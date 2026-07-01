// GET  /api/reaction-drafts — list saved reaction posts (newest first)
// POST /api/reaction-drafts — save a new reaction post

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET() {
  const { data, error } = await db()
    .from('reaction_drafts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ drafts: data || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    news_item_id, news_title, news_url, news_topic,
    post_short, post_medium, post_long,
    alt_hooks, titles, comment_ideas, takeaway, hashtags,
  } = body

  if (!post_short || !post_medium || !post_long) {
    return NextResponse.json({ error: 'post_short, post_medium, and post_long are required' }, { status: 400 })
  }

  const hook = post_medium.split(/\n\n+/)[0]?.slice(0, 300) || post_medium.slice(0, 300)

  const { data, error } = await db()
    .from('reaction_drafts')
    .insert({
      news_item_id:  news_item_id  || null,
      news_title:    news_title    || null,
      news_url:      news_url      || null,
      news_topic:    news_topic    || null,
      post_short,
      post_medium,
      post_long,
      hook,
      alt_hooks:    alt_hooks     || [],
      titles:       titles        || [],
      comment_ideas:comment_ideas || [],
      takeaway:     takeaway      || null,
      hashtags:     hashtags      || [],
      status: 'saved',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ draft: data })
}
