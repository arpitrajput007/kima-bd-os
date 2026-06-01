import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// AI classifier: given a list of lead "names", decide which are REAL specific
// companies vs generic categories/segments. This is the authoritative check —
// the wordlist heuristic is only a cheap pre-filter.
//
// Returns a map of name → true (real company) / false (generic category).
export async function classifyRealCompanies(names: string[]): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {}
  const unique = Array.from(new Set(names.map(n => (n || '').trim()).filter(Boolean)))
  if (!unique.length || !process.env.OPENAI_API_KEY) {
    unique.forEach(n => { result[n] = true }) // fail open — don't wrongly nuke leads
    return result
  }

  // Batch to keep each request small and reliable.
  const BATCH = 60
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH)
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You decide whether each name is a REAL, SPECIFIC company/brand or a GENERIC category/segment.

REAL company = a specific named business you could google and reach one company's website (e.g. "Binance", "Coinbase", "Circle", "JPMorgan", "MetaMask", "Stripe", "THORChain", "Fireblocks", "Revolut").

GENERIC category = a sector, segment, type, or descriptive grouping — NOT a single company (e.g. "Crypto Exchanges", "Banks", "Fintechs", "RWA Platforms", "Infrastructure", "AI", "Analytics Platforms", "Payments", "Wallets", "DeFi", "Lending Platforms", "Crypto Wallets", "Data Analytics").

Return ONLY valid JSON: { "results": [ { "name": "<exact input name>", "is_company": true|false } ] }`,
          },
          {
            role: 'user',
            content: `Classify each:\n${batch.map(n => `- ${n}`).join('\n')}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 1500,
      })
      const parsed = JSON.parse(completion.choices[0].message.content || '{"results":[]}')
      const arr: { name: string; is_company: boolean }[] = Array.isArray(parsed.results) ? parsed.results : []
      const seen = new Set<string>()
      arr.forEach(r => {
        if (typeof r.name === 'string') { result[r.name.trim()] = r.is_company !== false; seen.add(r.name.trim()) }
      })
      // Anything the model omitted → keep (fail open).
      batch.forEach(n => { if (!seen.has(n) && result[n] === undefined) result[n] = true })
    } catch {
      batch.forEach(n => { if (result[n] === undefined) result[n] = true })
    }
  }
  return result
}
