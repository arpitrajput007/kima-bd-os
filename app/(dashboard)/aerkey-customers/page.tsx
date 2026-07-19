'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  KeyRound, Search, Plus, ChevronUp, ChevronDown, Filter,
  Download, CheckCircle, Loader2,
} from 'lucide-react'
import { AERKEY_CUSTOMERS, AERKEY_CATEGORIES, type AerkeyCustomer } from '@/lib/aerkey-customers'

type SortKey = 'company' | 'category' | 'confidence'

function isDirect(sourceConfidence: string) {
  return sourceConfidence.toLowerCase().startsWith('sourced directly')
}

function ConfidencePill({ sourceConfidence }: { sourceConfidence: string }) {
  const direct = isDirect(sourceConfidence)
  const color = direct ? '#34d399' : '#fbbf24'
  const bg = direct ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)'
  const border = direct ? 'rgba(52,211,153,0.25)' : 'rgba(251,191,36,0.2)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 7, fontSize: 10, fontWeight: 700, color, background: bg, border: `1px solid ${border}`, whiteSpace: 'nowrap' }}>
      {direct ? 'Direct' : 'Inferred'}
    </span>
  )
}

export default function AerkeyCustomersPage() {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const getClient = () => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState<SortKey>('company')
  const [sortAsc, setSortAsc] = useState(true)
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const names = AERKEY_CUSTOMERS.map(c => c.company)
    getClient()
      .from('leads')
      .select('company_name')
      .in('company_name', names)
      .then(({ data }) => {
        if (data?.length) {
          setAdded(new Set(data.map((r: { company_name: string }) => r.company_name)))
        }
      })
  }, [])

  const filtered = useMemo(() => AERKEY_CUSTOMERS.filter(c => {
    const matchCat = category === 'All' || c.category === category
    const q = search.toLowerCase()
    const matchSearch = !q || c.company.toLowerCase().includes(q) || c.category.toLowerCase().includes(q) || c.whyFit.toLowerCase().includes(q) || c.stageSignal.toLowerCase().includes(q)
    return matchCat && matchSearch
  }), [search, category])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let diff = 0
    if (sort === 'company') diff = a.company.localeCompare(b.company)
    else if (sort === 'category') diff = a.category.localeCompare(b.category)
    else diff = Number(isDirect(a.sourceConfidence)) - Number(isDirect(b.sourceConfidence))
    return sortAsc ? diff : -diff
  }), [filtered, sort, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sort === key) setSortAsc(s => !s)
    else { setSort(key); setSortAsc(true) }
  }

  const SortIcon = ({ k }: { k: SortKey }) => sort === k
    ? (sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
    : <ChevronDown size={11} style={{ opacity: 0.3 }} />

  const addToPipeline = async (c: AerkeyCustomer) => {
    setAdding(c.company)
    try {
      const { error } = await getClient().from('leads').insert({
        company_name: c.company,
        website: null,
        twitter_url: null,
        description: c.stageSignal,
        industry_category: c.category,
        customer_category: ['AERKey Customer'],
        product_to_sell: 'AERKey (TEE Threshold Signing)',
        pain_point: 'Custody / key-signing infrastructure need typical of a lean, fast-moving crypto business',
        pain_point_severity: isDirect(c.sourceConfidence) ? 'high' : 'medium',
        pain_point_evidence: c.whyFit,
        pain_point_evidence_type: 'agent_analysis',
        kima_fit: `AERKey provides TEE-attested threshold ECDSA signing that fits ${c.company}: ${c.whyFit}`,
        trigger_reason: `${c.company} (${c.category}) is a fast-close AERKey target: ${c.stageSignal}`,
        settlement_angle: c.whyFit,
        integration_feasibility: 'high',
        lead_score: isDirect(c.sourceConfidence) ? 75 : 60,
        priority: isDirect(c.sourceConfidence) ? 'qualified' : 'needs_research',
        status: 'new',
        source_url: null,
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

  const directCount = sorted.filter(c => isDirect(c.sourceConfidence)).length

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2">
            <KeyRound size={18} style={{ color: '#60a5fa' }} /> AERKey Customers
          </h1>
          <p className="text-[12px] mt-1 font-medium" style={{ color: 'rgb(100,106,135)' }}>
            {AERKEY_CUSTOMERS.length} companies · {AERKEY_CATEGORIES.length - 1} categories · Emerging-market exchanges, market makers &amp; payment infra needing TEE threshold-signing custody
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              const csv = ['Company,Category,Stage/Size Signal,Why Good Fit,Source Confidence',
                ...sorted.map(c => `"${c.company}","${c.category}","${c.stageSignal}","${c.whyFit}","${c.sourceConfidence}"`)
              ].join('\n')
              const a = document.createElement('a'); a.href = 'data:text/csv,' + encodeURIComponent(csv); a.download = 'aerkey-customers.csv'; a.click()
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgb(160,165,195)' }}>
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 36px' }}>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Targets', value: AERKEY_CUSTOMERS.length, color: '#60a5fa' },
            { label: 'Directly Sourced', value: directCount, color: '#34d399' },
            { label: 'Categories', value: AERKEY_CATEGORIES.length - 1, color: '#fbbf24' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${s.color}20`, borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'rgb(120,127,160)', marginTop: 5 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '0 0 260px' }}>
            <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgb(120,127,160)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company, category, fit…"
              style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <Filter size={13} style={{ color: 'rgb(120,127,160)', flexShrink: 0 }} />
          <select value={category} onChange={e => setCategory(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgb(200,205,225)', fontSize: 12, outline: 'none', maxWidth: 340 }}>
            {AERKEY_CATEGORIES.map(cat => <option key={cat} value={cat} style={{ background: '#0c0d14' }}>{cat}</option>)}
          </select>
        </div>

        {/* Table */}
        <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '170px 220px 1fr 90px 110px', gap: 0, background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '10px 16px', alignItems: 'center' }}>
            {[
              { label: 'Company', key: 'company' as SortKey },
              { label: 'Category', key: 'category' as SortKey },
              { label: 'Stage / Size Signal', key: null },
              { label: 'Source', key: 'confidence' as SortKey },
              { label: 'Action', key: null },
            ].map((col, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 700, color: 'rgb(120,127,160)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4, cursor: col.key ? 'pointer' : 'default', userSelect: 'none' }}
                onClick={() => col.key && toggleSort(col.key)}>
                {col.label}{col.key && <SortIcon k={col.key} />}
              </div>
            ))}
          </div>

          {/* Rows */}
          {sorted.map((c, idx) => {
            const isExpanded = expanded === c.company
            const isAdded = added.has(c.company)
            return (
              <div key={c.company}>
                <div
                  style={{ display: 'grid', gridTemplateColumns: '170px 220px 1fr 90px 110px', gap: 0, padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)', alignItems: 'center', transition: 'background 0.12s', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)'}
                  onClick={() => setExpanded(isExpanded ? null : c.company)}>

                  {/* Company */}
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'white', paddingRight: 12 }}>{c.company}</div>

                  {/* Category */}
                  <div style={{ paddingRight: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#60a5fa', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', padding: '2px 8px', borderRadius: 6, display: 'inline-block' }}>
                      {c.category}
                    </span>
                  </div>

                  {/* Stage/Size Signal */}
                  <div style={{ paddingRight: 12, fontSize: 11, color: 'rgb(160,165,195)', lineHeight: 1.45 }}>
                    {c.stageSignal.slice(0, 90)}{c.stageSignal.length > 90 ? '…' : ''}
                  </div>

                  {/* Source Confidence */}
                  <div><ConfidencePill sourceConfidence={c.sourceConfidence} /></div>

                  {/* Action */}
                  <div onClick={e => e.stopPropagation()}>
                    {isAdded ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#34d399' }}>
                        <CheckCircle size={13} /> Added
                      </span>
                    ) : (
                      <button onClick={() => addToPipeline(c)} disabled={adding === c.company}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(96,165,250,0.35)', background: 'rgba(96,165,250,0.1)', color: '#60a5fa', opacity: adding === c.company ? 0.7 : 1 }}>
                        {adding === c.company ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                        Add to BD
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded detail row */}
                {isExpanded && (
                  <div style={{ padding: '16px 20px 20px 20px', background: 'rgba(96,165,250,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div style={{ borderRadius: 12, border: '1px solid rgba(96,165,250,0.2)', background: 'rgba(96,165,250,0.05)', padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Stage / Size Signal</div>
                        <div style={{ fontSize: 12, color: 'rgb(210,215,235)', lineHeight: 1.6 }}>{c.stageSignal}</div>
                      </div>
                      <div style={{ borderRadius: 12, border: '1px solid rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.05)', padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Why Good Fit (fast-close specific)</div>
                        <div style={{ fontSize: 12, color: 'rgb(210,215,235)', lineHeight: 1.6 }}>{c.whyFit}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 11, color: 'rgb(120,127,160)' }}>
                      Source: {c.sourceConfidence}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ fontSize: 11, color: 'rgb(90,95,120)', marginTop: 14, textAlign: 'center' }}>
          Click any row to expand · Sort by column headers · &quot;Add to BD&quot; pushes to your lead pipeline
        </div>
      </div>
    </div>
  )
}
