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

// Models — tiered by cost/quality trade-off.
// Use CLAUDE_THINK only when extended reasoning genuinely helps (e.g. deepResearch).
// For everything else, Sonnet is faster and ~5× cheaper.
// CLAUDE_MINI (Haiku) is ~20× cheaper than Sonnet — use for classification, scoring,
// and any task where the input is already structured and the output is small.
export const CLAUDE_THINK    = 'claude-opus-4-8'              // Opus + thinking — deepResearch ONLY
export const CLAUDE_RESEARCH = 'claude-sonnet-4-6'            // solid research, reports, analysis
export const CLAUDE_FAST     = 'claude-sonnet-4-6'            // fast extraction, lighter tasks
export const CLAUDE_MINI     = 'claude-haiku-4-5-20251001'    // classification, scoring, cheap structured tasks

export function claudeConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

const _client = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Strip any markdown fences Claude might add even when told not to, then
// extract the outermost JSON object or array.
// Handles preamble text like "I notice that..." before the JSON block.
function extractJson(raw: string): string {
  let s = raw.trim()
  // Remove ```json ... ``` or ``` ... ``` fences (may appear anywhere)
  s = s.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim()
  // Find the outermost { } or [ ]
  const start = s.search(/[{[]/)
  const lastCurly  = s.lastIndexOf('}')
  const lastSquare = s.lastIndexOf(']')
  const end = Math.max(lastCurly, lastSquare)
  if (start >= 0 && end > start) return s.slice(start, end + 1)
  // Nothing found — return as-is so the caller gets a useful parse error
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
  // Set to true only for deep research calls (deepResearch) where extra reasoning
  // improves quality. Leave false (default) for fast extraction tasks.
  thinking?: boolean
  // Temperature: only pass for creative tasks (e.g. outreach drafting).
  // Do NOT set when thinking=true — Opus 4.8 + thinking does not accept it.
  // Sonnet 4.6 supports temperature normally.
  temperature?: number
}): Promise<T> {
  const client = _client()
  const model = params.model ?? CLAUDE_RESEARCH
  const systemText =
    params.system.trimEnd() +
    '\n\nCRITICAL: Return ONLY valid JSON — no markdown, no code fences, no explanatory text before or after the JSON.'

  // cache_control marks the system prompt for Anthropic prompt caching.
  // Cache hits cost 90% less on input tokens — critical when the same large
  // system prompt (PRODUCT_BRAIN ~4-5k tokens) is sent on multiple calls.
  const systemBlock: Anthropic.TextBlockParam = {
    type: 'text',
    text: systemText,
    cache_control: { type: 'ephemeral' },
  }

  const response = await client.messages.create({
    model,
    max_tokens: params.maxTokens ?? 4000,
    // temperature is supported on Sonnet 4.6 — only omit it when thinking is enabled
    // (Opus 4.8 with thinking: adaptive rejects the temperature param).
    ...(params.thinking ? { thinking: { type: 'adaptive' } } : {}),
    ...(params.temperature != null && !params.thinking ? { temperature: params.temperature } : {}),
    system: [systemBlock],
    messages: [{ role: 'user', content: params.user }],
  })

  // When thinking is enabled, content[0] is a thinking block — find the text block explicitly.
  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
  const text = textBlock?.text ?? ''
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
  thinking?: boolean
  temperature?: number
}): Promise<string> {
  const client = _client()

  const systemBlock: Anthropic.TextBlockParam = {
    type: 'text',
    text: params.system,
    cache_control: { type: 'ephemeral' },
  }

  const response = await client.messages.create({
    model: params.model ?? CLAUDE_RESEARCH,
    max_tokens: params.maxTokens ?? 4000,
    ...(params.thinking ? { thinking: { type: 'adaptive' } } : {}),
    ...(params.temperature != null && !params.thinking ? { temperature: params.temperature } : {}),
    system: [systemBlock],
    messages: [{ role: 'user', content: params.user }],
  })

  // When thinking is enabled, content[0] may be a thinking block — find text explicitly.
  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
  return textBlock?.text ?? ''
}

// ── Streaming text — for routes that stream back to the UI ──────────────────
export async function claudeStream(params: {
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  model?: string
  maxTokens?: number
}): Promise<ReadableStream<Uint8Array>> {
  const client = _client()

  const systemBlock: Anthropic.TextBlockParam = {
    type: 'text',
    text: params.system,
    cache_control: { type: 'ephemeral' },
  }

  const stream = client.messages.stream({
    model: params.model ?? CLAUDE_RESEARCH,
    max_tokens: params.maxTokens ?? 4000,
    // Note: temperature/top_p/top_k are removed on Opus 4.7+ — do not add them back.
    system: [systemBlock],
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
