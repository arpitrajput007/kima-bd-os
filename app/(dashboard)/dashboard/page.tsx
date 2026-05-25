'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  TrendingUp, Star, CheckCircle, XCircle, Mail, MessageCircle,
  Calendar, Inbox, Clock, AlertCircle, Users, Target, Zap,
  ArrowUpRight, RefreshCw, Plus, Activity, Database
} from 'lucide-react'
import { cn, getScoreBg } from '@/lib/utils'
import Link from 'next/link'
import type { Lead } from '@/lib/types'

const CUSTOMER_CATEGORIES = [
  { label: 'LayerZero Customer',                  color: '#60a5fa', bar: 'rgba(96,165,250,0.7)'  },
  { label: 'Hacked Protocol',                     color: '#f87171', bar: 'rgba(248,113,113,0.7)' },
  { label: 'Needs On/Off Ramp',                   color: '#34d399', bar: 'rgba(52,211,153,0.7)'  },
  { label: 'Fireblocks Customer',                 color: '#a78bfa', bar: 'rgba(167,139,250,0.7)' },
  { label: 'Web2 Stablecoin Settlement Customer', color: '#fbbf24', bar: 'rgba(251,191,36,0.7)'  },
]
const CATEGORY_CAP = 3

interface DashboardStats {
  new_leads: number; qualified: number; excellent: number; approved: number
  rejected: number; contacted: number; replied: number; meetings: number
  total: number; needs_review: number; high_score: number
}
interface CategoryStat { category: string; count: number }

function StatCard({ label, value, icon: Icon, color, bg, border, loading, sub }: {
  label: string; value: number; icon: React.ComponentType<{size?: number; color?: string}>
  color: string; bg: string; border: string; loading: boolean; sub?: string
}) {
  return (
    <div className="stat-card" style={{ borderColor: border }}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: bg }}>
          <Icon size={18} color={color} />
        </div>
        {value > 0 && (
          <div className="flex items-center gap-1 text-[11px] font-semibold" style={{ color }}>
            <ArrowUpRight size={12} />
          </div>
        )}
      </div>
      <div className="text-[32px] font-bold tabular-nums leading-none mb-1.5 text-white"
        style={loading ? { opacity: 0.2 } : {}}>
        {loading ? '—' : value}
      </div>
      <div className="text-[12px] font-medium" style={{ color: 'rgb(110,115,145)' }}>{label}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color }}>{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentLeads, setRecentLeads] = useState<Lead[]>([])
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([])
  const [productStats, setProductStats] = useState<CategoryStat[]>([])
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    const { data: leads } = await supabase
      .from('leads').select('*').order('created_at', { ascending: false })
    if (leads) {
      const today = new Date(); today.setHours(0,0,0,0)
      setStats({
        new_leads: leads.filter(l => new Date(l.created_at) >= today).length,
        qualified: leads.filter(l => l.status === 'qualified').length,
        excellent: leads.filter(l => l.priority === 'excellent').length,
        approved: leads.filter(l => l.status === 'approved').length,
        rejected: leads.filter(l => l.status === 'rejected').length,
        contacted: leads.filter(l => l.status === 'contacted').length,
        replied: leads.filter(l => l.status === 'replied').length,
        meetings: leads.filter(l => l.status === 'meeting_booked').length,
        total: leads.length,
        needs_review: leads.filter(l => l.status === 'new' || l.status === 'researching').length,
        high_score: leads.filter(l => (l.lead_score || 0) >= 70).length,
      })
      setRecentLeads(leads.slice(0, 10))

      const counts: Record<string, number> = {}
      CUSTOMER_CATEGORIES.forEach(c => { counts[c.label] = 0 })
      leads.filter(l => l.status !== 'rejected' && l.status !== 'archived')
        .forEach(l => { (l.customer_category || []).forEach((cat: string) => { if (counts[cat] !== undefined) counts[cat]++ }) })
      setCategoryCounts(counts)

      const catMap: Record<string, number> = {}
      leads.forEach(l => { (l.customer_category || []).forEach((cat: string) => { catMap[cat] = (catMap[cat] || 0) + 1 }) })
      setCategoryStats(Object.entries(catMap).map(([category, count]) => ({ category, count })).sort((a,b) => b.count - a.count))

      const prodMap: Record<string, number> = {}
      leads.forEach(l => { if (l.product_to_sell) prodMap[l.product_to_sell] = (prodMap[l.product_to_sell] || 0) + 1 })
      setProductStats(Object.entries(prodMap).map(([category, count]) => ({ category, count })).sort((a,b) => b.count - a.count).slice(0, 6))
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, []) // eslint-disable-line

  const statCards = [
    { label: 'New Today',  value: stats?.new_leads ?? 0, icon: Inbox,        color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.18)'  },
    { label: 'Excellent',  value: stats?.excellent  ?? 0, icon: Star,         color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.18)' },
    { label: 'Approved',   value: stats?.approved   ?? 0, icon: CheckCircle,  color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.18)'  },
    { label: 'Contacted',  value: stats?.contacted  ?? 0, icon: Mail,         color: '#22d3ee', bg: 'rgba(34,211,238,0.1)',  border: 'rgba(34,211,238,0.18)'  },
    { label: 'Replied',    value: stats?.replied    ?? 0, icon: MessageCircle,color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.18)'  },
    { label: 'Meetings',   value: stats?.meetings   ?? 0, icon: Calendar,     color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.18)'  },
    { label: 'Rejected',   value: stats?.rejected   ?? 0, icon: XCircle,      color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.18)' },
    { label: 'Total Leads',value: stats?.total      ?? 0, icon: TrendingUp,   color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.18)' },
  ]

  const getStatusColor = (s: string) => {
    const map: Record<string, string> = { new:'#60a5fa', qualified:'#34d399', approved:'#a78bfa', contacted:'#22d3ee', replied:'#34d399', meeting_booked:'#fbbf24', rejected:'#f87171' }
    return map[s] || '#555'
  }
  const getStatusLabel = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div className="fade-in">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-white tracking-tight">BD Command Center</h1>
          <p className="text-[12px] mt-1 font-medium" style={{ color: 'rgb(100,106,135)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
            style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.18)', color: '#34d399' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse" />
            Agent Active
          </div>
          <button onClick={loadData} className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '12px' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link href="/leads/new" className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '12px' }}>
            <Plus size={13} />
            Add Lead
          </Link>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────── */}
      <div style={{ padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* ── Alerts ─────────────────────────────────── */}
        {stats && (stats.needs_review > 0 || stats.high_score > 0) && (
          <div className="flex gap-3 flex-wrap">
            {stats.needs_review > 0 && (
              <Link href="/leads?status=new"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-opacity hover:opacity-90"
                style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.18)', color: '#fbbf24' }}>
                <AlertCircle size={13} />
                <span><strong>{stats.needs_review}</strong> leads awaiting review</span>
                <span className="opacity-60 ml-1">→</span>
              </Link>
            )}
            {stats.high_score > 0 && (
              <Link href="/leads"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-opacity hover:opacity-90"
                style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.18)', color: '#a78bfa' }}>
                <Zap size={13} />
                <span><strong>{stats.high_score}</strong> leads scored 70+</span>
                <span className="opacity-60 ml-1">→</span>
              </Link>
            )}
          </div>
        )}

        {/* ── Stat Cards ──────────────────────────────── */}
        <div>
          <div className="text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: 'rgb(100,106,135)' }}>
            Pipeline Overview
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statCards.map(card => (
              <StatCard key={card.label} {...card} loading={loading} />
            ))}
          </div>
        </div>

        {/* ── Category Quota ──────────────────────────── */}
        <div className="section-card">
          <div className="section-card-header">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.15)' }}>
                <Activity size={14} style={{ color: '#a78bfa' }} />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-white">Lead Queue Quotas</div>
                <div className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>3 leads per category · Agent pauses when full</div>
              </div>
            </div>
            <Link href="/sources" className="text-[12px] font-semibold hover:opacity-80 transition-opacity"
              style={{ color: 'rgb(167,139,250)' }}>
              Manage Sources →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-5">
            {CUSTOMER_CATEGORIES.map(({ label, color, bar }, i) => {
              const count = categoryCounts[label] || 0
              const pct = Math.min((count / CATEGORY_CAP) * 100, 100)
              const full = count >= CATEGORY_CAP
              return (
                <div key={label}
                  className={cn('px-6 py-5', i < CUSTOMER_CATEGORIES.length - 1 && 'border-r')}
                  style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <div className="text-[11px] font-medium mb-3 leading-snug" style={{ color: 'rgb(140,145,175)' }}>{label}</div>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-[26px] font-bold tabular-nums leading-none"
                      style={{ color: full ? '#f87171' : 'white' }}>{count}</span>
                    <span className="text-[12px] font-medium" style={{ color: 'rgb(90,95,120)' }}>/ {CATEGORY_CAP}</span>
                    {full && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>FULL</span>}
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: full ? '#f87171' : bar }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Main Grid ────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Recent Leads — 2/3 */}
          <div className="lg:col-span-2 section-card">
            <div className="section-card-header">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(96,165,250,0.1)' }}>
                  <Clock size={14} style={{ color: '#60a5fa' }} />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white">Recent Leads</div>
                  <div className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>Latest discoveries by the agent</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="badge" style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', borderColor: 'rgba(96,165,250,0.2)', fontSize: '11px' }}>
                  {recentLeads.length}
                </span>
                <Link href="/leads" className="text-[12px] font-semibold hover:opacity-80 transition-opacity" style={{ color: 'rgb(167,139,250)' }}>
                  View all →
                </Link>
              </div>
            </div>
            <div>
              {loading ? (
                <div className="p-10 text-center text-[13px]" style={{ color: 'rgb(100,106,135)' }}>Loading…</div>
              ) : recentLeads.length === 0 ? (
                <div className="p-14 text-center">
                  <Database size={40} className="mx-auto mb-4 opacity-15" style={{ color: 'rgb(160,165,195)' }} />
                  <div className="text-[14px] font-semibold text-white mb-2">No leads yet</div>
                  <div className="text-[12px] mb-5" style={{ color: 'rgb(100,106,135)', lineHeight: '1.7' }}>
                    Add a source and run the discovery engine to find your first leads.
                  </div>
                  <Link href="/sources" className="btn btn-primary" style={{ fontSize: '12px', padding: '8px 16px' }}>
                    Go to Sources
                  </Link>
                </div>
              ) : (
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Company</th>
                      <th className="text-left">Product</th>
                      <th className="text-center">Score</th>
                      <th className="text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLeads.map(lead => (
                      <tr key={lead.id} className="cursor-pointer" onClick={() => window.location.href = `/leads/${lead.id}`}>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                              style={{ background: 'rgba(124,58,237,0.15)', color: 'rgb(167,139,250)' }}>
                              {lead.company_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-[13px] font-semibold text-white">{lead.company_name}</div>
                              <div className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>{lead.industry_category || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="text-[12px]" style={{ color: 'rgb(140,145,175)' }}>
                          {lead.product_to_sell || '—'}
                        </td>
                        <td className="text-center">
                          {lead.lead_score != null ? (
                            <span className={cn('badge', getScoreBg(lead.lead_score))} style={{ fontSize: '11px' }}>
                              {lead.lead_score}
                            </span>
                          ) : <span style={{ color: 'rgb(90,95,120)' }}>—</span>}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: getStatusColor(lead.status) }} />
                            <span className="text-[12px]" style={{ color: 'rgb(140,145,175)' }}>{getStatusLabel(lead.status)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right column — 1/3 */}
          <div className="space-y-5">

            {/* By Category */}
            <div className="section-card">
              <div className="section-card-header">
                <div className="flex items-center gap-2">
                  <Users size={14} style={{ color: 'rgb(130,135,165)' }} />
                  <span className="text-[13px] font-semibold text-white">By Customer Type</span>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {categoryStats.length === 0 ? (
                  <div className="text-[12px] text-center py-3" style={{ color: 'rgb(100,106,135)' }}>No data yet</div>
                ) : categoryStats.slice(0, 5).map(({ category, count }) => {
                  const max = categoryStats[0]?.count || 1
                  const catColor = CUSTOMER_CATEGORIES.find(c => c.label === category)?.color || '#a78bfa'
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[12px] font-medium truncate mr-2" style={{ color: 'rgb(160,165,195)' }}>{category}</span>
                        <span className="text-[13px] font-bold text-white tabular-nums flex-shrink-0">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(count / max) * 100}%`, background: catColor, opacity: 0.75 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* By Product */}
            <div className="section-card">
              <div className="section-card-header">
                <div className="flex items-center gap-2">
                  <Target size={14} style={{ color: 'rgb(130,135,165)' }} />
                  <span className="text-[13px] font-semibold text-white">By Product</span>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {productStats.length === 0 ? (
                  <div className="text-[12px] text-center py-3" style={{ color: 'rgb(100,106,135)' }}>No data yet</div>
                ) : productStats.map(({ category, count }) => {
                  const max = productStats[0]?.count || 1
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[12px] font-medium truncate mr-2" style={{ color: 'rgb(160,165,195)' }}>{category}</span>
                        <span className="text-[13px] font-bold text-white tabular-nums flex-shrink-0">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(count / max) * 100}%`, background: 'linear-gradient(90deg, #0d9488, #34d399)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="section-card" style={{ borderColor: 'rgba(124,58,237,0.18)' }}>
              <div className="section-card-header" style={{ background: 'rgba(124,58,237,0.05)' }}>
                <div className="flex items-center gap-2">
                  <Zap size={14} style={{ color: '#a78bfa' }} />
                  <span className="text-[13px] font-semibold" style={{ color: '#a78bfa' }}>Quick Actions</span>
                </div>
              </div>
              <div className="p-4 space-y-2">
                <Link href="/leads/new" className="btn btn-secondary w-full justify-start text-[12px]" style={{ padding: '9px 12px' }}>
                  <Target size={13} /> Add lead manually
                </Link>
                <Link href="/sources" className="btn btn-secondary w-full justify-start text-[12px]" style={{ padding: '9px 12px' }}>
                  <Database size={13} /> Run discovery
                </Link>
                <Link href="/outreach" className="btn btn-secondary w-full justify-start text-[12px]" style={{ padding: '9px 12px' }}>
                  <MessageCircle size={13} /> Generate outreach
                </Link>
                <Link href="/reports" className="btn btn-secondary w-full justify-start text-[12px]" style={{ padding: '9px 12px' }}>
                  <TrendingUp size={13} /> Weekly report
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
