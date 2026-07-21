'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Kanban, Plus, X, ChevronRight, Clock, CheckCircle2,
  MessageSquare, Phone, Mail, Calendar,
  Loader2, ArrowRight, AlertCircle, TrendingUp,
  StickyNote, Bell, Check, Send, AtSign, Globe,
  RefreshCw, ExternalLink, Trophy, XCircle,
  Flame, Target, Link2, FileText, Upload, Sparkles,
  BookOpen, Zap, ShieldCheck, Users, Trash2, Search,
} from 'lucide-react'
import { cn, getScoreBg, truncate } from '@/lib/utils'
import type { Lead, Contact } from '@/lib/types'
import type { LeadStatus } from '@/lib/types'

type ActivityType = 'note' | 'call' | 'email' | 'meeting' | 'follow_up' | 'status_change'

interface Activity {
  id: string
  lead_id: string
  type: ActivityType
  channel?: string | null
  content: string
  scheduled_at?: string | null
  follow_up_at?: string | null
  completed_at?: string | null
  created_at: string
}

interface LeadWithActivity extends Lead {
  activities?: Activity[]
}

const PIPELINE_STAGES: {
  status: LeadStatus; label: string; color: string; bg: string; emoji?: string; terminal?: boolean
}[] = [
  { status: 'new',            label: 'New',         color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  { status: 'contacted',      label: 'Contacted',   color: '#38bdf8', bg: 'rgba(56,189,248,0.1)'  },
  { status: 'replied',        label: 'Replied',     color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
  { status: 'meeting_booked', label: 'Meeting',     color: '#34d399', bg: 'rgba(52,211,153,0.1)'  },
  { status: 'proposal_sent',  label: 'Proposal',    color: '#fb923c', bg: 'rgba(251,146,60,0.1)'  },
  { status: 'negotiating',    label: 'Negotiating', color: '#818cf8', bg: 'rgba(129,140,248,0.1)' },
  { status: 'integration',    label: 'Integrating', color: '#22d3ee', bg: 'rgba(34,211,238,0.1)'  },
  { status: 'won',            label: 'Won',         color: '#4ade80', bg: 'rgba(74,222,128,0.12)', emoji: '🎉', terminal: true },
  { status: 'lost',           label: 'Lost',        color: '#f43f5e', bg: 'rgba(244,63,94,0.1)',   emoji: '✗',  terminal: true },
]

type LIcon = React.ComponentType<{ size?: number; style?: React.CSSProperties }>

const CHANNEL_META: Record<string, { label: string; color: string; icon: LIcon }> = {
  telegram: { label: 'Telegram',  color: '#22d3ee', icon: Send         },
  twitter:  { label: 'Twitter/X', color: '#38bdf8', icon: AtSign       },
  linkedin: { label: 'LinkedIn',  color: '#60a5fa', icon: ExternalLink  },
  email:    { label: 'Email',     color: '#a78bfa', icon: Mail         },
  discord:  { label: 'Discord',   color: '#818cf8', icon: MessageSquare },
  call:     { label: 'Call',      color: '#34d399', icon: Phone        },
  other:    { label: 'Outreach',  color: '#fbbf24', icon: Globe        },
}

const TYPE_META: Record<ActivityType, { label: string; color: string; icon: LIcon }> = {
  note:          { label: 'Note',         color: '#a78bfa',          icon: StickyNote },
  call:          { label: 'Call',         color: '#38bdf8',          icon: Phone      },
  email:         { label: 'Email',        color: '#fbbf24',          icon: Mail       },
  meeting:       { label: 'Meeting',      color: '#34d399',          icon: Calendar   },
  follow_up:     { label: 'Follow-up',    color: '#fb7185',          icon: Bell       },
  status_change: { label: 'Stage change', color: 'rgb(120,127,160)', icon: ArrowRight },
}

function getActivityMeta(a: Activity) {
  if (a.channel && CHANNEL_META[a.channel]) return CHANNEL_META[a.channel]
  return TYPE_META[a.type] || TYPE_META.note
}

function lastTouched(lead: LeadWithActivity): number {
  const acts = lead.activities || []
  const latestActivity = acts.reduce((max, a) => Math.max(max, new Date(a.created_at).getTime()), 0)
  const updated = lead.updated_at ? new Date(lead.updated_at).getTime() : 0
  const created = lead.created_at ? new Date(lead.created_at).getTime() : 0
  return Math.max(latestActivity, updated, created)
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ── Log Activity Modal ──────────────────────────────────────────
function AddActivityModal({ lead, onClose, onSaved, onOutreachLogged }: {
  lead: Lead; onClose: () => void; onSaved: () => void; onOutreachLogged?: () => void
}) {
  const supabase = createClient()
  const [type, setType] = useState<ActivityType>('note')
  const [channel, setChannel] = useState('')
  const [content, setContent] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [saving, setSaving] = useState(false)

  const OUTREACH_TYPES: ActivityType[] = ['email', 'call', 'meeting']
  const isOutreach = OUTREACH_TYPES.includes(type)

  const save = async () => {
    if (!content.trim() && type !== 'follow_up') { toast.error('Add some content'); return }
    if (type === 'follow_up' && !scheduledAt) { toast.error('Pick a follow-up date'); return }
    setSaving(true)
    await supabase.from('lead_activities').insert({
      lead_id: lead.id, type,
      channel: isOutreach && channel ? channel : null,
      content: content.trim() || 'Follow-up scheduled',
      scheduled_at: type === 'follow_up' && scheduledAt ? new Date(scheduledAt).toISOString() : null,
    })
    // Auto-increment contacts_reached when logging outreach
    if (isOutreach && onOutreachLogged) {
      onOutreachLogged()
    }
    setSaving(false)
    toast.success('Activity logged')
    onSaved(); onClose()
  }

  const typeOpts: { v: ActivityType; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { v: 'note',      label: 'Note',      icon: StickyNote },
    { v: 'call',      label: 'Call',      icon: Phone      },
    { v: 'email',     label: 'Outreach',  icon: Mail       },
    { v: 'meeting',   label: 'Meeting',   icon: Calendar   },
    { v: 'follow_up', label: 'Follow-up', icon: Bell       },
  ]
  const channelOpts = ['telegram', 'twitter', 'linkedin', 'email', 'discord', 'call']

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(4,4,10,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="section-card fade-in" style={{ width: '100%', maxWidth: 460, background: 'rgb(var(--bg-surface-2))', boxShadow: '0 40px 80px rgba(0,0,0,0.7)', borderRadius: 18 }}>
        <div className="section-card-header">
          <div>
            <div className="text-[15px] font-bold text-white">Log activity</div>
            <div className="text-[11px] text-muted mt-0.5">{lead.company_name}</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}><X size={15} /></button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="flex gap-1.5 flex-wrap">
            {typeOpts.map(t => {
              const Icon = t.icon
              const meta = t.v === 'email' ? TYPE_META.email : TYPE_META[t.v]
              const active = type === t.v
              return (
                <button key={t.v} onClick={() => setType(t.v)}
                  className="flex items-center gap-1.5 text-[12px] font-semibold"
                  style={{ padding: '6px 12px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s', border: `1px solid ${active ? meta.color + '55' : 'var(--border)'}`, background: active ? meta.color + '18' : 'rgba(255,255,255,0.03)', color: active ? meta.color : 'var(--text-3)' }}>
                  <Icon size={12} />{t.label}
                </button>
              )
            })}
          </div>

          {isOutreach && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Channel</div>
              <div className="flex gap-1.5 flex-wrap">
                {channelOpts.map(ch => {
                  const cm = CHANNEL_META[ch]
                  const CIcon = cm.icon
                  return (
                    <button key={ch} onClick={() => setChannel(ch)}
                      className="flex items-center gap-1.5 text-[11px] font-semibold"
                      style={{ padding: '5px 10px', borderRadius: 7, cursor: 'pointer', transition: 'all 0.15s', border: `1px solid ${channel === ch ? cm.color + '55' : 'var(--border)'}`, background: channel === ch ? cm.color + '18' : 'rgba(255,255,255,0.03)', color: channel === ch ? cm.color : 'var(--text-3)' }}>
                      <CIcon size={11} />{cm.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <textarea autoFocus value={content} onChange={e => setContent(e.target.value)}
            placeholder={type === 'note' ? 'Add your note…' : type === 'call' ? 'What was discussed?' : type === 'email' ? 'What did you send / receive?' : type === 'meeting' ? 'Meeting notes…' : 'What to follow up on?'}
            rows={3} className="input-dark" style={{ resize: 'none', lineHeight: 1.6 }} />

          {type === 'follow_up' && (
            <div>
              <label className="text-[11px] font-semibold text-muted block mb-1.5 uppercase tracking-wide">Follow-up date *</label>
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                className="input-dark" style={{ colorScheme: 'dark' }} />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
            <button onClick={save} disabled={saving} className="btn btn-primary" style={{ flex: 2 }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save activity
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Add Lead Modal (redesigned) ────────────────────────────────
// Stages that unlock the proposal attachment section
const PROPOSAL_STAGES: LeadStatus[] = ['proposal_sent', 'negotiating', 'integration']

type LearnResult = {
  title: string
  insights: string[]
  rules_created: number
  sources_created: number
  summary: string
}

function AddLeadModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()

  // Core fields
  const [name,    setName]    = useState('')
  const [website, setWebsite] = useState('')
  const [status,  setStatus]  = useState<LeadStatus>('new')
  const [note,    setNote]    = useState('')

  // Proposal attachment
  const [proposalTab,  setProposalTab]  = useState<'url' | 'file'>('url')
  const [proposalUrl,  setProposalUrl]  = useState('')
  const [proposalFile, setProposalFile] = useState<File | null>(null)
  const [learnToggle,  setLearnToggle]  = useState(true)

  // Save / learn states
  const [saving,      setSaving]      = useState(false)
  const [learning,    setLearning]    = useState(false)
  const [learnResult, setLearnResult] = useState<LearnResult | null>(null)
  const [savedName,   setSavedName]   = useState('')

  const showProposal = PROPOSAL_STAGES.includes(status)
  const hasProposal  = showProposal && (
    (proposalTab === 'url'  && proposalUrl.trim().startsWith('http')) ||
    (proposalTab === 'file' && proposalFile != null)
  )
  const canSave = !!name.trim() && !saving && !learning

  const save = async () => {
    if (!name.trim()) { toast.error('Company name is required'); return }
    setSaving(true)

    // 1 — Insert the lead
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        company_name: name.trim(),
        website:      website.trim() || null,
        status,
        priority:     'needs_research',
        lead_score:   50,
        updated_at:   new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error || !lead) { toast.error('Failed to add lead'); setSaving(false); return }

    // 2 — Log initial note
    if (note.trim()) {
      await supabase.from('lead_activities').insert({
        lead_id: lead.id, type: 'note', content: note.trim(),
      })
    }

    setSavedName(name.trim())
    toast.success(`${name.trim()} added to CRM`)
    onSaved()
    setSaving(false)

    // 3 — Learn from proposal (non-blocking — keep modal open to show progress)
    if (hasProposal && learnToggle) {
      setLearning(true)
      try {
        let res: Response
        const srcName = `Proposal — ${name.trim()}`

        if (proposalTab === 'file' && proposalFile) {
          const fd = new FormData()
          fd.append('file', proposalFile)
          fd.append('type', 'file')
          fd.append('source_name', srcName)
          res = await fetch('/api/ai/learn', { method: 'POST', body: fd })
        } else {
          res = await fetch('/api/ai/learn', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ type: 'url', content: proposalUrl.trim(), source_name: srcName }),
          })
        }

        const data = await res.json()
        if (res.ok) {
          setLearnResult({
            title:           data.title   || srcName,
            insights:        data.insights || [],
            rules_created:   data.rules_created   || 0,
            sources_created: data.sources_created || 0,
            summary:         data.summary || '',
          })
        } else {
          toast.error(`Proposal read failed: ${data.error || 'Unknown error'}`)
          onClose()
        }
      } catch {
        toast.error('Failed to process proposal')
        onClose()
      } finally {
        setLearning(false)
      }
      return // keep modal open to show learn result
    }

    onClose()
  }

  // ── Post-learn result screen ────────────────────────────────
  if (learnResult) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(4,4,10,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="section-card fade-in" style={{ width: '100%', maxWidth: 460, background: 'rgb(var(--bg-surface-2))', boxShadow: '0 40px 80px rgba(0,0,0,0.7)', borderRadius: 18, overflow: 'hidden' }}>
          {/* Green accent top bar */}
          <div style={{ height: 3, background: 'linear-gradient(90deg, #34d399, #22d3ee)' }} />

          <div style={{ padding: '24px 24px 20px' }}>
            {/* Lead added row */}
            <div className="flex items-center gap-3 mb-5">
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldCheck size={18} style={{ color: '#34d399' }} />
              </div>
              <div>
                <div className="text-[14px] font-bold text-white">{savedName} added to CRM</div>
                <div className="text-[11px] text-muted mt-0.5">Proposal processed · agent intelligence updated</div>
              </div>
            </div>

            {/* Learn result card */}
            <div style={{ borderRadius: 12, border: '1px solid rgba(124,58,237,0.2)', background: 'rgba(124,58,237,0.05)', padding: '16px 18px', marginBottom: 16 }}>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={13} style={{ color: '#a78bfa' }} />
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#a78bfa' }}>Agent learned from proposal</span>
              </div>
              <div className="text-[13px] font-semibold text-white mb-2" style={{ lineHeight: 1.4 }}>{learnResult.title}</div>
              {learnResult.summary && (
                <div className="text-[12px] text-muted mb-3" style={{ lineHeight: 1.6 }}>{learnResult.summary}</div>
              )}

              {/* Stats */}
              <div className="flex gap-3">
                <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.15)', textAlign: 'center' }}>
                  <div className="text-[20px] font-bold tabular-nums" style={{ color: '#a78bfa' }}>{learnResult.insights.length}</div>
                  <div className="text-[10px] text-muted mt-0.5">Insights</div>
                </div>
                <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)', textAlign: 'center' }}>
                  <div className="text-[20px] font-bold tabular-nums" style={{ color: '#34d399' }}>{learnResult.rules_created}</div>
                  <div className="text-[10px] text-muted mt-0.5">New rules</div>
                </div>
                <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)', textAlign: 'center' }}>
                  <div className="text-[20px] font-bold tabular-nums" style={{ color: '#22d3ee' }}>{learnResult.sources_created}</div>
                  <div className="text-[10px] text-muted mt-0.5">New sources</div>
                </div>
              </div>

              {/* Top insights preview */}
              {learnResult.insights.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {learnResult.insights.slice(0, 3).map((ins, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div style={{ width: 4, height: 4, borderRadius: 999, background: '#a78bfa', marginTop: 6, flexShrink: 0 }} />
                      <span className="text-[11px] text-muted" style={{ lineHeight: 1.5 }}>{ins}</span>
                    </div>
                  ))}
                  {learnResult.insights.length > 3 && (
                    <div className="text-[10px] text-muted" style={{ paddingLeft: 10 }}>+{learnResult.insights.length - 3} more insights saved to agent memory</div>
                  )}
                </div>
              )}
            </div>

            <button onClick={onClose} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              <Check size={14} /> Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Learning in progress screen ─────────────────────────────
  if (learning) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(4,4,10,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="section-card fade-in" style={{ width: '100%', maxWidth: 400, background: 'rgb(var(--bg-surface-2))', boxShadow: '0 40px 80px rgba(0,0,0,0.7)', borderRadius: 18, padding: '36px 28px', textAlign: 'center' }}>
          <div className="ai-loading" style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <BookOpen size={22} style={{ color: '#a78bfa' }} />
          </div>
          <div className="text-[15px] font-bold text-white mb-2">Reading proposal…</div>
          <div className="text-[13px] text-muted mb-4" style={{ lineHeight: 1.6 }}>
            Agent is extracting value propositions,<br />use cases &amp; ICP signals to find similar leads
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['Parsing document content', 'Extracting BD intelligence', 'Updating agent rules & sources'].map((step, i) => (
              <div key={i} className="flex items-center gap-2.5" style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.12)' }}>
                <Loader2 size={11} className="animate-spin flex-shrink-0" style={{ color: '#a78bfa' }} />
                <span className="text-[12px] text-muted">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Main form ───────────────────────────────────────────────
  const selectedStage = PIPELINE_STAGES.find(s => s.status === status)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(4,4,10,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="section-card fade-in"
        style={{ width: '100%', maxWidth: 500, background: 'rgb(var(--bg-surface-2))', boxShadow: '0 40px 80px rgba(0,0,0,0.7)', borderRadius: 18, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="section-card-header" style={{ flexShrink: 0 }}>
          <div>
            <div className="text-[15px] font-bold text-white">Add lead manually</div>
            <div className="text-[11px] text-muted mt-0.5">Track a deal you're already working</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}><X size={15} /></button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Company + Website row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted block mb-1.5">Company name *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Binance, LayerZero" autoFocus className="input-dark" style={{ fontSize: 13 }} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted block mb-1.5">Website</label>
              <input value={website} onChange={e => setWebsite(e.target.value)}
                placeholder="https://..." className="input-dark" style={{ fontSize: 13 }} />
            </div>
          </div>

          {/* Pipeline stage — ALL stages */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted block mb-2">Pipeline stage</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PIPELINE_STAGES.filter(s => !s.terminal).map(s => (
                <button key={s.status} onClick={() => setStatus(s.status)}
                  style={{
                    padding: '5px 12px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s', fontSize: 12, fontWeight: 600,
                    border:      `1px solid ${status === s.status ? s.color + '60' : 'var(--border)'}`,
                    background:  status === s.status ? s.color + '18' : 'rgba(255,255,255,0.03)',
                    color:       status === s.status ? s.color : 'var(--text-3)',
                    boxShadow:   status === s.status ? `0 0 12px ${s.color}20` : 'none',
                  }}>
                  {s.status === 'proposal_sent' && <span style={{ marginRight: 4, fontSize: 10 }}>📄</span>}
                  {s.label}
                  {status === s.status && <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: 999, background: s.color, boxShadow: `0 0 4px ${s.color}`, marginLeft: 6, verticalAlign: 'middle' }} />}
                </button>
              ))}
              {/* Terminal stages: won / lost */}
              {PIPELINE_STAGES.filter(s => s.terminal).map(s => (
                <button key={s.status} onClick={() => setStatus(s.status)}
                  style={{
                    padding: '5px 12px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s', fontSize: 12, fontWeight: 600,
                    border:     `1px solid ${status === s.status ? s.color + '60' : 'var(--border)'}`,
                    background: status === s.status ? s.color + '18' : 'rgba(255,255,255,0.02)',
                    color:      status === s.status ? s.color : 'var(--text-3)',
                    opacity:    0.75,
                  }}>
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
            {selectedStage && (
              <div className="text-[10px] text-muted mt-1.5" style={{ paddingLeft: 2 }}>
                Stage: <span style={{ color: selectedStage.color, fontWeight: 600 }}>{selectedStage.label}</span>
                {PROPOSAL_STAGES.includes(status) && <span style={{ color: '#a78bfa' }}> · Proposal attachment available below</span>}
              </div>
            )}
          </div>

          {/* ── Proposal section (only for proposal/negotiating/integration) ── */}
          {showProposal && (
            <div style={{ borderRadius: 12, border: '1px solid rgba(124,58,237,0.28)', background: 'rgba(124,58,237,0.04)', overflow: 'hidden' }}>
              {/* Section header */}
              <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="flex items-center gap-2">
                  <Sparkles size={13} style={{ color: '#a78bfa' }} />
                  <span className="text-[12px] font-bold" style={{ color: '#a78bfa' }}>Proposal document</span>
                </div>
                {/* Learn toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-[11px] text-muted">Let agent learn</span>
                  <div onClick={() => setLearnToggle(p => !p)}
                    style={{
                      width: 32, height: 18, borderRadius: 999, cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                      background: learnToggle ? 'rgba(124,58,237,0.7)' : 'rgba(255,255,255,0.1)',
                      border: `1px solid ${learnToggle ? 'rgba(124,58,237,0.9)' : 'var(--border)'}`,
                      position: 'relative',
                    }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: 999, background: 'white',
                      position: 'absolute', top: 2, transition: 'left 0.2s',
                      left: learnToggle ? 16 : 2,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                    }} />
                  </div>
                </label>
              </div>

              <div style={{ padding: '12px 16px 14px' }}>
                {/* Tab selector */}
                <div className="flex gap-1.5 mb-3">
                  <button onClick={() => setProposalTab('url')}
                    className="flex items-center gap-1.5 text-[11px] font-semibold"
                    style={{ padding: '5px 12px', borderRadius: 7, cursor: 'pointer', transition: 'all 0.15s', border: `1px solid ${proposalTab === 'url' ? 'rgba(124,58,237,0.5)' : 'var(--border)'}`, background: proposalTab === 'url' ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)', color: proposalTab === 'url' ? '#a78bfa' : 'var(--text-3)' }}>
                    <Link2 size={11} /> Doc link
                  </button>
                  <button onClick={() => setProposalTab('file')}
                    className="flex items-center gap-1.5 text-[11px] font-semibold"
                    style={{ padding: '5px 12px', borderRadius: 7, cursor: 'pointer', transition: 'all 0.15s', border: `1px solid ${proposalTab === 'file' ? 'rgba(124,58,237,0.5)' : 'var(--border)'}`, background: proposalTab === 'file' ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)', color: proposalTab === 'file' ? '#a78bfa' : 'var(--text-3)' }}>
                    <Upload size={11} /> Upload file
                  </button>
                </div>

                {proposalTab === 'url' ? (
                  <div>
                    <input
                      value={proposalUrl}
                      onChange={e => setProposalUrl(e.target.value)}
                      placeholder="Google Docs, Notion, Dropbox, any public PDF URL…"
                      className="input-dark"
                      style={{ fontSize: 12 }}
                    />
                    <div className="text-[10px] text-muted mt-1.5">
                      Works with Google Docs, Notion pages, Dropbox, Docsend, direct PDF links
                    </div>
                  </div>
                ) : (
                  <div>
                    <label style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 6, padding: '18px 14px', borderRadius: 10, cursor: 'pointer',
                      border: `1px dashed ${proposalFile ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.12)'}`,
                      background: proposalFile ? 'rgba(124,58,237,0.06)' : 'rgba(255,255,255,0.02)',
                      transition: 'all 0.15s',
                    }}>
                      <input type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }}
                        onChange={e => setProposalFile(e.target.files?.[0] || null)} />
                      {proposalFile ? (
                        <>
                          <FileText size={18} style={{ color: '#a78bfa' }} />
                          <span className="text-[12px] font-semibold" style={{ color: '#a78bfa' }}>{proposalFile.name}</span>
                          <span className="text-[10px] text-muted">{(proposalFile.size / 1024).toFixed(0)} KB · click to change</span>
                        </>
                      ) : (
                        <>
                          <Upload size={18} style={{ color: 'var(--text-3)' }} />
                          <span className="text-[12px] text-muted">Drop PDF, DOCX, or DOC here</span>
                          <span className="text-[10px] text-muted">or click to browse</span>
                        </>
                      )}
                    </label>
                  </div>
                )}

                {/* Learn from proposal info box */}
                {learnToggle && (
                  <div className="flex items-start gap-2 mt-3" style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}>
                    <Zap size={11} style={{ color: '#a78bfa', marginTop: 1, flexShrink: 0 }} />
                    <span className="text-[10px] text-muted" style={{ lineHeight: 1.55 }}>
                      Agent will read the proposal, extract value propositions &amp; use cases, update discovery rules, and surface similar companies automatically.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted block mb-1.5">Note (optional)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="What do you know about this deal so far?"
              rows={2} className="input-dark" style={{ resize: 'none', fontSize: 13 }} />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
            <button onClick={save} disabled={!canSave}
              className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
              {saving
                ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                : hasProposal && learnToggle
                  ? <><Sparkles size={14} /> Add &amp; learn from proposal</>
                  : <><Plus size={14} /> Add to CRM</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Stage Rail ──────────────────────────────────────────────────
function StageRail({ currentStatus, onMove }: { currentStatus: LeadStatus; onMove: (s: LeadStatus) => void }) {
  const currentIdx = PIPELINE_STAGES.findIndex(s => s.status === currentStatus)
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
      <div className="flex gap-1" style={{ minWidth: 'max-content' }}>
        {PIPELINE_STAGES.map((s, idx) => {
          const isActive = s.status === currentStatus
          const isPast = idx < currentIdx && !s.terminal
          return (
            <button key={s.status} onClick={() => onMove(s.status)}
              className="flex items-center gap-1.5 text-[11px] font-bold"
              style={{
                padding: '5px 10px', borderRadius: 7, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                border: `1px solid ${isActive ? s.color + '65' : isPast ? s.color + '22' : 'var(--border)'}`,
                background: isActive ? s.color + '20' : isPast ? s.color + '08' : 'rgba(255,255,255,0.02)',
                color: isActive ? s.color : isPast ? s.color + 'aa' : 'var(--text-3)',
                opacity: isPast ? 0.7 : 1,
              }}>
              {s.emoji && <span style={{ fontSize: 9 }}>{s.emoji}</span>}
              {s.label}
              {isActive && <span style={{ width: 5, height: 5, borderRadius: 999, background: s.color, boxShadow: `0 0 6px ${s.color}` }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Contacts Section ────────────────────────────────────────────
const CONTACT_CHANNELS = [
  { key: 'linkedin',  label: 'LinkedIn',  color: '#60a5fa' },
  { key: 'email',     label: 'Email',     color: '#a78bfa' },
  { key: 'telegram',  label: 'Telegram',  color: '#22d3ee' },
  { key: 'twitter',   label: 'X/Twitter', color: '#38bdf8' },
  { key: 'discord',   label: 'Discord',   color: '#818cf8' },
  { key: 'call',      label: 'Call',      color: '#34d399' },
]

function ContactsSection({ contacts, onUpdated }: { contacts: Contact[]; onUpdated: () => void }) {
  const supabase = createClient()
  const [local, setLocal] = useState<Contact[]>(contacts)

  const toggle = async (contactId: string, channel: string) => {
    const contact = local.find(c => c.id === contactId)
    if (!contact) return
    const existing = contact.contacted_channels || []
    const already  = existing.some(t => t.channel === channel)
    const updated  = already
      ? existing.filter(t => t.channel !== channel)
      : [...existing, { channel, contacted_at: new Date().toISOString() }]
    await supabase.from('contacts').update({ contacted_channels: updated }).eq('id', contactId)
    setLocal(prev => prev.map(c => c.id === contactId ? { ...c, contacted_channels: updated } : c))
    onUpdated()
  }

  const reached = local.filter(c => (c.contacted_channels?.length ?? 0) > 0).length

  if (local.length === 0) {
    return (
      <div style={{ padding: '10px 22px 12px', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted">
          <Users size={11} /> Contacts · None found — run AI research to discover contacts
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 22px', borderBottom: '1px solid var(--border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users size={12} style={{ color: '#38bdf8' }} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Contacts</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 80, height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${local.length > 0 ? Math.round((reached / local.length) * 100) : 0}%`, background: reached === local.length ? '#34d399' : '#38bdf8', borderRadius: 999 }} />
          </div>
          <span className="text-[11px] font-bold tabular-nums" style={{ color: reached === local.length && reached > 0 ? '#34d399' : '#38bdf8' }}>
            {reached}/{local.length}
          </span>
        </div>
      </div>

      {/* Contact rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {local.map(contact => {
          const touches       = contact.contacted_channels || []
          const touchedSet    = new Set(touches.map(t => t.channel))
          const wasContacted  = touches.length > 0
          return (
            <div key={contact.id} style={{
              padding: '9px 11px', borderRadius: 10,
              border: `1px solid ${wasContacted ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.07)'}`,
              background: wasContacted ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.02)',
            }}>
              {/* Name + role */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, background: wasContacted ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${wasContacted ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {wasContacted
                      ? <CheckCircle2 size={11} style={{ color: '#34d399' }} />
                      : <Users size={11} style={{ color: 'rgba(255,255,255,0.25)' }} />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[12px] font-semibold text-white truncate block">{contact.name || 'Unknown'}</span>
                    {contact.role && <span className="text-[10px] text-muted">{contact.role}</span>}
                  </div>
                </div>
                {/* External links */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {contact.linkedin_url && <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', opacity: 0.7 }}><ExternalLink size={10} /></a>}
                  {contact.twitter_url  && <a href={contact.twitter_url}  target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', opacity: 0.7 }}><ExternalLink size={10} /></a>}
                </div>
              </div>

              {/* Channel chips — toggle on/off */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {CONTACT_CHANNELS.map(ch => {
                  const active = touchedSet.has(ch.key)
                  return (
                    <button key={ch.key} onClick={() => toggle(contact.id, ch.key)}
                      title={active ? `Remove ${ch.label}` : `Mark as reached via ${ch.label}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        padding: '3px 7px', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                        border:      `1px solid ${active ? ch.color + '55' : 'rgba(255,255,255,0.08)'}`,
                        background:  active ? ch.color + '1a' : 'rgba(255,255,255,0.03)',
                        color:       active ? ch.color : 'rgba(255,255,255,0.22)',
                        transition:  'all 0.12s',
                      }}>
                      {active && <Check size={8} />}
                      {ch.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Lead Flyout ─────────────────────────────────────────────────
function LeadFlyout({ lead, onClose, onActivityAdded, onStatusChange }: {
  lead: LeadWithActivity
  onClose: () => void
  onActivityAdded: () => void
  onStatusChange: (id: string, status: LeadStatus) => void
}) {
  const supabase = createClient()
  const [activities, setActivities] = useState<Activity[]>(lead.activities || [])
  const [showAddModal, setShowAddModal] = useState(false)
  const [completing, setCompleting] = useState<string | null>(null)

  const loadActivities = useCallback(async () => {
    const { data } = await supabase.from('lead_activities').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false })
    setActivities(data || [])
  }, [lead.id]) // eslint-disable-line

  useEffect(() => { loadActivities() }, [loadActivities])

  const completeFollowUp = async (id: string) => {
    setCompleting(id)
    await supabase.from('lead_activities').update({ completed_at: new Date().toISOString() }).eq('id', id)
    setCompleting(null); loadActivities(); onActivityAdded()
  }

  const pendingFollowUps = activities.filter(a => a.type === 'follow_up' && !a.completed_at)
  const timeline = activities.filter(a => !(a.type === 'follow_up' && !a.completed_at))
  const stage = PIPELINE_STAGES.find(s => s.status === lead.status)
  const isWon = lead.status === 'won'
  const isLost = lead.status === 'lost'

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(4,4,10,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="slide-in" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 201,
        width: 'min(500px,100vw)',
        background: 'rgb(var(--bg-surface-2))',
        borderLeft: '1px solid var(--border-strong)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-40px 0 100px rgba(0,0,0,0.6)',
      }}>

        {/* Won/Lost banner */}
        {(isWon || isLost) && (
          <div className="flex items-center gap-2 text-[12px] font-bold" style={{
            padding: '9px 22px',
            background: isWon ? 'rgba(74,222,128,0.07)' : 'rgba(244,63,94,0.07)',
            borderBottom: `1px solid ${isWon ? 'rgba(74,222,128,0.18)' : 'rgba(244,63,94,0.18)'}`,
            color: isWon ? '#4ade80' : '#f43f5e',
          }}>
            {isWon ? <Trophy size={13} /> : <XCircle size={13} />}
            {isWon ? 'Deal Won 🎉 — Integration live' : 'Deal Lost — Marked closed'}
          </div>
        )}

        {/* Flyout header */}
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div style={{ minWidth: 0 }}>
              <Link href={`/leads/${lead.id}`}
                className="text-[16px] font-bold text-white hover:text-violet-300 transition-colors"
                style={{ textDecoration: 'none' }}>
                {lead.company_name}
              </Link>
              <div className="flex items-center gap-2 flex-wrap mt-1.5">
                {stage && (
                  <span className="badge" style={{ fontSize: 10, color: stage.color, background: stage.bg, borderColor: stage.color + '40' }}>
                    {stage.emoji ? `${stage.emoji} ` : ''}{stage.label}
                  </span>
                )}
                {lead.lead_score != null && (
                  <span className={cn('badge', getScoreBg(lead.lead_score))} style={{ fontSize: 10 }}>{lead.lead_score}</span>
                )}
                {lead.website && (
                  <a href={lead.website} target="_blank" rel="noopener noreferrer"
                    className="text-[11px]" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>
                    {lead.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            </div>
            <button onClick={onClose} className="btn btn-secondary" style={{ padding: '5px 7px', flexShrink: 0 }}><X size={14} /></button>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Move stage</div>
          <StageRail currentStatus={lead.status} onMove={(s) => onStatusChange(lead.id, s)} />
        </div>

        {/* Pending follow-ups */}
        {pendingFollowUps.length > 0 && (
          <div style={{ padding: '12px 22px', borderBottom: '1px solid rgba(251,113,133,0.1)', background: 'rgba(251,65,133,0.03)' }}>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#fb7185' }}>
              <Bell size={10} />Scheduled follow-ups
            </div>
            {pendingFollowUps.map(a => {
              const isOverdue = a.scheduled_at && new Date(a.scheduled_at) < new Date()
              return (
                <div key={a.id} className="flex items-center gap-3 mb-2" style={{
                  padding: '10px 13px', borderRadius: 10,
                  border: `1px solid ${isOverdue ? 'rgba(251,65,133,0.25)' : 'rgba(251,65,133,0.1)'}`,
                  background: isOverdue ? 'rgba(251,65,133,0.08)' : 'rgba(251,65,133,0.04)',
                }}>
                  <AlertCircle size={13} color={isOverdue ? '#fb7185' : '#fbbf24'} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="text-[12px] text-white" style={{ lineHeight: 1.4 }}>{a.content}</div>
                    {a.scheduled_at && (
                      <div className="text-[10px] mt-0.5" style={{ color: isOverdue ? '#fb7185' : '#fbbf24' }}>
                        {isOverdue ? '⚠ Overdue · ' : ''}{formatDate(a.scheduled_at)}
                      </div>
                    )}
                  </div>
                  <button onClick={() => completeFollowUp(a.id)} disabled={completing === a.id}
                    className="btn btn-success flex-shrink-0" style={{ padding: '4px 10px', fontSize: 11 }}>
                    {completing === a.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Done
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Quick actions */}
        <div className="flex gap-2" style={{ padding: '12px 22px', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setShowAddModal(true)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}>
            <Plus size={13} /> Log activity
          </button>
          <Link href={`/outreach?lead=${lead.id}`} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: 12, textDecoration: 'none' }}>
            <MessageSquare size={13} /> Draft message
          </Link>
          <Link href={`/leads/${lead.id}`} className="btn btn-ghost" style={{ padding: '9px 11px', textDecoration: 'none' }}>
            <ChevronRight size={14} />
          </Link>
        </div>

        {/* Contact coverage — live from contacts table */}
        <ContactsSection
          contacts={lead.contacts || []}
          onUpdated={onActivityAdded}
        />

        {/* Activity timeline */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-4">Activity timeline</div>
          {timeline.length === 0 ? (
            <div className="text-center text-muted text-[12px]" style={{ padding: '40px 0', lineHeight: 1.7 }}>
              No activity yet.<br />Log a note, call, or outreach to track progress.
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 13, top: 14, bottom: 0, width: 1, background: 'var(--border)' }} />
              <div className="flex flex-col">
                {timeline.map((a, idx) => {
                  const meta = getActivityMeta(a)
                  const Icon = meta.icon
                  return (
                    <div key={a.id} className="flex gap-3 items-start" style={{ paddingBottom: idx < timeline.length - 1 ? 16 : 0 }}>
                      <div style={{ width: 27, height: 27, borderRadius: 8, border: `1px solid ${meta.color}35`, background: meta.color + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', zIndex: 1 }}>
                        <Icon size={12} style={{ color: meta.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[11px] font-bold" style={{ color: meta.color }}>{meta.label}</span>
                          <span className="text-[10px] text-muted">{relTime(a.created_at)}</span>
                          {a.completed_at && <span className="text-[10px] font-semibold" style={{ color: '#34d399' }}>✓ Done</span>}
                        </div>
                        <div className="text-[13px] text-secondary" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{a.content}</div>
                        {(a.scheduled_at || a.follow_up_at) && (
                          <div className="flex items-center gap-1 text-[10px] text-muted mt-1">
                            <Clock size={9} /> Follow-up: {formatDate((a.scheduled_at || a.follow_up_at)!)}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <AddActivityModal
          lead={lead}
          onClose={() => setShowAddModal(false)}
          onSaved={() => { loadActivities(); onActivityAdded() }}
        />
      )}
    </>
  )
}

// ── Pipeline Card (improved) ────────────────────────────────────
function PipelineCard({ lead, stage, onClick, onDelete, onDragStart, onDragEnd, onDragOverCard, isDragging, isDropTarget }: {
  lead: LeadWithActivity
  stage: typeof PIPELINE_STAGES[number]
  onClick: () => void
  onDelete: (id: string) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDragOverCard: (id: string) => void
  isDragging: boolean
  isDropTarget: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirmDelete) {
      // Second click — confirmed
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
      onDelete(lead.id)
    } else {
      // First click — arm
      setConfirmDelete(true)
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  const lastActivity = (lead.activities || []).find(a => a.type !== 'status_change')
  const pendingFollowUp = (lead.activities || []).find(a => a.type === 'follow_up' && !a.completed_at)
  const isOverdue = pendingFollowUp?.scheduled_at && new Date(pendingFollowUp.scheduled_at) < new Date()
  const isWon  = stage.status === 'won'
  const isLost = stage.status === 'lost'

  return (
    <div onClick={onClick}
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', lead.id); onDragStart(lead.id) }}
      onDragEnd={onDragEnd}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOverCard(lead.id) }}
      style={{
        background: isWon
          ? 'linear-gradient(145deg, rgba(74,222,128,0.07), rgba(34,211,238,0.03))'
          : isLost ? 'rgba(244,63,94,0.04)' : 'rgb(var(--bg-surface-2))',
        border: isDropTarget
          ? '1px dashed rgba(167,139,250,0.7)'
          : isWon
          ? '1px solid rgba(74,222,128,0.22)'
          : isLost ? '1px solid rgba(244,63,94,0.14)'
          : confirmDelete ? '1px solid rgba(244,63,94,0.55)'
          : '1px solid var(--border)',
        borderRadius: 14,
        cursor: 'grab',
        opacity: isDragging ? 0.35 : isLost ? 0.6 : 1,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: isDropTarget ? '0 0 0 2px rgba(167,139,250,0.25)' : '0 2px 10px rgba(0,0,0,0.28)',
        transition: 'box-shadow 0.15s, border-color 0.15s, transform 0.1s, opacity 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      {/* Stage accent stripe */}
      <div style={{
        height: 3,
        background: isWon
          ? 'linear-gradient(90deg, #4ade80, #22d3ee)'
          : `linear-gradient(90deg, ${stage.color}, ${stage.color}44)`,
      }} />

      {/* Delete button — top-right corner */}
      <button
        onClick={handleDeleteClick}
        title={confirmDelete ? 'Click again to confirm' : 'Remove from pipeline'}
        style={{
          position: 'absolute', top: 10, right: 10, zIndex: 2,
          display: 'flex', alignItems: 'center', gap: 4,
          padding: confirmDelete ? '4px 8px' : '4px 6px',
          borderRadius: 7, border: 'none', cursor: 'pointer',
          fontSize: 10, fontWeight: 700,
          background: confirmDelete ? 'rgba(244,63,94,0.2)' : 'rgba(255,255,255,0.06)',
          color: confirmDelete ? '#f43f5e' : 'rgba(255,255,255,0.22)',
          transition: 'all 0.15s',
        }}>
        <Trash2 size={10} />
        {confirmDelete && 'Confirm?'}
      </button>

      <div style={{ padding: '14px 16px' }}>

        {/* Company name + optional website */}
        <div style={{ marginBottom: 10, paddingRight: confirmDelete ? 80 : 32 }}>
          <div style={{
            fontSize: 14.5, fontWeight: 700, lineHeight: 1.25,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            textDecoration: isLost ? 'line-through' : 'none',
            color: isLost ? 'rgba(255,255,255,0.35)' : 'white',
          }}>
            {lead.company_name}
          </div>
          {lead.website && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lead.website.replace(/^https?:\/\//, '')}
            </div>
          )}
        </div>

        {/* Score + category row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {!isWon && !isLost && lead.lead_score != null && (
            <span className={cn(getScoreBg(lead.lead_score))} style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 20, flexShrink: 0 }}>
              {lead.lead_score}
            </span>
          )}
          {isWon  && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#4ade80' }}><Trophy size={11} /> Won</span>}
          {isLost && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#f43f5e', opacity: 0.6 }}><XCircle size={11} /> Lost</span>}
          {(lead.customer_category || []).length > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
              color: stage.color, background: stage.bg, border: `1px solid ${stage.color}38`,
              flexShrink: 0,
            }}>
              {(lead.customer_category as string[])[0].replace(' Customer', '')}
            </span>
          )}
        </div>

        {/* Pain point */}
        {lead.pain_point && (
          <div style={{
            fontSize: 12, color: 'rgba(200,205,225,0.58)', lineHeight: 1.6,
            marginBottom: 12,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {lead.pain_point}
          </div>
        )}

        {/* Contact coverage bar */}
        {(lead.contacts || []).length > 0 && (() => {
          const total    = (lead.contacts || []).length
          const reached  = (lead.contacts || []).filter(c => (c.contacted_channels?.length ?? 0) > 0).length
          const pct      = Math.min(100, Math.round((reached / total) * 100))
          const barColor = reached >= total ? '#34d399' : '#38bdf8'
          const channelCounts: Record<string, number> = {}
          ;(lead.contacts || []).forEach(c =>
            (c.contacted_channels || []).forEach(t => { channelCounts[t.channel] = (channelCounts[t.channel] || 0) + 1 })
          )
          const channelLabel = Object.entries(channelCounts).map(([ch, n]) => `${ch} ×${n}`).join(' · ')
          return (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Users size={10} style={{ color: barColor, flexShrink: 0 }} />
                <div style={{ flex: 1, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 999, transition: 'width 0.35s ease' }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: barColor, minWidth: 24, textAlign: 'right', flexShrink: 0 }}>
                  {reached}/{total}
                </span>
              </div>
              {channelLabel && (
                <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.22)', paddingLeft: 17, marginTop: 3 }}>
                  {channelLabel}
                </div>
              )}
            </div>
          )
        })()}

        {/* Footer divider + row */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 10 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          {lastActivity ? (() => {
            const meta = getActivityMeta(lastActivity)
            const Icon = meta.icon
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 22, height: 22, borderRadius: 7, background: meta.color + '1a', border: `1px solid ${meta.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={11} style={{ color: meta.color }} />
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)' }}>{relTime(lastActivity.created_at)}</span>
              </div>
            )
          })() : (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', fontStyle: 'italic' }}>No activity yet</span>
          )}

          {pendingFollowUp && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 10, fontWeight: 700,
              color: isOverdue ? '#fb7185' : '#fbbf24',
              background: isOverdue ? 'rgba(251,65,133,0.1)' : 'rgba(251,191,36,0.1)',
              border: `1px solid ${isOverdue ? 'rgba(251,65,133,0.3)' : 'rgba(251,191,36,0.3)'}`,
              padding: '3px 8px', borderRadius: 7,
            }}>
              <Bell size={9} />{isOverdue ? 'Overdue' : 'Follow-up'}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Main CRM page ───────────────────────────────────────────────
export default function CRMPage() {
  const supabase = createClient()
  const [leads, setLeads] = useState<LeadWithActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<LeadWithActivity | null>(null)
  const [view, setView] = useState<'pipeline' | 'followups' | 'wins'>('pipeline')
  const [showAddLead, setShowAddLead] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Drag-and-drop ordering — `order` holds lead ids in display order (newest-touched first
  // by default); dragging splices ids around so the user's manual arrangement sticks across reloads.
  const [order, setOrder] = useState<string[]>([])
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  useEffect(() => {
    setOrder(prev => {
      const stillExists = prev.filter(id => leads.some(l => l.id === id))
      const known = new Set(stillExists)
      const fresh = leads
        .filter(l => !known.has(l.id))
        .sort((a, b) => lastTouched(b) - lastTouched(a))
        .map(l => l.id)
      return [...fresh, ...stillExists]
    })
  }, [leads])

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: leadsData }, { data: activitiesData }, { data: contactsData }] = await Promise.all([
      supabase.from('leads').select('*')
        .not('status', 'in', '("rejected","archived","reserved")')
        .order('lead_score', { ascending: false, nullsFirst: false }),
      supabase.from('lead_activities').select('*').order('created_at', { ascending: false }),
      supabase.from('contacts').select('id, lead_id, name, role, contact_confidence, email, linkedin_url, twitter_url, telegram, contacted_channels, created_at').order('created_at'),
    ])
    const actsByLead: Record<string, Activity[]> = {}
    ;(activitiesData || []).forEach((a: Activity) => {
      if (!actsByLead[a.lead_id]) actsByLead[a.lead_id] = []
      actsByLead[a.lead_id].push(a)
    })
    const contactsByLead: Record<string, Contact[]> = {}
    ;(contactsData || []).forEach((c: Contact) => {
      if (!contactsByLead[c.lead_id]) contactsByLead[c.lead_id] = []
      contactsByLead[c.lead_id].push(c)
    })
    setLeads((leadsData || []).map((l: Lead) => ({
      ...l,
      activities: actsByLead[l.id] || [],
      contacts: contactsByLead[l.id] || [],
    })))
    setLoading(false)
  }, []) // eslint-disable-line

  useEffect(() => { loadData() }, [loadData])

  const deleteLead = async (id: string) => {
    const lead = leads.find(l => l.id === id)
    await supabase.from('leads').delete().eq('id', id)
    setLeads(prev => prev.filter(l => l.id !== id))
    if (selectedLead?.id === id) setSelectedLead(null)
    toast(`${lead?.company_name ?? 'Lead'} removed from pipeline`)
  }

  const moveStage = async (id: string, status: LeadStatus) => {
    await supabase.from('leads').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    await supabase.from('lead_activities').insert({
      lead_id: id, type: 'status_change',
      content: `Moved to ${PIPELINE_STAGES.find(s => s.status === status)?.label || status}`,
    })
    toast.success('Stage updated')
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    if (selectedLead?.id === id) setSelectedLead(prev => prev ? { ...prev, status } : prev)
    loadData()
  }

  const reorder = (draggedLeadId: string, targetStatus: LeadStatus, beforeId: string | null) => {
    setOrder(prev => {
      const next = prev.filter(id => id !== draggedLeadId)
      const insertAt = beforeId ? next.indexOf(beforeId) : -1
      if (insertAt === -1) {
        // dropped on empty column area — place after the last card of that stage
        let lastIdx = -1
        next.forEach((id, i) => { if (leads.find(l => l.id === id)?.status === targetStatus) lastIdx = i })
        next.splice(lastIdx + 1, 0, draggedLeadId)
      } else {
        next.splice(insertAt, 0, draggedLeadId)
      }
      return next
    })
  }

  const handleDrop = (targetStatus: LeadStatus, beforeId: string | null) => {
    if (!draggedId) return
    const dragged = leads.find(l => l.id === draggedId)
    reorder(draggedId, targetStatus, beforeId)
    if (dragged && dragged.status !== targetStatus) moveStage(draggedId, targetStatus)
    setDraggedId(null)
    setDropTargetId(null)
  }

  const filteredLeads = searchQuery.trim()
    ? leads.filter(l => l.company_name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : leads

  const allFollowUps = filteredLeads.flatMap(l =>
    (l.activities || [])
      .filter(a => a.type === 'follow_up' && !a.completed_at)
      .map(a => ({ ...a, lead: l }))
  ).sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())

  const overdue  = allFollowUps.filter(a => a.scheduled_at && new Date(a.scheduled_at) < new Date())
  const upcoming = allFollowUps.filter(a => a.scheduled_at && new Date(a.scheduled_at) >= new Date())

  const completeFollowUp = async (id: string) => {
    await supabase.from('lead_activities').update({ completed_at: new Date().toISOString() }).eq('id', id)
    toast.success('Follow-up marked done'); loadData()
  }

  const stageCounts = PIPELINE_STAGES.map(s => ({ ...s, count: filteredLeads.filter(l => l.status === s.status).length }))
  const totalActive  = filteredLeads.filter(l => !['won', 'lost'].includes(l.status)).length
  const wonCount     = filteredLeads.filter(l => l.status === 'won').length
  const lostCount    = filteredLeads.filter(l => l.status === 'lost').length
  const totalClosed  = wonCount + lostCount
  const winRate      = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : 0

  // Pipeline stages for the board (exclude terminal stages from main flow display)
  const activeStages   = PIPELINE_STAGES.filter(s => !s.terminal)
  const terminalStages = PIPELINE_STAGES.filter(s => s.terminal)

  return (
    <div className="fade-in">

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2">
              <Kanban size={18} style={{ color: '#a78bfa' }} />
              CRM Pipeline
            </h1>
            <p className="text-[12px] mt-1 font-medium text-muted">
              {totalActive} active · {wonCount} won · {lostCount} lost
              {overdue.length > 0
                ? <> · <span style={{ color: '#fb7185', fontWeight: 700 }}>{overdue.length} overdue</span></>
                : ' · All follow-ups on track'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Search bar */}
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search leads…"
                className="input-dark"
                style={{ paddingLeft: 30, paddingRight: searchQuery ? 28 : 10, fontSize: 12, height: 34, width: 200 }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center', padding: 0 }}>
                  <X size={12} />
                </button>
              )}
            </div>
            <button onClick={loadData} className="btn btn-secondary" style={{ padding: '7px 10px' }}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setShowAddLead(true)} className="btn btn-primary" style={{ fontSize: 12, padding: '7px 14px' }}>
              <Plus size={13} /> Add lead
            </button>
          </div>
        </div>

        {/* Tab bar — sits inside the sticky header */}
        <div className="flex items-center gap-1.5 mt-4">
          {[
            { v: 'pipeline'  as const, label: 'Pipeline',     icon: <Kanban size={13} />,       color: '#a78bfa', border: 'rgba(167,139,250,0.35)', badge: null },
            { v: 'followups' as const, label: 'Follow-ups',   icon: <Bell size={13} />,          color: '#fb7185', border: 'rgba(251,113,133,0.35)', badge: overdue.length > 0 ? overdue.length : null },
            { v: 'wins'      as const, label: 'Integrations', icon: <Trophy size={13} />,        color: '#4ade80', border: 'rgba(74,222,128,0.35)',  badge: wonCount > 0 ? wonCount : null },
          ].map(tab => (
            <button key={tab.v} onClick={() => setView(tab.v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '6px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s', position: 'relative',
                border: view === tab.v ? `1px solid ${tab.border}` : '1px solid transparent',
                background: view === tab.v ? tab.color + '15' : 'transparent',
                color: view === tab.v ? tab.color : 'var(--text-3)',
              }}>
              {tab.icon}{tab.label}
              {tab.badge != null && (
                <span style={{
                  position: 'absolute', top: -5, right: -5,
                  minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999,
                  background: tab.color, color: tab.v === 'wins' ? '#052e16' : 'white',
                  fontSize: 9, fontWeight: 800,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 36px' }}>

        {/* ── KPI strip ──────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {/* Total active */}
          <div className="stat-card" style={{ borderColor: 'rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.04)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Pipeline</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target size={13} style={{ color: '#a78bfa' }} />
              </div>
            </div>
            <div className="text-[30px] font-bold tabular-nums leading-none mb-1" style={{ color: '#a78bfa' }}>{totalActive}</div>
            <div className="text-[11px] text-muted">active deals</div>
          </div>

          {/* Won / Win rate */}
          <div className="stat-card" style={{ borderColor: 'rgba(74,222,128,0.2)', background: 'rgba(74,222,128,0.03)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Won</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trophy size={13} style={{ color: '#4ade80' }} />
              </div>
            </div>
            <div className="text-[30px] font-bold tabular-nums leading-none mb-1" style={{ color: '#4ade80' }}>{wonCount}</div>
            <div className="text-[11px] text-muted">{winRate}% win rate</div>
          </div>

          {/* Follow-ups */}
          <div className="stat-card" style={{
            borderColor: overdue.length > 0 ? 'rgba(251,113,133,0.25)' : 'rgba(251,191,36,0.15)',
            background:  overdue.length > 0 ? 'rgba(251,113,133,0.04)' : 'rgba(251,191,36,0.03)',
          }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Follow-ups</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: overdue.length > 0 ? 'rgba(251,113,133,0.1)' : 'rgba(251,191,36,0.1)', border: `1px solid ${overdue.length > 0 ? 'rgba(251,113,133,0.25)' : 'rgba(251,191,36,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bell size={13} style={{ color: overdue.length > 0 ? '#fb7185' : '#fbbf24' }} />
              </div>
            </div>
            <div className="text-[30px] font-bold tabular-nums leading-none mb-1" style={{ color: overdue.length > 0 ? '#fb7185' : '#fbbf24' }}>
              {overdue.length > 0 ? overdue.length : upcoming.length}
            </div>
            <div className="text-[11px] text-muted">{overdue.length > 0 ? 'overdue' : `upcoming`}</div>
          </div>

          {/* Velocity — deals in progress stages */}
          <div className="stat-card" style={{ borderColor: 'rgba(34,211,238,0.18)', background: 'rgba(34,211,238,0.03)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted">In Progress</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Flame size={13} style={{ color: '#22d3ee' }} />
              </div>
            </div>
            <div className="text-[30px] font-bold tabular-nums leading-none mb-1" style={{ color: '#22d3ee' }}>
              {stageCounts.filter(x => ['proposal_sent','negotiating','integration'].includes(x.status)).reduce((a,b) => a + b.count, 0)}
            </div>
            <div className="text-[11px] text-muted">proposal → close</div>
          </div>
        </div>

        {/* ── Pipeline bar (mini funnel visual) ──────────────── */}
        {view === 'pipeline' && totalActive > 0 && (
          <div className="section-card mb-6" style={{ padding: '14px 20px' }}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={12} style={{ color: 'var(--text-3)' }} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Pipeline distribution</span>
            </div>
            <div className="flex gap-1 h-2 rounded-full overflow-hidden mb-3">
              {PIPELINE_STAGES.filter(s => !s.terminal).map(s => {
                const count = stageCounts.find(x => x.status === s.status)?.count || 0
                const pct = totalActive > 0 ? (count / totalActive) * 100 : 0
                if (pct === 0) return null
                return (
                  <div key={s.status} style={{ width: `${pct}%`, background: s.color, minWidth: pct > 0 ? 4 : 0, transition: 'width 0.5s ease' }}
                    title={`${s.label}: ${count}`} />
                )
              })}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {PIPELINE_STAGES.filter(s => !s.terminal).map(s => {
                const count = stageCounts.find(x => x.status === s.status)?.count || 0
                if (count === 0) return null
                return (
                  <div key={s.status} className="flex items-center gap-1.5">
                    <div style={{ width: 7, height: 7, borderRadius: 999, background: s.color }} />
                    <span className="text-[11px] text-muted">{s.label}</span>
                    <span className="text-[11px] font-bold" style={{ color: s.color }}>{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Content ────────────────────────────────────────── */}
        {loading ? (
          <div className="section-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Loader2 size={28} className="animate-spin mx-auto mb-3" style={{ color: '#a78bfa', display: 'block' }} />
            <div className="text-[13px] text-muted">Loading pipeline…</div>
          </div>

        ) : view === 'pipeline' ? (
          /* ── Kanban board ─────────────────────────────────── */
          <div style={{ overflowX: 'auto', paddingBottom: 24 }}>
            <div className="flex gap-4" style={{ minWidth: 'max-content', alignItems: 'start' }}>

              {/* Active stages */}
              {activeStages.map(stage => {
                const stageLeads = order
                  .map(id => filteredLeads.find(l => l.id === id))
                  .filter((l): l is LeadWithActivity => !!l && l.status === stage.status)
                return (
                  <div key={stage.status} style={{ width: 296, flexShrink: 0 }}>
                    {/* Column header */}
                    <div style={{
                      background: `linear-gradient(135deg, ${stage.color}10, rgba(255,255,255,0.01))`,
                      border: '1px solid var(--border)',
                      borderTop: `3px solid ${stage.color}`,
                      borderRadius: '12px 12px 0 0',
                      padding: '12px 16px 11px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 7, height: 7, borderRadius: 999, background: stage.color, boxShadow: `0 0 6px ${stage.color}` }} />
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: stage.color, letterSpacing: '0.01em' }}>
                            {stage.label}
                          </span>
                        </div>
                        <span style={{
                          minWidth: 22, height: 22, padding: '0 7px', borderRadius: 8,
                          background: stage.bg, border: `1px solid ${stage.color}35`,
                          color: stage.color, fontSize: 12, fontWeight: 800,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {stageLeads.length}
                        </span>
                      </div>
                    </div>

                    {/* Cards */}
                    <div
                      onDragOver={e => { e.preventDefault(); if (e.target === e.currentTarget) setDropTargetId(null) }}
                      onDrop={e => { e.preventDefault(); handleDrop(stage.status, dropTargetId) }}
                      style={{
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid var(--border)',
                        borderTop: 'none',
                        borderRadius: '0 0 12px 12px',
                        padding: 10,
                        minHeight: 140,
                        display: 'flex', flexDirection: 'column', gap: 8,
                      }}>
                      {stageLeads.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '36px 8px', opacity: 0.35 }}>
                          <div style={{ fontSize: 24, marginBottom: 6 }}>—</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Empty</div>
                        </div>
                      ) : stageLeads.map(lead => (
                        <PipelineCard key={lead.id} lead={lead} stage={stage} onClick={() => setSelectedLead(lead)} onDelete={deleteLead}
                          isDragging={draggedId === lead.id}
                          isDropTarget={dropTargetId === lead.id && draggedId !== lead.id}
                          onDragStart={id => setDraggedId(id)}
                          onDragEnd={() => { setDraggedId(null); setDropTargetId(null) }}
                          onDragOverCard={id => setDropTargetId(id)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Terminal stages (Won / Lost) — side by side, visually separated */}
              <div style={{ width: 2, flexShrink: 0, background: 'rgba(255,255,255,0.06)', borderRadius: 2, alignSelf: 'stretch', margin: '0 4px' }} />
              {terminalStages.map(stage => {
                const stageLeads = order
                  .map(id => filteredLeads.find(l => l.id === id))
                  .filter((l): l is LeadWithActivity => !!l && l.status === stage.status)
                return (
                  <div key={stage.status} style={{ width: 248, flexShrink: 0 }}>
                    <div style={{
                      background: stage.status === 'won' ? 'rgba(74,222,128,0.05)' : 'rgba(244,63,94,0.03)',
                      border: `1px solid ${stage.status === 'won' ? 'rgba(74,222,128,0.2)' : 'rgba(244,63,94,0.12)'}`,
                      borderTop: `2px solid ${stage.color}`,
                      borderRadius: '10px 10px 0 0',
                      padding: '10px 14px 9px',
                    }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-bold" style={{ color: stage.color }}>
                          {stage.emoji} {stage.label}
                        </span>
                        <span style={{
                          minWidth: 20, height: 20, padding: '0 6px', borderRadius: 6,
                          background: stage.bg, border: `1px solid ${stage.color}30`,
                          color: stage.color, fontSize: 11, fontWeight: 700,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {stageLeads.length}
                        </span>
                      </div>
                    </div>
                    <div
                      onDragOver={e => { e.preventDefault(); if (e.target === e.currentTarget) setDropTargetId(null) }}
                      onDrop={e => { e.preventDefault(); handleDrop(stage.status, dropTargetId) }}
                      style={{
                        background: stage.status === 'won' ? 'rgba(74,222,128,0.02)' : 'rgba(244,63,94,0.015)',
                        border: `1px solid ${stage.status === 'won' ? 'rgba(74,222,128,0.12)' : 'rgba(244,63,94,0.08)'}`,
                        borderTop: 'none',
                        borderRadius: '0 0 10px 10px',
                        padding: 8, minHeight: 80,
                        display: 'flex', flexDirection: 'column', gap: 6,
                      }}>
                      {stageLeads.length === 0 ? (
                        <div className="text-center text-[11px] text-muted" style={{ padding: '20px 8px', opacity: 0.4 }}>Empty</div>
                      ) : stageLeads.map(lead => (
                        <PipelineCard key={lead.id} lead={lead} stage={stage} onClick={() => setSelectedLead(lead)} onDelete={deleteLead}
                          isDragging={draggedId === lead.id}
                          isDropTarget={dropTargetId === lead.id && draggedId !== lead.id}
                          onDragStart={id => setDraggedId(id)}
                          onDragEnd={() => { setDraggedId(null); setDropTargetId(null) }}
                          onDragOverCard={id => setDropTargetId(id)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        ) : view === 'followups' ? (
          /* ── Follow-ups view ──────────────────────────────── */
          <div style={{ maxWidth: 700 }}>
            {allFollowUps.length === 0 ? (
              <div className="section-card text-center" style={{ padding: '60px 20px' }}>
                <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <CheckCircle2 size={24} style={{ color: '#34d399' }} />
                </div>
                <div className="text-[15px] font-semibold text-white mb-2">All caught up!</div>
                <div className="text-[13px] text-muted">No pending follow-ups. Keep reaching out to create more.</div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {overdue.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: '#fb7185' }}>
                      <AlertCircle size={12} /> Overdue · {overdue.length}
                    </div>
                    {overdue.map(a => (
                      <div key={a.id} className="section-card"
                        style={{ padding: '16px 20px', borderColor: 'rgba(251,65,133,0.22)', background: 'rgba(251,65,133,0.04)' }}>
                        <div className="flex items-center gap-4">
                          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Bell size={15} style={{ color: '#fb7185' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <button onClick={() => setSelectedLead(a.lead)} className="text-[13px] font-bold text-white hover:text-violet-300 transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                {a.lead.company_name}
                              </button>
                              <span className="badge" style={{ fontSize: 10, color: '#fb7185', background: 'rgba(251,113,133,0.1)', borderColor: 'rgba(251,113,133,0.25)' }}>
                                Overdue · {formatDate(a.scheduled_at!)}
                              </span>
                            </div>
                            <div className="text-[12px] text-muted">{truncate(a.content, 90)}</div>
                          </div>
                          <button onClick={() => completeFollowUp(a.id)} className="btn btn-success flex-shrink-0" style={{ fontSize: 12 }}>
                            <CheckCircle2 size={13} /> Done
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {upcoming.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: '#fbbf24', marginTop: overdue.length > 0 ? 8 : 0 }}>
                      <Clock size={12} /> Upcoming · {upcoming.length}
                    </div>
                    {upcoming.map(a => (
                      <div key={a.id} className="section-card"
                        style={{ padding: '16px 20px', borderColor: 'rgba(251,191,36,0.15)', background: 'rgba(251,191,36,0.02)' }}>
                        <div className="flex items-center gap-4">
                          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Clock size={15} style={{ color: '#fbbf24' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <button onClick={() => setSelectedLead(a.lead)} className="text-[13px] font-bold text-white hover:text-violet-300 transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                {a.lead.company_name}
                              </button>
                              <span className="text-[11px] font-semibold" style={{ color: '#fbbf24' }}>{formatDate(a.scheduled_at!)}</span>
                            </div>
                            <div className="text-[12px] text-muted">{truncate(a.content, 90)}</div>
                          </div>
                          <button onClick={() => completeFollowUp(a.id)} className="btn btn-success flex-shrink-0" style={{ fontSize: 12 }}>
                            <CheckCircle2 size={13} /> Done
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

        ) : (
          /* ── Integrations trophy wall ──────────────────────── */
          <div>
            {/* Hero banner */}
            <div className="section-card flex items-center gap-6 mb-6"
              style={{ padding: '24px 28px', borderColor: 'rgba(74,222,128,0.18)', background: 'linear-gradient(135deg, rgba(74,222,128,0.05), rgba(34,211,238,0.02))' }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, flexShrink: 0, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 28px rgba(74,222,128,0.1)' }}>
                <Trophy size={24} style={{ color: '#4ade80' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="text-[17px] font-bold text-white mb-1" style={{ letterSpacing: '-0.01em' }}>Successfully Integrated Partners</div>
                <div className="text-[13px] text-muted" style={{ lineHeight: 1.6, maxWidth: 500 }}>
                  Every partner here is live on Kima. Volume tracking coming soon — take a moment to appreciate what you&apos;ve built. 💚
                </div>
              </div>
              <div className="text-center flex-shrink-0 section-card" style={{ padding: '14px 24px', borderColor: 'rgba(74,222,128,0.2)', background: 'rgba(74,222,128,0.06)' }}>
                <div className="text-[36px] font-black tabular-nums leading-none" style={{ color: '#4ade80' }}>{wonCount}</div>
                <div className="text-[11px] font-semibold text-muted mt-1">Live integrations</div>
              </div>
            </div>

            {wonCount === 0 ? (
              <div className="section-card text-center" style={{ padding: '80px 20px', borderColor: 'rgba(74,222,128,0.1)', borderStyle: 'dashed' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
                <div className="text-[16px] font-bold text-white mb-2">Your first win is coming</div>
                <div className="text-[13px] text-muted" style={{ lineHeight: 1.7, maxWidth: 360, margin: '0 auto' }}>
                  Once a deal closes and the integration goes live, it&apos;ll appear here as a permanent record of your work.
                </div>
                <button onClick={() => setView('pipeline')} className="btn btn-success" style={{ marginTop: 24 }}>
                  Go close a deal →
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
                {order
                  .map(id => filteredLeads.find(l => l.id === id))
                  .filter((l): l is LeadWithActivity => !!l && l.status === 'won')
                  .map((lead, idx) => (
                  <div key={lead.id} onClick={() => setSelectedLead(lead)} className="section-card card-hover"
                    style={{ padding: '20px 22px', cursor: 'pointer', borderColor: 'rgba(74,222,128,0.18)', background: 'linear-gradient(135deg, rgba(74,222,128,0.04), rgba(34,211,238,0.02))', position: 'relative', overflow: 'hidden' }}>
                    {/* Top accent */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #4ade80, #22d3ee)' }} />
                    {/* Watermark */}
                    <div style={{ position: 'absolute', top: 10, right: 14, fontSize: 48, fontWeight: 900, color: 'rgba(74,222,128,0.04)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>#{idx + 1}</div>

                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="text-[15px] font-bold text-white mb-0.5" style={{ letterSpacing: '-0.01em' }}>{lead.company_name}</div>
                        {lead.website && (
                          <a href={lead.website} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-[11px]" style={{ color: 'rgba(74,222,128,0.5)', textDecoration: 'none' }}>
                            {lead.website.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                      </div>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Trophy size={15} style={{ color: '#4ade80' }} />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {lead.industry_category && (
                        <span className="badge" style={{ fontSize: 10, color: '#22d3ee', background: 'rgba(34,211,238,0.08)', borderColor: 'rgba(34,211,238,0.2)' }}>{lead.industry_category}</span>
                      )}
                      {lead.product_to_sell && (
                        <span className="badge" style={{ fontSize: 10, color: '#818cf8', background: 'rgba(129,140,248,0.08)', borderColor: 'rgba(129,140,248,0.2)' }}>{lead.product_to_sell}</span>
                      )}
                    </div>

                    {lead.suggested_use_case && (
                      <div className="text-[12px] text-secondary mb-3" style={{ lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {lead.suggested_use_case}
                      </div>
                    )}

                    <div className="flex items-center justify-between" style={{ padding: '10px 12px', background: 'rgb(var(--bg-base))', border: '1px solid var(--border)', borderRadius: 9 }}>
                      <div className="flex items-center gap-1.5">
                        <TrendingUp size={12} style={{ color: 'rgba(74,222,128,0.4)' }} />
                        <span className="text-[11px] font-semibold text-muted">Volume</span>
                      </div>
                      <span className="text-[11px] font-bold" style={{ color: 'rgba(74,222,128,0.4)', background: 'rgba(74,222,128,0.06)', border: '1px dashed rgba(74,222,128,0.2)', padding: '2px 8px', borderRadius: 6 }}>
                        Coming soon
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-muted mt-2.5">
                      <CheckCircle2 size={9} style={{ color: 'rgba(74,222,128,0.4)' }} />
                      Integration live · {new Date(lead.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedLead && (
        <LeadFlyout
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onActivityAdded={loadData}
          onStatusChange={moveStage}
        />
      )}
      {showAddLead && (
        <AddLeadModal onClose={() => setShowAddLead(false)} onSaved={loadData} />
      )}
    </div>
  )
}
