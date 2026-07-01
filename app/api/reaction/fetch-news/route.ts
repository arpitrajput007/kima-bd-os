// GET  /api/reaction/fetch-news — load cached items from DB (fast, no external calls)
// POST /api/reaction/fetch-news — pull fresh items from all sources, dedup, store, return all

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exaNewsTopics, exaConfigured } from '@/lib/exa'
import {
  EXA_TOPIC_QUERIES,
  fetchAllRssItems,
  fetchDeFiLlamaHacks,
  fetchDeFiLlamaRaises,
  type ReactionNewsItem,
} from '@/lib/reaction-sources'

export const dynamic    = 'force-dynamic'
export const maxDuration = 30

const WINDOW_DAYS = 14

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function loadItems() {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString()
  const { data } = await db()
    .from('reaction_news_feed')
    .select('*')
    .gte('created_at', since)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(200)
  return data || []
}

export async function GET() {
  const items = await loadItems()
  return NextResponse.json({ items, fetched_count: 0 })
}

export async function POST() {
  // 1. Load existing URLs to dedup
  const { data: existing } = await db()
    .from('reaction_news_feed')
    .select('url')
    .limit(2000)
  const knownUrls = new Set<string>((existing || []).map((r: { url: string }) => r.url))

  // 2. Fetch all sources in parallel
  const [exaItems, rssItems, hackItems, raiseItems] = await Promise.allSettled([
    exaConfigured()
      ? exaNewsTopics(EXA_TOPIC_QUERIES, 7, 5)
      : Promise.resolve([]),
    fetchAllRssItems(),
    fetchDeFiLlamaHacks(14),
    fetchDeFiLlamaRaises(14),
  ]).then(results =>
    results.map(r => (r.status === 'fulfilled' ? r.value : []))
  ) as [ReactionNewsItem[], ReactionNewsItem[], ReactionNewsItem[], ReactionNewsItem[]]

  // 3. Merge + dedup
  const allRaw: ReactionNewsItem[] = [
    ...exaItems.map(i => ({ ...i, source: i.source ?? 'exa' })),
    ...rssItems,
    ...hackItems,
    ...raiseItems,
  ]
  const newItems = allRaw.filter(i => i.url && !knownUrls.has(i.url))

  // 4. Insert new rows (ignore conflicts on URL unique constraint)
  if (newItems.length > 0) {
    const rows = newItems.map(i => ({
      topic:        i.topic,
      title:        i.title.slice(0, 500),
      url:          i.url,
      source:       (i.source || 'unknown').slice(0, 100),
      summary:      (i.summary || '').slice(0, 800),
      published_at: i.published_at,
      used:         false,
    }))
    await db()
      .from('reaction_news_feed')
      .upsert(rows, { onConflict: 'url', ignoreDuplicates: true })
  }

  // 5. Return all items from window
  const items = await loadItems()
  return NextResponse.json({ items, fetched_count: newItems.length })
}
