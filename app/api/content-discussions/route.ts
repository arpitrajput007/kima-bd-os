// GET  /api/content-discussions?session_id=... — list a session's discussion threads (newest first)
// POST /api/content-discussions — start a new discussion thread

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'session_id is required' }, { status: 400 })

  const { data, error } = await db()
    .from('content_discussions')
    .select('id, session_id, title, message_count, created_at, updated_at')
    .eq('session_id', sessionId)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ discussions: data || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { session_id, title } = body

  if (!session_id) return NextResponse.json({ error: 'session_id is required' }, { status: 400 })

  const { data, error } = await db()
    .from('content_discussions')
    .insert({ session_id, title: title || 'New conversation' })
    .select('id, session_id, title, message_count, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ discussion: data })
}
