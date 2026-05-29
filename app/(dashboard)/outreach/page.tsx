'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Sparkles, Copy, Save, Loader2, MessageSquare, RefreshCw, Send, AtSign, Mail, Wand2, SlidersHorizontal } from 'lucide-react'
import { CUSTOMER_CATEGORIES, PRODUCTS_TO_SELL } from '@/lib/types'
import type { Lead } from '@/lib/types'

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
  subject?: string
  text: string
}

const channelIcon: Record<string, typeof Send> = {
  telegram: Send,
  twitter: AtSign,
  linkedin: MessageSquare,
  email: Mail,
}

function OutreachStudioContent() {
  const searchParams = useSearchParams()
  const preselectedLeadId = searchParams.get('lead')
  const supabase = createClient()

  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLeadId, setSelectedLeadId] = useState(preselectedLeadId || '')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  // Agent auto-drafts (the default, zero-config path).
  const [autoDrafts, setAutoDrafts] = useState<AgentDraft[]>([])
  const [autoLoading, setAutoLoading] = useState(false)
  const [savingDraftId, setSavingDraftId] = useState<string | null>(null)

  // Manual "write your own" path.
  const [showCustom, setShowCustom] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generated, setGenerated] = useState<GeneratedMessages | null>(null)

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

  // The agent drafts on its own from the saved research the moment a lead is picked.
  const generateAuto = useCallback(async (leadId: string) => {
    setAutoLoading(true)
    setAutoDrafts([])
    try {
      const res = await fetch('/api/ai/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'auto', lead_id: leadId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const drafts: AgentDraft[] = json.data?.drafts || []
      setAutoDrafts(drafts)
      if (drafts.length === 0) toast.error('No drafts returned — try regenerating')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Draft generation failed'
      toast.error(msg)
    } finally {
      setAutoLoading(false)
    }
  }, [])

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

  // Auto-draft as soon as a lead is selected (once leads are loaded).
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
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setGenerated(json.data)
      toast.success('Messages generated')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      toast.error(msg)
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
    else toast.success(`${draft.label} saved to lead`)
    setSavingDraftId(null)
  }

  const copy = (text?: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    toast.success('Copied!')
  }

  const inputClass = 'input-dark'
  const selStyle = { fontSize: '13px' }

  const MessageBlock = ({ label, value }: { label: string; value?: string }) => (
    value ? (
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between px-4 py-2.5"
          style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-xs font-semibold" style={{ color: 'rgb(160,160,180)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
          <button onClick={() => copy(value)} className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: '11px' }}>
            <Copy size={10} /> Copy
          </button>
        </div>
        <pre className="p-4 text-sm leading-relaxed whitespace-pre-wrap"
          style={{ color: 'rgb(210,210,230)', fontFamily: 'Inter, sans-serif', background: 'rgba(22,22,34,0.5)' }}>
          {value}
        </pre>
      </div>
    ) : null
  )

  const DraftCard = ({ draft }: { draft: AgentDraft }) => {
    const Icon = channelIcon[draft.channel] || MessageSquare
    const full = draft.subject ? `Subject: ${draft.subject}\n\n${draft.text}` : draft.text
    return (
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(167,139,250,0.18)' }}>
        <div className="flex items-center justify-between px-4 py-2.5"
          style={{ background: 'rgba(167,139,250,0.08)', borderBottom: '1px solid rgba(167,139,250,0.12)' }}>
          <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: '#c4b5fd' }}>
            <Icon size={12} />
            {draft.label}
          </span>
          <div className="flex gap-1.5">
            <button onClick={() => copy(full)} className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: '11px' }}>
              <Copy size={10} /> Copy
            </button>
            <button onClick={() => saveDraft(draft)} disabled={savingDraftId === draft.id} className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: '11px' }}>
              {savingDraftId === draft.id ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} Save
            </button>
          </div>
        </div>
        {draft.subject && (
          <div className="px-4 pt-3 text-xs" style={{ color: '#fbbf24' }}>
            <span style={{ opacity: 0.7 }}>Subject: </span>
            <span className="text-white">{draft.subject}</span>
          </div>
        )}
        <pre className="p-4 text-sm leading-relaxed whitespace-pre-wrap"
          style={{ color: 'rgb(214,214,232)', fontFamily: 'Inter, sans-serif', background: 'rgba(22,22,34,0.5)' }}>
          {draft.text}
        </pre>
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Outreach Studio</h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>
              The agent writes ready-to-send drafts from its research — or write your own
            </p>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-6">
        {/* Lead picker */}
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
              <button onClick={() => generateAuto(selectedLeadId)} disabled={autoLoading} className="btn btn-secondary whitespace-nowrap" style={{ fontSize: '12px', padding: '6px 12px' }}>
                <RefreshCw size={12} className={autoLoading ? 'animate-spin' : ''} />Regenerate
              </button>
            )}
          </div>
        </div>

        {/* Agent drafts */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Wand2 size={14} style={{ color: '#a78bfa' }} />
            <h2 className="text-sm font-semibold text-white">Agent Drafts</h2>
            <span className="text-xs" style={{ color: 'rgb(100,100,120)' }}>· 3 human, research-backed variations</span>
          </div>

          {!selectedLeadId ? (
            <div className="flex flex-col items-center justify-center min-h-[280px] rounded-xl"
              style={{ background: 'rgba(22,22,34,0.4)', border: '2px dashed rgba(255,255,255,0.06)' }}>
              <MessageSquare size={40} className="mb-4 opacity-20" style={{ color: '#a78bfa' }} />
              <p className="text-sm font-medium text-white mb-1">Pick a company</p>
              <p className="text-xs text-center max-w-xs" style={{ color: 'rgb(100,100,120)' }}>
                The agent reads everything it researched and drafts a short, medium, and longer message — each with a different hook, written to look hand-made for that lead.
              </p>
            </div>
          ) : autoLoading ? (
            <div className="flex flex-col items-center justify-center min-h-[280px] rounded-xl"
              style={{ background: 'rgba(22,22,34,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Loader2 size={28} className="animate-spin mb-3" style={{ color: '#a78bfa' }} />
              <p className="text-sm font-medium text-white">Researching the lead and drafting…</p>
              <p className="text-xs mt-1" style={{ color: 'rgb(100,100,120)' }}>Writing 3 tailored variations</p>
            </div>
          ) : autoDrafts.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {autoDrafts.map(d => <DraftCard key={d.id} draft={d} />)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[200px] rounded-xl"
              style={{ background: 'rgba(22,22,34,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-sm text-white mb-2">No drafts yet</p>
              <button onClick={() => generateAuto(selectedLeadId)} className="btn btn-primary" style={{ fontSize: '13px' }}>
                <Sparkles size={14} />Draft with AI
              </button>
            </div>
          )}
        </div>

        {/* Manual path toggle */}
        <div className="border-t pt-6" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => setShowCustom(s => !s)}
            className="flex items-center gap-2 text-sm font-medium"
            style={{ color: showCustom ? '#fff' : 'rgb(160,160,180)' }}
          >
            <SlidersHorizontal size={14} />
            {showCustom ? 'Hide custom builder' : 'Want to write your own? Configure it manually'}
          </button>

          {showCustom && (
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
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

              {/* Right: Generated Messages */}
              <div>
                {!generated ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px] rounded-xl"
                    style={{ background: 'rgba(22,22,34,0.4)', border: '2px dashed rgba(255,255,255,0.06)' }}>
                    <MessageSquare size={40} className="mb-4 opacity-20" style={{ color: '#a78bfa' }} />
                    <p className="text-sm font-medium text-white mb-1">Full sequence builder</p>
                    <p className="text-xs text-center max-w-xs" style={{ color: 'rgb(100,100,120)' }}>
                      Configure the options and generate a first message, follow-ups, an objection reply, a call opener, and a meeting agenda.
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
                          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                          Save to Lead
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
