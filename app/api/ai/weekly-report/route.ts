import { claudeJSON, CLAUDE_RESEARCH } from "@/lib/claude"
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PRODUCT_BRAIN } from '@/lib/kima-knowledge'
import { isDuplicateRule, GUARDRAIL_TYPES } from '@/lib/agent-memory'

export async function generateWeeklyReport(period: string) {
  const supabase = await createClient()

  // Fetch all feedback and leads
  const [feedbackRes, leadsRes, rulesRes] = await Promise.all([
    supabase.from('feedback_memory').select('*, lead:leads(company_name, customer_category, product_to_sell, industry_category, lead_score, priority)').order('created_at', { ascending: false }).limit(100),
    supabase.from('leads').select('status, priority, customer_category, product_to_sell, industry_category, lead_score').order('created_at', { ascending: false }).limit(200),
    supabase.from('agent_rules').select('*').eq('status', 'active'),
  ])

  const feedback = feedbackRes.data || []
  const leads = leadsRes.data || []
  const rules = rulesRes.data || []

  const reportPeriod = period || 'last_7_days'

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
    const result = await claudeJSON<{
      summary?: string
      winning_patterns?: unknown[]
      rejected_patterns?: unknown[]
      best_customer_categories?: unknown[]
      worst_customer_categories?: unknown[]
      best_products_to_sell?: unknown[]
      scoring_changes_suggested?: unknown[]
      outreach_changes_suggested?: unknown[]
      new_rules_suggested?: Array<{ rule_type?: string; rule?: string; weight?: number; reasoning?: string }>
    }>({ model: CLAUDE_RESEARCH, system: systemPrompt, user: userPrompt, maxTokens: 3000 })

    // Non-guardrail suggestions (prioritize/score_boost/outreach_style/
    // source_preference) apply immediately — same "no approval gate" policy
    // as the Learn page. reject/score_penalty stay pending_review since
    // they can broadly exclude whole categories of leads; a human should
    // see those before they take effect. Every suggestion still goes
    // through the same dedup check as Learn/Discuss so a report can't
    // re-teach a lesson already in agent_rules.
    const createdRules: string[] = []
    const annotatedSuggestions: Array<Record<string, unknown>> = []
    for (const rule of result.new_rules_suggested || []) {
      if (!rule.rule || rule.rule.length < 10) { annotatedSuggestions.push(rule); continue }
      const ruleType = rule.rule_type || 'prioritize'
      const isGuardrail = (GUARDRAIL_TYPES as readonly string[]).includes(ruleType)

      if (isGuardrail) {
        annotatedSuggestions.push({ ...rule, auto_applied: false })
        continue
      }

      const sameTypeExisting = rules.filter(r => r.rule_type === ruleType).map(r => r.rule)
      if (isDuplicateRule(rule.rule, [...sameTypeExisting, ...createdRules])) {
        annotatedSuggestions.push({ ...rule, auto_applied: false, skipped_duplicate: true })
        continue
      }

      const { error } = await supabase.from('agent_rules').insert({
        rule_type: ruleType,
        rule: rule.rule,
        weight: rule.weight || 5,
        status: 'active',
        suggestion_reason: rule.reasoning || null,
      })
      if (!error) createdRules.push(rule.rule)
      annotatedSuggestions.push({ ...rule, auto_applied: !error })
    }

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
      new_rules_suggested: annotatedSuggestions,
      status: 'pending_review',
    }).select().single()

    return { success: true, data: result, report_id: report?.id, rules_auto_applied: createdRules.length }

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI request failed'
    return { error: message }
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const result = await generateWeeklyReport(body.period || 'last_7_days')
  if ('error' in result) return NextResponse.json(result, { status: 500 })
  return NextResponse.json(result)
}
