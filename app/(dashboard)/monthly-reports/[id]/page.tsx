'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, Pencil, Trash2, Building2, Target,
  DollarSign, TrendingUp, AlertTriangle, Lightbulb, Activity, StickyNote,
  Download, ChevronDown, FileText,
} from 'lucide-react'
import DealForm from '@/components/monthly-reports/DealForm'
import type { DealFormData } from '@/components/monthly-reports/DealForm'
import ActivityTimeline from '@/components/monthly-reports/ActivityTimeline'
import type { NewActivityInput } from '@/components/monthly-reports/ActivityTimeline'
import { dealStatusMeta, fmtMonthYear, blockerLabel } from '@/lib/monthly-reports-types'
import type { MonthlyDeal, DealActivity } from '@/lib/monthly-reports-types'
import { SectionHeader } from '@/components/monthly-reports/ui'
import { exportDealPDF, exportDealDoc } from '@/lib/deal-export'

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'rgb(100,106,135)' }}>{label}</div>
      <div className="text-sm" style={{ color: 'rgb(200,200,225)' }}>{value}</div>
    </div>
  )
}

export default function DealDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [deal, setDeal] = useState<MonthlyDeal | null>(null)
  const [activities, setActivities] = useState<DealActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addingActivity, setAddingActivity] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: d, error }, { data: acts }] = await Promise.all([
      supabase.from('monthly_deals').select('*').eq('id', params.id).single(),
      supabase.from('deal_activities').select('*').eq('deal_id', params.id).order('created_at', { ascending: false }),
    ])
    if (error || !d) {
      toast.error('Deal not found')
      router.push('/monthly-reports')
      return
    }
    setDeal(d as MonthlyDeal)
    setActivities((acts || []) as DealActivity[])
    setLoading(false)
  }, [params.id, supabase, router])

  useEffect(() => { load() }, [load])

  async function handleSave(data: DealFormData) {
    setSaving(true)
    const { error } = await supabase.from('monthly_deals').update({
      ...data,
      // "" is not a valid Postgres `date` — an unset close date must be null.
      expected_close_date: data.expected_close_date || null,
      // Nothing on this form is required — company_name is NOT NULL in the
      // DB, so fall back to the individual's name, then a placeholder.
      company_name: data.company_name.trim() || data.individual_name.trim() || 'Untitled Deal',
    }).eq('id', params.id)
    if (error) {
      toast.error(error.message)
      setSaving(false)
      return
    }
    toast.success('Deal updated')
    setEditing(false)
    setSaving(false)
    load()
  }

  async function handleDelete() {
    if (!confirm(`Delete the deal for ${deal?.company_name}? This cannot be undone.`)) return
    setDeleting(true)
    const { error } = await supabase.from('monthly_deals').delete().eq('id', params.id)
    if (error) {
      toast.error(error.message)
      setDeleting(false)
      return
    }
    toast.success('Deal deleted')
    router.push('/monthly-reports')
  }

  async function handleAddActivity(input: NewActivityInput) {
    if (!deal) return
    setAddingActivity(true)
    const { error } = await supabase.from('deal_activities').insert({ deal_id: deal.id, ...input })
    if (error) {
      toast.error(error.message)
      setAddingActivity(false)
      return
    }
    setAddingActivity(false)
    load()
  }

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 size={24} className="animate-spin" style={{ color: '#a78bfa' }} /></div>
  }
  if (!deal) return null

  if (editing) {
    return (
      <div className="fade-in">
        <div className="page-header flex items-center gap-4">
          <button onClick={() => setEditing(false)} className="btn btn-ghost" style={{ fontSize: '12px', gap: '6px' }}>
            <ArrowLeft size={13} />Back
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Edit Deal</h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>{deal.company_name}</p>
          </div>
        </div>
        <div style={{ padding: '28px 36px' }}>
          <DealForm initialData={deal} defaultMonthYear={deal.month_year} saving={saving} onSave={handleSave} onCancel={() => setEditing(false)} />
        </div>
      </div>
    )
  }

  const statusMeta = dealStatusMeta(deal.status)

  return (
    <div className="fade-in">
      <div className="page-header flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/monthly-reports" className="btn btn-ghost" style={{ fontSize: '12px', gap: '6px', textDecoration: 'none' }}>
            <ArrowLeft size={13} />Back
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white">{deal.company_name}</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold"
                style={{ background: statusMeta.bg, color: statusMeta.color, border: `1px solid ${statusMeta.color}30` }}>
                {statusMeta.label}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>
              {fmtMonthYear(deal.month_year)}{deal.lead_type ? ` · ${deal.lead_type}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen(!exportOpen)}
              className="btn btn-secondary flex items-center gap-1.5"
              style={{ padding: '7px 14px', fontSize: '12px' }}
            >
              <Download size={12} />Export<ChevronDown size={10} />
            </button>
            {exportOpen && (
              <div className="absolute left-0 top-full mt-1 w-48 rounded-xl overflow-hidden z-50 shadow-xl"
                style={{ background: 'rgb(22,22,34)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <button onClick={() => { exportDealPDF(deal, activities); setExportOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-white/5 text-left transition-colors"
                  style={{ color: 'rgb(180,180,210)' }}>
                  <FileText size={12} style={{ color: '#a78bfa' }} />Export as PDF
                </button>
                <button onClick={() => { exportDealDoc(deal, activities); setExportOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-white/5 text-left transition-colors"
                  style={{ color: 'rgb(180,180,210)' }}>
                  <FileText size={12} style={{ color: '#60a5fa' }} />Export as Word (.doc)
                </button>
              </div>
            )}
          </div>
          <button onClick={() => setEditing(true)} className="btn btn-secondary" style={{ padding: '7px 14px', fontSize: '12px' }}>
            <Pencil size={12} />Edit
          </button>
          <button onClick={handleDelete} disabled={deleting} className="btn btn-danger" style={{ padding: '7px 14px', fontSize: '12px' }}>
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}Delete
          </button>
        </div>
      </div>

      <div style={{ padding: '28px 36px' }} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: details ─────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          <div className="section-card">
            <SectionHeader icon={Building2} iconColor="#a78bfa" title="Company Information" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ padding: '18px 22px' }}>
              <InfoRow label="Individual" value={deal.individual_name ? `${deal.individual_name}${deal.designation ? ` · ${deal.designation}` : ''}` : undefined} />
              <InfoRow label="Country" value={deal.country} />
              <InfoRow label="Industry" value={deal.industry} />
              <InfoRow label="Website" value={deal.website} />
              <InfoRow label="Outreach Channel" value={deal.outreach_channel} />
              <InfoRow label="Expected Close" value={deal.expected_close_date} />
            </div>
          </div>

          {(deal.requirement || deal.problem_statement) && (
            <div className="section-card">
              <SectionHeader icon={Target} iconColor="#60a5fa" title="Opportunity Details" />
              <div className="space-y-4" style={{ padding: '18px 22px' }}>
                <InfoRow label="Requirement" value={deal.requirement} />
                <InfoRow label="Problem Statement" value={deal.problem_statement} />
                {!!(deal.products_interested?.length) && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'rgb(100,106,135)' }}>Products Interested In</div>
                    <div className="flex flex-wrap gap-1.5">
                      {deal.products_interested.map(p => (
                        <span key={p} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>{p}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="section-card">
            <SectionHeader icon={Activity} iconColor="#22d3ee" title="Activity Timeline" subtitle="Notes, follow-ups, meetings &amp; channel touches" />
            <div style={{ padding: '18px 22px' }}>
              <ActivityTimeline activities={activities} saving={addingActivity} onAdd={handleAddActivity} />
            </div>
          </div>
        </div>

        {/* ── Right: business potential + feedback ───────── */}
        <div className="space-y-5">
          <div className="section-card">
            <SectionHeader icon={DollarSign} iconColor="#4ade80" title="Business Potential" />
            <div className="space-y-3" style={{ padding: '18px 22px' }}>
              <InfoRow label="Monthly Volume" value={deal.expected_monthly_volume} />
              <InfoRow label="Yearly Volume" value={deal.expected_yearly_volume} />
              <InfoRow label="Revenue Opportunity" value={deal.estimated_revenue} />
              <InfoRow label="Geographic Corridor" value={deal.geographic_corridor} />
              {deal.strategic_importance && <InfoRow label="Strategic Importance" value={deal.strategic_importance.toUpperCase()} />}
            </div>
          </div>

          {(deal.business_impact || deal.why_valuable || deal.long_term_value) && (
            <div className="section-card">
              <SectionHeader icon={TrendingUp} iconColor="#60a5fa" title="Business Impact" />
              <div className="space-y-3" style={{ padding: '18px 22px' }}>
                <InfoRow label="Impact" value={deal.business_impact} />
                <InfoRow label="Why Valuable" value={deal.why_valuable} />
                <InfoRow label="Long-term Value" value={deal.long_term_value} />
              </div>
            </div>
          )}

          {deal.product_feedback && Object.values(deal.product_feedback).some(Boolean) && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.15)' }}>
              <div className="flex items-center gap-2.5 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(34,211,238,0.12)' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(34,211,238,0.15)' }}>
                  <Lightbulb size={14} style={{ color: '#67e8f9' }} />
                </div>
                <div className="text-[13px] font-semibold" style={{ color: '#67e8f9' }}>Product Feedback</div>
              </div>
              <div className="space-y-3" style={{ padding: '16px 20px' }}>
                {Object.entries(deal.product_feedback).filter(([, v]) => v).map(([k, v]) => (
                  <InfoRow key={k} label={k.replace(/_/g, ' ')} value={v as string} />
                ))}
              </div>
            </div>
          )}

          {!!(deal.blockers?.length) && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)' }}>
              <div className="flex items-center gap-2.5 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(248,113,113,0.12)' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(248,113,113,0.15)' }}>
                  <AlertTriangle size={14} style={{ color: '#f87171' }} />
                </div>
                <div className="text-[13px] font-semibold" style={{ color: '#f87171' }}>Blockers</div>
              </div>
              <div className="space-y-1.5" style={{ padding: '14px 20px' }}>
                {deal.blockers.map(b => (
                  <div key={b.type} className="text-xs" style={{ color: b.resolved ? 'rgb(100,106,135)' : '#f87171', textDecoration: b.resolved ? 'line-through' : 'none' }}>
                    {blockerLabel(b)}{b.notes ? ` — ${b.notes}` : ''}
                  </div>
                ))}
              </div>
            </div>
          )}

          {deal.notes && (
            <div className="section-card">
              <SectionHeader icon={StickyNote} iconColor="#fbbf24" title="Notes" />
              <div style={{ padding: '18px 22px' }}>
                <p className="text-xs" style={{ color: 'rgb(180,180,210)' }}>{deal.notes}</p>
                {deal.owner && <p className="text-[10px] mt-2" style={{ color: 'rgb(100,106,135)' }}>Owner: {deal.owner}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
