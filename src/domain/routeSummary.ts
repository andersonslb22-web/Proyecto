import type { CandidateEvaluation, DecisionStatus, MatchAnalysis } from './engine'
import type { Quote } from './types'

export type AlternateEvaluationSummary = {
  quote: Quote
  route: 'scaled' | 'fallback'
  status: DecisionStatus
  score: number | null
  impliedProbability: number | null
  requiredScore: number | null
  expectedValue: boolean | null
  gate: CandidateEvaluation['gate']
  penalties: string[]
  trace: string[]
}

export function buildAlternateSummaries(
  candidate: CandidateEvaluation,
  analysis: MatchAnalysis,
): AlternateEvaluationSummary[] {
  const evaluations = analysis.markets.flatMap(({ candidates }) => candidates)
  const routes = [
    { quoteId: candidate.scaledQuoteId, route: 'scaled' as const },
    { quoteId: candidate.fallbackQuoteId, route: 'fallback' as const },
  ]

  return routes.flatMap(({ quoteId, route }) => {
    if (!quoteId) return []
    const evaluation = evaluations.find(({ quote }) => quote.quote_id === quoteId)
    if (!evaluation) return []
    return [{
      quote: evaluation.quote,
      route,
      status: evaluation.status,
      score: evaluation.score,
      impliedProbability: evaluation.impliedProbability,
      requiredScore: evaluation.requiredScore,
      expectedValue: evaluation.expectedValue,
      gate: evaluation.gate,
      penalties: [...evaluation.penalties],
      trace: [...evaluation.trace],
    }]
  })
}