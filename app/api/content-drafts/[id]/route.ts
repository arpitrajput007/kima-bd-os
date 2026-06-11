// PATCH  /api/content-drafts/[id] — update status or notes
// DELETE /api/content-drafts/[id] — delete a draft

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (body.status !== undefined) update.status = body.status
  if (body.notes !== undefined)  update.notes  = body.notes
  if (body.status === 'posted')  update.posted_at = new Date().toISOString()

  const { data, error } = await db()
    .from('content_drafts')
    .update(update)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ draft: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await db()
    .from('content_drafts')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
