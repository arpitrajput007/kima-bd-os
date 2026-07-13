import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isRealEmail, followUpDue, MAX_FOLLOWUPS } from '@/lib/outreach'

// Appended verbatim to the LAST follow-up so the no-more-emails promise is
// always honored exactly, regardless of what the AI drafted.
const BREAKUP_LINE = `If that's not interesting, no worries. Just reply with a quick "no" and I will not email you again.`
import { isEmailConfigured, sendEmail as sendNotifyEmail } from '@/lib/email-sender'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Vercel cron is called at 02:00 UTC (07:30 IST) daily.
// Can also be triggered manually: GET /api/cron/auto-outreach with the cron secret.
//
// Emails are NOT sent automatically — this only queues drafts (status='draft')
// for review. Arpit reviews/edits/sends each one from the Email Reachout page,
// which actually sends via /api/leads/approve-draft.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const MAX_INITIAL_DRAFTS = 15
const MAX_FOLLOWUP_DRAFTS = 10
const MAX_SOCIAL_PREDRAFTS = 25

interface ContactRow { id: string; name?: string | null; email?: string | null }
import type { LeadStatus } from '@/lib/types'

interface LeadRow {
  id: string
  company_name: string
  lead_score?: number | null
  follow_up_stage?: number | null
  next_follow_up_at?: string | null
  last_contacted_at?: string | null
  updated_at: string
  status: LeadStatus
  contacts?: ContactRow[] | null
}
interface AgentDraft { channel: string; subject?: string; text: string }

function auth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

function bestEmailContact(lead: LeadRow): ContactRow | undefined {
  return (lead.contacts ?? []).find(c => isRealEmail(c.email))
}

async function callOutreachAI(
  appUrl: string,
  payload: Record<string, unknown>,
): Promise<{ drafts?: AgentDraft[]; draft?: AgentDraft } | null> {
  try {
    const res = await fetch(`${appUrl}/api/ai/outreach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drafting_ai: 'openai', ...payload }),
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.data ?? null
  } catch {
    return null
  }
}

// A lead already has an undecided email draft sitting in the queue — skip it
// so we don't pile up duplicates while Arpit hasn't reviewed the last one.
async function hasPendingEmailDraft(leadId: string): Promise<boolean> {
  const { data } = await supabase
    .from('outreach_messages')
    .select('id')
    .eq('lead_id', leadId)
    .eq('channel', 'email')
    .eq('status', 'draft')
    .limit(1)
    .maybeSingle()
  return !!data
}

function buildDigest(opts: {
  appUrl: string
  drafted: { company: string; leadId: string }[]
  followupsDrafted: { company: string; leadId: string }[]
  socialQueued: number
  errors: string[]
}): string {
  const { appUrl, drafted, followupsDrafted, socialQueued, errors } = opts
  const lines: string[] = [
    'Kima BD OS — Autonomous Outreach Report',
    '─'.repeat(40),
    '',
  ]

  if (drafted.length > 0) {
    lines.push(`NEW EMAIL DRAFTS READY FOR APPROVAL (${drafted.length}):`)
    for (const d of drafted) lines.push(`  • ${d.company}`)
    lines.push('')
  }

  if (followupsDrafted.length > 0) {
    lines.push(`FOLLOW-UP DRAFTS READY FOR APPROVAL (${followupsDrafted.length}):`)
    for (const f of followupsDrafted) lines.push(`  • ${f.company}`)
    lines.push('')
  }

  if (socialQueued > 0) {
    lines.push(`SOCIAL DRAFTS READY: ${socialQueued} messages pre-drafted — review at ${appUrl}/outreach`)
    lines.push('')
  }

  if (errors.length > 0) {
    lines.push(`ERRORS (${errors.length}):`)
    for (const e of errors) lines.push(`  ⚠ ${e}`)
    lines.push('')
  }

  lines.push(`Review + approve/discard drafts in-app (top-right of any page).`)
  lines.push(`View full pipeline: ${appUrl}/crm`)
  return lines.join('\n')
}

export async function GET(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'https://kima-bd-os.vercel.app'

  const emailReady = isEmailConfigured()
  const drafted: { company: string; leadId: string }[] = []
  const followupsDrafted: { company: string; leadId: string }[] = []
  const errors: string[] = []
  let socialQueued = 0

  // ── 1. INITIAL OUTREACH — approved leads not yet contacted ──────────────────
  const { data: approvedRaw } = await supabase
    .from('leads')
    .select('id, company_name, lead_score, updated_at, status, contacts(id, name, email)')
    .eq('status', 'approved')
    .order('lead_score', { ascending: false })
    .limit(MAX_INITIAL_DRAFTS + MAX_SOCIAL_PREDRAFTS)

  const approved = (approvedRaw ?? []) as LeadRow[]
  const emailLeads = approved.filter(l => bestEmailContact(l)).slice(0, MAX_INITIAL_DRAFTS)
  const noEmailLeads = approved.filter(l => !bestEmailContact(l)).slice(0, MAX_SOCIAL_PREDRAFTS)

  for (const lead of emailLeads) {
    const contact = bestEmailContact(lead)!
    if (await hasPendingEmailDraft(lead.id)) continue

    const data = await callOutreachAI(appUrl, { mode: 'auto', lead_id: lead.id })
    const emailDraft = (data?.drafts ?? []).find(d => d.channel === 'email')

    if (!emailDraft) {
      errors.push(`${lead.company_name}: no email draft generated`)
      continue
    }

    const subject = emailDraft.subject || `Partnership — ${lead.company_name}`
    const { error } = await supabase.from('outreach_messages').insert({
      lead_id: lead.id,
      contact_id: contact.id,
      channel: 'email',
      message: `Subject: ${subject}\n\n${emailDraft.text}`,
      status: 'draft',
    })
    if (error) {
      errors.push(`${lead.company_name}: ${error.message}`)
      continue
    }
    drafted.push({ company: lead.company_name, leadId: lead.id })
  }

  // ── 2. PRE-DRAFT SOCIAL for leads without email ─────────────────────────────
  for (const lead of noEmailLeads) {
    const data = await callOutreachAI(appUrl, { mode: 'auto', lead_id: lead.id })
    const socialDrafts = (data?.drafts ?? []).filter(d => d.channel !== 'email')
    if (socialDrafts.length === 0) continue

    // Store the top social draft so it shows up in the outreach queue.
    const top = socialDrafts[0]
    const { error } = await supabase.from('outreach_messages').insert({
      lead_id: lead.id,
      channel: top.channel,
      message: top.text,
      status: 'draft',
    })
    if (!error) socialQueued++
  }

  // ── 3. FOLLOW-UPS — contacted leads that are overdue ───────────────────────
  const { data: contactedRaw } = await supabase
    .from('leads')
    .select('id, company_name, follow_up_stage, next_follow_up_at, last_contacted_at, updated_at, status, contacts(id, name, email)')
    .eq('status', 'contacted')
    .limit(MAX_FOLLOWUP_DRAFTS + 20)

  const contactedLeads = ((contactedRaw ?? []) as LeadRow[])
    .filter(l => followUpDue({
      status: l.status,
      follow_up_stage: l.follow_up_stage ?? undefined,
      next_follow_up_at: l.next_follow_up_at ?? undefined,
      last_contacted_at: l.last_contacted_at ?? undefined,
      updated_at: l.updated_at,
    }))
    .filter(l => bestEmailContact(l))
    .slice(0, MAX_FOLLOWUP_DRAFTS)

  for (const lead of contactedLeads) {
    const contact = bestEmailContact(lead)!
    if (await hasPendingEmailDraft(lead.id)) continue

    const stage = lead.follow_up_stage ?? 0
    const data = await callOutreachAI(appUrl, { mode: 'followup', lead_id: lead.id, stage })
    const draft = data?.draft

    if (!draft) {
      errors.push(`FU ${lead.company_name}: no draft`)
      continue
    }

    const isFinalFollowup = stage >= MAX_FOLLOWUPS - 1
    const text = isFinalFollowup ? `${draft.text}\n\n${BREAKUP_LINE}` : draft.text
    const subject = draft.subject || `Re: ${lead.company_name}`
    const { error } = await supabase.from('outreach_messages').insert({
      lead_id: lead.id,
      contact_id: contact.id,
      channel: 'email',
      message: `Subject: ${subject}\n\n${text}`,
      status: 'draft',
    })
    if (error) {
      errors.push(`FU ${lead.company_name}: ${error.message}`)
      continue
    }
    followupsDrafted.push({ company: lead.company_name, leadId: lead.id })
  }

  // ── 4. NOTIFY ARPIT ─────────────────────────────────────────────────────────
  const notifyEmail = process.env.NOTIFY_EMAIL || 'arpitcoding007@gmail.com'
  const totalActions = drafted.length + followupsDrafted.length + socialQueued

  if (totalActions > 0 && emailReady) {
    await sendNotifyEmail({
      to: notifyEmail,
      subject: `[Kima BD] ${drafted.length + followupsDrafted.length} email drafts awaiting your approval, ${socialQueued} social drafts ready`,
      text: buildDigest({ appUrl, drafted, followupsDrafted, socialQueued, errors }),
    })
  }

  return NextResponse.json({
    success: true,
    run_at: new Date().toISOString(),
    email_configured: emailReady,
    drafts_queued: drafted.length,
    followup_drafts_queued: followupsDrafted.length,
    social_drafted: socialQueued,
    errors,
  })
}
