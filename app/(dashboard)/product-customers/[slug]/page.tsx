'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Users, ArrowRight, Database, Compass, Loader2, Star } from 'lucide-react'
import { getProductSection, PRODUCT_DISCOVERY } from '@/lib/product-sections'
import { cn, getScoreBg, getUrgencyBg, getStatusColor, getStatusLabel, formatDate } from '@/lib/utils'
import type { Lead } from '@/lib/types'
import { notFound } from 'next/navigation'

const NON_CUSTOMER_CLASSIFICATIONS_FILTER = '("competitor","investor_ecosystem","not_relevant","partner")'

export default function ProductCustomersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const section = getProductSection(slug)
  if (!section) notFound()
  const discovery = PRODUCT_DISCOVERY[section.slug]

  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(!!discovery)

  useEffect(() => {
    if (!discovery) { setLoading(false); return }
    setLoading(true)
    const supabase = createClient()
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
  }, [discovery])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 fade-in">
      <div>
        <Link href="/leads" className="inline-flex items-center gap-1.5 text-[12px] mb-3" style={{ color: 'var(--text-3)' }}>
          <ArrowLeft size={13} /> Lead Inbox
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users size={20} style={{ color: 'var(--text-2)' }} />
            {section.label} Customers
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
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>
            Companies the discovery pipeline scored as a fit for {section.label} (customer_category: &quot;{discovery.category}&quot;) — run resources from the{' '}
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
        <div className="section-card">
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {leads.map(lead => (
              <Link key={lead.id} href={`/leads/${lead.id}`} className="p-4 flex items-start justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {lead.priority === 'excellent' && <Star size={11} style={{ color: '#a78bfa', flexShrink: 0 }} />}
                    <span className="text-[13px] font-semibold text-white">{lead.company_name}</span>
                    <span className={cn('badge text-xs', getStatusColor(lead.status))}>{getStatusLabel(lead.status)}</span>
                  </div>
                  {lead.pain_point && (
                    <div className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>{lead.pain_point}</div>
                  )}
                  <div className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>
                    {formatDate(lead.created_at)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {lead.urgency_score != null && <span className={cn('badge', getUrgencyBg(lead.urgency_score))} title="Urgency">{lead.urgency_score}</span>}
                  {lead.lead_score != null && <span className={cn('badge', getScoreBg(lead.lead_score))} title="Lead score">{lead.lead_score}</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
