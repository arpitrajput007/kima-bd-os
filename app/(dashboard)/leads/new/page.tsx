'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft, Globe, Loader2, CheckCircle2, XCircle, Zap,
  AlertTriangle, ChevronDown, ChevronUp, Save, Trash2,
  Sparkles, Search, TrendingUp, Target, Star, BarChart2,
  ArrowRight, Shield, DollarSign, MessageCircle, Users,
  BookOpen, Layers, ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { INDUSTRY_CATEGORIES, CUSTOMER_CATEGORIES, PRODUCTS_TO_SELL, REGIONS } from '@/lib/types'

// ── Design tokens (match lead detail page) ────────────────────
const C = {
  cardBg:       '#101522',
  nestedBg:     '#151A2A',
  border:       '1px solid rgba(255,255,255,0.08)',
  borderStrong: '1px solid rgba(255,255,255,0.12)',
}

// ── Types ─────────────────────────────────────────────────────
interface FactItem { label: string; value: string }

interface QualifyResult {
  company_name: string; description: string; business_model: string
  product_summary: string; supported_chains_or_rails: string; current_providers: string
  competitor_or_current_provider: string; competitor_context: string
  industry_category: string; customer_category: string[]
  product_to_sell: string; region: string
  pain_point: string; pain_point_severity: string; pain_point_evidence: string
  pain_point_source_url: string; pain_point_evidence_type: string
  trigger_reason: string; trigger_source_url: string
  kima_fit: string; suggested_use_case: string; settlement_angle: string
  aeredium_fit: string; security_angle: string; risk_angle: string
  revenue_potential: string; integration_feasibility: string
  twitter_url: string; telegram_url: string; discord_url: string
  facts: FactItem[]; assumptions: FactItem[]
  lead_score: number; confidence_score: number; priority: string
  verdict: 'good_lead' | 'not_a_lead'
  verdict_reasoning: string; verdict_flags: string[]; verdict_strengths: string[]
  source_url: string; source_summary: string
}

// ── Research progress steps ────────────────────────────────────
const RESEARCH_STEPS = [
  { icon: Globe,     label: 'Fetching web intelligence',        detail: 'News, press releases, funding & social links' },
  { icon: Search,    label: 'Analysing company',                detail: 'Business model, product, tech stack & competitors' },
  { icon: Target,    label: 'Identifying pain points',          detail: 'Payment, settlement & bridge friction' },
  { icon: Zap,       label: 'Evaluating Kima / Aeredium fit',  detail: 'Use case, risk angle, settlement & security angles' },
  { icon: BarChart2, label: 'Scoring & rendering verdict',      detail: 'Lead score, priority, strengths & flags' },
]

// ── Helpers ───────────────────────────────────────────────────
function scoreGradient(s: number) {
  if (s >= 85) return 'linear-gradient(135deg, rgba(52,211,153,0.2), rgba(16,185,129,0.08))'
  if (s >= 70) return 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(124,58,237,0.08))'
  if (s >= 50) return 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(245,158,11,0.07))'
  return 'linear-gradient(135deg, rgba(252,165,165,0.18), rgba(239,68,68,0.07))'
}
function scoreBorder(s: number) {
  if (s >= 85) return 'rgba(52,211,153,0.35)'
  if (s >= 70) return 'rgba(167,139,250,0.35)'
  if (s >= 50) return 'rgba(251,191,36,0.35)'
  return 'rgba(252,165,165,0.35)'
}
function scoreTextColor(s: number) {
  if (s >= 85) return 'rgb(52,211,153)'
  if (s >= 70) return 'rgb(167,139,250)'
  if (s >= 50) return 'rgb(251,191,36)'
  return 'rgb(252,165,165)'
}
function priorityLabel(p: string) {
  return { excellent: '🏆 Excellent', qualified: '✅ Qualified', needs_research: '🔍 Needs Research', low_priority: '⬇️ Low Priority' }[p] ?? p
}
function severityBadge(s: string) {
  const map: Record<string, { bg: string; color: string }> = {
    critical: { bg: 'rgba(248,113,133,0.12)', color: 'rgb(252,165,165)' },
    high:     { bg: 'rgba(251,191,36,0.12)',  color: 'rgb(253,224,71)'  },
    medium:   { bg: 'rgba(251,191,36,0.08)',  color: 'rgb(253,224,71)'  },
    low:      { bg: 'rgba(96,165,250,0.12)',  color: 'rgb(147,197,253)' },
  }
  return map[s] ?? { bg: 'rgba(255,255,255,0.07)', color: 'rgb(203,213,225)' }
}
function feasBadge(s: string) {
  const key = s?.split(' ')[0]?.toLowerCase()
  const map: Record<string, { bg: string; color: string }> = {
    high:   { bg: 'rgba(52,211,153,0.12)', color: 'rgb(110,231,183)' },
    medium: { bg: 'rgba(251,191,36,0.12)', color: 'rgb(253,224,71)'  },
    low:    { bg: 'rgba(252,165,165,0.12)', color: 'rgb(252,165,165)' },
  }
  return map[key] ?? { bg: 'rgba(255,255,255,0.07)', color: 'rgb(203,213,225)' }
}
function evidenceStyle(t: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    verified_source: { bg: 'rgba(52,211,153,0.1)',  color: 'rgb(110,231,183)', label: '🔗 Verified source' },
    agent_analysis:  { bg: 'rgba(167,139,250,0.1)', color: 'rgb(196,167,252)', label: '🤖 Agent analysis' },
    inferred:        { bg: 'rgba(251,191,36,0.1)',  color: 'rgb(253,224,71)',  label: '💡 Inferred' },
  }
  return map[t] ?? { bg: 'rgba(255,255,255,0.06)', color: 'rgb(160,165,195)', label: t }
}

// ── Primitive UI components ───────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 700, color: 'rgb(100,107,140)', marginBottom: 8 }}>
      {children}
    </p>
  )
}

function Pill({ text, bg, color }: { text: string; bg: string; color: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: bg, color, letterSpacing: '0.02em' }}>
      {text}
    </span>
  )
}

function SectionCard({
  icon: Icon, title, sectionKey, open, onToggle, children, accent,
}: {
  icon: React.ElementType; title: string; sectionKey: string;
  open: boolean; onToggle: () => void; children: React.ReactNode
  accent?: string
}) {
  return (
    <div style={{ borderRadius: 16, border: C.border, background: C.cardBg, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 22px', cursor: 'pointer', background: 'transparent', border: 'none',
          borderBottom: open ? '1px solid rgba(255,255,255,0.07)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: accent ? `${accent}18` : 'rgba(124,58,237,0.14)',
          }}>
            <Icon size={15} color={accent ?? 'rgb(167,139,250)'} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'rgb(225,228,248)', letterSpacing: '-0.01em' }}>{title}</span>
        </div>
        {open
          ? <ChevronUp size={15} color="rgb(80,85,110)" />
          : <ChevronDown size={15} color="rgb(80,85,110)" />}
      </button>
      {open && <div style={{ padding: '22px 24px' }}>{children}</div>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function NewLeadPage() {
  const router   = useRouter()
  const supabase = createClient()

  type Step = 'url' | 'researching' | 'review'
  const [step,         setStep]         = useState<Step>('url')
  const [url,          setUrl]          = useState('')
  const [result,       setResult]       = useState<QualifyResult | null>(null)
  const [form,         setForm]         = useState<QualifyResult | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [researchStep, setResearchStep] = useState(0)
  const [open, setOpen] = useState({
    company: true, competitive: true, classification: true,
    painPoint: true, fit: true, commercial: true,
    social: true, intel: false, scoring: false,
  })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (step !== 'researching') { if (intervalRef.current) clearInterval(intervalRef.current); return }
    setResearchStep(0); let i = 0
    intervalRef.current = setInterval(() => {
      i += 1
      if (i < RESEARCH_STEPS.length) setResearchStep(i)
      else if (intervalRef.current) clearInterval(intervalRef.current)
    }, 3800)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [step])

  const set = (key: keyof QualifyResult, val: unknown) => setForm(f => (f ? { ...f, [key]: val } : f))
  const toggleCat = (cat: string) => setForm(f => {
    if (!f) return f
    const cur = f.customer_category ?? []
    return { ...f, customer_category: cur.includes(cat) ? cur.filter(c => c !== cat) : [...cur, cat] }
  })
  const toggle = (k: keyof typeof open) => setOpen(o => ({ ...o, [k]: !o[k] }))
  const reset  = () => { setStep('url'); setResult(null); setForm(null) }

  // ── Research ─────────────────────────────────────────────────
  const handleResearch = async () => {
    const trimmed = url.trim()
    if (!trimmed) { toast.error('Paste a company website URL first'); return }
    const fullUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    setStep('researching')
    try {
      const res  = await fetch('/api/ai/qualify-lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fullUrl }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) { toast.error(data.error ?? 'Research failed — try again'); setStep('url'); return }
      setResult(data.data); setForm({ ...data.data }); setStep('review')
    } catch { toast.error('Network error — check your connection'); setStep('url') }
  }

  // ── Save ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    const score    = Number(form.lead_score) || null
    const priority = score != null
      ? score >= 85 ? 'excellent' : score >= 70 ? 'qualified' : score >= 50 ? 'needs_research' : 'low_priority'
      : null
    const s = (v: string | undefined) => v?.trim() || null

    const { data, error } = await supabase.from('leads').insert({
      company_name: form.company_name, website: s(url),
      description: s(form.description), business_model: s(form.business_model),
      product_summary: s(form.product_summary),
      supported_chains_or_rails: s(form.supported_chains_or_rails),
      current_providers: s(form.current_providers),
      competitor_or_current_provider: s(form.competitor_or_current_provider),
      competitor_context: s(form.competitor_context),
      industry_category: s(form.industry_category),
      customer_category: form.customer_category?.length ? form.customer_category : null,
      product_to_sell: s(form.product_to_sell), region: s(form.region),
      pain_point: s(form.pain_point), pain_point_severity: s(form.pain_point_severity),
      pain_point_evidence: s(form.pain_point_evidence),
      pain_point_source_url: s(form.pain_point_source_url),
      pain_point_evidence_type: s(form.pain_point_evidence_type),
      trigger_reason: s(form.trigger_reason),
      kima_fit: s(form.kima_fit), suggested_use_case: s(form.suggested_use_case),
      settlement_angle: s(form.settlement_angle), aeredium_fit: s(form.aeredium_fit),
      security_angle: s(form.security_angle), risk_angle: s(form.risk_angle),
      revenue_potential: s(form.revenue_potential),
      integration_feasibility: s(form.integration_feasibility),
      twitter_url: s(form.twitter_url), telegram_url: s(form.telegram_url),
      discord_url: s(form.discord_url),
      facts: form.facts?.length ? form.facts : null,
      assumptions: form.assumptions?.length ? form.assumptions : null,
      lead_score: score, confidence_score: Number(form.confidence_score) || null,
      priority, source_url: s(form.source_url), source_summary: s(form.source_summary),
      status: 'new',
    }).select().single()

    if (error) { toast.error('Failed to save: ' + error.message); setSaving(false); return }
    toast.success('Lead added to pipeline!')
    router.push(`/leads/${data.id}`)
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 1 — URL Input
  // ─────────────────────────────────────────────────────────────
  if (step === 'url') return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/leads" className="btn btn-ghost" style={{ padding: '6px 8px' }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'white', letterSpacing: '-0.02em' }}>Add New Lead</h1>
          <p style={{ fontSize: 12, color: 'rgb(100,107,140)', marginTop: 3 }}>Paste a website — the agent researches everything</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 180px)', padding: '0 24px' }}>
        <div style={{ width: '100%', maxWidth: 520 }}>
          <div style={{
            borderRadius: 20, border: '1px solid rgba(255,255,255,0.09)', background: '#0D1120',
            padding: '48px 44px', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}>
            {/* Icon */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(99,102,241,0.15))',
                border: '1px solid rgba(124,58,237,0.35)',
              }}>
                <Sparkles size={28} color="rgb(167,139,250)" />
              </div>
            </div>

            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'white', letterSpacing: '-0.02em', marginBottom: 10 }}>
              Research a company
            </h2>
            <p style={{ fontSize: 14, color: 'rgb(130,135,165)', lineHeight: 1.65, marginBottom: 32 }}>
              Share the website link. The agent will research the company,
              fill every field automatically, and tell you if it&apos;s a good lead.
            </p>

            {/* Input */}
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <Globe size={15} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgb(100,107,140)' }} />
              <input
                type="url" value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleResearch()}
                placeholder="https://company.xyz"
                className="input-dark"
                style={{ paddingLeft: 42, fontSize: 15, height: 52 }}
                autoFocus
              />
            </div>

            <button
              onClick={handleResearch} disabled={!url.trim()}
              className="btn btn-primary"
              style={{ width: '100%', height: 52, fontSize: 15, fontWeight: 600, gap: 10, justifyContent: 'center' }}
            >
              <Sparkles size={16} /> Research this company <ArrowRight size={15} />
            </button>

            {/* Capability chips */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 28 }}>
              {[
                { icon: Search,      label: 'Company profile & model' },
                { icon: Target,      label: 'Pain points & fit' },
                { icon: Shield,      label: 'Competitive intel' },
                { icon: TrendingUp,  label: 'Trigger & social links' },
                { icon: DollarSign,  label: 'Revenue potential' },
                { icon: Star,        label: 'Score & verdict' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  textAlign: 'left',
                }}>
                  <Icon size={14} color="rgb(167,139,250)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'rgb(160,165,195)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <p style={{ textAlign: 'center', fontSize: 12, color: 'rgb(70,75,100)', marginTop: 18 }}>
            Try: resolv.im · volo.exchange · stargate.finance · ondo.finance
          </p>
        </div>
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────
  // STEP 2 — Loading
  // ─────────────────────────────────────────────────────────────
  if (step === 'researching') return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/leads" className="btn btn-ghost" style={{ padding: '6px 8px' }}><ArrowLeft size={16} /></Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'white', letterSpacing: '-0.02em' }}>Researching Company</h1>
          <p style={{ fontSize: 12, color: 'rgb(100,107,140)', marginTop: 3 }}>{url}</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 180px)', padding: '0 24px' }}>
        <div style={{ width: '100%', maxWidth: 460 }}>
          <div style={{
            borderRadius: 20, border: '1px solid rgba(255,255,255,0.09)', background: '#0D1120',
            padding: '44px 40px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}>
            {/* Spinner */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
              <div style={{ position: 'relative', width: 60, height: 60 }}>
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: '2px solid rgba(124,58,237,0.15)',
                  borderTopColor: 'rgb(124,58,237)',
                  animation: 'spin 1s linear infinite',
                }} />
                <Sparkles size={20} color="rgb(167,139,250)" style={{ position: 'absolute', inset: 0, margin: 'auto' }} />
              </div>
            </div>

            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white', textAlign: 'center', marginBottom: 6 }}>
              Agent is researching...
            </h2>
            <p style={{ fontSize: 13, color: 'rgb(90,95,130)', textAlign: 'center', marginBottom: 32 }}>
              Live web search + deep AI analysis · 20–30 seconds
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {RESEARCH_STEPS.map((s, i) => {
                const Icon    = s.icon
                const done    = i < researchStep
                const active  = i === researchStep
                const pending = i > researchStep
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 16px', borderRadius: 12,
                    background: active ? 'rgba(124,58,237,0.1)' : done ? 'rgba(52,211,153,0.05)' : 'rgba(255,255,255,0.02)',
                    border: active ? '1px solid rgba(124,58,237,0.28)' : done ? '1px solid rgba(52,211,153,0.15)' : '1px solid rgba(255,255,255,0.05)',
                    opacity: pending ? 0.38 : 1,
                    transition: 'all 0.5s ease',
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: active ? 'rgba(124,58,237,0.2)' : done ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)',
                    }}>
                      {done   ? <CheckCircle2 size={15} color="rgb(52,211,153)" />
                       : active ? <Loader2 size={14} color="rgb(167,139,250)" style={{ animation: 'spin 1s linear infinite' }} />
                       : <Icon size={14} color="rgb(80,85,110)" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: active ? 'rgb(210,215,240)' : done ? 'rgb(110,200,160)' : 'rgb(80,85,110)', marginBottom: 0 }}>
                        {s.label}
                      </p>
                      {active && <p style={{ fontSize: 11, color: 'rgb(110,100,165)', marginTop: 3 }}>{s.detail}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────
  // STEP 3 — Review & Confirm
  // ─────────────────────────────────────────────────────────────
  if (step === 'review' && form && result) {
    const isGood = result.verdict === 'good_lead'
    const score  = Number(form.lead_score) || 0

    const inp = (
      value: string,
      onChange: (v: string) => void,
      opts?: { rows?: number; placeholder?: string; readOnly?: boolean }
    ) => {
      const base: React.CSSProperties = {
        background: 'rgba(10,11,16,0.7)', border: '1px solid rgba(255,255,255,0.08)',
        color: opts?.readOnly ? 'rgb(130,135,165)' : 'rgb(220,225,245)',
        borderRadius: 10, padding: '10px 14px', fontSize: 14,
        fontFamily: 'inherit', width: '100%', lineHeight: 1.6,
        transition: 'border-color 0.18s, box-shadow 0.18s',
        resize: opts?.rows ? 'vertical' as const : undefined,
      }
      return opts?.rows
        ? <textarea rows={opts.rows} value={value} onChange={e => onChange(e.target.value)}
            placeholder={opts?.placeholder} readOnly={opts?.readOnly}
            style={base}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none' }}
          />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)}
            placeholder={opts?.placeholder} readOnly={opts?.readOnly}
            style={base}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none' }}
          />
    }

    const sel = (value: string, onChange: (v: string) => void, options: readonly string[], placeholder = 'Select…') => (
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{
          background: 'rgba(10,11,16,0.7)', border: '1px solid rgba(255,255,255,0.08)',
          color: value ? 'rgb(220,225,245)' : 'rgb(100,107,140)',
          borderRadius: 10, padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', width: '100%', cursor: 'pointer',
        }}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o} style={{ background: 'rgb(15,16,24)' }}>{o}</option>)}
      </select>
    )

    return (
      <div className="fade-in">
        {/* Header */}
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={reset} className="btn btn-ghost" style={{ padding: '6px 8px' }}>
            <ArrowLeft size={16} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'white', letterSpacing: '-0.02em' }}>{form.company_name}</h1>
            <p style={{ fontSize: 12, color: 'rgb(100,107,140)', marginTop: 3 }}>Research complete · review all fields, then add to pipeline</p>
          </div>
          {/* Quick score pill in header */}
          <div style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700,
            background: scoreGradient(score), border: `1px solid ${scoreBorder(score)}`,
            color: scoreTextColor(score),
          }}>
            {score}/100
          </div>
        </div>

        <div style={{ padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 920 }}>

          {/* ── VERDICT CARD ────────────────────────────────── */}
          <div style={{
            borderRadius: 18, overflow: 'hidden',
            background: isGood
              ? 'linear-gradient(160deg, rgba(16,185,129,0.1) 0%, rgba(5,150,105,0.04) 100%)'
              : 'linear-gradient(160deg, rgba(248,113,133,0.1) 0%, rgba(185,28,28,0.04) 100%)',
            border: `1px solid ${isGood ? 'rgba(52,211,153,0.28)' : 'rgba(252,165,165,0.28)'}`,
            boxShadow: `0 16px 40px ${isGood ? 'rgba(16,185,129,0.08)' : 'rgba(248,113,133,0.08)'}`,
          }}>
            {/* Top row */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '22px 28px',
              borderBottom: `1px solid ${isGood ? 'rgba(52,211,153,0.12)' : 'rgba(252,165,165,0.12)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isGood ? 'rgba(52,211,153,0.15)' : 'rgba(252,165,165,0.15)',
                }}>
                  {isGood
                    ? <CheckCircle2 size={24} color="rgb(52,211,153)" />
                    : <XCircle      size={24} color="rgb(252,165,165)" />}
                </div>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 700, color: isGood ? 'rgb(52,211,153)' : 'rgb(252,165,165)', letterSpacing: '-0.01em', marginBottom: 5 }}>
                    {isGood ? '✅ Good Lead' : '❌ Not a Lead'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'rgb(130,135,165)' }}>{priorityLabel(result.priority)}</span>
                    <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 12 }}>·</span>
                    <span style={{ fontSize: 12, color: 'rgb(130,135,165)' }}>Confidence {result.confidence_score}%</span>
                  </div>
                </div>
              </div>

              {/* Score ring */}
              <div style={{
                width: 80, height: 80, borderRadius: '50%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: scoreGradient(score), border: `2px solid ${scoreBorder(score)}`,
              }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: scoreTextColor(score), letterSpacing: '-0.03em', lineHeight: 1 }}>{score}</span>
                <span style={{ fontSize: 11, color: 'rgb(90,95,130)', marginTop: 2 }}>/100</span>
              </div>
            </div>

            {/* Reasoning */}
            <div style={{ padding: '20px 28px' }}>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgb(195,200,225)' }}>
                {result.verdict_reasoning}
              </p>

              {/* Strengths + Flags */}
              {((result.verdict_strengths?.length ?? 0) > 0 || (result.verdict_flags?.length ?? 0) > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
                  {(result.verdict_strengths?.length ?? 0) > 0 && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgb(52,211,153)', marginBottom: 12 }}>
                        Strengths
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {result.verdict_strengths.map((s, i) => (
                          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <span style={{ color: 'rgb(52,211,153)', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>+</span>
                            <span style={{ fontSize: 13, color: 'rgb(150,195,165)', lineHeight: 1.55 }}>{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(result.verdict_flags?.length ?? 0) > 0 && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgb(251,191,36)', marginBottom: 12 }}>
                        Flags
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {result.verdict_flags.map((f, i) => (
                          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <AlertTriangle size={13} color="rgb(251,191,36)" style={{ flexShrink: 0, marginTop: 2 }} />
                            <span style={{ fontSize: 13, color: 'rgb(200,175,130)', lineHeight: 1.55 }}>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── COMPANY INFO ──────────────────────────────────── */}
          <SectionCard icon={Globe} title="Company Information" sectionKey="company" open={open.company} onToggle={() => toggle('company')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <FieldLabel>Company Name</FieldLabel>
                {inp(form.company_name, v => set('company_name', v))}
              </div>
              <div>
                <FieldLabel>Website</FieldLabel>
                {inp(url, () => {}, { readOnly: true })}
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <FieldLabel>Description</FieldLabel>
                {inp(form.description, v => set('description', v), { rows: 2 })}
              </div>
              <div>
                <FieldLabel>Business Model</FieldLabel>
                {inp(form.business_model, v => set('business_model', v), { rows: 2 })}
              </div>
              <div>
                <FieldLabel>Product Summary</FieldLabel>
                {inp(form.product_summary, v => set('product_summary', v), { rows: 2 })}
              </div>
              <div>
                <FieldLabel>Supported Chains / Rails</FieldLabel>
                {inp(form.supported_chains_or_rails, v => set('supported_chains_or_rails', v))}
              </div>
              <div>
                <FieldLabel>Current Providers</FieldLabel>
                {inp(form.current_providers, v => set('current_providers', v))}
              </div>
            </div>
          </SectionCard>

          {/* ── COMPETITIVE INTEL ─────────────────────────────── */}
          <SectionCard icon={Shield} title="Competitive Intelligence" sectionKey="competitive" open={open.competitive} onToggle={() => toggle('competitive')} accent="rgb(96,165,250)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {form.competitor_or_current_provider && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                  borderRadius: 12, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.18)',
                }}>
                  <Shield size={18} color="rgb(96,165,250)" style={{ flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgb(96,165,250)', fontWeight: 700, marginBottom: 3 }}>
                      Current Provider / Competitor
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'rgb(220,225,245)' }}>{form.competitor_or_current_provider}</p>
                  </div>
                </div>
              )}
              <div>
                <FieldLabel>Competitor / Current Provider</FieldLabel>
                {inp(form.competitor_or_current_provider, v => set('competitor_or_current_provider', v), { placeholder: 'e.g. LayerZero, Fireblocks, SWIFT...' })}
              </div>
              <div>
                <FieldLabel>Why They Use It & What Limitations That Creates (the pitch wedge)</FieldLabel>
                {inp(form.competitor_context, v => set('competitor_context', v), { rows: 3, placeholder: 'What lock-in, costs, or risks does their current choice create?' })}
              </div>
            </div>
          </SectionCard>

          {/* ── CLASSIFICATION ───────────────────────────────── */}
          <SectionCard icon={Target} title="Sales Classification" sectionKey="classification" open={open.classification} onToggle={() => toggle('classification')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <FieldLabel>Customer Categories</FieldLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {CUSTOMER_CATEGORIES.map(cat => {
                    const on = form.customer_category?.includes(cat)
                    return (
                      <button key={cat} type="button" onClick={() => toggleCat(cat)}
                        style={{
                          padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', transition: 'all 0.18s', fontFamily: 'inherit',
                          border: on ? '1px solid rgba(167,139,250,0.5)' : '1px solid rgba(255,255,255,0.1)',
                          background: on ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                          color: on ? 'rgb(196,167,252)' : 'rgb(160,165,195)',
                        }}>
                        {cat}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <FieldLabel>Industry Category</FieldLabel>
                  {sel(form.industry_category, v => set('industry_category', v), INDUSTRY_CATEGORIES)}
                </div>
                <div>
                  <FieldLabel>Product to Sell</FieldLabel>
                  {sel(form.product_to_sell, v => set('product_to_sell', v), PRODUCTS_TO_SELL)}
                </div>
                <div>
                  <FieldLabel>Region</FieldLabel>
                  {sel(form.region, v => set('region', v), REGIONS)}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── PAIN POINT & TRIGGER ─────────────────────────── */}
          <SectionCard icon={AlertTriangle} title="Pain Point & Trigger" sectionKey="painPoint" open={open.painPoint} onToggle={() => toggle('painPoint')} accent="rgb(251,191,36)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Badge row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {form.pain_point_severity && (() => {
                  const s = severityBadge(form.pain_point_severity)
                  return <Pill text={form.pain_point_severity.toUpperCase()} bg={s.bg} color={s.color} />
                })()}
                {form.pain_point_evidence_type && (() => {
                  const e = evidenceStyle(form.pain_point_evidence_type)
                  return <Pill text={e.label} bg={e.bg} color={e.color} />
                })()}
              </div>

              <div>
                <FieldLabel>Pain Point</FieldLabel>
                {inp(form.pain_point, v => set('pain_point', v), { rows: 3 })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <FieldLabel>Severity</FieldLabel>
                  {sel(form.pain_point_severity, v => set('pain_point_severity', v), ['critical','high','medium','low'])}
                </div>
                <div>
                  <FieldLabel>Evidence Type</FieldLabel>
                  {sel(form.pain_point_evidence_type, v => set('pain_point_evidence_type', v), ['verified_source','agent_analysis','inferred'])}
                </div>
              </div>
              <div>
                <FieldLabel>Evidence</FieldLabel>
                {inp(form.pain_point_evidence, v => set('pain_point_evidence', v), { rows: 2 })}
              </div>
              {form.pain_point_source_url && (
                <div>
                  <FieldLabel>Evidence Source URL</FieldLabel>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {inp(form.pain_point_source_url, v => set('pain_point_source_url', v))}
                    <a href={form.pain_point_source_url} target="_blank" rel="noopener noreferrer"
                      style={{ flexShrink: 0, padding: '10px 12px', borderRadius: 10, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: 'rgb(96,165,250)', display: 'flex', alignItems: 'center' }}>
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              )}
              <div>
                <FieldLabel>Trigger Reason (why reach out NOW?)</FieldLabel>
                {inp(form.trigger_reason, v => set('trigger_reason', v), { rows: 2 })}
              </div>
              {form.trigger_source_url && (
                <div>
                  <FieldLabel>Trigger Source URL</FieldLabel>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {inp(form.trigger_source_url, v => set('trigger_source_url', v))}
                    <a href={form.trigger_source_url} target="_blank" rel="noopener noreferrer"
                      style={{ flexShrink: 0, padding: '10px 12px', borderRadius: 10, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: 'rgb(96,165,250)', display: 'flex', alignItems: 'center' }}>
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* ── KIMA & AEREDIUM FIT ──────────────────────────── */}
          <SectionCard icon={Zap} title="Kima & Aeredium Fit" sectionKey="fit" open={open.fit} onToggle={() => toggle('fit')} accent="rgb(167,139,250)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div>
                  <FieldLabel>Kima Fit</FieldLabel>
                  {inp(form.kima_fit, v => set('kima_fit', v), { rows: 4 })}
                </div>
                <div>
                  <FieldLabel>Aeredium Fit</FieldLabel>
                  {inp(form.aeredium_fit, v => set('aeredium_fit', v), { rows: 4 })}
                </div>
              </div>
              <div>
                <FieldLabel>Suggested Use Case</FieldLabel>
                {inp(form.suggested_use_case, v => set('suggested_use_case', v))}
              </div>
              <div>
                <FieldLabel>Settlement Angle</FieldLabel>
                {inp(form.settlement_angle, v => set('settlement_angle', v), { rows: 2, placeholder: 'How Kima\'s atomic settlement improves their current setup...' })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div>
                  <FieldLabel>Security Angle</FieldLabel>
                  {inp(form.security_angle, v => set('security_angle', v), { rows: 3, placeholder: 'TEE / MPC / compliance angle...' })}
                </div>
                <div>
                  <FieldLabel>Risk Angle</FieldLabel>
                  {inp(form.risk_angle, v => set('risk_angle', v), { rows: 3, placeholder: 'Bridge / custody risks Aeredium mitigates...' })}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── COMMERCIAL POTENTIAL ─────────────────────────── */}
          <SectionCard icon={DollarSign} title="Commercial Potential" sectionKey="commercial" open={open.commercial} onToggle={() => toggle('commercial')} accent="rgb(52,211,153)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <FieldLabel>Revenue Potential</FieldLabel>
                {inp(form.revenue_potential, v => set('revenue_potential', v), { rows: 2, placeholder: 'Estimated impact if they integrate Kima...' })}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 700, color: 'rgb(100,107,140)' }}>
                    Integration Feasibility
                  </p>
                  {form.integration_feasibility && (() => {
                    const b = feasBadge(form.integration_feasibility)
                    return <Pill text={form.integration_feasibility.split(' ')[0].toUpperCase()} bg={b.bg} color={b.color} />
                  })()}
                </div>
                {inp(form.integration_feasibility, v => set('integration_feasibility', v), { rows: 2, placeholder: 'high / medium / low — and why...' })}
              </div>
            </div>
          </SectionCard>

          {/* ── SOCIAL LINKS ─────────────────────────────────── */}
          <SectionCard icon={Users} title="Social Links" sectionKey="social" open={open.social} onToggle={() => toggle('social')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              {[
                { label: 'Twitter / X', key: 'twitter_url' as keyof QualifyResult, icon: Globe, color: 'rgb(100,170,255)' },
                { label: 'Telegram',    key: 'telegram_url' as keyof QualifyResult, icon: MessageCircle, color: 'rgb(50,190,210)' },
                { label: 'Discord',     key: 'discord_url'  as keyof QualifyResult, icon: Layers, color: 'rgb(130,130,255)' },
              ].map(({ label, key, icon: Icon, color }) => (
                <div key={label}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                    <Icon size={12} color={color} />
                    <FieldLabel>{label}</FieldLabel>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {inp(String(form[key] ?? ''), v => set(key, v), { placeholder: `https://...` })}
                    {form[key] && (
                      <a href={String(form[key])} target="_blank" rel="noopener noreferrer"
                        style={{ flexShrink: 0, padding: '10px 11px', borderRadius: 9, background: `${color}18`, border: `1px solid ${color}30`, color, display: 'flex', alignItems: 'center' }}>
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ── RESEARCH INTELLIGENCE ────────────────────────── */}
          <SectionCard icon={BookOpen} title="Research Intelligence" sectionKey="intel" open={open.intel} onToggle={() => toggle('intel')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {(form.facts?.length ?? 0) > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgb(52,211,153)', marginBottom: 12 }}>
                    Verified Facts
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {form.facts.map((f, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: 12, padding: '12px 16px', borderRadius: 10,
                        background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.15)',
                      }}>
                        <CheckCircle2 size={14} color="rgb(52,211,153)" style={{ flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgb(110,231,183)' }}>{f.label}: </span>
                          <span style={{ fontSize: 13, color: 'rgb(160,195,175)', lineHeight: 1.55 }}>{f.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(form.assumptions?.length ?? 0) > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgb(251,191,36)', marginBottom: 12 }}>
                    Assumptions / Inferred
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {form.assumptions.map((a, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: 12, padding: '12px 16px', borderRadius: 10,
                        background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)',
                      }}>
                        <AlertTriangle size={14} color="rgb(251,191,36)" style={{ flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgb(253,224,71)' }}>{a.label}: </span>
                          <span style={{ fontSize: 13, color: 'rgb(195,180,140)', lineHeight: 1.55 }}>{a.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!form.facts?.length && !form.assumptions?.length && (
                <p style={{ fontSize: 13, color: 'rgb(90,95,130)', textAlign: 'center', padding: '12px 0' }}>No research intelligence data returned.</p>
              )}
            </div>
          </SectionCard>

          {/* ── SCORING & SOURCE ─────────────────────────────── */}
          <SectionCard icon={BarChart2} title="Scoring & Source" sectionKey="scoring" open={open.scoring} onToggle={() => toggle('scoring')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <div>
                <FieldLabel>Lead Score (0–100)</FieldLabel>
                <input type="number" min={0} max={100} value={form.lead_score}
                  onChange={e => set('lead_score', parseInt(e.target.value) || 0)}
                  style={{ background: 'rgba(10,11,16,0.7)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgb(220,225,245)', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', width: '100%' }} />
              </div>
              <div>
                <FieldLabel>Confidence Score (0–100)</FieldLabel>
                <input type="number" min={0} max={100} value={form.confidence_score}
                  onChange={e => set('confidence_score', parseInt(e.target.value) || 0)}
                  style={{ background: 'rgba(10,11,16,0.7)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgb(220,225,245)', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', width: '100%' }} />
              </div>
              <div>
                <FieldLabel>Source URL</FieldLabel>
                {inp(form.source_url, v => set('source_url', v))}
              </div>
              <div>
                <FieldLabel>Source Summary</FieldLabel>
                {inp(form.source_summary, v => set('source_summary', v))}
              </div>
            </div>
          </SectionCard>

          {/* ── ACTION BAR ───────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 40 }}>
            <button
              onClick={handleSave} disabled={saving}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 9,
                padding: '12px 26px', borderRadius: 11, fontSize: 14, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1,
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                color: 'white', border: 'none', fontFamily: 'inherit',
                boxShadow: '0 2px 14px rgba(124,58,237,0.3)',
                transition: 'all 0.18s',
              }}>
              {saving ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />Adding to pipeline...</>
                       : <><Save size={15} />Add to Pipeline</>}
            </button>
            <button
              onClick={reset} disabled={saving}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 9,
                padding: '12px 22px', borderRadius: 11, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                background: 'rgba(248,113,133,0.08)', color: 'rgb(252,165,165)',
                border: '1px solid rgba(248,113,133,0.2)', transition: 'all 0.18s',
              }}>
              <Trash2 size={15} /> Discard
            </button>
            <button
              onClick={() => setStep('url')} disabled={saving}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 9,
                padding: '12px 20px', borderRadius: 11, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                background: 'transparent', color: 'rgb(130,135,165)',
                border: '1px solid rgba(255,255,255,0.08)', transition: 'all 0.18s',
              }}>
              <Globe size={14} /> Try another URL
            </button>
          </div>

        </div>
      </div>
    )
  }

  return null
}
