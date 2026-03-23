import { useEffect, useState, useMemo, useCallback } from 'react'
import { HighchartsReact } from 'highcharts-react-official'
import Highcharts from 'highcharts'
import { TrendingUp, Layers, CheckCircle, Timer, Coins, DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { formatNumber, formatCost, formatLatency, timeAgo, providerColor, providerIcon, providerLabel } from '@/lib/utils'

interface Stats {
  totalRequests: number
  totalTokens: number
  totalPromptTokens: number
  totalCompletionTokens: number
  totalCost: number
  successRate: number
  avgLatency: number
  activeServices: number
  totalServices: number
  requestsToday: number
  topModels: any[]
  recentRequests: any[]
}

function StatCard({ icon: Icon, label, value, sub, accent }: {
  icon: any; label: string; value: string; sub?: string; accent?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: `${accent}18` }}>
          <Icon size={13} style={{ color: accent }} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight" style={{ letterSpacing: '-0.03em' }}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function ProviderDot({ provider }: { provider: string }) {
  const icon = providerIcon(provider)
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon ? (
        <img src={icon} alt={provider} className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: providerColor(provider) }} />
      )}
      {providerLabel(provider)}
    </span>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [timeseries, setTimeseries] = useState<any[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [s, ts] = await Promise.all([api.getStats(), api.getTimeseries()])
      setStats(s)
      setTimeseries(ts)
      setError('')
    } catch (e: any) {
      setError(e.message || 'Failed to load dashboard')
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [load])

  const chartOptions = useMemo((): Highcharts.Options => {
    const providers = ['openai', 'anthropic', 'gemini']
    const names: Record<string, string> = { openai: 'OpenAI', anthropic: 'Claude', gemini: 'Gemini' }
    const colors = { openai: '#5bdcb0', anthropic: '#c180ff', gemini: '#ff9f96' }

    const dayMap = new Map<number, Record<string, number>>()
    for (const row of timeseries) {
      if (!dayMap.has(row.day_ts)) dayMap.set(row.day_ts, {})
      dayMap.get(row.day_ts)![row.provider] = row.requests
    }
    const days = Array.from(dayMap.keys()).sort()

    return {
      chart: { backgroundColor: 'transparent', style: { fontFamily: 'Inter, system-ui, sans-serif' }, height: 220, margin: [10, 10, 40, 40] },
      title: { text: undefined },
      xAxis: { type: 'datetime', labels: { style: { color: 'var(--color-muted-foreground)', fontSize: '11px' }, format: '{value:%b %e}' }, lineColor: 'var(--color-border)', tickColor: 'var(--color-border)' },
      yAxis: { title: { text: undefined }, labels: { style: { color: 'var(--color-muted-foreground)', fontSize: '11px' } }, gridLineColor: 'var(--color-border)', min: 0 },
      legend: { itemStyle: { color: 'var(--color-muted-foreground)', fontSize: '11px', fontWeight: 'normal' }, itemHoverStyle: { color: 'var(--color-foreground)' } },
      tooltip: { backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', borderRadius: 8, style: { color: 'var(--color-foreground)', fontSize: '12px' }, shared: true, xDateFormat: '%b %e, %Y' },
      credits: { enabled: false },
      series: providers.map(p => ({
        type: 'line' as const,
        name: names[p],
        color: colors[p as keyof typeof colors],
        data: days.map(d => [d, dayMap.get(d)?.[p] || 0]),
        lineWidth: 2,
        marker: { radius: 3, symbol: 'circle' as const },
      })),
    }
  }, [timeseries])

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground text-sm">
        {error ? (
          <>
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>Retry</Button>
          </>
        ) : 'Loading...'}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard icon={TrendingUp} label="Total Requests" value={formatNumber(stats.totalRequests)} sub={`+${stats.requestsToday} today`} accent="var(--color-primary)" />
        <StatCard icon={Layers} label="Active Services" value={`${stats.activeServices}/${stats.totalServices}`} sub="providers" accent="var(--color-anthropic)" />
        <StatCard icon={CheckCircle} label="Success Rate" value={`${stats.successRate}%`} sub="all time" accent="#4ade80" />
        <StatCard icon={Timer} label="Avg Latency" value={formatLatency(stats.avgLatency)} sub="success only" accent="var(--color-gemini)" />
        <StatCard icon={Coins} label="Total Tokens" value={formatNumber(stats.totalTokens)} sub={`${formatNumber(stats.totalPromptTokens)} in / ${formatNumber(stats.totalCompletionTokens)} out`} accent="#60a5fa" />
        <StatCard icon={DollarSign} label="Est. Cost" value={formatCost(stats.totalCost)} sub="all time" accent="#fbbf24" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Chart */}
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold">Request Volume</CardTitle>
            <span className="text-xs text-muted-foreground">Last 7 days</span>
          </CardHeader>
          <CardContent>
            {timeseries.length > 0 ? (
              <HighchartsReact highcharts={Highcharts} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm text-center">
                No requests yet. Add a service and start using the proxy.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent requests */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Recent Requests</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            {stats.recentRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests yet</p>
            ) : (
              <div className="flex flex-col">
                {stats.recentRequests.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <ProviderDot provider={r.provider} />
                      <span className="text-xs font-mono truncate">{r.model}</span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0 ml-2">
                      <Badge variant={r.status === 'success' ? 'default' : 'destructive'} className="text-xs h-4 px-1.5">
                        {r.status === 'success' ? 'OK' : 'ERR'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top models */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Top Models</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {stats.topModels.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6">No model usage yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {['Model', 'Provider', 'Requests', 'Tokens', 'Est. Cost', 'Success', 'Avg Latency'].map(h => (
                      <th key={h} className="text-left py-2 px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground first:pl-6 last:pr-6" style={{ letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.topModels.map((m: any) => (
                    <tr key={m.model} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-4 pl-6 font-mono text-xs">{m.model}</td>
                      <td className="py-2.5 px-4"><ProviderDot provider={m.provider} /></td>
                      <td className="py-2.5 px-4 tabular-nums text-xs">{formatNumber(m.requests)}</td>
                      <td className="py-2.5 px-4 tabular-nums text-xs">{formatNumber(m.tokens)}</td>
                      <td className="py-2.5 px-4 tabular-nums text-xs">{formatCost(m.cost)}</td>
                      <td className="py-2.5 px-4 text-xs" style={{ color: m.success_rate >= 95 ? '#4ade80' : '#fbbf24' }}>{m.success_rate}%</td>
                      <td className="py-2.5 px-4 pr-6 tabular-nums text-xs">{formatLatency(m.avg_latency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
