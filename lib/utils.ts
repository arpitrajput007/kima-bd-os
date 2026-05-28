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
