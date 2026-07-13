import type { SupabaseClient } from '@supabase/supabase-js'
import type { Lead } from './types'

// How many follow-ups we owe before a lead is "done" being chased.
export const MAX_FOLLOWUPS = 3
// Days to wait between touches before the next follow-up is due.
export const FOLLOWUP_GAP_DAYS = 3

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

// The contacts finder often returns a guessed *pattern* (firstname@acme.com)
// rather than a real inbox. Sending to that literal is worse than not sending,
// so we treat patterns as "no email".
const EMAIL_PLACEHOLDERS = [
  'firstname', 'lastname', 'first.last', 'first_last', 'first-last',
  'first.name', 'name.surname', 'fname', 'lname', 'yourname', 'your.name',
  'name@', 'email@', 'user@', 'example.com', '@example',
]

export function isRealEmail(email?: string | null): boolean {
  if (!email) return false
  const e = email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return false
  return !EMAIL_PLACEHOLDERS.some(p => e.includes(p))
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
    email: isRealEmail(c?.email) ? (c!.email as string) : undefined,
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

// The outcome of an outreach attempt, captured by the human after they send.
// 'replied'/'meeting_booked' = it worked; 'no_response' = stop chasing it.
export type OutreachOutcome = 'replied' | 'meeting_booked' | 'no_response'

// Record what happened after we reached out. Updates the lead's status, stops
// the follow-up clock, and (for positive outcomes) marks the most recent sent
// message as 'replied' so the learning loop can see which channel/angle won.
export async function recordOutcome(
  supabase: SupabaseClient,
  opts: { leadId: string; outcome: OutreachOutcome },
): Promise<{ error: string | null }> {
  const statusMap: Record<OutreachOutcome, string> = {
    replied: 'replied',
    meeting_booked: 'meeting_booked',
    no_response: 'archived',
  }
  const now = new Date().toISOString()

  const { error: e1 } = await supabase
    .from('leads')
    .update({ status: statusMap[opts.outcome], next_follow_up_at: null, updated_at: now })
    .eq('id', opts.leadId)

  // A reply (or meeting) means the last message we sent landed — tag it so we
  // can learn from what actually converts.
  let e2: { message: string } | null = null
  if (opts.outcome !== 'no_response') {
    const { data: last } = await supabase
      .from('outreach_messages')
      .select('id')
      .eq('lead_id', opts.leadId)
      .eq('status', 'sent')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (last?.id) {
      const { error } = await supabase
        .from('outreach_messages')
        .update({ status: 'replied', updated_at: now })
        .eq('id', last.id)
      e2 = error
    }
  }
  return { error: e1?.message || e2?.message || null }
}

// What the agent has learned from real outcomes — a compact block injected into
// the drafting prompt so new messages lean into the channels, categories, and
// voice that have actually been getting replies.
export interface OutreachLearnings {
  block: string
  hasData: boolean
}

export async function getOutreachLearnings(supabase: SupabaseClient): Promise<OutreachLearnings> {
  const empty: OutreachLearnings = { block: '', hasData: false }
  const since = new Date(Date.now() - 120 * 86400000).toISOString()

  const { data: msgs } = await supabase
    .from('outreach_messages')
    .select('channel, status, message, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (!msgs || msgs.length === 0) return empty

  // Per-channel sent vs. replied tallies.
  const tally: Record<string, { sent: number; replied: number }> = {}
  for (const m of msgs) {
    const ch = m.channel || 'unknown'
    if (!tally[ch]) tally[ch] = { sent: 0, replied: 0 }
    tally[ch].sent++
    if (m.status === 'replied') tally[ch].replied++
  }

  const sections: string[] = []

  // Channel reply rates — only channels with enough sends to mean something.
  const rates = Object.entries(tally)
    .filter(([, v]) => v.sent >= 2)
    .map(([ch, v]) => ({ ch, rate: v.replied / v.sent, ...v }))
    .sort((a, b) => b.rate - a.rate)
  if (rates.length > 0) {
    const line = rates
      .map(r => `${r.ch} ${Math.round(r.rate * 100)}% (${r.replied}/${r.sent})`)
      .join(', ')
    sections.push(`Channel reply rates (last 120d): ${line}. Favour the channels that actually get replies when you have a contact there.`)
  }

  // Real messages that earned a reply — the strongest signal of what works.
  const winners = msgs
    .filter(m => m.status === 'replied' && m.message)
    .slice(0, 2)
  if (winners.length > 0) {
    const examples = winners
      .map((m, i) => {
        const text = (m.message || '').slice(0, 500)
        return `--- replied example ${i + 1} (${m.channel || 'unknown'}) ---\n${text}`
      })
      .join('\n\n')
    sections.push(`These are messages YOU sent that GOT a reply — mirror their voice, length, and structure (never copy literally):\n${examples}`)
  }

  // Categories that have converted recently.
  const { data: wonLeads } = await supabase
    .from('leads')
    .select('customer_category')
    .in('status', ['replied', 'meeting_booked'])
    .limit(50)
  const cats = [...new Set((wonLeads || []).flatMap(l => (l.customer_category as string[] | null) || []))]
    .slice(0, 6)
  if (cats.length > 0) {
    sections.push(`Categories that have replied recently: ${cats.join(', ')}.`)
  }

  if (sections.length === 0) return empty
  return {
    hasData: true,
    block: `WHAT'S BEEN WORKING — learn from your own real results:\n${sections.join('\n\n')}`,
  }
}

// Advance a lead's follow-up state after a touch actually goes out — shared by
// logTouch (fresh send) and finalizeDraftSend (approved draft).
async function advanceLeadFollowUp(
  supabase: SupabaseClient,
  opts: { leadId: string; channel: string; kind: 'initial' | 'followup'; currentStage?: number },
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

  const { error } = await supabase.from('leads').update(update).eq('id', opts.leadId)
  return { error: error?.message || null }
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
    gmailThreadId?: string
    gmailMessageId?: string
    gmailMessageIdHeader?: string
  },
): Promise<{ error: string | null }> {
  const { error: e1 } = await advanceLeadFollowUp(supabase, opts)
  const { error: e2 } = await supabase.from('outreach_messages').insert({
    lead_id: opts.leadId,
    contact_id: opts.contactId || null,
    channel: opts.channel,
    message: opts.subject ? `Subject: ${opts.subject}\n\n${opts.text}` : opts.text,
    status: 'sent',
    gmail_thread_id: opts.gmailThreadId || null,
    gmail_message_id: opts.gmailMessageId || null,
    gmail_message_id_header: opts.gmailMessageIdHeader || null,
  })
  return { error: e1 || e2?.message || null }
}

// Approving a queued draft (see /api/leads/approve-draft): advance the lead's
// follow-up state and flip the existing outreach_messages row from
// 'draft' to 'sent' in place, rather than inserting a new row.
export async function finalizeDraftSend(
  supabase: SupabaseClient,
  opts: {
    messageId: string
    leadId: string
    channel: string
    kind: 'initial' | 'followup'
    currentStage?: number
    gmailThreadId?: string
    gmailMessageId?: string
    gmailMessageIdHeader?: string
    message?: string
  },
): Promise<{ error: string | null }> {
  const { error: e1 } = await advanceLeadFollowUp(supabase, opts)
  const { error: e2 } = await supabase
    .from('outreach_messages')
    .update({
      status: 'sent',
      gmail_thread_id: opts.gmailThreadId || null,
      gmail_message_id: opts.gmailMessageId || null,
      gmail_message_id_header: opts.gmailMessageIdHeader || null,
      ...(opts.message ? { message: opts.message } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.messageId)
  return { error: e1 || e2?.message || null }
}

// The most recent EMAIL touch we sent this lead, if any — used to thread the
// next follow-up into the same Gmail conversation (In-Reply-To/References +
// threadId) so replies keep landing in one place we can watch.
export async function getLastEmailThread(
  supabase: SupabaseClient,
  leadId: string,
): Promise<{ threadId?: string; messageIdHeader?: string; subject?: string } | null> {
  const { data } = await supabase
    .from('outreach_messages')
    .select('gmail_thread_id, gmail_message_id_header, message')
    .eq('lead_id', leadId)
    .eq('channel', 'email')
    .not('gmail_thread_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.gmail_thread_id) return null
  const subjectMatch = (data.message as string | null)?.match(/^Subject: (.+)$/m)
  return {
    threadId: data.gmail_thread_id,
    messageIdHeader: data.gmail_message_id_header || undefined,
    subject: subjectMatch?.[1],
  }
}
