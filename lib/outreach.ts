import type { SupabaseClient } from '@supabase/supabase-js'
import type { Lead } from './types'

// How many follow-ups we owe before a lead is "done" being chased.
export const MAX_FOLLOWUPS = 2
// Days to wait between touches before the next follow-up is due.
export const FOLLOWUP_GAP_DAYS = 5

// Where to open / who to message for a given channel. Built from a lead's
// company-level socials plus the best individual contact.
export interface TouchTarget {
  email?: string
  telegram_url?: string
  twitter_url?: string
  linkedin_url?: string
  website?: string
}

// The contact/social bundle the outreach API returns alongside drafts so the
// UI can build one-click "open & send" links.
export interface OutreachMeta {
  telegram_url?: string | null
  twitter_url?: string | null
  discord_url?: string | null
  website?: string | null
  contact?: {
    id?: string
    name?: string | null
    email?: string | null
    linkedin_url?: string | null
    twitter_url?: string | null
    telegram?: string | null
  } | null
}

// Merge contact-level and company-level handles into a single target,
// always preferring the individual contact when we have them.
export function buildTarget(meta?: OutreachMeta | null): TouchTarget {
  const c = meta?.contact
  const rawTg = c?.telegram || undefined
  const tgHandle = rawTg
    ? rawTg.replace(/^@/, '').replace(/^https?:\/\/(www\.)?t\.me\//, '')
    : undefined
  return {
    email: c?.email || undefined,
    telegram_url: tgHandle ? `https://t.me/${tgHandle}` : (meta?.telegram_url || undefined),
    twitter_url: c?.twitter_url || meta?.twitter_url || undefined,
    linkedin_url: c?.linkedin_url || undefined,
    website: meta?.website || undefined,
  }
}

// Best link to open for a channel. Email is fully prefilled (subject + body);
// other channels just open the chat/profile (text goes via clipboard).
export function channelDeepLink(
  channel: string,
  t: TouchTarget,
  text: string,
  subject?: string,
): string | null {
  switch (channel) {
    case 'email': {
      if (!t.email) return null
      const params = new URLSearchParams()
      if (subject) params.set('subject', subject)
      if (text) params.set('body', text)
      return `mailto:${t.email}?${params.toString()}`
    }
    case 'telegram':
      return t.telegram_url || null
    case 'twitter':
      return t.twitter_url || null
    case 'linkedin':
      return t.linkedin_url || null
    default:
      return t.website || null
  }
}

// Is this lead due (or overdue) for a follow-up right now?
export function followUpDue(lead: Pick<Lead, 'status' | 'follow_up_stage' | 'next_follow_up_at' | 'last_contacted_at' | 'updated_at'>): boolean {
  if (lead.status !== 'contacted') return false
  const stage = lead.follow_up_stage ?? 0
  if (stage >= MAX_FOLLOWUPS) return false
  if (lead.next_follow_up_at) return new Date(lead.next_follow_up_at) <= new Date()
  // Legacy leads contacted before tracking existed: fall back to last touch.
  const base = lead.last_contacted_at || lead.updated_at
  if (!base) return false
  return Date.now() - new Date(base).getTime() >= FOLLOWUP_GAP_DAYS * 86400000
}

// Record an outreach touch: advance the lead's follow-up state and log the
// sent message. `kind` is 'initial' for the first message, 'followup' after.
export async function logTouch(
  supabase: SupabaseClient,
  opts: {
    leadId: string
    channel: string
    text: string
    subject?: string
    contactId?: string
    kind: 'initial' | 'followup'
    currentStage?: number
  },
): Promise<{ error: string | null }> {
  const now = new Date()
  const newStage = opts.kind === 'initial'
    ? 0
    : Math.min((opts.currentStage ?? 0) + 1, MAX_FOLLOWUPS)

  const update: Record<string, unknown> = {
    status: 'contacted',
    last_contacted_at: now.toISOString(),
    last_channel: opts.channel,
    follow_up_stage: newStage,
    next_follow_up_at: newStage < MAX_FOLLOWUPS
      ? new Date(now.getTime() + FOLLOWUP_GAP_DAYS * 86400000).toISOString()
      : null,
    updated_at: now.toISOString(),
  }
  if (opts.kind === 'initial') update.contacted_at = now.toISOString()

  const { error: e1 } = await supabase.from('leads').update(update).eq('id', opts.leadId)
  const { error: e2 } = await supabase.from('outreach_messages').insert({
    lead_id: opts.leadId,
    contact_id: opts.contactId || null,
    channel: opts.channel,
    message: opts.subject ? `Subject: ${opts.subject}\n\n${opts.text}` : opts.text,
    status: 'sent',
  })
  return { error: e1?.message || e2?.message || null }
}
