'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Plus, Search, Download, FileText, TrendingUp, Users,
  Trophy, XCircle, Calendar, BarChart2, Loader2, RefreshCw,
  Building2, ChevronDown, AlertCircle, Send, Reply, Sparkles,
  Zap, Settings2, Target, DollarSign,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  DEAL_STATUSES, OUTREACH_CHANNELS, LEAD_TYPES,
  dealStatusMeta, fmtMonthYear, fmtMonthShort, currentMonthYear, last12Months,
  blockerLabel,
} from '@/lib/monthly-reports-types'
import type { MonthlyDeal, DealActivity, TimeAllocation } from '@/lib/monthly-reports-types'
import { getOutreachStats, EMPTY_OUTREACH_STATS } from '@/lib/monthly-outreach-stats'
import type { OutreachStats } from '@/lib/monthly-outreach-stats'
import { KpiCard, MiniBar, SectionHeader } from '@/components/monthly-reports/ui'
import { TimeAllocationSection, timeByCompany, TIME_PIE_COLORS } from '@/components/monthly-reports/time-allocation-section'

// PostgREST reports a missing table as code PGRST205 ("Could not find the
// table ... in the schema cache"), not a "does not exist" message.
function isMissingTableError(error?: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === 'PGRST205' || !!error.message?.includes('schema cache')
}

// ── Export helpers ─────────────────────────────────────────────

function toCSV(rows: Record<string, string | number>[]) {
  if (!rows.length) return ''
  const h = Object.keys(rows[0]).map(k => `"${k}"`).join(',')
  const b = rows.map(r => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
  return [h, ...b].join('\n')
}

function dlFile(content: string, name: string, type: string) {
  const blob = new Blob([content], { type })
  const url  = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function exportCSV(deals: MonthlyDeal[], month: string) {
  const rows = deals.map(d => {
    const pf = d.product_feedback || {}
    const openBlockers = (d.blockers || []).filter(b => !b.resolved)
    return {
      Company: d.company_name,
      Individual: d.individual_name ?? '',
      Designation: d.designation ?? '',
      Country: d.country ?? '',
      Industry: d.industry ?? '',
      'Lead Type': d.lead_type ?? '',
      Status: d.status.replace(/_/g, ' '),
      'Requirement': d.requirement ?? '',
      'Problem Statement': d.problem_statement ?? '',
      'Products Interested': (d.products_interested ?? []).join('; '),
      'Products Proposed': (d.products_proposed ?? []).join('; '),
      'Strategic Importance': d.strategic_importance ?? '',
      'Outreach Channel': d.outreach_channel ?? '',
      'Expected Close': d.expected_close_date ?? '',
      'Monthly Volume': d.expected_monthly_volume ?? '',
      'Yearly Volume': d.expected_yearly_volume ?? '',
      'Revenue Opportunity': d.estimated_revenue ?? '',
      'Geographic Corridor': d.geographic_corridor ?? '',
      'End Users': d.end_users_count ?? '',
      'Use Case': d.use_case ?? '',
      'Business Impact': d.business_impact ?? '',
      'Why Valuable': d.why_valuable ?? '',
      'Best Product Fit': d.best_product_fit ?? '',
      'Long-term Value': d.long_term_value ?? '',
      'Feature Requested': pf.feature_requested ?? '',
      'Missing Functionality': pf.missing_functionality ?? '',
      'Product Gaps': pf.product_gaps ?? '',
      'Integration Requested': pf.integration_requested ?? '',
      'API Requirements': pf.api_requirements ?? '',
      'Compliance Requirements': pf.compliance_requirements ?? '',
      'Technical Blockers': pf.technical_blockers ?? '',
      'Open Blockers': openBlockers.map(b => blockerLabel(b) + (b.notes ? ` (${b.notes})` : '')).join('; '),
      'Owner': d.owner ?? '',
      'Month': d.month_year ?? '',
      Notes: d.notes ?? '',
      Created: d.created_at.slice(0, 10),
    }
  })
  dlFile(toCSV(rows), `kima-bd-${month}.csv`, 'text/csv;charset=utf-8;')
}

const PDF_STYLE = `
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;color:#1a1a2e;background:#fff}
  .cover{background:#0f0e17;color:#fff;padding:48px 56px 36px}
  .cover h1{margin:16px 0 4px;font-size:26px;font-weight:700}
  .cover .sub{font-size:13px;color:rgba(255,255,255,0.45);margin-top:6px}
  .badge{display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;font-size:9px;font-weight:700;padding:3px 9px;border-radius:4px;letter-spacing:.05em;margin-right:8px}
  .body{padding:36px 56px}
  .section{margin-bottom:32px}
  .section-title{font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #e5e7eb}
  .kpi-row{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:8px}
  .kpi{background:#f7f6fc;border:1px solid #e0dcf0;border-radius:8px;padding:12px 18px;min-width:110px}
  .kpi .num{font-size:22px;font-weight:700;color:#5b21b6}
  .kpi .lbl{font-size:10px;color:#6b7280;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  thead th{background:#f3f4f6;color:#374151;font-weight:600;text-align:left;padding:7px 12px;white-space:nowrap;border-bottom:2px solid #e5e7eb}
  tbody tr:nth-child(even){background:#fafafa}
  tbody td{padding:7px 12px;border-bottom:1px solid #f0f0f0;color:#374151;vertical-align:top}
  .s-badge{display:inline-block;font-size:9px;font-weight:600;padding:2px 6px;border-radius:3px}
  .won{background:#d1fae5;color:#065f46}.lost{background:#fee2e2;color:#991b1b}
  .active{background:#dbeafe;color:#1e40af}.other{background:#f3f4f6;color:#6b7280}
  .footer{margin-top:32px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`

function buildConicGradient(items: { name: string; value: number }[], colors: string[]): string | null {
  const total = items.reduce((a, b) => a + b.value, 0)
  if (!total) return null
  let acc = 0
  const stops = items.map((it, i) => {
    const start = (acc / total) * 360
    acc += it.value
    const end = (acc / total) * 360
    return `${colors[i % colors.length]} ${start}deg ${end}deg`
  })
  return `conic-gradient(${stops.join(', ')})`
}

function exportPDF(deals: MonthlyDeal[], activities: DealActivity[], month: string, outreach: OutreachStats, timeEntries: TimeAllocation[], narrative?: string) {
  const label = fmtMonthYear(month)
  const won     = deals.filter(d => d.status === 'closed_won')
  const lost    = deals.filter(d => d.status === 'closed_lost')
  const active  = deals.filter(d => !['closed_won','closed_lost'].includes(d.status))
  const meetings   = activities.filter(a => a.activity_type === 'meeting').length + outreach.meetingsBooked
  const followUps  = activities.filter(a => a.activity_type === 'follow_up').length + outreach.followUpsSent
  const uniqueCos  = new Set(deals.map(d => d.company_name)).size

  // Channel breakdown (deal-level channel + raw outreach touches)
  const ch: Record<string, number> = { ...outreach.channelBreakdown }
  deals.forEach(d => { if (d.outreach_channel) ch[d.outreach_channel] = (ch[d.outreach_channel] || 0) + 1 })
  const chRows = Object.entries(ch).sort((a,b)=>b[1]-a[1]).map(([k,v]) => {
    const meta = OUTREACH_CHANNELS.find(c => c.value === k)
    return `<tr><td>${meta?.label ?? k}</td><td>${v}</td></tr>`
  }).join('')

  // Companies contacted by category
  const categoryRows = Object.entries(outreach.companyCategoryBreakdown).sort((a,b)=>b[1]-a[1])
    .map(([k,v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')

  // Time allocation — by company
  const timeByCo = timeByCompany(timeEntries)
  const totalTimeHours = timeByCo.reduce((a,b) => a + b.value, 0)
  const timeGradient = buildConicGradient(timeByCo, TIME_PIE_COLORS)
  const timeRows = timeByCo.map((c, i) => `<tr><td><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${TIME_PIE_COLORS[i % TIME_PIE_COLORS.length]};margin-right:6px"></span>${c.name}</td><td>${c.value}h</td><td>${totalTimeHours ? Math.round((c.value/totalTimeHours)*100) : 0}%</td></tr>`).join('')

  // Product feedback themes — every filled field, not just a subset
  const pfItems: string[] = []
  deals.forEach(d => {
    const pf = d.product_feedback || {}
    ;(['feature_requested','missing_functionality','product_gaps','integration_requested','api_requirements','compliance_requirements','technical_blockers'] as const).forEach(key => {
      const v = pf[key]
      if (v) pfItems.push(`• [${d.company_name}] ${v.slice(0,120)}`)
    })
  })

  // Blockers summary — keyed by type, label resolved via blockerLabel (handles custom blockers)
  const blockerCount: Record<string, { label: string; count: number }> = {}
  deals.forEach(d => (d.blockers || []).filter(b => !b.resolved).forEach(b => {
    const key = b.type
    if (!blockerCount[key]) blockerCount[key] = { label: blockerLabel(b), count: 0 }
    blockerCount[key].count++
  }))

  // Next-month priorities (open deals with close date)
  const priorities = active
    .filter(d => d.expected_close_date)
    .sort((a,b) => (a.expected_close_date ?? '') < (b.expected_close_date ?? '') ? -1 : 1)
    .slice(0, 5)

  function statusBadge(s: string) {
    const cls = s === 'closed_won' ? 'won' : s === 'closed_lost' ? 'lost' : ['contacted','discovery','demo','technical_discussion','proposal_sent','negotiation'].includes(s) ? 'active' : 'other'
    return `<span class="s-badge ${cls}">${s.replace(/_/g,' ')}</span>`
  }

  // Only fields the user actually filled in render a value — everything else stays a blank cell.
  const dealRows = deals.map(d => {
    const openBlockers = (d.blockers || []).filter(b => !b.resolved).map(b => blockerLabel(b)).join(', ')
    return `
    <tr>
      <td>${d.company_name ?? ''}</td>
      <td>${d.individual_name ?? ''}</td>
      <td>${d.country ?? ''}</td>
      <td>${d.lead_type ?? ''}</td>
      <td>${statusBadge(d.status)}</td>
      <td>${d.expected_monthly_volume ?? ''}</td>
      <td>${d.estimated_revenue ?? ''}</td>
      <td>${d.strategic_importance ?? ''}</td>
      <td>${d.expected_close_date ?? ''}</td>
      <td>${openBlockers}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>BD Report ${label}</title><style>${PDF_STYLE}</style></head><body>
  <div class="cover">
    <span class="badge">KIMA FINANCE</span><span style="font-size:10px;color:rgba(255,255,255,.35)">Confidential</span>
    <h1>Monthly BD Performance Report</h1>
    <div class="sub">${label} &nbsp;·&nbsp; Generated ${new Date().toLocaleString('en-US',{dateStyle:'long',timeStyle:'short'})} &nbsp;·&nbsp; Kima BD OS</div>
  </div>
  <div class="body">
    <div class="section">
      <div class="section-title">Executive Summary</div>
      <div class="kpi-row">
        <div class="kpi"><div class="num">${outreach.totalOutreach}</div><div class="lbl">Total Outreach</div></div>
        <div class="kpi"><div class="num">${outreach.companiesContacted}</div><div class="lbl">Companies Contacted</div></div>
        <div class="kpi"><div class="num">${outreach.individualsContacted}</div><div class="lbl">Individuals Contacted</div></div>
        <div class="kpi"><div class="num">${outreach.replies}</div><div class="lbl">Replies</div></div>
        <div class="kpi"><div class="num">${deals.length}</div><div class="lbl">Total Deals</div></div>
        <div class="kpi"><div class="num">${uniqueCos}</div><div class="lbl">Companies (Deals)</div></div>
        <div class="kpi"><div class="num">${active.length}</div><div class="lbl">Active</div></div>
        <div class="kpi"><div class="num">${won.length}</div><div class="lbl">Won</div></div>
        <div class="kpi"><div class="num">${lost.length}</div><div class="lbl">Lost</div></div>
        <div class="kpi"><div class="num">${meetings}</div><div class="lbl">Meetings</div></div>
        <div class="kpi"><div class="num">${followUps}</div><div class="lbl">Follow-ups</div></div>
      </div>
    </div>

    ${narrative ? `<div class="section"><div class="section-title">AI Monthly Summary</div>
      <div style="font-size:12px;color:#374151;line-height:1.7;white-space:pre-line">${narrative}</div>
    </div>` : ''}

    ${chRows ? `<div class="section"><div class="section-title">Outreach by Channel</div>
      <table style="max-width:320px"><thead><tr><th>Channel</th><th>Count</th></tr></thead><tbody>${chRows}</tbody></table>
    </div>` : ''}

    ${categoryRows ? `<div class="section"><div class="section-title">Companies Contacted by Category</div>
      <table style="max-width:320px"><thead><tr><th>Category</th><th>Count</th></tr></thead><tbody>${categoryRows}</tbody></table>
    </div>` : ''}

    ${timeByCo.length ? `<div class="section"><div class="section-title">Time Allocation — ${totalTimeHours}h logged</div>
      <div style="display:flex;align-items:center;gap:28px;flex-wrap:wrap">
        <div style="width:140px;height:140px;border-radius:50%;background:${timeGradient ?? '#e5e7eb'};flex-shrink:0"></div>
        <table style="max-width:340px"><thead><tr><th>Company</th><th>Hours</th><th>%</th></tr></thead><tbody>${timeRows}</tbody></table>
      </div>
    </div>` : ''}

    <div class="section">
      <div class="section-title">Full Pipeline — ${deals.length} Deals</div>
      <table>
        <thead><tr><th>Company</th><th>Individual</th><th>Country</th><th>Type</th><th>Status</th><th>Monthly Vol.</th><th>Revenue Opp.</th><th>Importance</th><th>Close Date</th><th>Open Blockers</th></tr></thead>
        <tbody>${dealRows}</tbody>
      </table>
    </div>

    ${won.length ? `<div class="section"><div class="section-title">Wins This Month</div>
      ${won.map(d => `<div style="margin-bottom:8px;padding:10px 14px;background:#f0fdf4;border-left:3px solid #34d399;border-radius:4px">
        <strong>${d.company_name}</strong> ${d.individual_name ? `· ${d.individual_name}` : ''}<br>
        <span style="font-size:11px;color:#374151">${d.business_impact?.slice(0,200) ?? d.why_valuable?.slice(0,200) ?? ''}</span>
      </div>`).join('')}
    </div>` : ''}

    ${pfItems.length ? `<div class="section"><div class="section-title">Product Feedback Collected (${pfItems.length} items)</div>
      <div style="font-size:11px;color:#374151;line-height:1.8">${pfItems.slice(0,12).join('<br>')}</div>
    </div>` : ''}

    ${Object.keys(blockerCount).length ? `<div class="section"><div class="section-title">Active Blockers</div>
      <table style="max-width:360px"><thead><tr><th>Blocker</th><th>Count</th></tr></thead><tbody>
        ${Object.values(blockerCount).sort((a,b)=>b.count-a.count).map(b=>`<tr><td>${b.label}</td><td>${b.count}</td></tr>`).join('')}
      </tbody></table>
    </div>` : ''}

    ${priorities.length ? `<div class="section"><div class="section-title">Next Month Priorities</div>
      ${priorities.map(d => `<div style="margin-bottom:6px;font-size:11px;color:#374151">
        <strong>${d.company_name}</strong> — ${d.status.replace(/_/g,' ')} · Close: ${d.expected_close_date}
      </div>`).join('')}
    </div>` : ''}

    <div class="footer">Kima BD OS · Monthly BD Performance Report · ${label}</div>
  </div>
</body></html>`

  const win = window.open('', '_blank')
  if (!win) { toast.error('Pop-up blocked — allow pop-ups for PDF'); return }
  win.document.write(html); win.document.close(); win.focus()
  setTimeout(() => win.print(), 600)
}

// ── Badges ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const m = dealStatusMeta(status as never)
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.color}30` }}>
      {m.label}
    </span>
  )
}

function ImportanceBadge({ v }: { v?: string }) {
  if (!v) return null
  const map = { high: '#fbbf24', medium: '#60a5fa', low: '#9ca3af' }
  const color = map[v as keyof typeof map] || '#9ca3af'
  return <span className="text-[10px] font-semibold" style={{ color }}>{v.toUpperCase()}</span>
}

const STATUS_ICON: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  new: Building2, contacted: Send, discovery: Search, demo: Zap,
  technical_discussion: Settings2, proposal_sent: FileText,
  negotiation: TrendingUp, closed_won: Trophy, closed_lost: XCircle,
}

const TREND_MONTHS = 6

// ── Page ───────────────────────────────────────────────────────

export default function MonthlyReportsPage() {
  const supabase = createClient()
  const [month, setMonth]         = useState(currentMonthYear())
  const [deals, setDeals]         = useState<MonthlyDeal[]>([])
  const [activities, setActivities] = useState<DealActivity[]>([])
  const [trendRows, setTrendRows] = useState<{ month_year: string; status: string }[]>([])
  const [loading, setLoading]     = useState(true)
  const [mounted, setMounted]     = useState(false)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter]     = useState('all')
  const [exportOpen, setExportOpen]     = useState(false)
  const [setupNeeded, setSetupNeeded]   = useState(false)
  const [outreachStats, setOutreachStats] = useState<OutreachStats>(EMPTY_OUTREACH_STATS)
  const [narrative, setNarrative]       = useState('')
  const [generatingNarrative, setGeneratingNarrative] = useState(false)
  const [overrides, setOverrides]       = useState<Record<string, number>>({})
  const [timeEntries, setTimeEntries]   = useState<TimeAllocation[]>([])
  const [trackingSetupNeeded, setTrackingSetupNeeded] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setNarrative('')
    const trendMonths = last12Months().slice(0, TREND_MONTHS).reverse()

    const [dealsRes, trendRes, overridesRes, timeRes] = await Promise.all([
      supabase.from('monthly_deals').select('*').eq('month_year', month).order('updated_at', { ascending: false }),
      supabase.from('monthly_deals').select('month_year,status').in('month_year', trendMonths),
      supabase.from('monthly_report_overrides').select('overrides').eq('month_year', month).maybeSingle(),
      supabase.from('time_allocations').select('*').eq('month_year', month).order('created_at', { ascending: false }),
    ])

    if (isMissingTableError(dealsRes.error)) {
      setSetupNeeded(true); setLoading(false); return
    }
    const dealList = (dealsRes.data || []) as MonthlyDeal[]
    setDeals(dealList)
    setSetupNeeded(false)
    setTrendRows((trendRes.data || []) as { month_year: string; status: string }[])

    const trackingMissing = isMissingTableError(overridesRes.error) || isMissingTableError(timeRes.error)
    setTrackingSetupNeeded(trackingMissing)
    setOverrides((overridesRes.data?.overrides as Record<string, number>) || {})
    setTimeEntries((timeRes.data || []) as TimeAllocation[])

    const [actsRes, stats] = await Promise.all([
      dealList.length
        ? supabase.from('deal_activities').select('id,deal_id,activity_type,created_at').in('deal_id', dealList.map(d => d.id))
        : Promise.resolve({ data: [] as DealActivity[] }),
      getOutreachStats(supabase, month),
    ])
    setActivities((actsRes.data || []) as DealActivity[])
    setOutreachStats(stats)
    setLoading(false)
  }, [month, supabase])

  useEffect(() => { load() }, [load])

  // Close export dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── KPIs ──────────────────────────────────────────────────────
  const total    = deals.length
  const active   = deals.filter(d => !['closed_won','closed_lost'].includes(d.status)).length
  const won      = deals.filter(d => d.status === 'closed_won').length
  const lost     = deals.filter(d => d.status === 'closed_lost').length
  const meetings = activities.filter(a => a.activity_type === 'meeting').length + outreachStats.meetingsBooked
  const followUps = activities.filter(a => a.activity_type === 'follow_up').length + outreachStats.followUpsSent

  // Manual overrides — any Overview KPI can be pinned to a fixed number instead of
  // the auto-computed value (e.g. outreach logged outside the tracked systems).
  const kpiValue = (key: string, computed: number) => overrides[key] ?? computed
  async function saveOverride(key: string, value: number) {
    const next = { ...overrides, [key]: value }
    setOverrides(next)
    const { error } = await supabase.from('monthly_report_overrides').upsert({ month_year: month, overrides: next }, { onConflict: 'month_year' })
    if (error) toast.error('Failed to save — run supabase/add-time-tracking-and-overrides.sql')
  }
  async function resetOverride(key: string) {
    const next = { ...overrides }
    delete next[key]
    setOverrides(next)
    const { error } = await supabase.from('monthly_report_overrides').upsert({ month_year: month, overrides: next }, { onConflict: 'month_year' })
    if (error) toast.error('Failed to reset override')
  }

  async function addTimeEntry(company: string, responsibility: string, hours: number) {
    const { data, error } = await supabase.from('time_allocations')
      .insert({ month_year: month, company_name: company, responsibility, hours }).select().single()
    if (error) { toast.error('Failed to save — run supabase/add-time-tracking-and-overrides.sql'); return }
    setTimeEntries(prev => [data as TimeAllocation, ...prev])
  }
  async function deleteTimeEntry(id: string) {
    setTimeEntries(prev => prev.filter(e => e.id !== id))
    const { error } = await supabase.from('time_allocations').delete().eq('id', id)
    if (error) toast.error('Failed to delete entry')
  }

  // Channel breakdown (raw outreach touches + deal-level channel)
  const channelCounts: Record<string, number> = { ...outreachStats.channelBreakdown }
  deals.forEach(d => { if (d.outreach_channel) channelCounts[d.outreach_channel] = (channelCounts[d.outreach_channel] || 0) + 1 })
  const maxChannel = Math.max(...Object.values(channelCounts), 1)

  // Status distribution for the pipeline funnel
  const statusCounts: Record<string, number> = {}
  deals.forEach(d => { statusCounts[d.status] = (statusCounts[d.status] || 0) + 1 })

  // Strategic importance mix
  const importanceCounts = { high: 0, medium: 0, low: 0 }
  deals.forEach(d => { const k = d.strategic_importance as keyof typeof importanceCounts; if (k && importanceCounts[k] !== undefined) importanceCounts[k]++ })
  const volumeFilled  = deals.filter(d => d.expected_monthly_volume || d.expected_yearly_volume).length
  const revenueFilled = deals.filter(d => d.estimated_revenue).length

  // 6-month trend
  const trendMonths = useMemo(() => last12Months().slice(0, TREND_MONTHS).reverse(), [])
  const trend = trendMonths.map(m => {
    const rows = trendRows.filter(r => r.month_year === m)
    return {
      label: fmtMonthShort(m),
      won: rows.filter(r => r.status === 'closed_won').length,
      active: rows.filter(r => !['closed_won', 'closed_lost'].includes(r.status)).length,
      lost: rows.filter(r => r.status === 'closed_lost').length,
    }
  })

  // Filtered deals
  const filtered = deals.filter(d => {
    const s = search.toLowerCase()
    const matchSearch = !s || d.company_name.toLowerCase().includes(s)
      || (d.individual_name || '').toLowerCase().includes(s)
      || (d.country || '').toLowerCase().includes(s)
      || (d.industry || '').toLowerCase().includes(s)
    const matchStatus = statusFilter === 'all' || d.status === statusFilter
    const matchType   = typeFilter === 'all' || d.lead_type === typeFilter
    return matchSearch && matchStatus && matchType
  })

  const months = last12Months()

  async function generateNarrative() {
    setGeneratingNarrative(true)
    try {
      const res = await fetch('/api/ai/monthly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, deals, activities, outreach: outreachStats }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to generate summary')
      setNarrative(json.summary || '')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate summary')
    } finally {
      setGeneratingNarrative(false)
    }
  }

  return (
    <div className="fade-in">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="page-header flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Monthly BD Performance</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgb(100,106,135)' }}>
            Track deals, pipeline, and business impact — generate shareable monthly reports.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={load} disabled={loading} className="btn btn-secondary" style={{ padding: '7px 10px', fontSize: '12px' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Month selector */}
          <div className="relative">
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-white appearance-none cursor-pointer outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {months.map(m => <option key={m} value={m}>{fmtMonthYear(m)}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgb(130,130,160)' }} />
          </div>

          {/* Export dropdown */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen(!exportOpen)}
              className="btn btn-secondary flex items-center gap-1.5"
              style={{ fontSize: '12px' }}
            >
              <Download size={12} />Export<ChevronDown size={10} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-xl overflow-hidden z-50 shadow-xl"
                style={{ background: 'rgb(22,22,34)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <button onClick={() => { exportCSV(deals, month); setExportOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-white/5 text-left transition-colors"
                  style={{ color: 'rgb(180,180,210)' }}>
                  <FileText size={12} style={{ color: '#34d399' }} />Export CSV
                </button>
                <button onClick={() => { exportCSV(deals, month); setExportOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-white/5 text-left transition-colors"
                  style={{ color: 'rgb(180,180,210)' }}>
                  <FileText size={12} style={{ color: '#60a5fa' }} />Export Excel (CSV)
                </button>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
                <button onClick={() => { exportPDF(deals, activities, month, outreachStats, timeEntries, narrative || undefined); setExportOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-white/5 text-left transition-colors"
                  style={{ color: 'rgb(180,180,210)' }}>
                  <FileText size={12} style={{ color: '#a78bfa' }} />Export PDF Report
                </button>
              </div>
            )}
          </div>

          <Link href="/monthly-reports/new" className="btn btn-ai" style={{ fontSize: '12px', gap: '6px', textDecoration: 'none' }}>
            <Plus size={13} />Add Deal
          </Link>
        </div>
      </div>

      <div style={{ padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: 26 }}>

        {/* ── Setup banner ──────────────────────────────── */}
        {setupNeeded && (
          <div className="rounded-xl p-5 flex gap-4" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <AlertCircle size={18} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="text-sm font-semibold text-white mb-1">Database setup required</p>
              <p className="text-xs" style={{ color: 'rgb(180,170,120)' }}>
                Run the migration in <code className="px-1 py-0.5 rounded text-[11px]" style={{ background: 'rgba(255,255,255,0.07)' }}>supabase/monthly-reports-migration.sql</code> in your Supabase SQL editor to enable this feature.
              </p>
            </div>
          </div>
        )}

        {!setupNeeded && (
          <>
            {/* ── Section 1: Hero KPI Cards ─────────────────── */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgb(80,85,115)' }}>
                {fmtMonthYear(month)} — Overview
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                <KpiCard label="Total Outreach"        value={kpiValue('total_outreach', outreachStats.totalOutreach)}             color="#22d3ee" icon={Send}      loading={loading}
                  editable isOverridden={overrides.total_outreach != null} onEditSave={v => saveOverride('total_outreach', v)} onResetOverride={() => resetOverride('total_outreach')} />
                <KpiCard label="Companies Contacted"   value={kpiValue('companies_contacted', outreachStats.companiesContacted)}   color="#67e8f9" icon={Building2} loading={loading}
                  editable isOverridden={overrides.companies_contacted != null} onEditSave={v => saveOverride('companies_contacted', v)} onResetOverride={() => resetOverride('companies_contacted')} />
                <KpiCard label="Individuals Contacted" value={kpiValue('individuals_contacted', outreachStats.individualsContacted)} color="#c084fc" icon={Users}     loading={loading}
                  editable isOverridden={overrides.individuals_contacted != null} onEditSave={v => saveOverride('individuals_contacted', v)} onResetOverride={() => resetOverride('individuals_contacted')} />
                <KpiCard label="Replies"               value={kpiValue('replies', outreachStats.replies)}                          color="#34d399" icon={Reply}     loading={loading}
                  sub={outreachStats.totalOutreach > 0 ? `${Math.round((outreachStats.replies / outreachStats.totalOutreach) * 100)}% reply rate` : undefined}
                  editable isOverridden={overrides.replies != null} onEditSave={v => saveOverride('replies', v)} onResetOverride={() => resetOverride('replies')} />
                <KpiCard label="Active Pipeline"       value={kpiValue('active_pipeline', active)}                                  color="#60a5fa" icon={TrendingUp} loading={loading}
                  editable isOverridden={overrides.active_pipeline != null} onEditSave={v => saveOverride('active_pipeline', v)} onResetOverride={() => resetOverride('active_pipeline')} />
                <KpiCard label="Won"                   value={kpiValue('won', won)}                                                color="#4ade80" icon={Trophy}    loading={loading}
                  editable isOverridden={overrides.won != null} onEditSave={v => saveOverride('won', v)} onResetOverride={() => resetOverride('won')} />
                <KpiCard label="Lost"                  value={kpiValue('lost', lost)}                                              color="#f87171" icon={XCircle}   loading={loading}
                  editable isOverridden={overrides.lost != null} onEditSave={v => saveOverride('lost', v)} onResetOverride={() => resetOverride('lost')} />
                <KpiCard label="Meetings"              value={kpiValue('meetings', meetings)}                                      color="#fb923c" icon={Calendar}  loading={loading}
                  sub={`${followUps} follow-ups`}
                  editable isOverridden={overrides.meetings != null} onEditSave={v => saveOverride('meetings', v)} onResetOverride={() => resetOverride('meetings')} />
              </div>
            </div>

            {/* ── Section 1.5: Companies Contacted by Category ── */}
            <div className="section-card">
              <SectionHeader
                icon={Building2} iconColor="#67e8f9"
                title="Companies Contacted by Category"
                subtitle="Industry breakdown of unique companies reached out to this month"
                right={<span className="text-[15px] font-bold text-white tabular-nums">{outreachStats.companiesContacted}</span>}
              />
              <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                {Object.keys(outreachStats.companyCategoryBreakdown).length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: 'rgb(90,90,110)' }}>
                    No categorized outreach yet — categories come from each lead&apos;s industry.
                  </p>
                ) : Object.entries(outreachStats.companyCategoryBreakdown).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-medium" style={{ color: 'rgb(160,165,195)' }}>{cat}</span>
                      <span className="text-[14px] font-bold tabular-nums text-white">{count}</span>
                    </div>
                    <MiniBar value={count} max={Math.max(...Object.values(outreachStats.companyCategoryBreakdown), 1)} color="#67e8f9" />
                  </div>
                ))}
              </div>
            </div>

            {/* ── Section 2: Pipeline Status ─────────────────── */}
            <div className="section-card">
              <SectionHeader
                icon={Target} iconColor="#fbbf24"
                title="Pipeline Status"
                subtitle={`Where every tracked deal stands this month · ${total} total`}
              />
              <div style={{ padding: '18px 22px 20px' }}>
                {total > 0 ? (
                  <>
                    <div style={{ height: 22, borderRadius: 11, display: 'flex', gap: 2, overflow: 'hidden', marginBottom: 10 }}>
                      {DEAL_STATUSES.filter(s => statusCounts[s.value] > 0).map(s => (
                        <div key={s.value}
                          title={`${s.label}: ${statusCounts[s.value]}`}
                          style={{ flex: statusCounts[s.value], background: s.color, borderRadius: 3, minWidth: 3 }} />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3 mb-5">
                      {DEAL_STATUSES.filter(s => statusCounts[s.value] > 0).map(s => (
                        <div key={s.value} className="flex items-center gap-1.5">
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                          <span className="text-[10px]" style={{ color: 'rgb(100,106,135)' }}>{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="mb-4 p-4 rounded-xl text-center text-[12px]" style={{ color: 'rgb(100,106,135)', background: 'rgba(255,255,255,0.025)' }}>
                    No deals tracked for {fmtMonthYear(month)} yet — add one to see your pipeline.
                  </div>
                )}
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2.5">
                  {DEAL_STATUSES.map(s => {
                    const count = statusCounts[s.value] || 0
                    const Icon = STATUS_ICON[s.value] ?? Building2
                    return (
                      <div key={s.value} style={{
                        padding: '12px 14px', borderRadius: 10,
                        background: count > 0 ? s.color + '09' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${count > 0 ? s.color + '28' : 'rgba(255,255,255,0.05)'}`,
                      }}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Icon size={11} style={{ color: count > 0 ? s.color : 'rgb(80,85,110)' }} />
                          <span className="text-[10px] font-semibold" style={{ color: count > 0 ? s.color : 'rgb(80,85,110)' }}>{s.label}</span>
                        </div>
                        <div className="text-[22px] font-bold tabular-nums leading-none text-white">{count}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* ── Section 3: Channel + Business Potential ────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="section-card">
                <SectionHeader
                  icon={Send} iconColor="#34d399"
                  title="Outreach by Channel"
                  subtitle="All touches — deal-level + raw outreach"
                  right={<span className="text-[15px] font-bold text-white tabular-nums">{Object.values(channelCounts).reduce((a, b) => a + b, 0)}</span>}
                />
                <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {Object.keys(channelCounts).length === 0 ? (
                    <p className="text-xs text-center py-4" style={{ color: 'rgb(90,90,110)' }}>No channel activity logged yet.</p>
                  ) : OUTREACH_CHANNELS.filter(c => channelCounts[c.value] > 0).map(c => (
                    <div key={c.value}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[12px] font-medium" style={{ color: 'rgb(160,165,195)' }}>{c.label}</span>
                        <span className="text-[14px] font-bold tabular-nums text-white">{channelCounts[c.value]}</span>
                      </div>
                      <MiniBar value={channelCounts[c.value]} max={maxChannel} color="#a78bfa" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="section-card">
                <SectionHeader
                  icon={DollarSign} iconColor="#4ade80"
                  title="Business Potential"
                  subtitle="Strategic importance mix &amp; data completeness"
                />
                <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {([
                    { label: 'High Importance',   value: importanceCounts.high,   color: '#fbbf24' },
                    { label: 'Medium Importance', value: importanceCounts.medium, color: '#60a5fa' },
                    { label: 'Low Importance',    value: importanceCounts.low,    color: '#9ca3af' },
                  ]).map(({ label, value, color }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[12px] font-medium" style={{ color: 'rgb(160,165,195)' }}>{label}</span>
                        <span className="text-[14px] font-bold tabular-nums text-white">{value}</span>
                      </div>
                      <MiniBar value={value} max={Math.max(total, 1)} color={color} />
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <div style={{ padding: '11px 13px', borderRadius: 10, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="text-[10px] font-medium mb-1.5" style={{ color: 'rgb(100,106,135)' }}>Volume Estimated</div>
                      <div className="text-[20px] font-bold tabular-nums text-white leading-none">{volumeFilled}<span style={{ fontSize: 12, fontWeight: 500, color: 'rgb(80,85,110)' }}> / {total}</span></div>
                    </div>
                    <div style={{ padding: '11px 13px', borderRadius: 10, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="text-[10px] font-medium mb-1.5" style={{ color: 'rgb(100,106,135)' }}>Revenue Estimated</div>
                      <div className="text-[20px] font-bold tabular-nums text-white leading-none">{revenueFilled}<span style={{ fontSize: 12, fontWeight: 500, color: 'rgb(80,85,110)' }}> / {total}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Section 3.5: Time Allocation ────────────────── */}
            <TimeAllocationSection
              entries={timeEntries}
              onAdd={addTimeEntry}
              onDelete={deleteTimeEntry}
              setupNeeded={trackingSetupNeeded}
            />

            {/* ── Section 4: AI Monthly Summary ──────────────── */}
            <div className="section-card">
              <SectionHeader
                icon={Sparkles} iconColor="#a78bfa"
                title="AI Monthly Summary"
                subtitle="Activity, pipeline health, opportunities &amp; product insights — auto-written"
                right={
                  <button onClick={generateNarrative} disabled={generatingNarrative} className="btn btn-ai" style={{ fontSize: '11px', gap: '6px' }}>
                    {generatingNarrative ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                    {narrative ? 'Regenerate' : 'Generate Summary'}
                  </button>
                }
              />
              <div style={{ padding: '18px 22px' }}>
                {narrative ? (
                  <p className="text-xs whitespace-pre-line" style={{ color: 'rgb(200,200,225)', lineHeight: 1.7 }}>{narrative}</p>
                ) : (
                  <p className="text-xs" style={{ color: 'rgb(100,106,135)' }}>
                    Generate an AI-written narrative covering activity, pipeline health, opportunities, and product insights for {fmtMonthYear(month)}.
                  </p>
                )}
              </div>
            </div>

            {/* ── Section 5: 6-Month Trend ────────────────────── */}
            <div className="section-card">
              <SectionHeader
                icon={BarChart2} iconColor="#60a5fa"
                title="Pipeline Trend"
                subtitle={`Deals by outcome per month · last ${TREND_MONTHS} months`}
              />
              <div style={{ padding: '16px 22px 24px' }}>
                {mounted && !loading ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={trend} barGap={3} barCategoryGap="28%">
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'rgb(100,106,135)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'rgb(100,106,135)' }} axisLine={false} tickLine={false} width={22} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: 'rgb(20,22,33)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 9, fontSize: 12, color: 'rgb(160,165,195)' }}
                        labelStyle={{ color: 'rgb(200,205,235)', fontWeight: 600, marginBottom: 4 }}
                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      />
                      <Bar dataKey="won"    name="Won"    stackId="a" fill="#4ade80" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="active" name="Active" stackId="a" fill="#60a5fa" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="lost"   name="Lost"   stackId="a" fill="#f87171" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="text-[12px]" style={{ color: 'rgb(100,106,135)' }}>Loading chart…</div>
                  </div>
                )}
                <div className="flex items-center gap-5 mt-3">
                  {[{ label: 'Won', color: '#4ade80' }, { label: 'Active', color: '#60a5fa' }, { label: 'Lost', color: '#f87171' }].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
                      <span className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Filters ─────────────────────────────────────── */}
            <div className="flex gap-2 flex-wrap items-center">
              <div className="relative flex-1 min-w-48">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgb(90,90,110)' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search company, individual, country…"
                  className="input-dark"
                  style={{ paddingLeft: 32 }}
                />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-dark" style={{ width: 'auto' }}>
                <option value="all">All Statuses</option>
                {DEAL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input-dark" style={{ width: 'auto' }}>
                <option value="all">All Types</option>
                {LEAD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* ── Deal list ───────────────────────────────────── */}
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin" style={{ color: '#a78bfa' }} /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <Building2 size={36} className="mx-auto mb-3 opacity-20" style={{ color: '#a78bfa' }} />
                <p className="text-sm font-medium text-white mb-1">
                  {deals.length === 0 ? `No deals for ${fmtMonthYear(month)}` : 'No matching deals'}
                </p>
                <p className="text-xs mb-5" style={{ color: 'rgb(90,90,110)' }}>
                  {deals.length === 0 ? 'Start tracking your BD activities by adding your first deal.' : 'Try adjusting your filters.'}
                </p>
                {deals.length === 0 && (
                  <Link href="/monthly-reports/new" className="btn btn-ai" style={{ fontSize: '13px', textDecoration: 'none', display: 'inline-flex', gap: '6px' }}>
                    <Plus size={13} />Add Your First Deal
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs mb-1" style={{ color: 'rgb(90,90,110)' }}>{filtered.length} deal{filtered.length !== 1 ? 's' : ''}</div>
                {filtered.map(deal => {
                  const actCount = activities.filter(a => a.deal_id === deal.id).length
                  const hasBlockers = (deal.blockers || []).some(b => !b.resolved)
                  return (
                    <Link
                      key={deal.id}
                      href={`/monthly-reports/${deal.id}`}
                      className="block rounded-xl p-4 card-hover"
                      style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none' }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-semibold text-white">{deal.company_name}</span>
                            <StatusBadge status={deal.status} />
                            {deal.lead_type && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgb(150,150,180)' }}>
                                {deal.lead_type}
                              </span>
                            )}
                            <ImportanceBadge v={deal.strategic_importance} />
                            {hasBlockers && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                                style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
                                ⚠ Blocker
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            {deal.individual_name && (
                              <span className="text-xs" style={{ color: 'rgb(140,140,170)' }}>
                                {deal.individual_name}{deal.designation ? ` · ${deal.designation}` : ''}
                              </span>
                            )}
                            {deal.country && <span className="text-xs" style={{ color: 'rgb(110,110,140)' }}>{deal.country}</span>}
                            {deal.industry && <span className="text-xs" style={{ color: 'rgb(110,110,140)' }}>{deal.industry}</span>}
                          </div>
                          {(deal.products_proposed?.length || deal.products_interested?.length) ? (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {(deal.products_proposed || deal.products_interested || []).slice(0, 3).map(p => (
                                <span key={p} className="text-[10px] px-1.5 py-0.5 rounded"
                                  style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>
                                  {p}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          {deal.expected_close_date && (
                            <div className="flex items-center gap-1 text-[10px]" style={{ color: 'rgb(110,110,140)' }}>
                              <Calendar size={10} />
                              {new Date(deal.expected_close_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                            </div>
                          )}
                          {deal.expected_monthly_volume && (
                            <div className="text-[10px] font-medium" style={{ color: '#34d399' }}>
                              {deal.expected_monthly_volume}/mo
                            </div>
                          )}
                          {actCount > 0 && (
                            <div className="text-[10px]" style={{ color: 'rgb(90,90,110)' }}>
                              {actCount} activit{actCount !== 1 ? 'ies' : 'y'}
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
