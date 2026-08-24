'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  FileLock2, Search, ExternalLink, Plus, ChevronUp, ChevronDown,
  Filter, Download, CheckCircle, Loader2,
} from 'lucide-react'
import { AERSEAL_CUSTOMERS, AERSEAL_CATEGORIES, AERSEAL_ACCOUNT_COUNT, type AersealCustomer } from '@/lib/aerseal-customers'
import { AssignToPlutoButton } from '@/components/AssignToPlutoButton'

type SortKey = 'company' | 'conversionScore' | 'reachability' | 'lockIn' | 'triggerDate'

const TIERS = ['All', 'Tier 1', 'Tier 2', 'Tier 3'] as const

function tierColor(tier: string) {
  if (tier === 'Tier 1') return '#34d399'
  if (tier === 'Tier 2') return '#fbbf24'
  return '#f87171'
}

function scoreColor(score: number) {
  if (score >= 90) return { color: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.3)' }
  if (score >= 75) return { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)' }
  return { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' }
}

/** Small 1–5 (or 0–10) sub-score chip used in the expanded row. */
function SubScore({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = value / max
  const color = pct >= 0.8 ? '#34d399' : pct >= 0.5 ? '#fbbf24' : '#f87171'
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 11, color: 'rgb(160,165,195)' }}>
      <span>{label}</span>
      <span style={{ fontWeight: 700, color }}>{value}<span style={{ color: 'rgb(100,107,140)', fontWeight: 500 }}>/{max}</span></span>
    </div>
  )
}

export default function AersealCustomersPage() {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const getClient = () => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [tier, setTier] = useState<string>('All')
  const [sort, setSort] = useState<SortKey>('conversionScore')
  const [sortAsc, setSortAsc] = useState(false)
  const [adding, setAdding] = useState<number | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [plutoAssigned, setPlutoAssigned] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<number | null>(null)

  // On mount: which accounts are already in the CRM, and which are with Pluto.
  useEffect(() => {
    const names = Array.from(new Set(AERSEAL_CUSTOMERS.map(c => c.company)))
    getClient()
      .from('leads')
      .select('company_name, assigned_to')
      .in('company_name', names)
      .then(({ data }) => {
        if (data?.length) {
          setAdded(new Set(data.map((r: { company_name: string }) => r.company_name)))
          setPlutoAssigned(new Set(data.filter((r: { assigned_to: string | null }) => r.assigned_to === 'pluto').map((r: { company_name: string }) => r.company_name)))
        }
      })
  }, [])

  const filtered = useMemo(() => AERSEAL_CUSTOMERS.filter(c => {
    const matchCat = category === 'All' || c.category === category
    const matchTier = tier === 'All' || c.tier === tier
    const q = search.toLowerCase().trim()
    const matchSearch = !q
      || c.company.toLowerCase().includes(q)
      || c.category.toLowerCase().includes(q)
      || c.whyNow.toLowerCase().includes(q)
      || c.authoritySurface.toLowerCase().includes(q)
      || (c.region || '').toLowerCase().includes(q)
      || c.buyerRole.toLowerCase().includes(q)
    return matchCat && matchTier && matchSearch
  }), [search, category, tier])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let diff = 0
    if (sort === 'company') diff = a.company.localeCompare(b.company)
    else if (sort === 'reachability') diff = a.reachability - b.reachability
    else if (sort === 'lockIn') diff = a.lockIn - b.lockIn
    else if (sort === 'triggerDate') diff = (a.triggerDate || '').localeCompare(b.triggerDate || '')
    else diff = a.conversionScore - b.conversionScore
    return sortAsc ? diff : -diff
  }), [filtered, sort, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sort === key) setSortAsc(s => !s)
    else { setSort(key); setSortAsc(false) }
  }

  const SortIcon = ({ k }: { k: SortKey }) => sort === k
    ? (sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
    : <ChevronDown size={11} style={{ opacity: 0.3 }} />

  // Shared insert payload (minus company_name/status/updated_at, which the
  // caller — either addToPipeline or the Assign-to-Pluto button — supplies).
  // Mirrors the shape the AERseal discovery pipeline writes, so a manually
  // added account looks identical to a discovered one downstream.
  const leadFieldsFor = (c: AersealCustomer) => {
    // Evidence-gated severity: no verified trigger URL means we cannot claim
    // critical/high, however confident the workbook was.
    const verified = Boolean(c.triggerUrl)
    const severity = !verified ? 'medium'
      : c.tier === 'Tier 1' ? 'critical'
      : c.tier === 'Tier 2' ? 'high' : 'medium'
    return {
      website: c.website,
      region: c.region,
      description: c.whyNow,
      industry_category: c.category,
      customer_category: ['AERseal Contract-Authority Customer'],
      product_to_sell: 'AERseal contract-authority transfer',
      classification: 'customer',
      current_providers: c.currentAlternative,
      pain_point: c.authoritySurface,
      pain_point_severity: severity,
      pain_point_evidence: c.whyNow,
      pain_point_source_url: c.triggerUrl,
      pain_point_evidence_type: verified ? 'verified_source' : 'agent_analysis',
      aerseal_fit: c.outreachAngle,
      suggested_use_case: c.outreachAngle,
      potential_gap: c.authoritySurface,
      outreach_angle: c.outreachAngle,
      trigger_reason: c.whyNow,
      trigger_date: c.triggerDate,
      trigger_source_url: c.triggerUrl,
      source_url: c.triggerUrl || c.fitUrl,
      integration_feasibility: c.lockIn >= 7 ? 'low' : c.lockIn >= 4 ? 'medium' : 'high',
      lead_score: c.conversionScore,
      confidence_score: c.evidence * 20,
      priority: c.conversionScore >= 90 ? 'excellent' : c.conversionScore >= 75 ? 'qualified' : 'needs_research',
    }
  }

  const addToPipeline = async (c: AersealCustomer) => {
    setAdding(c.id)
    try {
      const { error } = await getClient().from('leads').insert({
        company_name: c.company,
        status: 'new',
        updated_at: new Date().toISOString(),
        ...leadFieldsFor(c),
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

  const tier1 = AERSEAL_CUSTOMERS.filter(c => c.tier === 'Tier 1').length
  const avgScore = Math.round(sorted.reduce((s, c) => s + c.conversionScore, 0) / (sorted.length || 1))

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2">
            <FileLock2 size={18} style={{ color: '#a78bfa' }} /> AERseal Customers
          </h1>
          <p className="text-[12px] mt-1 font-medium" style={{ color: 'rgb(100,106,135)' }}>
            {AERSEAL_CUSTOMERS.length} prospects · {AERSEAL_ACCOUNT_COUNT} unique accounts · {AERSEAL_CATEGORIES.length - 1} contract-authority categories · every row has a dated trigger and an evidence URL
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
              const csv = ['Company,Category,Website,Region,Tier,Conversion Score,Trigger Date,Why Now,Authority Surface,Buyer Role,Outreach Angle,Current Alternative,Reachability,Lock-in,Trigger URL',
                ...sorted.map(c => [c.company, c.category, c.website, c.region, c.tier, c.conversionScore, c.triggerDate, c.whyNow, c.authoritySurface, c.buyerRole, c.outreachAngle, c.currentAlternative, c.reachability, c.lockIn, c.triggerUrl].map(esc).join(','))
              ].join('\n')
              const a = document.createElement('a')
              a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
              a.download = 'aerseal-customers.csv'
              a.click()
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgb(160,165,195)' }}>
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 36px' }}>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Prospects', value: AERSEAL_CUSTOMERS.length, color: '#a78bfa' },
            { label: 'Tier 1', value: tier1, color: '#34d399' },
            { label: 'Categories', value: AERSEAL_CATEGORIES.length - 1, color: '#38bdf8' },
            { label: 'Avg Score (filtered)', value: `${avgScore}/100`, color: '#fbbf24' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${s.color}20`, borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'rgb(120,127,160)', marginTop: 5 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Score legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, fontSize: 11, color: 'rgb(120,127,160)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: 'rgb(150,155,185)' }}>Score guide:</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#34d399', display: 'inline-block' }} />90+ = Tier 1 / act now</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#fbbf24', display: 'inline-block' }} />75–89 = strong</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#f87171', display: 'inline-block' }} />&lt;75 = needs more research</span>
          <span style={{ marginLeft: 8 }}>· <b>Reach</b>: how easy to get a reply (5 = founder-reachable) · <b>Lock-in</b>: switching friction from the incumbent (10 = hardest to displace)</span>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '0 0 260px' }}>
            <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgb(120,127,160)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company, trigger, authority…"
              style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <Filter size={13} style={{ color: 'rgb(120,127,160)', flexShrink: 0 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {AERSEAL_CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${category === cat ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.08)'}`, background: category === cat ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)', color: category === cat ? '#a78bfa' : 'rgb(150,155,185)', whiteSpace: 'nowrap' }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Tier filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'rgb(120,127,160)', marginRight: 4 }}>Tier:</span>
          {TIERS.map(t => (
            <button key={t} onClick={() => setTier(t)}
              style={{ padding: '4px 11px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${tier === t ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.08)'}`, background: tier === t ? 'rgba(52,211,153,0.13)' : 'rgba(255,255,255,0.03)', color: tier === t ? '#34d399' : 'rgb(150,155,185)' }}>
              {t}
            </button>
          ))}
          <span style={{ fontSize: 11, color: 'rgb(100,107,140)', marginLeft: 8 }}>{sorted.length} shown</span>
        </div>

        {/* Table */}
        <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '190px 150px 1fr 1fr 90px 70px 70px 130px', gap: 0, background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '10px 16px', alignItems: 'center' }}>
            {[
              { label: 'Company', key: 'company' as SortKey },
              { label: 'Category', key: null },
              { label: 'Trigger / Why Now', key: 'triggerDate' as SortKey },
              { label: 'Authority Surface', key: null },
              { label: 'Score', key: 'conversionScore' as SortKey },
              { label: 'Reach', key: 'reachability' as SortKey },
              { label: 'Lock-in', key: 'lockIn' as SortKey },
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
            const isExpanded = expanded === c.id
            const isAdded = added.has(c.company)
            const sc = scoreColor(c.conversionScore)
            return (
              <div key={c.id}>
                <div
                  style={{ display: 'grid', gridTemplateColumns: '190px 150px 1fr 1fr 90px 70px 70px 130px', gap: 0, padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)', alignItems: 'center', transition: 'background 0.12s', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(167,139,250,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)'}
                  onClick={() => setExpanded(isExpanded ? null : c.id)}>

                  {/* Company */}
                  <div style={{ paddingRight: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {c.company}
                      {c.multiCategory && <span title="Also appears under another category" style={{ fontSize: 9, fontWeight: 700, color: '#38bdf8', background: 'rgba(56,189,248,0.12)', padding: '1px 5px', borderRadius: 4 }}>multi</span>}
                    </div>
                    {c.website && (
                      <a href={c.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        style={{ fontSize: 10, color: 'rgb(110,115,150)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <ExternalLink size={9} />{c.website.replace(/^https?:\/\//, '').slice(0, 22)}
                      </a>
                    )}
                    <div style={{ fontSize: 10, color: 'rgb(100,107,140)', marginTop: 2 }}>{c.region}</div>
                  </div>

                  {/* Category */}
                  <div style={{ paddingRight: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', padding: '2px 8px', borderRadius: 6, display: 'inline-block', lineHeight: 1.4 }}>
                      {c.category}
                    </span>
                  </div>

                  {/* Trigger / why now */}
                  <div style={{ paddingRight: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', marginBottom: 3 }}>{c.triggerDate || 'undated'}</div>
                    <div style={{ fontSize: 11, color: 'rgb(160,165,195)', lineHeight: 1.45 }}>{c.whyNow.slice(0, 110)}{c.whyNow.length > 110 ? '…' : ''}</div>
                  </div>

                  {/* Authority surface */}
                  <div style={{ paddingRight: 12 }}>
                    <div style={{ fontSize: 11, color: 'rgb(150,155,185)', lineHeight: 1.45 }}>{c.authoritySurface.slice(0, 80)}{c.authoritySurface.length > 80 ? '…' : ''}</div>
                    <div style={{ fontSize: 10, color: tierColor(c.tier), marginTop: 3, fontWeight: 600 }}>{c.tier} · {c.probability}</div>
                  </div>

                  {/* Score */}
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, padding: '3px 8px', borderRadius: 7, fontSize: 13, fontWeight: 800, color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}>
                      {c.conversionScore}
                    </span>
                  </div>

                  {/* Reach + lock-in */}
                  <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: c.reachability >= 4 ? '#34d399' : c.reachability >= 3 ? '#fbbf24' : '#f87171' }}>{c.reachability}<span style={{ fontSize: 10, color: 'rgb(100,107,140)', fontWeight: 500 }}>/5</span></div>
                  <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: c.lockIn >= 7 ? '#f87171' : c.lockIn >= 4 ? '#fbbf24' : '#34d399' }}>{c.lockIn}<span style={{ fontSize: 10, color: 'rgb(100,107,140)', fontWeight: 500 }}>/10</span></div>

                  {/* Action */}
                  <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                    {isAdded ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#34d399' }}>
                        <CheckCircle size={13} /> Added
                      </span>
                    ) : (
                      <button onClick={() => addToPipeline(c)} disabled={adding === c.id}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(167,139,250,0.35)', background: 'rgba(167,139,250,0.1)', color: '#a78bfa', opacity: adding === c.id ? 0.7 : 1 }}>
                        {adding === c.id ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                        Add to BD
                      </button>
                    )}
                    <AssignToPlutoButton
                      companyName={c.company}
                      createFields={{ ...leadFieldsFor(c) }}
                      initialAssigned={plutoAssigned.has(c.company)}
                      compact
                      onAssigned={() => setAdded(s => new Set([...s, c.company]))}
                    />
                  </div>
                </div>

                {/* Expanded detail row */}
                {isExpanded && (
                  <div style={{ padding: '16px 20px 20px 20px', background: 'rgba(167,139,250,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr 0.8fr', gap: 16 }}>
                      <div style={{ borderRadius: 12, border: '1px solid rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.05)', padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Why reach out now · {c.triggerDate || 'undated'}</div>
                        <div style={{ fontSize: 12, color: 'rgb(210,215,235)', lineHeight: 1.6 }}>{c.whyNow}</div>
                      </div>
                      <div style={{ borderRadius: 12, border: '1px solid rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.05)', padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>AERseal outreach angle</div>
                        <div style={{ fontSize: 12, color: 'rgb(210,215,235)', lineHeight: 1.6 }}>{c.outreachAngle}</div>
                        <div style={{ fontSize: 11, color: 'rgb(140,145,175)', marginTop: 8, lineHeight: 1.5 }}><b style={{ color: 'rgb(170,175,205)' }}>Buyer:</b> {c.buyerRole}</div>
                      </div>
                      <div style={{ borderRadius: 12, border: '1px solid rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.05)', padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Current alternative / friction</div>
                        <div style={{ fontSize: 12, color: 'rgb(210,215,235)', lineHeight: 1.6 }}>{c.currentAlternative}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                          {c.triggerUrl && (
                            <a href={c.triggerUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#818cf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <ExternalLink size={11} /> Trigger evidence
                            </a>
                          )}
                          {c.fitUrl && (
                            <a href={c.fitUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <ExternalLink size={11} /> Structural fit
                            </a>
                          )}
                        </div>
                      </div>
                      <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)', padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgb(150,155,185)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Score breakdown · {c.researchConfidence} confidence</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <SubScore label="Pain" value={c.pain} max={5} />
                          <SubScore label="Recency" value={c.recency} max={5} />
                          <SubScore label="EVM fit" value={c.evmFit} max={5} />
                          <SubScore label="Admin fit" value={c.adminFit} max={5} />
                          <SubScore label="Reachability" value={c.reachability} max={5} />
                          <SubScore label="Evidence" value={c.evidence} max={5} />
                          <SubScore label="Lock-in penalty" value={c.lockIn} max={10} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {sorted.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 12, color: 'rgb(120,127,160)' }}>
              No prospects match those filters.
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, color: 'rgb(90,95,120)', marginTop: 14, textAlign: 'center' }}>
          Click any row to expand · Sort by column headers · &quot;Add to BD&quot; pushes to your lead pipeline
        </div>
      </div>
    </div>
  )
}
