import type { MatchInput } from '../domain/types'

export type Justification = {
  candidate_id: string
  narrative: string
  referenced_metric_ids: string[]
}

export type JustificationErrorCode =
  | 'INVALID_REQUEST'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPSTREAM_TIMEOUT'
  | 'INVALID_MODEL_RESPONSE'
  | 'INTERNAL_ERROR'

export type JustificationResult =
  | { ok: true; justifications: Justification[] }
  | { ok: false; code: JustificationErrorCode; message: string }
  | { ok: false; cancelled: true }

const safeMessages: Record<JustificationErrorCode, string> = {
  INVALID_REQUEST: 'La solicitud no pudo validarse. Vuelve a analizar la entrada.',
  PAYLOAD_TOO_LARGE: 'La entrada supera el tamaño permitido.',
  RATE_LIMITED: 'Se alcanzó el límite local de solicitudes. Inténtalo más tarde.',
  UPSTREAM_UNAVAILABLE: 'La justificación no está disponible. Comprueba la configuración del servidor y reintenta.',
  UPSTREAM_TIMEOUT: 'La solicitud agotó el tiempo de espera. Puedes reintentar.',
  INVALID_MODEL_RESPONSE: 'La respuesta de justificación no superó la validación. Puedes reintentar.',
  INTERNAL_ERROR: 'No se pudo completar la solicitud. Puedes reintentar.',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
}

export async function requestJustifications(input: MatchInput, eligibleCandidateIds: string[], signal?: AbortSignal): Promise<JustificationResult> {
  let response: Response
  try {
    response = await fetch('/api/v1/gemini/justifications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input }),
      signal,
    })
  } catch (error) {
    if (isAbortError(error)) return { ok: false, cancelled: true }
    return { ok: false, code: 'UPSTREAM_UNAVAILABLE', message: safeMessages.UPSTREAM_UNAVAILABLE }
  }

  let result: unknown
  try {
    result = await response.json() as unknown
  } catch (error) {
    if (isAbortError(error)) return { ok: false, cancelled: true }
    return { ok: false, code: 'INVALID_MODEL_RESPONSE', message: safeMessages.INVALID_MODEL_RESPONSE }
  }
  if (!response.ok) {
    const error = isRecord(result) && isRecord(result.error) ? result.error : null
    const code = typeof error?.code === 'string' && error.code in safeMessages
      ? error.code as JustificationErrorCode
      : 'INTERNAL_ERROR'
    return { ok: false, code, message: safeMessages[code] }
  }

  if (!isRecord(result) || Object.keys(result).length !== 2 || result.contract_version !== '1.0'
    || !Array.isArray(result.justifications) || result.justifications.length !== eligibleCandidateIds.length) {
    return { ok: false, code: 'INVALID_MODEL_RESPONSE', message: safeMessages.INVALID_MODEL_RESPONSE }
  }
  const seen = new Set<string>()
  const justifications: Justification[] = []
  for (const item of result.justifications) {
    if (!isRecord(item) || Object.keys(item).length !== 3
      || typeof item.candidate_id !== 'string' || !eligibleCandidateIds.includes(item.candidate_id)
      || seen.has(item.candidate_id) || typeof item.narrative !== 'string'
      || item.narrative.length < 30 || item.narrative.length > 500 || /\d/.test(item.narrative)
      || !Array.isArray(item.referenced_metric_ids)
      || !item.referenced_metric_ids.every((id) => typeof id === 'string')
      || new Set(item.referenced_metric_ids).size !== item.referenced_metric_ids.length) {
      return { ok: false, code: 'INVALID_MODEL_RESPONSE', message: safeMessages.INVALID_MODEL_RESPONSE }
    }
    seen.add(item.candidate_id)
    justifications.push({
      candidate_id: item.candidate_id,
      narrative: item.narrative,
      referenced_metric_ids: item.referenced_metric_ids as string[],
    })
  }
  if (seen.size !== eligibleCandidateIds.length) {
    return { ok: false, code: 'INVALID_MODEL_RESPONSE', message: safeMessages.INVALID_MODEL_RESPONSE }
  }
  return { ok: true, justifications }
}