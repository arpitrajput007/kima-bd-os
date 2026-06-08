// ============================================================
// AI Router — single dispatch layer for all AI calls.
//
// Routes every call to Claude or OpenAI based on the caller's
// preference. This is the ONLY place that knows about both SDKs,
// so switching providers requires no changes to individual routes.
//
// Preferences are stored in localStorage on the client and passed
// as request body params:
//   research_ai:  'claude' | 'openai'   (default: 'claude')
//   drafting_ai:  'claude' | 'openai'   (default: 'openai')
// ============================================================

import OpenAI from 'openai'
import { claudeJSON, claudeText, CLAUDE_FAST } from './claude'

export type AIProvider = 'claude' | 'openai'

const openai = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Strip markdown fences and extract JSON — same helper as in lib/claude.ts.
function extractJson(raw: string): string {
  let s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  const start = s.search(/[{[]/)
  const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'))
  if (start >= 0 && end > start) return s.slice(start, end + 1)
  return s
}

// ── JSON (structured output) ─────────────────────────────────────────────────
export async function routeJSON<T = Record<string, unknown>>(params: {
  provider: AIProvider
  system: string
  user: string
  model?: string          // override the auto-selected model
  maxTokens?: number
  temperature?: number
}): Promise<T> {
  if (params.provider === 'openai') {
    const client = openai()
    const completion = await client.chat.completions.create({
      model: params.model ?? 'gpt-4o',
      messages: [
        { role: 'system', content: params.system },
        { role: 'user',   content: params.user   },
      ],
      response_format: { type: 'json_object' },
      temperature: params.temperature ?? 0.2,
      max_tokens:  params.maxTokens   ?? 4000,
    })
    return JSON.parse(completion.choices[0].message.content || '{}') as T
  }

  // Default: Claude
  // NOTE: No temperature param — claude-opus-4-8 with thinking: adaptive
  // does not accept temperature. Omitting it is correct.
  return claudeJSON<T>({
    model:     params.model     ?? CLAUDE_FAST,
    maxTokens: params.maxTokens ?? 4000,
    system: params.system,
    user:   params.user,
  })
}

// ── Plain text ───────────────────────────────────────────────────────────────
export async function routeText(params: {
  provider: AIProvider
  system: string
  user: string
  model?: string
  maxTokens?: number
  temperature?: number
}): Promise<string> {
  if (params.provider === 'openai') {
    const client = openai()
    const completion = await client.chat.completions.create({
      model: params.model ?? 'gpt-4o',
      messages: [
        { role: 'system', content: params.system },
        { role: 'user',   content: params.user   },
      ],
      temperature: params.temperature ?? 0.3,
      max_tokens:  params.maxTokens   ?? 4000,
    })
    return completion.choices[0].message.content || ''
  }

  // NOTE: No temperature param — same reason as claudeJSON above.
  return claudeText({
    model:     params.model     ?? CLAUDE_FAST,
    maxTokens: params.maxTokens ?? 4000,
    system: params.system,
    user:   params.user,
  })
}

// ── JSON with ban-guard retry (used by outreach drafting) ────────────────────
// On first pass: generate the message.
// If banned phrases appear in the output: retry once with the offenders
// called out explicitly. Works identically on both providers.
export async function routeJSONWithBanGuard<T = Record<string, unknown>>(params: {
  provider: AIProvider
  system: string
  user: string
  maxTokens?: number
  temperature?: number
  // Return the text strings to scan for banned phrases from the parsed output
  extractTexts: (parsed: T) => string[]
  bannedPhrases: string[]
}): Promise<T> {
  const run = async (userPrompt: string): Promise<T> =>
    routeJSON<T>({ provider: params.provider, system: params.system, user: userPrompt, maxTokens: params.maxTokens, temperature: params.temperature })

  let parsed = await run(params.user)

  const t = params.extractTexts(parsed).join(' ').toLowerCase()
  const found = params.bannedPhrases.filter(p => t.includes(p.toLowerCase()))
  if (found.length > 0) {
    const fixUser =
      `${params.user}\n\nYOUR PREVIOUS ATTEMPT USED THESE BANNED PHRASES: ${found.map(b => `"${b}"`).join(', ')}. ` +
      `Rewrite everything so NONE of these — or any phrase from the HARD BANS — appears anywhere. ` +
      `Keep it specific, human, and tailored to this exact lead.`
    parsed = await run(fixUser)
  }

  return parsed
}

// ── Model label for display in the UI ───────────────────────────────────────
export function modelLabel(provider: AIProvider, task: 'research' | 'drafting'): string {
  if (provider === 'claude') {
    return task === 'research' ? 'Claude Opus 4.5' : 'Claude Sonnet 4.5'
  }
  return 'GPT-4o'
}
