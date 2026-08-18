'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Plus, Edit, Trash2, Loader2, Save, X,
  Database, Play, Pause, Zap, CheckCircle, AlertCircle, Clock,
  Sparkles, Lightbulb, Check, Square, ListChecks, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react'
import type { Source, Lead } from '@/lib/types'
import { cn, formatDate, getScoreBg } from '@/lib/utils'
import { getSelectedSourceIds, setSelectedSourceIds, clearSelectedSourceIds } from '@/lib/sourceSelection'

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

const emptyForm: Partial<Source> = {
  source_name: '', source_type: 'google_search', source_url_or_query: '',
  frequency: 'weekly', quality_rating: 'unrated', status: 'active', notes: '',
}

interface RunResult {
  found: number
  saved: number
  researched?: number
  skipped_duplicate: number
  skipped_generic?: number
  skipped_cap: number
  skipped_low_score: number
  leads_saved: string[]
  error?: string
}

// Below this many lifetime AI research calls, a source hasn't run enough to
// judge yield fairly — one bad run of 3 companies means nothing. Above it,
// a low yield is a real signal, not noise.
const MIN_SAMPLE_FOR_YIELD_JUDGMENT = 10
// Yield below this is a real "burning credits for nothing" signal once the
// sample size above is met.
const LOW_YIELD_THRESHOLD = 0.08

function sourceYield(source: Source): { pct: number | null; isLow: boolean } {
  const evaluated = source.companies_evaluated || 0
  const saved = source.leads_generated || 0
  if (evaluated < MIN_SAMPLE_FOR_YIELD_JUDGMENT) return { pct: null, isLow: false }
  const pct = saved / evaluated
  return { pct, isLow: pct < LOW_YIELD_THRESHOLD }
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

export default function SourcesPage() {
  const supabase = createClient()
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<Source>>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [sortWorstYieldFirst, setSortWorstYieldFirst] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [runResults, setRunResults] = useState<Record<string, RunResult>>({})
  const [suggesting, setSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState<SourceSuggestion[]>([])
  const [addingIdx, setAddingIdx] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ── Manual multi-select: pick which sources to run, skip the rest ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchRunning, setBatchRunning] = useState(false)
  const stopRequestedRef = useRef(false)

  // Hydrate from localStorage after mount (not during SSR/first client render,
  // to avoid a hydration mismatch — window isn't available server-side).
  useEffect(() => { setSelectedIds(new Set(getSelectedSourceIds())) }, [])

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedSourceIds(Array.from(next))
    return next
  })
  const selectAllVisible = () => {
    const next = new Set(filteredSources.map(s => s.id))
    setSelectedIds(next)
    setSelectedSourceIds(Array.from(next))
  }
  const clearSelection = () => {
    setSelectedIds(new Set())
    clearSelectedSourceIds()
  }

  // ── Per-source lead breakdown: which leads did this source actually bring? ──
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null)
  const [sourceLeadsCache, setSourceLeadsCache] = useState<Record<string, Lead[]>>({})
  const [loadingSourceLeads, setLoadingSourceLeads] = useState<string | null>(null)

  const toggleSourceLeads = async (source: Source) => {
    if (expandedSourceId === source.id) { setExpandedSourceId(null); return }
    setExpandedSourceId(source.id)
    if (sourceLeadsCache[source.id]) return // already fetched
    setLoadingSourceLeads(source.id)
    const { data, error } = await supabase
      .from('leads')
      .select('id, company_name, lead_score, urgency_score, status, classification, created_at')
      .eq('source_id', source.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (!error) setSourceLeadsCache(prev => ({ ...prev, [source.id]: (data as Lead[]) || [] }))
    setLoadingSourceLeads(null)
  }

  // Ask the agent which new sources are worth adding.
  const suggestSources = async () => {
    setSuggesting(true)
    try {
      const res = await fetch('/api/ai/suggest-sources', { method: 'POST' })
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

  // Accept a suggestion → create it as an active source.
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
    })
    setAddingIdx(null)
    if (error) { toast.error('Failed to add source'); return }
    toast.success(`Added: ${s.source_name}`)
    setSuggestions(prev => prev.filter((_, i) => i !== idx))
    loadSources()
  }

  const dismissSuggestion = (idx: number) =>
    setSuggestions(prev => prev.filter((_, i) => i !== idx))

  const loadSources = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('sources')
      .select('*')
      .order('status')
      .order('created_at', { ascending: false })
    setSources(data || [])
    setLoading(false)
  }

  useEffect(() => { loadSources() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.source_name) { toast.error('Source name required'); return }
    setSaving(true)

    const payload = { ...form }
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
      setShowForm(false); setEditId(null); setForm(emptyForm); loadSources()
    }
    setSaving(false)
  }

  const deleteSource = async (id: string) => {
    if (!confirm('Delete this source?')) return
    await supabase.from('sources').delete().eq('id', id)
    toast.success('Source deleted')
    loadSources()
  }

  const toggleStatus = async (source: Source) => {
    const newStatus = source.status === 'active' ? 'paused' : 'active'
    await supabase.from('sources').update({ status: newStatus }).eq('id', source.id)
    toast.success(`Source ${newStatus}`)
    loadSources()
  }

  const startEdit = (source: Source) => {
    setForm(source)
    setEditId(source.id)
    setShowForm(true)
  }

  // Stops whatever is currently in flight. During a batch run, also halts
  // the queue — the loop checks stopRequestedRef before starting the next source.
  const stopDiscovery = () => {
    stopRequestedRef.current = true
    abortRef.current?.abort()
    abortRef.current = null
    setRunningId(null)
    setBatchRunning(false)
    toast('Discovery stopped')
  }

  // Run the discovery pipeline for a single source. Shared by the per-row
  // "Run Now" button and the batch runner below — returns the result (or
  // null on abort/skip) so the batch loop can tally totals.
  const runOneDiscovery = async (source: Source): Promise<RunResult | null> => {
    if (!source.source_url_or_query) {
      toast.error(`${source.source_name}: no URL configured, skipping`)
      return null
    }
    setRunningId(source.id)
    setRunResults(prev => {
      const next = { ...prev }
      delete next[source.id]
      return next
    })

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/ai/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: source.id }),
        signal: controller.signal,
      })
      const data: RunResult = await res.json()
      setRunResults(prev => ({ ...prev, [source.id]: data }))
      if (data.error) {
        toast.error(`${source.source_name}: ${data.error}`)
      } else {
        toast.success(`${source.source_name}: saved ${data.saved} new leads`)
      }
      return data
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return null
      toast.error(`${source.source_name}: network error`)
      const errResult: RunResult = { found: 0, saved: 0, skipped_duplicate: 0, skipped_cap: 0, skipped_low_score: 0, leads_saved: [], error: 'Network error' }
      setRunResults(prev => ({ ...prev, [source.id]: errResult }))
      return errResult
    } finally {
      abortRef.current = null
    }
  }

  // Single "Run Now" click — same as before, wraps the shared runner.
  const runDiscovery = async (source: Source) => {
    await runOneDiscovery(source)
    setRunningId(null)
    loadSources()
  }

  // Run only the sources the user checked, one at a time (each discovery
  // call can take up to ~5 min, so sequential keeps it legible and avoids
  // hammering Claude/Exa/Hunter concurrently). Stop button aborts the
  // in-flight one and halts the rest of the queue.
  const runSelected = async () => {
    const queue = sources.filter(s => selectedIds.has(s.id))
    if (!queue.length) { toast.error('Select at least one source first'); return }

    setBatchRunning(true)
    stopRequestedRef.current = false
    let saved = 0
    let ran = 0

    for (const source of queue) {
      if (stopRequestedRef.current) break
      const result = await runOneDiscovery(source)
      ran++
      if (result && !result.error) saved += result.saved
    }

    setRunningId(null)
    setBatchRunning(false)
    loadSources()
    if (!stopRequestedRef.current) {
      toast.success(`Batch done — ${saved} leads saved across ${ran} source${ran === 1 ? '' : 's'}`)
    }
  }

  const filteredSources = sources
    .filter(s =>
      !search ||
      s.source_name.toLowerCase().includes(search.toLowerCase()) ||
      s.source_url_or_query?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (!sortWorstYieldFirst) return 0
      // Worst yield first, but only among sources with enough sample to judge
      // fairly — unjudged sources (too few runs) sink to the bottom rather
      // than crowding out the ones actually worth pausing.
      const ya = sourceYield(a), yb = sourceYield(b)
      if (ya.pct == null && yb.pct == null) return 0
      if (ya.pct == null) return 1
      if (yb.pct == null) return -1
      return ya.pct - yb.pct
    })

  const inputClass = 'input-dark'
  const selStyle = { fontSize: '13px' }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Source Manager</h1>
          <p className="text-xs mt-1" style={{ color: 'rgb(100,100,120)' }}>
            {sources.filter(s => s.status === 'active').length} active sources · Agent runs daily at 6:00 AM IST · Max 5 leads per category
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={suggestSources}
            disabled={suggesting}
            className="btn btn-secondary"
            style={{ fontSize: '13px', opacity: suggesting ? 0.8 : 1 }}
          >
            {suggesting
              ? <><Loader2 size={14} className="animate-spin" /> Thinking…</>
              : <><Sparkles size={14} /> Suggest sources</>}
          </button>
          <button
            onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(!showForm) }}
            className="btn btn-primary"
            style={{ fontSize: '13px' }}
          >
            <Plus size={14} /> Add Source
          </button>
        </div>
      </div>

      <div className="p-8 space-y-6">

        {/* Agent source suggestions */}
        {suggestions.length > 0 && (
          <div className="rounded-xl p-5" style={{ background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.2)' }}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Lightbulb size={15} style={{ color: '#38bdf8' }} />
                Agent&apos;s source suggestions
              </h2>
              <button onClick={() => setSuggestions([])} className="text-xs" style={{ color: 'rgb(120,127,160)' }}>
                Dismiss all
              </button>
            </div>
            <p className="text-xs mb-4" style={{ color: 'rgb(120,127,160)' }}>
              Sources the agent thinks could bring strong leads — each one test-crawled to drop dead links. Review and add the ones you like.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {suggestions.map((s, idx) => {
                const confColor = s.confidence === 'high' ? '#34d399' : s.confidence === 'medium' ? '#fbbf24' : 'rgb(150,155,185)'
                return (
                  <div key={idx} className="rounded-lg p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="text-[13px] font-bold text-white">{s.source_name}</div>
                      <span className="badge" style={{ fontSize: '9px', flexShrink: 0, color: confColor, background: confColor + '18', borderColor: confColor + '40' }}>
                        {s.confidence}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="badge" style={{ fontSize: '9px', background: 'rgba(167,139,250,0.1)', color: '#a78bfa', borderColor: 'rgba(167,139,250,0.2)' }}>
                        {s.source_type?.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] mono truncate" style={{ color: 'rgb(130,135,165)', maxWidth: 240 }}>{s.source_url_or_query}</span>
                    </div>
                    <p className="text-[11.5px] leading-relaxed mb-1.5" style={{ color: 'rgb(170,175,200)' }}>{s.why}</p>
                    {s.expected_leads && (
                      <p className="text-[11px] mb-2" style={{ color: 'rgb(110,115,145)' }}>
                        <span style={{ color: '#38bdf8' }}>Brings: </span>{s.expected_leads}
                      </p>
                    )}
                    {s.check_note && (
                      <div className="flex items-center gap-1.5 mb-3 text-[10.5px]" style={{
                        color: s.check_status === 'good' ? '#34d399' : s.check_status === 'thin' ? '#fbbf24' : 'rgb(130,135,165)',
                      }}>
                        {s.check_status === 'good'
                          ? <CheckCircle size={11} />
                          : <AlertCircle size={11} />}
                        {s.check_note}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => acceptSuggestion(s, idx)} disabled={addingIdx === idx}
                        className="btn btn-primary" style={{ fontSize: '11px', padding: '5px 11px', flex: 1, justifyContent: 'center' }}>
                        {addingIdx === idx ? <Loader2 size={12} className="animate-spin" /> : <><Check size={12} /> Add source</>}
                      </button>
                      <button onClick={() => dismissSuggestion(idx)}
                        className="btn btn-ghost" style={{ fontSize: '11px', padding: '5px 11px', color: 'rgb(130,135,165)' }}>
                        <X size={12} /> Skip
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <div className="rounded-xl p-5" style={{ background: 'rgba(22,22,34,0.9)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <h2 className="text-sm font-semibold text-white mb-4">{editId ? 'Edit Source' : 'Add New Source'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>Source Name *</label>
                  <input className={inputClass} style={selStyle} value={form.source_name || ''} onChange={e => setForm(f => ({ ...f, source_name: e.target.value }))} placeholder="e.g. LayerZero Ecosystem Directory" required />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>Source Type</label>
                  <select className={inputClass} style={selStyle} value={form.source_type || ''} onChange={e => setForm(f => ({ ...f, source_type: e.target.value as Source['source_type'] }))}>
                    {SOURCE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>
                    {form.source_type === 'apollo_search'
                      ? <>Apollo keywords <span style={{ color: 'rgb(100,100,120)' }}>— comma-separated tags; Apollo finds matching companies</span></>
                      : form.source_type === 'exa_search'
                      ? <>Exa search query <span style={{ color: 'rgb(100,100,120)' }}>— natural language; Exa semantically finds real companies</span></>
                      : form.source_type === 'exa_similar'
                      ? <>Company URL <span style={{ color: 'rgb(100,100,120)' }}>— paste a company's homepage; Exa finds similar companies</span></>
                      : <>URL or Search Query <span style={{ color: 'rgb(100,100,120)' }}>— the bot will read this page to find companies</span></>}
                  </label>
                  <input className={inputClass} style={selStyle} value={form.source_url_or_query || ''} onChange={e => setForm(f => ({ ...f, source_url_or_query: e.target.value }))}
                    placeholder={
                      form.source_type === 'apollo_search' ? 'e.g. stablecoin, cross-border payments, crypto exchange'
                      : form.source_type === 'exa_search' ? 'e.g. DeFi protocols with cross-chain settlement problems'
                      : form.source_type === 'exa_similar' ? 'e.g. https://layerzero.network'
                      : 'e.g. https://layerzero.network/ecosystem  or  https://defillama.com/chains'} />
                  <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'rgb(110,110,130)' }}>
                    Just point the agent at strong sources — Telegram groups, sites, Google or X searches.
                    It researches each company itself and decides the industry &amp; sales fit using everything you&apos;ve taught it.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>Frequency</label>
                  <select className={inputClass} style={selStyle} value={form.frequency || 'weekly'} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as Source['frequency'] }))}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="manual">Manual only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>Quality Rating</label>
                  <select className={inputClass} style={selStyle} value={form.quality_rating || 'unrated'} onChange={e => setForm(f => ({ ...f, quality_rating: e.target.value as Source['quality_rating'] }))}>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="average">Average</option>
                    <option value="poor">Poor</option>
                    <option value="unrated">Unrated</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>Notes</label>
                  <input className={inputClass} style={selStyle} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any context about this source..." />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ fontSize: '12px', padding: '7px 14px' }}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {editId ? 'Update' : 'Add Source'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm) }} className="btn btn-ghost" style={{ fontSize: '12px' }}>
                  <X size={13} /> Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search + manual multi-select run */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            className="input-dark max-w-xs"
            style={{ fontSize: '13px' }}
            placeholder="Search sources..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button
            onClick={() => setSortWorstYieldFirst(v => !v)}
            className="btn btn-ghost"
            style={{
              fontSize: '12px', padding: '6px 10px',
              color: sortWorstYieldFirst ? '#f87171' : 'rgb(150,155,185)',
              border: sortWorstYieldFirst ? '1px solid rgba(248,113,113,0.3)' : undefined,
            }}
            title="Sort so the sources burning the most AI credits per lead show first"
          >
            {sortWorstYieldFirst ? 'Sorted: worst yield first' : 'Sort by yield'}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={selectAllVisible} className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 10px', color: 'rgb(150,155,185)' }}>
              Select all{search ? ' (filtered)' : ''}
            </button>
            {selectedIds.size > 0 && (
              <button onClick={clearSelection} className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 10px', color: 'rgb(150,155,185)' }}>
                Clear ({selectedIds.size})
              </button>
            )}
            <button
              onClick={batchRunning ? stopDiscovery : runSelected}
              disabled={!batchRunning && (selectedIds.size === 0 || !!runningId)}
              className="btn btn-ai flex items-center gap-1.5"
              style={{
                padding: '6px 12px', fontSize: '12px',
                ...(batchRunning
                  ? { color: '#fb7185', border: '1px solid rgba(248,113,133,0.35)', background: 'rgba(248,113,133,0.1)' }
                  : { opacity: selectedIds.size === 0 || !!runningId ? 0.5 : 1 }),
              }}
              title={batchRunning ? 'Stop the batch run' : 'Run discovery for only the sources you checked'}
            >
              {batchRunning ? (
                <><Loader2 size={12} className="animate-spin" /><Square size={10} fill="#fb7185" style={{ marginLeft: 2 }} /> Stop batch</>
              ) : (
                <><ListChecks size={12} /> Run selected ({selectedIds.size})</>
              )}
            </button>
          </div>
        </div>
        {selectedIds.size === 0 && (
          <p className="text-xs" style={{ color: 'rgb(100,100,120)', marginTop: -8 }}>
            Check the sources you want, then hit Run Selected — everything else stays untouched, no automatic run.
          </p>
        )}

        {/* Sources List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin" style={{ color: '#a78bfa' }} />
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Database size={32} className="mx-auto mb-3 opacity-20" style={{ color: 'rgb(140,140,160)' }} />
            <div className="text-sm font-medium text-white mb-1">No sources yet</div>
            <div className="text-xs mb-4" style={{ color: 'rgb(100,100,120)' }}>
              Add your first source — paste any URL and the bot will read it to find leads
            </div>
            <button onClick={() => setShowForm(true)} className="btn btn-primary" style={{ fontSize: '12px' }}>
              <Plus size={13} /> Add First Source
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSources.map(source => {
              const isRunning = runningId === source.id
              const result = runResults[source.id]
              return (
                <div
                  key={source.id}
                  className="rounded-xl overflow-hidden"
                  style={{ background: 'rgba(20,20,30,0.85)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  {/* Source Row */}
                  <div className="flex items-center gap-4 p-4">
                    {/* Select for batch run */}
                    <input
                      type="checkbox"
                      checked={selectedIds.has(source.id)}
                      onChange={() => toggleSelect(source.id)}
                      style={{ width: 15, height: 15, accentColor: '#8b5cf6', cursor: 'pointer', flexShrink: 0 }}
                      title="Select for batch run"
                    />

                    {/* Status dot */}
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: source.status === 'active' ? '#34d399' : '#6b7280' }}
                    />

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-white">{source.source_name}</span>
                        <span className="badge" style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', borderColor: 'rgba(96,165,250,0.2)', fontSize: '10px', padding: '2px 7px' }}>
                          {source.source_type?.replace(/_/g, ' ')}
                        </span>
                        {source.quality_rating && source.quality_rating !== 'unrated' && (
                          <span className={cn('badge', QUALITY_COLORS[source.quality_rating])} style={{ fontSize: '10px', padding: '2px 7px' }}>
                            {source.quality_rating}
                          </span>
                        )}
                        {(() => {
                          const y = sourceYield(source)
                          return y.isLow ? (
                            <span
                              className="badge"
                              style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', borderColor: 'rgba(248,113,113,0.3)', fontSize: '10px', padding: '2px 7px' }}
                              title={`${Math.round((y.pct || 0) * 100)}% yield over ${source.companies_evaluated} researched — burning AI calls for very few leads. Consider pausing.`}
                            >
                              low yield — consider pausing
                            </span>
                          ) : null
                        })()}
                      </div>
                      <div className="flex items-center gap-3 text-xs" style={{ color: 'rgb(110,110,135)' }}>
                        <span className="truncate max-w-xs mono">{source.source_url_or_query || '—'}</span>
                        {source.last_run_at && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} /> Last run {formatDate(source.last_run_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats — always visible, so "0 leads" reads as a real
                        answer instead of silently showing nothing. */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(() => {
                        const leads = source.leads_generated || 0
                        const hasLeads = leads > 0
                        return (
                          <button
                            onClick={hasLeads ? () => toggleSourceLeads(source) : undefined}
                            title={hasLeads ? 'Show which leads this source brought' : 'This source has not generated any leads yet'}
                            style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                              minWidth: 56, padding: '5px 10px', borderRadius: 9,
                              border: `1px solid ${hasLeads ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.07)'}`,
                              background: hasLeads ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.02)',
                              cursor: hasLeads ? 'pointer' : 'default',
                              font: 'inherit',
                            }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 15, fontWeight: 700, color: hasLeads ? '#34d399' : 'rgb(120,120,140)' }}>
                              {leads}
                              {hasLeads && (expandedSourceId === source.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                            </span>
                            <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgb(100,100,120)' }}>leads</span>
                          </button>
                        )
                      })()}

                      {(() => {
                        const hasRun = !!source.total_runs
                        if (!hasRun) {
                          return (
                            <div
                              title="This source hasn't been run yet — no AI credits spent"
                              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, minWidth: 56, padding: '5px 10px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
                            >
                              <span style={{ fontSize: 15, fontWeight: 700, color: 'rgb(120,120,140)' }}>—</span>
                              <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgb(100,100,120)' }}>not run</span>
                            </div>
                          )
                        }
                        const y = sourceYield(source)
                        const yieldColor = y.isLow ? '#f87171' : y.pct != null ? '#60a5fa' : 'rgb(120,120,140)'
                        return (
                          <div
                            title={`${source.companies_evaluated || 0} companies researched (AI calls spent) over ${source.total_runs} run${source.total_runs === 1 ? '' : 's'}${y.pct != null ? ` — ${Math.round(y.pct * 100)}% ended up saved as leads` : ' — under 10 researched, too few to judge yield yet'}`}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, minWidth: 56, padding: '5px 10px', borderRadius: 9, border: `1px solid ${y.isLow ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.07)'}`, background: y.isLow ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.02)' }}
                          >
                            <span style={{ fontSize: 15, fontWeight: 700, color: yieldColor }}>
                              {y.pct != null ? `${Math.round(y.pct * 100)}%` : `${source.companies_evaluated || 0}`}
                            </span>
                            <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgb(100,100,120)' }}>
                              {y.pct != null ? 'yield' : 'researched'}
                            </span>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Run Now / Stop */}
                      <button
                        onClick={isRunning ? stopDiscovery : () => runDiscovery(source)}
                        disabled={!!runningId && !isRunning}
                        className="btn btn-ai flex items-center gap-1.5"
                        style={{
                          padding: '6px 12px', fontSize: '12px',
                          ...(isRunning
                            ? { color: '#fb7185', border: '1px solid rgba(248,113,133,0.35)', background: 'rgba(248,113,133,0.1)' }
                            : { opacity: runningId && runningId !== source.id ? 0.4 : 1 }),
                        }}
                        title={isRunning ? 'Stop discovery' : 'Run discovery now — bot will read this source and find leads'}
                      >
                        {isRunning ? (
                          <><Loader2 size={12} className="animate-spin" /><Square size={10} fill="#fb7185" style={{ marginLeft: 2 }} /> Stop</>
                        ) : (
                          <><Zap size={12} /> Run Now</>
                        )}
                      </button>

                      {/* Pause / Activate */}
                      <button
                        onClick={() => toggleStatus(source)}
                        className="btn btn-ghost"
                        style={{ padding: '6px', color: source.status === 'active' ? '#fbbf24' : '#34d399' }}
                        title={source.status === 'active' ? 'Pause source' : 'Activate source'}
                      >
                        {source.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
                      </button>

                      <button onClick={() => startEdit(source)} className="btn btn-ghost" style={{ padding: '6px' }} title="Edit">
                        <Edit size={13} />
                      </button>
                      <button onClick={() => deleteSource(source.id)} className="btn btn-ghost" style={{ padding: '6px', color: '#f87171' }} title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Result Panel — shown after a run */}
                  {result && (
                    <div
                      className="px-4 py-3 text-xs"
                      style={{
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        background: result.error
                          ? 'rgba(248,113,113,0.05)'
                          : 'rgba(52,211,153,0.04)',
                      }}
                    >
                      {result.error ? (
                        <div className="flex items-center gap-2" style={{ color: '#f87171' }}>
                          <AlertCircle size={13} />
                          <span>Error: {result.error}</span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-4">
                          <span className="flex items-center gap-1" style={{ color: '#34d399' }}>
                            <CheckCircle size={12} />
                            <strong>{result.saved}</strong> leads saved
                          </span>
                          <span style={{ color: 'rgb(110,110,135)' }}>{result.found} companies found on page</span>
                          {!!result.researched && (
                            <span style={{ color: 'rgb(110,110,135)' }}>
                              {result.researched} researched this run
                              {result.researched > 0 ? ` (${Math.round((result.saved / result.researched) * 100)}% yield)` : ''}
                            </span>
                          )}
                          {result.skipped_duplicate > 0 && (
                            <span style={{ color: 'rgb(110,110,135)' }}>{result.skipped_duplicate} already in DB</span>
                          )}
                          {(result.skipped_generic ?? 0) > 0 && (
                            <span style={{ color: 'rgb(110,110,135)' }}>{result.skipped_generic} generic categories filtered</span>
                          )}
                          {result.skipped_cap > 0 && (
                            <span style={{ color: '#fbbf24' }}>{result.skipped_cap} skipped (category full)</span>
                          )}
                          {result.skipped_low_score > 0 && (
                            <span style={{ color: 'rgb(110,110,135)' }}>{result.skipped_low_score} scored below 50</span>
                          )}
                          {result.leads_saved.length > 0 && (
                            <span style={{ color: 'rgb(160,160,180)' }}>
                              → {result.leads_saved.join(', ')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Per-source lead breakdown — which leads did this source actually bring */}
                  {expandedSourceId === source.id && (
                    <div className="px-4 py-3 text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(139,92,246,0.03)' }}>
                      {loadingSourceLeads === source.id ? (
                        <div className="flex items-center gap-2" style={{ color: 'rgb(130,135,165)' }}>
                          <Loader2 size={12} className="animate-spin" /> Loading leads…
                        </div>
                      ) : (sourceLeadsCache[source.id] || []).length === 0 ? (
                        <span style={{ color: 'rgb(110,110,135)' }}>
                          No leads with tracked attribution yet
                          {source.leads_generated ? ' — this source\'s counter predates per-lead tracking' : ''}.
                        </span>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {(sourceLeadsCache[source.id] || []).map(lead => (
                            <div key={lead.id} className="flex items-center gap-2 flex-wrap">
                              <Link
                                href={`/leads/${lead.id}`}
                                className="flex items-center gap-1 hover:underline"
                                style={{ color: 'rgb(210,212,230)', fontWeight: 500 }}
                              >
                                {lead.company_name} <ExternalLink size={10} />
                              </Link>
                              {lead.lead_score != null && (
                                <span className={cn('badge', getScoreBg(lead.lead_score))} style={{ fontSize: '10px', padding: '1px 6px' }}>
                                  {lead.lead_score}
                                </span>
                              )}
                              {lead.classification && lead.classification !== 'customer' && lead.classification !== 'unclear' && (
                                <span className="badge" style={{ fontSize: '10px', padding: '1px 6px', color: '#fb7185', background: 'rgba(251,113,133,0.12)' }}>
                                  {lead.classification.replace('_', ' ')}
                                </span>
                              )}
                              <span style={{ color: 'rgb(100,100,120)' }}>{lead.status} · {formatDate(lead.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
