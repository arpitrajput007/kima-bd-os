'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft, Globe, Loader2, CheckCircle2, XCircle, Zap,
  AlertTriangle, ChevronDown, ChevronUp, Save, Trash2,
  Sparkles, Search, TrendingUp, Target, Star, BarChart2,
  ArrowRight, Shield, DollarSign, MessageCircle,
  Users, BookOpen, Layers,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { INDUSTRY_CATEGORIES, CUSTOMER_CATEGORIES, PRODUCTS_TO_SELL, REGIONS } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────
interface FactItem { label: string; value: string }

interface QualifyResult {
  // Core
  company_name: string
  description: string
  business_model: string
  product_summary: string
  supported_chains_or_rails: string
  current_providers: string
  // Competitive intel
  competitor_or_current_provider: string
  competitor_context: string
  // Classification
  industry_category: string
  customer_category: string[]
  product_to_sell: string
  region: string
  // Pain point
  pain_point: string
  pain_point_severity: string
  pain_point_evidence: string
  pain_point_source_url: string
  pain_point_evidence_type: string
  // Trigger
  trigger_reason: string
  trigger_source_url: string
  // Fit
  kima_fit: string
  suggested_use_case: string
  settlement_angle: string
  aeredium_fit: string
  security_angle: string
  risk_angle: string
  // Commercial
  revenue_potential: string
  integration_feasibility: string
  // Social
  twitter_url: string
  telegram_url: string
  discord_url: string
  // Facts / assumptions
  facts: FactItem[]
  assumptions: FactItem[]
  // Scoring
  lead_score: number
  confidence_score: number
  priority: string
  // Verdict
  verdict: 'good_lead' | 'not_a_lead'
  verdict_reasoning: string
  verdict_flags: string[]
  verdict_strengths: string[]
  // Source
  source_url: string
  source_summary: string
}

// ── Research steps shown during loading ───────────────────────
const RESEARCH_STEPS = [
  { icon: Globe,     label: 'Fetching web intelligence...',       detail: 'News, press releases, funding & social links' },
  { icon: Search,    label: 'Analysing company...',               detail: 'Business model, product, tech stack & competitors' },
  { icon: Target,    label: 'Identifying pain points...',         detail: 'Payment, settlement & bridge friction' },
  { icon: Zap,       label: 'Evaluating Kima / Aeredium fit...', detail: 'Use case, risk angle, settlement & security angles' },
  { icon: BarChart2, label: 'Scoring & rendering verdict...',     detail: 'Lead score, priority, strengths & flags' },
]

// ── Helpers ───────────────────────────────────────────────────
function scoreColor(s: number) {
  if (s >= 85) return 'text-emerald-400'
  if (s >= 70) return 'text-violet-400'
  if (s >= 50) return 'text-amber-400'
  return 'text-red-400'
}
function scoreBg(s: number) {
  if (s >= 85) return 'rgba(16,185,129,0.12)'
  if (s >= 70) return 'rgba(139,92,246,0.12)'
  if (s >= 50) return 'rgba(245,158,11,0.12)'
  return 'rgba(239,68,68,0.12)'
}
function scoreBorder(s: number) {
  if (s >= 85) return 'rgba(16,185,129,0.3)'
  if (s >= 70) return 'rgba(139,92,246,0.3)'
  if (s >= 50) return 'rgba(245,158,11,0.3)'
  return 'rgba(239,68,68,0.3)'
}
function priorityLabel(p: string) {
  return { excellent: '🏆 Excellent', qualified: '✅ Qualified', needs_research: '🔍 Needs Research', low_priority: '⬇️ Low Priority' }[p] ?? p
}
function severityColor(s: string) {
  return { critical: 'text-red-400', high: 'text-amber-400', medium: 'text-yellow-400', low: 'text-blue-400' }[s] ?? 'text-zinc-400'
}
function feasColor(s: string) {
  return { high: 'text-emerald-400', medium: 'text-amber-400', low: 'text-red-400' }[s?.split(' ')[0]?.toLowerCase()] ?? 'text-zinc-400'
}
function evidenceLabel(t: string) {
  return { verified_source: '🔗 Verified source', agent_analysis: '🤖 Agent analysis', inferred: '💡 Inferred' }[t] ?? t
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
  const [openSections, setOpenSections] = useState({
    company: true, competitive: true, classification: true,
    painPoint: true, fit: true, commercial: true,
    social: true, intel: false, scoring: false,
  })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (step !== 'researching') { if (intervalRef.current) clearInterval(intervalRef.current); return }
    setResearchStep(0)
    let i = 0
    intervalRef.current = setInterval(() => {
      i += 1
      if (i < RESEARCH_STEPS.length) setResearchStep(i)
      else if (intervalRef.current) clearInterval(intervalRef.current)
    }, 3800)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [step])

  const set = (key: keyof QualifyResult, val: unknown) =>
    setForm(f => (f ? { ...f, [key]: val } : f))

  const toggleCategory = (cat: string) => {
    setForm(f => {
      if (!f) return f
      const cur = f.customer_category ?? []
      return { ...f, customer_category: cur.includes(cat) ? cur.filter(c => c !== cat) : [...cur, cat] }
    })
  }

  const toggleSection = (k: keyof typeof openSections) =>
    setOpenSections(s => ({ ...s, [k]: !s[k] }))

  // ── Run research ─────────────────────────────────────────────
  const handleResearch = async () => {
    const trimmed = url.trim()
    if (!trimmed) { toast.error('Paste a company website URL first'); return }
    const fullUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    setStep('researching')
    try {
      const res  = await fetch('/api/ai/qualify-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fullUrl }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) { toast.error(data.error ?? 'Research failed — try again'); setStep('url'); return }
      setResult(data.data)
      setForm({ ...data.data })
      setStep('review')
    } catch {
      toast.error('Network error — check your connection')
      setStep('url')
    }
  }

  // ── Save to Supabase ─────────────────────────────────────────
  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    const score    = Number(form.lead_score) || null
    const priority = score != null
      ? score >= 85 ? 'excellent' : score >= 70 ? 'qualified' : score >= 50 ? 'needs_research' : 'low_priority'
      : null

    // Helper: save only non-empty strings
    const s = (v: string | undefined) => v?.trim() || null

    const { data, error } = await supabase.from('leads').insert({
      company_name:                  form.company_name,
      website:                       s(url),
      description:                   s(form.description),
      business_model:                s(form.business_model),
      product_summary:               s(form.product_summary),
      supported_chains_or_rails:     s(form.supported_chains_or_rails),
      current_providers:             s(form.current_providers),
      competitor_or_current_provider: s(form.competitor_or_current_provider),
      competitor_context:            s(form.competitor_context),
      industry_category:             s(form.industry_category),
      customer_category:             form.customer_category?.length ? form.customer_category : null,
      product_to_sell:               s(form.product_to_sell),
      region:                        s(form.region),
      pain_point:                    s(form.pain_point),
      pain_point_severity:           s(form.pain_point_severity),
      pain_point_evidence:           s(form.pain_point_evidence),
      pain_point_source_url:         s(form.pain_point_source_url),
      pain_point_evidence_type:      s(form.pain_point_evidence_type),
      trigger_reason:                s(form.trigger_reason),
      kima_fit:                      s(form.kima_fit),
      suggested_use_case:            s(form.suggested_use_case),
      settlement_angle:              s(form.settlement_angle),
      aeredium_fit:                  s(form.aeredium_fit),
      security_angle:                s(form.security_angle),
      risk_angle:                    s(form.risk_angle),
      revenue_potential:             s(form.revenue_potential),
      integration_feasibility:       s(form.integration_feasibility),
      twitter_url:                   s(form.twitter_url),
      telegram_url:                  s(form.telegram_url),
      discord_url:                   s(form.discord_url),
      facts:                         form.facts?.length ? form.facts : null,
      assumptions:                   form.assumptions?.length ? form.assumptions : null,
      lead_score:                    score,
      confidence_score:              Number(form.confidence_score) || null,
      priority,
      source_url:                    s(form.source_url),
      source_summary:                s(form.source_summary),
      status:                        'new',
    }).select().single()

    if (error) { toast.error('Failed to save lead: ' + error.message); setSaving(false); return }
    toast.success('Lead added to pipeline!')
    router.push(`/leads/${data.id}`)
  }

  const reset = () => { setStep('url'); setResult(null); setForm(null) }

  // ─────────────────────────────────────────────────────────────
  // Shared styles
  // ─────────────────────────────────────────────────────────────
  const inputClass   = 'input-dark'
  const labelClass   = 'block text-xs font-medium mb-1.5'
  const labelStyle   = { color: 'rgb(160,160,180)' }
  const sectionStyle = { background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }

  function SectionHeader({ title, k, icon: Icon }: { title: string; k: keyof typeof openSections; icon: React.ElementType }) {
    return (
      <button type="button" onClick={() => toggleSection(k)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-violet-400" />
          <h2 className="text-sm font-semibold text-white">{title}</h2>
        </div>
        {openSections[k]
          ? <ChevronUp   size={14} style={{ color: 'rgb(100,100,130)' }} />
          : <ChevronDown size={14} style={{ color: 'rgb(100,100,130)' }} />}
      </button>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 1 — URL Input
  // ─────────────────────────────────────────────────────────────
  if (step === 'url') return (
    <div className="fade-in">
      <div className="page-header flex items-center gap-4">
        <Link href="/leads" className="btn btn-ghost" style={{ padding: '6px' }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Add New Lead</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>
            Paste a website — the agent researches everything
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 180px)' }}>
        <div className="w-full max-w-xl px-4">
          <div className="rounded-2xl p-8 text-center" style={{
            background: 'rgba(18,18,30,0.95)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 48px rgba(0,0,0,0.4)',
          }}>
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(99,102,241,0.2))',
                border: '1px solid rgba(139,92,246,0.3)',
              }}>
                <Sparkles size={28} className="text-violet-400" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Research a company</h2>
            <p className="text-sm mb-8" style={{ color: 'rgb(130,130,160)', lineHeight: '1.6' }}>
              Share the website link. The agent researches the company,
              fills every field automatically, and tells you if it&apos;s a good lead.
            </p>

            <div className="relative mb-4">
              <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'rgb(120,120,150)' }} />
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleResearch()}
                placeholder="https://company.xyz"
                className="input-dark w-full"
                style={{ paddingLeft: '40px', fontSize: '15px', height: '52px' }}
                autoFocus
              />
            </div>

            <button
              onClick={handleResearch}
              disabled={!url.trim()}
              className="btn btn-primary w-full"
              style={{ height: '52px', fontSize: '15px', fontWeight: 600, gap: '10px' }}
            >
              <Sparkles size={16} />
              Research this company
              <ArrowRight size={16} />
            </button>

            <div className="mt-8 grid grid-cols-2 gap-3 text-left">
              {[
                { icon: Search,       label: 'Company profile & model' },
                { icon: Target,       label: 'Pain points & fit' },
                { icon: Shield,       label: 'Competitive intel' },
                { icon: TrendingUp,   label: 'Trigger & social links' },
                { icon: DollarSign,   label: 'Revenue potential' },
                { icon: Star,         label: 'Score & verdict' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5" style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <Icon size={14} className="text-violet-400 shrink-0" />
                  <span className="text-xs" style={{ color: 'rgb(160,160,190)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-xs mt-5" style={{ color: 'rgb(80,80,100)' }}>
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
      <div className="page-header flex items-center gap-4">
        <Link href="/leads" className="btn btn-ghost" style={{ padding: '6px' }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Researching Company</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>{url}</p>
        </div>
      </div>

      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 180px)' }}>
        <div className="w-full max-w-md px-4">
          <div className="rounded-2xl p-8" style={{
            background: 'rgba(18,18,30,0.95)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 48px rgba(0,0,0,0.4)',
          }}>
            <div className="flex items-center justify-center mb-8">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full" style={{
                  border: '2px solid rgba(139,92,246,0.15)',
                  borderTopColor: 'rgb(139,92,246)',
                  animation: 'spin 1s linear infinite',
                }} />
                <Sparkles size={20} className="absolute inset-0 m-auto text-violet-400" />
              </div>
            </div>

            <h2 className="text-lg font-bold text-white text-center mb-1">Agent is researching...</h2>
            <p className="text-xs text-center mb-8" style={{ color: 'rgb(100,100,130)' }}>
              Live web search + deep AI analysis · takes ~20–30 seconds
            </p>

            <div className="space-y-3">
              {RESEARCH_STEPS.map((s, i) => {
                const Icon    = s.icon
                const done    = i < researchStep
                const active  = i === researchStep
                const pending = i > researchStep
                return (
                  <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-500" style={{
                    background: active  ? 'rgba(139,92,246,0.1)'  : done ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
                    border:     active  ? '1px solid rgba(139,92,246,0.3)' : done ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(255,255,255,0.04)',
                    opacity:    pending ? 0.4 : 1,
                  }}>
                    <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{
                      background: active ? 'rgba(139,92,246,0.2)' : done ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                    }}>
                      {done   ? <CheckCircle2 size={14} className="text-emerald-400" />
                       : active ? <Loader2 size={13} className="text-violet-400 animate-spin" />
                       : <Icon size={13} style={{ color: 'rgb(100,100,130)' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium" style={{
                        color: active ? 'rgb(200,200,230)' : done ? 'rgb(140,200,160)' : 'rgb(100,100,130)',
                      }}>{s.label}</p>
                      {active && <p className="text-xs mt-0.5" style={{ color: 'rgb(110,100,160)' }}>{s.detail}</p>}
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

    return (
      <div className="fade-in">
        <div className="page-header flex items-center gap-4">
          <button onClick={reset} className="btn btn-ghost" style={{ padding: '6px' }}>
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">{form.company_name}</h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>
              Research complete · review all fields, then add to pipeline
            </p>
          </div>
        </div>

        <div className="p-8 space-y-6 max-w-4xl">

          {/* ── VERDICT ───────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden" style={{
            background: isGood
              ? 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(5,150,105,0.06))'
              : 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(185,28,28,0.05))',
            border: `1px solid ${isGood ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`,
          }}>
            <div className="flex items-center justify-between px-6 py-5" style={{
              borderBottom: `1px solid ${isGood ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)'}`,
            }}>
              <div className="flex items-center gap-3">
                {isGood ? <CheckCircle2 size={24} className="text-emerald-400" /> : <XCircle size={24} className="text-red-400" />}
                <div>
                  <p className="text-lg font-bold" style={{ color: isGood ? 'rgb(52,211,153)' : 'rgb(248,113,113)' }}>
                    {isGood ? '✅ Good Lead' : '❌ Not a Lead'}
                  </p>
                  <p className="text-xs" style={{ color: 'rgb(120,120,150)' }}>
                    {priorityLabel(result.priority)} · Confidence {result.confidence_score}%
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center w-20 h-20 rounded-full" style={{
                background: scoreBg(score), border: `2px solid ${scoreBorder(score)}`,
              }}>
                <span className={cn('text-2xl font-bold tabular-nums', scoreColor(score))}>{score}</span>
                <span className="text-xs" style={{ color: 'rgb(100,100,130)' }}>/100</span>
              </div>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm leading-relaxed" style={{ color: 'rgb(180,180,210)' }}>
                {result.verdict_reasoning}
              </p>
              {((result.verdict_strengths?.length ?? 0) > 0 || (result.verdict_flags?.length ?? 0) > 0) && (
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                  {(result.verdict_strengths?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-2 text-emerald-400 uppercase tracking-wide">Strengths</p>
                      <ul className="space-y-1.5">
                        {result.verdict_strengths.map((s, i) => (
                          <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: 'rgb(150,195,165)' }}>
                            <span className="text-emerald-400 font-bold mt-0.5">+</span>{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(result.verdict_flags?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-2 text-amber-400 uppercase tracking-wide">Flags</p>
                      <ul className="space-y-1.5">
                        {result.verdict_flags.map((f, i) => (
                          <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: 'rgb(200,175,130)' }}>
                            <AlertTriangle size={11} className="text-amber-400 mt-0.5 shrink-0" />{f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── COMPANY INFO ──────────────────────────────────── */}
          <div className="rounded-xl p-5" style={sectionStyle}>
            <SectionHeader title="Company Information" k="company" icon={Globe} />
            {openSections.company && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} style={labelStyle}>Company Name</label>
                  <input className={inputClass} value={form.company_name} onChange={e => set('company_name', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Website</label>
                  <input className={inputClass} value={url} readOnly style={{ opacity: 0.55 }} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass} style={labelStyle}>Description</label>
                  <textarea className={inputClass} value={form.description} onChange={e => set('description', e.target.value)} rows={2} style={{ resize: 'vertical' }} />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Business Model</label>
                  <textarea className={inputClass} value={form.business_model} onChange={e => set('business_model', e.target.value)} rows={2} style={{ resize: 'vertical' }} />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Product Summary</label>
                  <textarea className={inputClass} value={form.product_summary} onChange={e => set('product_summary', e.target.value)} rows={2} style={{ resize: 'vertical' }} />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Supported Chains / Rails</label>
                  <input className={inputClass} value={form.supported_chains_or_rails} onChange={e => set('supported_chains_or_rails', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Current Providers</label>
                  <input className={inputClass} value={form.current_providers} onChange={e => set('current_providers', e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* ── COMPETITIVE INTEL ─────────────────────────────── */}
          <div className="rounded-xl p-5" style={sectionStyle}>
            <SectionHeader title="Competitive Intelligence" k="competitive" icon={Shield} />
            {openSections.competitive && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className={labelClass} style={labelStyle}>Current Provider / Competitor</label>
                  <input
                    className={inputClass}
                    value={form.competitor_or_current_provider}
                    onChange={e => set('competitor_or_current_provider', e.target.value)}
                    placeholder="e.g. LayerZero, Fireblocks, SWIFT..."
                  />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Why They Use It & What Limitations That Creates</label>
                  <textarea
                    className={inputClass}
                    value={form.competitor_context}
                    onChange={e => set('competitor_context', e.target.value)}
                    rows={3}
                    style={{ resize: 'vertical' }}
                    placeholder="This is the wedge for Kima's pitch..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── CLASSIFICATION ────────────────────────────────── */}
          <div className="rounded-xl p-5" style={sectionStyle}>
            <SectionHeader title="Sales Classification" k="classification" icon={Target} />
            {openSections.classification && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className={labelClass} style={labelStyle}>Customer Categories</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {CUSTOMER_CATEGORIES.map(cat => (
                      <button
                        key={cat} type="button"
                        onClick={() => toggleCategory(cat)}
                        className={cn('badge cursor-pointer transition-all',
                          form.customer_category?.includes(cat)
                            ? 'bg-violet-500/20 text-violet-200 border-violet-500/40'
                            : 'bg-white/5 text-zinc-400 border-white/10 hover:border-white/20'
                        )}
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass} style={labelStyle}>Industry Category</label>
                    <select className={inputClass} value={form.industry_category} onChange={e => set('industry_category', e.target.value)}>
                      <option value="">Select category</option>
                      {INDUSTRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>Product to Sell</label>
                    <select className={inputClass} value={form.product_to_sell} onChange={e => set('product_to_sell', e.target.value)}>
                      <option value="">Select product</option>
                      {PRODUCTS_TO_SELL.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>Region</label>
                    <select className={inputClass} value={form.region} onChange={e => set('region', e.target.value)}>
                      <option value="">Select region</option>
                      {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── PAIN POINT & TRIGGER ──────────────────────────── */}
          <div className="rounded-xl p-5" style={sectionStyle}>
            <SectionHeader title="Pain Point & Trigger" k="painPoint" icon={AlertTriangle} />
            {openSections.painPoint && (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <label className={labelClass} style={{ ...labelStyle, marginBottom: 0 }}>Pain Point</label>
                    {form.pain_point_severity && (
                      <span className={cn('text-xs font-semibold capitalize', severityColor(form.pain_point_severity))}>
                        [{form.pain_point_severity}]
                      </span>
                    )}
                    {form.pain_point_evidence_type && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        background: 'rgba(139,92,246,0.1)', color: 'rgb(160,130,220)', border: '1px solid rgba(139,92,246,0.2)',
                      }}>
                        {evidenceLabel(form.pain_point_evidence_type)}
                      </span>
                    )}
                  </div>
                  <textarea className={inputClass} value={form.pain_point} onChange={e => set('pain_point', e.target.value)} rows={3} style={{ resize: 'vertical' }} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass} style={labelStyle}>Severity</label>
                    <select className={inputClass} value={form.pain_point_severity} onChange={e => set('pain_point_severity', e.target.value)}>
                      <option value="">Select severity</option>
                      {['critical','high','medium','low'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>Evidence Type</label>
                    <select className={inputClass} value={form.pain_point_evidence_type} onChange={e => set('pain_point_evidence_type', e.target.value)}>
                      <option value="">Select type</option>
                      <option value="verified_source">Verified source</option>
                      <option value="agent_analysis">Agent analysis</option>
                      <option value="inferred">Inferred</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Evidence</label>
                  <textarea className={inputClass} value={form.pain_point_evidence} onChange={e => set('pain_point_evidence', e.target.value)} rows={2} style={{ resize: 'vertical' }} />
                </div>
                {form.pain_point_source_url && (
                  <div>
                    <label className={labelClass} style={labelStyle}>Evidence Source URL</label>
                    <input className={inputClass} value={form.pain_point_source_url} onChange={e => set('pain_point_source_url', e.target.value)} />
                  </div>
                )}
                <div>
                  <label className={labelClass} style={labelStyle}>Trigger Reason (why reach out NOW?)</label>
                  <textarea className={inputClass} value={form.trigger_reason} onChange={e => set('trigger_reason', e.target.value)} rows={2} style={{ resize: 'vertical' }} />
                </div>
                {form.trigger_source_url && (
                  <div>
                    <label className={labelClass} style={labelStyle}>Trigger Source URL</label>
                    <input className={inputClass} value={form.trigger_source_url} onChange={e => set('trigger_source_url', e.target.value)} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── KIMA / AEREDIUM FIT ───────────────────────────── */}
          <div className="rounded-xl p-5" style={sectionStyle}>
            <SectionHeader title="Kima & Aeredium Fit" k="fit" icon={Zap} />
            {openSections.fit && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className={labelClass} style={labelStyle}>Kima Fit</label>
                  <textarea className={inputClass} value={form.kima_fit} onChange={e => set('kima_fit', e.target.value)} rows={3} style={{ resize: 'vertical' }} />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Suggested Use Case</label>
                  <input className={inputClass} value={form.suggested_use_case} onChange={e => set('suggested_use_case', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Settlement Angle</label>
                  <textarea className={inputClass} value={form.settlement_angle} onChange={e => set('settlement_angle', e.target.value)} rows={2} style={{ resize: 'vertical' }}
                    placeholder="How Kima's atomic cross-chain settlement improves their current setup..." />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass} style={labelStyle}>Aeredium Fit</label>
                    <textarea className={inputClass} value={form.aeredium_fit} onChange={e => set('aeredium_fit', e.target.value)} rows={3} style={{ resize: 'vertical' }} />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass} style={labelStyle}>Security Angle</label>
                      <textarea className={inputClass} value={form.security_angle} onChange={e => set('security_angle', e.target.value)} rows={3} style={{ resize: 'vertical' }}
                        placeholder="TEE / MPC / compliance / execution-integrity angle..." />
                    </div>
                  </div>
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Risk Angle</label>
                  <textarea className={inputClass} value={form.risk_angle} onChange={e => set('risk_angle', e.target.value)} rows={2} style={{ resize: 'vertical' }}
                    placeholder="What risks (bridge exploits, custody failure) Aeredium mitigates for them..." />
                </div>
              </div>
            )}
          </div>

          {/* ── COMMERCIAL ────────────────────────────────────── */}
          <div className="rounded-xl p-5" style={sectionStyle}>
            <SectionHeader title="Commercial Potential" k="commercial" icon={DollarSign} />
            {openSections.commercial && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className={labelClass} style={labelStyle}>Revenue Potential</label>
                  <textarea className={inputClass} value={form.revenue_potential} onChange={e => set('revenue_potential', e.target.value)} rows={2} style={{ resize: 'vertical' }}
                    placeholder="Estimated revenue / business impact for them if they integrate Kima..." />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <label className={labelClass} style={{ ...labelStyle, marginBottom: 0 }}>Integration Feasibility</label>
                    {form.integration_feasibility && (
                      <span className={cn('text-xs font-semibold capitalize', feasColor(form.integration_feasibility))}>
                        [{form.integration_feasibility.split(' ')[0]}]
                      </span>
                    )}
                  </div>
                  <textarea className={inputClass} value={form.integration_feasibility} onChange={e => set('integration_feasibility', e.target.value)} rows={2} style={{ resize: 'vertical' }}
                    placeholder="high / medium / low — and why..." />
                </div>
              </div>
            )}
          </div>

          {/* ── SOCIAL LINKS ──────────────────────────────────── */}
          <div className="rounded-xl p-5" style={sectionStyle}>
            <SectionHeader title="Social Links" k="social" icon={Users} />
            {openSections.social && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass} style={labelStyle}>
                    <span className="flex items-center gap-1.5"><Globe size={12} /> Twitter / X</span>
                  </label>
                  <input className={inputClass} value={form.twitter_url} onChange={e => set('twitter_url', e.target.value)} placeholder="https://x.com/..." />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>
                    <span className="flex items-center gap-1.5"><MessageCircle size={12} /> Telegram</span>
                  </label>
                  <input className={inputClass} value={form.telegram_url} onChange={e => set('telegram_url', e.target.value)} placeholder="https://t.me/..." />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>
                    <span className="flex items-center gap-1.5"><Layers size={12} /> Discord</span>
                  </label>
                  <input className={inputClass} value={form.discord_url} onChange={e => set('discord_url', e.target.value)} placeholder="https://discord.gg/..." />
                </div>
              </div>
            )}
          </div>

          {/* ── FACTS & ASSUMPTIONS ───────────────────────────── */}
          <div className="rounded-xl p-5" style={sectionStyle}>
            <SectionHeader title="Research Intelligence" k="intel" icon={BookOpen} />
            {openSections.intel && (
              <div className="mt-4 space-y-5">
                {/* Facts */}
                {form.facts?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2 text-emerald-400 uppercase tracking-wide">Verified Facts</p>
                    <div className="space-y-2">
                      {form.facts.map((f, i) => (
                        <div key={i} className="flex items-start gap-3 rounded-lg px-3 py-2.5" style={{
                          background: 'rgba(16,185,129,0.05)',
                          border: '1px solid rgba(16,185,129,0.15)',
                        }}>
                          <CheckCircle2 size={13} className="text-emerald-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-xs font-medium text-emerald-300">{f.label}: </span>
                            <span className="text-xs" style={{ color: 'rgb(160,190,170)' }}>{f.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Assumptions */}
                {form.assumptions?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2 text-amber-400 uppercase tracking-wide">Assumptions / Inferred</p>
                    <div className="space-y-2">
                      {form.assumptions.map((a, i) => (
                        <div key={i} className="flex items-start gap-3 rounded-lg px-3 py-2.5" style={{
                          background: 'rgba(245,158,11,0.05)',
                          border: '1px solid rgba(245,158,11,0.15)',
                        }}>
                          <AlertTriangle size={13} className="text-amber-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-xs font-medium text-amber-300">{a.label}: </span>
                            <span className="text-xs" style={{ color: 'rgb(190,175,145)' }}>{a.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── SCORING & SOURCE ──────────────────────────────── */}
          <div className="rounded-xl p-5" style={sectionStyle}>
            <SectionHeader title="Scoring & Source" k="scoring" icon={BarChart2} />
            {openSections.scoring && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} style={labelStyle}>Lead Score (0–100)</label>
                  <input className={inputClass} type="number" min={0} max={100}
                    value={form.lead_score} onChange={e => set('lead_score', parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Confidence Score (0–100)</label>
                  <input className={inputClass} type="number" min={0} max={100}
                    value={form.confidence_score} onChange={e => set('confidence_score', parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Source URL</label>
                  <input className={inputClass} value={form.source_url} onChange={e => set('source_url', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Source Summary</label>
                  <input className={inputClass} value={form.source_summary} onChange={e => set('source_summary', e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* ── ACTIONS ───────────────────────────────────────── */}
          <div className="flex items-center gap-3 pb-8">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
              style={{ padding: '11px 24px', fontSize: '14px', fontWeight: 600 }}
            >
              {saving
                ? <><Loader2 size={15} className="animate-spin" />Adding to pipeline...</>
                : <><Save size={15} />Add to Pipeline</>
              }
            </button>
            <button
              onClick={reset}
              disabled={saving}
              className="btn btn-ghost"
              style={{ padding: '11px 24px', fontSize: '14px', color: 'rgb(210,70,70)' }}
            >
              <Trash2 size={15} />
              Discard
            </button>
            <button
              onClick={() => setStep('url')}
              disabled={saving}
              className="btn btn-ghost"
              style={{ padding: '11px 20px', fontSize: '14px' }}
            >
              <Globe size={14} />
              Try another URL
            </button>
          </div>

        </div>
      </div>
    )
  }

  return null
}
