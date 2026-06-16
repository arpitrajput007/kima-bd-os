// ============================================================
// /api/ai/bd-brief
//
// Generates a 7-section BD Brief — designed so the BD team can
// decide in 30–60 seconds whether a lead is worth pursuing.
//
// Uses the shared generateBDBrief() from lib/bd-brief.ts, which
// is also called at the end of the enrich-lead pipeline.
//
// POST { lead_id: string }
// Returns { success: true, bd_brief: BDBrief }
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateBDBrief } from '@/lib/bd-brief'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const { lead_id } = await req.json()
  if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })

  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', lead_id)
    .single()

  if (error || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  try {
    const brief = await generateBDBrief(lead as Record<string, unknown>)

    await supabase
      .from('leads')
      .update({ bd_brief: brief, updated_at: new Date().toISOString() })
      .eq('id', lead_id)

    return NextResponse.json({ success: true, bd_brief: brief })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'BD brief generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
