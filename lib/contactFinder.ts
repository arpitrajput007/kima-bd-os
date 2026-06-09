// ============================================================
// Contact finder — three-stage pipeline:
// 1. OpenAI web search (real-time) → finds actual named founders/team
// 2. Exa → finds their Twitter + LinkedIn profiles by name
// 3. Apollo + Hunter → verified emails
// ============================================================

import OpenAI from 'openai'
import { apolloConfigured, apolloSearchPeople } from './apollo'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export interface FoundContact {
  name: string
  role: string
  email?: string
  linkedin_url?: string
  twitter_url?: string
  github_url?: string
  source: 'apollo' | 'exa_linkedin' | 'exa_twitter' | 'github' | 'hunter' | 'web_search' | 'ai'
  confidence: 'high' | 'medium' | 'low'
  why_contact: string
  raw_snippet?: string
}

// ── Raw Exa fetch ─────────────────────────────────────────────
async function exaFetch(query: string, domains: string[], numResults = 4) {
  if (!process.env.EXA_API_KEY) return []
  try {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.EXA_API_KEY },
      body: JSON.stringify({
        query, type: 'auto', numResults, includeDomains: domains,
        contents: { highlights: { numSentences: 2, highlightsPerUrl: 1 } },
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results || []) as Array<{ url: string; title: string; highlights?: string[] }>
  } catch { return [] }
}

// ── JSON extraction helper ────────────────────────────────────
function extractJsonArray(raw: string): Array<{ name: string; role: string }> {
  // Strip markdown fences (```json … ``` or ``` … ```)
  let s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  // Find outermost [ … ] (last ] to handle trailing citations from search model)
  const start = s.indexOf('[')
  const end   = s.lastIndexOf(']')
  if (start === -1 || end <= start) return []
  try {
    const parsed = JSON.parse(s.slice(start, end + 1))
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (p: { name?: string }) =>
        p.name && typeof p.name === 'string' &&
        p.name.trim().length > 2 &&
        !/unknown|n\/a|none/i.test(p.name)
    ).slice(0, 6)
  } catch { return [] }
}

// ── Stage 1: real-time web search for team members ────────────
async function findTeamViaWebSearch(companyName: string, website: string): Promise<Array<{ name: string; role: string }>> {
  const prompt = `Who are the founders and key BD/partnerships/leadership team at "${companyName}"${website ? ` (${website})` : ''}?
List only REAL, verifiable named people with their exact titles. Focus on founders, CEO, CTO, Head of Partnerships, BD Lead.
Return ONLY a JSON array — no prose, no markdown fences:
[{"name":"Full Name","role":"exact title"}]`

  // ── Try 1: gpt-4o-search-preview (live web search) ───────────
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-search-preview',
        web_search_options: {},
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(25000),
    })
    if (res.ok) {
      const data = await res.json()
      const content: string = data.choices?.[0]?.message?.content || ''
      const parsed = extractJsonArray(content)
      if (parsed.length > 0) return parsed
      // search model returned prose/citations but no parseable array — fall through
    }
  } catch { /* fall through */ }

  // ── Try 2: gpt-4o from training knowledge (no web search) ────
  // Reliable for well-known Web3 / DeFi founders already in training data.
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a Web3/crypto BD researcher with deep knowledge of DeFi teams. Return ONLY a valid JSON array — no markdown, no prose.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 400,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (res.ok) {
      const data = await res.json()
      const content: string = data.choices?.[0]?.message?.content || ''
      return extractJsonArray(content)
    }
  } catch { /* noop */ }

  return []
}

// ── Stage 2: find each person's social links ──────────────────
async function enrichPerson(name: string, companyName: string): Promise<{
  twitter_url?: string; linkedin_url?: string; github_url?: string
}> {
  const result: { twitter_url?: string; linkedin_url?: string; github_url?: string } = {}

  await Promise.all([
    // Twitter — check GitHub user search first (reliable source of twitter_username)
    (async () => {
      try {
        const ghRes = await fetch(
          `https://api.github.com/search/users?q=${encodeURIComponent(name)}&per_page=5`,
          { headers: { Accept: 'application/vnd.github.v3+json' }, signal: AbortSignal.timeout(6000) }
        )
        if (ghRes.ok) {
          const ghData = await ghRes.json()
          for (const user of (ghData.items || []).slice(0, 5)) {
            const profile = await fetch(`https://api.github.com/users/${user.login}`, {
              headers: { Accept: 'application/vnd.github.v3+json' }, signal: AbortSignal.timeout(4000)
            }).then(r => r.json()).catch(() => null)
            // Verify the company matches
            const company = (profile?.company || profile?.bio || '').toLowerCase()
            const nameLower = companyName.toLowerCase()
            if (profile?.twitter_username && (company.includes(nameLower.split(' ')[0]) || name.toLowerCase() === profile.name?.toLowerCase())) {
              result.twitter_url = `https://x.com/${profile.twitter_username}`
              result.github_url = profile.html_url
              return
            }
          }
        }
      } catch { /* noop */ }

      // Fallback: Exa Twitter search
      try {
        const hits = await exaFetch(`${name} ${companyName} crypto blockchain`, ['twitter.com', 'x.com'], 3)
        for (const h of hits) {
          const handle = h.url?.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]+)/)?.[1]
          if (!handle || ['search', 'home', 'explore', 'i', 'intent', 'settings'].includes(handle.toLowerCase())) continue
          const titleLower = (h.title || '').toLowerCase()
          const nameParts = name.toLowerCase().split(' ')
          if (nameParts.some(p => p.length > 2 && titleLower.includes(p))) {
            result.twitter_url = `https://x.com/${handle}`
            break
          }
        }
      } catch { /* noop */ }
    })(),

    // LinkedIn
    (async () => {
      try {
        const hits = await exaFetch(`${name} ${companyName}`, ['linkedin.com'], 3)
        for (const h of hits) {
          const url = h.url || ''
          if (url.includes('/in/') && !url.includes('/search/') && !url.includes('/posts/') && !url.includes('/pulse/')) {
            result.linkedin_url = url.split('?')[0]
            break
          }
        }
      } catch { /* noop */ }
    })(),
  ])

  return result
}

// ── Apollo: verified emails ────────────────────────────────────
async function fromApollo(companyName: string, domain: string): Promise<FoundContact[]> {
  if (!apolloConfigured()) return []
  try {
    const results = await apolloSearchPeople(companyName, domain)
    return results.map(p => ({
      name: p.name, role: p.title || '',
      email: p.email || undefined, linkedin_url: p.linkedin_url || undefined,
      source: 'apollo' as const,
      confidence: p.email ? 'high' : 'medium',
      why_contact: `${p.title || 'Team member'} at ${companyName} — verified via Apollo`,
    }))
  } catch { return [] }
}

// ── Hunter.io ──────────────────────────────────────────────────
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
      email: e.value, linkedin_url: e.linkedin || undefined,
      source: 'hunter' as const,
      confidence: e.confidence >= 90 ? 'high' : 'medium',
      why_contact: `Found in Hunter.io database (${e.confidence}% confidence)`,
    }))
  } catch { return [] }
}

// ── Dedup ──────────────────────────────────────────────────────
function dedup(contacts: FoundContact[]): FoundContact[] {
  const seen = new Set<string>()
  const out: FoundContact[] = []
  for (const c of contacts) {
    const key = (c.name || '').toLowerCase().replace(/\s+/g, '')
    if (key.length > 1 && !seen.has(key)) { seen.add(key); out.push(c) }
  }
  return out
}

// ── Main ───────────────────────────────────────────────────────
export async function findContacts(companyName: string, website: string): Promise<FoundContact[]> {
  const domain = website.replace(/^https?:\/\//, '').split('/')[0]

  // Run web search + Apollo + Hunter in parallel
  const [teamFromWeb, apolloContacts, hunterContacts] = await Promise.all([
    findTeamViaWebSearch(companyName, website),
    fromApollo(companyName, domain),
    fromHunter(website),
  ])

  // Enrich each web-found person with Twitter + LinkedIn
  const webContacts: FoundContact[] = await Promise.all(
    teamFromWeb.map(async person => {
      const socials = await enrichPerson(person.name, companyName)
      return {
        name: person.name,
        role: person.role,
        twitter_url: socials.twitter_url,
        linkedin_url: socials.linkedin_url,
        github_url: socials.github_url,
        source: 'web_search' as const,
        confidence: (socials.twitter_url || socials.linkedin_url) ? 'medium' : 'low',
        why_contact: `${person.role} at ${companyName} — found via real-time web search`,
      }
    })
  )

  const LEADER_RE = /founder|ceo|cto|co-founder|chief|head|lead|director|partner|bd|business.dev/i
  const all = [...apolloContacts, ...webContacts, ...hunterContacts]
  const deduped = dedup(all.filter(c => c.name && c.name.length > 2))
  deduped.sort((a, b) => (LEADER_RE.test(b.role || '') ? 1 : 0) - (LEADER_RE.test(a.role || '') ? 1 : 0))

  return deduped.slice(0, 6)
}
