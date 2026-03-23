import { Router } from 'express'
import { getDb } from '../db'

const router = Router()

router.get('/', (_req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const settings: Record<string, string> = {}
  for (const row of rows) settings[row.key] = row.value
  res.json(settings)
})

router.put('/', (req, res) => {
  const db = getDb()
  const updates = req.body as Record<string, string>
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(updates)) {
      upsert.run(k, String(v))
    }
  })
  tx()
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const settings: Record<string, string> = {}
  for (const row of rows) settings[row.key] = row.value
  res.json(settings)
})

// Pricing endpoints
router.get('/pricing', (_req, res) => {
  const db = getDb()
  res.json(db.prepare('SELECT * FROM model_pricing ORDER BY model ASC').all())
})

router.put('/pricing/:model', (req, res) => {
  const { model } = req.params
  const { input_cost_per_1k, output_cost_per_1k } = req.body
  const db = getDb()
  db.prepare(`
    INSERT OR REPLACE INTO model_pricing (model, input_cost_per_1k, output_cost_per_1k, is_custom)
    VALUES (?, ?, ?, 1)
  `).run(model, input_cost_per_1k, output_cost_per_1k)
  res.json({ success: true })
})

export default router
