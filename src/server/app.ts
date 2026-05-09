import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { getDb, pruneOldLogs } from './db'
import servicesRouter from './api/services'
import logsRouter from './api/logs'
import statsRouter from './api/stats'
import settingsRouter from './api/settings'
import aliasesRouter from './api/aliases'
import modelsRouter from './api/models'
import proxyRouter from './proxy'

export async function startServer(port: number): Promise<void> {
  const app = express()

  app.use(cors())
  app.use(express.json({ limit: '10mb' }))

  // Initialize DB
  getDb()

  // Prune old logs every hour
  setInterval(() => pruneOldLogs(getDb()), 60 * 60 * 1000)

  // API routes (models must be before services to avoid /:id catching the path)
  app.use('/api/services/:serviceId/models', modelsRouter)
  app.use('/api/services', servicesRouter)
  app.use('/api/logs', logsRouter)
  app.use('/api/stats', statsRouter)
  app.use('/api/settings', settingsRouter)
  app.use('/api/aliases', aliasesRouter)

  // Gateway API key authentication for /v1 proxy routes
  app.use('/v1', (req, res, next) => {
    const db = getDb()
    const row = db.prepare("SELECT value FROM settings WHERE key = 'gateway_api_key'").get() as any
    const gatewayKey = row?.value
    if (!gatewayKey) return next() // no key set = open access

    const authHeader = req.headers.authorization || ''
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (bearerToken === gatewayKey) return next()

    res.status(401).json({ error: { message: 'Invalid or missing API key', type: 'authentication_error' } })
  })

  // OpenAI-compatible proxy
  app.use('/v1', proxyRouter)

  // JSON 404 for unmatched /api/* and /v1/* requests — must come before the SPA
  // fallback so API clients (e.g. Cursor BYOK, tunnels) get a structured error
  // instead of the dashboard HTML.
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: { message: `Unknown API route: ${req.method} ${req.path}`, type: 'not_found' } })
  })
  app.all('/v1/*', (req, res) => {
    res.status(404).json({
      error: {
        message: `Unknown endpoint: ${req.method} ${req.path}. Supported: POST /v1/chat/completions, GET /v1/models.`,
        type: 'not_found',
      },
    })
  })

  // Serve frontend static files (production only — in dev, Vite serves on :5173)
  const publicDir = path.join(__dirname, 'public')
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir))
    app.get('*', (_req, res) => {
      res.sendFile(path.join(publicDir, 'index.html'))
    })
  } else {
    app.get('/', (_req, res) => {
      res.send('<p>Dev mode: open <a href="http://localhost:5173">http://localhost:5173</a> for the dashboard.</p>')
    })
  }

  return new Promise((resolve, reject) => {
    app.listen(port, () => {
      resolve()
    }).on('error', reject)
  })
}
