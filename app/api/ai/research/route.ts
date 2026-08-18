import { claudeJSON, claudeText, claudeConfigured, CLAUDE_RESEARCH } from "@/lib/claude"
import { NextRequest, NextResponse } from 'next/server'
import { PRODUCT_BRAIN, AER360_DISCOVERY_BRAIN } from '@/lib/kima-knowledge'
import { scoringMemory } from '@/lib/agent-memory'
import { readUrl } from '@/lib/webRead'


async function getHunterContacts(website: string): Promise<string> {
  if (!process.env.HUNTER_API_KEY || !website) return ''
  try {
    const domain = website.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${process.env.HUNTER_API_KEY}&limit=10`)
    const data = await res.json()
    if (!data?.data?.emails?.length) return ''
    return JSON.stringify(data.data.emails.map((e: any) => ({
      email: e.value,
      name: `${e.first_name || ''} ${e.last_name || ''}`.trim(),
      position: e.position,
      department: e.department,
      confidence: e.confidence
    })))
  } catch (e) {
    return ''
  }
}

export async function POST(req: NextRequest) {
  if (!claudeConfigured()) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured. Add it to your .env.local (local) or hosting provider environment (production).' }, { status: 400 })
  }

  const { company_name, website, description, action } = await req.json()

  // Real evidence beats guessing from a short description — crawl the
  // company's own site once (skip for 'contacts', which already does real
  // multi-source lookup via lib/contactFinder).
  const [memory, homepageText] = await Promise.all([
    scoringMemory(),
    website && action !== 'contacts' ? readUrl(website, 4000) : Promise.resolve(''),
  ])
  const evidenceContext = homepageText
    ? `\nCOMPANY'S OWN WEBSITE (Level 1 evidence — crawled live, treat as ground truth over training data):\n${homepageText}\n`
    : ''

  const systemPrompt = `You are a senior BD researcher for three co-equal products: AER360 (hardware-enforced wallet/fund custody and key-signing), Aerpolice (AI-agent governance), and AERseal (hardware-enforced custody of a deployed smart contract's privileged admin authority). These are the only three products this pipeline evaluates leads for. None is a default primary.

${PRODUCT_BRAIN}

${AER360_DISCOVERY_BRAIN}
${memory}

Always respond with valid JSON only. No markdown, no prose outside JSON.
Always separate FACTS (verified) from ASSUMPTIONS (inferred) from UNKNOWNS (genuinely unconfirmed).
Classify the company (customer | partner | competitor | integration | investor_ecosystem | not_relevant | unclear) before evaluating fit — never score a competitor or investor as if it were a prospect.
Quality over quantity. Be specific and business-focused.`

  try {
    let userPrompt = ''
    
    if (action === 'research') {
      userPrompt = `Research this company for BD purposes:
Company: ${company_name}
Website: ${website || 'unknown'}
Description: ${description || 'unknown'}
${evidenceContext}
Return JSON with this exact structure:
{
  "company_summary": "2-3 sentence summary of what they do",
  "business_model": "How they make money",
  "product_summary": "What their product does",
  "supported_chains_or_rails": "Blockchains or payment rails they support",
  "current_providers": "Known payment/bridge/settlement providers they use",
  "facts": ["fact1", "fact2"],
  "assumptions": ["assumption1", "assumption2"],
  "unknowns": ["thing1 that matters but is genuinely unconfirmed"],
  "trigger_reason": "Why is this a good time to reach out? Use the trigger dictionary above — must be datable and real, not a generic AI/crypto mention.",
  "trigger_date": "The trigger's actual date if known (e.g. '2026-07-15' or 'July 2026'), or null if undated",
  "source_urls": ["exact, specific page URLs (article/news/funding post) that evidence the trigger — full links to specific pages, NOT homepages"]
}`

    } else if (action === 'pain_points') {
      userPrompt = `Identify the exact pain points this company has that AER360, Aerpolice, or AERseal can solve — each evaluated independently:
Company: ${company_name}
Website: ${website || 'unknown'}
Description: ${description || 'unknown'}
${evidenceContext}
Return JSON:
{
  "pain_point": "The single most important pain point one of our products can solve",
  "pain_point_severity": "critical|high|medium|low",
  "pain_point_evidence": "Specific evidence. If from a real article/news/incident report, paste the exact quote. If reasoned from their public tech stack or business model, explain the reasoning.",
  "pain_point_source_url": "EXACT URL to article/news/blog/tweet/incident report that proves this pain. Empty string if no real URL — never invent one.",
  "pain_point_evidence_type": "verified_source if pain_point_source_url is a real article that explicitly mentions this pain | agent_analysis if reasoned from publicly known facts | inferred if general industry knowledge with no specific backing",
  "potential_gap": "What's architecturally missing that one of our products could fill, or exactly 'Gap not confirmed' if unsupported by evidence",
  "why_it_matters": "Why this pain point matters to their business",
  "how_urgent": "How urgent is this problem for them?",
  "secondary_pain_points": ["other pain point 1", "other pain point 2"]
}`

    } else if (action === 'aeredium_fit') {
      userPrompt = `Identify how AER360 (AERKey threshold signing / Policy Engine / AERKey Wallet / Agent Control Center) can specifically help this company's WALLET/FUND custody or key-signing:
Company: ${company_name}
Website: ${website || 'unknown'}
Description: ${description || 'unknown'}
${evidenceContext}
Return JSON:
{
  "aeredium_fit": "How AER360 specifically helps this company — which pillar(s), tied to their actual stack. Or, if no genuine fit, say so honestly.",
  "security_angle": "Threshold-signing/hardware-enclave/policy-enforcement angle",
  "risk_angle": "Risk reduction angle (key theft, insider threat, unaudited transactions)",
  "suggested_use_case": "Exact AER360 use case to pitch, or null",
  "integration_feasibility": "How easy is integration? (high/medium/low)",
  "revenue_potential": "Revenue/business impact for them, or null"
}`

    } else if (action === 'aerpolice_fit') {
      userPrompt = `Identify how Aerpolice (governance & control layer for AI agents that move money or take system actions) can specifically help this company — a co-equal product, not a secondary note:
Company: ${company_name}
Website: ${website || 'unknown'}
Description: ${description || 'unknown'}
${evidenceContext}
Aerpolice only fits if this company has autonomous AI agents that take consequential financial or system actions. "Uses AI" is NOT sufficient — the agents must have real economic or system authority. If they don't, say so honestly in aerpolice_fit.

Return JSON:
{
  "aerpolice_fit": "Specific way Aerpolice helps this company — what governance gap exists, or an honest explanation of why it's not a fit",
  "agent_control_angle": "The specific control/governance angle (Triple Gate, audit trail, spend limits, identity, kill switch) for their situation, or null"
}`

    } else if (action === 'aerseal_fit') {
      userPrompt = `Identify how AERseal (threshold-controlled custody of a deployed smart contract's privileged admin authority — upgrade, mint, pause, freeze, oracle, bridge config, role management) can specifically help this company:
Company: ${company_name}
Website: ${website || 'unknown'}
Description: ${description || 'unknown'}
${evidenceContext}
AERseal only fits if this company operates a deployed smart contract whose privileged role is controlled by a single EOA or a weakly-secured multisig. It is NOT wallet/treasury custody (that's AER360) and NOT AI-agent governance (that's Aerpolice). If there's no deployed contract with such a role, or the role is already renounced/immutable/behind a strong timelock, say so honestly in aerseal_fit.

Return JSON:
{
  "aerseal_fit": "Specific way AERseal helps this company — name the specific privileged contract role and its current controller, or an honest explanation of why it's not a fit",
  "suggested_use_case": "Exact AERseal use case to pitch, or null",
  "integration_feasibility": "How easy is integration? (high/medium/low)",
  "revenue_potential": "Revenue/business impact for them, or null"
}`

    } else if (action === 'classify') {
      userPrompt = `Classify this company for BD purposes. Do TWO classifications:
Company: ${company_name}
Website: ${website || 'unknown'}
Description: ${description || 'unknown'}
${evidenceContext}
1. customer/partner/competitor classification (see the classification rules above) — this comes first and gates everything else.
2. Industry/category classification.

Return JSON:
{
  "classification": "customer|partner|competitor|integration|investor_ecosystem|not_relevant|unclear",
  "industry_category": "One of: AI agent / agentic commerce company, AI-native SaaS selling to enterprise, Custody / MPC wallet provider, Exchange, Treasury or fund, Fintech, Robotics / autonomous systems, DeFi protocol / DAO / token issuer with a deployed contract, Other",
  "customer_category": ["Array of: AER360 Custody / Key-Governance Customer, AERseal Contract-Authority Customer, Agentic Payments Customer, Aerpolice Governance Customer, Other"],
  "product_to_sell": "One of: AER360 threshold signing, AER360 policy engine, AER360 wallet, AER360 agent control center, AERseal contract-authority transfer, Aerpolice agent identity, Aerpolice policy + execution gate, Aerpolice audit trail",
  "region": "Their primary market region",
  "classification_reasoning": "Why you classified them this way, for both classifications above"
}`

    } else if (action === 'score') {
      userPrompt = `Score this lead for AER360 / Aerpolice / AERseal BD purposes (0-100) — three co-equal products:
Company: ${company_name}
Website: ${website || 'unknown'}
Description: ${description || 'unknown'}
${evidenceContext}
Reason through the fit dimensions above (financial exposure, agent/automation activity, deployed-contract privileged-role exposure, need for transaction/admin controls, security sensitivity, recent trigger, likelihood of buying external infrastructure, differentiation for them, buyer accessibility) before committing to a number.

SCORING SYSTEM (lead_score — general ICP fit, independent of timing):
Base scores: pain_point (25), traction (20), contact_found (15), trigger (15), category_fit (10), integration_feasibility (10), revenue_potential (5)
Boosts: aer360_custody_gap (+25), aerseal_contract_admin_gap (+25), giving_agent_or_human_spend_authority (+20), fireblocks_or_mpc_customer_with_visible_gap (+15), agentic_payments_fit (+15), recent_trigger (+15), decision_maker_found (+15)
Penalties: no_pain_point (-25), no_active_product (-20), no_decision_maker (-15), no_source_proof (-30), generic_ai_only_no_financial_authority (-25), classification_is_competitor_or_investor (-100)

URGENCY SCORING (urgency_score — separate 0-100, how urgent to reach out THIS WEEK):
Use the trigger dictionary and freshness bands above. Driven ONLY by trigger recency + pain severity, NOT by how good a long-term fit they are.
70-100: dated VERY HIGH/HIGH value trigger in roughly the last 30-60 days AND severe pain
40-69: real but older/vaguer trigger, or severe pain with no dated trigger
0-39: no trigger found, or it's stale/speculative — can still be a high lead_score company

Return JSON:
{
  "classification": "customer|partner|competitor|integration|investor_ecosystem|not_relevant|unclear",
  "lead_score": 0-100,
  "urgency_score": 0-100,
  "urgency_reasoning": "1-2 sentences: what dated trigger and pain severity drove this number",
  "confidence_score": 0-100,
  "priority": "excellent|qualified|needs_research|low_priority",
  "score_breakdown": {
    "pain_point_score": 0-25,
    "traction_score": 0-20,
    "trigger_score": 0-15,
    "category_fit_score": 0-10,
    "integration_feasibility_score": 0-10,
    "revenue_potential_score": 0-5,
    "category_boost": 0-25,
    "penalties": 0
  },
  "score_reasoning": "Why this score",
  "flags": ["any concerns or flags"]
}`

    } else if (action === 'contacts') {
      // Run real multi-source contact discovery first
      const { findContacts } = await import('@/lib/contactFinder')
      const realContacts = await findContacts(company_name, website || '')

      if (realContacts.length > 0) {
        // Return real contacts directly — no AI hallucination needed
        return NextResponse.json({
          success: true,
          data: {
            suggested_contacts: realContacts.map(c => ({
              name: c.name,
              role: c.role,
              email_pattern: c.email || null,
              linkedin_url: c.linkedin_url || null,
              twitter_url: c.twitter_url || null,
              github_url: c.github_url || null,
              why_this_person: c.why_contact,
              contact_confidence: c.confidence,
              source: c.source,
              outreach_angle: c.raw_snippet || null,
            })),
            ideal_contact_title: realContacts[0]?.role || 'Head of Partnerships',
            research_notes: `Found ${realContacts.length} real contacts via ${[...new Set(realContacts.map(c => c.source))].join(', ')}`,
            sources_used: [...new Set(realContacts.map(c => c.source))],
          }
        })
      }

      // Fallback: AI suggestion with Hunter data if no real contacts found
      const hunterData = await getHunterContacts(website)
      const hunterContext = hunterData
        ? `\nVerified emails from Hunter.io:\n${hunterData}\nUse these real emails. Do NOT guess emails.`
        : '\nNo verified emails found. Do NOT invent email addresses — leave email_pattern null.'

      userPrompt = `Find real contacts at this company for Aerpolice/AER360/AERseal BD outreach.
Company: ${company_name}
Website: ${website || 'unknown'}
Description: ${description || 'unknown'}${hunterContext}

CRITICAL: Only return contacts with REAL names you know from public sources (LinkedIn, Twitter, GitHub, press).
Do NOT make up names. Do NOT guess emails. Mark confidence as "low" if name is uncertain.

Return JSON:
{
  "suggested_contacts": [
    {
      "name": "Real full name from public source, or null if unknown",
      "email_pattern": "Verified email only, null if not found",
      "role": "Their actual title",
      "why_this_person": "Why this person is the right contact",
      "linkedin_url": "Full LinkedIn profile URL if known, else null",
      "twitter_url": "Full Twitter URL if known, else null",
      "contact_confidence": "high|medium|low",
      "source": "linkedin|twitter|github|press|unknown",
      "outreach_angle": "How to approach this person specifically"
    }
  ],
  "ideal_contact_title": "The most important contact title to reach",
  "research_notes": "Notes on how to find the right contact"
}`
    }

    const result = await claudeJSON({ model: CLAUDE_RESEARCH, system: systemPrompt, user: userPrompt, maxTokens: 2000 })
    return NextResponse.json({ success: true, data: result })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI request failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
