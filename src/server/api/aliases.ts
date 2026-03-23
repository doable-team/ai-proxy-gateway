import { Router } from 'express'
import { getDb } from '../db'
import { v4 as uuidv4 } from 'uuid'
import type { ModelAlias } from '../../types'

const router = Router()

router.get('/', (_req, res) => {
  const db = getDb()
  const aliases = db.prepare('SELECT * FROM model_aliases ORDER BY created_at ASC').all()
  res.json(aliases)
})

router.post('/', (req, res) => {
  const { alias, service_id, target_model, description } = req.body
  if (!alias || !service_id || !target_model) {
    return res.status(400).json({ error: 'alias, service_id, and target_model are required' })
  }
  const db = getDb()
  const id = uuidv4()
  const now = Date.now()
  try {
    db.prepare(`
      INSERT INTO model_aliases (id, alias, service_id, target_model, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, alias, service_id, target_model, description || null, now)
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: `Alias "${alias}" already exists` })
    }
    throw e
  }
  res.status(201).json(db.prepare('SELECT * FROM model_aliases WHERE id = ?').get(id))
})

router.put('/:id', (req, res) => {
  const { id } = req.params
  const db = getDb()
  const existing = db.prepare('SELECT * FROM model_aliases WHERE id = ?').get(id) as ModelAlias | undefined
  if (!existing) return res.status(404).json({ error: 'Alias not found' })

  const { alias, service_id, target_model, description } = req.body
  try {
    db.prepare(`
      UPDATE model_aliases SET
        alias = ?,
        service_id = ?,
        target_model = ?,
        description = ?
      WHERE id = ?
    `).run(
      alias ?? existing.alias,
      service_id ?? existing.service_id,
      target_model ?? existing.target_model,
      description !== undefined ? description : existing.description,
      id
    )
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: `Alias "${alias}" already exists` })
    }
    throw e
  }
  res.json(db.prepare('SELECT * FROM model_aliases WHERE id = ?').get(id))
})

router.delete('/:id', (req, res) => {
  const { id } = req.params
  const db = getDb()
  const result = db.prepare('DELETE FROM model_aliases WHERE id = ?').run(id)
  if (result.changes === 0) return res.status(404).json({ error: 'Alias not found' })
  res.json({ success: true })
})

export default router
