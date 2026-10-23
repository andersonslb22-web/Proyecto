import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleGeminiApiRequest } from '../../../server/geminiApi.js'

export default function handler(request: IncomingMessage, response: ServerResponse) {
  handleGeminiApiRequest(request, response, {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
  })
}
