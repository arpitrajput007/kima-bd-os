import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PRODUCT_BRAIN, PRODUCT_BRAIN_COMPACT, AER360_DISCOVERY_BRAIN } from '@/lib/kima-knowledge'
import { pickBestUrl, extractSocials, type Socials } from '@/lib/utils'
import { apolloConfigured, apolloEnrichContacts, apolloSearchCompanies, toDomain } from '@/lib/apollo'
import { isGenericName } from '@/lib/leadQuality'
import { exaConfigured, exaSearchCompanies, exaCompanyNews } from '@/lib/exa'
import { routeJSON, type AIProvider } from '@/lib/ai-router'
import { CLAUDE_FAST } from '@/lib/claude'
import { discoveryMemory } from '@/lib/agent-memory'
import { readUrl } from '@/lib/webRead'
import { isRealEmail } from '@/lib/outreach'

// A contact only counts as reachable if there's an actual channel to message
// them through — a name with no email/profile, a guessed email pattern (see
// isRealEmail), or a generic LinkedIn/X *search* URL (not a profile — this is
// what Tier 3 below produces when it only has a name hint, not a channel.
function isReachableContact(c: { name?: string | null; email?: string | null; linkedin_url?: string | null; twitter_url?: string | null }): boolean {
  if (!c.name) return false
  if (isRealEmail(c.email)) return true
  if (c.linkedin_url && !c.linkedin_url.includes('/search/')) return true
  if (c.twitter_url && !c.twitter_url.includes('/search')) return true
  return false
}

// Deep research (OpenAI + Exa + crawling) per company is slow. Without this the
// function hits Vercel's default timeout and gets killed before saving leads.
// 300s = Vercel Pro cap; on Hobby it's silently clamped to the plan max.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

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


// Scoped to the three co-equal products this agent sources for (2026-08-19):
// Aerpolice + AER360 + AERseal. (Previously included LayerZero Customer,
// Hacked Protocol, Needs On/Off Ramp, and Web2 Stablecoin Settlement Customer
// — those were Kima-only categories and have been dropped along with the
// sources that targeted them.)
const CUSTOMER_CATEGORIES = [
  'Agentic Payments Customer',
  'Aerpolice Governance Customer',
  'AER360 Custody / Key-Governance Customer',
  'AERseal Contract-Authority Customer',
]
// Cap = how many *unworked* prospects we allow to sit in a category at once.
// Only leads still in the top-of-funnel (see CAP_BLOCKING_STATUSES) count toward
// this. Once you contact/reserve/qualify a lead it stops blocking new discovery,
// so the daily pipeline keeps surfacing fresh leads instead of clogging.
const CATEGORY_CAP = 8
const CAP_BLOCKING_STATUSES = ['new', 'researching', 'needs_more_research']

// ── "Immediate pain" quality gate ──────────────────────────────────────────
// A lead can have a great long-term ICP fit but no reason to contact them
// THIS week. Per user decision: only save leads with both a strong general
// fit AND a genuinely urgent, severe pain point — not just fit.
const MIN_LEAD_SCORE = 50
const MIN_URGENCY_SCORE = 50
const REQUIRED_PAIN_SEVERITIES = new Set(['critical', 'high'])
// A lead can clear lead_score/severity/urgency individually while still
// having thin overall evidence (no dated trigger, low-confidence contact,
// mostly assumptions) — confidence_score (computed below, not self-reported)
// catches that combination none of the other gates individually catch.
const MIN_CONFIDENCE_SCORE = 25

// ── Confidence score — computed in code, not self-reported by the model ────
// Deliberately NOT another "rate your own work" LLM field (that's exactly how
// severity got inflated). Derived instead from signals already present in the
// deepResearch() output, so it costs zero extra API calls/credits: real
// citations, a dated trigger, the ratio of sourced facts to guesses, and
// whether a real contact was found.
function computeConfidenceScore(research: Record<string, unknown>, isVerified: boolean): number {
  let score = 20

  if (isVerified) score += 30

  const triggerDate = String(research.trigger_date || '').trim().toLowerCase()
  if (triggerDate && triggerDate !== 'null' && triggerDate !== 'unknown') score += 15

  const triggerSourceUrl = String(research.trigger_source_url || research.source_url || '').trim()
  if (triggerSourceUrl) score += 15

  const facts = Array.isArray(research.facts) ? research.facts.length : 0
  const assumptions = Array.isArray(research.assumptions) ? research.assumptions.length : 0
  const unknowns = Array.isArray(research.unknowns) ? research.unknowns.length : 0
  score += Math.min(20, facts * 4)
  score -= Math.min(15, assumptions * 3)
  score -= Math.min(15, unknowns * 3)

  const contacts = Array.isArray(research.contacts) ? research.contacts as Record<string, unknown>[] : []
  const confidenceRank: Record<string, number> = { high: 2, medium: 1, low: 0 }
  const bestContactRank = contacts.reduce((best, c) => {
    const rank = confidenceRank[String(c.contact_confidence || '').toLowerCase()] ?? -1
    return Math.max(best, rank)
  }, -1)
  if (bestContactRank === 2) score += 15
  else if (bestContactRank === 1) score += 7

  return Math.max(0, Math.min(100, Math.round(score)))
}

// Check a URL against ChainPatrol's phishing registry (free, no key needed).
// Used by MetaMask, SEAL, and other Web3 security tools.
// Returns true if safe, false if flagged as phishing/malicious.
// Fails open (returns true) so a network error never blocks all discovery.
async function isSafeDomain(url: string): Promise<boolean> {
  try {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`
    const res = await fetch('https://app.chainpatrol.io/api/v2/asset/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'URL', content: fullUrl }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return true // fail open
    const json = await res.json()
    if (json.status === 'BLOCKED') {
      console.warn(`[isSafeDomain] Phishing domain blocked: ${fullUrl}`)
      return false
    }
    return true
  } catch {
    return true // fail open — don't block discovery if check times out
  }
}

// Read a company website and pull real social links (twitter/telegram/discord)
// from the page (usually the header/footer). No AI guessing — regex only.
// prefetchedText: pass deepResearch()'s own homepage crawl when it's for the
// same URL — avoids fetching the exact same page through Jina twice (once as
// research evidence, once here for social links) for every saved lead.
async function fetchSocials(website?: string, companyName?: string, prefetchedText?: string): Promise<Socials> {
  if (!website) return {}
  try {
    let text = prefetchedText
    if (!text) {
      const url = website.startsWith('http') ? website : `https://${website}`
      const res = await fetch(`https://r.jina.ai/${url}`, {
        headers: { Accept: 'text/plain' },
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) return {}
      text = await res.text()
    }
    return extractSocials(text, companyName)
  } catch {
    return {}
  }
}

// If the extracted company has no website, do a quick search to find the real one.
// Returns the best URL found, or '' if nothing found.
async function resolveWebsite(companyName: string): Promise<string> {
  try {
    // First try Jina search — fast and free.
    const jinaSearch = `https://s.jina.ai/${encodeURIComponent(companyName + ' official website')}`
    const res = await fetch(jinaSearch, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(12000),
    })
    if (res.ok) {
      const text = await res.text()
      // Find first https:// link that looks like a homepage (not a social or news site).
      const links = [...text.matchAll(/https?:\/\/(?!.*(?:twitter|t\.co|x\.com|linkedin|facebook|instagram|crunchbase|wikipedia|medium|substack|coinmarketcap|coingecko|techcrunch|theblock|decrypt|cointelegraph|github|reddit|youtube|bloomberg|forbes|reuters|wsj))[a-z0-9.-]+\.[a-z]{2,}(?:\/)?(?=$|\s|\))/gi)]
      if (links.length) return links[0][0].replace(/\/$/, '')
    }
  } catch { /* fall through */ }

  // Tavily fallback.
  if (process.env.TAVILY_API_KEY) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query: companyName + ' official site', max_results: 3, search_depth: 'basic' }),
        signal: AbortSignal.timeout(12000),
      })
      const data = await res.json()
      const top = (data?.results || [])[0]?.url
      if (top && !/(twitter|linkedin|facebook|crunchbase|wikipedia|medium|github|reddit|youtube|bloomberg|theblock|decrypt|cointelegraph)/i.test(top)) {
        return top.replace(/\/$/, '')
      }
    } catch { /* fall through */ }
  }
  return ''
}

// Pull socials from a web-search result page (fallback when we have no website to crawl).
async function fetchSocialsFromSearch(companyName: string): Promise<Socials> {
  try {
    const q = encodeURIComponent(companyName + ' twitter telegram discord')
    const res = await fetch(`https://s.jina.ai/${q}`, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return {}
    return extractSocials(await res.text(), companyName)
  } catch { return {} }
}

// Search web using Tavily API
async function searchWeb(query: string): Promise<string> {
  if (!process.env.TAVILY_API_KEY) return ''
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: 'advanced',
        include_raw_content: false,
        max_results: 10
      })
    })
    const data = await res.json()
    if (!data.results) return ''
    return data.results.map((r: any) => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`).join('\n\n')
  } catch (e) {
    console.error('[searchWeb]', e)
    return ''
  }
}

// Extract company mentions from raw page content
// extraction_confidence lets the caller skip the expensive per-company
// deepResearch() call (one Sonnet call + Hunter + Exa + homepage crawl,
// ~4500 tokens, vs this single ~2500-token extraction call shared across up
// to 6 candidates) for candidates the model itself isn't confident about at
// extraction time — a real credit-saving lever, since this reuses a call
// we're already paying for rather than adding a new one. Low stakes to get
// slightly wrong: unlike pain_point_severity (which gates what gets SAVED as
// a lead and is evidence-locked, see the severity downgrade below), this
// field only gates whether we spend the research call at all — worst case
// is a missed candidate, not a trust/quality regression, since every company
// that DOES get researched still goes through the full evidence/severity gate.
interface ExtractedCompany {
  name: string
  website: string
  description: string
  source_url: string
  source_excerpt: string
  extraction_confidence?: 'high' | 'medium' | 'low'
}

async function extractCompanies(
  content: string,
  sourceContext: string,
  provider: AIProvider = 'claude'
): Promise<ExtractedCompany[]> {
  try {
    const result = await routeJSON<{ companies: ExtractedCompany[] }>({
      provider,
      model: provider === 'claude' ? CLAUDE_FAST : 'gpt-4o',
      maxTokens: 2500,
      temperature: 0.2,
      system: `You are a BD researcher for three co-equal products: AER360 (hardware-enforced wallet/fund custody and key-signing), Aerpolice (AI-agent governance), and AERseal (hardware-enforced custody of a deployed smart contract's privileged admin authority).

${PRODUCT_BRAIN_COMPACT}

Read the ENTIRE page, not just the first company mentioned. Output REAL, SPECIFIC, NAMED companies that could be B2B customers for institutional custody/key-signing, AI-agent governance, or deployed-contract admin-authority infrastructure — never categories.

CRITICAL — every "name" MUST be a single real company you could google and land on one company's website:
- GOOD (real companies): "Skyfire", "Fireblocks", "Copper", "Fordefi", "Anthropic", "Bybit", "Coinbase", "Circle", "Ramp", "Brex".
- BANNED (categories / segments / groupings — NEVER output these as a name): "AI Agents", "Custody Providers", "MPC Wallets", "Exchanges", "Crypto Exchanges", "Custodians", "Fintechs", "Agent Frameworks", "DeFi Protocols".

EXPAND CATEGORIES INTO REAL COMPANIES:
- If the content points at a CATEGORY, expand it into specific real companies that best fit one of the three ICPs.
  · "agentic commerce / AI agents that pay" → Skyfire, Payman, Crossmint agent-wallet customers (Aerpolice)
  · "MPC/custody providers" → Fireblocks, Copper, Fordefi, Coinbase Custody, BitGo (AER360)
  · "AI agent frameworks / MCP tooling" → companies building on Claude/OpenAI agent SDKs, MCP server authors, agent-marketplace listings (Aerpolice)
  · "exchanges / treasuries" → Bybit, OKX, Kraken, Circle (AER360)
  · "DeFi protocols / bridges / token issuers / L2s with an upgradeable contract" → named protocols with a live admin/proxy-admin/mint/pause role (AERseal)
- Only name companies that genuinely exist with a findable website.
- QUALITY OVER COUNT: it is completely fine to return 2 companies, or 0, if that's all the content genuinely supports. Do not pad the list with borderline or generic mentions just to reach a number — every extra low-confidence pick costs a real, expensive research call downstream. A source page that only weakly touches our ICP should return few or no companies.`,
      user: `Source: ${sourceContext}

Content:
${content}

Return up to 6 SPECIFIC, REAL, NAMED companies — fewer is fine, don't pad. Never output a category/segment as a name. For each company, pull the exact sentence(s) from the content above that mention them — this is real evidence, don't discard it. Return JSON:
{
  "companies": [
    {
      "name": "Real brand name (e.g. 'Bybit', 'JPMorgan') — NEVER a category",
      "website": "https://<real domain>",
      "description": "1-2 sentence description of what this company does",
      "source_url": "EXACT link from content about this company, or empty string",
      "source_excerpt": "The exact sentence(s) from the content above that mention this company and any trigger/pain evidence — empty string if nothing specific",
      "extraction_confidence": "high (content gives a specific, concrete reason this company fits one of the three ICPs) | medium (plausible fit but the content is thin/generic) | low (mentioned in passing, weak or speculative fit — include only if you have nothing better)"
    }
  ]
}`,
    })
    return Array.isArray(result.companies) ? result.companies : []
  } catch (e) {
    console.error('[extractCompanies]', e)
    return []
  }
}

// Removed: getLearnedIntelligence() — replaced by discoveryMemory() from lib/agent-memory.ts
// discoveryMemory() loads up to 56 knowledge entries (8 per type × 7 types) + active rules
// + feedback patterns, vs the old limit(30) by recency which dropped older knowledge.

// Full deep-dive research on a single company
async function deepResearch(
  company: {
  name: string
  website: string
  description: string
  source_excerpt?: string
},
  learnedIntelligence?: string,
  provider: AIProvider = 'claude'
): Promise<Record<string, unknown> | null> {
  const domain = (company.website || '')
    .replace(/https?:\/\//, '')
    .replace(/\/.*/, '')
    .trim()

  try {
    // Real evidence beats a search snippet. Pull the company's own homepage
    // and, if this company surfaced from a specific article, keep the exact
    // excerpt that mentioned them — both run in parallel with Hunter.
    const [hunterData, homepageText] = await Promise.all([
      getHunterContacts(company.website),
      company.website ? readUrl(company.website, 4000) : Promise.resolve(''),
    ])
    const hunterContext = hunterData ? `\nVerified emails from Hunter.io database:\n${hunterData}\nSelect the most relevant BD contacts from this list if any, otherwise guess patterns.` : ''
    const homepageContext = homepageText ? `\n\nCOMPANY'S OWN WEBSITE (Level 1 evidence — crawled live, treat as ground truth over training data):\n${homepageText}` : ''
    const excerptContext = company.source_excerpt ? `\n\nSOURCE ARTICLE EXCERPT (the exact text that surfaced this company — Level 1/2 evidence depending on the source):\n${company.source_excerpt}` : ''

    // Sonnet for Claude, gpt-4o for OpenAI. NOTE: this intentionally does NOT
    // use Opus + extended thinking — on a 300s function budget, Opus per
    // company × up to 8 companies risks the timeout. Sonnet is fast enough to
    // process a full batch and, combined with the real evidence above (was
    // previously just an 800-char search snippet), is the higher-leverage fix.
    const deepResearchSystem = `You are a senior BD researcher for three co-equal products: AER360 (hardware-enforced wallet/fund custody and key-signing), Aerpolice (AI-agent governance), and AERseal (hardware-enforced custody of a deployed smart contract's privileged admin authority). These are the ONLY three products this pipeline sources leads for — do not evaluate or invoke any other product, even if you know of one. None of the three is a default primary — each is scored on its own merits.

${PRODUCT_BRAIN}

${AER360_DISCOVERY_BRAIN}

FIRST, validate the input is a REAL, SPECIFIC company (a brand you can google to one company's site like "Skyfire", "Fireblocks", "Circle") and NOT a generic category/segment ("AI Agents", "Custody Providers", "Exchanges", "Fintechs", "Infrastructure"). If it is a category, set "is_specific_real_company": false and leave other fields minimal.

SECOND, classify the company (customer | partner | competitor | integration | investor_ecosystem | not_relevant | unclear) before you evaluate fit — see the classification rules above. Do not score a competitor or investor as if it were a prospect.

Evaluate all three products independently for every company — see MULTI-PRODUCT DISCIPLINE above:
- AER360 fits if this company is a custodian, MPC wallet provider, exchange, treasury, or fund with WALLET/FUND key-signing/custody policy needs, OR is about to give a human or AI agent real financial authority for the first time.
- AERseal fits if this company operates a DEPLOYED SMART CONTRACT whose privileged role (upgrade, mint, pause, freeze, oracle, bridge config, role management) is controlled by a single EOA or a weakly-secured multisig. This is a different problem from AER360 — do not credit AER360 for a contract-authority gap, or vice versa.
- Aerpolice fits if this company builds/operates AI agents taking consequential financial or system actions with no identity/policy/audit layer.
- Recommend more than one only when EACH has its own distinct, independently verified pain — shared AERKey infrastructure is not sufficient on its own.
- If NONE of the three products solves a real, specific problem for this company, say so honestly — do not force a fit.

You must produce ONE lead_score and ONE urgency_score for the lead overall (not per-product), but the fit fields (aeredium_fit / aerseal_fit / aerpolice_fit below) must each be reasoned independently — leave any that don't genuinely apply as null rather than padding them. Reason through the fit dimensions above (financial exposure, agent/automation activity, deployed-contract privileged-role exposure, need for transaction/admin controls, security sensitivity, recent trigger, likelihood of buying external infrastructure, differentiation for them, buyer accessibility) before you commit to a number — don't just pick a round number that feels right:

LEAD_SCORE (0-100) — general ICP fit, independent of timing:
High score (70+): clear pain point, active product, matches a target category, decision maker findable
Medium (40-69): possible fit but unclear pain point or no direct match
Low (<40): no clear use case for AER360, Aerpolice, or AERseal

URGENCY_SCORE (0-100) — how urgent it is to reach out THIS WEEK, driven ONLY by
trigger recency and pain severity, NOT by how good a long-term fit they are — use the trigger dictionary and freshness bands above:
High (70+): a dated, concrete VERY HIGH or HIGH value trigger in roughly the last 30-60 days AND pain_point_severity is critical or high
Medium (40-69): a real but older or vaguer trigger, or high-severity pain with no dated trigger
Low (<40): no trigger_reason found, or trigger is stale/speculative — this can still be a HIGH lead_score company, just not one to prioritize contacting right now

IMPORTANT — only leads with BOTH a strong fit AND a genuinely urgent, severe pain point get saved (lead_score ≥ ${MIN_LEAD_SCORE}, pain_point_severity critical/high, urgency_score ≥ ${MIN_URGENCY_SCORE}). Do not inflate urgency_score or pain_point_severity just to help a good-fit company clear the bar — an honest "good fit, not urgent right now" is a more useful answer than a manufactured one, even though it means this lead won't be saved today.`

    const deepResearchUser = `Do a deep BD research on this company for AER360 / Aerpolice / AERseal — three co-equal products, each evaluated independently:

Company: ${company.name}
Website: ${company.website || 'unknown'}
Description: ${company.description}${hunterContext}${homepageContext}${excerptContext}

PAIN POINT RULES — be specific, not generic:
- Do NOT write "they need better agent governance" or "they face custody risk". Anyone can write that.
- DO write the SPECIFIC pain: what exact product/feature is exposed, what exact cost/risk/incident they face, what specific architecture choice creates the vulnerability. Cite real facts about this company, using the homepage text and source excerpt above where available.
- For AI-agent companies: name the specific financial or system action their agent takes unsupervised, and what happens if that action is wrong or hijacked.
- For custody/Fireblocks/MPC-wallet users: what specific signing/custody limitation (software-level MPC, single-cloud dependency, seed-phrase exposure) blocks their growth or fails a due-diligence question.
- For companies with a deployed smart contract: name the SPECIFIC privileged role (upgrade/mint/pause/freeze/oracle/bridge-config/role-management) and who controls it (single EOA, or a specific weak multisig setup) — cite on-chain or documented evidence, not a guess that "they probably have an admin key."
- pain_point_severity = critical only if there is a real incident, a live enterprise-deal blocker, or a blocking architectural dependency.

GAP RULE: potential_gap is distinct from pain_point — it's specifically what's architecturally MISSING from their current setup that one of our products could fill (for AER360: no agent-specific wallet, unrestricted access, weak limits, no destination allowlist, excessive human approvals, no policy enforcement at signing, no tamper-evident audit, hot-wallet/API-key exposure; for AERseal: contract admin role on a single EOA or weak multisig, no approval workflow on privileged actions, no independent key-proof; for Aerpolice: no agent identity, no pre-execution policy gate, no audit trail). If the evidence doesn't support a specific gap, set potential_gap to exactly "Gap not confirmed" — never invent one.

CONTACT RULES — find the REAL decision maker, not a generic title:
- Priority 1: Head of BD / VP Partnerships / Head of Growth — this person signs integration deals.
- Priority 2: CTO / VP Engineering / Head of Security / Head of Trust — needs to evaluate technical fit.
- Priority 3: CEO / Co-Founder — for companies < 100 people, this person often owns BD.
- If you know their real name (from public LinkedIn, press releases, Twitter) use it. Otherwise null — never fabricate names.
- linkedin_hint must be specific: "FirstName LastName CompanyName Title"
- why_this_person must explain the specific buying authority, not just the title (e.g. "CTO because the pain is architectural" or "Head of Treasury because the problem is financial-authority controls").

Return this exact JSON:
{
  "is_specific_real_company": true,
  "classification": "customer|partner|competitor|integration|investor_ecosystem|not_relevant|unclear",
  "industry_category": "one specific industry category",
  "customer_category": ["array — pick from: AER360 Custody / Key-Governance Customer, AERseal Contract-Authority Customer, Agentic Payments Customer, Aerpolice Governance Customer, Other"],
  "product_to_sell": "the single most relevant product (AER360 / AERseal / Aerpolice) for this company and WHY — e.g. 'AER360 threshold signing — they run software-only MPC custody today with no hardware-attested signing policy', 'AERseal — their proxy admin is a single founder EOA with no approval workflow', or 'Aerpolice agent governance — their AI agent handles payouts with no execution gate'",
  "region": "their primary market region",
  "company_summary": "3-4 sentence summary: what they do, how big, what stack they use, what stage they're at",
  "business_model": "how they specifically make money",
  "financial_activity": "what money/assets they appear to control or move — be concrete, or 'Unknown' if not established",
  "agent_activity": "what autonomous/AI/automated activity exists that touches money or system actions — or 'None confirmed' if there isn't any",
  "supported_chains_or_rails": "blockchains, wallets, or agent frameworks they currently use",
  "current_providers": "specific known custody/MPC/agent-governance providers they currently use, if any",
  "pain_point": "THE specific pain point — one crisp sentence with a concrete fact",
  "pain_point_severity": "critical|high|medium|low",
  "pain_point_evidence": "concrete evidence: exact quote, incident + date, specific architectural dependency, or named product limitation",
  "pain_point_source_url": "EXACT full URL to the article/post proving the pain point. Empty string if none.",
  "pain_point_evidence_type": "verified_source|agent_analysis|inferred",
  "potential_gap": "what's architecturally missing that one of our products could fill, or exactly 'Gap not confirmed' if unsupported",
  "aeredium_fit": "how AER360 (AERKey threshold signing / Policy Engine / AERKey Wallet / Agent Control Center) addresses their WALLET/FUND custody, key-signing, or agent-spend-control gap — specific pillar(s), or null if there is genuinely no fit",
  "aerseal_fit": "how AERseal (transferring a deployed contract's privileged role to an AERKey threshold-controlled address) addresses their SMART-CONTRACT admin-authority gap — name the specific privileged role and current controller, or null if there is no deployed contract with a privileged role controlled by a single EOA/weak multisig — never force this",
  "suggested_use_case": "the precise integration to pitch for whichever product(s) genuinely fit",
  "outreach_angle": "one specific sentence referencing their actual trigger/situation — not a generic 'would love to introduce AER360' line",
  "aerpolice_fit": "how Aerpolice's Agent Identity / Triple Gate / Audit Trail addresses their AI-agent governance gap, or null if this company has no AI agents taking financial or system actions — never force this",
  "trigger_reason": "why reach out NOW — a specific recent event (funding, product launch, security incident, compliance hire, contract deployment, audit flag). Must be datable and real.",
  "trigger_date": "the trigger event's actual date if known (e.g. '2026-07-15' or 'July 2026'), or null if undated",
  "source_url": "exact URL to the trigger event. NOT a homepage. null if none.",
  "trigger_source_url": "same as source_url if it's specifically the trigger citation, else the best available citation for the trigger, or null",
  "integration_feasibility": "high|medium|low — with one sentence of reasoning",
  "revenue_potential": "realistic ARR estimate based on their volume/scale/headcount, for whichever product(s) genuinely fit",
  "lead_score": 0,
  "urgency_score": 0,
  "urgency_reasoning": "1-2 sentences: what dated trigger and pain severity drove this urgency number — say explicitly if there is no dated trigger",
  "priority": "excellent|qualified|needs_research|low_priority",
  "score_reasoning": "2-3 sentences: what drives the score up and what limits it",
  "facts": ["short, directly-sourced factual statements — leave empty if none"],
  "assumptions": ["reasoned inferences, clearly labeled as such — leave empty if none"],
  "unknowns": ["specific things that matter but are genuinely unconfirmed — leave empty if none"],
  "contacts": [
    {
      "role": "exact title of the ideal person to contact",
      "name": "real full name if publicly known, or null — never fabricate",
      "linkedin_hint": "FirstName LastName CompanyName Title",
      "twitter_hint": "exact @handle if known, or null",
      "email_pattern": "firstname@${domain || 'company.com'}",
      "why_this_person": "specific reason they own the buying decision",
      "contact_confidence": "high|medium|low"
    }
  ]
}`

    const researchResult = await routeJSON({
      provider,
      model: provider === 'claude' ? CLAUDE_FAST : 'gpt-4o',
      maxTokens: 4500,
      temperature: 0.2,
      system: deepResearchSystem,
      // learnedIntelligence varies per source-run fetch; keeping it out of
      // `system` means the (much larger) static PRODUCT_BRAIN block above can
      // hit the prompt cache across ALL sources/companies in a run, not just
      // within one source, even if this text differs slightly between fetches.
      systemDynamicSuffix: learnedIntelligence || undefined,
      user: deepResearchUser,
    })
    // Carry the homepage crawl through to the caller (underscore-prefixed —
    // internal plumbing, never a DB field) so the later socials lookup can
    // reuse it instead of crawling the exact same URL a second time.
    return { ...researchResult, _homepageText: homepageText }
  } catch (e) {
    console.error('[deepResearch]', e)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    // Use service role key on the server so RLS doesn't block lead INSERT/SELECT ops.
    // `||` not `??` — SUPABASE_SERVICE_ROLE_KEY can be present-but-empty (e.g. an
    // unfilled '.env.local' placeholder), and '' is not null/undefined so `??`
    // would pass the empty string straight to createClient() instead of falling
    // back, crashing every run before it does anything at all.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { source_id, research_ai = 'claude' } = await req.json()
    if (!source_id) {
      return NextResponse.json({ error: 'source_id is required' }, { status: 400 })
    }
    // research_ai: 'claude' (default) | 'openai' — set by the user in Settings.
    const researchProvider: 'claude' | 'openai' = research_ai === 'openai' ? 'openai' : 'claude'

    // Pre-flight: make sure the selected AI provider is actually configured.
    // Without this check, auth errors get swallowed deep in extractCompanies/deepResearch
    // and the pipeline silently returns 0 leads with no visible error.
    if (researchProvider === 'claude') {
      const { claudeConfigured } = await import('@/lib/claude')
      if (!claudeConfigured()) {
        return NextResponse.json({
          error: 'ANTHROPIC_API_KEY is not configured. Add it to your .env.local (local) or Render environment (production). Get a key at https://console.anthropic.com',
        }, { status: 503 })
      }
    } else {
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({
          error: 'OPENAI_API_KEY is not configured. Add it to your .env.local (local) or Render environment (production).',
        }, { status: 503 })
      }
    }

    // 1. Load the source
    const { data: source, error: srcError } = await supabase
      .from('sources')
      .select('*')
      .eq('id', source_id)
      .single()

    if (srcError || !source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    }
    if (!source.source_url_or_query) {
      return NextResponse.json({ error: 'Source has no URL or query configured' }, { status: 400 })
    }

    // 2. Check current category counts. Only count *recent* unworked leads — once a
    // lead is contacted/reserved/qualified it stops counting (it's "in play").
    // Also exclude leads older than 7 days: a backlog from last week should never
    // permanently block fresh discovery. Stale leads are still in the DB and visible;
    // they just don't occupy a cap slot so the pipeline keeps flowing.
    const capCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('customer_category')
      .in('status', CAP_BLOCKING_STATUSES)
      .gte('created_at', capCutoff)

    const categoryCounts: Record<string, number> = {}
    CUSTOMER_CATEGORIES.forEach(c => { categoryCounts[c] = 0 })
    ;(existingLeads || []).forEach((lead: { customer_category?: string[] }) => {
      const cats = lead.customer_category || []
      cats.forEach((cat: string) => {
        if (categoryCounts[cat] !== undefined) categoryCounts[cat]++
      })
    })

    // 2b. Cheap early exit: if this source's own target category is already at
    // cap, every company we'd find is going to get thrown away at the cap check
    // anyway (see step 6) — but only AFTER paying for Exa-news/Hunter/homepage-crawl/
    // Claude research on each one. Bail before any of that spend happens.
    // Don't touch last_run_at — this source didn't actually run, so it should be
    // retried as soon as the category drains, not wait out its full cadence.
    if (
      source.target_customer_category &&
      CUSTOMER_CATEGORIES.includes(source.target_customer_category) &&
      (categoryCounts[source.target_customer_category] || 0) >= CATEGORY_CAP
    ) {
      return NextResponse.json({
        found: 0,
        saved: 0,
        skipped_duplicate: 0,
        skipped_generic: 0,
        skipped_cap: 1,
        skipped_low_score: 0,
        leads_saved: [],
        note: `Skipped — "${source.target_customer_category}" already has ${categoryCounts[source.target_customer_category]} unworked leads (cap ${CATEGORY_CAP}). No research run, no tokens spent.`,
      })
    }

    // 2c. Broader safety net: the check above only fires when a source has a
    // specific target_customer_category set. Most sources (general news feeds,
    // etc.) don't have one, so they'd still burn a full research call per
    // candidate even when literally every category is already full and there
    // is nowhere for any lead to land. Catch that case unconditionally.
    if (CUSTOMER_CATEGORIES.every(c => (categoryCounts[c] || 0) >= CATEGORY_CAP)) {
      return NextResponse.json({
        found: 0,
        saved: 0,
        skipped_duplicate: 0,
        skipped_generic: 0,
        skipped_cap: 1,
        skipped_low_score: 0,
        leads_saved: [],
        note: `Skipped — every customer category is already at the ${CATEGORY_CAP}-lead cap. No research run, no tokens spent.`,
      })
    }

    // 3. Get existing company names/websites/domains to avoid duplicates.
    // We match on: exact lowercased name, lowercased domain (most reliable),
    // and a slug version (removes spaces/punctuation) to catch "Gnosis Safe" vs "GnosisSafe".
    const { data: existingCompanies } = await supabase
      .from('leads')
      .select('company_name, website')

    // Strip qualifiers that make the same company look like two different names
    // to a naive slug — "Lio (formerly askLio)" vs "askLio" vs "Lio Inc." should
    // all collapse to the same key so we never re-run expensive research on a
    // company already sitting in the lead box.
    function nameSlug(s: string) {
      return s
        .toLowerCase()
        .replace(/\([^)]*\)/g, '')                                   // drop "(formerly X)", "(YC S24)", etc.
        .replace(/\b(inc|incorporated|ltd|llc|ltd\.|corp|corporation|co)\b\.?/g, '')
        .replace(/[^a-z0-9]/g, '')
    }

    const existingNames = new Set(
      (existingCompanies || []).map((l: { company_name?: string }) =>
        (l.company_name || '').toLowerCase().trim()
      )
    )
    const existingNameSlugs = new Set(
      (existingCompanies || []).map((l: { company_name?: string }) =>
        nameSlug(l.company_name || '')
      ).filter(Boolean)
    )
    const existingDomains = new Set(
      (existingCompanies || [])
        .map((l: { website?: string }) => toDomain(l.website || ''))
        .filter(Boolean)
    )
    const existingWebsites = existingDomains // keep alias for compatibility

    // 4. Get the company list — either straight from Apollo, or by crawling a URL/search.
    const sourceQuery = source.source_url_or_query.trim()
    const isApolloSource = source.source_type === 'apollo_search' || /^apollo:/i.test(sourceQuery)
    let companies: Array<{ name: string; website: string; description: string; source_url: string; source_excerpt?: string; extraction_confidence?: 'high' | 'medium' | 'low' }> = []

    if (isApolloSource) {
      if (!apolloConfigured()) {
        return NextResponse.json({ error: 'Apollo API key not configured. Add APOLLO_API_KEY to your environment.' }, { status: 400 })
      }
      const q = sourceQuery.replace(/^apollo:/i, '').trim()
      companies = await apolloSearchCompanies(q, 8)
      if (!companies.length) {
        return NextResponse.json({ error: 'Apollo returned no companies for that query — try different keywords.' }, { status: 400 })
      }
    } else if (source.source_type === 'exa_similar') {
      // Exa findSimilar — point at a good lead URL, get more companies like it.
      if (!exaConfigured()) {
        return NextResponse.json({ error: 'EXA_API_KEY not configured.' }, { status: 400 })
      }
      const { exaFindSimilar } = await import('@/lib/exa')
      const similar = await exaFindSimilar(sourceQuery, 8)
      companies = similar
      if (!companies.length) {
        return NextResponse.json({ error: 'Exa could not find similar companies for that URL.' }, { status: 400 })
      }
    } else if (source.source_type === 'exa_search' || (!sourceQuery.startsWith('http') && exaConfigured())) {
      // Exa neural search — semantically finds real companies matching the query.
      companies = await exaSearchCompanies(sourceQuery, 8)
      if (!companies.length) {
        return NextResponse.json({ error: 'Exa returned no companies for that query — try different keywords.' }, { status: 400 })
      }
    } else {
      let content = ''
      if (sourceQuery.startsWith('http://') || sourceQuery.startsWith('https://')) {
        content = await readUrl(sourceQuery)
      } else {
        // Exa not configured — fall back to Tavily.
        if (!process.env.TAVILY_API_KEY) {
          return NextResponse.json({ error: 'No search API configured. Add EXA_API_KEY (recommended) or TAVILY_API_KEY to your environment.' }, { status: 400 })
        }
        content = await searchWeb(sourceQuery)
      }

      if (!content || content.length < 100) {
        return NextResponse.json(
          { error: 'Could not fetch content or content too short (try a different URL or search query)' },
          { status: 400 }
        )
      }

      // Extract company list from the page
      companies = await extractCompanies(content, `${source.source_name} (${source.source_type})`, researchProvider)
    }

    // 5b. Load full memory: up to 56 knowledge entries (8 per type) + active rules + feedback patterns
    const learnedIntelligence = await discoveryMemory()

    // Drop generic categories that slipped through as "companies".
    const namedCompanies = companies.filter(c => !isGenericName(c.name))

    // Cost gate: skip the expensive deepResearch() call for candidates the
    // extraction step itself flagged as low-confidence — reuses the extraction
    // call's own judgment rather than spending a full ~4500-token research
    // call to find out the same thing. Missing `extraction_confidence`
    // (older/other providers) is treated as researchable, not filtered.
    const realCompanies = namedCompanies.filter(c => c.extraction_confidence !== 'low')

    const results = {
      found: realCompanies.length,
      saved: 0,
      researched: 0, // companies that actually got a deepResearch() AI call — the real cost driver
      skipped_duplicate: 0,
      skipped_generic: companies.length - namedCompanies.length,
      skipped_low_confidence: namedCompanies.length - realCompanies.length, // filtered before spending a research call — costs nothing
      skipped_cap: 0,
      skipped_low_score: 0,
      skipped_not_urgent: 0,
      skipped_no_product_fit: 0,
      skipped_not_customer: 0,
      downgraded_unverified_severity: 0,
      downgraded_unverified_urgency: 0,
      skipped_low_confidence_score: 0,
      skipped_no_contact: 0,
      leads_saved: [] as string[],
    }

    // 6. Deep-research each company and save qualified ones.
    // Runs in small concurrent batches (see CONCURRENCY below) rather than one
    // company fully at a time — a single company's research (crawl + Hunter +
    // Exa + the big Claude call) can take 60-90s, and a source with several
    // surviving candidates was measured taking 4-5 minutes end to end
    // sequentially, well into range of getting killed by the platform's
    // function timeout before ever reaching the step that saves anything or
    // updates the source row — which looks indistinguishable from "found
    // nothing" from the outside. Extracted into its own function so the
    // driver loop below can Promise.all a batch of these together.
    async function processCompany(
      company: (typeof realCompanies)[number],
      nameKey: string,
      nameSlugKey: string,
      domainKey: string,
    ): Promise<void> {
      // Enrich company context with real-time research before the main deep-dive.
      // Exa: recent news as corroborating context (Perplexity dropped — not
      // configured for this account, was always contributing nothing).
      const exaNewsContext = exaConfigured() ? await exaCompanyNews(company.name) : ''

      // Merge the enriched context into company description for deepResearch.
      // The source_excerpt (the exact text that surfaced this company, if any)
      // is passed through separately — deepResearch treats it as real evidence,
      // not folded into the generic description.
      const enrichedCompany = {
        ...company,
        description: [
          company.description,
          exaNewsContext ? `\n\nRECENT NEWS (Exa):\n${exaNewsContext.slice(0, 1500)}` : '',
        ].filter(Boolean).join(''),
      }

      // Full research — inject learned intelligence + live context
      results.researched++
      const research = await deepResearch(enrichedCompany, learnedIntelligence, researchProvider)
      if (!research) return
      const crawledHomepageText = typeof research._homepageText === 'string' ? research._homepageText : ''

      // Hard gate: the model itself confirms this is a real company, not a category.
      if (research.is_specific_real_company === false) { results.skipped_generic++; return }

      // Classification gate — never save a competitor, investor, partner, or
      // clearly irrelevant company as a prospect just because it cleared the
      // score bar. "partner" means a channel/co-marketing relationship, not a
      // buyer — Arpit wants customer leads, not partners occupying cap slots.
      const classification = String(research.classification || '').toLowerCase()
      if (['competitor', 'investor_ecosystem', 'not_relevant', 'partner'].includes(classification)) {
        results.skipped_not_customer++
        return
      }

      // Skip low-quality leads (general ICP fit gate).
      if ((research.lead_score as number) < MIN_LEAD_SCORE) { results.skipped_low_score++; return }

      // Evidence gate — a model can label its OWN reasoning "critical" with no
      // real proof behind it. `isVerified` (published, cited article) still
      // feeds confidence_score below as the strongest tier. But the outright
      // downgrade-to-medium only fires for the genuinely weak tier —
      // 'inferred' (generic industry-level guessing, no company-specific
      // facts) or no evidence type at all. 'agent_analysis' is deliberately
      // NOT downgraded: in this pipeline it specifically means "reasoned from
      // this company's own crawled homepage and cited real facts" (required
      // by the deepResearch prompt above), not a guess — requiring a literal
      // published article for every lead was the actual problem: almost no
      // company has a news article confirming its own internal security gap,
      // so that bar rejected nearly everything regardless of lead quality.
      // The original failure this gate was built for (2026-08-19) was a
      // templated static-list source with zero company-specific facts at
      // all — a different, since-fixed code path — not well-reasoned
      // agent_analysis from live research.
      const evidenceType = String(research.pain_point_evidence_type || '').toLowerCase()
      const hasSourceUrl = typeof research.pain_point_source_url === 'string' && research.pain_point_source_url.trim().length > 0
      const isVerified = evidenceType === 'verified_source' && hasSourceUrl
      const isWeaklyEvidenced = evidenceType === 'inferred' || !evidenceType
      if (isWeaklyEvidenced && ['critical', 'high'].includes(String(research.pain_point_severity || '').toLowerCase())) {
        results.downgraded_unverified_severity++
        research.pain_point_severity = 'medium'
      }

      // Same evidence-gate principle applied to the OTHER half of the
      // "immediate pain" bar: urgency_score is supposed to be driven by a
      // dated, concrete trigger (see the prompt above), but nothing enforced
      // that in code — a lead could claim urgency 70+ on a vague, undated
      // trigger_reason with no real citation. Cap it below the gate threshold
      // when there's no real dated trigger + source backing it.
      const triggerDateRaw = String(research.trigger_date || '').trim().toLowerCase()
      const hasDatedTrigger = !!triggerDateRaw && triggerDateRaw !== 'null' && triggerDateRaw !== 'unknown'
      const hasTriggerSource = !!(String(research.trigger_source_url || '').trim() || String(research.source_url || '').trim())
      if ((!hasDatedTrigger || !hasTriggerSource) && typeof research.urgency_score === 'number' && research.urgency_score >= MIN_URGENCY_SCORE) {
        results.downgraded_unverified_urgency++
        research.urgency_score = MIN_URGENCY_SCORE - 1
      }

      const confidenceScore = computeConfidenceScore(research, isVerified)

      // "Immediate pain" gate — a good long-term fit is not enough on its own.
      // Require a severe pain point AND a genuinely urgent trigger before saving.
      const severity = String(research.pain_point_severity || '').toLowerCase()
      const urgency = (research.urgency_score as number) ?? 0
      if (!REQUIRED_PAIN_SEVERITIES.has(severity) || urgency < MIN_URGENCY_SCORE) {
        results.skipped_not_urgent++
        return
      }

      // Overall-evidence gate — a lead can clear lead_score/severity/urgency
      // individually while still being thin overall (see MIN_CONFIDENCE_SCORE
      // above). confidence_score is computed from real signals, not
      // self-reported, so this is a cheap, trustworthy backstop.
      if (confidenceScore < MIN_CONFIDENCE_SCORE) {
        results.skipped_low_confidence_score++
        return
      }

      // Product-relevance gate — reject unless there's a genuine, specific fit
      // for at least one of our three co-equal products. A non-empty lead_score
      // alone isn't proof of that; the model must have actually named a fit for
      // Aerpolice, AER360 (aeredium_fit field), or AERseal.
      const hasAerpoliceFit = typeof research.aerpolice_fit === 'string' && research.aerpolice_fit.trim().length > 0
      const hasAer360Fit = typeof research.aeredium_fit === 'string' && research.aeredium_fit.trim().length > 0
      const hasAerSealFit = typeof research.aerseal_fit === 'string' && research.aerseal_fit.trim().length > 0
      if (!hasAerpoliceFit && !hasAer360Fit && !hasAerSealFit) {
        results.skipped_no_product_fit++
        return
      }

      // Determine relevant customer categories
      const categories = ((research.customer_category as string[]) || [])
        .filter(c => CUSTOMER_CATEGORIES.includes(c))
      if (categories.length === 0) categories.push('Other')

      // Check if any matching category has room (CATEGORY_CAP unworked leads)
      const hasRoom = categories.some(cat => (categoryCounts[cat] || 0) < CATEGORY_CAP)
      if (!hasRoom) { results.skipped_cap++; return }

      // Resolve website — required before saving. If the extractor didn't find it,
      // do a quick search to look it up. Skip the lead if we still can't find one.
      let website = company.website?.trim() || (research.website as string | undefined)?.trim() || ''
      if (!website) {
        website = await resolveWebsite(company.name)
      }
      if (!website) { results.skipped_low_score++; return } // no website = can't reach out

      // Safety check — never save a phishing / malicious domain.
      const safe = await isSafeDomain(website)
      if (!safe) {
        console.warn(`[discover] Skipping ${company.name} — domain flagged as phishing: ${website}`)
        results.skipped_duplicate++ // reuse counter; will log clearly in console
        return
      }

      // Pull real social links. Reuse deepResearch()'s own homepage crawl when
      // it's for this exact website — avoids fetching the same page twice.
      // Falls back to a fresh crawl (then a search) when the website changed
      // (e.g. resolved after-the-fact) or the original crawl came back empty.
      const canReuseHomepage = !!crawledHomepageText && website === (company.website || '').trim()
      let socials = await fetchSocials(website, company.name, canReuseHomepage ? crawledHomepageText : undefined)
      if (!socials.twitter_url && !socials.telegram_url && !socials.discord_url) {
        const searchSocials = await fetchSocialsFromSearch(company.name)
        socials = { ...searchSocials, ...Object.fromEntries(Object.entries(socials).filter(([, v]) => v)) }
      }

      // Insert lead
      const { data: newLead, error: leadErr } = await supabase
        .from('leads')
        .insert({
          company_name: company.name,
          website: website || null,
          source_id: source.id,
          twitter_url: socials.twitter_url || null,
          telegram_url: socials.telegram_url || null,
          discord_url: socials.discord_url || null,
          description: company.description,
          industry_category: research.industry_category,
          customer_category: research.customer_category,
          product_to_sell: research.product_to_sell,
          region: research.region,
          business_model: research.business_model,
          product_summary: research.company_summary,
          supported_chains_or_rails: research.supported_chains_or_rails,
          current_providers: research.current_providers,
          pain_point: research.pain_point,
          pain_point_severity: research.pain_point_severity,
          pain_point_evidence: research.pain_point_evidence,
          pain_point_source_url: research.pain_point_source_url || null,
          pain_point_evidence_type: research.pain_point_evidence_type || 'agent_analysis',
          potential_gap: research.potential_gap || null,
          kima_fit: research.kima_fit,
          aeredium_fit: research.aeredium_fit,
          aerpolice_fit: research.aerpolice_fit || null,
          aerseal_fit: research.aerseal_fit || null,
          suggested_use_case: research.suggested_use_case,
          outreach_angle: research.outreach_angle || null,
          trigger_reason: research.trigger_reason,
          trigger_date: research.trigger_date || null,
          trigger_source_url: (research.trigger_source_url as string) || (research.source_url as string) || null,
          settlement_angle: research.settlement_angle,
          integration_feasibility: research.integration_feasibility,
          revenue_potential: research.revenue_potential,
          classification: research.classification || 'unclear',
          financial_activity: research.financial_activity || null,
          agent_activity: research.agent_activity || null,
          facts: research.facts || [],
          assumptions: research.assumptions || [],
          unknowns: research.unknowns || [],
          lead_score: research.lead_score,
          urgency_score: research.urgency_score ?? null,
          urgency_reasoning: research.urgency_reasoning ?? null,
          confidence_score: confidenceScore,
          priority: research.priority,
          source_url: pickBestUrl([
            company.source_url,            // exact link copied from the source page (most reliable)
            research.source_url as string, // AI-found specific URL
            source.source_url_or_query,    // the discovery source (may be a homepage/query)
            company.website,
          ]) || source.source_url_or_query,
          status: 'new',
        })
        .select('id')
        .single()

      if (!leadErr && newLead) {
        // Contact strategy (quality-first, three-tier):
        //
        // Tier 1 — Apollo people search by domain + seniority (real people, real titles,
        //          verified emails). Best quality; works even when we don't know names.
        // Tier 2 — Apollo person-match on AI-suggested names (enriches known names with
        //          verified email + LinkedIn).
        // Tier 3 — AI-guessed contacts (LinkedIn search URL + email pattern). Fallback only.
        const { apolloSearchPeople } = await import('@/lib/apollo')
        const domain = toDomain(website)
        const aiContacts = (research.contacts as Record<string, string>[]) || []

        // BD-relevant seniority signals to filter Apollo results
        const BD_ROLES = ['partnerships', 'business development', 'bd ', 'growth', 'cto', 'coo', 'chief technology', 'chief operating', 'vp eng', 'head of eng', 'founder', 'co-founder', 'ceo', 'chief executive']

        let contactsSaved = 0
        let reachableContactsSaved = 0 // only real channels — see isReachableContact()

        // Tier 1: Apollo people search
        if (domain && contactsSaved === 0) {
          const apolloPeople = await apolloSearchPeople(company.name, domain)
          const bdPeople = apolloPeople
            .filter(p => BD_ROLES.some(r => p.title?.toLowerCase().includes(r)))
            .slice(0, 3)
          const toInsert = bdPeople.length > 0 ? bdPeople : apolloPeople.slice(0, 2)
          for (const c of toInsert) {
            const contactRow = {
              name: c.name,
              linkedin_url: c.linkedin_url || null,
              email: c.email || null,
            }
            const { error: ce } = await supabase.from('contacts').insert({
              lead_id: newLead.id,
              ...contactRow,
              role: c.title || 'Decision maker',
              company: company.name,
              contact_confidence: c.email ? 'high' : 'medium',
              reason_this_person: `Found via Apollo people search${c.seniority ? ` · ${c.seniority}` : ''}${c.title ? ` · ${c.title}` : ''}`,
            })
            if (!ce) {
              contactsSaved++
              if (isReachableContact(contactRow)) reachableContactsSaved++
            }
          }
        }

        // Tier 2: Enrich AI-named contacts via Apollo (adds email + LinkedIn to known names)
        if (contactsSaved === 0 && domain) {
          const namedAiContacts = aiContacts.filter(c => c.name && !/^null$/i.test(String(c.name)))
          const apolloEnriched = namedAiContacts.length > 0
            ? await apolloEnrichContacts(domain, company.name, namedAiContacts.map(c => ({ name: c.name, role: c.role })))
            : []
          for (const c of apolloEnriched.slice(0, 3)) {
            const contactRow = {
              name: c.name,
              linkedin_url: c.linkedin_url || null,
              email: c.email || null,
            }
            const { error: ce } = await supabase.from('contacts').insert({
              lead_id: newLead.id,
              ...contactRow,
              role: c.title || 'Decision maker',
              company: company.name,
              contact_confidence: c.email ? 'high' : 'medium',
              reason_this_person: `Verified via Apollo name-match${c.seniority ? ` · ${c.seniority}` : ''}`,
            })
            if (!ce) {
              contactsSaved++
              if (isReachableContact(contactRow)) reachableContactsSaved++
            }
          }
        }

        // Tier 3: AI-suggested contacts (LinkedIn search URL + guessed email pattern).
        // These rarely count as reachable on their own — a search-results URL isn't
        // a profile and email_pattern is a guess, not a verified inbox (see
        // isRealEmail) — but they're still saved as a starting point for manual
        // research, they just won't rescue a lead from the reachability gate below.
        if (contactsSaved === 0) {
          for (const contact of aiContacts.slice(0, 3)) {
            const linkedinUrl = contact.linkedin_hint
              ? `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(contact.linkedin_hint)}`
              : null
            const twitterUrl = contact.twitter_hint
              ? contact.twitter_hint.startsWith('http')
                ? contact.twitter_hint
                : `https://x.com/search?q=${encodeURIComponent(contact.twitter_hint)}`
              : null
            const contactRow = {
              name: contact.name || null,
              linkedin_url: linkedinUrl,
              twitter_url: twitterUrl,
              email: contact.email_pattern || null,
            }
            const { error: ce } = await supabase.from('contacts').insert({
              lead_id: newLead.id,
              ...contactRow,
              role: contact.role,
              company: company.name,
              contact_confidence: contact.contact_confidence || 'low',
              reason_this_person: contact.why_this_person,
            })
            if (!ce) {
              contactsSaved++
              if (isReachableContact(contactRow)) reachableContactsSaved++
            }
          }
        }

        // Reachability gate — a lead nobody can actually be messaged through
        // is dead weight regardless of how good its pain point is (see
        // lead_prioritization_philosophy: reachability beats perfect fit).
        // Roll back the insert rather than leaving an unreachable lead sitting
        // in the pipeline looking equally qualified as a reachable one.
        if (reachableContactsSaved === 0) {
          await supabase.from('contacts').delete().eq('lead_id', newLead.id)
          await supabase.from('leads').delete().eq('id', newLead.id)
          results.skipped_no_contact++
          return
        }

        // Update in-memory counts
        categories.forEach(cat => {
          if (categoryCounts[cat] !== undefined) categoryCounts[cat]++
        })
        existingNames.add(nameKey)
        if (nameSlugKey) existingNameSlugs.add(nameSlugKey)
        if (domainKey) existingDomains.add(domainKey)

        results.saved++
        results.leads_saved.push(company.name)
      }
    }

    // Drive processCompany() in small concurrent batches rather than one
    // company at a time. The dedup check (name/slug/domain) has to happen
    // synchronously for the whole batch BEFORE any of them start their async
    // work — otherwise two same-named candidates in one batch could both slip
    // past the check and both get researched/saved. categoryCounts is still
    // only updated after a company is actually saved (same as before), so two
    // companies in the same batch landing in the same near-full category can
    // in rare cases both get saved and push slightly past CATEGORY_CAP —
    // acceptable given the small batch size, versus the alternative of fully
    // serializing again.
    const CONCURRENCY = 3
    for (let i = 0; i < realCompanies.length; i += CONCURRENCY) {
      const batch: Array<{ company: (typeof realCompanies)[number]; nameKey: string; nameSlugKey: string; domainKey: string }> = []
      for (const company of realCompanies.slice(i, i + CONCURRENCY)) {
        const nameKey = (company.name || '').toLowerCase().trim()
        const nameSlugKey = nameSlug(company.name || '')
        const domainKey = toDomain(company.website || '')
        // Skip duplicates — check name, name slug, and domain (most reliable).
        // These are the ONLY skips that happen before deepResearch() runs, so
        // they're the only ones that don't cost an AI call.
        if (existingNames.has(nameKey)) { results.skipped_duplicate++; continue }
        if (nameSlugKey && existingNameSlugs.has(nameSlugKey)) { results.skipped_duplicate++; continue }
        if (domainKey && existingDomains.has(domainKey)) { results.skipped_duplicate++; continue }
        batch.push({ company, nameKey, nameSlugKey, domainKey })
      }
      if (batch.length === 0) continue
      await Promise.all(batch.map(b => processCompany(b.company, b.nameKey, b.nameSlugKey, b.domainKey)))
    }

    // 7. Update source last_run_at, cumulative leads_generated, and cumulative
    // companies_evaluated/total_runs — the yield denominator (see
    // supabase/add-source-yield-tracking.sql) that lets the Sources page show
    // which sources burn AI research calls without producing leads.
    await supabase
      .from('sources')
      .update({
        last_run_at: new Date().toISOString(),
        leads_generated: (source.leads_generated || 0) + results.saved,
        companies_evaluated: (source.companies_evaluated || 0) + results.researched,
        total_runs: (source.total_runs || 0) + 1,
      })
      .eq('id', source_id)

    return NextResponse.json({ success: true, ...results })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Discovery pipeline failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
