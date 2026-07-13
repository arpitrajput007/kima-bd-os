import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { finalizeDraftSend, getLastEmailThread } from '@/lib/outreach'
import { sendEmail, isEmailConfigured } from '@/lib/email-sender'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface ApproveDraftBody {
  id?: string
  action?: 'send' | 'discard' | 'save'
  subject?: string
  text?: string
}

// One-click approve/discard/edit for a queued email draft.
// POST { id: outreach_messages.id, action: 'send' | 'discard' | 'save', subject?, text? }
// 'save' persists edits without sending. 'send' accepts optional subject/text
// overrides so an edited-but-unsaved draft can be sent in one click.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as ApproveDraftBody | null
  if (!body?.id || !['send', 'discard', 'save'].includes(body.action ?? '')) {
    return NextResponse.json({ error: 'Missing id or invalid action' }, { status: 400 })
  }

  const { data: draftRow, error: draftErr } = await supabase
    .from('outreach_messages')
    .select('id, lead_id, contact_id, channel, message, status')
    .eq('id', body.id)
    .maybeSingle()

  if (draftErr || !draftRow) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }
  if (draftRow.status !== 'draft') {
    return NextResponse.json({ error: `Already ${draftRow.status}` }, { status: 409 })
  }
  if (draftRow.channel !== 'email') {
    return NextResponse.json({ error: 'Only email drafts go through this endpoint' }, { status: 400 })
  }

  if (body.action === 'discard') {
    await supabase.from('outreach_messages').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', draftRow.id)
    return NextResponse.json({ success: true, action: 'discarded' })
  }

  const storedSubjectMatch = (draftRow.message as string).match(/^Subject: (.+)$/m)
  const storedSubject = storedSubjectMatch?.[1] || ''
  const storedText = storedSubjectMatch
    ? (draftRow.message as string).replace(/^Subject: .+\n\n/, '')
    : (draftRow.message as string)

  const subject = body.subject ?? storedSubject
  const text = body.text ?? storedText

  if (body.action === 'save') {
    const { error } = await supabase
      .from('outreach_messages')
      .update({ message: `Subject: ${subject}\n\n${text}`, updated_at: new Date().toISOString() })
      .eq('id', draftRow.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, action: 'saved' })
  }

  // ── action === 'send' ──────────────────────────────────────────────────────
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: 'Gmail not configured' }, { status: 500 })
  }

  const [{ data: lead }, { data: contact }] = await Promise.all([
    supabase.from('leads').select('id, company_name, status, follow_up_stage').eq('id', draftRow.lead_id).maybeSingle(),
    draftRow.contact_id
      ? supabase.from('contacts').select('id, email').eq('id', draftRow.contact_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }
  if (!contact?.email) {
    return NextResponse.json({ error: 'No contact email on this draft' }, { status: 400 })
  }

  // A lead already 'contacted' means this draft is a follow-up — thread it
  // into the same Gmail conversation as the prior message(s).
  const kind: 'initial' | 'followup' = lead.status === 'contacted' ? 'followup' : 'initial'
  const prevThread = kind === 'followup' ? await getLastEmailThread(supabase, lead.id) : null

  const { id: gmailMessageId, threadId, messageIdHeader, error: sendErr } = await sendEmail({
    to: contact.email,
    subject,
    text,
    threadId: prevThread?.threadId,
    inReplyToMessageId: prevThread?.messageIdHeader,
    references: prevThread?.messageIdHeader,
  })

  if (sendErr) {
    return NextResponse.json({ error: sendErr }, { status: 502 })
  }

  const { error: finalizeErr } = await finalizeDraftSend(supabase, {
    messageId: draftRow.id,
    leadId: lead.id,
    channel: 'email',
    kind,
    currentStage: lead.follow_up_stage ?? undefined,
    gmailThreadId: threadId,
    gmailMessageId,
    gmailMessageIdHeader: messageIdHeader,
    message: `Subject: ${subject}\n\n${text}`,
  })

  if (finalizeErr) {
    return NextResponse.json({ error: finalizeErr }, { status: 500 })
  }

  return NextResponse.json({ success: true, action: 'sent' })
}
