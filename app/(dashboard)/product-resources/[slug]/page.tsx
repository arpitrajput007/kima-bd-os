'use client'

import { useEffect, useState, use as usePromise } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Plus, Edit, Trash2, Loader2, Save, X, Database, Sparkles,
  Lightbulb, Check, ExternalLink, ArrowLeft, Zap, Users,
} from 'lucide-react'
import type { Source } from '@/lib/types'
import { cn, formatDate } from '@/lib/utils'
import { getProductSection, ACCENT_HEX, type ProductSlug } from '@/lib/product-sections'
import { notFound } from 'next/navigation'

// Products with a live scoring path from Resources → Customers. AERKey and
// Agent aren't scored by /api/ai/discover or /api/ai/discover-aerseal (see
// PRODUCT_DISCOVERY), so "Run these resources" only shows for the 3 that are.
const RUNNABLE_SLUGS = new Set(['aerpolice', 'aer360', 'aerseal'])

const SOURCE_TYPES = [
  'exa_search', 'exa_similar', 'apollo_search',
  'website', 'google_search', 'twitter_profile', 'linkedin_company',
  'telegram_group', 'rss_feed', 'defillama_category', 'crunchbase_list',
  'ecosystem_directory', 'hackathon_directory', 'news_source', 'manual_list',
]

const QUALITY_COLORS: Record<string, string> = {
  excellent: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  good: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  average: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  poor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  unrated: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

interface SourceSuggestion {
  source_name: string
  source_type: Source['source_type']
  source_url_or_query: string
  why: string
  expected_leads: string
  confidence: 'high' | 'medium' | 'low'
  verified?: boolean
  check_status?: 'good' | 'thin' | 'unverified'
  check_note?: string
}

function emptyForm(productSlug: string): Partial<Source> {
  return {
    source_name: '', source_type: 'google_search', source_url_or_query: '',
    frequency: 'weekly', quality_rating: 'unrated', status: 'active', notes: '',
    product_slug: productSlug,
  } as Partial<Source>
}

export default function ProductResourcesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = usePromise(params)
  const section = getProductSection(slug)
  if (!section) notFound()
  const accentColor = ACCENT_HEX[section.accent]

  const supabase = createClient()
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<Source>>(emptyForm(slug))
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState<SourceSuggestion[]>([])
  const [addingIdx, setAddingIdx] = useState<number | null>(null)
  const [approachText, setApproachText] = useState('')
  const [running, setRunning] = useState(false)
  const [runProgress, setRunProgress] = useState({ done: 0, total: 0 })
  const [runSummary, setRunSummary] = useState<{ saved: number; ran: number } | null>(null)

  const loadSources = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('sources')
      .select('*')
      .eq('product_slug', slug)
      .order('status')
      .order('created_at', { ascending: false })
    setSources((data as Source[]) || [])
    setLoading(false)
  }

  useEffect(() => { loadSources() }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    supabase.from('product_hunting_approach').select('approach_text').eq('product_slug', slug).maybeSingle()
      .then(({ data }) => setApproachText(data?.approach_text || ''))
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  const suggestSources = async () => {
    setSuggesting(true)
    try {
      const res = await fetch('/api/ai/suggest-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productSlug: slug, approachText }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      if (!data.suggestions?.length) { toast('No new source ideas right now — try again later'); return }
      setSuggestions(data.suggestions)
      toast.success(`${data.suggestions.length} source ideas ready for review`)
    } catch {
      toast.error('Could not get suggestions')
    } finally {
      setSuggesting(false)
    }
  }

  const acceptSuggestion = async (s: SourceSuggestion, idx: number) => {
    setAddingIdx(idx)
    const { error } = await supabase.from('sources').insert({
      source_name: s.source_name,
      source_type: s.source_type,
      source_url_or_query: s.source_url_or_query,
      frequency: 'weekly',
      quality_rating: 'unrated',
      status: 'active',
      notes: s.why || null,
      product_slug: slug,
    })
    setAddingIdx(null)
    if (error) { toast.error('Failed to add source'); return }
    toast.success(`Added: ${s.source_name}`)
    setSuggestions(prev => prev.filter((_, i) => i !== idx))
    loadSources()
  }

  const dismissSuggestion = (idx: number) => setSuggestions(prev => prev.filter((_, i) => i !== idx))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.source_name) { toast.error('Source name required'); return }
    setSaving(true)
    const payload = { ...form, product_slug: slug }
    delete payload.id; delete payload.created_at; delete payload.updated_at
    delete payload.leads_generated; delete payload.last_run_at

    let error
    if (editId) {
      ({ error } = await supabase.from('sources').update(payload).eq('id', editId))
    } else {
      ({ error } = await supabase.from('sources').insert(payload))
    }
    if (error) toast.error('Failed to save')
    else {
      toast.success(editId ? 'Source updated' : 'Source added')
      setShowForm(false); setEditId(null); setForm(emptyForm(slug)); loadSources()
    }
    setSaving(false)
  }

  const deleteSource = async (id: string) => {
    if (!confirm('Delete this source?')) return
    await supabase.from('sources').delete().eq('id', id)
    toast.success('Source deleted')
    loadSources()
  }

  const editSource = (s: Source) => {
    setForm(s)
    setEditId(s.id)
    setShowForm(true)
  }

  // Scrape every active resource for this product and save qualified
  // companies straight into its Customers page — AERSeal runs through its own
  // Firecrawl authority pipeline (surface_key: db:<id>, see
  // app/api/ai/discover-aerseal/route.ts), the other two through the general
  // pipeline with force_deep_crawl so Firecrawl always fires here regardless
  // of the per-source deep_crawl toggle.
  const runResources = async () => {
    const queue = sources.filter(s => s.status === 'active' && s.source_url_or_query)
    if (!queue.length) { toast.error('No active resources with a URL/query to run'); return }
    setRunning(true)
    setRunSummary(null)
    setRunProgress({ done: 0, total: queue.length })
    let saved = 0
    let ran = 0
    for (const source of queue) {
      try {
        const endpoint = slug === 'aerseal' ? '/api/ai/discover-aerseal' : '/api/ai/discover'
        const body = slug === 'aerseal'
          ? { surface_key: `db:${source.id}`, deep_crawl: true }
          : { source_id: source.id, force_deep_crawl: true }
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (data.error) toast.error(`${source.source_name}: ${data.error}`)
        else saved += data.saved || 0
      } catch {
        toast.error(`${source.source_name}: network error`)
      }
      ran++
      setRunProgress({ done: ran, total: queue.length })
    }
    setRunning(false)
    setRunSummary({ saved, ran })
    loadSources()
    toast.success(`Done — ${saved} new customer${saved === 1 ? '' : 's'} found across ${ran} resource${ran === 1 ? '' : 's'}`)
  }

  const customersHref = section.customerLinks[0]?.href || `/product-customers/${slug}`

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5 fade-in">
      <div>
        <Link href="/sources" className="inline-flex items-center gap-1.5 text-[12px] mb-3" style={{ color: 'var(--text-3)' }}>
          <ArrowLeft size={13} /> All discovery sources
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Database size={20} style={{ color: 'var(--text-2)' }} />
              {section.label} Resources
            </h1>
            <p className="text-[13px] mt-1" style={{ color: 'var(--text-3)' }}>
              Places the agent should look to find {section.label} customers — directories, search queries, communities, feeds.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-secondary" onClick={suggestSources} disabled={suggesting}>
              {suggesting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Suggest sources
            </button>
            <button className="btn btn-primary" onClick={() => { setForm(emptyForm(slug)); setEditId(null); setShowForm(true) }}>
              <Plus size={14} /> Add source
            </button>
          </div>
        </div>
        <div className="mt-2 text-[12px]" style={{ color: 'var(--text-3)' }}>
          Suggestions are grounded in your <Link href={`/product-approach/${slug}`} className="underline" style={{ color: 'var(--text-2)' }}>hunting approach</Link> for {section.label}{approachText ? '' : ' — none saved yet, using default product knowledge'}.
        </div>

        {RUNNABLE_SLUGS.has(slug) && sources.length > 0 && (
          <div className="rounded-xl p-5 mt-3" style={{ background: `${accentColor}0a`, border: `1px solid ${accentColor}30` }}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-[13px] font-semibold text-white flex items-center gap-1.5">
                  <Zap size={14} style={{ color: accentColor }} /> Run these resources
                </div>
                <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                  Firecrawl-scrapes every active resource above, evaluates companies against your {section.label} approach, and saves qualified ones straight to{' '}
                  <Link href={customersHref} className="underline" style={{ color: 'var(--text-2)' }}>{section.label} Customers</Link>.
                </div>
              </div>
              <div className="flex items-center gap-2">
                {runSummary && !running && (
                  <Link href={customersHref} className="btn btn-ghost">
                    <Users size={14} /> View {runSummary.saved} new
                  </Link>
                )}
                <button className="btn btn-primary" onClick={runResources} disabled={running}>
                  {running ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                  {running ? `Running ${runProgress.done}/${runProgress.total}` : 'Run these resources'}
                </button>
              </div>
            </div>
            {running && (
              <div className="rounded-lg p-6 text-center mt-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Loader2 size={20} className="animate-spin mx-auto mb-2" style={{ color: accentColor }} />
                <p className="text-[13px] text-white">Scraping resource {runProgress.done + 1} of {runProgress.total}…</p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>
                  Each resource gets a live Firecrawl scrape, research, and scoring pass — this can take a few minutes per resource.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="section-card">
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <Lightbulb size={15} style={{ color: 'rgb(251,191,36)' }} />
            <span className="text-[13px] font-semibold text-white">Suggested sources</span>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {suggestions.map((s, idx) => (
              <div key={idx} className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-white">{s.source_name}</span>
                    <span className="badge" style={{ fontSize: 10 }}>{s.source_type}</span>
                    {s.check_status && (
                      <span className="text-[10px]" style={{ color: s.check_status === 'good' ? 'rgb(52,211,153)' : 'var(--text-3)' }}>
                        {s.check_note}
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] mt-1 break-all" style={{ color: 'var(--text-3)' }}>{s.source_url_or_query}</div>
                  <div className="text-[12px] mt-1.5" style={{ color: 'var(--text-2)' }}>{s.why}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => dismissSuggestion(idx)}>
                    <X size={13} />
                  </button>
                  <button className="btn btn-primary" style={{ padding: '6px 10px' }} onClick={() => acceptSuggestion(s, idx)} disabled={addingIdx === idx}>
                    {addingIdx === idx ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSave} className="section-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Source name" value={form.source_name || ''}
              onChange={e => setForm(f => ({ ...f, source_name: e.target.value }))} required />
            <select className="input" value={form.source_type || 'google_search'}
              onChange={e => setForm(f => ({ ...f, source_type: e.target.value as Source['source_type'] }))}>
              {SOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <input className="input w-full" placeholder="URL or search query" value={form.source_url_or_query || ''}
            onChange={e => setForm(f => ({ ...f, source_url_or_query: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <select className="input" value={form.frequency || 'weekly'}
              onChange={e => setForm(f => ({ ...f, frequency: e.target.value as Source['frequency'] }))}>
              <option value="daily">daily</option>
              <option value="weekly">weekly</option>
              <option value="manual">manual</option>
            </select>
            <select className="input" value={form.status || 'active'}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as Source['status'] }))}>
              <option value="active">active</option>
              <option value="paused">paused</option>
            </select>
          </div>
          <textarea className="input w-full" placeholder="Notes" rows={2} value={form.notes || ''}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <div className="flex items-center gap-2">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setEditId(null) }}>Cancel</button>
          </div>
        </form>
      )}

      <div className="section-card">
        {loading ? (
          <div className="p-8 text-center"><Loader2 size={20} className="animate-spin mx-auto" style={{ color: 'var(--text-3)' }} /></div>
        ) : sources.length === 0 ? (
          <div className="p-8 text-center text-[13px]" style={{ color: 'var(--text-3)' }}>
            No {section.label} resources yet. Add one manually or click &quot;Suggest sources&quot; above.
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {sources.map(s => (
              <div key={s.id} className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-white">{s.source_name}</span>
                    <span className="badge" style={{ fontSize: 10 }}>{s.source_type}</span>
                    <span className={cn('badge border text-[10px]', QUALITY_COLORS[s.quality_rating || 'unrated'])}>{s.quality_rating || 'unrated'}</span>
                    <span className="text-[10px]" style={{ color: s.status === 'active' ? 'rgb(52,211,153)' : 'var(--text-3)' }}>{s.status}</span>
                  </div>
                  {s.source_url_or_query && (
                    <div className="text-[12px] mt-1 break-all flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                      {s.source_url_or_query}
                      {s.source_url_or_query.startsWith('http') && (
                        <a href={s.source_url_or_query} target="_blank" rel="noreferrer"><ExternalLink size={11} /></a>
                      )}
                    </div>
                  )}
                  <div className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>
                    {s.leads_generated || 0} leads · added {formatDate(s.created_at)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button className="btn btn-ghost" style={{ padding: '6px 8px' }} onClick={() => editSource(s)}><Edit size={13} /></button>
                  <button className="btn btn-ghost" style={{ padding: '6px 8px' }} onClick={() => deleteSource(s.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
