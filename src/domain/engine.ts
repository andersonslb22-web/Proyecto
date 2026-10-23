import type { Candidate, MatchInput, Market, Measurement, Team } from './types.js'

export type GateStatus = 'pass' | 'fail' | 'not_evaluable'
export type DecisionStatus = 'ELIGIBLE' | 'REJECT' | 'not_evaluable'
export type EvaluationRoute = 'primary' | 'scaled' | 'fallback' | 'no_fallback'

export type ScoreTraceEntry = {
  group: 'confirmation' | 'support' | 'penalty' | 'limit'
  label: string
  scorePoints: number
  matrixPoints?: number
  matrixMaximum?: number
}

export type ScoreTrace = {
  entries: ScoreTraceEntry[]
  rawScore: number
  finalScore: number
}

export type RouteEvaluation = {
  candidate: Candidate
  status: DecisionStatus
  score: number | null
  scoreTrace: ScoreTrace | null
  gate: {
    status: GateStatus
    projection: number | null
    threshold: number | null
    mop: number | null
    unit: string
    explanation: string
  }
  penalties: string[]
  trace: string[]
}

export type CandidateEvaluation = {
  candidate: Candidate
  status: DecisionStatus
  route: EvaluationRoute
  score: number | null
  scoreTrace: ScoreTrace | null
  gate: {
    status: GateStatus
    projection: number | null
    threshold: number | null
    mop: number | null
    unit: string
    explanation: string
  }
  scoreExplanation: string[]
  penalties: string[]
  trace: string[]
  scaled: RouteEvaluation | null
  fallback: RouteEvaluation | null
}

export type MarketResult = {
  market: Market
  candidates: CandidateEvaluation[]
}

export type MatchAnalysis = { markets: MarketResult[] }

type GateProjection = CandidateEvaluation['gate']
type ScoreCalculation = { score: number; explanation: string[]; penalties: string[]; trace: ScoreTrace }
type ScoreFactor = { points: number; max: number; label: string }

const markets: Market[] = [
  'simple_win', 'double_chance', 'asian_handicap',
  'total_goals', 'total_corners', 'team_goals',
]

function observed(measurement: Measurement | undefined): number | null {
  return measurement?.status === 'observed'
    && typeof measurement.value === 'number'
    && Number.isFinite(measurement.value)
    ? measurement.value
    : null
}

function numericMeasurement(measurement: Measurement | undefined): number | null {
  return (measurement?.status === 'observed' || measurement?.status === 'estimated')
    && typeof measurement.value === 'number'
    && Number.isFinite(measurement.value)
    ? measurement.value
    : null
}

function stat(team: Team, key: keyof Team['stats']): number | null {
  return observed(team.stats[key])
}

function teamBySide(input: MatchInput, side: Team['side']): Team {
  return input.match.teams.find((team) => team.side === side)!
}

function teamById(input: MatchInput, teamId: string | null): Team | null {
  return input.match.teams.find((team) => team.team_id === teamId) ?? null
}

function candidateTeam(input: MatchInput, candidate: Candidate): Team | null {
  if (candidate.market === 'team_goals' || candidate.market === 'asian_handicap') return teamById(input, candidate.team_id)
  if (candidate.market === 'simple_win') {
    return teamBySide(input, candidate.selection as Team['side'])
  }
  if (candidate.market === 'double_chance') return teamBySide(input, candidate.selection === '1X' ? 'home' : 'away')
  return null
}

function sampleIssue(team: Team): string | null {
  if (team.sample.period !== 'season_to_date') return `${team.name}: se requiere muestra season_to_date.`
  if (!Number.isInteger(team.sample.matches_count) || team.sample.matches_count === null || team.sample.matches_count <= 0) {
    return `${team.name}: matches_count debe ser mayor que cero.`
  }
  if (!['home', 'away', 'all'].includes(team.sample.scope)) return `${team.name}: el alcance de la muestra no es válido.`
  return null
}

function validSamples(input: MatchInput): string | null {
  return input.match.teams.map(sampleIssue).find((issue) => issue !== null) ?? null
}

function netXg(team: Team): number | null {
  const xg = stat(team, 'xg')
  const xga = stat(team, 'xga')
  return xg === null || xga === null ? null : xg - xga
}

function getProjection(input: MatchInput, candidate: Candidate): GateProjection {
  const home = teamBySide(input, 'home')
  const away = teamBySide(input, 'away')
  const team = candidateTeam(input, candidate)
  const rival = team ? input.match.teams.find((item) => item.team_id !== team.team_id)! : null
  let projection: number | null = null
  let threshold: number | null = null
  let unit = 'goles'
  let explanation = ''

  if (candidate.market === 'simple_win' || candidate.market === 'double_chance') {
    const ownNet = netXg(team!)
    const rivalNet = netXg(rival!)
    threshold = candidate.market === 'simple_win' ? 0.4 : 0.15
    if (ownNet === null || rivalNet === null) return unavailableGate('xG neto requiere xG y xGA observados de ambos equipos.', threshold, unit)
    if (candidate.market === 'double_chance') {
      const advantage = numericMeasurement(input.match.home_advantage)
      if (advantage === null) return unavailableGate('Falta la ventaja local explícita requerida para doble oportunidad.', threshold, unit)
      projection = ownNet + (team!.side === 'home' ? advantage : -advantage) - rivalNet
      explanation = 'xG neto del equipo + ventaja local firmada - xG neto rival.'
    } else {
      projection = ownNet - rivalNet
      explanation = 'xG neto del equipo - xG neto rival.'
    }
  } else if (candidate.market === 'asian_handicap') {
    if (!team || !rival || candidate.line_value === null) return unavailableGate('No se puede determinar favorito y no favorito: se requiere xG y xGA observados y distintos para ambos equipos.', 1.3, unit)
    const goals = stat(team, 'goals_scored')
    const conceded = stat(rival, 'goals_conceded')
    const adjustment = observed(team.urgency_adjustment) ?? 0
    const fouls = combinedFouls(input)
    if (fouls === null) return unavailableGate('Faltan los promedios de faltas combinadas requeridos para ajustar el colchón.', 1.3, unit)
    if (goals === null || conceded === null) return unavailableGate('Faltan goles promedio del equipo o goles concedidos por el rival.', 1.3, unit)
    projection = goals - conceded + adjustment + candidate.line_value
    threshold = 1.3 + (fouls >= 26 ? 0.5 : 0)
    explanation = `Goles anotados - goles concedidos rival + ajuste (${adjustment}) + línea ${candidate.line_value}${fouls >= 26 ? ' · umbral +0.5 por faltas' : ''}.`
  } else if (candidate.market === 'total_corners') {
    const homeCorners = stat(home, 'corners')
    const awayCorners = stat(away, 'corners')
    const fouls = combinedFouls(input)
    if (homeCorners === null || awayCorners === null) return unavailableGate('Faltan promedios de córners de uno o ambos equipos.', null, 'córners')
    if (fouls === null) return unavailableGate('Faltan faltas combinadas para evaluar el colchón dinámico.', null, 'córners')
    projection = homeCorners + awayCorners
    threshold = candidate.line_value! + 3.5 + (fouls >= 26 ? 0.5 : 0)
    unit = 'córners'
    explanation = `Suma de córners; colchón ${threshold - candidate.line_value!} aplicado a OVER ${candidate.line_value}.`
  } else if (candidate.market === 'total_goals') {
    const homeGoals = stat(home, 'goals_scored')
    const awayGoals = stat(away, 'goals_scored')
    const homeXg = stat(home, 'xg')
    const awayXg = stat(away, 'xg')
    const fouls = combinedFouls(input)
    if (fouls === null) return unavailableGate('Faltan faltas combinadas para evaluar el colchón dinámico.', null, unit)
    if (homeGoals !== null && awayGoals !== null) {
      projection = homeGoals + awayGoals
      explanation = 'Suma de promedios de goles de ambos equipos.'
    } else if (homeXg !== null && awayXg !== null) {
      projection = homeXg + awayXg
      explanation = 'Suma de xG de ambos equipos; no se mezclan goles y xG.'
    } else return unavailableGate('Se requieren los goles promedio de ambos o el xG de ambos, sin mezclar medidas.', null, unit)
    threshold = candidate.line_value! + 1.2 + (fouls >= 26 ? 0.5 : 0)
    explanation += ` Colchón ${threshold - candidate.line_value!} aplicado a OVER ${candidate.line_value}.`
  } else {
    const goals = stat(team!, 'goals_scored')
    const xg = stat(team!, 'xg')
    const fouls = combinedFouls(input)
    if (fouls === null) return unavailableGate('Faltan faltas combinadas para evaluar el colchón dinámico.', null, unit)
    if (goals !== null) {
      projection = goals
      explanation = `Goles promedio de ${team!.name}.`
    } else if (xg !== null) {
      projection = xg
      explanation = `xG promedio de ${team!.name}; goles no observados.`
    } else return unavailableGate(`Faltan goles y xG observados de ${team!.name}.`, null, unit)
    threshold = candidate.line_value! + 0.8 + (fouls >= 26 ? 0.5 : 0)
    explanation += ` Colchón ${threshold - candidate.line_value!} aplicado a OVER ${candidate.line_value}.`
  }

  if (projection === null || threshold === null || !Number.isFinite(projection) || !Number.isFinite(threshold)) return unavailableGate('La proyección o el umbral no es finito.', threshold, unit)
  const mop = projection - threshold
  return { status: mop >= 0 ? 'pass' : 'fail', projection, threshold, mop, unit, explanation: `${explanation} MOP = ${mop.toFixed(2)} ${unit}.` }
}

function unavailableGate(explanation: string, threshold: number | null, unit: string): GateProjection {
  return { status: 'not_evaluable', projection: null, threshold, mop: null, unit, explanation }
}

function combinedFouls(input: MatchInput): number | null {
  const [home, away] = input.match.teams
  const homeFouls = stat(home, 'fouls')
  const awayFouls = stat(away, 'fouls')
  return homeFouls === null || awayFouls === null ? null : homeFouls + awayFouls
}

function estimateHomeAdvantage(input: MatchInput): Measurement {
  const home = teamBySide(input, 'home')
  const away = teamBySide(input, 'away')
  const homeGoals = stat(home, 'goals_scored')
  const awayGoals = stat(away, 'goals_scored')
  const homeConceded = stat(home, 'goals_conceded')
  const awayConceded = stat(away, 'goals_conceded')
  if ([homeGoals, awayGoals, homeConceded, awayConceded].some((value) => value === null)) return input.match.home_advantage
  const seasonSignal = ((homeGoals! - awayGoals!) + (awayConceded! - homeConceded!)) / 4
  const homeRecent = home.recent_venue_form
  const awayRecent = away.recent_venue_form
  const recentValues = [
    numericMeasurement(homeRecent?.goals_scored), numericMeasurement(homeRecent?.goals_conceded),
    numericMeasurement(awayRecent?.goals_scored), numericMeasurement(awayRecent?.goals_conceded),
  ]
  const recentSignal = recentValues.every((value) => value !== null)
    ? ((recentValues[0]! - recentValues[1]!) - (recentValues[2]! - recentValues[3]!)) / 10
    : 0
  const value = Math.max(0.3, Math.min(0.5, 0.35 + seasonSignal * 0.1 + recentSignal * 0.1))
  return {
    value,
    unit: 'goals',
    status: 'estimated',
    source_label: 'Cálculo algorítmico interno basado en rendimiento local/visitante reciente y temporada',
  }
}

function ensureHomeAdvantage(input: MatchInput) {
  if (input.match.home_advantage.status === 'missing' || input.match.home_advantage.value === null) {
    input.match.home_advantage = estimateHomeAdvantage(input)
  }
}

function factor(points: number, max: number, label: string): ScoreFactor {
  return { points, max, label }
}

function urgencyLabel(label: string, teams: Team[]): string {
  const contexts = teams
    .filter((team) => team.urgency_context)
    .map((team) => `${team.name}: ${team.urgency} (${team.urgency_context})`)
  return contexts.length ? `${label} · ${contexts.join('; ')}` : label
}

function urgencyContextTrace(input: MatchInput): string[] {
  return input.match.teams.flatMap((team) => team.urgency_context
    ? [`Urgencia ${team.urgency} de ${team.name}: ${team.urgency_context}.`]
    : [])
}

function band(value: number, threshold: number, points: number, lowerIsBetter = false): number {
  return lowerIsBetter ? (value <= threshold ? points : 0) : (value >= threshold ? points : 0)
}

function scoreFor(input: MatchInput, candidate: Candidate, gate: GateProjection): ScoreCalculation | null {
  const home = teamBySide(input, 'home')
  const away = teamBySide(input, 'away')
  const chosen = candidateTeam(input, candidate)
  const opponent = chosen ? input.match.teams.find((team) => team.team_id !== chosen.team_id)! : null
  let confirmation: ScoreFactor[] = []
  let support: ScoreFactor[] = []
  let missedTeams: Team[] = []
  let goalkeeper: Team | null = null
  let explanation: string[] = []

  if (candidate.market === 'simple_win') {
    const scoring = chosen!
    const rival = opponent!
    const scored = stat(scoring, 'goals_scored')
    const conceded = stat(scoring, 'goals_conceded')
    const prevented = stat(scoring, 'goals_prevented')
    const rivalConceded = stat(rival, 'goals_conceded')
    const rivalErrors = stat(rival, 'errors')
    if ([scored, conceded, prevented, rivalConceded, rivalErrors].some((value) => value === null)) return null
    const urgencyPoints = scoring.urgency === 'high' ? 10 : 0
    confirmation = [
      factor(band(scored! - conceded!, 0.6, 20, false) || band(scored! - conceded!, 0.2, 10, false), 20, 'Diferencial de goles'),
      factor(urgencyPoints, 10, urgencyLabel('Urgencia alta', [scoring])),
      factor(band(prevented!, 1, 20, false), 20, 'Goles evitados propios'),
    ]
    support = [
      factor(band(rivalConceded!, 1.3, 25, false), 25, 'Goles concedidos del rival'),
      factor(band(rivalErrors!, 1, 25, false), 25, 'Errores rivales que conducen al gol'),
    ]
    missedTeams = [scoring]
    goalkeeper = rival
  } else if (candidate.market === 'double_chance') {
    const scoring = chosen!
    const rival = opponent!
    const conceded = stat(scoring, 'goals_conceded')
    const prevented = stat(scoring, 'goals_prevented')
    const rivalConceded = stat(rival, 'goals_conceded')
    const rivalErrors = stat(rival, 'errors')
    if ([conceded, prevented, rivalConceded, rivalErrors].some((value) => value === null)) return null
    const urgencyPoints = scoring.urgency === 'high' ? 10 : scoring.urgency === 'medium' ? 5 : 0
    confirmation = [
      factor(gate.status === 'pass' ? 20 : 0, 20, 'Gate de resistencia'),
      factor(urgencyPoints, 10, urgencyLabel('Urgencia', [scoring])),
      factor(band(conceded!, 0.9, 12, true), 12, 'Goles concedidos propios'),
      factor(band(prevented!, 1, 13, false), 13, 'Goles evitados propios'),
    ]
    support = [
      factor(gate.status === 'pass' ? 20 : 0, 20, 'Sustitución de tasa de no-victoria por gate de resistencia'),
      factor(band(rivalConceded!, 1.3, 25, false), 25, 'Goles concedidos del rival'),
      factor(band(rivalErrors!, 1, 20, false), 20, 'Errores rivales que conducen al gol'),
    ]
  } else if (candidate.market === 'asian_handicap') {
    if (!chosen || !opponent || candidate.line_value === null) return null
    const xg = stat(chosen, 'xg')
    const rivalConceded = stat(opponent, 'goals_conceded')
    const ownConceded = stat(chosen, 'goals_conceded')
    const rivalErrors = stat(opponent, 'errors')
    if ([xg, rivalConceded, ownConceded, rivalErrors].some((value) => value === null)) return null
    const urgencyPoints = chosen.urgency === 'high' ? 10 : 0
    const xgMargin = xg! + candidate.line_value - rivalConceded!
    confirmation = [
      factor(xgMargin >= 1.5 ? 20 : xgMargin >= 0.8 ? 10 : 0, 20, 'xG candidato + hándicap - goles concedidos rival'),
      factor(urgencyPoints, 10, urgencyLabel('Urgencia alta', [chosen])),
      factor(band(ownConceded!, 0.9, 20, true), 20, 'Goles concedidos propios'),
    ]
    support = [
      factor(rivalConceded! >= 1.5 ? 25 : rivalConceded! >= 1.1 ? 15 : 0, 25, 'Goles concedidos del rival'),
      factor(band(rivalErrors!, 1, 25, false), 25, 'Errores rivales (sustitución documentada)'),
    ]
    missedTeams = [chosen]
  } else if (candidate.market === 'total_goals') {
    const homeXg = stat(home, 'xg')
    const awayXg = stat(away, 'xg')
    const homeGoals = stat(home, 'goals_scored')
    const awayGoals = stat(away, 'goals_scored')
    const homeShots = stat(home, 'shots_on_target')
    const awayShots = stat(away, 'shots_on_target')
    const homeChances = stat(home, 'big_chances_created')
    const awayChances = stat(away, 'big_chances_created')
    const homeConceded = stat(home, 'goals_conceded')
    const awayConceded = stat(away, 'goals_conceded')
    const homeErrors = stat(home, 'errors')
    const awayErrors = stat(away, 'errors')
    if ([homeShots, awayShots, homeChances, awayChances, homeConceded, awayConceded, homeErrors, awayErrors].some((value) => value === null)) return null
    const volume = homeXg !== null && awayXg !== null ? homeXg + awayXg
      : homeGoals !== null && awayGoals !== null ? homeGoals + awayGoals : null
    if (volume === null) return null
    const shotsReady = homeShots! + awayShots! >= 10 && homeChances! + awayChances! > 5
    const urgency = [home.urgency, away.urgency].includes('high') ? 15 : 0
    confirmation = [
      factor(volume >= 3.2 ? 25 : 0, 25, 'Volumen combinado de goles/xG'),
      factor(shotsReady ? 15 : 0, 15, 'Tiros a puerta y grandes ocasiones'),
      factor(urgency, 15, urgencyLabel('Urgencia alta', [home, away])),
    ]
    support = [
      factor(Math.max(homeConceded!, awayConceded!) >= 1.2 ? 25 : 0, 25, 'Goles concedidos'),
      factor(homeErrors! + awayErrors! >= 1 ? 20 : 0, 20, 'Errores que conducen al gol (sustitución de tendencia H2H)'),
    ]
    missedTeams = [home, away]
    const homePrevented = stat(home, 'goals_prevented')
    const awayPrevented = stat(away, 'goals_prevented')
    if (homePrevented === null || awayPrevented === null) return null
    goalkeeper = homePrevented >= awayPrevented ? home : away
  } else if (candidate.market === 'team_goals') {
    const scoring = chosen!
    const rival = opponent!
    const goals = stat(scoring, 'goals_scored')
    const xg = stat(scoring, 'xg')
    const shots = stat(scoring, 'shots_on_target')
    const chances = stat(scoring, 'big_chances_created')
    const rivalConceded = stat(rival, 'goals_conceded')
    const rivalErrors = stat(rival, 'errors')
    if ([goals, xg, shots, chances, rivalConceded, rivalErrors].some((value) => value === null)) return null
    const productive = goals! >= 1.6 && xg! >= 1.6
    const modest = goals! >= 1.3 && goals! < 1.6 && xg! >= 1.3 && xg! < 1.6
    const volume = shots! >= 5 && chances! >= 3
    const urgency = scoring.urgency === 'high' ? 15 : 0
    confirmation = [
      factor(productive ? 25 : modest ? 15 : 0, 25, 'Goles y xG del equipo'),
      factor(volume ? 15 : 0, 15, 'Tiros a puerta y grandes ocasiones'),
      factor(urgency, 15, urgencyLabel('Urgencia alta', [scoring])),
    ]
    support = [
      factor(rivalConceded! >= 1.2 ? 25 : rivalConceded! >= 0.8 ? 12 : 0, 25, 'Goles concedidos por el rival'),
      factor(band(rivalErrors!, 1, 20), 20, 'Errores del rival que conducen al gol'),
    ]
    missedTeams = [scoring]
    goalkeeper = rival
  } else {
    const homeShots = stat(home, 'shots_on_target')
    const awayShots = stat(away, 'shots_on_target')
    const homeBlocked = stat(home, 'blocked_shots')
    const awayBlocked = stat(away, 'blocked_shots')
    const homeCrosses = stat(home, 'crosses')
    const awayCrosses = stat(away, 'crosses')
    const homeOppositionPasses = stat(home, 'passes_opposition_half')
    const awayOppositionPasses = stat(away, 'passes_opposition_half')
    const homeTotalShots = stat(home, 'shots_total')
    const awayTotalShots = stat(away, 'shots_total')
    if ([homeShots, awayShots, homeBlocked, awayBlocked, homeCrosses, awayCrosses,
      homeOppositionPasses, awayOppositionPasses, homeTotalShots, awayTotalShots].some((value) => value === null)) return null
    const projectedPass = gate.status === 'pass'
    const shotVolume = homeShots! + awayShots! + homeBlocked! + awayBlocked! >= 10
    const crossesReady = homeCrosses! + awayCrosses! >= 10
    const territorialPressure = homeOppositionPasses! + awayOppositionPasses! >= 350
    const totalShotVolume = homeTotalShots! + awayTotalShots! >= 30
    confirmation = [
      factor(projectedPass ? 30 : 0, 30, 'Proyección supera el gate de córners'),
      factor(shotVolume ? 25 : 0, 25, 'Tiros a puerta + bloqueados'),
    ]
    support = [
      factor(crossesReady ? 20 : 0, 20, 'Centros combinados'),
      factor(territorialPressure ? 15 : 0, 15, 'Pases combinados en campo contrario'),
      factor(totalShotVolume ? 10 : 0, 10, 'Disparos totales combinados'),
    ]
    missedTeams = [home, away]
  }

  const foulTotal = combinedFouls(input)
  if (foulTotal === null) return null
  const confirmMaximum = confirmation.reduce((sum, item) => sum + item.max, 0)
  const supportMaximum = support.reduce((sum, item) => sum + item.max, 0)
  const confirmWeight = 55
  const supportWeight = 45
  const penalties: string[] = []
  const penaltyEntries: ScoreTraceEntry[] = []
  const missed = missedTeams.map((team) => stat(team, 'big_chances_missed'))
  if (missed.some((value) => value === null)) return null
  if (missed.reduce<number>((sum, value) => sum + (value ?? 0), 0) >= 2) {
    penalties.push('Ocasiones claras falladas >= 2.0: -10 al subtotal normalizado de confirmación.')
    penaltyEntries.push({ group: 'penalty', label: 'Ocasiones claras falladas >= 2.0', scorePoints: -10 })
  }
  if (foulTotal >= 26) {
    penalties.push('Faltas combinadas >= 26: -5 puntos.')
    penaltyEntries.push({ group: 'penalty', label: 'Faltas combinadas >= 26', scorePoints: -5 })
  }
  const structuralCount = input.match.teams.flatMap((team) => team.structural_absences)
    .filter((absence) => absence.is_structural === true && absence.starter === true && absence.confirmation === 'confirmed').length
  const absencePenalty = Math.min(structuralCount * 10, 25)
  if (absencePenalty > 0) {
    penalties.push(`${structuralCount} baja(s) titular(es) estructural(es) confirmada(s), tope aplicado: -${absencePenalty}.`)
    penaltyEntries.push({ group: 'penalty', label: `${structuralCount} baja(s) titular(es) estructural(es), tope aplicado`, scorePoints: -absencePenalty })
  }
  const goalkeeperPenaltyApplies = candidate.market === 'simple_win'
    || candidate.market === 'total_goals'
    || candidate.market === 'team_goals'
  if (goalkeeperPenaltyApplies && goalkeeper) {
    const prevented = stat(goalkeeper, 'goals_prevented')
    if (prevented === null) return null
    if (prevented >= 1.2) {
      penalties.push(`Goles evitados del portero rival >= 1.20: -15 puntos (${goalkeeper.name}).`)
      penaltyEntries.push({ group: 'penalty', label: `Goles evitados del portero rival >= 1.20 (${goalkeeper.name})`, scorePoints: -15 })
    }
  }
  explanation = [
    ...confirmation.map((item) => `Confirmación: ${item.label} ${item.points}/${item.max}.`),
    ...support.map((item) => `Respaldo: ${item.label} ${item.points}/${item.max}.`),
  ]
  const entries: ScoreTraceEntry[] = [
    ...confirmation.map((item) => ({
      group: 'confirmation' as const,
      label: item.label,
      scorePoints: confirmMaximum ? item.points * confirmWeight / confirmMaximum : 0,
      matrixPoints: item.points,
      matrixMaximum: item.max,
    })),
    ...support.map((item) => ({
      group: 'support' as const,
      label: item.label,
      scorePoints: supportMaximum ? item.points * supportWeight / supportMaximum : 0,
      matrixPoints: item.points,
      matrixMaximum: item.max,
    })),
    ...penaltyEntries,
  ]
  const rawScore = entries.reduce((sum, item) => sum + item.scorePoints, 0)
  const score = Math.max(0, Math.min(100, rawScore))
  if (score !== rawScore) {
    entries.push({
      group: 'limit',
      label: score === 0 ? 'Límite inferior del score' : 'Límite superior del score',
      scorePoints: score - rawScore,
    })
  }
  if (!Number.isFinite(score)) return null
  return { score, explanation, penalties, trace: { entries, rawScore, finalScore: score } }
}

export function mopScalingLevels(mop: number): number {
  if (mop < 0.5) return 0
  if (mop <= 1.1) return 1
  if (mop < 1.2) return 1
  return 2
}

function generatedCandidates(input: MatchInput): Candidate[] {
  const home = teamBySide(input, 'home')
  const away = teamBySide(input, 'away')
  const favoriteSide = input.match.simple_win_odds.home === input.match.simple_win_odds.away
    ? null
    : input.match.simple_win_odds.home < input.match.simple_win_odds.away ? 'home' : 'away'
  const favorite = favoriteSide ? teamBySide(input, favoriteSide) : null
  const dog = favorite ? input.match.teams.find(({ team_id }) => team_id !== favorite.team_id)! : null
  const create = (market: Market, selection: Candidate['selection'], teamId: string | null, line: number | null, unit: Candidate['line_unit'], key = teamId ?? selection): Candidate => ({
    candidate_id: `${market}:${encodeURIComponent(key)}:${line === null ? 'none' : line}`,
    market, selection, team_id: teamId, line_value: line, line_unit: unit,
  })
  return [
    create('simple_win', 'home', home.team_id, null, 'none'),
    create('simple_win', 'away', away.team_id, null, 'none'),
    create('double_chance', '1X', home.team_id, null, 'none'),
    create('double_chance', 'X2', away.team_id, null, 'none'),
    create('asian_handicap', 'favorite', favorite?.team_id ?? null, -1.5, 'goals', 'favorite'),
    create('asian_handicap', 'nonfavorite', dog?.team_id ?? null, 1.5, 'goals', 'nonfavorite'),
    create('total_goals', 'OVER', null, 1.5, 'goals'),
    create('total_corners', 'OVER', null, 6.5, 'corners'),
    create('team_goals', 'OVER', home.team_id, 0.5, 'goals', home.team_id),
    create('team_goals', 'OVER', away.team_id, 0.5, 'goals', away.team_id),
  ]
}

function candidateWithLine(source: Candidate, line: number): Candidate {
  const key = source.market === 'team_goals' ? source.team_id! : source.market === 'asian_handicap' ? source.selection : source.team_id ?? source.selection
  return {
    ...source,
    candidate_id: `${source.market}:${encodeURIComponent(key)}:${line}`,
    line_value: line,
  }
}

function evaluate(input: MatchInput, candidate: Candidate): CandidateEvaluation {
  const result: CandidateEvaluation = {
    candidate, status: 'not_evaluable', route: 'primary', score: null,
    scoreTrace: null,
    gate: unavailableGate('No se pudo calcular el colchón.', null, candidate.line_unit),
    scoreExplanation: [], penalties: [], trace: [],
    scaled: null, fallback: null,
  }
  const sampleError = validSamples(input)
  if (sampleError) {
    result.trace.push(...urgencyContextTrace(input))
    result.trace.push(sampleError)
    return result
  }
  result.gate = getProjection(input, candidate)
  const breakdown = scoreFor(input, candidate, result.gate)
  if (!breakdown) {
    result.trace.push(...urgencyContextTrace(input))
    result.trace.push('Faltan métricas observadas para calcular la matriz de score o sus penalizaciones.')
    if (result.gate.status === 'not_evaluable') result.trace.push(result.gate.explanation)
    return result
  }
  result.score = breakdown.score
  result.scoreTrace = breakdown.trace
  result.scoreExplanation = breakdown.explanation
  result.penalties = breakdown.penalties
  result.trace.push(...breakdown.explanation, ...breakdown.penalties)
  if (breakdown.score < 50) {
    result.status = 'REJECT'
    result.trace.push('Score < 50: rechazo terminal; no se intenta fallback.')
    return result
  }
  if (result.gate.status === 'not_evaluable') {
    result.trace.push(result.gate.explanation)
    return result
  }
  if (result.gate.status === 'fail') {
    result.status = 'REJECT'
    result.trace.push('El colchón/MOP de la línea generada no pasa.')
    return result
  }
  result.status = 'ELIGIBLE'
  result.trace.push('Pasa score >= 50 y gate de colchón.')
  return result
}

function dcFallback(input: MatchInput, candidates: Candidate[]): Candidate | null {
  const home = netXg(teamBySide(input, 'home'))
  const away = netXg(teamBySide(input, 'away'))
  if (home === null || away === null || home === away) return null
  const selection = home > away ? '1X' : 'X2'
  return candidates.find((candidate) => candidate.market === 'double_chance' && candidate.selection === selection) ?? null
}

export function analyzeMatch(input: MatchInput): MatchAnalysis {
  ensureHomeAdvantage(input)
  const candidates = generatedCandidates(input)
  const results = markets.map((market) => ({
    market,
    candidates: candidates.filter((candidate) => candidate.market === market).map((candidate) => evaluate(input, candidate)),
  }))
  const all = results.flatMap(({ candidates: items }) => items)
  for (const item of all) {
    if (item.status === 'ELIGIBLE' && item.gate.mop !== null && item.candidate.line_value !== null) {
      const levels = mopScalingLevels(item.gate.mop)
      const step = item.candidate.market === 'asian_handicap' ? -0.5 : 0.5
      if (levels > 0) {
        const scaled = evaluate(input, candidateWithLine(item.candidate, item.candidate.line_value + step * levels))
        item.trace.push(`Escalado interno a línea ${scaled.candidate.line_value}: score y gate recalculados; ${scaled.status}.`)
        if (scaled.status === 'ELIGIBLE') {
          item.scaled = scaled
          item.route = 'scaled'
        }
      }
    }
    if (item.status !== 'REJECT' || (item.score ?? 0) < 50 || item.gate.status !== 'fail'
      || !['total_goals', 'total_corners', 'team_goals'].includes(item.candidate.market)) continue
    const lower = evaluate(input, candidateWithLine(item.candidate, item.candidate.line_value! - 0.5))
    item.trace.push(`Fallback OVER ${lower.candidate.line_value}: score y gate recalculados; ${lower.status}.`)
    if (lower.score !== null && lower.score < 50) {
      item.trace.push('Score < 50 en fallback: rechazo terminal, sin segunda ruta.')
      continue
    }
    item.route = 'fallback'
    item.fallback = lower
    if (lower.status === 'ELIGIBLE') continue
    const fallback = dcFallback(input, candidates)
    if (!fallback) {
      item.trace.push('Sin fallback 1X/X2: net xG empatado o no evaluable.')
      continue
    }
    const dc = evaluate(input, fallback)
    item.fallback = dc
    item.trace.push(`Fallback ${fallback.selection}: score y gate recalculados; ${dc.status}.`)
  }
  return { markets: results }
}
