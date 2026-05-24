'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  TrendingUp, Star, CheckCircle, XCircle, Mail, MessageCircle,
  Calendar, Inbox, Clock, AlertCircle, Users, Target, Zap,
  ArrowUpRight, RefreshCw, Plus, ArrowRight, BrainCircuit, Database
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
    { label: 'New Leads Today', value: stats?.new_leads ?? 0, icon: Inbox, color: '#60A5FA', bg: 'rgba(96, 165, 250, 0.12)' },
    { label: 'Excellent Leads', value: stats?.excellent ?? 0, icon: Star, color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.12)' },
    { label: 'Qualified Pipeline', value: stats?.qualified ?? 0, icon: TrendingUp, color: '#34D399', bg: 'rgba(52, 211, 153, 0.12)' },
    { label: 'Approved for Outreach', value: stats?.approved ?? 0, icon: CheckCircle, color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
    { label: 'Rejected', value: stats?.rejected ?? 0, icon: XCircle, color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' },
    { label: 'Contacted', value: stats?.contacted ?? 0, icon: Mail, color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.12)' },
    { label: 'Replied', value: stats?.replied ?? 0, icon: MessageCircle, color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
    { label: 'Meetings Booked', value: stats?.meetings ?? 0, icon: Calendar, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return '#60A5FA'
      case 'qualified': return '#34D399'
      case 'approved': return '#A78BFA'
      case 'contacted': return '#22D3EE'
      default: return '#71717A'
    }
  }

  return (
    <div className="fade-in page-container">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F4F4F5] tracking-tight">BD Command Center</h1>
          <p className="text-[13px] font-medium text-[#A1A1AA] mt-1">
            AI-powered lead intelligence for Kima/Aeredium
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-[rgba(16,185,129,0.1)] text-[#10B981] border border-[rgba(16,185,129,0.2)]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] status-pulse" />
            Agent Active
          </div>
          <div className="w-px h-6 bg-[#272738] hidden md:block" />
          <button onClick={loadData} className="btn btn-secondary">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link href="/leads/new" className="btn btn-primary">
            <Plus size={14} />
            Add Lead
          </Link>
        </div>
      </div>

      <div className="space-y-8">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="glass card-hover p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: bg }}>
                  <Icon size={18} color={color} />
                </div>
                {label === 'New Leads Today' && value > 0 && (
                  <div className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-[#34D399] uppercase">
                    <ArrowUpRight size={12} />
                    Rising
                  </div>
                )}
              </div>
              <div className="text-3xl font-bold text-[#F4F4F5] tracking-tight mb-1" style={loading ? { opacity: 0.3 } : {}}>
                {loading ? '—' : value}
              </div>
              <div className="text-[13px] font-medium text-[#A1A1AA]">{label}</div>
            </div>
          ))}
        </div>

        {/* Alert Row */}
        {stats && (stats.needs_review > 0 || stats.high_score > 0) && (
          <div className="flex gap-4 flex-wrap">
            {stats.needs_review > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.2)] text-[#F59E0B]">
                <AlertCircle size={16} />
                <span><strong className="font-bold">{stats.needs_review}</strong> leads awaiting your review</span>
                <Link href="/leads?status=new" className="underline ml-1 underline-offset-2">Review →</Link>
              </div>
            )}
            {stats.high_score > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.2)] text-[#A78BFA]">
                <Zap size={16} />
                <span><strong className="font-bold">{stats.high_score}</strong> leads scored 70+</span>
                <Link href="/leads?min_score=70" className="underline ml-1 underline-offset-2">View →</Link>
              </div>
            )}
          </div>
        )}

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Recent Leads */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-[#272738]">
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-[#A1A1AA]" />
                  <span className="text-base font-semibold text-[#F4F4F5]">Recent High-Quality Leads</span>
                  <span className="badge bg-[rgba(59,130,246,0.1)] text-[#60A5FA] border-[rgba(59,130,246,0.2)]">
                    {recentLeads.length}
                  </span>
                </div>
                <Link href="/leads" className="text-sm font-medium text-[#A78BFA] hover:text-[#C4B5FD] transition-colors">
                  View all pipeline →
                </Link>
              </div>
              
              <div className="divide-y divide-[#1A1A24]">
                {loading ? (
                  <div className="p-12 text-center text-sm text-[#71717A]">
                    Syncing pipeline data...
                  </div>
                ) : recentLeads.length === 0 ? (
                  /* Beautiful Empty State */
                  <div className="p-12 text-center max-w-md mx-auto">
                    <div className="w-16 h-16 bg-[#171724] border border-[#272738] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-black/20">
                      <Inbox size={24} className="text-[#A1A1AA]" />
                    </div>
                    <h3 className="text-lg font-bold text-[#F4F4F5] mb-2 tracking-tight">No leads discovered yet</h3>
                    <p className="text-sm text-[#A1A1AA] mb-8 leading-relaxed">
                      Add your first data source or manually inject a lead to jumpstart the AI BD agent's learning process.
                    </p>
                    
                    <div className="bg-[#171724] border border-[#272738] rounded-xl p-5 text-left mb-8 shadow-inner">
                      <div className="text-xs font-bold text-[#71717A] uppercase tracking-wider mb-4">Getting Started Checklist</div>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <CheckCircle size={16} className="text-[#34D399] shrink-0 mt-0.5" />
                          <span className="text-sm text-[#F4F4F5]">Connect your first data source or target list</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle size={16} className="text-[#272738] shrink-0 mt-0.5" />
                          <span className="text-sm text-[#A1A1AA]">Let the AI qualify and score leads</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle size={16} className="text-[#272738] shrink-0 mt-0.5" />
                          <span className="text-sm text-[#A1A1AA]">Generate hyper-personalized outreach</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center gap-3">
                      <Link href="/sources" className="btn btn-secondary">
                        <Database size={14} /> Add Source
                      </Link>
                      <Link href="/leads/new" className="btn btn-primary">
                        <Plus size={14} /> Add Lead Manually
                      </Link>
                    </div>
                  </div>
                ) : (
                  recentLeads.map(lead => (
                    <Link
                      key={lead.id}
                      href={`/leads/${lead.id}`}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[15px] font-semibold text-[#F4F4F5] tracking-tight truncate group-hover:text-white transition-colors">{lead.company_name}</span>
                          {lead.priority === 'excellent' && (
                            <Star size={12} className="text-[#A78BFA] fill-[#A78BFA] shrink-0" />
                          )}
                        </div>
                        <div className="text-[13px] text-[#A1A1AA] truncate font-medium">
                          {lead.industry_category || 'Unknown category'} <span className="text-[#3F3F50] mx-1">•</span> {lead.product_to_sell || 'TBD'}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        {lead.lead_score != null && (
                          <div className={cn('badge shadow-sm', getScoreBg(lead.lead_score))}>
                            {lead.lead_score}
                          </div>
                        )}
                        <div className="w-8 h-8 rounded-full border border-[#272738] flex items-center justify-center bg-[#171724]">
                          <ArrowRight size={14} className="text-[#A1A1AA] group-hover:text-white transition-colors" />
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Intel & Stats */}
          <div className="space-y-6">
            
            {/* Agent Intelligence Summary */}
            <div className="glass p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#7C3AED] opacity-[0.03] rounded-full blur-3xl -mr-10 -mt-10 transition-opacity group-hover:opacity-[0.06]" />
              <div className="flex items-center gap-3 mb-4">
                <BrainCircuit size={18} className="text-[#A78BFA]" />
                <span className="text-sm font-semibold text-[#F4F4F5]">Agent Intelligence</span>
              </div>
              <p className="text-[13px] text-[#A1A1AA] leading-relaxed mb-4">
                The agent is currently monitoring active sources and cross-referencing firmographic data against your ideal customer profiles.
              </p>
              <Link href="/reports" className="text-[13px] font-medium text-[#A78BFA] hover:text-[#C4B5FD] transition-colors flex items-center gap-1">
                View latest learning report <ArrowRight size={12} />
              </Link>
            </div>

            {/* Sales Category Breakdown */}
            <div className="glass">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-[#272738]">
                <Users size={16} className="text-[#A1A1AA]" />
                <span className="text-sm font-semibold text-[#F4F4F5]">Sales Category Breakdown</span>
              </div>
              <div className="p-5 space-y-4">
                {categoryStats.length === 0 ? (
                  <div className="text-[13px] text-center py-4 text-[#71717A]">No pipeline data yet</div>
                ) : categoryStats.slice(0, 5).map(({ category, count }) => {
                  const max = categoryStats[0]?.count || 1
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[13px] font-medium text-[#A1A1AA]">{category}</span>
                        <span className="text-[13px] font-bold text-[#F4F4F5]">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#171724] border border-[#272738] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{
                            width: `${(count / max) * 100}%`,
                            background: 'linear-gradient(90deg, #7C3AED, #A78BFA)'
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Product Angle Breakdown */}
            <div className="glass">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-[#272738]">
                <Target size={16} className="text-[#A1A1AA]" />
                <span className="text-sm font-semibold text-[#F4F4F5]">Product Angle Breakdown</span>
              </div>
              <div className="p-5 space-y-4">
                {productStats.length === 0 ? (
                  <div className="text-[13px] text-center py-4 text-[#71717A]">No pipeline data yet</div>
                ) : productStats.map(({ category, count }) => {
                  const max = productStats[0]?.count || 1
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[13px] font-medium text-[#A1A1AA] truncate mr-3">{category}</span>
                        <span className="text-[13px] font-bold text-[#F4F4F5] shrink-0">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#171724] border border-[#272738] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{
                            width: `${(count / max) * 100}%`,
                            background: 'linear-gradient(90deg, #10B981, #34D399)'
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-[rgba(124,58,237,0.04)] border border-[rgba(124,58,237,0.1)] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={16} className="text-[#A78BFA]" />
                <span className="text-sm font-semibold text-[#A78BFA]">Quick Actions</span>
              </div>
              <div className="space-y-2.5">
                <Link href="/leads/new" className="btn btn-secondary w-full justify-start text-[13px] shadow-sm bg-[#171724] hover:bg-[#1A1A24]">
                  <Plus size={14} className="text-[#A1A1AA]" /> Manually Inject Lead
                </Link>
                <Link href="/outreach" className="btn btn-secondary w-full justify-start text-[13px] shadow-sm bg-[#171724] hover:bg-[#1A1A24]">
                  <MessageCircle size={14} className="text-[#A1A1AA]" /> Generate Outreach
                </Link>
                <Link href="/reports" className="btn btn-secondary w-full justify-start text-[13px] shadow-sm bg-[#171724] hover:bg-[#1A1A24]">
                  <TrendingUp size={14} className="text-[#A1A1AA]" /> View Learning Report
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
