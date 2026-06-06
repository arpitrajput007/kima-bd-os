import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PRODUCT_BRAIN, SINGLE_API_LINE } from '@/lib/kima-knowledge'
import { MAX_FOLLOWUPS, getOutreachLearnings } from '@/lib/outreach'
import { routeJSONWithBanGuard, type AIProvider } from '@/lib/ai-router'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Rules that make every message read as a hand-written, researched DM — not a
// blast. Shared by both the auto-draft and the custom-config flows.
const HUMAN_RULES = `WRITE LIKE A REAL PERSON WHO DID THE RESEARCH — NOT A TEMPLATE.

HARD BANS (never use these — they scream "mass outreach"):
- "I hope this email/message finds you well", "I wanted to reach out", "I came across", "I noticed your company"
- "game-changer", "revolutionary", "cutting-edge", "synergy", "leverage", "seamless", "robust", "best-in-class", "in today's fast-paced world"
- "circle back", "touch base", "pick your brain", "hop on a quick call", "let's connect"
- "I'd love to", "we are excited to", "we believe", over-the-top flattery
- generic openers that could be sent to any company

REQUIRED:
- Open with a SPECIFIC detail about THEM: the exact trigger/event, a chain/provider they use, a number, a recent hack/launch/funding — something only someone who researched them would know. Reference the source if there is one.
- Tie that detail to ONE concrete problem Kima/Aeredium fixes for them. Be specific, not a feature dump.
- Sound human: contractions, varied sentence length, plain words. A small amount of imperfection is good. No corporate voice.
- Confident peer tone, never pushy or salesy. No exclamation spam, at most one emoji and only if it fits the channel.
- End with a low-friction, specific CTA (a yes/no question or a tiny ask), and vary it across drafts.
- No signature block, no "Best regards". Sign-offs should be minimal or omitted (the human sends from their own account).
- Naturally include this idea once where it fits (don't force it): "${SINGLE_API_LINE}"`

// High-signal phrases that scream "mass outreach". GPT sometimes ignores the
// prompt ban, so we scan the output and force one rewrite if any slip through.
const BANNED_PHRASES = [
  'i hope this email finds you well', 'i hope this message finds you well',
  'hope this finds you well', 'hope this email finds you', 'hope this message finds you',
  'i wanted to reach out', 'just wanted to reach out', 'i came across', 'i noticed your company',
  'game-changer', 'game changer', 'revolutionary', 'cutting-edge', 'cutting edge',
  'synergy', 'seamless', 'best-in-class', "in today's fast-paced world",
  'circle back', 'touch base', 'pick your brain', 'hop on a quick call',
  "let's connect", 'we are excited to', "we're excited to", 'just bumping this',
  'just circling back', 'just following up',
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

  const learnings = await getOutreachLearnings(supabase)

  const systemPrompt = `You are Arpit, leading BD/partnerships for Kima and Aeredium. You write your own outreach DMs by hand after researching each prospect.

${PRODUCT_BRAIN}

${HUMAN_RULES}
${learnings.hasData ? `\n${learnings.block}\n` : ''}
You will produce THREE drafts for the SAME lead. They must NOT feel like the same message resized — each uses a DIFFERENT hook/angle from the research and a different length and channel:
1. "short"  → a Telegram / X DM. 2-3 sentences. Punchy, one sharp hook.
2. "medium" → a LinkedIn message. ~4-5 sentences. A different angle than the short one.
3. "long"   → an email (include a subject line). ~6-8 sentences, a bit more context and proof, yet still tight and human.

Return JSON only.`

  const userPrompt = `Here is everything I researched on this lead. Write the 3 drafts so they could ONLY have been written for this specific company.

${leadContextBlock(lead as LeadRow)}

Return JSON exactly:
{
  "drafts": [
    { "id": "short",  "label": "Short — Telegram / X DM", "channel": "telegram", "text": "..." },
    { "id": "medium", "label": "Medium — LinkedIn",        "channel": "linkedin", "text": "..." },
    { "id": "long",   "label": "Longer — Email",           "channel": "email", "subject": "...", "text": "..." }
  ]
}`

  try {
    const result = await completeWithBanGuard(
      systemPrompt,
      userPrompt,
      { temperature: 0.85, max_tokens: 2200 },
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

  const learnings = await getOutreachLearnings(supabase)

  const isFinal = stage >= MAX_FOLLOWUPS - 1
  const systemPrompt = `You are Arpit, leading BD/partnerships for Kima and Aeredium. You're writing a SHORT follow-up to someone who hasn't replied yet. You are not annoyed and not pushy — just persistent and useful.

${PRODUCT_BRAIN}

${HUMAN_RULES}
${learnings.hasData ? `\n${learnings.block}\n` : ''}
FOLLOW-UP RULES:
- Keep it SHORT — 1 to 3 sentences. Shorter than the first message.
- Do NOT repeat the same hook or pitch from the prior message(s). Lead with a DIFFERENT angle: a fresh proof point, a new trigger, a relevant comparison, or a genuinely useful nudge.
- Lightly acknowledge you reached out before without guilt-tripping ("following up" is fine; no "just bumping this" or "circling back").
- ${isFinal
    ? 'This is the LAST follow-up — make it an easy, no-pressure close: a simple yes/no, or "should I close the loop?" so it is painless to reply even with a no.'
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
      { temperature: 0.85, max_tokens: 800 },
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
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
    return NextResponse.json({ error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your .env.local file.' }, { status: 400 })
  }

  const body = await req.json()
  // drafting_ai: 'openai' (default) | 'claude' — user preference from Settings.
  const draftingProvider: AIProvider = body.drafting_ai === 'claude' ? 'claude' : 'openai'

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

  const learnings = await getOutreachLearnings(supabase)

  const systemPrompt = `You are writing BD outreach messages for Arpit, who leads BD/partnerships for Kima and Aeredium.

${PRODUCT_BRAIN}

${HUMAN_RULES}
${learnings.hasData ? `\n${learnings.block}\n` : ''}
MESSAGE STRUCTURE (keep it natural, don't make it look like a checklist):
1. Personal opener based on their specific company/product/trigger
2. The specific pain point they have
3. Kima/Aeredium fit for their situation
4. Product/use case to sell
5. The single-API idea woven in
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
