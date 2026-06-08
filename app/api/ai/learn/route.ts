import { claudeJSON, claudeText, CLAUDE_RESEARCH } from "@/lib/claude"
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FULL_BRAIN } from '@/lib/kima-knowledge'


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Kima/Aeredium context for the AI synthesis
const KIMA_CONTEXT = `${FULL_BRAIN}

RULE TYPES WE USE:
- prioritize: Companies/signals that should be prioritized
- reject: Companies/signals that should be rejected
- score_boost: Conditions that boost a lead's score
- score_penalty: Conditions that reduce a lead's score
- outreach_style: How to write outreach for specific cases
- source_preference: Which sources/directories to prefer
`

// ── Document extraction helpers ──────────────────────────────────────────────

// Read any URL via Jina.ai (full content, no cap — chunked if needed)
async function readUrl(url: string): Promise<string> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`
    const res = await fetch(jinaUrl, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) throw new Error(`Jina fetch failed: ${res.status}`)
    return await res.text() // no cap — chunked synthesis handles large content
  } catch (e) {
    console.error('[readUrl]', e)
    return ''
  }
}

// Extract text from PDF (all pages)
async function extractPdf(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer, {
      // Parse all pages
      max: 0,
    })
    console.log(`[PDF] ${data.numpages} pages, ${data.text.length} chars extracted`)
    return data.text
  } catch (e) {
    console.error('[extractPdf]', e)
    // Last resort: raw buffer as text (catches some simple PDFs)
    return buffer.toString('utf-8')
  }
}

// Extract text from DOCX / DOC via mammoth
async function extractDocx(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    console.log(`[DOCX] ${result.value.length} chars extracted`)
    if (result.messages?.length > 0) {
      console.log('[DOCX warnings]', result.messages.map((m: { message: string }) => m.message).join('; '))
    }
    return result.value
  } catch (e) {
    console.error('[extractDocx]', e)
    // Fallback: raw text (works for some .doc files)
    return buffer.toString('utf-8')
  }
}

// Detect file type by MIME and extension
function detectFileType(fileName: string, mime: string): 'pdf' | 'docx' | 'doc' | 'csv' | 'text' | 'image' {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) return 'docx'
  if (mime === 'application/msword' || ext === 'doc') return 'doc'
  if (mime === 'text/csv' || ext === 'csv') return 'csv'
  return 'text'
}

// Chunk large text into ~12k char segments for GPT synthesis
function chunkText(text: string, chunkSize = 12000): string[] {
  const chunks: string[] = []
  let i = 0
  while (i < text.length) {
    // Try to break at paragraph boundary
    let end = Math.min(i + chunkSize, text.length)
    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n', end)
      if (lastNewline > i + chunkSize * 0.7) end = lastNewline
    }
    chunks.push(text.slice(i, end).trim())
    i = end
  }
  return chunks.filter(c => c.length > 50)
}

// Analyze image via Claude vision
async function analyzeImage(base64Image: string, mimeType: string): Promise<string> {
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64Image } },
          { type: 'text', text: 'Please extract and describe ALL text, data, tables, charts, and visual information in this image in full detail. This will be used for BD intelligence analysis. Include every company name, metric, product feature, market data, pricing, or competitive information visible. Be exhaustive.' },
        ],
      }],
    })
    return response.content[0].type === 'text' ? response.content[0].text : ''
  } catch (e) {
    console.error('[analyzeImage]', e)
    return ''
  }
}

// ── Multi-chunk synthesis for large documents ─────────────────────────────────
// When a document is too large for a single GPT call, we:
// 1. Summarize each chunk independently
// 2. Merge summaries into a final synthesis
async function summarizeChunk(chunk: string, chunkIndex: number, totalChunks: number, sourceName: string): Promise<string> {
  try {
    return await claudeText({
      model: CLAUDE_RESEARCH,
      maxTokens: 2000,
      system: `You are a BD intelligence extractor for Kima (cross-chain settlement) and Aeredium (TEE blockchain).
Extract all BD-relevant information: company names, pain points, market data, competitive signals, funding info, product details, payment/settlement needs.
This is chunk ${chunkIndex + 1} of ${totalChunks} from "${sourceName}".
Be thorough and specific. Return plain text, no JSON.`,
      user: `Extract all BD-relevant intelligence from this section:\n\n${chunk}`,
    })
  } catch (e) {
    console.error(`[summarizeChunk ${chunkIndex}]`, e)
    return chunk.slice(0, 1000)
  }
}

// Core synthesis: extract BD intelligence from any content
async function synthesizeKnowledge(
  content: string,
  sourceName: string,
  sourceType: string,
  existingRules: string
): Promise<{
  title: string
  summary: string
  knowledge_type: string
  tags: string[]
  insights: string[]
  new_rules: Array<{ rule_type: string; rule: string; weight: number }>
  new_sources: Array<{ source_name: string; source_type: string; source_url_or_query: string; target_industry_category: string; target_customer_category: string; notes: string }>
  raw_knowledge: string
}> {
  try {
    return await claudeJSON({
      model: CLAUDE_RESEARCH,
      maxTokens: 4000,
      system: `You are the intelligence synthesis engine for the Kima BD OS.
Your job is to extract actionable BD intelligence from any content and convert it into structured knowledge, agent rules, and discovery sources.

${KIMA_CONTEXT}

EXISTING AGENT RULES (do not duplicate these):
${existingRules || 'None yet.'}`,
      user: `Analyze this content from "${sourceName}" (type: ${sourceType}) and extract BD intelligence for Kima/Aeredium:

CONTENT:
${content}

Extract and return this exact JSON structure:
{
  "title": "Short descriptive title for what was learned (max 10 words)",
  "summary": "2-3 sentence summary of the key BD intelligence extracted",
  "knowledge_type": "one of: icp_signal | competitor_intel | market_trend | product_context | outreach_strategy | source_directory | general",
  "tags": ["array of 2-5 relevant tags"],
  "insights": ["array of 3-8 specific, actionable insight strings extracted"],
  "new_rules": [{ "rule_type": "prioritize | reject | score_boost | score_penalty | outreach_style | source_preference", "rule": "specific rule text", "weight": 0 }],
  "new_sources": [{ "source_name": "name", "source_type": "exa_search|exa_similar|website", "source_url_or_query": "URL or query", "target_industry_category": "categories", "target_customer_category": "categories", "notes": "why relevant" }],
  "raw_knowledge": "Full synthesis — 200-500 words of BD-relevant notes for the agent."
}`,
    })
  } catch (e) {
    console.error('[synthesizeKnowledge parse error]', e)
    return {
      title: 'Learning from ' + sourceName,
      summary: 'Content was processed but synthesis had parsing issues.',
      knowledge_type: 'general',
      tags: [],
      insights: [],
      new_rules: [],
      new_sources: [],
      raw_knowledge: content.slice(0, 1000),
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''

    let inputType = ''
    let inputContent = ''
    let sourceName = ''
    let mimeType = 'image/png'
    let docMeta = ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      inputType = (formData.get('type') as string) || 'file'
      sourceName = file?.name || 'Uploaded file'

      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      mimeType = file.type || 'application/octet-stream'

      const fileType = detectFileType(file.name, mimeType)
      console.log(`[learn] ${file.name} | MIME: ${mimeType} | Type: ${fileType} | Size: ${(buffer.length / 1024).toFixed(1)} KB`)

      if (fileType === 'image') {
        inputType = 'image'
        const base64 = buffer.toString('base64')
        inputContent = await analyzeImage(base64, mimeType)
        if (!inputContent) return NextResponse.json({ error: 'Could not analyze image' }, { status: 400 })

      } else if (fileType === 'pdf') {
        inputType = 'file'
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse')
        const pdfData = await pdfParse(buffer, { max: 0 }) // max:0 = all pages
        inputContent = pdfData.text
        docMeta = `${pdfData.numpages} pages · ${inputContent.length.toLocaleString()} chars`
        console.log(`[PDF] ${docMeta}`)

      } else if (fileType === 'docx' || fileType === 'doc') {
        inputType = 'file'
        inputContent = await extractDocx(buffer)
        docMeta = `${inputContent.length.toLocaleString()} chars extracted`

      } else if (fileType === 'csv') {
        inputType = 'file'
        inputContent = buffer.toString('utf-8')
        docMeta = `${inputContent.split('\n').length} rows · ${inputContent.length.toLocaleString()} chars`

      } else {
        inputType = 'file'
        inputContent = buffer.toString('utf-8')
        docMeta = `${inputContent.length.toLocaleString()} chars`
      }

    } else {
      const body = await req.json()
      inputType = body.type || 'text'
      sourceName = body.source_name || (inputType === 'url' ? body.content : 'Manual input')
      inputContent = body.content || ''

      if (inputType === 'url') {
        if (!inputContent.startsWith('http')) return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
        const fetched = await readUrl(inputContent)
        if (!fetched || fetched.length < 50) return NextResponse.json({ error: 'Could not read URL content. Try a different URL.' }, { status: 400 })
        inputContent = fetched
        docMeta = `${inputContent.length.toLocaleString()} chars fetched`
      }
    }

    if (!inputContent || inputContent.length < 20) {
      return NextResponse.json({ error: 'Content is too short to analyze' }, { status: 400 })
    }

    // ── Multi-chunk strategy for large documents ──────────────────────────────
    // Docs > 12k chars are split into chunks, each summarized, then merged
    const CHUNK_SIZE = 12000
    let contentForSynthesis = inputContent

    if (inputContent.length > CHUNK_SIZE) {
      const chunks = chunkText(inputContent, CHUNK_SIZE)
      console.log(`[learn] Large content: ${chunks.length} chunks (${inputContent.length.toLocaleString()} chars total)`)

      if (chunks.length > 1) {
        const BATCH = 5
        const summaries: string[] = []
        for (let i = 0; i < chunks.length; i += BATCH) {
          const batch = chunks.slice(i, i + BATCH)
          const results = await Promise.all(
            batch.map((chunk, j) => summarizeChunk(chunk, i + j, chunks.length, sourceName))
          )
          summaries.push(...results)
        }
        contentForSynthesis = [
          `[Document: ${sourceName}] [${docMeta}] [${chunks.length} sections]`,
          '',
          ...summaries.map((s, i) => `=== Section ${i + 1} ===\n${s}`),
        ].join('\n\n')
        console.log(`[learn] Merged ${summaries.length} summaries → ${contentForSynthesis.length} chars`)
      } else {
        contentForSynthesis = chunks[0]
      }
    }

    // ── Load existing rules to avoid duplication ──────────────────────────────
    const { data: existingRules } = await supabase
      .from('agent_rules').select('rule_type, rule').eq('status', 'active')
    const existingRulesStr = (existingRules || []).map(r => `[${r.rule_type}] ${r.rule}`).join('\n')

    // ── Final AI synthesis ────────────────────────────────────────────────────
    const synthesis = await synthesizeKnowledge(contentForSynthesis, sourceName, inputType, existingRulesStr)

    let rulesCreated = 0
    let sourcesCreated = 0
    const createdRules: string[] = []
    const createdSources: string[] = []

    if (synthesis.new_rules?.length > 0) {
      for (const rule of synthesis.new_rules.slice(0, 4)) {
        if (!rule.rule || rule.rule.length < 10) continue
        const { error } = await supabase.from('agent_rules').insert({
          rule_type: rule.rule_type || 'prioritize', rule: rule.rule,
          weight: rule.weight || 0, status: 'active',
        })
        if (!error) { rulesCreated++; createdRules.push(rule.rule) }
      }
    }

    if (synthesis.new_sources?.length > 0) {
      for (const source of synthesis.new_sources.slice(0, 3)) {
        if (!source.source_name || !source.source_url_or_query) continue
        const { error } = await supabase.from('sources').insert({
          source_name: source.source_name,
          source_type: source.source_type || 'website',
          source_url_or_query: source.source_url_or_query,
          target_industry_category: source.target_industry_category || '',
          target_customer_category: source.target_customer_category || '',
          frequency: 'weekly', quality_rating: 'unrated', status: 'active',
          notes: source.notes || `Auto-added from: ${sourceName}`,
        })
        if (!error) { sourcesCreated++; createdSources.push(source.source_name) }
      }
    }

    const { data: savedKnowledge, error: knowledgeError } = await supabase
      .from('agent_knowledge')
      .insert({
        title: synthesis.title || 'Learning from ' + sourceName,
        content: synthesis.raw_knowledge || synthesis.summary || '',
        source_type: inputType as 'file' | 'url' | 'text' | 'image' | 'screenshot',
        source_name: sourceName,
        tags: synthesis.tags || [],
        knowledge_type: synthesis.knowledge_type || 'general',
        rules_created: rulesCreated,
        sources_created: sourcesCreated,
        status: 'active',
      })
      .select('id').single()

    if (knowledgeError) console.error('[agent_knowledge insert error]', knowledgeError)

    return NextResponse.json({
      success: true,
      knowledge_id: savedKnowledge?.id,
      title: synthesis.title,
      summary: synthesis.summary,
      knowledge_type: synthesis.knowledge_type,
      tags: synthesis.tags,
      insights: synthesis.insights,
      rules_created: rulesCreated,
      sources_created: sourcesCreated,
      created_rules: createdRules,
      created_sources: createdSources,
      doc_meta: docMeta || null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Learning pipeline failed'
    console.error('[learn route error]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


