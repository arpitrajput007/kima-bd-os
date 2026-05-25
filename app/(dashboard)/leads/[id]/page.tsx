'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  ArrowLeft, ExternalLink, Star, Edit, Save, X, Loader2,
  Sparkles, Target, Shield, Users, MessageSquare, ThumbsUp,
  ThumbsDown, Phone, Copy, CheckCircle, AlertTriangle, Zap,
  Globe, Link2, Send, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react'
import {
  cn, getScoreBg, getStatusColor, getStatusLabel, getSeverityColor,
  getConfidenceColor, formatDate, truncate
} from '@/lib/utils'
import type { Lead, Contact, OutreachMessage } from '@/lib/types'
import { INDUSTRY_CATEGORIES, CUSTOMER_CATEGORIES, PRODUCTS_TO_SELL, REGIONS } from '@/lib/types'

type AIAction = 'research' | 'pain_points' | 'kima_fit' | 'aeredium_fit' | 'classify' | 'score' | 'contacts' | null

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
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true, research: true, pain: true, kima: true, aeredium: true,
    contacts: true, outreach: false, feedback: false
  })

  const loadLead = async () => {
    const [leadRes, contactsRes, outreachRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase.from('contacts').select('*').eq('lead_id', id).order('created_at'),
      supabase.from('outreach_messages').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
    ])

    if (leadRes.error) { toast.error('Lead not found'); router.push('/leads'); return }
    setLead(leadRes.data)
    setEditForm(leadRes.data)
    setContacts(contactsRes.data || [])
    setOutreachMessages(outreachRes.data || [])
    setLoading(false)
  }

  useEffect(() => { loadLead() }, [id])

  const toggleSection = (section: string) => {
    setExpandedSections(s => ({ ...s, [section]: !s[section] }))
  }

  const saveEdits = async () => {
    if (!lead) return
    setSaving(true)
    const score = editForm.lead_score
    const priority = score != null
      ? score >= 85 ? 'excellent' : score >= 70 ? 'qualified' : score >= 50 ? 'needs_research' : 'low_priority'
      : editForm.priority

    const { error } = await supabase
      .from('leads')
      .update({ ...editForm, priority, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) toast.error('Failed to save')
    else { toast.success('Lead updated'); setEditing(false); loadLead() }
    setSaving(false)
  }

  const updateStatus = async (status: string) => {
    const { error } = await supabase
      .from('leads').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) toast.error('Update failed')
    else { toast.success(`Status: ${getStatusLabel(status as Lead['status'])}`); loadLead() }
  }

  const runAI = async (action: AIAction) => {
    if (!lead || !action) return
    setAiAction(action)
    setAiResult(null)

    try {
      const res = await fetch('/api/ai/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          company_name: lead.company_name,
          website: lead.website,
          description: lead.description || lead.product_summary,
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setAiResult(json.data)

      // Auto-apply certain results
      if (action === 'research') {
        await supabase.from('leads').update({
          description: json.data.company_summary || lead.description,
          business_model: json.data.business_model,
          product_summary: json.data.product_summary,
          supported_chains_or_rails: json.data.supported_chains_or_rails,
          current_providers: json.data.current_providers,
          trigger_reason: json.data.trigger_reason,
          facts: json.data.facts?.map((f: string) => ({ text: f })) || [],
          assumptions: json.data.assumptions?.map((a: string) => ({ text: a })) || [],
          updated_at: new Date().toISOString()
        }).eq('id', id)
        loadLead()
      } else if (action === 'classify') {
        await supabase.from('leads').update({
          industry_category: json.data.industry_category,
          customer_category: json.data.customer_category,
          product_to_sell: json.data.product_to_sell,
          region: json.data.region,
          updated_at: new Date().toISOString()
        }).eq('id', id)
        loadLead()
      } else if (action === 'pain_points') {
        await supabase.from('leads').update({
          pain_point: json.data.pain_point,
          pain_point_severity: json.data.pain_point_severity,
          pain_point_evidence: json.data.pain_point_evidence,
          updated_at: new Date().toISOString()
        }).eq('id', id)
        loadLead()
      } else if (action === 'kima_fit') {
        await supabase.from('leads').update({
          kima_fit: json.data.kima_fit,
          suggested_use_case: json.data.suggested_use_case,
          settlement_angle: json.data.settlement_angle,
          integration_feasibility: json.data.integration_feasibility,
          updated_at: new Date().toISOString()
        }).eq('id', id)
        loadLead()
      } else if (action === 'aeredium_fit') {
        await supabase.from('leads').update({
          aeredium_fit: json.data.aeredium_fit,
          security_angle: json.data.security_angle,
          risk_angle: json.data.risk_angle,
          updated_at: new Date().toISOString()
        }).eq('id', id)
        loadLead()
      } else if (action === 'score') {
        const score = json.data.lead_score
        const priority = score >= 85 ? 'excellent' : score >= 70 ? 'qualified' : score >= 50 ? 'needs_research' : 'low_priority'
        await supabase.from('leads').update({
          lead_score: score,
          confidence_score: json.data.confidence_score,
          priority,
          updated_at: new Date().toISOString()
        }).eq('id', id)
        loadLead()
      } else if (action === 'contacts') {
        // Save suggested contacts
        const suggested = json.data.suggested_contacts || []
        for (const c of suggested.slice(0, 3)) {
          await supabase.from('contacts').insert({
            lead_id: id,
            name: c.name || null,
            role: c.role,
            company: lead.company_name,
            contact_confidence: c.contact_confidence,
            reason_this_person: c.why_this_person,
            linkedin_url: c.linkedin_hint ? `https://linkedin.com/search/results/people/?keywords=${encodeURIComponent(c.linkedin_hint)}` : null,
          })
        }
        loadLead()
      }

      toast.success(`AI ${action.replace('_', ' ')} complete`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI action failed'
      toast.error(msg)
    } finally {
      setAiAction(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const Section = ({ id: sectionId, title, icon: Icon, color = '#a78bfa', children, badge }: {
    id: string; title: string; icon: React.ComponentType<{ size?: number; color?: string }>; color?: string; children: React.ReactNode; badge?: string
  }) => (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(20,20,30,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <button
        onClick={() => toggleSection(sectionId)}
        className="w-full flex items-center justify-between px-6 py-5 hover:bg-white/[0.02] transition-colors"
        style={{ borderBottom: expandedSections[sectionId] ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg" style={{ background: `${color}15` }}>
            <Icon size={16} color={color} />
          </div>
          <span className="text-[15px] font-medium text-white">{title}</span>
          {badge && (
            <span className="badge text-xs font-bold" style={{ background: `${color}15`, color, borderColor: `${color}30`, padding: '2px 8px' }}>{badge}</span>
          )}
        </div>
        {expandedSections[sectionId] ? <ChevronUp size={16} style={{ color: 'rgb(100,100,120)' }} /> : <ChevronDown size={16} style={{ color: 'rgb(100,100,120)' }} />}
      </button>
      {expandedSections[sectionId] && <div className="p-6 md:p-8">{children}</div>}
    </div>
  )

  const Field = ({ label, value, className = '' }: { label: string; value?: string | null; className?: string }) => (
    value ? (
      <div className={className}>
        <div className="text-[11px] font-semibold mb-2" style={{ color: 'rgb(140,140,160)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
        <div className="text-[15px]" style={{ color: 'rgb(220,220,230)', lineHeight: '1.7' }}>{value}</div>
      </div>
    ) : null
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin" style={{ color: '#a78bfa' }} />
    </div>
  )

  if (!lead) return null

  const inputClass = 'input-dark text-sm'
  const inputStyle = { fontSize: '13px', padding: '7px 10px' }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Link href="/leads" className="btn btn-ghost mt-0.5" style={{ padding: '6px' }}>
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-bold text-white">{lead.company_name}</h1>
                {lead.priority === 'excellent' && <Star size={16} style={{ color: '#a78bfa' }} fill="#a78bfa" />}
                {lead.lead_score != null && (
                  <span className={cn('badge text-sm font-bold', getScoreBg(lead.lead_score))}>
                    {lead.lead_score}
                  </span>
                )}
                <span className={cn('badge', getStatusColor(lead.status))}>
                  {getStatusLabel(lead.status)}
                </span>
              </div>
              {lead.website && (
                <a href={lead.website} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs hover:text-violet-300 transition-colors"
                  style={{ color: 'rgb(100,100,120)' }}>
                  <Globe size={10} />
                  {lead.website}
                  <ExternalLink size={9} />
                </a>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {!editing ? (
              <button onClick={() => setEditing(true)} className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 10px' }}>
                <Edit size={12} />Edit
              </button>
            ) : (
              <>
                <button onClick={saveEdits} disabled={saving} className="btn btn-primary" style={{ fontSize: '12px', padding: '6px 10px' }}>
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save
                </button>
                <button onClick={() => setEditing(false)} className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 10px' }}>
                  <X size={12} />Cancel
                </button>
              </>
            )}

            {/* Status Quick-Actions */}
            {lead.status !== 'approved' && (
              <button onClick={() => updateStatus('approved')} className="btn btn-success" style={{ fontSize: '12px', padding: '6px 10px' }}>
                <CheckCircle size={12} />Approve
              </button>
            )}
            {lead.status !== 'rejected' && (
              <button onClick={() => updateStatus('rejected')} className="btn btn-danger" style={{ fontSize: '12px', padding: '6px 10px' }}>
                <X size={12} />Reject
              </button>
            )}
            {lead.status === 'approved' && (
              <button onClick={() => updateStatus('contacted')} className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 10px', color: '#22d3ee' }}>
                <Send size={12} />Mark Contacted
              </button>
            )}
            <Link href={`/outreach?lead=${lead.id}`} className="btn btn-ai" style={{ fontSize: '12px', padding: '6px 10px' }}>
              <MessageSquare size={12} />Outreach Studio
            </Link>
          </div>
        </div>

        {/* AI Action Bar */}
        <div className="flex items-center gap-2 flex-wrap mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-xs font-medium" style={{ color: 'rgb(100,100,120)' }}>
            <Sparkles size={11} className="inline mr-1" />AI Actions:
          </span>
          {[
            { action: 'research' as AIAction, label: 'Research Company' },
            { action: 'pain_points' as AIAction, label: 'Identify Pain Points' },
            { action: 'kima_fit' as AIAction, label: 'Kima Fit' },
            { action: 'aeredium_fit' as AIAction, label: 'Aeredium Fit' },
            { action: 'classify' as AIAction, label: 'Classify' },
            { action: 'score' as AIAction, label: 'Score Lead' },
            { action: 'contacts' as AIAction, label: 'Find Contacts' },
          ].map(({ action, label }) => (
            <button
              key={action}
              onClick={() => runAI(action)}
              disabled={aiAction !== null}
              className="btn btn-ai"
              style={{ fontSize: '11px', padding: '4px 8px' }}
            >
              {aiAction === action ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {label}
            </button>
          ))}
          {aiResult && (
            <button onClick={() => setAiResult(null)} className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 8px', color: '#f87171' }}>
              <X size={11} /> Clear Result
            </button>
          )}
        </div>

        {/* AI Result Preview */}
        {aiResult && (
          <div className="mt-3 p-4 rounded-xl text-xs"
            style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={12} style={{ color: '#a78bfa' }} />
              <span className="font-medium" style={{ color: '#a78bfa' }}>AI Result (auto-applied to lead)</span>
            </div>
            <pre className="text-xs overflow-auto max-h-32" style={{ color: 'rgb(180,180,200)', fontFamily: 'monospace' }}>
              {JSON.stringify(aiResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 md:p-8 w-full max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column (Overview, Findings, Fits) */}
          <div className="lg:col-span-2 space-y-6">

        {/* Company Overview */}
        <Section id="overview" title="Company Overview" icon={Globe} color="#60a5fa">
          {editing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Company Name</label>
                <input className={inputClass} style={inputStyle} value={editForm.company_name || ''} onChange={e => setEditForm(f => ({ ...f, company_name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Website</label>
                <input className={inputClass} style={inputStyle} value={editForm.website || ''} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Industry Category</label>
                <select className={inputClass} style={inputStyle} value={editForm.industry_category || ''} onChange={e => setEditForm(f => ({ ...f, industry_category: e.target.value }))}>
                  <option value="">Select</option>
                  {INDUSTRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Region</label>
                <select className={inputClass} style={inputStyle} value={editForm.region || ''} onChange={e => setEditForm(f => ({ ...f, region: e.target.value }))}>
                  <option value="">Select</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Product to Sell</label>
                <select className={inputClass} style={inputStyle} value={editForm.product_to_sell || ''} onChange={e => setEditForm(f => ({ ...f, product_to_sell: e.target.value }))}>
                  <option value="">Select</option>
                  {PRODUCTS_TO_SELL.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Status</label>
                <select className={inputClass} style={inputStyle} value={editForm.status || 'new'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as Lead['status'] }))}>
                  <option value="new">New</option>
                  <option value="researching">Researching</option>
                  <option value="qualified">Qualified</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="contacted">Contacted</option>
                  <option value="replied">Replied</option>
                  <option value="meeting_booked">Meeting Booked</option>
                  <option value="archived">Archived</option>
                  <option value="needs_more_research">Needs More Research</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Description</label>
                <textarea className={inputClass} style={{ ...inputStyle, resize: 'vertical' as const }} rows={2} value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Lead Score (0-100)</label>
                <input className={inputClass} style={inputStyle} type="number" min="0" max="100" value={editForm.lead_score || ''} onChange={e => setEditForm(f => ({ ...f, lead_score: parseInt(e.target.value) || undefined }))} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Confidence Score (0-100)</label>
                <input className={inputClass} style={inputStyle} type="number" min="0" max="100" value={editForm.confidence_score || ''} onChange={e => setEditForm(f => ({ ...f, confidence_score: parseInt(e.target.value) || undefined }))} />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 mb-4">
                {(lead.customer_category || []).map(cat => (
                  <span key={cat} className="badge"
                    style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', borderColor: 'rgba(139,92,246,0.2)', fontSize: '11px' }}>
                    {cat}
                  </span>
                ))}
                {lead.industry_category && (
                  <span className="badge" style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', borderColor: 'rgba(96,165,250,0.2)', fontSize: '11px' }}>
                    {lead.industry_category}
                  </span>
                )}
                {lead.region && (
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgb(160,160,180)', borderColor: 'rgba(255,255,255,0.1)', fontSize: '11px' }}>
                    📍 {lead.region}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8 mt-2">
                <Field label="Product to Sell" value={lead.product_to_sell} />
                <Field label="Suggested Use Case" value={lead.suggested_use_case} />
                <Field label="Business Model" value={lead.business_model} />
                <Field label="Current Providers" value={lead.current_providers} />
                <Field label="Supported Chains/Rails" value={lead.supported_chains_or_rails} className="md:col-span-2" />
                <Field label="Description" value={lead.description} className="md:col-span-2" />
              </div>
              <div className="flex items-center gap-4 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <div className="text-xs mb-1" style={{ color: 'rgb(100,100,120)' }}>Lead Score</div>
                  <div className="text-xl font-bold" style={{ color: lead.lead_score != null ? (lead.lead_score >= 85 ? '#a78bfa' : lead.lead_score >= 70 ? '#34d399' : lead.lead_score >= 50 ? '#fbbf24' : '#f87171') : 'rgb(100,100,120)' }}>
                    {lead.lead_score ?? '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: 'rgb(100,100,120)' }}>Confidence</div>
                  <div className="text-xl font-bold text-white">{lead.confidence_score ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: 'rgb(100,100,120)' }}>Added</div>
                  <div className="text-sm" style={{ color: 'rgb(160,160,180)' }}>{formatDate(lead.created_at)}</div>
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* Research Findings */}
        {(lead.trigger_reason || lead.facts?.length || lead.assumptions?.length || lead.source_url) && (
          <Section id="research" title="Research Findings" icon={Zap} color="#fbbf24">
            <div className="space-y-4">
              <Field label="Trigger / Reason to Reach Out Now" value={lead.trigger_reason} />
              {lead.source_url && (
                <div>
                  <div className="text-xs font-medium mb-1" style={{ color: 'rgb(100,100,120)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Source</div>
                  <a href={lead.source_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:text-violet-300 transition-colors"
                    style={{ color: '#60a5fa' }}>
                    <Link2 size={12} />
                    {lead.source_url}
                    <ExternalLink size={11} />
                  </a>
                </div>
              )}
              {(lead.facts as {text:string}[] || []).length > 0 && (
                <div>
                  <div className="text-xs font-medium mb-2" style={{ color: 'rgb(100,100,120)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    ✓ Facts (Verified)
                  </div>
                  <ul className="space-y-1">
                    {(lead.facts as {text:string}[]).map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'rgb(200,200,220)' }}>
                        <span style={{ color: '#34d399', marginTop: '2px', flexShrink: 0 }}>✓</span>
                        {f.text || String(f)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(lead.assumptions as {text:string}[] || []).length > 0 && (
                <div>
                  <div className="text-xs font-medium mb-2" style={{ color: 'rgb(100,100,120)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    ~ Assumptions (Inferred)
                  </div>
                  <ul className="space-y-1">
                    {(lead.assumptions as {text:string}[]).map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'rgb(180,180,200)' }}>
                        <span style={{ color: '#fbbf24', marginTop: '2px', flexShrink: 0 }}>~</span>
                        {a.text || String(a)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Pain Point */}
        <Section id="pain" title="Pain Point Analysis" icon={AlertTriangle} color="#f87171">
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Pain Point</label>
                <textarea className={inputClass} style={{ ...inputStyle, resize: 'vertical' as const }} rows={3} value={editForm.pain_point || ''} onChange={e => setEditForm(f => ({ ...f, pain_point: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Severity</label>
                  <select className={inputClass} style={inputStyle} value={editForm.pain_point_severity || ''} onChange={e => setEditForm(f => ({ ...f, pain_point_severity: e.target.value as Lead['pain_point_severity'] }))}>
                    <option value="">Select</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Evidence</label>
                  <input className={inputClass} style={inputStyle} value={editForm.pain_point_evidence || ''} onChange={e => setEditForm(f => ({ ...f, pain_point_evidence: e.target.value }))} />
                </div>
              </div>
            </div>
          ) : lead.pain_point ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
                <p className="text-sm leading-relaxed" style={{ color: 'rgb(220,200,200)' }}>{lead.pain_point}</p>
              </div>
              <div className="flex gap-4">
                {lead.pain_point_severity && (
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'rgb(100,100,120)' }}>Severity</div>
                    <span className={cn('badge', getSeverityColor(lead.pain_point_severity))}>
                      {lead.pain_point_severity}
                    </span>
                  </div>
                )}
              </div>
              <Field label="Evidence" value={lead.pain_point_evidence} />
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm mb-3" style={{ color: 'rgb(100,100,120)' }}>No pain point identified yet</p>
              <button onClick={() => runAI('pain_points')} className="btn btn-ai" style={{ fontSize: '12px' }}>
                <Sparkles size={12} /> Identify with AI
              </button>
            </div>
          )}
        </Section>

        {/* Kima Fit */}
        <Section id="kima" title="Kima Fit" icon={Target} color="#34d399">
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Kima Fit</label>
                <textarea className={inputClass} style={{ ...inputStyle, resize: 'vertical' as const }} rows={3} value={editForm.kima_fit || ''} onChange={e => setEditForm(f => ({ ...f, kima_fit: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Settlement Angle</label>
                <input className={inputClass} style={inputStyle} value={editForm.settlement_angle || ''} onChange={e => setEditForm(f => ({ ...f, settlement_angle: e.target.value }))} />
              </div>
            </div>
          ) : lead.kima_fit ? (
            <div className="space-y-3">
              <div className="p-4 rounded-xl" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
                <p className="text-sm leading-relaxed" style={{ color: 'rgb(200,220,210)' }}>{lead.kima_fit}</p>
              </div>
              <Field label="Settlement Angle" value={lead.settlement_angle} />
              <Field label="Integration Feasibility" value={lead.integration_feasibility} />
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm mb-3" style={{ color: 'rgb(100,100,120)' }}>Kima fit not analyzed yet</p>
              <button onClick={() => runAI('kima_fit')} className="btn btn-ai" style={{ fontSize: '12px' }}>
                <Sparkles size={12} /> Analyze Kima Fit
              </button>
            </div>
          )}
        </Section>

        {/* Aeredium Fit */}
        <Section id="aeredium" title="Aeredium Fit" icon={Shield} color="#a78bfa">
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Aeredium Fit</label>
                <textarea className={inputClass} style={{ ...inputStyle, resize: 'vertical' as const }} rows={3} value={editForm.aeredium_fit || ''} onChange={e => setEditForm(f => ({ ...f, aeredium_fit: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Security Angle</label>
                <input className={inputClass} style={inputStyle} value={editForm.security_angle || ''} onChange={e => setEditForm(f => ({ ...f, security_angle: e.target.value }))} />
              </div>
            </div>
          ) : lead.aeredium_fit ? (
            <div className="space-y-3">
              <div className="p-4 rounded-xl" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                <p className="text-sm leading-relaxed" style={{ color: 'rgb(210,200,230)' }}>{lead.aeredium_fit}</p>
              </div>
              <Field label="Security Angle" value={lead.security_angle} />
              <Field label="Risk Angle" value={lead.risk_angle} />
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm mb-3" style={{ color: 'rgb(100,100,120)' }}>Aeredium fit not analyzed yet</p>
              <button onClick={() => runAI('aeredium_fit')} className="btn btn-ai" style={{ fontSize: '12px' }}>
                <Sparkles size={12} /> Analyze Aeredium Fit
              </button>
            </div>
          )}
        </Section>
        </div>

        {/* Right Column (Contacts, Outreach, Feedback) */}
        <div className="space-y-6">

        {/* Contacts */}
        <Section id="contacts" title="Contacts" icon={Users} color="#22d3ee"
          badge={contacts.length > 0 ? String(contacts.length) : undefined}>
          <div className="space-y-3">
            {contacts.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm mb-3" style={{ color: 'rgb(100,100,120)' }}>No contacts found yet</p>
                <button onClick={() => runAI('contacts')} className="btn btn-ai" style={{ fontSize: '12px' }}>
                  <Sparkles size={12} /> Find Contacts with AI
                </button>
              </div>
            ) : (
              contacts.map(contact => (
                <div key={contact.id} className="p-4 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-sm font-semibold text-white">{contact.name || 'Unknown Name'}</div>
                      <div className="text-xs" style={{ color: 'rgb(160,160,180)' }}>{contact.role}</div>
                    </div>
                    <span className={cn('badge', getConfidenceColor(contact.contact_confidence))}>
                      {contact.contact_confidence || 'unknown'} confidence
                    </span>
                  </div>
                  {contact.reason_this_person && (
                    <p className="text-xs mb-3 leading-relaxed" style={{ color: 'rgb(140,140,160)' }}>
                      {contact.reason_this_person}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {contact.linkedin_url && (
                      <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer"
                        className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 8px' }}>
                        <ExternalLink size={10} />LinkedIn
                      </a>
                    )}
                    {contact.twitter_url && (
                      <a href={contact.twitter_url} target="_blank" rel="noopener noreferrer"
                        className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 8px' }}>
                        <ExternalLink size={10} />Twitter
                      </a>
                    )}
                    {contact.telegram && (
                      <span className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 8px' }}>
                        📱 {contact.telegram}
                      </span>
                    )}
                    {contact.email && (
                      <button onClick={() => copyToClipboard(contact.email!)}
                        className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 8px' }}>
                        <Copy size={10} />{contact.email}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
            <button onClick={() => runAI('contacts')} disabled={aiAction === 'contacts'}
              className="btn btn-ghost text-xs" style={{ padding: '5px 8px' }}>
              {aiAction === 'contacts' ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
              Refresh with AI
            </button>
          </div>
        </Section>

        {/* Outreach Messages */}
        <Section id="outreach" title="Outreach Messages" icon={MessageSquare} color="#fbbf24"
          badge={outreachMessages.length > 0 ? String(outreachMessages.length) : undefined}>
          <div className="space-y-4">
            {outreachMessages.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm mb-3" style={{ color: 'rgb(100,100,120)' }}>No messages drafted yet</p>
                <Link href={`/outreach?lead=${lead.id}`} className="btn btn-ai" style={{ fontSize: '12px' }}>
                  <MessageSquare size={12} /> Open Outreach Studio
                </Link>
              </div>
            ) : (
              outreachMessages.map(msg => (
                <div key={msg.id} className="p-4 rounded-xl space-y-3"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2">
                    <span className="badge" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', borderColor: 'rgba(251,191,36,0.2)', fontSize: '10px' }}>
                      {msg.channel}
                    </span>
                    <span className="text-xs" style={{ color: 'rgb(100,100,120)' }}>{msg.tone}</span>
                    <span className="text-xs" style={{ color: 'rgb(100,100,120)' }}>· {formatDate(msg.created_at)}</span>
                  </div>
                  {msg.message && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium" style={{ color: 'rgb(100,100,120)' }}>FIRST MESSAGE</span>
                        <button onClick={() => copyToClipboard(msg.message!)} className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: '10px' }}>
                          <Copy size={9} /> Copy
                        </button>
                      </div>
                      <div className="p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap"
                        style={{ background: 'rgba(255,255,255,0.03)', color: 'rgb(200,200,220)', fontFamily: 'inherit' }}>
                        {msg.message}
                      </div>
                    </div>
                  )}
                  {msg.followup_1 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium" style={{ color: 'rgb(100,100,120)' }}>FOLLOW-UP 1</span>
                        <button onClick={() => copyToClipboard(msg.followup_1!)} className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: '10px' }}>
                          <Copy size={9} /> Copy
                        </button>
                      </div>
                      <div className="p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap"
                        style={{ background: 'rgba(255,255,255,0.03)', color: 'rgb(200,200,220)', fontFamily: 'inherit' }}>
                        {msg.followup_1}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Section>

        {/* Feedback */}
        <Section id="feedback" title="Log Outcome / Feedback" icon={ThumbsUp} color="#34d399">
          <FeedbackForm leadId={lead.id} onSaved={loadLead} />
        </Section>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeedbackForm({ leadId, onSaved }: { leadId: string; onSaved: () => void }) {
  const supabase = createClient()
  const [form, setForm] = useState({
    action_taken: '',
    lead_quality: '',
    pain_point_accuracy: '',
    contact_accuracy: '',
    message_quality: '',
    outcome: '',
    rejection_reason: '',
    arpit_notes: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('feedback_memory').insert({
      lead_id: leadId,
      ...form,
      action_taken: form.action_taken || null,
      lead_quality: form.lead_quality || null,
      pain_point_accuracy: form.pain_point_accuracy || null,
      contact_accuracy: form.contact_accuracy || null,
      message_quality: form.message_quality || null,
      outcome: form.outcome || null,
      rejection_reason: form.rejection_reason || null,
      arpit_notes: form.arpit_notes || null,
    })
    if (error) toast.error('Failed to save feedback')
    else { toast.success('Feedback saved — training the agent'); onSaved() }
    setSaving(false)
  }

  const sel = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))
  const selClass = 'input-dark text-xs'
  const selStyle = { fontSize: '12px', padding: '6px 8px' }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Action Taken</label>
          <select className={selClass} style={selStyle} value={form.action_taken} onChange={e => sel('action_taken', e.target.value)}>
            <option value="">Select action</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="edited">Edited</option>
            <option value="contacted">Contacted</option>
            <option value="replied">Replied</option>
            <option value="meeting_booked">Meeting Booked</option>
            <option value="deal_closed">Deal Closed</option>
            <option value="needs_more_research">Needs More Research</option>
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Lead Quality</label>
          <select className={selClass} style={selStyle} value={form.lead_quality} onChange={e => sel('lead_quality', e.target.value)}>
            <option value="">Select</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="average">Average</option>
            <option value="poor">Poor</option>
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Pain Point Accuracy</label>
          <select className={selClass} style={selStyle} value={form.pain_point_accuracy} onChange={e => sel('pain_point_accuracy', e.target.value)}>
            <option value="">Select</option>
            <option value="very_accurate">Very Accurate</option>
            <option value="mostly_accurate">Mostly Accurate</option>
            <option value="partially_accurate">Partially Accurate</option>
            <option value="inaccurate">Inaccurate</option>
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Contact Accuracy</label>
          <select className={selClass} style={selStyle} value={form.contact_accuracy} onChange={e => sel('contact_accuracy', e.target.value)}>
            <option value="">Select</option>
            <option value="perfect">Perfect</option>
            <option value="good">Good</option>
            <option value="off">Off</option>
            <option value="wrong">Wrong</option>
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Message Quality</label>
          <select className={selClass} style={selStyle} value={form.message_quality} onChange={e => sel('message_quality', e.target.value)}>
            <option value="">Select</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="needs_work">Needs Work</option>
            <option value="poor">Poor</option>
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Outcome</label>
          <select className={selClass} style={selStyle} value={form.outcome} onChange={e => sel('outcome', e.target.value)}>
            <option value="">Select outcome</option>
            <option value="replied">Replied</option>
            <option value="meeting_booked">Meeting Booked</option>
            <option value="deal_in_progress">Deal In Progress</option>
            <option value="deal_closed">Deal Closed 🎉</option>
            <option value="no_response">No Response</option>
            <option value="rejected_by_prospect">Rejected by Prospect</option>
            <option value="not_yet_sent">Not Yet Sent</option>
          </select>
        </div>
      </div>
      {form.action_taken === 'rejected' && (
        <div>
          <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Rejection Reason</label>
          <input className="input-dark text-xs" style={{ fontSize: '12px' }} value={form.rejection_reason} onChange={e => setForm(f => ({ ...f, rejection_reason: e.target.value }))} placeholder="Why are you rejecting this lead?" />
        </div>
      )}
      <div>
        <label className="block text-xs mb-1" style={{ color: 'rgb(120,120,140)' }}>Your Notes</label>
        <textarea className="input-dark text-xs" style={{ fontSize: '12px', resize: 'vertical' }} rows={2} value={form.arpit_notes} onChange={e => setForm(f => ({ ...f, arpit_notes: e.target.value }))} placeholder="Any notes for the agent to learn from..." />
      </div>
      <button type="submit" disabled={saving} className="btn btn-success" style={{ fontSize: '12px' }}>
        {saving ? <><Loader2 size={12} className="animate-spin" />Saving...</> : <><Save size={12} />Save Feedback</>}
      </button>
    </form>
  )
}


