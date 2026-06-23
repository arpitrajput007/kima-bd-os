// ============================================================
// /api/ai/content/graphic
// ------------------------------------------------------------
// Generates a branded infographic card (no AI image model needed).
// Uses next/og (satori) to render a text-rich PNG directly from
// incident data — clean, professional, ready to post on LinkedIn/X.
// Saves to Supabase Storage + content_media table for the gallery.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import React from 'react'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function trunc(text: string | null | undefined, n: number): string {
  if (!text) return ''
  return text.length > n ? text.slice(0, n - 1) + '…' : text
}

// Builds the card as React elements (no .tsx file needed)
function buildCard(opts: {
  hook: string
  incident_summary: string
  solution: string
  isLinkedIn: boolean
}) {
  const { hook, incident_summary, solution, isLinkedIn } = opts
  const e = React.createElement
  const pad = isLinkedIn ? '44px 52px' : '52px 52px'
  const hlSize = isLinkedIn ? 28 : 34
  const bodySize = isLinkedIn ? 14 : 15
  const dir = isLinkedIn ? 'row' : 'column'

  return e('div', {
    style: {
      width: '100%', height: '100%',
      background: 'linear-gradient(140deg, #07090f 0%, #0d1228 55%, #080c1a 100%)',
      display: 'flex', flexDirection: 'column',
      padding: pad, fontFamily: 'sans-serif', position: 'relative',
    },
  },
    // Accent line at top
    e('div', {
      style: {
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: 'linear-gradient(90deg, #7c3aed 0%, #3b82f6 60%, transparent 100%)',
      },
    }),

    // Header row
    e('div', {
      style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isLinkedIn ? 26 : 34 },
    },
      e('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
        e('div', {
          style: {
            width: 28, height: 28, borderRadius: 7,
            background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          },
        }, e('span', { style: { fontSize: 14 } }, '⚡')),
        e('span', {
          style: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em' },
        }, 'KIMA BD OS'),
      ),
      e('div', {
        style: {
          background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)',
          borderRadius: 6, padding: '4px 11px',
        },
      },
        e('span', { style: { color: '#a78bfa', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em' } }, 'SECURITY INCIDENT'),
      ),
    ),

    // Headline with left accent bar
    e('div', {
      style: {
        fontSize: hlSize, fontWeight: 800, color: 'white', lineHeight: 1.22,
        marginBottom: isLinkedIn ? 22 : 30,
        borderLeft: '3px solid #7c3aed', paddingLeft: 16,
      },
    }, trunc(hook, isLinkedIn ? 105 : 120)),

    // Info cards (side by side on LinkedIn, stacked on X)
    e('div', { style: { display: 'flex', flexDirection: dir, gap: 14, flex: 1 } },
      // What happened
      e('div', {
        style: {
          flex: 1, background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column',
        },
      },
        e('div', {
          style: { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: 700, letterSpacing: '0.13em', marginBottom: 9 },
        }, 'WHAT HAPPENED'),
        e('div', {
          style: { color: 'rgba(255,255,255,0.82)', fontSize: bodySize, lineHeight: 1.62 },
        }, trunc(incident_summary, 170)),
      ),
      // Solution
      e('div', {
        style: {
          flex: 1, background: 'rgba(124,58,237,0.08)',
          border: '1px solid rgba(124,58,237,0.2)',
          borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column',
        },
      },
        e('div', {
          style: { color: '#a78bfa', fontSize: 9, fontWeight: 700, letterSpacing: '0.13em', marginBottom: 9 },
        }, 'HOW KIMA PREVENTS THIS'),
        e('div', {
          style: { color: 'rgba(167,139,250,0.88)', fontSize: bodySize, lineHeight: 1.62 },
        }, trunc(solution, 170)),
      ),
    ),

    // Footer
    e('div', {
      style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
    },
      e('span', { style: { color: 'rgba(255,255,255,0.15)', fontSize: 11 } }, 'kima.finance · aeredium.io'),
      e('div', {
        style: { background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', borderRadius: 6, padding: '5px 13px' },
      },
        e('span', { style: { color: 'white', fontSize: 11, fontWeight: 700 } }, 'Kima Finance'),
      ),
    ),
  )
}

async function saveToGallery(opts: {
  b64: string; incident_summary: string
  hook: string; post_type: string; content_id: string | null; size: string
}): Promise<string | null> {
  try {
    const supabase = db()
    const safeId = (opts.content_id || 'graphic').replace(/[^a-z0-9_-]/gi, '_')
    const fileName = `${Date.now()}-${safeId}.png`
    const buffer = Buffer.from(opts.b64, 'base64')

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
      visual_prompt: 'infographic-card',
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
  const body = await req.json()
  const { incident_summary, root_cause, kima_angle, hook, post_type = 'tweet', content_id } = body

  if (!incident_summary || !hook) {
    return NextResponse.json({ error: 'incident_summary and hook are required.' }, { status: 400 })
  }

  const isLinkedIn = post_type === 'linkedin'
  const width  = isLinkedIn ? 1200 : 1024
  const height = isLinkedIn ? 628  : 1024
  const size   = `${width}x${height}`
  const solution = kima_angle || root_cause || ''

  const card = buildCard({ hook, incident_summary, solution, isLinkedIn })

  const imgResponse = new ImageResponse(card, { width, height })
  const buffer = Buffer.from(await imgResponse.arrayBuffer())
  const b64 = buffer.toString('base64')

  const publicUrl = await saveToGallery({ b64, incident_summary, hook, post_type, content_id, size })
  const imageUrl = publicUrl ?? `data:image/png;base64,${b64}`

  return NextResponse.json({
    success: true,
    image_url: imageUrl,
    saved_to_gallery: !!publicUrl,
    size,
    content_id,
  })
}
