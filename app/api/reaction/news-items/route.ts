// DELETE /api/reaction/news-items — delete one or more news feed items by id
// body: { ids: string[] }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body.ids) ? body.ids : []
  if (ids.length === 0) return NextResponse.json({ error: 'ids required' }, { status: 400 })

  const { error } = await db()
    .from('reaction_news_feed')
    .delete()
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, deleted: ids.length })
}
