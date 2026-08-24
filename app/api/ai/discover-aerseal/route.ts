// ============================================================================
// AERSeal customer discovery — dedicated pipeline
// ============================================================================
// Separate from /api/ai/discover on purpose. The general pipeline asks "is this
// company a plausible customer for one of three products?". This one asks a
// single, much narrower question and refuses to answer anything else:
//
//   Who holds the privileged authority over a deployed EVM contract, what just
//   happened that makes that authority a live question this week, and can we
//   prove both from an authoritative source?
//
// Flow:
//   1. Harvest  — pull an EVENT surface (governance forum, audit finding, risk
//                 page, postmortem, registry), not a company directory.
//   2. Extract  — organisations + the authority-relevant event that surfaced
//                 them. Discards anything with no authority angle.
//   3. Profile  — build the full dossier: contracts, powers, control model,
//                 trigger, exposure, buyer, incumbent, FACT/INFERENCE/UNKNOWN.
//   4. Score    — computed in code from the dossier (lib/aerseal-discovery).
//   5. Gate     — six hard requirements + rejection rules.
//   6. Enrich   — Apollo/Hunter run ONLY after an account qualifies.
//   7. Hypothesis — one verified trigger + one authority implication + one
//                 intelligent question. No trigger, no send.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { routeJSON, type AIProvider } from '@/lib/ai-router'
import { CLAUDE_FAST } from '@/lib/claude'
import { readUrl } from '@/lib/webRead'
import { exaConfigured, exaSearchEvents, exaCompanyNews } from '@/lib/exa'
import { firecrawlConfigured, firecrawlDeepScrape } from '@/lib/firecrawl'
import { apolloConfigured, apolloSearchPeople, toDomain } from '@/lib/apollo'
import { isGenericName } from '@/lib/leadQuality'
import { isRealEmail } from '@/lib/outreach'
import { AERSEAL_KNOWLEDGE } from '@/lib/kima-knowledge'
import {
  MONITORING_SURFACES,
  scoreProspect,
  evaluateGate,
  validateHypothesis,
  daysSince,
  tierLabel,
  powersReference,
  controlModelsReference,
  segmentsReference,
  triggersReference,
  evidenceTiersReference,
  EPISTEMIC_RULES,
  FAIR_CHARACTERISATION_RULES,
  REJECTION_REASONS,
  type AersealDossier,
  type OutreachHypothesis,
  type MonitoringSurface,
} from '@/lib/aerseal-discovery'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

// How many candidates from one harvest get the expensive dossier call.
const MAX_PROFILED = 6
// Only look back this far for events. The scorer already decays recency hard
// past 90 days and the gate rejects anything past TRIGGER_STALE_DAYS, so
// harvesting older documents just spends research calls on prospects that
// cannot qualify.
const EVENT_WINDOW_DAYS = 240
// Dossier calls run in small parallel batches — one profile is a crawl plus a
// ~5k-token model call, and six of them serially blows the 300s budget.
const CONCURRENCY = 3

// ── Stage 1: harvest ────────────────────────────────────────────────────────
async function harvest(probe: string, deepCrawl: boolean): Promise<{ content: string; via: string }> {
  if (/^https?:\/\//.test(probe)) {
    if (deepCrawl && firecrawlConfigured()) {
      const deep = await firecrawlDeepScrape(probe, { maxActions: 5 })
      if (deep) return { content: deep, via: 'firecrawl' }
    }
    const text = await readUrl(probe, deepCrawl ? 40000 : 14000)
    return { content: text, via: 'crawl' }
  }
  // A query, not a URL. We want the DOCUMENTS describing the event — the
  // governance proposal, the audit finding, the release note, the postmortem —
  // not company homepages, so this deliberately does not use Exa's 'company'
  // category. The publishedDate that comes back is what dates the trigger, and
  // an undated trigger scores as weak recency, so it is worth carrying through.
  if (exaConfigured()) {
    const events = await exaSearchEvents(probe, 12, EVENT_WINDOW_DAYS)
    const content = events
      .map(r => `Title: ${r.title}\nURL: ${r.url}\nPublished: ${r.publishedDate?.split('T')[0] || 'undated'}\nContent: ${r.text.slice(0, 1800)}`)
      .join('\n\n---\n\n')
    if (content.length > 200) return { content, via: 'exa' }
  }
  if (process.env.TAVILY_API_KEY) {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: probe,
        search_depth: 'advanced',
        max_results: 10,
      }),
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

// ── Stage 2: extract authority-relevant organisations ───────────────────────
interface AuthorityCandidate {
  organization: string
  website: string
  what_they_operate: string
  authority_signal: string
  event_summary: string
  event_date: string | null
  evidence_url: string
  is_social_only: boolean
  authority_relevance: 'high' | 'medium' | 'low'
}

async function extractCandidates(
  content: string,
  surfaceLabel: string,
  provider: AIProvider,
): Promise<AuthorityCandidate[]> {
  try {
    const result = await routeJSON<{ candidates: AuthorityCandidate[] }>({
      provider,
      model: provider === 'claude' ? CLAUDE_FAST : 'gpt-4o',
      maxTokens: 3000,
      temperature: 0.2,
      system: `You scan event surfaces for organisations whose EVM SMART-CONTRACT ADMINISTRATIVE AUTHORITY has just become important.

You are NOT looking for "companies interested in blockchain security". Auditors, security vendors, wallet apps, research firms, conference organisers and news outlets are NOT candidates unless they themselves operate a deployed EVM contract with privileged powers. Reject them.

You ARE looking for an organisation that operates deployed EVM contracts where someone holds a privileged power:
${powersReference()}

A candidate qualifies only when the page shows BOTH:
  (a) the organisation operates real deployed EVM contracts or an on-chain product, AND
  (b) a specific EVENT touching who controls those contracts — a signer or threshold change, a governance migration, a council formation, an upgrade, a mint/freeze authority change, a bridge reconfiguration, an audit centralisation finding, a founder departure, a launch, a regulator requirement, or an administrative security incident.

"They exist and probably have an admin key" is NOT an event. If the page gives you no dated, specific event for an organisation, do not return it.

Output real, specific, named organisations — never a category ("DeFi protocols", "L2s", "stablecoin issuers"). QUALITY OVER COUNT: returning 2 or 0 is correct when that is what the page supports. Every extra weak candidate costs an expensive research call downstream.`,
      user: `Event surface: ${surfaceLabel}

Content:
${content.slice(0, 24000)}

Return JSON — up to 8 organisations, fewer is better than padded:
{
  "candidates": [
    {
      "organization": "Real specific name — never a category",
      "website": "https://<their real domain>, or empty string",
      "what_they_operate": "the EVM contracts / on-chain product they run, from the content",
      "authority_signal": "the specific privileged power implicated (ownership, proxy upgrade, mint, burn, freeze, pause, treasury, bridge admin, guardian, emergency) and any stated controller",
      "event_summary": "the specific event on this page that makes their contract authority topical right now",
      "event_date": "YYYY-MM-DD or 'Month YYYY' if the page states or implies one, else null",
      "evidence_url": "the exact URL on this page for that event — not a homepage",
      "is_social_only": true/false — true if the ONLY source here is a social post (X, Farcaster, Telegram, Discord, Reddit),
      "authority_relevance": "high (a named privileged role and a dated event) | medium (clear contract operator, event slightly vague) | low (thin — include only if nothing better)"
    }
  ]
}`,
    })
    return Array.isArray(result.candidates) ? result.candidates : []
  } catch (e) {
    console.error('[aerseal:extractCandidates]', e)
    return []
  }
}

// ── Stage 3: authority profiling ────────────────────────────────────────────
async function profileAuthority(
  candidate: AuthorityCandidate,
  provider: AIProvider,
): Promise<AersealDossier | null> {
  try {
    // Real evidence beats a snippet: crawl their own site, pull recent news.
    const [siteText, newsText] = await Promise.all([
      candidate.website ? readUrl(candidate.website, 6000) : Promise.resolve(''),
      exaConfigured() ? exaCompanyNews(candidate.organization, 120) : Promise.resolve(''),
    ])

    const system = `You are a smart-contract authority analyst qualifying prospects for AERSeal.

${AERSEAL_KNOWLEDGE}

${EPISTEMIC_RULES}

${FAIR_CHARACTERISATION_RULES}

PRIVILEGED POWERS (use these exact keys):
${powersReference()}

CONTROL MODELS (use these exact keys):
${controlModelsReference()}

SEGMENTS (use these exact keys):
${segmentsReference()}

TRIGGER TYPES (use these exact keys):
${triggersReference()}

EVIDENCE TIERS (use these exact keys):
${evidenceTiersReference()}

WHAT YOU MUST ESTABLISH — all eight, honestly:
1. What EVM contracts or products this organisation operates.
2. What privileged powers exist over them.
3. How those powers appear to be controlled today.
4. The current event making outreach timely.
5. The evidence URL and publication date for that event.
6. The likely buyer or governance owner — the ROLE that owns contract-authority decisions and a public route to reach them. You are not expected to produce a personal email; a governance forum, a team page, or a named council is a complete answer.
7. The specific AERSeal use case for THIS organisation.
8. Their current alternative and the switching friction it creates.

DO NOT SCORE. Do not output a lead score, a tier, or a rating of any kind — those are computed downstream from the structured fields you return. Your job is to be accurate about the facts and honest about the gaps. A dossier full of correctly-labelled unknowns is a good dossier; one padded with confident guesses is a useless one.

Never invent a contract address, a threshold, a signer, or a person's name. Null and "unknown" are correct answers.`

    const user = `Profile this organisation for AERSeal.

Organisation: ${candidate.organization}
Website: ${candidate.website || 'unknown'}
What they operate (from the event surface): ${candidate.what_they_operate}
Authority signal spotted: ${candidate.authority_signal}
Event: ${candidate.event_summary}
Event date as stated: ${candidate.event_date || 'not stated'}
Event evidence URL: ${candidate.evidence_url || 'none'}
${candidate.is_social_only ? 'NOTE: the event was found on social media only. That is a discovery signal, NOT corroboration. Find an official/authoritative source for it, or mark the trigger evidence_tier as "social" and record the gap in unknowns.' : ''}
${siteText ? `\nTHEIR OWN SITE (crawled live — treat as authoritative for what they operate):\n${siteText}` : ''}
${newsText ? `\nRECENT NEWS (Exa — corroboration candidates, check the tier of each):\n${newsText.slice(0, 2500)}` : ''}

Return this exact JSON:
{
  "organization": "${candidate.organization}",
  "website": "https://...",
  "evm_footprint": {
    "chains": ["specific EVM chains they deploy on"],
    "products": ["their on-chain products"],
    "contracts": [
      { "name": "what this contract is", "address": "0x... or null — never invent", "chain": "chain or null", "explorer_url": "verified explorer URL or null", "verified_on_explorer": true/false, "upgradeable": true/false/null }
    ],
    "evm_only": true/false,
    "is_non_evm_only": true/false — true ONLY if they have no EVM deployment at all,
    "all_contracts_immutable": true/false — true only if documented immutable with no privileged roles
  },
  "privileged_powers": [
    { "power": "one exact key from PRIVILEGED POWERS", "where": "which contract/product it applies to", "status": "confirmed|inferred|unknown", "evidence_url": "URL or null" }
  ],
  "authority_control": {
    "model": "one exact key from CONTROL MODELS",
    "detail": "what is actually documented about who holds it",
    "address": "0x... or null", "threshold": "e.g. '3 of 5' or null", "timelock_delay": "e.g. '48h' or null",
    "status": "confirmed|inferred|unknown",
    "evidence_url": "URL or null"
  },
  "trigger": {
    "type": "one exact key from TRIGGER TYPES",
    "what_happened": "the specific event, concretely",
    "date": "YYYY-MM-DD or 'Month YYYY', or null if genuinely undatable",
    "evidence_url": "exact URL to the event — not a homepage",
    "evidence_tier": "one exact key from EVIDENCE TIERS"
  },
  "structural_fit": {
    "segments": ["one or more exact keys from SEGMENTS"],
    "rationale": "why this organisation is shaped like an AERSeal customer regardless of today's news",
    "evidence_url": "authoritative URL supporting that shape (docs, risk page, explorer, official post)",
    "evidence_tier": "one exact key from EVIDENCE TIERS"
  },
  "exposure": {
    "value_at_risk_usd": number or null — TVL, supply, or treasury the privileged role can reach; null if unknown,
    "value_basis": "how you arrived at that figure, or why it is unknown",
    "operational": "what breaks operationally if the authority is misused, or null",
    "reputational": "reputational exposure, or null",
    "regulatory": "regulatory/licensing exposure, or null"
  },
  "buyer": {
    "role": "the role that owns this decision",
    "name": "real public name or null — never fabricate",
    "why_this_person": "why this role owns contract-authority decisions here",
    "governance_owner": "the DAO/council/committee that would own it, or null",
    "identifiable": true/false — is there a ROUTE IN: a public decision surface, a named governance body, a public team, or a real corporate domain. This is NOT asking whether you found a person's email; finding the individual happens later. Answer true whenever someone could actually be reached about this,
    "public_channel": "governance forum URL, docs contact, careers/team page, public profile — anything reachable, or null"
  },
  "aerseal_use_case": "the specific AERSeal application: which privileged role would move to threshold control, and what approval policy that implies for THIS organisation",
  "incumbent": {
    "current_alternative": "what they use today (Safe, custodian, timelock, governance, raw EOA, nothing documented)",
    "switching_friction": "none|low|medium|high",
    "friction_reason": "what makes the switch easy or hard — operational, not a claim about the incumbent's quality"
  },
  "facts": ["only claims backed by an authoritative source — include the URL inline"],
  "inferences": ["reasoned conclusions, each clearly a conclusion and not a fact"],
  "unknowns": ["things that matter and you could not establish"],
  "team_public": true/false,
  "kyc_willing": "yes|no|unknown",
  "project_active": true/false,
  "rejection_flags": ["any of: ${Object.keys(REJECTION_REASONS).join(', ')} — empty array if none apply"]
}`

    const dossier = await routeJSON<AersealDossier>({
      provider,
      model: provider === 'claude' ? CLAUDE_FAST : 'gpt-4o',
      maxTokens: 5000,
      temperature: 0.2,
      system,
      user,
    })
    return dossier
  } catch (e) {
    console.error('[aerseal:profileAuthority]', e)
    return null
  }
}

// ── Stage 7: outreach hypothesis ────────────────────────────────────────────
async function buildHypothesis(
  dossier: AersealDossier,
  provider: AIProvider,
): Promise<OutreachHypothesis | null> {
  const isIncidentVictim =
    dossier.trigger?.type === 'admin_key_incident' ||
    dossier.trigger?.type === 'upgrade_exploit' ||
    dossier.trigger?.type === 'governance_attack' ||
    (dossier.structural_fit?.segments || []).includes('security_incident')

  try {
    const h = await routeJSON<OutreachHypothesis>({
      provider,
      model: provider === 'claude' ? CLAUDE_FAST : 'gpt-4o',
      maxTokens: 900,
      temperature: 0.3,
      system: `You write the outreach hypothesis for a qualified AERSeal prospect. Exactly three parts, nothing else:

1. ONE VERIFIED TRIGGER — the dated event, stated plainly, with its source. Not a compliment, not a preamble.
2. ONE CONCRETE AUTHORITY IMPLICATION — what that event means for who can exercise a specific privileged power on a specific contract. Name the power. One implication, not a list, and not a pitch.
3. ONE INTELLIGENT QUESTION — a question a knowledgeable peer would ask, which they would want to answer. It should be genuinely open, and it should show you read their docs or governance, not a survey question with an obvious answer.

${FAIR_CHARACTERISATION_RULES}

BANNED: fear framing of any kind, "you could be next", "before it's too late", predictions of doom, implied incompetence, and every generic opener ("I hope this finds you well", "I wanted to reach out", "quick question").
${isIncidentVictim ? '\nTHIS ORGANISATION IS RECOVERING FROM A SECURITY INCIDENT. Consultative register only. Acknowledge what they have already published or already fixed. No hindsight, no blame, no urgency manufacturing. The question should be about their forward design decisions, asked as a peer.' : ''}

Do not mention AERSeal by name and do not pitch. This is a hypothesis to test, not a sales message.`,
      user: `Prospect: ${dossier.organization}
Trigger: ${dossier.trigger?.what_happened} (${dossier.trigger?.date || 'undated'})
Trigger source: ${dossier.trigger?.evidence_url}
Privileged powers: ${(dossier.privileged_powers || []).map(p => `${p.power} on ${p.where} [${p.status}]`).join('; ') || 'none recorded'}
Control today: ${dossier.authority_control?.model} — ${dossier.authority_control?.detail}
Current alternative: ${dossier.incumbent?.current_alternative}
Buyer: ${dossier.buyer?.role}${dossier.buyer?.name ? ` (${dossier.buyer.name})` : ''}
Known facts: ${(dossier.facts || []).slice(0, 6).join(' | ')}
Unknowns: ${(dossier.unknowns || []).slice(0, 4).join(' | ')}

Return JSON:
{
  "verified_trigger": "one sentence — the dated event and where it was published",
  "authority_implication": "one or two sentences — the specific privileged power and what the event means for its control",
  "intelligent_question": "one question, ending in a question mark",
  "evidence_url": "${dossier.trigger?.evidence_url || ''}"
}`,
    })
    return h
  } catch (e) {
    console.error('[aerseal:buildHypothesis]', e)
    return null
  }
}

// ── Buyer enrichment — ONLY for qualified accounts ──────────────────────────
// Deliberately after the gate: Apollo/Hunter credits are never spent on an
// account that has not already earned approval on public evidence.
interface EnrichedBuyer {
  name: string
  title: string
  email: string | null
  linkedin_url: string | null
  source: 'apollo' | 'hunter' | 'dossier'
  confidence: 'high' | 'medium' | 'low'
  why: string
}

const AUTHORITY_ROLES = [
  'security', 'cto', 'chief technology', 'protocol', 'engineering', 'smart contract',
  'infrastructure', 'head of risk', 'chief risk', 'treasury', 'operations', 'coo',
  'founder', 'co-founder', 'ceo', 'compliance', 'governance',
]

async function enrichBuyers(
  organization: string,
  website: string,
  dossier: AersealDossier,
): Promise<EnrichedBuyer[]> {
  const out: EnrichedBuyer[] = []
  const domain = toDomain(website)

  if (domain && apolloConfigured()) {
    try {
      const people = await apolloSearchPeople(organization, domain)
      const relevant = people
        .filter(p => AUTHORITY_ROLES.some(r => (p.title || '').toLowerCase().includes(r)))
        .slice(0, 3)
      for (const p of relevant) {
        out.push({
          name: p.name,
          title: p.title || 'Decision maker',
          email: p.email || null,
          linkedin_url: p.linkedin_url || null,
          source: 'apollo',
          confidence: p.email ? 'high' : 'medium',
          why: `Owns or reviews contract-authority decisions${p.title ? ` · ${p.title}` : ''}`,
        })
      }
    } catch (e) {
      console.error('[aerseal:apollo]', e)
    }
  }

  if (out.length < 2 && domain && process.env.HUNTER_API_KEY) {
    try {
      const res = await fetch(
        `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${process.env.HUNTER_API_KEY}&limit=10`,
      )
      const data = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const emails: any[] = data?.data?.emails || []
      for (const e of emails) {
        if (out.length >= 3) break
        const title = (e.position || '').toLowerCase()
        if (!AUTHORITY_ROLES.some(r => title.includes(r))) continue
        if (!isRealEmail(e.value)) continue
        out.push({
          name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.value,
          title: e.position || 'Unknown',
          email: e.value,
          linkedin_url: e.linkedin || null,
          source: 'hunter',
          confidence: e.confidence >= 80 ? 'high' : 'medium',
          why: 'Verified address in an authority-relevant role',
        })
      }
    } catch (e) {
      console.error('[aerseal:hunter]', e)
    }
  }

  // Fall back to what the dossier itself established. This has to accept every
  // route the approval gate accepts — a named person, a governance body, a
  // public decision surface, or a public team. An earlier version required
  // name || governance_owner, so a lead approved on `public_channel` alone
  // saved with zero contacts and no indication why: qualified on a route the
  // enrichment step then refused to use.
  const b = dossier.buyer
  const hasRoute = !!(b?.name || b?.governance_owner || b?.public_channel || b?.identifiable)
  if (out.length === 0 && hasRoute) {
    out.push({
      name: b.name || b.governance_owner || b.role || 'Authority owner (unnamed)',
      title: b.role || 'Governance owner',
      email: null,
      linkedin_url: b.public_channel || null,
      source: 'dossier',
      confidence: 'low',
      why: b.why_this_person || 'Identified from a public decision surface — needs a named person before outreach',
    })
  }

  return out.slice(0, 3)
}

// ── Route ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const body = await req.json().catch(() => ({}))
    const {
      surface_key,
      probe: customProbe,
      label: customLabel,
      deep_crawl = false,
      research_ai = 'claude',
      dry_run = false,
    } = body as {
      surface_key?: string
      probe?: string
      label?: string
      deep_crawl?: boolean
      research_ai?: string
      dry_run?: boolean
    }

    const provider: AIProvider = research_ai === 'openai' ? 'openai' : 'claude'
    if (provider === 'claude') {
      const { claudeConfigured } = await import('@/lib/claude')
      if (!claudeConfigured()) {
        return NextResponse.json(
          { error: 'ANTHROPIC_API_KEY is not configured. Add it to .env.local (local) or your host environment.' },
          { status: 503 },
        )
      }
    } else if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 503 })
    }

    // Fail loudly and early if the migration has not been run — never harvest,
    // profile, and qualify a batch only to drop every one of them at insert.
    // This pipeline writes five aerseal_* columns. If the migration has not been
    // run, PostgREST rejects the whole insert and every qualified prospect
    // vanishes with no lead, no counter, and no error the caller can see — the
    // exact failure mode that hid the missing leads.source_id column for weeks
    // (see supabase/add-lead-source-id.sql). One cheap SELECT up front turns
    // that silent data loss into an actionable message.
    if (!dry_run) {
      const { error: schemaError } = await supabase
        .from('leads')
        .select('aerseal_dossier, aerseal_score, aerseal_tier, aerseal_score_breakdown, aerseal_hypothesis')
        .limit(1)
      if (schemaError) {
        return NextResponse.json(
          {
            error:
              'AERSeal discovery columns are missing from the leads table. Run supabase/add-aerseal-discovery.sql in the Supabase SQL editor, then retry. ' +
              '(Pass dry_run: true to score prospects without saving in the meantime.)',
            detail: schemaError.message,
          },
          { status: 503 },
        )
      }
    }

    // Resolve which event surface to watch.
    let surface: MonitoringSurface | undefined
    if (surface_key) {
      surface = MONITORING_SURFACES.find(s => s.key === surface_key)
      if (!surface) {
        return NextResponse.json(
          { error: `Unknown surface "${surface_key}". Known: ${MONITORING_SURFACES.map(s => s.key).join(', ')}` },
          { status: 400 },
        )
      }
    }
    const probe = (customProbe || surface?.probe || '').trim()
    const label = customLabel || surface?.label || probe
    if (!probe) {
      return NextResponse.json(
        { error: 'Provide surface_key (one of the monitoring surfaces) or a custom probe URL/query.' },
        { status: 400 },
      )
    }

    const results = {
      surface: surface?.key || 'custom',
      surface_label: label,
      harvested_via: '' as string,
      candidates_found: 0,
      skipped_no_authority_angle: 0,
      skipped_generic_name: 0,
      skipped_duplicate: 0,
      profiled: 0,
      profile_failed: 0,
      rejected: 0,
      gate_failed: 0,
      approved: 0,
      saved: 0,
      hypothesis_rejected: 0,
      insert_failed: 0,
      tier_1: 0,
      tier_2: 0,
      tier_3: 0,
      prospects: [] as Array<Record<string, unknown>>,
    }

    // 1 ── Harvest the event surface.
    const { content, via } = await harvest(probe, deep_crawl)
    results.harvested_via = via
    if (!content || content.length < 150) {
      return NextResponse.json(
        { ...results, error: `Nothing usable harvested from "${label}" (via ${via}). Try a different surface or enable deep_crawl.` },
        { status: 400 },
      )
    }

    // 2 ── Extract organisations whose contract authority the event touches.
    const candidates = await extractCandidates(content, label, provider)
    results.candidates_found = candidates.length

    const named = candidates.filter(c => {
      if (isGenericName(c.organization)) { results.skipped_generic_name++; return false }
      return true
    })
    // An extraction the model itself rated 'low' has no dated event behind it —
    // profiling it costs a full dossier call to rediscover that.
    const withAngle = named.filter(c => {
      if (c.authority_relevance === 'low') { results.skipped_no_authority_angle++; return false }
      return true
    })

    // Dedupe against leads already in the box.
    const { data: existing } = await supabase.from('leads').select('company_name, website')
    const existingNames = new Set(
      (existing || []).map((l: { company_name?: string }) => (l.company_name || '').toLowerCase().trim()),
    )
    const existingDomains = new Set(
      (existing || []).map((l: { website?: string }) => toDomain(l.website || '')).filter(Boolean),
    )

    const toProfile = withAngle.filter(c => {
      const nameKey = c.organization.toLowerCase().trim()
      const domainKey = toDomain(c.website || '')
      if (existingNames.has(nameKey)) { results.skipped_duplicate++; return false }
      if (domainKey && existingDomains.has(domainKey)) { results.skipped_duplicate++; return false }
      return true
    }).slice(0, MAX_PROFILED)

    // 3–7 ── Profile, score, gate, enrich, hypothesise, save.
    async function runOne(candidate: AuthorityCandidate): Promise<void> {
      results.profiled++
      const dossier = await profileAuthority(candidate, provider)
      if (!dossier) { results.profile_failed++; return }

      // The event surface already carries a dated trigger and its URL — keep
      // them when the profiling model came back vaguer than the source it was
      // handed, rather than losing real evidence to a null.
      if (!dossier.trigger) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (dossier as any).trigger = {}
      }
      if (!dossier.trigger.evidence_url && candidate.evidence_url) {
        dossier.trigger.evidence_url = candidate.evidence_url
      }
      if (!dossier.trigger.date && candidate.event_date) {
        dossier.trigger.date = candidate.event_date
      }
      if (!dossier.website && candidate.website) dossier.website = candidate.website

      // 4 ── Score in code from the structured dossier.
      const score = scoreProspect(dossier)
      // 5 ── Six hard requirements + rejection rules.
      const gate = evaluateGate(dossier, score)

      const record: Record<string, unknown> = {
        organization: dossier.organization || candidate.organization,
        website: dossier.website || candidate.website || '',
        score: score.total,
        tier: score.tier,
        tier_label: tierLabel(score.tier),
        breakdown: score,
        trigger: dossier.trigger,
        trigger_age_days: daysSince(dossier.trigger?.date),
        control_model: dossier.authority_control?.model,
        powers: (dossier.privileged_powers || []).map(p => p.power),
        approved: gate.approved,
        gate_failures: gate.failures,
        rejections: gate.rejections.map(r => REJECTION_REASONS[r]),
      }

      // Tier counts describe the surviving funnel. A rejected prospect can
      // still compute a high score (a $40k anonymous project with a perfect
      // authority profile scores Tier 1 on the rubric and is still not a
      // prospect), so counting it would overstate the day's yield.
      if (gate.rejections.length > 0) {
        results.rejected++
        results.prospects.push({ ...record, outcome: 'rejected' })
        return
      }

      if (score.tier === 1) results.tier_1++
      else if (score.tier === 2) results.tier_2++
      else results.tier_3++

      if (!gate.approved) {
        results.gate_failed++
        results.prospects.push({ ...record, outcome: 'gate_failed' })
        return
      }
      results.approved++

      // 6 ── Enrichment happens only now, on a qualified account.
      const buyers = await enrichBuyers(
        dossier.organization,
        dossier.website || candidate.website || '',
        dossier,
      )
      record.buyers = buyers

      // 7 ── Outreach hypothesis. No trigger, no send.
      const hypothesis = await buildHypothesis(dossier, provider)
      const hypothesisProblems = validateHypothesis(hypothesis)
      record.hypothesis = hypothesis
      record.hypothesis_problems = hypothesisProblems
      if (hypothesisProblems.length > 0) {
        results.hypothesis_rejected++
        record.outcome = 'approved_no_send'
        results.prospects.push(record)
        // Still saved below — a qualified account with an unusable draft is a
        // drafting problem, not a qualification problem.
      } else {
        record.outcome = 'approved'
      }

      if (dry_run) {
        if (!record.outcome) record.outcome = 'approved'
        results.prospects.push(record)
        return
      }

      // Persist as a lead, with the full dossier attached.
      const website = dossier.website || candidate.website || ''
      const powersSummary = (dossier.privileged_powers || [])
        .map(p => `${p.power} (${p.status})`)
        .join(', ')

      const { data: newLead, error: leadErr } = await supabase
        .from('leads')
        .insert({
          company_name: dossier.organization,
          website: website || null,
          description: (dossier.evm_footprint?.products || []).join(', ') || candidate.what_they_operate,
          industry_category: 'DeFi protocol / DAO / token issuer with a deployed contract',
          customer_category: ['AERseal Contract-Authority Customer'],
          product_to_sell: 'AERseal contract-authority transfer',
          product_summary: dossier.structural_fit?.rationale || null,
          supported_chains_or_rails: (dossier.evm_footprint?.chains || []).join(', ') || null,
          current_providers: dossier.incumbent?.current_alternative || null,
          pain_point: `${powersSummary || 'Privileged role'} controlled via ${dossier.authority_control?.model} — ${dossier.authority_control?.detail || 'controller not fully documented'}`,
          // Severity describes HOW BAD THE CONSEQUENCE IS, so it comes from the
          // pain component — not from the overall tier. Mapping it from tier
          // wrote 'medium' onto a confirmed $76M key-compromise exploit whose
          // pain_consequence was 89, because that lead's tier was held down by
          // trigger recency and evidence gaps, which say nothing about how bad
          // the exposure is. Safe to assert critical/high here without a
          // further evidence check: an approved lead has already cleared the
          // gate's dated-trigger + authoritative-source requirements.
          pain_point_severity:
            score.pain_consequence >= 80 ? 'critical'
            : score.pain_consequence >= 60 ? 'high'
            : score.pain_consequence >= 40 ? 'medium'
            : 'low',
          pain_point_evidence: (dossier.facts || []).slice(0, 3).join(' | ') || null,
          pain_point_source_url: dossier.authority_control?.evidence_url || dossier.structural_fit?.evidence_url || null,
          pain_point_evidence_type: 'verified_source',
          potential_gap: dossier.aerseal_use_case || null,
          aerseal_fit: dossier.aerseal_use_case,
          suggested_use_case: dossier.aerseal_use_case,
          outreach_angle: hypothesis?.authority_implication || null,
          trigger_reason: dossier.trigger?.what_happened || null,
          trigger_date: dossier.trigger?.date || null,
          trigger_source_url: dossier.trigger?.evidence_url || null,
          source_url: dossier.trigger?.evidence_url || probe,
          classification: 'customer',
          facts: dossier.facts || [],
          assumptions: dossier.inferences || [],
          unknowns: dossier.unknowns || [],
          lead_score: score.total,
          urgency_score: score.trigger_recency,
          urgency_reasoning: `Trigger "${dossier.trigger?.type}" dated ${dossier.trigger?.date || 'unknown'} — recency component ${score.trigger_recency}/100.`,
          confidence_score: score.evidence_confidence,
          revenue_potential: dossier.exposure?.value_at_risk_usd
            ? `Authority reaches ~$${Number(dossier.exposure.value_at_risk_usd).toLocaleString()} (${dossier.exposure.value_basis})`
            : null,
          integration_feasibility: dossier.incumbent?.switching_friction === 'high' ? 'low'
            : dossier.incumbent?.switching_friction === 'medium' ? 'medium' : 'high',
          priority: score.tier === 1 ? 'excellent' : score.tier === 2 ? 'qualified' : 'needs_research',
          status: 'new',
          aerseal_score: score.total,
          aerseal_tier: score.tier,
          aerseal_dossier: dossier,
          aerseal_score_breakdown: score,
          aerseal_hypothesis: hypothesisProblems.length === 0 ? hypothesis : null,
        })
        .select('id')
        .single()

      if (leadErr || !newLead) {
        console.error(`[aerseal] insert failed for ${dossier.organization}:`, leadErr?.message)
        results.insert_failed++
        record.insert_error = leadErr?.message || 'no row returned'
        results.prospects.push(record)
        return
      }

      for (const b of buyers) {
        await supabase.from('contacts').insert({
          lead_id: newLead.id,
          name: b.name,
          role: b.title,
          company: dossier.organization,
          email: b.email,
          linkedin_url: b.linkedin_url,
          contact_confidence: b.confidence,
          reason_this_person: b.why,
        })
      }

      record.lead_id = newLead.id
      results.saved++
      results.prospects.push(record)
    }

    for (let i = 0; i < toProfile.length; i += CONCURRENCY) {
      await Promise.all(toProfile.slice(i, i + CONCURRENCY).map(runOne))
    }

    // Sort best-first so the caller sees Tier 1 at the top.
    results.prospects.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))

    return NextResponse.json({ success: true, ...results })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AERSeal discovery failed'
    console.error('[aerseal:POST]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Surface catalogue for the UI.
export async function GET() {
  return NextResponse.json({
    surfaces: MONITORING_SURFACES.map(s => ({
      key: s.key,
      label: s.label,
      kind: s.kind,
      tier: s.tier,
      segments: s.segments,
      probe: s.probe,
      is_url: /^https?:\/\//.test(s.probe),
    })),
  })
}
