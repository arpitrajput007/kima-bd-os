// ============================================================
// /api/ai/content/graphic
// ------------------------------------------------------------
// Generates a branded social media graphic:
//   1. Claude builds a precise image prompt
//   2. gpt-image-1 generates a dark editorial illustration
//   3. Image is uploaded to Supabase Storage (content-media bucket)
//      and saved to content_media table for the gallery
//   4. Returns public URL (or data URL fallback if storage fails)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { claudeText } from '@/lib/claude'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function buildVisualPrompt(opts: {
  incident_summary: string
  root_cause: string
  hook: string
  post_type: 'tweet' | 'linkedin'
}): Promise<string> {
  const prompt = await claudeText({
    model: 'claude-sonnet-4-6',
    maxTokens: 300,
    system: `You write image generation prompts for gpt-image-1. You create dark, editorial, cinematic digital illustrations for Web3/crypto thought-leadership content. NO text in the image — text will be overlaid separately.

Style rules:
- Always dark background (deep navy, near-black)
- Accent colors: electric purple (#7c3aed), electric blue (#3b82f6), or amber (#f59e0b) depending on tone
- Cinematic, editorial quality — not cartoonish, not generic stock photo
- Abstract or metaphorical — represents the concept, not a literal screenshot
- Professional, institutional feel — suitable for a serious finance/tech audience
- 16:9 landscape for LinkedIn, 1:1 square for tweet/X

Avoid: people's faces, text/writing, logos, clichéd "coins falling" imagery, pixelated/retro aesthetics`,
    user: `Generate an image prompt for this incident:
Incident: ${opts.incident_summary}
Root cause: ${opts.root_cause}
Hook text: ${opts.hook}
Post type: ${opts.post_type === 'linkedin' ? 'LinkedIn (16:9 landscape)' : 'X/Twitter (1:1 square)'}

Write ONLY the image prompt — no explanation, no quotes, just the prompt itself. Under 200 words. Make it visually striking and thematically aligned with the specific failure mechanism described.`,
  })
  return prompt.trim()
}

// Upload base64 PNG to Supabase Storage and save record to content_media table.
// Returns public URL on success, null on failure (caller falls back to data URL).
async function saveToGallery(opts: {
  b64: string
  visualPrompt: string
  incident_summary: string
  hook: string
  post_type: string
  content_id: string | null
  size: string
}): Promise<string | null> {
  try {
    const supabase = db()
    const safeId = (opts.content_id || 'graphic').replace(/[^a-z0-9_-]/gi, '_')
    const fileName = `${Date.now()}-${safeId}.png`
    const buffer = Buffer.from(opts.b64, 'base64')

    // Create bucket if it doesn't exist yet
    await supabase.storage.createBucket('content-media', { public: true }).catch(() => {})

    const { error: uploadError } = await supabase.storage
      .from('content-media')
      .upload(fileName, buffer, { contentType: 'image/png' })

    if (uploadError) return null

    const { data: urlData } = supabase.storage.from('content-media').getPublicUrl(fileName)
    const publicUrl = urlData?.publicUrl
    if (!publicUrl) return null

    await supabase.from('content_media').insert({
      storage_path: fileName,
      public_url: publicUrl,
      visual_prompt: opts.visualPrompt,
      incident_summary: opts.incident_summary || null,
      hook: opts.hook || null,
      post_type: opts.post_type || null,
      content_id: opts.content_id || null,
      size: opts.size,
    })

    return publicUrl
  } catch {
    return null
  }
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
    const visualPrompt = await buildVisualPrompt({
      incident_summary,
      root_cause: root_cause || '',
      hook,
      post_type,
    })

    console.log(`[graphic] prompt for ${content_id}:`, visualPrompt.slice(0, 120))

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

    const data = await res.json() as { data?: Array<{ b64_json?: string }> }
    const b64 = data.data?.[0]?.b64_json

    if (!b64) {
      return NextResponse.json({ error: 'No image returned.' }, { status: 500 })
    }

    // Try to save to gallery; fall back to data URL if storage not configured
    const publicUrl = await saveToGallery({
      b64, visualPrompt, incident_summary, hook, post_type, content_id, size,
    })

    const imageUrl = publicUrl ?? `data:image/png;base64,${b64}`

    return NextResponse.json({
      success: true,
      image_url: imageUrl,
      saved_to_gallery: !!publicUrl,
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
