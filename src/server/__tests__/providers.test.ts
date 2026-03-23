/**
 * Unit tests for the Anthropic ↔ OpenAI message translation logic.
 */
import { describe, it, expect } from 'vitest'
import type { OpenAIMessage } from '../../types'

// Extract the translation logic to test it in isolation
function toAnthropicMessages(messages: OpenAIMessage[]): {
  system?: string
  messages: { role: 'user' | 'assistant'; content: string }[]
} {
  let system: string | undefined
  const msgs: { role: 'user' | 'assistant'; content: string }[] = []
  for (const m of messages) {
    if (m.role === 'system') {
      system = m.content
    } else {
      msgs.push({ role: m.role as 'user' | 'assistant', content: m.content })
    }
  }
  return { system, messages: msgs }
}

function toGeminiContents(messages: OpenAIMessage[]): {
  systemInstruction?: { parts: [{ text: string }] }
  contents: { role: string; parts: [{ text: string }] }[]
} {
  let systemInstruction: { parts: [{ text: string }] } | undefined
  const contents: { role: string; parts: [{ text: string }] }[] = []
  for (const m of messages) {
    if (m.role === 'system') {
      systemInstruction = { parts: [{ text: m.content }] }
    } else {
      contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })
    }
  }
  return { systemInstruction, contents }
}

// ─── Anthropic translation ────────────────────────────────────────────────────

describe('Anthropic message translation', () => {
  it('converts simple user message', () => {
    const { system, messages } = toAnthropicMessages([
      { role: 'user', content: 'Hello' },
    ])
    expect(system).toBeUndefined()
    expect(messages).toHaveLength(1)
    expect(messages[0]).toEqual({ role: 'user', content: 'Hello' })
  })

  it('extracts system prompt', () => {
    const { system, messages } = toAnthropicMessages([
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hi' },
    ])
    expect(system).toBe('You are a helpful assistant.')
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('user')
  })

  it('preserves assistant messages', () => {
    const { messages } = toAnthropicMessages([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
    ])
    expect(messages).toHaveLength(3)
    expect(messages[1]).toEqual({ role: 'assistant', content: 'Hi there!' })
  })

  it('handles empty messages', () => {
    const { system, messages } = toAnthropicMessages([])
    expect(system).toBeUndefined()
    expect(messages).toHaveLength(0)
  })

  it('handles system-only messages', () => {
    const { system, messages } = toAnthropicMessages([
      { role: 'system', content: 'Be concise.' },
    ])
    expect(system).toBe('Be concise.')
    expect(messages).toHaveLength(0)
  })
})

// ─── Gemini translation ───────────────────────────────────────────────────────

describe('Gemini message translation', () => {
  it('converts user message to Gemini format', () => {
    const { systemInstruction, contents } = toGeminiContents([
      { role: 'user', content: 'Hello Gemini' },
    ])
    expect(systemInstruction).toBeUndefined()
    expect(contents).toHaveLength(1)
    expect(contents[0]).toEqual({ role: 'user', parts: [{ text: 'Hello Gemini' }] })
  })

  it('extracts system instruction', () => {
    const { systemInstruction, contents } = toGeminiContents([
      { role: 'system', content: 'You are Gemini.' },
      { role: 'user', content: 'Hi' },
    ])
    expect(systemInstruction).toEqual({ parts: [{ text: 'You are Gemini.' }] })
    expect(contents).toHaveLength(1)
  })

  it('maps assistant → model role', () => {
    const { contents } = toGeminiContents([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ])
    expect(contents[1].role).toBe('model')
  })

  it('maps user → user role', () => {
    const { contents } = toGeminiContents([
      { role: 'user', content: 'Hello' },
    ])
    expect(contents[0].role).toBe('user')
  })

  it('handles multi-turn conversation', () => {
    const { contents } = toGeminiContents([
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
      { role: 'user', content: 'Q2' },
    ])
    expect(contents).toHaveLength(3)
    expect(contents.map(c => c.role)).toEqual(['user', 'model', 'user'])
  })
})
