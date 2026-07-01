'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { actStart, actFinish } from '@/lib/agent-activity'
import {
  Globe, Search, ExternalLink, Plus, ChevronUp, ChevronDown,
  CheckCircle, Loader2, BarChart2, Download, Shield,
} from 'lucide-react'
import {
  WEB2_COMPANIES, WEB2_CATEGORIES, WEB2_CAT_COLORS,
  type Web2Company, type Web2Category, type GovernanceRisk,
} from '@/lib/web2-agent-companies'

// ── Priority / risk styling ───────────────────────────────────
const priorityStyle = (p: Web2Company['priority']) => {
  if (p === 'Immediate Outreach') return { bg: 'rgba(251,113,133,0.12)', text: 'rgb(251,113,133)', border: 'rgba(251,113,133,0.2)' }
  if (p === 'Strong Prospect')    return { bg: 'rgba(251,191,36,0.12)',  text: 'rgb(251,191,36)',  border: 'rgba(251,191,36,0.2)'  }
  if (p === 'Monitor')            return { bg: 'rgba(96,165,250,0.12)',  text: 'rgb(96,165,250)',  border: 'rgba(96,165,250,0.2)'  }
  return                                 { bg: 'rgba(100,106,135,0.12)', text: 'rgb(100,106,135)', border: 'rgba(100,106,135,0.2)' }
}

const riskStyle = (r: GovernanceRisk) => {
  if (r === 'High')        return { text: 'rgb(251,113,133)', bg: 'rgba(251,113,133,0.1)', border: 'rgba(251,113,133,0.2)' }
  if (r === 'Medium-High') return { text: 'rgb(251,191,36)',  bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.2)' }
  if (r === 'Medium')      return { text: 'rgb(96,165,250)',  bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.2)' }
  return                          { text: 'rgb(100,106,135)', bg: 'rgba(100,106,135,0.1)', border: 'rgba(100,106,135,0.2)' }
}

const tierLabel: Record<number, string> = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3', 4: 'Tier 4' }
const tierColor: Record<number, string> = {
  1: 'rgb(248,113,133)',
  2: 'rgb(251,191,36)',
  3: 'rgb(96,165,250)',
  4: 'rgb(100,106,135)',
}

const TIER_ORDER = { 1: 0, 2: 1, 3: 2, 4: 3 }

export default function Web2AgentCompaniesPage() {
  const supabase = createClient()
  const [search, setSearch]       = useState('')
  const [activeCat, setActiveCat] = useState<Web2Category | 'All'>('All')
  const [riskFilter, setRiskFilter] = useState<GovernanceRisk | 'All'>('All')
  const [tierFilter, setTierFilter] = useState<number | 'All'>('All')
  const [adding, setAdding]       = useState<string | null>(null)
  const [added, setAdded]         = useState<Set<string>>(new Set())
  const [enriching, setEnriching] = useState<Set<string>>(new Set())
  const [expandedDetail, setExpandedDetail] = useState<Set<string>>(new Set())

  useEffect(() => {
    const names = WEB2_COMPANIES.map(a => a.co)
    supabase
      .from('leads')
      .select('company_name')
      .in('company_name', names)
      .then(({ data }) => {
        if (data?.length) setAdded(new Set(data.map((r: { company_name: string }) => r.company_name)))
      })
  }, []) // eslint-disable-line

  const filtered = useMemo(() => {
    return WEB2_COMPANIES.filter(a => {
      if (activeCat !== 'All' && a.cat !== activeCat) return false
      if (riskFilter !== 'All' && a.govRisk !== riskFilter) return false
      if (tierFilter !== 'All' && a.tier !== tierFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const blob = [a.co, a.desc, a.agentDoes, a.govReason, a.whyAergap, a.decisionMaker, a.industry, ...a.highStakeActions, ...a.triggerSignals].join(' ').toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    }).sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.fitScore - a.fitScore)
  }, [activeCat, riskFilter, tierFilter, search])

  const stats = useMemo(() => ({
    total:    WEB2_COMPANIES.length,
    tier1:    WEB2_COMPANIES.filter(a => a.tier === 1).length,
    highRisk: WEB2_COMPANIES.filter(a => a.govRisk === 'High').length,
    inCRM:    added.size,
    bycat: WEB2_CATEGORIES.map(c => ({
      cat:   c,
      count: WEB2_COMPANIES.filter(a => a.cat === c).length,
      tier1: WEB2_COMPANIES.filter(a => a.cat === c && a.tier === 1).length,
    })),
  }), [added])

  const kickOffEnrichment = (leadId: string, coName: string) => {
    setEnriching(s => new Set([...s, coName]))
    const a1 = actStart({ tool: 'Claude',        action: 'Research + Classify + Fit Analysis', page: `Web2 Agents — ${coName}`, timestamp: Date.now() })
    const a2 = actStart({ tool: 'ContactFinder', action: 'Find Contacts',                      page: `Web2 Agents — ${coName}`, timestamp: Date.now() })
    const a3 = actStart({ tool: 'Claude',        action: 'Aergap Use Cases',                   page: `Web2 Agents — ${coName}`, timestamp: Date.now() })
    const t0 = Date.now()

    fetch('/api/ai/enrich-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId }),
    })
      .then(r => r.json())
      .then(res => {
        const enrichDur = Date.now() - t0
        if (res.success) {
          actFinish(a1, 'success', 'Research complete', Math.round(enrichDur * 0.55))
          actFinish(a2, 'success', 'Contacts saved',    Math.round(enrichDur * 0.45))
          toast(`${coName} enriched — generating Aergap use cases…`, { icon: '⚡' })
          const t1 = Date.now()
          return fetch('/api/ai/use-cases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead_id: leadId }),
          })
            .then(r => r.json())
            .then(ucRes => {
              const ucDur = Date.now() - t1
              if (ucRes.success) {
                actFinish(a3, 'success', `${ucRes.use_cases?.length ?? 0} use cases saved`, ucDur)
                toast.success(`✓ ${coName} — deep research + Aergap use cases ready`)
              } else {
                actFinish(a3, 'error', 'Use case gen failed', ucDur)
                toast.success(`✓ ${coName} enriched (use cases failed — retry from lead page)`)
              }
            })
            .catch(() => {
              actFinish(a3, 'error', 'Use cases error', 0)
              toast.success(`✓ ${coName} enriched (use cases timed out)`)
            })
        } else {
          actFinish(a1, 'error', 'Partial', enrichDur)
          actFinish(a2, 'error', 'Partial', 0)
          actFinish(a3, 'error', 'Skipped', 0)
          toast.error(`Enrichment partial for ${coName}`)
        }
      })
      .catch(() => {
        actFinish(a1, 'error', 'Failed', 0)
        actFinish(a2, 'error', 'Failed', 0)
        actFinish(a3, 'error', 'Skipped', 0)
        toast.error(`Enrichment failed for ${coName}`)
      })
      .finally(() => setEnriching(s => { const n = new Set(s); n.delete(coName); return n }))
  }

  const addOne = async (a: Web2Company) => {
    if (adding || added.has(a.co)) return
    setAdding(a.co)
    try {
      const { data: newLead, error } = await supabase.from('leads').insert({
        company_name:            a.co,
        website:                 a.site,
        description:             a.desc,
        industry_category:       a.industry,
        customer_category:       ['Web2 Agent Company', 'Aergap Governance Customer'],
        product_to_sell:         'Aergap Agent Governance (Identity + Policy + Execution Gate + Audit Trail)',
        pain_point:              a.govReason,
        pain_point_severity:     a.govRisk === 'High' ? 'critical' : a.govRisk === 'Medium-High' ? 'high' : 'medium',
        pain_point_evidence:     a.whyAergap,
        pain_point_evidence_type:'agent_analysis',
        kima_fit:                a.whyAergap,
        trigger_reason:          `${a.co} — ${a.cat} — Tier ${a.tier} — ${a.priority}`,
        integration_feasibility: a.stage === 'Startup' ? 'high' : a.stage === 'Growth' ? 'medium' : 'low',
        lead_score:              a.fitScore * 10,
        priority:                a.tier === 1 ? 'excellent' : a.tier === 2 ? 'qualified' : 'needs_research',
        status:                  'approved',
        source_url:              a.site,
        updated_at:              new Date().toISOString(),
      }).select('id').single()

      if (error) {
        if (error.code === '23505') { toast(`${a.co} already in pipeline`); setAdded(s => new Set([...s, a.co])) }
        else toast.error('Failed: ' + error.message)
        setAdding(null)
        return
      }

      setAdded(s => new Set([...s, a.co]))
      toast(`${a.co} added — running full AI research in background…`, { icon: '🔬' })
      if (newLead?.id) kickOffEnrichment(newLead.id, a.co)
    } catch { toast.error('Failed') }
    setAdding(null)
  }

  const exportCSV = () => {
    const headers = ['Tier', 'Priority', 'Category', 'Company', 'Website', 'Industry', 'Fit Score', 'Gov Risk', 'What Agent Does', 'High-Stake Actions', 'Gov Reason', 'Why Aergap', 'Decision Maker', 'Outreach Angle', 'Trigger Signals']
    const rows = filtered.map(a => [
      a.tier, a.priority, a.cat, a.co, a.site, a.industry, a.fitScore, a.govRisk,
      a.agentDoes, a.highStakeActions.join('; '), a.govReason, a.whyAergap, a.decisionMaker, a.outreachAngle, a.triggerSignals.join('; '),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const el  = document.createElement('a')
    el.href = url; el.download = 'web2-agent-companies.csv'; el.click()
  }

  const toggleDetail = (co: string) => setExpandedDetail(s => {
    const n = new Set(s); n.has(co) ? n.delete(co) : n.add(co); return n
  })

  return (
    <div style={{ minHeight: '100vh', background: 'rgb(10,11,16)' }}>

      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(251,146,60,0.25), rgba(251,191,36,0.15))',
              border: '1px solid rgba(251,146,60,0.3)',
            }}>
              <Globe size={17} style={{ color: 'rgb(251,146,60)' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: 'rgb(240,242,255)', lineHeight: 1.2 }}>
                Web2 AI Agent Companies
              </h1>
              <p style={{ fontSize: 12, color: 'rgb(100,106,135)', marginTop: 2 }}>
                {WEB2_COMPANIES.length} Web2 companies deploying autonomous AI agents — Aergap governance prospects
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={exportCSV}>
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 32px', maxWidth: 1600, margin: '0 auto' }}>

        {/* ── Stats ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Total companies', value: stats.total,    color: 'rgb(251,146,60)' },
            { label: 'Tier 1 targets',  value: stats.tier1,   color: 'rgb(251,113,133)' },
            { label: 'High gov risk',   value: stats.highRisk, color: 'rgb(251,191,36)' },
            { label: 'In CRM',          value: stats.inCRM,   color: 'rgb(52,211,153)' },
            { label: 'Filtered view',   value: filtered.length, color: 'rgb(96,165,250)' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="label">{s.label}</div>
              <div className="value" style={{ color: s.color, fontSize: 26 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Category chart ────────────────────────────────────── */}
        <div className="section-card" style={{ marginBottom: 28 }}>
          <div className="section-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={14} style={{ color: 'rgb(100,106,135)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'rgb(240,242,255)' }}>Companies by category</span>
            </div>
          </div>
          <div style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 12 }}>
            {stats.bycat.map(({ cat, count, tier1 }) => {
              const c = WEB2_CAT_COLORS[cat]
              return (
                <div
                  key={cat}
                  onClick={() => setActiveCat(activeCat === cat ? 'All' : cat)}
                  style={{
                    padding: '12px 14px', borderRadius: 9, cursor: 'pointer',
                    border: `1px solid ${activeCat === cat ? c.border : 'rgba(255,255,255,0.055)'}`,
                    background: activeCat === cat ? c.bg : 'transparent',
                    transition: 'all 0.18s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: c.text }}>{cat}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'rgb(240,242,255)' }}>{count}</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 3, height: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(count / 12) * 100}%`, height: '100%', background: c.bar, borderRadius: 3 }} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, color: 'rgb(100,106,135)' }}>
                    {tier1} tier 1 · <span style={{ color: c.text }}>{count - tier1} tier 2–4</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Tier quick-tabs ───────────────────────────────────── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {(['All', 1, 2, 3, 4] as const).map(t => {
            const isActive = tierFilter === t
            const col = t !== 'All' ? tierColor[t] : 'rgb(167,139,250)'
            return (
              <button key={t} onClick={() => setTierFilter(t)}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 7, cursor: 'pointer',
                  border: `1px solid ${isActive ? col.replace('rgb', 'rgba').replace(')', ',0.4)') : 'rgba(255,255,255,0.055)'}`,
                  background: isActive ? col.replace('rgb', 'rgba').replace(')', ',0.12)') : 'transparent',
                  color: isActive ? col : 'rgb(100,106,135)',
                  transition: 'all 0.18s ease',
                }}>
                {t === 'All' ? `All Tiers (${WEB2_COMPANIES.length})` : `${tierLabel[t]} (${WEB2_COMPANIES.filter(a => a.tier === t).length})`}
              </button>
            )
          })}
        </div>

        {/* ── Filters ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgb(100,106,135)', pointerEvents: 'none' }} />
            <input
              className="input-dark"
              style={{ paddingLeft: 32, fontSize: 13 }}
              placeholder="Search company, agent action, governance risk, decision-maker…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="input-dark" style={{ width: 'auto', fontSize: 12 }} value={activeCat} onChange={e => setActiveCat(e.target.value as Web2Category | 'All')}>
            <option value="All">All categories</option>
            {WEB2_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input-dark" style={{ width: 'auto', fontSize: 12 }} value={riskFilter} onChange={e => setRiskFilter(e.target.value as GovernanceRisk | 'All')}>
            <option value="All">All gov risk</option>
            <option value="High">High risk</option>
            <option value="Medium-High">Medium-High risk</option>
            <option value="Medium">Medium risk</option>
            <option value="Low">Low risk</option>
          </select>
          <span style={{ fontSize: 12, color: 'rgb(100,106,135)', whiteSpace: 'nowrap' }}>
            {filtered.length} of {WEB2_COMPANIES.length}
          </span>
        </div>

        {/* ── Table ─────────────────────────────────────────────── */}
        <div className="section-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
              <thead>
                <tr>
                  <th style={{ width: 55 }}>Tier</th>
                  <th style={{ width: 90 }}>Priority</th>
                  <th style={{ width: 100 }}>Category</th>
                  <th style={{ width: 160 }}>Company</th>
                  <th>What the agent does</th>
                  <th style={{ width: 90 }}>Gov Risk</th>
                  <th style={{ width: 55, textAlign: 'center' }}>Score</th>
                  <th>Decision-maker & angle</th>
                  <th style={{ width: 100, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const isAdded   = added.has(a.co)
                  const isAdding  = adding === a.co
                  const isEnrich  = enriching.has(a.co)
                  const expanded  = expandedDetail.has(a.co)
                  const pri       = priorityStyle(a.priority)
                  const risk      = riskStyle(a.govRisk)
                  const catColor  = WEB2_CAT_COLORS[a.cat]

                  return (
                    <>
                      <tr key={a.co} style={{ cursor: 'pointer' }} onClick={() => toggleDetail(a.co)}>
                        {/* Tier */}
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 700, color: tierColor[a.tier] }}>T{a.tier}</span>
                        </td>

                        {/* Priority */}
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5, border: `1px solid ${pri.border}`, background: pri.bg, color: pri.text, whiteSpace: 'nowrap' }}>
                            {a.priority === 'Immediate Outreach' ? 'Immediate' : a.priority === 'Strong Prospect' ? 'Strong' : a.priority === 'Competitive Intel' ? 'Comp Intel' : 'Monitor'}
                          </span>
                        </td>

                        {/* Category */}
                        <td>
                          <span style={{ display: 'inline-flex', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5, border: `1px solid ${catColor.border}`, background: catColor.bg, color: catColor.text, whiteSpace: 'nowrap' }}>
                            {a.cat}
                          </span>
                        </td>

                        {/* Company */}
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'rgb(240,242,255)' }}>{a.co}</div>
                          <div style={{ fontSize: 10, color: 'rgb(100,106,135)', marginTop: 2, maxWidth: 180, lineHeight: 1.4 }}>{a.industry}</div>
                          <a href={a.site} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                            style={{ fontSize: 10, color: 'rgb(96,165,250)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 4 }}>
                            <ExternalLink size={9} /> Site
                          </a>
                        </td>

                        {/* Agent does */}
                        <td style={{ fontSize: 11, color: 'rgb(160,165,195)', maxWidth: 220, lineHeight: 1.5 }}>
                          {a.agentDoes.slice(0, 120)}{a.agentDoes.length > 120 ? '…' : ''}
                        </td>

                        {/* Gov risk */}
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5, border: `1px solid ${risk.border}`, background: risk.bg, color: risk.text }}>
                            {a.govRisk}
                          </span>
                        </td>

                        {/* Fit score */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', border: `2px solid ${risk.border}`, background: risk.bg, fontSize: 12, fontWeight: 700, color: risk.text }}>
                            {a.fitScore}
                          </div>
                        </td>

                        {/* Decision-maker */}
                        <td style={{ fontSize: 11, color: 'rgb(160,165,195)', maxWidth: 240, lineHeight: 1.5 }}>
                          <div style={{ fontWeight: 600, color: 'rgb(200,205,225)', marginBottom: 3 }}>{a.decisionMaker.split('.')[0]}</div>
                          <div style={{ fontSize: 10, color: 'rgb(130,137,165)' }}>{a.outreachAngle.slice(0, 90)}{a.outreachAngle.length > 90 ? '…' : ''}</div>
                          <button onClick={e => { e.stopPropagation(); toggleDetail(a.co) }} style={{ fontSize: 10, color: 'rgb(96,165,250)', background: 'none', border: 'none', padding: '3px 0 0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                            {expanded ? 'Hide detail' : 'Full analysis'}
                          </button>
                        </td>

                        {/* Action */}
                        <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          {isAdded && !isEnrich ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgb(52,211,153)' }}>
                              <CheckCircle size={13} /> Added
                            </span>
                          ) : isAdded && isEnrich ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgb(251,191,36)' }}>
                              <Loader2 size={13} className="animate-spin" /> Enriching…
                            </span>
                          ) : isAdding ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgb(251,146,60)' }}>
                              <Loader2 size={13} className="animate-spin" /> Adding…
                            </span>
                          ) : (
                            <button className="btn btn-ai" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => addOne(a)}>
                              <Plus size={12} /> Add to BD
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* ── Expanded detail row ── */}
                      {expanded && (
                        <tr key={`${a.co}-detail`}>
                          <td colSpan={9} style={{ padding: 0 }}>
                            <div style={{ padding: '16px 20px', background: 'rgba(251,146,60,0.03)', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>

                                {/* High-stake actions */}
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>High-Stakes Actions</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {a.highStakeActions.map(action => (
                                      <div key={action} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                        <span style={{ color: riskStyle(a.govRisk).text, flexShrink: 0, fontSize: 10, marginTop: 2 }}>●</span>
                                        <span style={{ fontSize: 11, color: 'rgb(160,165,195)', lineHeight: 1.45 }}>{action}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Governance reason + Aergap fit */}
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Governance Risk</div>
                                  <p style={{ fontSize: 11, color: 'rgb(160,165,195)', lineHeight: 1.55, marginBottom: 12 }}>{a.govReason}</p>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Why Aergap Fits</div>
                                  <p style={{ fontSize: 11, color: 'rgb(160,165,195)', lineHeight: 1.55 }}>{a.whyAergap}</p>
                                </div>

                                {/* Trigger signals + outreach */}
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Trigger Signals</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                                    {a.triggerSignals.map(sig => (
                                      <div key={sig} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                        <span style={{ color: 'rgb(52,211,153)', flexShrink: 0, fontSize: 10, marginTop: 2 }}>✓</span>
                                        <span style={{ fontSize: 11, color: 'rgb(160,165,195)', lineHeight: 1.45 }}>{sig}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Outreach Angle</div>
                                  <div style={{ padding: '9px 12px', borderRadius: 8, background: 'rgba(251,146,60,0.07)', border: '1px solid rgba(251,146,60,0.2)', fontSize: 11, color: 'rgb(180,185,210)', lineHeight: 1.55, fontStyle: 'italic' }}>
                                    {a.outreachAngle}
                                  </div>
                                </div>

                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'rgb(100,106,135)', fontSize: 13 }}>
                No companies match your filters.
              </div>
            )}
          </div>
        </div>

        {/* ── Core principle reminder ─────────────────────────── */}
        <div style={{ marginTop: 24, padding: '14px 18px', borderRadius: 10, background: 'rgba(251,146,60,0.05)', border: '1px solid rgba(251,146,60,0.15)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Shield size={16} style={{ color: 'rgb(251,146,60)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: 'rgb(160,165,195)', lineHeight: 1.65 }}>
            <strong style={{ color: 'white' }}>Core evaluation principle:</strong> Evaluate companies based on whether their autonomous agents perform actions that could create financial, operational, compliance, security, or reputational damage if something goes wrong — not merely whether they use AI. Ask: <em>"Would an enterprise customer eventually ask for identity, policy controls, pre-action blocking, and auditability for these agents?"</em>
          </div>
        </div>

      </div>
    </div>
  )
}
