'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  Database,
  FileText,
  Inbox,
  Mail,
  MessageCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, getScoreBg } from '@/lib/utils'
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

const primaryMetrics = [
  { key: 'new_leads', label: 'New Leads Today', icon: Inbox, tone: 'text-[var(--info)]' },
  { key: 'qualified', label: 'Qualified Pipeline', icon: TrendingUp, tone: 'text-[var(--success)]' },
  { key: 'approved', label: 'Approved for Outreach', icon: CheckCircle, tone: 'text-[var(--accent-primary)]' },
  { key: 'meetings', label: 'Meetings Booked', icon: Calendar, tone: 'text-[var(--warning)]' },
] as const

const secondaryMetrics = [
  { key: 'excellent', label: 'Excellent Leads', icon: Star },
  { key: 'contacted', label: 'Contacted', icon: Mail },
  { key: 'replied', label: 'Replied', icon: MessageCircle },
  { key: 'rejected', label: 'Rejected', icon: XCircle },
] as const

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const topCategory = categoryStats[0]?.category || 'No category signal yet'
  const topProduct = productStats[0]?.category || 'No product angle yet'
  const pipelineReadiness = stats?.total ? Math.round(((stats.high_score + stats.approved + stats.meetings) / (stats.total * 3)) * 100) : 0

  const recommendedFocus = useMemo(() => {
    if (!stats?.total) return 'Start by adding one source and one manually qualified lead so the agent has a clean seed pattern.'
    if ((stats.needs_review || 0) > (stats.approved || 0)) return 'Review new and researching leads first; approvals will sharpen the agent faster than adding more volume.'
    if ((stats.approved || 0) > (stats.contacted || 0)) return 'Move approved accounts into outreach while the qualification context is still fresh.'
    return 'Study replies and meetings to identify the source and product angles worth doubling down on next week.'
  }, [stats])

  return (
    <div className="page-container">
      <header className="mb-12 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-white/[0.025] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)]">
            <span className="status-dot active" />
            Agent Active
          </div>
          <h1 className="text-[34px] font-semibold tracking-tight text-[var(--text-primary)] md:text-[42px]">
            BD Command Center
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[var(--text-secondary)]">
            AI-powered lead intelligence for Kima/Aeredium, organized for daily pipeline review, source learning, and operator decisions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={loadData} className="btn btn-secondary">
            <RefreshCw size={14} className={loading ? 'animate-spin text-[var(--text-muted)]' : 'text-[var(--text-muted)]'} />
            Refresh
          </button>
          <Link href="/sources" className="btn btn-secondary">
            <Database size={14} />
            Add Source
          </Link>
          <Link href="/leads/new" className="btn btn-primary">
            <Plus size={14} />
            Add Lead
          </Link>
        </div>
      </header>

      <section className="surface-elevated mb-12 p-6 md:p-7">
        <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs-bold mb-3">Pipeline Snapshot</p>
            <h2 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">Today&apos;s operating picture</h2>
          </div>
          <div className="w-max rounded-full bg-[var(--accent-primary-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--accent-primary)]">
            {loading ? 'Syncing' : `${stats?.total ?? 0} total leads`}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[310px_minmax(0,1fr)]">
          <div className="surface-flat p-5">
            <div className="mb-5 text-[13px] leading-6 text-[var(--text-secondary)]">
              A compact read on pipeline health before moving into lead review.
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-[26px] font-semibold tabular-nums text-[var(--text-primary)]">{loading ? '-' : stats?.needs_review ?? 0}</div>
                <div className="mt-1 text-[12px] text-[var(--text-muted)]">Needs review</div>
              </div>
              <div>
                <div className="text-[26px] font-semibold tabular-nums text-[var(--text-primary)]">{loading ? '-' : stats?.high_score ?? 0}</div>
                <div className="mt-1 text-[12px] text-[var(--text-muted)]">Score 70+</div>
              </div>
              <div>
                <div className="text-[26px] font-semibold tabular-nums text-[var(--text-primary)]">{loading ? '-' : `${pipelineReadiness}%`}</div>
                <div className="mt-1 text-[12px] text-[var(--text-muted)]">Readiness</div>
              </div>
            </div>
          </div>

          <div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {primaryMetrics.map(({ key, label, icon: Icon, tone }) => (
                <div key={key} className="rounded-2xl bg-white/[0.025] p-5">
                  <Icon size={16} className={tone} />
                  <div className="mt-6 text-[34px] font-semibold tracking-tight tabular-nums text-[var(--text-primary)]">
                    {loading ? '-' : stats?.[key] ?? 0}
                  </div>
                  <div className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">{label}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-4">
              {secondaryMetrics.map(({ key, label, icon: Icon }) => (
                <div key={key} className="inline-flex items-center gap-2 rounded-full bg-white/[0.025] px-3.5 py-2 text-[12px] text-[var(--text-secondary)]">
                  <Icon size={13} className="text-[var(--text-muted)]" />
                  <span>{label}</span>
                  <strong className="font-semibold tabular-nums text-[var(--text-primary)]">{loading ? '-' : stats?.[key] ?? 0}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12 grid grid-cols-1 gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-h-[620px]">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs-bold mb-2">Main Workspace</p>
              <h2 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">Recent High-Quality Leads</h2>
            </div>
            <Link href="/leads" className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
              View pipeline
              <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="surface-elevated min-h-[560px] overflow-hidden">
            {loading ? (
              <div className="flex min-h-[560px] items-center justify-center text-[13px] text-[var(--text-muted)]">
                Syncing pipeline data...
              </div>
            ) : recentLeads.length === 0 ? (
              <div className="grid min-h-[560px] place-items-center px-6 py-14">
                <div className="w-full max-w-2xl text-center">
                  <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-white/[0.035]">
                    <Sparkles size={24} className="text-[var(--accent-primary)]" />
                  </div>
                  <h3 className="text-[24px] font-semibold tracking-tight text-[var(--text-primary)]">No leads discovered yet</h3>
                  <p className="mx-auto mt-3 max-w-md text-[14px] leading-6 text-[var(--text-secondary)]">
                    Connect your first source or manually add a lead to start building your BD pipeline.
                  </p>

                  <div className="mx-auto mt-9 grid max-w-xl gap-3 text-left sm:grid-cols-2">
                    {[
                      'Add your first source',
                      'Import or add your first lead',
                      'Generate outreach',
                      'Approve/reject leads to train the agent',
                    ].map((item, index) => (
                      <div key={item} className="flex min-h-[72px] items-start gap-3 rounded-xl bg-white/[0.035] p-4">
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-soft)] text-[11px] font-semibold text-[var(--text-secondary)]">
                          {index + 1}
                        </div>
                        <span className="text-[13px] leading-5 text-[var(--text-secondary)]">{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                    <Link href="/sources" className="btn btn-secondary justify-center px-5">
                      <Database size={14} />
                      Add Source
                    </Link>
                    <Link href="/leads/new" className="btn btn-primary justify-center px-5">
                      <Plus size={14} />
                      Add Lead Manually
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3">
                {recentLeads.map((lead, index) => (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="group grid gap-4 rounded-2xl px-4 py-4 transition-colors hover:bg-white/[0.035] md:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-medium text-[var(--text-primary)]">{lead.company_name}</span>
                        {lead.priority === 'excellent' && (
                          <span className="badge badge-warning">
                            <Star size={11} />
                            Excellent
                          </span>
                        )}
                        {lead.status === 'new' && <span className="badge badge-info">New</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--text-secondary)]">
                        <span>{lead.industry_category || 'Uncategorized'}</span>
                        <span className="text-[var(--text-muted)]">/</span>
                        <span>{lead.product_to_sell || 'Product angle not set'}</span>
                      </div>
                      {(lead.pain_point || lead.trigger_reason) && (
                        <p className="mt-3 line-clamp-2 max-w-2xl text-[13px] leading-6 text-[var(--text-muted)]">
                          {lead.pain_point || lead.trigger_reason}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-5 md:justify-end">
                      <div className="text-right">
                        <div className={cn('inline-flex rounded-full border px-2.5 py-1 text-[12px] font-medium tabular-nums', getScoreBg(lead.lead_score || 0))}>
                          {lead.lead_score ?? '-'} / 100
                        </div>
                        <div className="mt-2 text-[12px] text-[var(--text-muted)]">{index === 0 ? 'Latest' : formatDate(lead.created_at)}</div>
                      </div>
                      <ChevronRight size={16} className="text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-primary)]" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <div>
            <p className="text-xs-bold mb-2">Intelligence Rail</p>
            <h2 className="text-[18px] font-semibold tracking-tight text-[var(--text-primary)]">Agent briefing</h2>
          </div>

          <div className="surface-panel p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BrainCircuit size={16} className="text-[var(--accent-primary)]" />
                <span className="text-[14px] font-medium text-[var(--text-primary)]">Agent Intelligence</span>
              </div>
              <span className="badge badge-success">Live</span>
            </div>
            <p className="text-[13px] leading-6 text-[var(--text-secondary)]">
              Monitoring active sources and comparing new accounts against Kima/Aeredium fit signals.
            </p>
            <div className="mt-5 rounded-xl bg-white/[0.025] p-4">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Latest insight</div>
              <p className="text-[13px] leading-5 text-[var(--text-secondary)]">{recommendedFocus}</p>
            </div>
            <Link href="/reports" className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-primary)]">
              Weekly learning report <ArrowRight size={13} className="text-[var(--text-muted)]" />
            </Link>
          </div>

          <div className="surface-panel p-5">
            <div className="mb-5 flex items-center gap-2">
              <BarChart3 size={16} className="text-[var(--text-muted)]" />
              <span className="text-[14px] font-medium text-[var(--text-primary)]">Pipeline Breakdown</span>
            </div>
            <BreakdownList title="Sales categories" items={categoryStats.slice(0, 4)} empty="No sales category data yet." />
            <div className="my-5 h-px bg-[var(--border-subtle)]" />
            <BreakdownList title="Product angles" items={productStats.slice(0, 4)} empty="No product angle data yet." />
          </div>

          <div className="surface-panel p-5">
            <div className="mb-4 flex items-center gap-2">
              <Zap size={16} className="text-[var(--text-muted)]" />
              <span className="text-[14px] font-medium text-[var(--text-primary)]">Quick Actions</span>
            </div>
            <div className="grid gap-2">
              <QuickAction href="/leads/new" icon={Plus} label="Add Lead" />
              <QuickAction href="/sources" icon={Database} label="Add Source" />
              <QuickAction href="/outreach" icon={MessageCircle} label="Generate Outreach" />
              <QuickAction href="/reports" icon={FileText} label="View Report" />
            </div>
          </div>
        </aside>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <LearningCard
          icon={BrainCircuit}
          label="Weekly Learning Preview"
          title="Agent memory is shaped by approvals"
          body={`${stats?.approved ?? 0} approved, ${stats?.rejected ?? 0} rejected, and ${stats?.replied ?? 0} replied leads are currently informing future recommendations.`}
          href="/feedback"
          cta="Review memory"
        />
        <LearningCard
          icon={Target}
          label="Best Sources"
          title={topCategory}
          body="Use the category signal as a source quality proxy until the weekly report has enough data to rank specific channels."
          href="/sources"
          cta="Manage sources"
        />
        <LearningCard
          icon={Clock}
          label="Recommended Focus"
          title={topProduct}
          body={recommendedFocus}
          href="/reports"
          cta="Open report"
        />
      </section>
    </div>
  )
}

function BreakdownList({ title, items, empty }: { title: string; items: CategoryStat[]; empty: string }) {
  const max = items[0]?.count || 1

  return (
    <div>
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{title}</div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-[13px] text-[var(--text-muted)]">{empty}</div>
        ) : items.map(({ category, count }) => (
          <div key={category}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="truncate text-[13px] text-[var(--text-secondary)]">{category}</span>
              <span className="text-[12px] font-medium tabular-nums text-[var(--text-primary)]">{count}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
              <div className="h-full rounded-full bg-[var(--text-secondary)]" style={{ width: `${(count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link href={href} className="group flex items-center justify-between rounded-xl bg-white/[0.025] px-3 py-3 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-white/[0.045] hover:text-[var(--text-primary)]">
      <span className="flex items-center gap-2">
        <Icon size={14} className="text-[var(--text-muted)]" />
        {label}
      </span>
      <ChevronRight size={14} className="text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

function LearningCard({
  icon: Icon,
  label,
  title,
  body,
  href,
  cta,
}: {
  icon: React.ElementType
  label: string
  title: string
  body: string
  href: string
  cta: string
}) {
  return (
    <div className="surface-panel p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.035]">
          <Icon size={16} className="text-[var(--text-secondary)]" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{label}</span>
      </div>
      <h3 className="text-[15px] font-semibold leading-6 text-[var(--text-primary)]">{title}</h3>
      <p className="mt-3 min-h-[68px] text-[13px] leading-6 text-[var(--text-secondary)]">{body}</p>
      <Link href={href} className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-primary)]">
        {cta} <ArrowRight size={13} className="text-[var(--text-muted)]" />
      </Link>
    </div>
  )
}
