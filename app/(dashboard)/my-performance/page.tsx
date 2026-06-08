'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Target, TrendingUp, Mail, Users, Trophy,
  RefreshCw, Calendar, Clock, CheckCircle2,
  XCircle, Activity, Zap, Star, Award, Flame,
  Edit3, Save, X, Send, AtSign, ExternalLink,
  Phone, BarChart2, MessageSquare, ArrowUpRight,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

// ── Constants ──────────────────────────────────────────────────
const CONTACTED_STATUSES = [
  'contacted', 'replied', 'meeting_booked',
  'proposal_sent', 'negotiating', 'integration', 'won', 'lost',
]
const REPLIED_STATUSES = [
  'replied', 'meeting_booked', 'proposal_sent', 'negotiating', 'integration', 'won',
]
const MEETING_STATUSES = [
  'meeting_booked', 'proposal_sent', 'negotiating', 'integration', 'won',
]

// ── Goals (persisted to localStorage) ─────────────────────────
interface Goals {
  contactsPerDay:       number
  contactsPerWeek:      number
  contactsPerMonth:     number
  meetingsPerMonth:     number
  partnershipsPerMonth: number
}
const DEFAULT_GOALS: Goals = {
  contactsPerDay:       3,
  contactsPerWeek:      15,
  contactsPerMonth:     50,
  meetingsPerMonth:     5,
  partnershipsPerMonth: 1,
}
const GOALS_KEY = 'kima_bd_goals_v1'

function readGoals(): Goals {
  if (typeof window === 'undefined') return DEFAULT_GOALS
  try {
    const raw = localStorage.getItem(GOALS_KEY)
    return raw ? { ...DEFAULT_GOALS, ...JSON.parse(raw) } : DEFAULT_GOALS
  } catch { return DEFAULT_GOALS }
}
function writeGoals(g: Goals) {
  localStorage.setItem(GOALS_KEY, JSON.stringify(g))
}

// ── Helpers ────────────────────────────────────────────────────
function pct(val: number, max: number) {
  return max > 0 ? Math.min(Math.round((val / max) * 100), 100) : 0
}
function weekRange(weeksAgo: number): [Date, Date] {
  const end = new Date()
  end.setDate(end.getDate() - weeksAgo * 7)
  const start = new Date(end)
  start.setDate(start.getDate() - 6)
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)
  return [start, end]
}
function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Sub-components ─────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: 3,
        width: `${pct(value, max)}%`,
        background: color,
        transition: 'width 0.8s cubic-bezier(.16,1,.3,1)',
      }} />
    </div>
  )
}

function KpiCard({
  label, value, sub, color, icon: Icon, loading,
}: {
  label: string; value: string; sub?: string; color: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; loading: boolean
}) {
  return (
    <div className="stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Subtle glow top border */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color, opacity: 0.5, borderRadius: '14px 14px 0 0' }} />
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: color + '15', border: `1px solid ${color}22` }}>
          <Icon size={16} style={{ color }} />
        </div>
        <ArrowUpRight size={13} style={{ color, opacity: 0.4 }} />
      </div>
      <div className="text-[26px] font-bold tabular-nums leading-none text-white mb-1"
        style={loading ? { opacity: 0.18 } : {}}>
        {loading ? '—' : value}
      </div>
      <div className="text-[11px] font-medium" style={{ color: 'rgb(100,106,135)' }}>{label}</div>
      {sub && <div className="text-[10px] font-semibold mt-1" style={{ color }}>{sub}</div>}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
export default function MyPerformancePage() {
  const supabase = createClient()

  const [loading,  setLoading]  = useState(true)
  const [mounted,  setMounted]  = useState(false)
  const [leads,    setLeads]    = useState<any[]>([])
  const [acts,     setActs]     = useState<any[]>([])
  const [msgs,     setMsgs]     = useState<any[]>([])

  const [goals,        setGoals]        = useState<Goals>(DEFAULT_GOALS)
  const [editingGoals, setEditingGoals] = useState(false)
  const [goalDraft,    setGoalDraft]    = useState<Goals>(DEFAULT_GOALS)

  useEffect(() => {
    setMounted(true)
    const g = readGoals()
    setGoals(g)
    setGoalDraft(g)
  }, [])

  // ── Data fetch ────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    const [leadsRes, actsRes, msgsRes] = await Promise.all([
      supabase
        .from('leads')
        .select('id,status,contacted_at,last_contacted_at,customer_category,last_channel,created_at'),
      supabase
        .from('lead_activities')
        .select('id,lead_id,type,channel,content,created_at,completed_at,scheduled_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('outreach_messages')
        .select('channel,status,created_at'),
    ])
    setLeads(leadsRes.data ?? [])
    setActs(actsRes.data  ?? [])
    setMsgs(msgsRes.data  ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // ── Time windows ──────────────────────────────────────────────
  const now        = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  // ISO week starts Monday
  const isoWeekStart = new Date(now)
  isoWeekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  isoWeekStart.setHours(0, 0, 0, 0)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // ── Outreach volume ───────────────────────────────────────────
  const totalIdentified   = leads.length
  const totalContacted    = leads.filter(l => CONTACTED_STATUSES.includes(l.status)).length
  const contactedToday    = leads.filter(l => l.contacted_at && new Date(l.contacted_at) >= todayStart).length
  const contactedThisWeek = leads.filter(l => l.contacted_at && new Date(l.contacted_at) >= isoWeekStart).length
  const contactedThisMonth = leads.filter(l => l.contacted_at && new Date(l.contacted_at) >= monthStart).length

  // ── Status breakdown ──────────────────────────────────────────
  const byStatus = (s: string) => leads.filter(l => l.status === s).length
  const statusCounts = {
    contacted:     byStatus('contacted'),
    replied:       byStatus('replied'),
    meeting_booked: byStatus('meeting_booked'),
    proposal_sent: byStatus('proposal_sent'),
    negotiating:   byStatus('negotiating'),
    integration:   byStatus('integration'),
    won:           byStatus('won'),
    lost:          byStatus('lost'),
  }
  const openFollowups = acts.filter(a => a.type === 'follow_up' && !a.completed_at).length
  const overdueFollowups = acts.filter(a =>
    a.type === 'follow_up' && !a.completed_at && a.scheduled_at && new Date(a.scheduled_at) < now,
  ).length

  // ── Conversion rates ──────────────────────────────────────────
  const repliedCount = leads.filter(l => REPLIED_STATUSES.includes(l.status)).length
  const meetingCount = leads.filter(l => MEETING_STATUSES.includes(l.status)).length
  const wonCount     = statusCounts.won

  const responseRate = pct(repliedCount, totalContacted)
  const meetingRate  = pct(meetingCount, repliedCount)
  const winRate      = pct(wonCount, totalContacted)

  // Avg days to first reply (status_change to "Replied" minus contacted_at)
  const repliedActs = acts.filter(a =>
    a.type === 'status_change' && a.content?.toLowerCase().includes('replied'),
  )
  const daysToReplyArr = repliedActs.map((a: any) => {
    const lead = leads.find(l => l.id === a.lead_id)
    if (!lead?.contacted_at) return null
    const diff = (new Date(a.created_at).getTime() - new Date(lead.contacted_at).getTime()) / 86_400_000
    return diff > 0 ? Math.round(diff) : null
  }).filter((d: number | null): d is number => d !== null)
  const avgDaysToReply = daysToReplyArr.length > 0
    ? Math.round(daysToReplyArr.reduce((s: number, d: number) => s + d, 0) / daysToReplyArr.length)
    : null

  // Avg days to win
  const wonActs = acts.filter((a: any) =>
    a.type === 'status_change' && a.content?.toLowerCase().includes('won'),
  )
  const daysToWinArr = wonActs.map((a: any) => {
    const lead = leads.find(l => l.id === a.lead_id)
    if (!lead?.contacted_at) return null
    const diff = (new Date(a.created_at).getTime() - new Date(lead.contacted_at).getTime()) / 86_400_000
    return diff > 0 ? Math.round(diff) : null
  }).filter((d: number | null): d is number => d !== null)
  const avgDaysToWin = daysToWinArr.length > 0
    ? Math.round(daysToWinArr.reduce((s: number, d: number) => s + d, 0) / daysToWinArr.length)
    : null

  // ── Channel counts ────────────────────────────────────────────
  // Primary: lead_activities (manual CRM logs) + outreach_messages (sent drafts)
  const actsByChannel = (ch: string) => acts.filter((a: any) => a.channel === ch).length
  const msgsByChannel = (ch: string) => msgs.filter((m: any) => m.status === 'sent' && m.channel === ch).length
  const ch = {
    email:    actsByChannel('email')    + msgsByChannel('email'),
    telegram: actsByChannel('telegram') + msgsByChannel('telegram'),
    twitter:  actsByChannel('twitter')  + msgsByChannel('twitter'),
    linkedin: actsByChannel('linkedin') + msgsByChannel('linkedin'),
    call:     actsByChannel('call'),
    followups: acts.filter((a: any) => a.type === 'follow_up' && a.completed_at).length,
  }
  const totalTouches = ch.email + ch.telegram + ch.twitter + ch.linkedin + ch.call

  // Best channel by volume
  const bestChannel = Object.entries({ email: ch.email, telegram: ch.telegram, twitter: ch.twitter, linkedin: ch.linkedin, call: ch.call })
    .sort((a, b) => b[1] - a[1])
    .find(([, v]) => v > 0)?.[0] ?? null

  // ── Performance insights ──────────────────────────────────────
  // Best category = most reply-weighted engagement
  const catScores: Record<string, number> = {}
  leads.forEach(l => {
    const score = REPLIED_STATUSES.includes(l.status) ? 3
      : CONTACTED_STATUSES.includes(l.status) ? 1 : 0
    ;(l.customer_category ?? []).forEach((cat: string) => {
      catScores[cat] = (catScores[cat] ?? 0) + score
    })
  })
  const bestCategory = Object.entries(catScores).sort((a, b) => b[1] - a[1]).find(([, v]) => v > 0)?.[0] ?? null

  // ── Goals progress this period ────────────────────────────────
  const meetingsThisMonth = acts.filter((a: any) =>
    a.type === 'status_change' &&
    a.content?.toLowerCase().includes('meeting') &&
    new Date(a.created_at) >= monthStart,
  ).length
  const wonThisMonth = acts.filter((a: any) =>
    a.type === 'status_change' &&
    a.content?.toLowerCase().includes('won') &&
    new Date(a.created_at) >= monthStart,
  ).length

  // ── Weekly trend (last 10 weeks) ──────────────────────────────
  const weeklyTrend = Array.from({ length: 10 }, (_, i) => {
    const weeksAgo = 9 - i
    const [wStart, wEnd] = weekRange(weeksAgo)
    return {
      label: fmtDate(wEnd),
      contacts:   leads.filter(l => l.contacted_at && new Date(l.contacted_at) >= wStart && new Date(l.contacted_at) <= wEnd).length,
      activities: acts.filter((a: any) => { const d = new Date(a.created_at); return a.channel && d >= wStart && d <= wEnd }).length,
    }
  })

  // ── Goals handlers ────────────────────────────────────────────
  const saveGoalsFn = () => {
    setGoals(goalDraft)
    writeGoals(goalDraft)
    setEditingGoals(false)
  }

  // ── Channel BEST label ────────────────────────────────────────
  const CHANNEL_META: Record<string, { label: string; color: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
    email:    { label: 'Email',     color: '#60a5fa', icon: Mail         },
    telegram: { label: 'Telegram',  color: '#34d399', icon: Send         },
    twitter:  { label: 'Twitter/X', color: '#22d3ee', icon: AtSign       },
    linkedin: { label: 'LinkedIn',  color: '#818cf8', icon: ExternalLink },
    call:     { label: 'Calls',     color: '#fbbf24', icon: Phone        },
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="fade-in">

      {/* ── Sticky header ──────────────────────────────────────── */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-white tracking-tight">My BD Performance</h1>
          <p className="text-[12px] mt-0.5 font-medium" style={{ color: 'rgb(100,106,135)' }}>
            Personal outreach analytics, conversion tracking &amp; KPI goals
          </p>
        </div>
        <button onClick={loadData} className="btn btn-secondary" style={{ padding: '7px 14px', fontSize: '12px' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div style={{ padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: 26 }}>

        {/* ── Section 1: Hero KPI Cards ─────────────────────────── */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgb(80,85,115)' }}>
            Overall Numbers
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard label="Leads Identified"  value={String(totalIdentified)}   color="#a78bfa"  icon={Users}         loading={loading}
              sub={`${totalContacted > 0 ? pct(totalContacted, totalIdentified) : 0}% contacted`} />
            <KpiCard label="Total Contacted"   value={String(totalContacted)}    color="#22d3ee"  icon={Mail}          loading={loading}
              sub={totalContacted > 0 ? `${totalContacted} companies reached` : undefined} />
            <KpiCard label="Replied / Engaged" value={String(repliedCount)}      color="#34d399"  icon={MessageSquare} loading={loading}
              sub={totalContacted > 0 ? `${responseRate}% reply rate` : undefined} />
            <KpiCard label="Meetings Booked"   value={String(meetingCount)}      color="#fbbf24"  icon={Calendar}      loading={loading}
              sub={repliedCount > 0 ? `${meetingRate}% of replies` : undefined} />
            <KpiCard label="Partnerships Won"  value={String(wonCount)}          color="#4ade80"  icon={Trophy}        loading={loading}
              sub={wonCount > 0 ? `${winRate}% win rate` : undefined} />
            <KpiCard label="Open Follow-ups"
              value={String(openFollowups)}
              color={overdueFollowups > 0 ? '#f87171' : openFollowups > 0 ? '#fb923c' : '#34d399'}
              icon={Clock} loading={loading}
              sub={overdueFollowups > 0 ? `${overdueFollowups} overdue` : openFollowups > 0 ? 'Need action' : 'All clear ✓'} />
          </div>
        </div>

        {/* ── Section 2: Outreach Volume + Conversion ───────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Outreach Volume */}
          <div className="section-card">
            <div className="section-card-header">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(34,211,238,0.1)' }}>
                  <Activity size={14} style={{ color: '#22d3ee' }} />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white">Outreach Volume</div>
                  <div className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>New companies contacted per period</div>
                </div>
              </div>
            </div>
            <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { label: 'Today',      value: contactedToday,      color: '#22d3ee', goal: goals.contactsPerDay       },
                { label: 'This Week',  value: contactedThisWeek,   color: '#a78bfa', goal: goals.contactsPerWeek      },
                { label: 'This Month', value: contactedThisMonth,  color: '#34d399', goal: goals.contactsPerMonth     },
              ].map(({ label, value, color, goal }) => {
                const p = pct(value, goal)
                const hit = p >= 100
                return (
                  <div key={label} style={{ padding: '14px 14px 12px', borderRadius: 11, background: hit ? color + '08' : 'rgba(255,255,255,0.025)', border: `1px solid ${hit ? color + '30' : 'rgba(255,255,255,0.06)'}` }}>
                    <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'rgb(100,106,135)' }}>{label}</div>
                    <div style={{ fontSize: 30, fontWeight: 800, color: loading ? 'rgba(255,255,255,0.15)' : hit ? color : 'white', lineHeight: 1, marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
                      {loading ? '—' : value}
                    </div>
                    <div className="text-[10px] mb-2.5" style={{ color: hit ? color : 'rgb(80,85,110)' }}>
                      {hit ? '🎯 Goal hit!' : `of ${goal} goal`}
                    </div>
                    <MiniBar value={value} max={goal} color={color} />
                    <div className="text-[10px] mt-1.5 text-right tabular-nums" style={{ color }}>
                      {p}%
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Conversion Rates */}
          <div className="section-card">
            <div className="section-card-header">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(167,139,250,0.1)' }}>
                  <TrendingUp size={14} style={{ color: '#a78bfa' }} />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white">Conversion Funnel</div>
                  <div className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>How your pipeline converts at each stage</div>
                </div>
              </div>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Response Rate',       value: responseRate, desc: `${repliedCount} replied / ${totalContacted} contacted`, color: '#34d399' },
                { label: 'Meeting Booking Rate', value: meetingRate,  desc: `${meetingCount} meetings from ${repliedCount} replies`,  color: '#fbbf24' },
                { label: 'Win Rate',             value: winRate,      desc: `${wonCount} won from ${totalContacted} contacted`,       color: '#4ade80' },
              ].map(({ label, value, desc, color }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-medium" style={{ color: 'rgb(160,165,195)' }}>{label}</span>
                    <span className="text-[18px] font-bold tabular-nums" style={{ color }}>{value}%</span>
                  </div>
                  <MiniBar value={value} max={100} color={color} />
                  <div className="text-[10px] mt-1" style={{ color: 'rgb(80,85,110)' }}>{desc}</div>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3 mt-1">
                {[
                  { label: 'Avg. Days to 1st Reply', value: avgDaysToReply, unit: 'days after contact' },
                  { label: 'Avg. Days to Close',     value: avgDaysToWin,   unit: 'contact to partnership' },
                ].map(({ label, value, unit }) => (
                  <div key={label} style={{ padding: '11px 13px', borderRadius: 10, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="text-[10px] font-medium mb-1.5" style={{ color: 'rgb(100,106,135)' }}>{label}</div>
                    <div className="text-[22px] font-bold tabular-nums text-white leading-none">
                      {value !== null ? value : <span style={{ color: 'rgb(80,85,110)' }}>—</span>}
                    </div>
                    <div className="text-[10px] mt-1" style={{ color: 'rgb(80,85,110)' }}>{unit}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* ── Section 3: Pipeline Funnel ────────────────────────── */}
        <div className="section-card">
          <div className="section-card-header">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.1)' }}>
                <Target size={14} style={{ color: '#fbbf24' }} />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-white">Lead Status Breakdown</div>
                <div className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>Where every contacted lead stands right now</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'rgb(80,85,110)' }}>Total contacted</span>
              <span className="text-[15px] font-bold text-white tabular-nums">{totalContacted}</span>
            </div>
          </div>

          <div style={{ padding: '18px 22px 20px' }}>
            {/* Visual funnel bar */}
            {totalContacted > 0 ? (
              <div className="mb-5">
                <div style={{ height: 22, borderRadius: 11, display: 'flex', gap: 2, overflow: 'hidden' }}>
                  {[
                    { key: 'contacted',     count: statusCounts.contacted,     color: '#38bdf8' },
                    { key: 'replied',       count: statusCounts.replied,       color: '#fbbf24' },
                    { key: 'meeting_booked', count: statusCounts.meeting_booked, color: '#34d399' },
                    { key: 'proposal_sent', count: statusCounts.proposal_sent, color: '#fb923c' },
                    { key: 'negotiating',   count: statusCounts.negotiating,   color: '#818cf8' },
                    { key: 'integration',   count: statusCounts.integration,   color: '#22d3ee' },
                    { key: 'won',           count: statusCounts.won,           color: '#4ade80' },
                    { key: 'lost',          count: statusCounts.lost,          color: '#f43f5e' },
                  ].filter(s => s.count > 0).map(s => (
                    <div key={s.key}
                      title={`${s.key.replace(/_/g, ' ')}: ${s.count}`}
                      style={{ flex: s.count, background: s.color, borderRadius: 3, minWidth: 3 }} />
                  ))}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-2.5">
                  {[
                    { label: 'Contacted',   color: '#38bdf8' },
                    { label: 'Replied',     color: '#fbbf24' },
                    { label: 'Meeting',     color: '#34d399' },
                    { label: 'Proposal',    color: '#fb923c' },
                    { label: 'Negotiating', color: '#818cf8' },
                    { label: 'Integrating', color: '#22d3ee' },
                    { label: 'Won',         color: '#4ade80' },
                    { label: 'Lost',        color: '#f43f5e' },
                  ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                      <span className="text-[10px]" style={{ color: 'rgb(100,106,135)' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-4 p-4 rounded-xl text-center text-[12px]" style={{ color: 'rgb(100,106,135)', background: 'rgba(255,255,255,0.025)' }}>
                No contacted leads yet — start reaching out to see your funnel
              </div>
            )}

            {/* 8-card grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                { label: 'Contacted',    count: statusCounts.contacted,      color: '#38bdf8', icon: Mail,         desc: 'Awaiting reply'    },
                { label: 'Replied',      count: statusCounts.replied,        color: '#fbbf24', icon: MessageSquare, desc: 'Engaged with us'  },
                { label: 'Meeting Booked', count: statusCounts.meeting_booked, color: '#34d399', icon: Calendar, desc: 'Call scheduled'    },
                { label: 'Proposal Sent', count: statusCounts.proposal_sent, color: '#fb923c', icon: Star,         desc: 'Under their review' },
                { label: 'Negotiating',  count: statusCounts.negotiating,    color: '#818cf8', icon: Zap,          desc: 'Terms being shaped' },
                { label: 'Integrating',  count: statusCounts.integration,    color: '#22d3ee', icon: Award,        desc: 'Deal in motion'    },
                { label: 'Won / Closed', count: statusCounts.won,            color: '#4ade80', icon: Trophy,       desc: 'Partnership active' },
                { label: 'Lost',         count: statusCounts.lost,           color: '#f43f5e', icon: XCircle,      desc: 'Closed lost'       },
              ].map(({ label, count, color, icon: Icon, desc }) => (
                <div key={label} style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: count > 0 ? color + '09' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${count > 0 ? color + '28' : 'rgba(255,255,255,0.05)'}`,
                }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon size={11} style={{ color: count > 0 ? color : 'rgb(80,85,110)' }} />
                    <span className="text-[10px] font-semibold" style={{ color: count > 0 ? color : 'rgb(80,85,110)' }}>{label}</span>
                  </div>
                  <div className="text-[22px] font-bold tabular-nums leading-none text-white">{count}</div>
                  <div className="text-[9px] mt-1" style={{ color: 'rgb(80,85,110)' }}>{desc}</div>
                </div>
              ))}
              {/* Follow-ups card — spans full width of last row */}
              <div style={{
                gridColumn: 'span 4', padding: '10px 14px', borderRadius: 10,
                background: overdueFollowups > 0 ? 'rgba(248,113,113,0.06)' : openFollowups > 0 ? 'rgba(251,146,60,0.06)' : 'rgba(52,211,153,0.05)',
                border: `1px solid ${overdueFollowups > 0 ? 'rgba(248,113,113,0.22)' : openFollowups > 0 ? 'rgba(251,146,60,0.22)' : 'rgba(52,211,153,0.18)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div className="flex items-center gap-2.5">
                  <Clock size={13} style={{ color: overdueFollowups > 0 ? '#f87171' : openFollowups > 0 ? '#fb923c' : '#34d399' }} />
                  <div>
                    <div className="text-[11px] font-semibold" style={{ color: overdueFollowups > 0 ? '#f87171' : openFollowups > 0 ? '#fb923c' : '#34d399' }}>
                      {overdueFollowups > 0 ? `${overdueFollowups} overdue follow-ups` : openFollowups > 0 ? `${openFollowups} pending follow-ups` : 'No pending follow-ups'}
                    </div>
                    <div className="text-[10px]" style={{ color: 'rgb(80,85,110)' }}>
                      {overdueFollowups > 0 ? 'Past due date — action needed today' : openFollowups > 0 ? 'Scheduled for future dates' : 'All follow-ups completed ✓'}
                    </div>
                  </div>
                </div>
                <div className="text-[28px] font-bold tabular-nums" style={{ color: overdueFollowups > 0 ? '#f87171' : openFollowups > 0 ? '#fb923c' : '#34d399' }}>
                  {openFollowups}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 4: Activity by Channel + Insights ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Activity by Channel */}
          <div className="section-card">
            <div className="section-card-header">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.1)' }}>
                  <Send size={14} style={{ color: '#34d399' }} />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white">Activity by Channel</div>
                  <div className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>Outreach touches across all platforms</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'rgb(80,85,110)' }}>Total</span>
                <span className="text-[18px] font-bold text-white tabular-nums">{totalTouches}</span>
              </div>
            </div>
            <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 11 }}>
              {[
                { key: 'email',    label: 'Email',      count: ch.email,    color: '#60a5fa', icon: Mail         },
                { key: 'telegram', label: 'Telegram',   count: ch.telegram, color: '#34d399', icon: Send         },
                { key: 'twitter',  label: 'Twitter/X',  count: ch.twitter,  color: '#22d3ee', icon: AtSign       },
                { key: 'linkedin', label: 'LinkedIn',   count: ch.linkedin, color: '#818cf8', icon: ExternalLink },
                { key: 'call',     label: 'Calls',      count: ch.call,     color: '#fbbf24', icon: Phone        },
                { key: 'followups',label: 'Follow-ups completed', count: ch.followups, color: '#fb923c', icon: CheckCircle2 },
              ].map(({ key, label, count, color, icon: Icon }) => {
                const max = Math.max(ch.email, ch.telegram, ch.twitter, ch.linkedin, ch.call, 1)
                const isBest = bestChannel === key
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: color + '15', border: `1px solid ${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={12} style={{ color }} />
                        </div>
                        <span className="text-[12px] font-medium" style={{ color: 'rgb(160,165,195)' }}>{label}</span>
                        {isBest && count > 0 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: color + '20', color, border: `1px solid ${color}30` }}>TOP</span>
                        )}
                      </div>
                      <span className="text-[14px] font-bold tabular-nums text-white">{count}</span>
                    </div>
                    <MiniBar value={key === 'followups' ? count : count} max={key === 'followups' ? Math.max(ch.followups, 1) : max} color={color} />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Performance Insights */}
          <div className="section-card">
            <div className="section-card-header">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.12)' }}>
                  <Zap size={14} style={{ color: '#a78bfa' }} />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white">Performance Insights</div>
                  <div className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>What's working best in your BD process</div>
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                {
                  label: 'Best Outreach Channel',
                  value: bestChannel
                    ? (CHANNEL_META[bestChannel]?.label ?? bestChannel)
                    : 'Log activities to see',
                  color: bestChannel ? (CHANNEL_META[bestChannel]?.color ?? '#a78bfa') : '#a78bfa',
                  icon: bestChannel ? (CHANNEL_META[bestChannel]?.icon ?? Star) : Star,
                  desc: bestChannel
                    ? `Highest outreach volume via ${CHANNEL_META[bestChannel]?.label ?? bestChannel}`
                    : 'Use CRM to log channel activities',
                },
                {
                  label: 'Best Lead Category',
                  value: bestCategory ?? 'Contact more leads',
                  color: '#34d399',
                  icon: Target,
                  desc: bestCategory
                    ? 'Highest engagement & replies in this ICP'
                    : 'Patterns appear after 5+ contacts',
                },
                {
                  label: 'Outreach Velocity',
                  value: contactedThisWeek > 0 ? `${contactedThisWeek} / week` : 'No data yet',
                  color: '#fbbf24',
                  icon: Flame,
                  desc: `${contactedThisMonth} this month · ${contactedToday} today`,
                },
                {
                  label: 'Pipeline Health Score',
                  value: (() => {
                    if (totalContacted === 0) return 'No data'
                    const score = Math.round(
                      (responseRate * 0.3) +
                      (meetingRate * 0.3) +
                      (winRate * 0.2) +
                      (Math.min(contactedThisWeek / Math.max(goals.contactsPerWeek, 1), 1) * 20)
                    )
                    return score >= 70 ? `${score} · Strong` : score >= 40 ? `${score} · Building` : `${score} · Early stage`
                  })(),
                  color: (() => {
                    if (totalContacted === 0) return '#a78bfa'
                    const score = Math.round(
                      (responseRate * 0.3) + (meetingRate * 0.3) +
                      (winRate * 0.2) +
                      (Math.min(contactedThisWeek / Math.max(goals.contactsPerWeek, 1), 1) * 20)
                    )
                    return score >= 70 ? '#34d399' : score >= 40 ? '#fbbf24' : '#a78bfa'
                  })(),
                  icon: TrendingUp,
                  desc: 'Composite: reply rate × meeting rate × win rate × velocity',
                },
              ].map(({ label, value, color, icon: Icon, desc }) => (
                <div key={label} style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.055)',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '15', border: `1px solid ${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={15} style={{ color }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'rgb(100,106,135)' }}>{label}</div>
                    <div className="text-[13px] font-bold text-white truncate">{value}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'rgb(80,85,110)' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Section 5: Goals & Targets ────────────────────────── */}
        <div className="section-card" style={{ borderColor: editingGoals ? 'rgba(251,146,60,0.3)' : undefined }}>
          <div className="section-card-header">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(251,146,60,0.1)' }}>
                <Flame size={14} style={{ color: '#fb923c' }} />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-white">Goals &amp; Targets</div>
                <div className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>Your personal KPIs — edit anytime</div>
              </div>
            </div>
            {editingGoals ? (
              <div className="flex gap-2">
                <button onClick={() => { setGoalDraft(goals); setEditingGoals(false) }} className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: '12px' }}>
                  <X size={12} /> Cancel
                </button>
                <button onClick={saveGoalsFn} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }}>
                  <Save size={12} /> Save Goals
                </button>
              </div>
            ) : (
              <button onClick={() => { setGoalDraft(goals); setEditingGoals(true) }} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                <Edit3 size={12} /> Edit Goals
              </button>
            )}
          </div>
          <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
            {([
              { key: 'contactsPerDay'       as keyof Goals, label: 'Contacts / Day',       period: 'today',  current: contactedToday,     color: '#22d3ee', icon: Mail         },
              { key: 'contactsPerWeek'      as keyof Goals, label: 'Contacts / Week',      period: 'week',   current: contactedThisWeek,  color: '#a78bfa', icon: Activity     },
              { key: 'contactsPerMonth'     as keyof Goals, label: 'Contacts / Month',     period: 'month',  current: contactedThisMonth, color: '#34d399', icon: Users        },
              { key: 'meetingsPerMonth'     as keyof Goals, label: 'Meetings / Month',     period: 'month',  current: meetingsThisMonth,  color: '#fbbf24', icon: Calendar     },
              { key: 'partnershipsPerMonth' as keyof Goals, label: 'Partnerships / Month', period: 'month',  current: wonThisMonth,       color: '#4ade80', icon: Trophy       },
            ] as { key: keyof Goals; label: string; period: string; current: number; color: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }[]).map(({ key, label, current, color, icon: Icon }) => {
              const target = goals[key]
              const p = pct(current, target)
              const hit = p >= 100
              const close = p >= 70 && !hit
              return (
                <div key={key} style={{
                  padding: '16px', borderRadius: 12,
                  background: hit ? color + '09' : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${hit ? color + '30' : 'rgba(255,255,255,0.06)'}`,
                  transition: 'all 0.2s',
                }}>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Icon size={12} style={{ color }} />
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'rgb(100,106,135)' }}>{label}</span>
                  </div>

                  {editingGoals ? (
                    <div>
                      <div className="text-[10px] mb-1.5" style={{ color: 'rgb(100,106,135)' }}>Target</div>
                      <input
                        type="number"
                        value={goalDraft[key]}
                        onChange={e => setGoalDraft(d => ({ ...d, [key]: Math.max(1, parseInt(e.target.value) || 1) }))}
                        className="input-dark"
                        style={{ fontSize: 18, fontWeight: 700, padding: '7px 10px', textAlign: 'center' }}
                        min={1}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="tabular-nums leading-none mb-2.5" style={{ fontSize: 28, fontWeight: 800, color: hit ? color : 'white' }}>
                        {current}
                        <span style={{ fontSize: 15, fontWeight: 500, color: 'rgb(80,85,110)', marginLeft: 3 }}>/ {target}</span>
                      </div>
                      <MiniBar value={current} max={target} color={color} />
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] font-semibold" style={{ color: hit ? color : close ? '#fbbf24' : 'rgb(100,106,135)' }}>
                          {hit ? '🎯 Target reached!' : close ? `Almost — ${p}%` : `${p}% of goal`}
                        </span>
                        {hit && <span style={{ fontSize: 14 }}>🏆</span>}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Section 6: Weekly Trend Chart ────────────────────── */}
        <div className="section-card">
          <div className="section-card-header">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(96,165,250,0.1)' }}>
                <BarChart2 size={14} style={{ color: '#60a5fa' }} />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-white">Weekly Outreach Trend</div>
                <div className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>
                  Contacts initiated &amp; activities logged per week · last 10 weeks
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: '16px 22px 24px' }}>
            {mounted && !loading ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyTrend} barGap={3} barCategoryGap="28%">
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: 'rgb(100,106,135)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'rgb(100,106,135)' }}
                    axisLine={false}
                    tickLine={false}
                    width={22}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgb(20,22,33)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      borderRadius: 9,
                      fontSize: 12,
                      color: 'rgb(160,165,195)',
                    }}
                    labelStyle={{ color: 'rgb(200,205,235)', fontWeight: 600, marginBottom: 4 }}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  />
                  <Bar dataKey="contacts"   name="Contacts initiated" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="activities" name="Activities logged"  fill="rgba(167,139,250,0.25)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="text-[12px]" style={{ color: 'rgb(100,106,135)' }}>
                  {loading ? 'Loading data…' : 'Loading chart…'}
                </div>
              </div>
            )}
            <div className="flex items-center gap-5 mt-3">
              <div className="flex items-center gap-1.5">
                <div style={{ width: 10, height: 10, borderRadius: 3, background: '#a78bfa' }} />
                <span className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>Contacts initiated</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(167,139,250,0.25)' }} />
                <span className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>Activities logged (channel)</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
