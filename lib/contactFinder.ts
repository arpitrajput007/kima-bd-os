// ============================================================
// Multi-source contact finder for BD outreach.
// Priority stack:
//   1. Apollo.io people search — verified emails + real names (best)
//   2. Exa people search       — finds LinkedIn profiles by role+company
//   3. Exa Twitter search      — DeFi founders active on Twitter
//   4. GitHub org members      — real names for technical contacts
//   5. Hunter.io domain search — email pattern database
// All sources run in parallel, then deduplicated and ranked.
// ============================================================

import { exaConfigured, exaFindPeople } from './exa'
import { apolloConfigured, apolloSearchPeople } from './apollo'

export interface FoundContact {
  name: string
  role: string
  email?: string
  linkedin_url?: string
  twitter_url?: string
  github_url?: string
  source: 'apollo' | 'exa_linkedin' | 'exa_twitter' | 'github' | 'hunter' | 'ai'
  confidence: 'high' | 'medium' | 'low'
  why_contact: string
  raw_snippet?: string
}

// ── Apollo: search people by company domain ───────────────
async function fromApollo(companyName: string, domain: string): Promise<FoundContact[]> {
  if (!apolloConfigured()) return []
  try {
    const results = await apolloSearchPeople(companyName, domain)
    return results.map(p => ({
      name: p.name,
      role: p.title || '',
      email: p.email || undefined,
      linkedin_url: p.linkedin_url || undefined,
      source: 'apollo' as const,
      confidence: p.email ? 'high' : 'medium',
      why_contact: `${p.title || 'Team member'} at ${companyName} — verified via Apollo`,
    }))
  } catch { return [] }
}

// ── Exa: find LinkedIn profiles by role ──────────────────
async function fromExaLinkedIn(companyName: string, roles: string[]): Promise<FoundContact[]> {
  if (!exaConfigured()) return []
  const results: FoundContact[] = []
  for (const role of roles.slice(0, 3)) {
    const found = await exaFindPeople(`${role} at ${companyName}`, 3)
    for (const p of found) {
      if (!p.name || p.name.length < 3) continue
      results.push({
        name: p.name,
        role,
        linkedin_url: p.url?.includes('linkedin') ? p.url : undefined,
        source: 'exa_linkedin',
        confidence: 'medium',
        why_contact: p.highlights?.slice(0, 120) || `Found via LinkedIn search`,
        raw_snippet: p.highlights,
      })
    }
  }
  return results
}

// ── Exa: search Twitter/X for founders ───────────────────
async function fromExaTwitter(companyName: string): Promise<FoundContact[]> {
  if (!exaConfigured()) return []
  try {
    const { default: Exa } = await import('exa-js')
    const exa = new Exa(process.env.EXA_API_KEY!)
    const res = await exa.search(
      `${companyName} founder CEO head of partnerships DeFi`,
      {
        type: 'auto', numResults: 5,
        includeDomains: ['twitter.com', 'x.com'],
        contents: { highlights: { numSentences: 2, highlightsPerUrl: 1 } as unknown as true },
      } as Parameters<typeof exa.search>[1]
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (res.results || [] as any[]).map((r: any) => {
      const handle = r.url?.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]+)/)?.[1]
      if (!handle || ['search','home','explore'].includes(handle.toLowerCase())) return null
      return {
        name: r.title?.replace(/[|(].*$/,'').trim() || handle,
        role: 'Founder / Leadership',
        twitter_url: `https://x.com/${handle}`,
        source: 'exa_twitter' as const,
        confidence: 'medium' as const,
        why_contact: `Active on Twitter — ${(Array.isArray(r.highlights) ? r.highlights.join(' ') : r.text||'').slice(0,100)}`,
        raw_snippet: Array.isArray(r.highlights) ? r.highlights.join(' ') : '',
      }
    }).filter(Boolean) as FoundContact[]
  } catch { return [] }
}

// ── GitHub: find real orgs via Exa, scrape ALL, pick best ─
async function fromGitHub(companyName: string, website: string): Promise<FoundContact[]> {
  try {
    let orgsToTry: string[] = []

    // Step 1: Exa finds real GitHub orgs (catches parent-company cases like
    // Hyperbridge → polytope-labs that name-guessing would miss)
    if (exaConfigured()) {
      try {
        const { default: Exa } = await import('exa-js')
        const exa = new Exa(process.env.EXA_API_KEY!)
        const exaRes = await exa.search(
          `${companyName} GitHub organization repository source code`,
          {
            type: 'auto', numResults: 8,
            includeDomains: ['github.com'],
            contents: { text: { maxCharacters: 300 } as unknown as true },
          } as Parameters<typeof exa.search>[1]
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const exaOrgs = (exaRes.results || [] as any[])
          .map((r: any) => (r.url as string)?.match(/github\.com\/([A-Za-z0-9_-]+)/)?.[1])
          .filter((o: string | undefined): o is string =>
            !!o && !['topics','orgs','sponsors','features','about','marketplace','search'].includes(o)
          )
        orgsToTry.push(...[...new Set(exaOrgs)])
      } catch { /* fall through */ }
    }

    // Step 2: Name/domain fallback guesses
    const nameGuess = companyName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    const domainGuess = website?.replace(/^https?:\/\//, '').split('.')[0].replace(/[^a-z0-9-]/g, '-')
    orgsToTry.push(nameGuess, domainGuess, `${nameGuess}-labs`, `${nameGuess}-network`, `${nameGuess}-protocol`)
    orgsToTry = [...new Set(orgsToTry.filter(Boolean))]

    // Step 3: Fetch members from ALL valid orgs, collect everyone
    const allProfiles: Array<{ name: string; bio?: string; html_url: string; twitter_username?: string; company?: string; org: string }> = []

    await Promise.all(orgsToTry.slice(0, 6).map(async org => {
      try {
        const res = await fetch(`https://api.github.com/orgs/${org}/members?per_page=20`, {
          headers: { Accept: 'application/vnd.github.v3+json' },
          signal: AbortSignal.timeout(6000),
        })
        if (!res.ok) return
        const members = await res.json()
        if (!Array.isArray(members)) return

        const profiles = await Promise.all(
          members.slice(0, 15).map(async (m: { login: string }) => {
            try {
              const r = await fetch(`https://api.github.com/users/${m.login}`, {
                headers: { Accept: 'application/vnd.github.v3+json' },
                signal: AbortSignal.timeout(4000),
              })
              const p = r.ok ? await r.json() : null
              return p?.name ? { ...p, org } : null
            } catch { return null }
          })
        )
        allProfiles.push(...profiles.filter(Boolean))
      } catch { /* one org failing is fine */ }
    }))

    if (!allProfiles.length) return []

    // Step 4: Score each profile — founders/leadership first, pure devs last
    const LEADER_KEYWORDS = /founder|ceo|cto|co-founder|chief|head|lead|director|partner|president/i
    const scored = allProfiles
      .filter(p => p.name)
      .map(p => ({
        profile: p,
        score: LEADER_KEYWORDS.test(p.bio || '') ? 2 : p.twitter_username ? 1 : 0,
      }))
      .sort((a, b) => b.score - a.score)

    return scored.slice(0, 6).map(({ profile: p }) => ({
      name: p.name,
      role: p.bio?.slice(0, 80) || 'Core Team',
      github_url: p.html_url,
      twitter_url: p.twitter_username ? `https://x.com/${p.twitter_username}` : undefined,
      source: 'github' as const,
      confidence: 'medium' as const,
      why_contact: `GitHub org member (${p.org}) — ${p.bio?.slice(0, 80) || p.company || 'core team'}`,
      raw_snippet: p.bio,
    }))
  } catch { return [] }
}

// ── Hunter.io: email database ─────────────────────────────
async function fromHunter(website: string): Promise<FoundContact[]> {
  if (!process.env.HUNTER_API_KEY || !website) return []
  try {
    const domain = website.replace(/^https?:\/\//, '').split('/')[0]
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${process.env.HUNTER_API_KEY}&limit=10`,
      { signal: AbortSignal.timeout(8000) }
    )
    const data = await res.json()
    if (!data?.data?.emails?.length) return []
    return data.data.emails
      .filter((e: { confidence: number }) => e.confidence >= 70)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((e: any) => ({
        name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Unknown',
        role: e.position || e.department || 'Team member',
        email: e.value,
        linkedin_url: e.linkedin || undefined,
        source: 'hunter' as const,
        confidence: e.confidence >= 90 ? 'high' : 'medium',
        why_contact: `Found in Hunter.io database (${e.confidence}% confidence)`,
      }))
  } catch { return [] }
}

// ── Deduplicate: prefer named + high-confidence contacts ──
function dedup(contacts: FoundContact[]): FoundContact[] {
  const seen = new Set<string>()
  const out: FoundContact[] = []
  // Sort: high confidence first, then apollo, then github, then exa
  const order = ['apollo', 'hunter', 'github', 'exa_linkedin', 'exa_twitter', 'ai']
  contacts.sort((a, b) => {
    const confScore = { high: 2, medium: 1, low: 0 }
    if (confScore[b.confidence] !== confScore[a.confidence]) return confScore[b.confidence] - confScore[a.confidence]
    return order.indexOf(a.source) - order.indexOf(b.source)
  })
  for (const c of contacts) {
    const key = (c.name || '').toLowerCase().replace(/\s+/g, '')
    const emailKey = c.email?.toLowerCase() || ''
    if (key.length > 1 && !seen.has(key) && !seen.has(emailKey)) {
      seen.add(key)
      if (emailKey) seen.add(emailKey)
      out.push(c)
    }
  }
  return out
}

// ── Main entry point ──────────────────────────────────────
// BD-relevant roles to search for — prioritize founders + partnerships
const BD_ROLES = [
  'Founder', 'Co-founder', 'CEO', 'Head of Partnerships',
  'Head of Business Development', 'CTO', 'Head of Growth',
]

export async function findContacts(
  companyName: string,
  website: string,
): Promise<FoundContact[]> {
  const domain = website.replace(/^https?:\/\//, '').split('/')[0]

  // Run all sources in parallel
  const [apollo, exaLinkedIn, exaTwitter, github, hunter] = await Promise.all([
    fromApollo(companyName, domain),
    fromExaLinkedIn(companyName, BD_ROLES),
    fromExaTwitter(companyName),
    fromGitHub(companyName, website),
    fromHunter(website),
  ])

  const all = [...apollo, ...exaLinkedIn, ...exaTwitter, ...github, ...hunter]
  const deduped = dedup(all)

  // Filter unnamed, then sort: leadership first (founder/CEO/CTO), devs last
  const LEADER_RE = /founder|ceo|cto|co-founder|chief|head|lead|director|partner|bd|business.dev|partner/i
  const named = deduped.filter(c => c.name && c.name !== 'Unknown' && c.name.length > 2)
  named.sort((a, b) => {
    const aIsLeader = LEADER_RE.test(a.role || '')
    const bIsLeader = LEADER_RE.test(b.role || '')
    if (aIsLeader && !bIsLeader) return -1
    if (!aIsLeader && bIsLeader) return 1
    return 0
  })

  return named.slice(0, 6)
}
