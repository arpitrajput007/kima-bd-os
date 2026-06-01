// ============================================================
// Perplexity Sonar client — real-time grounded research.
//
// Why Perplexity over GPT-4o for trigger research:
//   - Real-time web access (GPT-4o knowledge cutoff → misses recent events)
//   - Cites sources automatically (so trigger_reason has verifiable URLs)
//   - Sonar Pro is tuned for research synthesis, not just Q&A
//   - Much better at: "Did X raise recently? Get hacked? Launch new product?"
//
// Fails soft — if the key is missing, callers fall back to GPT-4o.
// ============================================================

const PERP_BASE = 'https://api.perplexity.ai'

export function perplexityConfigured(): boolean {
  return !!process.env.PERPLEXITY_API_KEY
}

export interface PerplexityResponse {
  content: string
  citations: string[]
}

// Core research call — uses sonar-pro for deep research.
// Returns the answer text and any citation URLs Perplexity found.
export async function perplexityResearch(
  prompt: string,
  systemPrompt?: string,
  opts: { model?: string; maxTokens?: number } = {}
): Promise<PerplexityResponse> {
  if (!perplexityConfigured()) return { content: '', citations: [] }
  try {
    const body: Record<string, unknown> = {
      model: opts.model ?? 'sonar-pro',
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
      max_tokens: opts.maxTokens ?? 1200,
      temperature: 0.2,
      return_citations: true,
    }

    const res = await fetch(`${PERP_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return { content: '', citations: [] }
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content || ''
    const citations: string[] = Array.isArray(data?.citations) ? data.citations : []
    return { content, citations }
  } catch { return { content: '', citations: [] } }
}

// Research a company's current state, recent news, and BD trigger.
// Returns a structured string to inject into the deepResearch prompt.
export async function researchCompanyTrigger(
  companyName: string,
  website: string,
  description: string,
): Promise<{ trigger: string; sourceUrls: string[] }> {
  if (!perplexityConfigured()) return { trigger: '', sourceUrls: [] }

  const { content, citations } = await perplexityResearch(
    `Research ${companyName} (${website || 'no website'}) for a B2B BD pitch.

Answer these specifically:
1. What have they shipped, announced, or done in the last 90 days? (funding, product launches, partnerships, hacks, expansions)
2. What payment/settlement/cross-chain infrastructure do they currently use?
3. Why is RIGHT NOW a good time to reach out? What is their current growth trigger or pain?
4. Any recent news about them struggling with cross-chain settlement, payment friction, or security?

Be specific and cite dates. If you find no recent news, say so.`,
    `You are a senior BD researcher. Give concise, factual, cited answers. Focus on what's actionable for a BD outreach pitch.`,
    { model: 'sonar-pro', maxTokens: 800 }
  )

  if (!content) return { trigger: '', sourceUrls: [] }

  return {
    trigger: content.slice(0, 1500),
    sourceUrls: citations.slice(0, 3),
  }
}

// Quick company snapshot — used to enrich company description during discovery.
export async function quickCompanySnapshot(
  companyName: string,
  website: string,
): Promise<string> {
  if (!perplexityConfigured()) return ''
  const { content } = await perplexityResearch(
    `In 2-3 sentences: what does ${companyName} (${website}) do, who are their customers, and how do they handle cross-chain or payment settlement today?`,
    undefined,
    { model: 'sonar', maxTokens: 300 }
  )
  return content
}
