// ============================================================
// Agent Activity Log
//
// Architecture: every call (start / finish / clear) dispatches a
// CustomEvent on window. The panel listens to window events ONLY —
// zero dependency on module identity or singleton sharing.
//
// This is immune to Next.js code-splitting because window is always
// the single global object in the browser, regardless of how many
// JS chunks import this module.
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

// ── Event names ───────────────────────────────────────────────
const EV_ADD    = '__bda_add'    // new / updated event
const EV_FINISH = '__bda_finish' // resolve pending → success/error
const EV_CLEAR  = '__bda_clear'  // wipe all events

function dispatch(name: string, detail: unknown) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

// ── Public API ────────────────────────────────────────────────

/** Emit a pending event. Returns id so you can resolve it later. */
export function actStart(event: Omit<ActivityEvent, 'id' | 'status'>): string {
  const id = Math.random().toString(36).slice(2, 10)
  const ev: ActivityEvent = { ...event, id, status: 'pending' }
  dispatch(EV_ADD, ev)
  return id
}

/** Resolve a pending event to success or error. */
export function actFinish(
  id: string,
  status: 'success' | 'error',
  detail?: string,
  durationMs?: number
) {
  dispatch(EV_FINISH, { id, status, detail, duration: durationMs })
}

/** Wipe all events from the panel. */
export function actClear() {
  dispatch(EV_CLEAR, null)
}

// ── Keep the old agentActivity object for the test-ping button ─
// (the panel calls agentActivity.start() for its own test button)
export const agentActivity = { start: actStart, finish: actFinish, clear: actClear }

// ── useActivityLog hook — used ONLY in AgentActivityLog.tsx ───
// Manages the in-panel event list by listening to window events.
export function subscribeToActivityLog(
  onUpdate: (events: ActivityEvent[]) => void
): () => void {
  if (typeof window === 'undefined') return () => {}

  // Local event list (lives only in the panel's closure)
  let events: ActivityEvent[] = []

  const onAdd = (e: Event) => {
    const ev = (e as CustomEvent<ActivityEvent>).detail
    // Update existing (finish called before panel processes add) or prepend
    const idx = events.findIndex(x => x.id === ev.id)
    if (idx >= 0) {
      events = events.map((x, i) => i === idx ? ev : x)
    } else {
      events = [ev, ...events].slice(0, 100)
    }
    onUpdate([...events])
  }

  const onFinish = (e: Event) => {
    const { id, status, detail, duration } = (e as CustomEvent<{
      id: string; status: 'success' | 'error'; detail?: string; duration?: number
    }>).detail
    events = events.map(x => x.id === id ? { ...x, status, detail, duration } : x)
    onUpdate([...events])
  }

  const onClear = () => { events = []; onUpdate([]) }

  window.addEventListener(EV_ADD,    onAdd)
  window.addEventListener(EV_FINISH, onFinish)
  window.addEventListener(EV_CLEAR,  onClear)

  return () => {
    window.removeEventListener(EV_ADD,    onAdd)
    window.removeEventListener(EV_FINISH, onFinish)
    window.removeEventListener(EV_CLEAR,  onClear)
  }
}

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
