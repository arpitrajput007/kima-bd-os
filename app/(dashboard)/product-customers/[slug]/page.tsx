'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft, ArrowRight, Database, Compass, Loader2, Star, ExternalLink,
  AtSign, Send, MessageCircle, MessageSquare, Flame, Eye, CheckCircle, XCircle,
  CalendarCheck,
} from 'lucide-react'
import { getProductSection, PRODUCT_DISCOVERY, ACCENT_HEX } from '@/lib/product-sections'
import { cn, getScoreBg, getUrgencyBg, getStatusColor, getStatusLabel, truncate, groupByDay } from '@/lib/utils'
import type { Lead } from '@/lib/types'
import { notFound } from 'next/navigation'

const NON_CUSTOMER_CLASSIFICATIONS_FILTER = '("competitor","investor_ecosystem","not_relevant","partner")'

export default function ProductCustomersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const section = getProductSection(slug)
  if (!section) notFound()
  const discovery = PRODUCT_DISCOVERY[section.slug]
  const accentColor = ACCENT_HEX[section.accent]

  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(!!discovery)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadLeads = () => {
    if (!discovery) { setLoading(false); return }
    setLoading(true)
    supabase
      .from('leads')
      .select('*')
      .contains('customer_category', [discovery.category])
      .not('classification', 'in', NON_CUSTOMER_CLASSIFICATIONS_FILTER)
      .order('urgency_score', { ascending: false, nullsFirst: false })
      .order('lead_score', { ascending: false, nullsFirst: false })
      .limit(200)
      .then(({ data }) => {
        setLeads((data as Lead[]) || [])
        setLoading(false)
      })
  }

  useEffect(loadLeads, [discovery]) // eslint-disable-line react-hooks/exhaustive-deps

  const dayGroups = groupByDay(leads, l => l.created_at)

  const updateLeadStatus = async (id: string, status: string) => {
    setActionLoading(id + status)
    const { error } = await supabase.from('leads').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) toast.error('Update failed')
    else {
      toast.success(`Lead ${status.replace('_', ' ')}`)
      loadLeads()
    }
    setActionLoading(null)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5 fade-in">
      <div>
        <Link href="/leads" className="inline-flex items-center gap-1.5 text-[12px] mb-3" style={{ color: 'var(--text-3)' }}>
          <ArrowLeft size={13} /> Lead Inbox
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span style={{ width: 9, height: 9, borderRadius: 999, background: accentColor, display: 'inline-block', flexShrink: 0 }} />
            {section.label} Customers
            {discovery && !loading && (
              <span className="text-[13px] font-normal" style={{ color: 'var(--text-3)' }}>· {leads.length} customer{leads.length !== 1 ? 's' : ''}</span>
            )}
          </h1>
          <div className="flex items-center gap-2">
            <Link href={`/product-approach/${slug}`} className="btn btn-ghost">
              <Compass size={14} /> Approach
            </Link>
            <Link href={`/product-resources/${slug}`} className="btn btn-secondary">
              <Database size={14} /> Resources
            </Link>
          </div>
        </div>
        {discovery && (
          <p className="text-[12px] mt-1 flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
            <Star size={11} style={{ color: '#a78bfa' }} /> = excellent (score 85+) · scored as a fit for {section.label} (customer_category: &quot;{discovery.category}&quot;) — run resources from the{' '}
            <Link href={`/product-resources/${slug}`} className="underline" style={{ color: 'var(--text-2)' }}>Resources page</Link> to find more.
          </p>
        )}
      </div>

      {!discovery ? (
        <div className="section-card p-6 text-center space-y-4">
          <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>
            {section.label} isn&apos;t scored by the automated discovery pipeline, so there&apos;s no live customer list here yet.
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Link href={`/product-approach/${slug}`} className="btn btn-secondary">
              <Compass size={14} /> Set hunting approach
            </Link>
            <Link href={`/product-resources/${slug}`} className="btn btn-secondary">
              <Database size={14} /> Manage resources
            </Link>
            <Link href="/leads" className="btn btn-ghost">
              View all leads <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      ) : loading ? (
        <div className="section-card p-8 text-center"><Loader2 size={20} className="animate-spin mx-auto" style={{ color: 'var(--text-3)' }} /></div>
      ) : leads.length === 0 ? (
        <div className="section-card p-6 text-center space-y-4">
          <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>
            No {section.label} customers found yet. Add resources and run them to have the agent find some.
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Link href={`/product-resources/${slug}`} className="btn btn-primary">
              <Database size={14} /> Manage resources
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-3)' }}>
            <CalendarCheck size={13} />
            <span>Found by day · {leads.length} total</span>
          </div>
          {dayGroups.map(group => {
            const isToday = group.label === 'Today'
            return (
              <div key={group.key} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${accentColor}30`, background: 'rgb(var(--bg-surface-2))', borderLeft: `3px solid ${isToday ? '#fb7185' : accentColor}` }}>
                <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <CalendarCheck size={13} style={{ color: isToday ? '#fb7185' : '#fbbf24' }} />
                  <span className="text-[13px] font-bold" style={{ color: isToday ? '#fb7185' : 'white' }}>{group.label}</span>
                  <span className="badge" style={{ fontSize: 10 }}>{group.items.length} found</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full data-table" style={{ marginBottom: 0 }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.015)' }}>
                        <th className="text-left">Company</th>
                        <th className="text-left">Industry</th>
                        <th className="text-left">Pain Point</th>
                        <th className="text-left">Urgency</th>
                        <th className="text-left">Score</th>
                        <th className="text-left">Status</th>
                        <th className="text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map(lead => (
                  <tr key={lead.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {lead.priority === 'excellent' && <span title="Excellent priority — score 85+, top BD target" style={{ display: 'inline-flex', flexShrink: 0 }}><Star size={11} style={{ color: '#a78bfa' }} /></span>}
                        <div>
                          <Link href={`/leads/${lead.id}`} className="text-sm font-medium text-white hover:text-violet-300 transition-colors">{lead.company_name}</Link>
                          {lead.assigned_to && (
                            <span className="badge text-xs ml-1.5" title={`Assigned to ${lead.assigned_to}`}
                              style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', borderColor: 'rgba(251,191,36,0.25)', fontSize: '10px', padding: '1px 6px' }}>
                              → {lead.assigned_to}
                            </span>
                          )}
                          {lead.website && <a href={lead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }} onClick={e => e.stopPropagation()}>{lead.website.replace(/^https?:\/\//, '').slice(0, 25)}<ExternalLink size={9} /></a>}
                          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                            {lead.twitter_url && <a href={lead.twitter_url} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}><AtSign size={11} /></a>}
                            {lead.telegram_url && <a href={lead.telegram_url} target="_blank" rel="noopener noreferrer" style={{ color: '#22d3ee' }}><Send size={11} /></a>}
                            {lead.discord_url && <a href={lead.discord_url} target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8' }}><MessageCircle size={11} /></a>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td><span className="text-xs" style={{ color: 'rgb(140,140,160)' }}>{lead.industry_category || '—'}</span></td>
                    <td><span className="text-xs" style={{ color: 'rgb(140,140,160)' }}>{lead.pain_point ? truncate(lead.pain_point, 50) : '—'}</span></td>
                    <td>
                      {lead.urgency_score != null ? (
                        <span className={cn('badge', getUrgencyBg(lead.urgency_score))} title={lead.urgency_reasoning || ''}>
                          {lead.urgency_score >= 70 && <Flame size={10} style={{ marginRight: 3, display: 'inline' }} />}
                          {lead.urgency_score}
                        </span>
                      ) : '—'}
                    </td>
                    <td>{lead.lead_score != null ? <span className={cn('badge', getScoreBg(lead.lead_score))}>{lead.lead_score}</span> : '—'}</td>
                    <td>
                      <span className={cn('badge', getStatusColor(lead.status))}>{getStatusLabel(lead.status)}</span>
                      {lead.classification && lead.classification !== 'customer' && lead.classification !== 'unclear' && (
                        <span className="badge" title="Classified as non-customer — verify before working this lead" style={{ marginLeft: 4, color: '#fb7185', background: 'rgba(251,113,133,0.12)' }}>
                          {lead.classification.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Link href={`/leads/${lead.id}`} className="btn btn-ghost p-1.5" title="View" style={{ padding: 5 }}><Eye size={13} /></Link>
                        {lead.status !== 'approved' && (
                          <button onClick={() => updateLeadStatus(lead.id, 'approved')} disabled={actionLoading === lead.id + 'approved'} className="btn btn-ghost p-1.5" title="Approve" style={{ padding: 5, color: '#34d399' }}>
                            {actionLoading === lead.id + 'approved' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                          </button>
                        )}
                        {lead.status !== 'rejected' && (
                          <button onClick={() => updateLeadStatus(lead.id, 'rejected')} disabled={actionLoading === lead.id + 'rejected'} className="btn btn-ghost p-1.5" title="Reject" style={{ padding: 5, color: '#f87171' }}>
                            {actionLoading === lead.id + 'rejected' ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                          </button>
                        )}
                        <Link href={`/outreach?lead=${lead.id}`} className="btn btn-ghost p-1.5" title="Outreach" style={{ padding: 5, color: '#a78bfa' }}><MessageSquare size={13} /></Link>
                      </div>
                    </td>
                  </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
