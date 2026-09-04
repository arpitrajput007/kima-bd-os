// ============================================================================
// Aerpolice customer discovery — dedicated pipeline
// ============================================================================
// Mirrors app/api/ai/discover-aerseal/route.ts's shape (harvest -> extract ->
// profile -> score -> gate -> enrich -> outreach seed -> save), answering a
// narrower question: which real, named company has an AI agent that already
// takes a verifiable EXTERNAL action, what event makes that a live governance
// question right now, and can we prove both from a primary source?
//
// NO EXTERNAL ACTION, NO LEAD. NO TRIGGER, NO SEND — but unlike AERSeal, a
// missing trigger downgrades a qualified action-taking agent to "Monitor"
// rather than dropping it; see evaluateGate in lib/aerpolice-discovery.ts.
//
// Manual trigger only — this route is never registered in vercel.json's
// crons. lib/aerpolice-orchestrator.ts calls it once per due source when a
// person clicks "Run Aerpolice Discovery".
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { routeJSON, type AIProvider } from '@/lib/ai-router'
import { CLAUDE_FAST } from '@/lib/claude'
import { readUrl } from '@/lib/webRead'
import { exaConfigured, exaSearchEvents, exaCompanyNews } from '@/lib/exa'
import { firecrawlConfigured, firecrawlDeepScrape, firecrawlFindActionEvidence } from '@/lib/firecrawl'
import { apolloConfigured, apolloSearchPeople, toDomain } from '@/lib/apollo'
import { isGenericName } from '@/lib/leadQuality'
import { isRealEmail } from '@/lib/outreach'
import { AERPOLICE_KNOWLEDGE } from '@/lib/kima-knowledge'
import {
  scoreProspect,
  evaluateGate,
  enforceGapDiscipline,
  validateOutreachSeed,
  daysSince,
  tierLabel,
  externalActionsReference,
  segmentsReference,
  triggersReference,
  evidenceTiersReference,
  motionsReference,
  QUALIFICATION_GATE_RULES,
  CONTROL_GAP_RULES,
  REPLACEMENT_VS_COMPLEMENT_RULES,
  EPISTEMIC_RULES,
  OUTREACH_TONE_RULES,
  PIPELINE_SEPARATION_RULES,
  REJECTION_REASONS,
  isOemOrPartnerCandidate,
  type AerpoliceDossier,
  type OutreachSeed,
} from '@/lib/aerpolice-discovery'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const MAX_PROFILED = 6
const EVENT_WINDOW_DAYS = 90 // daily sources look back 7d, weekly 30d — 90 is the outer bound for a manual/backfill-style run
const CONCURRENCY = 3

// ── Stage 1: harvest ────────────────────────────────────────────────────────
async function harvest(probe: string, deepCrawl: boolean, windowDays: number): Promise<{ content: string; via: string }> {
  if (/^https?:\/\//.test(probe)) {
    if (deepCrawl && firecrawlConfigured()) {
      const deep = await firecrawlDeepScrape(probe, { maxActions: 5 })
      if (deep) return { content: deep, via: 'firecrawl' }
    }
    const text = await readUrl(probe, deepCrawl ? 40000 : 14000)
    return { content: text, via: 'crawl' }
  }
  if (exaConfigured()) {
    const events = await exaSearchEvents(probe, 12, windowDays)
    const content = events
      .map(r => `Title: ${r.title}\nURL: ${r.url}\nPublished: ${r.publishedDate?.split('T')[0] || 'undated'}\nContent: ${r.text.slice(0, 1800)}`)
      .join('\n\n---\n\n')
    if (content.length > 200) return { content, via: 'exa' }
  }
  if (process.env.TAVILY_API_KEY) {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query: probe, search_depth: 'advanced', max_results: 10 }),
    })
    const data = await res.json().catch(() => null)
    if (data?.results?.length) {
      return {
        content: data.results
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((r: any) => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`)
          .join('\n\n'),
        via: 'tavily',
      }
    }
  }
  return { content: '', via: 'none' }
}

// ── Stage 2: extract action-taking-agent candidates ─────────────────────────
interface ActionCandidate {
  organization: string
  website: string
  agent_product: string
  action_signal: string
  event_summary: string
  event_date: string | null
  evidence_url: string
  is_social_only: boolean
  action_relevance: 'high' | 'medium' | 'low'
}

async function extractCandidates(
  content: string,
  sourceLabel: string,
  provider: AIProvider,
  windowDays: number,
): Promise<ActionCandidate[]> {
  try {
    const result = await routeJSON<{ candidates: ActionCandidate[] }>({
      provider,
      model: provider === 'claude' ? CLAUDE_FAST : 'gpt-4o',
      maxTokens: 3000,
      temperature: 0.2,
      system: `You scan a source for companies whose AI agent has just gained, or been shown to have, the ability to take a real EXTERNAL action.

${QUALIFICATION_GATE_RULES}

Reject chatbots, search assistants, content generators and read-only "copilots" that only answer or summarize. Reject a company on sight if the only thing this page shows is that they "use AI" or "build agents" with no external action stated. A keyword match on "AI agent" is not a signal — the action is the signal.

Only return REAL, NAMED companies — never a category ("fintech startups", "healthcare AI companies"). QUALITY OVER COUNT: 0 or 2 correct candidates beats 8 padded ones — every extra weak candidate costs an expensive downstream research call.

Only return candidates whose event_date falls within the last ${windowDays} days (today is ${new Date().toISOString().slice(0, 10)}); skip older items even if the page shows them.`,
      user: `Source: ${sourceLabel}

Content:
${content.slice(0, 24000)}

Return JSON — up to 8 candidates, fewer is better than padded:
{
  "candidates": [
    {
      "organization": "Real specific company name",
      "website": "https://<their real domain>, or empty string",
      "agent_product": "the name of the agent/product, from the content",
      "action_signal": "the specific external action this agent can perform, in the content's own words",
      "event_summary": "the specific event on this page that makes this company topical right now",
      "event_date": "YYYY-MM-DD or 'Month YYYY' if stated/implied, else null",
      "evidence_url": "the exact URL on this page for that event — not a homepage",
      "is_social_only": true/false,
      "action_relevance": "high (a named external action and a dated event) | medium (plausible action, event slightly vague) | low (thin — include only if nothing better)"
    }
  ]
}`,
    })
    return Array.isArray(result.candidates) ? result.candidates : []
  } catch (e) {
    console.error('[aerpolice:extractCandidates]', e)
    return []
  }
}

// ── Stage 3: profile ─────────────────────────────────────────────────────────
async function profileAgent(candidate: ActionCandidate, provider: AIProvider): Promise<AerpoliceDossier | null> {
  try {
    const [siteText, newsText, actionPage] = await Promise.all([
      candidate.website ? readUrl(candidate.website, 6000) : Promise.resolve(''),
      exaConfigured() ? exaCompanyNews(candidate.organization, 120) : Promise.resolve(''),
      candidate.website && firecrawlConfigured() ? firecrawlFindActionEvidence(candidate.website) : Promise.resolve(null),
    ])

    const system = `You are an AI-agent governance analyst qualifying prospects for Aerpolice.

${AERPOLICE_KNOWLEDGE}

${QUALIFICATION_GATE_RULES}

${CONTROL_GAP_RULES}

${REPLACEMENT_VS_COMPLEMENT_RULES}

${PIPELINE_SEPARATION_RULES}

${EPISTEMIC_RULES}

EXTERNAL ACTIONS (use these exact keys):
${externalActionsReference()}

SEGMENTS (use these exact keys):
${segmentsReference()}

TRIGGER TYPES (use these exact keys):
${triggersReference()}

EVIDENCE TIERS (use these exact keys):
${evidenceTiersReference()}

RECOMMENDED MOTIONS (use these exact keys):
${motionsReference()}

For every candidate, before writing the dossier, mentally check: official website, product documentation, API/connector docs, changelog/release notes, security or trust center, official blog/newsroom, relevant marketplace listing, and current job openings. Do not approve a company based only on the discovery article.

DO NOT SCORE. Do not output a score, tier, or rating of any kind — those are computed downstream from the structured fields you return. Never invent an evidence URL, a person's name, or a company-size figure. Null and "unknown" are correct answers when genuinely unestablished.`

    const user = `Profile this organisation for Aerpolice.

Organisation: ${candidate.organization}
Website: ${candidate.website || 'unknown'}
Agent/product (from the source): ${candidate.agent_product}
Action signal spotted: ${candidate.action_signal}
Event: ${candidate.event_summary}
Event date as stated: ${candidate.event_date || 'not stated'}
Event evidence URL: ${candidate.evidence_url || 'none'}
${candidate.is_social_only ? 'NOTE: the event was found on social media only — that is discovery, not corroboration. Find an official source, or mark trigger.evidence_tier as "social" and record the gap in unknowns.' : ''}
${siteText ? `\nTHEIR OWN SITE (crawled live):\n${siteText}` : ''}
${actionPage ? `\nTHEIR DOCS/CHANGELOG/API/SECURITY PAGE (crawled live from ${actionPage.url} — prefer this over the homepage for verified_action and current_controls):\n${actionPage.text}` : ''}
${newsText ? `\nRECENT NEWS (Exa — check the tier of each):\n${newsText.slice(0, 2500)}` : ''}

Return this exact JSON:
{
  "organization": "${candidate.organization}",
  "website": "https://...",
  "agent_product": "the agent/product name",
  "company_size_band": "micro|startup|mid_market|enterprise_large|unknown",
  "company_size_basis": "how you estimated headcount, or why unknown",
  "verified_action": {
    "action_type": "one exact key from EXTERNAL ACTIONS, or null",
    "description": "the exact external action, concretely — not 'automates workflows'",
    "status": "confirmed|inferred|unknown",
    "evidence_url": "URL or null",
    "evidence_tier": "one exact key from EVIDENCE TIERS",
    "additional_actions": ["any other confirmed external-action keys this agent also performs"]
  },
  "trigger": {
    "type": "one exact key from TRIGGER TYPES, or null",
    "what_happened": "the specific event, concretely",
    "date": "YYYY-MM-DD or 'Month YYYY', or null if genuinely undatable",
    "evidence_url": "exact URL to the event — not a homepage",
    "evidence_tier": "one exact key from EVIDENCE TIERS"
  },
  "structural_fit": {
    "segments": ["one or more exact keys from SEGMENTS"],
    "rationale": "why this org is shaped like an Aerpolice prospect regardless of today's news"
  },
  "current_controls": {
    "has_own_identity": "confirmed|inferred|unknown",
    "shared_service_account": "confirmed|inferred|unknown",
    "credentials_or_oauth_scope": "what's documented, or 'not public'",
    "authorization_external_to_runtime": "confirmed|inferred|unknown",
    "limits_supported": "what's documented about amount/destination/resource/action limits, or 'not public'",
    "human_escalation": "confirmed|inferred|unknown",
    "independent_kill_switch": "confirmed|inferred|unknown",
    "audit_log_explains_why": "confirmed|inferred|unknown",
    "audit_verifiable_by_customer": "confirmed|inferred|unknown",
    "stated_summary": "one or two sentences on what's publicly documented about controls today"
  },
  "control_gap": {
    "gap": "what's architecturally missing in the control layer — e.g. 'no independent per-agent kill control described'. If you only know the agent can act and nothing about the control layer, this must be exactly 'Gap not confirmed'",
    "status": "confirmed|inferred|unknown — 'confirmed' requires evidence about the CONTROL LAYER, not just that the agent acts",
    "basis": "the specific evidence behind that status, or why it could not be established"
  },
  "consequence": {
    "financial": "what's financially at stake if this action is misused, or null",
    "operational": "operational exposure, or null",
    "regulatory": "regulatory/compliance exposure, or null",
    "reputational": "reputational exposure, or null"
  },
  "recommended_motion": "one exact key from RECOMMENDED MOTIONS",
  "motion_rationale": "why this motion — especially if the company already offers some governance functionality itself",
  "buyer": {
    "role": "the role that would own this decision",
    "name": "real public name or null — never fabricate",
    "identifiable": true/false — is there a route in: a named person, a public team, a careers/product page, or a real corporate domain,
    "public_channel": "docs contact, careers/team page, public profile, or null"
  },
  "first_qualification_question": "one intelligent question about the biggest UNKNOWN in current_controls, ending in a question mark",
  "facts": ["only claims backed by an authoritative source — include the URL inline"],
  "inferences": ["reasoned conclusions, each clearly labelled as such"],
  "unknowns": ["things that matter and could not be established"],
  "team_public": true/false,
  "project_active": true/false,
  "rejection_flags": ["any of: ${Object.keys(REJECTION_REASONS).join(', ')} — empty array if none apply"]
}`

    return await routeJSON<AerpoliceDossier>({
      provider,
      model: provider === 'claude' ? CLAUDE_FAST : 'gpt-4o',
      maxTokens: 5000,
      temperature: 0.2,
      system,
      user,
    })
  } catch (e) {
    console.error('[aerpolice:profileAgent]', e)
    return null
  }
}

// ── Stage: outreach seed (Contact-now prospects only) ────────────────────────
async function buildOutreachSeed(dossier: AerpoliceDossier, provider: AIProvider): Promise<OutreachSeed | null> {
  try {
    return await routeJSON<OutreachSeed>({
      provider,
      model: provider === 'claude' ? CLAUDE_FAST : 'gpt-4o',
      maxTokens: 700,
      temperature: 0.3,
      system: `You write the outreach seed for a qualified "Contact now" Aerpolice prospect. Exactly four parts:
1. ONE sentence referencing the verified trigger, stated plainly.
2. ONE sentence explaining the specific action-control implication — name the external action and what the event means for who controls it.
3. ONE intelligent question about the biggest UNKNOWN.
4. A LinkedIn connection note, under 280 characters.

${OUTREACH_TONE_RULES}

Do not mention Aerpolice by name and do not pitch. This is a hypothesis to test, not a sales message.`,
      user: `Prospect: ${dossier.organization}
Trigger: ${dossier.trigger?.what_happened} (${dossier.trigger?.date || 'undated'})
Verified action: ${dossier.verified_action?.description}
Control gap: ${dossier.control_gap?.gap} [${dossier.control_gap?.status}]
Buyer: ${dossier.buyer?.role}${dossier.buyer?.name ? ` (${dossier.buyer.name})` : ''}
Biggest unknown: ${(dossier.unknowns || [])[0] || dossier.first_qualification_question}

Return JSON:
{
  "trigger_sentence": "one sentence — the dated event and where it was published",
  "action_control_implication": "one or two sentences",
  "intelligent_question": "one question, ending in a question mark",
  "linkedin_note": "under 280 characters"
}`,
    })
  } catch (e) {
    console.error('[aerpolice:buildOutreachSeed]', e)
    return null
  }
}

// ── Buyer enrichment — qualified accounts only ───────────────────────────────
interface EnrichedBuyer {
  name: string; title: string; email: string | null; linkedin_url: string | null
  source: 'apollo' | 'hunter' | 'dossier'; confidence: 'high' | 'medium' | 'low'; why: string
}
const GOVERNANCE_ROLES = [
  'security', 'cto', 'chief technology', 'trust', 'compliance', 'engineering',
  'infrastructure', 'platform', 'product', 'founder', 'co-founder', 'ceo', 'governance', 'risk',
]

async function enrichBuyers(organization: string, website: string, dossier: AerpoliceDossier): Promise<EnrichedBuyer[]> {
  const out: EnrichedBuyer[] = []
  const domain = toDomain(website)

  if (domain && apolloConfigured()) {
    try {
      const people = await apolloSearchPeople(organization, domain)
      const relevant = people.filter(p => GOVERNANCE_ROLES.some(r => (p.title || '').toLowerCase().includes(r))).slice(0, 3)
      for (const p of relevant) {
        out.push({
          name: p.name, title: p.title || 'Decision maker', email: p.email || null, linkedin_url: p.linkedin_url || null,
          source: 'apollo', confidence: p.email ? 'high' : 'medium',
          why: `Owns or reviews agent-governance decisions${p.title ? ` · ${p.title}` : ''}`,
        })
      }
    } catch (e) { console.error('[aerpolice:apollo]', e) }
  }

  if (out.length < 2 && domain && process.env.HUNTER_API_KEY) {
    try {
      const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${process.env.HUNTER_API_KEY}&limit=10`)
      const data = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const emails: any[] = data?.data?.emails || []
      for (const e of emails) {
        if (out.length >= 3) break
        const title = (e.position || '').toLowerCase()
        if (!GOVERNANCE_ROLES.some(r => title.includes(r))) continue
        if (!isRealEmail(e.value)) continue
        out.push({
          name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.value, title: e.position || 'Unknown',
          email: e.value, linkedin_url: e.linkedin || null, source: 'hunter',
          confidence: e.confidence >= 80 ? 'high' : 'medium', why: 'Verified address in a governance-relevant role',
        })
      }
    } catch (e) { console.error('[aerpolice:hunter]', e) }
  }

  const b = dossier.buyer
  const hasRoute = !!(b?.name || b?.public_channel || b?.identifiable)
  if (out.length === 0 && hasRoute) {
    out.push({
      name: b.name || b.role || 'Governance owner (unnamed)', title: b.role || 'Decision maker',
      email: null, linkedin_url: b.public_channel || null, source: 'dossier', confidence: 'low',
      why: 'Identified from a public route — needs a named person before outreach',
    })
  }
  return out.slice(0, 3)
}

// ── Route ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const body = await req.json().catch(() => ({}))
    const {
      source_id, probe: customProbe, label: customLabel,
      deep_crawl = false, research_ai = 'claude', dry_run = false, lookback_days,
    } = body as {
      source_id?: string; probe?: string; label?: string
      deep_crawl?: boolean; research_ai?: string; dry_run?: boolean; lookback_days?: number
    }
    const windowDays = lookback_days ? Math.max(1, Math.min(Math.round(Number(lookback_days)), EVENT_WINDOW_DAYS)) : EVENT_WINDOW_DAYS

    const provider: AIProvider = research_ai === 'openai' ? 'openai' : 'claude'
    if (provider === 'claude') {
      const { claudeConfigured } = await import('@/lib/claude')
      if (!claudeConfigured()) {
        return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured.' }, { status: 503 })
      }
    } else if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 503 })
    }

    // Fail loudly if the migration has not been run — never harvest, profile
    // and qualify a batch only to drop every result at insert.
    if (!dry_run) {
      const { error: schemaError } = await supabase
        .from('leads')
        .select('aerpolice_dossier, aerpolice_score, aerpolice_tier')
        .limit(1)
      if (schemaError) {
        return NextResponse.json(
          {
            error: 'Aerpolice discovery columns are missing from the leads table. Run supabase/add-aerpolice-discovery.sql in the Supabase SQL editor, then retry. (Pass dry_run: true to score without saving in the meantime.)',
            detail: schemaError.message,
          },
          { status: 503 },
        )
      }
      const { error: watchlistSchemaError } = await supabase
        .from('aerpolice_oem_partner_watchlist')
        .select('id')
        .limit(1)
      if (watchlistSchemaError) {
        return NextResponse.json(
          {
            error: 'The aerpolice_oem_partner_watchlist table is missing. Run supabase/add-aerpolice-oem-partner-watchlist.sql in the Supabase SQL editor, then retry. (Pass dry_run: true to score without saving in the meantime.)',
            detail: watchlistSchemaError.message,
          },
          { status: 503 },
        )
      }
    }

    let source: { id: string; source_name: string; source_url_or_query: string } | null = null
    if (source_id) {
      const { data } = await supabase
        .from('sources')
        .select('id, source_name, source_url_or_query')
        .eq('id', source_id)
        .single()
      if (!data?.source_url_or_query) {
        return NextResponse.json({ error: `Unknown Aerpolice source "${source_id}".` }, { status: 400 })
      }
      source = data
    }
    const probe = (customProbe || source?.source_url_or_query || '').trim()
    const label = customLabel || source?.source_name || probe
    if (!probe) {
      return NextResponse.json({ error: 'Provide source_id (an active Aerpolice source) or a custom probe URL/query.' }, { status: 400 })
    }

    const results = {
      source: source?.id || 'custom',
      source_label: label,
      harvested_via: '' as string,
      lookback_days: windowDays,
      candidates_found: 0,
      skipped_no_action_angle: 0,
      skipped_generic_name: 0,
      skipped_duplicate: 0,
      skipped_recently_rejected: 0,
      profiled: 0,
      profile_failed: 0,
      rejected: 0,
      watchlisted: 0,
      saved: 0,
      monitor: 0,
      validate_then_send: 0,
      contact_now: 0,
      outreach_seed_rejected: 0,
      insert_failed: 0,
      tier_1: 0,
      tier_2: 0,
      tier_3: 0,
      prospects: [] as Array<Record<string, unknown>>,
    }

    const { content, via } = await harvest(probe, deep_crawl, windowDays)
    results.harvested_via = via
    if (!content || content.length < 150) {
      return NextResponse.json({ ...results, error: `Nothing usable harvested from "${label}" (via ${via}). Try enabling deep_crawl.` }, { status: 400 })
    }

    const candidates = await extractCandidates(content, label, provider, windowDays)
    results.candidates_found = candidates.length

    const named = candidates.filter(c => {
      if (isGenericName(c.organization)) { results.skipped_generic_name++; return false }
      return true
    })
    const withAngle = named.filter(c => {
      if (c.action_relevance === 'low') { results.skipped_no_action_angle++; return false }
      return true
    })

    const { data: existing } = await supabase.from('leads').select('company_name, website')
    const existingNames = new Set((existing || []).map((l: { company_name?: string }) => (l.company_name || '').toLowerCase().trim()))
    const existingDomains = new Set((existing || []).map((l: { website?: string }) => toDomain(l.website || '')).filter(Boolean))

    const rejectedCooldownDays = Number(process.env.AERPOLICE_REJECTED_COOLDOWN_DAYS) || 14
    const rejectedSince = new Date(Date.now() - rejectedCooldownDays * 86400_000).toISOString()
    const { data: recentlyRejected } = await supabase
      .from('aerpolice_rejected_candidates')
      .select('organization, domain')
      .gte('last_seen_at', rejectedSince)
    const rejectedNames = new Set((recentlyRejected || []).map((r: { organization: string }) => (r.organization || '').toLowerCase().trim()))
    const rejectedDomains = new Set((recentlyRejected || []).map((r: { domain: string | null }) => r.domain || '').filter(Boolean))

    const toProfile = withAngle.filter(c => {
      const nameKey = c.organization.toLowerCase().trim()
      const domainKey = toDomain(c.website || '')
      if (existingNames.has(nameKey)) { results.skipped_duplicate++; return false }
      if (domainKey && existingDomains.has(domainKey)) { results.skipped_duplicate++; return false }
      if (rejectedNames.has(nameKey)) { results.skipped_recently_rejected++; return false }
      if (domainKey && rejectedDomains.has(domainKey)) { results.skipped_recently_rejected++; return false }
      return true
    }).slice(0, MAX_PROFILED)

    async function recordRejection(organization: string, website: string, reason: string, score: number, tier: number, failures: string[], rejections: string[]): Promise<void> {
      try {
        const domain = toDomain(website) || ''
        const { data: existingRow } = await supabase
          .from('aerpolice_rejected_candidates')
          .select('id, seen_count')
          .eq('organization', organization)
          .or(`domain.eq.${domain},domain.is.null`)
          .maybeSingle()
        const now = new Date().toISOString()
        if (existingRow) {
          await supabase.from('aerpolice_rejected_candidates').update({
            reason, score, tier, gate_failures: failures, rejections,
            source_id: source?.id || null, last_seen_at: now, seen_count: (existingRow.seen_count || 1) + 1,
          }).eq('id', existingRow.id)
        } else {
          await supabase.from('aerpolice_rejected_candidates').insert({
            organization, domain, reason, score, tier, gate_failures: failures, rejections, source_id: source?.id || null,
          })
        }
      } catch (e) {
        console.error('[aerpolice:recordRejection]', e)
      }
    }

    async function recordWatchlist(dossier: AerpoliceDossier, candidate: ActionCandidate, score: ReturnType<typeof scoreProspect>): Promise<void> {
      try {
        const organization = dossier.organization || candidate.organization
        const website = dossier.website || candidate.website || ''
        const domain = toDomain(website) || ''
        const whyNotCustomer = (dossier.rejection_flags || []).includes('equivalent_offering')
          ? REJECTION_REASONS.equivalent_offering
          : `Recommended motion "${dossier.recommended_motion}" — OEM/partner, not a direct customer.`
        const { data: existingRow } = await supabase
          .from('aerpolice_oem_partner_watchlist')
          .select('id, seen_count')
          .eq('organization', organization)
          .or(`domain.eq.${domain},domain.is.null`)
          .maybeSingle()
        const now = new Date().toISOString()
        const row = {
          organization, website: website || null, domain: domain || null,
          entity_signal: dossier.agent_product || candidate.agent_product || null,
          recommended_motion: dossier.recommended_motion,
          motion_rationale: dossier.motion_rationale || null,
          why_not_customer: whyNotCustomer,
          dossier, score: score.totalScore,
          source_id: source?.id || null,
          last_seen_at: now,
        }
        if (existingRow) {
          await supabase.from('aerpolice_oem_partner_watchlist').update({ ...row, seen_count: (existingRow.seen_count || 1) + 1 }).eq('id', existingRow.id)
        } else {
          await supabase.from('aerpolice_oem_partner_watchlist').insert(row)
        }
      } catch (e) {
        console.error('[aerpolice:recordWatchlist]', e)
      }
    }

    async function runOne(candidate: ActionCandidate): Promise<void> {
      results.profiled++
      const dossier = await profileAgent(candidate, provider)
      if (!dossier) { results.profile_failed++; return }

      if (!dossier.trigger) (dossier as unknown as { trigger: Record<string, unknown> }).trigger = {}
      if (!dossier.trigger.evidence_url && candidate.evidence_url) dossier.trigger.evidence_url = candidate.evidence_url
      if (!dossier.trigger.date && candidate.event_date) dossier.trigger.date = candidate.event_date
      if (!dossier.website && candidate.website) dossier.website = candidate.website

      const gapDowngrades = enforceGapDiscipline(dossier)
      const score = scoreProspect(dossier)

      // OEM/Partner Watchlist — separate pipeline, never a customer lead and
      // never outreached from here. See PIPELINE_SEPARATION_RULES.
      if (isOemOrPartnerCandidate(dossier)) {
        results.watchlisted++
        results.prospects.push({
          organization: dossier.organization || candidate.organization,
          website: dossier.website || candidate.website || '',
          score: score.totalScore,
          recommended_motion: dossier.recommended_motion,
          motion_rationale: dossier.motion_rationale,
          outcome: 'watchlisted',
        })
        if (!dry_run) await recordWatchlist(dossier, candidate, score)
        return
      }

      const gate = evaluateGate(dossier, score)

      const record: Record<string, unknown> = {
        organization: dossier.organization || candidate.organization,
        website: dossier.website || candidate.website || '',
        score: score.totalScore,
        tier: score.tier,
        tier_label: tierLabel(score.tier),
        breakdown: score,
        trigger: dossier.trigger,
        trigger_age_days: daysSince(dossier.trigger?.date),
        verified_action: dossier.verified_action,
        control_gap: dossier.control_gap,
        gap_downgrades: gapDowngrades,
        recommended_motion: dossier.recommended_motion,
        next_action: gate.nextAction,
        gate_notes: gate.failures,
        rejections: gate.rejections.map(r => REJECTION_REASONS[r]),
      }

      if (!gate.saved) {
        results.rejected++
        results.prospects.push({ ...record, outcome: 'rejected' })
        if (!dry_run) {
          await recordRejection(
            dossier.organization || candidate.organization, dossier.website || candidate.website || '',
            gate.rejections[0] || 'gate_failed', score.totalScore, score.tier, gate.failures, gate.rejections,
          )
        }
        return
      }

      if (score.tier === 1) results.tier_1++
      else if (score.tier === 2) results.tier_2++
      else results.tier_3++
      if (gate.nextAction === 'Monitor') results.monitor++
      else if (gate.nextAction === 'Validate then send') results.validate_then_send++
      else if (gate.nextAction === 'Contact now') results.contact_now++

      let buyers: EnrichedBuyer[] = []
      let outreachSeed: OutreachSeed | null = null
      if (gate.nextAction !== 'Monitor') {
        buyers = await enrichBuyers(dossier.organization, dossier.website || candidate.website || '', dossier)
        record.buyers = buyers
      }
      if (gate.nextAction === 'Contact now') {
        outreachSeed = await buildOutreachSeed(dossier, provider)
        const problems = validateOutreachSeed(outreachSeed)
        record.outreach_seed = outreachSeed
        record.outreach_seed_problems = problems
        if (problems.length > 0) {
          results.outreach_seed_rejected++
          record.outcome = 'saved_no_send'
        } else {
          record.outcome = 'contact_now'
        }
      } else {
        record.outcome = gate.nextAction === 'Monitor' ? 'monitor' : 'validate_then_send'
      }

      if (dry_run) {
        results.prospects.push(record)
        return
      }

      const website = dossier.website || candidate.website || ''
      const { data: newLead, error: leadErr } = await supabase
        .from('leads')
        .insert({
          company_name: dossier.organization,
          website: website || null,
          description: dossier.agent_product || candidate.agent_product || null,
          industry_category: (dossier.structural_fit?.segments || []).join(', ') || null,
          customer_category: ['Aerpolice Governance Customer'],
          product_to_sell: 'Aerpolice agent governance',
          current_providers: dossier.current_controls?.stated_summary || null,
          pain_point: dossier.control_gap?.gap
            ? `${dossier.control_gap.gap} [${dossier.control_gap.status}]`
            : `${dossier.verified_action?.description || 'Action-taking agent'} with no independently confirmed control layer`,
          pain_point_severity:
            score.consequenceScore >= 12 ? 'critical' : score.consequenceScore >= 8 ? 'high' : score.consequenceScore >= 5 ? 'medium' : 'low',
          pain_point_evidence: (dossier.facts || []).slice(0, 3).join(' | ') || null,
          pain_point_source_url: dossier.verified_action?.evidence_url || null,
          pain_point_evidence_type: dossier.verified_action?.evidence_tier === 'official' || dossier.verified_action?.evidence_tier === 'marketplace' ? 'verified_source' : 'agent_analysis',
          potential_gap: dossier.control_gap?.gap ? `${dossier.control_gap.gap} [${dossier.control_gap.status}]` : 'Gap not confirmed',
          aerpolice_fit: dossier.motion_rationale || dossier.control_gap?.gap || null,
          suggested_use_case: dossier.first_qualification_question || null,
          outreach_angle: (record.outreach_seed as OutreachSeed | null)?.action_control_implication || null,
          trigger_reason: dossier.trigger?.what_happened || null,
          trigger_date: dossier.trigger?.date || null,
          trigger_source_url: dossier.trigger?.evidence_url || null,
          source_url: dossier.verified_action?.evidence_url || dossier.trigger?.evidence_url || probe,
          classification: 'customer',
          facts: dossier.facts || [],
          assumptions: dossier.inferences || [],
          unknowns: dossier.unknowns || [],
          lead_score: score.totalScore,
          urgency_score: score.triggerScore * 5, // scale 0-20 -> 0-100 for the shared urgency_score column
          urgency_reasoning: `Trigger "${dossier.trigger?.type || 'unknown'}" dated ${dossier.trigger?.date || 'unknown'} — trigger component ${score.triggerScore}/20. Next action: ${gate.nextAction}.`,
          confidence_score: score.evidenceScore * 10, // scale 0-10 -> 0-100
          integration_feasibility: dossier.recommended_motion === 'direct_design_partner_pilot' ? 'high' : dossier.recommended_motion === 'complementary_governance_layer' ? 'medium' : 'low',
          priority: score.tier === 1 ? 'excellent' : score.tier === 2 ? 'qualified' : 'needs_research',
          status: 'new',
          aerpolice_score: score.totalScore,
          aerpolice_tier: score.tier,
          aerpolice_dossier: dossier,
          aerpolice_score_breakdown: score,
          aerpolice_next_action: gate.nextAction,
          aerpolice_outreach_seed: record.outcome === 'contact_now' ? outreachSeed : null,
        })
        .select('id')
        .single()

      if (leadErr || !newLead) {
        console.error(`[aerpolice] insert failed for ${dossier.organization}:`, leadErr?.message)
        results.insert_failed++
        record.insert_error = leadErr?.message || 'no row returned'
        results.prospects.push(record)
        return
      }

      for (const b of buyers) {
        await supabase.from('contacts').insert({
          lead_id: newLead.id, name: b.name, role: b.title, company: dossier.organization,
          email: b.email, linkedin_url: b.linkedin_url, contact_confidence: b.confidence, reason_this_person: b.why,
        })
      }

      record.lead_id = newLead.id
      results.saved++
      results.prospects.push(record)
    }

    for (let i = 0; i < toProfile.length; i += CONCURRENCY) {
      await Promise.all(toProfile.slice(i, i + CONCURRENCY).map(runOne))
    }

    results.prospects.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
    return NextResponse.json({ success: true, ...results })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Aerpolice discovery failed'
    console.error('[aerpolice:POST]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Source catalogue for the UI/orchestrator: every active `sources` row tagged
// product_slug='aerpolice'.
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: sources } = await supabase
    .from('sources')
    .select('id, source_name, source_url_or_query, frequency, last_run_at, last_success_at, leads_generated, companies_evaluated, total_runs, consecutive_failures')
    .eq('product_slug', 'aerpolice')
    .eq('status', 'active')
    .not('source_url_or_query', 'is', null)

  return NextResponse.json({
    sources: (sources || []).map(s => ({ ...s, is_url: /^https?:\/\//.test(s.source_url_or_query as string) })),
  })
}
