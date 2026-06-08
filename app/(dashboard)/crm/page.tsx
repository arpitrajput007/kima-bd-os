'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Kanban, Plus, X, ChevronRight, Clock, CheckCircle2,
  MessageSquare, Phone, Mail, Calendar,
  Loader2, ArrowRight, AlertCircle, TrendingUp,
  StickyNote, Bell, Check, Send, AtSign, Globe,
  RefreshCw, ExternalLink, Trophy, XCircle,
  FileText, Handshake, Zap, ChevronLeft, ChevronDown,
} from 'lucide-react'
import { cn, getScoreBg, truncate } from '@/lib/utils'
import type { Lead } from '@/lib/types'
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

// ── Pipeline stages — full lifecycle ─────────────────────────
const PIPELINE_STAGES: { status: LeadStatus; label: string; color: string; bg: string; emoji?: string; terminal?: boolean }[] = [
  { status: 'new',            label: 'New',          color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  { status: 'contacted',      label: 'Contacted',    color: '#38bdf8', bg: 'rgba(56,189,248,0.1)'  },
  { status: 'replied',        label: 'Replied',      color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
  { status: 'meeting_booked', label: 'Meeting',      color: '#34d399', bg: 'rgba(52,211,153,0.1)'  },
  { status: 'proposal_sent',  label: 'Proposal',     color: '#fb923c', bg: 'rgba(251,146,60,0.1)'  },
  { status: 'negotiating',    label: 'Negotiating',  color: '#818cf8', bg: 'rgba(129,140,248,0.1)' },
  { status: 'integration',    label: 'Integrating',  color: '#22d3ee', bg: 'rgba(34,211,238,0.1)'  },
  { status: 'won',            label: 'Won',          color: '#4ade80', bg: 'rgba(74,222,128,0.12)', emoji: '🎉', terminal: true },
  { status: 'lost',           label: 'Lost',         color: '#f43f5e', bg: 'rgba(244,63,94,0.1)',   emoji: '✗',  terminal: true },
]

// Channel → icon + label + color
type LIcon = React.ComponentType<{ size?: number; style?: React.CSSProperties }>
const CHANNEL_META: Record<string, { label: string; color: string; icon: LIcon }> = {
  telegram: { label: 'Telegram', color: '#22d3ee', icon: Send },
  twitter:  { label: 'Twitter/X', color: '#38bdf8', icon: AtSign },
  linkedin: { label: 'LinkedIn',  color: '#60a5fa', icon: ExternalLink },
  email:    { label: 'Email',     color: '#a78bfa', icon: Mail },
  discord:  { label: 'Discord',   color: '#818cf8', icon: MessageSquare },
  call:     { label: 'Call',      color: '#34d399', icon: Phone },
  other:    { label: 'Outreach',  color: '#fbbf24', icon: Globe },
}

const TYPE_META: Record<ActivityType, { label: string; color: string; icon: LIcon }> = {
  note:          { label: 'Note',          color: '#a78bfa', icon: StickyNote },
  call:          { label: 'Call',          color: '#38bdf8', icon: Phone },
  email:         { label: 'Email',         color: '#fbbf24', icon: Mail },
  meeting:       { label: 'Meeting',       color: '#34d399', icon: Calendar },
  follow_up:     { label: 'Follow-up',     color: '#fb7185', icon: Bell },
  status_change: { label: 'Stage change',  color: 'rgb(120,127,160)', icon: ArrowRight },
}

function getActivityMeta(a: Activity) {
  if (a.channel && CHANNEL_META[a.channel]) return CHANNEL_META[a.channel]
  return TYPE_META[a.type] || TYPE_META.note
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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Log Activity Modal ────────────────────────────────────────
function AddActivityModal({ lead, onClose, onSaved }: { lead: Lead; onClose: () => void; onSaved: () => void }) {
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
    setSaving(false)
    toast.success('Activity logged')
    onSaved(); onClose()
  }

  const typeOpts: { v: ActivityType; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { v: 'note', label: 'Note', icon: StickyNote },
    { v: 'call', label: 'Call', icon: Phone },
    { v: 'email', label: 'Outreach', icon: Mail },
    { v: 'meeting', label: 'Meeting', icon: Calendar },
    { v: 'follow_up', label: 'Follow-up', icon: Bell },
  ]

  const channelOpts = ['telegram', 'twitter', 'linkedin', 'email', 'discord', 'call']

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(4,4,10,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'linear-gradient(180deg,rgb(18,19,30),rgb(13,13,21))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 24, boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>Log activity</div>
            <div style={{ fontSize: 11, color: 'rgb(120,127,160)', marginTop: 2 }}>{lead.company_name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgb(120,127,160)', cursor: 'pointer' }}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {typeOpts.map(t => {
            const Icon = t.icon
            const meta = t.v === 'email' ? TYPE_META.email : TYPE_META[t.v]
            const active = type === t.v
            return (
              <button key={t.v} onClick={() => setType(t.v)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${active ? meta.color + '60' : 'rgba(255,255,255,0.08)'}`, background: active ? meta.color + '18' : 'rgba(255,255,255,0.03)', color: active ? meta.color : 'rgb(150,155,185)' }}>
                <Icon size={12} />{t.label}
              </button>
            )
          })}
        </div>

        {/* Channel selector for outreach types */}
        {isOutreach && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgb(150,155,185)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Channel</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {channelOpts.map(ch => {
                const cm = CHANNEL_META[ch]
                const CIcon = cm.icon
                return (
                  <button key={ch} onClick={() => setChannel(ch)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${channel === ch ? cm.color + '60' : 'rgba(255,255,255,0.08)'}`, background: channel === ch ? cm.color + '18' : 'rgba(255,255,255,0.03)', color: channel === ch ? cm.color : 'rgb(150,155,185)' }}>
                    <CIcon size={11} />{cm.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <textarea autoFocus value={content} onChange={e => setContent(e.target.value)}
          placeholder={type === 'note' ? 'Add your note…' : type === 'call' ? 'What was discussed?' : type === 'email' ? 'What did you send / receive?' : type === 'meeting' ? 'Meeting notes…' : 'What to follow up on?'}
          rows={3}
          style={{ width: '100%', resize: 'none', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.35)', color: 'white', fontSize: 13, fontFamily: 'inherit', lineHeight: 1.6, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />

        {type === 'follow_up' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'rgb(150,155,185)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Follow-up date *</label>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.35)', color: 'white', fontSize: 13, outline: 'none', colorScheme: 'dark', boxSizing: 'border-box' }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgb(150,155,185)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#38bdf8)', color: 'white', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Lead Manually Modal ────────────────────────────────────
function AddLeadModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<LeadStatus>('new')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  // Only show top-of-funnel stages for adding new leads
  const ADD_LEAD_STAGES = PIPELINE_STAGES.filter(s => ['new', 'contacted', 'replied', 'meeting_booked'].includes(s.status))

  const save = async () => {
    if (!name.trim()) { toast.error('Company name is required'); return }
    setSaving(true)
    const { error } = await supabase.from('leads').insert({
      company_name: name.trim(),
      website: website.trim() || null,
      status,
      priority: 'needs_research',
      lead_score: 50,
      updated_at: new Date().toISOString(),
    })
    if (error) { toast.error('Failed to add lead'); setSaving(false); return }
    if (note.trim()) {
      const { data: lead } = await supabase.from('leads').select('id').eq('company_name', name.trim()).single()
      if (lead) await supabase.from('lead_activities').insert({ lead_id: lead.id, type: 'note', content: note.trim() })
    }
    toast.success(`${name} added to CRM`)
    onSaved(); onClose()
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(4,4,10,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: 'linear-gradient(180deg,rgb(18,19,30),rgb(13,13,21))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 24, boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>Add lead manually</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgb(120,127,160)', cursor: 'pointer' }}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'rgb(150,155,185)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Company name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Binance, LayerZero"
              autoFocus style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.35)', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'rgb(150,155,185)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Website</label>
            <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..."
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.35)', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'rgb(150,155,185)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Initial stage</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ADD_LEAD_STAGES.map(s => (
                <button key={s.status} onClick={() => setStatus(s.status)}
                  style={{ padding: '6px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${status === s.status ? s.color + '60' : 'rgba(255,255,255,0.08)'}`, background: status === s.status ? s.color + '18' : 'rgba(255,255,255,0.03)', color: status === s.status ? s.color : 'rgb(150,155,185)' }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'rgb(150,155,185)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Note (optional)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Why are you adding this lead? What do you know so far?"
              rows={2} style={{ width: '100%', resize: 'none', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.35)', color: 'white', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgb(150,155,185)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving || !name.trim()} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#38bdf8)', color: 'white', fontSize: 13, fontWeight: 700, cursor: saving || !name.trim() ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add to CRM
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Stage Rail ─────────────────────────────────────────────────
function StageRail({ currentStatus, onMove }: { currentStatus: LeadStatus; onMove: (s: LeadStatus) => void }) {
  const currentIdx = PIPELINE_STAGES.findIndex(s => s.status === currentStatus)

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
      <div style={{ display: 'flex', gap: 4, minWidth: 'max-content' }}>
        {PIPELINE_STAGES.map((s, idx) => {
          const isActive = s.status === currentStatus
          const isPast = idx < currentIdx && !s.terminal
          return (
            <button key={s.status} onClick={() => onMove(s.status)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                whiteSpace: 'nowrap', transition: 'all 0.15s',
                border: `1px solid ${isActive ? s.color + '70' : isPast ? s.color + '25' : 'rgba(255,255,255,0.07)'}`,
                background: isActive ? s.color + '22' : isPast ? s.color + '0a' : 'rgba(255,255,255,0.02)',
                color: isActive ? s.color : isPast ? s.color + 'aa' : 'rgb(120,127,160)',
                opacity: isPast ? 0.7 : 1,
              }}>
              {s.emoji && <span style={{ fontSize: 10 }}>{s.emoji}</span>}
              {s.label}
              {isActive && <span style={{ width: 5, height: 5, borderRadius: 999, background: s.color, display: 'inline-block', boxShadow: `0 0 6px ${s.color}` }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Lead Flyout ───────────────────────────────────────────────
function LeadFlyout({ lead, onClose, onActivityAdded, onStatusChange }: {
  lead: LeadWithActivity; onClose: () => void; onActivityAdded: () => void; onStatusChange: (id: string, status: LeadStatus) => void
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
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(4,4,10,0.5)', backdropFilter: 'blur(2px)' }} onClick={onClose} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 201, width: 'min(500px,100vw)', background: 'linear-gradient(180deg,rgb(16,17,27),rgb(11,11,18))', borderLeft: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', boxShadow: '-40px 0 80px rgba(0,0,0,0.7)' }}>

        {/* Won/Lost banner */}
        {(isWon || isLost) && (
          <div style={{
            padding: '10px 22px', display: 'flex', alignItems: 'center', gap: 8,
            background: isWon ? 'rgba(74,222,128,0.08)' : 'rgba(244,63,94,0.08)',
            borderBottom: `1px solid ${isWon ? 'rgba(74,222,128,0.2)' : 'rgba(244,63,94,0.2)'}`,
          }}>
            {isWon
              ? <><Trophy size={14} style={{ color: '#4ade80', flexShrink: 0 }} /><span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>Deal Won 🎉 — Integration live</span></>
              : <><XCircle size={14} style={{ color: '#f43f5e', flexShrink: 0 }} /><span style={{ fontSize: 12, fontWeight: 700, color: '#f43f5e' }}>Deal Lost — Marked closed</span></>
            }
          </div>
        )}

        {/* Header */}
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <div style={{ minWidth: 0 }}>
              <Link href={`/leads/${lead.id}`} style={{ fontSize: 16, fontWeight: 700, color: 'white', textDecoration: 'none' }} className="hover:text-violet-300 transition-colors">
                {lead.company_name}
              </Link>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                {stage && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: stage.color, background: stage.bg, border: `1px solid ${stage.color}40`, padding: '2px 8px', borderRadius: 999 }}>
                    {stage.emoji ? `${stage.emoji} ` : ''}{stage.label}
                  </span>
                )}
                {lead.lead_score != null && (
                  <span className={cn('badge', getScoreBg(lead.lead_score))} style={{ fontSize: 10 }}>{lead.lead_score}</span>
                )}
                {lead.website && (
                  <a href={lead.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'rgb(110,115,150)', textDecoration: 'none' }}>
                    {lead.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'rgb(150,155,185)', cursor: 'pointer', padding: '5px 6px', flexShrink: 0, display: 'flex' }}><X size={14} /></button>
          </div>

          {/* Stage rail — scrollable */}
          <div style={{ fontSize: 10, fontWeight: 600, color: 'rgb(100,107,140)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>Move stage</div>
          <StageRail currentStatus={lead.status} onMove={(s) => onStatusChange(lead.id, s)} />
        </div>

        {/* Pending follow-ups */}
        {pendingFollowUps.length > 0 && (
          <div style={{ padding: '12px 22px', borderBottom: '1px solid rgba(251,113,133,0.12)', background: 'rgba(251,65,133,0.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#fb7185', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              <Bell size={10} style={{ display: 'inline', marginRight: 4 }} />Scheduled follow-ups
            </div>
            {pendingFollowUps.map(a => {
              const isOverdue = a.scheduled_at && new Date(a.scheduled_at) < new Date()
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, border: `1px solid ${isOverdue ? 'rgba(251,65,133,0.3)' : 'rgba(251,65,133,0.12)'}`, background: isOverdue ? 'rgba(251,65,133,0.1)' : 'rgba(251,65,133,0.05)', marginBottom: 6 }}>
                  <AlertCircle size={13} color={isOverdue ? '#fb7185' : '#fbbf24'} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'white', lineHeight: 1.4 }}>{a.content}</div>
                    {a.scheduled_at && (
                      <div style={{ fontSize: 10, color: isOverdue ? '#fb7185' : '#fbbf24', marginTop: 2 }}>
                        {isOverdue ? '⚠ Overdue · ' : ''}{formatDate(a.scheduled_at)}
                      </div>
                    )}
                  </div>
                  <button onClick={() => completeFollowUp(a.id)} disabled={completing === a.id}
                    style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.1)', color: '#34d399', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {completing === a.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Done
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Quick actions */}
        <div style={{ padding: '12px 22px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 8 }}>
          <button onClick={() => setShowAddModal(true)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 10, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.1)', color: '#a78bfa', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={13} /> Log activity
          </button>
          <Link href={`/outreach?lead=${lead.id}`}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 10, border: '1px solid rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
            <MessageSquare size={13} /> Draft message
          </Link>
          <Link href={`/leads/${lead.id}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgb(160,165,195)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
            <ChevronRight size={14} />
          </Link>
        </div>

        {/* Activity timeline */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgb(100,107,140)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Activity timeline</div>
          {timeline.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 12, color: 'rgb(90,95,120)', lineHeight: 1.7 }}>
              No activity yet.<br />Log a note, call, or outreach to track progress.
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* Vertical line */}
              <div style={{ position: 'absolute', left: 13, top: 14, bottom: 0, width: 1, background: 'rgba(255,255,255,0.06)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {timeline.map((a, idx) => {
                  const meta = getActivityMeta(a)
                  const Icon = meta.icon
                  return (
                    <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: idx < timeline.length - 1 ? 16 : 0 }}>
                      {/* Icon dot */}
                      <div style={{ width: 27, height: 27, borderRadius: 8, border: `1px solid ${meta.color}40`, background: meta.color + '16', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', zIndex: 1 }}>
                        <Icon size={12} style={{ color: meta.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>{meta.label}</span>
                          <span style={{ fontSize: 10, color: 'rgb(100,107,140)' }}>{relTime(a.created_at)}</span>
                          {a.completed_at && <span style={{ fontSize: 10, color: '#34d399', fontWeight: 600 }}>✓ Done</span>}
                        </div>
                        <div style={{ fontSize: 13, color: 'rgb(210,215,235)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{a.content}</div>
                        {(a.scheduled_at || a.follow_up_at) && (
                          <div style={{ fontSize: 10, color: 'rgb(150,155,185)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
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
        <AddActivityModal lead={lead} onClose={() => setShowAddModal(false)} onSaved={() => { loadActivities(); onActivityAdded() }} />
      )}
    </>
  )
}

// ── Pipeline card ─────────────────────────────────────────────
function PipelineCard({ lead, stage, onClick }: { lead: LeadWithActivity; stage: typeof PIPELINE_STAGES[number]; onClick: () => void }) {
  const lastActivity = (lead.activities || []).find(a => a.type !== 'status_change')
  const pendingFollowUp = (lead.activities || []).find(a => a.type === 'follow_up' && !a.completed_at)
  const isOverdue = pendingFollowUp?.scheduled_at && new Date(pendingFollowUp.scheduled_at) < new Date()
  const isWon = stage.status === 'won'
  const isLost = stage.status === 'lost'

  return (
    <div onClick={onClick}
      style={{
        background: isWon ? 'rgba(74,222,128,0.04)' : isLost ? 'rgba(244,63,94,0.03)' : 'rgba(255,255,255,0.025)',
        border: isWon ? '1px solid rgba(74,222,128,0.25)' : isLost ? '1px solid rgba(244,63,94,0.15)' : '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12, padding: '14px 15px', cursor: 'pointer', transition: 'all 0.15s',
        boxShadow: isWon ? '0 0 16px rgba(74,222,128,0.06)' : 'none',
        opacity: isLost ? 0.65 : 1,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = isWon ? 'rgba(74,222,128,0.08)' : isLost ? 'rgba(244,63,94,0.07)' : 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = stage.color + '40' }}
      onMouseLeave={e => { e.currentTarget.style.background = isWon ? 'rgba(74,222,128,0.04)' : isLost ? 'rgba(244,63,94,0.03)' : 'rgba(255,255,255,0.025)'; e.currentTarget.style.borderColor = isWon ? 'rgba(74,222,128,0.25)' : isLost ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.07)' }}>

      {/* Company + score */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          color: isLost ? 'rgb(150,155,185)' : 'white',
          textDecoration: isLost ? 'line-through' : 'none',
        }}>{lead.company_name}</div>
        {isWon && <Trophy size={12} style={{ color: '#4ade80', flexShrink: 0 }} />}
        {isLost && <XCircle size={12} style={{ color: '#f43f5e', flexShrink: 0, opacity: 0.6 }} />}
        {!isWon && !isLost && lead.lead_score != null && (
          <span className={cn('badge', getScoreBg(lead.lead_score))} style={{ fontSize: 9, flexShrink: 0 }}>{lead.lead_score}</span>
        )}
      </div>

      {/* Pain point */}
      {lead.pain_point && (
        <div style={{ fontSize: 11, color: isLost ? 'rgb(100,105,130)' : 'rgb(140,145,175)', lineHeight: 1.5, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {lead.pain_point}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {lastActivity ? (() => {
            const meta = getActivityMeta(lastActivity)
            const Icon = meta.icon
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, background: meta.color + '20', border: `1px solid ${meta.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={10} style={{ color: meta.color }} />
                </div>
                <span style={{ fontSize: 10, color: 'rgb(110,115,145)' }}>{relTime(lastActivity.created_at)}</span>
              </div>
            )
          })() : (
            <span style={{ fontSize: 10, color: 'rgb(90,95,120)' }}>No activity</span>
          )}
        </div>
        {pendingFollowUp && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: isOverdue ? '#fb7185' : '#fbbf24', background: isOverdue ? 'rgba(251,65,133,0.1)' : 'rgba(251,191,36,0.1)', padding: '2px 7px', borderRadius: 6, border: `1px solid ${isOverdue ? 'rgba(251,65,133,0.3)' : 'rgba(251,191,36,0.3)'}` }}>
            <Bell size={9} />{isOverdue ? 'Overdue' : 'Follow-up'}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main CRM page ─────────────────────────────────────────────
export default function CRMPage() {
  const supabase = createClient()
  const [leads, setLeads] = useState<LeadWithActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<LeadWithActivity | null>(null)
  const [view, setView] = useState<'pipeline' | 'followups' | 'wins'>('pipeline')
  const [showAddLead, setShowAddLead] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: leadsData } = await supabase
      .from('leads')
      .select('*')
      .not('status', 'in', '(\"rejected\",\"archived\",\"reserved\")')
      .order('lead_score', { ascending: false, nullsFirst: false })

    const { data: activitiesData } = await supabase
      .from('lead_activities').select('*').order('created_at', { ascending: false })

    const actsByLead: Record<string, Activity[]> = {}
    ;(activitiesData || []).forEach((a: Activity) => {
      if (!actsByLead[a.lead_id]) actsByLead[a.lead_id] = []
      actsByLead[a.lead_id].push(a)
    })

    setLeads((leadsData || []).map((l: Lead) => ({ ...l, activities: actsByLead[l.id] || [] })))
    setLoading(false)
  }, []) // eslint-disable-line

  useEffect(() => { loadData() }, [loadData])

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

  const allFollowUps = leads.flatMap(l =>
    (l.activities || [])
      .filter(a => a.type === 'follow_up' && !a.completed_at)
      .map(a => ({ ...a, lead: l }))
  ).sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())

  const overdue = allFollowUps.filter(a => a.scheduled_at && new Date(a.scheduled_at) < new Date())
  const upcoming = allFollowUps.filter(a => a.scheduled_at && new Date(a.scheduled_at) >= new Date())

  const completeFollowUp = async (id: string) => {
    await supabase.from('lead_activities').update({ completed_at: new Date().toISOString() }).eq('id', id)
    toast.success('Follow-up marked done'); loadData()
  }

  // Stats: one per stage + overdue
  const stageCounts = PIPELINE_STAGES.map(s => ({ ...s, count: leads.filter(l => l.status === s.status).length }))
  const totalActive = leads.filter(l => !['won', 'lost'].includes(l.status)).length
  const wonCount = leads.filter(l => l.status === 'won').length
  const lostCount = leads.filter(l => l.status === 'lost').length

  // Stats strip items — show early stages + terminal + overdue
  const statsItems = [
    ...PIPELINE_STAGES.slice(0, 4).map(s => ({ label: s.label, count: stageCounts.find(x => x.status === s.status)?.count || 0, color: s.color, border: s.color + '22' })),
    { label: 'Proposal+', count: stageCounts.filter(x => ['proposal_sent','negotiating','integration'].includes(x.status)).reduce((a,b) => a + b.count, 0), color: '#fb923c', border: 'rgba(251,146,60,0.2)' },
    { label: 'Won 🎉', count: wonCount, color: '#4ade80', border: 'rgba(74,222,128,0.25)' },
    { label: 'Lost', count: lostCount, color: '#f43f5e', border: 'rgba(244,63,94,0.2)' },
    { label: 'Overdue', count: overdue.length, color: '#fb7185', border: 'rgba(251,113,133,0.2)' },
  ]

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2">
            <Kanban size={18} style={{ color: '#a78bfa' }} /> CRM Pipeline
          </h1>
          <p className="text-[12px] mt-1 font-medium" style={{ color: 'rgb(100,106,135)' }}>
            {totalActive} active · {wonCount} won · {lostCount} lost · {overdue.length > 0 ? `${overdue.length} overdue` : 'All follow-ups on track'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={loadData}
            style={{ padding: '7px 10px', borderRadius: 9, fontSize: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgb(150,155,185)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={13} />
          </button>
          <button onClick={() => setView('pipeline')}
            style={{ padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${view === 'pipeline' ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.08)'}`, background: view === 'pipeline' ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.04)', color: view === 'pipeline' ? '#a78bfa' : 'rgb(160,165,195)' }}>
            <Kanban size={12} style={{ display: 'inline', marginRight: 5 }} />Pipeline
          </button>
          <button onClick={() => setView('followups')} style={{ padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', position: 'relative', border: `1px solid ${view === 'followups' ? 'rgba(251,113,133,0.4)' : 'rgba(255,255,255,0.08)'}`, background: view === 'followups' ? 'rgba(251,113,133,0.1)' : 'rgba(255,255,255,0.04)', color: view === 'followups' ? '#fb7185' : 'rgb(160,165,195)' }}>
            <Bell size={12} style={{ display: 'inline', marginRight: 5 }} />Follow-ups
            {overdue.length > 0 && <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: '#fb7185', color: 'white', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{overdue.length}</span>}
          </button>
          <button onClick={() => setView('wins')} style={{ padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', position: 'relative', border: `1px solid ${view === 'wins' ? 'rgba(74,222,128,0.45)' : 'rgba(255,255,255,0.08)'}`, background: view === 'wins' ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)', color: view === 'wins' ? '#4ade80' : 'rgb(160,165,195)' }}>
            <Trophy size={12} style={{ display: 'inline', marginRight: 5 }} />Integrations
            {wonCount > 0 && <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: '#4ade80', color: '#052e16', fontSize: 9, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{wonCount}</span>}
          </button>
          <button onClick={() => setShowAddLead(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'linear-gradient(135deg,rgba(124,58,237,0.8),rgba(56,189,248,0.8))', border: 'none', color: 'white' }}>
            <Plus size={13} /> Add lead
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 36px' }}>
        {/* Stats strip */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, overflowX: 'auto', paddingBottom: 2 }}>
          {statsItems.map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${s.border}`, borderRadius: 12, padding: '14px 20px', flexShrink: 0, minWidth: 90 }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.count}</div>
              <div style={{ fontSize: 11, color: 'rgb(120,127,160)', marginTop: 5, whiteSpace: 'nowrap' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgb(100,107,140)' }}>
            <Loader2 size={28} className="animate-spin mx-auto mb-3" style={{ color: '#a78bfa' }} />
            <div style={{ fontSize: 13 }}>Loading CRM…</div>
          </div>
        ) : view === 'pipeline' ? (
          /* Horizontal-scrolling Kanban — 9 fixed-width columns */
          <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
            <div style={{ display: 'flex', gap: 14, minWidth: 'max-content', alignItems: 'start' }}>
              {PIPELINE_STAGES.map(stage => {
                const stageLeads = leads.filter(l => l.status === stage.status)
                return (
                  <div key={stage.status} style={{ width: 230, flexShrink: 0 }}>
                    {/* Column header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 999, background: stage.color, boxShadow: `0 0 6px ${stage.color}80` }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>
                          {stage.emoji ? `${stage.emoji} ` : ''}{stage.label}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: stage.color, background: stage.bg, border: `1px solid ${stage.color}30`, padding: '2px 8px', borderRadius: 999 }}>{stageLeads.length}</span>
                    </div>
                    {/* Cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {stageLeads.length === 0 ? (
                        <div style={{ padding: '24px 14px', background: 'rgba(255,255,255,0.015)', border: '1px dashed rgba(255,255,255,0.07)', borderRadius: 12, textAlign: 'center', fontSize: 11, color: 'rgb(80,85,110)' }}>No leads yet</div>
                      ) : stageLeads.map(lead => (
                        <PipelineCard key={lead.id} lead={lead} stage={stage} onClick={() => setSelectedLead(lead)} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : view === 'followups' ? (
          /* Follow-ups view */
          <div style={{ maxWidth: 680 }}>
            {allFollowUps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <CheckCircle2 size={44} style={{ color: '#34d399', margin: '0 auto 16px', display: 'block' }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: 'white', marginBottom: 6 }}>All caught up!</div>
                <div style={{ fontSize: 13, color: 'rgb(100,107,140)' }}>No pending follow-ups. Keep reaching out to create more.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {overdue.length > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fb7185', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertCircle size={12} /> Overdue · {overdue.length}
                  </div>
                )}
                {overdue.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'rgba(251,65,133,0.06)', border: '1px solid rgba(251,65,133,0.2)', borderRadius: 14 }}>
                    <Bell size={15} color="#fb7185" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <button onClick={() => setSelectedLead(a.lead)} style={{ fontSize: 13, fontWeight: 700, color: 'white', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{a.lead.company_name}</button>
                        <span style={{ fontSize: 11, color: '#fb7185', fontWeight: 600 }}>Overdue · {formatDate(a.scheduled_at!)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'rgb(190,195,220)', marginTop: 3 }}>{truncate(a.content, 90)}</div>
                    </div>
                    <button onClick={() => completeFollowUp(a.id)}
                      style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 9, border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.1)', color: '#34d399', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <CheckCircle2 size={13} /> Done
                    </button>
                  </div>
                ))}
                {upcoming.length > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em', margin: overdue.length > 0 ? '12px 0 4px' : '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={12} /> Upcoming · {upcoming.length}
                  </div>
                )}
                {upcoming.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 14 }}>
                    <Clock size={15} color="#fbbf24" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <button onClick={() => setSelectedLead(a.lead)} style={{ fontSize: 13, fontWeight: 700, color: 'white', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{a.lead.company_name}</button>
                        <span style={{ fontSize: 11, color: '#fbbf24' }}>{formatDate(a.scheduled_at!)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'rgb(190,195,220)', marginTop: 3 }}>{truncate(a.content, 90)}</div>
                    </div>
                    <button onClick={() => completeFollowUp(a.id)}
                      style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 9, border: '1px solid rgba(52,211,153,0.25)', background: 'rgba(52,211,153,0.08)', color: '#34d399', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <CheckCircle2 size={13} /> Done
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── Integrations (Won) view — Trophy wall ── */
          <div>
            {/* Section hero */}
            <div style={{
              marginBottom: 32,
              padding: '28px 32px',
              background: 'linear-gradient(135deg, rgba(74,222,128,0.07) 0%, rgba(34,211,238,0.05) 50%, rgba(129,140,248,0.05) 100%)',
              border: '1px solid rgba(74,222,128,0.15)',
              borderRadius: 20,
              display: 'flex', alignItems: 'center', gap: 24,
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18, flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(74,222,128,0.2), rgba(34,211,238,0.15))',
                border: '1px solid rgba(74,222,128,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 32px rgba(74,222,128,0.15)',
              }}>
                <Trophy size={28} style={{ color: '#4ade80' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'white', letterSpacing: '-0.01em', marginBottom: 4 }}>
                  Successfully Integrated Partners
                </div>
                <div style={{ fontSize: 13, color: 'rgb(120,127,160)', lineHeight: 1.6, maxWidth: 540 }}>
                  Every partner here is live on Kima. Volume tracking coming soon — for now, take a moment to appreciate what you've built. 💚
                </div>
              </div>
              <div style={{
                textAlign: 'center', flexShrink: 0,
                padding: '12px 24px',
                background: 'rgba(74,222,128,0.08)',
                border: '1px solid rgba(74,222,128,0.2)',
                borderRadius: 14,
              }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#4ade80', lineHeight: 1 }}>{wonCount}</div>
                <div style={{ fontSize: 11, color: 'rgb(120,127,160)', marginTop: 4, fontWeight: 600 }}>Live integrations</div>
              </div>
            </div>

            {wonCount === 0 ? (
              /* Empty state */
              <div style={{
                textAlign: 'center', padding: '80px 20px',
                background: 'rgba(255,255,255,0.015)',
                border: '1px dashed rgba(74,222,128,0.15)',
                borderRadius: 20,
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 8 }}>Your first win is coming</div>
                <div style={{ fontSize: 13, color: 'rgb(100,107,140)', lineHeight: 1.7, maxWidth: 360, margin: '0 auto' }}>
                  Once a deal closes and the integration goes live, it'll appear here as a permanent record of your work.
                </div>
                <button onClick={() => setView('pipeline')}
                  style={{ marginTop: 24, padding: '10px 22px', borderRadius: 11, border: '1px solid rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.08)', color: '#4ade80', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Go close a deal →
                </button>
              </div>
            ) : (
              /* Trophy grid */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {leads.filter(l => l.status === 'won').map((lead, idx) => (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    style={{
                      background: 'linear-gradient(135deg, rgba(74,222,128,0.06) 0%, rgba(34,211,238,0.04) 100%)',
                      border: '1px solid rgba(74,222,128,0.2)',
                      borderRadius: 16, padding: '20px 22px',
                      cursor: 'pointer', transition: 'all 0.2s',
                      boxShadow: '0 0 20px rgba(74,222,128,0.04)',
                      position: 'relative', overflow: 'hidden',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(74,222,128,0.45)'; e.currentTarget.style.boxShadow = '0 0 32px rgba(74,222,128,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(74,222,128,0.2)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(74,222,128,0.04)'; e.currentTarget.style.transform = 'translateY(0)' }}
                  >
                    {/* Background number watermark */}
                    <div style={{ position: 'absolute', top: 12, right: 16, fontSize: 48, fontWeight: 900, color: 'rgba(74,222,128,0.06)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>#{idx + 1}</div>

                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'white', letterSpacing: '-0.01em', marginBottom: 3 }}>{lead.company_name}</div>
                        {lead.website && (
                          <a href={lead.website} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: 11, color: 'rgba(74,222,128,0.6)', textDecoration: 'none' }}>
                            {lead.website.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                      </div>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Trophy size={14} style={{ color: '#4ade80' }} />
                      </div>
                    </div>

                    {/* Tags row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
                      {lead.industry_category && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(34,211,238,0.9)', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)', padding: '3px 8px', borderRadius: 6 }}>
                          {lead.industry_category}
                        </span>
                      )}
                      {lead.product_to_sell && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(129,140,248,0.9)', background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)', padding: '3px 8px', borderRadius: 6 }}>
                          {lead.product_to_sell}
                        </span>
                      )}
                    </div>

                    {/* Pain point / use case */}
                    {lead.suggested_use_case && (
                      <div style={{ fontSize: 12, color: 'rgb(150,160,195)', lineHeight: 1.6, marginBottom: 14, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {lead.suggested_use_case}
                      </div>
                    )}

                    {/* Volume placeholder */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 10,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <TrendingUp size={12} style={{ color: 'rgba(74,222,128,0.5)' }} />
                        <span style={{ fontSize: 11, color: 'rgb(100,107,140)', fontWeight: 600 }}>Volume</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(74,222,128,0.4)', background: 'rgba(74,222,128,0.06)', padding: '2px 8px', borderRadius: 6, border: '1px dashed rgba(74,222,128,0.2)' }}>
                        Coming soon
                      </span>
                    </div>

                    {/* Won date */}
                    <div style={{ marginTop: 10, fontSize: 10, color: 'rgb(80,87,115)', display: 'flex', alignItems: 'center', gap: 4 }}>
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
