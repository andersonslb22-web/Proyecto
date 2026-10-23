import type { CandidateEvaluation, RouteEvaluation } from './engine.js'

export type AlternateEvaluationSummary = {
  route: 'scaled' | 'fallback'
  evaluation: RouteEvaluation
}

export function buildAlternateSummaries(candidate: CandidateEvaluation): AlternateEvaluationSummary[] {
  const summaries: AlternateEvaluationSummary[] = []
  if (candidate.scaled) summaries.push({ route: 'scaled', evaluation: candidate.scaled })
  if (candidate.fallback) summaries.push({ route: 'fallback', evaluation: candidate.fallback })
  return summaries
}