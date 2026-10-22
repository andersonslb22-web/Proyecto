import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyzeMatch, expectedValuePasses, mopScalingLevels } from '../src/domain/engine'
import { parseMatchInput } from '../src/domain/parser'
import { buildAlternateSummaries } from '../src/domain/routeSummary'
import { statDefinitions, type MatchInput, type Market, type Quote, type Team } from '../src/domain/types'

const fixtureText = readFileSync(new URL('./fixtures/test_juventus_lazio.json', import.meta.url), 'utf8')
const fixtureResult = parseMatchInput(fixtureText)
if (!fixtureResult.ok) throw new Error(fixtureResult.issues.map(({ path, message }) => `${path}: ${message}`).join('\n'))
const fixture = fixtureResult.value
const lilleFixtureText = readFileSync(new URL('../examples/partido.json', import.meta.url), 'utf8')
const lilleFixtureResult = parseMatchInput(lilleFixtureText)
if (!lilleFixtureResult.ok) throw new Error(lilleFixtureResult.issues.map(({ path, message }) => `${path}: ${message}`).join('\n'))
const lilleFixture = lilleFixtureResult.value

function syntheticInput(): MatchInput {
  const values: Record<string, number> = {
    goals_scored: 2, xg: 2.4, xgot: 2, shots_total: 14, shots_on_target: 6,
    shots_off_target: 5, blocked_shots: 3, big_chances_created: 3, big_chances_missed: 0,
    possession_pct: 55, passes_opposition_half: 200, corners: 6, goals_conceded: 0.5,
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
      home_advantage: { value: 0.2, unit: 'goals', status: 'observed', source_label: 'synthetic test vector' },
      quotes: [],
    },
  }
}

function quote(market: Market, selection: string, line: number | null, odds = 2, teamId: string | null = null): Quote {
  const lineUnit = market === 'total_corners' ? 'corners'
    : market === 'simple_win' || market === 'double_chance' ? 'none' : 'goals'
  return {
    quote_id: `${market}-${selection}-${line ?? 'none'}-${odds}`,
    market,
    selection,
    team_id: teamId,
    line_value: line,
    line_unit: lineUnit,
    odds_decimal: odds,
  }
}

describe('fixture fuente Juventus-Lazio', () => {
  it('lee el JSON del disco y conserva cifras exactas, estados y trazabilidad', () => {
    expect(fixture.match.teams.map(({ sample }) => sample)).toEqual(fixture.match.teams.map(() => ({
      period: 'season_to_date', matches_count: 6, from: null, to: null, scope: 'all',
      source_label: 'Sofascore · Serie A 26/27',
    })))
    const juventus = fixture.match.teams.find(({ side }) => side === 'home')!
    const lazio = fixture.match.teams.find(({ side }) => side === 'away')!
    expect([
      juventus.stats.goals_scored.value, juventus.stats.xg.value, juventus.stats.xgot.value,
      juventus.stats.shots_total.value, juventus.stats.shots_on_target.value, juventus.stats.shots_off_target.value,
      juventus.stats.blocked_shots.value, juventus.stats.big_chances_created.value,
      juventus.stats.big_chances_missed.value, juventus.stats.possession_pct.value,
      juventus.stats.passes_opposition_half.value, juventus.stats.corners.value,
      juventus.stats.goals_conceded.value, juventus.stats.goals_prevented.value,
      juventus.stats.clearances.value, juventus.stats.errors.value, juventus.stats.fouls.value,
      juventus.stats.cards.value, juventus.stats.duels_won.value,
    ]).toEqual([1.5, 1.62, 1.75, 18.3, 6.5, 7.0, 4.8, 3.0, 2.0, 58.7, 311, 8.7, 0.8, -0.55, 15.2, 0, 13.7, 1.5, 42.3])
    expect([
      lazio.stats.goals_scored.value, lazio.stats.xg.value, lazio.stats.xgot.value,
      lazio.stats.shots_total.value, lazio.stats.shots_on_target.value, lazio.stats.shots_off_target.value,
      lazio.stats.blocked_shots.value, lazio.stats.big_chances_created.value,
      lazio.stats.big_chances_missed.value, lazio.stats.possession_pct.value,
      lazio.stats.passes_opposition_half.value, lazio.stats.corners.value,
      lazio.stats.goals_conceded.value, lazio.stats.goals_prevented.value,
      lazio.stats.clearances.value, lazio.stats.errors.value, lazio.stats.fouls.value,
      lazio.stats.cards.value, lazio.stats.duels_won.value,
    ]).toEqual([1.8, 1.60, 1.57, 13.5, 4.3, 6.2, 3.0, 2.8, 1.5, 49.5, 208, 4.8, 0.7, 4.36, 21.0, 0, 13.2, 1.8, 40.0])
    expect(juventus.stats.xga).toMatchObject({ value: null, status: 'missing' })
    expect(lazio.stats.xga).toMatchObject({ value: null, status: 'missing' })
    expect(fixture.match.home_advantage).toMatchObject({ value: null, status: 'missing' })
    expect(fixture.match.kickoff).toBeNull()
    expect(fixture.match.teams.every(({ urgency, urgency_adjustment }) => urgency === 'unknown'
      && urgency_adjustment.status === 'missing')).toBe(true)
    expect(fixture.match.teams.flatMap(({ structural_absences }) => structural_absences)
      .every(({ confirmation, starter, is_structural }) => confirmation === 'confirmed'
        && starter === null && is_structural === null)).toBe(true)
    expect(juventus.stats.errors_leading_to_shot.value).toBe(1 / 6)
    expect(juventus.stats.errors_leading_to_shot.source_label).toContain('1 error en 6 partidos')
    expect(fixture.match.quotes.map(({ market, selection, odds_decimal }) => [market, selection, odds_decimal]))
      .toEqual([['simple_win', 'home', 1.55], ['simple_win', 'away', 6]])
  })

  it('rechaza score <50 aunque xGA/localía falten y conserva el gate no evaluable', () => {
    const withDoubleChance = structuredClone(fixture)
    withDoubleChance.match.quotes.push(quote('double_chance', '1X', null))
    const result = analyzeMatch(withDoubleChance)
    const simpleWin = result.markets.find(({ market }) => market === 'simple_win')!.candidates
    expect(simpleWin.map(({ status }) => status)).toEqual(['REJECT', 'REJECT'])
    expect(simpleWin.every(({ gate }) => gate.status === 'not_evaluable')).toBe(true)
    const doubleChance = result.markets.find(({ market }) => market === 'double_chance')!.candidates[0]
    expect(doubleChance.status).toBe('REJECT')
    expect(doubleChance.gate.status).toBe('not_evaluable')
  })

  it('calcula score y aplica REJECT <50 aunque el gate de xG sea no evaluable', () => {
    const evaluation = analyzeMatch(fixture).markets.find(({ market }) => market === 'simple_win')!
      .candidates.find(({ quote: item }) => item.selection === 'home')!
    expect(evaluation.gate.status).toBe('not_evaluable')
    expect(evaluation.score).toBe(0)
    expect(evaluation.status).toBe('REJECT')
    expect(evaluation.fallbackQuoteId).toBeNull()
  })
})

describe('ejemplo canónico transcrito de Partido.txt', () => {
  it('parsea Lille-Galatasaray y conserva las estadísticas fuente exactas', () => {
    expect(lilleFixture.match.match_id).toBe('LILLE-GALATASARAY-UEFA-CHAMPIONS-LEAGUE-2026-10-21')
    expect(lilleFixture.match.competition).toBe('Fútbol · UEFA Champions League · Ronda 3')
    expect(lilleFixture.match.kickoff).toBeNull()
    const lille = lilleFixture.match.teams.find(({ side }) => side === 'home')!
    const galatasaray = lilleFixture.match.teams.find(({ side }) => side === 'away')!
    expect([lille.team_id, galatasaray.team_id]).toEqual(['lille', 'galatasaray'])
    expect(lille.sample).toMatchObject({ period: 'season_to_date', matches_count: 7, scope: 'all' })
    expect(galatasaray.sample).toMatchObject({ period: 'season_to_date', matches_count: 8, scope: 'all' })
    expect(lille.sample.source_label).toContain('Partido.txt')
    expect(galatasaray.sample.source_label).toContain('Partido.txt')

    const expectedLille = [1.4, 1.5, 2.03, 12.3, 5.4, 4.3, 2.6, 2.6, 1.7, 50.1, 179, 3.3, 0.7, 0.92, 1.52, 26.9, 0, 8 / 7, 11.7, 1.3, 47.3]
    const expectedGalatasaray = [2.1, 2.33, 2.14, 22.4, 7.6, 9.6, 5.1, 4.1, 3.1, 60.3, 219, 7.5, 1.4, 1.14, -2.08, 23.4, 2 / 8, 7 / 8, 12.0, 1.6 + 2 / 8, 47.3]
    const statKeys = statDefinitions.map(({ key }) => key)
    expect(statKeys.map((key) => lille.stats[key].value)).toEqual(expectedLille)
    expect(statKeys.map((key) => galatasaray.stats[key].value)).toEqual(expectedGalatasaray)
    expect(lille.stats.xga.source_label).toContain('(derivado, marcado así en la fuente; valor consignado)')
    expect(galatasaray.stats.xga.source_label).toContain('(derivado, marcado así en la fuente; valor consignado)')
    expect(lille.stats.cards.source_label).toContain('1.3 + 0/7')
    expect(galatasaray.stats.cards.source_label).toContain('1.6 + 2/8')
    expect(lille.stats.errors_leading_to_shot.source_label).toContain('8 errores / 7 partidos')
    expect(galatasaray.stats.errors.source_label).toContain('2 errores / 8 partidos')
    expect(galatasaray.stats.errors_leading_to_shot.source_label).toContain('7 errores / 8 partidos')
    expect(lille.stats.xga.value).toBe(0.92)
    expect(galatasaray.stats.xga.value).toBe(1.14)
  })

  it('preserva los faltantes, bajas indeterminadas y las cuotas ingresadas', () => {
    expect(lilleFixture.match.home_advantage).toMatchObject({ value: null, status: 'missing' })
    expect(lilleFixture.match.teams.every(({ urgency, urgency_adjustment }) => urgency === 'unknown'
      && urgency_adjustment.value === null && urgency_adjustment.status === 'missing')).toBe(true)
    expect(lilleFixture.match.teams.flatMap(({ structural_absences }) => structural_absences)
      .every(({ confirmation, starter, is_structural }) => confirmation === 'confirmed'
        && starter === null && is_structural === null)).toBe(true)
    expect(lilleFixture.match.quotes.map(({ market, selection, odds_decimal, team_id, line_value }) => [market, selection, odds_decimal, team_id, line_value]))
      .toEqual([
        ['simple_win', 'home', 2.2, null, null],
        ['simple_win', 'away', 3.1, null, null],
        ['double_chance', '1X', 1.36, null, null],
        ['double_chance', 'X2', 1.67, null, null],
        ['asian_handicap_negative', 'home', 4.0, null, -1.5],
        ['total_corners', 'over', 1.29, null, 6.5],
        ['total_corners', 'under', 3.5, null, 6.5],
        ['total_goals', 'over', 1.33, null, 1.5],
        ['total_goals', 'under', 3.2, null, 1.5],
        ['team_goals', 'over', 1.29, 'lille', 0.5],
        ['team_goals', 'over', 1.4, 'galatasaray', 0.5],
      ])
    expect(lilleFixture.match.quotes).toHaveLength(11)
  })
})

describe('motor determinista con vectores sintéticos separados', () => {
  it('aplica el ajuste de faltas combinadas 26.9 como -5 score y +0.5 buffer asiático', () => {
    const input = syntheticInput()
    input.match.teams[0].stats.goals_scored.value = 3
    input.match.teams[1].stats.goals_conceded.value = 0.5
    input.match.teams[0].stats.fouls.value = 13.7
    input.match.teams[1].stats.fouls.value = 13.2
    const handicap = quote('asian_handicap_negative', 'home', -0.5, 10)
    input.match.quotes = [handicap]
    const evaluation = analyzeMatch(input).markets.find(({ market }) => market === 'asian_handicap_negative')!.candidates[0]
    expect(evaluation.gate.threshold).toBeCloseTo(2.3)
    expect(evaluation.penalties).toContain('Faltas combinadas >= 26: -5 puntos.')
  })

  it('resta 10 al subtotal ofensivo desde big_chances_missed >= 2.0', () => {
    const input = syntheticInput()
    const teamId = input.match.teams[0].team_id
    const teamQuote = quote('team_goals', 'over', 0.5, 2, teamId)
    input.match.quotes = [teamQuote]
    const baseline = analyzeMatch(input).markets.find(({ market }) => market === 'team_goals')!.candidates[0]
    input.match.teams[0].stats.big_chances_missed.value = 2.0
    const penalized = analyzeMatch(input).markets.find(({ market }) => market === 'team_goals')!.candidates[0]
    expect(baseline.score! - penalized.score!).toBe(10)
    expect(penalized.penalties).toContain('Ocasiones claras falladas >= 2.0: -10 al subtotal normalizado de confirmación.')
  })

  it('no recompensa errores rivales como respaldo para goles individuales under', () => {
    const input = syntheticInput()
    const teamId = input.match.teams[0].team_id
    input.match.teams[0].stats.goals_scored.value = 1
    input.match.teams[0].stats.xg.value = 1
    input.match.teams[0].stats.shots_on_target.value = 3
    input.match.teams[0].stats.big_chances_created.value = 2
    input.match.teams[1].stats.goals_conceded.value = 1.5
    input.match.teams[1].stats.errors.value = 1
    input.match.quotes = [quote('team_goals', 'under', 2.5, 2, teamId)]

    const withErrors = analyzeMatch(input).markets.find(({ market }) => market === 'team_goals')!.candidates[0]
    input.match.teams[1].stats.errors.value = 0
    const withoutErrors = analyzeMatch(input).markets.find(({ market }) => market === 'team_goals')!.candidates[0]

    expect(withErrors.score).toBeLessThan(withoutErrors.score!)
  })

  it('rechaza score < 50 de forma terminal aunque haya cuota alta', () => {
    const input = syntheticInput()
    input.match.teams[0].stats.goals_scored.value = 0.5
    input.match.teams[0].stats.goals_conceded.value = 0.7
    input.match.teams[0].stats.goals_prevented.value = 0
    input.match.teams[0].stats.xg.value = 1.6
    input.match.teams[0].stats.xga.value = 0.5
    input.match.teams[1].stats.xg.value = 1
    input.match.teams[1].stats.xga.value = 1
    input.match.teams[1].stats.goals_conceded.value = 0.5
    input.match.teams[1].stats.errors.value = 0
    const winQuote = quote('simple_win', 'home', null, 20)
    input.match.quotes = [winQuote]
    const evaluation = analyzeMatch(input).markets.find(({ market }) => market === 'simple_win')!.candidates[0]
    expect(evaluation.score).toBeLessThan(50)
    expect(evaluation.status).toBe('REJECT')
    expect(evaluation.fallbackQuoteId).toBeNull()
    expect(evaluation.trace).toContain('Score < 50: rechazo terminal antes de +EV; no se intenta fallback.')
  })

  it('no aplica -10 a bajas confirmadas cuando starter/is_structural son null', () => {
    const input = syntheticInput()
    input.match.teams[0].structural_absences.push({
      absence_id: 'synthetic-absence-1', confirmation: 'confirmed', starter: null, is_structural: null,
    })
    input.match.quotes = [quote('team_goals', 'over', 0.5, 2, input.match.teams[0].team_id)]
    const evaluation = analyzeMatch(input).markets.find(({ market }) => market === 'team_goals')!.candidates[0]
    expect(evaluation.status).toBe('ELIGIBLE')
    expect(evaluation.penalties.some((penalty) => penalty.includes('baja(s)'))).toBe(false)
  })

  it('aplica MOP simétrico para over/under y respeta los límites de escalado', () => {
    const input = syntheticInput()
    const over = quote('total_goals', 'over', 1.5)
    const under = quote('total_goals', 'under', 1.5)
    input.match.quotes = [over, under]
    const candidates = analyzeMatch(input).markets.find(({ market }) => market === 'total_goals')!.candidates
    expect(candidates[0].gate.threshold).toBeCloseTo(2.7)
    expect(candidates[0].gate.mop).toBeCloseTo(1.3)
    expect(candidates[1].gate.threshold).toBeCloseTo(0.3)
    expect(candidates[1].gate.mop).toBeCloseTo(-3.7)
    expect([-0.01, 0, 0.499, 0.5, 1.1, 1.1001, 1.1999, 1.2].map(mopScalingLevels))
      .toEqual([0, 0, 0, 1, 1, 1, 1, 2])
  })

  it('usa +EV estricta y escala solo cuando existe la cuota de la línea objetivo', () => {
    expect(expectedValuePasses(55, 2)).toBe(false)
    expect(expectedValuePasses(55.01, 2)).toBe(true)
    const input = syntheticInput()
    const base = quote('total_goals', 'over', 1.5)
    const target = quote('total_goals', 'over', 2.5)
    input.match.quotes = [base, target]
    const evaluation = analyzeMatch(input).markets.find(({ market }) => market === 'total_goals')!.candidates[0]
    expect(evaluation.status).toBe('ELIGIBLE')
    expect(evaluation.scaledQuoteId).toBe(target.quote_id)
    input.match.quotes = [base]
    const withoutTarget = analyzeMatch(input).markets.find(({ market }) => market === 'total_goals')!.candidates[0]
    expect(withoutTarget.scaledQuoteId).toBeNull()
    expect(withoutTarget.trace).toContain('Escalado no disponible: no hay cuota para la línea objetivo exacta.')
  })

  it('recalcula fallback solo con una línea cotizada y nunca acepta BTTS', () => {
    const input = syntheticInput()
    const risky = quote('total_goals', 'over', 3.5)
    const conservative = quote('total_goals', 'over', 2.5, 2)
    input.match.quotes = [risky, conservative]
    const evaluation = analyzeMatch(input).markets.find(({ market }) => market === 'total_goals')!.candidates[0]
    expect(evaluation.status).toBe('REJECT')
    expect(evaluation.route).toBe('fallback')
    expect(evaluation.fallbackQuoteId).toBe(conservative.quote_id)
    expect(evaluation.fallbackStatus).toBe('ELIGIBLE')
    const raw = structuredClone(input) as unknown as { match: { quotes: unknown[] } }
    raw.match.quotes = [{ ...risky, market: 'btts', selection: 'yes' }]
    expect(parseMatchInput(JSON.stringify({ schema_version: '1.0', match: raw.match })).ok).toBe(false)
  })

  it('expone score, gate, EV y trazabilidad calculados para fallback y escalado', () => {
    const fallbackInput = syntheticInput()
    const risky = quote('total_goals', 'over', 3.5)
    const conservative = quote('total_goals', 'over', 2.5)
    fallbackInput.match.quotes = [risky, conservative]
    const fallbackAnalysis = analyzeMatch(fallbackInput)
    const fallbackCandidate = fallbackAnalysis.markets.find(({ market }) => market === 'total_goals')!.candidates[0]
    const fallbackSummary = buildAlternateSummaries(fallbackCandidate, fallbackAnalysis)[0]

    expect(fallbackSummary).toMatchObject({
      route: 'fallback',
      quote: { quote_id: conservative.quote_id, line_value: 2.5, odds_decimal: 2 },
      status: 'ELIGIBLE',
      score: expect.any(Number),
      impliedProbability: 50,
      expectedValue: true,
      gate: { status: 'pass', projection: expect.any(Number), threshold: expect.any(Number), mop: expect.any(Number) },
    })
    expect(fallbackSummary.trace.length).toBeGreaterThan(0)

    const scaledInput = syntheticInput()
    const base = quote('total_goals', 'over', 1.5)
    const raised = quote('total_goals', 'over', 2.5)
    scaledInput.match.quotes = [base, raised]
    const scaledAnalysis = analyzeMatch(scaledInput)
    const scaledCandidate = scaledAnalysis.markets.find(({ market }) => market === 'total_goals')!.candidates[0]
    const scaledSummary = buildAlternateSummaries(scaledCandidate, scaledAnalysis)[0]

    expect(scaledSummary).toMatchObject({
      route: 'scaled',
      quote: { quote_id: raised.quote_id, line_value: 2.5, odds_decimal: 2 },
      score: expect.any(Number),
      expectedValue: expect.any(Boolean),
      gate: { status: expect.any(String), projection: expect.any(Number), threshold: expect.any(Number), mop: expect.any(Number) },
    })
    expect(scaledSummary.trace.length).toBeGreaterThan(0)
  })

  it('calcula gates de líneas cero sin inventar límites de parser en el motor', () => {
    const input = syntheticInput()
    const teamId = input.match.teams[0].team_id
    input.match.quotes = [
      quote('total_goals', 'over', 0),
      quote('total_corners', 'over', 0),
      quote('team_goals', 'under', 0, 2, teamId),
    ]
    const candidates = analyzeMatch(input).markets.flatMap(({ candidates: items }) => items)
    expect(candidates.map(({ gate }) => gate.threshold)).toEqual([1.2, 3.5, -0.8])
    expect(candidates.every(({ gate }) => gate.projection !== null && gate.mop !== null)).toBe(true)
  })

  it('invierte correctamente las bandas ofensivas de team_goals under', () => {
    const input = syntheticInput()
    const teamId = input.match.teams[0].team_id
    input.match.teams[0].stats.shots_on_target.value = 3
    input.match.teams[0].stats.big_chances_created.value = 1
    input.match.teams[0].urgency = 'low'
    input.match.teams[1].stats.goals_conceded.value = 0.5
    input.match.quotes = [quote('team_goals', 'under', 2.5, 2.2, teamId)]

    input.match.teams[0].stats.goals_scored.value = 1.4
    input.match.teams[0].stats.xg.value = 1.4
    const modest = analyzeMatch(input).markets.find(({ market }) => market === 'team_goals')!.candidates[0]
    expect(modest.scoreExplanation).toContain('Confirmación: Goles y xG del equipo 15/25.')

    input.match.teams[0].stats.goals_scored.value = 1.2
    input.match.teams[0].stats.xg.value = 1.2
    const productive = analyzeMatch(input).markets.find(({ market }) => market === 'team_goals')!.candidates[0]
    expect(productive.scoreExplanation).toContain('Confirmación: Goles y xG del equipo 25/25.')
    expect(productive.score! - modest.score!).toBe(10)
  })
})
