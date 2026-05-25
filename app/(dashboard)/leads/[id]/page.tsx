'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  ArrowLeft, ExternalLink, Star, Edit3 as Edit, Save, X, Loader2,
  Sparkles, Target, Shield, Users, MessageSquare, ThumbsUp,
  Copy, CheckCircle, CheckCircle2, AlertTriangle, Globe, Link2, Send,
  ChevronDown, ChevronUp, RefreshCw, Building2, Brain,
  FileSearch, Puzzle, Calendar, Mail,
  MapPin
} from 'lucide-react'
import {
  cn, getScoreBg, getStatusColor, getStatusLabel, getSeverityColor,
  getConfidenceColor, formatDate
} from '@/lib/utils'
import type { Lead, Contact, OutreachMessage } from '@/lib/types'
import { INDUSTRY_CATEGORIES, CUSTOMER_CATEGORIES, PRODUCTS_TO_SELL, REGIONS } from '@/lib/types'

type AIAction = 'research' | 'pain_points' | 'kima_fit' | 'aeredium_fit' | 'classify' | 'score' | 'contacts' | null

/* ── Design tokens (matching reference exactly) ──────────────── */
const C = {
  pageBg:      '#070A12',
  containerBg: '#0B0F1A',
  headerBg:    'linear-gradient(to right, #0C1020, #090B13)',
  cardBg:      '#101522',
  nestedBg:    '#151A2A',
  border:      '1px solid rgba(255,255,255,0.08)',
  borderStrong:'1px solid rgba(255,255,255,0.12)',
}

/* ── Primitive components ────────────────────────────────────── */

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={{
      borderRadius: 16, border: C.border, background: C.cardBg,
      padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.4)', ...style
    }}>
      {children}
    </section>
  )
}

function InfoBlock({ title, value }: { title: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'rgb(100,107,140)', marginBottom: 8, fontWeight: 600 }}>
        {title}
      </p>
      <p style={{ fontSize: 14, lineHeight: 1.65, color: 'rgb(210,215,235)' }}>{value}</p>
    </div>
  )
}

function TagBadge({ label, variant = 'gray' }: { label: string; variant?: 'purple' | 'blue' | 'gray' | 'green' }) {
  const styles: Record<string, React.CSSProperties> = {
    purple: { border: '1px solid rgba(168,85,247,0.35)', background: 'rgba(168,85,247,0.12)', color: 'rgb(196,167,252)' },
    blue:   { border: '1px solid rgba(96,165,250,0.35)',  background: 'rgba(96,165,250,0.1)',   color: 'rgb(147,197,253)' },
    green:  { border: '1px solid rgba(52,211,153,0.35)',  background: 'rgba(52,211,153,0.1)',   color: 'rgb(110,231,183)' },
    gray:   { border: '1px solid rgba(255,255,255,0.1)',  background: 'rgba(255,255,255,0.05)', color: 'rgb(203,213,225)' },
  }
  return (
    <span style={{ borderRadius: 8, padding: '6px 14px', fontSize: 13, ...styles[variant] }}>
      {label}
    </span>
  )
}

function ActionBtn({ icon: Icon, label, variant = 'default', onClick, disabled, href }: {
  icon: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>; label: string
  variant?: 'default' | 'green' | 'red' | 'purple'
  onClick?: () => void; disabled?: boolean; href?: string
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: { border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgb(203,213,225)' },
    green:   { border: '1px solid rgba(52,211,153,0.3)',  background: 'rgba(52,211,153,0.1)',   color: 'rgb(110,231,183)' },
    red:     { border: '1px solid rgba(248,113,133,0.3)', background: 'rgba(248,113,133,0.1)',  color: 'rgb(252,165,165)' },
    purple:  { border: '1px solid rgba(168,85,247,0.4)',  background: 'rgba(168,85,247,0.13)',  color: 'rgb(196,167,252)' },
  }
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
    transition: 'all 0.18s', fontFamily: 'inherit', whiteSpace: 'nowrap',
    ...styles[variant]
  }
  if (href) return <Link href={href} style={base}><Icon size={14} />{label}</Link>
  return <button style={base} onClick={onClick} disabled={disabled}><Icon size={14} />{label}</button>
}

function FindingCard({ icon: Icon, title, subtitle, body, rightLabel, rightValue, pill, pillVariant = 'purple', expanded, onToggle, children }: {
  icon: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>; title: string; subtitle?: string
  body?: string | null; rightLabel?: string; rightValue?: string | null
  pill?: string | null; pillVariant?: 'purple' | 'red' | 'green'
  expanded: boolean; onToggle: () => void; children?: React.ReactNode
}) {
  const iconBg: Record<string, React.CSSProperties> = {
    purple: { background: 'rgba(168,85,247,0.13)', color: 'rgb(196,167,252)' },
    red:    { background: 'rgba(248,113,133,0.12)', color: 'rgb(252,165,165)' },
    green:  { background: 'rgba(52,211,153,0.12)',  color: 'rgb(110,231,183)' },
  }
  const pillSty: Record<string, React.CSSProperties> = {
    red:    { border: '1px solid rgba(248,113,133,0.4)', background: 'rgba(248,113,133,0.1)', color: 'rgb(252,165,165)' },
    green:  { border: '1px solid rgba(52,211,153,0.4)',  background: 'rgba(52,211,153,0.1)',  color: 'rgb(110,231,183)' },
    purple: { border: '1px solid rgba(168,85,247,0.4)',  background: 'rgba(168,85,247,0.1)',  color: 'rgb(196,167,252)' },
  }
  return (
    <div style={{ borderRadius: 16, border: C.border, background: C.cardBg, boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
      {/* row */}
      <button onClick={onToggle} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '18px 20px', display: 'grid', gridTemplateColumns: '1fr auto 24px', gap: 20, alignItems: 'center', borderBottom: expanded ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
        {/* left */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', textAlign: 'left' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...iconBg[pillVariant] }}>
            <Icon size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'white', margin: 0, lineHeight: 1.3 }}>{title}</h3>
            {subtitle && <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'rgb(100,107,140)', marginTop: 4, marginBottom: 0 }}>{subtitle}</p>}
            {body && <p style={{ fontSize: 13, color: 'rgb(190,195,220)', marginTop: 6, lineHeight: 1.6 }}>{body}</p>}
          </div>
        </div>
        {/* right label + pill/link */}
        <div style={{ minWidth: 200 }}>
          {rightLabel && <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'rgb(100,107,140)', marginBottom: 8 }}>{rightLabel}</p>}
          {rightValue && (
            <p style={{ fontSize: 13, color: 'rgb(96,165,250)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rightValue}</span>
              <ExternalLink size={13} />
            </p>
          )}
          {pill && (
            <span style={{ display: 'inline-flex', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 500, ...pillSty[pillVariant] }}>
              {pill}
            </span>
          )}
        </div>
        {/* chevron */}
        {expanded ? <ChevronUp size={18} color="rgb(100,107,140)" /> : <ChevronDown size={18} color="rgb(100,107,140)" />}
      </button>
      {/* expanded body */}
      {expanded && children && (
        <div style={{ padding: '20px 24px' }}>{children}</div>
      )}
    </div>
  )
}

function StatStrip({ score, confidence, addedAt }: { score?: number | null; confidence?: number | null; addedAt: string }) {
  const scoreColor = score == null ? '#a78bfa' : score >= 85 ? '#c084fc' : score >= 70 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171'
  const pct = score != null ? Math.min(score, 100) : 0
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, borderRadius: 16, border: C.border, background: C.cardBg, padding: 20 }}>
      {/* Score */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgb(148,163,184)', fontSize: 13 }}>
          <Star size={14} color="#c084fc" />
          Lead Score
        </div>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 30, fontWeight: 600, color: scoreColor, fontVariantNumeric: 'tabular-nums' }}>{score ?? '—'}</span>
          {score != null && (
            <div style={{ height: 8, width: 80, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: '#7c3aed', transition: 'width 0.6s ease' }} />
            </div>
          )}
        </div>
      </div>
      {/* Confidence */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgb(148,163,184)', fontSize: 13 }}>
          <Shield size={14} color="#c084fc" />
          Confidence
        </div>
        <div style={{ marginTop: 10 }}>
          <span style={{ fontSize: 30, fontWeight: 600, color: '#c084fc', fontVariantNumeric: 'tabular-nums' }}>{confidence ?? '—'}</span>
        </div>
      </div>
      {/* Added */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgb(148,163,184)', fontSize: 13 }}>
          <Calendar size={14} color="#c084fc" />
          Added
        </div>
        <div style={{ marginTop: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'rgb(203,213,225)' }}>{formatDate(addedAt)}</span>
        </div>
      </div>
    </div>
  )
}

function ContactCard({ contact, onRefresh, refreshing }: { contact: Contact; onRefresh: () => void; refreshing: boolean }) {
  const initials = contact.name
    ? contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'UN'

  const confStyle: React.CSSProperties = contact.contact_confidence === 'high'
    ? { border: '1px solid rgba(52,211,153,0.4)', background: 'rgba(52,211,153,0.1)', color: 'rgb(110,231,183)' }
    : contact.contact_confidence === 'low'
    ? { border: '1px solid rgba(248,113,133,0.4)', background: 'rgba(248,113,133,0.1)', color: 'rgb(252,165,165)' }
    : { border: '1px solid rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.1)', color: 'rgb(253,224,71)' }

  return (
    <div style={{ borderRadius: 16, border: C.border, background: C.nestedBg, padding: 20 }}>
      {/* top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          {/* circular avatar */}
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #374151, #111827)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: 'rgb(209,213,219)', flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'white', margin: 0 }}>{contact.name || 'Unknown Name'}</h3>
            <p style={{ fontSize: 13, color: 'rgb(148,163,184)', marginTop: 2 }}>{contact.role}</p>
            {contact.reason_this_person && (
              <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: 'rgb(203,213,225)', maxWidth: 400 }}>
                {contact.reason_this_person}
              </p>
            )}
          </div>
        </div>
        {/* confidence badge */}
        {contact.contact_confidence && (
          <span style={{ borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 500, flexShrink: 0, ...confStyle }}>
            {contact.contact_confidence.charAt(0).toUpperCase() + contact.contact_confidence.slice(1)} Confidence
          </span>
        )}
      </div>

      {/* social buttons */}
      <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {contact.linkedin_url && (
          <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 8, border: C.border, background: 'rgba(255,255,255,0.04)', padding: '7px 14px', fontSize: 13, color: 'rgb(203,213,225)', textDecoration: 'none' }}>
            <ExternalLink size={14} color="rgb(196,167,252)" />LinkedIn
          </a>
        )}
        {contact.twitter_url && (
          <a href={contact.twitter_url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 8, border: C.border, background: 'rgba(255,255,255,0.04)', padding: '7px 14px', fontSize: 13, color: 'rgb(203,213,225)', textDecoration: 'none' }}>
            <ExternalLink size={14} color="rgb(196,167,252)" />Twitter / X
          </a>
        )}
        {contact.email && (
          <button onClick={() => { navigator.clipboard.writeText(contact.email!); toast.success('Copied') }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 8, border: C.border, background: 'rgba(255,255,255,0.04)', padding: '7px 14px', fontSize: 13, color: 'rgb(203,213,225)', cursor: 'pointer', maxWidth: 220 }}>
            <Mail size={14} color="rgb(196,167,252)" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.email}</span>
          </button>
        )}
      </div>

      {/* refresh */}
      <div style={{ marginTop: 18, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 14 }}>
        <button onClick={onRefresh} disabled={refreshing}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgb(196,167,252)', background: 'none', border: 'none', cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.5 : 1 }}>
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh with AI
        </button>
      </div>
    </div>
  )
}

function AccordionPanel({ icon: Icon, title, iconColor, expanded, onToggle, children }: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; title: string; iconColor: string
  expanded: boolean; onToggle: () => void; children?: React.ReactNode
}) {
  return (
    <div style={{ borderRadius: 16, border: C.border, background: C.cardBg, boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
      <button onClick={onToggle} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: expanded ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon size={18} style={{ color: iconColor }} />
          <h3 style={{ fontSize: 15, fontWeight: 500, color: 'rgb(241,245,249)', margin: 0 }}>{title}</h3>
        </div>
        {expanded ? <ChevronUp size={18} color="rgb(100,107,140)" /> : <ChevronDown size={18} color="rgb(100,107,140)" />}
      </button>
      {expanded && children && <div style={{ padding: '20px 22px' }}>{children}</div>}
    </div>
  )
}

/* ══════════════════════════════════════════════════════ */
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
            email: c.email_pattern || null,
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

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280 }}>
      <Loader2 size={24} className="animate-spin" color="#a78bfa" />
    </div>
  )
  if (!lead) return null

  const ic = 'input-dark'; const is = { fontSize: '13px', padding: '8px 11px' }

  /* status badge color */
  const statusBadgeStyle: React.CSSProperties = lead.status === 'approved'
    ? { border: '1px solid rgba(52,211,153,0.4)', background: 'rgba(52,211,153,0.1)', color: 'rgb(110,231,183)' }
    : lead.status === 'rejected'
    ? { border: '1px solid rgba(248,113,133,0.4)', background: 'rgba(248,113,133,0.1)', color: 'rgb(252,165,165)' }
    : lead.status === 'contacted' || lead.status === 'replied'
    ? { border: '1px solid rgba(34,211,238,0.4)', background: 'rgba(34,211,238,0.1)', color: 'rgb(103,232,249)' }
    : { border: '1px solid rgba(96,165,250,0.4)', background: 'rgba(96,165,250,0.1)', color: 'rgb(147,197,253)' }

  return (
    <div className="fade-in" style={{ background: C.pageBg, minHeight: '100vh', padding: 16 }}>
      <div style={{ borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', background: C.containerBg, boxShadow: '0 40px 80px rgba(0,0,0,0.6)', overflow: 'hidden' }}>

        {/* ══ HEADER ══════════════════════════════════════════ */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: C.headerBg }}>

          {/* Row 1: back + identity + actions */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

              {/* Back + avatar group */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Link href="/leads" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgb(203,213,225)', textDecoration: 'none' }}>
                  <ArrowLeft size={15} />
                </Link>
                {/* Avatar */}
                <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #6d28d9, #3730a3)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(109,40,217,0.4)', fontSize: 22, fontWeight: 700, color: 'rgb(221,214,254)' }}>
                  {lead.company_name.charAt(0).toUpperCase()}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: 28, fontWeight: 600, color: 'white', margin: 0, letterSpacing: '-0.02em' }}>
                    {lead.company_name}
                  </h1>
                  {lead.priority === 'excellent' && <Star size={18} color="#c084fc" fill="#c084fc" />}
                  {lead.lead_score != null && (
                    <span style={{ borderRadius: 999, border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.13)', padding: '4px 14px', fontSize: 13, color: 'rgb(196,167,252)' }}>
                      {lead.lead_score}
                    </span>
                  )}
                  <span style={{ borderRadius: 999, padding: '4px 14px', fontSize: 13, ...statusBadgeStyle }}>
                    {getStatusLabel(lead.status)}
                  </span>
                </div>
                {lead.website && (
                  <a href={lead.website} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13, color: 'rgb(100,116,139)', textDecoration: 'none' }}>
                    <Globe size={13} />
                    {lead.website}
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
              {!editing ? (
                <ActionBtn icon={Edit} label="Edit" onClick={() => setEditing(true)} />
              ) : (
                <>
                  <ActionBtn icon={saving ? Loader2 : Save} label={saving ? 'Saving…' : 'Save'} variant="purple" onClick={saveEdits} disabled={saving} />
                  <ActionBtn icon={X} label="Cancel" onClick={() => setEditing(false)} />
                </>
              )}
              {lead.status !== 'approved' && (
                <ActionBtn icon={CheckCircle} label="Approve" variant="green" onClick={() => updateStatus('approved')} />
              )}
              {lead.status !== 'rejected' && (
                <ActionBtn icon={X} label="Reject" variant="red" onClick={() => updateStatus('rejected')} />
              )}
              {lead.status === 'approved' && (
                <ActionBtn icon={Send} label="Mark Contacted" onClick={() => updateStatus('contacted')} />
              )}
              <ActionBtn icon={MessageSquare} label="Outreach Studio" variant="purple" href={`/outreach?lead=${lead.id}`} />
            </div>
          </div>

          {/* Row 2: AI Actions */}
          <div style={{ marginTop: 22, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgb(203,213,225)', marginRight: 4 }}>
              <Sparkles size={14} color="#c084fc" />
              <span>AI Actions</span>
            </div>
            {([
              { action: 'research' as AIAction,    label: 'Research Company'     },
              { action: 'pain_points' as AIAction, label: 'Identify Pain Points' },
              { action: 'kima_fit' as AIAction,    label: 'Kima Fit'             },
              { action: 'aeredium_fit' as AIAction,label: 'Aeredium Fit'         },
              { action: 'classify' as AIAction,    label: 'Classify'             },
              { action: 'score' as AIAction,       label: 'Score Lead'           },
              { action: 'contacts' as AIAction,    label: 'Find Contacts'        },
            ]).map(({ action, label }) => (
              <button key={action} onClick={() => runAI(action)} disabled={aiAction !== null}
                style={{ borderRadius: 9, border: '1px solid rgba(168,85,247,0.28)', background: 'rgba(168,85,247,0.09)', padding: '8px 14px', fontSize: 13, color: 'rgb(196,167,252)', cursor: aiAction !== null ? 'not-allowed' : 'pointer', opacity: aiAction !== null && aiAction !== action ? 0.45 : 1, display: 'inline-flex', alignItems: 'center', gap: 7, transition: 'background 0.15s', fontFamily: 'inherit' }}>
                {aiAction === action ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ══ BODY ════════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: 16, padding: 16 }}>

          {/* ── LEFT COLUMN ──────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Company Overview card */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <Building2 size={20} color="#c084fc" />
                <h2 style={{ fontSize: 19, fontWeight: 600, color: 'white', margin: 0 }}>Company Overview</h2>
              </div>

              {/* Tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
                {(lead.customer_category || []).map(cat => (
                  <TagBadge key={cat} label={cat} variant="purple" />
                ))}
                {lead.industry_category && <TagBadge label={lead.industry_category} variant="blue" />}
                {lead.region && <TagBadge label={lead.region} variant="gray" />}
              </div>

              {/* Edit form */}
              {editing ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[['company_name','Company Name'],['website','Website']].map(([k,l]) => (
                    <div key={k}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgb(100,107,140)', marginBottom: 6 }}>{l}</label>
                      <input className={ic} style={is} value={(editForm as Record<string,string>)[k] || ''} onChange={e => setEditForm(f => ({ ...f, [k]: e.target.value }))} />
                    </div>
                  ))}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgb(100,107,140)', marginBottom: 6 }}>Industry</label>
                    <select className={ic} style={is} value={editForm.industry_category || ''} onChange={e => setEditForm(f => ({ ...f, industry_category: e.target.value }))}>
                      <option value="">Select</option>
                      {INDUSTRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgb(100,107,140)', marginBottom: 6 }}>Region</label>
                    <select className={ic} style={is} value={editForm.region || ''} onChange={e => setEditForm(f => ({ ...f, region: e.target.value }))}>
                      <option value="">Select</option>
                      {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgb(100,107,140)', marginBottom: 6 }}>Product to Sell</label>
                    <select className={ic} style={is} value={editForm.product_to_sell || ''} onChange={e => setEditForm(f => ({ ...f, product_to_sell: e.target.value }))}>
                      <option value="">Select</option>
                      {PRODUCTS_TO_SELL.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgb(100,107,140)', marginBottom: 6 }}>Status</label>
                    <select className={ic} style={is} value={editForm.status || 'new'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as Lead['status'] }))}>
                      {['new','researching','qualified','approved','rejected','contacted','replied','meeting_booked','archived','needs_more_research'].map(s =>
                        <option key={s} value={s}>{getStatusLabel(s as Lead['status'])}</option>
                      )}
                    </select>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgb(100,107,140)', marginBottom: 6 }}>Description</label>
                    <textarea className={ic} style={{ ...is, resize: 'vertical' }} rows={3} value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgb(100,107,140)', marginBottom: 6 }}>Lead Score</label>
                    <input className={ic} style={is} type="number" min="0" max="100" value={editForm.lead_score || ''} onChange={e => setEditForm(f => ({ ...f, lead_score: parseInt(e.target.value) || undefined }))} />
                  </div>
                </div>
              ) : (
                <>
                  {/* 2-col info grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '20px 0' }}>
                    <InfoBlock title="Product to Sell"    value={lead.product_to_sell} />
                    <InfoBlock title="Suggested Use Case" value={lead.suggested_use_case} />
                    <InfoBlock title="Business Model"     value={lead.business_model} />
                    <InfoBlock title="Current Providers"  value={lead.current_providers} />
                  </div>
                  {/* full-width fields */}
                  <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <InfoBlock title="Supported Chains / Rails" value={lead.supported_chains_or_rails} />
                    <InfoBlock title="Description"              value={lead.description || lead.product_summary} />
                  </div>
                </>
              )}
            </Card>

            {/* Stats strip */}
            <StatStrip score={lead.lead_score} confidence={lead.confidence_score} addedAt={lead.created_at} />

            {/* Research Findings */}
            <FindingCard
              icon={FileSearch} title="Research Findings" pillVariant="purple"
              subtitle={lead.trigger_reason ? 'Trigger / Reason to Reach Out Now' : undefined}
              body={lead.trigger_reason || 'No research findings yet.'}
              rightLabel={lead.source_url ? 'Source' : undefined}
              rightValue={lead.source_url}
              expanded={expanded.research} onToggle={() => toggle('research')}
            >
              {(lead.facts as {text:string}[] || []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(lead.facts as {text:string}[]).map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'rgb(190,195,220)' }}>
                      <span style={{ color: '#34d399', flexShrink: 0 }}>✓</span>
                      {f.text || String(f)}
                    </div>
                  ))}
                </div>
              )}
              {!lead.trigger_reason && (
                <button onClick={() => runAI('research')} disabled={aiAction !== null}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 9, border: '1px solid rgba(168,85,247,0.28)', background: 'rgba(168,85,247,0.09)', padding: '8px 14px', fontSize: 13, color: 'rgb(196,167,252)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Sparkles size={12} />Research with AI
                </button>
              )}
            </FindingCard>

            {/* Pain Point */}
            <FindingCard
              icon={AlertTriangle} title="Pain Point Analysis" pillVariant="red"
              body={lead.pain_point || 'No pain point identified yet.'}
              rightLabel={lead.pain_point_severity ? 'Severity' : undefined}
              pill={lead.pain_point_severity ? lead.pain_point_severity.charAt(0).toUpperCase() + lead.pain_point_severity.slice(1) : undefined}
              expanded={expanded.pain} onToggle={() => toggle('pain')}
            >
              {lead.pain_point ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {lead.pain_point_evidence && <InfoBlock title="Evidence" value={lead.pain_point_evidence} />}
                  {editing && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgb(100,107,140)', marginBottom: 6 }}>Pain Point</label>
                        <textarea className={ic} style={{ ...is, resize: 'vertical' }} rows={2} value={editForm.pain_point || ''} onChange={e => setEditForm(f => ({ ...f, pain_point: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgb(100,107,140)', marginBottom: 6 }}>Severity</label>
                        <select className={ic} style={is} value={editForm.pain_point_severity || ''} onChange={e => setEditForm(f => ({ ...f, pain_point_severity: e.target.value as Lead['pain_point_severity'] }))}>
                          <option value="">Select</option>
                          {['critical','high','medium','low'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => runAI('pain_points')} disabled={aiAction !== null}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 9, border: '1px solid rgba(248,113,133,0.28)', background: 'rgba(248,113,133,0.09)', padding: '8px 14px', fontSize: 13, color: 'rgb(252,165,165)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Sparkles size={12} />Identify with AI
                </button>
              )}
            </FindingCard>

            {/* Kima Fit */}
            <FindingCard
              icon={Puzzle} title="Kima Fit" pillVariant="green"
              body={lead.kima_fit || 'Kima fit not analyzed yet.'}
              rightLabel={lead.settlement_angle ? 'Settlement Angle' : lead.integration_feasibility ? 'Integration' : undefined}
              pill={lead.settlement_angle || lead.integration_feasibility || undefined}
              expanded={expanded.kima} onToggle={() => toggle('kima')}
            >
              {lead.kima_fit ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <InfoBlock title="Suggested Use Case"     value={lead.suggested_use_case} />
                  <InfoBlock title="Integration Feasibility" value={lead.integration_feasibility} />
                </div>
              ) : (
                <button onClick={() => runAI('kima_fit')} disabled={aiAction !== null}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 9, border: '1px solid rgba(52,211,153,0.28)', background: 'rgba(52,211,153,0.09)', padding: '8px 14px', fontSize: 13, color: 'rgb(110,231,183)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Sparkles size={12} />Analyze Kima Fit
                </button>
              )}
            </FindingCard>

            {/* Aeredium Fit */}
            <FindingCard
              icon={Shield} title="Aeredium Fit" pillVariant="purple"
              body={lead.aeredium_fit || 'Aeredium fit not analyzed yet.'}
              rightLabel={lead.security_angle ? 'Security Angle' : undefined}
              pill={lead.security_angle || undefined}
              expanded={expanded.aeredium} onToggle={() => toggle('aeredium')}
            >
              {lead.aeredium_fit ? (
                <InfoBlock title="Risk Angle" value={lead.risk_angle} />
              ) : (
                <button onClick={() => runAI('aeredium_fit')} disabled={aiAction !== null}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 9, border: '1px solid rgba(168,85,247,0.28)', background: 'rgba(168,85,247,0.09)', padding: '8px 14px', fontSize: 13, color: 'rgb(196,167,252)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Sparkles size={12} />Analyze Aeredium Fit
                </button>
              )}
            </FindingCard>

          </div>

          {/* ── RIGHT COLUMN ──────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Contacts card */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <Users size={20} color="#c084fc" />
                <h2 style={{ fontSize: 19, fontWeight: 600, color: 'white', margin: 0 }}>Contacts</h2>
                <span style={{ borderRadius: 999, background: 'rgba(168,85,247,0.18)', color: 'rgb(196,167,252)', padding: '2px 10px', fontSize: 13 }}>
                  {contacts.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {contacts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <Users size={32} color="rgba(196,167,252,0.3)" style={{ margin: '0 auto 12px' }} />
                    <p style={{ fontSize: 13, color: 'rgb(100,107,140)', marginBottom: 16 }}>No contacts found yet</p>
                    <button onClick={() => runAI('contacts')} disabled={aiAction !== null}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 9, border: '1px solid rgba(168,85,247,0.28)', background: 'rgba(168,85,247,0.09)', padding: '8px 16px', fontSize: 13, color: 'rgb(196,167,252)', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <Sparkles size={12} />Find with AI
                    </button>
                  </div>
                ) : (
                  contacts.map(contact => (
                    <ContactCard key={contact.id} contact={contact}
                      onRefresh={() => runAI('contacts')}
                      refreshing={aiAction === 'contacts'} />
                  ))
                )}
              </div>
            </Card>

            {/* Outreach Messages accordion */}
            <AccordionPanel icon={MessageSquare} title="Outreach Messages" iconColor="rgb(253,224,71)"
              expanded={expanded.outreach} onToggle={() => toggle('outreach')}>
              {outreachMessages.length === 0 ? (
                <div style={{ textAlign: 'center', paddingBottom: 8 }}>
                  <p style={{ fontSize: 13, color: 'rgb(100,107,140)', marginBottom: 14 }}>No messages drafted yet</p>
                  <Link href={`/outreach?lead=${lead.id}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 9, border: '1px solid rgba(253,224,71,0.28)', background: 'rgba(253,224,71,0.08)', padding: '8px 16px', fontSize: 13, color: 'rgb(253,224,71)', textDecoration: 'none' }}>
                    <MessageSquare size={12} />Open Outreach Studio
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {outreachMessages.map(msg => (
                    <div key={msg.id} style={{ borderRadius: 12, border: '1px solid rgba(253,224,71,0.12)', background: 'rgba(253,224,71,0.04)', padding: 16 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                        <span style={{ borderRadius: 6, border: '1px solid rgba(253,224,71,0.2)', background: 'rgba(253,224,71,0.08)', padding: '3px 10px', fontSize: 11, color: 'rgb(253,224,71)' }}>{msg.channel}</span>
                        <span style={{ fontSize: 11, color: 'rgb(100,107,140)', alignSelf: 'center' }}>{msg.tone} · {formatDate(msg.created_at)}</span>
                      </div>
                      {msg.message && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgb(100,107,140)' }}>First Message</span>
                            <button onClick={() => { navigator.clipboard.writeText(msg.message!); toast.success('Copied') }}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgb(100,107,140)', background: 'none', border: 'none', cursor: 'pointer' }}>
                              <Copy size={10} />Copy
                            </button>
                          </div>
                          <div style={{ fontSize: 12, lineHeight: 1.65, color: 'rgb(190,195,220)', whiteSpace: 'pre-wrap', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 12 }}>
                            {msg.message}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </AccordionPanel>

            {/* Feedback accordion */}
            <AccordionPanel icon={CheckCircle} title="Log Outcome / Feedback" iconColor="rgb(110,231,183)"
              expanded={expanded.feedback} onToggle={() => toggle('feedback')}>
              <FeedbackForm leadId={lead.id} onSaved={loadLead} />
            </AccordionPanel>

          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Feedback form ────────────────────────────────────────────── */
function FeedbackForm({ leadId, onSaved }: { leadId: string; onSaved: () => void }) {
  const supabase = createClient()
  const [form, setForm] = useState({ action_taken: '', lead_quality: '', pain_point_accuracy: '', contact_accuracy: '', message_quality: '', outcome: '', rejection_reason: '', arpit_notes: '' })
  const [saving, setSaving] = useState(false)
  const ic = 'input-dark'; const is = { fontSize: '12px', padding: '7px 10px' }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.from('feedback_memory').insert({
      lead_id: leadId, ...form,
      action_taken: form.action_taken || null, lead_quality: form.lead_quality || null,
      pain_point_accuracy: form.pain_point_accuracy || null, contact_accuracy: form.contact_accuracy || null,
      message_quality: form.message_quality || null, outcome: form.outcome || null,
      rejection_reason: form.rejection_reason || null, arpit_notes: form.arpit_notes || null,
    })
    if (error) toast.error('Failed to save feedback')
    else { toast.success('Feedback saved — training the agent'); onSaved() }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          { label: 'Action Taken', key: 'action_taken', opts: [['approved','Approved'],['rejected','Rejected'],['edited','Edited'],['contacted','Contacted'],['replied','Replied'],['meeting_booked','Meeting Booked'],['deal_closed','Deal Closed'],['needs_more_research','Needs Research']] },
          { label: 'Lead Quality', key: 'lead_quality', opts: [['excellent','Excellent'],['good','Good'],['average','Average'],['poor','Poor']] },
          { label: 'Pain Point Accuracy', key: 'pain_point_accuracy', opts: [['very_accurate','Very Accurate'],['mostly_accurate','Mostly Accurate'],['partially_accurate','Partially'],['inaccurate','Inaccurate']] },
          { label: 'Outcome', key: 'outcome', opts: [['replied','Replied'],['meeting_booked','Meeting Booked'],['deal_closed','Deal Closed 🎉'],['no_response','No Response'],['rejected_by_prospect','Rejected'],['not_yet_sent','Not Sent']] },
        ].map(({ label, key, opts }) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgb(100,107,140)', marginBottom: 6 }}>{label}</label>
            <select className={ic} style={is} value={(form as Record<string,string>)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}>
              <option value="">Select</option>
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgb(100,107,140)', marginBottom: 6 }}>Your Notes</label>
        <textarea className={ic} style={{ fontSize: '12px', resize: 'vertical' }} rows={2} value={form.arpit_notes}
          onChange={e => setForm(f => ({ ...f, arpit_notes: e.target.value }))} placeholder="Notes for the agent to learn from…" />
      </div>
      <button type="submit" disabled={saving}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 9, border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.1)', padding: '9px 14px', fontSize: 13, color: 'rgb(110,231,183)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'inherit', fontWeight: 500 }}>
        {saving ? <><Loader2 size={13} className="animate-spin" />Saving…</> : <><Save size={13} />Save Feedback</>}
      </button>
    </form>
  )
}
