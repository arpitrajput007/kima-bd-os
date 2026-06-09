import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apolloConfigured, apolloMatchPerson, apolloSearchPeople, toDomain } from '@/lib/apollo'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Apollo enrichment — two-phase approach ────────────────────
//
// Phase 1 (DISCOVER): search Apollo by org domain + org name.
//   Works even if there are zero contacts in the DB yet.
//   If Apollo people-search is gated for this API key tier, returns [].
//
// Phase 2 (VERIFY): for any existing AI-suggested contacts that
//   Phase 1 didn't cover, run apolloMatchPerson to attach real emails.
//
// This means the button is useful at any point — before OR after
// running "Find Contacts" with AI.
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!apolloConfigured()) {
    return NextResponse.json(
      { error: 'Apollo API key not configured. Add APOLLO_API_KEY to your environment.' },
      { status: 400 },
    )
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

    const domain = toDomain(lead.website ?? '')

    // ── Phase 1: search Apollo directly (no existing contacts needed) ──
    let discovered = 0
    const apolloPeople = await apolloSearchPeople(lead.company_name, domain)

    if (apolloPeople.length > 0) {
      // Fetch existing contacts so we can upsert (update if name exists, insert if new)
      const { data: existing } = await supabase
        .from('contacts')
        .select('id, name')
        .eq('lead_id', lead_id)

      const existingNames = new Set((existing || []).map(c => c.name?.toLowerCase().trim()))

      for (const p of apolloPeople) {
        if (!p.name) continue
        const nameLower = p.name.toLowerCase().trim()
        const reason = `Found via Apollo${p.seniority ? ` · ${p.seniority}` : ''}${p.title ? ` · ${p.title}` : ''}`

        if (existingNames.has(nameLower)) {
          // Update existing contact with better data
          const match = (existing || []).find(c => c.name?.toLowerCase().trim() === nameLower)
          if (match) {
            await supabase.from('contacts').update({
              role:             p.title      || undefined,
              email:            p.email      || undefined,
              linkedin_url:     p.linkedin_url || undefined,
              contact_confidence: p.email ? 'high' : 'medium',
              reason_this_person: reason,
            }).eq('id', match.id)
          }
        } else {
          // Insert brand-new contact
          await supabase.from('contacts').insert({
            lead_id,
            name:             p.name,
            role:             p.title || null,
            company:          lead.company_name,
            email:            p.email || null,
            linkedin_url:     p.linkedin_url || null,
            contact_confidence: p.email ? 'high' : 'medium',
            reason_this_person: reason,
          })
          discovered++
        }
      }
    }

    // ── Phase 2: verify existing AI-suggested contacts that Apollo didn't cover ──
    // Only runs if we have a domain (needed for apolloMatchPerson's email-domain check).
    let verified = 0
    if (domain) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, email')
        .eq('lead_id', lead_id)

      // Only verify contacts that don't yet have a verified email
      const unverified = (contacts || []).filter(
        c => c.name && c.name.trim().length > 2 && !c.email,
      )

      for (const c of unverified) {
        const hit = await apolloMatchPerson({
          name: c.name!,
          domain,
          organizationName: lead.company_name,
          reveal: true,
        })
        if (!hit?.email) continue
        const { error: updErr } = await supabase.from('contacts').update({
          email:              hit.email,
          role:               hit.title      || undefined,
          linkedin_url:       hit.linkedin_url || undefined,
          contact_confidence: 'high',
          reason_this_person: `Verified via Apollo${hit.seniority ? ` · ${hit.seniority}` : ''}${hit.title ? ` · ${hit.title}` : ''}`,
        }).eq('id', c.id)
        if (!updErr) verified++
      }
    }

    // ── Build response ─────────────────────────────────────────
    const total = discovered + verified

    if (total === 0 && apolloPeople.length === 0) {
      const hint = !domain
        ? 'Add a website to this lead so Apollo can search by company domain.'
        : `Apollo found no one at "${lead.company_name}" (${domain}). The company may be too small or new for Apollo's database — try "Find Contacts" (AI) instead.`
      return NextResponse.json({ discovered: 0, verified: 0, message: hint })
    }

    return NextResponse.json({
      discovered,
      verified,
      total,
      message: undefined,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Apollo enrichment failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
