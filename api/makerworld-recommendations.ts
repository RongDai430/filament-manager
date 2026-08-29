import { MAKERWORLD_LISTING_URL, parseMakerWorldModels, pickRandomModels } from '../src/makerworld'

type RequestLike = { method?: string }
type ResponseLike = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => ResponseLike
  json: (body: unknown) => void
}

const CACHE_TTL_MS = 15 * 60 * 1000
const REQUEST_HEADERS = {
  Accept: 'text/html,application/xhtml+xml',
  'User-Agent': 'FilamentManager/1.0 (public MakerWorld recommendations)',
}

let cachedModels: { expiresAt: number; models: ReturnType<typeof parseMakerWorldModels> } | null = null

async function loadModels() {
  if (cachedModels && cachedModels.expiresAt > Date.now()) return cachedModels.models

  const response = await fetch(MAKERWORLD_LISTING_URL, {
    headers: REQUEST_HEADERS,
    redirect: 'follow',
  })
  if (!response.ok) throw new Error(`MakerWorld returned ${response.status}`)

  const models = parseMakerWorldModels(await response.text())
  if (models.length < 4) throw new Error('MakerWorld listing did not contain enough models')
  cachedModels = { expiresAt: Date.now() + CACHE_TTL_MS, models }
  return models
}

export default async function handler(request: RequestLike, response: ResponseLike) {
  response.setHeader('Cache-Control', 'private, no-store')
  response.setHeader('Access-Control-Allow-Origin', '*')

  if (request.method && request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    response.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const models = await loadModels()
    response.status(200).json({ models: pickRandomModels(models, 4) })
  } catch (error) {
    console.error('MakerWorld recommendation fetch failed', error)
    response.status(502).json({ error: 'MakerWorld recommendations unavailable' })
  }
}
