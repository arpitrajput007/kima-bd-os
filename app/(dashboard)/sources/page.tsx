'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Plus, Edit, Trash2, Loader2, Save, X,
  Database, Play, Pause, Zap, CheckCircle, AlertCircle, Clock,
} from 'lucide-react'
import type { Source } from '@/lib/types'
import { cn, formatDate } from '@/lib/utils'

const SOURCE_TYPES = [
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
  skipped_duplicate: number
  skipped_cap: number
  skipped_low_score: number
  leads_saved: string[]
  error?: string
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
  const [runningId, setRunningId] = useState<string | null>(null)
  const [runResults, setRunResults] = useState<Record<string, RunResult>>({})

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

  // Run the discovery pipeline for a single source
  const runDiscovery = async (source: Source) => {
    if (!source.source_url_or_query) {
      toast.error('No URL configured for this source')
      return
    }
    setRunningId(source.id)
    setRunResults(prev => {
      const next = { ...prev }
      delete next[source.id]
      return next
    })

    try {
      const res = await fetch('/api/ai/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: source.id }),
      })
      const data: RunResult = await res.json()
      setRunResults(prev => ({ ...prev, [source.id]: data }))
      if (data.error) {
        toast.error(`Discovery failed: ${data.error}`)
      } else {
        toast.success(`Done! Saved ${data.saved} new leads from ${source.source_name}`)
        loadSources()
      }
    } catch (e) {
      toast.error('Network error during discovery')
      setRunResults(prev => ({
        ...prev,
        [source.id]: { found: 0, saved: 0, skipped_duplicate: 0, skipped_cap: 0, skipped_low_score: 0, leads_saved: [], error: 'Network error' },
      }))
    } finally {
      setRunningId(null)
    }
  }

  const filteredSources = sources.filter(s =>
    !search ||
    s.source_name.toLowerCase().includes(search.toLowerCase()) ||
    s.source_url_or_query?.toLowerCase().includes(search.toLowerCase())
  )

  const inputClass = 'input-dark'
  const selStyle = { fontSize: '13px' }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Source Manager</h1>
          <p className="text-xs mt-1" style={{ color: 'rgb(100,100,120)' }}>
            {sources.filter(s => s.status === 'active').length} active sources · Agent runs daily at 6:00 AM IST · Max 3 leads per category
          </p>
        </div>
        <button
          onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(!showForm) }}
          className="btn btn-primary"
          style={{ fontSize: '13px' }}
        >
          <Plus size={14} /> Add Source
        </button>
      </div>

      <div className="p-8 space-y-6">

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
                    URL or Search Query <span style={{ color: 'rgb(100,100,120)' }}>— the bot will read this page to find companies</span>
                  </label>
                  <input className={inputClass} style={selStyle} value={form.source_url_or_query || ''} onChange={e => setForm(f => ({ ...f, source_url_or_query: e.target.value }))} placeholder="e.g. https://layerzero.network/ecosystem  or  https://defillama.com/chains" />
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

        {/* Search */}
        <input
          className="input-dark max-w-xs"
          style={{ fontSize: '13px' }}
          placeholder="Search sources..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

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
                      </div>
                      <div className="flex items-center gap-3 text-xs" style={{ color: 'rgb(110,110,135)' }}>
                        <span className="truncate max-w-xs mono">{source.source_url_or_query || '—'}</span>
                        {source.last_run_at && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} /> Last run {formatDate(source.last_run_at)}
                          </span>
                        )}
                        {source.leads_generated != null && source.leads_generated > 0 && (
                          <span style={{ color: '#34d399' }}>· {source.leads_generated} leads generated total</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Run Now */}
                      <button
                        onClick={() => runDiscovery(source)}
                        disabled={!!runningId}
                        className="btn btn-ai flex items-center gap-1.5"
                        style={{ padding: '6px 12px', fontSize: '12px', opacity: runningId && runningId !== source.id ? 0.4 : 1 }}
                        title="Run discovery now — bot will read this source and find leads"
                      >
                        {isRunning ? (
                          <><Loader2 size={12} className="animate-spin" /> Running…</>
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
                          {result.skipped_duplicate > 0 && (
                            <span style={{ color: 'rgb(110,110,135)' }}>{result.skipped_duplicate} already in DB</span>
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
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
