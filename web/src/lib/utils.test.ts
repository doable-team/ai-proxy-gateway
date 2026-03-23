import { describe, it, expect } from 'vitest'
import { formatNumber, formatCost, formatLatency, timeAgo, providerColor } from '../lib/utils'

describe('formatNumber', () => {
  it('formats small numbers as-is', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(42)).toBe('42')
    expect(formatNumber(999)).toBe('999')
  })

  it('formats thousands as K', () => {
    expect(formatNumber(1000)).toBe('1.0K')
    expect(formatNumber(1500)).toBe('1.5K')
    expect(formatNumber(24891)).toBe('24.9K')
    expect(formatNumber(999900)).toBe('999.9K')
  })

  it('formats millions as M', () => {
    expect(formatNumber(1_000_000)).toBe('1.0M')
    expect(formatNumber(2_500_000)).toBe('2.5M')
  })
})

describe('formatCost', () => {
  it('formats costs >= $1 with 2 decimal places', () => {
    expect(formatCost(1)).toBe('$1.00')
    expect(formatCost(12.5)).toBe('$12.50')
    expect(formatCost(1.999)).toBe('$2.00')
  })

  it('formats cents with 3 decimal places', () => {
    expect(formatCost(0.05)).toBe('$0.050')
    expect(formatCost(0.123)).toBe('$0.123')
  })

  it('formats sub-cent costs with 5 decimal places', () => {
    expect(formatCost(0.001)).toBe('$0.00100')
    expect(formatCost(0.00125)).toBe('$0.00125')
  })

  it('formats zero', () => {
    expect(formatCost(0)).toBe('$0.00000')
  })
})

describe('formatLatency', () => {
  it('formats milliseconds for < 1000ms', () => {
    expect(formatLatency(0)).toBe('0ms')
    expect(formatLatency(342)).toBe('342ms')
    expect(formatLatency(999)).toBe('999ms')
  })

  it('formats seconds for >= 1000ms', () => {
    expect(formatLatency(1000)).toBe('1.0s')
    expect(formatLatency(1500)).toBe('1.5s')
    expect(formatLatency(12000)).toBe('12.0s')
  })
})

describe('timeAgo', () => {
  const now = Date.now()

  it('shows seconds for < 60s', () => {
    expect(timeAgo(now - 5000)).toBe('5s ago')
    expect(timeAgo(now - 30000)).toBe('30s ago')
  })

  it('shows minutes for < 60m', () => {
    expect(timeAgo(now - 60000)).toBe('1m ago')
    expect(timeAgo(now - 5 * 60 * 1000)).toBe('5m ago')
  })

  it('shows hours for < 24h', () => {
    expect(timeAgo(now - 3600000)).toBe('1h ago')
    expect(timeAgo(now - 2 * 3600000)).toBe('2h ago')
  })

  it('shows days for >= 24h', () => {
    expect(timeAgo(now - 24 * 3600000)).toBe('1d ago')
    expect(timeAgo(now - 3 * 24 * 3600000)).toBe('3d ago')
  })
})

describe('providerColor', () => {
  it('returns teal for openai', () => {
    expect(providerColor('openai')).toBe('var(--color-openai)')
  })

  it('returns purple for anthropic', () => {
    expect(providerColor('anthropic')).toBe('var(--color-anthropic)')
  })

  it('returns orange for gemini', () => {
    expect(providerColor('gemini')).toBe('var(--color-gemini)')
  })

  it('returns fallback for unknown provider', () => {
    expect(providerColor('unknown')).toBe('#888')
    expect(providerColor('')).toBe('#888')
  })
})
