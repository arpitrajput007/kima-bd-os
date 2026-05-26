import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 })
    }

    // Truncate to avoid excessive TTS cost (max ~600 chars for a voice response)
    const truncated = text.slice(0, 800)

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',   // Clear, professional, natural-sounding
      input: truncated,
      speed: 1.0,
    })

    const audioBuffer = Buffer.from(await mp3.arrayBuffer())

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'TTS failed'
    console.error('[tts route]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
