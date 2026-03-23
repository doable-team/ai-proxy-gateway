import type { OpenAIChatRequest } from '../../types'
import type { ServerResponse } from 'http'
import { request as httpsRequest } from 'https'
import { request as httpRequest } from 'http'
import { URL } from 'url'

export async function proxyOpenAI(
  chatReq: OpenAIChatRequest,
  apiKey: string,
  baseUrl: string,
  clientRes: ServerResponse
): Promise<{ promptTokens: number; completionTokens: number; statusCode: number }> {
  const url = new URL('/v1/chat/completions', baseUrl)
  const isHttps = url.protocol === 'https:'
  const reqFn = isHttps ? httpsRequest : httpRequest

  // For streaming, request usage stats from OpenAI
  const body = JSON.stringify(
    chatReq.stream
      ? { ...chatReq, stream_options: { include_usage: true } }
      : chatReq
  )

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }

    const upstream = reqFn(options, (upstreamRes) => {
      const statusCode = upstreamRes.statusCode || 200
      clientRes.writeHead(statusCode, {
        'Content-Type': upstreamRes.headers['content-type'] || 'application/json',
        'Cache-Control': 'no-cache',
        ...(chatReq.stream ? { 'Connection': 'keep-alive' } : {}),
      })

      let buffer = ''
      let promptTokens = 0
      let completionTokens = 0

      upstreamRes.on('data', (chunk: Buffer) => {
        const str = chunk.toString()
        buffer += str
        clientRes.write(chunk)
      })

      upstreamRes.on('end', () => {
        if (chatReq.stream) {
          // Parse usage from the last SSE chunk that contains it
          const lines = buffer.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.usage) {
                  promptTokens = data.usage.prompt_tokens || 0
                  completionTokens = data.usage.completion_tokens || 0
                }
              } catch {}
            }
          }
        } else {
          try {
            const parsed = JSON.parse(buffer)
            promptTokens = parsed.usage?.prompt_tokens || 0
            completionTokens = parsed.usage?.completion_tokens || 0
          } catch {}
        }
        clientRes.end()
        resolve({ promptTokens, completionTokens, statusCode })
      })

      upstreamRes.on('error', reject)
    })

    upstream.on('error', reject)
    upstream.write(body)
    upstream.end()
  })
}
