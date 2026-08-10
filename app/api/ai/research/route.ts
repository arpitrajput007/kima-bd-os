import { claudeJSON, claudeText, CLAUDE_RESEARCH } from "@/lib/claude"
import { NextRequest, NextResponse } from 'next/server'
import { PRODUCT_BRAIN } from '@/lib/kima-knowledge'
import { scoringMemory } from '@/lib/agent-memory'


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
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
    return NextResponse.json({ error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your .env.local file.' }, { status: 400 })
  }

  const { company_name, website, description, action } = await req.json()

  const memory = await scoringMemory()

  const systemPrompt = `You are a senior BD researcher for Aerpolice (AI-agent governance) and AER360 (hardware-enforced custody and key-signing) — the only two products this pipeline evaluates leads for.

${PRODUCT_BRAIN}
${memory}

Always respond with valid JSON only. No markdown, no prose outside JSON.
Always separate FACTS (verified) from ASSUMPTIONS (inferred).
Quality over quantity. Be specific and business-focused.`

  try {
    let userPrompt = ''
    
    if (action === 'research') {
      userPrompt = `Research this company for BD purposes:
Company: ${company_name}
Website: ${website || 'unknown'}
Description: ${description || 'unknown'}

Return JSON with this exact structure:
{
  "company_summary": "2-3 sentence summary of what they do",
  "business_model": "How they make money",
  "product_summary": "What their product does",
  "supported_chains_or_rails": "Blockchains or payment rails they support",
  "current_providers": "Known payment/bridge/settlement providers they use",
  "facts": ["fact1", "fact2"],
  "assumptions": ["assumption1", "assumption2"],
  "trigger_reason": "Why is this a good time to reach out? Recent news, funding, expansion, hack, etc.",
  "source_urls": ["exact, specific page URLs (article/news/funding post) that evidence the trigger — full links to specific pages, NOT homepages"]
}`

    } else if (action === 'pain_points') {
      userPrompt = `Identify the exact pain points this company has that Aerpolice/AER360 can solve:
Company: ${company_name}
Website: ${website || 'unknown'}
Description: ${description || 'unknown'}

Return JSON:
{
  "pain_point": "The single most important pain point Aerpolice/AER360 can solve",
  "pain_point_severity": "critical|high|medium|low",
  "pain_point_evidence": "Specific evidence. If from a real article/news/incident report, paste the exact quote. If reasoned from their public tech stack or business model, explain the reasoning.",
  "pain_point_source_url": "EXACT URL to article/news/blog/tweet/incident report that proves this pain. Empty string if no real URL — never invent one.",
  "pain_point_evidence_type": "verified_source if pain_point_source_url is a real article that explicitly mentions this pain | agent_analysis if reasoned from publicly known facts | inferred if general industry knowledge with no specific backing",
  "why_it_matters": "Why this pain point matters to their business",
  "how_urgent": "How urgent is this problem for them?",
  "secondary_pain_points": ["other pain point 1", "other pain point 2"]
}`

    } else if (action === 'aeredium_fit') {
      userPrompt = `Identify how AER360 (AERKey threshold signing / Policy Engine / AERKey Wallet / Agent Control Center) can specifically help this company:
Company: ${company_name}
Website: ${website || 'unknown'}
Description: ${description || 'unknown'}

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
      userPrompt = `Identify how Aerpolice (governance & control layer for AI agents that move money or take system actions) can specifically help this company:
Company: ${company_name}
Website: ${website || 'unknown'}
Description: ${description || 'unknown'}

Aerpolice only fits if this company has autonomous AI agents that take consequential financial or system actions. "Uses AI" is NOT sufficient — the agents must have real economic or system authority. If they don't, say so honestly in aerpolice_fit.

Return JSON:
{
  "aerpolice_fit": "Specific way Aerpolice helps this company — what governance gap exists, or an honest explanation of why it's not a fit",
  "agent_control_angle": "The specific control/governance angle (Triple Gate, audit trail, spend limits, identity, kill switch) for their situation, or null"
}`

    } else if (action === 'classify') {
      userPrompt = `Classify this company for BD purposes:
Company: ${company_name}
Website: ${website || 'unknown'}
Description: ${description || 'unknown'}

Return JSON:
{
  "industry_category": "One of: AI agent / agentic commerce company, AI-native SaaS selling to enterprise, Custody / MPC wallet provider, Exchange, Treasury or fund, Fintech, Robotics / autonomous systems, Other",
  "customer_category": ["Array of: Agentic Payments Customer, Aerpolice Governance Customer, AER360 Custody / Key-Governance Customer, Other"],
  "product_to_sell": "One of: Aerpolice agent identity, Aerpolice policy + execution gate, Aerpolice audit trail, AER360 threshold signing, AER360 policy engine, AER360 wallet, AER360 agent control center",
  "region": "Their primary market region",
  "classification_reasoning": "Why you classified them this way"
}`

    } else if (action === 'score') {
      userPrompt = `Score this lead for Aerpolice/AER360 BD purposes (0-100):
Company: ${company_name}
Website: ${website || 'unknown'}
Description: ${description || 'unknown'}

SCORING SYSTEM (lead_score — general ICP fit, independent of timing):
Base scores: pain_point (25), traction (20), contact_found (15), trigger (15), category_fit (10), integration_feasibility (10), revenue_potential (5)
Boosts: agentic_payments_fit (+25), aer360_custody_gap (+20), fireblocks_or_mpc_customer (+15), giving_agent_spend_authority (+20), recent_trigger (+15), decision_maker_found (+15)
Penalties: no_pain_point (-25), no_active_product (-20), no_decision_maker (-15), no_source_proof (-30), generic_ai_only_no_agent_authority (-25)

URGENCY SCORING (urgency_score — separate 0-100, how urgent to reach out THIS WEEK):
Driven ONLY by trigger recency + pain severity, NOT by how good a long-term fit they are.
70-100: dated trigger in roughly the last 30-60 days (funding, hack, launch, expansion) AND severe pain
40-69: real but older/vaguer trigger, or severe pain with no dated trigger
0-39: no trigger found, or it's stale/speculative — can still be a high lead_score company

Return JSON:
{
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

      userPrompt = `Find real contacts at this company for Aerpolice/AER360 BD outreach.
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
