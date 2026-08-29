export const MAKERWORLD_LISTING_URL = 'https://makerworld.com/en/3d-models'
const MAKERWORLD_ORIGIN = 'https://makerworld.com'
const MODEL_PATH_PATTERN = /\/en\/models\/(\d+)(?:[/?#]|$)/i

export type MakerWorldModel = {
  id: string
  name: string
  author: string
  imageUrl: string
  url: string
}

type UnknownRecord = Record<string, unknown>

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim()

const decodeHtml = (value: string) => value
  .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ')

const stripTags = (value: string) => normalizeText(decodeHtml(value
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')))

function parseAttributes(tag: string): UnknownRecord {
  const attributes: UnknownRecord = {}
  const pattern = /([:\w-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g
  for (const match of tag.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = decodeHtml(match[2].replace(/^['"]|['"]$/g, ''))
  }
  return attributes
}

function asText(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const text = normalizeText(String(value))
  return text || undefined
}

function asNestedText(value: unknown): string | undefined {
  const direct = asText(value)
  if (direct) return direct
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const object = value as UnknownRecord
  for (const key of ['name', 'displayName', 'nickname', 'username', 'userName', 'handle']) {
    const text = asText(object[key])
    if (text) return text
  }
  return undefined
}

function toAbsoluteUrl(value: unknown): string | undefined {
  const text = asText(value)
  if (!text || text.startsWith('data:')) return undefined
  const candidate = text.startsWith('//') ? `https:${text}` : text
  try {
    const url = new URL(candidate, MAKERWORLD_ORIGIN)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}

function imageFromValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const image = imageFromValue(item)
      if (image) return image
    }
    return undefined
  }
  if (typeof value === 'object' && value !== null) {
    const object = value as UnknownRecord
    for (const key of ['url', 'src', 'imageUrl', 'image', 'original', 'large', 'medium']) {
      const image = imageFromValue(object[key])
      if (image) return image
    }
    return undefined
  }
  return toAbsoluteUrl(value)
}

function imageFromTag(tag: string): string | undefined {
  const attributes = parseAttributes(tag)
  const direct = imageFromValue(attributes.src)
    || imageFromValue(attributes['data-src'])
    || imageFromValue(attributes['data-original'])
    || imageFromValue(attributes['data-lazy-src'])
  if (direct) return direct

  const srcset = asText(attributes.srcset || attributes['data-srcset'])
  if (!srcset) return undefined
  const firstSource = srcset.split(',')[0]?.trim().split(/\s+/)[0]
  return toAbsoluteUrl(firstSource)
}

function modelIdFromUrl(value: unknown): string | undefined {
  const text = asText(value)
  return text?.match(MODEL_PATH_PATTERN)?.[1]
}

function modelUrl(id: string) {
  return `${MAKERWORLD_ORIGIN}/en/models/${id}`
}

function authorFromLabel(value: string | undefined): { name?: string; author?: string } {
  if (!value) return {}
  const separator = value.match(/^(.*?)\s+(?:by|作者[:：])\s+(.+)$/i)
  if (!separator) return { name: value }
  return { name: normalizeText(separator[1]), author: normalizeText(separator[2]) }
}

function collectModel(
  models: Map<string, MakerWorldModel>,
  candidate: { id?: string; name?: string; author?: string; imageUrl?: string },
) {
  if (!candidate.id || !candidate.name || !candidate.imageUrl) return
  const next: MakerWorldModel = {
    id: candidate.id,
    name: candidate.name,
    author: candidate.author || 'MakerWorld 创作者',
    imageUrl: candidate.imageUrl,
    url: modelUrl(candidate.id),
  }
  const previous = models.get(next.id)
  if (!previous) {
    models.set(next.id, next)
    return
  }
  models.set(next.id, {
    ...previous,
    name: previous.name === 'MakerWorld 模型' ? next.name : previous.name,
    author: previous.author === 'MakerWorld 创作者' ? next.author : previous.author,
    imageUrl: previous.imageUrl || next.imageUrl,
  })
}

function collectFromAnchor(models: Map<string, MakerWorldModel>, anchor: string) {
  const openingTag = anchor.match(/^<a\b[^>]*>/i)?.[0] || ''
  const attributes = parseAttributes(openingTag)
  const id = modelIdFromUrl(attributes.href)
  if (!id) return

  const imageTag = anchor.match(/<(?:img|source)\b[^>]*>/i)?.[0]
  const imageUrl = imageTag ? imageFromTag(imageTag) : undefined
  const label = asText(attributes.title) || asText(attributes['aria-label']) || (imageTag ? asText(parseAttributes(imageTag).alt) : undefined)
  const labelParts = authorFromLabel(label)
  const dataName = asText(attributes['data-model-name']) || asText(attributes['data-name']) || asText(attributes['data-title'])
  const dataAuthor = asText(attributes['data-author']) || asText(attributes['data-creator']) || asText(attributes['data-username'])
  const text = stripTags(anchor)
  const textParts = authorFromLabel(text)
  const name = dataName || labelParts.name || textParts.name || text
  const author = dataAuthor || labelParts.author || textParts.author
  collectModel(models, { id, name, author, imageUrl })
}

function stringFromObject(object: UnknownRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asNestedText(object[key])
    if (value) return value
  }
  return undefined
}

function imageFromObject(object: UnknownRecord): string | undefined {
  for (const key of ['image', 'imageUrl', 'cover', 'coverUrl', 'coverImage', 'cover_image', 'thumbnail', 'thumbnailUrl', 'images', 'photos']) {
    const image = imageFromValue(object[key])
    if (image) return image
  }
  return undefined
}

function collectFromStructuredData(models: Map<string, MakerWorldModel>, value: unknown, depth = 0) {
  if (depth > 12 || !value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) collectFromStructuredData(models, item, depth + 1)
    return
  }

  const object = value as UnknownRecord
  const href = stringFromObject(object, ['url', 'href', 'link', 'modelUrl', 'detailUrl', 'shareUrl'])
  const id = modelIdFromUrl(href) || (asText(object.id)?.match(/^\d+$/)?.[0]) || (asText(object.modelId)?.match(/^\d+$/)?.[0]) || (asText(object.model_id)?.match(/^\d+$/)?.[0])
  const name = stringFromObject(object, ['name', 'title', 'modelName', 'modelTitle', 'model_name', 'displayName'])
  const author = stringFromObject(object, ['author', 'creator', 'owner', 'user', 'username', 'userName', 'user_name', 'designer'])
  const imageUrl = imageFromObject(object)
  collectModel(models, { id, name, author, imageUrl })

  for (const child of Object.values(object)) collectFromStructuredData(models, child, depth + 1)
}

function collectJsonScripts(models: Map<string, MakerWorldModel>, html: string) {
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  for (const match of html.matchAll(scriptPattern)) {
    const attributes = parseAttributes(match[1])
    const content = match[2].trim()
    const isJson = asText(attributes.type)?.includes('json') || content.startsWith('{') || content.startsWith('[')
    if (!isJson) continue
    try {
      collectFromStructuredData(models, JSON.parse(content))
    } catch {
      // A page can contain non-JSON scripts with JSON-like content; skip those safely.
    }
  }
}

export function parseMakerWorldModels(html: string): MakerWorldModel[] {
  const models = new Map<string, MakerWorldModel>()
  const anchorPattern = /<a\b[^>]*\bhref\s*=\s*(?:"[^"]*\/en\/models\/\d+[^"']*"|'[^']*\/en\/models\/\d+[^"']*'|[^\s>]+)[^>]*>[\s\S]*?<\/a>/gi
  for (const match of html.matchAll(anchorPattern)) collectFromAnchor(models, match[0])
  collectJsonScripts(models, html)
  return [...models.values()]
}

export function pickRandomModels(models: MakerWorldModel[], count = 4, random = Math.random): MakerWorldModel[] {
  const pool = [...models]
  const result: MakerWorldModel[] = []
  const amount = Math.min(Math.max(0, count), pool.length)
  while (result.length < amount) {
    const index = Math.floor(random() * pool.length)
    result.push(pool.splice(Math.min(index, pool.length - 1), 1)[0])
  }
  return result
}

export async function fetchMakerWorldRecommendations(signal?: AbortSignal): Promise<MakerWorldModel[]> {
  const response = await fetch(`/api/makerworld-recommendations?batch=${Date.now()}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  if (!response.ok) throw new Error('MakerWorld recommendations unavailable')
  const payload: unknown = await response.json()
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as UnknownRecord).models)) {
    throw new Error('MakerWorld recommendations unavailable')
  }
  const models = (payload as UnknownRecord).models as unknown[]
  return models.filter((model: unknown): model is MakerWorldModel => {
    if (!model || typeof model !== 'object') return false
    const candidate = model as UnknownRecord
    return ['id', 'name', 'author', 'imageUrl', 'url'].every((key) => typeof candidate[key] === 'string' && candidate[key])
  })
}
