'use client'

import { useEffect, useState, Suspense, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Sparkles, Copy, Save, Loader2, MessageSquare, RefreshCw, Send,
  AtSign, Mail, Wand2, SlidersHorizontal, ExternalLink, CheckCheck,
} from 'lucide-react'
import { CUSTOMER_CATEGORIES, PRODUCTS_TO_SELL } from '@/lib/types'
import type { Lead } from '@/lib/types'
import { buildTarget, channelDeepLink, logTouch, type OutreachMeta } from '@/lib/outreach'

const CHANNELS = ['telegram', 'linkedin', 'twitter', 'email'] as const
const TONES = ['casual', 'professional', 'founder_to_founder', 'concise', 'strong_bd'] as const
const LENGTHS = ['short', 'medium', 'detailed'] as const
const USE_CASES = [
  'Cross-chain settlement', 'Stablecoin settlement', 'Fiat on/off-ramp',
  'Treasury movement', 'DvP settlement', 'iGaming payments', 'RWA settlement',
  'PSP settlement', 'Wallet onboarding', 'Launchpad participation'
]

interface GeneratedMessages {
  subject_line?: string
  message?: string
  followup_1?: string
  followup_2?: string
  objection_reply?: string
  call_opening?: string
  meeting_agenda?: string
}

interface AgentDraft {
  id: string
  label: string
  channel: string
  version?: number
  subject?: string
  text: string
}

// ── Platform identity ────────────────────────────────────────────────────────
const CHANNEL_CFG: Record<string, {
  label: string
  color: string
  dimColor: string
  bg: string
  border: string
  borderActive: string
  Icon: typeof Send
}> = {
  telegram: {
    label: 'Telegram / X DM',
    color: '#22d3ee',
    dimColor: 'rgba(34,211,238,0.55)',
    bg: 'rgba(34,211,238,0.06)',
    border: 'rgba(34,211,238,0.15)',
    borderActive: 'rgba(34,211,238,0.35)',
    Icon: Send,
  },
  linkedin: {
    label: 'LinkedIn',
    color: '#60a5fa',
    dimColor: 'rgba(96,165,250,0.55)',
    bg: 'rgba(96,165,250,0.06)',
    border: 'rgba(96,165,250,0.15)',
    borderActive: 'rgba(96,165,250,0.35)',
    Icon: MessageSquare,
  },
  email: {
    label: 'Email',
    color: '#fbbf24',
    dimColor: 'rgba(251,191,36,0.55)',
    bg: 'rgba(251,191,36,0.06)',
    border: 'rgba(251,191,36,0.15)',
    borderActive: 'rgba(251,191,36,0.35)',
    Icon: Mail,
  },
  twitter: {
    label: 'Twitter / X',
    color: '#94a3b8',
    dimColor: 'rgba(148,163,184,0.5)',
    bg: 'rgba(148,163,184,0.05)',
    border: 'rgba(148,163,184,0.12)',
    borderActive: 'rgba(148,163,184,0.3)',
    Icon: AtSign,
  },
}

const CHANNEL_ORDER = ['telegram', 'linkedin', 'email']

// ── Version pill strip ────────────────────────────────────────────────────────
function VersionPills({
  count, active, color, onChange,
}: { count: number; active: number; color: string; onChange: (i: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          style={{
            padding: '2px 10px',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.04em',
            borderRadius: 5,
            cursor: 'pointer',
            transition: 'all 0.15s',
            background: i === active ? color : 'rgba(255,255,255,0.05)',
            color: i === active ? '#000' : 'rgba(255,255,255,0.35)',
            border: `1px solid ${i === active ? color : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          V{i + 1}
        </button>
      ))}
    </div>
  )
}

// ── Single channel card ───────────────────────────────────────────────────────
function DraftChannelCard({
  channel,
  drafts,
  savingId,
  sendingId,
  copiedId,
  onCopy,
  onSave,
  onSend,
}: {
  channel: string
  drafts: AgentDraft[]
  savingId: string | null
  sendingId: string | null
  copiedId: string | null
  onCopy: (draft: AgentDraft) => void
  onSave: (draft: AgentDraft) => void
  onSend: (draft: AgentDraft) => void
}) {
  const [activeV, setActiveV] = useState(0)
  const cfg = CHANNEL_CFG[channel] ?? CHANNEL_CFG.linkedin
  const draft = drafts[activeV]
  if (!draft) return null
  const isCopied = copiedId === draft.id

  return (
    <div style={{
      borderRadius: 14,
      overflow: 'hidden',
      border: `1px solid ${cfg.border}`,
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(12,13,24,0.85)',
      boxShadow: `0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)`,
      transition: 'border-color 0.2s',
    }}>
      {/* ── header ── */}
      <div style={{
        padding: '14px 16px 12px',
        background: cfg.bg,
        borderBottom: `1px solid ${cfg.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: drafts.length > 1 ? 10 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <cfg.Icon size={12} color={cfg.color} />
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: cfg.color,
            }}>
              {cfg.label}
            </span>
          </div>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
            {draft.text.length} chars
          </span>
        </div>

        {drafts.length > 1 && (
          <VersionPills
            count={drafts.length}
            active={activeV}
            color={cfg.color}
            onChange={setActiveV}
          />
        )}
      </div>

      {/* ── subject line (email) ── */}
      {draft.subject && (
        <div style={{
          padding: '10px 16px 8px',
          borderBottom: `1px solid rgba(255,255,255,0.04)`,
          background: 'rgba(251,191,36,0.04)',
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(251,191,36,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Subject </span>
          <span style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>{draft.subject}</span>
        </div>
      )}

      {/* ── message body ── */}
      <div style={{
        flex: 1,
        padding: '16px',
        fontSize: 13,
        lineHeight: 1.72,
        color: 'rgb(210,213,235)',
        fontFamily: 'Inter, sans-serif',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        minHeight: 100,
      }}>
        {draft.text}
      </div>

      {/* ── footer ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 6,
        padding: '9px 14px',
        borderTop: `1px solid rgba(255,255,255,0.05)`,
        background: 'rgba(255,255,255,0.015)',
      }}>
        <button
          onClick={() => onCopy(draft)}
          className="btn btn-ghost"
          style={{ padding: '3px 9px', fontSize: 11, gap: 4, color: isCopied ? cfg.color : undefined }}
        >
          {isCopied ? <CheckCheck size={10} /> : <Copy size={10} />}
          {isCopied ? 'Copied' : 'Copy'}
        </button>
        <button
          onClick={() => onSave(draft)}
          disabled={savingId === draft.id}
          className="btn btn-ghost"
          style={{ padding: '3px 9px', fontSize: 11, gap: 4 }}
        >
          {savingId === draft.id ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
          Save
        </button>
        <button
          onClick={() => onSend(draft)}
          disabled={sendingId === draft.id}
          className="btn btn-ghost"
          style={{ padding: '3px 9px', fontSize: 11, gap: 4, color: cfg.color }}
        >
          {sendingId === draft.id ? <Loader2 size={10} className="animate-spin" /> : <ExternalLink size={10} />}
          Send
        </button>
      </div>
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function DraftSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {CHANNEL_ORDER.map(ch => {
        const cfg = CHANNEL_CFG[ch]
        return (
          <div key={ch} style={{
            borderRadius: 14, overflow: 'hidden',
            border: `1px solid ${cfg.border}`,
            background: 'rgba(12,13,24,0.85)',
          }}>
            <div style={{ padding: '14px 16px', background: cfg.bg, borderBottom: `1px solid ${cfg.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <cfg.Icon size={12} color={cfg.dimColor} />
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: cfg.dimColor }}>
                  {cfg.label}
                </span>
              </div>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[80, 95, 70, 85].map((w, i) => (
                <div key={i} style={{
                  height: 11, borderRadius: 4, width: `${w}%`,
                  background: 'rgba(255,255,255,0.05)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Custom message block ──────────────────────────────────────────────────────
function MessageBlock({ label, value }: { label: string; value?: string }) {
  const [copied, setCopied] = useState(false)
  if (!value) return null
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-xs font-semibold" style={{ color: 'rgb(160,160,180)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
          className="btn btn-ghost"
          style={{ padding: '2px 6px', fontSize: '11px', color: copied ? '#34d399' : undefined }}
        >
          {copied ? <CheckCheck size={10} /> : <Copy size={10} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 text-sm leading-relaxed whitespace-pre-wrap"
        style={{ color: 'rgb(210,210,230)', fontFamily: 'Inter, sans-serif', background: 'rgba(22,22,34,0.5)' }}>
        {value}
      </pre>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
function OutreachStudioContent() {
  const searchParams = useSearchParams()
  const preselectedLeadId = searchParams.get('lead')
  const supabase = createClient()

  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLeadId, setSelectedLeadId] = useState(preselectedLeadId || '')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  // Agent auto-drafts.
  const [autoDrafts, setAutoDrafts] = useState<AgentDraft[]>([])
  const [autoMeta, setAutoMeta] = useState<OutreachMeta | null>(null)
  const [autoLoading, setAutoLoading] = useState(false)
  const [savingDraftId, setSavingDraftId] = useState<string | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Manual "write your own" path.
  const [showCustom, setShowCustom] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generated, setGenerated] = useState<GeneratedMessages | null>(null)

  // Drafting AI from settings.
  const [draftingAI, setDraftingAI] = useState<'openai' | 'claude'>('openai')
  useEffect(() => {
    const v = localStorage.getItem('bd_drafting_ai')
    if (v === 'claude' || v === 'openai') setDraftingAI(v)
  }, [])

  const [form, setForm] = useState({
    contact_name: '',
    channel: 'linkedin' as typeof CHANNELS[number],
    tone: 'founder_to_founder' as typeof TONES[number],
    customer_category: '',
    product_to_sell: '',
    use_case: '',
    message_length: 'medium' as typeof LENGTHS[number],
    pain_point_override: '',
    kima_fit_override: '',
    aeredium_fit_override: '',
  })

  useEffect(() => {
    supabase.from('leads').select('id, company_name, pain_point, kima_fit, aeredium_fit, customer_category, product_to_sell')
      .not('status', 'eq', 'rejected')
      .not('status', 'eq', 'archived')
      .order('lead_score', { ascending: false, nullsFirst: false })
      .limit(100)
      .then(({ data }) => setLeads((data || []) as Lead[]))
  }, [])

  const generateAuto = useCallback(async (leadId: string) => {
    setAutoLoading(true)
    setAutoDrafts([])
    setAutoMeta(null)
    try {
      const res = await fetch('/api/ai/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'auto', lead_id: leadId, drafting_ai: draftingAI }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const drafts: AgentDraft[] = json.data?.drafts || []
      setAutoDrafts(drafts)
      setAutoMeta(json.data?.meta || null)
      if (drafts.length === 0) toast.error('No drafts returned — try regenerating')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Draft generation failed'
      toast.error(msg)
    } finally {
      setAutoLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftingAI])

  useEffect(() => {
    if (selectedLeadId) {
      const lead = leads.find(l => l.id === selectedLeadId)
      if (lead) {
        setSelectedLead(lead)
        setForm(f => ({
          ...f,
          customer_category: (lead.customer_category || [])[0] || '',
          product_to_sell: lead.product_to_sell || '',
          pain_point_override: lead.pain_point || '',
          kima_fit_override: lead.kima_fit || '',
          aeredium_fit_override: lead.aeredium_fit || '',
        }))
      }
    }
  }, [selectedLeadId, leads])

  useEffect(() => {
    if (selectedLeadId && leads.length > 0) {
      generateAuto(selectedLeadId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeadId, leads.length])

  const generate = async () => {
    if (!selectedLead) { toast.error('Select a company first'); return }
    setGenerating(true)
    setGenerated(null)
    try {
      const res = await fetch('/api/ai/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: selectedLead.company_name,
          contact_name: form.contact_name || '[Name]',
          channel: form.channel,
          tone: form.tone,
          customer_category: form.customer_category,
          product_to_sell: form.product_to_sell,
          use_case: form.use_case,
          pain_point: form.pain_point_override || selectedLead.pain_point,
          kima_fit: form.kima_fit_override || selectedLead.kima_fit,
          aeredium_fit: form.aeredium_fit_override || selectedLead.aeredium_fit,
          message_length: form.message_length,
          drafting_ai: draftingAI,
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setGenerated(json.data)
      toast.success('Messages generated')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const saveToLead = async () => {
    if (!generated || !selectedLeadId) return
    setSaving(true)
    const { error } = await supabase.from('outreach_messages').insert({
      lead_id: selectedLeadId,
      channel: form.channel,
      tone: form.tone,
      customer_category: form.customer_category,
      product_to_sell: form.product_to_sell,
      message: generated.message,
      followup_1: generated.followup_1,
      followup_2: generated.followup_2,
      objection_reply: generated.objection_reply,
      call_opening: generated.call_opening,
      meeting_agenda: generated.meeting_agenda,
      status: 'draft',
    })
    if (error) toast.error('Failed to save')
    else toast.success('Messages saved to lead')
    setSaving(false)
  }

  const saveDraft = async (draft: AgentDraft) => {
    if (!selectedLeadId) return
    setSavingDraftId(draft.id)
    const { error } = await supabase.from('outreach_messages').insert({
      lead_id: selectedLeadId,
      channel: draft.channel,
      tone: 'founder_to_founder',
      message: draft.subject ? `Subject: ${draft.subject}\n\n${draft.text}` : draft.text,
      status: 'draft',
    })
    if (error) toast.error('Failed to save')
    else toast.success(`Saved to lead ✓`)
    setSavingDraftId(null)
  }

  const copyDraft = (draft: AgentDraft) => {
    const full = draft.subject ? `${draft.subject}\n\n${draft.text}` : draft.text
    navigator.clipboard.writeText(full)
    setCopiedId(draft.id)
    setTimeout(() => setCopiedId(null), 1500)
    toast.success('Copied!')
  }

  const sendDraft = async (draft: AgentDraft) => {
    if (!selectedLeadId) return
    setSendingId(draft.id)
    const target = buildTarget(autoMeta)
    const url = channelDeepLink(draft.channel, target, draft.text, draft.subject)
    const fullText = draft.subject ? `${draft.subject}\n\n${draft.text}` : draft.text
    const { error } = await logTouch(supabase, {
      leadId: selectedLeadId,
      channel: draft.channel,
      text: draft.text,
      subject: draft.subject,
      contactId: autoMeta?.contact?.id,
      kind: 'initial',
    })
    setSendingId(null)
    if (error) { toast.error('Could not log the touch'); return }
    if (url) {
      if (draft.channel !== 'email') navigator.clipboard.writeText(fullText)
      window.open(url, '_blank')
      toast.success('Logged · follow-up scheduled in 5 days')
    } else {
      navigator.clipboard.writeText(fullText)
      toast.success('Logged · no destination on file — text copied')
    }
  }

  // Group drafts by channel, preserving order
  const grouped: Record<string, AgentDraft[]> = {}
  for (const d of autoDrafts) {
    if (!grouped[d.channel]) grouped[d.channel] = []
    grouped[d.channel].push(d)
  }
  const channelKeys = CHANNEL_ORDER.filter(ch => grouped[ch]?.length > 0)

  const inputClass = 'input-dark'
  const selStyle = { fontSize: '13px' }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Outreach Studio</h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>
              Agent drafts 2 ready-to-send variations per channel — pick your favourite and send
            </p>
          </div>
          {draftingAI && (
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
              padding: '3px 9px', borderRadius: 6,
              background: draftingAI === 'claude' ? 'rgba(167,139,250,0.1)' : 'rgba(52,211,153,0.1)',
              color: draftingAI === 'claude' ? '#a78bfa' : '#34d399',
              border: `1px solid ${draftingAI === 'claude' ? 'rgba(167,139,250,0.25)' : 'rgba(52,211,153,0.25)'}`,
            }}>
              {draftingAI === 'claude' ? 'Claude' : 'GPT-4o'}
            </span>
          )}
        </div>
      </div>

      <div className="p-8 space-y-6">
        {/* ── Lead picker ── */}
        <div className="rounded-xl p-5" style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>Company</label>
          <div className="flex gap-3">
            <select className={inputClass} style={selStyle} value={selectedLeadId} onChange={e => setSelectedLeadId(e.target.value)}>
              <option value="">Select a lead...</option>
              {leads.map(l => (
                <option key={l.id} value={l.id}>{l.company_name}</option>
              ))}
            </select>
            {selectedLeadId && (
              <button
                onClick={() => generateAuto(selectedLeadId)}
                disabled={autoLoading}
                className="btn btn-secondary whitespace-nowrap"
                style={{ fontSize: '12px', padding: '6px 14px', gap: 6 }}
              >
                <RefreshCw size={12} className={autoLoading ? 'animate-spin' : ''} />
                Regenerate
              </button>
            )}
          </div>
        </div>

        {/* ── Agent drafts ── */}
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div style={{
              width: 26, height: 26, borderRadius: 7,
              background: 'rgba(167,139,250,0.12)',
              border: '1px solid rgba(167,139,250,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Wand2 size={13} color="#a78bfa" />
            </div>
            <div>
              <span className="text-sm font-semibold text-white">Agent Drafts</span>
              <span className="text-xs ml-2" style={{ color: 'rgb(90,95,130)' }}>
                {autoDrafts.length > 0
                  ? `${autoDrafts.length} variations across 3 channels`
                  : '2 variations per channel · research-backed'}
              </span>
            </div>
          </div>

          {!selectedLeadId ? (
            <div className="flex flex-col items-center justify-center min-h-[260px] rounded-xl"
              style={{ background: 'rgba(22,22,34,0.4)', border: '2px dashed rgba(255,255,255,0.06)' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, marginBottom: 16,
                background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Wand2 size={22} color="rgba(167,139,250,0.5)" />
              </div>
              <p className="text-sm font-semibold text-white mb-1.5">Pick a company to start</p>
              <p className="text-xs text-center max-w-xs" style={{ color: 'rgb(90,95,130)', lineHeight: 1.6 }}>
                The agent reads every piece of research saved for that lead and writes 2 completely different messages per channel — each with a unique hook, written to look hand-crafted.
              </p>
            </div>

          ) : autoLoading ? (
            <DraftSkeleton />

          ) : channelKeys.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {channelKeys.map(ch => (
                <DraftChannelCard
                  key={ch}
                  channel={ch}
                  drafts={grouped[ch]}
                  savingId={savingDraftId}
                  sendingId={sendingId}
                  copiedId={copiedId}
                  onCopy={copyDraft}
                  onSave={saveDraft}
                  onSend={sendDraft}
                />
              ))}
            </div>

          ) : (
            <div className="flex flex-col items-center justify-center min-h-[200px] rounded-xl"
              style={{ background: 'rgba(22,22,34,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-sm text-white mb-3">No drafts yet</p>
              <button onClick={() => generateAuto(selectedLeadId)} className="btn btn-primary" style={{ fontSize: '13px' }}>
                <Sparkles size={14} />Draft with AI
              </button>
            </div>
          )}
        </div>

        {/* ── Manual path toggle ── */}
        <div className="border-t pt-6" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => setShowCustom(s => !s)}
            className="flex items-center gap-2 text-sm font-medium"
            style={{ color: showCustom ? '#fff' : 'rgb(140,145,175)' }}
          >
            <SlidersHorizontal size={14} />
            {showCustom ? 'Hide custom builder' : 'Want to write your own? Configure it manually'}
          </button>

          {showCustom && (
            <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: Config */}
              <div className="space-y-4">
                <div className="rounded-xl p-5" style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h2 className="text-sm font-semibold text-white mb-4">Configure Outreach</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>Contact Name (optional)</label>
                      <input className={inputClass} style={selStyle} value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="[Name] if unknown" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>Channel</label>
                        <select className={inputClass} style={selStyle} value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value as typeof CHANNELS[number] }))}>
                          {CHANNELS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>Tone</label>
                        <select className={inputClass} style={selStyle} value={form.tone} onChange={e => setForm(f => ({ ...f, tone: e.target.value as typeof TONES[number] }))}>
                          <option value="casual">Casual</option>
                          <option value="professional">Professional</option>
                          <option value="founder_to_founder">Founder to Founder</option>
                          <option value="concise">Concise</option>
                          <option value="strong_bd">Strong BD</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>Customer Category</label>
                        <select className={inputClass} style={selStyle} value={form.customer_category} onChange={e => setForm(f => ({ ...f, customer_category: e.target.value }))}>
                          <option value="">Select category</option>
                          {CUSTOMER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>Message Length</label>
                        <select className={inputClass} style={selStyle} value={form.message_length} onChange={e => setForm(f => ({ ...f, message_length: e.target.value as typeof LENGTHS[number] }))}>
                          <option value="short">Short</option>
                          <option value="medium">Medium</option>
                          <option value="detailed">Detailed</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>Product to Sell</label>
                      <select className={inputClass} style={selStyle} value={form.product_to_sell} onChange={e => setForm(f => ({ ...f, product_to_sell: e.target.value }))}>
                        <option value="">Select product</option>
                        {PRODUCTS_TO_SELL.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>Use Case</label>
                      <select className={inputClass} style={selStyle} value={form.use_case} onChange={e => setForm(f => ({ ...f, use_case: e.target.value }))}>
                        <option value="">Select use case</option>
                        {USE_CASES.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>Pain Point (override or customize)</label>
                      <textarea className={inputClass} rows={2} style={{ ...selStyle, resize: 'vertical' as const }} value={form.pain_point_override} onChange={e => setForm(f => ({ ...f, pain_point_override: e.target.value }))} placeholder="The specific pain point to address..." />
                    </div>
                    <button
                      onClick={generate}
                      disabled={generating || !selectedLeadId}
                      className="btn btn-primary w-full justify-center"
                      style={{ padding: '10px', fontSize: '14px' }}
                    >
                      {generating
                        ? <><Loader2 size={16} className="animate-spin" />Generating with AI...</>
                        : <><Sparkles size={16} />Generate Full Sequence</>}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right: Generated */}
              <div>
                {!generated ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px] rounded-xl"
                    style={{ background: 'rgba(22,22,34,0.4)', border: '2px dashed rgba(255,255,255,0.06)' }}>
                    <MessageSquare size={40} className="mb-4 opacity-20" style={{ color: '#a78bfa' }} />
                    <p className="text-sm font-medium text-white mb-1">Full sequence builder</p>
                    <p className="text-xs text-center max-w-xs" style={{ color: 'rgb(100,100,120)' }}>
                      Configure the options and generate a first message, follow-ups, objection reply, call opener, and meeting agenda.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-white">Generated Sequence</h2>
                      <div className="flex gap-2">
                        <button onClick={generate} disabled={generating} className="btn btn-secondary" style={{ fontSize: '12px', padding: '5px 10px' }}>
                          <RefreshCw size={12} className={generating ? 'animate-spin' : ''} />Regenerate
                        </button>
                        <button onClick={saveToLead} disabled={saving || !selectedLeadId} className="btn btn-success" style={{ fontSize: '12px', padding: '5px 10px' }}>
                          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}Save to Lead
                        </button>
                      </div>
                    </div>
                    {generated.subject_line && (
                      <div className="p-3 rounded-lg text-xs" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)' }}>
                        <span style={{ color: '#fbbf24' }}>Subject: </span>
                        <span className="text-white">{generated.subject_line}</span>
                      </div>
                    )}
                    <MessageBlock label="First Message" value={generated.message} />
                    <MessageBlock label="Follow-up 1 (after 5-7 days)" value={generated.followup_1} />
                    <MessageBlock label="Follow-up 2" value={generated.followup_2} />
                    <MessageBlock label="Objection Reply" value={generated.objection_reply} />
                    <MessageBlock label="Call Opening Line" value={generated.call_opening} />
                    <MessageBlock label="Meeting Agenda" value={generated.meeting_agenda} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function OutreachPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center" style={{ color: 'rgb(100,100,120)' }}>Loading...</div>}>
      <OutreachStudioContent />
    </Suspense>
  )
}
