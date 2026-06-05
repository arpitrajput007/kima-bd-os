import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PRODUCT_BRAIN_COMPACT } from '@/lib/kima-knowledge'
import { exaConfigured, exaCompanyNews } from '@/lib/exa'
import { toDomain } from '@/lib/apollo'
import { extractSocials } from '@/lib/utils'
import Exa from 'exa-js'

// Scraping rekt.news + Exa + OpenAI extraction takes well over 10s.
// Without this the function is killed before saving any hacked-protocol leads.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const HACK_DAYS = 120 // look back window
const REKT_URLS = [
  'https://rekt.news',
  'https://rekt.news/leaderboard',
]

// ── Scrape rekt.news for recent hacks ────────────────────────
async function fetchRecentHacks(): Promise<string> {
  try {
    const results = await Promise.all(REKT_URLS.map(async url => {
      const res = await fetch(`https://r.jina.ai/${url}`, {
        headers: { Accept: 'text/plain' },
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) return ''
      return res.text()
    }))
    return results.join('\n\n').slice(0, 12000)
  } catch { return '' }
}

// Use Exa to search for recent bridge/protocol hacks (more comprehensive than just rekt.news)
async function exaHackSearch(): Promise<string> {
  if (!exaConfigured()) return ''
  try {
    const exa = new Exa(process.env.EXA_API_KEY!)
    const since = new Date(Date.now() - HACK_DAYS * 86400000).toISOString().split('T')[0]
    const res = await exa.search(
      'DeFi protocol bridge exploit hack theft vulnerability 2024 2025',
      {
        type: 'auto',
        numResults: 20,
        category: 'news',
        startPublishedDate: since,
        contents: { highlights: { numSentences: 4, highlightsPerUrl: 2 } as unknown as true },
      } as Parameters<typeof exa.search>[1]
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (res.results || [] as any[]).map((r: any) => {
      const text = Array.isArray(r.highlights) ? r.highlights.join(' ') : r.text || ''
      return `[${(r.publishedDate as string)?.split('T')[0] || 'recent'}] ${r.title}\nURL: ${r.url}\n${text.slice(0, 400)}`
    }).join('\n\n---\n\n')
  } catch { return '' }
}

// ── AI: extract structured hacks from raw content ──────────────
async function extractHacks(content: string): Promise<Array<{
  name: string; website: string; hack_date: string; amount_lost: string
  hack_type: string; description: string; source_url: string
}>> {
  try {
    const since = new Date(Date.now() - HACK_DAYS * 86400000).toISOString().split('T')[0]
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a DeFi security analyst extracting hacked protocol leads for Kima/Aeredium BD.
${PRODUCT_BRAIN_COMPACT}
Kima is positioned as a secure, TEE-backed settlement layer — the antidote to bridge exploits and cross-chain security failures.
Return ONLY valid JSON.`,
        },
        {
          role: 'user',
          content: `Extract hacked DeFi protocols from this content. Only include hacks that happened AFTER ${since}.
Focus on: bridge exploits, cross-chain hacks, payment rail vulnerabilities, settlement failures, custody breaches.
Skip: purely NFT/GameFi hacks with no payment/bridge angle, rug pulls, scams (not hacks).

Content:
${content}

Return JSON:
{
  "hacks": [
    {
      "name": "exact protocol/project name",
      "website": "their website URL (guess if not in content, e.g. https://xyz.finance)",
      "hack_date": "YYYY-MM-DD",
      "amount_lost": "e.g. $4.8M",
      "hack_type": "bridge exploit|oracle manipulation|smart contract|cross-chain|custody|other",
      "description": "2 sentence description of what happened and why Kima's architecture prevents this",
      "source_url": "the rekt.news or news article URL for this specific hack"
    }
  ]
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 2000,
    })
    const result = JSON.parse(completion.choices[0].message.content || '{"hacks":[]}')
    return Array.isArray(result.hacks) ? result.hacks : []
  } catch { return [] }
}

// ── Fetch socials from website ────────────────────────────────
async function fetchSocials(website: string, name: string) {
  if (!website) return {}
  try {
    const url = website.startsWith('http') ? website : `https://${website}`
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain' }, signal: AbortSignal.timeout(12000)
    })
    if (!res.ok) return {}
    return extractSocials(await res.text(), name)
  } catch { return {} }
}

// ── Main POST: run the hack monitor ──────────────────────────
export async function POST() {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key required' }, { status: 400 })
  }

  try {
    // Gather hack data from both rekt.news and Exa news search in parallel
    const [rektContent, exaContent] = await Promise.all([fetchRecentHacks(), exaHackSearch()])
    const combined = [rektContent, exaContent].filter(Boolean).join('\n\n===\n\n')

    if (!combined || combined.length < 100) {
      return NextResponse.json({ error: 'Could not fetch hack data' }, { status: 400 })
    }

    const hacks = await extractHacks(combined)
    if (!hacks.length) {
      return NextResponse.json({ found: 0, saved: 0, message: 'No qualifying hacks found in the lookback window' })
    }

    // Get existing leads to avoid duplicates
    const { data: existing } = await supabase.from('leads').select('company_name, website')
    const existingNames = new Set((existing || []).map((l: { company_name?: string }) => (l.company_name || '').toLowerCase()))
    const existingWebsites = new Set((existing || []).map((l: { website?: string }) => toDomain(l.website)))

    let saved = 0
    const savedNames: string[] = []

    for (const hack of hacks) {
      const nameKey = (hack.name || '').toLowerCase().trim()
      const domainKey = toDomain(hack.website)
      if (existingNames.has(nameKey) || (domainKey && existingWebsites.has(domainKey))) continue
      if (!hack.name || hack.name.length < 2) continue

      // Fetch socials + recent news in parallel
      const [socials, recentNews] = await Promise.all([
        fetchSocials(hack.website, hack.name),
        exaConfigured() ? exaCompanyNews(hack.name, HACK_DAYS) : Promise.resolve(''),
      ])

      const triggerReason = `${hack.name} was hacked on ${hack.hack_date} — ${hack.amount_lost} lost via ${hack.hack_type}. Kima's TEE-secured, non-custodial settlement layer eliminates the exact vulnerability class that caused this exploit. This is an ideal time to reach out.`

      const { error } = await supabase.from('leads').insert({
        company_name: hack.name,
        website: hack.website || null,
        twitter_url: (socials as { twitter_url?: string }).twitter_url || null,
        telegram_url: (socials as { telegram_url?: string }).telegram_url || null,
        discord_url: (socials as { discord_url?: string }).discord_url || null,
        description: hack.description,
        industry_category: 'DeFi Protocol',
        customer_category: ['Hacked Protocol'],
        product_to_sell: 'Cross-chain settlement',
        pain_point: `${hack.hack_type} — lost ${hack.amount_lost} on ${hack.hack_date}`,
        pain_point_severity: 'critical',
        pain_point_evidence: `${hack.description}. Source: ${hack.source_url}`,
        kima_fit: `Kima's TEE-backed non-custodial settlement replaces the vulnerable bridge/contract layer exploited in this attack`,
        aeredium_fit: "Aeredium's trust layer with institutional-grade security directly addresses the exploit vector",
        trigger_reason: triggerReason + (recentNews ? `\n\nRecent context: ${recentNews.slice(0, 400)}` : ''),
        settlement_angle: 'Replace exploited bridge/settlement layer with Kima\'s verifiable, atomic cross-chain settlement',
        integration_feasibility: 'high',
        source_url: hack.source_url || 'https://rekt.news',
        lead_score: 85, // hacked protocols are always high-priority
        priority: 'excellent',
        status: 'new',
      })

      if (!error) {
        saved++
        savedNames.push(hack.name)
        existingNames.add(nameKey)
        if (domainKey) existingWebsites.add(domainKey)
      }
    }

    return NextResponse.json({
      success: true,
      found: hacks.length,
      saved,
      leads_saved: savedNames,
      message: saved > 0 ? `Found ${hacks.length} recent hacks, saved ${saved} new leads` : 'All hacked protocols already in your pipeline',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Hack monitor failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
