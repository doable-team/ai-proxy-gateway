import { useEffect, useState, useMemo, useCallback } from 'react'
import { HighchartsReact } from 'highcharts-react-official'
import Highcharts from 'highcharts'
import { TrendingUp, Layers, CheckCircle, Timer, Coins, DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { formatNumber, formatCost, formatLatency, timeAgo, providerIcon, providerLabel } from '@/lib/utils'

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
    <Card className="py-3">
      <CardContent className="px-4 py-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
          <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ background: `${accent}18` }}>
            <Icon size={12} style={{ color: accent }} />
          </div>
        </div>
        <div className="text-xl font-semibold tracking-tight" style={{ letterSpacing: '-0.03em' }}>{value}</div>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function ProviderDot({ provider }: { provider: string }) {
  const icon = providerIcon(provider)
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon ? (
        <img src={icon} alt={provider} className="h-3 w-3 shrink-0" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-muted-foreground" />
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
    const colors = { openai: '#5bdcb0', anthropic: '#D4A27F', gemini: '#4285F4' }

    const dayMap = new Map<number, Record<string, number>>()
    for (const row of timeseries) {
      if (!dayMap.has(row.day_ts)) dayMap.set(row.day_ts, {})
      dayMap.get(row.day_ts)![row.provider] = row.requests
    }
    const days = Array.from(dayMap.keys()).sort()

    return {
      chart: { backgroundColor: 'transparent', style: { fontFamily: 'Inter, system-ui, sans-serif' }, height: 200, spacing: [5, 5, 5, 5] },
      title: { text: undefined },
      xAxis: { type: 'datetime', labels: { style: { color: 'var(--color-muted-foreground)', fontSize: '10px' }, format: '{value:%b %e}' }, lineColor: 'var(--color-border)', tickColor: 'var(--color-border)', gridLineWidth: 0 },
      yAxis: { title: { text: undefined }, labels: { style: { color: 'var(--color-muted-foreground)', fontSize: '10px' } }, gridLineColor: 'var(--color-border)', gridLineWidth: 1, min: 0 },
      legend: { enabled: true, align: 'right', verticalAlign: 'top', layout: 'horizontal', itemStyle: { color: 'var(--color-muted-foreground)', fontSize: '10px', fontWeight: 'normal' }, itemHoverStyle: { color: 'var(--color-foreground)' }, floating: true, y: -5 },
      tooltip: { backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', borderRadius: 8, style: { color: 'var(--color-foreground)', fontSize: '11px' }, shared: true, xDateFormat: '%b %e, %Y' },
      credits: { enabled: false },
      plotOptions: { line: { lineWidth: 2, marker: { radius: 2.5, symbol: 'circle' } } },
      series: providers.map(p => ({
        type: 'line' as const,
        name: names[p],
        color: colors[p as keyof typeof colors],
        data: days.map(d => [d, dayMap.get(d)?.[p] || 0]),
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
    <div className="flex flex-col gap-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard icon={TrendingUp} label="Total Requests" value={formatNumber(stats.totalRequests)} sub={`+${stats.requestsToday} today`} accent="var(--color-primary)" />
        <StatCard icon={Layers} label="Active Services" value={`${stats.activeServices}/${stats.totalServices}`} sub="providers" accent="var(--color-anthropic)" />
        <StatCard icon={CheckCircle} label="Success Rate" value={`${stats.successRate}%`} sub="all time" accent="#4ade80" />
        <StatCard icon={Timer} label="Avg Latency" value={formatLatency(stats.avgLatency)} sub="success only" accent="var(--color-gemini)" />
        <StatCard icon={Coins} label="Total Tokens" value={formatNumber(stats.totalTokens)} sub={`${formatNumber(stats.totalPromptTokens)} in / ${formatNumber(stats.totalCompletionTokens)} out`} accent="#60a5fa" />
        <StatCard icon={DollarSign} label="Est. Cost" value={formatCost(stats.totalCost)} sub="all time" accent="#fbbf24" />
      </div>

      {/* Chart + Recent side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Chart — wider */}
        <Card className="xl:col-span-3 py-3">
          <CardHeader className="px-4 py-0 flex flex-row items-center justify-between mb-1">
            <CardTitle className="text-xs font-semibold">Request Volume</CardTitle>
            <span className="text-[10px] text-muted-foreground">Last 7 days</span>
          </CardHeader>
          <CardContent className="px-2 py-0">
            {timeseries.length > 0 ? (
              <HighchartsReact highcharts={Highcharts} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm text-center">
                No requests yet. Add a service and start using the proxy.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent requests — narrower, scrollable */}
        <Card className="xl:col-span-2 py-3 flex flex-col max-h-[300px]">
          <CardHeader className="px-4 py-0 mb-2">
            <CardTitle className="text-xs font-semibold">Recent Requests</CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-0 overflow-y-auto flex-1">
            {stats.recentRequests.length === 0 ? (
              <p className="text-xs text-muted-foreground">No requests yet</p>
            ) : (
              <div className="flex flex-col">
                {stats.recentRequests.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <div className="flex flex-col gap-0 min-w-0">
                      <ProviderDot provider={r.provider} />
                      <span className="text-xs font-mono truncate">{r.model}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge variant={r.status === 'success' ? 'default' : 'destructive'} className="text-[10px] h-4 px-1.5">
                        {r.status === 'success' ? 'OK' : 'ERR'}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground w-12 text-right">{timeAgo(r.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top models — full width, compact */}
      <Card className="py-3">
        <CardHeader className="px-4 py-0 mb-2">
          <CardTitle className="text-xs font-semibold">Top Models</CardTitle>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {stats.topModels.length === 0 ? (
            <p className="text-xs text-muted-foreground px-4">No model usage yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    {['Model', 'Provider', 'Requests', 'Tokens', 'Est. Cost', 'Success', 'Avg Latency'].map(h => (
                      <th key={h} className="text-left py-1.5 px-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground first:pl-5 last:pr-5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.topModels.map((m: any) => (
                    <tr key={m.model} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-1.5 px-4 pl-5 font-mono">{m.model}</td>
                      <td className="py-1.5 px-4"><ProviderDot provider={m.provider} /></td>
                      <td className="py-1.5 px-4 tabular-nums">{formatNumber(m.requests)}</td>
                      <td className="py-1.5 px-4 tabular-nums">{formatNumber(m.tokens)}</td>
                      <td className="py-1.5 px-4 tabular-nums">{formatCost(m.cost)}</td>
                      <td className="py-1.5 px-4" style={{ color: m.success_rate >= 95 ? '#4ade80' : '#fbbf24' }}>{m.success_rate}%</td>
                      <td className="py-1.5 px-4 pr-5 tabular-nums">{formatLatency(m.avg_latency)}</td>
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
