// ============================================================
// /api/ai/enrich-lead
//
// Full AI enrichment pipeline for a freshly-added lead.
// Runs: research + classify + kima_fit + aeredium_fit (parallel)
//       → score (sequential, needs research data)
//       → contacts (findAndSaveContacts)
//       → sets status = 'approved'
//
// NOTE: Use cases are NOT generated here — only on explicit
//       user request via the "Regenerate" button.
//
// POST { lead_id: string }
// ============================================================

import { claudeJSON, CLAUDE_RESEARCH } from '@/lib/claude'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PRODUCT_BRAIN } from '@/lib/kima-knowledge'

export const maxDuration = 300 // Vercel Pro / Enterprise

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SYS = `You are a senior BD researcher for Kima and Aeredium — financial infrastructure companies.

${PRODUCT_BRAIN}

Always respond with valid JSON only. No markdown, no prose outside JSON.
Separate FACTS (verified) from ASSUMPTIONS (inferred). Be specific and business-focused.`

// ── Prompt builders ────────────────────────────────────────────

function pResearch(name: string, site: string, desc: string) {
  return `Research this company for BD purposes:
Company: ${name}
Website: ${site || 'unknown'}
Description: ${desc || 'unknown'}

Return JSON:
{
  "company_summary": "2-3 sentence summary of what they do",
  "business_model": "How they make money",
  "product_summary": "What their product does",
  "supported_chains_or_rails": "Blockchains or payment rails they support",
  "current_providers": "Known payment/bridge/settlement providers they use",
  "facts": ["fact1", "fact2"],
  "assumptions": ["assumption1"],
  "trigger_reason": "Why is this a good time to reach out? Recent news, funding, expansion, hack, etc.",
  "source_urls": ["specific page URLs that evidence the trigger"]
}`
}

function pClassify(name: string, site: string, desc: string) {
  return `Classify this company for BD purposes:
Company: ${name}
Website: ${site || 'unknown'}
Description: ${desc || 'unknown'}

Return JSON:
{
  "industry_category": "One of: Cross-border payment company, PSP/payment gateway, On/off-ramp provider, Stablecoin payment company, Wallet, DEX, Perp DEX, Launchpad, RWA platform, iGaming/payment-heavy platform, Neobank, Fintech, Exchange, Chain ecosystem, AI commerce/payment agent, Treasury management platform, Custody/payment infrastructure company, Web2 company with payment/settlement friction, Other",
  "customer_category": ["Array of: Agentic Payments Customer, LayerZero Customer, Hacked Protocol, Needs On/Off Ramp, Fireblocks Customer, Web2 Stablecoin Settlement Customer, Other"],
  "product_to_sell": "One of: Agentic payment rails, Cross-chain settlement, Stablecoin settlement, Fiat on/off-ramp, Treasury movement, DvP settlement, iGaming payments, RWA settlement, PSP settlement, Wallet onboarding, Launchpad participation, Payment orchestration, Cross-border USDT/USDC settlement",
  "region": "Their primary market region"
}`
}

function pKima(name: string, site: string, desc: string) {
  return `Identify how Kima can specifically help this company:
Company: ${name}
Website: ${site || 'unknown'}
Description: ${desc || 'unknown'}

Return JSON:
{
  "kima_fit": "Specific way Kima helps this company",
  "suggested_use_case": "Exact Kima use case to pitch",
  "settlement_angle": "How Kima improves their settlement",
  "integration_feasibility": "high|medium|low",
  "revenue_potential": "Revenue/business impact for them"
}`
}

function pAeredium(name: string, site: string, desc: string) {
  return `Identify how Aeredium strengthens the pitch for this company:
Company: ${name}
Website: ${site || 'unknown'}
Description: ${desc || 'unknown'}

Return JSON:
{
  "aeredium_fit": "How Aeredium specifically helps this company",
  "security_angle": "TEE/security/compliance angle",
  "risk_angle": "Risk reduction angle"
}`
}

function pScore(name: string, site: string, desc: string) {
  return `Score this lead for Kima/Aeredium BD purposes (0-100):
Company: ${name}
Website: ${site || 'unknown'}
Description: ${desc || 'unknown'}

SCORING: pain_point(25)+traction(20)+contact(15)+trigger(15)+category_fit(10)+integration(10)+revenue(5)
Boosts: agentic_payments_fit(+25), hacked_protocol(+25), web2_stablecoin(+25), needs_ramp(+15)
Penalties: no_pain_point(-25), no_active_product(-20), nft_only(-30)

Return JSON:
{
  "lead_score": 0-100,
  "confidence_score": 0-100,
  "priority": "excellent|qualified|needs_research|low_priority",
  "score_reasoning": "Why this score"
}`
}

// ── Contact finder helper ───────────────────────────────────────

async function findAndSaveContacts(leadId: string, company: string, website: string) {
  try {
    const { findContacts } = await import('@/lib/contactFinder')
    const contacts = await findContacts(company, website || '')
    if (!contacts.length) return
    await supabase.from('contacts').delete().eq('lead_id', leadId)
    for (const c of contacts.slice(0, 6)) {
      if (!c.name) continue
      await supabase.from('contacts').insert({
        lead_id: leadId, name: c.name, role: c.role, company,
        contact_confidence: c.confidence, reason_this_person: c.why_contact,
        email: c.email || null, linkedin_url: c.linkedin_url || null,
        twitter_url: c.twitter_url || null, github_url: c.github_url || null,
      })
    }
  } catch { /* non-fatal */ }
}

// ── Main handler ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { lead_id } = await req.json()
  if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })

  const { data: lead, error } = await supabase.from('leads').select('*').eq('id', lead_id).single()
  if (error || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const { company_name: name, website } = lead
  const desc = lead.description || lead.product_summary || ''

  // Mark in-progress
  await supabase.from('leads').update({ status: 'researching', updated_at: new Date().toISOString() }).eq('id', lead_id)

  try {
    // ── Phase 1: all analysis in parallel ─────────────────────
    const [resR, classR, kimaR, aeredR] = await Promise.allSettled([
      claudeJSON({ model: CLAUDE_RESEARCH, system: SYS, user: pResearch(name, website, desc), maxTokens: 2000 }),
      claudeJSON({ model: CLAUDE_RESEARCH, system: SYS, user: pClassify(name, website, desc), maxTokens: 800 }),
      claudeJSON({ model: CLAUDE_RESEARCH, system: SYS, user: pKima(name, website, desc), maxTokens: 1200 }),
      claudeJSON({ model: CLAUDE_RESEARCH, system: SYS, user: pAeredium(name, website, desc), maxTokens: 800 }),
    ])

    const patch: Record<string, unknown> = {}

    if (resR.status === 'fulfilled') {
      const d = resR.value
      if (d.company_summary) patch.description = d.company_summary
      if (d.business_model)  patch.business_model = d.business_model
      if (d.product_summary) patch.product_summary = d.product_summary
      if (d.supported_chains_or_rails) patch.supported_chains_or_rails = d.supported_chains_or_rails
      if (d.current_providers) patch.current_providers = d.current_providers
      if (d.trigger_reason)  patch.trigger_reason = d.trigger_reason
      if (Array.isArray(d.facts) && d.facts.length)       patch.facts = (d.facts as string[]).map(f => ({ text: f }))
      if (Array.isArray(d.assumptions) && d.assumptions.length) patch.assumptions = (d.assumptions as string[]).map(a => ({ text: a }))
    }
    if (classR.status === 'fulfilled') {
      const d = classR.value
      if (d.industry_category)  patch.industry_category = d.industry_category
      if (d.customer_category)  patch.customer_category = d.customer_category
      if (d.product_to_sell)    patch.product_to_sell   = d.product_to_sell
      if (d.region)             patch.region            = d.region
    }
    if (kimaR.status === 'fulfilled') {
      const d = kimaR.value
      if (d.kima_fit)               patch.kima_fit              = d.kima_fit
      if (d.suggested_use_case)     patch.suggested_use_case    = d.suggested_use_case
      if (d.settlement_angle)       patch.settlement_angle      = d.settlement_angle
      if (d.integration_feasibility) patch.integration_feasibility = d.integration_feasibility
      if (d.revenue_potential)      patch.revenue_potential     = d.revenue_potential
    }
    if (aeredR.status === 'fulfilled') {
      const d = aeredR.value
      if (d.aeredium_fit)   patch.aeredium_fit  = d.aeredium_fit
      if (d.security_angle) patch.security_angle = d.security_angle
      if (d.risk_angle)     patch.risk_angle    = d.risk_angle
    }

    patch.updated_at = new Date().toISOString()
    await supabase.from('leads').update(patch).eq('id', lead_id)

    // ── Phase 2: score ─────────────────────────────────────────
    const freshDesc = (resR.status === 'fulfilled' && resR.value.company_summary) ? resR.value.company_summary : desc

    const [scoreR] = await Promise.allSettled([
      claudeJSON({ model: CLAUDE_RESEARCH, system: SYS, user: pScore(name, website, freshDesc), maxTokens: 800 }),
    ])

    // Save score
    if (scoreR.status === 'fulfilled') {
      const d = scoreR.value
      const s = typeof d.lead_score === 'number' ? d.lead_score : 60
      await supabase.from('leads').update({
        lead_score: s, confidence_score: d.confidence_score,
        priority: s >= 85 ? 'excellent' : s >= 70 ? 'qualified' : s >= 50 ? 'needs_research' : 'low_priority',
        updated_at: new Date().toISOString(),
      }).eq('id', lead_id)
    }

    // Contacts only — use cases are generated on explicit user request
    await findAndSaveContacts(lead_id, name, website)

    // ── Done: mark as approved ─────────────────────────────────
    await supabase.from('leads').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', lead_id)

    // ── BD Brief: generate last so it has all enriched data ────
    // Fire-and-forget — brief failure must not block the enrichment result
    try {
      const { generateBDBrief } = await import('@/lib/bd-brief')
      const freshLead = await supabase.from('leads').select('*').eq('id', lead_id).single()
      if (freshLead.data) {
        const brief = await generateBDBrief(freshLead.data as Record<string, unknown>)
        await supabase.from('leads').update({ bd_brief: brief, updated_at: new Date().toISOString() }).eq('id', lead_id)
      }
    } catch { /* non-fatal — user can regenerate from the lead page */ }

    return NextResponse.json({ success: true, lead_id })

  } catch (err: unknown) {
    // Don't leave stuck — fall back to qualified so it still shows
    await supabase.from('leads').update({ status: 'qualified', updated_at: new Date().toISOString() }).eq('id', lead_id)
    const message = err instanceof Error ? err.message : 'Enrichment failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
