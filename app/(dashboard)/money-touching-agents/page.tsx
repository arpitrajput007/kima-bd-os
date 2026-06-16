'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { actStart, actFinish } from '@/lib/agent-activity'
import {
  DollarSign, Search, ExternalLink, Plus, ChevronUp, ChevronDown,
  CheckCircle, Loader2, BarChart2, Filter, Download,
} from 'lucide-react'
import { MONEY_AGENTS, CATEGORIES, CAT_COLORS, type MoneyAgent, type AgentCategory } from '@/lib/money-touching-agents'

// ── Priority helpers ──────────────────────────────────────────
const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 } as const

const priorityStyle = (p: MoneyAgent['priority']) => {
  if (p === 'High')   return { bg: 'rgba(251,113,133,0.12)', text: 'rgb(251,113,133)', border: 'rgba(251,113,133,0.2)' }
  if (p === 'Medium') return { bg: 'rgba(251,191,36,0.12)',  text: 'rgb(251,191,36)',  border: 'rgba(251,191,36,0.2)'  }
  return               { bg: 'rgba(100,106,135,0.12)',       text: 'rgb(100,106,135)', border: 'rgba(100,106,135,0.2)' }
}

const stageStyle = (s: MoneyAgent['stage']) => {
  if (s === 'Enterprise') return 'rgb(52,211,153)'
  if (s === 'Growth')     return 'rgb(251,191,36)'
  return                         'rgb(251,113,133)'
}

export default function MoneyTouchingAgentsPage() {
  const supabase = createClient()
  const [search, setSearch]       = useState('')
  const [activeCat, setActiveCat] = useState<AgentCategory | 'All'>('All')
  const [priority, setPriority]   = useState<'All' | 'High' | 'Medium' | 'Low'>('All')
  const [adding, setAdding]       = useState<string | null>(null)
  const [added, setAdded]         = useState<Set<string>>(new Set())
  const [enriching, setEnriching] = useState<Set<string>>(new Set())
  const [bulkAdding, setBulkAdding] = useState<string | null>(null)
  const [expandedPain, setExpandedPain] = useState<Set<string>>(new Set())

  // ── Check which companies are already in the CRM ──────────────
  useEffect(() => {
    const names = MONEY_AGENTS.map(a => a.co)
    supabase
      .from('leads')
      .select('company_name')
      .in('company_name', names)
      .then(({ data }) => {
        if (data?.length) setAdded(new Set(data.map((r: { company_name: string }) => r.company_name)))
      })
  }, []) // eslint-disable-line

  // ── Filter ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return MONEY_AGENTS.filter(a => {
      if (activeCat !== 'All' && a.cat !== activeCat) return false
      if (priority  !== 'All' && a.priority !== priority) return false
      if (search) {
        const q = search.toLowerCase()
        const blob = [a.co, a.desc, a.does, a.movement, a.cust, a.pitch, ...a.pain].join(' ').toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    }).sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  }, [activeCat, priority, search])

  // ── Stats ─────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:    MONEY_AGENTS.length,
    high:     MONEY_AGENTS.filter(a => a.priority === 'High').length,
    inCRM:    added.size,
    bycat:    CATEGORIES.map(c => ({
      cat:   c,
      count: MONEY_AGENTS.filter(a => a.cat === c).length,
      high:  MONEY_AGENTS.filter(a => a.cat === c && a.priority === 'High').length,
    })),
  }), [added])

  // ── Enrichment ────────────────────────────────────────────────
  const kickOffEnrichment = (leadId: string, coName: string) => {
    setEnriching(s => new Set([...s, coName]))
    const a1 = actStart({ tool: 'Claude',        action: 'Research + Classify + Fit Analysis', page: `Money Agents — ${coName}`, timestamp: Date.now() })
    const a2 = actStart({ tool: 'ContactFinder', action: 'Find Contacts',                      page: `Money Agents — ${coName}`, timestamp: Date.now() })
    const a3 = actStart({ tool: 'Claude',        action: 'Generate Use Cases',                 page: `Money Agents — ${coName}`, timestamp: Date.now() })
    const t0 = Date.now()
    fetch('/api/ai/enrich-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId }),
    })
      .then(r => r.json())
      .then(res => {
        const dur = Date.now() - t0
        if (res.success) {
          actFinish(a1, 'success', 'Research complete', Math.round(dur * 0.4))
          actFinish(a2, 'success', 'Contacts saved',    Math.round(dur * 0.3))
          actFinish(a3, 'success', 'Use cases ready',   Math.round(dur * 0.3))
          toast.success(`✓ ${coName} fully enriched`)
        } else {
          actFinish(a1, 'error', 'Partial', dur)
          actFinish(a2, 'error', 'Partial', 0)
          actFinish(a3, 'error', 'Partial', 0)
          toast.error(`Enrichment partial for ${coName}`)
        }
      })
      .catch(() => {
        actFinish(a1, 'error', 'Failed', 0)
        actFinish(a2, 'error', 'Failed', 0)
        actFinish(a3, 'error', 'Failed', 0)
        toast.error(`Enrichment failed for ${coName}`)
      })
      .finally(() => setEnriching(s => { const n = new Set(s); n.delete(coName); return n }))
  }

  // ── Add single ────────────────────────────────────────────────
  const addOne = async (a: MoneyAgent) => {
    if (adding || added.has(a.co)) return
    setAdding(a.co)
    try {
      const { data: newLead, error } = await supabase.from('leads').insert({
        company_name:            a.co,
        website:                 a.site,
        description:             a.desc,
        industry_category:       `AI commerce/payment agent`,
        customer_category:       ['Agentic Payments Customer'],
        product_to_sell:         'Agentic payment rails',
        pain_point:              a.pain.join('; '),
        pain_point_severity:     a.priority === 'High' ? 'critical' : a.priority === 'Medium' ? 'high' : 'medium',
        pain_point_evidence:     a.pitch,
        pain_point_evidence_type:'agent_analysis',
        kima_fit:                a.pitch,
        trigger_reason:          `${a.co} — ${a.cat} — moves real money (${a.movement})`,
        integration_feasibility: a.stage === 'Startup' ? 'high' : a.stage === 'Growth' ? 'medium' : 'low',
        lead_score:              a.priority === 'High' ? 85 : a.priority === 'Medium' ? 65 : 45,
        priority:                a.priority === 'High' ? 'excellent' : a.priority === 'Medium' ? 'qualified' : 'needs_research',
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

  // ── Bulk add by category ──────────────────────────────────────
  const bulkAdd = async (cat: AgentCategory) => {
    const targets = MONEY_AGENTS.filter(a => a.cat === cat && !added.has(a.co))
    if (!targets.length) { toast(`All ${cat} companies already in pipeline`); return }
    if (!confirm(`Add all ${targets.length} ${cat} companies to BD pipeline?`)) return
    setBulkAdding(cat)
    let count = 0
    for (const a of targets) {
      try {
        const { error } = await supabase.from('leads').insert({
          company_name:            a.co,
          website:                 a.site,
          description:             a.desc,
          industry_category:       `AI commerce/payment agent`,
          customer_category:       ['Agentic Payments Customer'],
          product_to_sell:         'Agentic payment rails',
          pain_point:              a.pain.join('; '),
          pain_point_severity:     a.priority === 'High' ? 'critical' : a.priority === 'Medium' ? 'high' : 'medium',
          pain_point_evidence:     a.pitch,
          pain_point_evidence_type:'agent_analysis',
          kima_fit:                a.pitch,
          trigger_reason:          `${a.co} — ${a.cat} — moves real money (${a.movement})`,
          integration_feasibility: a.stage === 'Startup' ? 'high' : a.stage === 'Growth' ? 'medium' : 'low',
          lead_score:              a.priority === 'High' ? 85 : a.priority === 'Medium' ? 65 : 45,
          priority:                a.priority === 'High' ? 'excellent' : a.priority === 'Medium' ? 'qualified' : 'needs_research',
          status:                  'new',
          source_url:              a.site,
          updated_at:              new Date().toISOString(),
        })
        if (!error || error.code === '23505') { count++; setAdded(s => new Set([...s, a.co])) }
      } catch { /* continue */ }
    }
    toast.success(`Added ${count} ${cat} companies to pipeline`)
    setBulkAdding(null)
  }

  // ── Export CSV ────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Priority','Category','Company','Website','Description','Agent Does','Moves Money','Money Movement','Customers','Stage','Pain Points','BD Pitch']
    const rows = filtered.map(a => [
      a.priority, a.cat, a.co, a.site, a.desc, a.does, a.money, a.movement, a.cust, a.stage, a.pain.join('; '), a.pitch,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const url  = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a    = document.createElement('a')
    a.href = url; a.download = 'money-touching-agents.csv'; a.click()
  }

  // ── Toggle pain expansion ────────────────────────────────────
  const togglePain = (co: string) => setExpandedPain(s => {
    const n = new Set(s); n.has(co) ? n.delete(co) : n.add(co); return n
  })

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'rgb(10,11,16)' }}>

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(52,211,153,0.2), rgba(124,58,237,0.2))',
              border: '1px solid rgba(52,211,153,0.25)',
            }}>
              <DollarSign size={17} style={{ color: 'rgb(52,211,153)' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: 'rgb(240,242,255)', lineHeight: 1.2 }}>
                Money Touching Agents
              </h1>
              <p style={{ fontSize: 12, color: 'rgb(100,106,135)', marginTop: 2 }}>
                78 autonomous AI agents moving real money — ranked BD prospects for Kima
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
            { label: 'Total agents',     value: stats.total,  color: 'rgb(167,139,250)' },
            { label: 'High priority',    value: stats.high,   color: 'rgb(251,113,133)' },
            { label: 'Already in CRM',   value: stats.inCRM,  color: 'rgb(52,211,153)'  },
            { label: 'Filtered view',    value: filtered.length, color: 'rgb(96,165,250)' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="label">{s.label}</div>
              <div className="value" style={{ color: s.color, fontSize: 26 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Distribution chart ───────────────────────────────── */}
        <div className="section-card" style={{ marginBottom: 28 }}>
          <div className="section-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={14} style={{ color: 'rgb(100,106,135)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'rgb(240,242,255)' }}>Agents by category</span>
            </div>
          </div>
          <div style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 14 }}>
            {stats.bycat.map(({ cat, count, high }) => {
              const c = CAT_COLORS[cat]
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
                    <span style={{ fontSize: 12, fontWeight: 600, color: c.text }}>{cat}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'rgb(240,242,255)' }}>{count}</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                    <div style={{ width: `${(count / 25) * 100}%`, height: '100%', background: c.bar, borderRadius: 3 }} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, color: 'rgb(100,106,135)' }}>
                    {high} high priority · <span style={{ color: c.text }}>{count - high} med/low</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Filters ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgb(100,106,135)', pointerEvents: 'none' }} />
            <input
              className="input-dark"
              style={{ paddingLeft: 32, fontSize: 13 }}
              placeholder="Search company, movement, pain signal…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input-dark"
            style={{ width: 'auto', fontSize: 12 }}
            value={activeCat}
            onChange={e => setActiveCat(e.target.value as AgentCategory | 'All')}
          >
            <option value="All">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            className="input-dark"
            style={{ width: 'auto', fontSize: 12 }}
            value={priority}
            onChange={e => setPriority(e.target.value as 'All' | 'High' | 'Medium' | 'Low')}
          >
            <option value="All">All priorities</option>
            <option value="High">High priority</option>
            <option value="Medium">Medium priority</option>
            <option value="Low">Low priority</option>
          </select>
          <span style={{ fontSize: 12, color: 'rgb(100,106,135)', whiteSpace: 'nowrap' }}>
            {filtered.length} of {MONEY_AGENTS.length} agents
          </span>
        </div>

        {/* ── Category quick-tabs ───────────────────────────────── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {(['All', ...CATEGORIES] as const).map(cat => {
            const isActive = activeCat === cat
            const c = cat !== 'All' ? CAT_COLORS[cat] : null
            return (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 7, cursor: 'pointer',
                  border: `1px solid ${isActive && c ? c.border : isActive ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.055)'}`,
                  background: isActive && c ? c.bg : isActive ? 'rgba(124,58,237,0.14)' : 'transparent',
                  color: isActive && c ? c.text : isActive ? 'rgb(167,139,250)' : 'rgb(100,106,135)',
                  transition: 'all 0.18s ease',
                }}
              >
                {cat === 'All' ? `All (${MONEY_AGENTS.length})` : `${cat} (${MONEY_AGENTS.filter(a => a.cat === cat).length})`}
                {cat !== 'All' && (
                  <button
                    title={`Bulk add all ${cat} agents`}
                    onClick={e => { e.stopPropagation(); bulkAdd(cat as AgentCategory) }}
                    style={{ marginLeft: 6, fontSize: 10, opacity: 0.7, cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', padding: 0 }}
                  >
                    {bulkAdding === cat ? '…' : '+all'}
                  </button>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Table ─────────────────────────────────────────────── */}
        <div className="section-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Priority</th>
                  <th style={{ width: 90 }}>Category</th>
                  <th style={{ width: 180 }}>Company</th>
                  <th>What the agent does</th>
                  <th style={{ width: 120 }}>Money movement</th>
                  <th style={{ width: 90 }}>Stage</th>
                  <th>Pain signals</th>
                  <th>BD pitch</th>
                  <th style={{ width: 100, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const isAdded   = added.has(a.co)
                  const isAdding  = adding === a.co
                  const isEnrich  = enriching.has(a.co)
                  const pri       = priorityStyle(a.priority)
                  const catColor  = CAT_COLORS[a.cat]
                  const painExpanded = expandedPain.has(a.co)
                  const shownPain = painExpanded ? a.pain : a.pain.slice(0, 3)

                  return (
                    <tr key={a.co}>
                      {/* Priority */}
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 600,
                          padding: '3px 8px', borderRadius: 5, border: `1px solid ${pri.border}`,
                          background: pri.bg, color: pri.text,
                        }}>
                          {a.priority}
                        </span>
                      </td>

                      {/* Category */}
                      <td>
                        <span style={{
                          display: 'inline-flex', fontSize: 10, fontWeight: 600,
                          padding: '3px 8px', borderRadius: 5,
                          border: `1px solid ${catColor.border}`, background: catColor.bg, color: catColor.text,
                        }}>
                          {a.cat}
                        </span>
                      </td>

                      {/* Company */}
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'rgb(240,242,255)' }}>{a.co}</div>
                        <div style={{ fontSize: 11, color: 'rgb(100,106,135)', marginTop: 3, maxWidth: 200 }}>{a.desc}</div>
                        <a
                          href={a.site}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 11, color: 'rgb(96,165,250)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 4 }}
                        >
                          <ExternalLink size={10} /> Site
                        </a>
                      </td>

                      {/* Does */}
                      <td style={{ fontSize: 11, color: 'rgb(160,165,195)', maxWidth: 200 }}>{a.does}</td>

                      {/* Movement */}
                      <td style={{ fontSize: 11, color: 'rgb(52,211,153)', maxWidth: 140 }}>
                        <span style={{
                          display: 'inline-flex', fontSize: 10, fontWeight: 600,
                          padding: '3px 8px', borderRadius: 5,
                          background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.2)', color: 'rgb(52,211,153)',
                          marginBottom: 4,
                        }}>✓ Real money</span>
                        <div style={{ fontSize: 10, color: 'rgb(100,106,135)', marginTop: 4 }}>{a.movement}</div>
                      </td>

                      {/* Stage */}
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 600, color: stageStyle(a.stage) }}>{a.stage}</span>
                        <div style={{ fontSize: 10, color: 'rgb(100,106,135)', marginTop: 2 }}>{a.cust.split(',')[0]}</div>
                      </td>

                      {/* Pain */}
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {shownPain.map(p => (
                            <span key={p} style={{
                              fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 4,
                              background: 'rgba(255,255,255,0.05)', color: 'rgb(160,165,195)',
                              border: '1px solid rgba(255,255,255,0.055)',
                            }}>{p}</span>
                          ))}
                        </div>
                        {a.pain.length > 3 && (
                          <button
                            onClick={() => togglePain(a.co)}
                            style={{ marginTop: 4, fontSize: 10, color: 'rgb(96,165,250)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
                          >
                            {painExpanded ? '▲ less' : `+${a.pain.length - 3} more`}
                          </button>
                        )}
                      </td>

                      {/* Pitch */}
                      <td style={{ fontSize: 11, color: 'rgb(160,165,195)', maxWidth: 280, lineHeight: 1.5 }}>{a.pitch}</td>

                      {/* Action */}
                      <td style={{ textAlign: 'center' }}>
                        {isAdded && !isEnrich ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgb(52,211,153)' }}>
                            <CheckCircle size={13} /> Added
                          </span>
                        ) : isAdded && isEnrich ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgb(251,191,36)' }}>
                            <Loader2 size={13} className="animate-spin" /> Enriching…
                          </span>
                        ) : isAdding ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgb(167,139,250)' }}>
                            <Loader2 size={13} className="animate-spin" /> Adding…
                          </span>
                        ) : (
                          <button
                            className="btn btn-ai"
                            style={{ fontSize: 11, padding: '5px 10px' }}
                            onClick={() => addOne(a)}
                          >
                            <Plus size={12} /> Add to BD
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'rgb(100,106,135)', fontSize: 13 }}>
                No agents match your filters.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
