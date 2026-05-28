import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PRODUCT_BRAIN } from '@/lib/kima-knowledge'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
    return NextResponse.json({ error: 'OpenAI API key not configured.' }, { status: 400 })
  }

  const body = await req.json()

  // Fetch all feedback and leads
  const [feedbackRes, leadsRes, rulesRes] = await Promise.all([
    supabase.from('feedback_memory').select('*, lead:leads(company_name, customer_category, product_to_sell, industry_category, lead_score, priority)').order('created_at', { ascending: false }).limit(100),
    supabase.from('leads').select('status, priority, customer_category, product_to_sell, industry_category, lead_score').order('created_at', { ascending: false }).limit(200),
    supabase.from('agent_rules').select('*').eq('status', 'active'),
  ])

  const feedback = feedbackRes.data || []
  const leads = leadsRes.data || []
  const rules = rulesRes.data || []

  const reportPeriod = body.period || 'last_7_days'

  const systemPrompt = `You are analyzing BD performance data for Kima/Aeredium and generating a learning report. Be specific and actionable.

${PRODUCT_BRAIN}`

  const userPrompt = `Generate a weekly BD learning report based on this data:

LEADS DATA:
- Total leads: ${leads.length}
- By status: ${JSON.stringify(leads.reduce((acc: Record<string, number>, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc }, {}))}
- By priority: ${JSON.stringify(leads.reduce((acc: Record<string, number>, l) => { if(l.priority) acc[l.priority] = (acc[l.priority] || 0) + 1; return acc }, {}))}
- Excellent leads (85+): ${leads.filter(l => (l.lead_score || 0) >= 85).length}
- By customer category: ${JSON.stringify(leads.reduce((acc: Record<string, number>, l) => { (l.customer_category || []).forEach((c: string) => { acc[c] = (acc[c] || 0) + 1 }); return acc }, {}))}
- By product: ${JSON.stringify(leads.reduce((acc: Record<string, number>, l) => { if(l.product_to_sell) acc[l.product_to_sell] = (acc[l.product_to_sell] || 0) + 1; return acc }, {}))}

FEEDBACK DATA:
${feedback.slice(0, 30).map(f => `- ${f.lead?.company_name}: action=${f.action_taken}, quality=${f.lead_quality}, pain_accuracy=${f.pain_point_accuracy}, outcome=${f.outcome}, rejection_reason=${f.rejection_reason || 'none'}`).join('\n')}

CURRENT RULES: ${rules.length} active rules

Return JSON:
{
  "summary": "2-3 sentence executive summary of this week's BD performance",
  "winning_patterns": [{"pattern": "...", "evidence": "...", "recommendation": "..."}],
  "rejected_patterns": [{"pattern": "...", "evidence": "...", "recommendation": "..."}],
  "best_customer_categories": [{"category": "...", "performance": "...", "why": "..."}],
  "worst_customer_categories": [{"category": "...", "issue": "...", "fix": "..."}],
  "best_products_to_sell": [{"product": "...", "performance": "..."}],
  "most_common_rejection_reasons": ["reason1", "reason2"],
  "scoring_changes_suggested": [{"change": "...", "reasoning": "...", "suggested_weight": 0}],
  "outreach_changes_suggested": [{"change": "...", "reasoning": "..."}],
  "new_rules_suggested": [{"rule_type": "prioritize|reject|score_boost|score_penalty|outreach_style|source_preference", "rule": "...", "weight": 0, "reasoning": "..."}],
  "focus_for_next_week": "Top 3 priorities for next week's BD work",
  "report_period": "${reportPeriod}"
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 3000,
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')

    // Save report to DB
    const { data: report } = await supabase.from('learning_reports').insert({
      report_period: reportPeriod,
      summary: result.summary,
      winning_patterns: result.winning_patterns || [],
      rejected_patterns: result.rejected_patterns || [],
      best_customer_categories: result.best_customer_categories || [],
      worst_customer_categories: result.worst_customer_categories || [],
      best_products_to_sell: result.best_products_to_sell || [],
      scoring_changes_suggested: result.scoring_changes_suggested || [],
      outreach_changes_suggested: result.outreach_changes_suggested || [],
      new_rules_suggested: result.new_rules_suggested || [],
      status: 'pending_review',
    }).select().single()

    return NextResponse.json({ success: true, data: result, report_id: report?.id })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI request failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
