'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Lightbulb, Sparkles, Loader2, RefreshCw, AlertCircle,
  Users, DollarSign, ListChecks, CheckCircle2, TrendingUp,
} from 'lucide-react'
import {
  productDemandStatusMeta, productDemandCategoryLabel,
  fmtUsdCompact, sumClientMonthlyVolume,
} from '@/lib/monthly-reports-types'
import type { ProductFeatureDemand, ProductDemandClient } from '@/lib/monthly-reports-types'
import { KpiCard, SectionHeader } from '@/components/monthly-reports/ui'

type SortKey = 'volume' | 'clients' | 'recent'

const IMPORTANCE_COLOR: Record<string, string> = { high: '#fbbf24', medium: '#60a5fa', low: '#9ca3af' }

function sortedClients(clients: ProductDemandClient[]): ProductDemandClient[] {
  return [...clients].sort((a, b) => (b.monthly_volume_usd ?? -1) - (a.monthly_volume_usd ?? -1))
}

export default function ProductDemandPage() {
  const supabase = createClient()
  const [items, setItems]           = useState<ProductFeatureDemand[]>([])
  const [loading, setLoading]       = useState(true)
  const [analyzing, setAnalyzing]   = useState(false)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [sortKey, setSortKey]       = useState<SortKey>('volume')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('product_feature_demand')
      .select('*')
      .order('mention_count', { ascending: false })
    if (error?.message?.includes('does not exist')) {
      setSetupNeeded(true); setLoading(false); return
    }
    setSetupNeeded(false)
    setItems((data || []) as ProductFeatureDemand[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function analyze() {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/ai/product-demand', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to analyze feedback')
      if (json.items) setItems(json.items as ProductFeatureDemand[])
      toast.success(json.message || `Backlog updated — ${json.items?.length ?? 0} item(s)`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to analyze feedback')
    } finally {
      setAnalyzing(false)
    }
  }

  async function updateStatus(id: string, status: string) {
    setItems(prev => prev.map(p => p.id === id ? { ...p, status: status as ProductFeatureDemand['status'] } : p))
    await supabase.from('product_feature_demand').update({ status }).eq('id', id)
  }

  // ── Rollups ─────────────────────────────────────────────────
  const withVolume = useMemo(() => items.map(item => {
    const { total, parsedCount } = sumClientMonthlyVolume(item.client_details || [])
    return { item, volumeUsd: total, parsedCount, clientCount: (item.client_details?.length || item.companies?.length || 0) }
  }), [items])

  const filtered = useMemo(() => {
    const rows = statusFilter === 'all' ? withVolume : withVolume.filter(r => r.item.status === statusFilter)
    const sorted = [...rows]
    if (sortKey === 'volume') sorted.sort((a, b) => b.volumeUsd - a.volumeUsd)
    else if (sortKey === 'clients') sorted.sort((a, b) => b.clientCount - a.clientCount)
    else sorted.sort((a, b) => (b.item.last_seen || '').localeCompare(a.item.last_seen || ''))
    return sorted
  }, [withVolume, statusFilter, sortKey])

  const totalOpen = items.filter(i => i.status === 'open').length
  const totalShipped = items.filter(i => i.status === 'shipped').length
  const allClients = new Set(items.flatMap(i => i.companies || []))
  const totalVolumeUsd = withVolume.reduce((sum, r) => sum + r.volumeUsd, 0)
  const totalParsed = withVolume.reduce((sum, r) => sum + r.parsedCount, 0)
  const totalClientRows = withVolume.reduce((sum, r) => sum + r.clientCount, 0)

  return (
    <div className="fade-in">
      <div className="page-header flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Product / Feature Demand</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgb(100,106,135)' }}>
            What prospects say we&apos;re missing — clustered from every deal&apos;s product feedback &amp; blockers, with the volume behind each gap.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={load} disabled={loading} className="btn btn-secondary" style={{ padding: '7px 10px', fontSize: '12px' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={analyze} disabled={analyzing} className="btn btn-ai" style={{ fontSize: '12px', gap: '6px' }}>
            {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {items.length ? 'Re-analyze Feedback' : 'Analyze Feedback'}
          </button>
        </div>
      </div>

      <div style={{ padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: 26 }}>

        {setupNeeded && (
          <div className="rounded-xl p-5 flex gap-4" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <AlertCircle size={18} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="text-sm font-semibold text-white mb-1">Database setup required</p>
              <p className="text-xs" style={{ color: 'rgb(180,170,120)' }}>
                Run <code className="px-1 py-0.5 rounded text-[11px]" style={{ background: 'rgba(255,255,255,0.07)' }}>supabase/add-product-feature-demand.sql</code> and then <code className="px-1 py-0.5 rounded text-[11px]" style={{ background: 'rgba(255,255,255,0.07)' }}>supabase/add-product-demand-client-details.sql</code> in your Supabase SQL editor to enable this page.
              </p>
            </div>
          </div>
        )}

        {!setupNeeded && (
          <>
            {/* ── KPIs ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard label="Open Gaps"              value={totalOpen}                        color="#f87171" icon={ListChecks}  loading={loading} />
              <KpiCard label="Clients Affected"       value={allClients.size}                  color="#a78bfa" icon={Users}       loading={loading}
                sub={totalClientRows > allClients.size ? `${totalClientRows} deal mentions` : undefined} />
              <KpiCard label="Monthly Volume At Risk" value={totalVolumeUsd > 0 ? fmtUsdCompact(totalVolumeUsd) + '/mo' : '—'} color="#34d399" icon={DollarSign} loading={loading}
                sub={totalParsed > 0 ? `estimated from ${totalParsed} deal${totalParsed !== 1 ? 's' : ''}` : 'no parseable volume yet'} />
              <KpiCard label="Shipped"                value={totalShipped}                      color="#4ade80" icon={CheckCircle2} loading={loading} />
            </div>

            {/* ── Filters ───────────────────────────────────── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setStatusFilter('all')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={statusFilter === 'all'
                    ? { background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.4)', color: '#a78bfa' }
                    : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgb(130,130,160)' }}>
                  All ({items.length})
                </button>
                {(['open','planned','shipped','wont_fix'] as const).map(s => {
                  const m = productDemandStatusMeta(s)
                  const count = items.filter(i => i.status === s).length
                  const active = statusFilter === s
                  return (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={active
                        ? { background: m.bg, border: `1px solid ${m.color}50`, color: m.color }
                        : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgb(130,130,160)' }}>
                      {m.label} ({count})
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>Sort by</span>
                {([
                  { key: 'volume' as SortKey,  label: 'Volume at risk' },
                  { key: 'clients' as SortKey, label: 'Client count'   },
                  { key: 'recent' as SortKey,  label: 'Most recent'    },
                ]).map(o => (
                  <button key={o.key} onClick={() => setSortKey(o.key)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
                    style={sortKey === o.key
                      ? { background: 'rgba(255,255,255,0.08)', color: 'white' }
                      : { background: 'transparent', color: 'rgb(100,106,135)' }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── List ──────────────────────────────────────── */}
            <div className="section-card">
              <SectionHeader
                icon={Lightbulb} iconColor="#fbbf24"
                title="Feature / Product Backlog"
                subtitle="Ranked by estimated monthly volume blocked — use this to prioritize what to build next"
              />
              <div style={{ padding: '18px 22px' }}>
                {loading ? (
                  <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin" style={{ color: '#a78bfa' }} /></div>
                ) : filtered.length === 0 ? (
                  <p className="text-xs" style={{ color: 'rgb(100,106,135)' }}>
                    {items.length === 0
                      ? 'Click "Analyze Feedback" to have AI read the Product Feedback and Blockers collected across every tracked deal, cluster them into distinct gaps, and build a running, priority-ranked backlog here.'
                      : 'No items match this filter.'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filtered.map(({ item, volumeUsd, parsedCount, clientCount }) => {
                      const clients = sortedClients(item.client_details || [])
                      return (
                        <div key={item.id} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-white">{item.title}</span>
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
                                {productDemandCategoryLabel(item.category)}
                              </span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgb(150,150,180)' }}>
                                <Users size={9} />{clientCount} client{clientCount !== 1 ? 's' : ''} need this
                              </span>
                              {volumeUsd > 0 && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                                  <TrendingUp size={9} />~{fmtUsdCompact(volumeUsd)}/mo blocked
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {(['open','planned','shipped','wont_fix'] as const).map(s => {
                                const m = productDemandStatusMeta(s)
                                const active = item.status === s
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => updateStatus(item.id, s)}
                                    className="px-2 py-1 rounded-md text-[10px] font-medium transition-all"
                                    style={active
                                      ? { background: m.bg, border: `1px solid ${m.color}50`, color: m.color }
                                      : { background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', color: 'rgb(100,106,135)' }}
                                  >
                                    {active && <CheckCircle2 size={9} className="inline mr-0.5" style={{ marginBottom: 1 }} />}
                                    {m.label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          {item.description && (
                            <p className="text-xs mb-3" style={{ color: 'rgb(160,165,195)', lineHeight: 1.5 }}>{item.description}</p>
                          )}

                          {clients.length > 0 && (
                            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                              <table className="w-full" style={{ fontSize: '11px' }}>
                                <thead>
                                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                                    <th className="text-left px-3 py-1.5 font-medium" style={{ color: 'rgb(110,110,140)' }}>Client</th>
                                    <th className="text-left px-3 py-1.5 font-medium" style={{ color: 'rgb(110,110,140)' }}>Monthly Volume</th>
                                    <th className="text-left px-3 py-1.5 font-medium" style={{ color: 'rgb(110,110,140)' }}>Revenue Opportunity</th>
                                    <th className="text-left px-3 py-1.5 font-medium" style={{ color: 'rgb(110,110,140)' }}>Importance</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {clients.map((c, i) => (
                                    <tr key={c.company + i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                      <td className="px-3 py-1.5" style={{ color: 'rgb(200,200,225)' }}>{c.company}</td>
                                      <td className="px-3 py-1.5" style={{ color: 'rgb(160,165,195)' }}>{c.monthly_volume || ''}</td>
                                      <td className="px-3 py-1.5" style={{ color: 'rgb(160,165,195)' }}>{c.estimated_revenue || ''}</td>
                                      <td className="px-3 py-1.5">
                                        {c.strategic_importance && (
                                          <span className="text-[10px] font-semibold" style={{ color: IMPORTANCE_COLOR[c.strategic_importance] || '#9ca3af' }}>
                                            {c.strategic_importance.toUpperCase()}
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {parsedCount > 0 && parsedCount < clientCount && (
                            <p className="text-[10px] mt-1.5" style={{ color: 'rgb(80,85,110)' }}>
                              Volume estimate covers {parsedCount} of {clientCount} clients — the rest didn&apos;t have a parseable volume figure on their deal.
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
