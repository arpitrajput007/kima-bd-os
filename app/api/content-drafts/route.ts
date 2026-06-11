// GET  /api/content-drafts — list all drafts (newest first)
// POST /api/content-drafts — save a new draft

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
    .from('content_drafts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ drafts: data || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    post_type, text, hook, incident_summary,
    root_cause, kima_angle, notes,
  } = body

  if (!post_type || !text) {
    return NextResponse.json({ error: 'post_type and text are required' }, { status: 400 })
  }

  const { data, error } = await db()
    .from('content_drafts')
    .insert({
      post_type,
      text,
      hook: hook || text.split(/\n\n+/)[0]?.slice(0, 300) || text.slice(0, 300),
      incident_summary: incident_summary || null,
      root_cause: root_cause || null,
      kima_angle: kima_angle || null,
      notes: notes || null,
      status: 'saved',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ draft: data })
}
