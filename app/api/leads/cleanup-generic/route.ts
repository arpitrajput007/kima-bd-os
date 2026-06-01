import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isGenericName } from '@/lib/leadQuality'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Find (and optionally archive) existing leads whose name is a generic category
// rather than a real company. POST { dryRun?: boolean }.
//   dryRun=true  → just return the matches (preview)
//   dryRun=false → archive them (status='archived', recoverable)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const dryRun = body?.dryRun === true

    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, company_name, status')
      .not('status', 'in', '("archived","rejected")')
      .limit(1000)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const generic = (leads || []).filter(l => isGenericName(l.company_name || ''))
    const names = generic.map(l => l.company_name)

    if (dryRun || generic.length === 0) {
      return NextResponse.json({ matched: generic.length, names, archived: 0 })
    }

    const ids = generic.map(l => l.id)
    const { error: updErr } = await supabase
      .from('leads')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .in('id', ids)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    return NextResponse.json({ matched: generic.length, names, archived: generic.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Cleanup failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
