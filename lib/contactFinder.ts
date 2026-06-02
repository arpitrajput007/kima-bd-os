// ============================================================
// Multi-source contact finder for BD outreach.
// For every person found, we auto-enrich with Twitter + LinkedIn
// via Exa so you always get clickable outreach links.
// ============================================================

import { exaConfigured } from './exa'
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

// ── Exa helpers ──────────────────────────────────────────────

async function exaSearch(query: string, domains: string[], numResults = 5) {
  if (!exaConfigured()) return []
  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.EXA_API_KEY! },
    body: JSON.stringify({
      query, type: 'auto', numResults,
      includeDomains: domains,
      contents: { highlights: { numSentences: 2, highlightsPerUrl: 1 } },
    }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.results || []) as Array<{ url: string; title: string; highlights?: string[] }>
}

// Given a real person's name, find their Twitter + LinkedIn via Exa
async function enrichPersonSocials(name: string, companyName: string): Promise<{
  twitter_url?: string; linkedin_url?: string
}> {
  const result: { twitter_url?: string; linkedin_url?: string } = {}
  await Promise.all([
    // Twitter search
    (async () => {
      try {
        const hits = await exaSearch(`${name} ${companyName} crypto blockchain`, ['twitter.com', 'x.com'], 3)
        for (const h of hits) {
          const handle = h.url?.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]+)/)?.[1]
          if (!handle || ['search', 'home', 'explore', 'i', 'intent'].includes(handle.toLowerCase())) continue
          // Name check: at least one part of name appears in title
          const titleLower = (h.title || '').toLowerCase()
          const nameParts = name.toLowerCase().split(' ')
          if (nameParts.some(p => p.length > 2 && titleLower.includes(p))) {
            result.twitter_url = `https://x.com/${handle}`
            break
          }
        }
      } catch { /* noop */ }
    })(),
    // LinkedIn search
    (async () => {
      try {
        const hits = await exaSearch(`${name} ${companyName}`, ['linkedin.com'], 3)
        for (const h of hits) {
          if (h.url?.includes('/in/') && !h.url.includes('/search/')) {
            result.linkedin_url = h.url.split('?')[0]
            break
          }
        }
      } catch { /* noop */ }
    })(),
  ])
  return result
}

// ── Apollo: verified emails + real names ─────────────────────
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

// ── Exa LinkedIn: find real profiles by role + company ───────
async function fromExaLinkedIn(companyName: string, roles: string[]): Promise<FoundContact[]> {
  const results: FoundContact[] = []
  for (const role of roles.slice(0, 4)) {
    try {
      const hits = await exaSearch(`${role} at ${companyName} blockchain crypto`, ['linkedin.com'], 3)
      for (const h of hits) {
        if (!h.url?.includes('/in/') || h.url.includes('/search/')) continue
        const name = h.title?.replace(/[|(].*$/, '').replace(/\s*-\s*LinkedIn.*$/i, '').trim() || ''
        if (!name || name.length < 3) continue
        results.push({
          name,
          role,
          linkedin_url: h.url.split('?')[0],
          source: 'exa_linkedin',
          confidence: 'medium',
          why_contact: (Array.isArray(h.highlights) ? h.highlights.join(' ') : '').slice(0, 120) || `Found on LinkedIn`,
        })
      }
    } catch { /* noop */ }
  }
  return results
}

// ── Exa Twitter: DeFi founders active on Twitter ─────────────
async function fromExaTwitter(companyName: string): Promise<FoundContact[]> {
  try {
    const hits = await exaSearch(
      `${companyName} founder CEO head of partnerships DeFi blockchain`,
      ['twitter.com', 'x.com'], 5
    )
    return hits.flatMap(h => {
      const handle = h.url?.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]+)/)?.[1]
      if (!handle || ['search', 'home', 'explore', 'i'].includes(handle.toLowerCase())) return []
      const name = h.title?.replace(/[|((@].*$/, '').trim() || handle
      if (!name || name.length < 2) return []
      return [{
        name,
        role: 'Founder / Leadership',
        twitter_url: `https://x.com/${handle}`,
        source: 'exa_twitter' as const,
        confidence: 'medium' as const,
        why_contact: (Array.isArray(h.highlights) ? h.highlights.join(' ') : '').slice(0, 120),
      }]
    })
  } catch { return [] }
}

// ── GitHub: find org via Exa, get members, auto-enrich each ──
async function fromGitHub(companyName: string, website: string): Promise<FoundContact[]> {
  try {
    let orgsToTry: string[] = []

    // 1. Exa finds the real org (catches polytope-labs for Hyperbridge etc.)
    if (exaConfigured()) {
      try {
        const hits = await exaSearch(
          `${companyName} GitHub organization repository`,
          ['github.com'], 8
        )
        const exaOrgs = hits
          .map(h => h.url?.match(/github\.com\/([A-Za-z0-9_-]+)/)?.[1])
          .filter((o): o is string =>
            !!o && !['topics', 'orgs', 'sponsors', 'features', 'about', 'marketplace', 'search'].includes(o)
          )
        orgsToTry.push(...[...new Set(exaOrgs)])
      } catch { /* fall through */ }
    }

    // 2. Fallback name/domain guesses
    const nameGuess = companyName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    const domainGuess = website?.replace(/^https?:\/\//, '').split('.')[0].replace(/[^a-z0-9-]/g, '-')
    orgsToTry.push(nameGuess, domainGuess, `${nameGuess}-labs`, `${nameGuess}-network`, `${nameGuess}-protocol`)
    orgsToTry = [...new Set(orgsToTry.filter(Boolean))]

    // 3. Collect members from ALL valid orgs
    const allProfiles: Array<{
      name: string; bio?: string; html_url: string
      twitter_username?: string; company?: string; org: string; login: string
    }> = []

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
              return p?.name ? { ...p, org, login: m.login } : null
            } catch { return null }
          })
        )
        allProfiles.push(...profiles.filter(Boolean))
      } catch { /* one org failing is fine */ }
    }))

    if (!allProfiles.length) return []

    // 4. Score: founders/leadership first, pure devs last
    const LEADER_RE = /founder|ceo|cto|co-founder|chief|head|lead|director|partner|president/i
    const scored = allProfiles
      .filter(p => p.name)
      .map(p => ({ profile: p, score: LEADER_RE.test(p.bio || '') ? 2 : p.twitter_username ? 1 : 0 }))
      .sort((a, b) => b.score - a.score)

    // 5. For each top person — auto-enrich with Twitter + LinkedIn via Exa
    const topProfiles = scored.slice(0, 5)
    const enriched = await Promise.all(topProfiles.map(async ({ profile: p }) => {
      // If GitHub already gave us Twitter, skip Exa
      const twitterFromGitHub = p.twitter_username ? `https://x.com/${p.twitter_username}` : undefined
      let socials: { twitter_url?: string; linkedin_url?: string } = {}
      if (!twitterFromGitHub) {
        socials = await enrichPersonSocials(p.name, companyName)
      }
      return {
        name: p.name,
        role: p.bio?.slice(0, 80) || 'Core Team',
        github_url: p.html_url,
        twitter_url: twitterFromGitHub || socials.twitter_url,
        linkedin_url: socials.linkedin_url,
        source: 'github' as const,
        confidence: 'medium' as const,
        why_contact: `GitHub org member (${p.org}) — ${p.bio?.slice(0, 80) || p.company || 'core team'}`,
        raw_snippet: p.bio,
      } as FoundContact
    }))

    return enriched
  } catch { return [] }
}

// ── Hunter.io: email database ─────────────────────────────────
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.data.emails.filter((e: any) => e.confidence >= 70).map((e: any) => ({
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

// ── Deduplicate ───────────────────────────────────────────────
function dedup(contacts: FoundContact[]): FoundContact[] {
  const seen = new Set<string>()
  const out: FoundContact[] = []
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

// ── Main entry point ──────────────────────────────────────────
const BD_ROLES = ['Founder', 'Co-founder', 'CEO', 'Head of Partnerships', 'Head of Business Development', 'CTO']

export async function findContacts(companyName: string, website: string): Promise<FoundContact[]> {
  const domain = website.replace(/^https?:\/\//, '').split('/')[0]

  const [apollo, exaLinkedIn, exaTwitter, github, hunter] = await Promise.all([
    fromApollo(companyName, domain),
    fromExaLinkedIn(companyName, BD_ROLES),
    fromExaTwitter(companyName),
    fromGitHub(companyName, website),
    fromHunter(website),
  ])

  const all = [...apollo, ...exaLinkedIn, ...exaTwitter, ...github, ...hunter]
  const deduped = dedup(all)

  // Leaders first, devs last
  const LEADER_RE = /founder|ceo|cto|co-founder|chief|head|lead|director|partner|bd|business.dev/i
  const named = deduped.filter(c => c.name && c.name !== 'Unknown' && c.name.length > 2)
  named.sort((a, b) => (LEADER_RE.test(b.role || '') ? 1 : 0) - (LEADER_RE.test(a.role || '') ? 1 : 0))

  return named.slice(0, 6)
}
