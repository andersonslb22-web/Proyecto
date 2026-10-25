import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { calculateDerivedMetrics, compareObservedMeasurements } from '../src/domain/calculations'
import { issueLocation } from '../src/domain/issueLocation'
import { analyzeMatch } from '../src/domain/engine'
import { parseMatchInput } from '../src/domain/parser'
import { statDefinitions } from '../src/domain/types'

function inputWith(statsHome: Record<string, unknown>, statsAway: Record<string, unknown> = {}) {
  const baseTeam = (teamId: string, name: string, side: string, stats: Record<string, unknown>) => ({
    team_id: teamId,
    name,
    side,
    sample: { period: 'unknown', matches_count: null, from: null, to: null, scope: 'unknown', source_label: null },
    urgency: 'unknown',
    urgency_adjustment: { value: null, unit: 'goals', status: 'missing', source_label: null },
    structural_absences: [],
    stats,
  })
  return {
    schema_version: '1.0',
    match: {
      match_id: 'TEST-1', competition: null, kickoff: null,
      simple_win_odds: { home: 2.2, away: 3.1 },
      home_advantage: { value: null, unit: 'goals', status: 'missing', source_label: null },
      teams: [baseTeam('home-1', 'Local', 'home', statsHome), baseTeam('away-1', 'Visitante', 'away', statsAway)],
    },
  }
}

function measurement(value: number, unit: string) {
  return { value, unit, status: 'observed', source_label: 'test' }
}

function comparisonContext(options: {
  leftPeriod?: 'last_n_matches' | 'season_to_date' | 'date_range' | 'single_match' | 'unknown'
  rightPeriod?: 'last_n_matches' | 'season_to_date' | 'date_range' | 'single_match' | 'unknown'
  leftCount?: number | null
  rightCount?: number | null
  leftFrom?: string | null
  rightFrom?: string | null
  leftTo?: string | null
  rightTo?: string | null
  leftScope?: 'home' | 'away' | 'all' | 'unknown'
  rightScope?: 'home' | 'away' | 'all' | 'unknown'
  leftSource?: string | null
  rightSource?: string | null
} = {}) {
  const sample = (side: 'home' | 'away', prefix: 'left' | 'right') => ({
    period: options[`${prefix}Period`] ?? 'last_n_matches',
    matches_count: options[`${prefix}Count`] === undefined ? 5 : options[`${prefix}Count`],
    from: options[`${prefix}From`] ?? null,
    to: options[`${prefix}To`] ?? null,
    scope: options[`${prefix}Scope`] ?? 'all',
    source_label: options[`${prefix}Source`] === undefined ? 'provider' : options[`${prefix}Source`],
  })
  return {
    left: { sample: sample('home', 'left'), side: 'home' as const },
    right: { sample: sample('away', 'right'), side: 'away' as const },
  }
}

describe('parser JSON v1', () => {
  it('conserva valores fuente de un fixture SINTETICO y declara las 18 estadísticas', () => {
    const raw = inputWith(
      {
        xg: measurement(1.7, 'goals'),
        possession_pct: measurement(53.25, 'percent'),
        cards: measurement(3, 'count'),
        duels_won: measurement(61, 'count'),
      },
      { xg: measurement(0.9, 'goals') },
    )
    raw.match.match_id = 'SYNTH-QA-001'
    raw.match.teams[0].name = 'Equipo sintético Norte'
    raw.match.teams[1].name = 'Equipo sintético Sur'

    const result = parseMatchInput(JSON.stringify(raw))
    expect(statDefinitions).toHaveLength(22)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.match.match_id).toBe('SYNTH-QA-001')
    expect(result.value.match.teams[0].stats.xg).toEqual(measurement(1.7, 'goals'))
    expect(result.value.match.teams[0].stats.possession_pct).toEqual(measurement(53.25, 'percent'))
    expect(result.value.match.teams[0].stats.cards).toEqual(measurement(3, 'count'))
    expect(result.value.match.teams[0].stats.duels_won).toEqual(measurement(61, 'count'))
  })

  it('accepts omitted statistics as missing without inventing zero', () => {
    const result = parseMatchInput(JSON.stringify(inputWith({}, {})))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.match.teams[0].stats.xg).toEqual({ value: null, unit: 'goals', status: 'missing', source_label: null })
    }
  })

  it('derives urgency from standings position relative to the qualification cutoff', () => {
    const cases = [
      { position: 25, expected: 'high' },
      { position: 24, expected: 'medium' },
      { position: 22, expected: 'medium' },
      { position: 21, expected: 'low' },
    ] as const

    for (const { position, expected } of cases) {
      const raw = inputWith({}, {})
      raw.match.standings = {
        team_count: 36,
        qualification_cutoff_position: 24,
        source_label: 'tabla de prueba',
        teams: [
          { team_id: 'home-1', position, matches_played: 2, points: 0, goal_difference: -4 },
          { team_id: 'away-1', position: 1, matches_played: 2, points: 6, goal_difference: 5 },
        ],
      }
      const result = parseMatchInput(JSON.stringify(raw))
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.match.teams.find(({ side }) => side === 'home')?.urgency).toBe(expected)
        expect(result.value.match.teams.find(({ side }) => side === 'home')?.urgency_context)
          .toBe(`puesto ${position}/36, corte 24; fuente tabla de prueba`)
      }
    }
  })

  it('keeps manual urgency when standings are absent and rejects invalid standings', () => {
    const manual = inputWith({}, {})
    manual.match.teams[0].urgency = 'high'
    const parsedManual = parseMatchInput(JSON.stringify(manual))
    expect(parsedManual.ok && parsedManual.value.match.teams[0].urgency).toBe('high')

    const nullUrgency = inputWith({}, {}) as unknown as {
      match: { teams: [{ urgency?: unknown }, { urgency?: unknown }] }
    }
    nullUrgency.match.teams[0].urgency = null
    expect(parseMatchInput(JSON.stringify(nullUrgency)).ok).toBe(false)

    const invalid = inputWith({}, {})
    invalid.match.standings = {
      team_count: 36,
      qualification_cutoff_position: 37,
      source_label: 'tabla de prueba',
      teams: [
        { team_id: 'home-1', position: 34, matches_played: 2, points: 0, goal_difference: -4 },
        { team_id: 'away-1', position: 35, matches_played: 2, points: 0, goal_difference: -5 },
      ],
    }
    expect(parseMatchInput(JSON.stringify(invalid)).ok).toBe(false)
  })

  it('leaves urgency unknown when the team has no played standings row', () => {
    const raw = inputWith({}, {})
    raw.match.teams[0].urgency = 'high'
    raw.match.standings = {
      team_count: 36,
      qualification_cutoff_position: 24,
      source_label: 'tabla de prueba',
      teams: [
        { team_id: 'other-home', position: 34, matches_played: 2, points: 0, goal_difference: -4 },
        { team_id: 'away-1', position: 35, matches_played: 0, points: 0, goal_difference: 0 },
      ],
    }
    const result = parseMatchInput(JSON.stringify(raw))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.match.teams.find(({ side }) => side === 'home')?.urgency).toBe('unknown')
      expect(result.value.match.teams.find(({ side }) => side === 'away')?.urgency).toBe('unknown')
      expect(result.value.match.teams.find(({ side }) => side === 'home')?.urgency_context)
        .toContain('sin fila en tabla; corte 24/36; fuente tabla de prueba')
      expect(result.value.match.teams.find(({ side }) => side === 'away')?.urgency_context)
        .toContain('0 partidos disputados; puesto 35/36, corte 24; fuente tabla de prueba')
    }
  })

  it('requires exactly one decimal quota for each simple-win side', () => {
    const raw = inputWith({}, {}) as { match: Record<string, unknown> }
    delete raw.match.simple_win_odds
    const missing = parseMatchInput(JSON.stringify(raw))
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.issues.some(({ path }) => path === '$.match.simple_win_odds')).toBe(true)

    raw.match.simple_win_odds = { home: 2.2, away: 3.1 }
    expect(parseMatchInput(JSON.stringify(raw)).ok).toBe(true)
    raw.match.simple_win_odds = { home: 1, away: 3.1 }
    expect(parseMatchInput(JSON.stringify(raw)).ok).toBe(false)
  })

  it('acepta el expediente ya enriquecido por el análisis local', () => {
    const parsed = parseMatchInput(JSON.stringify(inputWith({}, {})))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    parsed.value.match.teams[0].urgency_context = 'Contexto derivado para reenvío al API'
    expect(parseMatchInput(JSON.stringify(parsed.value)).ok).toBe(true)
  })

  it('rejects quote lists, under selections, and unknown odds fields', () => {
    const raw = inputWith({}, {}) as Record<string, unknown>
    const match = raw.match as Record<string, unknown>
    match.quotes = [{ market: 'total_goals', selection: 'under' }]
    expect(parseMatchInput(JSON.stringify(raw)).ok).toBe(false)

    delete match.quotes
    match.simple_win_odds = { home: 2.2, away: 3.1 }
    expect(parseMatchInput(JSON.stringify(raw)).ok).toBe(true)
  })

  it('rejects unknown fields, coercions, and markets outside the closed catalog', () => {
    const unknown = inputWith({}, {}) as Record<string, unknown>
    unknown.extra = true
    const unknownResult = parseMatchInput(JSON.stringify(unknown))
    expect(unknownResult.ok).toBe(false)
    expect(unknownResult.issues[0].path).toBe('$.extra')

    const wrongUnit = inputWith({ xg: measurement(1.2, 'count') })
    expect(parseMatchInput(JSON.stringify(wrongUnit)).ok).toBe(false)

    const legacyDuels = inputWith({ duels: measurement(61, 'count') })
    const legacyDuelsResult = parseMatchInput(JSON.stringify(legacyDuels))
    expect(legacyDuelsResult.ok).toBe(false)
    if (!legacyDuelsResult.ok) expect(legacyDuelsResult.issues.some(({ path }) => path.endsWith('.stats.duels'))).toBe(true)

    const outsideCatalog = inputWith({}, {})
    outsideCatalog.match.quotes = [{ quote_id: 'q1', market: 'btts', selection: 'yes', line_value: null, line_unit: 'none', odds_decimal: 2 }]
    expect(parseMatchInput(JSON.stringify(outsideCatalog)).ok).toBe(false)
  })

  it('determines the Asian-handicap favorite from the lower simple-win quota', () => {
    const raw = inputWith(
      { xg: measurement(2.1, 'goals'), xga: measurement(0.8, 'goals') },
      { xg: measurement(1.7, 'goals'), xga: measurement(1.2, 'goals') },
    )
    raw.match.simple_win_odds = { home: 3.1, away: 2.2 }
    const parsed = parseMatchInput(JSON.stringify(raw))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const candidates = analyzeMatch(parsed.value).markets.find(({ market }) => market === 'asian_handicap')!.candidates
    expect(candidates.map(({ candidate }) => [candidate.selection, candidate.team_id, candidate.line_value])).toEqual([
      ['favorite', 'away-1', -1.5],
      ['nonfavorite', 'home-1', 1.5],
    ])
  })

  it('leaves Asian-handicap sides undetermined when simple-win quotas tie', () => {
    const tiedOdds = inputWith(
      { xg: measurement(2, 'goals'), xga: measurement(1, 'goals') },
      { xg: measurement(1.5, 'goals'), xga: measurement(0.5, 'goals') },
    )
    tiedOdds.match.simple_win_odds = { home: 2.2, away: 2.2 }
    const parsed = parseMatchInput(JSON.stringify(tiedOdds))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      const candidates = analyzeMatch(parsed.value).markets.find(({ market }) => market === 'asian_handicap')!.candidates
      expect(candidates.every(({ candidate }) => candidate.team_id === null)).toBe(true)
    }
  })

  it('preserves draft text and reports malformed JSON with a location when available', () => {
    const result = parseMatchInput('{\n  "schema_version":')
    expect(result.ok).toBe(false)
    expect(result.issues[0].category).toBe('formato')
    expect(result.issues[0].message).toContain('JSON malformado')
  })
})

describe('ubicación de errores de equipo', () => {
  it('resuelve la ubicación por side aunque visitante aparezca primero', () => {
    const raw = inputWith({}, {})
    raw.match.teams.reverse()
    const issue = { path: '$.match.teams[0].name', message: 'Nombre inválido.', category: 'inválido' as const }
    expect(issueLocation(issue, JSON.stringify(raw))).toBe('Equipo visitante')
  })

  it('usa el índice como etiqueta neutral si el borrador no puede analizarse', () => {
    const issue = { path: '$.match.teams[1].name', message: 'Nombre inválido.', category: 'inválido' as const }
    expect(issueLocation(issue, '{')).toBe('Equipo 2')
  })
})

describe('barras comparativas pareadas', () => {
  it('escala una pareja asimétrica respecto al mayor valor observado', () => {
    const comparison = compareObservedMeasurements(measurement(80, 'count'), measurement(20, 'count'), comparisonContext())
    expect(comparison).toEqual({ leftPercent: 100, rightPercent: 25, status: null })
  })

  it('permite barras con muestras y fuentes coincidentes, y scope home-vs-away esperado', () => {
    const context = comparisonContext({ leftScope: 'home', rightScope: 'away' })
    const comparison = compareObservedMeasurements(measurement(80, 'count'), measurement(20, 'count'), context)
    expect(comparison).toEqual({ leftPercent: 100, rightPercent: 25, status: null })
  })

  it('bloquea barras cuando difiere la fuente de las estadísticas', () => {
    const right = { ...measurement(20, 'count'), source_label: 'provider-b' }
    const comparison = compareObservedMeasurements(measurement(80, 'count'), right, comparisonContext())
    expect(comparison.leftPercent).toBeNull()
    expect(comparison.rightPercent).toBeNull()
    expect(comparison.status).toContain('fuente explícita')
  })

  it.each([
    ['conteos last_n_matches distintos', comparisonContext({ leftCount: 5, rightCount: 10 })],
    ['periodos incompatibles', comparisonContext({ leftPeriod: 'last_n_matches', rightPeriod: 'date_range' })],
    ['fuentes distintas', comparisonContext({ leftSource: 'provider-a', rightSource: 'provider-b' })],
    ['rango date_range distinto', comparisonContext({ leftPeriod: 'date_range', rightPeriod: 'date_range', leftFrom: '2026-01-01', rightFrom: '2026-01-02', leftTo: '2026-02-01', rightTo: '2026-02-01' })],
    ['conteos season_to_date incompatibles', comparisonContext({ leftPeriod: 'season_to_date', rightPeriod: 'season_to_date', leftCount: 5, rightCount: 6 })],
    ['periodo desconocido', comparisonContext({ leftPeriod: 'unknown', rightPeriod: 'unknown' })],
    ['origen de muestra desconocido', comparisonContext({ leftSource: null, rightSource: null })],
    ['ámbito desconocido', comparisonContext({ leftScope: 'unknown', rightScope: 'unknown' })],
  ])('deshabilita barras ante %s', (_reason, context) => {
    const comparison = compareObservedMeasurements(measurement(80, 'count'), measurement(20, 'count'), context)
    expect(comparison.leftPercent).toBeNull()
    expect(comparison.rightPercent).toBeNull()
    expect(comparison.status).toMatch(/^Sin barras:/)
  })

  it('requiere un conteo positivo conocido para last_n_matches', () => {
    const context = comparisonContext({ leftCount: null, rightCount: null })
    const comparison = compareObservedMeasurements(measurement(80, 'count'), measurement(20, 'count'), context)
    expect(comparison.leftPercent).toBeNull()
    expect(comparison.status).toContain('conteo positivo')
  })

  it('no dibuja barras ni convierte un valor ausente en cero', () => {
    const missing = { value: null, unit: 'count', status: 'missing' as const, source_label: null }
    const comparison = compareObservedMeasurements(measurement(12, 'count'), missing)
    expect(comparison.leftPercent).toBeNull()
    expect(comparison.rightPercent).toBeNull()
    expect(comparison.status).toContain('ambos valores deben estar observados')
  })

  it('no inventa una escala cuando ambos valores son cero', () => {
    const comparison = compareObservedMeasurements(measurement(0, 'count'), measurement(0, 'count'), comparisonContext())
    expect(comparison.leftPercent).toBeNull()
    expect(comparison.rightPercent).toBeNull()
    expect(comparison.status).toContain('ambos valores son 0')
  })

  it('no compara unidades incompatibles', () => {
    const comparison = compareObservedMeasurements(measurement(50, 'percent'), measurement(50, 'count'))
    expect(comparison.leftPercent).toBeNull()
    expect(comparison.rightPercent).toBeNull()
    expect(comparison.status).toContain('unidades incompatibles')
  })
})

describe('derivadas observables', () => {
  it('calcula las seis métricas nuevas con el fixture sintético', () => {
    const parsed = parseMatchInput(readFileSync(new URL('./fixtures/test_juventus_lazio.json', import.meta.url), 'utf8'))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const metrics = calculateDerivedMetrics(parsed.value)
    const expected = {
      home_goals_per_shot_pct: 1.5 / 18.3 * 100,
      away_goals_per_shot_pct: 1.8 / 13.5 * 100,
      home_xgot_to_xg_ratio: 1.75 / 1.62,
      away_xgot_to_xg_ratio: 1.57 / 1.6,
      home_blocked_shot_rate_pct: 4.8 / 18.3 * 100,
      away_blocked_shot_rate_pct: 3 / 13.5 * 100,
      home_off_target_rate_pct: 7 / 18.3 * 100,
      away_off_target_rate_pct: 6.2 / 13.5 * 100,
      home_errors_to_shot_rate_pct: (1 / 6) / 18.3 * 100,
      away_errors_to_shot_rate_pct: (1 / 6) / 13.5 * 100,
      home_corners_per_100_possession: 8.7 / 58.7 * 100,
      away_corners_per_100_possession: 4.8 / 49.5 * 100,
    }

    for (const [id, value] of Object.entries(expected)) {
      const metric = metrics.find((item) => item.id === id)
      expect(metric?.value).toBeCloseTo(value)
      expect(metric?.status).toBe('observed')
    }
  })

  it('marks new metrics not evaluable for zero denominators and missing sources', () => {
    const parsed = parseMatchInput(readFileSync(new URL('./fixtures/test_juventus_lazio.json', import.meta.url), 'utf8'))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const zeroDenominator = structuredClone(parsed.value)
    zeroDenominator.match.teams[0].stats.shots_total = {
      value: 0, unit: 'count', status: 'observed', source_label: 'test',
    }
    const zeroMetrics = calculateDerivedMetrics(zeroDenominator)
    for (const id of [
      'home_goals_per_shot_pct', 'home_blocked_shot_rate_pct',
      'home_off_target_rate_pct', 'home_errors_to_shot_rate_pct',
    ]) {
      const metric = zeroMetrics.find((item) => item.id === id)
      expect(metric?.value).toBeNull()
      expect(metric?.status).toBe('not_evaluable')
    }

    zeroDenominator.match.teams[0].stats.xg = {
      value: 0, unit: 'goals', status: 'observed', source_label: 'test',
    }
    const zeroXgMetric = calculateDerivedMetrics(zeroDenominator)
      .find((item) => item.id === 'home_xgot_to_xg_ratio')
    expect(zeroXgMetric?.value).toBeNull()
    expect(zeroXgMetric?.status).toBe('not_evaluable')

    const missingSource = structuredClone(parsed.value)
    missingSource.match.teams[0].stats.possession_pct = {
      value: null, unit: 'percent', status: 'missing', source_label: null,
    }
    const missingMetrics = calculateDerivedMetrics(missingSource)
    const metric = missingMetrics.find((item) => item.id === 'home_corners_per_100_possession')
    expect(metric?.value).toBeNull()
    expect(metric?.status).toBe('not_evaluable')

    missingSource.match.teams[0].stats.goals_scored = {
      value: null, unit: 'goals', status: 'missing', source_label: null,
    }
    const missingNumeratorMetric = calculateDerivedMetrics(missingSource)
      .find((item) => item.id === 'home_goals_per_shot_pct')
    expect(missingNumeratorMetric?.value).toBeNull()
    expect(missingNumeratorMetric?.status).toBe('not_evaluable')
  })

  it('calculates xG neto and bruto totals only from observed, matching-unit values', () => {
    const raw = inputWith(
      { xg: measurement(1.7, 'goals'), xga: measurement(0.8, 'goals'), corners: measurement(6, 'count'), goals_scored: measurement(2, 'goals') },
      { xg: measurement(1.1, 'goals'), xga: measurement(1.3, 'goals'), corners: measurement(4, 'count'), goals_scored: measurement(1, 'goals') },
    )
    const parsed = parseMatchInput(JSON.stringify(raw))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const metrics = calculateDerivedMetrics(parsed.value)
    expect(metrics.find(({ id }) => id === 'home_net_xg')?.value).toBeCloseTo(0.9)
    expect(metrics.find(({ id }) => id === 'net_xg_difference')?.value).toBeCloseTo(1.1)
    expect(metrics.find(({ id }) => id === 'gross_corners_total')?.value).toBe(10)
    expect(metrics.find(({ id }) => id === 'gross_goals_total')?.value).toBe(3)
  })

  it('marks a derived value not evaluable when a source is missing', () => {
    const parsed = parseMatchInput(JSON.stringify(inputWith({ xg: measurement(1, 'goals') }, {})))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const metrics = calculateDerivedMetrics(parsed.value)
    expect(metrics.find(({ id }) => id === 'home_net_xg')?.status).toBe('not_evaluable')
    expect(metrics.find(({ id }) => id === 'gross_corners_total')?.value).toBeNull()
  })

  it('marks arithmetic overflow as not evaluable and never returns an infinite value', () => {
    const parsed = parseMatchInput(JSON.stringify(inputWith(
      { xg: measurement(Number.MAX_VALUE, 'goals'), xga: measurement(-Number.MAX_VALUE, 'goals'), corners: measurement(Number.MAX_VALUE, 'count') },
      { xg: measurement(0, 'goals'), xga: measurement(0, 'goals'), corners: measurement(Number.MAX_VALUE, 'count') },
    )))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const metrics = calculateDerivedMetrics(parsed.value)
    for (const id of ['home_net_xg', 'gross_corners_total']) {
      const metric = metrics.find((item) => item.id === id)
      expect(metric?.status).toBe('not_evaluable')
      expect(metric?.value).toBeNull()
    }
    expect(metrics.every(({ value }) => value === null || Number.isFinite(value))).toBe(true)
  })

  it('marks an overflowing xG differential not evaluable even when both net values are finite', () => {
    const parsed = parseMatchInput(JSON.stringify(inputWith(
      { xg: measurement(Number.MAX_VALUE, 'goals'), xga: measurement(0, 'goals') },
      { xg: measurement(-Number.MAX_VALUE, 'goals'), xga: measurement(0, 'goals') },
    )))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const metric = calculateDerivedMetrics(parsed.value).find(({ id }) => id === 'net_xg_difference')
    expect(metric?.status).toBe('not_evaluable')
    expect(metric?.value).toBeNull()
  })
})