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

const OPEN = '[[MESSAGE]]'
const CLOSE = '[[/MESSAGE]]'

const HUMANIZE_SYSTEM = `You rewrite AI-drafted outreach messages (LinkedIn notes, InMail, cold email, follow-ups) so they read like a real person typed them in a couple of minutes — not like an AI wrote them.

The input has already been through an AI writer, so it will usually look clean and well-formed even when it doesn't contain an obvious buzzword — that evenness IS the tell. Don't treat "no glaring red flag" as "nothing to fix." Actually rewrite the phrasing: change sentence boundaries, cut a clause, reorder a thought, swap a formal construction for how someone would actually say it out loud. Returning the input close to word-for-word is a failure even if it was already free of obvious slop — find at least two or three sentences to genuinely restructure, not just reformat.

Watch for these formal-logic constructions in particular, common in AI drafts and rare in real typed messages — rewrite them into something more direct:
- "That/this [noun] determines whether X, or whether Y" → just ask the direct question.
- "I work on [abstract description of what you do]" → say the concrete thing plainer, or cut it.
- A sentence that exists purely to set up the next one ("Here's the thing:", "The distinction that matters is...").

Strip these AI tells wherever they appear:
- Em dashes used as a rhythm crutch. Rewrite as separate sentences or drop the aside.
- Throat-clearing openers: "I hope this finds you well", "I wanted to reach out", "I came across your profile/company".
- Tidy three-item lists and perfectly parallel clauses ("fast, reliable, and secure").
- Transition words: "Moreover", "Furthermore", "Additionally", "That said", "In today's [x] landscape".
- Corporate/buzzword filler: "leverage", "seamless", "robust", "cutting-edge", "unlock", "synergy", "game-changing", "revolutionary".
- Over-explaining or restating something the recipient obviously already knows about their own company.
- Uniform sentence length and a too-clean logical flow. Real people write with some unevenness — a short sentence, then a longer one, an occasional fragment.
- Excessive politeness or enthusiasm (exclamation points, "amazing", "excited to").
- A closing that oversells next steps ("Looking forward to connecting!", "Let's chat soon!").

Keep:
- Every fact, name, number, and claim exactly as given — do not add, remove, or soften factual content.
- The core ask/question — there should still be exactly one clear thing being asked.
- The approximate length of the original. If it's a short LinkedIn note, keep it short — do not pad a 200-character note into a paragraph. If it's an email, don't make it longer than the input.
- Plain, direct, contraction-using language a busy founder would actually text back to.

Output ONLY the rewritten message text. No preamble, no explanation, no quotes around it, no markdown.`

function extractDelimited(text: string): { pre: string; msg: string; post: string }[] {
  const matches: { pre: string; msg: string; post: string }[] = []
  let cursor = 0
  while (true) {
    const start = text.indexOf(OPEN, cursor)
    if (start === -1) break
    const end = text.indexOf(CLOSE, start)
    if (end === -1) {
      // Opening tag with no closing tag — most likely the reply got cut off
      // at max_tokens mid-message. Treat the rest of the string as the
      // message rather than leaking the raw tag to the client.
      matches.push({ pre: text.slice(cursor, start), msg: text.slice(start + OPEN.length).trim(), post: '' })
      cursor = text.length
      break
    }
    matches.push({
      pre: text.slice(cursor, start),
      msg: text.slice(start + OPEN.length, end).trim(),
      post: '',
    })
    cursor = end + CLOSE.length
  }
  return matches.length ? [...matches, { pre: '', msg: '', post: text.slice(cursor) }] : []
}

async function rewrite(draft: string): Promise<string> {
  if (!draft.trim()) return draft
  try {
    const out = await claudeText({
      model: CLAUDE_MINI,
      maxTokens: 600,
      temperature: 0.9,
      system: HUMANIZE_SYSTEM,
      user: draft,
    })
    return out.trim() || draft
  } catch {
    return draft
  }
}

// Finds every [[MESSAGE]]...[[/MESSAGE]] block in a reply, rewrites each one
// through the humanizer pass in parallel, and splices the results back in —
// stripping the delimiters so the client never sees them. If the model didn't
// use the delimiters (e.g. a pure research/analysis answer with no drafted
// message), this is a no-op and the reply is returned unchanged.
export async function humanizeReply(reply: string): Promise<string> {
  const parts = extractDelimited(reply)
  if (!parts.length) return reply

  const rewritten = await Promise.all(parts.map(p => (p.msg ? rewrite(p.msg) : Promise.resolve(''))))

  let result = ''
  parts.forEach((p, i) => {
    result += p.pre + rewritten[i] + p.post
  })
  return result
}
