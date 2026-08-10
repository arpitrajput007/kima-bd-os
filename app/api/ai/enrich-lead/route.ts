// ============================================================
// /api/ai/enrich-lead
//
// Full AI enrichment pipeline for a freshly-added lead.
// Runs: research + classify + aerpolice_fit + aeredium_fit(AER360) (parallel)
//       → score (sequential, needs research data)
//       → contacts (findAndSaveContacts)
//       → sets status = 'approved'
//
// NOTE: Use cases are NOT generated here — only on explicit
//       user request via the "Regenerate" button.
//
// POST { lead_id: string }
// ============================================================

import { claudeJSON, CLAUDE_RESEARCH, CLAUDE_MINI } from '@/lib/claude'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PRODUCT_BRAIN } from '@/lib/kima-knowledge'
import { scoringMemory } from '@/lib/agent-memory'
import type { ProductMatch } from '@/lib/types'

export const maxDuration = 300 // Vercel Pro / Enterprise

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── System prompt ──────────────────────────────────────────────
// The PRODUCT_BRAIN now includes the CONSULTANT_FRAMEWORK which
// instructs the model to understand the company BEFORE evaluating
// product fit. This is the most important quality lever.
const SYS_BASE = `You are a senior solutions consultant and BD strategist for Aerpolice (AI-agent governance) and AER360 (hardware-enforced custody and key-signing) — the only two products this pipeline evaluates leads for.

${PRODUCT_BRAIN}

ALWAYS respond with valid JSON only. No markdown, no prose outside JSON.
Distinguish FACTS (observable/verifiable) from ASSUMPTIONS (reasoned inference).`

// ── PHASE 1: Deep company research ────────────────────────────
// Understand the company first — NO product angle yet.
function pResearch(name: string, site: string, desc: string) {
  return `Research this company as if you are preparing for a first meeting with them.

Company: ${name}
Website: ${site || 'unknown'}
Initial description: ${desc || 'unknown'}

Your job at this stage: UNDERSTAND them deeply. Do not evaluate our products yet.

Answer these specific questions:

1. ACTUAL PRODUCT — What does a customer actually do on their platform? Not the category — the specific workflow. What is the core action a user takes?
2. ACTUAL CUSTOMERS — Who uses this? Types of companies or consumers, approximate scale, how they acquire customers.
3. REVENUE MODEL — How do they make money? Transaction fees, SaaS, spread, custody fees? Be specific.
4. EXISTING INFRASTRUCTURE — What payment rails, blockchains, custody solutions, banking partners, or settlement systems do they already have? Be specific — this matters enormously for evaluating fit.
5. STAGE — Early startup / growth-stage / mature enterprise? What signals indicate this (funding, team size, product maturity)?
6. REGIONS & REGULATIONS — Where do they operate? Which compliance regimes apply (MiCA, FinCEN, FCA, MAS, etc.)?
7. STRATEGIC DIRECTION — What are they building toward? What have they announced, launched, or hired for recently?
8. VISIBLE CONSTRAINTS — What is visibly missing or limiting in their current setup? What do they seem to struggle with based on public info?

Return JSON:
{
  "company_summary": "3-4 sentences, specific. What the company actually does, for whom, and how. If you replace the company name with another company and it still fits — rewrite it.",
  "business_model": "Specific revenue model. Not just 'payments company' — how exactly do they earn?",
  "product_summary": "What their product actually does at the workflow level.",
  "existing_infrastructure": "Specific chains, rails, custody providers, banking partners, APIs they use. This is critical context.",
  "customer_profile": "Who their actual customers are — types, sizes, notable names if public.",
  "company_stage": "startup|growth|enterprise — with brief reasoning.",
  "supported_chains_or_rails": "Specific blockchains and payment rails.",
  "current_providers": "Known payment/bridge/settlement/custody providers they use.",
  "region": "Primary region(s) of operation and regulatory environment.",
  "strategic_direction": "What they appear to be building toward over the next 12-24 months.",
  "visible_constraints": "What is clearly missing or limiting based on public information.",
  "facts": ["Observable fact 1", "Observable fact 2"],
  "assumptions": ["Reasoned inference 1 — marked as assumed"],
  "trigger_reason": "Why is NOW a good time to reach out? Recent funding, product launch, expansion, regulatory pressure, hack, new hire?",
  "source_urls": ["URLs that evidence the trigger if found"]
}`
}

// ── PHASE 2a: Real pain identification ────────────────────────
// Derived from research. Focus on operational bottlenecks specific
// to THIS company, not generic industry challenges.
function pPain(name: string, researchSummary: string) {
  return `Based on the company research below, identify the REAL operational pain points for ${name}.

COMPANY RESEARCH:
${researchSummary}

RULES:
- Each pain must be SPECIFIC to this company's situation — traceable to their actual business model, customer type, or existing infrastructure
- Do NOT list generic industry challenges like "cross-border payments are slow" — that's not a pain, that's a category description
- Do NOT list problems that their existing infrastructure already solves
- If a pain is speculative, label it clearly
- Focus on: operational bottlenecks, missing capabilities, friction in their core workflow, constraints that are costing them money or growth

Return JSON:
{
  "pain_point": "Top 3 pains as one concise paragraph (will be stored as the primary pain field). Start with the most critical.",
  "pain_point_severity": "critical|high|medium|low — based on how much this is likely blocking their growth or revenue",
  "top_pains": [
    {
      "title": "Short name for this pain",
      "description": "One sentence — what specifically is the operational problem?",
      "evidence": "What observable fact supports this pain existing for this specific company?",
      "severity": "critical|high|medium"
    }
  ],
  "pain_point_evidence": "The most compelling evidence-backed argument for why their pain is real. Be specific to this company.",
  "pain_point_evidence_type": "verified_source|agent_analysis|inferred"
}`
}

// ── PHASE 2b: Classification ───────────────────────────────────
// Runs in parallel with pPain. Uses research findings.
function pClassify(name: string, site: string, researchSummary: string) {
  return `Classify this company based on the research findings:

Company: ${name}
Website: ${site || 'unknown'}
Research summary: ${researchSummary}

Return JSON:
{
  "industry_category": "One of: AI agent / agentic commerce company, AI-native SaaS selling to enterprise, Custody / MPC wallet provider, Exchange, Treasury or fund, Fintech, Robotics / autonomous systems, Other",
  "customer_category": ["Array — only include categories that genuinely apply: Agentic Payments Customer, Aerpolice Governance Customer, AER360 Custody / Key-Governance Customer, Other"],
  "product_to_sell": "One of: Aerpolice agent identity, Aerpolice policy + execution gate, Aerpolice audit trail, AER360 threshold signing, AER360 policy engine, AER360 wallet, AER360 agent control center — choose NO_FIT if none genuinely apply",
  "region": "Their primary market region"
}`
}

// ── PHASE 3: Honest product fit evaluation ────────────────────
// Runs AFTER deep research and pain identification.
// Evaluates both products with "no_fit" as a valid answer.
function pFit(name: string, researchSummary: string, painSummary: string) {
  return `Evaluate our products against this company.

COMPANY: ${name}

RESEARCH FINDINGS:
${researchSummary}

PAIN POINTS:
${painSummary}

━━ EVALUATION RULES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"no_fit" is a perfectly valid conclusion. 3 deeply credible insights beat 10 generic ones.
If you recommend a product without a genuine gap — you waste the BD team's time.
The output must be specific to THIS company. If the analysis still makes sense with a different company name substituted in, it is too generic.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Evaluate each product:

AERPOLICE (governance for AI agents with financial or system authority):
- Does this company have autonomous AI agents that move money, approve payments, or take consequential financial/system actions?
- "Uses AI" is NOT sufficient. The agents must have real economic or system authority.
- Check: are agents executing actions, or only recommending them?
- Verdict options: strong_fit | moderate_fit | weak_fit | no_fit

AER360 (hardware-enforced custody, threshold signing, and per-agent wallet policy):
- Does this company have a REAL gap in how it custodies funds or signs transactions — software-only MPC, ad hoc multisig, seed-phrase-based wallets, or no per-agent spend policy?
- Check: are they a custodian, exchange, treasury, or fund handling institutional volume? Are they about to give an AI agent real spending authority with no bounded wallet for it?
- If they've already solved this with hardware-attested signing themselves, AER360 is a competitor scenario, not a customer scenario.
- Verdict options: strong_fit | moderate_fit | weak_fit | no_fit

Return JSON:
{
  "aerpolice": {
    "verdict": "strong_fit|moderate_fit|weak_fit|no_fit",
    "aerpolice_fit": "Specific reasoning — do they have agents with financial/system authority? What governance gap exists? Or, if no_fit, explain exactly why.",
    "agent_control_angle": "Specific control/governance angle, or null",
    "suggested_use_case": "Exact Aerpolice use case if applicable, or null",
    "integration_feasibility": "high|medium|low|not_applicable",
    "revenue_potential": "Estimated value this creates for them, or null"
  },
  "aer360": {
    "verdict": "strong_fit|moderate_fit|weak_fit|no_fit",
    "aeredium_fit": "Specific reasoning for THIS company — what custody/signing gap exists, tied to their actual stack. Or, if no_fit, explain exactly why.",
    "security_angle": "Threshold-signing/hardware-enclave/policy-enforcement angle specific to their situation, or null",
    "risk_angle": "Risk reduction angle (key theft, insider threat, unaudited transactions), or null",
    "suggested_use_case": "Exact AER360 use case if applicable, or null",
    "integration_feasibility": "high|medium|low|not_applicable",
    "revenue_potential": "Estimated value this creates for them, or null"
  },
  "combined_opportunity": "Is there a genuine case for combining Aerpolice + AER360 (e.g. an agentic-payments company that needs both a decision gate and a hardware-governed wallet)? Be specific. If not, say so clearly.",
  "strategic_hypotheses": [
    "When they start giving agents financial authority, Aerpolice becomes critical because...",
    "If they start handling institutional volume, AER360's hardware-enforced signing will matter because..."
  ],
  "honest_assessment": "One paragraph. Plain English. Is this a real opportunity? Which product and why? If weak or no fit across the board, say that clearly. The BD team needs honest signal, not manufactured confidence.",
  "competitor_context": "Are either of our products in competition with something they already have? Be explicit.",

  // ── Product & use-case match matrix ────────────────────────
  // The verdicts above are company-level (Aerpolice/AER360 as a whole).
  // Now break each down into its SPECIFIC sub-products — e.g. a company can
  // be a no_fit for AER360's wallet but a strong fit for AERKey specifically.
  // Return exactly 8 entries, one per product below. match values: "strong" | "partial" | "none"
  "product_matches": [
    { "product": "Aerpolice Agent Identity", "company": "Aerpolice", "match": "strong | partial | none", "why": "...", "use_case": "" },
    { "product": "Aerpolice Agent Policy + Execution Gate", "company": "Aerpolice", "match": "strong | partial | none", "why": "...", "use_case": "" },
    { "product": "Aerpolice Audit Trail", "company": "Aerpolice", "match": "strong | partial | none", "why": "...", "use_case": "" },
    { "product": "Aerpolice Controls (kill switch)", "company": "Aerpolice", "match": "strong | partial | none", "why": "...", "use_case": "" },
    { "product": "AER360 AERKey (Threshold Signing)", "company": "AER360", "match": "strong | partial | none", "why": "...", "use_case": "" },
    { "product": "AER360 Policy Engine", "company": "AER360", "match": "strong | partial | none", "why": "...", "use_case": "" },
    { "product": "AER360 AERKey Wallet", "company": "AER360", "match": "strong | partial | none", "why": "...", "use_case": "" },
    { "product": "AER360 Agent Control Center", "company": "AER360", "match": "strong | partial | none", "why": "...", "use_case": "" }
  ]
}`
}

// ── PHASE 4: Score ─────────────────────────────────────────────
// Scored AFTER honest fit evaluation — not before.
function pScore(name: string, fitSummary: string, companyStage: string) {
  return `Score this lead based on the honest product fit evaluation below.

Company: ${name}
Stage: ${companyStage || 'unknown'}

FIT EVALUATION:
${fitSummary}

SCORING FRAMEWORK (0–100):
Base factors: genuine_pain_identified(25) + clear_product_fit(25) + traction_and_stage(15) + timing_signal(15) + contact_accessibility(10) + revenue_potential(10)

Boosts (add to base):
+20 if agentic payments fit is strong (clear AI agents with financial or system authority)
+20 if strong AER360 fit with specific custody/key-signing gap identified
+15 if there is a live trigger event (recent funding, security incident, product launch, expansion)
+10 if this is an enterprise or growth-stage company with budget

Penalties (subtract):
-30 if the company already has mature infrastructure that solves the gap we'd pitch
-25 if there is no real pain point identified (only generic category fit)
-20 if the company is pre-product or has no live customers
-15 if fit is only speculative / future-state only

Return JSON:
{
  "lead_score": 0-100,
  "confidence_score": 0-100,
  "priority": "excellent|qualified|needs_research|low_priority",
  "score_reasoning": "One sentence explaining the score — reference something specific about this company and this fit."
}`
}

// ── Research cache helpers ──────────────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const CACHE_TTL_DAYS = 7

async function getCachedResearch(domain: string): Promise<Record<string, unknown> | null> {
  if (!domain) return null
  try {
    const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 86_400_000).toISOString()
    const { data } = await supabase
      .from('lead_research_cache')
      .select('research_data')
      .eq('domain', domain)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    return (data?.research_data as Record<string, unknown>) ?? null
  } catch {
    return null
  }
}

async function saveResearchCache(domain: string, companyName: string, url: string, data: Record<string, unknown>) {
  if (!domain) return
  try {
    await supabase.from('lead_research_cache').insert({
      url, domain, company_name: companyName, research_data: data, web_research_used: false,
    })
  } catch { /* non-fatal */ }
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

  // Inject learned memory (rules/knowledge/feedback from Make Agent Learn) so
  // enrichment reflects everything taught — ICP signals, product preferences,
  // rejected patterns. Used as the system prompt for every phase below.
  const memory = await scoringMemory({ tags: (lead.tags as string[] | null) || [] })
  const SYS = `${SYS_BASE}${memory}`

  try {
    // ════════════════════════════════════════════════════════════
    // NEW: Sequential deep reasoning pipeline
    //
    // Phase 1 → Understand the company first (no product angle)
    // Phase 2 → Identify pain + classify (parallel, uses Phase 1)
    // Phase 3 → Honest product fit (uses Phase 1+2 findings)
    // Phase 4 → Score (based on genuine fit, not assumed fit)
    //
    // This is slower than the old 4-parallel approach but produces
    // dramatically better output quality because product fit is
    // evaluated with full company context, not blindly alongside it.
    // ════════════════════════════════════════════════════════════

    // ── Phase 1: Deep company research ────────────────────────
    // Check research cache first — avoids burning API credits on companies
    // we've already researched within the last 7 days.
    const domain = website ? extractDomain(website) : ''
    let fromCache = false
    let resData = await getCachedResearch(domain)
    if (resData) {
      fromCache = true
    } else {
      resData = await claudeJSON({
        model: CLAUDE_RESEARCH, system: SYS,
        user: pResearch(name, website, desc), maxTokens: 2500,
      }).catch(() => null)
      if (resData) await saveResearchCache(domain, name, website || '', resData as Record<string, unknown>)
    }
    void fromCache // suppress unused-var lint

    const resSum = resData
      ? `Company: ${name}\nWhat they do: ${resData.company_summary || desc}\nBusiness model: ${resData.business_model || 'unknown'}\nExisting infrastructure: ${resData.existing_infrastructure || 'unknown'}\nCustomer profile: ${resData.customer_profile || 'unknown'}\nStage: ${resData.company_stage || 'unknown'}\nStrategic direction: ${resData.strategic_direction || 'unknown'}\nVisible constraints: ${resData.visible_constraints || 'unknown'}`
      : `Company: ${name}\nDescription: ${desc}`

    // Save Phase 1 findings immediately (so lead page shows progress)
    const patch1: Record<string, unknown> = {}
    if (resData) {
      if (resData.company_summary)           patch1.description              = resData.company_summary
      if (resData.business_model)            patch1.business_model           = resData.business_model
      if (resData.product_summary)           patch1.product_summary          = resData.product_summary
      if (resData.supported_chains_or_rails) patch1.supported_chains_or_rails = resData.supported_chains_or_rails
      if (resData.current_providers)         patch1.current_providers        = resData.current_providers
      if (resData.trigger_reason)            patch1.trigger_reason           = resData.trigger_reason
      if (resData.region)                    patch1.region                   = resData.region
      if (Array.isArray(resData.facts) && resData.facts.length)
        patch1.facts = (resData.facts as string[]).map(f => ({ text: f }))
      if (Array.isArray(resData.assumptions) && resData.assumptions.length)
        patch1.assumptions = (resData.assumptions as string[]).map(a => ({ text: a }))
      patch1.updated_at = new Date().toISOString()
      await supabase.from('leads').update(patch1).eq('id', lead_id)
    }

    // ── Phase 2: Pain identification + Classification (parallel) ──
    const [painR, classR] = await Promise.allSettled([
      claudeJSON({ model: CLAUDE_RESEARCH, system: SYS, user: pPain(name, resSum), maxTokens: 1500 }),
      // Classification is picking from fixed enum lists — Haiku handles this well at ~20× lower cost.
      claudeJSON({ model: CLAUDE_MINI, system: SYS, user: pClassify(name, website, resSum), maxTokens: 800 }),
    ])

    const painSum = painR.status === 'fulfilled'
      ? `Pain point: ${painR.value.pain_point || 'unknown'}\nTop pains: ${JSON.stringify(painR.value.top_pains || [])}`
      : 'Pain points: unknown'

    const patch2: Record<string, unknown> = {}
    if (painR.status === 'fulfilled') {
      const d = painR.value
      if (d.pain_point)              patch2.pain_point              = d.pain_point
      if (d.pain_point_severity)     patch2.pain_point_severity     = d.pain_point_severity
      if (d.pain_point_evidence)     patch2.pain_point_evidence     = d.pain_point_evidence
      if (d.pain_point_evidence_type) patch2.pain_point_evidence_type = d.pain_point_evidence_type
    }
    if (classR.status === 'fulfilled') {
      const d = classR.value
      if (d.industry_category) patch2.industry_category = d.industry_category
      if (d.customer_category) patch2.customer_category = d.customer_category
      if (d.product_to_sell)   patch2.product_to_sell   = d.product_to_sell
      if (d.region && !patch1.region) patch2.region     = d.region
    }
    if (Object.keys(patch2).length) {
      patch2.updated_at = new Date().toISOString()
      await supabase.from('leads').update(patch2).eq('id', lead_id)
    }

    // ── Phase 3: Honest product fit (both products, one call) ──
    // Runs AFTER company understanding + pain — this is the key change.
    type FitSection = Record<string, unknown>
    type FitResult = {
      aer360?: FitSection; aerpolice?: FitSection
      combined_opportunity?: string; strategic_hypotheses?: string[]
      honest_assessment?: string; competitor_context?: string
      product_matches?: ProductMatch[]
    }
    const fitData = await claudeJSON<FitResult>({
      model: CLAUDE_RESEARCH, system: SYS,
      user: pFit(name, resSum, painSum), maxTokens: 3200,
    }).catch(() => null)

    const fitSum = fitData ? JSON.stringify({
      aer360_verdict:    fitData.aer360?.verdict,
      aerpolice_verdict: fitData.aerpolice?.verdict,
      honest_assessment: fitData.honest_assessment,
    }) : 'Fit evaluation: not available'

    const patch3: Record<string, unknown> = {}
    if (fitData) {
      const ae = fitData.aer360 ?? {}
      if (ae.aeredium_fit)   patch3.aeredium_fit  = ae.aeredium_fit
      if (ae.security_angle) patch3.security_angle = ae.security_angle
      if (ae.risk_angle)     patch3.risk_angle    = ae.risk_angle
      // Shared single-value fields — set from AER360 first, Aerpolice below
      // overwrites if it also has a value, since Aerpolice is the
      // highest-priority wedge when both products genuinely fit.
      if (ae.suggested_use_case)      patch3.suggested_use_case      = ae.suggested_use_case
      if (ae.integration_feasibility) patch3.integration_feasibility = ae.integration_feasibility
      if (ae.revenue_potential)       patch3.revenue_potential       = ae.revenue_potential

      const ag = fitData.aerpolice ?? {}
      if (ag.aerpolice_fit)       patch3.aerpolice_fit       = ag.aerpolice_fit
      if (ag.agent_control_angle) patch3.agent_control_angle = ag.agent_control_angle
      if (ag.suggested_use_case)      patch3.suggested_use_case      = ag.suggested_use_case
      if (ag.integration_feasibility) patch3.integration_feasibility = ag.integration_feasibility
      if (ag.revenue_potential)       patch3.revenue_potential       = ag.revenue_potential

      // Full 8-product match matrix (which specific product — e.g. AERKey —
      // is the best fit), not just the 2 company-level verdicts above.
      if (fitData.product_matches?.length) patch3.product_matches = fitData.product_matches

      // Store honest_assessment in competitor_context field (re-purposed for
      // a richer summary that includes the full honest evaluation)
      if (fitData.honest_assessment) patch3.competitor_context = fitData.honest_assessment
      else if (fitData.competitor_context) patch3.competitor_context = fitData.competitor_context

      if (fitData.strategic_hypotheses?.length)
        patch3.assumptions = [
          ...(patch1.assumptions as {text:string}[] || []),
          ...fitData.strategic_hypotheses.map(h => ({ text: `[Strategic hypothesis] ${h}` })),
        ]
      patch3.updated_at = new Date().toISOString()
      await supabase.from('leads').update(patch3).eq('id', lead_id)
    }

    // ── Phase 4: Score ─────────────────────────────────────────
    // Scoring from a structured summary is a straightforward numerical task — Haiku is sufficient.
    const scoreData = await claudeJSON({
      model: CLAUDE_MINI, system: SYS,
      user: pScore(name, fitSum, String(resData?.company_stage || '')), maxTokens: 600,
    }).catch(() => null)

    if (scoreData) {
      const s = typeof scoreData.lead_score === 'number' ? scoreData.lead_score : 60
      await supabase.from('leads').update({
        lead_score: s,
        confidence_score: scoreData.confidence_score,
        priority: s >= 85 ? 'excellent' : s >= 70 ? 'qualified' : s >= 50 ? 'needs_research' : 'low_priority',
        updated_at: new Date().toISOString(),
      }).eq('id', lead_id)
    }

    // ── Contacts ───────────────────────────────────────────────
    await findAndSaveContacts(lead_id, name, website)

    // ── Done: mark as approved ─────────────────────────────────
    await supabase.from('leads').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', lead_id)

    return NextResponse.json({ success: true, lead_id })

  } catch (err: unknown) {
    // Don't leave stuck — fall back to qualified so it still shows
    await supabase.from('leads').update({ status: 'qualified', updated_at: new Date().toISOString() }).eq('id', lead_id)
    const message = err instanceof Error ? err.message : 'Enrichment failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
