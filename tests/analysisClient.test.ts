import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAbortError, requestJustifications } from '../src/services/analysisClient'
import type { MatchInput } from '../src/domain/types'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestJustifications cancellation', () => {
  it('forwards the signal and classifies an aborted request without a user-facing error', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
      const signal = init?.signal as AbortSignal
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
    }))
    vi.stubGlobal('fetch', fetchMock)

    const pending = requestJustifications({} as MatchInput, ['quote-1'], controller.signal)
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal)
    controller.abort()

    const result = await pending
    expect(controller.signal.aborted).toBe(true)
    expect(result).toEqual({ ok: false, cancelled: true })
    expect(result).not.toHaveProperty('message')
    expect(isAbortError(new DOMException('aborted', 'AbortError'))).toBe(true)
    expect(isAbortError(new TypeError('network unavailable'))).toBe(false)
  })

  it('classifies abort while reading the response as cancellation', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(null, { status: 200 })))
    const response = { ok: true, json: vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')) } as unknown as Response
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => response))

    const result = await requestJustifications({} as MatchInput, ['quote-1'])

    expect(result).toEqual({ ok: false, cancelled: true })
    expect(result).not.toHaveProperty('message')
  })
})