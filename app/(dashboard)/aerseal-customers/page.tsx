'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  FileLock2, Search, ExternalLink, Plus, ChevronUp, ChevronDown,
  Filter, Download, CheckCircle, Loader2, CalendarCheck, Target, Sparkles, Users,
} from 'lucide-react'
import Link from 'next/link'
import { AERSEAL_CUSTOMERS, AERSEAL_CATEGORIES, AERSEAL_ACCOUNT_COUNT, type AersealCustomer } from '@/lib/aerseal-customers'
import { AERSEAL_HIGH_CONVERSION_PROSPECTS, AERSEAL_HIGH_CONVERSION_BATCH_DATE, type AersealHighConversionProspect } from '@/lib/aerseal-high-conversion-prospects'
import { AssignToPlutoButton } from '@/components/AssignToPlutoButton'
import { assignLeadToPluto } from '@/lib/pluto'
import { cn, getScoreBg, getStatusColor, getStatusLabel, groupByDay } from '@/lib/utils'
import type { Lead } from '@/lib/types'

// Companies the live discovery pipelines (main /api/ai/discover and the
// dedicated /api/ai/discover-aerseal Firecrawl pipeline) have actually found
// and saved — distinct from AERSEAL_CUSTOMERS below, which is a hand-curated
// research workbook. Excludes names already in that curated list so a lead
// someone manually "Add to BD"'d doesn't show up twice.
function usePipelineDiscoveredLeads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const supabase = createClient()
    const curatedNames = new Set(AERSEAL_CUSTOMERS.map(c => c.company.toLowerCase().trim()))
    const nonCustomerFilter = '("competitor","investor_ecosystem","not_relevant","partner")'
    // Two separate queries (category match + dossier-score match) merged
    // client-side rather than one .or() — avoids relying on undocumented
    // PostgREST array-contains-inside-or syntax for a one-off page.
    Promise.all([
      supabase.from('leads').select('*')
        .contains('customer_category', ['AERseal Contract-Authority Customer'])
        .not('classification', 'in', nonCustomerFilter)
        .limit(100),
      supabase.from('leads').select('*')
        .not('aerseal_score', 'is', null)
        .not('classification', 'in', nonCustomerFilter)
        .limit(100),
    ]).then(([byCategory, byScore]) => {
      const merged = new Map<string, Lead>()
      for (const row of [...(byCategory.data || []), ...(byScore.data || [])] as Lead[]) {
        merged.set(row.id, row)
      }
      const rows = Array.from(merged.values())
        .filter(l => !curatedNames.has((l.company_name || '').toLowerCase().trim()))
        .sort((a, b) => (b.aerseal_score ?? -1) - (a.aerseal_score ?? -1) || (b.lead_score ?? 0) - (a.lead_score ?? 0))
      setLeads(rows)
      setLoading(false)
    })
  }, [])
  return { leads, loading }
}

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

/** Fact / inference / unknown box used in the high-conversion prospect cards. */
function InfoBox({ title, color, text }: { title: string; color: string; text: string }) {
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${color}33`, background: `${color}0d`, padding: '11px 13px' }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: 'rgb(200,205,230)', lineHeight: 1.55 }}>{text}</div>
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
  const [expandedProspect, setExpandedProspect] = useState<number | null>(null)
  const [addingProspect, setAddingProspect] = useState<number | null>(null)
  const [bulkAdding, setBulkAdding] = useState(false)
  const { leads: pipelineLeads, loading: pipelineLoading } = usePipelineDiscoveredLeads()
  const pipelineDayGroups = useMemo(() => groupByDay(pipelineLeads, l => l.created_at), [pipelineLeads])

  // On mount: which accounts are already in the CRM, and which are with Pluto.
  // Covers both the curated workbook and the high-conversion prospect batch —
  // membership checks below just do `.has(company)` so sharing one set is fine.
  useEffect(() => {
    const names = Array.from(new Set([
      ...AERSEAL_CUSTOMERS.map(c => c.company),
      ...AERSEAL_HIGH_CONVERSION_PROSPECTS.map(p => p.company),
    ]))
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

  // Same evidence-gated mapping as leadFieldsFor above, adapted for the
  // dossier-shaped high-conversion prospect batch (fact/inference/unknown
  // split instead of a single whyNow/authoritySurface pair).
  const leadFieldsForProspect = (p: AersealHighConversionProspect) => {
    const verified = Boolean(p.triggerSourceUrl)
    const severity = !verified ? 'medium'
      : p.tier === 'Tier 1' ? 'critical'
      : p.tier === 'Tier 2' ? 'high' : 'medium'
    return {
      region: p.chains,
      description: p.whyNow,
      industry_category: p.segment,
      customer_category: ['AERseal Contract-Authority Customer'],
      product_to_sell: 'AERseal contract-authority transfer',
      classification: 'customer',
      supported_chains_or_rails: p.chains,
      current_providers: p.currentController,
      pain_point: p.privilegedRole,
      pain_point_severity: severity,
      pain_point_evidence: p.confirmedFact,
      pain_point_source_url: p.structuralSourceUrl,
      pain_point_evidence_type: verified ? 'verified_source' : 'agent_analysis',
      aerseal_fit: p.inference,
      suggested_use_case: p.smartFirstQuestion,
      potential_gap: p.unknown,
      outreach_angle: p.smartFirstQuestion,
      trigger_reason: p.datedTrigger,
      trigger_date: p.triggerDate,
      trigger_source_url: p.triggerSourceUrl,
      source_url: p.triggerSourceUrl || p.structuralSourceUrl,
      integration_feasibility: p.lockInPenalty >= 7 ? 'low' : p.lockInPenalty >= 4 ? 'medium' : 'high',
      lead_score: p.score,
      confidence_score: p.evidenceScore * 10,
      priority: p.score >= 82 ? 'excellent' : p.score >= 72 ? 'qualified' : 'needs_research',
    }
  }

  const addProspectToPipeline = async (p: AersealHighConversionProspect) => {
    setAddingProspect(p.rank)
    try {
      const { error } = await getClient().from('leads').insert({
        company_name: p.company,
        status: 'new',
        updated_at: new Date().toISOString(),
        ...leadFieldsForProspect(p),
      })
      if (error) {
        if (error.code === '23505') { toast(`${p.company} is already in your pipeline`); setAdded(s => new Set([...s, p.company])) }
        else toast.error('Failed to add: ' + error.message)
      } else {
        toast.success(`${p.company} added to BD pipeline`)
        setAdded(s => new Set([...s, p.company]))
      }
    } catch { toast.error('Failed') }
    setAddingProspect(null)
  }

  // Single "do both" action for the whole batch — creates (or updates) every
  // one of the 20 prospects as a lead and assigns it to Pluto in one go.
  const addAllProspectsToPluto = async () => {
    setBulkAdding(true)
    const results = await Promise.all(
      AERSEAL_HIGH_CONVERSION_PROSPECTS.map(p => assignLeadToPluto(p.company, leadFieldsForProspect(p)))
    )
    const okNames = AERSEAL_HIGH_CONVERSION_PROSPECTS.filter((_, i) => results[i].ok).map(p => p.company)
    const failCount = results.length - okNames.length
    if (okNames.length) {
      setAdded(s => new Set([...s, ...okNames]))
      setPlutoAssigned(s => new Set([...s, ...okNames]))
    }
    setBulkAdding(false)
    if (failCount === 0) toast.success(`All ${okNames.length} prospects added to BD pipeline & assigned to Pluto`)
    else toast.error(`${okNames.length} assigned, ${failCount} failed`)
  }

  const allProspectsWithPluto = AERSEAL_HIGH_CONVERSION_PROSPECTS.every(p => plutoAssigned.has(p.company))

  const tier1 = AERSEAL_CUSTOMERS.filter(c => c.tier === 'Tier 1').length
  const avgScore = Math.round(sorted.reduce((s, c) => s + c.conversionScore, 0) / (sorted.length || 1))

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
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

      <div style={{ padding: 'clamp(14px, 4vw, 20px) clamp(16px, 5vw, 36px)' }}>

        {/* High-Conversion Prospects — a dedicated 20-account research batch
            imported verbatim from the workbook, distinct from the 200-account
            curated list below. Card layout (not the dense table) because each
            row carries long-form fact/inference/unknown text that a narrow
            column would truncate into uselessness. */}
        <div style={{ marginBottom: 28, borderRadius: 16, border: '1px solid rgba(251,113,133,0.22)', background: 'rgba(251,113,133,0.03)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px 14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Target size={16} style={{ color: '#fb7185' }} />
                <span style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>High-Conversion Prospects</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: 700, color: '#fb7185', background: 'rgba(251,113,133,0.12)', border: '1px solid rgba(251,113,133,0.3)', padding: '2px 8px', borderRadius: 6 }}>
                  <Sparkles size={9} /> NEW · {AERSEAL_HIGH_CONVERSION_BATCH_DATE}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'rgb(120,127,160)', marginTop: 5, maxWidth: 640, lineHeight: 1.5 }}>
                {AERSEAL_HIGH_CONVERSION_PROSPECTS.length} smaller, higher-reach accounts from the latest research pass — ranked, with fact / inference / unknown evidence kept separate and a smart first question for each. Imported as-is from the workbook.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
            {AERSEAL_HIGH_CONVERSION_PROSPECTS.map(p => {
              const isExp = expandedProspect === p.rank
              const isAdded = added.has(p.company)
              const isPluto = plutoAssigned.has(p.company)
              const sc = scoreColor(p.score)
              const tc = tierColor(p.tier)
              return (
                <div key={p.rank} style={{ borderRadius: 14, border: `1px solid ${isExp ? 'rgba(251,113,133,0.4)' : 'rgba(255,255,255,0.08)'}`, background: isExp ? 'rgba(251,113,133,0.05)' : 'rgba(255,255,255,0.02)', overflow: 'hidden', transition: 'border-color 0.15s, background 0.15s' }}>

                  {/* Card header — always visible */}
                  <div
                    onClick={() => setExpandedProspect(isExp ? null : p.rank)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', cursor: 'pointer', flexWrap: 'wrap' }}>
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'rgb(150,155,185)', flexShrink: 0 }}>
                      #{p.rank}
                    </div>
                    <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{p.company}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 600, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>{p.segment}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 600, color: 'rgb(150,155,185)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>{p.chains}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'rgb(150,155,185)', marginTop: 4, lineHeight: 1.5 }}>{p.whyNow}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 8.5, color: 'rgb(100,107,140)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Score</div>
                        <span style={{ display: 'inline-flex', minWidth: 34, justifyContent: 'center', padding: '2px 8px', borderRadius: 7, fontSize: 13, fontWeight: 800, color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}>{p.score}</span>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: tc, padding: '4px 10px', borderRadius: 7, background: `${tc}18`, border: `1px solid ${tc}45`, whiteSpace: 'nowrap' }}>{p.tier}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'rgb(140,146,175)', whiteSpace: 'nowrap' }}>{p.readiness}</span>
                      {isPluto && <span title="With Pluto" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: '#fbbf24' }}><Users size={11} /></span>}
                      {isExp ? <ChevronUp size={14} style={{ color: 'rgb(120,127,160)' }} /> : <ChevronDown size={14} style={{ color: 'rgb(120,127,160)' }} />}
                    </div>
                  </div>

                  {/* Expanded dossier detail */}
                  {isExp && (
                    <div style={{ padding: '0 18px 18px 18px' }}>
                      <div style={{ fontSize: 10.5, color: '#fbbf24', fontWeight: 700, marginBottom: 10 }}>{p.triggerDate || 'undated'} · {p.datedTrigger}</div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 10, marginBottom: 12 }}>
                        <InfoBox title="Confirmed fact" color="#34d399" text={p.confirmedFact} />
                        <InfoBox title="AERSeal hypothesis" color="#a78bfa" text={p.inference} />
                        <InfoBox title="Must verify" color="#f87171" text={p.unknown} />
                      </div>

                      <div style={{ borderRadius: 12, border: '1px solid rgba(56,189,248,0.2)', background: 'rgba(56,189,248,0.05)', padding: '12px 14px', marginBottom: 12 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Smart first question</div>
                        <div style={{ fontSize: 12.5, color: 'rgb(220,225,245)', lineHeight: 1.6, fontStyle: 'italic' }}>&ldquo;{p.smartFirstQuestion}&rdquo;</div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12, fontSize: 11.5, color: 'rgb(160,165,195)', marginBottom: 14 }}>
                        <div><b style={{ color: 'rgb(190,195,220)' }}>Privileged role</b><div style={{ marginTop: 3, lineHeight: 1.5 }}>{p.privilegedRole}</div></div>
                        <div><b style={{ color: 'rgb(190,195,220)' }}>Current controller</b><div style={{ marginTop: 3, lineHeight: 1.5 }}>{p.currentController}</div></div>
                        <div><b style={{ color: 'rgb(190,195,220)' }}>Likely buyer</b><div style={{ marginTop: 3, lineHeight: 1.5 }}>{p.likelyBuyer}</div></div>
                        <div><b style={{ color: 'rgb(190,195,220)' }}>Reach route</b><div style={{ marginTop: 3, lineHeight: 1.5 }}>{p.reachRoute}</div></div>
                        <div><b style={{ color: 'rgb(190,195,220)' }}>Outreach posture</b><div style={{ marginTop: 3, lineHeight: 1.5 }}>{p.outreachPosture}</div></div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: 14 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                          <SubScore label="Fit" value={p.fitScore} max={30} />
                          <SubScore label="Trigger" value={p.triggerScore} max={25} />
                          <SubScore label="Reach" value={p.reachScore} max={20} />
                          <SubScore label="Consequence" value={p.consequenceScore} max={15} />
                          <SubScore label="Evidence" value={p.evidenceScore} max={10} />
                          <SubScore label="Lock-in" value={p.lockInPenalty} max={10} />
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginLeft: 'auto' }}>
                          {p.structuralSourceUrl && (
                            <a href={p.structuralSourceUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: '#818cf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <ExternalLink size={11} /> Structural source
                            </a>
                          )}
                          {p.triggerSourceUrl && (
                            <a href={p.triggerSourceUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <ExternalLink size={11} /> Trigger source
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
                          <button onClick={() => addProspectToPipeline(p)} disabled={addingProspect === p.rank}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(167,139,250,0.35)', background: 'rgba(167,139,250,0.1)', color: '#a78bfa', opacity: addingProspect === p.rank ? 0.7 : 1 }}>
                            {addingProspect === p.rank ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                            Add to BD
                          </button>
                        )}
                        <AssignToPlutoButton
                          companyName={p.company}
                          createFields={{ ...leadFieldsForProspect(p) }}
                          initialAssigned={isPluto}
                          onAssigned={() => setAdded(s => new Set([...s, p.company]))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Single action for the whole batch, at the end of the section */}
          <div style={{ padding: '4px 16px 20px 16px', display: 'flex', justifyContent: 'center' }}>
            {allProspectsWithPluto ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: '#34d399', padding: '11px 20px' }}>
                <CheckCircle size={15} /> All {AERSEAL_HIGH_CONVERSION_PROSPECTS.length} prospects are in the BD pipeline & assigned to Pluto
              </span>
            ) : (
              <button onClick={addAllProspectsToPluto} disabled={bulkAdding}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 11, fontSize: 12.5, fontWeight: 700, cursor: bulkAdding ? 'not-allowed' : 'pointer', border: '1px solid rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.12)', color: '#fbbf24', opacity: bulkAdding ? 0.7 : 1 }}>
                {bulkAdding ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                Add all {AERSEAL_HIGH_CONVERSION_PROSPECTS.length} to BD Pipeline &amp; Assign to Pluto
              </button>
            )}
          </div>
        </div>

        {/* Pipeline-discovered — companies the live discovery pipelines found
            and saved, not yet in the curated workbook below. */}
        {(pipelineLoading || pipelineLeads.length > 0) && (
          <div style={{ marginBottom: 24, border: '1px solid rgba(52,211,153,0.25)', borderRadius: 14, background: 'rgba(52,211,153,0.04)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: pipelineLeads.length ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399' }}>Pipeline-discovered ({pipelineLeads.length})</div>
              <div style={{ fontSize: 11, color: 'rgb(120,127,160)', marginTop: 2 }}>
                Found by running your AERSeal resources — not yet in the curated workbook below.
              </div>
            </div>
            {pipelineLoading ? (
              <div style={{ padding: 18, textAlign: 'center' }}><Loader2 size={16} className="animate-spin" style={{ color: 'rgb(120,127,160)' }} /></div>
            ) : (
              <div>
                {pipelineDayGroups.map(group => {
                  const isToday = group.label === 'Today'
                  return (
                    <div key={group.key}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.015)' }}>
                        <CalendarCheck size={11} style={{ color: isToday ? '#fb7185' : '#fbbf24' }} />
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: isToday ? '#fb7185' : 'rgb(180,185,210)' }}>{group.label}</span>
                        <span style={{ fontSize: 10, color: 'rgb(120,127,160)' }}>· {group.items.length} found</span>
                      </div>
                      {group.items.map(l => (
                        <Link key={l.id} href={`/leads/${l.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{l.company_name}</div>
                            {l.pain_point && <div style={{ fontSize: 11.5, color: 'rgb(140,146,175)', marginTop: 2 }}>{l.pain_point}</div>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <span className={cn('badge', getStatusColor(l.status))} style={{ fontSize: 10 }}>{getStatusLabel(l.status)}</span>
                            {l.aerseal_score != null && <span className={cn('badge', getScoreBg(l.aerseal_score))} title="AERSeal score">{l.aerseal_score}</span>}
                            {l.aerseal_score == null && l.lead_score != null && <span className={cn('badge', getScoreBg(l.lead_score))} title="Lead score">{l.lead_score}</span>}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
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
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 0, maxWidth: 320 }}>
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
        <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 880 }}>
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
        </div>
        </div>

        <div style={{ fontSize: 11, color: 'rgb(90,95,120)', marginTop: 14, textAlign: 'center' }}>
          Click any row to expand · Sort by column headers · &quot;Add to BD&quot; pushes to your lead pipeline
        </div>
      </div>
    </div>
  )
}
