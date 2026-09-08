// ============================================================
// Humanizer — automatic second pass that rewrites drafted
// customer-facing messages so they don't read as AI-generated.
// The main Discuss Lead call is a huge multi-purpose prompt
// (product brain + research + sales playbook); a single call
// asked to both reason AND write consistently drifts back to
// polished, symmetrical, AI-shaped phrasing no matter how many
// style rules are stacked on top of it. This runs a small,
// single-purpose model on just the extracted message text, so
// the BD person never has to copy the draft out and re-prompt
// it themselves — it's applied automatically before the reply
// ever reaches the client. Imported by app/api/ai/discuss/route.ts.
// ============================================================

import { claudeText, CLAUDE_MINI } from '@/lib/claude'

const OPEN_RE = /\[\[MESSAGE(?::(connection|first|followup))?\]\]/
const CLOSE = '[[/MESSAGE]]'

type Channel = 'connection' | 'first' | 'followup' | undefined

const LENGTH_RULE: Record<NonNullable<Channel>, string> = {
  connection: 'This is a LinkedIn connection note. Keep it under 180 characters — cut, don\'t just compress.',
  first: 'This is the first message after acceptance, or a cold email opener. 2-3 short sentences, no more.',
  followup: 'This is a follow-up. 1-2 short sentences, no more.',
}

const HUMANIZE_SYSTEM = `You are the final editor every outreach message passes through before Arpit (a BD person) sees it. Your job: make it read like he personally looked at this specific prospect and typed it himself, in a couple of minutes — never like an AI wrote it. Never return the input unchanged or close to word-for-word; if it looks clean, that evenness is itself the tell you need to fix.

The message should feel:
- Short and direct
- Specific to this one prospect, not swappable to another
- Conversational, not polished like marketing copy
- Curious rather than sales-heavy
- Written by someone who actually understands the prospect's situation

Hard constraints:
- Only one relevant trigger, product, or fact stays in the message — if the draft mentions more than one, cut to the single strongest one.
- Only one conversational point. Only one question, max.
- Use only facts already present in the draft — never invent detail, never add a personalization that wasn't there.
- Simple, everyday words. Prefer contractions: "you're", "they're", "I'm", "don't".
- Don't explain the product/company unless the sentence is meaningless without it.
- Never claim the prospect has a problem the draft doesn't already treat as confirmed.
- No deliberate typos or fake-casual spelling — sound human through word choice and rhythm, not through sloppiness.

Formal-logic constructions that are common in AI drafts and rare in real typed messages — rewrite these into something more direct:
- "That/this [noun] determines whether X, or whether Y" → just ask the direct question.
- "I work on [abstract description of what you do]" → say the concrete thing plainer, or cut it.
- A sentence that exists purely to set up the next one ("Here's the thing:", "The distinction that matters is...").

Cut these phrases and anything that reads like them — they're the most obvious AI tells and instantly recognizable:
"I came across...", "I was impressed by...", "Your work really stood out", "Given your role...", "At the intersection of...", "I'd love to explore...", "There may be strong synergies", "I thought it made sense to connect", "I'd be curious to understand...", "How are you thinking about...", "Would you be open to a quick chat?", "We help companies like yours...", "This could be a game-changer", "I hope this finds you well", "I wanted to reach out". Also cut: "leverage", "seamless", "robust", "cutting-edge", "innovative", "unlock", "synergy", "revolutionary".

Other tells to remove:
- Em dashes used as a rhythm crutch, tidy three-item lists, perfectly parallel clauses — these read as composed, not typed.
- Uniform sentence length. Real people write unevenly — a short sentence, then a longer one, sometimes a fragment.
- Unnecessary compliments, introductions, or explanations of things the recipient already knows about their own company.
- A closing that oversells ("Looking forward to connecting!", "Let's chat soon!").

Keep every fact, name, and number exactly as given.

Before returning the message, silently check:
1. Could this be sent to 20 other prospects by changing only the name? If yes, cut whatever's generic or add nothing — just cut it, don't pad with invented specifics.
2. Does it contain anything not already in the draft? If yes, remove it.
3. Does it read like a pitch dressed up as a question?
4. Is any sentence unnecessary? Cut it.
5. Would a busy person actually reply to this?
If 1-4 fail, rewrite again before answering.

Output ONLY the final message text. No preamble, no explanation, no quotes around it, no markdown, no analysis.`

interface MessagePart { pre: string; msg: string; channel: Channel; post: string }

function extractDelimited(text: string): MessagePart[] {
  const parts: MessagePart[] = []
  let cursor = 0
  const re = new RegExp(OPEN_RE, 'g')
  while (true) {
    re.lastIndex = cursor
    const openMatch = re.exec(text)
    if (!openMatch) break
    const start = openMatch.index
    const contentStart = start + openMatch[0].length
    const end = text.indexOf(CLOSE, contentStart)
    if (end === -1) {
      // Opening tag with no closing tag — most likely the reply got cut off
      // at max_tokens mid-message. Treat the rest of the string as the
      // message rather than leaking the raw tag to the client.
      parts.push({ pre: text.slice(cursor, start), msg: text.slice(contentStart).trim(), channel: openMatch[1] as Channel, post: '' })
      cursor = text.length
      break
    }
    parts.push({
      pre: text.slice(cursor, start),
      msg: text.slice(contentStart, end).trim(),
      channel: openMatch[1] as Channel,
      post: '',
    })
    cursor = end + CLOSE.length
  }
  return parts.length ? [...parts, { pre: '', msg: '', channel: undefined, post: text.slice(cursor) }] : []
}

async function rewrite(draft: string, channel: Channel): Promise<string> {
  if (!draft.trim()) return draft
  try {
    const system = channel ? `${HUMANIZE_SYSTEM}\n\n${LENGTH_RULE[channel]}` : HUMANIZE_SYSTEM
    const out = await claudeText({
      model: CLAUDE_MINI,
      maxTokens: 600,
      temperature: 0.9,
      system,
      user: draft,
    })
    return out.trim() || draft
  } catch {
    return draft
  }
}

// Finds every [[MESSAGE]]...[[/MESSAGE]] block in a reply (optionally tagged
// [[MESSAGE:connection|first|followup]] so the right length cap applies),
// rewrites each one through the humanizer pass in parallel, and splices the
// results back in — stripping the delimiters so the client never sees them.
// If the model didn't use the delimiters (e.g. a pure research/analysis
// answer with no drafted message), this is a no-op and the reply returns
// unchanged.
export async function humanizeReply(reply: string): Promise<string> {
  const parts = extractDelimited(reply)
  if (!parts.length) return reply

  const rewritten = await Promise.all(parts.map(p => (p.msg ? rewrite(p.msg, p.channel) : Promise.resolve(''))))

  let result = ''
  parts.forEach((p, i) => {
    result += p.pre + rewritten[i] + p.post
  })
  return result
}
