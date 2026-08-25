'use client'

import { use, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, ArrowRight, Database, Compass, Search, ExternalLink, Loader2, CheckCircle, Plus } from 'lucide-react'
import { getProductSection } from '@/lib/product-sections'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { notFound } from 'next/navigation'
import { PLUTO_AERPOLICE_CUSTOMERS, type PlutoAerpoliceCustomer } from '@/lib/pluto-aerpolice-customers'
import { AssignToPlutoButton } from '@/components/AssignToPlutoButton'

function PlutoAerpoliceCustomersList() {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const getClient = () => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [plutoAssigned, setPlutoAssigned] = useState<Set<string>>(new Set())

  useEffect(() => {
    const names = PLUTO_AERPOLICE_CUSTOMERS.map(c => c.company)
    getClient().from('leads').select('company_name, assigned_to').in('company_name', names)
      .then(({ data }) => {
        if (data?.length) {
          setAdded(new Set(data.map((r: { company_name: string }) => r.company_name)))
          setPlutoAssigned(new Set(data.filter((r: { assigned_to: string | null }) => r.assigned_to === 'pluto').map((r: { company_name: string }) => r.company_name)))
        }
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return PLUTO_AERPOLICE_CUSTOMERS
    return PLUTO_AERPOLICE_CUSTOMERS.filter(c =>
      c.company.toLowerCase().includes(q) || c.website.toLowerCase().includes(q) || c.twitter.toLowerCase().includes(q))
  }, [search])

  const addToPipeline = async (c: PlutoAerpoliceCustomer) => {
    setAdding(c.company)
    try {
      const { error } = await getClient().from('leads').insert({
        company_name: c.company,
        website: c.website,
        twitter_url: c.twitter,
        status: 'new',
        source_summary: "Sourced from Pluto's Customers — AERpolice prospecting sheet",
        trigger_reason: `${c.company} is an AI-agent company on Pluto's AERpolice hunting list.`,
        updated_at: new Date().toISOString(),
      })
      if (error) {
        if (error.code === '23505') { toast(`${c.company} is already in your pipeline`); setAdded(s => new Set([...s, c.company])) }
        else toast.error('Failed to add: ' + error.message)
      } else {
        toast.success(`${c.company} added to BD pipeline`)
        setAdded(s => new Set([...s, c.company]))
      }
    } catch { toast.error('Failed') }
    setAdding(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
          <input className="input w-full" style={{ paddingLeft: 30 }} placeholder="Search Pluto's Customers…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>{filtered.length} of {PLUTO_AERPOLICE_CUSTOMERS.length} companies</span>
      </div>

      <div className="section-card">
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {filtered.map(c => {
            const isAdded = added.has(c.company)
            return (
              <div key={c.id} className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-white">{c.company}</span>
                    {c.status && <span className="badge" style={{ fontSize: 10 }}>{c.status}</span>}
                    {isAdded && <span className="text-[10px] inline-flex items-center gap-1" style={{ color: 'rgb(52,211,153)' }}><CheckCircle size={11} /> In pipeline</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[12px]" style={{ color: 'var(--text-3)' }}>
                    <a href={c.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                      {c.website.replace(/^https?:\/\//, '').replace(/\/$/, '')} <ExternalLink size={10} />
                    </a>
                    {c.twitter && (
                      <a href={c.twitter} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                        {c.twitter.replace(/^https?:\/\/x\.com\//, '@')} <ExternalLink size={10} />
                      </a>
                    )}
                    {c.contact && <span>{c.platform ? `${c.platform}: ` : ''}{c.contact}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isAdded && <AssignToPlutoButton companyName={c.company} initialAssigned={plutoAssigned.has(c.company)} compact />}
                  <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => addToPipeline(c)} disabled={isAdded || adding === c.company}>
                    {adding === c.company ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    {isAdded ? 'Added' : 'Add to pipeline'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function ProductCustomersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const section = getProductSection(slug)
  if (!section) notFound()

  if (slug === 'aerpolice') {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-5 fade-in">
        <div>
          <Link href="/leads" className="inline-flex items-center gap-1.5 text-[12px] mb-3" style={{ color: 'var(--text-3)' }}>
            <ArrowLeft size={13} /> Lead Inbox
          </Link>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users size={20} style={{ color: 'var(--text-2)' }} />
            Pluto&apos;s Customers <span className="text-[13px] font-normal" style={{ color: 'var(--text-3)' }}>— AERpolice</span>
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text-3)' }}>
            Pluto&apos;s curated AI-agent prospecting list for AERpolice, imported from the shared research sheet.
          </p>
        </div>
        <PlutoAerpoliceCustomersList />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5 fade-in">
      <div>
        <Link href="/leads" className="inline-flex items-center gap-1.5 text-[12px] mb-3" style={{ color: 'var(--text-3)' }}>
          <ArrowLeft size={13} /> Lead Inbox
        </Link>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Users size={20} style={{ color: 'var(--text-2)' }} />
          {section.label} Customers
        </h1>
      </div>

      <div className="section-card p-6 text-center space-y-4">
        <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>
          {section.label} doesn&apos;t have a dedicated customer list wired up yet. Set the hunting approach and add
          resources first, then this page will be wired to pull matching leads once that pipeline exists.
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
    </div>
  )
}
