// One-click reply-marking endpoint — called from digest email magic links.
// GET /api/leads/mark-replied?lead_id=xxx&source=email
// Updates lead to 'replied' and returns a plain HTML confirmation page.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recordOutcome } from '@/lib/outreach'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const leadId = searchParams.get('lead_id')

  if (!leadId) {
    return new NextResponse('Missing lead_id', { status: 400 })
  }

  const { data: lead } = await supabase
    .from('leads')
    .select('company_name, status')
    .eq('id', leadId)
    .single()

  if (!lead) {
    return new NextResponse('Lead not found', { status: 404 })
  }

  if (lead.status === 'replied' || lead.status === 'meeting_booked') {
    return new NextResponse(
      successPage(lead.company_name, 'Already marked as replied.'),
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  await recordOutcome(supabase, { leadId, outcome: 'replied' })

  return new NextResponse(
    successPage(lead.company_name, 'Marked as replied! Go close the deal.'),
    { headers: { 'Content-Type': 'text/html' } }
  )
}

function successPage(company: string, message: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>Kima BD — ${company}</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#e5e7eb;background:#0a0a0a}
h1{font-size:1.5rem;margin-bottom:.5rem}p{color:#9ca3af}</style></head>
<body>
<h1>${company}</h1>
<p>${message}</p>
<p><a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/crm" style="color:#60a5fa">Open pipeline →</a></p>
</body></html>`
}
