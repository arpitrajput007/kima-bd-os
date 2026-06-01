// ============================================================
// Real-time grounded research using OpenAI's web-search model.
//
// Uses gpt-4o-search-preview — same OpenAI key you already have,
// no extra signup, no minimum spend. Real-time web access + citations.
//
// Why this instead of Perplexity:
//   - No $50 minimum — pay per token on your existing OpenAI account
//   - Same quality: real-time search, grounded answers, source URLs
//   - Zero new keys needed
//
// Fails soft — if OpenAI isn't configured, callers get empty strings.
// ============================================================

export function perplexityConfigured(): boolean {
  // Reuses the OpenAI key — always available if the agent is running.
  return !!process.env.OPENAI_API_KEY &&
    process.env.OPENAI_API_KEY !== 'your_openai_api_key_here'
}

export interface PerplexityResponse {
  content: string
  citations: string[]
}

// Core research call via OpenAI's gpt-4o-search-preview (real-time web search).
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

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: opts.model ?? 'gpt-4o-search-preview',
        messages,
        max_tokens: opts.maxTokens ?? 1000,
        web_search_options: { search_context_size: 'medium' },
      }),
      signal: AbortSignal.timeout(35000),
    })
    if (!res.ok) return { content: '', citations: [] }
    const data = await res.json()
    const content: string = data?.choices?.[0]?.message?.content || ''

    // Extract cited URLs from annotations (OpenAI search model format).
    const annotations: { type: string; url_citation?: { url: string } }[] =
      data?.choices?.[0]?.message?.annotations || []
    const citations = annotations
      .filter(a => a.type === 'url_citation' && a.url_citation?.url)
      .map(a => a.url_citation!.url)
      .filter((v, i, arr) => arr.indexOf(v) === i) // dedupe

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
