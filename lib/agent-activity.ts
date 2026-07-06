// Agent Activity Log
// Architecture: write to window.__bda (a plain object), panel polls it.
// Zero dependency on events, subscriptions, or module identity.

export type ToolName =
  | 'Claude' | 'OpenAI' | 'Apollo' | 'Hunter'
  | 'Exa' | 'Tavily' | 'Supabase' | 'ContactFinder' | 'System'

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

// ── Global store (plain window property) ──────────────────────
declare global {
  interface Window {
    __bda?: { events: ActivityEvent[]; v: number }
  }
}

function store() {
  if (typeof window === 'undefined') return { events: [] as ActivityEvent[], v: 0 }
  if (!window.__bda) window.__bda = { events: [], v: 0 }
  return window.__bda
}

// ── Public API ────────────────────────────────────────────────

export function actStart(event: Omit<ActivityEvent, 'id' | 'status'>): string {
  const id = Math.random().toString(36).slice(2, 10)
  const newEv: ActivityEvent = { ...event, id, status: 'pending' }
  const s = store()
  s.events = [newEv, ...s.events].slice(0, 100)
  s.v++
  return id
}

export function actFinish(
  id: string, status: 'success' | 'error',
  detail?: string, durationMs?: number
) {
  const s = store()
  s.events = s.events.map(e =>
    e.id === id ? { ...e, status, detail, duration: durationMs } : e
  )
  s.v++
}

export function actClear() {
  const s = store()
  s.events = []
  s.v++
}

// Kept for test-ping button in the panel
export const agentActivity = { start: actStart, finish: actFinish, clear: actClear }

// ── Tool metadata ─────────────────────────────────────────────

export const TOOL_META: Record<ToolName, { color: string; bg: string; label: string }> = {
  Claude:        { color: '#a78bfa', bg: 'rgba(167,139,250,0.14)', label: 'Claude' },
  OpenAI:        { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  label: 'OpenAI' },
  Apollo:        { color: '#fb923c', bg: 'rgba(251,146,60,0.14)',  label: 'Apollo' },
  Hunter:        { color: '#f472b6', bg: 'rgba(244,114,182,0.14)', label: 'Hunter' },
  Exa:           { color: '#38bdf8', bg: 'rgba(56,189,248,0.13)',  label: 'Exa' },
  Tavily:        { color: '#fbbf24', bg: 'rgba(251,191,36,0.13)',  label: 'Tavily' },
  Supabase:      { color: '#3ecf8e', bg: 'rgba(62,207,142,0.12)',  label: 'Supabase' },
  ContactFinder: { color: '#22d3ee', bg: 'rgba(34,211,238,0.13)',  label: 'Contacts' },
  System:        { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  label: 'System' },
}

export const ACTION_TOOL: Record<string, ToolName> = {
  research: 'Claude', classify: 'Claude', kima_fit: 'Claude',
  aeredium_fit: 'Claude', aerpolice_fit: 'Claude', score: 'Claude', contacts: 'ContactFinder', pain_points: 'Claude',
}

export const ACTION_LABEL: Record<string, string> = {
  research: 'Research Company', classify: 'Classify Lead',
  kima_fit: 'Kima Fit Analysis', aeredium_fit: 'Aeredium Fit Analysis', aerpolice_fit: 'Aerpolice Fit Analysis',
  score: 'Score Lead', contacts: 'Find Contacts', pain_points: 'Identify Pain Points',
}
