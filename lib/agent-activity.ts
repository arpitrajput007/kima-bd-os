// ============================================================
// Agent Activity Log — global singleton event store
//
// KEY DESIGN: agentActivity is a Proxy that resolves EVERY method
// call to window.__agentActivity at invocation time (not module-load
// time). This is immune to Next.js code-splitting — each route chunk
// may evaluate this module independently, but all method calls
// always hit the same window object.
// ============================================================

export type ToolName =
  | 'Claude'
  | 'OpenAI'
  | 'Apollo'
  | 'Hunter'
  | 'Exa'
  | 'Tavily'
  | 'Supabase'
  | 'ContactFinder'
  | 'System'

export interface ActivityEvent {
  id: string
  timestamp: number
  tool: ToolName
  action: string
  page: string
  status: 'pending' | 'success' | 'error'
  duration?: number
  detail?: string
}

type Listener = (events: ActivityEvent[]) => void

class AgentActivityStore {
  private _events: ActivityEvent[] = []
  private _listeners: Set<Listener> = new Set()

  start(event: Omit<ActivityEvent, 'id' | 'status'>): string {
    const id = Math.random().toString(36).slice(2, 10)
    const newEvent: ActivityEvent = { ...event, id, status: 'pending' }
    this._events = [newEvent, ...this._events].slice(0, 100)
    this._notify()
    return id
  }

  finish(id: string, status: 'success' | 'error', detail?: string, durationMs?: number) {
    this._events = this._events.map(e =>
      e.id === id ? { ...e, status, detail, duration: durationMs } : e
    )
    this._notify()
  }

  log(event: Omit<ActivityEvent, 'id' | 'status'> & { status?: ActivityEvent['status'] }) {
    const id = Math.random().toString(36).slice(2, 10)
    const newEvent: ActivityEvent = { ...event, id, status: event.status ?? 'success' }
    this._events = [newEvent, ...this._events].slice(0, 100)
    this._notify()
    return id
  }

  clear() { this._events = []; this._notify() }

  get events() { return [...this._events] }

  subscribe(listener: Listener) {
    this._listeners.add(listener)
    listener(this.events)
    return () => { this._listeners.delete(listener) }
  }

  private _notify() {
    const snapshot = this.events
    this._listeners.forEach(l => l(snapshot))
    // Also broadcast via window event — panel listens to this,
    // guaranteeing delivery even if subscription is on a different instance
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('__bd_activity_update', { detail: snapshot })
      )
    }
  }
}

// ── Always-fresh singleton via window ────────────────────────
declare global {
  interface Window { __agentActivity?: AgentActivityStore }
}

function liveStore(): AgentActivityStore {
  if (typeof window === 'undefined') {
    // SSR path — return a silent no-op store (events are never shown server-side)
    return new AgentActivityStore()
  }
  if (!window.__agentActivity) {
    window.__agentActivity = new AgentActivityStore()
  }
  return window.__agentActivity
}

// Proxy: every property access resolves to window.__agentActivity at
// CALL TIME, not at module-evaluation time. This means:
//   agentActivity.start(...)  →  liveStore().start(...)
//   agentActivity.subscribe() →  liveStore().subscribe()
// No stale reference possible, regardless of chunk load order.
export const agentActivity = new Proxy({} as AgentActivityStore, {
  get(_target, prop: string) {
    const store = liveStore()
    const val = (store as unknown as Record<string, unknown>)[prop]
    return typeof val === 'function' ? (val as Function).bind(store) : val
  },
})

// ── Tool metadata ─────────────────────────────────────────────

export const TOOL_META: Record<ToolName, { color: string; bg: string; label: string }> = {
  Claude:         { color: '#a78bfa', bg: 'rgba(167,139,250,0.14)', label: 'Claude' },
  OpenAI:         { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  label: 'OpenAI' },
  Apollo:         { color: '#fb923c', bg: 'rgba(251,146,60,0.14)',  label: 'Apollo' },
  Hunter:         { color: '#f472b6', bg: 'rgba(244,114,182,0.14)', label: 'Hunter' },
  Exa:            { color: '#38bdf8', bg: 'rgba(56,189,248,0.13)',  label: 'Exa' },
  Tavily:         { color: '#fbbf24', bg: 'rgba(251,191,36,0.13)',  label: 'Tavily' },
  Supabase:       { color: '#3ecf8e', bg: 'rgba(62,207,142,0.12)',  label: 'Supabase' },
  ContactFinder:  { color: '#22d3ee', bg: 'rgba(34,211,238,0.13)',  label: 'Contacts' },
  System:         { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  label: 'System' },
}

export const ACTION_TOOL: Record<string, ToolName> = {
  research:     'Claude',
  classify:     'Claude',
  kima_fit:     'Claude',
  aeredium_fit: 'Claude',
  score:        'Claude',
  contacts:     'ContactFinder',
  pain_points:  'Claude',
}

export const ACTION_LABEL: Record<string, string> = {
  research:     'Research Company',
  classify:     'Classify Lead',
  kima_fit:     'Kima Fit Analysis',
  aeredium_fit: 'Aeredium Fit Analysis',
  score:        'Score Lead',
  contacts:     'Find Contacts',
  pain_points:  'Identify Pain Points',
}
