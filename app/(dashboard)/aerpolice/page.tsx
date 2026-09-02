'use client'

// Aerpolice discovery desk. One button — "Run Aerpolice Discovery" — scans
// every due source (daily sources look back 7 days, weekly sources 30 days),
// runs the harvest -> extract -> profile -> score -> gate -> save pipeline
// against each, and reports the run. There is no cron here: this pipeline
// only ever runs when this button is clicked (see lib/aerpolice-orchestrator.ts).

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ShieldCheck, Loader2, Play, ExternalLink, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Eye, RefreshCw, Radio,
} from 'lucide-react'
import type { Lead } from '@/lib/types'

interface RunRow {
  id: string
  status: 'running' | 'completed' | 'failed'
  triggered_by: string | null
  sources_scanned: number
  sources_skipped: number
  sources_failed: number
  leads_created: number
  candidates_found: number
  tier1_count: number
  tier2_count: number
  tier3_count: number
  contact_now_count: number
  validate_then_send_count: number
  monitor_count: number
  started_at: string
  finished_at: string | null
  errors: Array<{ source: string; error: string }>
}

interface SourceRow {
  id: string
  source_name: string
  frequency: string | null
  last_run_at: string | null
  last_success_at: string | null
  leads_generated: number | null
  companies_evaluated: number | null
  total_runs: number | null
  consecutive_failures: number | null
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function tierColor(tier: number | null | undefined) {
  if (tier === 1) return '#34d399'
  if (tier === 2) return '#fbbf24'
  return '#f87171'
}

function scoreColor(score: number) {
  if (score >= 82) return { color: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.3)' }
  if (score >= 72) return { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)' }
  return { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' }
}

const NEXT_ACTION_META: Record<string, { label: string; color: string }> = {
  'Contact now': { label: 'Contact now', color: '#34d399' },
  'Validate then send': { label: 'Validate then send', color: '#fbbf24' },
  Monitor: { label: 'Monitor', color: '#94a3b8' },
}

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

export default function AerpoliceDiscoveryPage() {
  const [sources, setSources] = useState<SourceRow[]>([])
  const [recentRuns, setRecentRuns] = useState<RunRow[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loadingLeads, setLoadingLeads] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [nextActionFilter, setNextActionFilter] = useState<string>('All')

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/aerpolice/run-discovery')
      const data = await res.json()
      setRecentRuns(data.recent_runs || [])
      setIsRunning(!!data.is_running)
    } catch { /* status panel is best-effort */ }
  }, [])

  const loadSources = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/discover-aerpolice')
      const data = await res.json()
      setSources(data.sources || [])
    } catch { /* best-effort */ }
  }, [])

  const loadLeads = useCallback(async () => {
    setLoadingLeads(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('leads')
      .select('*')
      .not('aerpolice_score', 'is', null)
      .order('aerpolice_score', { ascending: false })
      .limit(100)
    setLeads((data || []) as Lead[])
    setLoadingLeads(false)
  }, [])

  useEffect(() => {
    loadStatus()
    loadSources()
    loadLeads()
  }, [loadStatus, loadSources, loadLeads])

  const runDiscovery = async () => {
    setTriggering(true)
    try {
      const res = await fetch('/api/aerpolice/run-discovery', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Discovery run failed')
      } else {
        toast.success(`Run complete — ${data.leads_created} lead${data.leads_created === 1 ? '' : 's'} saved from ${data.sources_scanned} source${data.sources_scanned === 1 ? '' : 's'}`)
        await Promise.all([loadStatus(), loadSources(), loadLeads()])
      }
    } catch {
      toast.error('Discovery run failed')
    }
    setTriggering(false)
  }

  const filteredLeads = nextActionFilter === 'All' ? leads : leads.filter(l => l.aerpolice_next_action === nextActionFilter)
  const latest = recentRuns[0]

  return (
    <div className="fade-in">
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck size={18} style={{ color: '#22d3ee' }} /> Aerpolice Discovery
          </h1>
          <p className="text-[12px] mt-1 font-medium" style={{ color: 'rgb(100,106,135)' }}>
            Manual only — no cron. Scans daily sources for the last 7 days and weekly sources for the last 30, and requires a verified external action before anything is saved.
          </p>
        </div>
        <button
          onClick={runDiscovery}
          disabled={triggering || isRunning}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: triggering || isRunning ? 'not-allowed' : 'pointer', border: '1px solid rgba(34,211,238,0.4)', background: 'rgba(34,211,238,0.12)', color: '#22d3ee', opacity: triggering || isRunning ? 0.7 : 1 }}>
          {triggering || isRunning ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
          {isRunning ? 'Discovery running…' : triggering ? 'Starting…' : 'Run Aerpolice Discovery'}
        </button>
      </div>

      <div style={{ padding: 'clamp(14px, 4vw, 20px) clamp(16px, 5vw, 36px)' }}>

        {/* Latest run stats */}
        {latest && (
          <div style={{ marginBottom: 20, borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <Radio size={13} style={{ color: latest.status === 'running' ? '#22d3ee' : latest.status === 'failed' ? '#f87171' : '#34d399' }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'white' }}>
                {latest.status === 'running' ? 'Running now' : latest.status === 'failed' ? 'Last run failed' : 'Last run'}
              </span>
              <span style={{ fontSize: 11, color: 'rgb(120,127,160)' }}>{timeAgo(latest.started_at)} · {latest.triggered_by || 'user'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px,1fr))', gap: 10 }}>
              {[
                { label: 'Sources scanned', value: latest.sources_scanned, color: '#38bdf8' },
                { label: 'Skipped (not due)', value: latest.sources_skipped, color: 'rgb(140,146,175)' },
                { label: 'Failed', value: latest.sources_failed, color: latest.sources_failed ? '#f87171' : 'rgb(140,146,175)' },
                { label: 'Leads saved', value: latest.leads_created, color: '#34d399' },
                { label: 'Contact now', value: latest.contact_now_count, color: '#34d399' },
                { label: 'Validate then send', value: latest.validate_then_send_count, color: '#fbbf24' },
                { label: 'Monitor', value: latest.monitor_count, color: '#94a3b8' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 19, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 9.5, color: 'rgb(110,116,145)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {latest.errors?.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 11, color: '#f87171' }}>
                {latest.errors.map((e, i) => <div key={i}>{e.source}: {e.error}</div>)}
              </div>
            )}
          </div>
        )}

        {/* Next-action filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          {['All', 'Contact now', 'Validate then send', 'Monitor'].map(f => (
            <button key={f} onClick={() => setNextActionFilter(f)}
              style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${nextActionFilter === f ? 'rgba(34,211,238,0.5)' : 'rgba(255,255,255,0.08)'}`, background: nextActionFilter === f ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.03)', color: nextActionFilter === f ? '#22d3ee' : 'rgb(150,155,185)' }}>
              {f}
            </button>
          ))}
          <span style={{ fontSize: 11, color: 'rgb(100,107,140)', marginLeft: 4 }}>{filteredLeads.length} shown</span>
          <button onClick={loadLeads} title="Refresh" style={{ marginLeft: 'auto', padding: 6, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer' }}>
            <RefreshCw size={12} className={loadingLeads ? 'animate-spin' : ''} style={{ color: 'rgb(140,146,175)' }} />
          </button>
        </div>

        {/* Discovered leads */}
        <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
            {loadingLeads ? (
              <div style={{ padding: 30, textAlign: 'center' }}><Loader2 size={16} className="animate-spin" style={{ color: 'rgb(120,127,160)' }} /></div>
            ) : filteredLeads.length === 0 ? (
              <div style={{ padding: '30px 20px', textAlign: 'center', fontSize: 12, color: 'rgb(120,127,160)' }}>
                No Aerpolice-discovered leads yet — click &quot;Run Aerpolice Discovery&quot; to start.
              </div>
            ) : filteredLeads.map(lead => {
              const isExp = expanded === lead.id
              const dossier = lead.aerpolice_dossier
              const sc = scoreColor(lead.aerpolice_score || 0)
              const na = NEXT_ACTION_META[lead.aerpolice_next_action || ''] || { label: lead.aerpolice_next_action || 'Unknown', color: 'rgb(150,155,185)' }
              return (
                <div key={lead.id} style={{ borderRadius: 14, border: `1px solid ${isExp ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.08)'}`, background: isExp ? 'rgba(34,211,238,0.05)' : 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
                  <div onClick={() => setExpanded(isExp ? null : lead.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', cursor: 'pointer', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{lead.company_name}</span>
                        {(dossier?.structural_fit?.segments || []).slice(0, 2).map(seg => (
                          <span key={seg} style={{ fontSize: 9.5, fontWeight: 600, color: '#22d3ee', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)', padding: '2px 7px', borderRadius: 6 }}>{seg}</span>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgb(150,155,185)', marginTop: 4, lineHeight: 1.5 }}>{lead.trigger_reason || dossier?.verified_action?.description || ''}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 8.5, color: 'rgb(100,107,140)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Score</div>
                        <span style={{ display: 'inline-flex', minWidth: 34, justifyContent: 'center', padding: '2px 8px', borderRadius: 7, fontSize: 13, fontWeight: 800, color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}>{lead.aerpolice_score}</span>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: tierColor(lead.aerpolice_tier), padding: '4px 10px', borderRadius: 7, background: `${tierColor(lead.aerpolice_tier)}18`, border: `1px solid ${tierColor(lead.aerpolice_tier)}45` }}>Tier {lead.aerpolice_tier}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: na.color }}>{na.label}</span>
                      {isExp ? <ChevronUp size={14} style={{ color: 'rgb(120,127,160)' }} /> : <ChevronDown size={14} style={{ color: 'rgb(120,127,160)' }} />}
                    </div>
                  </div>

                  {isExp && dossier && (
                    <div style={{ padding: '0 18px 18px 18px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 10, marginBottom: 12 }}>
                        <div style={{ borderRadius: 12, border: '1px solid rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.05)', padding: '11px 13px' }}>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: 6 }}>Verified action</div>
                          <div style={{ fontSize: 11.5, color: 'rgb(200,205,230)', lineHeight: 1.55 }}>{dossier.verified_action?.description}</div>
                        </div>
                        <div style={{ borderRadius: 12, border: '1px solid rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.05)', padding: '11px 13px' }}>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 6 }}>Why now · {dossier.trigger?.date || 'undated'}</div>
                          <div style={{ fontSize: 11.5, color: 'rgb(200,205,230)', lineHeight: 1.55 }}>{dossier.trigger?.what_happened}</div>
                        </div>
                        <div style={{ borderRadius: 12, border: '1px solid rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.05)', padding: '11px 13px' }}>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', marginBottom: 6 }}>Control gap</div>
                          <div style={{ fontSize: 11.5, color: 'rgb(200,205,230)', lineHeight: 1.55 }}>{dossier.control_gap?.gap} <span style={{ color: 'rgb(140,146,175)' }}>[{dossier.control_gap?.status}]</span></div>
                        </div>
                      </div>
                      <div style={{ borderRadius: 12, border: '1px solid rgba(56,189,248,0.2)', background: 'rgba(56,189,248,0.05)', padding: '11px 13px', marginBottom: 12 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: 6 }}>First qualification question</div>
                        <div style={{ fontSize: 12, color: 'rgb(220,225,245)', lineHeight: 1.6, fontStyle: 'italic' }}>&ldquo;{dossier.first_qualification_question}&rdquo;</div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                          <SubScore label="Action fit" value={lead.aerpolice_score_breakdown?.actionFitScore || 0} max={25} />
                          <SubScore label="Trigger" value={lead.aerpolice_score_breakdown?.triggerScore || 0} max={20} />
                          <SubScore label="Reach" value={lead.aerpolice_score_breakdown?.reachabilityScore || 0} max={20} />
                          <SubScore label="Consequence" value={lead.aerpolice_score_breakdown?.consequenceScore || 0} max={15} />
                          <SubScore label="Complementarity" value={lead.aerpolice_score_breakdown?.complementarityScore || 0} max={10} />
                          <SubScore label="Evidence" value={lead.aerpolice_score_breakdown?.evidenceScore || 0} max={10} />
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginLeft: 'auto' }}>
                          {dossier.verified_action?.evidence_url && (
                            <a href={dossier.verified_action.evidence_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#818cf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <ExternalLink size={11} /> Action evidence
                            </a>
                          )}
                          {dossier.trigger?.evidence_url && (
                            <a href={dossier.trigger.evidence_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <ExternalLink size={11} /> Trigger evidence
                            </a>
                          )}
                          <a href={`/leads/${lead.id}`} style={{ fontSize: 11, color: 'rgb(150,155,185)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Eye size={11} /> Open lead
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Sources */}
        <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 13, fontWeight: 700, color: 'white' }}>
            Monitored sources ({sources.length})
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['Source', 'Cadence', 'Last run', 'Leads', 'Companies evaluated', 'Failures'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 14px', fontSize: 10, fontWeight: 700, color: 'rgb(120,127,160)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sources.map(s => (
                  <tr key={s.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px 14px', fontSize: 12, color: 'white', fontWeight: 600 }}>{s.source_name}</td>
                    <td style={{ padding: '8px 14px', fontSize: 11, color: 'rgb(150,155,185)', textTransform: 'capitalize' }}>{s.frequency}</td>
                    <td style={{ padding: '8px 14px', fontSize: 11, color: 'rgb(120,127,160)' }}>{timeAgo(s.last_run_at)}</td>
                    <td style={{ padding: '8px 14px', fontSize: 11, color: '#34d399' }}>{s.leads_generated ?? 0}</td>
                    <td style={{ padding: '8px 14px', fontSize: 11, color: 'rgb(150,155,185)' }}>{s.companies_evaluated ?? 0}</td>
                    <td style={{ padding: '8px 14px', fontSize: 11 }}>
                      {(s.consecutive_failures ?? 0) > 0
                        ? <span style={{ color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: 4 }}><XCircle size={11} /> {s.consecutive_failures}</span>
                        : <span style={{ color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={11} /> 0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
