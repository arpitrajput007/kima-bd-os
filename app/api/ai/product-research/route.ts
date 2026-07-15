import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { claudeJSON, CLAUDE_RESEARCH } from '@/lib/claude'
import { perplexityResearch, perplexityConfigured } from '@/lib/perplexity'
import { FULL_BRAIN } from '@/lib/kima-knowledge'
import type { CustomProductAnalysis } from '@/lib/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Content extraction helpers (mirrors app/api/ai/learn/route.ts) ──────────

async function readUrl(url: string): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: 'text/plain' },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`Could not read URL (status ${res.status})`)
  return await res.text()
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse')
  const data = await pdfParse(buffer, { max: 0 })
  return data.text
}

async function extractDocx(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

function detectFileType(fileName: string, mime: string): 'pdf' | 'docx' | 'text' {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === 'docx' || ext === 'doc') return 'docx'
  return 'text'
}

// Source docs for this feature are product one-pagers / landing pages, not
// entire data rooms — a straight cap (rather than learn route's full
// chunk-and-summarize pipeline) keeps this fast while still giving Claude
// more than enough to work with.
const MAX_CONTENT_CHARS = 18000
function capContent(text: string): string {
  if (text.length <= MAX_CONTENT_CHARS) return text
  return text.slice(0, MAX_CONTENT_CHARS) + `\n\n[...content truncated at ${MAX_CONTENT_CHARS.toLocaleString()} chars...]`
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''

    let name = ''
    let sourceType: 'url' | 'document' | 'text' = 'text'
    let sourceUrl: string | null = null
    let sourceFilename: string | null = null
    let rawContent = ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      name = (formData.get('name') as string) || ''
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      if (!name.trim()) return NextResponse.json({ error: 'Product name is required' }, { status: 400 })

      sourceType = 'document'
      sourceFilename = file.name

      const buffer = Buffer.from(await file.arrayBuffer())
      const fileType = detectFileType(file.name, file.type || '')

      try {
        if (fileType === 'pdf') rawContent = await extractPdf(buffer)
        else if (fileType === 'docx') rawContent = await extractDocx(buffer)
        else rawContent = buffer.toString('utf-8')
      } catch {
        return NextResponse.json({ error: 'Could not read that document. Try a PDF, DOCX, or plain text file.' }, { status: 400 })
      }
    } else {
      const body = await req.json()
      name = (body.name as string) || ''
      sourceType = body.sourceType === 'url' ? 'url' : 'text'

      if (!name.trim()) return NextResponse.json({ error: 'Product name is required' }, { status: 400 })

      if (sourceType === 'url') {
        const url = (body.content as string) || ''
        if (!url.startsWith('http')) return NextResponse.json({ error: 'Enter a valid URL starting with http(s)://' }, { status: 400 })
        sourceUrl = url
        try {
          rawContent = await readUrl(url)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Could not read that URL'
          return NextResponse.json({ error: msg }, { status: 400 })
        }
      } else {
        rawContent = (body.content as string) || ''
      }
    }

    if (!rawContent || rawContent.trim().length < 50) {
      return NextResponse.json({ error: 'Not enough content to research — paste a longer description, a working URL, or a more detailed document.' }, { status: 400 })
    }

    const contentForAnalysis = capContent(rawContent.trim())

    // Supplement with live web research when we have a URL to ground it —
    // catches competitor/market context that won't be on the product's own page.
    let webContext = ''
    let webCitations: string[] = []
    if (sourceType === 'url' && sourceUrl && perplexityConfigured()) {
      const { content, citations } = await perplexityResearch(
        `Research the product/service "${name}" (${sourceUrl}) for a B2B sales team doing competitive and market analysis.
Answer specifically: Who are its known competitors? What market category is it in? What do reviews or customers say about it? Any funding, traction, or adoption signals?`,
        'You are a market research analyst. Give concise, factual, sourced answers.',
        { maxTokens: 700 }
      )
      webContext = content
      webCitations = citations
    }

    const system = `You are the product intelligence analyst for a BD (business development) team. A rep just gave you a new product or service to research — it may be one of the team's own offerings or a third-party product they're evaluating. Your job is to produce a rigorous, meeting-ready go-to-market analysis they can act on immediately: is it worth pursuing, who wants it, and how do they find those buyers.

Be specific and concrete — no generic filler like "businesses of all sizes" or "companies looking to grow." Ground every claim in the source content actually provided. If the content doesn't support a strong claim, say so honestly — a "Weak Fit" or "Not a Fit" verdict is a valid, useful answer, not a failure.

For broader market/customer context (the team's own product landscape, target categories, ICPs), use this as background — it may or may not be directly relevant to the product being analyzed now:

${FULL_BRAIN}`

    const user = `Product/service name: ${name}

SOURCE CONTENT (from ${sourceType === 'url' ? sourceUrl : sourceType === 'document' ? sourceFilename : 'pasted text'}):
${contentForAnalysis}
${webContext ? `\nADDITIONAL LIVE WEB RESEARCH:\n${webContext}` : ''}

Analyze this product and return this exact JSON structure:
{
  "layman_explanation": "2-4 sentences explaining what this product does in plain, non-technical language — as if explaining to a smart friend outside the industry",
  "market_fit": {
    "verdict": "Strong Fit" | "Moderate Fit" | "Weak Fit" | "Not a Fit",
    "reasoning": ["3-5 specific bullet points backing the verdict, citing what's in the source content"]
  },
  "use_cases": ["4-6 concrete, real-life usage scenarios — name the type of user/company and exactly what they do with it, not generic statements"],
  "gap_filled": ["2-4 bullet points on what's broken, missing, or painful today that this product solves"],
  "icp": {
    "description": "1-2 sentence summary of the ideal customer profile",
    "segments": ["4-6 concrete customer segments or personas, specific not generic"]
  },
  "where_to_find_customers": ["5-8 concrete, actionable channels: specific directories, communities, marketplaces, event/conference types, search queries, or platforms where these customers can actually be found"],
  "fastest_closing_segments": [{ "segment": "specific segment name", "why": "1-2 sentences on why this segment has a short sales cycle — existing urgent pain, budget already allocated, small buying committee, etc." }],
  "sources": ["array of URLs actually used from the web research above, if any — omit or leave empty if none"]
}`

    const analysis = await claudeJSON<CustomProductAnalysis>({
      system,
      user,
      model: CLAUDE_RESEARCH,
      maxTokens: 3000,
    })

    if (webCitations.length && !analysis.sources?.length) {
      analysis.sources = webCitations.slice(0, 5)
    }

    const { data: row, error } = await supabase
      .from('custom_products')
      .insert({
        name: name.trim(),
        source_type: sourceType,
        source_url: sourceUrl,
        source_filename: sourceFilename,
        analysis,
        status: 'active',
      })
      .select('*')
      .single()

    if (error) {
      if (error.message?.includes('does not exist') || error.code === 'PGRST205') {
        return NextResponse.json({ error: 'Database not set up yet — run supabase/add-custom-products.sql in your Supabase SQL editor, then try again.' }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, product: row })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Product research failed'
    console.error('[product-research route error]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
