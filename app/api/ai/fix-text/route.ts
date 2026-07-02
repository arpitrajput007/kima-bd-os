// POST /api/ai/fix-text
// ------------------------------------------------------------
// Cleans up grammar/spelling/phrasing on a short free-text field without
// changing its meaning. Powers the "AI Fix" buttons on deal form fields
// (Requirement, Problem Statement) for reps typing quick notes.

import { NextRequest, NextResponse } from 'next/server'
import { claudeText, claudeConfigured, CLAUDE_MINI } from '@/lib/claude'

export async function POST(req: NextRequest) {
  if (!claudeConfigured()) {
    return NextResponse.json({ error: 'Claude not configured' }, { status: 400 })
  }

  const { text } = await req.json()
  if (!text?.trim()) {
    return NextResponse.json({ error: 'text required' }, { status: 400 })
  }

  try {
    const fixed = await claudeText({
      system: `You fix grammar, spelling, and phrasing in short business notes written by a BD (business development) rep — often typed quickly in imperfect English.

Rules:
- Preserve the original meaning, facts, and tone exactly — do not add, remove, or invent information.
- Keep it roughly the same length — tighten wording, don't pad it into a longer passage.
- Return ONLY the corrected text. No preamble, no quotes, no explanation, no markdown.`,
      user: text,
      model: CLAUDE_MINI,
      maxTokens: 400,
      temperature: 0.2,
    })

    return NextResponse.json({ fixed: fixed.trim() })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fix text'
    console.error('[fix-text]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
