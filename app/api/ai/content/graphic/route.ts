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
    maxTokens: 500,
    system: `You write cinematic image generation prompts for gpt-image-1. You specialize in dark, editorial, institutional-grade visuals for Web3/crypto thought-leadership content.

CRITICAL: NO text, letters, numbers, words, logos, or UI elements anywhere in the image. Pure visual only.

LIGHTING — pick one setup per image:
- Rim/edge light: single dramatic light source from behind or side, subject silhouetted against deep dark background
- Shaft of light: single beam cutting through volumetric fog or darkness
- Bioluminescent glow: soft coloured light emanating from within a cracked or fractured object

COLOUR PALETTE — pick one, do not mix:
- NOIR: near-black background #080c18, electric purple accent #7c3aed, white specular highlights
- BREACH: deep navy #0a0e1a, warning amber #f59e0b, cold steel-blue mid-tones
- COLD: pitch black, ice blue #38bdf8, dark slate-grey reflections

COMPOSITION:
- Rule of thirds — primary subject slightly off-centre
- Strong diagonal lines or geometric tension in foreground
- Atmospheric perspective — sharp foreground, hazy depth
- Intentional negative space (never cluttered)

SUBJECT MATTER — abstract/metaphorical only, chosen to match the failure mechanism:
- Broken chain or shattered padlock → key/custody compromise
- Cracked vault door leaking light → treasury/fund exploit
- Severed glowing network cables → bridge or oracle failure
- Collapsing geometric lattice → smart contract exploit
- Single dim node disconnected from a bright network → relayer/messaging failure
- Fractured mirror reflecting distorted data → oracle manipulation

QUALITY KEYWORDS to always append: ultra high resolution, 8K, photorealistic Octane render, cinematic colour grading, anamorphic lens flare, award-winning editorial photography, deep shadows, micro-detail textures

AVOID: people's faces, coins, generic blockchain graphics, crypto logos, cartoonish style, text overlays, flat lighting, busy composition`,
    user: `Write a gpt-image-1 prompt for this incident:
Incident: ${opts.incident_summary}
Root cause: ${opts.root_cause}
Hook: ${opts.hook}
Format: ${opts.post_type === 'linkedin' ? '16:9 landscape (1536×1024)' : '1:1 square (1024×1024)'}

Pick the colour palette and subject matter that best matches the specific failure mechanism above.
Write ONLY the image prompt — no preamble, no quotes, no explanation. 150–250 words. Be specific about lighting position, materials, atmosphere, and composition.`,
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
