import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { PRODUCT_BRAIN } from '@/lib/kima-knowledge'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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

  const systemPrompt = `You are a senior BD researcher for Kima and Aeredium — financial infrastructure companies.

${PRODUCT_BRAIN}

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
      userPrompt = `Identify the exact pain points this company has that Kima/Aeredium can solve:
Company: ${company_name}
Website: ${website || 'unknown'}
Description: ${description || 'unknown'}

Return JSON:
{
  "pain_point": "The single most important pain point Kima can solve",
  "pain_point_severity": "critical|high|medium|low",
  "pain_point_evidence": "Evidence or reasoning for this pain point",
  "why_it_matters": "Why this pain point matters to their business",
  "how_urgent": "How urgent is this problem for them?",
  "secondary_pain_points": ["other pain point 1", "other pain point 2"]
}`

    } else if (action === 'kima_fit') {
      userPrompt = `Identify how Kima can specifically help this company:
Company: ${company_name}
Website: ${website || 'unknown'}
Description: ${description || 'unknown'}

Return JSON:
{
  "kima_fit": "Specific way Kima helps this company",
  "suggested_use_case": "Exact Kima use case to pitch",
  "integration_angle": "How they would integrate Kima",
  "revenue_potential": "Revenue/business impact for them",
  "possible_objections": ["objection1", "objection2"],
  "objection_responses": ["response1", "response2"],
  "settlement_angle": "How Kima improves their settlement",
  "integration_feasibility": "How easy is integration? (high/medium/low)"
}`

    } else if (action === 'aeredium_fit') {
      userPrompt = `Identify how Aeredium can specifically strengthen the pitch for this company:
Company: ${company_name}
Website: ${website || 'unknown'}
Description: ${description || 'unknown'}

Return JSON:
{
  "aeredium_fit": "How Aeredium specifically helps this company",
  "security_angle": "TEE/security/compliance angle",
  "risk_angle": "Risk reduction angle",
  "why_aeredium_matters": "Why Aeredium makes the Kima pitch stronger for this company"
}`

    } else if (action === 'classify') {
      userPrompt = `Classify this company for BD purposes:
Company: ${company_name}
Website: ${website || 'unknown'}
Description: ${description || 'unknown'}

Return JSON:
{
  "industry_category": "One of: Cross-border payment company, PSP/payment gateway, On/off-ramp provider, Stablecoin payment company, Wallet, DEX, Perp DEX, Launchpad, RWA platform, iGaming/payment-heavy platform, Neobank, Fintech, Exchange, Chain ecosystem, AI commerce/payment agent, Treasury management platform, Custody/payment infrastructure company, Web2 company with payment/settlement friction, Other",
  "customer_category": ["Array of: Agentic Payments Customer, LayerZero Customer, Hacked Protocol, Needs On/Off Ramp, Fireblocks Customer, Web2 Stablecoin Settlement Customer, Other"],
  "product_to_sell": "One of: Agentic payment rails, Cross-chain settlement, Stablecoin settlement, Fiat on/off-ramp, Treasury movement, DvP settlement, iGaming payments, RWA settlement, PSP settlement, Wallet onboarding, Launchpad participation, Payment orchestration, Cross-border USDT/USDC settlement",
  "region": "Their primary market region",
  "classification_reasoning": "Why you classified them this way"
}`

    } else if (action === 'score') {
      userPrompt = `Score this lead for Kima/Aeredium BD purposes (0-100):
Company: ${company_name}
Website: ${website || 'unknown'}
Description: ${description || 'unknown'}

SCORING SYSTEM:
Base scores: pain_point (25), traction (20), contact_found (15), trigger (15), category_fit (10), integration_feasibility (10), revenue_potential (5)
Boosts: agentic_payments_fit (+25), LayerZero+real_value (+20), Hacked_protocol+bridge_exploit (+25), needs_ramp (+15), fireblocks_customer (+15), web2_stablecoin (+25), recent_trigger (+15), decision_maker_found (+15)
Penalties: no_pain_point (-25), no_active_product (-20), no_decision_maker (-15), nft_only (-30), no_source_proof (-30), generic_web3_only (-25)

Return JSON:
{
  "lead_score": 0-100,
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
      const hunterData = await getHunterContacts(website)
      const hunterContext = hunterData ? `\nVerified emails from Hunter.io database:\n${hunterData}\nSelect the most relevant BD contacts from this list if any, otherwise guess patterns.` : ''
      
      userPrompt = `Find the ideal contacts at this company for Kima/Aeredium BD outreach:
Company: ${company_name}
Website: ${website || 'unknown'}
Description: ${description || 'unknown'}${hunterContext}

Return JSON:
{
  "suggested_contacts": [
    {
      "name": "Name if known or null",
      "email_pattern": "Their verified email from Hunter, or an educated guess if none exist",
      "role": "Ideal role to contact",
      "why_this_person": "Why this person is the right contact",
      "linkedin_hint": "LinkedIn search query to find them",
      "contact_confidence": "high|medium|low",
      "outreach_angle": "How to approach this person specifically"
    }
  ],
  "ideal_contact_title": "The most important contact title",
  "research_notes": "Notes on how to find the right contact"
}`
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2000,
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')
    return NextResponse.json({ success: true, data: result })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI request failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
