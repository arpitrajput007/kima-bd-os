// ============================================================
// Real-time grounded research using Perplexity Sonar API.
//
// sonar-pro: online search, deep research, citations included.
// Falls back gracefully if PERPLEXITY_API_KEY is not set.
// ============================================================

export function perplexityConfigured(): boolean {
  return !!process.env.PERPLEXITY_API_KEY &&
    process.env.PERPLEXITY_API_KEY !== 'your_perplexity_api_key_here'
}

export interface PerplexityResponse {
  content: string
  citations: string[]
}

// Core research call via Perplexity Sonar (real-time web search with citations).
export async function perplexityResearch(
  prompt: string,
  systemPrompt?: string,
  opts: { model?: string; maxTokens?: number } = {}
): Promise<PerplexityResponse> {
  if (!perplexityConfigured()) return { content: '', citations: [] }
  try {
    const messages: { role: string; content: string }[] = []
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
    messages.push({ role: 'user', content: prompt })

    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: opts.model ?? 'sonar-pro',
        messages,
        max_tokens: opts.maxTokens ?? 1000,
      }),
      signal: AbortSignal.timeout(35000),
    })

    if (!res.ok) return { content: '', citations: [] }
    const data = await res.json()
    const content: string = data?.choices?.[0]?.message?.content || ''
    // Perplexity returns citations as a top-level array of URLs
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

Be specific and cite dates. Say "no recent news found" if nothing relevant.`,
    'You are a senior BD researcher. Give concise, factual answers with sources. Focus on what is actionable for a BD outreach pitch.',
    { maxTokens: 800 }
  )

  if (!content) return { trigger: '', sourceUrls: [] }
  return { trigger: content.slice(0, 1500), sourceUrls: citations.slice(0, 3) }
}

// Quick company snapshot — enriches description during discovery.
export async function quickCompanySnapshot(
  companyName: string,
  website: string,
): Promise<string> {
  if (!perplexityConfigured()) return ''
  const { content } = await perplexityResearch(
    `In 2-3 sentences: what does ${companyName} (${website}) do, who are their customers, and how do they handle cross-chain or payment settlement today?`,
    undefined,
    { maxTokens: 300 }
  )
  return content
}
