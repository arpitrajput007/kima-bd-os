import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Lead, LeadPriority, ScoreBreakdown } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getScoreColor(score: number): string {
  if (score >= 85) return 'text-violet-400'
  if (score >= 70) return 'text-emerald-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-rose-400'
}

export function getScoreBg(score: number): string {
  if (score >= 85) return 'bg-violet-500/15 text-violet-300 border-violet-500/30'
  if (score >= 70) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
  if (score >= 50) return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
  return 'bg-rose-500/15 text-rose-300 border-rose-500/30'
}

export function getPriorityLabel(score: number): LeadPriority {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'qualified'
  if (score >= 50) return 'needs_research'
  return 'low_priority'
}

export function getPriorityDisplay(priority: LeadPriority): string {
  switch (priority) {
    case 'excellent': return 'Excellent'
    case 'qualified': return 'Qualified'
    case 'needs_research': return 'Needs Research'
    case 'low_priority': return 'Low Priority'
  }
}

export function getStatusColor(status: Lead['status']): string {
  switch (status) {
    case 'new': return 'bg-blue-500/15 text-blue-300 border-blue-500/30'
    case 'researching': return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    case 'qualified': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    case 'approved': return 'bg-violet-500/15 text-violet-300 border-violet-500/30'
    case 'rejected': return 'bg-rose-500/15 text-rose-300 border-rose-500/30'
    case 'contacted': return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
    case 'replied': return 'bg-teal-500/15 text-teal-300 border-teal-500/30'
    case 'meeting_booked': return 'bg-green-500/15 text-green-300 border-green-500/30'
    case 'archived': return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
    case 'needs_more_research': return 'bg-orange-500/15 text-orange-300 border-orange-500/30'
    case 'reserved': return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
    default: return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
  }
}

export function getStatusLabel(status: Lead['status']): string {
  switch (status) {
    case 'new': return 'New'
    case 'researching': return 'Researching'
    case 'qualified': return 'Qualified'
    case 'approved': return 'Approved'
    case 'rejected': return 'Rejected'
    case 'contacted': return 'Contacted'
    case 'replied': return 'Replied'
    case 'meeting_booked': return 'Meeting Booked'
    case 'archived': return 'Archived'
    case 'needs_more_research': return 'Needs Research'
    case 'reserved': return 'Reserved'
    default: return status
  }
}

export function getSeverityColor(severity?: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-500/15 text-red-300 border-red-500/30'
    case 'high': return 'bg-orange-500/15 text-orange-300 border-orange-500/30'
    case 'medium': return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    case 'low': return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
    default: return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
  }
}

export function getConfidenceColor(confidence?: string): string {
  switch (confidence) {
    case 'high': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    case 'medium': return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    case 'low': return 'bg-rose-500/15 text-rose-300 border-rose-500/30'
    default: return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
  }
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function truncate(str: string, maxLength: number): string {
  if (!str) return ''
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '...'
}

export function isHttpUrl(v?: string | null): boolean {
  return !!v && /^https?:\/\//i.test(v.trim())
}

// True when the URL points to a specific page, not just a domain root.
function urlHasPath(v: string): boolean {
  try {
    const u = new URL(v.trim())
    return u.pathname.replace(/\/+$/, '').length > 0
  } catch {
    return false
  }
}

// Pick the most specific source link: prefer a real URL with a path
// (article/post), then any http(s) URL, else null.
export function pickBestUrl(candidates: (string | null | undefined)[]): string | null {
  const urls = candidates.filter(isHttpUrl).map(c => (c as string).trim())
  return urls.find(urlHasPath) || urls[0] || null
}

export interface Socials {
  twitter_url?: string
  telegram_url?: string
  discord_url?: string
}

// Twitter/X handles that are not real accounts (UI/intent routes).
const TWITTER_RESERVED = new Set([
  'home', 'share', 'intent', 'search', 'hashtag', 'i', 'explore',
  'login', 'signup', 'messages', 'notifications', 'settings', 'compose',
  'about', 'tos', 'privacy', 'status',
])

const SOCIAL_STOP_TOKENS = new Set([
  'protocol', 'finance', 'network', 'labs', 'lab', 'app', 'inc', 'the',
  'foundation', 'capital', 'ventures', 'group', 'global', 'dao', 'defi',
  'exchange', 'wallet', 'chain', 'crypto', 'web3', 'company', 'xyz',
])

function nameTokens(name?: string): string[] {
  if (!name) return []
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3 && !SOCIAL_STOP_TOKENS.has(t))
}

// From a list of handles, prefer one that matches the company name
// (handle contains a name token, or a name token contains the handle).
// Falls back to the first handle when there's no name match.
function pickHandle(handles: string[], tokens: string[]): string | undefined {
  const seen = new Set<string>()
  const ordered = handles.filter(h => {
    const k = h.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  if (ordered.length === 0) return undefined
  if (tokens.length > 0) {
    const matched = ordered.find(h => {
      const flat = h.toLowerCase().replace(/[_+]/g, '')
      return tokens.some(t => flat.includes(t) || t.includes(flat))
    })
    if (matched) return matched
  }
  return ordered[0]
}

// Extract real social links from page text/markdown (e.g. a website footer).
// Pure regex — does not invent links, only returns ones present in the text.
// When companyName is given, prefer handles that match the company name so an
// official account wins over community bots/aggregators on the same page.
export function extractSocials(text: string, companyName?: string): Socials {
  const out: Socials = {}
  if (!text) return out
  const tokens = nameTokens(companyName)

  // Twitter/X — full URL match
  const twHandles = [...text.matchAll(/https?:\/\/(?:www\.)?(?:twitter|x)\.com\/([A-Za-z0-9_]{1,30})/gi)]
    .map(m => m[1])
    .filter(h => !TWITTER_RESERVED.has(h.toLowerCase()))
  const tw = pickHandle(twHandles, tokens)
  if (tw) out.twitter_url = `https://x.com/${tw}`

  // Telegram — both t.me URLs and @handle patterns, plus catch "telegram" page links
  const tgUrlMatches = [...text.matchAll(/https?:\/\/(?:www\.)?t\.me\/([A-Za-z0-9_+]{3,40})/gi)]
    .map(m => m[1])
    .filter(h => h.toLowerCase() !== 'share')
  // Also catch @handle mentions (e.g. "@hyperbridgeio")
  const tgAtMatches = [...text.matchAll(/@([A-Za-z0-9_]{3,40})/g)]
    .map(m => m[1])
    .filter(h => h.toLowerCase() !== 'share')
  const tgHandles = [...tgUrlMatches, ...tgAtMatches]
  const tg = pickHandle(tgHandles, tokens)
  if (tg) out.telegram_url = `https://t.me/${tg}`

  // Discord — full invite URLs
  const dc = text.match(/https?:\/\/(?:www\.)?(?:discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]{3,40}/i)
  if (dc) out.discord_url = dc[0]

  return out
}

export function getRuleTypeColor(type: string): string {
  switch (type) {
    case 'prioritize': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    case 'reject': return 'bg-rose-500/15 text-rose-300 border-rose-500/30'
    case 'score_boost': return 'bg-violet-500/15 text-violet-300 border-violet-500/30'
    case 'score_penalty': return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    case 'outreach_style': return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
    case 'source_preference': return 'bg-blue-500/15 text-blue-300 border-blue-500/30'
    default: return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
  }
}

export function getRuleTypeLabel(type: string): string {
  switch (type) {
    case 'prioritize': return 'Prioritize'
    case 'reject': return 'Reject'
    case 'score_boost': return 'Score Boost'
    case 'score_penalty': return 'Score Penalty'
    case 'outreach_style': return 'Outreach Style'
    case 'source_preference': return 'Source Pref'
    default: return type
  }
}
