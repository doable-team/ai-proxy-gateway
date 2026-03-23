import type { OpenAIChatRequest, OpenAIMessage } from '../../types'
import type { ServerResponse } from 'http'
import { request as httpsRequest } from 'https'
import { request as httpRequest } from 'http'
import { URL } from 'url'

function toGeminiContents(messages: OpenAIMessage[]): {
  systemInstruction?: { parts: [{ text: string }] }
  contents: { role: string; parts: [{ text: string }] }[]
} {
  const systemParts: string[] = []
  const contents: { role: string; parts: [{ text: string }] }[] = []

  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push(typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
    } else {
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
      })
    }
  }
  const systemInstruction = systemParts.length
    ? { parts: [{ text: systemParts.join('\n\n') }] as [{ text: string }] }
    : undefined
  return { systemInstruction, contents }
}

export async function proxyGemini(
  chatReq: OpenAIChatRequest,
  apiKey: string,
  baseUrl: string,
  clientRes: ServerResponse
): Promise<{ promptTokens: number; completionTokens: number; statusCode: number }> {
  const { systemInstruction, contents } = toGeminiContents(chatReq.messages)
  const model = chatReq.model

  const geminiBody: Record<string, unknown> = { contents }
  if (systemInstruction) geminiBody.systemInstruction = systemInstruction

  // Always include generationConfig if any relevant params are set
  const genConfig: Record<string, unknown> = {}
  if (chatReq.temperature !== undefined) genConfig.temperature = chatReq.temperature
  if (chatReq.max_tokens !== undefined) genConfig.maxOutputTokens = chatReq.max_tokens
  if (chatReq.top_p !== undefined) genConfig.topP = chatReq.top_p
  if (Object.keys(genConfig).length > 0) geminiBody.generationConfig = genConfig

  const isStream = chatReq.stream || false

  // Support custom base_url or default to Google API
  const defaultBase = 'https://generativelanguage.googleapis.com'
  const base = baseUrl || defaultBase
  const isDefaultGoogle = !baseUrl || base === defaultBase

  let fullUrl: URL
  if (isDefaultGoogle) {
    const endpoint = isStream
      ? `streamGenerateContent?alt=sse&key=${apiKey}`
      : `generateContent?key=${apiKey}`
    fullUrl = new URL(`/v1beta/models/${model}:${endpoint}`, base)
  } else {
    // Custom base URL: append path, pass key as query param
    const endpoint = isStream ? 'streamGenerateContent?alt=sse' : 'generateContent'
    fullUrl = new URL(`/v1beta/models/${model}:${endpoint}`, base)
    fullUrl.searchParams.set('key', apiKey)
  }

  const isHttps = fullUrl.protocol === 'https:'
  const reqFn = isHttps ? httpsRequest : httpRequest
  const bodyStr = JSON.stringify(geminiBody)

  return new Promise((resolve, reject) => {
    const options = {
      hostname: fullUrl.hostname,
      port: fullUrl.port || (isHttps ? 443 : 80),
      path: fullUrl.pathname + fullUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    }

    const upstream = reqFn(options, (upstreamRes) => {
      const statusCode = upstreamRes.statusCode || 200

      if (!isStream) {
        let data = ''
        upstreamRes.on('data', (c: Buffer) => (data += c))
        upstreamRes.on('end', () => {
          try {
            const geminiResp = JSON.parse(data)

            // Handle error responses
            if (geminiResp.error || statusCode >= 400) {
              const errMsg = geminiResp.error?.message || 'Unknown error'
              const openaiErr = { error: { message: errMsg, type: 'api_error', code: statusCode } }
              clientRes.writeHead(statusCode, { 'Content-Type': 'application/json' })
              clientRes.end(JSON.stringify(openaiErr))
              resolve({ promptTokens: 0, completionTokens: 0, statusCode })
              return
            }

            const candidate = geminiResp.candidates?.[0]
            const text = candidate?.content?.parts?.[0]?.text || ''
            const usage = geminiResp.usageMetadata || {}
            const openaiResp = {
              id: `chatcmpl-${Date.now()}`,
              object: 'chat.completion',
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{
                index: 0,
                message: { role: 'assistant', content: text },
                finish_reason: candidate?.finishReason === 'STOP' ? 'stop' : (candidate?.finishReason === 'MAX_TOKENS' ? 'length' : 'stop'),
              }],
              usage: {
                prompt_tokens: usage.promptTokenCount || 0,
                completion_tokens: usage.candidatesTokenCount || 0,
                total_tokens: usage.totalTokenCount || 0,
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
        // Handle streaming errors
        if (statusCode >= 400) {
          let errData = ''
          upstreamRes.on('data', (c: Buffer) => (errData += c))
          upstreamRes.on('end', () => {
            try {
              const errResp = JSON.parse(errData)
              clientRes.writeHead(statusCode, { 'Content-Type': 'application/json' })
              clientRes.end(JSON.stringify({ error: { message: errResp.error?.message || 'Unknown error', type: 'api_error' } }))
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
          const lines = buffer.replace(/\r\n/g, '\n').split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const payload = line.slice(6).trim()
            if (!payload || payload === '[DONE]') continue

            try {
              const event = JSON.parse(payload)
              const text = event.candidates?.[0]?.content?.parts?.[0]?.text || ''
              const finishReason = event.candidates?.[0]?.finishReason

              if (text) {
                const sseChunk = {
                  id: chatId,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model,
                  choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
                }
                clientRes.write(`data: ${JSON.stringify(sseChunk)}\n\n`)
              }

              if (event.usageMetadata) {
                promptTokens = event.usageMetadata.promptTokenCount || 0
                completionTokens = event.usageMetadata.candidatesTokenCount || 0
              }

              if ((finishReason === 'STOP' || finishReason === 'MAX_TOKENS') && !doneSent) {
                doneSent = true
                const stopChunk = {
                  id: chatId,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model,
                  choices: [{ index: 0, delta: {}, finish_reason: finishReason === 'MAX_TOKENS' ? 'length' : 'stop' }],
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
