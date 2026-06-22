import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export type APIStatus = 'ok' | 'not_configured' | 'unauthorized' | 'exhausted' | 'rate_limited' | 'error'

export interface APIHealth {
  status: APIStatus
  detail: string
  credits?: { used: number; available: number } | null
}

// Module-level cache — 5 min TTL so we don't burn credits on every page load
let cache: Record<string, APIHealth> | null = null
let cacheAt = 0
const TTL = 5 * 60 * 1000

async function checkAnthropic(key: string): Promise<APIHealth> {
  try {
    // /v1/models is free — no completions cost
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    })
    if (res.ok) return { status: 'ok', detail: 'Connected · models reachable' }
    if (res.status === 401) return { status: 'unauthorized', detail: 'Invalid or revoked API key' }
    if (res.status === 429) return { status: 'rate_limited', detail: 'Rate limited — try again shortly' }
    const err = await res.json().catch(() => ({}))
    return { status: 'error', detail: (err as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}` }
  } catch {
    return { status: 'error', detail: 'Could not reach Anthropic API' }
  }
}

async function checkOpenAI(key: string): Promise<APIHealth> {
  try {
    // /v1/models is free — no cost
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (res.ok) return { status: 'ok', detail: 'Connected · models reachable' }
    if (res.status === 401) return { status: 'unauthorized', detail: 'Invalid or revoked API key' }
    if (res.status === 429) {
      const err = await res.json().catch(() => ({}) as { error?: { message?: string } })
      const msg = ((err as { error?: { message?: string } })?.error?.message || '').toLowerCase()
      if (msg.includes('quota') || msg.includes('exceeded') || msg.includes('limit')) {
        return { status: 'exhausted', detail: 'Monthly quota exceeded — check OpenAI billing' }
      }
      return { status: 'rate_limited', detail: 'Rate limited — try again shortly' }
    }
    if (res.status === 402) return { status: 'exhausted', detail: 'Billing limit reached' }
    return { status: 'error', detail: `HTTP ${res.status}` }
  } catch {
    return { status: 'error', detail: 'Could not reach OpenAI API' }
  }
}

async function checkHunter(key: string): Promise<APIHealth> {
  try {
    // /v2/account is free and exposes remaining credits
    const res = await fetch(`https://api.hunter.io/v2/account?api_key=${key}`)
    if (res.status === 401 || res.status === 403) return { status: 'unauthorized', detail: 'Invalid API key' }
    if (!res.ok) return { status: 'error', detail: `HTTP ${res.status}` }
    const json = await res.json()
    const requests = (json as { data?: { requests?: { used: number; available: number } } })?.data?.requests
    if (requests) {
      const { used, available } = requests
      const remaining = available - used
      if (remaining <= 0) {
        return { status: 'exhausted', detail: `All ${available} requests used — credits exhausted`, credits: { used, available } }
      }
      if (remaining < available * 0.1) {
        return { status: 'rate_limited', detail: `${remaining} of ${available} remaining — running low`, credits: { used, available } }
      }
      return { status: 'ok', detail: `${remaining} of ${available} requests remaining`, credits: { used, available } }
    }
    return { status: 'ok', detail: 'Connected' }
  } catch {
    return { status: 'error', detail: 'Could not reach Hunter API' }
  }
}

async function checkExa(key: string): Promise<APIHealth> {
  try {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'api health check', numResults: 1, useAutoprompt: false }),
    })
    if (res.ok) return { status: 'ok', detail: 'Connected' }
    if (res.status === 401 || res.status === 403) return { status: 'unauthorized', detail: 'Invalid API key' }
    if (res.status === 402) return { status: 'exhausted', detail: 'Credits exhausted — add more on Exa dashboard' }
    if (res.status === 429) return { status: 'exhausted', detail: 'Rate limit or monthly credits exhausted' }
    const err = await res.json().catch(() => ({}))
    return { status: 'error', detail: (err as { message?: string })?.message || `HTTP ${res.status}` }
  } catch {
    return { status: 'error', detail: 'Could not reach Exa API' }
  }
}

async function checkTavily(key: string): Promise<APIHealth> {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, query: 'test', search_depth: 'basic', max_results: 1 }),
    })
    if (res.ok) return { status: 'ok', detail: 'Connected' }
    const err = await res.json().catch(() => ({}))
    const detail = (err as { detail?: string })?.detail || ''
    if (res.status === 401 || detail.toLowerCase().includes('invalid')) return { status: 'unauthorized', detail: 'Invalid API key' }
    if (res.status === 429 || detail.toLowerCase().includes('limit') || detail.toLowerCase().includes('quota')) {
      return { status: 'exhausted', detail: 'Monthly credits exhausted — check Tavily dashboard' }
    }
    return { status: 'error', detail: detail || `HTTP ${res.status}` }
  } catch {
    return { status: 'error', detail: 'Could not reach Tavily API' }
  }
}

async function checkPerplexity(key: string): Promise<APIHealth> {
  try {
    // Minimal sonar call — cheapest way to verify the key works
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      }),
    })
    if (res.ok) return { status: 'ok', detail: 'Connected · sonar-pro ready' }
    if (res.status === 401 || res.status === 403) return { status: 'unauthorized', detail: 'Invalid API key' }
    if (res.status === 402) return { status: 'exhausted', detail: 'Credits exhausted — check Perplexity billing' }
    if (res.status === 429) return { status: 'rate_limited', detail: 'Rate limited — try again shortly' }
    return { status: 'error', detail: `HTTP ${res.status}` }
  } catch {
    return { status: 'error', detail: 'Could not reach Perplexity API' }
  }
}

async function checkApollo(key: string): Promise<APIHealth> {
  try {
    const res = await fetch('https://api.apollo.io/api/v1/auth/health', {
      headers: { 'x-api-key': key, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    })
    if (res.ok) return { status: 'ok', detail: 'Connected' }
    if (res.status === 401) return { status: 'unauthorized', detail: 'Invalid API key' }
    if (res.status === 429) return { status: 'rate_limited', detail: 'Rate limited' }
    return { status: 'error', detail: `HTTP ${res.status}` }
  } catch {
    return { status: 'error', detail: 'Could not reach Apollo API' }
  }
}

const NOT_CONFIGURED: APIHealth = { status: 'not_configured', detail: 'API key not set in .env.local' }

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get('force') === '1'

  if (!force && cache && Date.now() - cacheAt < TTL) {
    return NextResponse.json({ ...cache, _cached: true, _age_s: Math.floor((Date.now() - cacheAt) / 1000) })
  }

  const ak = process.env.ANTHROPIC_API_KEY
  const ok = process.env.OPENAI_API_KEY
  const hk = process.env.HUNTER_API_KEY
  const ek = process.env.EXA_API_KEY
  const tk = process.env.TAVILY_API_KEY
  const apk = process.env.APOLLO_API_KEY
  const ppk = process.env.PERPLEXITY_API_KEY

  const [anthropic, openai, hunter, exa, tavily, apollo, perplexity] = await Promise.all([
    ak  ? checkAnthropic(ak)   : Promise.resolve(NOT_CONFIGURED),
    ok  ? checkOpenAI(ok)      : Promise.resolve(NOT_CONFIGURED),
    hk  ? checkHunter(hk)      : Promise.resolve(NOT_CONFIGURED),
    ek  ? checkExa(ek)         : Promise.resolve(NOT_CONFIGURED),
    tk  ? checkTavily(tk)      : Promise.resolve(NOT_CONFIGURED),
    apk ? checkApollo(apk)     : Promise.resolve(NOT_CONFIGURED),
    ppk ? checkPerplexity(ppk) : Promise.resolve(NOT_CONFIGURED),
  ])

  cache = { anthropic, openai, hunter, exa, tavily, apollo, perplexity }
  cacheAt = Date.now()

  return NextResponse.json(cache)
}
