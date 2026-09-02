'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ShieldCheck, Search, ExternalLink, Plus, ChevronUp, ChevronDown,
  Filter, Download, CheckCircle, Loader2, Users,
} from 'lucide-react'
import { AERPOLICE_CUSTOMERS, AERPOLICE_CATEGORIES, AERPOLICE_ACCOUNT_COUNT, type AerpoliceCustomer } from '@/lib/aerpolice-customers'
import { AssignToPlutoButton } from '@/components/AssignToPlutoButton'

type SortKey = 'company' | 'totalScore' | 'reachabilityScore' | 'triggerDate'

const TIERS = ['All', 'Tier 1', 'Tier 2'] as const

function tierColor(tier: string) {
  return tier === 'Tier 1' ? '#34d399' : '#fbbf24'
}

function scoreColor(score: number) {
  if (score >= 90) return { color: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.3)' }
  if (score >= 75) return { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)' }
  return { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' }
}

/** Small /N sub-score chip used in the expanded card. */
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

/** Fact / inference / unknown box used in the expanded card. */
function InfoBox({ title, color, text }: { title: string; color: string; text: string }) {
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${color}33`, background: `${color}0d`, padding: '11px 13px' }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: 'rgb(200,205,230)', lineHeight: 1.55 }}>{text}</div>
    </div>
  )
}

export default function AerpoliceCustomersPage() {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const getClient = () => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [tier, setTier] = useState<string>('All')
  const [sort, setSort] = useState<SortKey>('totalScore')
  const [sortAsc, setSortAsc] = useState(false)
  const [adding, setAdding] = useState<number | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [plutoAssigned, setPlutoAssigned] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<number | null>(null)

  // On mount: which accounts are already in the CRM, and which are with Pluto.
  useEffect(() => {
    const names = AERPOLICE_CUSTOMERS.map(c => c.company)
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

  const filtered = useMemo(() => AERPOLICE_CUSTOMERS.filter(c => {
    const matchCat = category === 'All' || c.category === category
    const matchTier = tier === 'All' || c.tier === tier
    const q = search.toLowerCase().trim()
    const matchSearch = !q
      || c.company.toLowerCase().includes(q)
      || c.category.toLowerCase().includes(q)
      || c.whyNow.toLowerCase().includes(q)
      || c.agentProduct.toLowerCase().includes(q)
      || c.buyerRoles.toLowerCase().includes(q)
    return matchCat && matchTier && matchSearch
  }), [search, category, tier])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let diff = 0
    if (sort === 'company') diff = a.company.localeCompare(b.company)
    else if (sort === 'reachabilityScore') diff = a.reachabilityScore - b.reachabilityScore
    else if (sort === 'triggerDate') diff = (a.triggerDate || '').localeCompare(b.triggerDate || '')
    else diff = a.totalScore - b.totalScore
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
  const leadFieldsFor = (c: AerpoliceCustomer) => {
    // Evidence-gated severity: no verified trigger URL means we cannot claim
    // critical/high, however confident the workbook was.
    const verified = Boolean(c.triggerEvidenceUrl)
    const severity = !verified ? 'medium'
      : c.tier === 'Tier 1' ? 'critical' : 'high'
    return {
      website: c.website,
      description: c.whyNow,
      industry_category: c.category,
      customer_category: ['Aerpolice Reachable Prospect'],
      product_to_sell: 'Aerpolice agent governance',
      classification: 'customer',
      current_providers: c.currentControls,
      pain_point: c.gapStatus,
      pain_point_severity: severity,
      pain_point_evidence: c.verifiedAction,
      pain_point_source_url: c.actionEvidenceUrl,
      pain_point_evidence_type: verified ? 'verified_source' : 'agent_analysis',
      aerpolice_fit: c.aerpoliceAngle,
      suggested_use_case: c.qualQuestion,
      potential_gap: c.gapStatus,
      outreach_angle: c.aerpoliceAngle,
      trigger_reason: c.whyNow,
      trigger_date: c.triggerDate,
      trigger_source_url: c.triggerEvidenceUrl,
      source_url: c.triggerEvidenceUrl || c.actionEvidenceUrl,
      integration_feasibility: c.reachabilityScore >= 15 ? 'high' : c.reachabilityScore >= 10 ? 'medium' : 'low',
      lead_score: c.totalScore,
      confidence_score: c.evidenceScore * 10,
      priority: c.totalScore >= 90 ? 'excellent' : c.totalScore >= 75 ? 'qualified' : 'needs_research',
    }
  }

  const addToPipeline = async (c: AerpoliceCustomer) => {
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

  const tier1 = AERPOLICE_CUSTOMERS.filter(c => c.tier === 'Tier 1').length
  const avgScore = Math.round(sorted.reduce((s, c) => s + c.totalScore, 0) / (sorted.length || 1))

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck size={18} style={{ color: '#22d3ee' }} /> Aerpolice Customers
          </h1>
          <p className="text-[12px] mt-1 font-medium" style={{ color: 'rgb(100,106,135)' }}>
            {AERPOLICE_CUSTOMERS.length} prospects · {AERPOLICE_ACCOUNT_COUNT} unique accounts · {AERPOLICE_CATEGORIES.length - 1} categories · every row has a verified action and a dated trigger
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
              const csv = ['Company,Category,Website,Trigger Date,Why Now,Verified Action,Aerpolice Angle,Buyer Roles,Score,Tier,Trigger URL',
                ...sorted.map(c => [c.company, c.category, c.website, c.triggerDate, c.whyNow, c.verifiedAction, c.aerpoliceAngle, c.buyerRoles, c.totalScore, c.tier, c.triggerEvidenceUrl].map(esc).join(','))
              ].join('\n')
              const a = document.createElement('a')
              a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
              a.download = 'aerpolice-customers.csv'
              a.click()
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgb(160,165,195)' }}>
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      <div style={{ padding: 'clamp(14px, 4vw, 20px) clamp(16px, 5vw, 36px)' }}>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Prospects', value: AERPOLICE_CUSTOMERS.length, color: '#22d3ee' },
            { label: 'Tier 1', value: tier1, color: '#34d399' },
            { label: 'Categories', value: AERPOLICE_CATEGORIES.length - 1, color: '#38bdf8' },
            { label: 'Avg Score (filtered)', value: `${avgScore}/100`, color: '#fbbf24' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${s.color}20`, borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'rgb(120,127,160)', marginTop: 5 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 0, maxWidth: 320 }}>
            <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgb(120,127,160)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company, trigger, agent…"
              style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <Filter size={13} style={{ color: 'rgb(120,127,160)', flexShrink: 0 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {AERPOLICE_CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${category === cat ? 'rgba(34,211,238,0.5)' : 'rgba(255,255,255,0.08)'}`, background: category === cat ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.03)', color: category === cat ? '#22d3ee' : 'rgb(150,155,185)', whiteSpace: 'nowrap' }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Tier filter + sort */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'rgb(120,127,160)', marginRight: 4 }}>Tier:</span>
          {TIERS.map(t => (
            <button key={t} onClick={() => setTier(t)}
              style={{ padding: '4px 11px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${tier === t ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.08)'}`, background: tier === t ? 'rgba(52,211,153,0.13)' : 'rgba(255,255,255,0.03)', color: tier === t ? '#34d399' : 'rgb(150,155,185)' }}>
              {t}
            </button>
          ))}
          <span style={{ fontSize: 11, color: 'rgb(100,107,140)', marginLeft: 4 }}>{sorted.length} shown</span>

          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgb(120,127,160)' }}>Sort:</span>
          {([
            { key: 'totalScore', label: 'Score' },
            { key: 'triggerDate', label: 'Trigger date' },
            { key: 'reachabilityScore', label: 'Reach' },
            { key: 'company', label: 'Company' },
          ] as { key: SortKey; label: string }[]).map(s => (
            <button key={s.key} onClick={() => toggleSort(s.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${sort === s.key ? 'rgba(34,211,238,0.45)' : 'rgba(255,255,255,0.08)'}`, background: sort === s.key ? 'rgba(34,211,238,0.13)' : 'rgba(255,255,255,0.03)', color: sort === s.key ? '#22d3ee' : 'rgb(150,155,185)' }}>
              {s.label}<SortIcon k={s.key} />
            </button>
          ))}
        </div>

        {/* Prospect cards */}
        <div style={{ borderRadius: 16, border: '1px solid rgba(34,211,238,0.18)', background: 'rgba(34,211,238,0.02)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px 14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={16} style={{ color: '#22d3ee' }} />
              <span style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>Reachable Prospects</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'rgb(120,127,160)', marginTop: 5, maxWidth: 640, lineHeight: 1.5 }}>
              Evidence-qualified prospects, not confirmed buyers — verified action, why-now trigger and Aerpolice angle kept separate, with a first qualification question for each. Imported as-is from the workbook.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
            {sorted.map((c, idx) => {
              const isExp = expanded === c.id
              const isAdded = added.has(c.company)
              const isPluto = plutoAssigned.has(c.company)
              const sc = scoreColor(c.totalScore)
              const tc = tierColor(c.tier)
              return (
                <div key={c.id} style={{ borderRadius: 14, border: `1px solid ${isExp ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.08)'}`, background: isExp ? 'rgba(34,211,238,0.05)' : 'rgba(255,255,255,0.02)', overflow: 'hidden', transition: 'border-color 0.15s, background 0.15s' }}>

                  {/* Card header — always visible */}
                  <div
                    onClick={() => setExpanded(isExp ? null : c.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', cursor: 'pointer', flexWrap: 'wrap' }}>
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'rgb(150,155,185)', flexShrink: 0 }}>
                      #{idx + 1}
                    </div>
                    <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{c.company}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 600, color: '#22d3ee', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)', padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>{c.category}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 600, color: 'rgb(150,155,185)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>{c.freshness}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'rgb(150,155,185)', marginTop: 4, lineHeight: 1.5 }}>{c.whyNow}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 8.5, color: 'rgb(100,107,140)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Score</div>
                        <span style={{ display: 'inline-flex', minWidth: 34, justifyContent: 'center', padding: '2px 8px', borderRadius: 7, fontSize: 13, fontWeight: 800, color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}>{c.totalScore}</span>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: tc, padding: '4px 10px', borderRadius: 7, background: `${tc}18`, border: `1px solid ${tc}45`, whiteSpace: 'nowrap' }}>{c.tier}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'rgb(140,146,175)', whiteSpace: 'nowrap' }}>{c.nextAction}</span>
                      {isPluto && <span title="With Pluto" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: '#fbbf24' }}><Users size={11} /></span>}
                      {isExp ? <ChevronUp size={14} style={{ color: 'rgb(120,127,160)' }} /> : <ChevronDown size={14} style={{ color: 'rgb(120,127,160)' }} />}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExp && (
                    <div style={{ padding: '0 18px 18px 18px' }}>
                      <div style={{ fontSize: 10.5, color: '#fbbf24', fontWeight: 700, marginBottom: 10 }}>{c.triggerDate || 'undated'} · {c.agentProduct}</div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 10, marginBottom: 12 }}>
                        <InfoBox title="Verified action (fact)" color="#34d399" text={c.verifiedAction} />
                        <InfoBox title="Aerpolice angle (inference)" color="#22d3ee" text={c.aerpoliceAngle} />
                        <InfoBox title={`Current controls · gap: ${c.gapStatus}`} color="#f87171" text={c.currentControls} />
                      </div>

                      <div style={{ borderRadius: 12, border: '1px solid rgba(56,189,248,0.2)', background: 'rgba(56,189,248,0.05)', padding: '12px 14px', marginBottom: 12 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>First qualification question</div>
                        <div style={{ fontSize: 12.5, color: 'rgb(220,225,245)', lineHeight: 1.6, fontStyle: 'italic' }}>&ldquo;{c.qualQuestion}&rdquo;</div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12, fontSize: 11.5, color: 'rgb(160,165,195)', marginBottom: 14 }}>
                        <div><b style={{ color: 'rgb(190,195,220)' }}>Agent / product</b><div style={{ marginTop: 3, lineHeight: 1.5 }}>{c.agentProduct}</div></div>
                        <div><b style={{ color: 'rgb(190,195,220)' }}>Size / reachability</b><div style={{ marginTop: 3, lineHeight: 1.5 }}>{c.sizeReachability}</div></div>
                        <div><b style={{ color: 'rgb(190,195,220)' }}>Likely buyer</b><div style={{ marginTop: 3, lineHeight: 1.5 }}>{c.buyerRoles}</div></div>
                        <div><b style={{ color: 'rgb(190,195,220)' }}>Recommended motion</b><div style={{ marginTop: 3, lineHeight: 1.5 }}>{c.recommendedMotion}</div></div>
                        <div><b style={{ color: 'rgb(190,195,220)' }}>Next action</b><div style={{ marginTop: 3, lineHeight: 1.5 }}>{c.nextAction}</div></div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: 14 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                          <SubScore label="Action fit" value={c.actionFitScore} max={25} />
                          <SubScore label="Trigger" value={c.triggerScore} max={20} />
                          <SubScore label="Reach" value={c.reachabilityScore} max={20} />
                          <SubScore label="Consequence" value={c.consequenceScore} max={15} />
                          <SubScore label="Complementarity" value={c.complementarityScore} max={10} />
                          <SubScore label="Evidence" value={c.evidenceScore} max={10} />
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginLeft: 'auto' }}>
                          {c.actionEvidenceUrl && (
                            <a href={c.actionEvidenceUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: '#818cf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <ExternalLink size={11} /> Action evidence
                            </a>
                          )}
                          {c.triggerEvidenceUrl && (
                            <a href={c.triggerEvidenceUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <ExternalLink size={11} /> Trigger evidence
                            </a>
                          )}
                          {c.website && (
                            <a href={c.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: 'rgb(140,146,175)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <ExternalLink size={11} /> Website
                            </a>
                          )}
                        </div>
                      </div>

                      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {isAdded ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#34d399', padding: '6px 12px' }}>
                            <CheckCircle size={13} /> Added
                          </span>
                        ) : (
                          <button onClick={() => addToPipeline(c)} disabled={adding === c.id}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(34,211,238,0.35)', background: 'rgba(34,211,238,0.1)', color: '#22d3ee', opacity: adding === c.id ? 0.7 : 1 }}>
                            {adding === c.id ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                            Add to BD
                          </button>
                        )}
                        <AssignToPlutoButton
                          companyName={c.company}
                          createFields={{ ...leadFieldsFor(c) }}
                          initialAssigned={isPluto}
                          onAssigned={() => setAdded(s => new Set([...s, c.company]))}
                        />
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
        </div>

        <div style={{ fontSize: 11, color: 'rgb(90,95,120)', marginTop: 14, textAlign: 'center' }}>
          Click any card to expand · Sort with the buttons above · &quot;Add to BD&quot; pushes to your lead pipeline
        </div>
      </div>
    </div>
  )
}
