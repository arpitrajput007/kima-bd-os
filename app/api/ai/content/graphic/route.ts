// ============================================================
// /api/ai/content/graphic
// ------------------------------------------------------------
// Generates a branded social media graphic for a piece of
// content (tweet or LinkedIn post) using DALL-E 3.
//
// Strategy:
//   1. Claude builds a precise DALL-E prompt from the incident
//      context + content hook (no hallucinated text in images)
//   2. DALL-E 3 generates a dark, editorial illustration
//   3. We return the image URL — the UI overlays hook text +
//      Kima branding using CSS (no font-mangling from DALL-E)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { claudeText } from '@/lib/claude'

// Build a DALL-E 3 visual prompt from the incident context
async function buildVisualPrompt(opts: {
  incident_summary: string
  root_cause: string
  hook: string
  post_type: 'tweet' | 'linkedin'
}): Promise<string> {
  const prompt = await claudeText({
    model: 'claude-sonnet-4-6',
    maxTokens: 300,
    system: `You write image generation prompts for DALL-E 3. You create dark, editorial, cinematic digital illustrations for Web3/crypto thought-leadership content. NO text in the image — text will be overlaid separately.

Style rules:
- Always dark background (deep navy, near-black)
- Accent colors: electric purple (#7c3aed), electric blue (#3b82f6), or amber (#f59e0b) depending on tone
- Cinematic, editorial quality — not cartoonish, not generic stock photo
- Abstract or metaphorical — represents the concept, not a literal screenshot
- Professional, institutional feel — suitable for a serious finance/tech audience
- 16:9 landscape for LinkedIn, 1:1 square for tweet/X

Avoid: people's faces, text/writing, logos, clichéd "coins falling" imagery, pixelated/retro aesthetics`,
    user: `Generate a DALL-E 3 prompt for this incident:
Incident: ${opts.incident_summary}
Root cause: ${opts.root_cause}
Hook text: ${opts.hook}
Post type: ${opts.post_type === 'linkedin' ? 'LinkedIn (16:9 landscape)' : 'X/Twitter (1:1 square)'}

Write ONLY the DALL-E 3 prompt — no explanation, no quotes, just the prompt itself. Under 200 words. Make it visually striking and thematically aligned with the specific failure mechanism described.`,
  })
  return prompt.trim()
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not configured.' }, { status: 400 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Anthropic API key not configured.' }, { status: 400 })
  }

  const body = await req.json()
  const { incident_summary, root_cause, hook, post_type = 'tweet', content_id } = body

  if (!incident_summary || !hook) {
    return NextResponse.json({ error: 'incident_summary and hook are required.' }, { status: 400 })
  }

  try {
    // Step 1: Claude builds the visual prompt
    const visualPrompt = await buildVisualPrompt({
      incident_summary,
      root_cause: root_cause || '',
      hook,
      post_type,
    })

    console.log(`[graphic] image prompt for ${content_id}:`, visualPrompt.slice(0, 120))

    // Step 2: gpt-image-1 generates the image (returns base64)
    const size = post_type === 'linkedin' ? '1536x1024' : '1024x1024'

    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: visualPrompt,
        n: 1,
        size,
        quality: 'high',
      }),
      signal: AbortSignal.timeout(60_000),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
      const msg = err?.error?.message || `Image generation failed (${res.status})`
      return NextResponse.json({ error: msg }, { status: res.status })
    }

    const data = await res.json() as {
      data?: Array<{ b64_json?: string }>
    }
    const b64 = data.data?.[0]?.b64_json

    if (!b64) {
      return NextResponse.json({ error: 'No image returned.' }, { status: 500 })
    }

    const imageUrl = `data:image/png;base64,${b64}`

    return NextResponse.json({
      success: true,
      image_url: imageUrl,
      visual_prompt: visualPrompt,
      size,
      content_id,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Graphic generation failed'
    console.error('[graphic route error]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
