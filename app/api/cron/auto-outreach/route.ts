import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isRealEmail, followUpDue, logTouch } from '@/lib/outreach'
import { sendEmail, isEmailConfigured } from '@/lib/email-sender'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Vercel cron is called at 02:00 UTC (07:30 IST) daily.
// Can also be triggered manually: POST /api/cron/auto-outreach with the cron secret.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

// Domain warm-up caps — raise gradually as your sending reputation builds.
const MAX_INITIAL_EMAILS = 15
const MAX_FOLLOWUP_EMAILS = 10
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

// Build a magic-link digest email so Arpit can one-click update reply status.
function buildDigest(opts: {
  appUrl: string
  sent: { company: string; leadId: string }[]
  followups: { company: string; leadId: string }[]
  socialQueued: number
  errors: string[]
}): string {
  const { appUrl, sent, followups, socialQueued, errors } = opts
  const lines: string[] = [
    'Kima BD OS — Autonomous Outreach Report',
    '─'.repeat(40),
    '',
  ]

  if (sent.length > 0) {
    lines.push(`EMAILS SENT TODAY (${sent.length}):`)
    for (const s of sent) {
      const markUrl = `${appUrl}/api/leads/mark-replied?lead_id=${s.leadId}&source=email`
      lines.push(`  • ${s.company} → ${markUrl}`)
    }
    lines.push('')
  }

  if (followups.length > 0) {
    lines.push(`FOLLOW-UPS SENT (${followups.length}):`)
    for (const f of followups) {
      const markUrl = `${appUrl}/api/leads/mark-replied?lead_id=${f.leadId}&source=email`
      lines.push(`  • ${f.company} → ${markUrl}`)
    }
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
  const sent: { company: string; leadId: string }[] = []
  const followupsSent: { company: string; leadId: string }[] = []
  const errors: string[] = []
  let socialQueued = 0

  // ── 1. INITIAL OUTREACH — approved leads not yet contacted ──────────────────
  const { data: approvedRaw } = await supabase
    .from('leads')
    .select('id, company_name, lead_score, updated_at, status, contacts(id, name, email)')
    .eq('status', 'approved')
    .order('lead_score', { ascending: false })
    .limit(MAX_INITIAL_EMAILS + MAX_SOCIAL_PREDRAFTS)

  const approved = (approvedRaw ?? []) as LeadRow[]
  const emailLeads = approved.filter(l => bestEmailContact(l)).slice(0, MAX_INITIAL_EMAILS)
  const noEmailLeads = approved.filter(l => !bestEmailContact(l)).slice(0, MAX_SOCIAL_PREDRAFTS)

  for (const lead of emailLeads) {
    const contact = bestEmailContact(lead)!
    const data = await callOutreachAI(appUrl, { mode: 'auto', lead_id: lead.id })
    const emailDraft = (data?.drafts ?? []).find(d => d.channel === 'email')

    if (!emailDraft) {
      errors.push(`${lead.company_name}: no email draft generated`)
      continue
    }

    if (emailReady) {
      const { error } = await sendEmail({
        to: contact.email!,
        subject: emailDraft.subject || `Partnership — ${lead.company_name}`,
        text: emailDraft.text,
        replyTo: process.env.RESEND_REPLY_TO,
      })
      if (error) {
        errors.push(`${lead.company_name}: ${error}`)
        continue
      }
    }

    // Always log the touch — marks lead as contacted and schedules follow-up.
    await logTouch(supabase, {
      leadId: lead.id,
      channel: 'email',
      text: emailDraft.text,
      subject: emailDraft.subject,
      contactId: contact.id,
      kind: 'initial',
    })
    sent.push({ company: lead.company_name, leadId: lead.id })
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
    .limit(MAX_FOLLOWUP_EMAILS + 20)

  const contactedLeads = ((contactedRaw ?? []) as LeadRow[])
    .filter(l => followUpDue({
      status: l.status,
      follow_up_stage: l.follow_up_stage ?? undefined,
      next_follow_up_at: l.next_follow_up_at ?? undefined,
      last_contacted_at: l.last_contacted_at ?? undefined,
      updated_at: l.updated_at,
    }))
    .filter(l => bestEmailContact(l))
    .slice(0, MAX_FOLLOWUP_EMAILS)

  for (const lead of contactedLeads) {
    const contact = bestEmailContact(lead)!
    const stage = lead.follow_up_stage ?? 0
    const data = await callOutreachAI(appUrl, { mode: 'followup', lead_id: lead.id, stage })
    const draft = data?.draft

    if (!draft) {
      errors.push(`FU ${lead.company_name}: no draft`)
      continue
    }

    if (emailReady) {
      const { error } = await sendEmail({
        to: contact.email!,
        subject: draft.subject || `Re: ${lead.company_name}`,
        text: draft.text,
        replyTo: process.env.RESEND_REPLY_TO,
      })
      if (error) {
        errors.push(`FU ${lead.company_name}: ${error}`)
        continue
      }
    }

    await logTouch(supabase, {
      leadId: lead.id,
      channel: 'email',
      text: draft.text,
      subject: draft.subject,
      contactId: contact.id,
      kind: 'followup',
      currentStage: stage,
    })
    followupsSent.push({ company: lead.company_name, leadId: lead.id })
  }

  // ── 4. NOTIFY ARPIT ─────────────────────────────────────────────────────────
  const notifyEmail = process.env.NOTIFY_EMAIL || 'arpitcoding007@gmail.com'
  const totalActions = sent.length + followupsSent.length + socialQueued

  if (totalActions > 0 && emailReady) {
    await sendEmail({
      to: notifyEmail,
      subject: `[Kima BD] ${sent.length} emails sent, ${followupsSent.length} follow-ups, ${socialQueued} social drafts ready`,
      text: buildDigest({ appUrl, sent, followups: followupsSent, socialQueued, errors }),
    })
  }

  return NextResponse.json({
    success: true,
    run_at: new Date().toISOString(),
    email_configured: emailReady,
    emails_sent: sent.length,
    followups_sent: followupsSent.length,
    social_drafted: socialQueued,
    errors,
  })
}
