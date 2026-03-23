import type { OpenAIChatRequest, OpenAIMessage } from '../../types'
import type { ServerResponse } from 'http'
import { request as httpsRequest } from 'https'
import { request as httpRequest } from 'http'
import { URL } from 'url'

const ANTHROPIC_API_URL = 'https://api.anthropic.com'

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | object[]
}

function toAnthropicMessages(messages: OpenAIMessage[]): {
  system?: string
  messages: AnthropicMessage[]
} {
  const systemParts: string[] = []
  const msgs: AnthropicMessage[] = []

  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push(typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
    } else {
      msgs.push({ role: m.role as 'user' | 'assistant', content: m.content })
    }
  }

  return { system: systemParts.length ? systemParts.join('\n\n') : undefined, messages: msgs }
}

function mapFinishReason(stopReason: string | undefined): string {
  switch (stopReason) {
    case 'end_turn': return 'stop'
    case 'max_tokens': return 'length'
    case 'stop_sequence': return 'stop'
    default: return stopReason || 'stop'
  }
}

export async function proxyAnthropic(
  chatReq: OpenAIChatRequest,
  apiKey: string,
  baseUrl: string,
  clientRes: ServerResponse
): Promise<{ promptTokens: number; completionTokens: number; statusCode: number }> {
  const { system, messages } = toAnthropicMessages(chatReq.messages)

  const anthropicBody: Record<string, unknown> = {
    model: chatReq.model,
    messages,
    max_tokens: chatReq.max_tokens || 4096,
    stream: chatReq.stream || false,
  }
  if (system) anthropicBody.system = system
  if (chatReq.temperature !== undefined) anthropicBody.temperature = chatReq.temperature
  if (chatReq.top_p !== undefined) anthropicBody.top_p = chatReq.top_p

  const base = baseUrl || ANTHROPIC_API_URL
  const url = new URL('/v1/messages', base)
  const isHttps = url.protocol === 'https:'
  const reqFn = isHttps ? httpsRequest : httpRequest
  const bodyStr = JSON.stringify(anthropicBody)

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    }

    const upstream = reqFn(options, (upstreamRes) => {
      const statusCode = upstreamRes.statusCode || 200

      if (!chatReq.stream) {
        let data = ''
        upstreamRes.on('data', (c: Buffer) => (data += c))
        upstreamRes.on('end', () => {
          try {
            const anthropicResp = JSON.parse(data)

            // Handle Anthropic error responses
            if (anthropicResp.type === 'error' || statusCode >= 400) {
              const errMsg = anthropicResp.error?.message || anthropicResp.message || 'Unknown error'
              const openaiErr = {
                error: { message: errMsg, type: anthropicResp.error?.type || 'api_error', code: statusCode }
              }
              clientRes.writeHead(statusCode, { 'Content-Type': 'application/json' })
              clientRes.end(JSON.stringify(openaiErr))
              resolve({ promptTokens: 0, completionTokens: 0, statusCode })
              return
            }

            const openaiResp = {
              id: anthropicResp.id || `chatcmpl-${Date.now()}`,
              object: 'chat.completion',
              created: Math.floor(Date.now() / 1000),
              model: chatReq.model,
              choices: [{
                index: 0,
                message: {
                  role: 'assistant',
                  content: anthropicResp.content?.[0]?.text || '',
                },
                finish_reason: mapFinishReason(anthropicResp.stop_reason),
              }],
              usage: {
                prompt_tokens: anthropicResp.usage?.input_tokens || 0,
                completion_tokens: anthropicResp.usage?.output_tokens || 0,
                total_tokens: (anthropicResp.usage?.input_tokens || 0) + (anthropicResp.usage?.output_tokens || 0),
              },
            }
            clientRes.writeHead(statusCode, { 'Content-Type': 'application/json' })
            clientRes.end(JSON.stringify(openaiResp))
            resolve({
              promptTokens: openaiResp.usage.prompt_tokens,
              completionTokens: openaiResp.usage.completion_tokens,
              statusCode,
            })
          } catch {
            clientRes.writeHead(statusCode, { 'Content-Type': 'application/json' })
            clientRes.end(data)
            resolve({ promptTokens: 0, completionTokens: 0, statusCode })
          }
        })
        upstreamRes.on('error', reject)
      } else {
        // Handle streaming errors (non-SSE response)
        if (statusCode >= 400) {
          let errData = ''
          upstreamRes.on('data', (c: Buffer) => (errData += c))
          upstreamRes.on('end', () => {
            try {
              const errResp = JSON.parse(errData)
              const errMsg = errResp.error?.message || errResp.message || 'Unknown error'
              clientRes.writeHead(statusCode, { 'Content-Type': 'application/json' })
              clientRes.end(JSON.stringify({ error: { message: errMsg, type: 'api_error' } }))
            } catch {
              clientRes.writeHead(statusCode, { 'Content-Type': 'application/json' })
              clientRes.end(errData)
            }
            resolve({ promptTokens: 0, completionTokens: 0, statusCode })
          })
          upstreamRes.on('error', reject)
          return
        }

        clientRes.writeHead(statusCode, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        })

        let buffer = ''
        let promptTokens = 0
        let completionTokens = 0
        const chatId = `chatcmpl-${Date.now()}`
        let doneSent = false

        upstreamRes.on('data', (chunk: Buffer) => {
          buffer += chunk.toString()
          // Handle both \r\n and \n line endings
          const lines = buffer.replace(/\r\n/g, '\n').split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const payload = line.slice(6).trim()
            if (!payload) continue

            try {
              const event = JSON.parse(payload)
              if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                const sseChunk = {
                  id: chatId,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: chatReq.model,
                  choices: [{ index: 0, delta: { content: event.delta.text }, finish_reason: null }],
                }
                clientRes.write(`data: ${JSON.stringify(sseChunk)}\n\n`)
              } else if (event.type === 'message_delta' && event.usage) {
                completionTokens = event.usage.output_tokens || 0
              } else if (event.type === 'message_start' && event.message?.usage) {
                promptTokens = event.message.usage.input_tokens || 0
              } else if (event.type === 'message_stop' && !doneSent) {
                doneSent = true
                const stopChunk = {
                  id: chatId,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: chatReq.model,
                  choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                }
                clientRes.write(`data: ${JSON.stringify(stopChunk)}\n\n`)
                clientRes.write('data: [DONE]\n\n')
              }
            } catch {}
          }
        })

        upstreamRes.on('end', () => {
          if (!doneSent) {
            clientRes.write('data: [DONE]\n\n')
          }
          clientRes.end()
          resolve({ promptTokens, completionTokens, statusCode })
        })
        upstreamRes.on('error', reject)
      }
    })

    upstream.on('error', reject)
    upstream.write(bodyStr)
    upstream.end()
  })
}
