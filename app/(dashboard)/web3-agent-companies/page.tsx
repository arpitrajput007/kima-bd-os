'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Shield, Search, ExternalLink, Plus, ChevronUp, ChevronDown,
  Filter, Download, CheckCircle, Loader2,
} from 'lucide-react'
import { WEB3_AGENTS, CATEGORIES, type Web3Agent } from '@/lib/web3-agent-companies'
import { AssignToPlutoButton } from '@/components/AssignToPlutoButton'

type SortKey = 'company' | 'urgencyScore' | 'accessibilityScore' | 'strategicValueScore' | 'total'

function scoreColor(score: number) {
  if (score >= 9) return { color: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.3)' }
  if (score >= 7) return { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)' }
  return { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' }
}

function ScorePill({ score, label }: { score: number; label?: string }) {
  const { color, bg, border } = scoreColor(score)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, padding: '3px 8px', borderRadius: 7, fontSize: 12, fontWeight: 700, color, background: bg, border: `1px solid ${border}` }}>
      {score}{label ? ` ${label}` : ''}
    </span>
  )
}

export default function Web3AgentCompaniesPage() {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const getClient = () => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState<SortKey>('total')
  const [sortAsc, setSortAsc] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [plutoAssigned, setPlutoAssigned] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)

  // On mount: check which companies are already in the CRM, and which are already with Pluto
  useEffect(() => {
    const names = WEB3_AGENTS.map(t => t.company)
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

  // Filter
  const filtered = WEB3_AGENTS.filter(t => {
    const matchCat = category === 'All' || t.category === category
    const q = search.toLowerCase()
    const matchSearch = !q || t.company.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.painPoint.toLowerCase().includes(q) || t.governanceGap.toLowerCase().includes(q)
    return matchCat && matchSearch
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const totalA = a.urgencyScore + a.accessibilityScore + a.strategicValueScore
    const totalB = b.urgencyScore + b.accessibilityScore + b.strategicValueScore
    let diff = 0
    if (sort === 'company') diff = a.company.localeCompare(b.company)
    else if (sort === 'urgencyScore') diff = a.urgencyScore - b.urgencyScore
    else if (sort === 'accessibilityScore') diff = a.accessibilityScore - b.accessibilityScore
    else if (sort === 'strategicValueScore') diff = a.strategicValueScore - b.strategicValueScore
    else diff = totalA - totalB
    return sortAsc ? diff : -diff
  })

  const toggleSort = (key: SortKey) => {
    if (sort === key) setSortAsc(s => !s)
    else { setSort(key); setSortAsc(false) }
  }

  const SortIcon = ({ k }: { k: SortKey }) => sort === k
    ? (sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
    : <ChevronDown size={11} style={{ opacity: 0.3 }} />

  // Shared insert payload (minus company_name/status/updated_at, which the
  // caller — either addToPipeline or the Assign-to-Pluto button — supplies).
  const leadFieldsFor = (t: Web3Agent) => ({
    website: t.website,
    twitter_url: null,
    description: t.description,
    industry_category: t.category,
    customer_category: ['Agentic Payments Customer'],
    product_to_sell: 'Aeredium governance layer',
    pain_point: t.governanceGap,
    pain_point_severity: t.urgencyScore >= 9 ? 'critical' : t.urgencyScore >= 7 ? 'high' : 'medium',
    pain_point_evidence: t.description,
    pain_point_evidence_type: 'agent_analysis',
    kima_fit: `Aeredium provides the cryptographic governance layer that ${t.company} needs: ${t.governanceGap}`,
    trigger_reason: `${t.company} is building agent infrastructure in the ${t.category} space with a clear governance gap: ${t.governanceGap}`,
    settlement_angle: t.currentSolution,
    integration_feasibility: t.accessibilityScore >= 8 ? 'high' : t.accessibilityScore >= 5 ? 'medium' : 'low',
    lead_score: Math.round((t.urgencyScore + t.accessibilityScore + t.strategicValueScore) / 30 * 100),
    priority: t.urgencyScore >= 9 ? 'excellent' : t.urgencyScore >= 7 ? 'qualified' : 'needs_research',
    source_url: t.sourceLink,
  })

  const addToPipeline = async (t: Web3Agent) => {
    setAdding(t.company)
    try {
      const { error } = await getClient().from('leads').insert({
        company_name: t.company,
        status: 'new',
        updated_at: new Date().toISOString(),
        ...leadFieldsFor(t),
      })
      if (error) {
        if (error.code === '23505') { toast(`${t.company} is already in your pipeline`); setAdded(s => new Set([...s, t.company])) }
        else toast.error('Failed to add: ' + error.message)
      } else {
        toast.success(`${t.company} added to BD pipeline`)
        setAdded(s => new Set([...s, t.company]))
      }
    } catch { toast.error('Failed') }
    setAdding(null)
  }

  // Stat totals
  const totalScore = (t: Web3Agent) => t.urgencyScore + t.accessibilityScore + t.strategicValueScore
  const avgTotal = Math.round(sorted.reduce((s, t) => s + totalScore(t), 0) / (sorted.length || 1))
  const topTargets = sorted.filter(t => totalScore(t) >= 22).length

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2">
            <Shield size={18} style={{ color: '#818cf8' }} /> Web3 AI Agent Companies
          </h1>
          <p className="text-[12px] mt-1 font-medium" style={{ color: 'rgb(100,106,135)' }}>
            {WEB3_AGENTS.length} companies · {CATEGORIES.length - 1} categories · Merged from Aeredium Targets, Agentic Payments, and Money Touching Agents intelligence
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              const csv = ['Company,Category,Website,Pain Point,Governance Gap,Urgency,Accessibility,Strategic Value,Total Score',
                ...sorted.map(t => `"${t.company}","${t.category}","${t.website}","${t.painPoint}","${t.governanceGap}",${t.urgencyScore},${t.accessibilityScore},${t.strategicValueScore},${totalScore(t)}`)
              ].join('\n')
              const a = document.createElement('a'); a.href = 'data:text/csv,' + encodeURIComponent(csv); a.download = 'web3-agent-companies.csv'; a.click()
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
            { label: 'Total Targets', value: WEB3_AGENTS.length, color: '#818cf8' },
            { label: 'High Priority (≥22)', value: topTargets, color: '#34d399' },
            { label: 'Categories', value: CATEGORIES.length - 1, color: '#38bdf8' },
            { label: 'Avg Score', value: `${avgTotal}/30`, color: '#fbbf24' },
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
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#34d399', display: 'inline-block' }} />9–10 = Critical/Excellent</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#fbbf24', display: 'inline-block' }} />7–8 = High/Good</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#f87171', display: 'inline-block' }} />1–6 = Low</span>
          <span style={{ marginLeft: 8 }}>· <b>Urgency</b>: how urgently they need governance · <b>Accessibility</b>: how easy to reach (10=startup, 1=public corp) · <b>Strategic Value</b>: market impact</span>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '0 0 260px' }}>
            <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgb(120,127,160)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company, pain, category…"
              style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <Filter size={13} style={{ color: 'rgb(120,127,160)', flexShrink: 0 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${category === cat ? 'rgba(129,140,248,0.5)' : 'rgba(255,255,255,0.08)'}`, background: category === cat ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.03)', color: category === cat ? '#818cf8' : 'rgb(150,155,185)', whiteSpace: 'nowrap' }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 160px 1fr 1fr 80px 80px 80px 80px 130px', gap: 0, background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '10px 16px', alignItems: 'center' }}>
            {[
              { label: 'Company', key: 'company' as SortKey },
              { label: 'Category', key: null },
              { label: 'Pain Point / Gap', key: null },
              { label: 'Current Solution', key: null },
              { label: 'Urgency', key: 'urgencyScore' as SortKey },
              { label: 'Access', key: 'accessibilityScore' as SortKey },
              { label: 'Strategic', key: 'strategicValueScore' as SortKey },
              { label: 'Total', key: 'total' as SortKey },
              { label: 'Action', key: null },
            ].map((col, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 700, color: 'rgb(120,127,160)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4, cursor: col.key ? 'pointer' : 'default', userSelect: 'none' }}
                onClick={() => col.key && toggleSort(col.key)}>
                {col.label}{col.key && <SortIcon k={col.key} />}
              </div>
            ))}
          </div>

          {/* Rows */}
          {sorted.map((t, idx) => {
            const total = totalScore(t)
            const isExpanded = expanded === t.company
            const isAdded = added.has(t.company)
            return (
              <div key={t.company}>
                <div
                  style={{ display: 'grid', gridTemplateColumns: '200px 160px 1fr 1fr 80px 80px 80px 80px 130px', gap: 0, padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)', alignItems: 'center', transition: 'background 0.12s', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(129,140,248,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)'}
                  onClick={() => setExpanded(isExpanded ? null : t.company)}>

                  {/* Company */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 2 }}>{t.company}</div>
                    <a href={t.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      style={{ fontSize: 10, color: 'rgb(110,115,150)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <ExternalLink size={9} />{t.website.replace(/^https?:\/\//, '').slice(0, 22)}
                    </a>
                  </div>

                  {/* Category */}
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#818cf8', background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', padding: '2px 8px', borderRadius: 6 }}>
                      {t.category}
                    </span>
                  </div>

                  {/* Pain + Gap */}
                  <div style={{ paddingRight: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: 3 }}>{t.painPoint.slice(0, 40)}{t.painPoint.length > 40 ? '…' : ''}</div>
                    <div style={{ fontSize: 11, color: 'rgb(160,165,195)', lineHeight: 1.45 }}>{t.governanceGap.slice(0, 80)}{t.governanceGap.length > 80 ? '…' : ''}</div>
                  </div>

                  {/* Current Solution */}
                  <div style={{ paddingRight: 12 }}>
                    <div style={{ fontSize: 11, color: 'rgb(140,145,175)', lineHeight: 1.45 }}>{t.currentSolution.slice(0, 70)}{t.currentSolution.length > 70 ? '…' : ''}</div>
                    <div style={{ fontSize: 10, color: 'rgb(100,107,140)', marginTop: 2 }}>{t.funding}</div>
                  </div>

                  {/* Scores */}
                  <div style={{ textAlign: 'center' }}><ScorePill score={t.urgencyScore} /></div>
                  <div style={{ textAlign: 'center' }}><ScorePill score={t.accessibilityScore} /></div>
                  <div style={{ textAlign: 'center' }}><ScorePill score={t.strategicValueScore} /></div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: total >= 22 ? '#34d399' : total >= 18 ? '#fbbf24' : '#f87171' }}>{total}</span>
                    <span style={{ fontSize: 10, color: 'rgb(100,107,140)' }}>/30</span>
                  </div>

                  {/* Action */}
                  <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                    {isAdded ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#34d399' }}>
                        <CheckCircle size={13} /> Added
                      </span>
                    ) : (
                      <button onClick={() => addToPipeline(t)} disabled={adding === t.company}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(129,140,248,0.35)', background: 'rgba(129,140,248,0.1)', color: '#818cf8', opacity: adding === t.company ? 0.7 : 1 }}>
                        {adding === t.company ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                        Add to BD
                      </button>
                    )}
                    <AssignToPlutoButton
                      companyName={t.company}
                      createFields={{ ...leadFieldsFor(t) }}
                      initialAssigned={plutoAssigned.has(t.company)}
                      compact
                      onAssigned={() => setAdded(s => new Set([...s, t.company]))}
                    />
                  </div>
                </div>

                {/* Expanded detail row */}
                {isExpanded && (
                  <div style={{ padding: '16px 20px 20px 20px', background: 'rgba(129,140,248,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                      <div style={{ borderRadius: 12, border: '1px solid rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.05)', padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Description</div>
                        <div style={{ fontSize: 12, color: 'rgb(210,215,235)', lineHeight: 1.6 }}>{t.description}</div>
                      </div>
                      <div style={{ borderRadius: 12, border: '1px solid rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.05)', padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Governance Gap</div>
                        <div style={{ fontSize: 12, color: 'rgb(210,215,235)', lineHeight: 1.6 }}>{t.governanceGap}</div>
                      </div>
                      <div style={{ borderRadius: 12, border: '1px solid rgba(129,140,248,0.2)', background: 'rgba(129,140,248,0.05)', padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Contact & Links</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <a href={t.sourceLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#818cf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <ExternalLink size={11} /> Partnership / Contact page
                          </a>
                          {t.linkedIn && (
                            <a href={t.linkedIn} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <ExternalLink size={11} /> LinkedIn
                            </a>
                          )}
                        </div>
                      </div>
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
