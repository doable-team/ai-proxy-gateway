// Suppress Node.js experimental warnings (node:sqlite)
const originalEmit = process.emit.bind(process)
process.emit = function (event: string, ...args: any[]) {
  if (event === 'warning' && (args[0] as any)?.name === 'ExperimentalWarning') return false
  return originalEmit(event, ...args)
} as typeof process.emit

import { startServer } from './server/app'

const port = parseInt(process.env.PORT || '4141', 10)
const args = process.argv.slice(2)
const portArgIdx = args.findIndex(a => a === '--port' || a === '-p')
const finalPort = portArgIdx !== -1 ? parseInt(args[portArgIdx + 1], 10) || port : port
const noOpen = args.includes('--no-open')

async function main() {
  try {
    await startServer(finalPort)

    console.log('')
    console.log('  AI Proxy Gateway')
    console.log(`  Dashboard:       http://localhost:${finalPort}`)
    console.log(`  OpenAI endpoint: http://localhost:${finalPort}/v1`)
    console.log('')
    console.log('  Connect Claude Code:')
    console.log(`    ANTHROPIC_BASE_URL=http://localhost:${finalPort} claude`)
    console.log('')

    if (!noOpen) {
      try {
        const { default: open } = await import('open')
        open(`http://localhost:${finalPort}`)
      } catch {
        // open not available (e.g. npx, headless) — ignore
      }
    }
  } catch (err: any) {
    if (err.code === 'EADDRINUSE') {
      console.error(`  Port ${finalPort} is already in use. Try: PORT=4142 npx ai-proxy-gateway`)
    } else {
      console.error('  Failed to start server:', err.message)
    }
    process.exit(1)
  }
}

main()
