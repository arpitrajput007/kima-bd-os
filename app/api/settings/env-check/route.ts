import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Returns which API keys are configured (true/false per key).
// Never exposes the actual key values — only presence.
export async function GET() {
  return NextResponse.json({
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai:    !!process.env.OPENAI_API_KEY,
    supabase:  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    tavily:    !!process.env.TAVILY_API_KEY,
    exa:       !!process.env.EXA_API_KEY,
    apollo:    !!process.env.APOLLO_API_KEY,
    hunter:    !!process.env.HUNTER_API_KEY,
  })
}
