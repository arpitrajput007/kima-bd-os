'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  TrendingUp, Star, CheckCircle, XCircle, Mail, MessageCircle,
  Calendar, Inbox, Clock, AlertCircle, Users, Target, Zap,
  RefreshCw, Plus, ArrowRight, BrainCircuit, Database, ChevronRight
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

  return (
    <div className="page-container">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">BD Command Center</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            AI-powered lead intelligence for Kima/Aeredium
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium bg-[var(--success-subtle)] text-[var(--success)] border border-[rgba(52,211,153,0.15)]">
            <div className="status-dot active" />
            Agent Active
          </div>
          <button onClick={loadData} className="btn btn-secondary">
            <RefreshCw size={14} className={loading ? 'animate-spin text-[var(--text-muted)]' : 'text-[var(--text-muted)]'} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <Link href="/leads/new" className="btn btn-primary">
            <Plus size={14} />
            Add Lead
          </Link>
        </div>
      </div>

      {/* SECTION 1: PIPELINE SNAPSHOT */}
      <div className="mb-8">
        <h2 className="text-xs-bold mb-4">Pipeline Snapshot</h2>
        
        {/* Primary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="surface-panel p-5">
            <div className="text-[13px] font-medium text-[var(--text-secondary)] mb-2 flex items-center gap-2">
              <Inbox size={14} className="text-[var(--info)]" /> New Leads Today
            </div>
            <div className="text-3xl font-semibold text-[var(--text-primary)] tracking-tight">
              {loading ? '—' : (stats?.new_leads ?? 0)}
            </div>
          </div>
          <div className="surface-panel p-5">
            <div className="text-[13px] font-medium text-[var(--text-secondary)] mb-2 flex items-center gap-2">
              <TrendingUp size={14} className="text-[var(--success)]" /> Qualified Pipeline
            </div>
            <div className="text-3xl font-semibold text-[var(--text-primary)] tracking-tight">
              {loading ? '—' : (stats?.qualified ?? 0)}
            </div>
          </div>
          <div className="surface-panel p-5">
            <div className="text-[13px] font-medium text-[var(--text-secondary)] mb-2 flex items-center gap-2">
              <CheckCircle size={14} className="text-[var(--accent-primary)]" /> Approved for Outreach
            </div>
            <div className="text-3xl font-semibold text-[var(--text-primary)] tracking-tight">
              {loading ? '—' : (stats?.approved ?? 0)}
            </div>
          </div>
          <div className="surface-panel p-5">
            <div className="text-[13px] font-medium text-[var(--text-secondary)] mb-2 flex items-center gap-2">
              <Calendar size={14} className="text-[var(--warning)]" /> Meetings Booked
            </div>
            <div className="text-3xl font-semibold text-[var(--text-primary)] tracking-tight">
              {loading ? '—' : (stats?.meetings ?? 0)}
            </div>
          </div>
        </div>

        {/* Secondary KPIs */}
        <div className="flex flex-wrap gap-2">
          <div className="badge badge-neutral gap-2 py-1.5 px-3">
            <Star size={12} className="text-[var(--warning)]" />
            <span>Excellent: <strong className="text-[var(--text-primary)] ml-1">{loading ? '-' : (stats?.excellent ?? 0)}</strong></span>
          </div>
          <div className="badge badge-neutral gap-2 py-1.5 px-3">
            <Mail size={12} className="text-[var(--info)]" />
            <span>Contacted: <strong className="text-[var(--text-primary)] ml-1">{loading ? '-' : (stats?.contacted ?? 0)}</strong></span>
          </div>
          <div className="badge badge-neutral gap-2 py-1.5 px-3">
            <MessageCircle size={12} className="text-[var(--success)]" />
            <span>Replied: <strong className="text-[var(--text-primary)] ml-1">{loading ? '-' : (stats?.replied ?? 0)}</strong></span>
          </div>
          <div className="badge badge-neutral gap-2 py-1.5 px-3">
            <XCircle size={12} className="text-[var(--danger)]" />
            <span>Rejected: <strong className="text-[var(--text-primary)] ml-1">{loading ? '-' : (stats?.rejected ?? 0)}</strong></span>
          </div>
        </div>
      </div>

      {/* SECTION 2: MAIN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Recent Leads */}
        <div className="lg:col-span-2 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs-bold">Recent High-Quality Leads</h2>
            <Link href="/leads" className="text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors">
              View pipeline <ChevronRight size={14} />
            </Link>
          </div>
          
          <div className="surface-panel flex-1 flex flex-col overflow-hidden">
            {loading ? (
              <div className="flex-1 flex items-center justify-center p-12 text-[13px] text-[var(--text-muted)]">
                Syncing pipeline data...
              </div>
            ) : recentLeads.length === 0 ? (
              /* PREMIUM EMPTY STATE */
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--bg-tertiary)] border border-[var(--border-strong)] mb-5">
                  <Database size={20} className="text-[var(--text-secondary)]" />
                </div>
                <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">No leads discovered yet</h3>
                <p className="text-[13px] text-[var(--text-secondary)] mb-8 leading-relaxed">
                  Connect your first source or manually add a lead to start building your BD pipeline.
                </p>
                
                <div className="w-full surface-flat p-5 text-left mb-8 border border-[var(--border-subtle)]">
                  <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-4">Setup Checklist</div>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full border border-[var(--border-strong)] flex items-center justify-center shrink-0 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] opacity-50" />
                      </div>
                      <span className="text-[13px] text-[var(--text-primary)] font-medium">Add your first target source</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full border border-[var(--border-strong)] flex items-center justify-center shrink-0 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] opacity-50" />
                      </div>
                      <span className="text-[13px] text-[var(--text-secondary)]">Import or add your first lead</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full border border-[var(--border-strong)] flex items-center justify-center shrink-0 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] opacity-50" />
                      </div>
                      <span className="text-[13px] text-[var(--text-secondary)]">Approve leads to train the agent</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 w-full">
                  <Link href="/sources" className="btn btn-secondary flex-1 justify-center">
                    Add Source
                  </Link>
                  <Link href="/leads/new" className="btn btn-primary flex-1 justify-center">
                    Add Lead
                  </Link>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {recentLeads.map(lead => (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[14px] font-medium text-[var(--text-primary)] truncate">{lead.company_name}</span>
                        {lead.priority === 'excellent' && (
                          <Star size={12} className="text-[var(--warning)] fill-[var(--warning)] shrink-0" />
                        )}
                        {lead.status === 'new' && (
                          <span className="badge badge-info px-1.5 py-0 text-[10px]">New</span>
                        )}
                      </div>
                      <div className="text-[13px] text-[var(--text-secondary)] truncate">
                        {lead.industry_category || 'Uncategorized'} <span className="text-[var(--text-muted)] mx-1.5">•</span> {lead.product_to_sell || 'No product set'}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {lead.lead_score != null && (
                        <div className="text-[13px] font-medium text-[var(--text-primary)] tabular-nums">
                          {lead.lead_score}/100
                        </div>
                      )}
                      <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Intelligence Rail */}
        <div className="space-y-6">
          <h2 className="text-xs-bold mb-4">Intelligence</h2>
          
          {/* Agent Module */}
          <div className="surface-panel p-5">
            <div className="flex items-center gap-2 mb-3">
              <BrainCircuit size={16} className="text-[var(--accent-primary)]" />
              <span className="text-[13px] font-medium text-[var(--text-primary)]">Agent Status</span>
            </div>
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-4">
              Monitoring active sources. Cross-referencing firmographic data against ideal customer profiles.
            </p>
            <Link href="/reports" className="text-[13px] font-medium text-[var(--text-primary)] hover:underline flex items-center gap-1 w-max">
              View learning report <ArrowRight size={12} className="text-[var(--text-muted)]" />
            </Link>
          </div>

          {/* Breakdown Module */}
          <div className="surface-panel p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target size={16} className="text-[var(--text-muted)]" />
              <span className="text-[13px] font-medium text-[var(--text-primary)]">Product Angles</span>
            </div>
            <div className="space-y-3">
              {productStats.length === 0 ? (
                <div className="text-[13px] text-[var(--text-muted)]">No pipeline data yet.</div>
              ) : productStats.map(({ category, count }) => {
                const max = productStats[0]?.count || 1
                return (
                  <div key={category}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] text-[var(--text-secondary)] truncate mr-3">{category}</span>
                      <span className="text-[13px] font-medium text-[var(--text-primary)] tabular-nums">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--text-secondary)]"
                        style={{ width: `${(count / max) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick Actions Module */}
          <div className="surface-panel p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={16} className="text-[var(--text-muted)]" />
              <span className="text-[13px] font-medium text-[var(--text-primary)]">Quick Actions</span>
            </div>
            <div className="space-y-2">
              <Link href="/leads/new" className="flex items-center gap-2 p-2 -mx-2 rounded-md hover:bg-[rgba(255,255,255,0.03)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                <Plus size={14} className="text-[var(--text-muted)]" /> Inject Lead
              </Link>
              <Link href="/outreach" className="flex items-center gap-2 p-2 -mx-2 rounded-md hover:bg-[rgba(255,255,255,0.03)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                <MessageCircle size={14} className="text-[var(--text-muted)]" /> Generate Outreach
              </Link>
              <Link href="/settings" className="flex items-center gap-2 p-2 -mx-2 rounded-md hover:bg-[rgba(255,255,255,0.03)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                <Users size={14} className="text-[var(--text-muted)]" /> Manage Sources
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
