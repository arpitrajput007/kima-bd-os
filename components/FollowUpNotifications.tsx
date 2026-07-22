'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { Bell, X, CheckCircle2, ArrowRight, ChevronLeft, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { getActor } from '@/lib/actor'

// ── Snooze persistence (survives page loads/navigation) ────────────────────
const SNOOZE_KEY = 'kima_followup_snooze_until'

function isSnoozed(): boolean {
  if (typeof window === 'undefined') return false
  const until = localStorage.getItem(SNOOZE_KEY)
  return !!until && new Date(until).getTime() > Date.now()
}

// ── Types ──────────────────────────────────────────────────────────────────
interface OverdueLead {
  id: string
  company_name: string
  last_channel: string | null
  next_follow_up_at: string
  last_contacted_at: string | null
  status: string | null
}

// ── Reschedule options ─────────────────────────────────────────────────────
const SNOOZE_OPTS = [
  { label: '1d',     days: 1  },
  { label: '2d',     days: 2  },
  { label: '3d',     days: 3  },
  { label: '5d',     days: 5  },
  { label: '7d',     days: 7  },
  { label: '2 weeks',days: 14 },
  { label: '1 month',days: 30 },
  { label: 'Never',  days: -1 },
]

// ── Helpers ────────────────────────────────────────────────────────────────
function timeOverdueLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0)             return 'due now'
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (d >= 1) return `${d}d overdue`
  if (h >= 1) return `${h}h overdue`
  return 'due now'
}

const CHANNEL_LABEL: Record<string, string> = {
  telegram: 'Telegram', linkedin: 'LinkedIn', twitter: 'Twitter/X',
  email: 'Email', discord: 'Discord', call: 'Call',
}

// ── Single notification card ───────────────────────────────────────────────
function NotifCard({
  lead,
  onDismiss,
  onRescheduled,
}: {
  lead: OverdueLead
  onDismiss: (id: string) => void
  onRescheduled: (id: string, days: number) => Promise<void>
}) {
  const [mode, setMode]   = useState<'idle' | 'pick' | 'saving'>('idle')

  const handlePick = async (days: number) => {
    setMode('saving')
    await onRescheduled(lead.id, days)
    // card disappears after parent removes it from state
  }

  return (
    <div style={{
      width: 330,
      borderRadius: 14,
      border: '1px solid rgba(167,139,250,0.22)',
      background: 'linear-gradient(160deg, rgba(22,23,38,0.99), rgba(14,15,26,0.99))',
      boxShadow: '0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(167,139,250,0.06)',
      backdropFilter: 'blur(20px)',
      animation: 'slideInRight 0.28s ease-out forwards',
      overflow: 'hidden',
    }}>
      {/* ── amber top bar ── */}
      <div style={{
        height: 3,
        background: 'linear-gradient(90deg, #fbbf24, rgba(251,191,36,0.3))',
      }} />

      <div style={{ padding: '13px 14px 13px' }}>
        {/* ── IDLE mode ── */}
        {mode === 'idle' && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 11 }}>
              {/* icon */}
              <div style={{
                flexShrink: 0, width: 32, height: 32, borderRadius: 9,
                background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bell size={14} color="#fbbf24" />
              </div>

              {/* text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lead.company_name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {lead.last_channel && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 4,
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'rgb(160,165,200)',
                    }}>
                      {CHANNEL_LABEL[lead.last_channel] ?? lead.last_channel}
                    </span>
                  )}
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24' }}>
                    {timeOverdueLabel(lead.next_follow_up_at)}
                  </span>
                </div>
              </div>

              {/* dismiss */}
              <button
                onClick={() => onDismiss(lead.id)}
                title="Dismiss until next page load"
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.22)', cursor: 'pointer', padding: 3, flexShrink: 0, lineHeight: 0 }}
              >
                <X size={13} />
              </button>
            </div>

            {/* actions */}
            <div style={{ display: 'flex', gap: 7 }}>
              <button
                onClick={() => setMode('pick')}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.28)',
                  color: '#34d399', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <CheckCircle2 size={12} /> Follow Up Done
              </button>
              <a
                href={`/leads/${lead.id}`}
                style={{
                  padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.18)',
                  color: '#a78bfa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none',
                }}
              >
                View <ArrowRight size={11} />
              </a>
            </div>
          </>
        )}

        {/* ── PICK mode: reschedule ── */}
        {mode === 'pick' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
              <button
                onClick={() => setMode('idle')}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 2, lineHeight: 0 }}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>
                When&apos;s the next follow-up?
              </span>
            </div>
            <div style={{ fontSize: 10, color: 'rgb(120,125,160)', marginBottom: 9 }}>
              {lead.company_name} · pick a date or clear it
            </div>
            {/* grid: 4 per row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 6 }}>
              {SNOOZE_OPTS.slice(0, 4).map(o => (
                <button key={o.days} onClick={() => handlePick(o.days)} style={{
                  padding: '7px 0', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgb(190,195,225)', fontFamily: 'inherit',
                }}>
                  {o.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {SNOOZE_OPTS.slice(4).map(o => (
                <button key={o.days} onClick={() => handlePick(o.days)} style={{
                  padding: '7px 0', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  background: o.days === -1 ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${o.days === -1 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.1)'}`,
                  color: o.days === -1 ? '#f87171' : 'rgb(190,195,225)', fontFamily: 'inherit',
                }}>
                  {o.label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── SAVING mode ── */}
        {mode === 'saving' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 2px' }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle2 size={14} color="#34d399" />
            </div>
            <span style={{ fontSize: 12, color: 'rgb(180,185,220)' }}>Saving follow-up…</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function FollowUpNotifications() {
  const supabase   = createClient()
  const [mounted,  setMounted]  = useState(false)
  const [leads,    setLeads]    = useState<OverdueLead[]>([])
  const [dismissed,setDismissed]= useState<Set<string>>(new Set())
  const [snoozed,  setSnoozed]  = useState(false)
  const timerRef   = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => { setMounted(true); setSnoozed(isSnoozed()) }, [])

  const fetchOverdue = useCallback(async () => {
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('leads')
      .select('id, company_name, last_channel, next_follow_up_at, last_contacted_at, status')
      .not('next_follow_up_at', 'is', null)
      .lte('next_follow_up_at', now)
      .not('status', 'in', '("won","rejected","archived")')
      .order('next_follow_up_at', { ascending: true })
      .limit(10)
    if (data) setLeads(data as OverdueLead[])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (snoozed) return
    fetchOverdue()
    timerRef.current = setInterval(fetchOverdue, 60_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fetchOverdue, snoozed])

  const dismiss = (id: string) => {
    setDismissed(prev => new Set([...prev, id]))
  }

  const dismissAll = () => {
    setDismissed(prev => new Set([...prev, ...leads.map(l => l.id)]))
  }

  const snooze24h = () => {
    const until = new Date(Date.now() + 24 * 3_600_000).toISOString()
    try { localStorage.setItem(SNOOZE_KEY, until) } catch { /* ignore storage errors */ }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setSnoozed(true)
    toast.success('Follow-up reminders snoozed for 24 hours')
  }

  const reschedule = async (id: string, days: number) => {
    const lead = leads.find(l => l.id === id)
    if (!lead) return

    const now   = new Date()
    const nowTs = now.toISOString()

    if (days === -1) {
      // Never — wipe the follow-up date
      await supabase.from('leads').update({
        next_follow_up_at: null,
        updated_at: nowTs,
      }).eq('id', id)

      await supabase.from('lead_activities').insert({
        lead_id: id,
        type: 'email',
        channel: lead.last_channel || 'follow_up',
        content: 'Follow-up done — no further reminder set',
        performed_by: getActor(),
      })

      toast.success(`${lead.company_name} — follow-up cleared`)
    } else {
      const nextAt   = new Date(now.getTime() + days * 86_400_000)
      const nextAtTs = nextAt.toISOString()

      await supabase.from('leads').update({
        next_follow_up_at: nextAtTs,
        last_contacted_at: nowTs,
        updated_at: nowTs,
      }).eq('id', id)

      await supabase.from('lead_activities').insert({
        lead_id: id,
        type: 'email',
        channel: lead.last_channel || 'follow_up',
        content: `Follow-up done — next reminder in ${days} day${days === 1 ? '' : 's'}`,
        follow_up_at: nextAtTs,
        performed_by: getActor(),
      })

      toast.success(`✓ Next follow-up for ${lead.company_name} in ${days}d`)
    }

    // Remove from visible list immediately
    setLeads(prev => prev.filter(l => l.id !== id))
  }

  const visible = leads.filter(l => !dismissed.has(l.id))

  if (!mounted || snoozed || visible.length === 0) return null

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 48,        // just below the 38px top-banner + a little gap
      right: 20,
      zIndex: 9995,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      maxHeight: 'calc(100vh - 70px)',
      overflowY: 'auto',
      overflowX: 'visible',
      paddingBottom: 4,
      // hide scrollbar but keep scrollability
      msOverflowStyle: 'none',
    } as React.CSSProperties}>
      {/* ── header: snooze / hide all ── */}
      <div style={{ width: 330, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          onClick={snooze24h}
          title="Don't show follow-up reminders for the next 24 hours"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 600,
            background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.28)',
            color: '#a78bfa', cursor: 'pointer', fontFamily: 'inherit',
            backdropFilter: 'blur(20px)',
          }}
        >
          <Clock size={12} /> Snooze 24h
        </button>
        <button
          onClick={dismissAll}
          title="Hide all overdue follow-ups until next page load"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 600,
            background: 'rgba(20,21,35,0.95)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgb(160,165,200)', cursor: 'pointer', fontFamily: 'inherit',
            backdropFilter: 'blur(20px)',
          }}
        >
          <X size={12} /> Hide all
        </button>
      </div>
      {visible.slice(0, 5).map(lead => (
        <NotifCard
          key={lead.id}
          lead={lead}
          onDismiss={dismiss}
          onRescheduled={reschedule}
        />
      ))}
      {visible.length > 5 && (
        <div style={{
          width: 330, padding: '8px 14px', borderRadius: 10, fontSize: 11, textAlign: 'center',
          background: 'rgba(20,21,35,0.95)', border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgb(140,145,175)',
        }}>
          +{visible.length - 5} more overdue follow-ups
        </div>
      )}
    </div>,
    document.body
  )
}
