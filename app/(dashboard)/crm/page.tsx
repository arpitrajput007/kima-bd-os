'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Kanban, Plus, X, ChevronRight, Clock, CheckCircle2,
  MessageSquare, Phone, Mail, Calendar, FileText,
  Loader2, ArrowRight, AlertCircle, Users, TrendingUp,
  StickyNote, Bell, Check,
} from 'lucide-react'
import { cn, getScoreBg, truncate } from '@/lib/utils'
import type { Lead } from '@/lib/types'
import type { LeadStatus } from '@/lib/types'

// ── Types ────────────────────────────────────────────────────
type ActivityType = 'note' | 'call' | 'email' | 'meeting' | 'follow_up' | 'status_change'
type LucideIcon = React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>

interface Activity {
  id: string
  lead_id: string
  type: ActivityType
  content: string
  scheduled_at?: string | null
  completed_at?: string | null
  created_at: string
}

interface LeadWithActivity extends Lead {
  activities?: Activity[]
}

// ── Pipeline columns ─────────────────────────────────────────
const PIPELINE_STAGES: { status: LeadStatus; label: string; color: string; bg: string }[] = [
  { status: 'new',            label: 'New',          color: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
  { status: 'contacted',      label: 'Contacted',    color: '#38bdf8', bg: 'rgba(56,189,248,0.08)' },
  { status: 'replied',        label: 'Replied',      color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
  { status: 'meeting_booked', label: 'Meeting',      color: '#34d399', bg: 'rgba(52,211,153,0.08)' },
]

const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  note:          StickyNote,
  call:          Phone,
  email:         Mail,
  meeting:       Calendar,
  follow_up:     Bell,
  status_change: ArrowRight,
}

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  note:          '#a78bfa',
  call:          '#38bdf8',
  email:         '#fbbf24',
  meeting:       '#34d399',
  follow_up:     '#fb7185',
  status_change: 'rgb(120,127,160)',
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

// ── Add Activity Modal ───────────────────────────────────────
function AddActivityModal({
  lead, onClose, onSaved,
}: {
  lead: Lead; onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [type, setType] = useState<ActivityType>('note')
  const [content, setContent] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!content.trim() && type !== 'follow_up') { toast.error('Add some content'); return }
    if (type === 'follow_up' && !scheduledAt) { toast.error('Pick a follow-up date'); return }
    setSaving(true)
    const { error } = await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      type,
      content: content.trim() || `Follow-up scheduled`,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    })
    setSaving(false)
    if (error) { toast.error('Failed to save'); return }
    toast.success('Activity logged')
    onSaved()
    onClose()
  }

  const typeOptions: { value: ActivityType; label: string; icon: LucideIcon }[] = [
    { value: 'note',      label: 'Note',      icon: StickyNote },
    { value: 'call',      label: 'Call',      icon: Phone },
    { value: 'email',     label: 'Email',     icon: Mail },
    { value: 'meeting',   label: 'Meeting',   icon: Calendar },
    { value: 'follow_up', label: 'Follow-up', icon: Bell },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(4,4,10,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, background: 'linear-gradient(180deg, rgb(18,19,30), rgb(13,13,21))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>Log activity</div>
            <div style={{ fontSize: 11, color: 'rgb(120,127,160)', marginTop: 2 }}>{lead.company_name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgb(120,127,160)', cursor: 'pointer', padding: 4 }}><X size={16} /></button>
        </div>

        {/* Type selector */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {typeOptions.map(t => {
            const Icon = t.icon
            return (
              <button key={t.value} onClick={() => setType(t.value)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', border: `1px solid ${type === t.value ? ACTIVITY_COLORS[t.value] + '60' : 'rgba(255,255,255,0.08)'}`, background: type === t.value ? ACTIVITY_COLORS[t.value] + '18' : 'rgba(255,255,255,0.03)', color: type === t.value ? ACTIVITY_COLORS[t.value] : 'rgb(150,155,185)' }}>
                <Icon size={12} />{t.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <textarea
          autoFocus
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={type === 'note' ? 'Add your note…' : type === 'call' ? 'What was discussed on the call?' : type === 'email' ? 'What did you send / receive?' : type === 'meeting' ? 'Meeting notes…' : 'What do you want to follow up on?'}
          rows={4}
          style={{ width: '100%', resize: 'none', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.35)', color: 'white', fontSize: 13, fontFamily: 'inherit', lineHeight: 1.6, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
        />

        {/* Follow-up date */}
        {type === 'follow_up' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'rgb(150,155,185)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Follow-up date &amp; time *</label>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.35)', color: 'white', fontSize: 13, outline: 'none', colorScheme: 'dark', boxSizing: 'border-box' }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgb(150,155,185)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,rgba(167,139,250,1),rgba(56,189,248,1))', color: '#000', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Lead detail flyout (activities + follow-up) ───────────────
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
    setCompleting(null)
    loadActivities()
    onActivityAdded()
  }

  const pendingFollowUps = activities.filter(a => a.type === 'follow_up' && !a.completed_at)
  const timeline = activities.filter(a => !(a.type === 'follow_up' && !a.completed_at))

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(4,4,10,0.5)', backdropFilter: 'blur(2px)' }} onClick={onClose} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 201, width: 'min(520px,100vw)', background: 'linear-gradient(180deg,rgb(17,18,28),rgb(12,12,19))', borderLeft: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', boxShadow: '-40px 0 80px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <Link href={`/leads/${lead.id}`} style={{ fontSize: 16, fontWeight: 700, color: 'white', textDecoration: 'none' }} className="hover:text-violet-300 transition-colors">
              {lead.company_name}
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              {lead.lead_score != null && (
                <span className={cn('badge', getScoreBg(lead.lead_score))} style={{ fontSize: 10 }}>{lead.lead_score}</span>
              )}
              <span style={{ fontSize: 11, color: 'rgb(120,127,160)' }}>{lead.product_to_sell}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgb(120,127,160)', cursor: 'pointer', flexShrink: 0 }}><X size={16} /></button>
        </div>

        {/* Move stage */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'rgb(100,107,140)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Move to stage</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PIPELINE_STAGES.map(s => (
              <button key={s.status} onClick={() => onStatusChange(lead.id, s.status)}
                style={{ padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', border: `1px solid ${lead.status === s.status ? s.color + '60' : 'rgba(255,255,255,0.08)'}`, background: lead.status === s.status ? s.color + '20' : 'rgba(255,255,255,0.03)', color: lead.status === s.status ? s.color : 'rgb(150,155,185)' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pending follow-ups */}
        {pendingFollowUps.length > 0 && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(251,65,133,0.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#fb7185', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Scheduled follow-ups</div>
            {pendingFollowUps.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(251,65,133,0.15)', background: 'rgba(251,65,133,0.06)', marginBottom: 6 }}>
                <Bell size={13} color="#fb7185" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'white', lineHeight: 1.4 }}>{a.content}</div>
                  {a.scheduled_at && (
                    <div style={{ fontSize: 10, color: '#fb7185', marginTop: 2 }}>Due: {formatDate(a.scheduled_at)}</div>
                  )}
                </div>
                <button onClick={() => completeFollowUp(a.id)} disabled={completing === a.id}
                  style={{ flexShrink: 0, padding: '4px 9px', borderRadius: 7, border: '1px solid rgba(52,211,153,0.25)', background: 'rgba(52,211,153,0.08)', color: '#34d399', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {completing === a.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Done
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 8 }}>
          <button onClick={() => setShowAddModal(true)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.1)', color: '#a78bfa', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={13} /> Log activity / note
          </button>
          <Link href={`/leads/${lead.id}`}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgb(160,165,195)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
            Full lead <ChevronRight size={13} />
          </Link>
        </div>

        {/* Activity timeline */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'rgb(100,107,140)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Activity timeline</div>
          {timeline.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 12, color: 'rgb(100,107,140)', lineHeight: 1.7 }}>
              No activity logged yet.<br />Hit "Log activity" to add a note, call, or schedule a follow-up.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {timeline.map(a => {
                const Icon = ACTIVITY_ICONS[a.type]
                const color = ACTIVITY_COLORS[a.type]
                return (
                  <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${color}40`, background: color + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <Icon size={13} color={color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color, textTransform: 'capitalize' }}>{a.type.replace('_', ' ')}</span>
                        <span style={{ fontSize: 10, color: 'rgb(100,107,140)' }}>{relTime(a.created_at)}</span>
                        {a.completed_at && <span style={{ fontSize: 10, color: '#34d399' }}>✓ Done</span>}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'rgb(200,205,225)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{a.content}</div>
                      {a.scheduled_at && (
                        <div style={{ fontSize: 10, color: 'rgb(150,155,185)', marginTop: 3 }}>Scheduled: {formatDate(a.scheduled_at)}</div>
                      )}
                    </div>
                  </div>
                )
              })}
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

// ── Pipeline card ─────────────────────────────────────────────
function PipelineCard({ lead, onClick }: { lead: LeadWithActivity; onClick: () => void }) {
  const lastActivity = (lead.activities || []).find(a => a.type !== 'status_change')
  const pendingFollowUp = (lead.activities || []).find(a => a.type === 'follow_up' && !a.completed_at)
  const isOverdue = pendingFollowUp?.scheduled_at && new Date(pendingFollowUp.scheduled_at) < new Date()

  return (
    <div onClick={onClick}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '13px 14px', cursor: 'pointer', transition: 'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.055)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.25)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{lead.company_name}</div>
        {lead.lead_score != null && (
          <span className={cn('badge', getScoreBg(lead.lead_score))} style={{ fontSize: 9, flexShrink: 0 }}>{lead.lead_score}</span>
        )}
      </div>
      {lead.pain_point && (
        <div style={{ fontSize: 11, color: 'rgb(140,145,175)', lineHeight: 1.5, marginBottom: 7 }}>{truncate(lead.pain_point, 80)}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
        {lastActivity ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'rgb(110,115,145)' }}>
            {(() => { const Icon = ACTIVITY_ICONS[lastActivity.type]; return <Icon size={10} /> })()}
            {relTime(lastActivity.created_at)}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: 'rgb(90,95,125)' }}>No activity</div>
        )}
        {pendingFollowUp && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: isOverdue ? '#fb7185' : '#fbbf24' }}>
            <Bell size={10} />
            {isOverdue ? 'Overdue!' : 'Follow-up'}
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
  const [showAddActivity, setShowAddActivity] = useState<Lead | null>(null)
  const [view, setView] = useState<'pipeline' | 'followups'>('pipeline')

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: leadsData } = await supabase
      .from('leads')
      .select('*')
      .not('status', 'in', '("rejected","archived")')
      .order('lead_score', { ascending: false, nullsFirst: false })

    const { data: activitiesData } = await supabase
      .from('lead_activities')
      .select('*')
      .order('created_at', { ascending: false })

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
    // Log status change activity
    await supabase.from('lead_activities').insert({
      lead_id: id, type: 'status_change',
      content: `Moved to ${PIPELINE_STAGES.find(s => s.status === status)?.label || status}`,
    })
    toast.success('Stage updated')
    // Update local state
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    if (selectedLead?.id === id) setSelectedLead(prev => prev ? { ...prev, status } : prev)
    loadData()
  }

  // Follow-up overdue or due today
  const allFollowUps = leads.flatMap(l =>
    (l.activities || [])
      .filter(a => a.type === 'follow_up' && !a.completed_at)
      .map(a => ({ ...a, lead: l }))
  ).sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())

  const overdue = allFollowUps.filter(a => a.scheduled_at && new Date(a.scheduled_at) < new Date())
  const upcoming = allFollowUps.filter(a => a.scheduled_at && new Date(a.scheduled_at) >= new Date())

  const completeFollowUp = async (id: string) => {
    await supabase.from('lead_activities').update({ completed_at: new Date().toISOString() }).eq('id', id)
    toast.success('Follow-up marked done')
    loadData()
  }

  // Stats
  const stats = PIPELINE_STAGES.map(s => ({
    ...s,
    count: leads.filter(l => l.status === s.status).length,
  }))

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2">
            <Kanban size={18} style={{ color: '#a78bfa' }} /> CRM
          </h1>
          <p className="text-[12px] mt-1 font-medium" style={{ color: 'rgb(100,106,135)' }}>
            Pipeline · Activity log · Follow-up scheduler
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setView('pipeline')}
            style={{ padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${view === 'pipeline' ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.08)'}`, background: view === 'pipeline' ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.04)', color: view === 'pipeline' ? '#a78bfa' : 'rgb(160,165,195)' }}>
            <Kanban size={13} style={{ display: 'inline', marginRight: 5 }} />Pipeline
          </button>
          <button onClick={() => setView('followups')}
            style={{ padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${view === 'followups' ? 'rgba(251,113,133,0.4)' : 'rgba(255,255,255,0.08)'}`, background: view === 'followups' ? 'rgba(251,113,133,0.1)' : 'rgba(255,255,255,0.04)', color: view === 'followups' ? '#fb7185' : 'rgb(160,165,195)', position: 'relative' }}>
            <Bell size={13} style={{ display: 'inline', marginRight: 5 }} />Follow-ups
            {overdue.length > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: '#fb7185', color: 'white', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{overdue.length}</span>
            )}
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 36px' }}>

        {/* Stats strip */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {stats.map(s => (
            <div key={s.status} style={{ flex: 1, minWidth: 120, background: 'rgba(255,255,255,0.03)', border: `1px solid ${s.color}25`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.count}</div>
              <div style={{ fontSize: 11, color: 'rgb(120,127,160)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
          <div style={{ flex: 1, minWidth: 120, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(251,113,133,0.2)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#fb7185', lineHeight: 1 }}>{overdue.length}</div>
            <div style={{ fontSize: 11, color: 'rgb(120,127,160)', marginTop: 4 }}>Overdue follow-ups</div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgb(100,107,140)' }}>
            <Loader2 size={28} className="animate-spin mx-auto mb-3" style={{ color: '#a78bfa' }} />
            <div style={{ fontSize: 13 }}>Loading CRM…</div>
          </div>
        ) : view === 'pipeline' ? (
          /* ── Pipeline view ── */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, alignItems: 'start' }}>
            {PIPELINE_STAGES.map(stage => {
              const stageLeads = leads.filter(l => l.status === stage.status)
              return (
                <div key={stage.status}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 999, background: stage.color }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{stage.label}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: stage.color, background: stage.bg, padding: '2px 8px', borderRadius: 999 }}>{stageLeads.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {stageLeads.length === 0 ? (
                      <div style={{ padding: '20px 14px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 12, textAlign: 'center', fontSize: 11, color: 'rgb(90,95,120)' }}>Empty</div>
                    ) : stageLeads.map(lead => (
                      <PipelineCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* ── Follow-ups view ── */
          <div style={{ maxWidth: 680 }}>
            {allFollowUps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Bell size={40} style={{ color: 'rgb(100,107,140)', margin: '0 auto 16px', display: 'block' }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 8 }}>No follow-ups scheduled</div>
                <div style={{ fontSize: 12, color: 'rgb(100,107,140)', lineHeight: 1.7 }}>
                  Open any lead in the pipeline and log a Follow-up activity to schedule a reminder.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {overdue.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <AlertCircle size={14} color="#fb7185" />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#fb7185', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Overdue · {overdue.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {overdue.map(a => (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(251,65,133,0.06)', border: '1px solid rgba(251,65,133,0.2)', borderRadius: 12, padding: '12px 14px' }}>
                          <Bell size={14} color="#fb7185" style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 2 }}>{a.lead.company_name}</div>
                            <div style={{ fontSize: 12, color: 'rgb(200,205,225)' }}>{a.content}</div>
                            <div style={{ fontSize: 10, color: '#fb7185', marginTop: 2 }}>Due: {formatDate(a.scheduled_at!)}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button onClick={() => setSelectedLead(a.lead as LeadWithActivity)}
                              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgb(160,165,195)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                              Open
                            </button>
                            <button onClick={() => completeFollowUp(a.id)}
                              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.1)', color: '#34d399', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={12} /> Done
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {upcoming.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <Clock size={14} color="#fbbf24" />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Upcoming · {upcoming.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {upcoming.map(a => (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 12, padding: '12px 14px' }}>
                          <Clock size={14} color="#fbbf24" style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 2 }}>{a.lead.company_name}</div>
                            <div style={{ fontSize: 12, color: 'rgb(200,205,225)' }}>{a.content}</div>
                            <div style={{ fontSize: 10, color: '#fbbf24', marginTop: 2 }}>Due: {formatDate(a.scheduled_at!)}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button onClick={() => setSelectedLead(a.lead as LeadWithActivity)}
                              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgb(160,165,195)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                              Open
                            </button>
                            <button onClick={() => completeFollowUp(a.id)}
                              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.1)', color: '#34d399', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={12} /> Done
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lead flyout */}
      {selectedLead && (
        <LeadFlyout
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onActivityAdded={loadData}
          onStatusChange={moveStage}
        />
      )}

      {/* Add activity modal (triggered from elsewhere) */}
      {showAddActivity && (
        <AddActivityModal
          lead={showAddActivity}
          onClose={() => setShowAddActivity(null)}
          onSaved={loadData}
        />
      )}
    </div>
  )
}
