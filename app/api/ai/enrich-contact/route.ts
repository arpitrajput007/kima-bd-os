// One-click contact enrichment: given a name + role, search Exa to find
// their Twitter, LinkedIn, GitHub, and email.
import { NextRequest, NextResponse } from 'next/server'
import { exaConfigured } from '@/lib/exa'
import Exa from 'exa-js'

export async function POST(req: NextRequest) {
  const { name, role } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (!exaConfigured()) return NextResponse.json({ error: 'Exa not configured' }, { status: 400 })

  const exa = new Exa(process.env.EXA_API_KEY!)
  const result: {
    twitter_url?: string; linkedin_url?: string
    github_url?: string; email?: string
  } = {}

  await Promise.all([
    // Twitter/X search
    (async () => {
      try {
        const res = await exa.search(`${name} ${role || ''} crypto DeFi`, {
          type: 'auto', numResults: 3,
          includeDomains: ['twitter.com', 'x.com'],
          contents: { highlights: { numSentences: 1, highlightsPerUrl: 1 } as unknown as true },
        } as Parameters<typeof exa.search>[1])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const r of (res.results || []) as any[]) {
          const handle = (r.url as string)?.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]+)/)?.[1]
          if (handle && !['search','home','explore','i'].includes(handle.toLowerCase())) {
            // Check title matches the person name
            const title = (r.title as string || '').toLowerCase()
            const nameParts = name.toLowerCase().split(' ')
            if (nameParts.some((p: string) => title.includes(p))) {
              result.twitter_url = `https://x.com/${handle}`
              break
            }
          }
        }
      } catch { /* noop */ }
    })(),

    // LinkedIn search
    (async () => {
      try {
        const res = await exa.search(`${name} ${role || ''} blockchain`, {
          type: 'auto', numResults: 3,
          includeDomains: ['linkedin.com'],
          contents: { highlights: { numSentences: 1, highlightsPerUrl: 1 } as unknown as true },
        } as Parameters<typeof exa.search>[1])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const r of (res.results || []) as any[]) {
          const url = r.url as string
          if (url?.includes('/in/') && !url.includes('/search/')) {
            result.linkedin_url = url.split('?')[0]
            break
          }
        }
      } catch { /* noop */ }
    })(),

    // GitHub search
    (async () => {
      try {
        const res = await exa.search(`${name} developer blockchain open source`, {
          type: 'auto', numResults: 3,
          includeDomains: ['github.com'],
          contents: { highlights: { numSentences: 1, highlightsPerUrl: 1 } as unknown as true },
        } as Parameters<typeof exa.search>[1])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const r of (res.results || []) as any[]) {
          const url = r.url as string
          // Only user profile pages (not repos or orgs)
          const match = url?.match(/github\.com\/([A-Za-z0-9_-]+)$/)
          if (match) {
            // Verify via GitHub API
            const profile = await fetch(`https://api.github.com/users/${match[1]}`, {
              headers: { Accept: 'application/vnd.github.v3+json' },
              signal: AbortSignal.timeout(5000)
            }).then(r => r.json()).catch(() => null)
            if (profile?.name) {
              result.github_url = url
              // Bonus: grab Twitter from GitHub profile
              if (!result.twitter_url && profile.twitter_username) {
                result.twitter_url = `https://x.com/${profile.twitter_username}`
              }
              break
            }
          }
        }
      } catch { /* noop */ }
    })(),
  ])

  return NextResponse.json(result)
}
