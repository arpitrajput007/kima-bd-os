import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Kima/Aeredium context for the AI synthesis
const KIMA_CONTEXT = `
KIMA: Universal settlement layer. Moves value across crypto and TradFi without bridges, wrapped assets, or smart contracts.
Use cases: cross-chain deposits, fiat-to-crypto onboarding, stablecoin payments, cross-border settlement, treasury rebalancing, RWA delivery-versus-payment. Single API, free and instant.

AEREDIUM: TEE-attested blockchain infra. MEV resistance, execution accountability, compliance-ready. Institutional-grade settlement.

TARGET CUSTOMER CATEGORIES:
1. LayerZero Customer — using LayerZero or similar cross-chain messaging
2. Hacked Protocol — affected by bridge/smart contract/oracle exploits
3. Needs On/Off Ramp — needing fiat<->crypto conversion
4. Fireblocks Customer — using Fireblocks or similar custody infra
5. Web2 Stablecoin Settlement Customer — traditional companies needing stablecoin rails

OUR ICP:
- PSPs and payment gateways needing stablecoin settlement
- Cross-border fintechs (remittance, payroll, B2B payments)
- DEXs/wallets looking for cross-chain settlement or on/off-ramp
- Recently hacked protocols (bridge/oracle/relayer exploits)
- RWA platforms needing delivery-versus-payment settlement
- iGaming platforms with high cross-border payment volume
- Web2 companies with SWIFT/wire transfer friction (exporters, neobanks)
- Companies in UAE-India, EU-India, US-India payment corridors

WE SELL:
- Cross-chain settlement, Stablecoin settlement, Fiat on/off-ramp, Treasury movement
- DvP settlement, iGaming payments, RWA settlement, PSP settlement
- Wallet onboarding, Launchpad participation, Payment orchestration

RULE TYPES WE USE:
- prioritize: Companies/signals that should be prioritized
- reject: Companies/signals that should be rejected
- score_boost: Conditions that boost a lead's score
- score_penalty: Conditions that reduce a lead's score
- outreach_style: How to write outreach for specific cases
- source_preference: Which sources/directories to prefer
`

// Read any URL via Jina.ai
async function readUrl(url: string): Promise<string> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`
    const res = await fetch(jinaUrl, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) throw new Error(`Jina fetch failed: ${res.status}`)
    const text = await res.text()
    return text.slice(0, 15000)
  } catch (e) {
    console.error('[readUrl]', e)
    return ''
  }
}

// Analyze image via GPT-4o vision
async function analyzeImage(base64Image: string, mimeType: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: 'high' },
            },
            {
              type: 'text',
              text: 'Please extract and describe all text, data, and visual information in this image in detail. This will be used for BD intelligence analysis. Include any company names, metrics, product features, market data, or competitive information visible.',
            },
          ],
        },
      ],
      max_tokens: 4000,
    })
    return completion.choices[0].message.content || ''
  } catch (e) {
    console.error('[analyzeImage]', e)
    return ''
  }
}

// Core synthesis: extract BD intelligence from any content
async function synthesizeKnowledge(
  content: string,
  sourceName: string,
  sourceType: string,
  existingRules: string
): Promise<{
  title: string
  summary: string
  knowledge_type: string
  tags: string[]
  insights: string[]
  new_rules: Array<{ rule_type: string; rule: string; weight: number }>
  new_sources: Array<{ source_name: string; source_type: string; source_url_or_query: string; target_industry_category: string; target_customer_category: string; notes: string }>
  raw_knowledge: string
}> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are the intelligence synthesis engine for the Kima BD OS. 
Your job is to extract actionable BD intelligence from any content and convert it into structured knowledge, agent rules, and discovery sources.

${KIMA_CONTEXT}

EXISTING AGENT RULES (do not duplicate these):
${existingRules || 'None yet.'}

Return ONLY valid JSON. No markdown. Be specific and actionable.`,
      },
      {
        role: 'user',
        content: `Analyze this content from "${sourceName}" (type: ${sourceType}) and extract BD intelligence for Kima/Aeredium:

CONTENT:
${content}

Extract and return this exact JSON structure:
{
  "title": "Short descriptive title for what was learned (max 10 words)",
  "summary": "2-3 sentence summary of the key BD intelligence extracted",
  "knowledge_type": "one of: icp_signal | competitor_intel | market_trend | product_context | outreach_strategy | source_directory | general",
  "tags": ["array of 2-5 relevant tags like: 'icp', 'competitor', 'outreach', 'market', 'product', 'ramp', 'defi', 'web2', etc"],
  "insights": ["array of 3-8 specific, actionable insight strings extracted"],
  "new_rules": [
    {
      "rule_type": "prioritize | reject | score_boost | score_penalty | outreach_style | source_preference",
      "rule": "specific rule text based on insights from this content",
      "weight": 0
    }
  ],
  "new_sources": [
    {
      "source_name": "descriptive name for this source",
      "source_type": "website | google_search | twitter_profile | linkedin_company | telegram_group | rss_feed | defillama_category | crunchbase_list | ecosystem_directory | hackathon_directory | news_source | manual_list",
      "source_url_or_query": "exact URL or search query string",
      "target_industry_category": "comma-separated industry categories",
      "target_customer_category": "comma-separated customer categories from our ICP list",
      "notes": "why this source is relevant"
    }
  ],
  "raw_knowledge": "Full synthesis of all BD-relevant knowledge from this content, written as detailed notes for the agent. Be thorough — 200-500 words."
}

Rules for new_rules:
- Only create rules that add NEW value not already in existing rules
- Weight: prioritize/score_boost use +5 to +25, reject/score_penalty use -5 to -25, outreach_style/source_preference use 0
- Be specific and actionable, not generic
- Create 1-4 rules maximum

Rules for new_sources:
- Only include if the content references specific URLs, directories, or search patterns worth monitoring
- Leave empty array [] if no new sources are evident
- Maximum 3 new sources`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 4000,
  })

  try {
    return JSON.parse(completion.choices[0].message.content || '{}')
  } catch (e) {
    console.error('[synthesizeKnowledge parse error]', e)
    return {
      title: 'Learning from ' + sourceName,
      summary: 'Content was processed but synthesis had parsing issues.',
      knowledge_type: 'general',
      tags: [],
      insights: [],
      new_rules: [],
      new_sources: [],
      raw_knowledge: content.slice(0, 1000),
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''

    let inputType = ''
    let inputContent = ''
    let sourceName = ''
    let mimeType = 'image/png'

    if (contentType.includes('multipart/form-data')) {
      // File or image upload
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      inputType = (formData.get('type') as string) || 'file'
      sourceName = file?.name || 'Uploaded file'

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      mimeType = file.type || 'application/octet-stream'

      if (mimeType.startsWith('image/')) {
        // Image/screenshot — send to GPT-4o vision
        inputType = 'image'
        const base64 = buffer.toString('base64')
        inputContent = await analyzeImage(base64, mimeType)
        if (!inputContent) {
          return NextResponse.json({ error: 'Could not analyze image' }, { status: 400 })
        }
      } else if (mimeType === 'application/pdf') {
        // PDF — use require for CJS compat
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const pdfParse = require('pdf-parse')
          const pdfData = await pdfParse(buffer)
          inputContent = pdfData.text.slice(0, 15000)
        } catch {
          // fallback: treat as text
          inputContent = buffer.toString('utf-8').slice(0, 15000)
        }

      } else {
        // Plain text/md/csv
        inputContent = buffer.toString('utf-8').slice(0, 15000)
      }
    } else {
      // JSON body — url or text
      const body = await req.json()
      inputType = body.type || 'text'
      sourceName = body.source_name || (inputType === 'url' ? body.content : 'Manual input')
      inputContent = body.content || ''

      if (inputType === 'url') {
        if (!inputContent.startsWith('http')) {
          return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
        }
        const fetched = await readUrl(inputContent)
        if (!fetched || fetched.length < 50) {
          return NextResponse.json({ error: 'Could not read URL content. Try a different URL.' }, { status: 400 })
        }
        inputContent = fetched
      }
    }

    if (!inputContent || inputContent.length < 20) {
      return NextResponse.json({ error: 'Content is too short to analyze' }, { status: 400 })
    }

    // Load existing rules to avoid duplication
    const { data: existingRules } = await supabase
      .from('agent_rules')
      .select('rule_type, rule')
      .eq('status', 'active')
    const existingRulesStr = (existingRules || [])
      .map(r => `[${r.rule_type}] ${r.rule}`)
      .join('\n')

    // Synthesize knowledge
    const synthesis = await synthesizeKnowledge(inputContent, sourceName, inputType, existingRulesStr)

    let rulesCreated = 0
    let sourcesCreated = 0
    const createdRules: string[] = []
    const createdSources: string[] = []

    // Save new agent rules
    if (synthesis.new_rules && synthesis.new_rules.length > 0) {
      for (const rule of synthesis.new_rules.slice(0, 4)) {
        if (!rule.rule || rule.rule.length < 10) continue
        const { error } = await supabase.from('agent_rules').insert({
          rule_type: rule.rule_type || 'prioritize',
          rule: rule.rule,
          weight: rule.weight || 0,
          status: 'active',
        })
        if (!error) {
          rulesCreated++
          createdRules.push(rule.rule)
        }
      }
    }

    // Save new sources
    if (synthesis.new_sources && synthesis.new_sources.length > 0) {
      for (const source of synthesis.new_sources.slice(0, 3)) {
        if (!source.source_name || !source.source_url_or_query) continue
        const { error } = await supabase.from('sources').insert({
          source_name: source.source_name,
          source_type: source.source_type || 'website',
          source_url_or_query: source.source_url_or_query,
          target_industry_category: source.target_industry_category || '',
          target_customer_category: source.target_customer_category || '',
          frequency: 'weekly',
          quality_rating: 'unrated',
          status: 'active',
          notes: source.notes || `Auto-added from learning session: ${sourceName}`,
        })
        if (!error) {
          sourcesCreated++
          createdSources.push(source.source_name)
        }
      }
    }

    // Save to agent_knowledge
    const { data: savedKnowledge, error: knowledgeError } = await supabase
      .from('agent_knowledge')
      .insert({
        title: synthesis.title || 'Learning from ' + sourceName,
        content: synthesis.raw_knowledge || synthesis.summary || '',
        source_type: inputType as 'file' | 'url' | 'text' | 'image' | 'screenshot',
        source_name: sourceName,
        tags: synthesis.tags || [],
        knowledge_type: synthesis.knowledge_type || 'general',
        rules_created: rulesCreated,
        sources_created: sourcesCreated,
        status: 'active',
      })
      .select('id')
      .single()

    if (knowledgeError) {
      console.error('[agent_knowledge insert error]', knowledgeError)
    }

    return NextResponse.json({
      success: true,
      knowledge_id: savedKnowledge?.id,
      title: synthesis.title,
      summary: synthesis.summary,
      knowledge_type: synthesis.knowledge_type,
      tags: synthesis.tags,
      insights: synthesis.insights,
      rules_created: rulesCreated,
      sources_created: sourcesCreated,
      created_rules: createdRules,
      created_sources: createdSources,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Learning pipeline failed'
    console.error('[learn route error]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
