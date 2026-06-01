import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apolloConfigured, apolloFindContacts, toDomain } from '@/lib/apollo'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// On-demand: pull real decision-maker contacts (with revealed emails) for one lead.
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
      return NextResponse.json({ error: 'This lead has no website/domain — add one so Apollo can find its team.' }, { status: 400 })
    }

    // Reveal emails for the top contacts (user-triggered → worth the credits).
    const contacts = await apolloFindContacts(domain, undefined, { perPage: 6, reveal: true, revealLimit: 3 })
    if (contacts.length === 0) {
      return NextResponse.json({ found: 0, added: 0, message: 'Apollo found no matching decision-makers for this domain.' })
    }

    // Existing contacts to avoid dupes (by name or email).
    const { data: existing } = await supabase.from('contacts').select('name, email').eq('lead_id', lead_id)
    const existingNames = new Set((existing || []).map(c => (c.name || '').toLowerCase().trim()).filter(Boolean))
    const existingEmails = new Set((existing || []).map(c => (c.email || '').toLowerCase().trim()).filter(Boolean))

    let added = 0
    for (const c of contacts.slice(0, 5)) {
      const nameKey = (c.name || '').toLowerCase().trim()
      const emailKey = (c.email || '').toLowerCase().trim()
      if (nameKey && existingNames.has(nameKey)) continue
      if (emailKey && existingEmails.has(emailKey)) continue

      const { error: insErr } = await supabase.from('contacts').insert({
        lead_id,
        name: c.name,
        role: c.title || 'Decision maker',
        company: lead.company_name,
        linkedin_url: c.linkedin_url,
        email: c.email,
        contact_confidence: c.email ? 'high' : 'medium',
        reason_this_person: `Found via Apollo${c.seniority ? ` · ${c.seniority}` : ''}${c.title ? ` · ${c.title}` : ''}`,
      })
      if (!insErr) {
        added++
        if (nameKey) existingNames.add(nameKey)
        if (emailKey) existingEmails.add(emailKey)
      }
    }

    return NextResponse.json({ found: contacts.length, added })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Apollo enrichment failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
