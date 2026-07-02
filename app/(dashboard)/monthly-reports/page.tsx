'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { toast } from 'sonner'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  Plus, Search, Download, FileText, TrendingUp, Users,
  Trophy, XCircle, Calendar, BarChart2, Loader2, RefreshCw,
  Building2, ChevronDown, AlertCircle, Send, Reply, Sparkles,
  Zap, Settings2, Target, DollarSign, RotateCcw,
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
import { TimeAllocationSection, timeByResponsibility, TIME_PIE_COLORS } from '@/components/monthly-reports/time-allocation-section'

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

type PdfDoc = jsPDF & { lastAutoTable: { finalY: number } }

// Status → badge colors used in the pipeline table (mirrors the on-screen StatusBadge palette).
function pdfStatusColors(status: string): { bg: string; text: string } {
  if (status === 'closed_won') return { bg: '#d1fae5', text: '#065f46' }
  if (status === 'closed_lost') return { bg: '#fee2e2', text: '#991b1b' }
  if (['contacted', 'discovery', 'demo', 'technical_discussion', 'proposal_sent', 'negotiation'].includes(status)) return { bg: '#dbeafe', text: '#1e40af' }
  return { bg: '#f3f4f6', text: '#6b7280' }
}

function exportPDF(deals: MonthlyDeal[], activities: DealActivity[], month: string, outreach: OutreachStats, timeEntries: TimeAllocation[], narrative?: string, kpiOverrides: Record<string, number> = {}) {
  const label = fmtMonthYear(month)
  const won     = deals.filter(d => d.status === 'closed_won')
  const lost    = deals.filter(d => d.status === 'closed_lost')
  const active  = deals.filter(d => !['closed_won','closed_lost'].includes(d.status))
  const meetings   = activities.filter(a => a.activity_type === 'meeting').length + outreach.meetingsBooked
  const followUps  = activities.filter(a => a.activity_type === 'follow_up').length + outreach.followUpsSent
  const uniqueCos  = new Set(deals.map(d => d.company_name)).size

  // Hero KPI badges reflect whatever's currently on screen (including any
  // unsaved presentation-mode edits) — everything below (deal tables, wins,
  // blockers) always reflects the real underlying records.
  const heroTotalOutreach       = kpiOverrides.total_outreach ?? outreach.totalOutreach
  const heroCompaniesContacted  = kpiOverrides.companies_contacted ?? outreach.companiesContacted
  const heroIndividualsContacted = kpiOverrides.individuals_contacted ?? outreach.individualsContacted
  const heroReplies             = kpiOverrides.replies ?? outreach.replies
  const heroActive              = kpiOverrides.active_pipeline ?? active.length
  const heroWon                 = kpiOverrides.won ?? won.length
  const heroLost                = kpiOverrides.lost ?? lost.length
  const heroMeetings            = kpiOverrides.meetings ?? meetings

  // Channel breakdown (deal-level channel + raw outreach touches)
  const ch: Record<string, number> = { ...outreach.channelBreakdown }
  deals.forEach(d => { if (d.outreach_channel) ch[d.outreach_channel] = (ch[d.outreach_channel] || 0) + 1 })
  const chRows = Object.entries(ch).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
    const meta = OUTREACH_CHANNELS.find(c => c.value === k)
    return [meta?.label ?? k, String(v)]
  })

  // Companies contacted by category
  const categoryRows = Object.entries(outreach.companyCategoryBreakdown).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => [k, String(v)])

  // Time allocation — by responsibility, as % of time
  const timeByResp = timeByResponsibility(timeEntries)
  const totalTimePct = timeByResp.reduce((a, b) => a + b.value, 0)

  // Product feedback themes — every filled field, not just a subset
  const pfItems: string[] = []
  deals.forEach(d => {
    const pf = d.product_feedback || {}
    ;(['feature_requested','missing_functionality','product_gaps','integration_requested','api_requirements','compliance_requirements','technical_blockers'] as const).forEach(key => {
      const v = pf[key]
      if (v) pfItems.push(`${d.company_name}: ${v.slice(0, 140)}`)
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
    .sort((a, b) => (a.expected_close_date ?? '') < (b.expected_close_date ?? '') ? -1 : 1)
    .slice(0, 5)

  // ── Document setup ────────────────────────────────────────────
  const doc = new jsPDF({ unit: 'mm', format: 'a4' }) as PdfDoc
  const PAGE_W = 210, PAGE_H = 297, MARGIN = 14, CONTENT_W = PAGE_W - MARGIN * 2, FOOTER_H = 16
  let y = 0

  function newContinuationPage() {
    doc.addPage()
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor('#7c3aed')
    doc.text('KIMA FINANCE', MARGIN, MARGIN)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor('#9ca3af')
    doc.text(`Monthly BD Performance Report — ${label}`, PAGE_W - MARGIN, MARGIN, { align: 'right' })
    doc.setDrawColor('#e5e7eb'); doc.setLineWidth(0.3)
    doc.line(MARGIN, MARGIN + 2, PAGE_W - MARGIN, MARGIN + 2)
    y = MARGIN + 10
  }
  function ensureSpace(needed: number) {
    if (y + needed > PAGE_H - FOOTER_H) newContinuationPage()
  }
  function sectionTitle(title: string, reserve: number = 0) {
    ensureSpace(9 + reserve)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor('#6b7280')
    doc.text(title.toUpperCase(), MARGIN, y)
    doc.setDrawColor('#e5e7eb'); doc.setLineWidth(0.3)
    doc.line(MARGIN, y + 2.2, PAGE_W - MARGIN, y + 2.2)
    y += 9
  }
  const tableTheme = {
    theme: 'plain' as const,
    styles: { fontSize: 8.5, cellPadding: 2.6, textColor: '#374151', lineColor: '#f0f0f0', lineWidth: 0.2, overflow: 'linebreak' as const },
    headStyles: { fillColor: '#f3f4f6', textColor: '#374151', fontStyle: 'bold' as const },
    alternateRowStyles: { fillColor: '#fafafa' },
  }

  // ── Cover band ─────────────────────────────────────────────────
  doc.setFillColor('#0f0e17')
  doc.rect(0, 0, PAGE_W, 36, 'F')
  doc.setFillColor('#6d28d9')
  doc.roundedRect(MARGIN, 9, 28, 6.4, 1.2, 1.2, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor('#ffffff')
  doc.text('KIMA FINANCE', MARGIN + 14, 13.3, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor('#a29bc4')
  doc.text('Confidential', MARGIN + 33, 13.3)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor('#ffffff')
  doc.text('Monthly BD Performance Report', MARGIN, 23.5)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor('#a29bc4')
  doc.text(`${label}   ·   Generated ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}   ·   Kima BD OS`, MARGIN, 30.5)
  y = 46

  // ── Executive Summary ─────────────────────────────────────────
  const kpis: [string, number][] = [
    ['Total Outreach', heroTotalOutreach], ['Companies Contacted', heroCompaniesContacted],
    ['Individuals Contacted', heroIndividualsContacted], ['Replies', heroReplies],
    ['Total Deals', deals.length], ['Companies (Deals)', uniqueCos],
    ['Active', heroActive], ['Won', heroWon],
    ['Lost', heroLost], ['Meetings', heroMeetings],
    ['Follow-ups', followUps],
  ]
  const KPI_COLS = 4, KPI_GAP = 4, KPI_ROW_H = 19
  const kpiColW = (CONTENT_W - KPI_GAP * (KPI_COLS - 1)) / KPI_COLS
  const kpiRows = Math.ceil(kpis.length / KPI_COLS)
  sectionTitle('Executive Summary', kpiRows * (KPI_ROW_H + KPI_GAP))
  kpis.forEach(([kLabel, val], i) => {
    const col = i % KPI_COLS, row = Math.floor(i / KPI_COLS)
    const x = MARGIN + col * (kpiColW + KPI_GAP)
    const cardY = y + row * (KPI_ROW_H + KPI_GAP)
    doc.setFillColor('#f7f6fc'); doc.setDrawColor('#e0dcf0'); doc.setLineWidth(0.25)
    doc.roundedRect(x, cardY, kpiColW, KPI_ROW_H, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor('#5b21b6')
    doc.text(String(val), x + 5, cardY + 10.5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor('#6b7280')
    doc.text(kLabel, x + 5, cardY + 15.8, { maxWidth: kpiColW - 8 })
  })
  y += kpiRows * (KPI_ROW_H + KPI_GAP) + 5

  // ── AI Monthly Summary ────────────────────────────────────────
  if (narrative) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5)
    const lines = doc.splitTextToSize(narrative, CONTENT_W)
    sectionTitle('AI Monthly Summary', Math.min(lines.length, 8) * 4.8 + 4)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor('#374151')
    doc.text(lines, MARGIN, y, { lineHeightFactor: 1.5 })
    y += lines.length * 4.8 + 8
  }

  // ── Outreach by Channel + Companies Contacted by Category (side by side) ──
  if (chRows.length || categoryRows.length) {
    sectionTitle('Outreach Breakdown', Math.max(chRows.length, categoryRows.length) * 6.2)
    const halfW = (CONTENT_W - 8) / 2
    const blockStartY = y
    let leftEnd = y, rightEnd = y
    if (chRows.length) {
      autoTable(doc, { ...tableTheme, startY: y, margin: { left: MARGIN }, tableWidth: halfW,
        head: [['Channel', 'Count']], body: chRows, columnStyles: { 1: { cellWidth: 20, halign: 'right' } } })
      leftEnd = doc.lastAutoTable.finalY
    }
    if (categoryRows.length) {
      autoTable(doc, { ...tableTheme, startY: blockStartY, margin: { left: MARGIN + halfW + 8 }, tableWidth: halfW,
        head: [['Category', 'Count']], body: categoryRows, columnStyles: { 1: { cellWidth: 20, halign: 'right' } } })
      rightEnd = doc.lastAutoTable.finalY
    }
    y = Math.max(leftEnd, rightEnd) + 8
  }

  // ── Time Allocation ────────────────────────────────────────────
  if (timeByResp.length) {
    sectionTitle(`Time Allocation — ${totalTimePct}% of Time Logged`, timeByResp.length * 8)
    autoTable(doc, {
      ...tableTheme, startY: y, margin: { left: MARGIN },
      head: [['Responsibility', '%']],
      body: timeByResp.map(t => [t.name, `${t.value}%`]),
      styles: { ...tableTheme.styles, cellPadding: { top: 3, bottom: 3, right: 3, left: 8 } },
      columnStyles: { 1: { cellWidth: 20, halign: 'right', fontStyle: 'bold' } },
      didDrawCell: data => {
        if (data.section === 'body' && data.column.index === 0) {
          doc.setFillColor(TIME_PIE_COLORS[data.row.index % TIME_PIE_COLORS.length])
          doc.circle(data.cell.x + 3, data.cell.y + data.cell.height / 2, 1.1, 'F')
        }
      },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // ── Full Pipeline ──────────────────────────────────────────────
  sectionTitle(`Full Pipeline — ${deals.length} Deal${deals.length === 1 ? '' : 's'}`, 10)
  autoTable(doc, {
    ...tableTheme, startY: y, margin: { left: MARGIN, top: MARGIN + 10 },
    head: [['Company', 'Individual', 'Country', 'Type', 'Status', 'Monthly Vol.', 'Revenue Opp.', 'Importance', 'Close Date', 'Open Blockers']],
    body: deals.map(d => [
      d.company_name ?? '', d.individual_name ?? '', d.country ?? '', d.lead_type ?? '',
      dealStatusMeta(d.status).label, d.expected_monthly_volume ?? '', d.estimated_revenue ?? '',
      d.strategic_importance ?? '', d.expected_close_date ?? '',
      (d.blockers || []).filter(b => !b.resolved).map(b => blockerLabel(b)).join(', '),
    ]),
    styles: { ...tableTheme.styles, fontSize: 7.5 },
    headStyles: { ...tableTheme.headStyles, fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold', textColor: '#1a1a2e' }, 1: { cellWidth: 19 },
      2: { cellWidth: 18 }, 3: { cellWidth: 10 }, 4: { cellWidth: 19 }, 5: { cellWidth: 15 },
      6: { cellWidth: 16 }, 7: { cellWidth: 15 }, 8: { cellWidth: 19 }, 9: { cellWidth: 29 },
    },
    didParseCell: data => {
      if (data.section === 'body' && data.column.index === 4) {
        const s = pdfStatusColors(deals[data.row.index].status)
        data.cell.styles.fillColor = s.bg
        data.cell.styles.textColor = s.text
        data.cell.styles.fontStyle = 'bold'
      }
    },
    didDrawPage: data => { if (data.pageNumber > 1) newContinuationPage() },
  })
  y = doc.lastAutoTable.finalY + 8

  // ── Wins This Month ────────────────────────────────────────────
  if (won.length) {
    sectionTitle('Wins This Month', 20)
    won.forEach(d => {
      const desc = (d.business_impact || d.why_valuable || '').slice(0, 220)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
      const descLines: string[] = desc ? doc.splitTextToSize(desc, CONTENT_W - 12) : []
      const cardH = 8 + descLines.length * 4.2 + 3
      ensureSpace(cardH + 3)
      doc.setFillColor('#f0fdf4')
      doc.rect(MARGIN, y, CONTENT_W, cardH, 'F')
      doc.setFillColor('#34d399')
      doc.rect(MARGIN, y, 1.2, cardH, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor('#1a1a2e')
      doc.text(d.company_name + (d.individual_name ? `   ·   ${d.individual_name}` : ''), MARGIN + 5, y + 6)
      if (descLines.length) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor('#374151')
        doc.text(descLines, MARGIN + 5, y + 11)
      }
      y += cardH + 3
    })
    y += 4
  }

  // ── Product Feedback Collected ─────────────────────────────────
  if (pfItems.length) {
    sectionTitle(`Product Feedback Collected (${pfItems.length} Items)`, 10)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor('#374151')
    pfItems.slice(0, 12).forEach(item => {
      const lines: string[] = doc.splitTextToSize(`•  ${item}`, CONTENT_W - 4)
      ensureSpace(lines.length * 4.3 + 1.5)
      doc.text(lines, MARGIN, y + 3)
      y += lines.length * 4.3 + 1.5
    })
    y += 4
  }

  // ── Active Blockers ────────────────────────────────────────────
  if (Object.keys(blockerCount).length) {
    sectionTitle('Active Blockers', Object.keys(blockerCount).length * 6.2)
    autoTable(doc, {
      ...tableTheme, startY: y, margin: { left: MARGIN }, tableWidth: 100,
      head: [['Blocker', 'Count']],
      body: Object.values(blockerCount).sort((a, b) => b.count - a.count).map(b => [b.label, String(b.count)]),
      headStyles: { fillColor: '#fef2f2', textColor: '#991b1b', fontStyle: 'bold' },
      columnStyles: { 1: { cellWidth: 18, halign: 'right' } },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // ── Next Month Priorities ──────────────────────────────────────
  if (priorities.length) {
    sectionTitle('Next Month Priorities', priorities.length * 6.5)
    priorities.forEach(d => {
      ensureSpace(6.5)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor('#1a1a2e')
      doc.text(d.company_name, MARGIN, y + 3.5)
      const w = doc.getTextWidth(d.company_name)
      doc.setFont('helvetica', 'normal'); doc.setTextColor('#6b7280')
      doc.text(`   —   ${dealStatusMeta(d.status).label}   ·   Close: ${d.expected_close_date}`, MARGIN + w, y + 3.5)
      y += 6.5
    })
  }

  // ── Footer on every page ───────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setDrawColor('#e5e7eb'); doc.setLineWidth(0.2)
    doc.line(MARGIN, PAGE_H - 13, PAGE_W - MARGIN, PAGE_H - 13)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor('#9ca3af')
    doc.text(`Kima BD OS   ·   Monthly BD Performance Report   ·   ${label}`, MARGIN, PAGE_H - 8)
    doc.text(`Page ${p} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' })
  }

  doc.save(`kima-bd-report-${month}.pdf`)
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
  const [fakeOverrides, setFakeOverrides] = useState<Record<string, number>>({})
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

  // Real value for a KPI — any persisted override (e.g. outreach logged outside the
  // tracked systems) takes precedence over the auto-computed number.
  const kpiValue = (key: string, computed: number) => overrides[key] ?? computed

  // Presentation-mode ("fake") layer — session-only, never written to the database.
  // Editing one Overview KPI scales the other KPIs in its funnel by the same ratio;
  // Reset to Real Numbers clears the whole layer at once.
  const OUTREACH_FUNNEL = ['total_outreach', 'companies_contacted', 'individuals_contacted', 'replies', 'meetings']
  const PIPELINE_FUNNEL = ['active_pipeline', 'won', 'lost']
  const funnelFor = (key: string) => OUTREACH_FUNNEL.includes(key) ? OUTREACH_FUNNEL : PIPELINE_FUNNEL.includes(key) ? PIPELINE_FUNNEL : [key]
  const baseKpiValues: Record<string, number> = {
    total_outreach: kpiValue('total_outreach', outreachStats.totalOutreach),
    companies_contacted: kpiValue('companies_contacted', outreachStats.companiesContacted),
    individuals_contacted: kpiValue('individuals_contacted', outreachStats.individualsContacted),
    replies: kpiValue('replies', outreachStats.replies),
    active_pipeline: kpiValue('active_pipeline', active),
    won: kpiValue('won', won),
    lost: kpiValue('lost', lost),
    meetings: kpiValue('meetings', meetings),
  }
  const displayValue = (key: string, computed: number) => fakeOverrides[key] ?? kpiValue(key, computed)
  function applyFakeEdit(key: string, newValue: number) {
    const base = baseKpiValues[key] ?? 0
    const ratio = base !== 0 ? newValue / base : null
    setFakeOverrides(prev => {
      const next = { ...prev }
      funnelFor(key).forEach(k => {
        next[k] = k === key ? newValue : ratio !== null ? Math.round((baseKpiValues[k] ?? 0) * ratio) : baseKpiValues[k] ?? 0
      })
      return next
    })
  }
  function resetFakeEdit(key: string) {
    setFakeOverrides(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }
  function resetAllFakeEdits() {
    setFakeOverrides({})
  }

  async function addTimeEntry(responsibility: string, percentage: number) {
    const { data, error } = await supabase.from('time_allocations')
      .insert({ month_year: month, responsibility, percentage }).select().single()
    if (error) { toast.error('Failed to save — run supabase/simplify-time-allocations.sql'); return }
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
                <button onClick={() => { exportPDF(deals, activities, month, outreachStats, timeEntries, narrative || undefined, fakeOverrides); setExportOpen(false) }}
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
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgb(80,85,115)' }}>
                  {fmtMonthYear(month)} — Overview
                </div>
                {Object.keys(fakeOverrides).length > 0 && (
                  <button onClick={resetAllFakeEdits} className="btn btn-secondary flex items-center gap-1.5" style={{ fontSize: '11px', padding: '5px 10px' }}>
                    <RotateCcw size={11} />Reset to Real Numbers
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                <KpiCard label="Total Outreach"        value={displayValue('total_outreach', outreachStats.totalOutreach)}             color="#22d3ee" icon={Send}      loading={loading}
                  editable isOverridden={fakeOverrides.total_outreach != null} onEditSave={v => applyFakeEdit('total_outreach', v)} onResetOverride={() => resetFakeEdit('total_outreach')} />
                <KpiCard label="Companies Contacted"   value={displayValue('companies_contacted', outreachStats.companiesContacted)}   color="#67e8f9" icon={Building2} loading={loading}
                  editable isOverridden={fakeOverrides.companies_contacted != null} onEditSave={v => applyFakeEdit('companies_contacted', v)} onResetOverride={() => resetFakeEdit('companies_contacted')} />
                <KpiCard label="Individuals Contacted" value={displayValue('individuals_contacted', outreachStats.individualsContacted)} color="#c084fc" icon={Users}     loading={loading}
                  editable isOverridden={fakeOverrides.individuals_contacted != null} onEditSave={v => applyFakeEdit('individuals_contacted', v)} onResetOverride={() => resetFakeEdit('individuals_contacted')} />
                <KpiCard label="Replies"               value={displayValue('replies', outreachStats.replies)}                          color="#34d399" icon={Reply}     loading={loading}
                  sub={outreachStats.totalOutreach > 0 ? `${Math.round((outreachStats.replies / outreachStats.totalOutreach) * 100)}% reply rate` : undefined}
                  editable isOverridden={fakeOverrides.replies != null} onEditSave={v => applyFakeEdit('replies', v)} onResetOverride={() => resetFakeEdit('replies')} />
                <KpiCard label="Active Pipeline"       value={displayValue('active_pipeline', active)}                                  color="#60a5fa" icon={TrendingUp} loading={loading}
                  editable isOverridden={fakeOverrides.active_pipeline != null} onEditSave={v => applyFakeEdit('active_pipeline', v)} onResetOverride={() => resetFakeEdit('active_pipeline')} />
                <KpiCard label="Won"                   value={displayValue('won', won)}                                                color="#4ade80" icon={Trophy}    loading={loading}
                  editable isOverridden={fakeOverrides.won != null} onEditSave={v => applyFakeEdit('won', v)} onResetOverride={() => resetFakeEdit('won')} />
                <KpiCard label="Lost"                  value={displayValue('lost', lost)}                                              color="#f87171" icon={XCircle}   loading={loading}
                  editable isOverridden={fakeOverrides.lost != null} onEditSave={v => applyFakeEdit('lost', v)} onResetOverride={() => resetFakeEdit('lost')} />
                <KpiCard label="Meetings"              value={displayValue('meetings', meetings)}                                      color="#fb923c" icon={Calendar}  loading={loading}
                  sub={`${followUps} follow-ups`}
                  editable isOverridden={fakeOverrides.meetings != null} onEditSave={v => applyFakeEdit('meetings', v)} onResetOverride={() => resetFakeEdit('meetings')} />
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
