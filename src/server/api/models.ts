import { Router } from 'express'
import { getDb } from '../db'
import { v4 as uuidv4 } from 'uuid'
import type { Service } from '../../types'

const router = Router({ mergeParams: true })

// GET /api/services/:serviceId/models
router.get('/', (req, res) => {
  const { serviceId } = req.params
  const db = getDb()
  const models = db.prepare(
    'SELECT * FROM service_models WHERE service_id = ? ORDER BY model_id ASC'
  ).all(serviceId)
  res.json(models)
})

// POST /api/services/:serviceId/models
router.post('/', (req, res) => {
  const { serviceId } = req.params
  const { model_id, display_name } = req.body
  if (!model_id) return res.status(400).json({ error: 'model_id is required' })

  const db = getDb()
  const id = uuidv4()
  try {
    db.prepare(
      'INSERT INTO service_models (id, service_id, model_id, display_name, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, serviceId, model_id, display_name || null, Date.now())
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: `Model "${model_id}" already exists for this service` })
    }
    throw e
  }
  res.status(201).json(db.prepare('SELECT * FROM service_models WHERE id = ?').get(id))
})

// DELETE /api/services/:serviceId/models/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params
  const db = getDb()
  const result = db.prepare('DELETE FROM service_models WHERE id = ?').run(id)
  if (result.changes === 0) return res.status(404).json({ error: 'Model not found' })
  res.json({ success: true })
})

// POST /api/services/:serviceId/models/fetch — auto-fetch from provider API
router.post('/fetch', async (req, res) => {
  const { serviceId } = req.params
  const { endpoint } = req.body || {}
  const db = getDb()

  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId) as Service | undefined
  if (!service) return res.status(404).json({ error: 'Service not found' })

  try {
    // If custom endpoint is given, always use the generic OpenAI-style fetch (works with any gateway)
    const models = endpoint
      ? await fetchOpenAIModels(service.api_key, endpoint, false)
      : await fetchModelsFromProvider(service)

    const insert = db.prepare(
      'INSERT OR IGNORE INTO service_models (id, service_id, model_id, display_name, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    const now = Date.now()
    let added = 0
    for (const m of models) {
      const result = insert.run(uuidv4(), serviceId, m.id, m.name || null, now)
      if (result.changes > 0) added++
    }

    const all = db.prepare('SELECT * FROM service_models WHERE service_id = ? ORDER BY model_id ASC').all(serviceId)
    res.json({ fetched: models.length, added, models: all })
  } catch (e: any) {
    res.status(502).json({ error: `Failed to fetch models: ${e.message}` })
  }
})

async function fetchModelsFromProvider(
  service: Service
): Promise<{ id: string; name?: string }[]> {
  switch (service.provider) {
    case 'openai':
      return fetchOpenAIModels(service.api_key, service.base_url, true)
    case 'anthropic':
      return fetchAnthropicModels()
    case 'gemini':
      return fetchGeminiModels(service.api_key, service.base_url)
    case 'deepseek':
      return fetchDeepSeekModels(service.api_key, service.base_url)
    default:
      return []
  }
}

async function fetchDeepSeekModels(apiKey: string, baseUrl?: string | null): Promise<{ id: string; name?: string }[]> {
  const base = baseUrl || 'https://api.deepseek.com'
  const url = `${base.replace(/\/$/, '')}/models`
  const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } })
  if (!resp.ok) throw new Error(`DeepSeek API returned ${resp.status}: ${(await resp.text()).slice(0, 200)}`)
  const data = await resp.json() as { data?: { id: string }[] }
  return (data.data || [])
    .map(m => ({ id: m.id }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

async function fetchOpenAIModels(apiKey: string, baseUrl?: string | null, filterChat = true): Promise<{ id: string; name?: string }[]> {
  // If baseUrl already ends with /models or /v1/models, use it directly
  let url: string
  if (baseUrl && (baseUrl.endsWith('/models') || baseUrl.endsWith('/v1/models'))) {
    url = baseUrl
  } else {
    const base = baseUrl || 'https://api.openai.com'
    url = `${base.replace(/\/$/, '')}/v1/models`
  }
  const resp = await fetch(url, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })
  if (!resp.ok) throw new Error(`API returned ${resp.status}: ${(await resp.text()).slice(0, 200)}`)
  const data = await resp.json() as { data?: { id: string }[]; models?: { id: string }[] }
  // Support both OpenAI format { data: [...] } and other formats { models: [...] }
  const models = data.data || data.models || []
  if (filterChat) {
    return models
      .filter((m: any) => /^(gpt-|o1|o3|chatgpt)/.test(m.id))
      .map((m: any) => ({ id: m.id }))
      .sort((a: any, b: any) => a.id.localeCompare(b.id))
  }
  return models
    .map((m: any) => ({ id: m.id, name: m.name }))
    .sort((a: any, b: any) => a.id.localeCompare(b.id))
}

async function fetchAnthropicModels(): Promise<{ id: string; name?: string }[]> {
  // Anthropic has no public list models API, return known models
  return [
    { id: 'claude-opus-4', name: 'Claude Opus 4' },
    { id: 'claude-sonnet-4', name: 'Claude Sonnet 4' },
    { id: 'claude-haiku-4', name: 'Claude Haiku 4' },
    { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
  ]
}

async function fetchGeminiModels(apiKey: string, baseUrl?: string | null): Promise<{ id: string; name?: string }[]> {
  const base = baseUrl || 'https://generativelanguage.googleapis.com'
  const url = `${base}/v1beta/models?key=${apiKey}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Gemini API returned ${resp.status}: ${await resp.text()}`)
  const data = await resp.json() as { models: { name: string; displayName: string; supportedGenerationMethods?: string[] }[] }
  return data.models
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => ({
      id: m.name.replace('models/', ''),
      name: m.displayName,
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

export default router
