import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apolloConfigured, apolloMatchPerson, toDomain } from '@/lib/apollo'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// On-demand: verify this lead's existing contacts against Apollo and attach
// real titles, LinkedIn and verified emails (with personal-email reveal).
export async function POST(req: NextRequest) {
  if (!apolloConfigured()) {
    return NextResponse.json({ error: 'Apollo API key not configured. Add APOLLO_API_KEY to your environment.' }, { status: 400 })
  }

  try {
    const { lead_id } = await req.json()
    if (!lead_id) return NextResponse.json({ error: 'lead_id is required' }, { status: 400 })

    const { data: lead, error } = await supabase
      .from('leads')
      .select('id, company_name, website')
      .eq('id', lead_id)
      .single()
    if (error || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const domain = toDomain(lead.website)
    if (!domain) {
      return NextResponse.json({ error: 'This lead has no website/domain — add one so Apollo can verify its team.' }, { status: 400 })
    }

    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, email')
      .eq('lead_id', lead_id)

    const named = (contacts || []).filter(c => c.name && c.name.trim().length > 2)
    if (named.length === 0) {
      return NextResponse.json({ verified: 0, message: 'No named contacts to verify yet — run AI "Find Contacts" first, then Apollo can verify their emails.' })
    }

    let verified = 0
    for (const c of named) {
      const hit = await apolloMatchPerson({ name: c.name!, domain, organizationName: lead.company_name, reveal: true })
      if (!hit || !hit.email) continue
      const { error: updErr } = await supabase
        .from('contacts')
        .update({
          email: hit.email,
          role: hit.title || undefined,
          linkedin_url: hit.linkedin_url || undefined,
          contact_confidence: 'high',
          reason_this_person: `Verified via Apollo${hit.seniority ? ` · ${hit.seniority}` : ''}${hit.title ? ` · ${hit.title}` : ''}`,
        })
        .eq('id', c.id)
      if (!updErr) verified++
    }

    return NextResponse.json({
      checked: named.length,
      verified,
      message: verified === 0 ? 'Apollo could not confirm verified emails for these contacts.' : undefined,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Apollo enrichment failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
