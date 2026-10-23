import { afterEach, describe, expect, it, vi } from 'vitest'
import { createGeminiApiServer } from '../server/geminiApi'
import { statDefinitions, type MatchInput, type Team } from '../src/domain/types'

const openServers: Array<{ close(callback: (error?: Error) => void): void; address(): { port: number } | string | null }> = []

function syntheticInput(eligible: boolean): MatchInput {
  const createTeam = (side: Team['side']): Team => ({
    team_id: `SYNTH-${side.toUpperCase()}`,
    name: `Synthetic ${side} name must not reach provider`,
    side,
    sample: { period: 'season_to_date', matches_count: 6, from: null, to: null, scope: 'all', source_label: 'synthetic only' },
    urgency: eligible ? 'high' : 'low',
    urgency_adjustment: { value: 0, unit: 'goals', status: 'observed', source_label: 'synthetic only' },
    structural_absences: [],
    stats: Object.fromEntries(statDefinitions.map(({ key, unit }) => [key, {
      value: eligible ? ({
        goals_scored: eligible ? 2 : 0, xg: eligible ? (side === 'home' ? 3 : 1) : 0, xga: eligible ? (side === 'home' ? 0.5 : 1.5) : 0,
        shots_on_target: 6, big_chances_created: 3, goals_conceded: 0.5, errors: 0, fouls: 10,
      }[key] ?? 1) : 0,
      unit,
      status: 'observed',
      source_label: 'synthetic only',
    }])) as Team['stats'],
  })
  return {
    schema_version: '1.0',
    match: {
      match_id: 'SYNTHETIC-API-TEST',
      competition: 'Synthetic competition, private field',
      kickoff: null,
      teams: [createTeam('home'), createTeam('away')],
      simple_win_odds: { home: 2.2, away: 3.1 },
      home_advantage: { value: null, unit: 'goals', status: 'missing', source_label: null },
    },
  }
}

async function startApi(options: Parameters<typeof createGeminiApiServer>[0] = {}) {
  const server = createGeminiApiServer(options)
  openServers.push(server)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port')
  return `http://127.0.0.1:${address.port}/api/v1/gemini/justifications`
}

function providerResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function validModelResult(candidateId = 'candidate-001') {
  return {
    contract_version: '1.0',
    justifications: [{
      candidate_id: candidateId,
      narrative: 'El perfil combina señales ofensivas consistentes con una proyección que supera el umbral establecido.',
      referenced_metric_ids: ['home.goals_scored', 'home.xg', 'home.fouls'],
    }],
  }
}

afterEach(async () => {
  await Promise.all(openServers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })))
  vi.restoreAllMocks()
})

describe('POST /api/v1/gemini/justifications', () => {
  it('devuelve lista vacía sin clave ni llamada upstream cuando no hay elegibles', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    const url = await startApi({ fetchImpl: fetchMock })
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: syntheticInput(false) }) })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ contract_version: '1.0', justifications: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('acepta el origen autorizado y las solicitudes directas sin Origin', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    const url = await startApi({ fetchImpl: fetchMock })
    const body = JSON.stringify({ input: syntheticInput(false) })
    const proxiedResponse = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8', origin: 'http://localhost:5174' },
      body,
    })
    const directResponse = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body,
    })
    expect(proxiedResponse.status).toBe(200)
    expect(directResponse.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rechaza un origen local no autorizado sin consultar al proveedor', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    const url = await startApi({ fetchImpl: fetchMock })
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:9999' },
      body: JSON.stringify({ input: syntheticInput(true) }),
    })
    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('INVALID_REQUEST')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rechaza Content-Type distinto de application/json antes de leer el body o consultar al proveedor', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    const url = await startApi({ apiKey: 'synthetic-key', fetchImpl: fetchMock })
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ input: syntheticInput(true) }),
    })
    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('INVALID_REQUEST')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rechaza candidatos inyectados por el navegador antes de consultar al proveedor', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    const url = await startApi({ apiKey: 'test-only-key', fetchImpl: fetchMock })
    const response = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: syntheticInput(true), eligible_candidates: [{ candidate_id: 'fake' }] }),
    })
    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('INVALID_REQUEST')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rechaza propiedades de cuotas fuera del bloque de victoria simple', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    const url = await startApi({ apiKey: 'test-only-key', fetchImpl: fetchMock })
    const input = syntheticInput(false) as MatchInput & { match: MatchInput['match'] & Record<string, unknown> }
    ;(input.match as MatchInput['match'] & Record<string, unknown>).quotes = []
    const response = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input }),
    })
    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('INVALID_REQUEST')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('responde con error genérico si hay elegibles pero falta la clave', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    const url = await startApi({ fetchImpl: fetchMock })
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: syntheticInput(true) }) })
    expect(response.status).toBe(503)
    expect((await response.json()).error.code).toBe('UPSTREAM_UNAVAILABLE')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('envía al proveedor solo candidatos elegibles y métricas numéricas sin nombres ni expediente', async () => {
    let providerBody = ''
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('synthetic-key')
      providerBody = String(init?.body)
      const request = JSON.parse(providerBody)
      const payload = JSON.parse(request.contents[0].parts[0].text)
      return providerResponse({
        contract_version: '1.0',
        justifications: payload.eligible_candidates.map(({ candidate_id }: { candidate_id: string }) => ({
          candidate_id,
          narrative: 'El perfil refleja señales estadísticas consistentes en los aspectos ofensivos y defensivos observados.',
          referenced_metric_ids: payload.metrics.slice(0, 1).map(({ metric_id }: { metric_id: string }) => metric_id),
        })),
      })
    })
    const url = await startApi({ apiKey: 'synthetic-key', fetchImpl: fetchMock })
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: syntheticInput(true) }) })
    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result.contract_version).toBe('1.0')
    expect(result.justifications.length).toBeGreaterThan(0)
    expect(result.justifications.every(({ candidate_id }: { candidate_id: string }) => !candidate_id.startsWith('candidate-'))).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(providerBody).not.toContain('Synthetic home name')
    expect(providerBody).not.toContain('Synthetic competition')
    expect(providerBody).not.toContain('SYNTHETIC-API-TEST')
    expect(providerBody).not.toContain('source_label')
    expect(providerBody).toContain('candidate-001')
  })

  it('descarta una respuesta del modelo con candidate_id no elegible', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => providerResponse(validModelResult('candidate-999')))
    const url = await startApi({ apiKey: 'synthetic-key', fetchImpl: fetchMock })
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: syntheticInput(true) }) })
    expect(response.status).toBe(502)
    expect((await response.json()).error.code).toBe('INVALID_MODEL_RESPONSE')
  })

  it('descarta respuestas con forma, versión, referencias o longitud inválidas', async () => {
    const invalidResponses = [
      { contract_version: '2.0', justifications: validModelResult().justifications },
      { contract_version: '1.0', justifications: [{ ...validModelResult().justifications[0], extra: true }] },
      { contract_version: '1.0', justifications: [{ ...validModelResult().justifications[0], referenced_metric_ids: ['match.home_advantage'] }] },
      { contract_version: '1.0', justifications: [{ ...validModelResult().justifications[0], narrative: 'Score de 80: recomiendo elegir esta opción.' }] },
      { contract_version: '1.0', justifications: [] },
    ]
    for (const invalid of invalidResponses) {
      const fetchMock = vi.fn<typeof fetch>(async () => providerResponse(invalid))
      const url = await startApi({ apiKey: 'synthetic-key', fetchImpl: fetchMock })
      const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: syntheticInput(true) }) })
      expect(response.status).toBe(502)
      expect((await response.json()).error.code).toBe('INVALID_MODEL_RESPONSE')
    }
  })

  it('prueba el siguiente modelo cuando el modelo automático no está disponible', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'Model not found' } }), { status: 404 }))
      .mockImplementationOnce(async (_url, init) => {
        const request = JSON.parse(String(init?.body))
        const payload = JSON.parse(request.contents[0].parts[0].text)
        return providerResponse({
          contract_version: '1.0',
          justifications: payload.eligible_candidates.map(({ candidate_id }: { candidate_id: string }) => ({
            candidate_id,
            narrative: 'El perfil refleja señales estadísticas consistentes en los aspectos ofensivos y defensivos observados.',
            referenced_metric_ids: payload.metrics.slice(0, 1).map(({ metric_id }: { metric_id: string }) => metric_id),
          })),
        })
      })
    const url = await startApi({ apiKey: 'synthetic-key', model: 'auto', fetchImpl: fetchMock })
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: syntheticInput(true) }),
    })
    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/gemini-3.8-flash:generateContent')
    expect(String(fetchMock.mock.calls[1][0])).toContain('/gemini-3.5-flash-lite:generateContent')
  })

  it('prueba el siguiente modelo cuando Gemini devuelve alta demanda temporal', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'This model is currently experiencing high demand.' } }), { status: 503 }))
      .mockImplementationOnce(async (_url, init) => {
        const request = JSON.parse(String(init?.body))
        const payload = JSON.parse(request.contents[0].parts[0].text)
        return providerResponse({
          contract_version: '1.0',
          justifications: payload.eligible_candidates.map(({ candidate_id }: { candidate_id: string }) => ({
            candidate_id,
            narrative: 'El perfil refleja señales estadísticas consistentes en los aspectos ofensivos y defensivos observados.',
            referenced_metric_ids: payload.metrics.slice(0, 1).map(({ metric_id }: { metric_id: string }) => metric_id),
          })),
        })
      })
    const url = await startApi({ apiKey: 'synthetic-key', model: 'auto', fetchImpl: fetchMock })
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: syntheticInput(true) }),
    })
    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('mapea timeout y errores del proveedor a errores seguros', async () => {
    const timeoutUrl = await startApi({ apiKey: 'synthetic-key', fetchImpl: vi.fn<typeof fetch>(async () => { throw new DOMException('timeout', 'TimeoutError') }) })
    const timeoutResponse = await fetch(timeoutUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: syntheticInput(true) }) })
    expect(timeoutResponse.status).toBe(504)
    expect((await timeoutResponse.json()).error.code).toBe('UPSTREAM_TIMEOUT')

    const upstreamUrl = await startApi({ apiKey: 'synthetic-key', fetchImpl: vi.fn<typeof fetch>(async () => { throw new Error('sensitive provider detail') }) })
    const upstreamResponse = await fetch(upstreamUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: syntheticInput(true) }) })
    expect(upstreamResponse.status).toBe(502)
    const upstreamBody = await upstreamResponse.json()
    expect(upstreamBody.error).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' })
    expect(JSON.stringify(upstreamBody)).not.toContain('sensitive provider detail')

    const rejectedUrl = await startApi({ apiKey: 'synthetic-key', fetchImpl: vi.fn<typeof fetch>(async () => providerResponse({}, 429)) })
    const rejectedResponse = await fetch(rejectedUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: syntheticInput(true) }) })
    expect(rejectedResponse.status).toBe(502)
    expect((await rejectedResponse.json()).error.code).toBe('UPSTREAM_UNAVAILABLE')
  })

  it('aborta la llamada upstream cuando el cliente cierra la conexión', async () => {
    let resolveProviderStarted!: () => void
    let resolveProviderAborted!: () => void
    let providerSignal: AbortSignal | undefined
    const providerStarted = new Promise<void>((resolve) => { resolveProviderStarted = resolve })
    const providerAborted = new Promise<void>((resolve) => { resolveProviderAborted = resolve })
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      providerSignal = init?.signal as AbortSignal
      providerSignal.addEventListener('abort', () => {
        resolveProviderAborted()
        resolveProviderResponse()
      }, { once: true })
      resolveProviderStarted()
      return await new Promise<Response>((resolve) => { resolveProviderResponse = () => resolve(providerResponse(validModelResult())) })
    })
    let resolveProviderResponse!: () => void
    const url = await startApi({ apiKey: 'synthetic-key', fetchImpl: fetchMock })
    const clientController = new AbortController()
    const clientRequest = fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: syntheticInput(true) }),
      signal: clientController.signal,
    })
    await providerStarted
    clientController.abort()
    await expect(clientRequest).rejects.toMatchObject({ name: 'AbortError' })
    await providerAborted
    expect(providerSignal?.aborted).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})