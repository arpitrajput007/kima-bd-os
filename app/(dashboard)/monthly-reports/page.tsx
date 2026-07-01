'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Plus, Search, Download, FileText, TrendingUp, Users,
  Trophy, XCircle, Calendar, BarChart2, Loader2, RefreshCw,
  Building2, ChevronDown, AlertCircle, Send, Reply, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DEAL_STATUSES, OUTREACH_CHANNELS, LEAD_TYPES,
  dealStatusMeta, fmtMonthYear, currentMonthYear, last12Months,
} from '@/lib/monthly-reports-types'
import type { MonthlyDeal, DealActivity } from '@/lib/monthly-reports-types'
import { getOutreachStats, EMPTY_OUTREACH_STATS } from '@/lib/monthly-outreach-stats'
import type { OutreachStats } from '@/lib/monthly-outreach-stats'

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
  const rows = deals.map(d => ({
    Company: d.company_name,
    Individual: d.individual_name ?? '',
    Designation: d.designation ?? '',
    Country: d.country ?? '',
    Industry: d.industry ?? '',
    'Lead Type': d.lead_type ?? '',
    Status: d.status.replace(/_/g, ' '),
    'Strategic Importance': d.strategic_importance ?? '',
    'Outreach Channel': d.outreach_channel ?? '',
    'Expected Close': d.expected_close_date ?? '',
    'Monthly Volume': d.expected_monthly_volume ?? '',
    'Yearly Volume': d.expected_yearly_volume ?? '',
    'Revenue Opportunity': d.estimated_revenue ?? '',
    'Geographic Corridor': d.geographic_corridor ?? '',
    'Products Interested': (d.products_interested ?? []).join('; '),
    'Products Proposed': (d.products_proposed ?? []).join('; '),
    'Business Impact': d.business_impact ?? '',
    'Why Valuable': d.why_valuable ?? '',
    'Best Product Fit': d.best_product_fit ?? '',
    Notes: d.notes ?? '',
    Created: d.created_at.slice(0, 10),
  }))
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

function exportPDF(deals: MonthlyDeal[], activities: DealActivity[], month: string, outreach: OutreachStats, narrative?: string) {
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

  // Product feedback themes
  const pfItems: string[] = []
  deals.forEach(d => {
    const pf = d.product_feedback || {}
    ;['feature_requested','missing_functionality','product_gaps','integration_requested'].forEach(key => {
      const v = (pf as Record<string,string>)[key]
      if (v) pfItems.push(`• ${v.slice(0,120)}`)
    })
  })

  // Blockers summary
  const blockerCount: Record<string, number> = {}
  deals.forEach(d => (d.blockers || []).filter(b => !b.resolved).forEach(b => {
    blockerCount[b.type] = (blockerCount[b.type] || 0) + 1
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

  const dealRows = deals.map(d => `
    <tr>
      <td>${d.company_name}</td>
      <td>${d.individual_name ?? '—'}</td>
      <td>${d.lead_type ?? '—'}</td>
      <td>${statusBadge(d.status)}</td>
      <td>${d.expected_monthly_volume ?? '—'}</td>
      <td>${d.estimated_revenue ?? '—'}</td>
      <td>${d.strategic_importance ?? '—'}</td>
      <td>${d.expected_close_date ?? '—'}</td>
    </tr>`).join('')

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

    <div class="section">
      <div class="section-title">Full Pipeline — ${deals.length} Deals</div>
      <table>
        <thead><tr><th>Company</th><th>Individual</th><th>Type</th><th>Status</th><th>Monthly Vol.</th><th>Revenue Opp.</th><th>Importance</th><th>Close Date</th></tr></thead>
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
        ${Object.entries(blockerCount).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td>${k.replace(/_/g,' ')}</td><td>${v}</td></tr>`).join('')}
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

// ── Status badge ───────────────────────────────────────────────

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

// ── Page ───────────────────────────────────────────────────────

export default function MonthlyReportsPage() {
  const supabase = createClient()
  const [month, setMonth]         = useState(currentMonthYear())
  const [deals, setDeals]         = useState<MonthlyDeal[]>([])
  const [activities, setActivities] = useState<DealActivity[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter]     = useState('all')
  const [exportOpen, setExportOpen]     = useState(false)
  const [setupNeeded, setSetupNeeded]   = useState(false)
  const [outreachStats, setOutreachStats] = useState<OutreachStats>(EMPTY_OUTREACH_STATS)
  const [narrative, setNarrative]       = useState('')
  const [generatingNarrative, setGeneratingNarrative] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNarrative('')
    const { data, error } = await supabase
      .from('monthly_deals')
      .select('*')
      .eq('month_year', month)
      .order('updated_at', { ascending: false })

    if (error?.message?.includes('does not exist')) {
      setSetupNeeded(true); setLoading(false); return
    }
    const dealList = (data || []) as MonthlyDeal[]
    setDeals(dealList)
    setSetupNeeded(false)

    if (dealList.length) {
      const { data: acts } = await supabase
        .from('deal_activities')
        .select('id,deal_id,activity_type,created_at')
        .in('deal_id', dealList.map(d => d.id))
      setActivities((acts || []) as DealActivity[])
    } else {
      setActivities([])
    }

    const stats = await getOutreachStats(supabase, month)
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
  const meetings = activities.filter(a => a.activity_type === 'meeting').length
  const followUps = activities.filter(a => a.activity_type === 'follow_up').length
  const uniqueCos = new Set(deals.map(d => d.company_name)).size
  const uniqueIndividuals = new Set(deals.map(d => d.individual_name).filter(Boolean)).size

  // Channel breakdown (raw outreach touches + deal-level channel)
  const channelCounts: Record<string, number> = { ...outreachStats.channelBreakdown }
  deals.forEach(d => { if (d.outreach_channel) channelCounts[d.outreach_channel] = (channelCounts[d.outreach_channel] || 0) + 1 })

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

  const outreachKpiCards = [
    { label: 'Total Outreach',        value: outreachStats.totalOutreach,        icon: Send,      color: '#22d3ee', bg: 'rgba(34,211,238,0.08)',  border: 'rgba(34,211,238,0.2)'  },
    { label: 'Companies Contacted',   value: outreachStats.companiesContacted,   icon: Building2, color: '#67e8f9', bg: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.2)'   },
    { label: 'Individuals Contacted', value: outreachStats.individualsContacted, icon: Users,     color: '#c084fc', bg: 'rgba(192,132,252,0.08)', border: 'rgba(192,132,252,0.2)' },
    { label: 'Replies',               value: outreachStats.replies,              icon: Reply,     color: '#34d399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.2)'  },
  ]

  const kpiCards = [
    { label: 'Total Deals',        value: total,            icon: Building2,  color: '#a78bfa', bg: 'rgba(139,92,246,0.08)',  border: 'rgba(139,92,246,0.2)'  },
    { label: 'Active Pipeline',     value: active,           icon: TrendingUp, color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.2)'  },
    { label: 'Won',                 value: won,              icon: Trophy,     color: '#34d399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.2)'  },
    { label: 'Lost',                value: lost,             icon: XCircle,    color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)' },
    { label: 'Companies (Deals)',   value: uniqueCos,        icon: Users,      color: '#67e8f9', bg: 'rgba(6,182,212,0.08)',  border: 'rgba(6,182,212,0.2)'   },
    { label: 'Individuals (Deals)', value: uniqueIndividuals,icon: Users,      color: '#c084fc', bg: 'rgba(192,132,252,0.08)', border: 'rgba(192,132,252,0.2)' },
    { label: 'Meetings',            value: meetings + outreachStats.meetingsBooked, icon: Calendar, color: '#fb923c', bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.2)'  },
    { label: 'Follow-ups',          value: followUps + outreachStats.followUpsSent, icon: BarChart2, color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.2)'  },
  ]

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
          <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>
            Track deals, pipeline, and business impact — generate shareable monthly reports.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={load} disabled={loading} className="btn btn-ghost" style={{ fontSize: '12px', gap: '6px' }}>
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
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
              className="btn btn-ghost flex items-center gap-1.5"
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
                <button onClick={() => { exportPDF(deals, activities, month, outreachStats, narrative || undefined); setExportOpen(false) }}
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

      <div className="p-8 space-y-6">

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

        {/* ── Outreach KPI cards ────────────────────────── */}
        {!setupNeeded && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {outreachKpiCards.map(({ label, value, icon: Icon, color, bg, border }) => (
              <div key={label} className="rounded-xl p-3.5 flex flex-col gap-2"
                style={{ background: bg, border: `1px solid ${border}` }}>
                <Icon size={13} style={{ color }} />
                <div className="text-xl font-bold" style={{ color }}>{value}</div>
                <div className="text-[10px] font-medium" style={{ color: 'rgb(100,100,130)' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Deal KPI cards ────────────────────────────── */}
        {!setupNeeded && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {kpiCards.map(({ label, value, icon: Icon, color, bg, border }) => (
              <div key={label} className="rounded-xl p-3.5 flex flex-col gap-2"
                style={{ background: bg, border: `1px solid ${border}` }}>
                <Icon size={13} style={{ color }} />
                <div className="text-xl font-bold" style={{ color }}>{value}</div>
                <div className="text-[10px] font-medium" style={{ color: 'rgb(100,100,130)' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── AI Monthly Summary ────────────────────────── */}
        {!setupNeeded && (
          <div className="rounded-xl p-5" style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(167,139,250,0.15)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-semibold" style={{ color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>AI Monthly Summary</div>
              <button onClick={generateNarrative} disabled={generatingNarrative} className="btn btn-ai" style={{ fontSize: '11px', gap: '6px' }}>
                {generatingNarrative ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                {narrative ? 'Regenerate' : 'Generate Summary'}
              </button>
            </div>
            {narrative ? (
              <p className="text-xs whitespace-pre-line" style={{ color: 'rgb(200,200,225)', lineHeight: 1.7 }}>{narrative}</p>
            ) : (
              <p className="text-xs" style={{ color: 'rgb(100,100,120)' }}>
                Generate an AI-written narrative covering activity, pipeline health, opportunities, and product insights for {fmtMonthYear(month)}.
              </p>
            )}
          </div>
        )}

        {/* ── Channel breakdown ──────────────────────────── */}
        {!setupNeeded && Object.keys(channelCounts).length > 0 && (
          <div className="rounded-xl p-4" style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-[10px] font-semibold mb-3" style={{ color: 'rgb(110,110,140)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Outreach by Channel</div>
            <div className="flex flex-wrap gap-3">
              {OUTREACH_CHANNELS.map(ch => {
                const count = channelCounts[ch.value] || 0
                if (!count) return null
                return (
                  <div key={ch.value} className="flex items-center gap-1.5">
                    <span className="text-sm font-bold" style={{ color: '#a78bfa' }}>{count}</span>
                    <span className="text-xs" style={{ color: 'rgb(110,110,140)' }}>{ch.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Filters ───────────────────────────────────── */}
        {!setupNeeded && (
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-48">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgb(90,90,110)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search company, individual, country…"
                className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'white' }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="rounded-lg px-3 py-2 text-xs outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgb(180,180,210)' }}
            >
              <option value="all">All Statuses</option>
              {DEAL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="rounded-lg px-3 py-2 text-xs outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgb(180,180,210)' }}
            >
              <option value="all">All Types</option>
              {LEAD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}

        {/* ── Deal list ─────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin" style={{ color: '#a78bfa' }} /></div>
        ) : setupNeeded ? null : filtered.length === 0 ? (
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
            <div className="text-xs mb-3" style={{ color: 'rgb(90,90,110)' }}>{filtered.length} deal{filtered.length !== 1 ? 's' : ''}</div>
            {filtered.map(deal => {
              const actCount = activities.filter(a => a.deal_id === deal.id).length
              const hasBlockers = (deal.blockers || []).some(b => !b.resolved)
              return (
                <Link
                  key={deal.id}
                  href={`/monthly-reports/${deal.id}`}
                  className="block rounded-xl p-4 transition-all"
                  style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(167,139,250,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
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
      </div>
    </div>
  )
}
