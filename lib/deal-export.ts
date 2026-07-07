// ── Single-deal export — PDF & Word (.doc), for sharing one deal with the team ──

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  ACTIVITY_TYPES, dealStatusMeta, blockerLabel, fmtMonthYear,
} from './monthly-reports-types'
import type { MonthlyDeal, DealActivity } from './monthly-reports-types'

type PdfDoc = jsPDF & { lastAutoTable: { finalY: number } }

function pdfStatusColors(status: string): { bg: string; text: string } {
  if (status === 'closed_won') return { bg: '#d1fae5', text: '#065f46' }
  if (status === 'closed_lost') return { bg: '#fee2e2', text: '#991b1b' }
  if (['contacted', 'discovery', 'demo', 'technical_discussion', 'proposal_sent', 'negotiation'].includes(status)) return { bg: '#dbeafe', text: '#1e40af' }
  return { bg: '#f3f4f6', text: '#6b7280' }
}

function activityLabel(type: string): string {
  return ACTIVITY_TYPES.find(t => t.value === type)?.label ?? type.replace(/_/g, ' ')
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium' })
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'deal'
}

function dlFile(content: string | Blob, name: string, type?: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── PDF ──────────────────────────────────────────────────────────

export function exportDealPDF(deal: MonthlyDeal, activities: DealActivity[]) {
  const statusMeta = dealStatusMeta(deal.status)
  const statusColors = pdfStatusColors(deal.status)
  const openBlockers = (deal.blockers || []).filter(b => !b.resolved)
  const resolvedBlockers = (deal.blockers || []).filter(b => b.resolved)
  const pf = deal.product_feedback || {}
  const pfRows = (['feature_requested', 'missing_functionality', 'product_gaps', 'integration_requested', 'api_requirements', 'compliance_requirements', 'technical_blockers'] as const)
    .filter(k => pf[k]).map(k => [k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), pf[k] as string])

  const doc = new jsPDF({ unit: 'mm', format: 'a4' }) as PdfDoc
  const PAGE_W = 210, PAGE_H = 297, MARGIN = 14, CONTENT_W = PAGE_W - MARGIN * 2, FOOTER_H = 16
  let y = 0

  function newContinuationPage() {
    doc.addPage()
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor('#9ca3af')
    doc.text(`Kima BD OS — ${deal.company_name}`, PAGE_W - MARGIN, MARGIN, { align: 'right' })
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
  function fieldGrid(fields: [string, string | undefined][], cols = 2) {
    const items = fields.filter(([, v]) => v) as [string, string][]
    if (!items.length) return
    const colW = CONTENT_W / cols
    const doc2 = doc
    let rowY = y
    let maxRowH = 0
    items.forEach(([label, value], i) => {
      const col = i % cols
      if (col === 0 && i !== 0) { y += maxRowH + 5; rowY = y; maxRowH = 0 }
      const x = MARGIN + col * colW
      doc2.setFont('helvetica', 'bold'); doc2.setFontSize(7); doc2.setTextColor('#9ca3af')
      doc2.text(label.toUpperCase(), x, rowY)
      doc2.setFont('helvetica', 'normal'); doc2.setFontSize(9); doc2.setTextColor('#1f2937')
      const lines: string[] = doc2.splitTextToSize(value, colW - 6)
      doc2.text(lines, x, rowY + 4.5)
      maxRowH = Math.max(maxRowH, 4.5 + lines.length * 4.2)
    })
    y += maxRowH + 3
  }
  const tableTheme = {
    theme: 'plain' as const,
    styles: { fontSize: 8.5, cellPadding: 2.6, textColor: '#374151', lineColor: '#f0f0f0', lineWidth: 0.2, overflow: 'linebreak' as const },
    headStyles: { fillColor: '#f3f4f6', textColor: '#374151', fontStyle: 'bold' as const },
    alternateRowStyles: { fillColor: '#fafafa' },
  }

  // ── Cover band ───────────────────────────────────────────────
  doc.setFillColor('#0f0e17')
  doc.rect(0, 0, PAGE_W, 36, 'F')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor('#a29bc4')
  doc.text('Confidential · Deal Brief', MARGIN, 13.3)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor('#ffffff')
  doc.text(deal.company_name, MARGIN, 23.5)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor('#a29bc4')
  doc.text(`${statusMeta.label}   ·   ${fmtMonthYear(deal.month_year)}   ·   Generated ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}`, MARGIN, 30.5)

  // Status pill, top-right of the band
  doc.setFillColor(statusColors.bg)
  const pillW = doc.getTextWidth(statusMeta.label) + 8
  doc.roundedRect(PAGE_W - MARGIN - pillW, 9, pillW, 7, 2, 2, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(statusColors.text)
  doc.text(statusMeta.label, PAGE_W - MARGIN - pillW / 2, 13.7, { align: 'center' })

  y = 46

  // ── Company Information ───────────────────────────────────────
  sectionTitle('Company Information', 20)
  fieldGrid([
    ['Individual', deal.individual_name ? `${deal.individual_name}${deal.designation ? ` · ${deal.designation}` : ''}` : undefined],
    ['Country', deal.country],
    ['Industry', deal.industry],
    ['Website', deal.website],
    ['Outreach Channel', deal.outreach_channel],
    ['Expected Close', deal.expected_close_date],
    ['Lead Type', deal.lead_type],
    ['Owner', deal.owner],
  ])
  y += 4

  // ── Opportunity Details ─────────────────────────────────────────
  if (deal.requirement || deal.problem_statement || deal.products_interested?.length) {
    sectionTitle('Opportunity Details', 20)
    fieldGrid([
      ['Requirement', deal.requirement],
      ['Problem Statement', deal.problem_statement],
    ], 1)
    if (deal.products_interested?.length) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor('#9ca3af')
      doc.text('PRODUCTS INTERESTED IN', MARGIN, y)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor('#1f2937')
      doc.text(deal.products_interested.join(', '), MARGIN, y + 4.5, { maxWidth: CONTENT_W })
      y += 10
    }
    y += 3
  }

  // ── Business Potential ──────────────────────────────────────────
  sectionTitle('Business Potential', 20)
  fieldGrid([
    ['Monthly Volume', deal.expected_monthly_volume],
    ['Yearly Volume', deal.expected_yearly_volume],
    ['Revenue Opportunity', deal.estimated_revenue],
    ['Geographic Corridor', deal.geographic_corridor],
    ['Strategic Importance', deal.strategic_importance?.toUpperCase()],
    ['End Users', deal.end_users_count],
  ])
  y += 4

  // ── Business Impact ─────────────────────────────────────────────
  if (deal.business_impact || deal.why_valuable || deal.long_term_value) {
    sectionTitle('Business Impact', 20)
    fieldGrid([
      ['Impact', deal.business_impact],
      ['Why Valuable', deal.why_valuable],
      ['Long-term Value', deal.long_term_value],
    ], 1)
    y += 3
  }

  // ── Product Feedback ────────────────────────────────────────────
  if (pfRows.length) {
    sectionTitle('Product Feedback', 10)
    autoTable(doc, {
      ...tableTheme, startY: y, margin: { left: MARGIN },
      head: [['Area', 'Detail']],
      body: pfRows,
      columnStyles: { 0: { cellWidth: 38, fontStyle: 'bold' } },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // ── Blockers ─────────────────────────────────────────────────────
  if (openBlockers.length || resolvedBlockers.length) {
    sectionTitle('Blockers', 10)
    autoTable(doc, {
      ...tableTheme, startY: y, margin: { left: MARGIN },
      head: [['Blocker', 'Status', 'Notes']],
      body: [
        ...openBlockers.map(b => [blockerLabel(b), 'Open', b.notes ?? '']),
        ...resolvedBlockers.map(b => [blockerLabel(b), 'Resolved', b.notes ?? '']),
      ],
      didParseCell: data => {
        if (data.section === 'body' && data.column.index === 1) {
          const open = data.cell.raw === 'Open'
          data.cell.styles.fillColor = open ? '#fef2f2' : '#f0fdf4'
          data.cell.styles.textColor = open ? '#991b1b' : '#065f46'
          data.cell.styles.fontStyle = 'bold'
        }
      },
      columnStyles: { 1: { cellWidth: 22 } },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // ── Activity Timeline ────────────────────────────────────────────
  if (activities.length) {
    sectionTitle(`Activity Timeline — ${activities.length} Entr${activities.length === 1 ? 'y' : 'ies'}`, 10)
    autoTable(doc, {
      ...tableTheme, startY: y, margin: { left: MARGIN },
      head: [['Date', 'Type', 'Details']],
      body: activities.map(a => [fmtDateTime(a.created_at), activityLabel(a.activity_type), a.content ?? '']),
      columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 28, fontStyle: 'bold' } },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // ── Notes ──────────────────────────────────────────────────────
  if (deal.notes) {
    sectionTitle('Notes', 10)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor('#374151')
    const lines: string[] = doc.splitTextToSize(deal.notes, CONTENT_W)
    ensureSpace(lines.length * 4.8)
    doc.text(lines, MARGIN, y, { lineHeightFactor: 1.5 })
    y += lines.length * 4.8 + 4
  }

  // ── Footer on every page ────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setDrawColor('#e5e7eb'); doc.setLineWidth(0.2)
    doc.line(MARGIN, PAGE_H - 13, PAGE_W - MARGIN, PAGE_H - 13)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor('#9ca3af')
    doc.text(`Kima BD OS   ·   Deal Brief   ·   ${deal.company_name}`, MARGIN, PAGE_H - 8)
    doc.text(`Page ${p} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' })
  }

  doc.save(`kima-deal-${slug(deal.company_name)}.pdf`)
}

// ── Word (.doc) ──────────────────────────────────────────────────
// Word opens well-formed HTML saved with a .doc extension / application/msword
// MIME type natively — this avoids pulling in a full docx-generation library
// for what is, structurally, the same content as the PDF export.

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
}

function docSection(title: string): string {
  return `<h2 style="font-size:13px;color:#6b7280;letter-spacing:0.5px;text-transform:uppercase;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin:22px 0 10px;">${esc(title)}</h2>`
}

function docFieldTable(fields: [string, string | undefined][]): string {
  const items = fields.filter(([, v]) => v) as [string, string][]
  if (!items.length) return ''
  const rows = items.map(([label, value]) => `
    <tr>
      <td style="width:32%;vertical-align:top;padding:6px 10px 6px 0;font-size:10px;font-weight:bold;color:#9ca3af;text-transform:uppercase;">${esc(label)}</td>
      <td style="vertical-align:top;padding:6px 0;font-size:12px;color:#1f2937;">${esc(value)}</td>
    </tr>`).join('')
  return `<table style="width:100%;border-collapse:collapse;">${rows}</table>`
}

function docDataTable(head: string[], body: string[][]): string {
  const headRow = head.map(h => `<th style="text-align:left;padding:6px 8px;background:#f3f4f6;color:#374151;font-size:10.5px;border:1px solid #e5e7eb;">${esc(h)}</th>`).join('')
  const bodyRows = body.map(row => `<tr>${row.map(cell => `<td style="padding:6px 8px;font-size:11px;color:#374151;border:1px solid #e5e7eb;">${esc(cell)}</td>`).join('')}</tr>`).join('')
  return `<table style="width:100%;border-collapse:collapse;margin-top:4px;"><thead><tr>${headRow}</tr></thead><tbody>${bodyRows}</tbody></table>`
}

export function exportDealDoc(deal: MonthlyDeal, activities: DealActivity[]) {
  const statusMeta = dealStatusMeta(deal.status)
  const openBlockers = (deal.blockers || []).filter(b => !b.resolved)
  const resolvedBlockers = (deal.blockers || []).filter(b => b.resolved)
  const pf = deal.product_feedback || {}
  const pfRows = (['feature_requested', 'missing_functionality', 'product_gaps', 'integration_requested', 'api_requirements', 'compliance_requirements', 'technical_blockers'] as const)
    .filter(k => pf[k]).map(k => [k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), pf[k] as string])

  const sections: string[] = []

  sections.push(docSection('Company Information') + docFieldTable([
    ['Individual', deal.individual_name ? `${deal.individual_name}${deal.designation ? ` · ${deal.designation}` : ''}` : undefined],
    ['Country', deal.country],
    ['Industry', deal.industry],
    ['Website', deal.website],
    ['Outreach Channel', deal.outreach_channel],
    ['Expected Close', deal.expected_close_date],
    ['Lead Type', deal.lead_type],
    ['Owner', deal.owner],
  ]))

  if (deal.requirement || deal.problem_statement || deal.products_interested?.length) {
    sections.push(docSection('Opportunity Details') + docFieldTable([
      ['Requirement', deal.requirement],
      ['Problem Statement', deal.problem_statement],
      ['Products Interested In', deal.products_interested?.join(', ')],
    ]))
  }

  sections.push(docSection('Business Potential') + docFieldTable([
    ['Monthly Volume', deal.expected_monthly_volume],
    ['Yearly Volume', deal.expected_yearly_volume],
    ['Revenue Opportunity', deal.estimated_revenue],
    ['Geographic Corridor', deal.geographic_corridor],
    ['Strategic Importance', deal.strategic_importance?.toUpperCase()],
    ['End Users', deal.end_users_count],
  ]))

  if (deal.business_impact || deal.why_valuable || deal.long_term_value) {
    sections.push(docSection('Business Impact') + docFieldTable([
      ['Impact', deal.business_impact],
      ['Why Valuable', deal.why_valuable],
      ['Long-term Value', deal.long_term_value],
    ]))
  }

  if (pfRows.length) {
    sections.push(docSection('Product Feedback') + docDataTable(['Area', 'Detail'], pfRows))
  }

  if (openBlockers.length || resolvedBlockers.length) {
    sections.push(docSection('Blockers') + docDataTable(['Blocker', 'Status', 'Notes'], [
      ...openBlockers.map(b => [blockerLabel(b), 'Open', b.notes ?? '']),
      ...resolvedBlockers.map(b => [blockerLabel(b), 'Resolved', b.notes ?? '']),
    ]))
  }

  if (activities.length) {
    sections.push(docSection(`Activity Timeline — ${activities.length} Entr${activities.length === 1 ? 'y' : 'ies'}`) + docDataTable(
      ['Date', 'Type', 'Details'],
      activities.map(a => [fmtDateTime(a.created_at), activityLabel(a.activity_type), a.content ?? '']),
    ))
  }

  if (deal.notes) {
    sections.push(docSection('Notes') + `<p style="font-size:12px;color:#374151;line-height:1.6;">${esc(deal.notes)}</p>`)
  }

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${esc(deal.company_name)} — Deal Brief</title>
<!--[if gte mso 9]>
<xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml>
<![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; color: #1f2937; }
  h1 { font-size: 22px; margin: 0 0 4px; }
</style>
</head>
<body>
  <div style="background:#0f0e17;padding:18px 24px;margin-bottom:18px;">
    <div style="color:#a29bc4;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Confidential · Deal Brief</div>
    <h1 style="color:#ffffff;">${esc(deal.company_name)}</h1>
    <div style="color:#a29bc4;font-size:11px;">${esc(statusMeta.label)} &middot; ${esc(fmtMonthYear(deal.month_year))} &middot; Generated ${esc(new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }))}</div>
  </div>
  ${sections.join('\n')}
  <p style="margin-top:28px;font-size:9px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:8px;">Kima BD OS &middot; Deal Brief &middot; ${esc(deal.company_name)}</p>
</body>
</html>`

  dlFile(html, `kima-deal-${slug(deal.company_name)}.doc`, 'application/msword')
}
