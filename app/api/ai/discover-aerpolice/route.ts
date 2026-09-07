// ============================================================================
// Aerpolice customer discovery — dedicated pipeline (wallet-signing scope)
// ============================================================================
// Mirrors app/api/ai/discover-aerseal/route.ts's shape (harvest -> extract ->
// profile -> score -> gate -> enrich -> outreach seed -> save), answering the
// question the current Aerpolice product-scope spec (2026-09-07) defines:
// does this company have an AI agent that itself controls a wallet-signing
// key, can it use that authority to execute an irreversible on-chain
// financial action, and is that live in production today?
//
// NO WALLET KEY, NO LEAD. NO IRREVERSIBLE ACTION, NO LEAD. NO PRODUCTION
// EVIDENCE, NO SALES OUTREACH. See lib/aerpolice-discovery.ts for the full
// gate/scoring logic this route calls into — this file only does harvest/
// extract/profile (the LLM-driven stages) and persistence.
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
  validateOutreachSeed,
  daysSince,
  walletSignalReference,
  irreversibleActionReference,
  segmentsReference,
  triggersReference,
  evidenceTiersReference,
  routesReference,
  QUALIFICATION_GATE_RULES,
  SEGMENT_RULES,
  RESEARCH_METHOD_RULES,
  PAST_LOSS_RULES,
  EPISTEMIC_RULES,
  OUTREACH_TONE_RULES,
  REJECTION_REASONS,
  type AerpoliceDossier,
  type OutreachSeed,
} from '@/lib/aerpolice-discovery'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const MAX_PROFILED = 6
const EVENT_WINDOW_DAYS = 90 // spec: triggers preferably within 30 days, no older than 90
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

// ── Stage 2: extract wallet-signing-agent candidates ────────────────────────
interface WalletCandidate {
  organization: string
  website: string
  agent_product: string
  wallet_signal: string
  irreversible_signal: string
  event_summary: string
  event_date: string | null
  evidence_url: string
  is_social_only: boolean
  relevance: 'high' | 'medium' | 'low'
}

async function extractCandidates(
  content: string,
  sourceLabel: string,
  provider: AIProvider,
  windowDays: number,
): Promise<WalletCandidate[]> {
  try {
    const result = await routeJSON<{ candidates: WalletCandidate[] }>({
      provider,
      model: provider === 'claude' ? CLAUDE_FAST : 'gpt-4o',
      maxTokens: 3000,
      temperature: 0.2,
      system: `You scan a source for companies whose AI agent itself controls an on-chain wallet-signing key and can execute an irreversible on-chain financial action.

${QUALIFICATION_GATE_RULES}

${SEGMENT_RULES}

Reject on sight: centralized-exchange trading bots operating through API keys, agents that only recommend trades for a human to execute, wallet-infrastructure vendors with no visible AI-agent use case, and any company where the only signal is generic "we use AI" or "we build agents" language. A keyword match is not a signal — the wallet-signing flow and the irreversible action are the signal.

Only return REAL, NAMED companies — never a category ("DeFi protocols", "trading bots"). QUALITY OVER COUNT: 0 or 2 correct candidates beats 8 padded ones — every extra weak candidate costs an expensive downstream research call.

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
      "wallet_signal": "the specific evidence that the agent controls a wallet-signing key (EOA, session key, smart-account signer, delegated authority, MPC share, agent-wallet-infra product), in the content's own words",
      "irreversible_signal": "the specific irreversible on-chain action this agent can execute (swap, perp position, Polymarket trade, transfer, treasury move, vault action), in the content's own words",
      "event_summary": "the specific event on this page that makes this company topical right now",
      "event_date": "YYYY-MM-DD or 'Month YYYY' if stated/implied, else null",
      "evidence_url": "the exact URL on this page for that event — not a homepage",
      "is_social_only": true/false,
      "relevance": "high (named wallet-signal + irreversible-action evidence, dated event) | medium (plausible but one piece is vague) | low (thin — include only if nothing better)"
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
async function profileAgent(candidate: WalletCandidate, provider: AIProvider): Promise<AerpoliceDossier | null> {
  try {
    const [siteText, newsText, actionPage] = await Promise.all([
      candidate.website ? readUrl(candidate.website, 6000) : Promise.resolve(''),
      exaConfigured() ? exaCompanyNews(candidate.organization, 120) : Promise.resolve(''),
      candidate.website && firecrawlConfigured() ? firecrawlFindActionEvidence(candidate.website) : Promise.resolve(null),
    ])

    const system = `You are a wallet-signing governance analyst qualifying prospects for Aerpolice.

${AERPOLICE_KNOWLEDGE}

Aerpolice prevents an AI agent from signing an on-chain transaction outside the mandate its owner approved — it enforces policy at the wallet-signing boundary, before execution. CURRENT LIMITATION: wallet keys only. Broker API keys, exchange API keys, bank APIs, cards and fiat-payment credentials are future capabilities, not current sales use cases.

${QUALIFICATION_GATE_RULES}

${SEGMENT_RULES}

${RESEARCH_METHOD_RULES}

${PAST_LOSS_RULES}

${EPISTEMIC_RULES}

WALLET SIGNAL TYPES (use one exact key when status is Yes, else null):
${walletSignalReference()}

IRREVERSIBLE ACTION TYPES (use one exact key when status is Yes, else null):
${irreversibleActionReference()}

SEGMENTS (use one exact label — "S1 Trading", "S2 Treasury" or "S3 Wallet Infra"):
${segmentsReference()}

TRIGGER TYPES (use one exact key, or null):
${triggersReference()}

EVIDENCE TIERS (use one exact key):
${evidenceTiersReference()}

PIPELINE ROUTES (your recommendation — use one exact key):
${routesReference()}

For every candidate, before writing the dossier, check: product documentation and SDKs, wallet and signer documentation, GitHub releases/changelogs, on-chain agent dashboards, agent-wallet and x402 documentation, security incidents/postmortems, founder technical posts, Terms of Service describing signing authority, and verified on-chain transaction history where available. Do not qualify a company from a news article alone.

DO NOT SCORE. Do not output a score or tier — those are computed downstream from the structured fields you return. Never invent a wallet address, an evidence URL, a person's name, or an incident. Null, "Unknown" and "No public evidence found." are correct answers when genuinely unestablished — never convert an assumption into Yes.`

    const user = `Profile this organisation for Aerpolice.

Organisation: ${candidate.organization}
Website: ${candidate.website || 'unknown'}
Agent/product (from the source): ${candidate.agent_product}
Wallet signal spotted: ${candidate.wallet_signal}
Irreversible-action signal spotted: ${candidate.irreversible_signal}
Event: ${candidate.event_summary}
Event date as stated: ${candidate.event_date || 'not stated'}
Event evidence URL: ${candidate.evidence_url || 'none'}
${candidate.is_social_only ? 'NOTE: the event was found on social media only — that is discovery, not corroboration. Find an official source, or mark the relevant evidence_tier as "social" and record the gap in unknowns.' : ''}
${siteText ? `\nTHEIR OWN SITE (crawled live):\n${siteText}` : ''}
${actionPage ? `\nTHEIR DOCS/CHANGELOG/API/TERMS PAGE (crawled live from ${actionPage.url} — prefer this over the homepage for wallet_key, irreversible and current_controls):\n${actionPage.text}` : ''}
${newsText ? `\nRECENT NEWS (Exa — check the tier of each):\n${newsText.slice(0, 2500)}` : ''}

Return this exact JSON:
{
  "organization": "${candidate.organization}",
  "website": "https://...",
  "segment": "S1 Trading | S2 Treasury | S3 Wallet Infra",
  "agent_product": "the agent/product name",
  "wallet_key": {
    "status": "Yes|No|Unknown",
    "evidence": "the exact wallet/signing evidence, concretely — not 'connects a wallet'",
    "evidence_url": "URL or null",
    "evidence_tier": "one exact key from EVIDENCE TIERS",
    "signal_type": "one exact key from WALLET SIGNAL TYPES, or null"
  },
  "irreversible": {
    "status": "Yes|No|Unknown",
    "action_type": "one exact key from IRREVERSIBLE ACTION TYPES, or null",
    "action": "the exact irreversible action, concretely",
    "evidence_url": "URL or null",
    "evidence_tier": "one exact key from EVIDENCE TIERS"
  },
  "production_confirmed": true/false,
  "production_evidence": "what shows real wallets/funds in production, or why it's testnet/demo/roadmap only",
  "api_fiat_rail_only": true/false — true if the agent's real execution rail is a broker/exchange API key, card, bank API or fiat rail rather than a wallet,
  "trigger": {
    "type": "one exact key from TRIGGER TYPES, or null",
    "what_happened": "the specific dated event, concretely",
    "date": "YYYY-MM-DD or 'Month YYYY', or null if genuinely undatable",
    "evidence_url": "exact URL to the event — not a homepage",
    "evidence_tier": "one exact key from EVIDENCE TIERS"
  },
  "past_loss": {
    "description": "drained wallet, leaked key, unintended transaction, paused initiative, tightened permissions, etc. — or exactly 'No public evidence found.' if nothing is documented. Never invent an incident.",
    "evidence_url": "URL or null"
  },
  "current_controls": "one or two sentences on what's publicly documented about wallet/signing controls today",
  "gap_to_investigate": "the unknown or residual gap worth investigating at the signing boundary. If nothing beyond 'the agent can act' is known, this must be exactly 'Gap not confirmed'",
  "integration_fit_rationale": "why Aerpolice's wallet-signing mandate enforcement is or isn't a fit here, beyond the agent simply existing",
  "buyer": {
    "target": "e.g. 'Founder / CTO'",
    "contact_path": "the fastest concrete contact route — public profile, docs contact, forum, etc.",
    "reachable": true/false
  },
  "first_question": "one story-seeking question about what already happened or almost happened with this agent's wallet authority, per the outreach style rules, ending in a question mark",
  "recommended_route": "one exact key from PIPELINE ROUTES — your classification judgment",
  "route_rationale": "why this route, especially for S3 Wallet Infra: learning interview vs integration vs OEM vs possible customer with a verified gap vs competitor",
  "facts": ["only claims backed by an authoritative source — include the URL inline"],
  "inferences": ["reasoned conclusions, each clearly labelled as such"],
  "unknowns": ["things that matter and could not be established"],
  "project_active": true/false,
  "team_public": true/false,
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

// ── Stage: outreach seed — Direct-sales "contact now" prospects only ───────
async function buildOutreachSeed(dossier: AerpoliceDossier, provider: AIProvider): Promise<OutreachSeed | null> {
  try {
    return await routeJSON<OutreachSeed>({
      provider,
      model: provider === 'claude' ? CLAUDE_FAST : 'gpt-4o',
      maxTokens: 500,
      temperature: 0.3,
      system: `You write the first-contact outreach seed for a qualified "Contact now" Aerpolice prospect. Exactly two parts — the first contact must seek their experience, not pitch Aerpolice.

${OUTREACH_TONE_RULES}

Do not mention Aerpolice by name and do not pitch. This is the opener for a discovery interview, not a sales message.`,
      user: `Prospect: ${dossier.organization}
Trigger: ${dossier.trigger?.what_happened} (${dossier.trigger?.date || 'undated'})
Wallet evidence: ${dossier.wallet_key?.evidence}
Irreversible action: ${dossier.irreversible?.action}
Past loss / near-miss: ${dossier.past_loss?.description}
Buyer: ${dossier.buyer?.target}

Return JSON:
{
  "story_seeking_question": "one question in the preferred style, ending in a question mark",
  "linkedin_note": "under ~180 characters, mentions one verified recent event, no feature lists or demo requests"
}`,
    })
  } catch (e) {
    console.error('[aerpolice:buildOutreachSeed]', e)
    return null
  }
}

// ── Buyer enrichment — Direct-sales / Design-partner routes only ───────────
interface EnrichedBuyer {
  name: string; title: string; email: string | null; linkedin_url: string | null
  source: 'apollo' | 'hunter' | 'dossier'; confidence: 'high' | 'medium' | 'low'; why: string
}
const GOVERNANCE_ROLES = [
  'security', 'cto', 'chief technology', 'trust', 'wallet', 'protocol', 'engineering',
  'infrastructure', 'founder', 'co-founder', 'ceo', 'risk',
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
          why: `Owns or reviews wallet-signing decisions${p.title ? ` · ${p.title}` : ''}`,
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
          confidence: e.confidence >= 80 ? 'high' : 'medium', why: 'Verified address in a wallet/security-relevant role',
        })
      }
    } catch (e) { console.error('[aerpolice:hunter]', e) }
  }

  const b = dossier.buyer
  if (out.length === 0 && b?.reachable) {
    out.push({
      name: b.target || 'Founder / CTO (unnamed)', title: b.target || 'Decision maker',
      email: null, linkedin_url: null, source: 'dossier', confidence: 'low',
      why: b.contact_path || 'Identified from a public route — needs a named person before outreach',
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
      skipped_low_relevance: 0,
      skipped_generic_name: 0,
      skipped_duplicate: 0,
      skipped_recently_rejected: 0,
      profiled: 0,
      profile_failed: 0,
      rejected: 0,
      later_api_fiat: 0,
      research_hold: 0,
      watchlisted: 0,
      saved: 0,
      direct_sales: 0,
      design_partner: 0,
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
      if (c.relevance === 'low') { results.skipped_low_relevance++; return false }
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

    async function recordRejection(organization: string, website: string, reason: string, score: number, tier: number, notes: string[], rejections: string[]): Promise<void> {
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
            reason, score, tier, gate_failures: notes, rejections,
            source_id: source?.id || null, last_seen_at: now, seen_count: (existingRow.seen_count || 1) + 1,
          }).eq('id', existingRow.id)
        } else {
          await supabase.from('aerpolice_rejected_candidates').insert({
            organization, domain, reason, score, tier, gate_failures: notes, rejections, source_id: source?.id || null,
          })
        }
      } catch (e) {
        console.error('[aerpolice:recordRejection]', e)
      }
    }

    async function recordWatchlist(dossier: AerpoliceDossier, candidate: WalletCandidate, score: ReturnType<typeof scoreProspect>, whyNotCustomer: string): Promise<void> {
      try {
        const organization = dossier.organization || candidate.organization
        const website = dossier.website || candidate.website || ''
        const domain = toDomain(website) || ''
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
          recommended_motion: dossier.recommended_route,
          motion_rationale: dossier.route_rationale || null,
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

    async function runOne(candidate: WalletCandidate): Promise<void> {
      results.profiled++
      const dossier = await profileAgent(candidate, provider)
      if (!dossier) { results.profile_failed++; return }

      if (!dossier.trigger) (dossier as unknown as { trigger: Record<string, unknown> }).trigger = {}
      if (!dossier.trigger.evidence_url && candidate.evidence_url) dossier.trigger.evidence_url = candidate.evidence_url
      if (!dossier.trigger.date && candidate.event_date) dossier.trigger.date = candidate.event_date
      if (!dossier.website && candidate.website) dossier.website = candidate.website

      const score = scoreProspect(dossier)
      const gate = evaluateGate(dossier, score)

      const record: Record<string, unknown> = {
        organization: dossier.organization || candidate.organization,
        website: dossier.website || candidate.website || '',
        segment: dossier.segment,
        score: score.totalScore,
        tier: gate.tierLabel,
        breakdown: score,
        wallet_key: dossier.wallet_key,
        irreversible: dossier.irreversible,
        production_confirmed: dossier.production_confirmed,
        trigger: dossier.trigger,
        trigger_age_days: daysSince(dossier.trigger?.date),
        past_loss: dossier.past_loss,
        gap_to_investigate: dossier.gap_to_investigate,
        route: gate.route,
        next_action: gate.nextAction,
        gate_notes: gate.notes,
        rejections: gate.rejections.map(r => REJECTION_REASONS[r]),
      }

      // Hard rejections and "later — API/fiat rails" — never saved as a lead.
      if (gate.route === 'rejected' || gate.route === 'later_api_fiat') {
        if (gate.route === 'later_api_fiat') results.later_api_fiat++
        else results.rejected++
        results.prospects.push({ ...record, outcome: gate.route })
        if (!dry_run) {
          await recordRejection(
            dossier.organization || candidate.organization, dossier.website || candidate.website || '',
            gate.rejections[0] || gate.route, score.totalScore, score.tier, gate.notes, gate.rejections,
          )
        }
        return
      }

      // Gate status Unknown or production unconfirmed — a research hold, not
      // a customer lead and not outreached. Recorded in the rejected-
      // candidates memory (with a distinct reason) so it isn't re-profiled
      // every cycle, but stays reconsiderable once evidence firms up.
      if (gate.route === 'monitoring' && !gate.scored) {
        results.research_hold++
        results.prospects.push({ ...record, outcome: 'research_hold' })
        if (!dry_run) {
          await recordRejection(
            dossier.organization || candidate.organization, dossier.website || candidate.website || '',
            'research_hold', score.totalScore, score.tier, gate.notes, [],
          )
        }
        return
      }

      // Wallet-infra provider routed to Learning/OEM — separate pipeline,
      // never a customer lead, never outreached from here.
      if (gate.route === 'learning_oem') {
        results.watchlisted++
        results.prospects.push({ ...record, outcome: 'watchlisted' })
        if (!dry_run) {
          await recordWatchlist(dossier, candidate, score, 'Agent-wallet infrastructure — routed to Learning/OEM; no verified residual gap and/or outreach-eligible motion.')
        }
        return
      }

      // gate.route is 'direct_sales' or 'design_partner' from here — a
      // scored, saved customer-pipeline lead.
      if (score.tier === 1) results.tier_1++
      else if (score.tier === 2) results.tier_2++
      else results.tier_3++
      if (gate.route === 'direct_sales') results.direct_sales++
      else results.design_partner++

      const contactNow = gate.nextAction === 'Contact now; request a 20-minute architecture interview.'
      if (contactNow) results.contact_now++

      let buyers: EnrichedBuyer[] = []
      let outreachSeed: OutreachSeed | null = null
      buyers = await enrichBuyers(dossier.organization, dossier.website || candidate.website || '', dossier)
      record.buyers = buyers
      if (contactNow) {
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
        record.outcome = gate.route
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
          industry_category: dossier.segment || null,
          customer_category: ['Aerpolice Reachable Prospect'],
          product_to_sell: 'Aerpolice wallet-signing governance',
          current_providers: dossier.current_controls || null,
          pain_point: `Wallet key: ${dossier.wallet_key?.status}. Irreversible: ${dossier.irreversible?.status}. ${dossier.gap_to_investigate || 'Gap not confirmed'}`,
          pain_point_severity:
            score.irreversibleScore >= 17 ? 'critical' : score.irreversibleScore >= 12 ? 'high' : score.irreversibleScore >= 8 ? 'medium' : 'low',
          pain_point_evidence: dossier.irreversible?.action || null,
          pain_point_source_url: dossier.irreversible?.evidence_url || dossier.wallet_key?.evidence_url || null,
          pain_point_evidence_type: dossier.irreversible?.evidence_tier === 'onchain_verified' || dossier.irreversible?.evidence_tier === 'official_docs' ? 'verified_source' : 'agent_analysis',
          potential_gap: dossier.gap_to_investigate || 'Gap not confirmed',
          aerpolice_fit: `${dossier.wallet_key?.evidence || ''} ${dossier.irreversible?.action || ''}`.trim() || null,
          suggested_use_case: dossier.first_question || null,
          outreach_angle: dossier.route_rationale || null,
          trigger_reason: dossier.trigger?.what_happened || null,
          trigger_date: dossier.trigger?.date || null,
          trigger_source_url: dossier.trigger?.evidence_url || null,
          source_url: dossier.irreversible?.evidence_url || dossier.trigger?.evidence_url || probe,
          classification: 'customer',
          facts: dossier.facts || [],
          assumptions: dossier.inferences || [],
          unknowns: dossier.unknowns || [],
          lead_score: score.totalScore,
          urgency_score: score.triggerScore * 5, // scale 0-20 -> 0-100 for the shared urgency_score column
          urgency_reasoning: `Trigger "${dossier.trigger?.type || 'unknown'}" dated ${dossier.trigger?.date || 'unknown'} — trigger component ${score.triggerScore}/20. Route: ${gate.route}.`,
          confidence_score: score.evidenceScore * 20, // scale 0-5 -> 0-100
          integration_feasibility: gate.route === 'direct_sales' ? 'high' : 'medium',
          priority: score.tier === 1 ? 'excellent' : score.tier === 2 ? 'qualified' : 'needs_research',
          status: 'new',
          aerpolice_score: score.totalScore,
          aerpolice_tier: score.tier,
          aerpolice_dossier: dossier,
          aerpolice_score_breakdown: score,
          aerpolice_next_action: gate.route,
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
