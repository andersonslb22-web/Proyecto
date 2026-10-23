export const statDefinitions = [
  { key: 'goals_scored', label: 'Goles', group: 'Ofensiva', unit: 'goals' },
  { key: 'xg', label: 'xG', group: 'Ofensiva', unit: 'goals' },
  { key: 'xgot', label: 'xGOT', group: 'Ofensiva', unit: 'goals' },
  { key: 'shots_total', label: 'Disparos totales', group: 'Ofensiva', unit: 'count' },
  { key: 'shots_on_target', label: 'Tiros a puerta', group: 'Ofensiva', unit: 'count' },
  { key: 'shots_off_target', label: 'Disparos desviados', group: 'Ofensiva', unit: 'count' },
  { key: 'blocked_shots', label: 'Tiros bloqueados', group: 'Ofensiva', unit: 'count' },
  { key: 'crosses', label: 'Centros por partido', group: 'Ofensiva', unit: 'count' },
  { key: 'big_chances_created', label: 'Grandes ocasiones creadas', group: 'Ofensiva', unit: 'count' },
  { key: 'big_chances_missed', label: 'Ocasiones claras falladas', group: 'Ofensiva', unit: 'count' },
  { key: 'possession_pct', label: 'Posesión', group: 'Ritmo', unit: 'percent' },
  { key: 'passes_opposition_half', label: 'Pases en campo contrario', group: 'Ritmo', unit: 'count' },
  { key: 'corners', label: 'Córners', group: 'Ritmo', unit: 'count' },
  { key: 'goals_conceded', label: 'Goles recibidos', group: 'Defensa y portería', unit: 'goals' },
  { key: 'xga', label: 'xGA', group: 'Defensa y portería', unit: 'goals' },
  { key: 'goals_prevented', label: 'Goles evitados', group: 'Defensa y portería', unit: 'goals' },
  { key: 'clearances', label: 'Despejes', group: 'Defensa y portería', unit: 'count' },
  { key: 'errors', label: 'Errores que conducen al gol', group: 'Defensa y portería', unit: 'count' },
  { key: 'errors_leading_to_shot', label: 'Errores que llevan a disparo', group: 'Defensa y portería', unit: 'count' },
  { key: 'fouls', label: 'Faltas', group: 'Fricción', unit: 'count' },
  { key: 'cards', label: 'Tarjetas', group: 'Fricción', unit: 'count' },
  { key: 'duels_won', label: 'Duelos ganados', group: 'Fricción', unit: 'count' },
] as const

export type StatKey = (typeof statDefinitions)[number]['key']
export type StatGroup = (typeof statDefinitions)[number]['group']
export type MeasurementStatus = 'observed' | 'estimated' | 'missing' | 'unknown' | 'not_applicable'
export type Measurement = {
  value: number | null
  unit: string
  status: MeasurementStatus
  source_label: string | null
}
export type Sample = {
  period: 'last_n_matches' | 'season_to_date' | 'date_range' | 'single_match' | 'unknown'
  matches_count: number | null
  from: string | null
  to: string | null
  scope: 'home' | 'away' | 'all' | 'unknown'
  source_label: string | null
}
export type StructuralAbsence = {
  absence_id: string
  is_structural: boolean | null
  starter: boolean | null
  confirmation: 'confirmed' | 'unconfirmed' | 'unknown'
}
export type RecentVenueForm = {
  sample: Sample
  goals_scored: Measurement
  goals_conceded: Measurement
}
export type Team = {
  team_id: string
  name: string
  side: 'home' | 'away'
  sample: Sample
  urgency: 'low' | 'medium' | 'high' | 'unknown'
  urgency_context?: string
  urgency_adjustment: Measurement
  recent_venue_form?: RecentVenueForm
  structural_absences: StructuralAbsence[]
  stats: Record<StatKey, Measurement>
}
export type StandingsTeam = {
  team_id: string
  position: number
  matches_played: number
  points: number
  goal_difference: number
}
export type MatchStandings = {
  team_count: number
  qualification_cutoff_position: number
  source_label: string | null
  teams: StandingsTeam[]
}
export type SimpleWinOdds = {
  home: number
  away: number
}
export type Market =
  | 'simple_win'
  | 'double_chance'
  | 'asian_handicap'
  | 'total_goals'
  | 'total_corners'
  | 'team_goals'
export type CandidateSelection = 'home' | 'away' | '1X' | 'X2' | 'OVER' | 'favorite' | 'nonfavorite' | 'undetermined'
export type Candidate = {
  candidate_id: string
  market: Market
  selection: CandidateSelection
  team_id: string | null
  line_value: number | null
  line_unit: 'goals' | 'corners' | 'none'
}
export type Match = {
  match_id: string
  competition: string | null
  kickoff: string | null
  teams: [Team, Team]
  simple_win_odds: SimpleWinOdds
  standings?: MatchStandings
  home_advantage: Measurement
}
export type MatchInput = { schema_version: '1.0'; match: Match }
export type ValidationIssue = {
  path: string
  message: string
  category: 'formato' | 'ausente' | 'inválido'
}
export type DerivedMetric = {
  id: string
  label: string
  value: number | null
  unit: string
  formula: string
  sources: string[]
  status: 'observed' | 'not_evaluable'
}