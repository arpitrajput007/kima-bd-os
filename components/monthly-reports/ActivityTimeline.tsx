'use client'

import { useState } from 'react'
import { Loader2, Plus, Calendar, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ACTIVITY_TYPES, OUTREACH_CHANNELS, activityTypeMeta } from '@/lib/monthly-reports-types'
import type { DealActivity, ActivityTypeValue } from '@/lib/monthly-reports-types'

export interface NewActivityInput {
  activity_type: ActivityTypeValue
  content?: string
  channel?: string
  next_follow_up_date?: string
}

interface Props {
  activities: DealActivity[]
  saving: boolean
  onAdd: (input: NewActivityInput) => void
}

const inputCls = "w-full rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 transition-all"
const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', '--tw-ring-color': 'rgba(167,139,250,0.4)' } as React.CSSProperties

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ActivityTimeline({ activities, saving, onAdd }: Props) {
  const [type, setType] = useState<ActivityTypeValue>('note')
  const [content, setContent] = useState('')
  const [channel, setChannel] = useState('')
  const [nextFollowUp, setNextFollowUp] = useState('')

  const needsChannel  = ['email', 'linkedin', 'twitter', 'telegram', 'call'].includes(type)
  const needsFollowUp = type === 'follow_up'

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() && !needsFollowUp) return
    onAdd({
      activity_type: type,
      content: content.trim() || undefined,
      channel: needsChannel ? (channel || undefined) : undefined,
      next_follow_up_date: needsFollowUp ? (nextFollowUp || undefined) : undefined,
    })
    setContent('')
    if (needsFollowUp) setNextFollowUp('')
  }

  const sorted = [...activities].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  return (
    <div className="space-y-4">
      {/* ── Add activity ──────────────────────────────── */}
      <form onSubmit={submit} className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex flex-wrap gap-2">
          {ACTIVITY_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
              style={type === t.value
                ? { background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(167,139,250,0.5)', color: '#a78bfa' }
                : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgb(130,130,160)' }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={2}
          placeholder={needsFollowUp ? 'What needs to happen on the follow-up…' : 'Add a note…'}
          className={inputCls}
          style={{ ...inputStyle, resize: 'vertical' }}
        />

        <div className="flex flex-wrap items-center gap-3">
          {needsChannel && (
            <select value={channel} onChange={e => setChannel(e.target.value)} className={cn(inputCls, 'w-auto')} style={inputStyle}>
              <option value="">Channel…</option>
              {OUTREACH_CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          )}
          {needsFollowUp && (
            <input
              type="date"
              value={nextFollowUp}
              onChange={e => setNextFollowUp(e.target.value)}
              className={cn(inputCls, 'w-auto')}
              style={inputStyle}
            />
          )}
          <button
            type="submit"
            disabled={saving || (!content.trim() && !needsFollowUp)}
            className="btn btn-ai ml-auto"
            style={{ fontSize: '12px', gap: '6px' }}
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}Log Activity
          </button>
        </div>
      </form>

      {/* ── Timeline ──────────────────────────────────── */}
      {sorted.length === 0 ? (
        <p className="text-xs text-center py-6" style={{ color: 'rgb(90,90,110)' }}>No activity logged yet.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map(a => {
            const meta = activityTypeMeta(a.activity_type)
            return (
              <div key={a.id} className="rounded-lg p-3 flex gap-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex-shrink-0 pt-0.5">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
                    {meta.label}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  {a.content && <p className="text-xs" style={{ color: 'rgb(190,190,215)' }}>{a.content}</p>}
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-[10px] flex items-center gap-1" style={{ color: 'rgb(90,90,110)' }}>
                      <Clock size={9} />{fmtDate(a.created_at)}
                    </span>
                    {a.channel && (
                      <span className="text-[10px]" style={{ color: 'rgb(110,110,140)' }}>via {a.channel}</span>
                    )}
                    {a.next_follow_up_date && (
                      <span className="text-[10px] flex items-center gap-1" style={{ color: '#fbbf24' }}>
                        <Calendar size={9} />Next: {new Date(a.next_follow_up_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
