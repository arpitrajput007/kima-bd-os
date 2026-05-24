'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  TrendingUp, Star, CheckCircle, XCircle, Mail, MessageCircle,
  Calendar, Inbox, Clock, AlertCircle, Users, Target, Zap,
  ArrowUpRight, RefreshCw
} from 'lucide-react'
import { cn, getScoreBg, formatDate } from '@/lib/utils'
import Link from 'next/link'
import type { Lead } from '@/lib/types'

interface DashboardStats {
  new_leads: number
  qualified: number
  excellent: number
  approved: number
  rejected: number
  contacted: number
  replied: number
  meetings: number
  total: number
  needs_review: number
  missing_contacts: number
  high_score: number
}

interface CategoryStat {
  category: string
  count: number
}

export default function DashboardPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentLeads, setRecentLeads] = useState<Lead[]>([])
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([])
  const [productStats, setProductStats] = useState<CategoryStat[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)

    // Fetch all leads for stats
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })

    if (leads) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const newToday = leads.filter(l => new Date(l.created_at) >= today).length

      setStats({
        new_leads: newToday,
        qualified: leads.filter(l => l.status === 'qualified').length,
        excellent: leads.filter(l => l.priority === 'excellent').length,
        approved: leads.filter(l => l.status === 'approved').length,
        rejected: leads.filter(l => l.status === 'rejected').length,
        contacted: leads.filter(l => l.status === 'contacted').length,
        replied: leads.filter(l => l.status === 'replied').length,
        meetings: leads.filter(l => l.status === 'meeting_booked').length,
        total: leads.length,
        needs_review: leads.filter(l => l.status === 'new' || l.status === 'researching').length,
        missing_contacts: leads.filter(l => l.status !== 'rejected' && l.status !== 'archived').length,
        high_score: leads.filter(l => (l.lead_score || 0) >= 70).length,
      })

      setRecentLeads(leads.slice(0, 8))

      // Category stats
      const catMap: Record<string, number> = {}
      leads.forEach(l => {
        const cats = l.customer_category || []
        cats.forEach((cat: string) => {
          catMap[cat] = (catMap[cat] || 0) + 1
        })
      })
      setCategoryStats(
        Object.entries(catMap)
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count)
      )

      // Product stats
      const prodMap: Record<string, number> = {}
      leads.forEach(l => {
        if (l.product_to_sell) {
          prodMap[l.product_to_sell] = (prodMap[l.product_to_sell] || 0) + 1
        }
      })
      setProductStats(
        Object.entries(prodMap)
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6)
      )
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const statCards = [
    { label: 'New Today', value: stats?.new_leads ?? 0, icon: Inbox, color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.08)' },
    { label: 'Excellent Leads', value: stats?.excellent ?? 0, icon: Star, color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.08)' },
    { label: 'Qualified', value: stats?.qualified ?? 0, icon: TrendingUp, color: '#34d399', bg: 'rgba(52, 211, 153, 0.08)' },
    { label: 'Approved', value: stats?.approved ?? 0, icon: CheckCircle, color: '#34d399', bg: 'rgba(52, 211, 153, 0.08)' },
    { label: 'Rejected', value: stats?.rejected ?? 0, icon: XCircle, color: '#f87171', bg: 'rgba(248, 113, 113, 0.08)' },
    { label: 'Contacted', value: stats?.contacted ?? 0, icon: Mail, color: '#22d3ee', bg: 'rgba(34, 211, 238, 0.08)' },
    { label: 'Replied', value: stats?.replied ?? 0, icon: MessageCircle, color: '#34d399', bg: 'rgba(52, 211, 153, 0.08)' },
    { label: 'Meetings', value: stats?.meetings ?? 0, icon: Calendar, color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.08)' },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return '#60a5fa'
      case 'qualified': return '#34d399'
      case 'approved': return '#a78bfa'
      case 'contacted': return '#22d3ee'
      default: return '#6b7280'
    }
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">BD Command Center</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgb(100, 100, 120)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
            style={{ background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.2)', color: '#34d399' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse" />
            Agent Active
          </div>
          <button onClick={loadData} className="btn btn-secondary" style={{ padding: '6px 10px', gap: '5px', fontSize: '12px' }}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link href="/leads/new" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
            <Target size={12} />
            Add Lead
          </Link>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon: Icon, color, bg }) => (
            <div
              key={label}
              className="rounded-xl p-4 card-hover"
              style={{
                background: 'rgba(22, 22, 34, 0.8)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: bg, border: `1px solid ${color}22` }}>
                  <Icon size={15} color={color} />
                </div>
                {label === 'New Today' && value > 0 && (
                  <div className="flex items-center gap-1 text-xs" style={{ color: '#34d399' }}>
                    <ArrowUpRight size={10} />
                    New
                  </div>
                )}
              </div>
              <div className="text-2xl font-bold text-white mb-0.5"
                style={loading ? { opacity: 0.3 } : {}}>
                {loading ? '—' : value}
              </div>
              <div className="text-xs" style={{ color: 'rgb(100, 100, 120)' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Alert Row */}
        {stats && (stats.needs_review > 0 || stats.high_score > 0) && (
          <div className="flex gap-3 flex-wrap">
            {stats.needs_review > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}>
                <AlertCircle size={13} />
                <span><strong>{stats.needs_review}</strong> leads awaiting your review</span>
                <Link href="/leads?status=new" className="underline ml-1">Review →</Link>
              </div>
            )}
            {stats.high_score > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.15)', color: '#a78bfa' }}>
                <Zap size={13} />
                <span><strong>{stats.high_score}</strong> leads scored 70+</span>
                <Link href="/leads?min_score=70" className="underline ml-1">View →</Link>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Leads */}
          <div className="lg:col-span-2 rounded-xl overflow-hidden"
            style={{ background: 'rgba(22, 22, 34, 0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <Clock size={14} style={{ color: 'rgb(140, 140, 160)' }} />
                <span className="text-sm font-semibold text-white">Recent Leads</span>
                <span className="badge" style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', borderColor: 'rgba(96,165,250,0.2)', fontSize: '10px' }}>
                  {recentLeads.length}
                </span>
              </div>
              <Link href="/leads" className="text-xs" style={{ color: 'rgb(139, 92, 246)' }}>
                View all →
              </Link>
            </div>
            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              {loading ? (
                <div className="p-8 text-center text-sm" style={{ color: 'rgb(100, 100, 120)' }}>
                  Loading leads...
                </div>
              ) : recentLeads.length === 0 ? (
                <div className="p-8 text-center">
                  <Inbox size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'rgb(140, 140, 160)' }} />
                  <div className="text-sm font-medium text-white mb-1">No leads yet</div>
                  <div className="text-xs mb-3" style={{ color: 'rgb(100, 100, 120)' }}>
                    Add your first lead or use the AI agent to discover leads
                  </div>
                  <Link href="/leads/new" className="btn btn-primary" style={{ fontSize: '12px', padding: '6px 12px' }}>
                    Add First Lead
                  </Link>
                </div>
              ) : (
                recentLeads.map(lead => (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-white truncate">{lead.company_name}</span>
                        {lead.priority === 'excellent' && (
                          <Star size={11} style={{ color: '#a78bfa', flexShrink: 0 }} />
                        )}
                      </div>
                      <div className="text-xs truncate" style={{ color: 'rgb(100, 100, 120)' }}>
                        {lead.industry_category || 'Unknown category'} · {lead.product_to_sell || 'TBD'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {lead.lead_score != null && (
                        <div className={cn('badge', getScoreBg(lead.lead_score))}>
                          {lead.lead_score}
                        </div>
                      )}
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: getStatusColor(lead.status) }}
                      />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Customer Categories */}
            <div className="rounded-xl overflow-hidden"
              style={{ background: 'rgba(22, 22, 34, 0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 px-4 py-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <Users size={13} style={{ color: 'rgb(140, 140, 160)' }} />
                <span className="text-sm font-semibold text-white">By Sales Category</span>
              </div>
              <div className="p-4 space-y-3">
                {categoryStats.length === 0 ? (
                  <div className="text-xs text-center py-3" style={{ color: 'rgb(100, 100, 120)' }}>
                    No data yet
                  </div>
                ) : categoryStats.slice(0, 5).map(({ category, count }) => {
                  const max = categoryStats[0]?.count || 1
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs" style={{ color: 'rgb(160, 160, 180)' }}>{category}</span>
                        <span className="text-xs font-medium text-white">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(count / max) * 100}%`,
                            background: 'linear-gradient(90deg, #7c3aed, #8b5cf6)'
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Product Distribution */}
            <div className="rounded-xl overflow-hidden"
              style={{ background: 'rgba(22, 22, 34, 0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 px-4 py-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <Target size={13} style={{ color: 'rgb(140, 140, 160)' }} />
                <span className="text-sm font-semibold text-white">By Product</span>
              </div>
              <div className="p-4 space-y-3">
                {productStats.length === 0 ? (
                  <div className="text-xs text-center py-3" style={{ color: 'rgb(100, 100, 120)' }}>
                    No data yet
                  </div>
                ) : productStats.map(({ category, count }) => {
                  const max = productStats[0]?.count || 1
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs truncate mr-2" style={{ color: 'rgb(160, 160, 180)' }}>{category}</span>
                        <span className="text-xs font-medium text-white flex-shrink-0">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(count / max) * 100}%`,
                            background: 'linear-gradient(90deg, #0d9488, #34d399)'
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-xl p-4"
              style={{ background: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.12)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Zap size={13} style={{ color: '#a78bfa' }} />
                <span className="text-sm font-semibold" style={{ color: '#a78bfa' }}>Quick Actions</span>
              </div>
              <div className="space-y-2">
                <Link href="/leads/new" className="btn btn-secondary w-full justify-start text-xs"
                  style={{ padding: '7px 10px' }}>
                  <Target size={12} /> Add new lead manually
                </Link>
                <Link href="/outreach" className="btn btn-secondary w-full justify-start text-xs"
                  style={{ padding: '7px 10px' }}>
                  <MessageCircle size={12} /> Generate outreach
                </Link>
                <Link href="/reports" className="btn btn-secondary w-full justify-start text-xs"
                  style={{ padding: '7px 10px' }}>
                  <TrendingUp size={12} /> View weekly report
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
