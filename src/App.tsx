import { useEffect, useRef, useState } from 'react'
import exampleJson from '../examples/partido.json?raw'
import { calculateDerivedMetrics, compareObservedMeasurements } from './domain/calculations'
import { analyzeMatch, type CandidateEvaluation, type MatchAnalysis, type RouteEvaluation, type ScoreTrace } from './domain/engine'
import { issueLocation } from './domain/issueLocation'
import { parseMatchInput } from './domain/parser'
import { statDefinitions, type Candidate, type DerivedMetric, type MatchInput, type Market, type StatGroup, type ValidationIssue } from './domain/types'
import { requestJustifications, type Justification } from './services/analysisClient'

type MarketDefinition = {
  id: Market
  title: string
  selection: string
  buffer: string
  observed: string
}

const marketDefinitions: MarketDefinition[] = [
  {
    id: 'simple_win', title: 'Victoria simple', selection: 'Local / visitante', buffer: 'xG neto del equipo − xG neto rival ≥ 0.40 goles',
    observed: 'Requiere xG y xGA observados en ambos equipos',
  },
  { id: 'double_chance', title: 'Doble oportunidad', selection: '1X / X2', buffer: 'xG neto + localía firmada − rival ≥ 0.15 goles', observed: 'La localía debe estar explícita' },
  { id: 'asian_handicap', title: 'Hándicap asiático negativo', selection: 'Local / visitante', buffer: 'Goles favor − concedidos rival + ajuste ≥ |línea| + 1.3', observed: 'Ajuste de urgencia ausente = 0 conservador' },
  { id: 'total_goals', title: 'Goles totales', selection: 'Over', buffer: 'Goles o xG combinados; colchón 1.2', observed: 'No se mezclan goles y xG' },
  { id: 'total_corners', title: 'Córners totales', selection: 'Over', buffer: 'Córners combinados; colchón 3.5', observed: 'Los tiros bloqueados no se convierten en córners' },
  { id: 'team_goals', title: 'Goles por equipo', selection: 'Over + equipo', buffer: 'Over 0.5 goles · proyección mínima 1.3 (línea 0.5 + colchón 0.8)', observed: 'Equipo identificado mediante team_id' },
]

const modifierDefinitions = [
  { title: 'Faltas combinadas', trigger: '≥ 26', impact: '−5 puntos', scope: '+0.5 al colchón de goles, córners y hándicap' },
  { title: 'Baja titular estructural confirmada', trigger: 'Las tres condiciones verdaderas', impact: '−10 por baja · tope −25', scope: 'No se aplica si starter o is_structural son null' },
  { title: 'Goles evitados del portero rival', trigger: '≥ 1.20', impact: '−15 puntos', scope: 'Victoria simple y over de goles; nunca under ni córners' },
  { title: 'Grandes ocasiones falladas', trigger: '≥ 2.0', impact: '−10 al subtotal ofensivo', scope: 'Ámbito según mercado; no se aplica a doble oportunidad' },
]

const groups: StatGroup[] = ['Ofensiva', 'Ritmo', 'Defensa y portería', 'Fricción']

function formatMeasurement(measurement: MatchInput['match']['teams'][number]['stats'][keyof MatchInput['match']['teams'][number]['stats']]) {
  if (measurement.status !== 'observed' || measurement.value === null) {
    return ({ missing: 'Dato ausente', estimated: 'Estimado', unknown: 'Desconocido', not_applicable: 'No aplicable', observed: 'No evaluable' } as const)[measurement.status]
  }
  const suffix = measurement.unit === 'goals' ? ' goles' : measurement.unit === 'percent' ? '%' : ''
  return `${measurement.value}${suffix}`
}

function formatDerived(metric: DerivedMetric | undefined): string {
  if (!metric || metric.status !== 'observed' || metric.value === null || !Number.isFinite(metric.value)) return 'No evaluable: faltan datos observados'
  return `${metric.value.toFixed(2)} ${metric.unit === 'goals' ? 'goles' : metric.unit}`
}

function formatUnit(unit: string) {
  if (unit === 'goals') return 'goles'
  if (unit === 'percent') return 'por ciento'
  return 'conteo'
}

function formatSampleRange(sample: MatchInput['match']['teams'][number]['sample']) {
  if (!sample.from && !sample.to) return 'No disponible'
  return `${sample.from ?? 'Sin fecha inicial'} – ${sample.to ?? 'Sin fecha final'}`
}

function formatSampleContext(sample: MatchInput['match']['teams'][number]['sample']) {
  return `${sample.period.replaceAll('_', ' ')}, ${sample.scope}, ${sample.matches_count ?? 'cantidad de partidos no disponible'} partidos, periodo ${formatSampleRange(sample)}, fuente ${sample.source_label ?? 'no disponible'}`
}

function formatSelection(candidate: Candidate, input: MatchInput) {
  const team = input.match.teams.find(({ team_id }) => team_id === candidate.team_id)
  if (candidate.market === 'simple_win') return `${candidate.selection === 'home' ? 'Local' : 'Visitante'} · ${team?.name ?? 'equipo no disponible'}`
  if (candidate.market === 'double_chance') return `${candidate.selection} · ${team?.name ?? 'equipo no disponible'}`
  if (candidate.market === 'asian_handicap') return `${candidate.selection === 'favorite' ? 'Favorito' : 'No favorito'} · ${team?.name ?? 'no determinado'}`
  if (candidate.market === 'team_goals') return `Over ${candidate.line_value ?? '0.5'} goles · ${team?.name ?? 'equipo no disponible'}`
  return `${candidate.selection === 'OVER' ? 'Over' : candidate.selection} ${candidate.line_value ?? ''}`.trim()
}

function formatDecision(status: CandidateEvaluation['status']) {
  if (status === 'ELIGIBLE') return 'Elegible'
  if (status === 'REJECT') return 'Rechazado'
  return 'No evaluable'
}

function formatMop(candidate: CandidateEvaluation) {
  const { mop, unit } = candidate.gate
  return mop === null ? 'No evaluable' : `${mop.toFixed(2)} ${formatUnit(unit)}`
}

function ScoreTraceDetails({ scoreTrace, market }: { scoreTrace: ScoreTrace | null; market: Market }) {
  const displayedEntries = scoreTrace?.entries.map((entry) => ({
    ...entry,
    displayedPoints: Number(entry.scorePoints.toFixed(2)),
  })) ?? []
  const displayedFinalScore = scoreTrace ? Number(scoreTrace.finalScore.toFixed(2)) : null
  const displayRoundingAdjustment = displayedFinalScore === null ? 0
    : Number((displayedFinalScore - displayedEntries.reduce((sum, entry) => sum + entry.displayedPoints, 0)).toFixed(2))
  const cornerConfirmation = displayedEntries
    .filter((entry) => entry.group === 'confirmation')
    .reduce((sum, entry) => sum + entry.displayedPoints, 0)
  return <details className="candidate-trace">
    <summary>Trazabilidad del score</summary>
    {market === 'total_corners' && <p className="candidate-explanation">
      Confirmación de córners: {scoreTrace ? `${cornerConfirmation.toFixed(2)}/55` : 'no evaluable'} puntos normalizados. El respaldo usa centros combinados (20), pases en campo contrario (15) y disparos totales (10), hasta 45/45; todos son proxies ofensivos documentados, no córners concedidos.
    </p>}
    {scoreTrace
      ? <>
        <ul>{displayedEntries.map((entry, index) => {
          const group = entry.group === 'confirmation' ? 'Confirmación'
            : entry.group === 'support' ? 'Respaldo'
              : entry.group === 'limit' ? 'Ajuste de límite' : 'Penalización'
          const matrix = entry.matrixPoints === undefined ? '' : ` · Matriz ${entry.matrixPoints}/${entry.matrixMaximum}`
          const points = `${entry.displayedPoints > 0 ? '+' : ''}${entry.displayedPoints.toFixed(2)} puntos`
          return <li key={`${entry.group}-${entry.label}-${index}`}><strong>{group}:</strong> {entry.label}{matrix} → {points} al score</li>
        })}</ul>
        {displayRoundingAdjustment !== 0 && <p className="candidate-explanation">Ajuste de redondeo de presentación: {displayRoundingAdjustment > 0 ? '+' : ''}{displayRoundingAdjustment.toFixed(2)} puntos.</p>}
        <p className="candidate-score-total">Suma antes del límite: {scoreTrace.rawScore.toFixed(2)} · Score final: <strong>{scoreTrace.finalScore.toFixed(2)}/100</strong></p>
      </>
      : <p className="candidate-explanation">No evaluable: faltan métricas para calcular el score.</p>}
  </details>
}

function RouteResult({ route, title, input }: { route: RouteEvaluation; title: string; input: MatchInput }) {
  const traceItems = route.trace.filter((item) => !route.penalties.includes(item))
  return <section className="candidate-alternate" aria-label={title}>
    <div className="candidate-heading">
      <strong>{title} · {formatSelection(route.candidate, input)}</strong>
      <span className={`candidate-state candidate-state-${route.status.toLowerCase()}`}>{formatDecision(route.status)}</span>
    </div>
    <dl className="pending-fields">
      <div><dt>Score / 100</dt><dd>{route.score === null ? 'No evaluable' : route.score.toFixed(2)}</dd></div>
      <div><dt>Línea</dt><dd>{route.candidate.line_value ?? 'Sin línea'}</dd></div>
      <div><dt>Gate</dt><dd>{route.gate.status === 'pass' ? 'Pasa' : route.gate.status === 'fail' ? 'Falla' : 'No evaluable'}</dd></div>
      <div><dt>MOP</dt><dd>{route.gate.mop === null ? 'No evaluable' : `${route.gate.mop.toFixed(2)} ${formatUnit(route.gate.unit)}`}</dd></div>
    </dl>
    <p className="candidate-projection">Proyección: {route.gate.projection === null ? 'No evaluable' : `${route.gate.projection.toFixed(2)} ${formatUnit(route.gate.unit)}`} · Umbral: {route.gate.threshold === null ? 'No disponible' : `${route.gate.threshold.toFixed(2)} ${formatUnit(route.gate.unit)}`}</p>
    <p className="candidate-explanation">{route.gate.explanation}</p>
    {traceItems.length > 0 && <details className="candidate-trace">
      <summary>Trazabilidad de la ruta</summary>
      <ul>{traceItems.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
    </details>}
    <ScoreTraceDetails scoreTrace={route.scoreTrace} market={route.candidate.market} />
  </section>
}

function CandidateResult({ candidate, input, justification }: { candidate: CandidateEvaluation; input: MatchInput; justification?: string }) {
  const traceItems = candidate.trace.filter((item) => !candidate.penalties.includes(item))
  return <section className="candidate-result" aria-label={`Resultado de ${formatSelection(candidate.candidate, input)}`}>
    <div className="candidate-heading">
      <strong>{formatSelection(candidate.candidate, input)}</strong>
      <span className={`candidate-state candidate-state-${candidate.status.toLowerCase()}`}>{formatDecision(candidate.status)}</span>
    </div>
    <dl className="pending-fields">
      <div><dt>Score / 100</dt><dd>{candidate.score === null ? 'No evaluable' : candidate.score.toFixed(2)}</dd></div>
      <div><dt>Ruta</dt><dd>{candidate.route === 'primary' ? 'Principal' : candidate.route === 'scaled' ? 'Escalada' : candidate.route === 'fallback' ? 'Fallback' : 'Sin fallback'}</dd></div>
      <div><dt>Gate</dt><dd>{candidate.gate.status === 'pass' ? 'Pasa' : candidate.gate.status === 'fail' ? 'Falla' : 'No evaluable'}</dd></div>
      <div><dt>MOP</dt><dd>{formatMop(candidate)}</dd></div>
    </dl>
    <p className="candidate-projection">Proyección: {candidate.gate.projection === null ? 'No evaluable' : `${candidate.gate.projection.toFixed(2)} ${formatUnit(candidate.gate.unit)}`} · Umbral: {candidate.gate.threshold === null ? 'No disponible' : `${candidate.gate.threshold.toFixed(2)} ${formatUnit(candidate.gate.unit)}`}</p>
    <p className="candidate-explanation">{candidate.gate.explanation}</p>
    {justification && <p className="candidate-justification"><span>Justificación cualitativa</span>{justification}</p>}
    {candidate.scaled && <RouteResult route={candidate.scaled} title="Línea escalada" input={input} />}
    {candidate.fallback && <RouteResult route={candidate.fallback} title="Fallback" input={input} />}
    {traceItems.length > 0 && <details className="candidate-trace">
      <summary>Trazabilidad del motor</summary>
      <ul>{traceItems.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
    </details>}
    <ScoreTraceDetails scoreTrace={candidate.scoreTrace} market={candidate.candidate.market} />
  </section>
}

function App() {
  const [text, setText] = useState('')
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [validatedInput, setValidatedInput] = useState<MatchInput | null>(null)
  const [derivedMetrics, setDerivedMetrics] = useState<DerivedMetric[]>([])
  const [analysisResult, setAnalysisResult] = useState<MatchAnalysis | null>(null)
  const [analyzed, setAnalyzed] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [requestingJustifications, setRequestingJustifications] = useState(false)
  const [justifications, setJustifications] = useState<Record<string, Justification>>({})
  const [justificationError, setJustificationError] = useState('')
  const [notice, setNotice] = useState('')
  const analysisRunRef = useRef(0)
  const justificationRunRef = useRef(0)
  const justificationControllerRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(false)
  const issueRef = useRef<HTMLElement>(null)
  const resultRef = useRef<HTMLElement>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      analysisRunRef.current += 1
      justificationRunRef.current += 1
      justificationControllerRef.current?.abort()
      justificationControllerRef.current = null
    }
  }, [])

  function cancelJustificationRequest() {
    justificationRunRef.current += 1
    justificationControllerRef.current?.abort()
    justificationControllerRef.current = null
  }

  function validateDraft() {
    cancelJustificationRequest()
    setRequestingJustifications(false)
    setJustifications({})
    setJustificationError('')
    setAnalyzed(false)
    setDerivedMetrics([])
    setAnalysisResult(null)
    setNotice('')
    if (!text.trim()) {
      setValidatedInput(null)
      setIssues([{ path: '$', message: 'Pega un expediente JSON v1 para comenzar.', category: 'ausente' }])
      requestAnimationFrame(() => issueRef.current?.focus())
      return null
    }
    const result = parseMatchInput(text)
    setIssues(result.issues)
    setValidatedInput(result.ok ? result.value : null)
    if (!result.ok) requestAnimationFrame(() => issueRef.current?.focus())
    else setNotice('JSON v1 interpretable. Los datos no se han verificado externamente.')
    return result.ok ? result.value : null
  }

  async function analyzeDraft() {
    const analysisRun = ++analysisRunRef.current
    const input = validateDraft()
    if (!input) return
    setAnalyzing(true)
    setNotice('Calculando comparaciones observables…')
    await new Promise<void>((resolve) => window.setTimeout(resolve, 120))
    if (analysisRun !== analysisRunRef.current) return
    const metrics = calculateDerivedMetrics(input)
    const result = analyzeMatch(input)
    setJustifications({})
    setJustificationError('')
    setDerivedMetrics(metrics)
    setAnalysisResult(result)
    setAnalyzed(true)
    setAnalyzing(false)
    setNotice('Motor determinista local listo. Se muestran score, gates y trazas disponibles.')
    requestAnimationFrame(() => resultRef.current?.focus())
  }

  function updateText(value: string) {
    analysisRunRef.current += 1
    cancelJustificationRequest()
    setAnalyzing(false)
    setRequestingJustifications(false)
    setJustifications({})
    setJustificationError('')
    setText(value)
    setIssues([])
    setValidatedInput(null)
    setDerivedMetrics([])
    setAnalysisResult(null)
    setAnalyzed(false)
    setNotice(value ? 'Borrador modificado. Valida de nuevo para actualizar el expediente.' : '')
  }

  function loadExample() {
    updateText(exampleJson)
    setNotice('Transcripción canónica de Partido.txt cargada. Revisa el expediente y pulsa Analizar partido cuando quieras; el TXT no se lee en tiempo de ejecución.')
  }

  async function requestEligibleJustifications() {
    if (!validatedInput || !analysisResult) return
    const eligibleCandidateIds = analysisResult.markets.flatMap(({ candidates }) => candidates)
      .filter(({ status }) => status === 'ELIGIBLE')
      .map(({ candidate }) => candidate.candidate_id)
    if (eligibleCandidateIds.length === 0) return
    justificationControllerRef.current?.abort()
    const controller = new AbortController()
    justificationControllerRef.current = controller
    const runId = ++justificationRunRef.current
    setRequestingJustifications(true)
    setJustificationError('')
    setJustifications({})
    const result = await requestJustifications(validatedInput, eligibleCandidateIds, controller.signal)
    if (!mountedRef.current || runId !== justificationRunRef.current) return
    if (justificationControllerRef.current === controller) justificationControllerRef.current = null
    setRequestingJustifications(false)
    if (!result.ok) {
      if ('cancelled' in result) return
      setJustificationError(result.message)
      return
    }
    setJustifications(Object.fromEntries(result.justifications.map((item) => [item.candidate_id, item])))
  }

  const home = validatedInput?.match.teams.find(({ side }) => side === 'home')
  const away = validatedInput?.match.teams.find(({ side }) => side === 'away')
  const columns = [home, away]
  const eligibleCount = analysisResult?.markets.flatMap(({ candidates }) => candidates)
    .filter(({ status }) => status === 'ELIGIBLE').length ?? 0

  return (
    <main className="app-shell">
      <header className="masthead">
        <div className="masthead-brand"><span className="brand-mark" aria-hidden="true">C</span><span>Cuaderno <i>de partido</i></span></div>
        <div className="session-note"><span className="live-dot" aria-hidden="true" /> Sesión local · sin persistencia</div>
      </header>

      <section className="intro" aria-labelledby="page-title">
        <div className="intro-copy">
          <p className="eyebrow">ANÁLISIS MANUAL <span>·</span> JSON V1</p>
          <h1 id="page-title">Un expediente.<br /><em>Sin cifras inventadas.</em></h1>
          <p className="lede">Pega los datos del partido, revisa su procedencia y compara únicamente lo que está observado.</p>
        </div>
        <div className="protocol-stamp" aria-label="Motor determinista local">
          <span className="stamp-rule" />
          <span className="stamp-label">MOTOR</span>
          <strong>Motor determinista</strong>
          <span className="stamp-foot">REGLAS LOCALES · SIN IA</span>
        </div>
      </section>

      <section className="entry-section" aria-labelledby="entry-title">
        <div className="section-heading">
          <div><p className="eyebrow">01 / ENTRADA</p><h2 id="entry-title">Expediente del partido</h2></div>
          <span className="section-aside">El texto permanece en el editor durante esta sesión.</span>
        </div>
        <div className="entry-layout">
          <div className="editor-wrap">
            <label className="sr-only" htmlFor="match-json">JSON v1 del partido</label>
            <div className="editor-topline"><span>ENTRADA MANUAL</span><span>JSON · schema_version 1.0</span></div>
            <textarea
              id="match-json"
              spellCheck={false}
              value={text}
              onChange={(event) => updateText(event.target.value)}
              placeholder={'Pega aquí el expediente JSON v1…'}
              aria-describedby={issues.length ? 'issue-summary' : 'editor-hint'}
              aria-invalid={issues.length > 0}
            />
            <div className="editor-footer"><span id="editor-hint">El análisis determinista es local; las justificaciones son opcionales.</span><span>{text.length.toLocaleString('es-ES')} caracteres</span></div>
          </div>
          <div className="entry-controls">
            <div className="status-ledger" aria-live="polite">
              <span className={`ledger-indicator ${validatedInput ? 'is-ready' : issues.length ? 'has-issues' : ''}`} aria-hidden="true" />
              <div><strong>{validatedInput ? 'Entrada interpretable' : issues.length ? 'Revisar entrada' : 'Sin expediente'}</strong><span>{validatedInput ? 'Partido y ambos equipos identificados' : 'El análisis comienza con datos pegados'}</span></div>
            </div>
            <button className="button button-secondary" type="button" onClick={loadExample}>Cargar Partido.txt · Lille–Galatasaray</button>
            <button className="button button-secondary" type="button" onClick={validateDraft}>Validar JSON</button>
            <button className="button button-primary" type="button" onClick={analyzeDraft} disabled={analyzing}>{analyzing ? 'Analizando…' : 'Analizar partido'}<span aria-hidden="true">↗</span></button>
            <p className="privacy-note">El análisis determinista se calcula en local. Al solicitar justificaciones, el expediente se envía al servidor local para validar candidatos; Gemini recibe solo métricas mínimas de candidatos elegibles, sin nombres ni expediente completo.</p>
            <p className="example-source">El ejemplo es una transcripción canónica de <strong>Partido.txt</strong>; no se lee el TXT en tiempo de ejecución. <strong>Prueba-partido.txt</strong> se conserva como fixture de prueba de Juventus-Lazio. Cargarlo no inicia el análisis.</p>
          </div>
        </div>
        {issues.length > 0 && <section className="issue-summary" id="issue-summary" ref={issueRef} tabIndex={-1} aria-labelledby="issues-title" role="alert">
          <div className="issue-heading"><span aria-hidden="true">!</span><div><h3 id="issues-title">La entrada necesita correcciones</h3><p>El texto original sigue disponible en el editor.</p></div></div>
          <ul>{issues.map((issue, index) => <li key={`${issue.path}-${index}`}><span>{issueLocation(issue, text)}</span><code>{issue.path}</code><p>{issue.message}</p></li>)}</ul>
        </section>}
        {notice && issues.length === 0 && <p className={`notice ${analyzing ? 'is-loading' : ''}`} role="status">{notice}</p>}
      </section>

      {validatedInput && <section className="dossier" aria-labelledby="dossier-title">
        <div className="section-heading">
          <div><p className="eyebrow">02 / EXPEDIENTE</p><h2 id="dossier-title">{validatedInput.match.match_id}</h2></div>
          <span className="validation-badge">✓ JSON interpretable · no verificado externamente</span>
        </div>
        <div className="match-meta">
          <div><span>Competición</span><strong>{validatedInput.match.competition ?? 'No disponible'}</strong></div>
          <div><span>Inicio</span><strong>{validatedInput.match.kickoff ?? 'No disponible'}</strong></div>
          <div><span>Local</span><strong>{home?.name ?? 'No disponible'}</strong></div>
          <div><span>Visitante</span><strong>{away?.name ?? 'No disponible'}</strong></div>
        </div>
        <div className="team-statuses">
          {columns.map((team) => team && <div className="team-status" key={team.team_id}><span className="team-side">{team.side === 'home' ? 'LOCAL' : 'VISITANTE'}</span><strong>{team.name}</strong><span>Identidad y estructura válidas</span><span className="team-context">Muestra: {team.sample.period.replaceAll('_', ' ')} · {team.sample.scope}</span></div>)}
        </div>
      </section>}

      {analyzed && validatedInput && <>
        <section className="comparison" aria-labelledby="comparison-title">
          <div className="section-heading comparison-heading">
            <div><p className="eyebrow">03 / COMPARACIÓN</p><h2 id="comparison-title">Lo observado, lado a lado</h2></div>
            <div className="legend"><span className="legend-source">Fuente</span><span className="legend-derived">Derivada</span></div>
          </div>
          <p className="comparison-context">Valores originales conservan unidad y procedencia. Las ausencias no se interpretan como cero.</p>
          <div className="comparison-samples" aria-label="Metadatos de muestra por equipo">
            {columns.map((team) => team && <section className="sample-team" key={team.team_id} aria-label={`Muestra de ${team.name}`}>
              <h3>{team.name} · {team.side === 'home' ? 'Local' : 'Visitante'}</h3>
              <dl className="sample-details">
                <div><dt>Periodo</dt><dd>{team.sample.period.replaceAll('_', ' ')}</dd></div>
                <div><dt>Ámbito</dt><dd>{team.sample.scope}</dd></div>
                <div><dt>Partidos</dt><dd>{team.sample.matches_count ?? 'No disponible'}</dd></div>
                <div><dt>Rango</dt><dd>{formatSampleRange(team.sample)}</dd></div>
                <div><dt>Fuente</dt><dd>{team.sample.source_label ?? 'No disponible'}</dd></div>
              </dl>
            </section>)}
          </div>
          <div className="comparison-table" role="table" aria-label={`Comparación de las ${statDefinitions.length} estadísticas del partido`}>
            <div className="table-head" role="row"><span role="columnheader">ESTADÍSTICA</span><span role="columnheader">{home?.name} · LOCAL</span><span role="columnheader">{away?.name} · VISITANTE</span></div>
            {groups.map((group) => <div className="stat-group" key={group}>
              <h3>{group}</h3>
              {statDefinitions.filter(({ group: statGroup }) => statGroup === group).map((definition) => {
                const leftMeasurement = home?.stats[definition.key]
                const rightMeasurement = away?.stats[definition.key]
                const comparison = leftMeasurement && rightMeasurement
                  ? compareObservedMeasurements(leftMeasurement, rightMeasurement, {
                    left: { sample: home!.sample, side: home!.side },
                    right: { sample: away!.sample, side: away!.side },
                  })
                  : null
                return <div className="stat-row" role="row" key={definition.key}>
                <span className="stat-label" role="rowheader">{definition.label}<small>Fuente · {definition.unit === 'goals' ? 'goles' : definition.unit === 'percent' ? '%' : 'conteo'}</small></span>
                {columns.map((team, index) => {
                  const measurement = team?.stats[definition.key]
                  const percent = index === 0 ? comparison?.leftPercent : comparison?.rightPercent
                  return <span className="stat-value" role="cell" key={team?.team_id ?? definition.key}>
                    {team && <small className="team-stat-side">{team.side === 'home' ? 'LOCAL' : 'VISITANTE'}</small>}
                    {measurement ? formatMeasurement(measurement) : 'No disponible'}
                    {(measurement?.status === 'observed' || measurement?.status === 'estimated') && measurement.source_label && <small>{measurement.source_label}</small>}
                    {team && home && away && leftMeasurement?.status === 'observed' && rightMeasurement?.status === 'observed' && percent !== null && percent !== undefined && <span
                      className={`paired-bar paired-bar-${team.side}`}
                      role="img"
                      aria-label={`Comparación proporcional de ${definition.label} entre ${home.name}: ${leftMeasurement.value} ${formatUnit(leftMeasurement.unit)}, muestra ${formatSampleContext(home.sample)}; y ${away.name}: ${rightMeasurement.value} ${formatUnit(rightMeasurement.unit)}, muestra ${formatSampleContext(away.sample)}. Barra de ${team.name}: ${percent.toFixed(0)} por ciento de la escala relativa.`}
                    >
                      <span className="paired-bar-caption">Comparativa {percent.toFixed(0)}%</span>
                      <span className="paired-bar-track" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
                    </span>}
                  </span>
                })}
                {comparison?.status && <span className="comparison-state" role="cell">{comparison.status}</span>}
              </div>
              })}
            </div>)}
          </div>
          <div className="derived-section">
            <div className="derived-heading"><span className="derived-tag">DERIVADAS</span><h3>Operaciones transparentes</h3><p>No reemplazan las cifras fuente ni deciden un mercado.</p></div>
            <div className="derived-grid">{derivedMetrics.map((metric) => <article className="derived-item" key={metric.id}>
              <span>{metric.label}</span><strong>{formatDerived(metric)}</strong><small>{metric.formula}</small><small>Origen: {metric.sources.join(' + ')}</small>
            </article>)}</div>
          </div>
        </section>

        <section className="markets" aria-labelledby="markets-title">
          <div className="section-heading">
            <div><p className="eyebrow">04 / EVALUACIÓN</p><h2 id="markets-title">Catálogo permitido</h2></div>
            <span className="catalog-count">06 MERCADOS · SIN EXCEPCIONES</span>
          </div>
          <p className="market-intro">Cada resultado se calcula con las estadísticas observadas del expediente. La cuota de victoria simple solo identifica el favorito; no modifica score, gates ni penalizaciones.</p>
          <div className="market-grid">{marketDefinitions.map((market, index) => {
            const marketCandidates = analysisResult?.markets.find(({ market: id }) => id === market.id)?.candidates ?? []
            return <article className="market-item" key={market.id}>
            <div className="market-top"><span className="market-index">0{index + 1}</span><span className="market-state">{analysisResult?.markets.find(({ market: id }) => id === market.id)?.candidates.some(({ status }) => status === 'ELIGIBLE') ? 'Elegible' : 'Consulta resultados'}</span></div>
            <h3>{market.title}</h3><p className="market-selection">Selecciones del catálogo: {market.selection}</p>
            <div className="market-buffer"><span>BUFFER FIJADO</span><strong>{market.buffer}</strong></div>
            <div className="market-observed"><span>DATOS REQUERIDOS</span><strong>{market.observed}</strong></div>
            {marketCandidates.length > 0
              ? marketCandidates.map((candidate) => <CandidateResult key={candidate.candidate.candidate_id} candidate={candidate} input={validatedInput} justification={justifications[candidate.candidate.candidate_id]?.narrative} />)
              : <div className="candidate-result"><strong>No evaluable</strong><p>No se generaron candidatos para este mercado.</p></div>}
          </article>
          })}</div>
          <section className="ai-notice" aria-label="Justificaciones cualitativas">
            <span className="ai-symbol" aria-hidden="true">AI</span>
            <div><p className="eyebrow">ANÁLISIS CUALITATIVO</p><h2>{requestingJustifications ? 'Redactando justificaciones' : eligibleCount > 0 ? 'Candidatos elegibles disponibles' : 'Sin candidatos elegibles'}</h2><p>{eligibleCount > 0 ? 'La solicitud es opcional y solo añade texto cualitativo; el motor determinista conserva la decisión.' : 'La solicitud opcional solo está disponible para candidatos elegibles.'}</p></div>
            {eligibleCount > 0 && <button className="button button-secondary ai-request" type="button" onClick={requestEligibleJustifications} disabled={requestingJustifications}>{requestingJustifications ? 'Solicitando…' : Object.keys(justifications).length ? 'Solicitar de nuevo (opcional)' : 'Solicitar justificaciones (opcional)'}</button>}
          </section>
          {justificationError && <p className="justification-error" role="alert">{justificationError} <button type="button" onClick={requestEligibleJustifications} disabled={requestingJustifications}>Reintentar</button></p>}
          <div className="modifiers" aria-labelledby="modifiers-title">
            <div className="modifiers-heading"><p className="eyebrow">REGLAS DEL MOTOR</p><h3 id="modifiers-title">Modificadores aplicados</h3><p>Solo se activan con mediciones y condiciones explícitas.</p></div>
            <div className="modifier-list">{modifierDefinitions.map((modifier) => <div className="modifier-row" key={modifier.title}><strong>{modifier.title}</strong><span>{modifier.trigger}</span><span>{modifier.impact}</span><small>{modifier.scope}</small></div>)}</div>
          </div>
        </section>

        <p className="persistent-disclaimer">La IA no inventa ni corrige cifras. El análisis se basa exclusivamente en los datos introducidos; no constituye garantía de resultado.</p>
      </>}
      {!analyzed && <section className="empty-state" aria-label="Sin análisis">
        <div className="empty-glyph" aria-hidden="true">↳</div><div><span className="eyebrow">EN ESPERA</span><p>{validatedInput ? 'Entrada válida. Analiza para ver comparación y mercados.' : 'El comparador aparecerá aquí cuando el expediente sea válido.'}</p></div>
      </section>}
      {analyzed && <section className="sr-only" ref={resultRef} tabIndex={-1} aria-label="Resultados del análisis">El motor determinista terminó. Revisa el estado, la puntuación, los gates y la trazabilidad de cada candidato.</section>}
      <footer className="page-footer"><span>CUADERNO DE PARTIDO <i>·</i> JSON V1</span><span>Datos manuales · sin persistencia</span></footer>
    </main>
  )
}

export default App