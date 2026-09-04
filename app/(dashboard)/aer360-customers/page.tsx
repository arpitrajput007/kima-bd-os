'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  KeyRound, Search, ExternalLink, Plus, ChevronUp, ChevronDown,
  Filter, Download, CheckCircle, Loader2, Users,
} from 'lucide-react'
import { AER360_CUSTOMERS, AER360_TIERS, AER360_BD_STATUSES, AER360_ACCOUNT_COUNT, type Aer360Customer } from '@/lib/aer360-customers'
import { AssignToPlutoButton } from '@/components/AssignToPlutoButton'

type SortKey = 'company' | 'totalScore' | 'reachabilityScore' | 'triggerDate'

function tierColor(tier: string) {
  return tier === 'Tier A' ? '#34d399' : tier === 'Tier B' ? '#fbbf24' : '#f87171'
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

export default function Aer360CustomersPage() {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const getClient = () => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }
  const [search, setSearch] = useState('')
  const [tier, setTier] = useState<string>('All')
  const [bdStatus, setBdStatus] = useState<string>('All')
  const [sort, setSort] = useState<SortKey>('totalScore')
  const [sortAsc, setSortAsc] = useState(false)
  const [adding, setAdding] = useState<number | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [plutoAssigned, setPlutoAssigned] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<number | null>(null)

  // On mount: which accounts are already in the CRM, and which are with Pluto.
  useEffect(() => {
    const names = AER360_CUSTOMERS.map(c => c.company)
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

  const filtered = useMemo(() => AER360_CUSTOMERS.filter(c => {
    const matchTier = tier === 'All' || c.tier === tier
    const matchBdStatus = bdStatus === 'All' || c.bdStatus === bdStatus
    const q = search.toLowerCase().trim()
    const matchSearch = !q
      || c.company.toLowerCase().includes(q)
      || c.segment.toLowerCase().includes(q)
      || c.region.toLowerCase().includes(q)
      || c.whyNow.toLowerCase().includes(q)
      || c.buyerRoles.toLowerCase().includes(q)
    return matchTier && matchBdStatus && matchSearch
  }), [search, tier, bdStatus])

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
  const leadFieldsFor = (c: Aer360Customer) => {
    // Evidence-gated severity: no verified trigger URL means we cannot claim
    // critical/high, however confident the workbook was.
    const verified = Boolean(c.triggerEvidenceUrl)
    const severity = !verified ? 'medium'
      : c.tier === 'Tier A' ? 'critical' : c.tier === 'Tier B' ? 'high' : 'medium'
    return {
      website: c.website,
      description: c.whyNow,
      industry_category: c.segment,
      customer_category: ['AER360 Reachable Prospect'],
      product_to_sell: 'AER360 threshold signing & key governance',
      classification: 'customer',
      current_providers: c.currentArchitecture,
      pain_point: c.gapEvidence,
      pain_point_severity: severity,
      pain_point_evidence: c.structuralFit,
      pain_point_source_url: c.structuralEvidenceUrl,
      pain_point_evidence_type: verified ? 'verified_source' : 'agent_analysis',
      aeredium_fit: c.opportunityHypothesis,
      suggested_use_case: c.qualQuestion,
      potential_gap: c.gapEvidence,
      outreach_angle: c.opportunityHypothesis,
      trigger_reason: c.whyNow,
      trigger_date: c.triggerDate,
      trigger_source_url: c.triggerEvidenceUrl,
      source_url: c.triggerEvidenceUrl || c.structuralEvidenceUrl,
      integration_feasibility: c.reachabilityScore >= 8 ? 'high' : c.reachabilityScore >= 5 ? 'medium' : 'low',
      lead_score: c.totalScore,
      confidence_score: c.gapEvidenceScore * 4,
      priority: c.totalScore >= 90 ? 'excellent' : c.totalScore >= 75 ? 'qualified' : 'needs_research',
    }
  }

  const addToPipeline = async (c: Aer360Customer) => {
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

  const tierA = AER360_CUSTOMERS.filter(c => c.tier === 'Tier A').length
  const avgScore = Math.round(sorted.reduce((s, c) => s + c.totalScore, 0) / (sorted.length || 1))

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2">
            <KeyRound size={18} style={{ color: '#a78bfa' }} /> AER360 Customers
          </h1>
          <p className="text-[12px] mt-1 font-medium" style={{ color: 'rgb(100,106,135)' }}>
            {AER360_CUSTOMERS.length} prospects · {AER360_ACCOUNT_COUNT} unique accounts · every row has a verified structural fit and a dated trigger
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
              const csv = ['Company,Region,Segment,Trigger Date,Why Now,Structural Fit,Opportunity Hypothesis,Buyer Roles,Score,Tier,Trigger URL',
                ...sorted.map(c => [c.company, c.region, c.segment, c.triggerDate, c.whyNow, c.structuralFit, c.opportunityHypothesis, c.buyerRoles, c.totalScore, c.tier, c.triggerEvidenceUrl].map(esc).join(','))
              ].join('\n')
              const a = document.createElement('a')
              a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
              a.download = 'aer360-customers.csv'
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
            { label: 'Total Prospects', value: AER360_CUSTOMERS.length, color: '#a78bfa' },
            { label: 'Tier A', value: tierA, color: '#34d399' },
            { label: 'Ready Now', value: AER360_CUSTOMERS.filter(c => c.bdStatus === 'READY').length, color: '#38bdf8' },
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
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company, segment, region…"
              style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <Filter size={13} style={{ color: 'rgb(120,127,160)', flexShrink: 0 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {AER360_BD_STATUSES.map(s => (
              <button key={s} onClick={() => setBdStatus(s)}
                style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${bdStatus === s ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.08)'}`, background: bdStatus === s ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)', color: bdStatus === s ? '#a78bfa' : 'rgb(150,155,185)', whiteSpace: 'nowrap' }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Tier filter + sort */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'rgb(120,127,160)', marginRight: 4 }}>Tier:</span>
          {AER360_TIERS.map(t => (
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
              style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${sort === s.key ? 'rgba(167,139,250,0.45)' : 'rgba(255,255,255,0.08)'}`, background: sort === s.key ? 'rgba(167,139,250,0.13)' : 'rgba(255,255,255,0.03)', color: sort === s.key ? '#a78bfa' : 'rgb(150,155,185)' }}>
              {s.label}<SortIcon k={s.key} />
            </button>
          ))}
        </div>

        {/* Prospect cards */}
        <div style={{ borderRadius: 16, border: '1px solid rgba(167,139,250,0.18)', background: 'rgba(167,139,250,0.02)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px 14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <KeyRound size={16} style={{ color: '#a78bfa' }} />
              <span style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>High-Conversion Prospects</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'rgb(120,127,160)', marginTop: 5, maxWidth: 640, lineHeight: 1.5 }}>
              Evidence-qualified prospects, not confirmed buyers — structural money-flow fit, why-now trigger and AER360 opportunity kept separate, with a first qualification question for each. Imported as-is from the workbook.
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
                <div key={c.id} style={{ borderRadius: 14, border: `1px solid ${isExp ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.08)'}`, background: isExp ? 'rgba(167,139,250,0.05)' : 'rgba(255,255,255,0.02)', overflow: 'hidden', transition: 'border-color 0.15s, background 0.15s' }}>

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
                        <span style={{ fontSize: 9.5, fontWeight: 600, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>{c.segment}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 600, color: 'rgb(150,155,185)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>{c.region}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'rgb(150,155,185)', marginTop: 4, lineHeight: 1.5 }}>{c.whyNow}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 8.5, color: 'rgb(100,107,140)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Score</div>
                        <span style={{ display: 'inline-flex', minWidth: 34, justifyContent: 'center', padding: '2px 8px', borderRadius: 7, fontSize: 13, fontWeight: 800, color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}>{c.totalScore}</span>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: tc, padding: '4px 10px', borderRadius: 7, background: `${tc}18`, border: `1px solid ${tc}45`, whiteSpace: 'nowrap' }}>{c.tier}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'rgb(140,146,175)', whiteSpace: 'nowrap' }}>{c.bdStatus}</span>
                      {isPluto && <span title="With Pluto" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: '#fbbf24' }}><Users size={11} /></span>}
                      {isExp ? <ChevronUp size={14} style={{ color: 'rgb(120,127,160)' }} /> : <ChevronDown size={14} style={{ color: 'rgb(120,127,160)' }} />}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExp && (
                    <div style={{ padding: '0 18px 18px 18px' }}>
                      <div style={{ fontSize: 10.5, color: '#fbbf24', fontWeight: 700, marginBottom: 10 }}>{c.triggerDate || 'undated'} · {c.recommendedMotion}</div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 10, marginBottom: 12 }}>
                        <InfoBox title="Structural fit (fact)" color="#34d399" text={c.structuralFit} />
                        <InfoBox title="AER360 opportunity (inference)" color="#a78bfa" text={c.opportunityHypothesis} />
                        <InfoBox title="Current architecture · gap evidence" color="#f87171" text={`${c.currentArchitecture} ${c.gapEvidence}`} />
                      </div>

                      <div style={{ borderRadius: 12, border: '1px solid rgba(56,189,248,0.2)', background: 'rgba(56,189,248,0.05)', padding: '12px 14px', marginBottom: 12 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>First qualification question</div>
                        <div style={{ fontSize: 12.5, color: 'rgb(220,225,245)', lineHeight: 1.6, fontStyle: 'italic' }}>&ldquo;{c.qualQuestion}&rdquo;</div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12, fontSize: 11.5, color: 'rgb(160,165,195)', marginBottom: 14 }}>
                        <div><b style={{ color: 'rgb(190,195,220)' }}>Region</b><div style={{ marginTop: 3, lineHeight: 1.5 }}>{c.region}</div></div>
                        <div><b style={{ color: 'rgb(190,195,220)' }}>Segment</b><div style={{ marginTop: 3, lineHeight: 1.5 }}>{c.segment}</div></div>
                        <div><b style={{ color: 'rgb(190,195,220)' }}>Likely buyer</b><div style={{ marginTop: 3, lineHeight: 1.5 }}>{c.buyerRoles}</div></div>
                        <div><b style={{ color: 'rgb(190,195,220)' }}>Recommended motion</b><div style={{ marginTop: 3, lineHeight: 1.5 }}>{c.recommendedMotion}</div></div>
                        <div><b style={{ color: 'rgb(190,195,220)' }}>BD status</b><div style={{ marginTop: 3, lineHeight: 1.5 }}>{c.bdStatus}</div></div>
                        <div><b style={{ color: 'rgb(190,195,220)' }}>Caveat</b><div style={{ marginTop: 3, lineHeight: 1.5 }}>{c.caveat}</div></div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: 14 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                          <SubScore label="Tech fit" value={c.techFitScore} max={30} />
                          <SubScore label="Trigger" value={c.triggerScore} max={25} />
                          <SubScore label="Gap evidence" value={c.gapEvidenceScore} max={25} />
                          <SubScore label="Consequence" value={c.consequenceScore} max={10} />
                          <SubScore label="Reachability" value={c.reachabilityScore} max={10} />
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginLeft: 'auto' }}>
                          {c.structuralEvidenceUrl && (
                            <a href={c.structuralEvidenceUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: '#818cf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <ExternalLink size={11} /> Structural evidence
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
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(167,139,250,0.35)', background: 'rgba(167,139,250,0.1)', color: '#a78bfa', opacity: adding === c.id ? 0.7 : 1 }}>
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
