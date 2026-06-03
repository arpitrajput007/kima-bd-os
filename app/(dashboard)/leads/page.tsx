'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Plus, Search, Filter, Star, ExternalLink, ChevronDown, ChevronRight,
  CheckCircle, XCircle, Eye, MessageSquare, Loader2, RefreshCw,
  AtSign, Send, MessageCircle, Sparkles, LayoutList, Layers, Clock
} from 'lucide-react'
import {
  cn, getScoreBg, getStatusColor, getStatusLabel, formatDate, truncate
} from '@/lib/utils'
import type { Lead } from '@/lib/types'
import { INDUSTRY_CATEGORIES, CUSTOMER_CATEGORIES, PRODUCTS_TO_SELL } from '@/lib/types'

const STATUS_OPTIONS = [
  'new', 'researching', 'qualified', 'approved', 'rejected',
  'contacted', 'replied', 'meeting_booked', 'archived', 'needs_more_research', 'reserved'
]

export default function LeadsPage() {
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    status: '',
    industry_category: '',
    customer_category: '',
    product_to_sell: '',
    min_score: '',
    priority: '',
  })
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'category'>('category')
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({})
  const toggleCat = (cat: string) => setCollapsedCats(p => ({ ...p, [cat]: !p[cat] }))
  const [activeCatFilter, setActiveCatFilter] = useState<string | null>(null)
  const [cleaning, setCleaning] = useState(false)

  // Archive existing leads whose name is a generic category, not a real company.
  const cleanupGeneric = async () => {
    setCleaning(true)
    try {
      // Preview first so the user sees exactly what will be archived.
      const preview = await fetch('/api/leads/cleanup-generic', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      }).then(r => r.json())
      if (preview.error) throw new Error(preview.error)
      if (!preview.matched) { toast.success('No generic-category leads found — your list is clean'); return }
      const sample = (preview.names || []).slice(0, 8).join(', ')
      if (!confirm(`Archive ${preview.matched} generic-category lead(s)?\n\n${sample}${preview.matched > 8 ? '…' : ''}\n\n(They’ll be archived, not deleted — recoverable.)`)) return
      const res = await fetch('/api/leads/cleanup-generic', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      }).then(r => r.json())
      if (res.error) throw new Error(res.error)
      toast.success(`Archived ${res.archived} generic lead(s)`)
      loadLeads()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Cleanup failed')
    } finally {
      setCleaning(false)
    }
  }

  const loadLeads = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('leads')
      .select('*')
      .order('lead_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (filters.status) query = query.eq('status', filters.status)
    // Hide archived/rejected/reserved by default — only show when explicitly filtered.
    else query = query.not('status', 'in', '("archived","rejected","reserved")')
    if (filters.industry_category) query = query.eq('industry_category', filters.industry_category)
    if (filters.product_to_sell) query = query.eq('product_to_sell', filters.product_to_sell)
    if (filters.priority) query = query.eq('priority', filters.priority)
    if (filters.min_score) query = query.gte('lead_score', parseInt(filters.min_score))
    if (filters.customer_category) query = query.contains('customer_category', [filters.customer_category])

    const { data, error } = await query.limit(200)
    if (error) toast.error('Failed to load leads')
    else setLeads(data || [])
    setLoading(false)
  }, [filters])

  useEffect(() => {
    loadLeads()
  }, [loadLeads])

  const filteredLeads = leads.filter(l =>
    !search ||
    l.company_name.toLowerCase().includes(search.toLowerCase()) ||
    l.industry_category?.toLowerCase().includes(search.toLowerCase()) ||
    l.pain_point?.toLowerCase().includes(search.toLowerCase())
  )

  // Per-category accent colors
  const CAT_COLORS: Record<string, string> = {
    'Agentic Payments Customer':           '#a78bfa',
    'LayerZero Customer':                  '#22d3ee',
    'Hacked Protocol':                     '#f87171',
    'Needs On/Off Ramp':                   '#34d399',
    'Fireblocks Customer':                 '#fb923c',
    'Web2 Stablecoin Settlement Customer': '#60a5fa',
    'Uncategorised':                       '#94a3b8',
  }
  const getCatColor = (cat: string) => CAT_COLORS[cat] ?? '#38bdf8'

  // Build category groups.
  // If a category pill is active → show ONLY that category (exclusive filter).
  // Each lead appears in each of its categories when no filter is active.
  const DEFINED_CATS: string[] = [...CUSTOMER_CATEGORIES]

  // All unique top-level categories (for the pill strip)
  const allCatGroups: { cat: string; leads: Lead[] }[] = (() => {
    const map: Record<string, Lead[]> = {}
    filteredLeads.forEach(l => {
      const cats = (l.customer_category || []).filter(Boolean)
      if (cats.length === 0) { (map['Uncategorised'] ??= []).push(l) }
      else { cats.forEach(c => { (map[c] ??= []).push(l) }) }
    })
    const defined = DEFINED_CATS.filter(c => map[c as string]) as string[]
    const extra = Object.keys(map).filter(c => !DEFINED_CATS.includes(c) && c !== 'Uncategorised').sort()
    const groups = [...defined, ...extra]
    if (map['Uncategorised']) groups.push('Uncategorised')
    return groups.map(cat => ({ cat, leads: map[cat] }))
  })()

  // Visible groups — if a pill is selected, show only that one category.
  // Within a selected category, group by industry_category (sub-categories).
  const categoryGroups = activeCatFilter
    ? allCatGroups.filter(g => g.cat === activeCatFilter)
    : allCatGroups

  // Sub-category groups for a selected category (grouped by industry_category)
  const subCategoryGroups: { sub: string; leads: Lead[] }[] = (() => {
    if (!activeCatFilter) return []
    const inCategory = filteredLeads.filter(l =>
      (l.customer_category || []).includes(activeCatFilter) ||
      (activeCatFilter === 'Uncategorised' && !(l.customer_category || []).length)
    )
    const map: Record<string, Lead[]> = {}
    inCategory.forEach(l => {
      const sub = l.industry_category?.trim() || 'Other'
      ;(map[sub] ??= []).push(l)
    })
    return Object.entries(map)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([sub, leads]) => ({ sub, leads }))
  })()

  const updateLeadStatus = async (id: string, status: string) => {
    setActionLoading(id + status)
    const { error } = await supabase
      .from('leads')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) toast.error('Update failed')
    else {
      toast.success(`Lead ${status.replace('_', ' ')}`)
      loadLeads()
    }
    setActionLoading(null)
  }

  const clearFilters = () => {
    setFilters({ status: '', industry_category: '', customer_category: '', product_to_sell: '', min_score: '', priority: '' })
    setSearch('')
  }

  const hasFilters = Object.values(filters).some(v => v) || search

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Lead Inbox</h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>
              {loading ? 'Loading...' : `${filteredLeads.length} leads`}
              {hasFilters && ' (filtered)'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div style={{ display: 'flex', borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <button onClick={() => setViewMode('category')}
                className={viewMode === 'category' ? 'btn btn-primary' : 'btn btn-ghost'}
                style={{ borderRadius: 0, padding: '6px 11px', fontSize: '12px', gap: 5 }}>
                <Layers size={12} /> Category
              </button>
              <button onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'btn btn-primary' : 'btn btn-ghost'}
                style={{ borderRadius: 0, padding: '6px 11px', fontSize: '12px', gap: 5 }}>
                <LayoutList size={12} /> List
              </button>
            </div>
            <button onClick={loadLeads} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={cleanupGeneric} disabled={cleaning} className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '12px' }}
              title="Archive leads whose name is a generic category instead of a real company">
              {cleaning ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Clean up
            </button>
            <Link href="/leads/new" className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '13px' }}>
              <Plus size={14} />
              Add Lead
            </Link>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgb(100,100,120)' }} />
            <input
              type="text"
              placeholder="Search leads..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-dark"
              style={{ paddingLeft: '34px' }}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn('btn btn-secondary', showFilters && 'border-violet-500/40 text-violet-300')}
            style={{ padding: '7px 12px', fontSize: '12px' }}
          >
            <Filter size={13} />
            Filters
            {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />}
            <ChevronDown size={12} className={showFilters ? 'rotate-180' : ''} />
          </button>
          {hasFilters && (
            <button onClick={clearFilters} className="btn btn-ghost text-xs" style={{ padding: '7px 10px', color: 'rgb(251,113,133)' }}>
              Clear
            </button>
          )}
        </div>

        {/* Filter Row */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 mt-3">
            <select
              value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
              className="input-dark"
              style={{ width: 'auto', fontSize: '12px', padding: '5px 8px' }}
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{getStatusLabel(s as Lead['status'])}</option>)}
            </select>

            <select
              value={filters.priority}
              onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}
              className="input-dark"
              style={{ width: 'auto', fontSize: '12px', padding: '5px 8px' }}
            >
              <option value="">All Priorities</option>
              <option value="excellent">Excellent (85+)</option>
              <option value="qualified">Qualified (70-84)</option>
              <option value="needs_research">Needs Research (50-69)</option>
              <option value="low_priority">Low Priority (&lt;50)</option>
            </select>

            <select
              value={filters.customer_category}
              onChange={e => setFilters(f => ({ ...f, customer_category: e.target.value }))}
              className="input-dark"
              style={{ width: 'auto', fontSize: '12px', padding: '5px 8px' }}
            >
              <option value="">All Sales Categories</option>
              {CUSTOMER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              value={filters.industry_category}
              onChange={e => setFilters(f => ({ ...f, industry_category: e.target.value }))}
              className="input-dark"
              style={{ width: 'auto', fontSize: '12px', padding: '5px 8px' }}
            >
              <option value="">All Industries</option>
              {INDUSTRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              value={filters.product_to_sell}
              onChange={e => setFilters(f => ({ ...f, product_to_sell: e.target.value }))}
              className="input-dark"
              style={{ width: 'auto', fontSize: '12px', padding: '5px 8px' }}
            >
              <option value="">All Products</option>
              {PRODUCTS_TO_SELL.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            <select
              value={filters.min_score}
              onChange={e => setFilters(f => ({ ...f, min_score: e.target.value }))}
              className="input-dark"
              style={{ width: 'auto', fontSize: '12px', padding: '5px 8px' }}
            >
              <option value="">Any Score</option>
              <option value="85">Score 85+</option>
              <option value="70">Score 70+</option>
              <option value="50">Score 50+</option>
            </select>
          </div>
        )}
      </div>

      {/* Category view */}
      {!loading && viewMode === 'category' && filteredLeads.length > 0 && (
        <div className="p-8 space-y-4">
          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, fontSize: 11, color: 'rgb(120,127,160)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Star size={11} color="#a78bfa" /> <strong style={{ color: 'rgb(160,165,195)' }}>Excellent</strong> — score 85+, top BD target</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: '#a78bfa', display: 'inline-block' }} /> Kima target category</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: '#38bdf8', display: 'inline-block' }} /> Other category</span>
          </div>
          {/* Category pill strip — click to filter exclusively to that category */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <button
              onClick={() => setActiveCatFilter(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${!activeCatFilter ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.08)'}`, background: !activeCatFilter ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)', color: !activeCatFilter ? '#a78bfa' : 'rgb(150,155,185)' }}>
              All
            </button>
            {allCatGroups.map(({ cat, leads: catLeads }) => {
              const isActive = activeCatFilter === cat
              const col = getCatColor(cat)
              return (
                <button key={cat}
                  onClick={() => setActiveCatFilter(isActive ? null : cat)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${isActive ? col + '70' : 'rgba(255,255,255,0.08)'}`, background: isActive ? col + '22' : 'rgba(255,255,255,0.03)', color: isActive ? col : 'rgb(150,155,185)', transition: 'all 0.15s' }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, flexShrink: 0, background: col, display: 'inline-block' }} />
                  {cat.replace(' Customer', '')}
                  <span style={{ fontWeight: 700, color: isActive ? col : 'rgb(140,145,175)' }}>{catLeads.length}</span>
                </button>
              )
            })}
          </div>

          {/* When a category is active and has sub-groups, show sub-category header */}
          {activeCatFilter && subCategoryGroups.length > 0 && (() => {
            const col = getCatColor(activeCatFilter)
            return (
              <div style={{ marginBottom: 12, padding: '10px 16px', borderRadius: 12, background: col + '10', border: `1px solid ${col}30`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: col, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{activeCatFilter.replace(' Customer', '')} sub-categories:</span>
                {subCategoryGroups.map(({ sub, leads: sl }) => (
                  <span key={sub} style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: col + '18', border: `1px solid ${col}40`, color: col }}>
                    {sub} · {sl.length}
                  </span>
                ))}
              </div>
            )
          })()}

          {categoryGroups.map(({ cat, leads: catLeads }) => {
            const collapsed = collapsedCats[cat]
            const col = getCatColor(cat)
            const statusColors: Record<string, string> = { new: '#a78bfa', contacted: '#38bdf8', replied: '#fbbf24', meeting_booked: '#34d399', approved: '#34d399' }
            // When filtered, render sub-category sections inside
            const useSubGroups = activeCatFilter === cat && subCategoryGroups.length > 0
            return (
              <div key={cat} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${col}30`, background: 'rgba(22,22,34,0.8)', borderLeft: `3px solid ${col}` }}>
                {/* Category header */}
                <button onClick={() => toggleCat(cat)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', background: `linear-gradient(90deg, ${col}10 0%, transparent 60%)`, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  {collapsed ? <ChevronRight size={14} color={col} /> : <ChevronDown size={14} color={col} />}
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{cat.replace(' Customer', '')}</span>
                    <span style={{ marginLeft: 10, fontSize: 12, color: 'rgb(130,135,165)' }}>{catLeads.length} lead{catLeads.length !== 1 ? 's' : ''}</span>
                  </div>
                  {/* Mini status bar */}
                  <div style={{ display: 'flex', gap: 5 }}>
                    {(['new', 'contacted', 'replied', 'meeting_booked'] as const).map(s => {
                      const n = catLeads.filter(l => l.status === s).length
                      if (!n) return null
                      return <span key={s} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 9, background: (statusColors[s] || '#a78bfa') + '18', color: statusColors[s] || '#a78bfa', border: `1px solid ${(statusColors[s] || '#a78bfa')}30` }}>{getStatusLabel(s)} {n}</span>
                    })}
                  </div>
                </button>

                {!collapsed && (
                  <div className="overflow-x-auto">
                    {useSubGroups ? (
                      // Render sub-category sections
                      subCategoryGroups.map(({ sub, leads: subLeads }) => (
                        <div key={sub}>
                          <div style={{ padding: '8px 18px 6px', background: `linear-gradient(90deg, ${col}12 0%, transparent 70%)`, borderTop: `1px solid ${col}20`, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 3, height: 14, borderRadius: 2, background: col, display: 'inline-block', flexShrink: 0 }} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: col, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{sub}</span>
                            <span style={{ fontSize: 10, color: 'rgb(120,127,160)', fontWeight: 500 }}>{subLeads.length} lead{subLeads.length !== 1 ? 's' : ''}</span>
                          </div>
                          <table className="w-full data-table" style={{ marginBottom: 0 }}>
                            <thead><tr style={{ background: 'rgba(255,255,255,0.01)' }}>
                              <th className="text-left">Company</th><th className="text-left">Pain Point</th>
                              <th className="text-left">Product</th><th className="text-left">Score</th>
                              <th className="text-left">Status</th><th className="text-left">Actions</th>
                            </tr></thead>
                            <tbody>
                              {subLeads.sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0)).map(lead => (
                                <tr key={lead.id}>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      {lead.priority === 'excellent' && <span title="Excellent priority — score 85+"><Star size={11} style={{ color: '#a78bfa' }} /></span>}
                                      <div>
                                        <Link href={`/leads/${lead.id}`} className="text-sm font-medium text-white hover:text-violet-300 transition-colors">{lead.company_name}</Link>
                                        {lead.website && <a href={lead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }} onClick={e => e.stopPropagation()}>{lead.website.replace(/^https?:\/\//, '').slice(0, 25)}<ExternalLink size={9} /></a>}
                                        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                                          {lead.twitter_url && <a href={lead.twitter_url} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}><AtSign size={11} /></a>}
                                          {lead.telegram_url && <a href={lead.telegram_url} target="_blank" rel="noopener noreferrer" style={{ color: '#22d3ee' }}><Send size={11} /></a>}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td><span className="text-xs" style={{ color: 'rgb(140,140,160)' }}>{lead.pain_point ? truncate(lead.pain_point, 55) : '—'}</span></td>
                                  <td><span className="text-xs" style={{ color: 'rgb(160,160,180)' }}>{lead.product_to_sell ? truncate(lead.product_to_sell, 22) : '—'}</span></td>
                                  <td>{lead.lead_score != null ? <span className={cn('badge', getScoreBg(lead.lead_score))}>{lead.lead_score}</span> : '—'}</td>
                                  <td><span className={cn('badge', getStatusColor(lead.status))}>{getStatusLabel(lead.status)}</span></td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <Link href={`/leads/${lead.id}`} className="btn btn-ghost p-1.5" title="View" style={{ padding: 5 }}><Eye size={13} /></Link>
                                      {lead.status !== 'approved' && <button onClick={() => updateLeadStatus(lead.id, 'approved')} disabled={actionLoading === lead.id + 'approved'} className="btn btn-ghost p-1.5" title="Approve" style={{ padding: 5, color: '#34d399' }}>{actionLoading === lead.id + 'approved' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}</button>}
                                      {lead.status !== 'rejected' && <button onClick={() => updateLeadStatus(lead.id, 'rejected')} disabled={actionLoading === lead.id + 'rejected'} className="btn btn-ghost p-1.5" title="Reject" style={{ padding: 5, color: '#f87171' }}>{actionLoading === lead.id + 'rejected' ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}</button>}
                                      {lead.status !== 'reserved' && <button onClick={() => updateLeadStatus(lead.id, 'reserved')} disabled={actionLoading === lead.id + 'reserved'} className="btn btn-ghost p-1.5" title="Reserve for later" style={{ padding: 5, color: '#818cf8' }}>{actionLoading === lead.id + 'reserved' ? <Loader2 size={13} className="animate-spin" /> : <Clock size={13} />}</button>}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))
                    ) : (
                    <table className="w-full data-table" style={{ marginBottom: 0 }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.015)' }}>
                          <th className="text-left">Company</th>
                          <th className="text-left">Industry</th>
                          <th className="text-left">Pain Point</th>
                          <th className="text-left">Product</th>
                          <th className="text-left">Score</th>
                          <th className="text-left">Status</th>
                          <th className="text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catLeads.sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0)).map(lead => (
                          <tr key={lead.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {lead.priority === 'excellent' && <span title="Excellent priority — score 85+, top BD target" style={{ display:'inline-flex', flexShrink:0 }}><Star size={11} style={{ color: '#a78bfa' }} /></span>}
                                <div>
                                  <Link href={`/leads/${lead.id}`} className="text-sm font-medium text-white hover:text-violet-300 transition-colors">{lead.company_name}</Link>
                                  {lead.website && <a href={lead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }} onClick={e => e.stopPropagation()}>{lead.website.replace(/^https?:\/\//, '').slice(0, 25)}<ExternalLink size={9} /></a>}
                                  <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                                    {lead.twitter_url && <a href={lead.twitter_url} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}><AtSign size={11} /></a>}
                                    {lead.telegram_url && <a href={lead.telegram_url} target="_blank" rel="noopener noreferrer" style={{ color: '#22d3ee' }}><Send size={11} /></a>}
                                    {lead.discord_url && <a href={lead.discord_url} target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8' }}><MessageCircle size={11} /></a>}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td><span className="text-xs" style={{ color: 'rgb(160,160,180)' }}>{lead.industry_category ? truncate(lead.industry_category, 22) : '—'}</span></td>
                            <td><span className="text-xs" style={{ color: 'rgb(140,140,160)' }}>{lead.pain_point ? truncate(lead.pain_point, 50) : '—'}</span></td>
                            <td><span className="text-xs" style={{ color: 'rgb(160,160,180)' }}>{lead.product_to_sell ? truncate(lead.product_to_sell, 22) : '—'}</span></td>
                            <td>{lead.lead_score != null ? <span className={cn('badge', getScoreBg(lead.lead_score))}>{lead.lead_score}</span> : '—'}</td>
                            <td><span className={cn('badge', getStatusColor(lead.status))}>{getStatusLabel(lead.status)}</span></td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Link href={`/leads/${lead.id}`} className="btn btn-ghost p-1.5" title="View" style={{ padding: 5 }}><Eye size={13} /></Link>
                                {lead.status !== 'approved' && <button onClick={() => updateLeadStatus(lead.id, 'approved')} disabled={actionLoading === lead.id + 'approved'} className="btn btn-ghost p-1.5" title="Approve" style={{ padding: 5, color: '#34d399' }}>{actionLoading === lead.id + 'approved' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}</button>}
                                {lead.status !== 'rejected' && <button onClick={() => updateLeadStatus(lead.id, 'rejected')} disabled={actionLoading === lead.id + 'rejected'} className="btn btn-ghost p-1.5" title="Reject" style={{ padding: 5, color: '#f87171' }}>{actionLoading === lead.id + 'rejected' ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}</button>}
                                {lead.status !== 'reserved' && <button onClick={() => updateLeadStatus(lead.id, 'reserved')} disabled={actionLoading === lead.id + 'reserved'} className="btn btn-ghost p-1.5" title="Reserve for later — too big right now" style={{ padding: 5, color: '#818cf8' }}>{actionLoading === lead.id + 'reserved' ? <Loader2 size={13} className="animate-spin" /> : <Clock size={13} />}</button>}
                                <Link href={`/outreach?lead=${lead.id}`} className="btn btn-ghost p-1.5" title="Outreach" style={{ padding: 5, color: '#a78bfa' }}><MessageSquare size={13} /></Link>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* List / fallback */}
      <div className={viewMode === 'list' ? 'p-8' : (filteredLeads.length === 0 || loading ? 'p-8' : 'hidden')}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin" style={{ color: 'rgb(139, 92, 246)' }} />
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-sm font-medium text-white mb-2">No leads found</div>
            <div className="text-xs mb-4" style={{ color: 'rgb(100,100,120)' }}>
              {hasFilters ? 'Try adjusting your filters' : 'Add your first lead to get started'}
            </div>
            {!hasFilters && (
              <Link href="/leads/new" className="btn btn-primary" style={{ fontSize: '13px' }}>
                <Plus size={14} /> Add First Lead
              </Link>
            )}
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden"
            style={{ background: 'rgba(22, 22, 34, 0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th className="text-left">Company</th>
                    <th className="text-left">Sales Cat.</th>
                    <th className="text-left">Industry</th>
                    <th className="text-left">Product</th>
                    <th className="text-left">Pain Point</th>
                    <th className="text-left">Score</th>
                    <th className="text-left">Status</th>
                    <th className="text-left">Date</th>
                    <th className="text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map(lead => (
                    <tr key={lead.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          {lead.priority === 'excellent' && <Star size={11} style={{ color: '#a78bfa', flexShrink: 0 }} />}
                          <div>
                            <Link
                              href={`/leads/${lead.id}`}
                              className="text-sm font-medium text-white hover:text-violet-300 transition-colors"
                            >
                              {lead.company_name}
                            </Link>
                            {lead.website && (
                              <a href={lead.website} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs mt-0.5"
                                style={{ color: 'rgb(100,100,120)' }}
                                onClick={e => e.stopPropagation()}>
                                {lead.website.replace(/^https?:\/\//, '').slice(0, 25)}
                                <ExternalLink size={9} />
                              </a>
                            )}
                            {(lead.twitter_url || lead.telegram_url || lead.discord_url) && (
                              <div className="flex items-center gap-1.5 mt-1">
                                {lead.twitter_url && (
                                  <a href={lead.twitter_url} target="_blank" rel="noopener noreferrer"
                                    title="Twitter / X" onClick={e => e.stopPropagation()}
                                    style={{ color: '#38bdf8' }}>
                                    <AtSign size={12} />
                                  </a>
                                )}
                                {lead.telegram_url && (
                                  <a href={lead.telegram_url} target="_blank" rel="noopener noreferrer"
                                    title="Telegram" onClick={e => e.stopPropagation()}
                                    style={{ color: '#22d3ee' }}>
                                    <Send size={12} />
                                  </a>
                                )}
                                {lead.discord_url && (
                                  <a href={lead.discord_url} target="_blank" rel="noopener noreferrer"
                                    title="Discord" onClick={e => e.stopPropagation()}
                                    style={{ color: '#818cf8' }}>
                                    <MessageCircle size={12} />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {(lead.customer_category || []).slice(0, 2).map(cat => (
                            <span key={cat} className="badge text-xs"
                              style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', borderColor: 'rgba(139,92,246,0.2)', fontSize: '10px', padding: '1px 6px' }}>
                              {cat.replace(' Customer', '').replace('Needs ', '').replace(' Settlement Customer', '')}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className="text-xs" style={{ color: 'rgb(160,160,180)' }}>
                          {lead.industry_category ? truncate(lead.industry_category, 24) : '—'}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs" style={{ color: 'rgb(160,160,180)' }}>
                          {lead.product_to_sell ? truncate(lead.product_to_sell, 22) : '—'}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs" style={{ color: 'rgb(140,140,160)' }}>
                          {lead.pain_point ? truncate(lead.pain_point, 40) : '—'}
                        </span>
                      </td>
                      <td>
                        {lead.lead_score != null ? (
                          <span className={cn('badge', getScoreBg(lead.lead_score))}>
                            {lead.lead_score}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <span className={cn('badge', getStatusColor(lead.status))}>
                          {getStatusLabel(lead.status)}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs" style={{ color: 'rgb(100,100,120)' }}>
                          {formatDate(lead.created_at)}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Link href={`/leads/${lead.id}`}
                            className="btn btn-ghost p-1.5" title="View"
                            style={{ padding: '5px' }}>
                            <Eye size={13} />
                          </Link>
                          {lead.status !== 'approved' && (
                            <button
                              onClick={() => updateLeadStatus(lead.id, 'approved')}
                              disabled={actionLoading === lead.id + 'approved'}
                              className="btn btn-ghost p-1.5" title="Approve"
                              style={{ padding: '5px', color: '#34d399' }}>
                              {actionLoading === lead.id + 'approved'
                                ? <Loader2 size={13} className="animate-spin" />
                                : <CheckCircle size={13} />}
                            </button>
                          )}
                          {lead.status !== 'rejected' && (
                            <button
                              onClick={() => updateLeadStatus(lead.id, 'rejected')}
                              disabled={actionLoading === lead.id + 'rejected'}
                              className="btn btn-ghost p-1.5" title="Reject"
                              style={{ padding: '5px', color: '#f87171' }}>
                              {actionLoading === lead.id + 'rejected'
                                ? <Loader2 size={13} className="animate-spin" />
                                : <XCircle size={13} />}
                            </button>
                          )}
                          <Link href={`/outreach?lead=${lead.id}`}
                            className="btn btn-ghost p-1.5" title="Generate outreach"
                            style={{ padding: '5px', color: '#a78bfa' }}>
                            <MessageSquare size={13} />
                          </Link>
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

