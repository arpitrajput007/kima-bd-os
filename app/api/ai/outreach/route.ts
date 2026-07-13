import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PRODUCT_BRAIN, productFocusDirective, type LeadFocusInput } from '@/lib/kima-knowledge'
import { MAX_FOLLOWUPS, getOutreachLearnings } from '@/lib/outreach'
import { routeJSONWithBanGuard, type AIProvider } from '@/lib/ai-router'
import { outreachMemory } from '@/lib/agent-memory'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Rules that make every message read as a hand-written, researched DM — not a
// blast. Shared by both the auto-draft and the custom-config flows.
const HUMAN_RULES = `YOU ARE ARPIT. You write your own outreach by hand after doing real research. Every message must be indistinguishable from something a sharp, experienced BD person typed themselves.

══ HARD BANS — if any of these appear, rewrite from scratch ══

Opener clichés (instant delete):
- "I hope this finds you well" / "Hope this email finds you" (any variant)
- "I wanted to reach out" / "Just wanted to drop you a note" / "Reaching out because"
- "I came across your company" / "I noticed your company" / "I stumbled upon"
- "I was impressed by" / "Truly impressive work" / "Love what you're building"
- "My name is Arpit and I" — never introduce yourself in the opener

Corporate buzzwords (these expose AI authorship immediately):
- game-changer, game changer, revolutionary, cutting-edge, cutting edge
- synergy, leverage, seamless, robust, best-in-class, scalable (as an adjective), frictionless
- "in today's fast-paced world", "in the rapidly evolving", "in the ever-changing"
- "comprehensive solution", "end-to-end", "holistic approach", "streamlined"
- "value proposition" (use "what Kima actually does for you" instead)
- "pain points" (use the specific problem plainly)
- "utilize" (say "use"), "facilitate" (say "help"), "leverage" (say "use")

Salesy / pushy openers:
- "circle back", "touch base", "pick your brain", "hop on a quick call"
- "let's connect", "let's jump on a call", "schedule some time"
- "we are excited to", "we're excited to", "I'd love to", "would love to"
- "looking forward to hearing from you", "looking forward to your thoughts"
- "don't hesitate to reach out", "please feel free to"
- "I believe this could be a great fit", "I think we could really help"

AI writing tells (these make it obvious a bot wrote this):
- Em dash overuse — never use more than one em dash per message, prefer a comma or period
- "Here's the thing:", "Here's why:", "Put simply:", "In short:", "Simply put:"
- Rhetorical question immediately followed by your own answer ("Why does this matter? Because...")
- "And that's exactly where [X] comes in" or "That's where we come in"
- Numbered lists or bullet points inside a DM or short message
- "I wanted to share", "I thought it might be worth", "It would be remiss of me"
- Starting 3+ sentences in a row with "I"
- Overly balanced sentences: "Not only X, but also Y" / "While X, we also Y"
- "Keen to" (British AI tell), "do not hesitate", "I trust this finds you"

══ WHAT ACTUALLY WORKS ══

Voice: Arpit is sharp, Web3-native, direct. He does not over-explain. He writes short sentences. He uses fragments when it sounds natural. He uses contractions. He does not capitalize random words for emphasis.

Opener: Start with the ONE thing that makes THIS company different — a specific number, event, chain they use, a recent hire, a hack, a funding round, something from the source URL. If you can't name something specific, you don't have a hook yet.

Structure (natural, not checklist):
- Hook = their specific situation (1-2 sentences)
- The problem WE fix for them — stated simply, not as a feature list (1-2 sentences). Which product leads is set by the PRODUCT FOCUS block below — follow it exactly.
- The product value woven in naturally where it fits (the PRODUCT FOCUS block tells you which product and the exact framing)
- One clean CTA — a yes/no question, a specific ask, or a soft close. Vary it.

Length and formatting:
- Telegram / X DM: 2-4 sentences. No bullet points. One thought per sentence.
- LinkedIn: 3-5 sentences. Still no bullet points. Slightly more context.
- Email: 5-8 sentences. Subject line should be specific (not "Partnership opportunity"). Still no bullet points in the body.

Before finalising: read each message out loud in your head. If any sentence sounds like it was written by software, rewrite it. Real humans use short sentences, imperfect punctuation, and say the direct thing without preamble.`

// High-signal phrases that expose AI authorship. GPT sometimes ignores the
// prompt ban so we scan output and force one rewrite if any slip through.
const BANNED_PHRASES = [
  // opener clichés
  'i hope this email finds you well', 'i hope this message finds you well',
  'hope this finds you well', 'hope this email finds you', 'hope this message finds you',
  'i wanted to reach out', 'just wanted to reach out', 'just wanted to drop',
  'reaching out because', 'i came across', 'i noticed your company',
  'i stumbled upon', 'i was impressed by', 'truly impressive', 'love what you',
  'my name is arpit and',
  // buzzwords
  'game-changer', 'game changer', 'revolutionary', 'cutting-edge', 'cutting edge',
  'synergy', 'best-in-class', "in today's fast-paced world", 'in the rapidly evolving',
  'comprehensive solution', 'end-to-end', 'holistic approach', 'frictionless',
  'value proposition', 'pain points', 'utilize', 'facilitate',
  // salesy
  'circle back', 'touch base', 'pick your brain', 'hop on a quick call',
  "let's connect", "let's jump on a call", 'we are excited to', "we're excited to",
  "i'd love to", 'would love to', 'looking forward to hearing from you',
  "don't hesitate to reach out", 'please feel free to',
  'i believe this could be a great fit', 'i think we could really help',
  // AI writing tells
  "here's the thing", "here's why", 'put simply', 'in short,', 'simply put',
  'and that\'s exactly where', "that's where we come in",
  'not only', 'keen to', 'do not hesitate', 'i trust this finds you',
  // follow-up
  'just bumping this', 'just circling back', 'just following up',
  'circling back on this', 'bumping this up',
]

function findBannedPhrases(text: string): string[] {
  const t = (text || '').toLowerCase()
  return BANNED_PHRASES.filter(p => t.includes(p))
}

// Thin wrapper — delegates to the provider-aware routeJSONWithBanGuard in ai-router.
// provider is set per-request from the user's drafting_ai preference.
async function completeWithBanGuard(
  systemPrompt: string,
  userPrompt: string,
  opts: { temperature: number; max_tokens: number },
  extractTexts: (parsed: Record<string, unknown>) => string[],
  provider: AIProvider = 'openai',
): Promise<Record<string, unknown>> {
  return routeJSONWithBanGuard({
    provider,
    system: systemPrompt,
    user: userPrompt,
    maxTokens: opts.max_tokens,
    temperature: opts.temperature,
    extractTexts,
    bannedPhrases: BANNED_PHRASES,
  })
}

interface LeadRow {
  company_name: string
  website?: string | null
  description?: string | null
  business_model?: string | null
  product_summary?: string | null
  supported_chains_or_rails?: string | null
  current_providers?: string | null
  customer_category?: string[] | null
  product_to_sell?: string | null
  region?: string | null
  pain_point?: string | null
  pain_point_evidence?: string | null
  kima_fit?: string | null
  aeredium_fit?: string | null
  suggested_use_case?: string | null
  settlement_angle?: string | null
  security_angle?: string | null
  trigger_reason?: string | null
  source_url?: string | null
  twitter_url?: string | null
  telegram_url?: string | null
  discord_url?: string | null
  last_channel?: string | null
  contacts?: {
    id?: string | null
    name?: string | null
    role?: string | null
    email?: string | null
    linkedin_url?: string | null
    twitter_url?: string | null
    telegram?: string | null
  }[] | null
}

// Build the contact/social bundle the UI uses for one-click "open & send".
function buildMeta(lead: LeadRow) {
  const c = (lead.contacts || [])[0]
  return {
    telegram_url: lead.telegram_url || null,
    twitter_url: lead.twitter_url || null,
    discord_url: lead.discord_url || null,
    website: lead.website || null,
    contact: c
      ? {
          id: c.id || undefined,
          name: c.name || null,
          email: c.email || null,
          linkedin_url: c.linkedin_url || null,
          twitter_url: c.twitter_url || null,
          telegram: c.telegram || null,
        }
      : null,
  }
}

function leadContextBlock(lead: LeadRow): string {
  const contact = (lead.contacts || [])[0]
  const lines = [
    `Company: ${lead.company_name}`,
    lead.website && `Website: ${lead.website}`,
    contact?.name && `Likely contact: ${contact.name}${contact.role ? ` (${contact.role})` : ''}`,
    lead.description && `What they do: ${lead.description}`,
    lead.business_model && `Business model: ${lead.business_model}`,
    lead.supported_chains_or_rails && `Chains/rails they use: ${lead.supported_chains_or_rails}`,
    lead.current_providers && `Current providers: ${lead.current_providers}`,
    (lead.customer_category || []).length > 0 && `Category: ${(lead.customer_category || []).join(', ')}`,
    lead.region && `Region: ${lead.region}`,
    lead.trigger_reason && `*** REASON TO REACH OUT NOW (use this as the hook): ${lead.trigger_reason}`,
    lead.source_url && `Source/proof: ${lead.source_url}`,
    lead.pain_point && `Their pain point: ${lead.pain_point}`,
    lead.pain_point_evidence && `Pain evidence: ${lead.pain_point_evidence}`,
    lead.kima_fit && `How Kima fits them: ${lead.kima_fit}`,
    lead.aeredium_fit && `How Aeredium fits them: ${lead.aeredium_fit}`,
    lead.settlement_angle && `Settlement angle: ${lead.settlement_angle}`,
    lead.security_angle && `Security angle: ${lead.security_angle}`,
    lead.suggested_use_case && `Suggested use case: ${lead.suggested_use_case}`,
    lead.product_to_sell && `Best product to sell: ${lead.product_to_sell}`,
  ].filter(Boolean)
  return lines.join('\n')
}

// ── AUTO MODE: agent writes 2-3 ready-to-send human drafts on its own ──
async function generateAutoDrafts(leadId: string, draftingProvider: AIProvider = 'openai') {
  const { data: lead, error } = await supabase
    .from('leads')
    .select('*, contacts(id, name, role, email, linkedin_url, twitter_url, telegram)')
    .eq('id', leadId)
    .single()

  if (error || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  const [learnings, memory] = await Promise.all([
    getOutreachLearnings(supabase),
    outreachMemory({ tags: (lead.tags as string[] | null) || [] }),
  ])

  const { directive: focusDirective } = productFocusDirective(lead as LeadFocusInput)

  const systemPrompt = `You are Arpit, leading BD/partnerships for Kima, Aeredium, and Aerpolice. You write your own outreach DMs by hand after researching each prospect.

${PRODUCT_BRAIN}

${HUMAN_RULES}
${learnings.hasData ? `\n${learnings.block}\n` : ''}${memory}

${focusDirective}

You will produce SIX drafts for the SAME lead — 2 variations per channel. Each variation within a channel MUST use a completely different hook, evidence point, and angle. They cannot feel like the same message reworded.

Channel 1 — Telegram / X DM (short_1, short_2): 2–3 sentences each. Punchy, one sharp hook. Each version starts from a different specific fact about this lead.
Channel 2 — LinkedIn (medium_1, medium_2): 4–5 sentences each. Different angle per version — e.g. one leads with their pain, one leads with a news hook.
Channel 3 — Email (long_1, long_2): 6–8 sentences each, include a subject line. Different angle and evidence point per version. Subject lines must also be distinct.

Return JSON only.`

  const userPrompt = `Here is everything I researched on this lead. Write all 6 drafts so they could ONLY have been written for this specific company.

${leadContextBlock(lead as LeadRow)}

Return JSON exactly:
{
  "drafts": [
    { "id": "short_1",  "label": "Telegram / X DM", "channel": "telegram", "version": 1, "text": "..." },
    { "id": "short_2",  "label": "Telegram / X DM", "channel": "telegram", "version": 2, "text": "..." },
    { "id": "medium_1", "label": "LinkedIn",         "channel": "linkedin", "version": 1, "text": "..." },
    { "id": "medium_2", "label": "LinkedIn",         "channel": "linkedin", "version": 2, "text": "..." },
    { "id": "long_1",   "label": "Email",            "channel": "email",    "version": 1, "subject": "...", "text": "..." },
    { "id": "long_2",   "label": "Email",            "channel": "email",    "version": 2, "subject": "...", "text": "..." }
  ]
}`

  try {
    const result = await completeWithBanGuard(
      systemPrompt,
      userPrompt,
      { temperature: 0.95, max_tokens: 3800 },
      (p) => ((p.drafts as { subject?: string; text?: string }[]) || [])
        .map(d => `${d.subject || ''} ${d.text || ''}`),
      draftingProvider,
    )
    return NextResponse.json({
      success: true,
      mode: 'auto',
      data: { ...result, meta: buildMeta(lead as LeadRow) },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI request failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ── FOLLOW-UP MODE: one short, fresh-angle nudge for a no-reply lead ──
async function generateFollowup(leadId: string, stage: number, draftingProvider: AIProvider = 'openai') {
  const { data: lead, error } = await supabase
    .from('leads')
    .select('*, contacts(id, name, role, email, linkedin_url, twitter_url, telegram)')
    .eq('id', leadId)
    .single()

  if (error || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  // Pull the prior messages so the follow-up doesn't repeat the same angle.
  const { data: priorMsgs } = await supabase
    .from('outreach_messages')
    .select('message, channel, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })

  const priorText = (priorMsgs || [])
    .map((m, i) => `Message ${i + 1} (${m.channel || 'unknown'}):\n${m.message || ''}`)
    .join('\n\n') || '(no prior message text on file)'

  const channel = (lead as LeadRow).last_channel || ((priorMsgs || [])[0]?.channel) || 'telegram'

  const [learnings, memory] = await Promise.all([
    getOutreachLearnings(supabase),
    outreachMemory({ tags: (lead.tags as string[] | null) || [] }),
  ])

  const { directive: focusDirective } = productFocusDirective(lead as LeadFocusInput)

  const isFinal = stage >= MAX_FOLLOWUPS - 1
  const systemPrompt = `You are Arpit, leading BD/partnerships for Kima, Aeredium, and Aerpolice. You're writing a SHORT follow-up to someone who hasn't replied yet. You are not annoyed and not pushy — just persistent and useful.

${PRODUCT_BRAIN}

${HUMAN_RULES}
${learnings.hasData ? `\n${learnings.block}\n` : ''}${memory}

${focusDirective}

FOLLOW-UP RULES:
- Keep it SHORT — 1 to 3 sentences. Shorter than the first message.
- Do NOT repeat the same hook or pitch from the prior message(s). Lead with a DIFFERENT angle: a fresh proof point, a new trigger, a relevant comparison, or a genuinely useful nudge.
- Lightly acknowledge you reached out before without guilt-tripping ("following up" is fine; no "just bumping this" or "circling back").
- ${isFinal
    ? 'This is the LAST follow-up. Write the body only — do NOT write your own closing line or ask. A closing sentence ("If that\'s not interesting, no worries — just reply \'no\' and I\'ll stop following up.") is appended automatically after your text, so end on the last useful point instead.'
    : 'End with a tiny, low-friction question that is easy to answer.'}
- Match the channel: ${channel}. ${channel === 'email' ? 'Include a short subject line.' : 'No subject line.'}
- No signature block.

Return JSON only.`

  const userPrompt = `Lead research:
${leadContextBlock(lead as LeadRow)}

What I've already sent them (do NOT repeat these angles):
${priorText}

This is follow-up #${stage + 1}${isFinal ? ' (the final one)' : ''}. Write ONE follow-up message for the ${channel} channel.

Return JSON exactly:
{ "draft": { "channel": "${channel}", ${channel === 'email' ? '"subject": "...", ' : ''}"text": "..." } }`

  try {
    const result = await completeWithBanGuard(
      systemPrompt,
      userPrompt,
      { temperature: 0.95, max_tokens: 800 },
      (p) => {
        const d = p.draft as { subject?: string; text?: string } | undefined
        return [`${d?.subject || ''} ${d?.text || ''}`]
      },
      draftingProvider,
    )
    return NextResponse.json({
      success: true,
      mode: 'followup',
      data: { ...result, meta: buildMeta(lead as LeadRow) },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI request failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  // drafting_ai: 'openai' (default) | 'claude' — user preference from Settings.
  const draftingProvider: AIProvider = body.drafting_ai === 'claude' ? 'claude' : 'openai'

  // Only require the OpenAI key when actually routing to OpenAI.
  if (draftingProvider === 'openai' && (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here')) {
    return NextResponse.json({ error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your .env.local file.' }, { status: 400 })
  }

  // Auto mode — the agent drafts on its own from the saved research.
  if (body.mode === 'auto') {
    if (!body.lead_id) {
      return NextResponse.json({ error: 'lead_id is required for auto mode' }, { status: 400 })
    }
    return generateAutoDrafts(body.lead_id, draftingProvider)
  }

  // Follow-up mode — one short, different-angle nudge for a no-reply lead.
  if (body.mode === 'followup') {
    if (!body.lead_id) {
      return NextResponse.json({ error: 'lead_id is required for followup mode' }, { status: 400 })
    }
    return generateFollowup(body.lead_id, typeof body.stage === 'number' ? body.stage : 0, draftingProvider)
  }

  // ── CUSTOM MODE: user-configured full sequence ──
  const {
    company_name, contact_name, channel, tone, customer_category,
    product_to_sell, use_case, pain_point, kima_fit, aeredium_fit,
    message_length = 'medium'
  } = body

  const lengthGuides: Record<string, string> = {
    short: '2-3 sentences max per message',
    medium: '4-6 sentences per message',
    detailed: '6-10 sentences per message with more context'
  }
  const lengthGuide = lengthGuides[message_length] || lengthGuides.medium

  const toneGuides: Record<string, string> = {
    casual: 'friendly and informal, like texting a peer',
    professional: 'professional but warm, not stiff',
    founder_to_founder: 'direct founder-to-founder, peer level, no fluff',
    concise: 'extremely short, every word counts',
    strong_bd: 'confident, sales-focused, clear value prop'
  }
  const toneGuide = toneGuides[tone] || 'professional but warm'

  const channelGuides: Record<string, string> = {
    telegram: 'Telegram DM - no subject line, casual opener, emoji OK',
    linkedin: 'LinkedIn message - professional opener, no subject line',
    twitter: 'Twitter/X DM - very short, casual, to the point',
    email: 'Email - needs subject line, can be slightly longer'
  }
  const channelGuide = channelGuides[channel] || 'LinkedIn message'

  const [learnings, memory] = await Promise.all([
    getOutreachLearnings(supabase),
    outreachMemory(),
  ])

  const { directive: focusDirective } = productFocusDirective({
    company_name,
    customer_category,
    product_to_sell,
    description: use_case,
    business_model: pain_point,
  } as LeadFocusInput)

  const systemPrompt = `You are writing BD outreach messages for Arpit, who leads BD/partnerships for Kima, Aeredium, and Aerpolice.

${PRODUCT_BRAIN}

${HUMAN_RULES}
${learnings.hasData ? `\n${learnings.block}\n` : ''}${memory}

${focusDirective}

MESSAGE STRUCTURE (keep it natural, don't make it look like a checklist):
1. Personal opener based on their specific company/product/trigger
2. The specific pain point they have
3. Our product fit for their situation — which product leads is set by the PRODUCT FOCUS block above
4. Product/use case to sell
5. The product value woven in (follow the PRODUCT FOCUS block for the exact framing)
6. Soft, specific CTA

Return JSON only. No markdown prose.`

  const userPrompt = `Write outreach messages for:
Company: ${company_name}
Contact: ${contact_name || '[Name]'}
Channel: ${channel} (${channelGuide})
Tone: ${tone} (${toneGuide})
Customer category: ${customer_category}
Product to sell: ${product_to_sell}
Use case: ${use_case}
Their pain point: ${pain_point}
Kima fit: ${kima_fit}
Aeredium fit: ${aeredium_fit}
Message length: ${lengthGuide}

Return JSON:
{
  "subject_line": "Email subject line (null for non-email)",
  "message": "First outreach message",
  "followup_1": "Follow-up message after 5-7 days of no reply",
  "followup_2": "Second follow-up (shorter, different angle)",
  "objection_reply": "Reply to common objection 'we already have a solution for this'",
  "call_opening": "Opening line for a cold call",
  "meeting_agenda": "3-bullet agenda for first meeting"
}`

  try {
    const result = await completeWithBanGuard(
      systemPrompt,
      userPrompt,
      { temperature: 0.7, max_tokens: 2000 },
      (p) => ['message', 'followup_1', 'followup_2', 'objection_reply', 'call_opening', 'meeting_agenda']
        .map(k => String(p[k] || '')),
      draftingProvider,
    )
    return NextResponse.json({ success: true, data: result })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI request failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
