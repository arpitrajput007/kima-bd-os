import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recordOutcome } from '@/lib/outreach'
import { sendEmail, isEmailConfigured } from '@/lib/email-sender'
import { checkThreadForReply } from '@/lib/gmail'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Polls Gmail threads for leads we've emailed to catch replies automatically.
// Triggered on a schedule (see vercel.json) or manually with the cron secret.
export const maxDuration = 120
export const dynamic = 'force-dynamic'

const MAX_THREADS_PER_RUN = 100

function auth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

interface OutreachRow {
  id: string
  lead_id: string
  gmail_thread_id: string
  created_at: string
  leads: { id: string; company_name: string; status: string } | null
}

export async function GET(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'https://kima-bd-os.vercel.app'

  // Latest emailed thread per lead that's still actively being chased
  // (skip leads already marked replied/meeting_booked/won/lost — nothing new to catch).
  const { data: rows } = await supabase
    .from('outreach_messages')
    .select('id, lead_id, gmail_thread_id, created_at, leads!inner(id, company_name, status)')
    .eq('channel', 'email')
    .not('gmail_thread_id', 'is', null)
    .in('leads.status', ['contacted'])
    .order('created_at', { ascending: false })
    .limit(MAX_THREADS_PER_RUN)

  const candidates = (rows ?? []) as unknown as OutreachRow[]

  // Only need the newest thread per lead.
  const seenLeads = new Set<string>()
  const toCheck = candidates.filter(r => {
    if (seenLeads.has(r.lead_id)) return false
    seenLeads.add(r.lead_id)
    return true
  })

  const newReplies: { company: string; leadId: string; from: string; snippet: string }[] = []
  const errors: string[] = []

  for (const row of toCheck) {
    const reply = await checkThreadForReply(row.gmail_thread_id)
    if (!reply) continue

    const { error } = await recordOutcome(supabase, { leadId: row.lead_id, outcome: 'replied' })
    if (error) {
      errors.push(`${row.leads?.company_name}: ${error}`)
      continue
    }

    newReplies.push({
      company: row.leads?.company_name || 'Unknown',
      leadId: row.lead_id,
      from: reply.from,
      snippet: reply.snippet,
    })
  }

  if (newReplies.length > 0 && isEmailConfigured()) {
    const notifyEmail = process.env.NOTIFY_EMAIL || 'arpitcoding007@gmail.com'
    const lines = [
      `${newReplies.length} new repl${newReplies.length === 1 ? 'y' : 'ies'} came in:`,
      '',
      ...newReplies.map(r => `• ${r.company} (${r.from})\n  "${r.snippet}"\n  ${appUrl}/crm`),
    ]
    await sendEmail({
      to: notifyEmail,
      subject: `[Kima BD] ${newReplies.length} new repl${newReplies.length === 1 ? 'y' : 'ies'} 🎉`,
      text: lines.join('\n'),
    })
  }

  return NextResponse.json({
    success: true,
    run_at: new Date().toISOString(),
    threads_checked: toCheck.length,
    new_replies: newReplies.length,
    replies: newReplies,
    errors,
  })
}
