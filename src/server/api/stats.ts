import { Router } from 'express'
import { getDb } from '../db'

const router = Router()

router.get('/', (_req, res) => {
  const db = getDb()
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000

  const totalRequests = (db.prepare('SELECT COUNT(*) as cnt FROM request_logs').get() as any).cnt
  const totalTokens = (db.prepare('SELECT COALESCE(SUM(total_tokens), 0) as t FROM request_logs').get() as any).t
  const totalPromptTokens = (db.prepare('SELECT COALESCE(SUM(prompt_tokens), 0) as t FROM request_logs').get() as any).t
  const totalCompletionTokens = (db.prepare('SELECT COALESCE(SUM(completion_tokens), 0) as t FROM request_logs').get() as any).t
  const totalCost = (db.prepare('SELECT COALESCE(SUM(estimated_cost_usd), 0) as c FROM request_logs').get() as any).c
  const successCount = (db.prepare("SELECT COUNT(*) as cnt FROM request_logs WHERE status = 'success'").get() as any).cnt
  const successRate = totalRequests > 0 ? ((successCount / totalRequests) * 100).toFixed(1) : '0.0'
  const avgLatency = (db.prepare("SELECT COALESCE(AVG(latency_ms), 0) as l FROM request_logs WHERE latency_ms IS NOT NULL AND status = 'success'").get() as any).l

  const activeServices = (db.prepare("SELECT COUNT(*) as cnt FROM services WHERE enabled = 1").get() as any).cnt
  const totalServices = (db.prepare('SELECT COUNT(*) as cnt FROM services').get() as any).cnt

  // 24h comparison
  const yesterday = now - day
  const requestsToday = (db.prepare('SELECT COUNT(*) as cnt FROM request_logs WHERE created_at >= ?').get(yesterday) as any).cnt

  // Top models
  const topModels = db.prepare(`
    SELECT
      model,
      provider,
      COUNT(*) as requests,
      COALESCE(SUM(total_tokens), 0) as tokens,
      COALESCE(SUM(estimated_cost_usd), 0) as cost,
      ROUND(100.0 * SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate,
      COALESCE(AVG(latency_ms), 0) as avg_latency
    FROM request_logs
    GROUP BY model, provider
    ORDER BY requests DESC
    LIMIT 10
  `).all()

  // Recent requests
  const recentRequests = db.prepare(`
    SELECT id, provider, model, status, total_tokens, estimated_cost_usd, latency_ms, created_at
    FROM request_logs
    ORDER BY created_at DESC
    LIMIT 10
  `).all()

  res.json({
    totalRequests,
    totalTokens,
    totalPromptTokens,
    totalCompletionTokens,
    totalCost,
    successRate: parseFloat(successRate),
    avgLatency: Math.round(avgLatency),
    activeServices,
    totalServices,
    requestsToday,
    topModels,
    recentRequests,
  })
})

router.get('/timeseries', (_req, res) => {
  const db = getDb()
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000

  // Last 7 days, grouped by day and provider
  const rows = db.prepare(`
    SELECT
      CAST((created_at / 86400000) AS INTEGER) * 86400000 as day_ts,
      provider,
      COUNT(*) as requests,
      COALESCE(SUM(total_tokens), 0) as tokens,
      COALESCE(SUM(estimated_cost_usd), 0) as cost
    FROM request_logs
    WHERE created_at >= ?
    GROUP BY day_ts, provider
    ORDER BY day_ts ASC
  `).all(now - 7 * day)

  res.json(rows)
})

export default router
