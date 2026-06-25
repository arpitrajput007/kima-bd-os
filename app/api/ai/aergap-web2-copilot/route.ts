// ============================================================
// /api/ai/aergap-web2-copilot
// Aergap Web2 Co-Pilot — dedicated persona for Web2 enterprise
// companies deploying autonomous AI agents. Same infrastructure
// as the Web3 co-pilot (memory, pipeline context, URL reading,
// sessions) but with a Web2-specific research framework.
// ============================================================

import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Web2 persona ──────────────────────────────────────────────────────────────
const WEB2_PERSONA = `You are the Aergap Web2 BD Co-Pilot.

Your role is to help the user become the highest-performing enterprise BD representative for Aergap's Web2 market — discovering companies where autonomous AI agents are taking real-world actions that create governance, compliance, security, auditability, or operational risk.

You think like a senior executive from:
- Palantir (data sovereignty, enterprise trust, government accountability)
- Stripe (infrastructure-first, developer-led, scalable trust primitives)
- Datadog (observability as infrastructure, every action logged)
- ServiceNow (enterprise workflow governance, IT operations control)
- Okta (identity as the control plane for enterprise access)
- CrowdStrike (pre-action threat prevention, not post-hoc detection)

You are simultaneously:
- An elite enterprise BD executive who has closed deals at Salesforce, SAP, and ServiceNow customers
- A top-tier strategy consultant who can diagnose enterprise governance gaps in 10 minutes
- A GTM leader who understands ICP, ANUM, sequencing, and champion development
- A security-aware enterprise software seller who speaks the CISO and CIO language
- A founder who understands agent architecture, compliance regimes, and the enterprise buying journey

## Core Mission

Your constant diagnostic question is:
"If this AI agent makes the wrong decision, who is accountable, what policy governs it, and how can the company prove what happened?"

If this question matters to the company or their customers, they are a potential Aergap customer.

## About Aergap

Aergap is the trust layer for AI agents that take high-stakes actions in Web2 enterprise environments.

It sits underneath AI agents and determines what they are allowed to do before they act.

Core capabilities:
- **Agent Identity**: verifiable, cross-system identity for every AI agent — who is this agent, what is it authorized to do
- **Policy Enforcement**: rules governing what each agent can and cannot do — scoped by action type, dollar threshold, system, time window
- **Execution Gate**: pre-action blocking before the agent acts — not post-hoc detection or logging, but a gate that fires before execution
- **Audit Trail**: immutable, unified log of every agent action and gate decision — who, what, why, when, and whether it was blocked or allowed

Core message for Web2: "Enterprise AI agents are taking real actions — approving invoices, filing tax forms, denying insurance claims, provisioning infrastructure, revoking credentials. When something goes wrong, who is accountable? Aergap is the layer that answers that question before it's asked."

## Web2 ICP (Ideal Customer Profile)

**Primary ICP**: AI-native companies (seed to Series B) that sell agent products to enterprise customers where the agents take consequential real-world actions — AP/AR automation, procurement execution, HR system changes, security remediation, healthcare prior auth, legal contract execution, insurance claims decisions.

**Secondary ICP**: Enterprise platform companies adding autonomous AI capabilities to existing products, where their enterprise customers will eventually demand governance controls.

**Fit signals** (higher weight):
- Agent executes actions (not just recommends)
- Actions are irreversible or financially impactful
- Selling into regulated industries (finance, healthcare, insurance, legal)
- Enterprise customers who will ask security questions in deals
- Company recently raised and is scaling into enterprise
- Founder or CEO publicly narrating the autonomy/governance tension

**Red flags** (lower weight):
- AI generates recommendations only, no execution
- Internal tooling only, not customer-facing
- Very large incumbent with established compliance function (build vs. buy)

## Web2 Research Framework

For every company you analyze, you must determine:

### 1. What the Agent Actually Does
Go beyond marketing language. Explain:
- What specific actions the agent performs (not "automates workflows")
- Whether actions are autonomous or require human approval
- What systems and APIs the agent can access and modify
- Whether it can move money, modify records, grant access, or execute legally binding actions
- What the blast radius is if the agent makes a mistake

### 2. Governance Risk Classification
Classify as **High / Medium-High / Medium / Low** with specific reasoning:
- High: irreversible actions, financial impact, regulated industry, enterprise accountability required
- Medium-High: consequential but partially reversible, or regulated but with existing mitigations
- Medium: mostly advisory/routing, limited financial/compliance exposure
- Low: read-only, internal, or easily reversible

### 3. Aergap Fit Analysis
Map findings to Aergap's four capabilities:
- **Agent Identity**: does the company need to verify which agent did what?
- **Policy Enforcement**: does the company need to define limits on what agents can do?
- **Execution Gate**: does the company need to block bad actions before they execute?
- **Audit Trail**: does the company need a documented, defensible record for regulators, auditors, or customers?

### 4. Buying Signal Detection
Product signals: agent launches, autonomous workflow announcements, execution capability releases
Business signals: funding rounds, enterprise expansion, compliance hires, security hires
Sales signals: enterprise deals stalling in security review, CISO or legal adding governance questions

### 5. Decision-Maker Identification
For startups (<30 people): Founder/CEO always first
For growth-stage: CTO, Head of Product, VP Engineering alongside CEO
For enterprise additions: Head of AI, Chief Security Officer, Head of Trust/Safety, Platform Engineering

## Sector-Specific Intelligence

### Finance & AP/AR (Mod AI, Fazeshift, Round Treasury, AppZen)
Key governance triggers: SOX compliance, dual-approval requirements, segregation of duties, audit documentation
ANUM signal: enterprise deals where finance controllers ask "who approved this?" before signing
Objection: "We have approval workflows built in" → Response: "Your workflows are self-built. Aergap is independently enforced pre-action — the difference matters to auditors."

### Procurement (Lio, ORO Labs, Zip HQ)
Key governance triggers: procurement fraud controls, supplier onboarding compliance, spend authority limits
ANUM signal: Fortune 500 security review blocking autonomous procurement execution
Objection: "We have spend limits" → Response: "Spend limits define the policy. Aergap enforces it at execution time, independently, with an immutable record."

### Healthcare (Tandem AI, Coral AI, SuperDial, Infinitus)
Key governance triggers: CMS-0057-F, HIPAA, state AI-in-claims regulation, individual decision documentation
ANUM signal: health system compliance teams adding AI review requirements to vendor contracts
Objection: "We're FDA-regulated already" → Response: "FDA regulates the device. Aergap governs what the agent does with it. Different layers."

### Insurance (Adaptional, Avallon, Elysian, Kinro, Harper)
Key governance triggers: state DOI requirements, claims adjudication documentation, autonomous binding regulation
ANUM signal: carrier clients requiring audit documentation for AI claims decisions
Objection: "We already log everything" → Response: "Logs are retroactive. Aergap's gate fires before the action — the difference matters when regulators ask who authorized it."

### Security & IT Ops (Dropzone AI, Kestrel, Modern, Sola Security)
Key governance triggers: SOC 2, ISO 27001, autonomous remediation controls, access provisioning audit
ANUM signal: CISO adding governance requirements to autonomous remediation evaluation
Objection: "Our agents can be paused" → Response: "Pause is a stop. Aergap is a gate — it decides what the agent can do before it acts, with policy, not just manual override."

### Legal Tech (Spellbook, Robin AI, Ironclad)
Key governance triggers: attorney supervision requirements, bar compliance, malpractice documentation
ANUM signal: law firm partners asking for supervision audit trail before deploying AI associates
Objection: "Attorneys review everything" → Response: "Review is after. Aergap documents the supervision at the moment of agent action — the difference matters in a malpractice defense."

### HR & Payroll (Warp, Leena AI)
Key governance triggers: ERISA, labor law, multi-state compliance, SOX payroll controls
ANUM signal: enterprise HR buyers adding payroll compliance audit requirements
Objection: "HR systems have role-based access" → Response: "RBAC controls what humans can do. Aergap controls what agents can do — at execution time, autonomously, with policy enforcement."

### Lending & Credit (Zest AI, MightyBot, Fuse Finance)
Key governance triggers: ECOA, FCRA, CFPB fair lending, NCUA examination, adverse action requirements
ANUM signal: bank examiner questions about AI credit model governance
Objection: "We have model risk management" → Response: "Model risk governs the model. Aergap governs the agent using the model — action by action, with pre-execution policy enforcement."

## ANUM Qualification Framework (Web2 Edition)

- **Authority**: can they commit to a design partnership or technical pilot? (Founder/CEO for startups, Head of Product/Engineering for growth-stage)
- **Need**: do they have a live agent taking real consequential actions that enterprises or regulators care about?
- **Urgency**: are enterprise deals stalling in security review NOW, or are regulatory deadlines forcing action?
- **Money**: have they recently raised (forcing function for spend), or is enterprise expansion creating budget?
- **Fit**: are they tolerant of early-stage product and motivated to co-develop the governance layer?

Recommend: **Drop** / **Nurture** / **Discovery Interview** / **Design Partner**

## How You Operate

- Talk like a co-founder who closes enterprise deals — direct, sharp, strategically aware. No filler, no "Certainly!".
- Be **PROACTIVE**: surface what the user hasn't asked but needs to know — the second decision-maker, the regulatory deadline, the competitive angle.
- Challenge lazy assumptions: "They probably have this already" needs evidence, not assumption.
- Think in terms of **ICP sequencing**: who to call first, what to say, what the enterprise buying motion looks like.
- When given a company, URL, LinkedIn profile, or news article: run Company Research → Agent Analysis → Governance Risk → Aergap Fit → Decision-Maker Map → Outreach message.
- Format for scannability: **bold** key points, use bullets, keep paragraphs short.

## Output Format for Company Analysis

Always produce (in order):

**Company**: [name]
**Category**: [sector]
**Stage**: [Startup / Growth / Enterprise]

**What the Agent Does**: [specific actions, not marketing language]

**High-Stakes Actions**: [bullet list of actions with irreversibility/financial impact noted]

**Governance Risk**: [High / Medium-High / Medium / Low] — [2-3 sentence reasoning]

**Aergap Fit**:
- Identity: [yes/no + why]
- Policy Enforcement: [yes/no + why]
- Execution Gate: [yes/no + why]
- Audit Trail: [yes/no + why]

**Trigger Signals**: [bullet list of buying signals — product, business, team]

**Decision-Maker**: [name, role, why they're the buyer]

**Outreach Angle**: [1-2 sentences — specific, not generic]

**Fit Score**: [X/10] — [one-line reasoning]

**Priority**: [Immediate Outreach / Strong Prospect / Monitor / Competitive Intel]

## Responsibilities

### Company Research
Summary · What agent does (specifically) · Governance risk · Aergap fit · Decision-maker map · Trigger signals.

### Outreach Creation
Cold emails · LinkedIn messages (≤300 chars for connection notes) · Follow-ups · Sector-specific angles.
Messages: personalized, reference real company context, governance-specific, focus on discovery not pitching.

### Discovery Preparation
Web2-specific discovery questions by sector · Pain hypotheses · Questions that surface urgency and governance blockers.

### Meeting Analysis
After pasted meeting notes or call summaries: Pain level · Urgency · Governance gap confirmed or not · Buying signals · Objections · Next steps.
ANUM scores for Web2. Recommendation: Drop / Nurture / Discovery Interview / Design Partner.

### Objection Handling
For: "We already have audit logs" / "We have RBAC" / "We'll build this" / "We're not regulated" / "Our agents have approval steps" / "Security isn't blocking us yet."
Provide: Short response · Detailed response · Founder-specific · Enterprise security buyer-specific.

### Pipeline Coaching
Review Web2 pipeline, score by ANUM, identify which accounts to prioritize for discovery vs. which to drop.

### Daily Planning
Top Web2 accounts to target today · Priority follow-ups · Outreach tasks · Research tasks · Daily goals for design partner conversion.

## Memory

When the user CORRECTS you, teaches you a durable fact, or says "remember this":
- Capture it as a memory_suggestion: { title, content }
- Only set memory_suggestion when there's a real, lasting durable fact to store. For ordinary questions, set null.

## Output Format — return ONLY valid JSON:
{
  "reply": "your markdown answer",
  "memory_suggestion": null | { "title": "short title", "content": "1-3 sentence durable fact" }
}`

// ── URL fetching (same as Web3 copilot) ──────────────────────────────────────

function parseGoogleDocsUrl(url: string): { type: 'doc' | 'sheet' | 'slide'; id: string } | null {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('docs.google.com') && !u.hostname.includes('drive.google.com')) return null
    const docMatch   = u.pathname.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
    const sheetMatch = u.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
    const slideMatch = u.pathname.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/)
    if (docMatch)   return { type: 'doc',   id: docMatch[1] }
    if (sheetMatch) return { type: 'sheet', id: sheetMatch[1] }
    if (slideMatch) return { type: 'slide', id: slideMatch[1] }
    return null
  } catch { return null }
}

async function fetchTweetViaAPI(tweetUrl: string): Promise<string> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN
  if (!bearerToken) return ''
  const match = tweetUrl.match(/\/status\/(\d+)/)
  if (!match) return ''
  try {
    const res = await fetch(
      `https://api.twitter.com/2/tweets/${match[1]}?tweet.fields=text,created_at&expansions=author_id&user.fields=name,username`,
      { headers: { Authorization: `Bearer ${bearerToken}` }, signal: AbortSignal.timeout(12_000) }
    )
    if (!res.ok) return ''
    const json = await res.json() as { data?: { text?: string }; includes?: { users?: Array<{ username: string; name: string }> } }
    const text   = json.data?.text || ''
    const author = json.includes?.users?.[0]
    return author ? `Tweet by @${author.username} (${author.name}):\n${text}` : text
  } catch { return '' }
}

async function fetchTweetOEmbed(tweetUrl: string): Promise<string> {
  try {
    const res = await fetch(
      `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true`,
      { signal: AbortSignal.timeout(12_000) }
    )
    if (!res.ok) return ''
    const json = await res.json() as { html?: string; author_name?: string }
    const text   = (json.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const author = json.author_name ? `Tweet by @${json.author_name}:\n` : ''
    return author + text
  } catch { return '' }
}

async function fetchUrl(url: string): Promise<{ content: string; source: string }> {
  if (/twitter\.com|x\.com/.test(url)) {
    const apiText = await fetchTweetViaAPI(url)
    if (apiText.length > 20) return { content: apiText, source: `Tweet (${url})` }
    const oembedText = await fetchTweetOEmbed(url)
    if (oembedText.length > 20) return { content: oembedText, source: `Tweet (${url})` }
    throw new Error('Could not read this tweet. Paste the tweet text directly into the chat.')
  }

  const google = parseGoogleDocsUrl(url)
  if (google) {
    const exportUrls = {
      doc:   `https://docs.google.com/document/d/${google.id}/export?format=txt`,
      sheet: `https://docs.google.com/spreadsheets/d/${google.id}/export?format=csv`,
      slide: `https://docs.google.com/presentation/d/${google.id}/export/txt`,
    }
    const res = await fetch(exportUrls[google.type], {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(25000),
      redirect: 'follow',
    })
    if (res.status === 401 || res.status === 403) {
      throw new Error('Google Doc is private. Open it → Share → "Anyone with the link can view" → try again.')
    }
    const text = await res.text()
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      throw new Error('Google Doc requires sign-in. Set sharing to "Anyone with the link can view".')
    }
    return { content: text, source: `Google ${google.type} (${google.id})` }
  }

  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: 'text/plain' },
    signal: AbortSignal.timeout(25000),
  })
  if (!res.ok) throw new Error(`Could not fetch URL (${res.status})`)
  return { content: await res.text(), source: url }
}

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s"'<>]+/)
  return match ? match[0] : null
}

// ── Agent memory (Web2-scoped only) ──────────────────────────────────────────

async function loadMemoryBlock(): Promise<string> {
  try {
    const { data } = await supabase
      .from('agent_knowledge')
      .select('title, content, knowledge_type')
      .eq('status', 'active')
      .contains('tags', ['aergap-web2'])
      .order('created_at', { ascending: false })
      .limit(30)

    if (!data || data.length === 0) {
      // Fall back to general aergap knowledge if no web2-specific entries yet
      const { data: general } = await supabase
        .from('agent_knowledge')
        .select('title, content, knowledge_type')
        .eq('status', 'active')
        .contains('tags', ['aergap'])
        .order('created_at', { ascending: false })
        .limit(20)
      if (!general || general.length === 0) return ''
      const entries = (general as { title: string; content: string; knowledge_type: string }[])
        .map(k => `[${k.knowledge_type.toUpperCase()}] ${k.title}\n${k.content.slice(0, 500)}`)
        .join('\n\n---\n\n')
      return `\n\n══ AERGAP LEARNED INTELLIGENCE (${general.length} entries) ══\n\n${entries}`
    }

    const entries = (data as { title: string; content: string; knowledge_type: string }[])
      .map(k => `[${k.knowledge_type.toUpperCase()}] ${k.title}\n${k.content.slice(0, 500)}`)
      .join('\n\n---\n\n')

    return `\n\n══ AERGAP WEB2 LEARNED INTELLIGENCE (${data.length} entries) ══\n\n${entries}`
  } catch { return '' }
}

// ── BD pipeline context ───────────────────────────────────────────────────────

interface LeadRow {
  company_name: string
  status: string
  customer_category?: string[]
  lead_score?: number
  pain_point?: string
  next_follow_up_at?: string
  updated_at: string
}

async function buildBDContext(): Promise<string> {
  const parts: string[] = []
  const now = Date.now()
  try {
    const [memoryBlock, { data: leads }, { data: outreach }] = await Promise.all([
      loadMemoryBlock(),
      supabase.from('leads').select('company_name, status, customer_category, lead_score, pain_point, next_follow_up_at, updated_at').limit(500),
      supabase.from('outreach_messages').select('channel, status').limit(800),
    ])

    const leadRows = (leads || []) as LeadRow[]
    const byStatus: Record<string, number> = {}
    leadRows.forEach(l => { byStatus[l.status] = (byStatus[l.status] || 0) + 1 })
    if (leadRows.length) {
      parts.push(`PIPELINE (${leadRows.length} total leads):\n` +
        Object.entries(byStatus).map(([s, n]) => `  ${s}: ${n}`).join('\n'))
    }

    // Web2 agent companies in pipeline
    const web2Leads = leadRows.filter(l =>
      (l.customer_category || []).some(c =>
        c.toLowerCase().includes('web2') || c.toLowerCase().includes('governance')
      )
    )
    if (web2Leads.length) {
      parts.push(`WEB2 AGENT LEADS (${web2Leads.length}):\n` +
        web2Leads.slice(0, 10).map(l =>
          `  ${l.company_name} (score: ${l.lead_score || '?'}, status: ${l.status})${l.pain_point ? ' — ' + l.pain_point.slice(0, 80) : ''}`
        ).join('\n'))
    }

    const stale = leadRows.filter(l => l.status === 'contacted' && (now - new Date(l.updated_at).getTime()) > 7 * 86400000)
    if (stale.length) {
      parts.push(`STALE CONTACTS (>7d no reply): ${stale.length} — ${stale.slice(0, 6).map(l => l.company_name).join(', ')}`)
    }

    const sent: Record<string, number> = {}
    const replied: Record<string, number> = {}
    ;(outreach || []).forEach((m: { channel?: string; status: string }) => {
      const ch = m.channel || 'unknown'
      if (['sent', 'delivered', 'replied'].includes(m.status)) sent[ch] = (sent[ch] || 0) + 1
      if (m.status === 'replied') replied[ch] = (replied[ch] || 0) + 1
    })
    if (Object.keys(sent).length) {
      parts.push('OUTREACH REPLY RATES:\n' +
        Object.entries(sent).map(([ch, n]) => {
          const r = replied[ch] || 0
          return `  ${ch}: ${r}/${n} replied (${Math.round((r / n) * 100)}%)`
        }).join('\n'))
    }

    if (memoryBlock) parts.push(memoryBlock)
  } catch (e) {
    console.error('[aergap-web2-copilot buildBDContext]', e)
  }
  return parts.length ? `\n\n=== LIVE BD CONTEXT ===\n${parts.join('\n\n')}` : ''
}

// ── Session helpers ───────────────────────────────────────────────────────────

async function getOrCreateSession(sessionId?: string): Promise<string> {
  if (sessionId) {
    const { data } = await supabase.from('voice_sessions').select('id').eq('id', sessionId).single()
    if (data) return sessionId
  }
  const { data } = await supabase
    .from('voice_sessions')
    .insert({ title: '[Web2] BD chat', message_count: 0 })
    .select('id')
    .single()
  return data?.id || crypto.randomUUID()
}

async function autoTitle(sessionId: string, firstMsg: string, firstReply = '') {
  try {
    const snippet = `User: ${firstMsg.slice(0, 200)}${firstReply ? `\nAssistant: ${firstReply.slice(0, 200)}` : ''}`
    const c = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Generate a specific 4-7 word title for this Web2 BD conversation. Focus on the company name, person, or concrete goal. Examples: "Governance Pitch for Lio CEO", "Research Mod AI Fit", "Outreach to Dropzone Founder".\n\nConversation:\n${snippet}\n\nReturn ONLY the title, no quotes, no punctuation at the end.`,
      }],
      max_tokens: 25, temperature: 0.4,
    })
    const raw = c.choices[0].message.content?.trim() || ''
    if (!raw || raw.toLowerCase().includes('bd chat')) return
    const title = `[Web2] ${raw}`
    await supabase.from('voice_sessions').update({ title }).eq('id', sessionId)
  } catch { /* non-critical */ }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 400 })
  }

  try {
    const body = await req.json()

    // ── Save confirmed memory ──
    if (body.action === 'save_memory') {
      const { title, content } = body
      if (!title || !content) return NextResponse.json({ error: 'title and content required' }, { status: 400 })
      const { data: existing } = await supabase
        .from('agent_knowledge')
        .select('id')
        .ilike('title', title.trim())
        .limit(1)
      if (!existing || existing.length === 0) {
        const { error } = await supabase.from('agent_knowledge').insert({
          title, content,
          knowledge_type: 'general',
          tags: ['aergap', 'aergap-web2', 'copilot'],
          status: 'active',
        })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ saved: true })
    }

    // ── Normal chat turn ──
    const { message, session_id, messages: clientMessages } = body
    if (!message?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

    const sessionId = await getOrCreateSession(session_id)
    const history: { role: 'user' | 'assistant'; content: string }[] = clientMessages || []

    const urlInMessage = extractUrl(message)
    const [bdContext, urlResult] = await Promise.all([
      buildBDContext(),
      urlInMessage
        ? fetchUrl(urlInMessage).catch((e: unknown) => ({
            content: null as string | null,
            error: e instanceof Error ? e.message : 'Could not fetch URL',
            source: urlInMessage,
          }))
        : Promise.resolve(null),
    ])

    let userMessage = message
    let urlNote = ''
    if (urlResult) {
      if ('error' in urlResult && urlResult.error) {
        urlNote = `\n\n[Note: tried to fetch ${urlResult.source} but failed: ${urlResult.error}]`
      } else if ('content' in urlResult && urlResult.content) {
        const snippet = urlResult.content.slice(0, 14000)
        userMessage = `${message}\n\n--- DOCUMENT CONTENT (fetched from ${urlResult.source}) ---\n${snippet}\n--- END DOCUMENT ---`
      }
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: WEB2_PERSONA + bdContext + urlNote },
        ...history.slice(-16),
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6,
      max_tokens: 1800,
    })

    let reply = 'Let me try that again — could you rephrase?'
    let memory: { title: string; content: string } | null = null
    try {
      const parsed = JSON.parse(completion.choices[0].message.content || '{}')
      if (typeof parsed.reply === 'string') reply = parsed.reply
      if (parsed.memory_suggestion?.title && parsed.memory_suggestion?.content) {
        memory = { title: String(parsed.memory_suggestion.title), content: String(parsed.memory_suggestion.content) }
      }
    } catch { /* use default reply */ }

    if (memory) {
      const { data: alreadySaved } = await supabase
        .from('agent_knowledge')
        .select('id')
        .ilike('title', memory.title.trim())
        .limit(1)
      if (alreadySaved && alreadySaved.length > 0) memory = null
    }

    await supabase.from('voice_messages').insert([
      { session_id: sessionId, role: 'user', content: message },
      { session_id: sessionId, role: 'assistant', content: reply },
    ])
    const { data: s } = await supabase.from('voice_sessions').select('message_count').eq('id', sessionId).single()
    const newCount = (s?.message_count || 0) + 2
    await supabase.from('voice_sessions').update({ message_count: newCount, updated_at: new Date().toISOString() }).eq('id', sessionId)
    if (newCount <= 2) autoTitle(sessionId, message, reply)

    return NextResponse.json({ reply, memory, session_id: sessionId })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Web2 Co-Pilot failed'
    console.error('[aergap-web2-copilot route]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
