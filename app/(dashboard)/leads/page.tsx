'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Plus, Search, Filter, Star, ExternalLink, ChevronDown,
  CheckCircle, XCircle, Eye, MessageSquare, Loader2, RefreshCw,
  LayoutList
} from 'lucide-react'
import {
  cn, getScoreBg, getStatusColor, getStatusLabel, formatDate, truncate
} from '@/lib/utils'
import type { Lead } from '@/lib/types'
import { INDUSTRY_CATEGORIES, CUSTOMER_CATEGORIES, PRODUCTS_TO_SELL } from '@/lib/types'

const STATUS_OPTIONS = [
  'new', 'researching', 'qualified', 'approved', 'rejected',
  'contacted', 'replied', 'meeting_booked', 'archived', 'needs_more_research'
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

  const loadLeads = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('leads')
      .select('*')
      .order('lead_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (filters.status) query = query.eq('status', filters.status)
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
    <div className="fade-in page-container">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F4F4F5] tracking-tight">Lead Pipeline</h1>
          <p className="text-[13px] font-medium text-[#A1A1AA] mt-1">
            {loading ? 'Loading...' : `${filteredLeads.length} leads in view`}
            {hasFilters && ' (filtered)'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadLeads} className="btn btn-secondary px-3">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Sync</span>
          </button>
          <Link href="/leads/new" className="btn btn-primary">
            <Plus size={14} />
            Add Lead
          </Link>
        </div>
      </div>

      <div className="space-y-6">
        {/* Search & Filter Bar */}
        <div className="glass p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-lg">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#71717A]" />
            <input
              type="text"
              placeholder="Search by company name, industry, or pain point..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-dark w-full pl-10"
            />
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'btn btn-secondary transition-colors',
                showFilters && 'bg-[#1A1A24] border-[#3F3F50] text-[#F4F4F5]',
                hasFilters && !showFilters && 'border-[#7C3AED] text-[#A78BFA]'
              )}
            >
              <Filter size={14} />
              Filters
              {hasFilters && <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />}
              <ChevronDown size={14} className={cn("transition-transform", showFilters && "rotate-180")} />
            </button>
            {hasFilters && (
              <button onClick={clearFilters} className="btn btn-ghost text-[#EF4444] hover:bg-[#EF4444]/10 hover:text-[#EF4444]">
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Filter Dropdown Row */}
        {showFilters && (
          <div className="glass p-4 flex flex-wrap gap-3 animate-in slide-in-from-top-2">
            <select
              value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
              className="input-dark w-auto text-[13px] py-2 bg-[#171724]"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{getStatusLabel(s as Lead['status'])}</option>)}
            </select>

            <select
              value={filters.priority}
              onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}
              className="input-dark w-auto text-[13px] py-2 bg-[#171724]"
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
              className="input-dark w-auto text-[13px] py-2 bg-[#171724]"
            >
              <option value="">All Sales Categories</option>
              {CUSTOMER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              value={filters.industry_category}
              onChange={e => setFilters(f => ({ ...f, industry_category: e.target.value }))}
              className="input-dark w-auto text-[13px] py-2 bg-[#171724]"
            >
              <option value="">All Industries</option>
              {INDUSTRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              value={filters.product_to_sell}
              onChange={e => setFilters(f => ({ ...f, product_to_sell: e.target.value }))}
              className="input-dark w-auto text-[13px] py-2 bg-[#171724]"
            >
              <option value="">All Products</option>
              {PRODUCTS_TO_SELL.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            <select
              value={filters.min_score}
              onChange={e => setFilters(f => ({ ...f, min_score: e.target.value }))}
              className="input-dark w-auto text-[13px] py-2 bg-[#171724]"
            >
              <option value="">Any Score</option>
              <option value="85">Score 85+</option>
              <option value="70">Score 70+</option>
              <option value="50">Score 50+</option>
            </select>
          </div>
        )}

        {/* Data View */}
        <div>
          {loading ? (
            <div className="glass p-20 flex flex-col items-center justify-center">
              <Loader2 size={32} className="animate-spin text-[#8B5CF6] mb-4" />
              <div className="text-[#A1A1AA] text-sm">Syncing pipeline data...</div>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="glass p-20 text-center max-w-2xl mx-auto mt-8">
              <div className="w-20 h-20 bg-[#171724] border border-[#272738] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                <LayoutList size={32} className="text-[#71717A]" />
              </div>
              <h3 className="text-xl font-bold text-[#F4F4F5] mb-2 tracking-tight">No leads found</h3>
              <p className="text-[#A1A1AA] mb-8 leading-relaxed max-w-md mx-auto">
                {hasFilters 
                  ? "We couldn't find any leads matching your current filters. Try relaxing your search criteria." 
                  : "Your pipeline is currently empty. Start by manually injecting a lead or connecting a data source."}
              </p>
              
              <div className="flex justify-center gap-3">
                {hasFilters ? (
                  <button onClick={clearFilters} className="btn btn-secondary">
                    Clear Filters
                  </button>
                ) : (
                  <Link href="/leads/new" className="btn btn-primary">
                    <Plus size={14} /> Add First Lead
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="glass overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full data-table">
                  <thead>
                    <tr className="bg-[#171724]">
                      <th>Company</th>
                      <th>Sales Category</th>
                      <th>Industry</th>
                      <th>Product Focus</th>
                      <th>Pain Point</th>
                      <th>Score</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A1A24]">
                    {filteredLeads.map(lead => (
                      <tr key={lead.id} className="hover:bg-[#1A1A24] transition-colors group">
                        <td>
                          <div className="flex items-center gap-2">
                            {lead.priority === 'excellent' && <Star size={14} className="text-[#A78BFA] fill-[#A78BFA] shrink-0" />}
                            <div>
                              <Link
                                href={`/leads/${lead.id}`}
                                className="text-[14px] font-semibold text-[#F4F4F5] hover:text-[#A78BFA] transition-colors tracking-tight"
                              >
                                {lead.company_name}
                              </Link>
                              {lead.website && (
                                <a href={lead.website} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-[12px] text-[#A1A1AA] hover:text-[#D4D4D8] mt-0.5 w-max"
                                  onClick={e => e.stopPropagation()}>
                                  {lead.website.replace(/^https?:\/\//, '').slice(0, 25)}
                                  <ExternalLink size={10} />
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1.5">
                            {(lead.customer_category || []).slice(0, 2).map(cat => (
                              <span key={cat} className="badge bg-[rgba(124,58,237,0.1)] text-[#A78BFA] border-[rgba(124,58,237,0.2)]">
                                {cat.replace(' Customer', '').replace('Needs ', '').replace(' Settlement Customer', '')}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span className="text-[13px] text-[#A1A1AA]">
                            {lead.industry_category ? truncate(lead.industry_category, 24) : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="text-[13px] text-[#A1A1AA] font-medium">
                            {lead.product_to_sell ? truncate(lead.product_to_sell, 22) : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="text-[13px] text-[#A1A1AA]" title={lead.pain_point || ''}>
                            {lead.pain_point ? truncate(lead.pain_point, 40) : '—'}
                          </span>
                        </td>
                        <td>
                          {lead.lead_score != null ? (
                            <span className={cn('badge shadow-sm', getScoreBg(lead.lead_score))}>
                              {lead.lead_score}
                            </span>
                          ) : <span className="text-[#71717A]">—</span>}
                        </td>
                        <td>
                          <span className={cn('badge', getStatusColor(lead.status))}>
                            {getStatusLabel(lead.status)}
                          </span>
                        </td>
                        <td>
                          <span className="text-[12px] text-[#A1A1AA] font-medium">
                            {formatDate(lead.created_at)}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link href={`/leads/${lead.id}`}
                              className="btn btn-ghost p-2" title="View Details">
                              <Eye size={15} />
                            </Link>
                            {lead.status !== 'approved' && (
                              <button
                                onClick={() => updateLeadStatus(lead.id, 'approved')}
                                disabled={actionLoading === lead.id + 'approved'}
                                className="btn btn-ghost p-2 text-[#34D399] hover:bg-[#34D399]/10" title="Approve for Outreach">
                                {actionLoading === lead.id + 'approved'
                                  ? <Loader2 size={15} className="animate-spin" />
                                  : <CheckCircle size={15} />}
                              </button>
                            )}
                            {lead.status !== 'rejected' && (
                              <button
                                onClick={() => updateLeadStatus(lead.id, 'rejected')}
                                disabled={actionLoading === lead.id + 'rejected'}
                                className="btn btn-ghost p-2 text-[#EF4444] hover:bg-[#EF4444]/10" title="Reject Lead">
                                {actionLoading === lead.id + 'rejected'
                                  ? <Loader2 size={15} className="animate-spin" />
                                  : <XCircle size={15} />}
                              </button>
                            )}
                            <Link href={`/outreach?lead=${lead.id}`}
                              className="btn btn-ghost p-2 text-[#A78BFA] hover:bg-[#A78BFA]/10" title="Generate Outreach Email">
                              <MessageSquare size={15} />
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
    </div>
  )
}
