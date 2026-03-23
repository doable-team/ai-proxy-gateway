# AI Proxy Gateway

A single-command local AI proxy gateway. One command. No config files. No Docker. Just run it.

```bash
npx ai-proxy-gateway
```

That's it. You now have:
- An **OpenAI-compatible API** running at `http://localhost:4141/v1`
- A **dashboard** to manage your AI providers, view logs, and track costs
- **Multi-provider routing** — send requests to OpenAI, Anthropic, or Gemini through one endpoint

---

## Why?

There are proxy tools like LiteLLM, but they require Python, config files, environment setup, and often Docker. This project takes a different approach:

- **One command** — `npx ai-proxy-gateway` and you're running
- **Zero config** — add your API keys through the dashboard UI
- **Just Node.js** — no Python, no Docker, no YAML files
- **Works with everything** — Claude Code, Cursor, Roo Code, OpenCode, Continue, or any OpenAI-compatible client

---

## Features

- **OpenAI-Compatible Proxy** — `/v1/chat/completions` and `/v1/models` endpoints with full streaming (SSE) support
- **Multi-Provider Routing** — automatically routes `gpt-*` → OpenAI, `claude-*` → Anthropic, `gemini-*` → Google Gemini
- **Model Aliases** — create custom names like `fast` → `gpt-4o-mini` or `smart` → `claude-sonnet-4`
- **Dashboard** — real-time stats, request volume charts, top models breakdown, recent activity feed
- **Request Logging** — every proxied request is logged with tokens, latency, cost, and status
- **Cost Tracking** — automatic cost estimation based on pre-seeded model pricing (customizable)
- **Service Management** — add, edit, enable/disable AI providers through the UI
- **Dark/Light Theme** — clean minimal UI with the Neural Canvas design system
- **SQLite Storage** — everything stored locally at `~/.ai-proxy-gateway/gateway.db`

---

## Quick Start

### Requirements

- **Node.js 22+** (uses built-in `node:sqlite`)
- **npm**

### Run

```bash
npx ai-proxy-gateway
```

The gateway starts on port **4141** by default. Your browser opens to the dashboard automatically.

### Connect Your API Keys

1. Open `http://localhost:4141`
2. Go to **Services** → **Add Service**
3. Select your provider (OpenAI, Anthropic, or Gemini)
4. Paste your API key
5. Done — start sending requests

### Use It

Point any OpenAI-compatible client at `http://localhost:4141/v1`:

**Claude Code:**
```bash
ANTHROPIC_BASE_URL=http://localhost:4141 claude
```

**Cursor / Continue / Any OpenAI client:**
```
Base URL: http://localhost:4141/v1
```

**cURL:**
```bash
curl http://localhost:4141/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

---

## Configuration

### Port

```bash
# Environment variable
PORT=8080 npx ai-proxy-gateway

# CLI flag
npx ai-proxy-gateway --port 8080
```

### Model Aliases

Create custom model names through the dashboard (Services → expand a service → Model Aliases):

| Alias | Target Model |
|-------|-------------|
| `fast` | `gpt-4o-mini` |
| `smart` | `claude-sonnet-4` |
| `cheap` | `gemini-2.0-flash` |

Then use them like any other model:

```bash
curl http://localhost:4141/v1/chat/completions \
  -d '{"model": "fast", "messages": [{"role": "user", "content": "Hi"}]}'
```

### Routing Rules

Requests are routed by model name prefix:

| Pattern | Provider |
|---------|----------|
| `gpt-*`, `o1`, `o3*` | OpenAI |
| `claude-*` | Anthropic |
| `gemini-*` | Google Gemini |
| Custom alias | Resolved to target model first |

---

## Development

```bash
git clone https://github.com/mrbeandev/ai-proxy-gateway.git
cd ai-proxy-gateway
npm install
cd web && npm install && cd ..

# Start dev servers (API on :4141, Vite on :5173)
npm run dev
```

### Project Structure

```
├── src/                    # Server (TypeScript)
│   ├── index.ts            # CLI entry point
│   ├── types.ts            # Shared types
│   └── server/
│       ├── app.ts          # Express app
│       ├── db.ts           # SQLite setup + migrations
│       ├── proxy.ts        # OpenAI-compatible proxy router
│       ├── api/            # REST API (services, logs, stats, settings, aliases)
│       └── providers/      # Provider adapters (openai, anthropic, gemini)
├── web/                    # Dashboard (React + Vite)
│   └── src/
│       ├── components/     # Layout, Sidebar, shadcn/ui components
│       ├── pages/          # Dashboard, Services, Logs, Settings
│       └── lib/            # API client, utilities
├── scripts/                # Build scripts
├── DESIGN.md               # Design system reference
└── dist/                   # Production build output
```

### Build

```bash
npm run build          # Build server + web
npm start              # Run production build
```

### Tests

```bash
npm test               # Server unit + integration tests
cd web && npm test     # Frontend utility tests
npm run test:all       # Everything
```

---

## API Reference

### Proxy Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/chat/completions` | OpenAI-compatible chat completions (streaming supported) |
| `GET` | `/v1/models` | List all available models across providers |

### Dashboard API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/stats` | Dashboard statistics |
| `GET` | `/api/stats/timeseries` | 7-day request volume by provider |
| `GET/POST/PUT/DELETE` | `/api/services` | CRUD for AI provider services |
| `GET` | `/api/logs` | Paginated request logs (filterable) |
| `GET/POST/PUT/DELETE` | `/api/aliases` | Model alias management |
| `GET/PUT` | `/api/settings` | Gateway configuration |

---

## Tech Stack

- **Server**: Express + `node:sqlite` (built-in Node.js SQLite)
- **Frontend**: React 18 + Vite + Tailwind CSS v4 + shadcn/ui + Highcharts
- **Build**: esbuild (server), Vite (web)
- **Tests**: Vitest + Supertest

---

## License

MIT — see [LICENSE](LICENSE)

---

Made by [@mrbeandev](https://github.com/mrbeandev)
