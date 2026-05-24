'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, Save, X, Database, Play, Pause } from 'lucide-react'
import type { Source } from '@/lib/types'
import { cn, formatDate } from '@/lib/utils'

const SOURCE_TYPES = [
  'website', 'google_search', 'twitter_profile', 'linkedin_company',
  'telegram_group', 'rss_feed', 'defillama_category', 'crunchbase_list',
  'ecosystem_directory', 'hackathon_directory', 'news_source', 'manual_list'
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
  target_industry_category: '', target_customer_category: '',
  frequency: 'weekly', quality_rating: 'unrated', status: 'active', notes: ''
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

  const loadSources = async () => {
    setLoading(true)
    const { data } = await supabase.from('sources').select('*').order('status').order('created_at', { ascending: false })
    setSources(data || [])
    setLoading(false)
  }

  useEffect(() => { loadSources() }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.source_name) { toast.error('Source name required'); return }
    setSaving(true)

    const payload = { ...form }
    delete payload.id; delete payload.created_at; delete payload.updated_at; delete payload.leads_generated; delete payload.last_run_at

    let error
    if (editId) {
      ({ error } = await supabase.from('sources').update(payload).eq('id', editId))
    } else {
      ({ error } = await supabase.from('sources').insert(payload))
    }

    if (error) toast.error('Failed to save')
    else { toast.success(editId ? 'Source updated' : 'Source added'); setShowForm(false); setEditId(null); setForm(emptyForm); loadSources() }
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

  const filteredSources = sources.filter(s =>
    !search || s.source_name.toLowerCase().includes(search.toLowerCase()) ||
    s.source_url_or_query?.toLowerCase().includes(search.toLowerCase())
  )

  const inputClass = 'input-dark'
  const selStyle = { fontSize: '13px' }

  return (
    <div className="fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Source Manager</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>
            Manage research sources — {sources.filter(s => s.status === 'active').length} active, {sources.length} total
          </p>
        </div>
        <button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(!showForm) }}
          className="btn btn-primary" style={{ fontSize: '13px' }}>
          <Plus size={14} />Add Source
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
                    {SOURCE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>URL or Search Query</label>
                  <input className={inputClass} style={selStyle} value={form.source_url_or_query || ''} onChange={e => setForm(f => ({ ...f, source_url_or_query: e.target.value }))} placeholder='e.g. "LayerZero integration" "USDC" OR https://layerzero.network/ecosystem' />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>Target Industry Category</label>
                  <input className={inputClass} style={selStyle} value={form.target_industry_category || ''} onChange={e => setForm(f => ({ ...f, target_industry_category: e.target.value }))} placeholder="e.g. DEX, Wallet, RWA platform" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>Target Sales Category</label>
                  <input className={inputClass} style={selStyle} value={form.target_customer_category || ''} onChange={e => setForm(f => ({ ...f, target_customer_category: e.target.value }))} placeholder="e.g. LayerZero Customer" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>Frequency</label>
                  <select className={inputClass} style={selStyle} value={form.frequency || 'weekly'} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as Source['frequency'] }))}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="manual">Manual</option>
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
                  <X size={13} />Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search */}
        <input className="input-dark max-w-xs" style={{ fontSize: '13px' }} placeholder="Search sources..." value={search} onChange={e => setSearch(e.target.value)} />

        {/* Sources Table */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#a78bfa' }} /></div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th className="text-left">Source Name</th>
                    <th className="text-left">Type</th>
                    <th className="text-left">Query / URL</th>
                    <th className="text-left">Target</th>
                    <th className="text-left">Freq</th>
                    <th className="text-left">Quality</th>
                    <th className="text-left">Status</th>
                    <th className="text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSources.map(source => (
                    <tr key={source.id}>
                      <td>
                        <div className="text-sm font-medium text-white">{source.source_name}</div>
                        {source.notes && <div className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>{source.notes}</div>}
                      </td>
                      <td>
                        <span className="badge" style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', borderColor: 'rgba(96,165,250,0.2)', fontSize: '10px' }}>
                          {source.source_type?.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs mono" style={{ color: 'rgb(140,140,160)' }}>
                          {source.source_url_or_query ? source.source_url_or_query.slice(0, 50) + (source.source_url_or_query.length > 50 ? '...' : '') : '—'}
                        </span>
                      </td>
                      <td>
                        <div className="text-xs" style={{ color: 'rgb(140,140,160)' }}>
                          {source.target_customer_category || source.target_industry_category || '—'}
                        </div>
                      </td>
                      <td>
                        <span className="text-xs capitalize" style={{ color: 'rgb(160,160,180)' }}>{source.frequency}</span>
                      </td>
                      <td>
                        {source.quality_rating && (
                          <span className={cn('badge', QUALITY_COLORS[source.quality_rating] || QUALITY_COLORS.unrated)} style={{ fontSize: '10px' }}>
                            {source.quality_rating}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={cn('badge', source.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
                        )} style={{ fontSize: '10px' }}>
                          {source.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => toggleStatus(source)} className="btn btn-ghost" style={{ padding: '4px', color: source.status === 'active' ? '#fbbf24' : '#34d399' }} title={source.status === 'active' ? 'Pause' : 'Activate'}>
                            {source.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
                          </button>
                          <button onClick={() => startEdit(source)} className="btn btn-ghost" style={{ padding: '4px' }}>
                            <Edit size={13} />
                          </button>
                          <button onClick={() => deleteSource(source.id)} className="btn btn-ghost" style={{ padding: '4px', color: '#f87171' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
