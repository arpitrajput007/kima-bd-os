// ============================================================
// Shared "which sources did I check?" selection — lets a manual
// pick made on the Sources page survive navigation to Today's Plan,
// so "Fetch fresh leads" there can run just that subset instead of
// every active/due source. Plain localStorage, no DB round-trip
// needed for what's just a same-browser UI convenience.
// ============================================================

const KEY = 'bd_selected_source_ids'

export function getSelectedSourceIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function setSelectedSourceIds(ids: string[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(ids))
}

export function clearSelectedSourceIds(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY)
}
