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

// ── System prompt ──────────────────────────────────────────────
// The PRODUCT_BRAIN now includes the CONSULTANT_FRAMEWORK which
// instructs the model to understand the company BEFORE evaluating
// product fit. This is the most important quality lever.
const SYS = `You are a senior solutions consultant and BD strategist for Kima, Aeredium, and Aergap — financial infrastructure companies.

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
  "industry_category": "One of: Cross-border payment company, PSP/payment gateway, On/off-ramp provider, Stablecoin payment company, Wallet, DEX, Perp DEX, Launchpad, RWA platform, iGaming/payment-heavy platform, Neobank, Fintech, Exchange, Chain ecosystem, AI commerce/payment agent, Treasury management platform, Custody/payment infrastructure company, Web2 company with payment/settlement friction, Other",
  "customer_category": ["Array — only include categories that genuinely apply: Agentic Payments Customer, LayerZero Customer, Hacked Protocol, Needs On/Off Ramp, Fireblocks Customer, Web2 Stablecoin Settlement Customer, Other"],
  "product_to_sell": "One of: Agentic payment rails, Cross-chain settlement, Stablecoin settlement, Fiat on/off-ramp, Treasury movement, DvP settlement, iGaming payments, RWA settlement, PSP settlement, Wallet onboarding, Launchpad participation, Payment orchestration, Cross-border USDT/USDC settlement — choose NO_FIT if none genuinely apply",
  "region": "Their primary market region"
}`
}

// ── PHASE 3: Honest product fit evaluation ────────────────────
// Runs AFTER deep research and pain identification.
// Evaluates all three products with "no_fit" as a valid answer.
// This replaces the old pKima + pAeredium separate calls.
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

KIMA (settlement + interoperability infrastructure):
- Does this company have a REAL gap in settlement or cross-rail value movement that Kima fills?
- Check: what settlement infrastructure do they already have? If they've solved this themselves, Kima is a competitor scenario, not a customer scenario.
- Verdict options: strong_fit | moderate_fit | weak_fit | no_fit

AEREDIUM (institutional-grade L1 infrastructure):
- Is this company at a stage/scale/partner mix where Aeredium's TEE validators, 250k TPS, or institutional-grade infrastructure genuinely matters?
- Check: are they serving banks or institutions? Do they have throughput needs or regulatory requirements that justify this?
- Verdict options: strong_fit | moderate_fit | weak_fit | no_fit

AERGAP (governance for AI agents with financial authority):
- Does this company have autonomous AI agents that move money, approve payments, or take consequential financial actions?
- "Uses AI" is NOT sufficient. The agents must have economic authority.
- Check: are agents executing financial transactions, or only recommending them?
- Verdict options: strong_fit | moderate_fit | weak_fit | no_fit

Return JSON:
{
  "kima": {
    "verdict": "strong_fit|moderate_fit|weak_fit|no_fit",
    "kima_fit": "Specific reasoning for THIS company — what gap exists, what workflow breaks without Kima. Or, if no_fit, explain exactly why.",
    "suggested_use_case": "Exact Kima use case if applicable, or null",
    "settlement_angle": "Specific settlement opportunity, or null",
    "integration_feasibility": "high|medium|low|not_applicable",
    "revenue_potential": "Estimated value this creates for them, or null"
  },
  "aeredium": {
    "verdict": "strong_fit|moderate_fit|weak_fit|no_fit",
    "aeredium_fit": "Specific reasoning for THIS company, or explanation of why it's not relevant",
    "security_angle": "TEE/compliance/throughput angle specific to their situation, or null",
    "risk_angle": "Risk reduction angle, or null"
  },
  "aergap": {
    "verdict": "strong_fit|moderate_fit|weak_fit|no_fit",
    "aergap_fit": "Specific reasoning — do they have agents with financial authority? What governance gap exists?",
    "agent_control_angle": "Specific control/governance angle, or null"
  },
  "combined_opportunity": "Is there a genuine case for combining products? Be specific. If not, say so clearly.",
  "strategic_hypotheses": [
    "If they expand into X, then Kima becomes relevant because...",
    "When they add agent-based automation, Aergap will matter because..."
  ],
  "honest_assessment": "One paragraph. Plain English. Is this a real opportunity? Which product and why? If weak or no fit across the board, say that clearly. The BD team needs honest signal, not manufactured confidence.",
  "competitor_context": "Are any of our products in competition with something they already have? Be explicit."
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
+20 if agentic payments fit is strong (clear AI agents with financial authority)
+20 if strong Kima fit with specific settlement gap identified
+15 if there is a live trigger event (recent funding, product launch, expansion, hack)
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
    const resData = await claudeJSON({
      model: CLAUDE_RESEARCH, system: SYS,
      user: pResearch(name, website, desc), maxTokens: 2500,
    }).catch(() => null)

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
      claudeJSON({ model: CLAUDE_RESEARCH, system: SYS, user: pClassify(name, website, resSum), maxTokens: 800 }),
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

    // ── Phase 3: Honest product fit (all 3 products, one call) ──
    // Runs AFTER company understanding + pain — this is the key change.
    const fitData = await claudeJSON({
      model: CLAUDE_RESEARCH, system: SYS,
      user: pFit(name, resSum, painSum), maxTokens: 2000,
    }).catch(() => null)

    const fitSum = fitData ? JSON.stringify({
      kima_verdict: fitData.kima?.verdict,
      aeredium_verdict: fitData.aeredium?.verdict,
      aergap_verdict: fitData.aergap?.verdict,
      honest_assessment: fitData.honest_assessment,
    }) : 'Fit evaluation: not available'

    const patch3: Record<string, unknown> = {}
    if (fitData) {
      if (fitData.kima) {
        if (fitData.kima.kima_fit)               patch3.kima_fit               = fitData.kima.kima_fit
        if (fitData.kima.suggested_use_case)      patch3.suggested_use_case     = fitData.kima.suggested_use_case
        if (fitData.kima.settlement_angle)        patch3.settlement_angle       = fitData.kima.settlement_angle
        if (fitData.kima.integration_feasibility) patch3.integration_feasibility = fitData.kima.integration_feasibility
        if (fitData.kima.revenue_potential)       patch3.revenue_potential      = fitData.kima.revenue_potential
      }
      if (fitData.aeredium) {
        if (fitData.aeredium.aeredium_fit)   patch3.aeredium_fit  = fitData.aeredium.aeredium_fit
        if (fitData.aeredium.security_angle) patch3.security_angle = fitData.aeredium.security_angle
        if (fitData.aeredium.risk_angle)     patch3.risk_angle    = fitData.aeredium.risk_angle
      }
      if (fitData.competitor_context)     patch3.competitor_context     = fitData.competitor_context
      if (fitData.honest_assessment)      patch3.competitor_context     = fitData.honest_assessment // repurpose field
      if (fitData.strategic_hypotheses?.length)
        patch3.assumptions = [
          ...(patch1.assumptions as {text:string}[] || []),
          ...(fitData.strategic_hypotheses as string[]).map((h: string) => ({ text: `[Strategic hypothesis] ${h}` })),
        ]
      patch3.updated_at = new Date().toISOString()
      await supabase.from('leads').update(patch3).eq('id', lead_id)
    }

    // ── Phase 4: Score ─────────────────────────────────────────
    const scoreData = await claudeJSON({
      model: CLAUDE_RESEARCH, system: SYS,
      user: pScore(name, fitSum, resData?.company_stage || ''), maxTokens: 600,
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
