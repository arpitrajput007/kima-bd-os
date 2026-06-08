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
  Flame, Target,
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
function AddActivityModal({ lead, onClose, onSaved }: {
  lead: Lead; onClose: () => void; onSaved: () => void
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

// ── Add Lead Modal ──────────────────────────────────────────────
function AddLeadModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<LeadStatus>('new')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const ADD_LEAD_STAGES = PIPELINE_STAGES.filter(s =>
    ['new', 'contacted', 'replied', 'meeting_booked'].includes(s.status)
  )

  const save = async () => {
    if (!name.trim()) { toast.error('Company name is required'); return }
    setSaving(true)
    const { error } = await supabase.from('leads').insert({
      company_name: name.trim(), website: website.trim() || null,
      status, priority: 'needs_research', lead_score: 50,
      updated_at: new Date().toISOString(),
    })
    if (error) { toast.error('Failed to add lead'); setSaving(false); return }
    if (note.trim()) {
      const { data: lead } = await supabase.from('leads').select('id').eq('company_name', name.trim()).single()
      if (lead) await supabase.from('lead_activities').insert({ lead_id: lead.id, type: 'note', content: note.trim() })
    }
    toast.success(`${name} added to CRM`)
    onSaved(); onClose(); setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(4,4,10,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="section-card fade-in" style={{ width: '100%', maxWidth: 440, background: 'rgb(var(--bg-surface-2))', boxShadow: '0 40px 80px rgba(0,0,0,0.7)', borderRadius: 18 }}>
        <div className="section-card-header">
          <div>
            <div className="text-[15px] font-bold text-white">Add lead manually</div>
            <div className="text-[11px] text-muted mt-0.5">Manually add a company to your pipeline</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}><X size={15} /></button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="text-[11px] font-semibold text-muted block mb-1.5 uppercase tracking-wide">Company name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Binance, LayerZero"
              autoFocus className="input-dark" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted block mb-1.5 uppercase tracking-wide">Website</label>
            <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..."
              className="input-dark" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted block mb-1.5 uppercase tracking-wide">Initial stage</label>
            <div className="flex gap-1.5 flex-wrap">
              {ADD_LEAD_STAGES.map(s => (
                <button key={s.status} onClick={() => setStatus(s.status)}
                  className="text-[12px] font-semibold"
                  style={{ padding: '6px 13px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s', border: `1px solid ${status === s.status ? s.color + '55' : 'var(--border)'}`, background: status === s.status ? s.color + '18' : 'rgba(255,255,255,0.03)', color: status === s.status ? s.color : 'var(--text-3)' }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted block mb-1.5 uppercase tracking-wide">Note (optional)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="Why are you adding this lead? What do you know so far?"
              rows={2} className="input-dark" style={{ resize: 'none' }} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
            <button onClick={save} disabled={saving || !name.trim()} className="btn btn-primary" style={{ flex: 2 }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add to CRM
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
        <AddActivityModal lead={lead} onClose={() => setShowAddModal(false)} onSaved={() => { loadActivities(); onActivityAdded() }} />
      )}
    </>
  )
}

// ── Pipeline Card (improved) ────────────────────────────────────
function PipelineCard({ lead, stage, onClick }: {
  lead: LeadWithActivity
  stage: typeof PIPELINE_STAGES[number]
  onClick: () => void
}) {
  const lastActivity = (lead.activities || []).find(a => a.type !== 'status_change')
  const pendingFollowUp = (lead.activities || []).find(a => a.type === 'follow_up' && !a.completed_at)
  const isOverdue = pendingFollowUp?.scheduled_at && new Date(pendingFollowUp.scheduled_at) < new Date()
  const isWon  = stage.status === 'won'
  const isLost = stage.status === 'lost'

  return (
    <div onClick={onClick} className="card-hover"
      style={{
        background: isWon
          ? 'linear-gradient(135deg, rgba(74,222,128,0.05), rgba(34,211,238,0.02))'
          : isLost
          ? 'rgba(244,63,94,0.03)'
          : 'rgb(var(--bg-surface-2))',
        border: isWon
          ? '1px solid rgba(74,222,128,0.2)'
          : isLost
          ? '1px solid rgba(244,63,94,0.12)'
          : '1px solid var(--border)',
        borderRadius: 12,
        cursor: 'pointer',
        opacity: isLost ? 0.55 : 1,
        overflow: 'hidden',
        position: 'relative',
      }}>

      {/* Stage accent bar */}
      <div style={{
        height: 2,
        background: isWon
          ? 'linear-gradient(90deg, #4ade80, #22d3ee)'
          : `linear-gradient(90deg, ${stage.color}cc, ${stage.color}33)`,
      }} />

      <div style={{ padding: '12px 14px' }}>
        {/* Company + score */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="text-[13px] font-bold"
            style={{
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              textDecoration: isLost ? 'line-through' : 'none',
              color: isLost ? 'var(--text-3)' : 'white',
            }}>
            {lead.company_name}
          </div>
          {isWon  && <Trophy size={12} style={{ color: '#4ade80', flexShrink: 0 }} />}
          {isLost && <XCircle size={12} style={{ color: '#f43f5e', flexShrink: 0, opacity: 0.5 }} />}
          {!isWon && !isLost && lead.lead_score != null && (
            <span className={cn('badge', getScoreBg(lead.lead_score))} style={{ fontSize: 9, flexShrink: 0, padding: '1px 6px' }}>
              {lead.lead_score}
            </span>
          )}
        </div>

        {/* Category badge */}
        {(lead.customer_category || []).length > 0 && (
          <div className="mb-2">
            <span className="badge" style={{ fontSize: 9, padding: '1px 7px', color: stage.color, background: stage.bg, borderColor: stage.color + '30' }}>
              {(lead.customer_category as string[])[0].replace(' Customer', '')}
            </span>
          </div>
        )}

        {/* Pain point */}
        {lead.pain_point && (
          <div className="text-[11px] text-muted mb-2.5"
            style={{ lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {lead.pain_point}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-1">
          {lastActivity ? (() => {
            const meta = getActivityMeta(lastActivity)
            const Icon = meta.icon
            return (
              <div className="flex items-center gap-1.5">
                <div style={{ width: 18, height: 18, borderRadius: 5, background: meta.color + '18', border: `1px solid ${meta.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={10} style={{ color: meta.color }} />
                </div>
                <span className="text-[10px] text-muted">{relTime(lastActivity.created_at)}</span>
              </div>
            )
          })() : (
            <span className="text-[10px] text-muted italic">No activity</span>
          )}

          {pendingFollowUp && (
            <div className="flex items-center gap-1 text-[10px] font-semibold" style={{
              color: isOverdue ? '#fb7185' : '#fbbf24',
              background: isOverdue ? 'rgba(251,65,133,0.08)' : 'rgba(251,191,36,0.08)',
              border: `1px solid ${isOverdue ? 'rgba(251,65,133,0.25)' : 'rgba(251,191,36,0.25)'}`,
              padding: '2px 7px', borderRadius: 6,
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

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: leadsData } = await supabase
      .from('leads').select('*')
      .not('status', 'in', '("rejected","archived","reserved")')
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

  const overdue  = allFollowUps.filter(a => a.scheduled_at && new Date(a.scheduled_at) < new Date())
  const upcoming = allFollowUps.filter(a => a.scheduled_at && new Date(a.scheduled_at) >= new Date())

  const completeFollowUp = async (id: string) => {
    await supabase.from('lead_activities').update({ completed_at: new Date().toISOString() }).eq('id', id)
    toast.success('Follow-up marked done'); loadData()
  }

  const stageCounts = PIPELINE_STAGES.map(s => ({ ...s, count: leads.filter(l => l.status === s.status).length }))
  const totalActive  = leads.filter(l => !['won', 'lost'].includes(l.status)).length
  const wonCount     = leads.filter(l => l.status === 'won').length
  const lostCount    = leads.filter(l => l.status === 'lost').length
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
          <div style={{ overflowX: 'auto', paddingBottom: 20 }}>
            <div className="flex gap-3" style={{ minWidth: 'max-content', alignItems: 'start' }}>

              {/* Active stages */}
              {activeStages.map(stage => {
                const stageLeads = leads.filter(l => l.status === stage.status)
                return (
                  <div key={stage.status} style={{ width: 256, flexShrink: 0 }}>
                    {/* Column header */}
                    <div style={{
                      background: 'rgb(var(--bg-surface-2))',
                      border: '1px solid var(--border)',
                      borderTop: `2px solid ${stage.color}`,
                      borderRadius: '10px 10px 0 0',
                      padding: '10px 14px 9px',
                      marginBottom: 0,
                    }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-bold" style={{ color: stage.color }}>
                          {stage.label}
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

                    {/* Cards */}
                    <div style={{
                      background: 'rgba(255,255,255,0.012)',
                      border: '1px solid var(--border)',
                      borderTop: 'none',
                      borderRadius: '0 0 10px 10px',
                      padding: 8,
                      minHeight: 120,
                      display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                      {stageLeads.length === 0 ? (
                        <div className="text-center text-[11px] text-muted" style={{ padding: '28px 8px', opacity: 0.5 }}>
                          Empty
                        </div>
                      ) : stageLeads.map(lead => (
                        <PipelineCard key={lead.id} lead={lead} stage={stage} onClick={() => setSelectedLead(lead)} />
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Terminal stages (Won / Lost) — side by side, visually separated */}
              <div style={{ width: 2, flexShrink: 0, background: 'rgba(255,255,255,0.06)', borderRadius: 2, alignSelf: 'stretch', margin: '0 4px' }} />
              {terminalStages.map(stage => {
                const stageLeads = leads.filter(l => l.status === stage.status)
                return (
                  <div key={stage.status} style={{ width: 220, flexShrink: 0 }}>
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
                    <div style={{
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
                        <PipelineCard key={lead.id} lead={lead} stage={stage} onClick={() => setSelectedLead(lead)} />
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
                {leads.filter(l => l.status === 'won').map((lead, idx) => (
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
