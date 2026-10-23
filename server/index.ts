import { loadEnvFile } from 'node:process'
import { createGeminiApiServer } from './geminiApi'

try {
  loadEnvFile('.env.local')
} catch {
  // La configuración puede llegar desde el entorno del proceso.
}

const port = 4174
const server = createGeminiApiServer({
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL,
})

server.listen(port, '127.0.0.1', () => {
  console.info(`Local API listening on http://127.0.0.1:${port}`)
})