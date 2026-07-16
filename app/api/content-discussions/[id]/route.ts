// GET    /api/content-discussions/[id] — fetch a thread + its messages
// PATCH  /api/content-discussions/[id] — rename a thread
// DELETE /api/content-discussions/[id] — delete a thread

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = db()

  const [{ data: discussion, error: dErr }, { data: messages, error: mErr }] = await Promise.all([
    supabase.from('content_discussions').select('*').eq('id', id).single(),
    supabase.from('content_discussion_messages').select('role, content, created_at').eq('discussion_id', id).order('created_at', { ascending: true }),
  ])

  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })
  return NextResponse.json({ discussion, messages: messages || [] })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  if (!body.title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const { data, error } = await db()
    .from('content_discussions')
    .update({ title: body.title.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, session_id, title, message_count, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ discussion: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error } = await db()
    .from('content_discussions')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
