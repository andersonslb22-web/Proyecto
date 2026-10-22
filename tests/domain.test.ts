import { describe, expect, it } from 'vitest'
import { calculateDerivedMetrics, compareObservedMeasurements } from '../src/domain/calculations'
import { issueLocation } from '../src/domain/issueLocation'
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
      home_advantage: { value: null, unit: 'goals', status: 'missing', source_label: null },
      simple_win_odds: { home: null, away: null },
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
    expect(statDefinitions).toHaveLength(21)
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

  it('accepts only simple decimal odds greater than one or null', () => {
    const raw = inputWith({}, {})
    raw.match.simple_win_odds = { home: 2.2, away: null }
    expect(parseMatchInput(JSON.stringify(raw)).ok).toBe(true)

    for (const invalidOdds of [1, 0, -1, '2.2']) {
      raw.match.simple_win_odds = { home: invalidOdds, away: null }
      expect(parseMatchInput(JSON.stringify(raw)).ok, String(invalidOdds)).toBe(false)
    }
  })

  it('rejects quote lists, under selections, and unknown odds fields', () => {
    const raw = inputWith({}, {}) as Record<string, unknown>
    const match = raw.match as Record<string, unknown>
    match.quotes = [{ market: 'total_goals', selection: 'under' }]
    expect(parseMatchInput(JSON.stringify(raw)).ok).toBe(false)

    delete match.quotes
    const odds = match.simple_win_odds as Record<string, unknown>
    odds.total_goals = 2
    expect(parseMatchInput(JSON.stringify(raw)).ok).toBe(false)
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