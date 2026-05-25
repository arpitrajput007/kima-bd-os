'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  ArrowLeft, ExternalLink, Star, Edit, Save, X, Loader2,
  Sparkles, Target, Shield, Users, MessageSquare, ThumbsUp,
  Copy, CheckCircle, AlertTriangle, Zap,
  Globe, Link2, Send, ChevronDown, ChevronUp, RefreshCw,
  Building2, TrendingUp, MapPin, Layers, Brain, Clock
} from 'lucide-react'
import {
  cn, getScoreBg, getStatusColor, getStatusLabel, getSeverityColor,
  getConfidenceColor, formatDate
} from '@/lib/utils'
import type { Lead, Contact, OutreachMessage } from '@/lib/types'
import { INDUSTRY_CATEGORIES, CUSTOMER_CATEGORIES, PRODUCTS_TO_SELL, REGIONS } from '@/lib/types'

type AIAction = 'research' | 'pain_points' | 'kima_fit' | 'aeredium_fit' | 'classify' | 'score' | 'contacts' | null

/* ─── tiny helpers ──────────────────────────────── */
const F = ({ label, value, full }: { label: string; value?: string | null; full?: boolean }) =>
  value ? (
    <div className={full ? 'col-span-2' : ''}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'rgb(100,106,135)' }}>{label}</div>
      <div className="text-[13px] leading-relaxed" style={{ color: 'rgb(210,215,235)' }}>{value}</div>
    </div>
  ) : null

const SectionCard = ({
  id, title, icon: Icon, color = '#a78bfa', children, badge, expanded, onToggle
}: {
  id: string; title: string; icon: React.ComponentType<{ size?: number; color?: string }>
  color?: string; children: React.ReactNode; badge?: string
  expanded: boolean; onToggle: () => void
}) => (
  <div className="section-card" style={{ borderColor: expanded ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)' }}>
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
      style={{ borderBottom: expanded ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
    >
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}18` }}>
          <Icon size={14} color={color} />
        </div>
        <span className="text-[13px] font-semibold text-white">{title}</span>
        {badge && (
          <span className="badge" style={{ background: `${color}15`, color, borderColor: `${color}30`, fontSize: '10px', padding: '1px 7px' }}>{badge}</span>
        )}
      </div>
      {expanded
        ? <ChevronUp size={15} style={{ color: 'rgb(100,106,135)' }} />
        : <ChevronDown size={15} style={{ color: 'rgb(100,106,135)' }} />}
    </button>
    {expanded && <div className="px-5 py-5">{children}</div>}
  </div>
)

/* ─── Contact avatar ──────────────────────────── */
function ContactAvatar({ name }: { name?: string | null }) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'UN'
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-[13px] font-bold"
      style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(52,211,153,0.2))', color: 'rgb(167,139,250)', border: '1px solid rgba(124,58,237,0.25)' }}>
      {initials}
    </div>
  )
}

/* ─── Score Ring ──────────────────────────────── */
function ScoreRing({ score }: { score?: number | null }) {
  const color = score == null ? '#555' : score >= 85 ? '#a78bfa' : score >= 70 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171'
  return (
    <div className="flex flex-col items-center justify-center p-4 rounded-xl"
      style={{ background: `${color}10`, border: `1px solid ${color}25`, minWidth: 72 }}>
      <div className="text-[28px] font-bold tabular-nums leading-none" style={{ color }}>{score ?? '—'}</div>
      <div className="text-[10px] font-semibold mt-1 uppercase tracking-wider" style={{ color: 'rgb(100,106,135)' }}>Score</div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ */
export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [lead, setLead] = useState<Lead | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [outreachMessages, setOutreachMessages] = useState<OutreachMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Lead>>({})
  const [saving, setSaving] = useState(false)
  const [aiAction, setAiAction] = useState<AIAction>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    overview: true, research: true, pain: true, kima: true,
    aeredium: true, contacts: true, outreach: false, feedback: false
  })

  const toggle = (k: string) => setExpanded(s => ({ ...s, [k]: !s[k] }))

  const loadLead = async () => {
    const [leadRes, contactsRes, outreachRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase.from('contacts').select('*').eq('lead_id', id).order('created_at'),
      supabase.from('outreach_messages').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
    ])
    if (leadRes.error) { toast.error('Lead not found'); router.push('/leads'); return }
    setLead(leadRes.data); setEditForm(leadRes.data)
    setContacts(contactsRes.data || [])
    setOutreachMessages(outreachRes.data || [])
    setLoading(false)
  }

  useEffect(() => { loadLead() }, [id]) // eslint-disable-line

  const saveEdits = async () => {
    if (!lead) return; setSaving(true)
    const score = editForm.lead_score
    const priority = score != null
      ? score >= 85 ? 'excellent' : score >= 70 ? 'qualified' : score >= 50 ? 'needs_research' : 'low_priority'
      : editForm.priority
    const { error } = await supabase.from('leads')
      .update({ ...editForm, priority, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) toast.error('Failed to save')
    else { toast.success('Lead updated'); setEditing(false); loadLead() }
    setSaving(false)
  }

  const updateStatus = async (status: string) => {
    const { error } = await supabase.from('leads')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) toast.error('Update failed')
    else { toast.success(`Status: ${getStatusLabel(status as Lead['status'])}`); loadLead() }
  }

  const runAI = async (action: AIAction) => {
    if (!lead || !action) return
    setAiAction(action)
    try {
      const res = await fetch('/api/ai/research', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, company_name: lead.company_name, website: lead.website, description: lead.description || lead.product_summary })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      if (action === 'research') {
        await supabase.from('leads').update({
          description: json.data.company_summary || lead.description,
          business_model: json.data.business_model, product_summary: json.data.product_summary,
          supported_chains_or_rails: json.data.supported_chains_or_rails,
          current_providers: json.data.current_providers, trigger_reason: json.data.trigger_reason,
          facts: json.data.facts?.map((f: string) => ({ text: f })) || [],
          assumptions: json.data.assumptions?.map((a: string) => ({ text: a })) || [],
          updated_at: new Date().toISOString()
        }).eq('id', id); loadLead()
      } else if (action === 'classify') {
        await supabase.from('leads').update({
          industry_category: json.data.industry_category, customer_category: json.data.customer_category,
          product_to_sell: json.data.product_to_sell, region: json.data.region,
          updated_at: new Date().toISOString()
        }).eq('id', id); loadLead()
      } else if (action === 'pain_points') {
        await supabase.from('leads').update({
          pain_point: json.data.pain_point, pain_point_severity: json.data.pain_point_severity,
          pain_point_evidence: json.data.pain_point_evidence, updated_at: new Date().toISOString()
        }).eq('id', id); loadLead()
      } else if (action === 'kima_fit') {
        await supabase.from('leads').update({
          kima_fit: json.data.kima_fit, suggested_use_case: json.data.suggested_use_case,
          settlement_angle: json.data.settlement_angle, integration_feasibility: json.data.integration_feasibility,
          updated_at: new Date().toISOString()
        }).eq('id', id); loadLead()
      } else if (action === 'aeredium_fit') {
        await supabase.from('leads').update({
          aeredium_fit: json.data.aeredium_fit, security_angle: json.data.security_angle,
          risk_angle: json.data.risk_angle, updated_at: new Date().toISOString()
        }).eq('id', id); loadLead()
      } else if (action === 'score') {
        const s = json.data.lead_score
        await supabase.from('leads').update({
          lead_score: s, confidence_score: json.data.confidence_score,
          priority: s >= 85 ? 'excellent' : s >= 70 ? 'qualified' : s >= 50 ? 'needs_research' : 'low_priority',
          updated_at: new Date().toISOString()
        }).eq('id', id); loadLead()
      } else if (action === 'contacts') {
        for (const c of (json.data.suggested_contacts || []).slice(0, 3)) {
          await supabase.from('contacts').insert({
            lead_id: id, name: c.name || null, role: c.role, company: lead.company_name,
            contact_confidence: c.contact_confidence, reason_this_person: c.why_this_person,
            linkedin_url: c.linkedin_hint ? `https://linkedin.com/search/results/people/?keywords=${encodeURIComponent(c.linkedin_hint)}` : null,
          })
        }
        loadLead()
      }
      toast.success(`AI ${action.replace('_', ' ')} complete`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'AI action failed')
    } finally { setAiAction(null) }
  }

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copied') }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={22} className="animate-spin" style={{ color: '#a78bfa' }} />
    </div>
  )
  if (!lead) return null

  const ic = 'input-dark'; const is = { fontSize: '13px', padding: '8px 11px' }

  return (
    <div className="fade-in">

      {/* ══ HEADER ══════════════════════════════════════════ */}
      <div className="page-header">
        {/* Row 1: back + name + actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/leads" className="btn btn-ghost flex-shrink-0" style={{ padding: '7px' }}>
              <ArrowLeft size={15} />
            </Link>

            {/* Company identity block */}
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-[15px]"
                style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(52,211,153,0.15))', color: 'rgb(167,139,250)', border: '1px solid rgba(124,58,237,0.3)' }}>
                {lead.company_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-[18px] font-bold text-white tracking-tight leading-none">{lead.company_name}</h1>
                  {lead.priority === 'excellent' && <Star size={15} style={{ color: '#fbbf24' }} fill="#fbbf24" />}
                  {lead.lead_score != null && (
                    <span className={cn('badge font-bold', getScoreBg(lead.lead_score))} style={{ fontSize: '12px', padding: '2px 9px' }}>
                      {lead.lead_score}
                    </span>
                  )}
                  <span className={cn('badge', getStatusColor(lead.status))} style={{ fontSize: '11px' }}>
                    {getStatusLabel(lead.status)}
                  </span>
                </div>
                {lead.website && (
                  <a href={lead.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 mt-1 text-[11px] hover:text-violet-300 transition-colors"
                    style={{ color: 'rgb(100,106,135)' }}>
                    <Globe size={10} />
                    {lead.website}
                    <ExternalLink size={9} />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {!editing ? (
              <button onClick={() => setEditing(true)} className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>
                <Edit size={12} />Edit
              </button>
            ) : (
              <>
                <button onClick={saveEdits} disabled={saving} className="btn btn-primary" style={{ fontSize: '12px', padding: '6px 12px' }}>
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}Save
                </button>
                <button onClick={() => setEditing(false)} className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 10px' }}>
                  <X size={12} />
                </button>
              </>
            )}
            {lead.status !== 'approved' && (
              <button onClick={() => updateStatus('approved')} className="btn btn-success" style={{ fontSize: '12px', padding: '6px 12px' }}>
                <CheckCircle size={12} />Approve
              </button>
            )}
            {lead.status !== 'rejected' && (
              <button onClick={() => updateStatus('rejected')} className="btn btn-danger" style={{ fontSize: '12px', padding: '6px 12px' }}>
                <X size={12} />Reject
              </button>
            )}
            {lead.status === 'approved' && (
              <button onClick={() => updateStatus('contacted')} className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px', color: '#22d3ee' }}>
                <Send size={12} />Contacted
              </button>
            )}
            <Link href={`/outreach?lead=${lead.id}`} className="btn btn-ai" style={{ fontSize: '12px', padding: '6px 12px' }}>
              <MessageSquare size={12} />Outreach Studio
            </Link>
          </div>
        </div>

        {/* Row 2: AI Actions */}
        <div className="flex items-center gap-2 flex-wrap mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-1.5 mr-1" style={{ color: 'rgb(100,106,135)' }}>
            <Sparkles size={11} />
            <span className="text-[11px] font-semibold uppercase tracking-wider">AI Actions</span>
          </div>
          {([
            { action: 'research' as AIAction,    label: 'Research Company',     color: '#60a5fa' },
            { action: 'pain_points' as AIAction, label: 'Identify Pain Points', color: '#f87171' },
            { action: 'kima_fit' as AIAction,    label: 'Kima Fit',             color: '#34d399' },
            { action: 'aeredium_fit' as AIAction,label: 'Aeredium Fit',         color: '#a78bfa' },
            { action: 'classify' as AIAction,    label: 'Classify',             color: '#fbbf24' },
            { action: 'score' as AIAction,       label: 'Score Lead',           color: '#22d3ee' },
            { action: 'contacts' as AIAction,    label: 'Find Contacts',        color: '#34d399' },
          ]).map(({ action, label, color }) => (
            <button key={action} onClick={() => runAI(action)} disabled={aiAction !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all hover:scale-105 disabled:opacity-40"
              style={{ background: `${color}12`, color, border: `1px solid ${color}25` }}>
              {aiAction === action
                ? <Loader2 size={10} className="animate-spin" />
                : <Sparkles size={10} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ BODY ════════════════════════════════════════════ */}
      <div style={{ padding: '20px 28px' }}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5" style={{ maxWidth: '1400px' }}>

          {/* ── LEFT COLUMN ─────────────────────────────── */}
          <div className="space-y-4">

            {/* Company Overview */}
            <SectionCard id="overview" title="Company Overview" icon={Building2} color="#60a5fa"
              expanded={expanded.overview} onToggle={() => toggle('overview')}>
              {editing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { label: 'Company Name', key: 'company_name', type: 'input' },
                    { label: 'Website', key: 'website', type: 'input' },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgb(100,106,135)' }}>{label}</label>
                      <input className={ic} style={is} value={(editForm as Record<string, string>)[key] || ''} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} />
                    </div>
                  ))}
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgb(100,106,135)' }}>Industry</label>
                    <select className={ic} style={is} value={editForm.industry_category || ''} onChange={e => setEditForm(f => ({ ...f, industry_category: e.target.value }))}>
                      <option value="">Select</option>
                      {INDUSTRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgb(100,106,135)' }}>Region</label>
                    <select className={ic} style={is} value={editForm.region || ''} onChange={e => setEditForm(f => ({ ...f, region: e.target.value }))}>
                      <option value="">Select</option>
                      {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgb(100,106,135)' }}>Product to Sell</label>
                    <select className={ic} style={is} value={editForm.product_to_sell || ''} onChange={e => setEditForm(f => ({ ...f, product_to_sell: e.target.value }))}>
                      <option value="">Select</option>
                      {PRODUCTS_TO_SELL.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgb(100,106,135)' }}>Status</label>
                    <select className={ic} style={is} value={editForm.status || 'new'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as Lead['status'] }))}>
                      {['new','researching','qualified','approved','rejected','contacted','replied','meeting_booked','archived','needs_more_research'].map(s =>
                        <option key={s} value={s}>{getStatusLabel(s as Lead['status'])}</option>
                      )}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgb(100,106,135)' }}>Description</label>
                    <textarea className={ic} style={{ ...is, resize: 'vertical' as const }} rows={3} value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgb(100,106,135)' }}>Lead Score (0–100)</label>
                    <input className={ic} style={is} type="number" min="0" max="100" value={editForm.lead_score || ''} onChange={e => setEditForm(f => ({ ...f, lead_score: parseInt(e.target.value) || undefined }))} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgb(100,106,135)' }}>Confidence Score (0–100)</label>
                    <input className={ic} style={is} type="number" min="0" max="100" value={editForm.confidence_score || ''} onChange={e => setEditForm(f => ({ ...f, confidence_score: parseInt(e.target.value) || undefined }))} />
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    {(lead.customer_category || []).map(cat => (
                      <span key={cat} className="badge" style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa', borderColor: 'rgba(124,58,237,0.22)', fontSize: '11px' }}>
                        {cat}
                      </span>
                    ))}
                    {lead.industry_category && (
                      <span className="badge" style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', borderColor: 'rgba(96,165,250,0.2)', fontSize: '11px' }}>
                        {lead.industry_category}
                      </span>
                    )}
                    {lead.region && (
                      <span className="badge flex items-center gap-1" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgb(160,165,195)', borderColor: 'rgba(255,255,255,0.1)', fontSize: '11px' }}>
                        <MapPin size={9} />
                        {lead.region}
                      </span>
                    )}
                  </div>

                  {/* Fields grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                    <F label="Product to Sell"      value={lead.product_to_sell} />
                    <F label="Suggested Use Case"    value={lead.suggested_use_case} />
                    <F label="Business Model"        value={lead.business_model} />
                    <F label="Current Providers"     value={lead.current_providers} />
                    <F label="Supported Chains/Rails" value={lead.supported_chains_or_rails} full />
                    <F label="Description"           value={lead.description} full />
                  </div>

                  {/* Score strip */}
                  <div className="flex items-center gap-4 pt-4 mt-1 flex-wrap"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <ScoreRing score={lead.lead_score} />
                    <div className="flex flex-col items-center px-4 py-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', minWidth: 72 }}>
                      <div className="text-[22px] font-bold text-white tabular-nums leading-none">{lead.confidence_score ?? '—'}</div>
                      <div className="text-[10px] font-semibold mt-1 uppercase tracking-wider" style={{ color: 'rgb(100,106,135)' }}>Confidence</div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <Clock size={12} style={{ color: 'rgb(100,106,135)' }} />
                      <span className="text-[12px]" style={{ color: 'rgb(140,145,175)' }}>Added {formatDate(lead.created_at)}</span>
                    </div>
                    {lead.revenue_potential && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                        style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
                        <TrendingUp size={12} style={{ color: '#34d399' }} />
                        <span className="text-[12px] font-medium" style={{ color: '#34d399' }}>{lead.revenue_potential}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Research Findings */}
            {(lead.trigger_reason || lead.source_url || (lead.facts as {text:string}[] || []).length > 0) && (
              <SectionCard id="research" title="Research Findings" icon={Brain} color="#fbbf24"
                expanded={expanded.research} onToggle={() => toggle('research')}>
                <div className="space-y-4">
                  {lead.trigger_reason && (
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.12)' }}>
                      <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgb(100,106,135)' }}>Trigger / Reason to Reach Out Now</div>
                      <p className="text-[13px] leading-relaxed" style={{ color: 'rgb(220,215,185)' }}>{lead.trigger_reason}</p>
                    </div>
                  )}
                  {lead.source_url && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'rgb(100,106,135)' }}>Source</div>
                      <a href={lead.source_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-[12px] hover:text-violet-300 transition-colors"
                        style={{ color: '#60a5fa' }}>
                        <Link2 size={11} />
                        {lead.source_url}
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  )}
                  {(lead.facts as {text:string}[] || []).length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgb(100,106,135)' }}>✓ Verified Facts</div>
                      <ul className="space-y-1.5">
                        {(lead.facts as {text:string}[]).map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: 'rgb(210,215,235)' }}>
                            <span className="mt-0.5 flex-shrink-0" style={{ color: '#34d399' }}>✓</span>
                            {f.text || String(f)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(lead.assumptions as {text:string}[] || []).length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgb(100,106,135)' }}>~ Inferred Assumptions</div>
                      <ul className="space-y-1.5">
                        {(lead.assumptions as {text:string}[]).map((a, i) => (
                          <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: 'rgb(180,185,205)' }}>
                            <span className="mt-0.5 flex-shrink-0" style={{ color: '#fbbf24' }}>~</span>
                            {a.text || String(a)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {/* Pain Point */}
            <SectionCard id="pain" title="Pain Point Analysis" icon={AlertTriangle} color="#f87171"
              expanded={expanded.pain} onToggle={() => toggle('pain')}>
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgb(100,106,135)' }}>Pain Point</label>
                    <textarea className={ic} style={{ ...is, resize: 'vertical' as const }} rows={3} value={editForm.pain_point || ''} onChange={e => setEditForm(f => ({ ...f, pain_point: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgb(100,106,135)' }}>Severity</label>
                      <select className={ic} style={is} value={editForm.pain_point_severity || ''} onChange={e => setEditForm(f => ({ ...f, pain_point_severity: e.target.value as Lead['pain_point_severity'] }))}>
                        <option value="">Select</option>
                        {['critical','high','medium','low'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgb(100,106,135)' }}>Evidence</label>
                      <input className={ic} style={is} value={editForm.pain_point_evidence || ''} onChange={e => setEditForm(f => ({ ...f, pain_point_evidence: e.target.value }))} />
                    </div>
                  </div>
                </div>
              ) : lead.pain_point ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl" style={{ background: 'rgba(248,113,133,0.06)', border: '1px solid rgba(248,113,133,0.15)' }}>
                    <p className="text-[13px] leading-relaxed" style={{ color: 'rgb(235,210,215)' }}>{lead.pain_point}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {lead.pain_point_severity && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'rgb(100,106,135)' }}>Severity</div>
                        <span className={cn('badge', getSeverityColor(lead.pain_point_severity))}>
                          {lead.pain_point_severity.charAt(0).toUpperCase() + lead.pain_point_severity.slice(1)}
                        </span>
                      </div>
                    )}
                  </div>
                  {lead.pain_point_evidence && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'rgb(100,106,135)' }}>Evidence</div>
                      <p className="text-[13px] leading-relaxed" style={{ color: 'rgb(190,195,215)' }}>{lead.pain_point_evidence}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle size={28} className="mx-auto mb-3 opacity-20" style={{ color: '#f87171' }} />
                  <p className="text-[13px] mb-4" style={{ color: 'rgb(100,106,135)' }}>No pain point identified yet</p>
                  <button onClick={() => runAI('pain_points')} className="btn btn-ai" style={{ fontSize: '12px' }}>
                    <Sparkles size={12} /> Identify with AI
                  </button>
                </div>
              )}
            </SectionCard>

            {/* Kima Fit */}
            <SectionCard id="kima" title="Kima Fit" icon={Target} color="#34d399"
              expanded={expanded.kima} onToggle={() => toggle('kima')}>
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgb(100,106,135)' }}>Kima Fit</label>
                    <textarea className={ic} style={{ ...is, resize: 'vertical' as const }} rows={3} value={editForm.kima_fit || ''} onChange={e => setEditForm(f => ({ ...f, kima_fit: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgb(100,106,135)' }}>Settlement Angle</label>
                    <input className={ic} style={is} value={editForm.settlement_angle || ''} onChange={e => setEditForm(f => ({ ...f, settlement_angle: e.target.value }))} />
                  </div>
                </div>
              ) : lead.kima_fit ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
                    <p className="text-[13px] leading-relaxed" style={{ color: 'rgb(200,235,220)' }}>{lead.kima_fit}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <F label="Settlement Angle" value={lead.settlement_angle} />
                    <F label="Integration Feasibility" value={lead.integration_feasibility} />
                    <F label="Suggested Use Case" value={lead.suggested_use_case} full />
                  </div>
                  {lead.integration_feasibility && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg"
                      style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.18)' }}>
                      <Layers size={12} style={{ color: '#34d399' }} />
                      <span className="text-[12px] font-semibold" style={{ color: '#34d399' }}>
                        Integration: {lead.integration_feasibility}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Target size={28} className="mx-auto mb-3 opacity-20" style={{ color: '#34d399' }} />
                  <p className="text-[13px] mb-4" style={{ color: 'rgb(100,106,135)' }}>Kima fit not analyzed yet</p>
                  <button onClick={() => runAI('kima_fit')} className="btn btn-ai" style={{ fontSize: '12px' }}>
                    <Sparkles size={12} /> Analyze Kima Fit
                  </button>
                </div>
              )}
            </SectionCard>

            {/* Aeredium Fit */}
            <SectionCard id="aeredium" title="Aeredium Fit" icon={Shield} color="#a78bfa"
              expanded={expanded.aeredium} onToggle={() => toggle('aeredium')}>
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgb(100,106,135)' }}>Aeredium Fit</label>
                    <textarea className={ic} style={{ ...is, resize: 'vertical' as const }} rows={3} value={editForm.aeredium_fit || ''} onChange={e => setEditForm(f => ({ ...f, aeredium_fit: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgb(100,106,135)' }}>Security Angle</label>
                    <input className={ic} style={is} value={editForm.security_angle || ''} onChange={e => setEditForm(f => ({ ...f, security_angle: e.target.value }))} />
                  </div>
                </div>
              ) : lead.aeredium_fit ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl" style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)' }}>
                    <p className="text-[13px] leading-relaxed" style={{ color: 'rgb(220,210,240)' }}>{lead.aeredium_fit}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <F label="Security Angle" value={lead.security_angle} />
                    <F label="Risk Angle"     value={lead.risk_angle} />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Shield size={28} className="mx-auto mb-3 opacity-20" style={{ color: '#a78bfa' }} />
                  <p className="text-[13px] mb-4" style={{ color: 'rgb(100,106,135)' }}>Aeredium fit not analyzed yet</p>
                  <button onClick={() => runAI('aeredium_fit')} className="btn btn-ai" style={{ fontSize: '12px' }}>
                    <Sparkles size={12} /> Analyze Aeredium Fit
                  </button>
                </div>
              )}
            </SectionCard>

          </div>

          {/* ── RIGHT COLUMN ────────────────────────────── */}
          <div className="space-y-4">

            {/* Contacts */}
            <SectionCard id="contacts" title="Contacts" icon={Users} color="#22d3ee"
              badge={contacts.length > 0 ? String(contacts.length) : undefined}
              expanded={expanded.contacts} onToggle={() => toggle('contacts')}>
              <div className="space-y-4">
                {contacts.length === 0 ? (
                  <div className="text-center py-6">
                    <Users size={26} className="mx-auto mb-3 opacity-20" style={{ color: '#22d3ee' }} />
                    <p className="text-[12px] mb-3" style={{ color: 'rgb(100,106,135)' }}>No contacts found yet</p>
                    <button onClick={() => runAI('contacts')} className="btn btn-ai" style={{ fontSize: '11px', padding: '6px 12px' }}>
                      <Sparkles size={11} /> Find with AI
                    </button>
                  </div>
                ) : (
                  contacts.map(contact => (
                    <div key={contact.id} className="p-4 rounded-xl space-y-3"
                      style={{ background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.12)' }}>
                      {/* Name row */}
                      <div className="flex items-start gap-3">
                        <ContactAvatar name={contact.name} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="text-[13px] font-bold text-white">{contact.name || 'Unknown Name'}</div>
                            {contact.contact_confidence && (
                              <span className={cn('badge', getConfidenceColor(contact.contact_confidence))} style={{ fontSize: '10px' }}>
                                {contact.contact_confidence} confidence
                              </span>
                            )}
                          </div>
                          <div className="text-[12px] mt-0.5" style={{ color: 'rgb(140,145,175)' }}>{contact.role}</div>
                        </div>
                      </div>
                      {/* Reason */}
                      {contact.reason_this_person && (
                        <p className="text-[12px] leading-relaxed" style={{ color: 'rgb(130,135,165)' }}>
                          {contact.reason_this_person}
                        </p>
                      )}
                      {/* Social links */}
                      <div className="flex flex-wrap gap-2">
                        {contact.linkedin_url && (
                          <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer"
                            className="btn btn-secondary" style={{ fontSize: '11px', padding: '5px 10px', gap: '5px' }}>
                            <ExternalLink size={10} />LinkedIn
                          </a>
                        )}
                        {contact.twitter_url && (
                          <a href={contact.twitter_url} target="_blank" rel="noopener noreferrer"
                            className="btn btn-secondary" style={{ fontSize: '11px', padding: '5px 10px', gap: '5px' }}>
                            <ExternalLink size={10} />Twitter
                          </a>
                        )}
                        {contact.email && (
                          <button onClick={() => copy(contact.email!)}
                            className="btn btn-secondary" style={{ fontSize: '11px', padding: '5px 10px', gap: '5px', maxWidth: '180px' }}>
                            <Copy size={10} />
                            <span className="truncate">{contact.email}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {contacts.length > 0 && (
                  <button onClick={() => runAI('contacts')} disabled={aiAction === 'contacts'}
                    className="btn btn-ghost text-[11px] w-full justify-center" style={{ padding: '7px' }}>
                    {aiAction === 'contacts' ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                    Refresh Contacts with AI
                  </button>
                )}
              </div>
            </SectionCard>

            {/* Outreach Messages */}
            <SectionCard id="outreach" title="Outreach Messages" icon={MessageSquare} color="#fbbf24"
              badge={outreachMessages.length > 0 ? String(outreachMessages.length) : undefined}
              expanded={expanded.outreach} onToggle={() => toggle('outreach')}>
              <div className="space-y-4">
                {outreachMessages.length === 0 ? (
                  <div className="text-center py-5">
                    <p className="text-[12px] mb-3" style={{ color: 'rgb(100,106,135)' }}>No messages drafted yet</p>
                    <Link href={`/outreach?lead=${lead.id}`} className="btn btn-ai" style={{ fontSize: '11px', padding: '6px 12px' }}>
                      <MessageSquare size={11} /> Open Outreach Studio
                    </Link>
                  </div>
                ) : outreachMessages.map(msg => (
                  <div key={msg.id} className="space-y-3 p-4 rounded-xl"
                    style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.12)' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="badge" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', borderColor: 'rgba(251,191,36,0.2)', fontSize: '10px' }}>{msg.channel}</span>
                      <span className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>{msg.tone}</span>
                      <span className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>· {formatDate(msg.created_at)}</span>
                    </div>
                    {msg.message && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgb(100,106,135)' }}>First Message</span>
                          <button onClick={() => copy(msg.message!)} className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: '10px' }}>
                            <Copy size={9} />Copy
                          </button>
                        </div>
                        <div className="p-3 rounded-lg text-[12px] leading-relaxed whitespace-pre-wrap"
                          style={{ background: 'rgba(255,255,255,0.03)', color: 'rgb(200,205,225)' }}>
                          {msg.message}
                        </div>
                      </div>
                    )}
                    {msg.followup_1 && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgb(100,106,135)' }}>Follow-up 1</span>
                          <button onClick={() => copy(msg.followup_1!)} className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: '10px' }}>
                            <Copy size={9} />Copy
                          </button>
                        </div>
                        <div className="p-3 rounded-lg text-[12px] leading-relaxed whitespace-pre-wrap"
                          style={{ background: 'rgba(255,255,255,0.03)', color: 'rgb(200,205,225)' }}>
                          {msg.followup_1}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Feedback */}
            <SectionCard id="feedback" title="Log Outcome / Feedback" icon={ThumbsUp} color="#34d399"
              expanded={expanded.feedback} onToggle={() => toggle('feedback')}>
              <FeedbackForm leadId={lead.id} onSaved={loadLead} />
            </SectionCard>

          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ */
function FeedbackForm({ leadId, onSaved }: { leadId: string; onSaved: () => void }) {
  const supabase = createClient()
  const [form, setForm] = useState({
    action_taken: '', lead_quality: '', pain_point_accuracy: '',
    contact_accuracy: '', message_quality: '', outcome: '',
    rejection_reason: '', arpit_notes: '',
  })
  const [saving, setSaving] = useState(false)
  const sel = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const sc = 'input-dark'; const ss = { fontSize: '12px', padding: '7px 10px' }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.from('feedback_memory').insert({
      lead_id: leadId, ...form,
      action_taken: form.action_taken || null, lead_quality: form.lead_quality || null,
      pain_point_accuracy: form.pain_point_accuracy || null,
      contact_accuracy: form.contact_accuracy || null, message_quality: form.message_quality || null,
      outcome: form.outcome || null, rejection_reason: form.rejection_reason || null,
      arpit_notes: form.arpit_notes || null,
    })
    if (error) toast.error('Failed to save feedback')
    else { toast.success('Feedback saved — training the agent'); onSaved() }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Action Taken', key: 'action_taken', opts: [['approved','Approved'],['rejected','Rejected'],['edited','Edited'],['contacted','Contacted'],['replied','Replied'],['meeting_booked','Meeting Booked'],['deal_closed','Deal Closed'],['needs_more_research','Needs Research']] },
          { label: 'Lead Quality', key: 'lead_quality', opts: [['excellent','Excellent'],['good','Good'],['average','Average'],['poor','Poor']] },
          { label: 'Pain Point Accuracy', key: 'pain_point_accuracy', opts: [['very_accurate','Very Accurate'],['mostly_accurate','Mostly Accurate'],['partially_accurate','Partially'],['inaccurate','Inaccurate']] },
          { label: 'Contact Accuracy', key: 'contact_accuracy', opts: [['perfect','Perfect'],['good','Good'],['off','Off'],['wrong','Wrong']] },
          { label: 'Message Quality', key: 'message_quality', opts: [['excellent','Excellent'],['good','Good'],['needs_work','Needs Work'],['poor','Poor']] },
          { label: 'Outcome', key: 'outcome', opts: [['replied','Replied'],['meeting_booked','Meeting Booked'],['deal_in_progress','Deal In Progress'],['deal_closed','Deal Closed 🎉'],['no_response','No Response'],['rejected_by_prospect','Rejected'],['not_yet_sent','Not Sent']] },
        ].map(({ label, key, opts }) => (
          <div key={key}>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'rgb(100,106,135)' }}>{label}</label>
            <select className={sc} style={ss} value={(form as Record<string, string>)[key]} onChange={e => sel(key, e.target.value)}>
              <option value="">Select</option>
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
      </div>
      {form.action_taken === 'rejected' && (
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'rgb(100,106,135)' }}>Rejection Reason</label>
          <input className={sc} style={ss} value={form.rejection_reason} onChange={e => setForm(f => ({ ...f, rejection_reason: e.target.value }))} placeholder="Why?" />
        </div>
      )}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'rgb(100,106,135)' }}>Your Notes</label>
        <textarea className={sc} style={{ fontSize: '12px', resize: 'vertical' }} rows={2} value={form.arpit_notes}
          onChange={e => setForm(f => ({ ...f, arpit_notes: e.target.value }))} placeholder="Notes for the agent to learn from…" />
      </div>
      <button type="submit" disabled={saving} className="btn btn-success w-full" style={{ fontSize: '12px' }}>
        {saving ? <><Loader2 size={12} className="animate-spin" />Saving…</> : <><Save size={12} />Save Feedback</>}
      </button>
    </form>
  )
}
