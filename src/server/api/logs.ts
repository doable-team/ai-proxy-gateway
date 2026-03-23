import { Router } from 'express'
import { getDb } from '../db'
import type { RequestLog } from '../../types'

const router = Router()

router.get('/', (req, res) => {
  const db = getDb()
  const {
    page = '1',
    limit = '50',
    provider,
    status,
    model,
    search,
    from,
    to,
  } = req.query

  const pageNum = Math.max(1, parseInt(page as string, 10))
  const limitNum = Math.min(200, Math.max(1, parseInt(limit as string, 10)))
  const offset = (pageNum - 1) * limitNum

  const conditions: string[] = []
  const params: (string | number)[] = []

  if (provider) { conditions.push('provider = ?'); params.push(provider as string) }
  if (status) { conditions.push('status = ?'); params.push(status as string) }
  if (model) { conditions.push('model LIKE ?'); params.push(`%${model}%`) }
  if (search) { conditions.push('(model LIKE ? OR id LIKE ?)'); params.push(`%${search}%`, `%${search}%`) }
  if (from) { conditions.push('created_at >= ?'); params.push(parseInt(from as string, 10)) }
  if (to) { conditions.push('created_at <= ?'); params.push(parseInt(to as string, 10)) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM request_logs ${where}`).get(...params) as any).cnt
  const logs = db.prepare(`
    SELECT * FROM request_logs ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, offset) as RequestLog[]

  res.json({ logs, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) })
})

router.get('/:id', (req, res) => {
  const db = getDb()
  const log = db.prepare('SELECT * FROM request_logs WHERE id = ?').get(req.params.id)
  if (!log) return res.status(404).json({ error: 'Log not found' })
  res.json(log)
})

export default router
