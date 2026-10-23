import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyzeMatch, mopScalingLevels } from '../src/domain/engine'
import { parseMatchInput } from '../src/domain/parser'
import { statDefinitions, type MatchInput, type Team } from '../src/domain/types'

function readFixture(path: URL): MatchInput {
  const result = parseMatchInput(readFileSync(path, 'utf8'))
  if (!result.ok) throw new Error(result.issues.map(({ path: issuePath, message }) => `${issuePath}: ${message}`).join('\n'))
  return result.value
}

const juventusFixture = readFixture(new URL('./fixtures/test_juventus_lazio.json', import.meta.url))
const lilleFixture = readFixture(new URL('../examples/partido.json', import.meta.url))

function syntheticInput(): MatchInput {
  const values: Record<string, number> = {
    goals_scored: 2, xg: 2.4, xgot: 2, shots_total: 14, shots_on_target: 6,
    shots_off_target: 5, blocked_shots: 3, big_chances_created: 3, big_chances_missed: 0,
    possession_pct: 55, passes_opposition_half: 200, corners: 6, goals_conceded: 0.5,
    crosses: 6,
    xga: 0.5, goals_prevented: 0.1, clearances: 10, errors: 0, errors_leading_to_shot: 0,
    fouls: 10, cards: 1, duels_won: 40,
  }
  const createTeam = (teamId: string, side: Team['side'], updates: Record<string, number> = {}): Team => ({
    team_id: teamId,
    name: side === 'home' ? 'Aster' : 'Boreal',
    side,
    sample: { period: 'season_to_date', matches_count: 6, from: null, to: null, scope: 'all', source_label: 'synthetic test vector' },
    urgency: 'high',
    urgency_adjustment: { value: 0, unit: 'goals', status: 'observed', source_label: 'synthetic test vector' },
    structural_absences: [],
    stats: Object.fromEntries(statDefinitions.map(({ key, unit }) => [key, {
      value: updates[key] ?? values[key] ?? 0,
      unit,
      status: 'observed',
      source_label: 'synthetic test vector',
    }])) as Team['stats'],
  })
  return {
    schema_version: '1.0',
    match: {
      match_id: 'SYNTHETIC-RULE-TEST',
      competition: 'Competición sintética de pruebas',
      kickoff: null,
      teams: [
        createTeam('synthetic-home', 'home'),
        createTeam('synthetic-away', 'away', {
          goals_scored: 2, xg: 1.6, xga: 1.2, goals_conceded: 1.5,
          goals_prevented: 0.1, errors: 1, shots_on_target: 5, big_chances_created: 3,
        }),
      ],
      simple_win_odds: { home: 2.2, away: 3.1 },
      home_advantage: { value: 0.2, unit: 'goals', status: 'observed', source_label: 'synthetic test vector' },
    },
  }
}

describe('motor determinista con cuota de victoria simple', () => {
  it('genera los candidatos del catálogo a partir del expediente', () => {
    const analysis = analyzeMatch(syntheticInput())
    expect(analysis.markets.map(({ market, candidates }) => [market, candidates.length])).toEqual([
      ['simple_win', 2],
      ['double_chance', 2],
      ['asian_handicap', 2],
      ['total_goals', 1],
      ['total_corners', 1],
      ['team_goals', 2],
    ])
  })

  it('determina favorito asiático con la cuota menor de victoria simple', () => {
    const candidates = analyzeMatch(lilleFixture).markets.find(({ market }) => market === 'asian_handicap')!.candidates
    expect(candidates.map(({ candidate }) => [candidate.selection, candidate.team_id, candidate.line_value])).toEqual([
      ['favorite', 'lille', -1.5],
      ['nonfavorite', 'galatasaray', 1.5],
    ])
  })

  it('mantiene los lados por cuota aunque falte xG/xGA o el xG neto empate', () => {
    const missing = syntheticInput()
    missing.match.teams[0].stats.xga = { value: null, unit: 'goals', status: 'missing', source_label: null }
    const missingCandidates = analyzeMatch(missing).markets.find(({ market }) => market === 'asian_handicap')!.candidates
    expect(missingCandidates.every(({ candidate }) => candidate.team_id !== null)).toBe(true)

    const tied = syntheticInput()
    tied.match.teams[0].stats.xg.value = 2
    tied.match.teams[0].stats.xga.value = 1
    tied.match.teams[1].stats.xg.value = 1.5
    tied.match.teams[1].stats.xga.value = 0.5
    const tiedCandidates = analyzeMatch(tied).markets.find(({ market }) => market === 'asian_handicap')!.candidates
    expect(tiedCandidates.every(({ candidate }) => candidate.team_id !== null)).toBe(true)
  })

  it('calcula victoria simple únicamente con xG neto y aplica el gate aunque el score supere 50', () => {
    const local = analyzeMatch(lilleFixture).markets.find(({ market }) => market === 'simple_win')!.candidates[0]
    expect(local.score).toBe(77.5)
    expect(local.scoreTrace?.entries.find(({ label }) => label.includes('Urgencia alta'))?.label)
      .toContain('puesto 34/36, corte 24; fuente Partido.txt')
    expect(local.gate.status).toBe('fail')
    expect(local.gate.projection).toBeCloseTo(-0.61)
    expect(local.gate.threshold).toBe(0.4)
    expect(local.gate.mop).toBeCloseTo(-1.01)
    expect(local.status).toBe('REJECT')
  })

  it('estima home_advantage y evalúa doble oportunidad cuando falta el input explícito', () => {
    const input = structuredClone(lilleFixture)
    const analysis = analyzeMatch(input)
    expect(input.match.home_advantage).toEqual({
      value: 0.364,
      unit: 'goals',
      status: 'estimated',
      source_label: 'Cálculo algorítmico interno basado en rendimiento local/visitante reciente y temporada',
    })
    const doubleChance = analysis.markets.find(({ market }) => market === 'double_chance')!.candidates
    expect(doubleChance.every(({ gate }) => gate.status !== 'not_evaluable')).toBe(true)
  })

  it('conserva la urgencia y su fuente cuando el score queda no evaluable', () => {
    const input = structuredClone(lilleFixture)
    const lille = input.match.teams.find(({ team_id }) => team_id === 'lille')!
    lille.stats.goals_prevented = { value: null, unit: 'goals', status: 'missing', source_label: null }

    const local = analyzeMatch(input).markets.find(({ market }) => market === 'simple_win')!.candidates[0]
    expect(local.status).toBe('not_evaluable')
    expect(local.trace).toContain('Urgencia high de Lille: puesto 34/36, corte 24; fuente Partido.txt · Clasificación UEFA Champions League · tras 2 jornadas.')
  })

  it('explica una urgencia desconocida en la ruta no evaluable', () => {
    const raw = JSON.parse(readFileSync(new URL('../examples/partido.json', import.meta.url), 'utf8')) as {
      match: { standings: { teams: { team_id: string; matches_played: number }[] } }
    }
    const lilleRow = raw.match.standings!.teams.find(({ team_id }) => team_id === 'lille')!
    lilleRow.matches_played = 0
    const parsed = parseMatchInput(JSON.stringify(raw))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const lille = parsed.value.match.teams.find(({ team_id }) => team_id === 'lille')!
    lille.stats.goals_prevented = { value: null, unit: 'goals', status: 'missing', source_label: null }
    const local = analyzeMatch(parsed.value).markets.find(({ market }) => market === 'simple_win')!.candidates[0]

    expect(lille.urgency).toBe('unknown')
    expect(local.status).toBe('not_evaluable')
    expect(local.trace).toContain('Urgencia unknown de Lille: desconocida: 0 partidos disputados; puesto 34/36, corte 24; fuente Partido.txt · Clasificación UEFA Champions League · tras 2 jornadas.')
  })

  it('calcula el gate y escalado de goles totales solo desde estadísticas', () => {
    const totalGoals = analyzeMatch(syntheticInput()).markets.find(({ market }) => market === 'total_goals')!.candidates[0]
    expect(totalGoals.gate.status).toBe('pass')
    expect(totalGoals.gate.projection).toBe(4)
    expect(totalGoals.gate.threshold).toBe(2.7)
    expect(totalGoals.gate.mop).toBeCloseTo(1.3)
    expect(totalGoals.route).toBe('scaled')
    expect(totalGoals.scaled?.candidate.line_value).toBe(2.5)
    const scaledTrace = totalGoals.scaled!.scoreTrace!
    expect(scaledTrace.entries.reduce((sum, entry) => sum + entry.scorePoints, 0)).toBe(scaledTrace.finalScore)
  })

  it('calcula respaldo de córners con centros, territorio y disparos totales', () => {
    const corners = analyzeMatch(syntheticInput()).markets.find(({ market }) => market === 'total_corners')!.candidates[0]
    const confirmationPoints = corners.scoreTrace!.entries
      .filter(({ group }) => group === 'confirmation')
      .reduce((sum, entry) => sum + entry.scorePoints, 0)
    const supportPoints = corners.scoreTrace!.entries
      .filter(({ group }) => group === 'support')
      .reduce((sum, entry) => sum + entry.scorePoints, 0)

    expect(corners.score).toBe(90)
    expect(confirmationPoints).toBe(55)
    expect(supportPoints).toBe(35)
    expect(corners.scoreTrace!.entries.find(({ label }) => label === 'Centros combinados')?.matrixPoints).toBe(20)
    expect(corners.scoreTrace!.entries.find(({ label }) => label === 'Pases combinados en campo contrario')?.matrixPoints).toBe(15)
    expect(corners.scoreTrace!.entries.find(({ label }) => label === 'Disparos totales combinados')?.matrixPoints).toBe(0)
  })

  it('calcula 90 para los córners de partido.json tras la penalización', () => {
    const corners = analyzeMatch(lilleFixture).markets.find(({ market }) => market === 'total_corners')!.candidates[0]
    expect(corners.score).toBe(90)
    expect(corners.scoreTrace!.entries.filter(({ group }) => group === 'support')
      .reduce((sum, entry) => sum + entry.scorePoints, 0)).toBe(45)
    expect(corners.penalties).toContain('Ocasiones claras falladas >= 2.0: -10 al subtotal normalizado de confirmación.')
  })

  it('deja córners no evaluables si falta el proxy de centros', () => {
    const input = syntheticInput()
    input.match.teams[0].stats.crosses = { value: null, unit: 'count', status: 'missing', source_label: null }
    const corners = analyzeMatch(input).markets.find(({ market }) => market === 'total_corners')!.candidates[0]

    expect(corners.status).toBe('not_evaluable')
    expect(corners.score).toBeNull()
    expect(corners.trace).toContain('Faltan métricas observadas para calcular la matriz de score o sus penalizaciones.')
  })

  it('conserva un desglose exacto de score para la ruta fallback', () => {
    const input = syntheticInput()
    input.match.teams[0].stats.goals_scored = { value: null, unit: 'goals', status: 'missing', source_label: null }
    input.match.teams[1].stats.goals_scored = { value: null, unit: 'goals', status: 'missing', source_label: null }
    input.match.teams[0].stats.xg.value = 1.5
    input.match.teams[1].stats.xg.value = 1
    const totalGoals = analyzeMatch(input).markets.find(({ market }) => market === 'total_goals')!.candidates[0]
    expect(totalGoals.route).toBe('fallback')
    expect(totalGoals.fallback?.status).toBe('ELIGIBLE')
    const fallbackTrace = totalGoals.fallback!.scoreTrace!
    expect(fallbackTrace.entries.reduce((sum, entry) => sum + entry.scorePoints, 0)).toBe(fallbackTrace.finalScore)
  })

  it('expone aportes normalizados y descuentos que cuadran con el score final', () => {
    const input = syntheticInput()
    input.match.teams[0].stats.big_chances_missed.value = 2
    input.match.teams[0].stats.fouls.value = 13
    input.match.teams[1].stats.fouls.value = 13
    input.match.teams[1].stats.goals_prevented.value = 1.2
    input.match.teams[0].structural_absences.push({
      absence_id: 'synthetic-confirmed-starter',
      confirmation: 'confirmed',
      starter: true,
      is_structural: true,
    })

    const local = analyzeMatch(input).markets.find(({ market }) => market === 'simple_win')!.candidates[0]
    const scoreTrace = local.scoreTrace!
    const penaltyEntries = scoreTrace.entries.filter(({ group }) => group === 'penalty')
    expect(penaltyEntries.map(({ scorePoints }) => scorePoints)).toEqual([-10, -5, -10, -15])
    expect(scoreTrace.entries.reduce((sum, entry) => sum + entry.scorePoints, 0)).toBe(local.score)
    expect(scoreTrace.finalScore).toBe(local.score)
  })

  it('explica el ajuste cuando las penalizaciones llevan el score bajo cero', () => {
    const input = syntheticInput()
    const home = input.match.teams[0]
    const away = input.match.teams[1]
    home.stats.goals_scored.value = 0.5
    home.stats.goals_conceded.value = 0.7
    home.stats.goals_prevented.value = 0
    home.stats.big_chances_missed.value = 2
    home.urgency = 'low'
    home.stats.fouls.value = 13
    away.stats.fouls.value = 13
    away.stats.goals_conceded.value = 0.5
    away.stats.errors.value = 0
    away.stats.goals_prevented.value = 1.2
    home.structural_absences = Array.from({ length: 3 }, (_, index) => ({
      absence_id: `synthetic-absence-${index}`,
      confirmation: 'confirmed' as const,
      starter: true,
      is_structural: true,
    }))

    const local = analyzeMatch(input).markets.find(({ market }) => market === 'simple_win')!.candidates[0]
    const scoreTrace = local.scoreTrace!
    expect(local.score).toBe(0)
    expect(scoreTrace.entries.find(({ group }) => group === 'limit')?.scorePoints).toBeGreaterThan(0)
    expect(scoreTrace.entries.reduce((sum, entry) => sum + entry.scorePoints, 0)).toBe(0)
  })

  it('mantiene score menor a 50 como rechazo terminal cuando falta xGA', () => {
    const local = analyzeMatch(juventusFixture).markets.find(({ market }) => market === 'simple_win')!.candidates[0]
    expect(local.score).toBe(0)
    expect(local.gate.status).toBe('not_evaluable')
    expect(local.status).toBe('REJECT')
    expect(local.trace).toContain('Score < 50: rechazo terminal; no se intenta fallback.')
  })

  it('conserva los límites definidos para el escalado MOP', () => {
    expect([-0.01, 0, 0.499, 0.5, 1.1, 1.1001, 1.1999, 1.2].map(mopScalingLevels))
      .toEqual([0, 0, 0, 1, 1, 1, 1, 2])
  })
})