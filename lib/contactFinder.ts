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

// ── GitHub: scrape org members ────────────────────────────
async function fromGitHub(companyName: string, website: string): Promise<FoundContact[]> {
  try {
    // Guess GitHub org from company name or website
    const orgGuess = companyName.toLowerCase()
      .replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    const orgsToTry = [
      orgGuess,
      website?.replace(/^https?:\/\//, '').split('.')[0].replace(/[^a-z0-9-]/g, '-'),
    ].filter(Boolean)

    for (const org of orgsToTry) {
      const res = await fetch(`https://api.github.com/orgs/${org}/members?per_page=10`, {
        headers: { Accept: 'application/vnd.github.v3+json' },
        signal: AbortSignal.timeout(6000),
      })
      if (!res.ok) continue
      const members = await res.json()
      if (!Array.isArray(members) || !members.length) continue

      const contacts: FoundContact[] = []
      for (const m of members.slice(0, 6)) {
        // Fetch profile for real name + bio
        const profileRes = await fetch(`https://api.github.com/users/${m.login}`, {
          headers: { Accept: 'application/vnd.github.v3+json' },
          signal: AbortSignal.timeout(4000),
        })
        if (!profileRes.ok) continue
        const profile = await profileRes.json()
        contacts.push({
          name: profile.name || profile.login,
          role: profile.bio?.slice(0, 60) || 'Engineering / Tech',
          github_url: profile.html_url,
          twitter_url: profile.twitter_username ? `https://x.com/${profile.twitter_username}` : undefined,
          source: 'github',
          confidence: 'medium',
          why_contact: `GitHub org member — ${profile.bio?.slice(0, 80) || profile.company || 'core team'}`,
          raw_snippet: profile.bio,
        })
      }
      if (contacts.length) return contacts
    }
    return []
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
const BD_ROLES = [
  'Head of Partnerships', 'Business Development', 'CEO', 'Founder',
  'CTO', 'Head of Growth', 'VP Business Development', 'Co-founder'
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

  // Filter out "Unknown" names if we have real ones
  const named = deduped.filter(c => c.name && c.name !== 'Unknown' && c.name.length > 2)
  return named.length ? named.slice(0, 8) : deduped.slice(0, 5)
}
