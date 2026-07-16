// POST /api/content-discussions/[id]/messages — append a message to a thread

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { role, content } = body

  if (role !== 'user' && role !== 'assistant') {
    return NextResponse.json({ error: "role must be 'user' or 'assistant'" }, { status: 400 })
  }
  if (!content?.trim()) return NextResponse.json({ error: 'content is required' }, { status: 400 })

  const supabase = db()

  const { data: message, error: insertError } = await supabase
    .from('content_discussion_messages')
    .insert({ discussion_id: id, role, content })
    .select('role, content, created_at')
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  const { count } = await supabase
    .from('content_discussion_messages')
    .select('id', { count: 'exact', head: true })
    .eq('discussion_id', id)

  await supabase
    .from('content_discussions')
    .update({ message_count: count ?? 0, updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ message, message_count: count ?? 0 })
}
