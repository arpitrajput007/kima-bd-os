'use client'

import { useEffect, useMemo, useState, type ElementType, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  FileText,
  Inbox,
  Mail,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, getScoreBg, getStatusLabel } from '@/lib/utils'
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
  { key: 'new_leads', label: 'New Leads Today', icon: Inbox },
  { key: 'qualified', label: 'Qualified Pipeline', icon: TrendingUp },
  { key: 'approved', label: 'Approved for Outreach', icon: CheckCircle2 },
  { key: 'meetings', label: 'Meetings Booked', icon: Calendar },
] as const

const secondaryMetrics = [
  { key: 'excellent', label: 'Excellent Leads', icon: Star },
  { key: 'rejected', label: 'Rejected', icon: XCircle },
  { key: 'contacted', label: 'Contacted', icon: Mail },
  { key: 'replied', label: 'Replied', icon: MessageCircle },
] as const

const firstSourceIdeas = [
  'LayerZero customer search',
  'Hacked protocol monitoring',
  'Web2 stablecoin settlement prospects',
  'On/off-ramp prospects',
  'Fireblocks customer research',
]

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
    if (!stats?.total) return 'Start with one high-signal source and one manually qualified lead so the agent has a clean seed pattern.'
    if ((stats.needs_review || 0) > (stats.approved || 0)) return 'Clear the review queue first. Approvals and rejections will teach the agent faster than more lead volume.'
    if ((stats.approved || 0) > (stats.contacted || 0)) return 'Move approved accounts into outreach while the qualification context is still fresh.'
    return 'Study replies and booked meetings to identify which source and product angles deserve more focus.'
  }, [stats])

  return (
    <div className="page-container">
      <CommandHeader loading={loading} onRefresh={loadData} />

      <PipelineSnapshot stats={stats} loading={loading} pipelineReadiness={pipelineReadiness} />

      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_352px]">
        <LeadWorkspace loading={loading} recentLeads={recentLeads} />
        <IntelligenceRail
          categoryStats={categoryStats}
          productStats={productStats}
          recommendedFocus={recommendedFocus}
        />
      </section>

      <LearningRecommendations
        stats={stats}
        topCategory={topCategory}
        topProduct={topProduct}
        recommendedFocus={recommendedFocus}
      />
    </div>
  )
}

function CommandHeader({ loading, onRefresh }: { loading: boolean; onRefresh: () => void }) {
  return (
    <header className="mb-16">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <StatusBadge label="Agent Active" />
          <h1 className="mt-5 text-[38px] font-semibold leading-[1.02] tracking-tight text-[var(--text-primary)] md:text-[46px]">
            BD Command Center
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-7 text-[var(--text-secondary)]">
            AI-powered lead intelligence for Kima/Aeredium.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={onRefresh} className="btn btn-secondary h-10 px-4">
            <RefreshCw size={15} className={cn('text-[var(--text-muted)]', loading && 'animate-spin')} />
            Refresh
          </button>
          <Link href="/sources" className="btn btn-secondary h-10 px-4">
            <Database size={15} />
            Add Source
          </Link>
          <Link href="/leads/new" className="btn btn-primary h-10 px-4">
            <Plus size={15} />
            Add Lead
          </Link>
        </div>
      </div>
    </header>
  )
}

function PipelineSnapshot({
  stats,
  loading,
  pipelineReadiness,
}: {
  stats: DashboardStats | null
  loading: boolean
  pipelineReadiness: number
}) {
  return (
    <section className="dashboard-card overflow-hidden p-7 md:p-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <SectionEyebrow>Pipeline Snapshot</SectionEyebrow>
          <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">
            Executive summary for today
          </h2>
        </div>
        <div className="rounded-full bg-white/[0.045] px-3.5 py-2 text-[13px] font-medium text-[var(--text-secondary)]">
          {loading ? 'Syncing pipeline' : `${stats?.total ?? 0} leads tracked`}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_292px]">
        <div className="grid gap-0 rounded-3xl bg-white/[0.018] sm:grid-cols-2 xl:grid-cols-4">
          {primaryMetrics.map((metric, index) => (
            <MetricCell
              key={metric.key}
              icon={metric.icon}
              label={metric.label}
              value={loading ? '-' : stats?.[metric.key] ?? 0}
              divided={index > 0}
            />
          ))}
        </div>

        <div className="rounded-3xl bg-white/[0.035] p-5 ring-1 ring-white/[0.045]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-medium text-[var(--text-secondary)]">Pipeline readiness</div>
              <div className="mt-2 text-[36px] font-semibold tracking-tight text-[var(--text-primary)]">
                {loading ? '-' : `${pipelineReadiness}%`}
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)]">
              <ShieldCheck size={19} />
            </div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.05]">
            <div className="h-full rounded-full bg-[var(--accent-primary)]" style={{ width: `${loading ? 0 : pipelineReadiness}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <MiniStat label="Needs review" value={loading ? '-' : stats?.needs_review ?? 0} />
            <MiniStat label="Score 70+" value={loading ? '-' : stats?.high_score ?? 0} />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {secondaryMetrics.map(({ key, label, icon: Icon }) => (
          <div key={key} className="inline-flex items-center gap-2 rounded-full bg-white/[0.035] px-3.5 py-2 text-[13px] text-[var(--text-secondary)] ring-1 ring-white/[0.035]">
            <Icon size={14} className="text-[var(--text-muted)]" />
            <span>{label}</span>
            <strong className="font-semibold tabular-nums text-[var(--text-primary)]">{loading ? '-' : stats?.[key] ?? 0}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

function LeadWorkspace({ loading, recentLeads }: { loading: boolean; recentLeads: Lead[] }) {
  return (
    <section className="dashboard-card min-h-[650px] p-5 md:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[24px] font-semibold tracking-tight text-[var(--text-primary)]">
            Recent High-Quality Leads
          </h2>
          <p className="mt-2 text-[14px] text-[var(--text-secondary)]">Review the accounts most likely to convert into useful BD motion.</p>
        </div>
        <Link href="/leads" className="group mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/[0.035] px-3.5 py-2 text-[13px] font-medium text-[var(--text-secondary)] transition hover:bg-white/[0.06] hover:text-[var(--text-primary)]">
          View pipeline
          <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {loading ? (
        <div className="grid min-h-[550px] place-items-center text-[14px] text-[var(--text-muted)]">
          Syncing pipeline data...
        </div>
      ) : recentLeads.length === 0 ? (
        <EmptyLeadState />
      ) : (
        <div className="space-y-3">
          {recentLeads.map(lead => (
            <LeadRow key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </section>
  )
}

function EmptyLeadState() {
  return (
    <div className="grid min-h-[550px] place-items-center rounded-[26px] bg-[radial-gradient(circle_at_top,rgba(145,130,255,0.075),transparent_42%),rgba(255,255,255,0.028)] px-5 py-10">
      <div className="w-full max-w-3xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/[0.055] text-[var(--accent-primary)] shadow-[0_18px_60px_rgba(0,0,0,0.22)] ring-1 ring-white/[0.08]">
          <Sparkles size={25} />
        </div>
        <h3 className="mt-7 text-[28px] font-semibold tracking-tight text-[var(--text-primary)]">No leads discovered yet</h3>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-7 text-[var(--text-secondary)]">
          Connect your first source or manually add a lead to start building your BD pipeline.
        </p>

        <div className="mx-auto mt-8 grid max-w-2xl gap-x-8 gap-y-4 text-left sm:grid-cols-2">
          {[
            'Add your first source',
            'Import or add your first lead',
            'Generate outreach',
            'Approve/reject leads to train the agent',
          ].map((item, index) => (
            <div key={item} className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.055] text-[12px] font-semibold text-[var(--text-secondary)] ring-1 ring-white/[0.06]">
                {index + 1}
              </div>
              <span className="pt-1 text-[14px] leading-5 text-[var(--text-secondary)]">{item}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/sources" className="btn btn-secondary h-11 justify-center px-5">
            <Database size={15} />
            Add Source
          </Link>
          <Link href="/leads/new" className="btn btn-primary h-11 justify-center px-5">
            <Plus size={15} />
            Add Lead Manually
          </Link>
        </div>

        <div className="mx-auto mt-8 max-w-2xl rounded-2xl bg-white/[0.035] p-4 text-left ring-1 ring-white/[0.05]">
          <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-[var(--text-primary)]">
            <Search size={14} className="text-[var(--accent-primary)]" />
            Suggested first sources
          </div>
          <div className="flex flex-wrap gap-2">
            {firstSourceIdeas.map(source => (
              <span key={source} className="rounded-full bg-white/[0.04] px-3 py-1.5 text-[12px] text-[var(--text-secondary)]">
                {source}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function LeadRow({ lead }: { lead: Lead }) {
  const categories = lead.customer_category?.slice(0, 2).join(', ') || 'No sales category'

  return (
    <Link href={`/leads/${lead.id}`} className="group block rounded-3xl bg-white/[0.026] p-5 ring-1 ring-white/[0.045] transition hover:bg-white/[0.045] hover:ring-white/[0.075]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">{lead.company_name}</h3>
            <span className="badge badge-neutral">{getStatusLabel(lead.status)}</span>
            {lead.priority === 'excellent' && <span className="badge badge-warning"><Star size={11} />Excellent</span>}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-[var(--text-secondary)]">
            <span>{lead.industry_category || 'Uncategorized'}</span>
            <span className="text-[var(--text-muted)]">/</span>
            <span>{categories}</span>
            <span className="text-[var(--text-muted)]">/</span>
            <span>{lead.product_to_sell || 'Product angle not set'}</span>
          </div>
          <p className="mt-4 line-clamp-2 max-w-3xl text-[14px] leading-6 text-[var(--text-muted)]">
            {lead.pain_point || lead.trigger_reason || lead.description || 'No pain point preview yet. Add more research context to sharpen qualification.'}
          </p>
        </div>

        <div className="grid min-w-[220px] grid-cols-2 gap-3 lg:text-right">
          <div>
            <div className={cn('inline-flex rounded-full border px-2.5 py-1 text-[12px] font-medium tabular-nums', getScoreBg(lead.lead_score || 0))}>
              {lead.lead_score ?? '-'} / 100
            </div>
            <div className="mt-2 text-[12px] text-[var(--text-muted)]">Lead score</div>
          </div>
          <div>
            <div className="text-[13px] font-medium tabular-nums text-[var(--text-primary)]">
              {lead.confidence_score != null ? `${lead.confidence_score}%` : '-'}
            </div>
            <div className="mt-2 text-[12px] text-[var(--text-muted)]">Confidence</div>
          </div>
          <div className="col-span-2 flex items-center justify-between rounded-2xl bg-white/[0.035] px-3 py-2 text-[13px] text-[var(--text-secondary)] lg:justify-end lg:gap-2">
            <span>{getNextAction(lead)}</span>
            <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </Link>
  )
}

function IntelligenceRail({
  categoryStats,
  productStats,
  recommendedFocus,
}: {
  categoryStats: CategoryStat[]
  productStats: CategoryStat[]
  recommendedFocus: string
}) {
  return (
    <aside className="space-y-4">
      <SectionCard icon={BrainCircuit} title="Agent Briefing" badge="Live">
        <p className="text-[14px] leading-6 text-[var(--text-secondary)]">
          Monitoring active sources, scoring fit, and preparing the pipeline for review.
        </p>
        <div className="mt-5 rounded-2xl bg-white/[0.035] p-4">
          <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">Latest insight</div>
          <p className="text-[13px] leading-5 text-[var(--text-secondary)]">{recommendedFocus}</p>
        </div>
        <Link href="/reports" className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-primary)]">
          Weekly report <ArrowRight size={13} className="text-[var(--text-muted)]" />
        </Link>
      </SectionCard>

      <SectionCard icon={BarChart3} title="Pipeline Breakdown">
        <BreakdownList title="Sales category breakdown" items={categoryStats.slice(0, 4)} empty="Add or approve leads to reveal sales category patterns." />
        <div className="my-5 h-px bg-white/[0.055]" />
        <BreakdownList title="Product angle breakdown" items={productStats.slice(0, 4)} empty="Product angle data will appear once leads are qualified." />
      </SectionCard>

      <SectionCard icon={Zap} title="Quick Actions">
        <div className="space-y-2">
          <QuickAction href="/leads/new" icon={Plus} label="Add Lead" />
          <QuickAction href="/sources" icon={Database} label="Add Source" />
          <QuickAction href="/outreach" icon={MessageCircle} label="Generate Outreach" />
          <QuickAction href="/reports" icon={FileText} label="View Report" />
        </div>
      </SectionCard>
    </aside>
  )
}

function LearningRecommendations({
  stats,
  topCategory,
  topProduct,
  recommendedFocus,
}: {
  stats: DashboardStats | null
  topCategory: string
  topProduct: string
  recommendedFocus: string
}) {
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <SectionEyebrow>Learning & Recommendations</SectionEyebrow>
          <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">What the agent should learn next</h2>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <LearningCard
          icon={BrainCircuit}
          label="Weekly Learning Preview"
          title="Agent memory is shaped by decisions"
          body={`${stats?.approved ?? 0} approved, ${stats?.rejected ?? 0} rejected, and ${stats?.replied ?? 0} replied leads are currently informing future recommendations.`}
          href="/feedback"
          cta="Review memory"
        />
        <LearningCard
          icon={Target}
          label="Best Sources"
          title={topCategory}
          body="Use category signal as an early source quality proxy until weekly reports can rank specific acquisition channels."
          href="/sources"
          cta="Manage sources"
        />
        <LearningCard
          icon={Clock3}
          label="Recommended Focus"
          title={topProduct}
          body={recommendedFocus}
          href="/reports"
          cta="Open report"
        />
      </div>
    </section>
  )
}

function MetricCell({
  icon: Icon,
  label,
  value,
  divided,
}: {
  icon: ElementType
  label: string
  value: number | string
  divided?: boolean
}) {
  return (
    <div className={cn('min-h-[142px] p-5', divided && 'sm:border-l sm:border-white/[0.055]')}>
      <div className="mb-6 flex h-9 w-9 items-center justify-center rounded-2xl bg-white/[0.04] text-[var(--accent-primary)]">
        <Icon size={17} />
      </div>
      <div className="text-[38px] font-semibold leading-none tracking-tight text-[var(--text-primary)]">{value}</div>
      <div className="mt-3 text-[13px] leading-5 text-[var(--text-secondary)]">{label}</div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-white/[0.035] px-3 py-2">
      <div className="text-[15px] font-semibold text-[var(--text-primary)]">{value}</div>
      <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{label}</div>
    </div>
  )
}

function SectionCard({
  icon: Icon,
  title,
  badge,
  children,
}: {
  icon: ElementType
  title: string
  badge?: string
  children: ReactNode
}) {
  return (
    <div className="dashboard-card p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.04] text-[var(--text-secondary)]">
            <Icon size={15} />
          </div>
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</h3>
        </div>
        {badge && <span className="badge badge-success">{badge}</span>}
      </div>
      {children}
    </div>
  )
}

function BreakdownList({ title, items, empty }: { title: string; items: CategoryStat[]; empty: string }) {
  const max = items[0]?.count || 1

  return (
    <div>
      <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">{title}</div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl bg-white/[0.025] p-3 text-[13px] leading-5 text-[var(--text-muted)]">{empty}</div>
        ) : items.map(({ category, count }) => (
          <div key={category}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="truncate text-[13px] text-[var(--text-secondary)]">{category}</span>
              <span className="text-[12px] font-medium tabular-nums text-[var(--text-primary)]">{count}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
              <div className="h-full rounded-full bg-[var(--text-secondary)]" style={{ width: `${(count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: ElementType; label: string }) {
  return (
    <Link href={href} className="group flex items-center justify-between rounded-2xl bg-white/[0.032] px-3.5 py-3 text-[13px] font-medium text-[var(--text-secondary)] transition hover:bg-white/[0.06] hover:text-[var(--text-primary)]">
      <span className="flex items-center gap-2.5">
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
  icon: ElementType
  label: string
  title: string
  body: string
  href: string
  cta: string
}) {
  return (
    <div className="dashboard-card p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.04] text-[var(--text-secondary)]">
          <Icon size={17} />
        </div>
        <span className="text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">{label}</span>
      </div>
      <h3 className="text-[16px] font-semibold leading-6 text-[var(--text-primary)]">{title}</h3>
      <p className="mt-3 min-h-[76px] text-[14px] leading-6 text-[var(--text-secondary)]">{body}</p>
      <Link href={href} className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-primary)]">
        {cta} <ArrowRight size={13} className="text-[var(--text-muted)]" />
      </Link>
    </div>
  )
}

function StatusBadge({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-[var(--success-subtle)] px-3 py-1.5 text-[13px] font-medium text-[var(--success)] ring-1 ring-emerald-300/10">
      <span className="status-dot active" />
      {label}
    </div>
  )
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
      {children}
    </div>
  )
}

function getNextAction(lead: Lead) {
  if (lead.status === 'approved') return 'Generate outreach'
  if (lead.status === 'qualified') return 'Approve for outreach'
  if (lead.status === 'new' || lead.status === 'researching') return 'Review qualification'
  if (lead.status === 'contacted') return 'Track reply'
  if (lead.status === 'replied') return 'Book meeting'
  if (lead.status === 'meeting_booked') return 'Prepare brief'
  return formatDate(lead.created_at)
}
