'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  TrendingUp, Star, CheckCircle, XCircle, Mail, MessageCircle,
  Calendar, Inbox, Clock, AlertCircle, Users, Target, Zap,
  ArrowUpRight, RefreshCw, Plus, Activity, Database, BookOpen,
  X, Send, AtSign, ExternalLink, Phone, Globe, MessageSquare,
} from 'lucide-react'

import { cn, getScoreBg } from '@/lib/utils'
import Link from 'next/link'
import type { Lead } from '@/lib/types'

const CUSTOMER_CATEGORIES = [
  { label: 'Agentic Payments Customer',           color: '#f472b6', bar: 'rgba(244,114,182,0.7)' },
  { label: 'LayerZero Customer',                  color: '#60a5fa', bar: 'rgba(96,165,250,0.7)'  },
  { label: 'Hacked Protocol',                     color: '#f87171', bar: 'rgba(248,113,113,0.7)' },
  { label: 'Needs On/Off Ramp',                   color: '#34d399', bar: 'rgba(52,211,153,0.7)'  },
  { label: 'Fireblocks Customer',                 color: '#a78bfa', bar: 'rgba(167,139,250,0.7)' },
  { label: 'Web2 Stablecoin Settlement Customer', color: '#fbbf24', bar: 'rgba(251,191,36,0.7)'  },
]
const CATEGORY_CAP = 5

const CHANNEL_META: Record<string, { label: string; color: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
  telegram: { label: 'Telegram',  color: '#22d3ee', icon: Send         },
  twitter:  { label: 'Twitter/X', color: '#38bdf8', icon: AtSign       },
  linkedin: { label: 'LinkedIn',  color: '#60a5fa', icon: ExternalLink  },
  email:    { label: 'Email',     color: '#a78bfa', icon: Mail         },
  discord:  { label: 'Discord',   color: '#818cf8', icon: MessageSquare },
  call:     { label: 'Call',      color: '#34d399', icon: Phone        },
  other:    { label: 'Outreach',  color: '#fbbf24', icon: Globe        },
}

interface DashboardStats {
  new_leads: number; qualified: number; excellent: number; approved: number
  rejected: number; contacted: number; replied: number; meetings: number
  total: number; needs_review: number; high_score: number
}
interface CategoryStat { category: string; count: number }

// ── Card Detail Modal ──────────────────────────────────────────────
interface CardModalProps {
  title: string
  subtitle: string
  leads: Lead[]
  color: string
  showChannel?: boolean
  onClose: () => void
}

function CardModal({ title, subtitle, leads, color, showChannel, onClose }: CardModalProps) {
  const getStatusColor = (s: string) => {
    const map: Record<string, string> = { new:'#60a5fa', qualified:'#34d399', approved:'#a78bfa', contacted:'#22d3ee', replied:'#34d399', meeting_booked:'#fbbf24', rejected:'#f87171' }
    return map[s] || '#555'
  }
  const getStatusLabel = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(4,4,10,0.65)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />
      {/* Slide-over panel */}
      <div className="slide-in" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 301,
        width: 'min(520px, 100vw)',
        background: 'rgb(var(--bg-surface-2))',
        borderLeft: '1px solid var(--border-strong)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-40px 0 100px rgba(0,0,0,0.7)',
      }}>
        {/* Accent top bar */}
        <div style={{ height: 3, background: `linear-gradient(90deg, ${color}, ${color}88)`, flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[16px] font-bold text-white">{title}</div>
              <div className="text-[12px] mt-0.5" style={{ color: 'rgb(100,106,135)' }}>{subtitle}</div>
            </div>
            <button onClick={onClose} className="btn btn-secondary" style={{ padding: '5px 7px', flexShrink: 0 }}>
              <X size={14} />
            </button>
          </div>
          {/* Count badge */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[28px] font-bold tabular-nums" style={{ color }}>{leads.length}</span>
            <span className="text-[13px] font-medium" style={{ color: 'rgb(110,115,145)' }}>lead{leads.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {leads.length === 0 ? (
            <div className="text-center py-16 text-[13px]" style={{ color: 'rgb(100,106,135)' }}>
              No leads in this category yet.
            </div>
          ) : (
            leads.map(lead => {
              const channelKey = lead.last_channel || ''
              const channelMeta = CHANNEL_META[channelKey]

              return (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  style={{ textDecoration: 'none', display: 'block' }}
                  onClick={onClose}
                >
                  <div
                    className="flex items-center gap-3 transition-colors"
                    style={{
                      padding: '11px 24px',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: `${color}18`, border: `1px solid ${color}35`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color, flexShrink: 0,
                    }}>
                      {lead.company_name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="text-[13px] font-semibold text-white truncate">{lead.company_name}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {lead.product_to_sell && (
                          <span className="text-[11px]" style={{ color: 'rgb(110,115,145)' }}>{lead.product_to_sell}</span>
                        )}
                        {lead.industry_category && !lead.product_to_sell && (
                          <span className="text-[11px]" style={{ color: 'rgb(110,115,145)' }}>{lead.industry_category}</span>
                        )}
                      </div>
                    </div>

                    {/* Right side */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {/* Score */}
                      {lead.lead_score != null && (
                        <span className={cn('badge', getScoreBg(lead.lead_score))} style={{ fontSize: '10px' }}>
                          {lead.lead_score}
                        </span>
                      )}

                      {/* Channel (for contacted/replied) */}
                      {showChannel && channelMeta ? (
                        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md"
                          style={{ background: `${channelMeta.color}18`, color: channelMeta.color, border: `1px solid ${channelMeta.color}35` }}>
                          <channelMeta.icon size={10} style={{ color: channelMeta.color }} />
                          {channelMeta.label}
                        </span>
                      ) : showChannel && channelKey ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold"
                          style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                          {channelKey}
                        </span>
                      ) : null}

                      {/* Status dot */}
                      {!showChannel && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: getStatusColor(lead.status) }} />
                          <span className="text-[10px]" style={{ color: 'rgb(110,115,145)' }}>{getStatusLabel(lead.status)}</span>
                        </div>
                      )}
                    </div>

                    {/* Arrow */}
                    <ArrowUpRight size={13} style={{ color: 'rgb(90,95,120)', flexShrink: 0 }} />
                  </div>
                </Link>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <Link
            href="/leads"
            onClick={onClose}
            className="btn btn-secondary w-full justify-center"
            style={{ fontSize: 12 }}
          >
            View all leads →
          </Link>
        </div>
      </div>
    </>
  )
}

// ── Stat Card ──────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, bg, border, loading, sub, onClick }: {
  label: string; value: number; icon: React.ComponentType<{size?: number; color?: string}>
  color: string; bg: string; border: string; loading: boolean; sub?: string
  onClick?: () => void
}) {
  return (
    <div
      className="stat-card"
      style={{ borderColor: border, cursor: onClick ? 'pointer' : 'default', transition: 'all 0.18s' }}
      onClick={onClick}
      onMouseEnter={e => { if (onClick) { (e.currentTarget as HTMLDivElement).style.borderColor = color + '55'; (e.currentTarget as HTMLDivElement).style.background = bg + '22' } }}
      onMouseLeave={e => { if (onClick) { (e.currentTarget as HTMLDivElement).style.borderColor = border; (e.currentTarget as HTMLDivElement).style.background = '' } }}
    >
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
      {onClick && value > 0 && (
        <div className="text-[10px] mt-2 font-semibold" style={{ color: color + 'aa' }}>Click to view →</div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [allLeads, setAllLeads] = useState<Lead[]>([])
  const [recentLeads, setRecentLeads] = useState<Lead[]>([])
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([])
  const [productStats, setProductStats] = useState<CategoryStat[]>([])
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  // Modal state
  const [modal, setModal] = useState<{
    title: string
    subtitle: string
    leads: Lead[]
    color: string
    showChannel?: boolean
  } | null>(null)

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
      setAllLeads(leads)
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

  const openModal = (title: string, subtitle: string, leads: Lead[], color: string, showChannel?: boolean) => {
    setModal({ title, subtitle, leads, color, showChannel })
  }

  const statCards = [
    {
      label: 'New Today',  value: stats?.new_leads ?? 0, icon: Inbox,        color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.18)',
      onClick: () => openModal('New Today', 'Leads discovered today', allLeads.filter(l => { const t = new Date(); t.setHours(0,0,0,0); return new Date(l.created_at) >= t }), '#60a5fa'),
    },
    {
      label: 'Excellent',  value: stats?.excellent  ?? 0, icon: Star,         color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.18)',
      onClick: () => openModal('Excellent Leads', 'Leads with excellent priority', allLeads.filter(l => l.priority === 'excellent'), '#a78bfa'),
    },
    {
      label: 'Approved',   value: stats?.approved   ?? 0, icon: CheckCircle,  color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.18)',
      onClick: () => openModal('Approved Leads', 'Leads approved for outreach', allLeads.filter(l => l.status === 'approved'), '#34d399'),
    },
    {
      label: 'Contacted',  value: stats?.contacted  ?? 0, icon: Mail,         color: '#22d3ee', bg: 'rgba(34,211,238,0.1)',  border: 'rgba(34,211,238,0.18)',
      onClick: () => openModal('Contacted Leads', 'Projects you\'ve reached out to & which platform', allLeads.filter(l => l.status === 'contacted'), '#22d3ee', true),
    },
    {
      label: 'Replied',    value: stats?.replied    ?? 0, icon: MessageCircle,color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.18)',
      onClick: () => openModal('Replied Leads', 'Leads that have responded to outreach', allLeads.filter(l => l.status === 'replied'), '#34d399', true),
    },
    {
      label: 'Meetings',   value: stats?.meetings   ?? 0, icon: Calendar,     color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.18)',
      onClick: () => openModal('Meetings Booked', 'Leads with a meeting scheduled', allLeads.filter(l => l.status === 'meeting_booked'), '#fbbf24'),
    },
    {
      label: 'Rejected',   value: stats?.rejected   ?? 0, icon: XCircle,      color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.18)',
      onClick: () => openModal('Rejected Leads', 'Leads that didn\'t qualify', allLeads.filter(l => l.status === 'rejected'), '#f87171'),
    },
    {
      label: 'Total Leads',value: stats?.total      ?? 0, icon: TrendingUp,   color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.18)',
      onClick: () => openModal('All Leads', 'Your entire lead pipeline', allLeads, '#a78bfa'),
    },
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
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
                <Link href="/learn"
                  className="w-full justify-start text-[12px] flex items-center gap-2 rounded-lg font-semibold transition-all duration-200"
                  style={{ padding: '9px 12px', background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa' }}>
                  <BookOpen size={13} /> Feed Intelligence
                  <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}>AI</span>
                </Link>
              </div>

            </div>

          </div>
        </div>
      </div>

      {/* ── Card Detail Modal ─────────────────────────── */}
      {modal && (
        <CardModal
          title={modal.title}
          subtitle={modal.subtitle}
          leads={modal.leads}
          color={modal.color}
          showChannel={modal.showChannel}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
