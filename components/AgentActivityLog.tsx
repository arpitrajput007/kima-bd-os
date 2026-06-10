'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { agentActivity, TOOL_META, type ActivityEvent } from '@/lib/agent-activity'
import {
  Activity, ChevronDown, ChevronUp, X, Trash2,
  Loader2, CheckCircle2, AlertCircle, GripHorizontal,
} from 'lucide-react'

/* ── helpers ─────────────────────────────────────────────────── */

function timeAgo(ts: number) {
  const d = Date.now() - ts
  if (d < 3000) return 'just now'
  if (d < 60000) return `${Math.round(d / 1000)}s ago`
  if (d < 3600000) return `${Math.round(d / 60000)}m ago`
  return `${Math.round(d / 3600000)}h ago`
}

/* ── single event row ────────────────────────────────────────── */

function EventRow({ ev }: { ev: ActivityEvent }) {
  const meta = TOOL_META[ev.tool]
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,0.045)',
    }}>
      <span style={{
        flexShrink: 0, fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
        padding: '2px 7px', borderRadius: 5, marginTop: 1,
        color: meta.color, background: meta.bg, border: `1px solid ${meta.color}30`,
      }}>
        {meta.label.toUpperCase()}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgb(220,225,245)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ev.action}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            {ev.status === 'pending' && (
              <Loader2 size={11} style={{ color: meta.color, animation: 'spin 1s linear infinite' }} />
            )}
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
          <span style={{ fontSize: 9, color: 'rgb(75,82,115)', flexShrink: 0 }}>
            {timeAgo(ev.timestamp)}
          </span>
        </div>

        {ev.detail && (
          <div style={{
            marginTop: 3, fontSize: 10, lineHeight: 1.4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: ev.status === 'error' ? '#f87171' : 'rgb(120,130,170)',
          }}>
            {ev.detail}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── main panel ──────────────────────────────────────────────── */

export default function AgentActivityLog() {
  const [enabled,   setEnabled]   = useState(false)
  const [minimised, setMinimised] = useState(false)
  const [events,    setEvents]    = useState<ActivityEvent[]>([])

  // drag state
  const panelRef   = useRef<HTMLDivElement>(null)
  const [pos,      setPos]      = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragOff    = useRef({ x: 0, y: 0 })

  // ── localStorage toggle ──────────────────────────────────────
  useEffect(() => {
    setEnabled(localStorage.getItem('bd_show_activity_log') === 'true')
    const handler = () => setEnabled(localStorage.getItem('bd_show_activity_log') === 'true')
    window.addEventListener('bd_activity_log_toggle', handler)
    return () => window.removeEventListener('bd_activity_log_toggle', handler)
  }, [])

  // ── store subscription + window event (dual approach) ────────
  // The store subscription handles same-chunk updates.
  // The window event handles cross-chunk updates (Next.js code-splitting
  // can cause separate module instances; window is always the same object).
  useEffect(() => {
    // Seed with whatever is already in the store
    setEvents(agentActivity.events)

    // Window event: fired by AgentActivityStore._notify() in ANY chunk
    const onWindowEvent = (e: Event) => {
      setEvents((e as CustomEvent<ActivityEvent[]>).detail)
    }
    window.addEventListener('__bd_activity_update', onWindowEvent)

    // Also subscribe via store in case same instance
    const unsub = agentActivity.subscribe(setEvents)

    return () => {
      window.removeEventListener('__bd_activity_update', onWindowEvent)
      unsub()
    }
  }, [])

  // ── drag: start ───────────────────────────────────────────────
  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return // don't drag if clicking a button
    e.preventDefault()
    const rect = panelRef.current!.getBoundingClientRect()
    dragOff.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    // Snap to absolute top/left on first drag
    setPos({ x: rect.left, y: rect.top })
    setDragging(true)
  }, [])

  // ── drag: move + release ──────────────────────────────────────
  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const x = Math.max(0, Math.min(e.clientX - dragOff.current.x, window.innerWidth  - (panelRef.current?.offsetWidth  ?? 390)))
      const y = Math.max(0, Math.min(e.clientY - dragOff.current.y, window.innerHeight - (panelRef.current?.offsetHeight ?? 100)))
      setPos({ x, y })
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [dragging])

  if (!enabled) return null

  const pendingCount = events.filter(e => e.status === 'pending').length

  // position: default bottom-right, dragged to absolute pos
  const posStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y }
    : { bottom: 20, right: 20 }

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        ...posStyle,
        zIndex: 9990,
        width: 390,
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'linear-gradient(180deg, rgba(14,16,28,0.98), rgba(9,10,18,0.99))',
        boxShadow: '0 24px 60px rgba(0,0,0,0.75)',
        backdropFilter: 'blur(18px)',
        fontFamily: 'inherit',
        overflow: 'hidden',
        userSelect: dragging ? 'none' : 'auto',
      }}
    >
      {/* ── header / drag handle ─────────────────────────────── */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px 10px 14px',
          borderBottom: minimised ? 'none' : '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(255,255,255,0.025)',
          cursor: dragging ? 'grabbing' : 'grab',
        }}
      >
        <GripHorizontal size={12} color="rgba(255,255,255,0.2)" style={{ flexShrink: 0 }} />
        <Activity size={13} color="#a78bfa" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgb(210,215,240)', flex: 1 }}>
          Agent Activity Log
        </span>

        {pendingCount > 0 && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 700, color: '#fbbf24',
            background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)',
            borderRadius: 5, padding: '1px 7px',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }} />
            {pendingCount} running
          </span>
        )}

        {events.length > 0 && (
          <span style={{
            fontSize: 10, color: 'rgb(100,107,140)',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 5, padding: '1px 7px',
          }}>
            {events.length}
          </span>
        )}

        <div style={{ display: 'flex', gap: 2, marginLeft: 2 }}>
          <button
            onClick={() => agentActivity.clear()}
            title="Clear log"
            style={{ display: 'flex', padding: '4px 6px', borderRadius: 5, background: 'none', border: 'none', color: 'rgb(90,97,130)', cursor: 'pointer' }}
          >
            <Trash2 size={11} />
          </button>
          <button
            onClick={() => setMinimised(m => !m)}
            title={minimised ? 'Expand' : 'Minimise'}
            style={{ display: 'flex', padding: '4px 6px', borderRadius: 5, background: 'none', border: 'none', color: 'rgb(90,97,130)', cursor: 'pointer' }}
          >
            {minimised ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button
            onClick={() => {
              localStorage.setItem('bd_show_activity_log', 'false')
              window.dispatchEvent(new Event('bd_activity_log_toggle'))
            }}
            title="Close"
            style={{ display: 'flex', padding: '4px 6px', borderRadius: 5, background: 'none', border: 'none', color: 'rgb(90,97,130)', cursor: 'pointer' }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ── event list ───────────────────────────────────────── */}
      {!minimised && (
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {events.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <Activity size={24} style={{ margin: '0 auto 10px', opacity: 0.15 }} />
              <div style={{ fontSize: 12, color: 'rgb(100,107,140)' }}>No activity yet</div>
              <div style={{ fontSize: 11, color: 'rgb(65,72,100)', marginTop: 4 }}>
                Click any AI button on a lead to see tool calls here
              </div>
            </div>
          ) : (
            events.map(ev => <EventRow key={ev.id} ev={ev} />)
          )}
        </div>
      )}

      {/* ── tool usage legend ────────────────────────────────── */}
      {!minimised && events.length > 0 && (
        <div style={{
          padding: '8px 14px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexWrap: 'wrap', gap: 5,
        }}>
          {(Object.entries(TOOL_META) as [string, typeof TOOL_META[keyof typeof TOOL_META]][])
            .filter(([key]) => events.some(e => e.tool === key))
            .map(([key, meta]) => {
              const count = events.filter(e => e.tool === key).length
              return (
                <span key={key} style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                  color: meta.color, background: meta.bg, border: `1px solid ${meta.color}25`,
                }}>
                  {meta.label} ×{count}
                </span>
              )
            })}
        </div>
      )}
    </div>
  )
}
