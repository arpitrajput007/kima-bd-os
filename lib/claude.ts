// ============================================================
// Claude API client — used for all research & analysis tasks.
//
// Split:
//   Claude  → lead discovery, deep research, company analysis,
//              hack monitoring, source suggestions, session learning,
//              weekly reports, lead discussion.
//   OpenAI  → outreach message drafting, chat copilot, TTS.
//             (OpenAI stays for drafting because its GPT-4o voice/tone
//              matches the tuned outreach rules; TTS is OpenAI-only.)
// ============================================================

import Anthropic from '@anthropic-ai/sdk'

// Models — pick the right tier per task.
// Research quality matters more than cost, so default to Opus for deep work.
export const CLAUDE_RESEARCH  = 'claude-opus-4-5'   // deep company research, analysis
export const CLAUDE_FAST      = 'claude-sonnet-4-5' // fast extraction, lighter tasks

export function claudeConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

const _client = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Strip any markdown fences Claude might add even when told not to, then
// extract the outermost JSON object or array.
function extractJson(raw: string): string {
  let s = raw.trim()
  // Remove ```json ... ``` or ``` ... ```
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  // Find the outermost { } or [ ]
  const start = s.search(/[{[]/)
  const lastCurly  = s.lastIndexOf('}')
  const lastSquare = s.lastIndexOf(']')
  const end = Math.max(lastCurly, lastSquare)
  if (start >= 0 && end > start) return s.slice(start, end + 1)
  return s
}

// ── Research call — returns parsed JSON ─────────────────────────────────────
// Use this for deepResearch, extractCompanies, hack analysis, etc.
// The system prompt is augmented to always demand pure JSON output.
export async function claudeJSON<T = Record<string, unknown>>(params: {
  system: string
  user: string
  model?: string
  maxTokens?: number
  temperature?: number
}): Promise<T> {
  const client = _client()
  const systemPrompt =
    params.system.trimEnd() +
    '\n\nCRITICAL: Return ONLY valid JSON — no markdown, no code fences, no explanatory text before or after the JSON.'

  const response = await client.messages.create({
    model: params.model ?? CLAUDE_RESEARCH,
    max_tokens: params.maxTokens ?? 4000,
    temperature: params.temperature ?? 0.2,
    system: systemPrompt,
    messages: [{ role: 'user', content: params.user }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const json = extractJson(text)
  return JSON.parse(json) as T
}

// ── Analysis call — returns plain text ──────────────────────────────────────
// Use this for reports, discussion responses, session summaries.
export async function claudeText(params: {
  system: string
  user: string
  model?: string
  maxTokens?: number
  temperature?: number
}): Promise<string> {
  const client = _client()

  const response = await client.messages.create({
    model: params.model ?? CLAUDE_RESEARCH,
    max_tokens: params.maxTokens ?? 4000,
    temperature: params.temperature ?? 0.3,
    system: params.system,
    messages: [{ role: 'user', content: params.user }],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

// ── Streaming text — for routes that stream back to the UI ──────────────────
export async function claudeStream(params: {
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  model?: string
  maxTokens?: number
  temperature?: number
}): Promise<ReadableStream<Uint8Array>> {
  const client = _client()

  const stream = client.messages.stream({
    model: params.model ?? CLAUDE_RESEARCH,
    max_tokens: params.maxTokens ?? 4000,
    temperature: params.temperature ?? 0.3,
    system: params.system,
    messages: params.messages,
  })

  const encoder = new TextEncoder()
  return new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          controller.enqueue(encoder.encode(event.delta.text))
        }
      }
      controller.close()
    },
  })
}
