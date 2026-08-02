// POST /api/ai/estimate-volume
// ------------------------------------------------------------
// Given a company name, estimates their expected monthly payment/settlement
// volume from public knowledge (funding size, reported TVL/volume, industry
// benchmarks). Powers the auto-fill on the "Monthly Volume" field in the
// Add Deal form — if Claude has no reasonable basis for an estimate, it
// returns null and the rep fills the field in manually.

import { NextRequest, NextResponse } from 'next/server'
import { claudeJSON, claudeConfigured, CLAUDE_FAST } from '@/lib/claude'

interface VolumeEstimate {
  monthly_volume: string | null
  confidence: 'high' | 'medium' | 'low' | 'unknown'
  reasoning: string
}

export async function POST(req: NextRequest) {
  if (!claudeConfigured()) {
    return NextResponse.json({ error: 'Claude not configured' }, { status: 400 })
  }

  const { company_name, website, industry } = await req.json()
  if (!company_name?.trim()) {
    return NextResponse.json({ error: 'company_name required' }, { status: 400 })
  }

  try {
    const result = await claudeJSON<VolumeEstimate>({
      system: `You are a BD analyst estimating a prospect's expected monthly payment/settlement volume for a sales pipeline tool.

Base the estimate ONLY on things you actually know about this specific company from training data — funding raised, reported TVL, reported transaction/payment volume, user/customer counts, or other concrete public signals. Do not use generic industry averages as a substitute for real signal.

If you don't have enough real, company-specific information to ground an estimate, say so honestly — do not guess or invent a number.

Return ONLY valid JSON, no markdown:
{
  "monthly_volume": "e.g. \\"$2M/month\\" — a single short estimate string, or null if you don't have a real basis for one",
  "confidence": "high | medium | low | unknown",
  "reasoning": "One sentence: what public signal the estimate is based on, or why you left it null"
}`,
      user: `Company: ${company_name}\nWebsite: ${website || 'unknown'}\nIndustry/category: ${industry || 'unknown'}`,
      model: CLAUDE_FAST,
      maxTokens: 300,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to estimate volume'
    console.error('[estimate-volume]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
