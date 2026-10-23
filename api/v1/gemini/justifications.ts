import type { IncomingMessage, ServerResponse } from 'node:http'
<<<<<<< Updated upstream
import { handleGeminiApiRequest } from '../../../../server/geminiApi'
=======
import { handleGeminiApiRequest } from '../../../server/geminiApi.js'
>>>>>>> Stashed changes

export default function handler(request: IncomingMessage, response: ServerResponse) {
  handleGeminiApiRequest(request, response, {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
  })
}
