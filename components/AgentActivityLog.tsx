'use client'

import { useEffect, useRef, useState } from 'react'
import { agentActivity, TOOL_META, type ActivityEvent } from '@/lib/agent-activity'
import { Activity, ChevronDown, ChevronUp, X, Trash2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

function timeAgo(ts: number) {
  const d = Date.now() - ts
  if (d < 3000)  return 'just now'
  if (d < 60000) return `${Math.round(d / 1000)}s ago`
  if (d < 3600000) return `${Math.round(d / 60000)}m ago`
  return `${Math.round(d / 3600000)}h ago`
}

function EventRow({ ev }: { ev: ActivityEvent }) {
  const meta = TOOL_META[ev.tool]
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      {/* Tool pill */}
      <span style={{
        flexShrink: 0, fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
        padding: '2px 7px', borderRadius: 5, marginTop: 1,
        color: meta.color, background: meta.bg,
        border: `1px solid ${meta.color}30`,
      }}>
        {meta.label.toUpperCase()}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgb(220,225,245)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {ev.action}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            {ev.status === 'pending' && <Loader2 size={11} style={{ color: meta.color }} className="animate-spin" />}
            {ev.status === 'success' && <CheckCircle2 size={11} color="#34d399" />}
            {ev.status === 'error'   && <AlertCircle  size={11} color="#f87171" />}
            {ev.duration != null && (
              <span style={{ fontSize: 10, color: 'rgb(120,130,160)', fontFamily: 'monospace' }}>
                {ev.duration < 1000 ? `${ev.duration}ms` : `${(ev.duration / 1000).toFixed(1)}s`}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: 10, color: 'rgb(100,107,140)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {ev.page}
          </span>
          <span style={{ fontSize: 9, color: 'rgb(80,87,120)', flexShrink: 0 }}>
            {timeAgo(ev.timestamp)}
          </span>
        </div>

        {ev.detail && (
          <div style={{ marginTop: 3, fontSize: 10, color: ev.status === 'error' ? '#f87171' : 'rgb(130,140,180)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ev.detail}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AgentActivityLog() {
  const [enabled, setEnabled] = useState(false)
  const [minimised, setMinimised] = useState(false)
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const listRef = useRef<HTMLDivElement>(null)

  // Read setting from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('bd_show_activity_log')
    setEnabled(stored === 'true')

    const handler = () => {
      const v = localStorage.getItem('bd_show_activity_log')
      setEnabled(v === 'true')
    }
    window.addEventListener('bd_activity_log_toggle', handler)
    return () => window.removeEventListener('bd_activity_log_toggle', handler)
  }, [])

  // Subscribe to activity store
  useEffect(() => {
    const unsub = agentActivity.subscribe(setEvents)
    return () => { unsub() }
  }, [])

  if (!enabled) return null

  const pendingCount = events.filter(e => e.status === 'pending').length

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 9990,
      width: 390, borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.1)',
      background: 'linear-gradient(180deg, rgba(14,16,26,0.98), rgba(10,11,18,0.98))',
      boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
      backdropFilter: 'blur(16px)',
      fontFamily: 'inherit',
      overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        borderBottom: minimised ? 'none' : '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(255,255,255,0.03)',
        cursor: 'default', userSelect: 'none',
      }}>
        <Activity size={13} color="#a78bfa" />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgb(210,215,240)', flex: 1 }}>
          Agent Activity Log
        </span>

        {/* Live indicator */}
        {pendingCount > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#fbbf24', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 5, padding: '1px 7px' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fbbf24', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
            {pendingCount} running
          </span>
        )}

        {events.length > 0 && (
          <span style={{ fontSize: 10, color: 'rgb(100,107,140)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, padding: '1px 7px' }}>
            {events.length}
          </span>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
          <button onClick={() => agentActivity.clear()} title="Clear log"
            style={{ display: 'flex', alignItems: 'center', padding: '3px 5px', borderRadius: 5, background: 'none', border: 'none', color: 'rgb(100,107,140)', cursor: 'pointer' }}>
            <Trash2 size={11} />
          </button>
          <button onClick={() => setMinimised(m => !m)} title={minimised ? 'Expand' : 'Minimise'}
            style={{ display: 'flex', alignItems: 'center', padding: '3px 5px', borderRadius: 5, background: 'none', border: 'none', color: 'rgb(100,107,140)', cursor: 'pointer' }}>
            {minimised ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button onClick={() => {
              localStorage.setItem('bd_show_activity_log', 'false')
              window.dispatchEvent(new Event('bd_activity_log_toggle'))
            }}
            title="Close"
            style={{ display: 'flex', alignItems: 'center', padding: '3px 5px', borderRadius: 5, background: 'none', border: 'none', color: 'rgb(100,107,140)', cursor: 'pointer' }}>
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Event list */}
      {!minimised && (
        <div ref={listRef} style={{ maxHeight: 420, overflowY: 'auto' }}>
          {events.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center' }}>
              <Activity size={22} style={{ margin: '0 auto 8px', opacity: 0.2 }} />
              <div style={{ fontSize: 12, color: 'rgb(100,107,140)' }}>No activity yet</div>
              <div style={{ fontSize: 11, color: 'rgb(70,77,110)', marginTop: 4 }}>Click any AI button to see tool calls here</div>
            </div>
          ) : (
            events.map(ev => <EventRow key={ev.id} ev={ev} />)
          )}
        </div>
      )}

      {/* Tool legend footer */}
      {!minimised && events.length > 0 && (
        <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(Object.entries(TOOL_META) as [string, typeof TOOL_META[keyof typeof TOOL_META]][])
            .filter(([key]) => events.some(e => e.tool === key))
            .map(([key, meta]) => {
              const count = events.filter(e => e.tool === key).length
              return (
                <span key={key} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, color: meta.color, background: meta.bg, border: `1px solid ${meta.color}25` }}>
                  {meta.label} ×{count}
                </span>
              )
            })}
        </div>
      )}
    </div>
  )
}
