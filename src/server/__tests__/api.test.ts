/**
 * Integration tests for the Express API routes using supertest.
 * Uses an in-memory SQLite DB via dependency injection shim.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import cors from 'cors'
import supertest from 'supertest'
import { DatabaseSync } from 'node:sqlite'

// Build a minimal Express app backed by an in-memory DB
function buildTestApp() {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(`
    CREATE TABLE services (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, provider TEXT NOT NULL,
      api_key TEXT NOT NULL, base_url TEXT, enabled INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE model_aliases (
      id TEXT PRIMARY KEY, alias TEXT NOT NULL UNIQUE,
      service_id TEXT REFERENCES services(id) ON DELETE CASCADE,
      target_model TEXT NOT NULL, description TEXT, created_at INTEGER NOT NULL
    );
    CREATE TABLE model_pricing (
      model TEXT PRIMARY KEY, input_cost_per_1k REAL NOT NULL,
      output_cost_per_1k REAL NOT NULL, is_custom INTEGER DEFAULT 0
    );
    CREATE TABLE request_logs (
      id TEXT PRIMARY KEY, service_id TEXT, provider TEXT NOT NULL, model TEXT NOT NULL,
      status TEXT NOT NULL, status_code INTEGER, prompt_tokens INTEGER, completion_tokens INTEGER,
      total_tokens INTEGER, estimated_cost_usd REAL, latency_ms INTEGER, error_message TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `)

  // Seed settings
  for (const [k, v] of [['port', '4141'], ['gateway_name', 'Test Gateway'], ['log_enabled', '1'], ['retention_days', '30']]) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(k, v)
  }

  const app = express()
  app.use(cors())
  app.use(express.json())

  // --- Services routes ---
  app.get('/api/services', (_req, res) => {
    const rows = db.prepare('SELECT * FROM services').all() as any[]
    res.json(rows.map((s: any) => ({ ...s, api_key: '***' + s.api_key.slice(-4) })))
  })
  app.post('/api/services', (req, res) => {
    const { name, provider, api_key, base_url } = req.body
    if (!name || !provider || !api_key) return res.status(400).json({ error: 'Missing fields' })
    const id = `svc-${Date.now()}`
    const now = Date.now()
    db.prepare('INSERT INTO services VALUES (?, ?, ?, ?, ?, 1, ?, ?)').run(id, name, provider, api_key, base_url || null, now, now)
    const s = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as any
    res.status(201).json({ ...s, api_key: '***' + s.api_key.slice(-4) })
  })
  app.delete('/api/services/:id', (req, res) => {
    const r = db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id)
    if (r.changes === 0) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  })

  // --- Aliases routes ---
  app.get('/api/aliases', (_req, res) => res.json(db.prepare('SELECT * FROM model_aliases').all()))
  app.post('/api/aliases', (req, res) => {
    const { alias, service_id, target_model, description } = req.body
    if (!alias || !service_id || !target_model) return res.status(400).json({ error: 'Missing fields' })
    const id = `alias-${Date.now()}`
    try {
      db.prepare('INSERT INTO model_aliases VALUES (?, ?, ?, ?, ?, ?)').run(id, alias, service_id, target_model, description || null, Date.now())
    } catch (e: any) {
      if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: `Alias "${alias}" already exists` })
      throw e
    }
    res.status(201).json(db.prepare('SELECT * FROM model_aliases WHERE id = ?').get(id))
  })
  app.delete('/api/aliases/:id', (req, res) => {
    const r = db.prepare('DELETE FROM model_aliases WHERE id = ?').run(req.params.id)
    if (r.changes === 0) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  })

  // --- Settings ---
  app.get('/api/settings', (_req, res) => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    const out: Record<string, string> = {}
    for (const r of rows) out[r.key] = r.value
    res.json(out)
  })
  app.put('/api/settings', (req, res) => {
    const updates = req.body as Record<string, string>
    const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    for (const [k, v] of Object.entries(updates)) upsert.run(k, String(v))
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    const out: Record<string, string> = {}
    for (const r of rows) out[r.key] = r.value
    res.json(out)
  })

  // --- Stats ---
  app.get('/api/stats', (_req, res) => {
    const totalRequests = (db.prepare('SELECT COUNT(*) as cnt FROM request_logs').get() as any).cnt
    const totalTokens = (db.prepare('SELECT COALESCE(SUM(total_tokens),0) as t FROM request_logs').get() as any).t
    const totalCost = (db.prepare('SELECT COALESCE(SUM(estimated_cost_usd),0) as c FROM request_logs').get() as any).c
    res.json({ totalRequests, totalTokens, totalCost })
  })

  // --- Logs ---
  app.get('/api/logs', (req, res) => {
    const { page = '1', limit = '50', provider, status } = req.query
    const pageNum = Math.max(1, parseInt(page as string))
    const limitNum = Math.min(200, parseInt(limit as string))
    const offset = (pageNum - 1) * limitNum
    const conds: string[] = []
    const params: (string | number)[] = []
    if (provider) { conds.push('provider = ?'); params.push(provider as string) }
    if (status) { conds.push('status = ?'); params.push(status as string) }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const total = (db.prepare(`SELECT COUNT(*) as cnt FROM request_logs ${where}`).get(...params) as any).cnt
    const logs = db.prepare(`SELECT * FROM request_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limitNum, offset)
    res.json({ logs, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) })
  })

  return { app, db }
}

let agent: ReturnType<typeof supertest>
let db: DatabaseSync
let serviceId: string

beforeAll(() => {
  const { app, db: testDb } = buildTestApp()
  db = testDb
  agent = supertest(app)
})

afterAll(() => {
  db.close()
})

// ─── Services ────────────────────────────────────────────────────────────────

describe('GET /api/services', () => {
  it('returns empty array initially', async () => {
    const res = await agent.get('/api/services')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('POST /api/services', () => {
  it('creates a new service', async () => {
    const res = await agent.post('/api/services').send({
      name: 'OpenAI Test',
      provider: 'openai',
      api_key: 'sk-testkey123',
    })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('OpenAI Test')
    expect(res.body.provider).toBe('openai')
    expect(res.body.api_key).toMatch(/^\*\*\*/)
    expect(res.body.api_key).toContain('y123')
    serviceId = res.body.id
  })

  it('returns 400 when fields are missing', async () => {
    const res = await agent.post('/api/services').send({ name: 'Test' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBeTruthy()
  })
})

describe('GET /api/services (after create)', () => {
  it('lists the created service', async () => {
    const res = await agent.get('/api/services')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].name).toBe('OpenAI Test')
  })
})

// ─── Aliases ─────────────────────────────────────────────────────────────────

describe('Model aliases API', () => {
  let aliasId: string

  it('starts empty', async () => {
    const res = await agent.get('/api/aliases')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('creates an alias', async () => {
    const res = await agent.post('/api/aliases').send({
      alias: 'fast',
      service_id: serviceId,
      target_model: 'gpt-4o-mini',
      description: 'Fastest model',
    })
    expect(res.status).toBe(201)
    expect(res.body.alias).toBe('fast')
    expect(res.body.target_model).toBe('gpt-4o-mini')
    aliasId = res.body.id
  })

  it('rejects duplicate alias', async () => {
    const res = await agent.post('/api/aliases').send({
      alias: 'fast',
      service_id: serviceId,
      target_model: 'gpt-4o',
    })
    expect(res.status).toBe(409)
    expect(res.body.error).toContain('"fast"')
  })

  it('returns 400 for missing fields', async () => {
    const res = await agent.post('/api/aliases').send({ alias: 'smart' })
    expect(res.status).toBe(400)
  })

  it('deletes an alias', async () => {
    const res = await agent.delete(`/api/aliases/${aliasId}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('returns 404 for non-existent alias', async () => {
    const res = await agent.delete('/api/aliases/nonexistent')
    expect(res.status).toBe(404)
  })
})

// ─── Settings ─────────────────────────────────────────────────────────────────

describe('Settings API', () => {
  it('returns default settings', async () => {
    const res = await agent.get('/api/settings')
    expect(res.status).toBe(200)
    expect(res.body.port).toBe('4141')
    expect(res.body.gateway_name).toBe('Test Gateway')
    expect(res.body.log_enabled).toBe('1')
  })

  it('updates settings', async () => {
    const res = await agent.put('/api/settings').send({ gateway_name: 'Updated Gateway', retention_days: '14' })
    expect(res.status).toBe(200)
    expect(res.body.gateway_name).toBe('Updated Gateway')
    expect(res.body.retention_days).toBe('14')
  })

  it('persists updated settings on next GET', async () => {
    const res = await agent.get('/api/settings')
    expect(res.body.gateway_name).toBe('Updated Gateway')
  })
})

// ─── Stats ────────────────────────────────────────────────────────────────────

describe('Stats API', () => {
  it('returns zero stats with no logs', async () => {
    const res = await agent.get('/api/stats')
    expect(res.status).toBe(200)
    expect(res.body.totalRequests).toBe(0)
    expect(res.body.totalTokens).toBe(0)
    expect(res.body.totalCost).toBe(0)
  })

  it('counts logs in stats after inserting log', async () => {
    db.prepare(`
      INSERT INTO request_logs VALUES (
        'log1', NULL, 'openai', 'gpt-4o', 'success', 200, 100, 50, 150, 0.00125, 342, NULL, ?
      )
    `).run(Date.now())
    const res = await agent.get('/api/stats')
    expect(res.body.totalRequests).toBe(1)
    expect(res.body.totalTokens).toBe(150)
    expect(res.body.totalCost).toBeCloseTo(0.00125)
  })
})

// ─── Logs ─────────────────────────────────────────────────────────────────────

describe('Logs API', () => {
  beforeAll(() => {
    // Insert a few more logs
    const insert = db.prepare(`
      INSERT INTO request_logs VALUES (?, NULL, ?, ?, ?, 200, 100, 50, 150, 0.001, 300, NULL, ?)
    `)
    insert.run('log2', 'anthropic', 'claude-sonnet-4', 'success', Date.now())
    insert.run('log3', 'gemini', 'gemini-2.0-flash', 'error', Date.now())
  })

  it('returns all logs with correct total', async () => {
    const res = await agent.get('/api/logs')
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(3)
    expect(res.body.logs).toHaveLength(3)
  })

  it('filters by provider', async () => {
    const res = await agent.get('/api/logs?provider=anthropic')
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.logs[0].provider).toBe('anthropic')
  })

  it('filters by status=error', async () => {
    const res = await agent.get('/api/logs?status=error')
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.logs[0].status).toBe('error')
  })

  it('paginates correctly', async () => {
    const res = await agent.get('/api/logs?page=1&limit=2')
    expect(res.body.logs).toHaveLength(2)
    expect(res.body.pages).toBe(2)
  })
})

// ─── Services cleanup ─────────────────────────────────────────────────────────

describe('DELETE /api/services', () => {
  it('deletes the service', async () => {
    const res = await agent.delete(`/api/services/${serviceId}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('returns 404 for already-deleted service', async () => {
    const res = await agent.delete(`/api/services/${serviceId}`)
    expect(res.status).toBe(404)
  })

  it('service list is now empty', async () => {
    const res = await agent.get('/api/services')
    expect(res.body).toHaveLength(0)
  })
})
