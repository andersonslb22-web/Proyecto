import {
  statDefinitions,
  type MatchInput,
  type MatchStandings,
  type Measurement,
  type MeasurementStatus,
  type RecentVenueForm,
  type Sample,
  type SimpleWinOdds,
  type StatKey,
  type Team,
  type ValidationIssue,
} from './types.js'

type ParseResult =
  | { ok: true; value: MatchInput; issues: [] }
  | { ok: false; value: null; issues: ValidationIssue[] }

const samplePeriods = ['last_n_matches', 'season_to_date', 'date_range', 'single_match', 'unknown']
const sampleScopes = ['home', 'away', 'all', 'unknown']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function addIssue(issues: ValidationIssue[], path: string, message: string, category: ValidationIssue['category']) {
  issues.push({ path, message, category })
}

function checkKeys(
  value: Record<string, unknown>,
  allowed: string[],
  path: string,
  issues: ValidationIssue[],
) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) addIssue(issues, `${path}.${key}`, 'Propiedad no permitida en JSON v1.', 'inválido')
  }
}

function required(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: ValidationIssue[],
): unknown {
  if (!(key in value)) {
    addIssue(issues, `${path}.${key}`, 'Falta este campo requerido por el formato v1.', 'ausente')
    return undefined
  }
  return value[key]
}

function isString(value: unknown, path: string, issues: ValidationIssue[], allowEmpty = false): value is string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim() === '')) {
    addIssue(issues, path, 'Se esperaba texto no vacío.', 'inválido')
    return false
  }
  return true
}

function isNullableString(value: unknown, path: string, issues: ValidationIssue[]): value is string | null {
  return value === null || isString(value, path, issues, true)
}

function isNullableDate(value: unknown, path: string, issues: ValidationIssue[], dateTime = false): value is string | null {
  if (value === null) return true
  if (typeof value !== 'string') {
    addIssue(issues, path, 'Se esperaba una fecha ISO-8601 o null.', 'inválido')
    return false
  }
  const validFormat = dateTime
    ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value)
    : /^\d{4}-\d{2}-\d{2}$/.test(value)
  if (!validFormat || Number.isNaN(Date.parse(value))) {
    addIssue(issues, path, 'La fecha no tiene un formato ISO-8601 válido.', 'inválido')
    return false
  }
  return true
}

function parseSample(value: unknown, path: string, issues: ValidationIssue[]): Sample | null {
  if (!isRecord(value)) {
    addIssue(issues, path, 'Se esperaba el objeto de muestra.', 'inválido')
    return null
  }
  const keys = ['period', 'matches_count', 'from', 'to', 'scope', 'source_label']
  checkKeys(value, keys, path, issues)
  const period = required(value, 'period', path, issues)
  const matchesCount = required(value, 'matches_count', path, issues)
  const from = required(value, 'from', path, issues)
  const to = required(value, 'to', path, issues)
  const scope = required(value, 'scope', path, issues)
  const sourceLabel = required(value, 'source_label', path, issues)
  if (typeof period !== 'string' || !samplePeriods.includes(period)) addIssue(issues, `${path}.period`, 'Periodo no reconocido.', 'inválido')
  if (matchesCount !== null && (!Number.isInteger(matchesCount) || (matchesCount as number) < 0)) addIssue(issues, `${path}.matches_count`, 'Se esperaba un entero no negativo o null.', 'inválido')
  if (from !== null) isNullableDate(from, `${path}.from`, issues)
  if (to !== null) isNullableDate(to, `${path}.to`, issues)
  if (typeof scope !== 'string' || !sampleScopes.includes(scope)) addIssue(issues, `${path}.scope`, 'Ámbito de muestra no reconocido.', 'inválido')
  isNullableString(sourceLabel, `${path}.source_label`, issues)
  if (period === 'date_range' && (!from || !to)) addIssue(issues, path, 'El periodo date_range requiere from y to.', 'inválido')
  return {
    period: typeof period === 'string' && samplePeriods.includes(period) ? period as Sample['period'] : 'unknown',
    matches_count: typeof matchesCount === 'number' && Number.isInteger(matchesCount) ? matchesCount : null,
    from: typeof from === 'string' ? from : null,
    to: typeof to === 'string' ? to : null,
    scope: typeof scope === 'string' && sampleScopes.includes(scope) ? scope as Sample['scope'] : 'unknown',
    source_label: typeof sourceLabel === 'string' ? sourceLabel : null,
  }
}

function parseMeasurement(value: unknown, expectedUnit: string, path: string, issues: ValidationIssue[]): Measurement | null {
  if (!isRecord(value)) {
    addIssue(issues, path, 'Se esperaba una medición con valor, unidad y estado.', 'inválido')
    return null
  }
  checkKeys(value, ['value', 'unit', 'status', 'source_label'], path, issues)
  const measurementValue = required(value, 'value', path, issues)
  const unit = required(value, 'unit', path, issues)
  const status = required(value, 'status', path, issues)
  const sourceLabel = required(value, 'source_label', path, issues)
  if (typeof measurementValue !== 'number' && measurementValue !== null) addIssue(issues, `${path}.value`, 'El valor debe ser numérico o null; no se convierten textos.', 'inválido')
  if (typeof measurementValue === 'number' && !Number.isFinite(measurementValue)) addIssue(issues, `${path}.value`, 'El valor debe ser finito.', 'inválido')
  if (unit !== expectedUnit) addIssue(issues, `${path}.unit`, `La unidad canónica para esta medición es ${expectedUnit}.`, 'inválido')
  const statuses: MeasurementStatus[] = ['observed', 'estimated', 'missing', 'unknown', 'not_applicable']
  if (typeof status !== 'string' || !statuses.includes(status as MeasurementStatus)) addIssue(issues, `${path}.status`, 'Estado de medición no reconocido.', 'inválido')
  if ((status === 'observed' || status === 'estimated') && typeof measurementValue !== 'number') addIssue(issues, `${path}.value`, 'Una medición observada o estimada requiere un número.', 'inválido')
  if (status !== 'observed' && status !== 'estimated' && measurementValue !== null) addIssue(issues, `${path}.value`, 'Una medición no observada requiere value: null.', 'inválido')
  isNullableString(sourceLabel, `${path}.source_label`, issues)
  return {
    value: typeof measurementValue === 'number' && Number.isFinite(measurementValue) ? measurementValue : null,
    unit: typeof unit === 'string' ? unit : expectedUnit,
    status: typeof status === 'string' && statuses.includes(status as MeasurementStatus) ? status as MeasurementStatus : 'missing',
    source_label: typeof sourceLabel === 'string' ? sourceLabel : null,
  }
}

function parseRecentVenueForm(value: unknown, path: string, issues: ValidationIssue[]): RecentVenueForm | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) {
    addIssue(issues, path, 'Se esperaba la forma reciente por sede.', 'inválido')
    return undefined
  }
  checkKeys(value, ['sample', 'goals_scored', 'goals_conceded'], path, issues)
  const sample = parseSample(required(value, 'sample', path, issues), `${path}.sample`, issues)
  const goalsScored = parseMeasurement(required(value, 'goals_scored', path, issues), 'goals', `${path}.goals_scored`, issues)
  const goalsConceded = parseMeasurement(required(value, 'goals_conceded', path, issues), 'goals', `${path}.goals_conceded`, issues)
  if (!sample || !goalsScored || !goalsConceded) return undefined
  if (sample.period !== 'last_n_matches' || sample.matches_count === null || sample.matches_count <= 0) {
    addIssue(issues, path, 'La forma reciente requiere periodo last_n_matches y un conteo positivo.', 'inválido')
  }
  return { sample, goals_scored: goalsScored, goals_conceded: goalsConceded }
}

function parseAbsences(value: unknown, path: string, issues: ValidationIssue[]): Team['structural_absences'] {
  if (!Array.isArray(value)) {
    addIssue(issues, path, 'Se esperaba una lista de bajas estructurales.', 'inválido')
    return []
  }
  return value.flatMap((absence, index) => {
    const itemPath = `${path}[${index}]`
    if (!isRecord(absence)) {
      addIssue(issues, itemPath, 'Se esperaba un objeto de baja.', 'inválido')
      return []
    }
    checkKeys(absence, ['absence_id', 'is_structural', 'starter', 'confirmation'], itemPath, issues)
    const id = required(absence, 'absence_id', itemPath, issues)
    const structural = required(absence, 'is_structural', itemPath, issues)
    const starter = required(absence, 'starter', itemPath, issues)
    const confirmation = required(absence, 'confirmation', itemPath, issues)
    isString(id, `${itemPath}.absence_id`, issues)
    if (structural !== null && typeof structural !== 'boolean') addIssue(issues, `${itemPath}.is_structural`, 'Se esperaba boolean o null.', 'inválido')
    if (starter !== null && typeof starter !== 'boolean') addIssue(issues, `${itemPath}.starter`, 'Se esperaba boolean o null.', 'inválido')
    if (!['confirmed', 'unconfirmed', 'unknown'].includes(String(confirmation))) addIssue(issues, `${itemPath}.confirmation`, 'Confirmación no reconocida.', 'inválido')
    return [{
      absence_id: typeof id === 'string' ? id : '',
      is_structural: typeof structural === 'boolean' ? structural : null,
      starter: typeof starter === 'boolean' ? starter : null,
      confirmation: ['confirmed', 'unconfirmed', 'unknown'].includes(String(confirmation)) ? confirmation as Team['structural_absences'][number]['confirmation'] : 'unknown',
    }]
  })
}

function parseStandings(value: unknown, path: string, issues: ValidationIssue[]): MatchStandings | null {
  if (!isRecord(value)) {
    addIssue(issues, path, 'Se esperaba el objeto de clasificación.', 'inválido')
    return null
  }
  checkKeys(value, ['team_count', 'qualification_cutoff_position', 'source_label', 'teams'], path, issues)
  const teamCount = required(value, 'team_count', path, issues)
  const cutoff = required(value, 'qualification_cutoff_position', path, issues)
  const sourceLabel = required(value, 'source_label', path, issues)
  const rawTeams = required(value, 'teams', path, issues)
  if (!Number.isInteger(teamCount) || (teamCount as number) < 2) {
    addIssue(issues, `${path}.team_count`, 'Se esperaba un entero igual o mayor que dos.', 'inválido')
  }
  if (!Number.isInteger(cutoff) || (cutoff as number) < 1 || (cutoff as number) > (typeof teamCount === 'number' ? teamCount : 0)) {
    addIssue(issues, `${path}.qualification_cutoff_position`, 'El corte debe estar entre 1 y el tamaño de la tabla.', 'inválido')
  }
  isNullableString(sourceLabel, `${path}.source_label`, issues)
  if (!Array.isArray(rawTeams)) {
    addIssue(issues, `${path}.teams`, 'Se esperaba la lista de equipos del partido en la tabla.', 'inválido')
    return null
  }
  const teams = rawTeams.flatMap((rawTeam, index) => {
    const teamPath = `${path}.teams[${index}]`
    if (!isRecord(rawTeam)) {
      addIssue(issues, teamPath, 'Se esperaba una fila de clasificación.', 'inválido')
      return []
    }
    checkKeys(rawTeam, ['team_id', 'position', 'matches_played', 'points', 'goal_difference'], teamPath, issues)
    const teamId = required(rawTeam, 'team_id', teamPath, issues)
    const position = required(rawTeam, 'position', teamPath, issues)
    const matchesPlayed = required(rawTeam, 'matches_played', teamPath, issues)
    const points = required(rawTeam, 'points', teamPath, issues)
    const goalDifference = required(rawTeam, 'goal_difference', teamPath, issues)
    isString(teamId, `${teamPath}.team_id`, issues)
    if (!Number.isInteger(position) || (position as number) < 1 || (position as number) > (typeof teamCount === 'number' ? teamCount : 0)) {
      addIssue(issues, `${teamPath}.position`, 'El puesto debe estar dentro del tamaño de la tabla.', 'inválido')
    }
    if (!Number.isInteger(matchesPlayed) || (matchesPlayed as number) < 0) addIssue(issues, `${teamPath}.matches_played`, 'Se esperaba un entero no negativo.', 'inválido')
    if (!Number.isInteger(points)) addIssue(issues, `${teamPath}.points`, 'Se esperaba un total de puntos entero.', 'inválido')
    if (!Number.isInteger(goalDifference)) addIssue(issues, `${teamPath}.goal_difference`, 'Se esperaba una diferencia de goles entera.', 'inválido')
    if (typeof teamId !== 'string' || typeof position !== 'number' || typeof matchesPlayed !== 'number'
      || typeof points !== 'number' || typeof goalDifference !== 'number') return []
    return [{ team_id: teamId, position, matches_played: matchesPlayed, points, goal_difference: goalDifference }]
  })
  if (new Set(teams.map(({ team_id }) => team_id)).size !== teams.length) addIssue(issues, `${path}.teams`, 'Los team_id de la tabla deben ser únicos.', 'inválido')
  if (new Set(teams.map(({ position }) => position)).size !== teams.length) addIssue(issues, `${path}.teams`, 'Los puestos de la tabla deben ser únicos.', 'inválido')
  return {
    team_count: typeof teamCount === 'number' ? teamCount : 0,
    qualification_cutoff_position: typeof cutoff === 'number' ? cutoff : 0,
    source_label: typeof sourceLabel === 'string' ? sourceLabel : null,
    teams,
  }
}

function deriveUrgency(position: number, cutoff: number): Team['urgency'] {
  if (position > cutoff) return 'high'
  if (position >= cutoff - 2) return 'medium'
  return 'low'
}

function parseSimpleWinOdds(value: unknown, path: string, issues: ValidationIssue[]): SimpleWinOdds | null {
  if (!isRecord(value)) {
    addIssue(issues, path, 'Se esperaba el objeto de cuotas de victoria simple.', 'inválido')
    return null
  }
  checkKeys(value, ['home', 'away'], path, issues)
  const home = required(value, 'home', path, issues)
  const away = required(value, 'away', path, issues)
  for (const [key, odd] of [['home', home], ['away', away]] as const) {
    if (typeof odd !== 'number' || !Number.isFinite(odd) || odd <= 1) {
      addIssue(issues, `${path}.${key}`, 'La cuota decimal debe ser un número finito mayor que 1.', 'inválido')
    }
  }
  return typeof home === 'number' && Number.isFinite(home) && home > 1
    && typeof away === 'number' && Number.isFinite(away) && away > 1
    ? { home, away }
    : null
}

function parseTeam(value: unknown, path: string, issues: ValidationIssue[]): Team | null {
  if (!isRecord(value)) {
    addIssue(issues, path, 'Se esperaba el objeto del equipo.', 'inválido')
    return null
  }
  const keys = ['team_id', 'name', 'side', 'sample', 'urgency', 'urgency_context', 'urgency_adjustment', 'recent_venue_form', 'structural_absences', 'stats']
  checkKeys(value, keys, path, issues)
  const id = required(value, 'team_id', path, issues)
  const name = required(value, 'name', path, issues)
  const side = required(value, 'side', path, issues)
  const sample = parseSample(required(value, 'sample', path, issues), `${path}.sample`, issues)
  const urgency = value.urgency === undefined ? 'unknown' : value.urgency
  const urgencyContext = value.urgency_context === undefined ? undefined : value.urgency_context
  const urgencyAdjustment = parseMeasurement(required(value, 'urgency_adjustment', path, issues), 'goals', `${path}.urgency_adjustment`, issues)
  const recentVenueForm = parseRecentVenueForm(value.recent_venue_form, `${path}.recent_venue_form`, issues)
  const absences = parseAbsences(required(value, 'structural_absences', path, issues), `${path}.structural_absences`, issues)
  const absenceIds = absences.map(({ absence_id }) => absence_id)
  if (new Set(absenceIds).size !== absenceIds.length) addIssue(issues, `${path}.structural_absences`, 'Los absence_id deben ser únicos dentro del equipo.', 'inválido')
  const rawStats = required(value, 'stats', path, issues)
  isString(id, `${path}.team_id`, issues)
  isString(name, `${path}.name`, issues)
  if (side !== 'home' && side !== 'away') addIssue(issues, `${path}.side`, 'El lado debe ser home o away.', 'inválido')
  if (!['low', 'medium', 'high', 'unknown'].includes(String(urgency))) addIssue(issues, `${path}.urgency`, 'Urgencia no reconocida.', 'inválido')
  if (urgencyContext !== undefined && typeof urgencyContext !== 'string') addIssue(issues, `${path}.urgency_context`, 'El contexto de urgencia debe ser texto.', 'inválido')
  const stats = {} as Record<StatKey, Measurement>
  if (!isRecord(rawStats)) {
    addIssue(issues, `${path}.stats`, 'Se esperaba el objeto stats.', 'inválido')
    for (const definition of statDefinitions) stats[definition.key] = { value: null, unit: definition.unit, status: 'missing', source_label: null }
  } else {
    checkKeys(rawStats, statDefinitions.map(({ key }) => key), `${path}.stats`, issues)
    for (const definition of statDefinitions) {
      const rawMeasurement = rawStats[definition.key]
      stats[definition.key] = rawMeasurement === undefined
        ? { value: null, unit: definition.unit, status: 'missing', source_label: null }
        : parseMeasurement(rawMeasurement, definition.unit, `${path}.stats.${definition.key}`, issues)
          ?? { value: null, unit: definition.unit, status: 'missing', source_label: null }
    }
  }
  return {
    team_id: typeof id === 'string' ? id : '',
    name: typeof name === 'string' ? name : '',
    side: side === 'away' ? 'away' : 'home',
    sample: sample ?? { period: 'unknown', matches_count: null, from: null, to: null, scope: 'unknown', source_label: null },
    urgency: ['low', 'medium', 'high', 'unknown'].includes(String(urgency)) ? urgency as Team['urgency'] : 'unknown',
    ...(typeof urgencyContext === 'string' ? { urgency_context: urgencyContext } : {}),
    urgency_adjustment: urgencyAdjustment ?? { value: null, unit: 'goals', status: 'missing', source_label: null },
    ...(recentVenueForm ? { recent_venue_form: recentVenueForm } : {}),
    structural_absences: absences,
    stats,
  }
}

export function parseMatchInput(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const position = message.match(/position\s+(\d+)/i)
    let location = ''
    if (position) {
      const offset = Number(position[1])
      const preceding = text.slice(0, offset)
      location = ` (línea ${preceding.split('\n').length}, columna ${offset - preceding.lastIndexOf('\n')})`
    }
    return { ok: false, value: null, issues: [{ path: '$', message: `JSON malformado${location}. Revisa comas, comillas y llaves.`, category: 'formato' }] }
  }

  const issues: ValidationIssue[] = []
  if (!isRecord(raw)) {
    addIssue(issues, '$', 'La raíz debe ser un objeto JSON.', 'inválido')
    return { ok: false, value: null, issues }
  }
  checkKeys(raw, ['schema_version', 'match'], '$', issues)
  const version = required(raw, 'schema_version', '$', issues)
  if (version !== '1.0') addIssue(issues, '$.schema_version', 'La versión debe ser "1.0".', 'inválido')
  const rawMatch = required(raw, 'match', '$', issues)
  if (!isRecord(rawMatch)) {
    addIssue(issues, '$.match', 'Se esperaba el objeto del partido.', 'inválido')
    return { ok: false, value: null, issues }
  }
  checkKeys(rawMatch, ['match_id', 'competition', 'kickoff', 'teams', 'simple_win_odds', 'standings', 'home_advantage'], '$.match', issues)
  const matchId = required(rawMatch, 'match_id', '$.match', issues)
  const competition = required(rawMatch, 'competition', '$.match', issues)
  const kickoff = required(rawMatch, 'kickoff', '$.match', issues)
  const rawTeams = required(rawMatch, 'teams', '$.match', issues)
  const simpleWinOdds = parseSimpleWinOdds(required(rawMatch, 'simple_win_odds', '$.match', issues), '$.match.simple_win_odds', issues)
  const standings = rawMatch.standings === undefined || rawMatch.standings === null
    ? null
    : parseStandings(rawMatch.standings, '$.match.standings', issues)
  const homeAdvantage = parseMeasurement(required(rawMatch, 'home_advantage', '$.match', issues), 'goals', '$.match.home_advantage', issues)
  isString(matchId, '$.match.match_id', issues)
  isNullableString(competition, '$.match.competition', issues)
  isNullableDate(kickoff, '$.match.kickoff', issues, true)
  const teams = Array.isArray(rawTeams)
    ? rawTeams.map((team, index) => parseTeam(team, `$.match.teams[${index}]`, issues))
    : (addIssue(issues, '$.match.teams', 'Se esperaba una lista de exactamente dos equipos.', 'inválido'), [])
  if (teams.length !== 2) addIssue(issues, '$.match.teams', 'Se requieren exactamente dos equipos.', 'inválido')
  const validTeams = teams.filter((team): team is Team => team !== null)
  if (validTeams.length === 2) {
    if (validTeams[0].team_id === validTeams[1].team_id) addIssue(issues, '$.match.teams', 'Los identificadores de equipo deben ser distintos.', 'inválido')
    if (new Set(validTeams.map(({ side }) => side)).size !== 2) addIssue(issues, '$.match.teams', 'Debe haber un equipo home y otro away.', 'inválido')
  }
  if (standings && validTeams.length === 2) {
    const sourceContext = standings.source_label ? `; fuente ${standings.source_label}` : ''
    for (const team of validTeams) {
      const row = standings.teams.find(({ team_id }) => team_id === team.team_id)
      if (!row) {
        team.urgency = 'unknown'
        team.urgency_context = `desconocida: sin fila en tabla; corte ${standings.qualification_cutoff_position}/${standings.team_count}${sourceContext}`
        continue
      }
      if (row.matches_played === 0) {
        team.urgency = 'unknown'
        team.urgency_context = `desconocida: 0 partidos disputados; puesto ${row.position}/${standings.team_count}, corte ${standings.qualification_cutoff_position}${sourceContext}`
        continue
      }
      team.urgency = deriveUrgency(row.position, standings.qualification_cutoff_position)
      team.urgency_context = `puesto ${row.position}/${standings.team_count}, corte ${standings.qualification_cutoff_position}${sourceContext}`
    }
  }
  if (issues.length || validTeams.length !== 2) return { ok: false, value: null, issues }
  return {
    ok: true,
    issues: [],
    value: {
      schema_version: '1.0',
      match: {
        match_id: typeof matchId === 'string' ? matchId : '',
        competition: typeof competition === 'string' ? competition : null,
        kickoff: typeof kickoff === 'string' ? kickoff : null,
        teams: validTeams as [Team, Team],
        simple_win_odds: simpleWinOdds!,
        ...(standings ? { standings } : {}),
        home_advantage: homeAdvantage ?? { value: null, unit: 'goals', status: 'missing', source_label: null },
      },
    },
  }
}