'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  FileDown, FileText, Globe, BarChart3, Target,
  TrendingUp, Loader2, RefreshCw, Building2, Trophy,
} from 'lucide-react'
import type { Lead } from '@/lib/types'

// ── Helpers ────────────────────────────────────────────────────

function toCSV(rows: Record<string, string | number | null | undefined>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const headerRow = headers.map(h => `"${h}"`).join(',')
  const dataRows = rows.map(row =>
    headers.map(h => {
      const v = row[h]
      return v === null || v === undefined ? '""' : `"${String(v).replace(/"/g, '""')}"`
    }).join(',')
  )
  return [headerRow, ...dataRows].join('\n')
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function openPrintWindow(html: string) {
  const win = window.open('', '_blank')
  if (!win) { toast.error('Pop-up blocked — allow pop-ups for this site'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 600)
}

const REPORT_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #111; margin: 0; padding: 0; }
  .header { background: #0f0e17; color: #fff; padding: 28px 40px 20px; }
  .header h1 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  .header .meta { font-size: 12px; color: rgba(255,255,255,0.5); }
  .kima-badge { display: inline-block; background: linear-gradient(135deg,#7c3aed,#4f46e5); color:#fff; font-size:10px; font-weight:700; padding:3px 8px; border-radius:4px; letter-spacing:0.05em; margin-right:10px; }
  .body { padding: 28px 40px; }
  .stats-row { display:flex; gap:16px; margin-bottom:24px; flex-wrap:wrap; }
  .stat { background:#f7f6fc; border:1px solid #e5e3f0; border-radius:8px; padding:14px 20px; min-width:120px; }
  .stat .num { font-size:24px; font-weight:700; color:#5b21b6; }
  .stat .lbl { font-size:11px; color:#6b7280; margin-top:2px; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  thead th { background:#f3f4f6; color:#374151; font-weight:600; text-align:left; padding:8px 12px; border-bottom:2px solid #e5e7eb; white-space:nowrap; }
  tbody tr:nth-child(even) { background:#fafafa; }
  tbody td { padding:7px 12px; border-bottom:1px solid #f0f0f0; color:#374151; vertical-align:top; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .badge { display:inline-block; font-size:10px; font-weight:600; padding:2px 6px; border-radius:4px; }
  .badge-green { background:#d1fae5; color:#065f46; }
  .badge-amber { background:#fef3c7; color:#92400e; }
  .badge-red { background:#fee2e2; color:#991b1b; }
  .badge-blue { background:#dbeafe; color:#1e40af; }
  .badge-gray { background:#f3f4f6; color:#6b7280; }
  .section-title { font-size:13px; font-weight:700; color:#374151; margin:24px 0 10px; text-transform:uppercase; letter-spacing:0.06em; }
  .footer { margin-top:32px; padding-top:16px; border-top:1px solid #e5e7eb; font-size:11px; color:#9ca3af; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
`

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    won: 'badge-green', integration: 'badge-green', negotiating: 'badge-blue',
    proposal_sent: 'badge-blue', meeting_booked: 'badge-blue', replied: 'badge-amber',
    contacted: 'badge-amber', lost: 'badge-red', rejected: 'badge-red',
  }
  const cls = map[status] || 'badge-gray'
  return `<span class="badge ${cls}">${status.replace(/_/g, ' ')}</span>`
}

// ── Pipeline Report ────────────────────────────────────────────

function pipelineCSVRows(leads: Lead[]) {
  return leads.map(l => ({
    'Company Name': l.company_name,
    'Status': l.status,
    'Priority': l.priority || '',
    'Product to Sell': l.product_to_sell || '',
    'Customer Category': (l.customer_category || []).join('; '),
    'Region': l.region || '',
    'Lead Score': l.lead_score ?? '',
    'Pain Point Severity': l.pain_point_severity || '',
    'Revenue Potential': l.revenue_potential || '',
    'Next Follow Up': l.next_follow_up_at ? new Date(l.next_follow_up_at).toLocaleDateString() : '',
    'Contacted At': l.contacted_at ? new Date(l.contacted_at).toLocaleDateString() : '',
    'Created': new Date(l.created_at).toLocaleDateString(),
  }))
}

function pipelineHTML(leads: Lead[], generatedAt: string): string {
  const byStatus = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1; return acc
  }, {})
  const total = leads.length
  const inPipeline = leads.filter(l => ['contacted','replied','meeting_booked','proposal_sent','negotiating','integration'].includes(l.status)).length
  const won = byStatus['won'] || 0
  const meetings = (byStatus['meeting_booked'] || 0) + (byStatus['proposal_sent'] || 0) + (byStatus['negotiating'] || 0)
  const replied = leads.filter(l => ['replied','meeting_booked','proposal_sent','negotiating','integration','won'].includes(l.status)).length
  const contacted = leads.filter(l => ['contacted','replied','meeting_booked','proposal_sent','negotiating','integration','won','lost'].includes(l.status)).length
  const responseRate = contacted > 0 ? Math.round((replied / contacted) * 100) : 0
  const meetingRate = replied > 0 ? Math.round((meetings / replied) * 100) : 0

  const rows = leads.map(l => `
    <tr>
      <td title="${l.company_name}">${l.company_name}</td>
      <td>${statusBadge(l.status)}</td>
      <td>${l.priority?.replace(/_/g,' ') || '—'}</td>
      <td>${l.product_to_sell || '—'}</td>
      <td>${l.region || '—'}</td>
      <td>${l.lead_score ?? '—'}</td>
      <td>${l.pain_point_severity || '—'}</td>
      <td title="${l.revenue_potential || ''}">${l.revenue_potential ? l.revenue_potential.slice(0,60) + (l.revenue_potential.length > 60 ? '…' : '') : '—'}</td>
      <td>${l.next_follow_up_at ? new Date(l.next_follow_up_at).toLocaleDateString() : '—'}</td>
    </tr>`).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Weekly BD Pipeline Report</title><style>${REPORT_STYLES}</style></head><body>
  <div class="header">
    <div><span class="kima-badge">KIMA FINANCE</span><span style="font-size:11px;color:rgba(255,255,255,0.4)">Confidential</span></div>
    <h1 style="margin-top:12px">Weekly BD Pipeline Report</h1>
    <div class="meta">Generated ${generatedAt} · Kima BD OS</div>
  </div>
  <div class="body">
    <div class="stats-row">
      <div class="stat"><div class="num">${total}</div><div class="lbl">Total Leads</div></div>
      <div class="stat"><div class="num">${inPipeline}</div><div class="lbl">Active Pipeline</div></div>
      <div class="stat"><div class="num">${meetings}</div><div class="lbl">Meetings / Proposals</div></div>
      <div class="stat"><div class="num">${won}</div><div class="lbl">Won</div></div>
      <div class="stat"><div class="num">${responseRate}%</div><div class="lbl">Response Rate</div></div>
      <div class="stat"><div class="num">${meetingRate}%</div><div class="lbl">Reply → Meeting Rate</div></div>
    </div>
    <div class="section-title">Pipeline Breakdown</div>
    <table>
      <thead><tr><th>Company</th><th>Status</th><th>Priority</th><th>Product</th><th>Region</th><th>Score</th><th>Pain Severity</th><th>Revenue Potential</th><th>Next Follow Up</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">Kima BD OS — Weekly BD Pipeline Report · Generated ${generatedAt}</div>
  </div>
</body></html>`
}

// ── Competitor Intelligence Report ────────────────────────────

function competitorCSVRows(leads: Lead[]) {
  return leads.map(l => ({
    'Company Name': l.company_name,
    'Competitor / Current Provider': l.competitor_or_current_provider || l.current_providers || '',
    'Competitor Context': l.competitor_context || '',
    'Industry Category': l.industry_category || '',
    'Product to Sell': l.product_to_sell || '',
    'Pain Point': l.pain_point || '',
    'Pain Point Severity': l.pain_point_severity || '',
    'Region': l.region || '',
    'Lead Score': l.lead_score ?? '',
    'Status': l.status,
    'Kima Fit': l.kima_fit ? l.kima_fit.slice(0, 120) : '',
  }))
}

function competitorHTML(leads: Lead[], generatedAt: string, quarter: string): string {
  const competitorMap = leads.reduce<Record<string, Lead[]>>((acc, l) => {
    const c = l.competitor_or_current_provider || l.current_providers || 'Unknown'
    const key = c.length > 40 ? c.slice(0, 40) + '…' : c
    ;(acc[key] = acc[key] || []).push(l)
    return acc
  }, {})

  const competitorSummary = Object.entries(competitorMap)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)

  const summaryRows = competitorSummary.map(([comp, cls]) =>
    `<tr><td>${comp}</td><td>${cls.length}</td><td>${[...new Set(cls.map(c => c.product_to_sell).filter(Boolean))].join(', ') || '—'}</td><td>${[...new Set(cls.map(c => c.region).filter(Boolean))].join(', ') || '—'}</td></tr>`
  ).join('')

  const detailRows = leads.map(l => `
    <tr>
      <td title="${l.company_name}">${l.company_name}</td>
      <td title="${l.competitor_or_current_provider || l.current_providers || ''}">${(l.competitor_or_current_provider || l.current_providers || '—').slice(0,50)}</td>
      <td>${l.industry_category || '—'}</td>
      <td>${l.product_to_sell || '—'}</td>
      <td>${l.pain_point_severity || '—'}</td>
      <td>${l.region || '—'}</td>
      <td>${l.lead_score ?? '—'}</td>
      <td>${statusBadge(l.status)}</td>
    </tr>`).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>QTR Competitor Intelligence Report</title><style>${REPORT_STYLES}</style></head><body>
  <div class="header">
    <div><span class="kima-badge">KIMA FINANCE</span><span style="font-size:11px;color:rgba(255,255,255,0.4)">Confidential</span></div>
    <h1 style="margin-top:12px">QTR Competitor Intelligence Report</h1>
    <div class="meta">Quarter: ${quarter} · Generated ${generatedAt} · Kima BD OS</div>
  </div>
  <div class="body">
    <div class="stats-row">
      <div class="stat"><div class="num">${leads.length}</div><div class="lbl">Leads with Competitor Data</div></div>
      <div class="stat"><div class="num">${competitorSummary.length}</div><div class="lbl">Unique Competitors</div></div>
      <div class="stat"><div class="num">${leads.filter(l=>l.pain_point_severity==='critical'||l.pain_point_severity==='high').length}</div><div class="lbl">High-Severity Pain Points</div></div>
    </div>

    <div class="section-title">Top Competitors by Lead Count</div>
    <table>
      <thead><tr><th>Competitor / Provider</th><th>Lead Count</th><th>Products We'd Sell</th><th>Regions</th></tr></thead>
      <tbody>${summaryRows}</tbody>
    </table>

    <div class="section-title" style="margin-top:32px">Full Lead Detail</div>
    <table>
      <thead><tr><th>Company</th><th>Competitor / Provider</th><th>Industry</th><th>Product to Sell</th><th>Pain Severity</th><th>Region</th><th>Score</th><th>Status</th></tr></thead>
      <tbody>${detailRows}</tbody>
    </table>
    <div class="footer">Kima BD OS — QTR Competitor Intelligence Report · Generated ${generatedAt}</div>
  </div>
</body></html>`
}

// ── Revenue Attribution Report ─────────────────────────────────

function revenueCSVRows(leads: Lead[]) {
  return leads.map(l => ({
    'Company Name': l.company_name,
    'Status': l.status,
    'Product to Sell': l.product_to_sell || '',
    'Revenue Potential': l.revenue_potential || '',
    'Customer Category': (l.customer_category || []).join('; '),
    'Region': l.region || '',
    'BD Verdict': l.bd_brief?.bd_verdict?.fit || '',
    'BD Reason': l.bd_brief?.bd_verdict?.reason || '',
    'Kima Fit': l.kima_fit ? l.kima_fit.slice(0, 120) : '',
    'Integration Feasibility': l.integration_feasibility || '',
    'Contacted At': l.contacted_at ? new Date(l.contacted_at).toLocaleDateString() : '',
    'Last Updated': new Date(l.updated_at).toLocaleDateString(),
  }))
}

function revenueHTML(leads: Lead[], generatedAt: string, quarter: string): string {
  const won = leads.filter(l => l.status === 'won')
  const inProgress = leads.filter(l => ['meeting_booked','proposal_sent','negotiating','integration'].includes(l.status))
  const meetings = leads.filter(l => l.status === 'meeting_booked')
  const lost = leads.filter(l => l.status === 'lost')

  const byProduct = leads.reduce<Record<string, number>>((acc, l) => {
    const p = l.product_to_sell || 'Unknown'
    acc[p] = (acc[p] || 0) + 1; return acc
  }, {})
  const productRows = Object.entries(byProduct).sort((a,b)=>b[1]-a[1])
    .map(([p, c]) => `<tr><td>${p}</td><td>${c}</td></tr>`).join('')

  const detailRows = leads.map(l => `
    <tr>
      <td title="${l.company_name}">${l.company_name}</td>
      <td>${statusBadge(l.status)}</td>
      <td>${l.product_to_sell || '—'}</td>
      <td title="${l.revenue_potential||''}">${l.revenue_potential ? l.revenue_potential.slice(0,60)+(l.revenue_potential.length>60?'…':'') : '—'}</td>
      <td>${l.region || '—'}</td>
      <td>${(l.customer_category||[]).join(', ') || '—'}</td>
      <td>${l.bd_brief?.bd_verdict?.fit || '—'}</td>
      <td>${l.integration_feasibility?.slice(0,40) || '—'}</td>
    </tr>`).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>QTR Revenue Attribution Report</title><style>${REPORT_STYLES}</style></head><body>
  <div class="header">
    <div><span class="kima-badge">KIMA FINANCE</span><span style="font-size:11px;color:rgba(255,255,255,0.4)">Confidential</span></div>
    <h1 style="margin-top:12px">QTR Revenue Attribution from Sales Report</h1>
    <div class="meta">Quarter: ${quarter} · Generated ${generatedAt} · Kima BD OS</div>
  </div>
  <div class="body">
    <div class="stats-row">
      <div class="stat"><div class="num">${won.length}</div><div class="lbl">Won Deals</div></div>
      <div class="stat"><div class="num">${inProgress.length}</div><div class="lbl">In Progress</div></div>
      <div class="stat"><div class="num">${meetings.length}</div><div class="lbl">At Meeting Stage</div></div>
      <div class="stat"><div class="num">${lost.length}</div><div class="lbl">Lost</div></div>
      <div class="stat"><div class="num">${leads.length}</div><div class="lbl">Total Tracked</div></div>
    </div>

    <div class="section-title">Revenue by Product</div>
    <table style="max-width:400px">
      <thead><tr><th>Product</th><th>Deal Count</th></tr></thead>
      <tbody>${productRows}</tbody>
    </table>

    <div class="section-title" style="margin-top:32px">Full Revenue Attribution Detail</div>
    <table>
      <thead><tr><th>Company</th><th>Status</th><th>Product</th><th>Revenue Potential</th><th>Region</th><th>Customer Category</th><th>BD Verdict</th><th>Integration Feasibility</th></tr></thead>
      <tbody>${detailRows}</tbody>
    </table>
    <div class="footer">Kima BD OS — QTR Revenue Attribution from Sales Report · Generated ${generatedAt}</div>
  </div>
</body></html>`
}

// ── Page Component ─────────────────────────────────────────────

type ExportFormat = 'csv' | 'html' | 'pdf'
type ReportKey = 'pipeline' | 'competitor' | 'revenue'

function getQuarter(date: Date): string {
  const q = Math.ceil((date.getMonth() + 1) / 3)
  return `Q${q} ${date.getFullYear()}`
}

export default function ExportReportsPage() {
  const supabase = createClient()
  const [pipelineLeads, setPipelineLeads] = useState<Lead[]>([])
  const [competitorLeads, setCompetitorLeads] = useState<Lead[]>([])
  const [revenueLeads, setRevenueLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()

    const [{ data: pipeline }, { data: competitor }, { data: revenue }] = await Promise.all([
      // Pipeline: all active pipeline leads (any age) + new leads discovered this week
      supabase
        .from('leads')
        .select('*')
        .or(`status.in.(contacted,replied,meeting_booked,proposal_sent,negotiating,integration,won,lost),created_at.gte.${sevenDaysAgo}`)
        .order('lead_score', { ascending: false }),
      // Competitor: leads with competitor OR current_providers data from last 90 days
      supabase
        .from('leads')
        .select('*')
        .gte('created_at', ninetyDaysAgo)
        .or('competitor_or_current_provider.not.is.null,current_providers.not.is.null')
        .order('lead_score', { ascending: false }),
      // Revenue: ALL leads in pipeline/closed stages regardless of age — QTR snapshot of the full funnel
      supabase
        .from('leads')
        .select('*')
        .in('status', ['won', 'lost', 'negotiating', 'proposal_sent', 'integration', 'meeting_booked'])
        .order('updated_at', { ascending: false }),
    ])

    setPipelineLeads(pipeline || [])
    setCompetitorLeads(competitor || [])
    setRevenueLeads(revenue || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  async function handleExport(report: ReportKey, format: ExportFormat) {
    const key = `${report}-${format}`
    setExporting(key)

    const now = new Date()
    const generatedAt = now.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })
    const quarter = getQuarter(now)
    const dateSlug = now.toISOString().slice(0, 10)

    try {
      if (report === 'pipeline') {
        if (format === 'csv') {
          downloadFile(toCSV(pipelineCSVRows(pipelineLeads)), `kima-bd-pipeline-${dateSlug}.csv`, 'text/csv;charset=utf-8;')
        } else {
          const html = pipelineHTML(pipelineLeads, generatedAt)
          if (format === 'html') downloadFile(html, `kima-bd-pipeline-${dateSlug}.html`, 'text/html;charset=utf-8;')
          else openPrintWindow(html)
        }
      } else if (report === 'competitor') {
        if (format === 'csv') {
          downloadFile(toCSV(competitorCSVRows(competitorLeads)), `kima-competitor-intelligence-${dateSlug}.csv`, 'text/csv;charset=utf-8;')
        } else {
          const html = competitorHTML(competitorLeads, generatedAt, quarter)
          if (format === 'html') downloadFile(html, `kima-competitor-intelligence-${dateSlug}.html`, 'text/html;charset=utf-8;')
          else openPrintWindow(html)
        }
      } else {
        if (format === 'csv') {
          downloadFile(toCSV(revenueCSVRows(revenueLeads)), `kima-revenue-attribution-${dateSlug}.csv`, 'text/csv;charset=utf-8;')
        } else {
          const html = revenueHTML(revenueLeads, generatedAt, quarter)
          if (format === 'html') downloadFile(html, `kima-revenue-attribution-${dateSlug}.html`, 'text/html;charset=utf-8;')
          else openPrintWindow(html)
        }
      }
      toast.success(`Report exported as ${format.toUpperCase()}`)
    } catch {
      toast.error('Export failed — please try again')
    } finally {
      setExporting(null)
    }
  }

  const pipeline_won = pipelineLeads.filter(l => l.status === 'won').length
  const pipeline_active = pipelineLeads.filter(l =>
    ['contacted','replied','meeting_booked','proposal_sent','negotiating','integration'].includes(l.status)
  ).length

  const reports: {
    key: ReportKey
    icon: React.ComponentType<{ size?: number; className?: string }>
    title: string
    subtitle: string
    color: string
    bg: string
    border: string
    stats: { label: string; value: number | string }[]
  }[] = [
    {
      key: 'pipeline',
      icon: BarChart3,
      title: 'Weekly BD Pipeline Report',
      subtitle: 'Active pipeline leads + all leads created this week. Includes status breakdown, conversion rates, follow-ups, and revenue potential.',
      color: '#a78bfa',
      bg: 'rgba(139,92,246,0.06)',
      border: 'rgba(139,92,246,0.18)',
      stats: [
        { label: 'Total Leads', value: pipelineLeads.length },
        { label: 'Active Pipeline', value: pipeline_active },
        { label: 'Won', value: pipeline_won },
      ],
    },
    {
      key: 'competitor',
      icon: Target,
      title: 'QTR Competitor Intelligence Report',
      subtitle: 'Leads from the last 90 days where a competitor or current provider is identified. Shows competitor frequency, products we\'d displace, and pain severity.',
      color: '#67e8f9',
      bg: 'rgba(6,182,212,0.06)',
      border: 'rgba(6,182,212,0.18)',
      stats: [
        { label: 'Leads with Competitor Data', value: competitorLeads.length },
        { label: 'High Pain Severity', value: competitorLeads.filter(l => l.pain_point_severity === 'critical' || l.pain_point_severity === 'high').length },
        { label: 'Unique Competitors', value: new Set(competitorLeads.map(l => l.competitor_or_current_provider || l.current_providers).filter(Boolean)).size },
      ],
    },
    {
      key: 'revenue',
      icon: TrendingUp,
      title: 'QTR Revenue Attribution from Sales',
      subtitle: 'All deals currently in meeting, proposal, negotiation, or integration stage, plus any won/lost deals. Includes revenue potential, BD verdict, and product attribution.',
      color: '#34d399',
      bg: 'rgba(52,211,153,0.06)',
      border: 'rgba(52,211,153,0.18)',
      stats: [
        { label: 'Won', value: revenueLeads.filter(l => l.status === 'won').length },
        { label: 'Meeting / Proposal / Negotiating', value: revenueLeads.filter(l => ['meeting_booked','proposal_sent','negotiating','integration'].includes(l.status)).length },
        { label: 'Lost', value: revenueLeads.filter(l => l.status === 'lost').length },
      ],
    },
  ]

  return (
    <div className="fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Export Reports</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>
            Download fresh reports as CSV, PDF, or HTML — data is pulled live from the database.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="btn btn-ghost"
          style={{ fontSize: '12px', gap: '6px' }}
        >
          {loading
            ? <Loader2 size={13} className="animate-spin" />
            : <RefreshCw size={13} />
          }
          Refresh Data
        </button>
      </div>

      <div className="p-8 space-y-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={28} className="animate-spin" style={{ color: '#a78bfa' }} />
            <p className="text-sm" style={{ color: 'rgb(100,100,120)' }}>Loading report data…</p>
          </div>
        ) : (
          reports.map(r => (
            <div
              key={r.key}
              className="rounded-xl p-6"
              style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: r.bg, border: `1px solid ${r.border}` }}
                >
                  <span style={{ color: r.color, display: 'flex' }}><r.icon size={18} /></span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-white mb-1">{r.title}</h2>
                  <p className="text-xs leading-relaxed mb-4" style={{ color: 'rgb(110,110,140)' }}>{r.subtitle}</p>

                  {/* Stats */}
                  <div className="flex gap-4 mb-5 flex-wrap">
                    {r.stats.map(s => (
                      <div key={s.label} className="flex items-center gap-1.5">
                        <span className="text-base font-bold" style={{ color: r.color }}>{s.value}</span>
                        <span className="text-xs" style={{ color: 'rgb(90,90,110)' }}>{s.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Export buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {(['csv', 'html', 'pdf'] as ExportFormat[]).map(fmt => {
                      const key = `${r.key}-${fmt}`
                      const busy = exporting === key
                      const icons = {
                        csv: Building2,
                        html: Globe,
                        pdf: FileText,
                      }
                      const Icon = icons[fmt]
                      const labels = { csv: 'Export CSV', html: 'Export HTML', pdf: 'Export PDF' }
                      return (
                        <button
                          key={fmt}
                          onClick={() => handleExport(r.key, fmt)}
                          disabled={busy || exporting !== null}
                          className="btn btn-ghost flex items-center gap-1.5"
                          style={{
                            fontSize: '12px',
                            padding: '6px 12px',
                            border: `1px solid ${r.border}`,
                            color: busy ? r.color : 'rgb(160,160,190)',
                            opacity: exporting !== null && !busy ? 0.5 : 1,
                          }}
                        >
                          {busy
                            ? <Loader2 size={12} className="animate-spin" style={{ color: r.color }} />
                            : <Icon size={12} style={{ color: r.color }} />
                          }
                          {busy ? 'Exporting…' : labels[fmt]}
                        </button>
                      )
                    })}
                    <div className="flex items-center ml-1">
                      <FileDown size={11} style={{ color: 'rgb(70,70,90)' }} />
                      <span className="text-xs ml-1" style={{ color: 'rgb(70,70,90)' }}>
                        {r.key === 'pipeline' ? pipelineLeads.length
                          : r.key === 'competitor' ? competitorLeads.length
                          : revenueLeads.length} rows
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Info box */}
        {!loading && (
          <div
            className="rounded-xl p-4 flex gap-3 items-start"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
          >
            <Trophy size={14} style={{ color: 'rgb(100,100,120)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="text-xs font-medium text-white mb-0.5">About these reports</p>
              <p className="text-xs leading-relaxed" style={{ color: 'rgb(90,90,110)' }}>
                <strong style={{ color: 'rgb(120,120,150)' }}>CSV</strong> — spreadsheet-ready, opens in Excel or Google Sheets. &nbsp;
                <strong style={{ color: 'rgb(120,120,150)' }}>HTML</strong> — a branded, self-contained web page you can email or archive. &nbsp;
                <strong style={{ color: 'rgb(120,120,150)' }}>PDF</strong> — opens your browser&apos;s print dialog; choose &ldquo;Save as PDF&rdquo; for a polished document.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
