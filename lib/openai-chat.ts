// ============================================================
// OpenAI tool-using chat call — the GPT-5.6 counterpart to
// claudeTextWithTools (lib/claude.ts). Same shape (system/user/tools/
// executeTool in, plain text out) so Discuss Lead can run the identical
// tool-use loop against either provider for a direct side-by-side
// comparison, not just a different prompt on a different model.
//
// Model split within the OpenAI side (see pickOpenAIModel): GPT-5.6
// Terra handles ordinary customer-conversation turns — strong and
// roughly half Sol's cost. GPT-5.6 Sol, the flagship, is reserved for
// leads that are actually worth the extra spend — the same 85+ "Excellent"
// bar BD Command Center already uses. This is a routing decision, not a
// verdict that one tier is simply "better" than the other.
// ============================================================

import OpenAI from 'openai'
import type { ClaudeTool } from './claude'

const _client = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export const GPT_TERRA = 'gpt-5.6-terra'
export const GPT_SOL = 'gpt-5.6-sol'

// Sol for the leads that matter most (same "Excellent" cutoff as BD Command
// Center's own scoring tiers), Terra for everything else.
export function pickOpenAIModel(leadScore: number | null | undefined): string {
  return typeof leadScore === 'number' && leadScore >= 85 ? GPT_SOL : GPT_TERRA
}

export function openaiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY
}

export async function openaiTextWithTools(params: {
  system: string
  user: string
  tools: ClaudeTool[]
  executeTool: (name: string, input: Record<string, unknown>) => Promise<string>
  model?: string
  maxTokens?: number
  image?: { mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string }
  // Caps tool-call rounds before the model is forced to answer with whatever
  // it has — same purpose as claudeTextWithTools's maxRounds.
  maxRounds?: number
}): Promise<string> {
  const client = _client()
  const maxRounds = params.maxRounds ?? 4
  const model = params.model ?? GPT_TERRA

  // GPT-5.6 only accepts the default temperature (1) — passing anything else
  // is a 400. Don't set it at all here rather than guess a "safe" value.
  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] | string = params.image
    ? [
        { type: 'text', text: params.user },
        { type: 'image_url', image_url: { url: `data:${params.image.mediaType};base64,${params.image.data}` } },
      ]
    : params.user

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = params.tools.map(t => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }))

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: params.system },
    { role: 'user', content: userContent },
  ]

  for (let round = 0; round < maxRounds; round++) {
    const completion = await client.chat.completions.create({
      model,
      max_completion_tokens: params.maxTokens ?? 4000,
      messages,
      tools,
      // GPT-5.6 Sol rejects function tools combined with its default
      // reasoning_effort on /v1/chat/completions ("Function tools with
      // reasoning_effort are not supported for gpt-5.6-sol") — 'none' is
      // the documented way around it. Terra accepts the same param fine.
      reasoning_effort: 'none',
    })
    const message = completion.choices[0].message

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return message.content?.trim() ?? ''
    }

    messages.push(message)
    for (const call of message.tool_calls) {
      let resultText: string
      // Anthropic-style tool_use blocks are one shape; OpenAI's function
      // tool_calls are a subtype of the union — narrow to it before reading
      // `.function`, since a custom (freeform) tool_call has no such field.
      if (call.type !== 'function') {
        resultText = `Unsupported tool call type: ${call.type}`
      } else {
        try {
          const input = call.function.arguments ? JSON.parse(call.function.arguments) : {}
          resultText = await params.executeTool(call.function.name, input)
        } catch (e) {
          resultText = `Tool "${call.function.name}" failed: ${e instanceof Error ? e.message : 'unknown error'}`
        }
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: resultText || '(no result)' })
    }
  }

  // Ran out of rounds — force a final answer with whatever's been gathered.
  // No `tools` on this call, mirroring claudeTextWithTools's fallback.
  messages.push({
    role: 'user',
    content: 'You\'re out of tool calls for this turn. Answer now using whatever you found. If a lookup failed or was blocked, say so plainly, then give your best-reasoned read clearly marked as inference.',
  })
  const final = await client.chat.completions.create({
    model,
    max_completion_tokens: params.maxTokens ?? 4000,
    messages,
  })
  return final.choices[0].message.content?.trim()
    || 'I ran into trouble getting a straight answer on that — the live lookups I tried either came back empty or were blocked. Try asking again, maybe more specifically.'
}
