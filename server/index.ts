import { createGeminiApiServer } from './geminiApi'

const port = 4174
const server = createGeminiApiServer({
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL,
})

server.listen(port, '127.0.0.1', () => {
  console.info(`Local API listening on http://127.0.0.1:${port}`)
})