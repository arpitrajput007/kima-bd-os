// GET  /api/content-sessions — list all sessions (newest first)
// POST /api/content-sessions — save a new session

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
    .from('content_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessions: data || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    source_url, news_context,
    incident_summary, root_cause, kima_angle,
    tweets, thread, linkedin,
  } = body

  const { data, error } = await db()
    .from('content_sessions')
    .insert({
      source_url: source_url || null,
      news_context: news_context || null,
      incident_summary: incident_summary || null,
      root_cause: root_cause || null,
      kima_angle: kima_angle || null,
      tweets: tweets || [],
      thread: thread || [],
      linkedin: linkedin || [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ session: data })
}
