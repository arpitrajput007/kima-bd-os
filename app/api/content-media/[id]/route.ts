// DELETE /api/content-media/[id] — delete media record + storage file

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = db()

  // Get storage path so we can delete the file too
  const { data: record } = await supabase
    .from('content_media')
    .select('storage_path')
    .eq('id', id)
    .single()

  if (record?.storage_path) {
    await supabase.storage.from('content-media').remove([record.storage_path]).catch(() => {})
  }

  const { error } = await supabase.from('content_media').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
