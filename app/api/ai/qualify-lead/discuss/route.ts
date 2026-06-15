// POST /api/ai/qualify-lead/discuss
// ------------------------------------------------------------
// Chat about a researched lead BEFORE saving it.
// Takes the full QualifyResult + a question, responds with
// lead-specific analysis using the full product brain + agent memory.

import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { FULL_BRAIN } from '@/lib/kima-knowledge'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI not configured' }, { status: 400 })
  }

  const body = await req.json()
  const { message, lead_data, history = [] } = body

  if (!message?.trim() || !lead_data) {
    return NextResponse.json({ error: 'message and lead_data required' }, { status: 400 })
  }

  // Load agent memory for richer context
  let memoryBlock = ''
  try {
    const { fullMemory } = await import('@/lib/agent-memory')
    memoryBlock = await fullMemory()
  } catch { /* non-fatal */ }

  const leadContext = `
LEAD BEING REVIEWED: ${lead_data.company_name}
Website: ${lead_data.source_url || 'not available'}

VERDICT: ${lead_data.verdict === 'good_lead' ? '✅ Good Lead' : '❌ Not a Lead'}
LEAD SCORE: ${lead_data.lead_score}/100
CONFIDENCE: ${lead_data.confidence_score}%
PRIORITY: ${lead_data.priority}

VERDICT REASONING:
${lead_data.verdict_reasoning}

STRENGTHS:
${(lead_data.verdict_strengths || []).map((s: string) => `- ${s}`).join('\n') || 'None listed'}

FLAGS:
${(lead_data.verdict_flags || []).map((f: string) => `- ${f}`).join('\n') || 'None listed'}

COMPANY DESCRIPTION:
${lead_data.description}

BUSINESS MODEL: ${lead_data.business_model}
PRODUCT: ${lead_data.product_summary}
SUPPORTED CHAINS / RAILS: ${lead_data.supported_chains_or_rails}
CURRENT PROVIDERS: ${lead_data.current_providers}
COMPETITOR / INCUMBENT: ${lead_data.competitor_or_current_provider}
COMPETITOR CONTEXT: ${lead_data.competitor_context}

PAIN POINT: ${lead_data.pain_point}
SEVERITY: ${lead_data.pain_point_severity}
EVIDENCE: ${lead_data.pain_point_evidence}
EVIDENCE TYPE: ${lead_data.pain_point_evidence_type}
TRIGGER: ${lead_data.trigger_reason}

KIMA FIT: ${lead_data.kima_fit}
AEREDIUM FIT: ${lead_data.aeredium_fit}
SUGGESTED USE CASE: ${lead_data.suggested_use_case}
SETTLEMENT ANGLE: ${lead_data.settlement_angle}
SECURITY ANGLE: ${lead_data.security_angle}
${lead_data.product_matches?.length ? `\nPRODUCT MATCH MATRIX:\n${lead_data.product_matches.map((p: { product: string; match: string; why: string; use_case?: string }) => `  ${p.product} (${p.match}): ${p.why}${p.use_case ? ' | USE CASE: ' + p.use_case : ''}`).join('\n')}` : ''}

CUSTOMER CATEGORIES: ${(lead_data.customer_category || []).join(', ')}
INDUSTRY: ${lead_data.industry_category}
REGION: ${lead_data.region}
PRODUCT TO SELL: ${lead_data.product_to_sell}

REVENUE POTENTIAL: ${lead_data.revenue_potential}
INTEGRATION FEASIBILITY: ${lead_data.integration_feasibility}`.trim()

  const systemPrompt = `You are a sharp senior BD advisor for Kima, Aeredium, and Aergap — three complementary products. You are helping the user evaluate a specific lead BEFORE deciding to add it to the pipeline or discard it.

${FULL_BRAIN}

${memoryBlock ? `AGENT MEMORY:\n${memoryBlock}` : ''}

ALWAYS EVALUATE ALL THREE PRODUCTS:
- Aergap: Do they have AI agents taking real consequential actions? Enterprise deals stalling in security review? → agent identity, policy gate, audit trail
- Kima: Do they need cross-chain, cross-rail, or stablecoin settlement? → UPR / LaaS / DvP
- Aeredium: Do they need institutional-grade infrastructure, bank API access, or hardware signing? → L1 / AERLink / AERKey

When asked "how does their tech work and where do we fit" — explain their tech first in plain terms, then map each of our products to a specific integration point for this company.

Answer concisely, directly, and with conviction. Reference specific details from the lead data. Give your actual opinion — don't hedge.

Format: short paragraphs, **bold** for key points. No "Certainly!" or filler.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: `LEAD DATA:\n${leadContext}` },
        // Inject history AFTER the lead context so it feels continuous
        ...(history as { role: 'user' | 'assistant'; content: string }[]).slice(-10),
        { role: 'user', content: message },
      ],
      temperature: 0.55,
      max_tokens: 700,
    })

    const reply = completion.choices[0].message.content?.trim() || 'Could not generate a response.'
    return NextResponse.json({ reply })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Discussion failed'
    console.error('[discuss-lead]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
