// ============================================================
// Agent Activity Log — global singleton event store
// Tracks every tool call the BD agent makes, visible in the
// floating Activity Log panel.
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
  timestamp: number          // Date.now()
  tool: ToolName
  action: string             // e.g. "Research Company"
  page: string               // e.g. "Lead Detail — Hyperbridge"
  status: 'pending' | 'success' | 'error'
  duration?: number          // ms
  detail?: string            // brief outcome or error snippet
}

type Listener = (events: ActivityEvent[]) => void

class AgentActivityStore {
  private _events: ActivityEvent[] = []
  private _listeners: Set<Listener> = new Set()

  /** Emit a pending event, returns its id so you can resolve it later */
  start(event: Omit<ActivityEvent, 'id' | 'status'>): string {
    const id = Math.random().toString(36).slice(2, 10)
    const newEvent: ActivityEvent = { ...event, id, status: 'pending' }
    this._events = [newEvent, ...this._events].slice(0, 100)
    this._notify()
    return id
  }

  /** Resolve a pending event once the API call completes */
  finish(id: string, status: 'success' | 'error', detail?: string, durationMs?: number) {
    this._events = this._events.map(e =>
      e.id === id ? { ...e, status, detail, duration: durationMs } : e
    )
    this._notify()
  }

  /** Shorthand: emit + immediately resolve (for synchronous or fire-and-forget events) */
  log(event: Omit<ActivityEvent, 'id' | 'status'> & { status?: ActivityEvent['status']; detail?: string }) {
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
    return () => this._listeners.delete(listener)
  }

  private _notify() {
    const snapshot = this.events
    this._listeners.forEach(l => l(snapshot))
  }
}

// Module-level singleton — persists across Next.js page navigation
export const agentActivity = new AgentActivityStore()

// ── Tool metadata (colours + icons used in the panel) ─────────

export const TOOL_META: Record<ToolName, { color: string; bg: string; label: string }> = {
  Claude:         { color: '#a78bfa', bg: 'rgba(167,139,250,0.14)', label: 'Claude' },
  OpenAI:         { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  label: 'OpenAI' },
  Apollo:         { color: '#fb923c', bg: 'rgba(251,146,60,0.14)',   label: 'Apollo' },
  Hunter:         { color: '#f472b6', bg: 'rgba(244,114,182,0.14)',  label: 'Hunter' },
  Exa:            { color: '#38bdf8', bg: 'rgba(56,189,248,0.13)',   label: 'Exa' },
  Tavily:         { color: '#fbbf24', bg: 'rgba(251,191,36,0.13)',   label: 'Tavily' },
  Supabase:       { color: '#3ecf8e', bg: 'rgba(62,207,142,0.12)',   label: 'Supabase' },
  ContactFinder:  { color: '#22d3ee', bg: 'rgba(34,211,238,0.13)',   label: 'Contacts' },
  System:         { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',   label: 'System' },
}

// ── Helper: infer primary tool from /api/ai/research action ───

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
