import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export function formatCost(usd: number): string {
  if (usd >= 1) return '$' + usd.toFixed(2)
  if (usd >= 0.01) return '$' + usd.toFixed(3)
  return '$' + usd.toFixed(5)
}

export function formatLatency(ms: number): string {
  if (ms >= 1000) return (ms / 1000).toFixed(1) + 's'
  return Math.round(ms) + 'ms'
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return secs + 's ago'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return mins + 'm ago'
  const hours = Math.floor(mins / 60)
  if (hours < 24) return hours + 'h ago'
  return Math.floor(hours / 24) + 'd ago'
}

export function providerColor(provider: string): string {
  switch (provider) {
    case 'openai': return 'var(--color-openai)'
    case 'anthropic': return 'var(--color-anthropic)'
    case 'gemini': return 'var(--color-gemini)'
    default: return '#888'
  }
}

export function providerIcon(provider: string): string | null {
  switch (provider) {
    case 'openai': return '/openai.svg'
    case 'anthropic': return '/claude.svg'
    case 'gemini': return '/gemini.svg'
    default: return null
  }
}

export function providerLabel(provider: string): string {
  switch (provider) {
    case 'openai': return 'OpenAI'
    case 'anthropic': return 'Claude'
    case 'gemini': return 'Gemini'
    default: return provider
  }
}
