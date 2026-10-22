import { type DerivedMetric, type MatchInput, type Measurement, type Sample, type StatKey, type Team } from './types'

function observed(measurement: Measurement): measurement is Measurement & { value: number; status: 'observed' } {
  return measurement.status === 'observed' && typeof measurement.value === 'number' && Number.isFinite(measurement.value)
}

type ComparisonContext = {
  left: { sample: Sample; side: Team['side'] }
  right: { sample: Sample; side: Team['side'] }
}

function compatibleSampleContext(
  left: Measurement,
  right: Measurement,
  context: ComparisonContext,
): string | null {
  const { left: leftContext, right: rightContext } = context
  const leftSample = leftContext.sample
  const rightSample = rightContext.sample

  if (!leftSample.source_label?.trim() || leftSample.source_label !== rightSample.source_label
    || !left.source_label?.trim() || left.source_label !== right.source_label) {
    return 'Sin barras: la fuente explícita debe estar disponible e igual en ambos equipos.'
  }
  if (leftSample.period === 'unknown' || rightSample.period === 'unknown') {
    return 'Sin barras: el periodo de muestra es desconocido.'
  }
  if (leftSample.period !== rightSample.period) {
    return 'Sin barras: los periodos de muestra son incompatibles.'
  }
  if (leftSample.period === 'last_n_matches'
    && (!Number.isInteger(leftSample.matches_count) || leftSample.matches_count! <= 0
      || leftSample.matches_count !== rightSample.matches_count)) {
    return 'Sin barras: last_n_matches requiere el mismo conteo positivo en ambas muestras.'
  }
  if (leftSample.period === 'date_range'
    && (!leftSample.from || !leftSample.to || leftSample.from !== rightSample.from || leftSample.to !== rightSample.to)) {
    return 'Sin barras: date_range requiere fechas from y to iguales.'
  }
  if (leftSample.period === 'season_to_date'
    && (!Number.isInteger(leftSample.matches_count) || leftSample.matches_count! <= 0
      || leftSample.matches_count !== rightSample.matches_count
      || leftSample.from !== rightSample.from || leftSample.to !== rightSample.to)) {
    return 'Sin barras: season_to_date requiere conteos positivos y límites temporales compatibles.'
  }
  if (leftSample.period !== 'last_n_matches' && leftSample.period !== 'date_range' && leftSample.period !== 'season_to_date') {
    return 'Sin barras: no hay reglas aprobadas para comparar este periodo.'
  }

  const allScopes = leftSample.scope === 'all' && rightSample.scope === 'all'
  const homeAwayScopes = leftContext.side === 'home' && leftSample.scope === 'home'
    && rightContext.side === 'away' && rightSample.scope === 'away'
  const awayHomeScopes = leftContext.side === 'away' && leftSample.scope === 'away'
    && rightContext.side === 'home' && rightSample.scope === 'home'
  if (!allScopes && !homeAwayScopes && !awayHomeScopes) {
    return 'Sin barras: los ámbitos de muestra no corresponden a ambos equipos.'
  }
  return null
}

function sourceValue(team: Team, stat: StatKey): Measurement {
  return team.stats[stat]
}

export type PairedBarComparison = {
  leftPercent: number | null
  rightPercent: number | null
  status: string | null
}

export function compareObservedMeasurements(left: Measurement, right: Measurement, context: ComparisonContext): PairedBarComparison {
  if (left.status !== 'observed' || right.status !== 'observed' || left.value === null || right.value === null) {
    return { leftPercent: null, rightPercent: null, status: 'Sin barras: ambos valores deben estar observados.' }
  }
  if (!Number.isFinite(left.value) || !Number.isFinite(right.value) || left.unit !== right.unit) {
    return { leftPercent: null, rightPercent: null, status: 'Sin barras: valores numéricos o unidades incompatibles.' }
  }
  const contextIssue = compatibleSampleContext(left, right, context)
  if (contextIssue) return { leftPercent: null, rightPercent: null, status: contextIssue }
  if (left.value < 0 || right.value < 0) {
    return { leftPercent: null, rightPercent: null, status: 'Sin barras: no hay escala proporcional para valores negativos.' }
  }
  const maximum = Math.max(left.value, right.value)
  if (maximum === 0) {
    return { leftPercent: null, rightPercent: null, status: 'Sin escala comparativa: ambos valores son 0.' }
  }
  return {
    leftPercent: (left.value / maximum) * 100,
    rightPercent: (right.value / maximum) * 100,
    status: null,
  }
}

export function calculateDerivedMetrics(input: MatchInput): DerivedMetric[] {
  const home = input.match.teams.find(({ side }) => side === 'home')!
  const away = input.match.teams.find(({ side }) => side === 'away')!
  const metrics: DerivedMetric[] = []
  const homeXg = sourceValue(home, 'xg')
  const homeXga = sourceValue(home, 'xga')
  const awayXg = sourceValue(away, 'xg')
  const awayXga = sourceValue(away, 'xga')
  const finiteResult = (value: number) => Number.isFinite(value) ? value : null
  const homeNet = observed(homeXg) && observed(homeXga) ? finiteResult(homeXg.value - homeXga.value) : null
  const awayNet = observed(awayXg) && observed(awayXga) ? finiteResult(awayXg.value - awayXga.value) : null
  metrics.push({
    id: 'home_net_xg', label: `xG neto · ${home.name}`, value: homeNet, unit: 'goals',
    formula: 'xG observado - xGA observado', sources: [`${home.name}: xG`, `${home.name}: xGA`],
    status: homeNet === null ? 'not_evaluable' : 'observed',
  })
  metrics.push({
    id: 'away_net_xg', label: `xG neto · ${away.name}`, value: awayNet, unit: 'goals',
    formula: 'xG observado - xGA observado', sources: [`${away.name}: xG`, `${away.name}: xGA`],
    status: awayNet === null ? 'not_evaluable' : 'observed',
  })
  metrics.push({
    id: 'net_xg_difference', label: 'Diferencial de xG neto',
    value: homeNet !== null && awayNet !== null ? finiteResult(homeNet - awayNet) : null, unit: 'goals',
    formula: 'xG neto local - xG neto visitante', sources: ['xG y xGA observados de ambos equipos'],
    status: homeNet !== null && awayNet !== null && Number.isFinite(homeNet - awayNet) ? 'observed' : 'not_evaluable',
  })
  const totals: Array<{ key: StatKey; id: string; label: string }> = [
    { key: 'corners', id: 'gross_corners_total', label: 'Córners · total bruto observado' },
    { key: 'goals_scored', id: 'gross_goals_total', label: 'Goles · total bruto observado' },
    { key: 'xg', id: 'gross_xg_total', label: 'xG · total bruto observado' },
  ]
  for (const total of totals) {
    const homeMeasurement = sourceValue(home, total.key)
    const awayMeasurement = sourceValue(away, total.key)
    const ready = observed(homeMeasurement) && observed(awayMeasurement) && homeMeasurement.unit === awayMeasurement.unit
    metrics.push({
      id: total.id, label: total.label,
      value: ready ? finiteResult(homeMeasurement.value + awayMeasurement.value) : null,
      unit: homeMeasurement.unit,
      formula: 'valor observado local + valor observado visitante',
      sources: [`${home.name}: ${total.key}`, `${away.name}: ${total.key}`],
      status: ready && Number.isFinite(homeMeasurement.value + awayMeasurement.value) ? 'observed' : 'not_evaluable',
    })
  }
  return metrics
}