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
  BookOpen, Layers, ExternalLink, Clock, RefreshCw, History,
  MessageSquare, Send, Brain,
} from 'lucide-react'
import Link from 'next/link'
import { INDUSTRY_CATEGORIES, CUSTOMER_CATEGORIES, PRODUCTS_TO_SELL, REGIONS } from '@/lib/types'

// ── Design tokens ─────────────────────────────────────────────
const C = {
  cardBg:  '#101522',
  border:  '1px solid rgba(255,255,255,0.08)',
}

// ── Types ─────────────────────────────────────────────────────
interface FactItem { label: string; value: string }

interface ProductMatch {
  product: string
  company: 'Kima' | 'Aeredium' | 'Aerpolice'
  match: 'strong' | 'partial' | 'none'
  why: string
  use_case?: string
}

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
  product_matches?: ProductMatch[]
}

interface CacheEntry {
  id: string
  url: string
  domain: string
  company_name: string
  research_data: QualifyResult
  web_research_used: boolean
  created_at: string
}

// ── Research steps ────────────────────────────────────────────
const RESEARCH_STEPS = [
  { icon: Globe,     label: 'Fetching web intelligence',       detail: 'News, press releases, funding & social links' },
  { icon: Search,    label: 'Analysing company',               detail: 'Business model, product, tech stack & competitors' },
  { icon: Target,    label: 'Identifying pain points',         detail: 'Payment, settlement & bridge friction' },
  { icon: Zap,       label: 'Evaluating Kima / Aeredium fit', detail: 'Use case, risk angle, settlement & security angles' },
  { icon: BarChart2, label: 'Scoring & rendering verdict',     detail: 'Lead score, priority, strengths & flags' },
]

// ── Helpers ───────────────────────────────────────────────────
function toDomain(url: string) {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].split('?')[0].toLowerCase()
}
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)   return `${s}s ago`
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return `${Math.floor(s/86400)}d ago`
}
function scoreGradient(s: number) {
  if (s >= 85) return 'linear-gradient(135deg, rgba(52,211,153,0.2), rgba(16,185,129,0.08))'
  if (s >= 70) return 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(124,58,237,0.08))'
  if (s >= 50) return 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(245,158,11,0.07))'
  return 'linear-gradient(135deg, rgba(252,165,165,0.18), rgba(239,68,68,0.07))'
}
function scoreBorderColor(s: number) {
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
  const m: Record<string, { bg: string; color: string }> = {
    critical: { bg: 'rgba(248,113,133,0.12)', color: 'rgb(252,165,165)' },
    high:     { bg: 'rgba(251,191,36,0.12)',  color: 'rgb(253,224,71)'  },
    medium:   { bg: 'rgba(251,191,36,0.08)',  color: 'rgb(253,224,71)'  },
    low:      { bg: 'rgba(96,165,250,0.12)',  color: 'rgb(147,197,253)' },
  }
  return m[s] ?? { bg: 'rgba(255,255,255,0.07)', color: 'rgb(203,213,225)' }
}
function feasBadge(s: string) {
  const key = s?.split(' ')[0]?.toLowerCase()
  const m: Record<string, { bg: string; color: string }> = {
    high:   { bg: 'rgba(52,211,153,0.12)', color: 'rgb(110,231,183)' },
    medium: { bg: 'rgba(251,191,36,0.12)', color: 'rgb(253,224,71)'  },
    low:    { bg: 'rgba(252,165,165,0.12)', color: 'rgb(252,165,165)' },
  }
  return m[key] ?? { bg: 'rgba(255,255,255,0.07)', color: 'rgb(203,213,225)' }
}
function evidenceStyle(t: string) {
  const m: Record<string, { bg: string; color: string; label: string }> = {
    verified_source: { bg: 'rgba(52,211,153,0.1)',  color: 'rgb(110,231,183)', label: '🔗 Verified source' },
    agent_analysis:  { bg: 'rgba(167,139,250,0.1)', color: 'rgb(196,167,252)', label: '🤖 Agent analysis' },
    inferred:        { bg: 'rgba(251,191,36,0.1)',  color: 'rgb(253,224,71)',  label: '💡 Inferred' },
  }
  return m[t] ?? { bg: 'rgba(255,255,255,0.06)', color: 'rgb(160,165,195)', label: t }
}

// ── UI primitives ─────────────────────────────────────────────
function FL({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 700, color: 'rgb(100,107,140)', marginBottom: 8 }}>
      {children}
    </p>
  )
}
function Pill({ text, bg, color }: { text: string; bg: string; color: string }) {
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: bg, color, letterSpacing: '0.02em' }}>{text}</span>
}

function SectionCard({ icon: Icon, title, open, onToggle, children, accent }: {
  icon: React.ElementType; title: string; open: boolean; onToggle: () => void
  children: React.ReactNode; accent?: string
}) {
  return (
    <div style={{ borderRadius: 16, border: C.border, background: C.cardBg, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.28)' }}>
      <button type="button" onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '15px 22px', cursor: 'pointer', background: 'transparent', border: 'none',
        borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: accent ? `${accent}18` : 'rgba(124,58,237,0.14)',
          }}>
            <Icon size={14} color={accent ?? 'rgb(167,139,250)'} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'rgb(225,228,248)', letterSpacing: '-0.01em' }}>{title}</span>
        </div>
        {open ? <ChevronUp size={14} color="rgb(70,75,100)" /> : <ChevronDown size={14} color="rgb(70,75,100)" />}
      </button>
      {open && <div style={{ padding: '22px 24px' }}>{children}</div>}
    </div>
  )
}

// ── Markdown renderer (lightweight) ──────────────────────────
function RichText({ text }: { text: string }) {
  const lines = text.split('\n')
  const out: React.ReactNode[] = []
  let list: React.ReactNode[] = []
  let listType: 'ul' | 'ol' | null = null
  const flush = () => {
    if (list.length) {
      out.push(listType === 'ol'
        ? <ol key={out.length} style={{ margin: '3px 0 6px', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>{list}</ol>
        : <ul key={out.length} style={{ margin: '3px 0 6px', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>{list}</ul>)
      list = []; listType = null
    }
  }
  const fmt = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} style={{ color: 'white', fontWeight: 600 }}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  )
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*[-*]\s+(.*)/)
    const numbered = line.match(/^\s*(\d+)\.\s+(.*)/)
    if (bullet) { if (listType === 'ol') flush(); listType = 'ul'; list.push(<li key={idx} style={{ lineHeight: 1.55 }}>{fmt(bullet[1])}</li>) }
    else if (numbered) { if (listType === 'ul') flush(); listType = 'ol'; list.push(<li key={idx} style={{ lineHeight: 1.55 }}>{fmt(numbered[2])}</li>) }
    else if (line === '') { flush() }
    else { flush(); out.push(<p key={idx} style={{ margin: '0 0 5px', lineHeight: 1.6 }}>{fmt(line)}</p>) }
  })
  flush()
  return <div>{out}</div>
}

// ── Discuss panel ─────────────────────────────────────────────
const DISCUSS_STARTERS = [
  'How does their tech work and where do Kima, Aeredium & Aerpolice each fit?',
  'Do they have AI agents taking real consequential actions — are they an Aerpolice customer?',
  'What would make this a strong lead for our full suite?',
  'Who should I reach out to first and what should I say?',
  'What objections will they raise and how do I counter them?',
  'Write a cold outreach message focused on Aerpolice',
]

function DiscussPanel({ leadData }: { leadData: QualifyResult }) {
  const supabase = createClient()
  const [open,      setOpen]     = useState(false)
  const [input,     setInput]    = useState('')
  const [thinking,  setThinking] = useState(false)
  const [msgs, setMsgs] = useState<{ role: 'user' | 'assistant'; content: string; id: string }[]>([])
  const histRef    = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  const sessionRef = useRef<string | null>(null)
  const endRef     = useRef<HTMLDivElement>(null)
  const taRef      = useRef<HTMLTextAreaElement>(null)

  // Load or create a session for this lead on first open
  const ensureSession = async (): Promise<string> => {
    if (sessionRef.current) return sessionRef.current
    const title = `[Lead] ${leadData.company_name}`
    // Try to find an existing session for this lead
    const { data: existing } = await supabase
      .from('voice_sessions')
      .select('id, message_count')
      .ilike('title', title)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (existing) {
      // Load previous messages
      const { data: prevMsgs } = await supabase
        .from('voice_messages')
        .select('id, role, content')
        .eq('session_id', existing.id)
        .order('created_at', { ascending: true })
      if (prevMsgs?.length) {
        const loaded = prevMsgs.map(m => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content }))
        setMsgs(loaded)
        histRef.current = loaded.map(m => ({ role: m.role, content: m.content }))
      }
      sessionRef.current = existing.id
      return existing.id
    }
    // Create new
    const { data: created } = await supabase
      .from('voice_sessions')
      .insert({ title, message_count: 0 })
      .select('id').single()
    const newId = created?.id ?? crypto.randomUUID()
    sessionRef.current = newId
    return newId
  }

  // Load session when panel opens
  useEffect(() => {
    if (open && !sessionRef.current) { ensureSession() }
  }, [open]) // eslint-disable-line

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, thinking])

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || thinking) return
    const userMsg = { role: 'user' as const, content: q, id: crypto.randomUUID() }
    setMsgs(prev => [...prev, userMsg])
    histRef.current.push({ role: 'user', content: q })
    setInput('')
    if (taRef.current) taRef.current.style.height = 'auto'
    setThinking(true)
    try {
      const res = await fetch('/api/ai/qualify-lead/discuss', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, lead_data: leadData, history: histRef.current.slice(-10) }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const agentMsg = { role: 'assistant' as const, content: data.reply, id: crypto.randomUUID() }
      setMsgs(prev => [...prev, agentMsg])
      histRef.current.push({ role: 'assistant', content: data.reply })

      // Persist both messages to Supabase
      const sid = await ensureSession()
      await supabase.from('voice_messages').insert([
        { session_id: sid, role: 'user',      content: q          },
        { session_id: sid, role: 'assistant', content: data.reply },
      ])
      const { data: s } = await supabase.from('voice_sessions').select('message_count').eq('id', sid).single()
      await supabase.from('voice_sessions').update({ message_count: (s?.message_count || 0) + 2, updated_at: new Date().toISOString() }).eq('id', sid)
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Failed'
      setMsgs(prev => [...prev, { role: 'assistant', content: `Error: ${err}`, id: crypto.randomUUID() }])
    } finally { setThinking(false) }
  }

  return (
    <div style={{ borderRadius: 14, border: '1px solid rgba(167,139,250,0.25)', background: C.cardBg, overflow: 'hidden' }}>
      {/* Toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'rgba(124,58,237,0.07)', border: 'none', cursor: 'pointer', borderBottom: open ? '1px solid rgba(167,139,250,0.15)' : 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(167,139,250,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageSquare size={13} color="#a78bfa" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Discuss this lead</span>
          {msgs.length > 0 && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10, background: 'rgba(167,139,250,0.2)', color: '#a78bfa' }}>
              {msgs.filter(m => m.role === 'assistant').length}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!open && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>Ask before deciding</span>}
          {open ? <ChevronUp size={13} color="rgba(255,255,255,0.3)" /> : <ChevronDown size={13} color="rgba(255,255,255,0.3)" />}
        </div>
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Messages */}
          <div style={{ maxHeight: 380, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {msgs.length === 0 ? (
              <div>
                <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.3)', marginBottom: 10, lineHeight: 1.5 }}>
                  Ask anything about <strong style={{ color: 'rgba(255,255,255,0.5)' }}>{leadData.company_name}</strong> — how their tech works, whether AI agents are in their product, and where <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Kima / Aeredium / Aerpolice</strong> each fit.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {DISCUSS_STARTERS.map(s => (
                    <button key={s} onClick={() => send(s)}
                      style={{ textAlign: 'left', padding: '7px 10px', borderRadius: 8, fontSize: 11.5, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgb(160,165,200)', cursor: 'pointer', transition: 'all 0.12s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.1)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.25)'; e.currentTarget.style.color = '#c4a7fc' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgb(160,165,200)' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              msgs.map(m => (
                m.role === 'user' ? (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ maxWidth: '85%', borderRadius: '12px 12px 3px 12px', padding: '8px 12px', fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.3)', color: 'rgb(225,218,252)' }}>
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <Brain size={12} color="#a78bfa" />
                    </div>
                    <div style={{ flex: 1, borderRadius: '3px 12px 12px 12px', padding: '9px 13px', fontSize: 12.5, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgb(205,210,232)' }}>
                      <RichText text={m.content} />
                    </div>
                  </div>
                )
              ))
            )}
            {thinking && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 size={11} className="animate-spin" color="#a78bfa" />
                </div>
                <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.3)' }}>Thinking…</span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', padding: '5px 6px' }}>
              <textarea
                ref={taRef}
                value={input}
                onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
                placeholder="Ask anything about this lead…"
                rows={1}
                style={{ flex: 1, resize: 'none', maxHeight: 120, border: 'none', background: 'transparent', padding: '5px 7px', fontSize: 12.5, color: 'white', fontFamily: 'inherit', lineHeight: 1.5, outline: 'none' }}
              />
              <button
                onClick={() => send(input)}
                disabled={thinking || !input.trim()}
                style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 8, border: 'none', cursor: thinking || !input.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: thinking || !input.trim() ? 'rgba(167,139,250,0.12)' : 'rgb(124,58,237)', color: thinking || !input.trim() ? '#a78bfa' : 'white' }}
              >
                {thinking ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              </button>
            </div>
            <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.18)', marginTop: 5, textAlign: 'center' }}>Enter to send · Shift+Enter for new line</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
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
  const [fromCache,    setFromCache]    = useState<{ id: string; created_at: string } | null>(null)
  const [history,      setHistory]      = useState<CacheEntry[]>([])
  const [histLoading,  setHistLoading]  = useState(true)
  const [open, setOpen] = useState({
    company: true, competitive: true, classification: true,
    painPoint: true, products: true, fit: true, commercial: true,
    social: true, intel: false, scoring: false,
  })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load history on mount
  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    setHistLoading(true)
    try {
      const { data } = await supabase
        .from('lead_research_cache')
        .select('id, url, domain, company_name, research_data, web_research_used, created_at')
        .order('created_at', { ascending: false })
        .limit(20)
      setHistory((data as CacheEntry[]) ?? [])
    } catch { /* table may not exist yet */ }
    setHistLoading(false)
  }

  async function saveToCache(urlStr: string, domain: string, data: QualifyResult, webUsed: boolean) {
    try {
      await supabase.from('lead_research_cache').insert({
        url: urlStr, domain,
        company_name: data.company_name,
        research_data: data,
        web_research_used: webUsed,
      })
      loadHistory()
    } catch { /* non-fatal */ }
  }

  // Animate steps
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
  const reset  = () => { setStep('url'); setResult(null); setForm(null); setFromCache(null) }

  // ── Load from cache entry ─────────────────────────────────────
  const loadFromCache = (entry: CacheEntry) => {
    setUrl(entry.url)
    setResult(entry.research_data)
    setForm({ ...entry.research_data })
    setFromCache({ id: entry.id, created_at: entry.created_at })
    setStep('review')
  }

  // ── Research ─────────────────────────────────────────────────
  const handleResearch = async (forceRefresh = false) => {
    const trimmed = url.trim()
    if (!trimmed) { toast.error('Paste a company website URL first'); return }
    const fullUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const domain  = toDomain(fullUrl)

    // Check cache first
    if (!forceRefresh) {
      try {
        const { data: cached } = await supabase
          .from('lead_research_cache')
          .select('*')
          .eq('domain', domain)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (cached) {
          const entry = cached as CacheEntry
          setResult(entry.research_data)
          setForm({ ...entry.research_data })
          setFromCache({ id: entry.id, created_at: entry.created_at })
          setStep('review')
          toast.success(`Loaded from cache (${timeAgo(entry.created_at)}) — no credits used`)
          return
        }
      } catch { /* no cache, proceed */ }
    }

    setFromCache(null)
    setStep('researching')
    try {
      const res  = await fetch('/api/ai/qualify-lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fullUrl }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) { toast.error(data.error ?? 'Research failed'); setStep('url'); return }
      const q: QualifyResult = data.data
      await saveToCache(fullUrl, domain, q, !!data.web_research_used)
      setResult(q); setForm({ ...q }); setStep('review')
    } catch { toast.error('Network error'); setStep('url') }
  }

  // ── Save to pipeline ─────────────────────────────────────────
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

  // ── Input helpers ─────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    background: 'rgba(8,9,18,0.8)', border: '1px solid rgba(255,255,255,0.08)',
    color: 'rgb(220,225,245)', borderRadius: 10, padding: '10px 14px',
    fontSize: 14, fontFamily: 'inherit', width: '100%', lineHeight: 1.6,
  }
  function Inp({ value, onChange, rows, placeholder, readOnly }: {
    value: string; onChange?: (v: string) => void; rows?: number; placeholder?: string; readOnly?: boolean
  }) {
    const focusBorder = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'
      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)'
    }
    const blurBorder = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
      e.currentTarget.style.boxShadow = 'none'
    }
    const style = { ...inputStyle, color: readOnly ? 'rgb(110,115,150)' : 'rgb(220,225,245)', resize: rows ? 'vertical' as const : undefined }
    return rows
      ? <textarea rows={rows} value={value} onChange={e => onChange?.(e.target.value)} placeholder={placeholder} readOnly={readOnly} style={style} onFocus={focusBorder} onBlur={blurBorder} />
      : <input type="text" value={value} onChange={e => onChange?.(e.target.value)} placeholder={placeholder} readOnly={readOnly} style={style} onFocus={focusBorder} onBlur={blurBorder} />
  }
  function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: readonly string[] }) {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        ...inputStyle, color: value ? 'rgb(220,225,245)' : 'rgb(100,107,140)', cursor: 'pointer',
      }}>
        <option value="">Select…</option>
        {options.map(o => <option key={o} value={o} style={{ background: 'rgb(10,11,18)' }}>{o}</option>)}
      </select>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 1 — URL Input
  // ─────────────────────────────────────────────────────────────
  if (step === 'url') return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/leads" className="btn btn-ghost" style={{ padding: '6px 8px' }}><ArrowLeft size={16} /></Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'white', letterSpacing: '-0.02em' }}>Add New Lead</h1>
          <p style={{ fontSize: 12, color: 'rgb(100,107,140)', marginTop: 3 }}>Paste a website — the agent researches everything</p>
        </div>
      </div>

      <div style={{ padding: '32px 36px', display: 'grid', gridTemplateColumns: '420px 1fr', gap: 28, alignItems: 'start' }}>

        {/* Left — URL input card */}
        <div>
          <div style={{
            borderRadius: 18, border: '1px solid rgba(255,255,255,0.09)', background: '#0D1120',
            padding: '36px 32px', boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(99,102,241,0.15))',
                border: '1px solid rgba(124,58,237,0.35)',
              }}>
                <Sparkles size={26} color="rgb(167,139,250)" />
              </div>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', letterSpacing: '-0.02em', marginBottom: 8, textAlign: 'center' }}>Research a company</h2>
            <p style={{ fontSize: 13, color: 'rgb(120,125,160)', lineHeight: 1.65, marginBottom: 24, textAlign: 'center' }}>
              Paste the website. The agent fills every field and gives a verdict.
            </p>

            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Globe size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgb(100,107,140)' }} />
              <input
                type="url" value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleResearch()}
                placeholder="https://company.xyz"
                style={{ ...inputStyle, paddingLeft: 38, height: 48, fontSize: 15 }}
                autoFocus
              />
            </div>

            <button onClick={() => handleResearch()} disabled={!url.trim()}
              style={{
                width: '100%', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                borderRadius: 11, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: !url.trim() ? 'not-allowed' : 'pointer',
                opacity: !url.trim() ? 0.45 : 1,
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: 'white', border: 'none',
                boxShadow: '0 2px 14px rgba(124,58,237,0.3)',
              }}>
              <Sparkles size={15} /> Research this company <ArrowRight size={14} />
            </button>

            {/* What the agent does */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 22 }}>
              {[
                { icon: Search,      label: 'Company profile' },
                { icon: Target,      label: 'Pain points & fit' },
                { icon: Shield,      label: 'Competitive intel' },
                { icon: TrendingUp,  label: 'Trigger & timing' },
                { icon: DollarSign,  label: 'Revenue potential' },
                { icon: Star,        label: 'Score & verdict' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <Icon size={13} color="rgb(167,139,250)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'rgb(150,155,190)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ fontSize: 11, color: 'rgb(65,70,95)', marginTop: 14, textAlign: 'center' }}>
            Try: resolv.im · volo.exchange · stargate.finance · ondo.finance
          </p>
        </div>

        {/* Right — Research history */}
        <div style={{ borderRadius: 16, border: C.border, background: C.cardBg, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.28)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(124,58,237,0.14)' }}>
                <History size={14} color="rgb(167,139,250)" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'rgb(225,228,248)', letterSpacing: '-0.01em' }}>Research History</span>
            </div>
            <span style={{ fontSize: 11, color: 'rgb(80,85,110)' }}>Click any to review · no credits used</span>
          </div>

          <div style={{ maxHeight: 560, overflowY: 'auto' }}>
            {histLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: 10 }}>
                <Loader2 size={16} color="rgb(100,107,140)" style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 13, color: 'rgb(80,85,110)' }}>Loading history...</span>
              </div>
            ) : history.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <Clock size={28} color="rgb(60,65,90)" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: 13, color: 'rgb(80,85,110)' }}>No research history yet.</p>
                <p style={{ fontSize: 12, color: 'rgb(65,70,95)', marginTop: 4 }}>Every company you research will appear here.</p>
              </div>
            ) : (
              history.map((entry, i) => {
                const score   = entry.research_data?.lead_score ?? 0
                const isGood  = entry.research_data?.verdict === 'good_lead'
                return (
                  <div key={entry.id}
                    onClick={() => loadFromCache(entry)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px',
                      borderBottom: i < history.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Verdict dot */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isGood ? 'rgba(52,211,153,0.1)' : 'rgba(252,165,165,0.1)',
                    }}>
                      {isGood
                        ? <CheckCircle2 size={18} color="rgb(52,211,153)" />
                        : <XCircle      size={18} color="rgb(252,165,165)" />}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'rgb(220,225,245)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.company_name ?? entry.domain}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: 'rgb(80,85,110)' }}>{entry.domain}</span>
                        <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 11 }}>·</span>
                        <span style={{ fontSize: 11, color: 'rgb(80,85,110)' }}>{timeAgo(entry.created_at)}</span>
                      </div>
                    </div>

                    {/* Score pill */}
                    <div style={{
                      flexShrink: 0, padding: '4px 11px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                      background: scoreGradient(score), border: `1px solid ${scoreBorderColor(score)}`,
                      color: scoreTextColor(score),
                    }}>
                      {score}/100
                    </div>
                  </div>
                )
              })
            )}
          </div>
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 180px)', padding: '0 36px' }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          <div style={{
            borderRadius: 20, border: '1px solid rgba(255,255,255,0.09)', background: '#0D1120',
            padding: '44px 40px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
              <div style={{ position: 'relative', width: 60, height: 60 }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(124,58,237,0.15)', borderTopColor: 'rgb(124,58,237)', animation: 'spin 1s linear infinite' }} />
                <Sparkles size={20} color="rgb(167,139,250)" style={{ position: 'absolute', inset: 0, margin: 'auto' }} />
              </div>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white', textAlign: 'center', marginBottom: 6 }}>Agent is researching...</h2>
            <p style={{ fontSize: 13, color: 'rgb(90,95,130)', textAlign: 'center', marginBottom: 32 }}>Live web search + deep AI analysis · 20–30 seconds</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {RESEARCH_STEPS.map((s, i) => {
                const Icon = s.icon; const done = i < researchStep; const active = i === researchStep; const pending = i > researchStep
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 12,
                    background: active ? 'rgba(124,58,237,0.1)' : done ? 'rgba(52,211,153,0.05)' : 'rgba(255,255,255,0.02)',
                    border: active ? '1px solid rgba(124,58,237,0.28)' : done ? '1px solid rgba(52,211,153,0.15)' : '1px solid rgba(255,255,255,0.05)',
                    opacity: pending ? 0.38 : 1, transition: 'all 0.5s ease',
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: active ? 'rgba(124,58,237,0.2)' : done ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)',
                    }}>
                      {done ? <CheckCircle2 size={15} color="rgb(52,211,153)" />
                        : active ? <Loader2 size={14} color="rgb(167,139,250)" style={{ animation: 'spin 1s linear infinite' }} />
                        : <Icon size={14} color="rgb(80,85,110)" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: active ? 'rgb(210,215,240)' : done ? 'rgb(110,200,160)' : 'rgb(80,85,110)' }}>{s.label}</p>
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
  // STEP 3 — Review
  // ─────────────────────────────────────────────────────────────
  if (step === 'review' && form && result) {
    const isGood = result.verdict === 'good_lead'
    const score  = Number(form.lead_score) || 0

    return (
      <div className="fade-in">
        {/* Sticky header */}
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={reset} className="btn btn-ghost" style={{ padding: '6px 8px' }}><ArrowLeft size={16} /></button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'white', letterSpacing: '-0.02em' }}>{form.company_name}</h1>
            <p style={{ fontSize: 12, color: 'rgb(100,107,140)', marginTop: 3 }}>Research complete · review and add to pipeline</p>
          </div>
          {fromCache && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)' }}>
              <Clock size={12} color="rgb(167,139,250)" />
              <span style={{ fontSize: 12, color: 'rgb(167,139,250)', fontWeight: 500 }}>Cached · {timeAgo(fromCache.created_at)}</span>
              <button onClick={() => handleResearch(true)} title="Re-research with fresh data"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', color: 'rgb(130,100,200)' }}>
                <RefreshCw size={12} />
              </button>
            </div>
          )}
          {/* Score pill always visible */}
          <div style={{
            padding: '5px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700,
            background: scoreGradient(score), border: `1px solid ${scoreBorderColor(score)}`,
            color: scoreTextColor(score),
          }}>
            {score}/100
          </div>
        </div>

        <div style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

          {/* ── LEFT COLUMN ───────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Verdict */}
            <div style={{
              borderRadius: 18, overflow: 'hidden',
              background: isGood ? 'linear-gradient(160deg, rgba(16,185,129,0.1) 0%, rgba(5,150,105,0.04) 100%)' : 'linear-gradient(160deg, rgba(248,113,133,0.1) 0%, rgba(185,28,28,0.04) 100%)',
              border: `1px solid ${isGood ? 'rgba(52,211,153,0.28)' : 'rgba(252,165,165,0.28)'}`,
              boxShadow: `0 12px 36px ${isGood ? 'rgba(16,185,129,0.07)' : 'rgba(248,113,133,0.07)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 26px', borderBottom: `1px solid ${isGood ? 'rgba(52,211,153,0.1)' : 'rgba(252,165,165,0.1)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isGood ? 'rgba(52,211,153,0.15)' : 'rgba(252,165,165,0.15)' }}>
                    {isGood ? <CheckCircle2 size={22} color="rgb(52,211,153)" /> : <XCircle size={22} color="rgb(252,165,165)" />}
                  </div>
                  <div>
                    <p style={{ fontSize: 18, fontWeight: 700, color: isGood ? 'rgb(52,211,153)' : 'rgb(252,165,165)', letterSpacing: '-0.01em', marginBottom: 4 }}>
                      {isGood ? '✅ Good Lead' : '❌ Not a Lead'}
                    </p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'rgb(130,135,165)' }}>{priorityLabel(result.priority)}</span>
                      <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                      <span style={{ fontSize: 12, color: 'rgb(130,135,165)' }}>Confidence {result.confidence_score}%</span>
                    </div>
                  </div>
                </div>
                <div style={{ width: 72, height: 72, borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: scoreGradient(score), border: `2px solid ${scoreBorderColor(score)}` }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: scoreTextColor(score), letterSpacing: '-0.03em', lineHeight: 1 }}>{score}</span>
                  <span style={{ fontSize: 10, color: 'rgb(90,95,130)', marginTop: 2 }}>/100</span>
                </div>
              </div>
              <div style={{ padding: '18px 26px' }}>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgb(190,195,225)' }}>{result.verdict_reasoning}</p>
                {((result.verdict_strengths?.length ?? 0) > 0 || (result.verdict_flags?.length ?? 0) > 0) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 18 }}>
                    {(result.verdict_strengths?.length ?? 0) > 0 && (
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgb(52,211,153)', marginBottom: 10 }}>Strengths</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                          {result.verdict_strengths.map((s, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              <span style={{ color: 'rgb(52,211,153)', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>+</span>
                              <span style={{ fontSize: 13, color: 'rgb(150,195,165)', lineHeight: 1.55 }}>{s}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(result.verdict_flags?.length ?? 0) > 0 && (
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgb(251,191,36)', marginBottom: 10 }}>Flags</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                          {result.verdict_flags.map((f, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              <AlertTriangle size={12} color="rgb(251,191,36)" style={{ flexShrink: 0, marginTop: 2 }} />
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

            {/* Company Info */}
            <SectionCard icon={Globe} title="Company Information" open={open.company} onToggle={() => toggle('company')}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div><FL>Company Name</FL><Inp value={form.company_name} onChange={v => set('company_name', v)} /></div>
                <div><FL>Website</FL><Inp value={url} readOnly /></div>
                <div style={{ gridColumn: '1/-1' }}><FL>Description</FL><Inp value={form.description} onChange={v => set('description', v)} rows={2} /></div>
                <div><FL>Business Model</FL><Inp value={form.business_model} onChange={v => set('business_model', v)} rows={2} /></div>
                <div><FL>Product Summary</FL><Inp value={form.product_summary} onChange={v => set('product_summary', v)} rows={2} /></div>
                <div><FL>Supported Chains / Rails</FL><Inp value={form.supported_chains_or_rails} onChange={v => set('supported_chains_or_rails', v)} /></div>
                <div><FL>Current Providers</FL><Inp value={form.current_providers} onChange={v => set('current_providers', v)} /></div>
              </div>
            </SectionCard>

            {/* Competitive Intel */}
            <SectionCard icon={Shield} title="Competitive Intelligence" open={open.competitive} onToggle={() => toggle('competitive')} accent="rgb(96,165,250)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {form.competitor_or_current_provider && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 11, background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.18)' }}>
                    <Shield size={16} color="rgb(96,165,250)" style={{ flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgb(96,165,250)', fontWeight: 700, marginBottom: 2 }}>Incumbent</p>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'rgb(220,225,245)' }}>{form.competitor_or_current_provider}</p>
                    </div>
                  </div>
                )}
                <div><FL>Current Provider / Competitor</FL><Inp value={form.competitor_or_current_provider} onChange={v => set('competitor_or_current_provider', v)} placeholder="e.g. LayerZero, Fireblocks, SWIFT..." /></div>
                <div><FL>Why they use it & what limitations that creates (the pitch wedge)</FL><Inp value={form.competitor_context} onChange={v => set('competitor_context', v)} rows={3} /></div>
              </div>
            </SectionCard>

            {/* Classification */}
            <SectionCard icon={Target} title="Sales Classification" open={open.classification} onToggle={() => toggle('classification')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <FL>Customer Categories</FL>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    {CUSTOMER_CATEGORIES.map(cat => {
                      const on = form.customer_category?.includes(cat)
                      return (
                        <button key={cat} type="button" onClick={() => toggleCat(cat)} style={{
                          padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                          border: on ? '1px solid rgba(167,139,250,0.5)' : '1px solid rgba(255,255,255,0.1)',
                          background: on ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                          color: on ? 'rgb(196,167,252)' : 'rgb(160,165,195)',
                          transition: 'all 0.15s',
                        }}>{cat}</button>
                      )
                    })}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <div><FL>Industry Category</FL><Sel value={form.industry_category} onChange={v => set('industry_category', v)} options={INDUSTRY_CATEGORIES} /></div>
                  <div><FL>Product to Sell</FL><Sel value={form.product_to_sell} onChange={v => set('product_to_sell', v)} options={PRODUCTS_TO_SELL} /></div>
                  <div><FL>Region</FL><Sel value={form.region} onChange={v => set('region', v)} options={REGIONS} /></div>
                </div>
              </div>
            </SectionCard>

            {/* Pain point */}
            <SectionCard icon={AlertTriangle} title="Pain Point & Trigger" open={open.painPoint} onToggle={() => toggle('painPoint')} accent="rgb(251,191,36)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {form.pain_point_severity && (() => { const b = severityBadge(form.pain_point_severity); return <Pill text={form.pain_point_severity.toUpperCase()} bg={b.bg} color={b.color} /> })()}
                  {form.pain_point_evidence_type && (() => { const e = evidenceStyle(form.pain_point_evidence_type); return <Pill text={e.label} bg={e.bg} color={e.color} /> })()}
                </div>
                <div><FL>Pain Point</FL><Inp value={form.pain_point} onChange={v => set('pain_point', v)} rows={3} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div><FL>Severity</FL><Sel value={form.pain_point_severity} onChange={v => set('pain_point_severity', v)} options={['critical','high','medium','low']} /></div>
                  <div><FL>Evidence Type</FL><Sel value={form.pain_point_evidence_type} onChange={v => set('pain_point_evidence_type', v)} options={['verified_source','agent_analysis','inferred']} /></div>
                </div>
                <div><FL>Evidence</FL><Inp value={form.pain_point_evidence} onChange={v => set('pain_point_evidence', v)} rows={2} /></div>
                {form.pain_point_source_url && (
                  <div>
                    <FL>Evidence Source URL</FL>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Inp value={form.pain_point_source_url} onChange={v => set('pain_point_source_url', v)} />
                      <a href={form.pain_point_source_url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, padding: '0 12px', borderRadius: 10, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: 'rgb(96,165,250)', display: 'flex', alignItems: 'center' }}><ExternalLink size={14} /></a>
                    </div>
                  </div>
                )}
                <div><FL>Trigger Reason (why reach out NOW?)</FL><Inp value={form.trigger_reason} onChange={v => set('trigger_reason', v)} rows={2} /></div>
                {form.trigger_source_url && (
                  <div>
                    <FL>Trigger Source URL</FL>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Inp value={form.trigger_source_url} onChange={v => set('trigger_source_url', v)} />
                      <a href={form.trigger_source_url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, padding: '0 12px', borderRadius: 10, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: 'rgb(96,165,250)', display: 'flex', alignItems: 'center' }}><ExternalLink size={14} /></a>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Products & Use Cases */}
            {(result.product_matches?.length ?? 0) > 0 && (
              <SectionCard icon={Layers} title="Products & Use Cases" open={open.products} onToggle={() => toggle('products')} accent="rgb(56,189,248)">
                {(() => {
                  const groups: Record<string, ProductMatch[]> = {}
                  ;(result.product_matches ?? []).forEach(pm => {
                    if (!groups[pm.company]) groups[pm.company] = []
                    groups[pm.company].push(pm)
                  })
                  const companyMeta: Record<string, { color: string; bg: string; border: string; dot: string }> = {
                    Kima:     { color: 'rgb(96,165,250)',   bg: 'rgba(96,165,250,0.08)',   border: 'rgba(96,165,250,0.22)',   dot: 'rgba(96,165,250,0.9)' },
                    Aeredium: { color: 'rgb(167,139,250)',  bg: 'rgba(167,139,250,0.08)',  border: 'rgba(167,139,250,0.22)',  dot: 'rgba(167,139,250,0.9)' },
                    Aerpolice:   { color: 'rgb(251,191,36)',   bg: 'rgba(251,191,36,0.07)',   border: 'rgba(251,191,36,0.22)',   dot: 'rgba(251,191,36,0.9)' },
                  }
                  const matchStyle = (m: string) => ({
                    strong:  { icon: '✓', color: 'rgb(52,211,153)',  bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.22)',  label: 'Strong Match' },
                    partial: { icon: '~', color: 'rgb(251,191,36)',  bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.22)',  label: 'Partial'      },
                    none:    { icon: '✕', color: 'rgb(156,163,175)', bg: 'rgba(255,255,255,0.03)',border: 'rgba(255,255,255,0.07)', label: 'No Match'     },
                  }[m] ?? { icon: '?', color: 'rgb(156,163,175)', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.07)', label: m })

                  const strongCount  = (result.product_matches ?? []).filter(p => p.match === 'strong').length
                  const partialCount = (result.product_matches ?? []).filter(p => p.match === 'partial').length

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                      {/* summary chips */}
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {strongCount > 0 && (
                          <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', color: 'rgb(52,211,153)' }}>
                            {strongCount} strong {strongCount === 1 ? 'match' : 'matches'}
                          </span>
                        )}
                        {partialCount > 0 && (
                          <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.28)', color: 'rgb(251,191,36)' }}>
                            {partialCount} partial {partialCount === 1 ? 'match' : 'matches'}
                          </span>
                        )}
                        {strongCount === 0 && partialCount === 0 && (
                          <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: 'rgba(252,165,165,0.1)', border: '1px solid rgba(252,165,165,0.25)', color: 'rgb(252,165,165)' }}>
                            No product match
                          </span>
                        )}
                      </div>

                      {/* per-company groups */}
                      {(['Kima', 'Aeredium', 'Aerpolice'] as const).map(co => {
                        const items = groups[co]
                        if (!items?.length) return null
                        const cm = companyMeta[co]
                        const hasHit = items.some(p => p.match !== 'none')
                        return (
                          <div key={co}>
                            {/* Company header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: cm.dot, flexShrink: 0 }} />
                              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: cm.color }}>{co}</span>
                              <div style={{ flex: 1, height: 1, background: cm.border }} />
                              {hasHit && (
                                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: cm.bg, border: `1px solid ${cm.border}`, color: cm.color }}>
                                  {items.filter(p => p.match !== 'none').length}/{items.length} match
                                </span>
                              )}
                            </div>

                            {/* Product rows */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {items.map((pm, idx) => {
                                const ms = matchStyle(pm.match)
                                return (
                                  <div key={idx} style={{
                                    borderRadius: 12, border: `1px solid ${ms.border}`,
                                    background: ms.bg, padding: '12px 16px',
                                    opacity: pm.match === 'none' ? 0.6 : 1,
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                                          <span style={{
                                            width: 20, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 11, fontWeight: 700, flexShrink: 0,
                                            background: `${ms.color}18`, color: ms.color,
                                          }}>{ms.icon}</span>
                                          <span style={{ fontSize: 13, fontWeight: 600, color: pm.match === 'none' ? 'rgb(120,125,155)' : 'rgb(220,225,245)' }}>
                                            {pm.product}
                                          </span>
                                        </div>
                                        <p style={{ fontSize: 12.5, lineHeight: 1.6, color: pm.match === 'none' ? 'rgb(90,95,125)' : 'rgb(170,175,205)', margin: '0 0 0 28px' }}>
                                          {pm.why}
                                        </p>
                                        {pm.use_case && pm.match !== 'none' && (
                                          <div style={{ margin: '8px 0 0 28px', padding: '7px 12px', borderRadius: 8, background: `${cm.color}10`, border: `1px solid ${cm.border}` }}>
                                            <p style={{ fontSize: 11, color: cm.color, margin: 0, lineHeight: 1.55 }}>
                                              <span style={{ fontWeight: 700, letterSpacing: '0.05em' }}>USE CASE — </span>{pm.use_case}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                      <span style={{
                                        flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                                        background: ms.bg, border: `1px solid ${ms.border}`, color: ms.color,
                                        letterSpacing: '0.04em',
                                      }}>{ms.label}</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </SectionCard>
            )}

            {/* Fit */}
            <SectionCard icon={Zap} title="Kima & Aeredium Fit" open={open.fit} onToggle={() => toggle('fit')} accent="rgb(167,139,250)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div><FL>Kima Fit</FL><Inp value={form.kima_fit} onChange={v => set('kima_fit', v)} rows={4} /></div>
                  <div><FL>Aeredium Fit</FL><Inp value={form.aeredium_fit} onChange={v => set('aeredium_fit', v)} rows={4} /></div>
                </div>
                <div><FL>Suggested Use Case</FL><Inp value={form.suggested_use_case} onChange={v => set('suggested_use_case', v)} /></div>
                <div><FL>Settlement Angle</FL><Inp value={form.settlement_angle} onChange={v => set('settlement_angle', v)} rows={2} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div><FL>Security Angle</FL><Inp value={form.security_angle} onChange={v => set('security_angle', v)} rows={3} /></div>
                  <div><FL>Risk Angle</FL><Inp value={form.risk_angle} onChange={v => set('risk_angle', v)} rows={3} /></div>
                </div>
              </div>
            </SectionCard>

            {/* Scoring */}
            <SectionCard icon={BarChart2} title="Scoring & Source" open={open.scoring} onToggle={() => toggle('scoring')}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div><FL>Lead Score (0–100)</FL>
                  <input type="number" min={0} max={100} value={form.lead_score} onChange={e => set('lead_score', parseInt(e.target.value)||0)} style={{ ...inputStyle }} />
                </div>
                <div><FL>Confidence Score (0–100)</FL>
                  <input type="number" min={0} max={100} value={form.confidence_score} onChange={e => set('confidence_score', parseInt(e.target.value)||0)} style={{ ...inputStyle }} />
                </div>
                <div><FL>Source URL</FL><Inp value={form.source_url} onChange={v => set('source_url', v)} /></div>
                <div><FL>Source Summary</FL><Inp value={form.source_summary} onChange={v => set('source_summary', v)} /></div>
              </div>
            </SectionCard>

          </div>

          {/* ── RIGHT SIDEBAR ─────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 88 }}>

            {/* Actions */}
            <div style={{ borderRadius: 14, border: C.border, background: C.cardBg, padding: 20 }}>
              <FL>Actions</FL>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={handleSave} disabled={saving} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                  padding: '11px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1,
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: 'white',
                  border: 'none', fontFamily: 'inherit', boxShadow: '0 2px 14px rgba(124,58,237,0.3)',
                }}>
                  {saving ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />Adding...</> : <><Save size={15} />Add to Pipeline</>}
                </button>
                <button onClick={() => setStep('url')} disabled={saving} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: 'rgba(255,255,255,0.04)', color: 'rgb(150,155,195)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <Globe size={13} /> Try another URL
                </button>
                <button onClick={reset} disabled={saving} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: 'rgba(248,113,133,0.07)', color: 'rgb(252,165,165)',
                  border: '1px solid rgba(248,113,133,0.18)',
                }}>
                  <Trash2 size={13} /> Discard
                </button>
                {fromCache && (
                  <button onClick={() => handleResearch(true)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                    background: 'rgba(167,139,250,0.07)', color: 'rgb(196,167,252)',
                    border: '1px solid rgba(167,139,250,0.2)',
                  }}>
                    <RefreshCw size={13} /> Re-research fresh
                  </button>
                )}
              </div>
            </div>

            {/* Discuss this lead */}
            <DiscussPanel leadData={result} />

            {/* Commercial potential */}
            <SectionCard icon={DollarSign} title="Commercial Potential" open={open.commercial} onToggle={() => toggle('commercial')} accent="rgb(52,211,153)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div><FL>Revenue Potential</FL><Inp value={form.revenue_potential} onChange={v => set('revenue_potential', v)} rows={3} placeholder="Impact if they integrate Kima..." /></div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <FL>Integration Feasibility</FL>
                    {form.integration_feasibility && (() => { const b = feasBadge(form.integration_feasibility); return <Pill text={form.integration_feasibility.split(' ')[0].toUpperCase()} bg={b.bg} color={b.color} /> })()}
                  </div>
                  <Inp value={form.integration_feasibility} onChange={v => set('integration_feasibility', v)} rows={2} placeholder="high / medium / low — and why..." />
                </div>
              </div>
            </SectionCard>

            {/* Social */}
            <SectionCard icon={MessageCircle} title="Social Links" open={open.social} onToggle={() => toggle('social')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'Twitter / X',   key: 'twitter_url'  as keyof QualifyResult, color: 'rgb(100,170,255)' },
                  { label: 'Telegram',       key: 'telegram_url' as keyof QualifyResult, color: 'rgb(50,190,210)' },
                  { label: 'Discord',        key: 'discord_url'  as keyof QualifyResult, color: 'rgb(130,130,255)' },
                ].map(({ label, key, color }) => (
                  <div key={label}>
                    <FL>{label}</FL>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Inp value={String(form[key] ?? '')} onChange={v => set(key, v)} placeholder="https://..." />
                      {form[key] && (
                        <a href={String(form[key])} target="_blank" rel="noopener noreferrer"
                          style={{ flexShrink: 0, padding: '0 11px', borderRadius: 9, background: `${color}18`, border: `1px solid ${color}30`, color, display: 'flex', alignItems: 'center' }}>
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Facts & Assumptions */}
            <SectionCard icon={BookOpen} title="Research Intel" open={open.intel} onToggle={() => toggle('intel')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(form.facts?.length ?? 0) > 0 && (
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgb(52,211,153)', marginBottom: 10 }}>Verified Facts</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {form.facts.map((f, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 9, background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.12)' }}>
                          <CheckCircle2 size={13} color="rgb(52,211,153)" style={{ flexShrink: 0, marginTop: 2 }} />
                          <div><span style={{ fontSize: 12, fontWeight: 600, color: 'rgb(110,231,183)' }}>{f.label}: </span><span style={{ fontSize: 12, color: 'rgb(155,190,170)' }}>{f.value}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(form.assumptions?.length ?? 0) > 0 && (
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgb(251,191,36)', marginBottom: 10 }}>Assumptions</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {form.assumptions.map((a, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 9, background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.12)' }}>
                          <AlertTriangle size={13} color="rgb(251,191,36)" style={{ flexShrink: 0, marginTop: 2 }} />
                          <div><span style={{ fontSize: 12, fontWeight: 600, color: 'rgb(253,224,71)' }}>{a.label}: </span><span style={{ fontSize: 12, color: 'rgb(190,175,135)' }}>{a.value}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!form.facts?.length && !form.assumptions?.length && (
                  <p style={{ fontSize: 12, color: 'rgb(80,85,110)', textAlign: 'center', padding: '8px 0' }}>No intel data.</p>
                )}
              </div>
            </SectionCard>

          </div>
        </div>
      </div>
    )
  }

  return null
}
