'use client'

// AERSeal discovery desk.
// Runs the dedicated pipeline against one event surface at a time and shows
// exactly why each prospect scored what it scored — the whole rubric is
// computed in code, so it can be displayed rather than taken on trust.

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  ShieldCheck, Loader2, Play, ExternalLink, ChevronDown, ChevronRight,
  AlertTriangle, XCircle, CheckCircle2, FlaskConical, Radio, RefreshCw,
  Newspaper,
} from 'lucide-react'

interface Surface {
  key: string
  label: string
  kind: string
  tier: string
  segments: string[]
  probe: string
  is_url: boolean
}

interface Breakdown {
  pain_consequence: number
  trigger_recency: number
  evm_fit: number
  admin_authority_fit: number
  reachability: number
  evidence_confidence: number
  weighted_subtotal: number
  lock_in_penalty: number
  total: number
  tier: 1 | 2 | 3
  notes: string[]
}

interface Prospect {
  organization: string
  website: string
  score: number
  tier: 1 | 2 | 3
  tier_label: string
  breakdown: Breakdown
  trigger?: { type?: string; what_happened?: string; date?: string; evidence_url?: string; evidence_tier?: string }
  trigger_age_days?: number | null
  control_model?: string
  powers?: string[]
  control_gap?: { gap?: string; status?: string; basis?: string }
  gap_downgrades?: string[]
  why_now?: string
  authority_loss_scenario?: string
  approved: boolean
  gate_failures: string[]
  rejections: string[]
  outcome: string
  lead_id?: string
  buyers?: Array<{ name: string; title: string; email: string | null; linkedin_url: string | null; source: string; confidence: string; why: string }>
  hypothesis?: { verified_trigger: string; authority_implication: string; intelligent_question: string; evidence_url: string } | null
  hypothesis_problems?: string[]
  insert_error?: string
}

interface RunResult {
  surface_label: string
  harvested_via: string
  candidates_found: number
  skipped_no_authority_angle: number
  skipped_generic_name: number
  skipped_duplicate: number
  profiled: number
  profile_failed: number
  rejected: number
  gate_failed: number
  approved: number
  saved: number
  hypothesis_rejected: number
  insert_failed: number
  tier_1: number
  tier_2: number
  tier_3: number
  prospects: Prospect[]
  error?: string
}

interface RunLedgerRow {
  id: string
  run_type: 'backfill' | 'incremental' | 'full' | 'manual'
  status: 'running' | 'completed' | 'failed'
  triggered_by: string | null
  lookback_days: number | null
  sources_scanned: number
  sources_skipped: number
  sources_failed: number
  leads_created: number
  tier1_count: number
  started_at: string
  finished_at: string | null
  errors: Array<{ source: string; error: string }>
}

interface DigestItem {
  lead_id: string
  company: string
  score: number
  tier: 1 | 2 | 3
  tier_label: string
  trigger_event: string | null
  trigger_date: string | null
  trigger_evidence_url: string | null
  privileged_role: string | null
  controller_classification: string
  likely_buyer: string | null
  first_intelligent_discovery_question: string | null
  recommended_action: 'outreach' | 'further_research' | 'monitor'
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

const RUN_TYPE_LABEL: Record<string, string> = {
  backfill: '30-day backfill',
  incremental: 'Incremental scan',
  full: 'Full reconciliation',
  manual: 'Manual run',
}

const ACTION_BADGE: Record<string, { label: string; c: string; bg: string; b: string }> = {
  outreach: { label: 'Outreach', c: '#34d399', bg: 'rgba(52,211,153,0.1)', b: 'rgba(52,211,153,0.28)' },
  further_research: { label: 'Further research', c: '#fbbf24', bg: 'rgba(251,191,36,0.1)', b: 'rgba(251,191,36,0.25)' },
  monitor: { label: 'Monitor', c: '#94a3b8', bg: 'rgba(148,163,184,0.09)', b: 'rgba(148,163,184,0.2)' },
}

const WEIGHTS: Record<string, string> = {
  pain_consequence: '25%',
  trigger_recency: '20%',
  admin_authority_fit: '20%',
  evm_fit: '15%',
  reachability: '10%',
  evidence_confidence: '10%',
}

const COMPONENT_LABEL: Record<string, string> = {
  pain_consequence: 'Pain / consequence',
  trigger_recency: 'Trigger recency',
  admin_authority_fit: 'Admin-authority fit',
  evm_fit: 'EVM fit',
  reachability: 'Reachability',
  evidence_confidence: 'Evidence confidence',
}

function tierColor(tier: 1 | 2 | 3) {
  if (tier === 1) return { c: '#34d399', bg: 'rgba(52,211,153,0.1)', b: 'rgba(52,211,153,0.28)' }
  if (tier === 2) return { c: '#fbbf24', bg: 'rgba(251,191,36,0.1)', b: 'rgba(251,191,36,0.25)' }
  return { c: '#94a3b8', bg: 'rgba(148,163,184,0.09)', b: 'rgba(148,163,184,0.2)' }
}

function outcomeBadge(o: string) {
  switch (o) {
    case 'approved': return { label: 'Approved', c: '#34d399', bg: 'rgba(52,211,153,0.1)', b: 'rgba(52,211,153,0.28)', Icon: CheckCircle2 }
    case 'approved_no_send': return { label: 'Approved · no send', c: '#fbbf24', bg: 'rgba(251,191,36,0.1)', b: 'rgba(251,191,36,0.25)', Icon: AlertTriangle }
    case 'gate_failed': return { label: 'Failed gate', c: '#f87171', bg: 'rgba(248,113,113,0.09)', b: 'rgba(248,113,113,0.22)', Icon: AlertTriangle }
    default: return { label: 'Rejected', c: '#94a3b8', bg: 'rgba(148,163,184,0.09)', b: 'rgba(148,163,184,0.2)', Icon: XCircle }
  }
}

function Bar({ value, weight, label }: { value: number; weight: string; label: string }) {
  const hue = value >= 75 ? '#34d399' : value >= 50 ? '#fbbf24' : '#f87171'
  return (
    <div style={{ marginBottom: 7 }}>
      <div className="flex items-center justify-between" style={{ fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: 'rgb(150,155,180)' }}>
          {label} <span style={{ color: 'rgb(100,105,130)' }}>· {weight}</span>
        </span>
        <span className="mono" style={{ color: hue, fontWeight: 700 }}>{value}</span>
      </div>
      <div style={{ height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: hue, borderRadius: 3 }} />
      </div>
    </div>
  )
}

export default function AersealPage() {
  const [surfaces, setSurfaces] = useState<Surface[]>([])
  const [selected, setSelected] = useState<string>('')
  const [dryRun, setDryRun] = useState(true)
  const [deepCrawl, setDeepCrawl] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Recurring discovery — status of the background/manual orchestrator run
  // (lib/aerseal-orchestrator.ts), separate from the single-surface "Run
  // surface" tool above.
  const [lastRun, setLastRun] = useState<RunLedgerRow | null>(null)
  const [runIsLocked, setRunIsLocked] = useState(false)
  const [recurringRunning, setRecurringRunning] = useState(false)
  const [digest, setDigest] = useState<DigestItem[] | null>(null)
  const [digestLoading, setDigestLoading] = useState(false)

  const loadRunStatus = useCallback(() => {
    fetch('/api/aerseal/run-discovery')
      .then(r => r.json())
      .then(d => {
        setLastRun(d.latest_run || null)
        setRunIsLocked(!!d.is_running)
      })
      .catch(() => {})
  }, [])

  const loadDigest = useCallback(() => {
    setDigestLoading(true)
    fetch('/api/aerseal/digest?since=7d&limit=20')
      .then(r => r.json())
      .then(d => setDigest(d.items || []))
      .catch(() => toast.error('Could not load the AERSeal digest'))
      .finally(() => setDigestLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/ai/discover-aerseal')
      .then(r => r.json())
      .then(d => {
        setSurfaces(d.surfaces || [])
        if (d.surfaces?.length) setSelected(d.surfaces[0].key)
      })
      .catch(() => toast.error('Could not load monitoring surfaces'))
    loadRunStatus()
    loadDigest()
  }, [loadRunStatus, loadDigest])

  const runRecurring = useCallback(async () => {
    setRecurringRunning(true)
    try {
      const res = await fetch('/api/aerseal/run-discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'manual' }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'AERSeal discovery run failed')
        return
      }
      toast.success(
        `${RUN_TYPE_LABEL[data.run_type] || 'Run'} complete — ${data.leads_created} lead${data.leads_created === 1 ? '' : 's'} from ${data.sources_scanned} source${data.sources_scanned === 1 ? '' : 's'}`,
      )
      loadRunStatus()
      loadDigest()
    } catch {
      toast.error('AERSeal discovery run failed')
    } finally {
      setRecurringRunning(false)
    }
  }, [loadRunStatus, loadDigest])

  const run = useCallback(async () => {
    if (!selected) return
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch('/api/ai/discover-aerseal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surface_key: selected,
          dry_run: dryRun,
          deep_crawl: deepCrawl,
          research_ai: localStorage.getItem('research_ai') || 'claude',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Discovery failed')
        setResult(data)
        return
      }
      setResult(data)
      const n = dryRun ? data.approved : data.saved
      toast.success(
        dryRun
          ? `${n} prospect${n === 1 ? '' : 's'} would qualify — nothing saved (dry run)`
          : `${n} prospect${n === 1 ? '' : 's'} saved to the lead inbox`,
      )
    } catch {
      toast.error('Discovery request failed')
    } finally {
      setRunning(false)
    }
  }, [selected, dryRun, deepCrawl])

  const surface = surfaces.find(s => s.key === selected)

  return (
    <div className="fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck size={18} style={{ color: '#38bdf8' }} />
            AERSeal Discovery
          </h1>
          <p className="text-xs mt-1" style={{ color: 'rgb(100,100,120)' }}>
            Monitors events where EVM smart-contract administrative authority becomes important — not companies
            that happen to be interested in security.
          </p>
        </div>
      </div>

      <div className="p-8 space-y-6">
        {/* ── Recurring discovery ──────────────────────────────────── */}
        <div className="rounded-xl p-5" style={{ background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.18)' }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <RefreshCw size={14} style={{ color: '#a78bfa' }} /> Recurring discovery
              </p>
              <p className="text-xs mt-1" style={{ color: 'rgb(100,105,130)' }}>
                Automatic: incremental scan every 6h (configurable via <span className="mono">AERSEAL_INCREMENTAL_INTERVAL_HOURS</span>), full reconciliation
                daily ~08:00 IST. First-ever run always backfills the last 30 days.
              </p>
            </div>
            <button className="btn btn-primary" onClick={runRecurring} disabled={recurringRunning || runIsLocked}>
              {recurringRunning || runIsLocked
                ? <><Loader2 size={14} className="animate-spin" /> {runIsLocked && !recurringRunning ? 'A run is already in progress…' : 'Running…'}</>
                : <><Play size={14} /> Run AERSeal Discovery</>}
            </button>
          </div>
          {lastRun && (
            <div className="text-xs mt-3 flex items-center gap-2 flex-wrap" style={{ color: 'rgb(120,127,160)' }}>
              <span className="badge" style={{
                color: lastRun.status === 'completed' ? '#34d399' : lastRun.status === 'failed' ? '#f87171' : '#fbbf24',
                background: lastRun.status === 'completed' ? 'rgba(52,211,153,0.1)' : lastRun.status === 'failed' ? 'rgba(248,113,113,0.09)' : 'rgba(251,191,36,0.1)',
                borderColor: 'transparent',
              }}>
                {lastRun.status}
              </span>
              <span>{RUN_TYPE_LABEL[lastRun.run_type] || lastRun.run_type} · {timeAgo(lastRun.started_at)}</span>
              {lastRun.status === 'completed' && (
                <span className="mono">
                  · {lastRun.sources_scanned} scanned{lastRun.sources_skipped > 0 && ` · ${lastRun.sources_skipped} not due`}{lastRun.sources_failed > 0 && ` · ${lastRun.sources_failed} failed`} · {lastRun.leads_created} lead{lastRun.leads_created === 1 ? '' : 's'} · {lastRun.tier1_count} Tier 1
                </span>
              )}
              {lastRun.errors?.length > 0 && (
                <span style={{ color: '#f87171' }}>· {lastRun.errors.length} source error{lastRun.errors.length === 1 ? '' : 's'} (logged, run continued)</span>
              )}
            </div>
          )}
        </div>

        {/* ── Today's digest ───────────────────────────────────────── */}
        {digest !== null && (
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <Newspaper size={14} style={{ color: '#38bdf8' }} /> AERSeal opportunity digest
                <span className="text-xs font-normal" style={{ color: 'rgb(100,105,130)' }}>· last 7 days, ranked by score</span>
              </p>
              {digestLoading && <Loader2 size={13} className="animate-spin" style={{ color: 'rgb(100,105,130)' }} />}
            </div>
            {digest.length === 0 ? (
              <div className="p-6 text-center text-xs" style={{ color: 'rgb(120,127,160)' }}>
                No qualified AERSeal leads in the last 7 days yet. Run a surface above or wait for the next scheduled scan.
              </div>
            ) : (
              <div>
                {digest.map(item => {
                  const ab = ACTION_BADGE[item.recommended_action]
                  const tc = tierColor(item.tier)
                  return (
                    <a key={item.lead_id} href={`/leads/${item.lead_id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-white/[0.02]" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">{item.company}</span>
                          <span className="badge" style={{ color: tc.c, background: tc.bg, borderColor: tc.b }}>{item.tier_label} · {item.score}</span>
                          <span className="badge" style={{ color: ab.c, background: ab.bg, borderColor: ab.b }}>{ab.label}</span>
                          {item.privileged_role && (
                            <span className="badge" style={{ color: 'rgb(150,155,180)', background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.09)' }}>
                              {item.privileged_role} · {item.controller_classification}
                            </span>
                          )}
                        </div>
                        {item.trigger_event && (
                          <p className="text-xs mt-1.5 line-clamp-1" style={{ color: 'rgb(150,155,180)' }}>
                            {item.trigger_date ? `${item.trigger_date} — ` : ''}{item.trigger_event}
                          </p>
                        )}
                        {item.first_intelligent_discovery_question && (
                          <p className="text-xs mt-1 italic line-clamp-1" style={{ color: 'rgb(120,127,160)' }}>
                            &ldquo;{item.first_intelligent_discovery_question}&rdquo;
                          </p>
                        )}
                      </div>
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Controls ─────────────────────────────────────────────── */}
        <div className="rounded-xl p-5" style={{ background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.18)' }}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'rgb(150,155,180)' }}>
                Event surface
              </label>
              <select className="input-dark" value={selected} onChange={e => setSelected(e.target.value)}>
                {surfaces.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
              {surface && (
                <p className="text-xs mt-2 mono" style={{ color: 'rgb(100,105,130)' }}>
                  {surface.is_url ? 'crawl' : 'search'} · evidence tier: {surface.tier} · {surface.probe.slice(0, 90)}
                  {surface.probe.length > 90 ? '…' : ''}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'rgb(150,155,180)' }}>
                <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
                <FlaskConical size={13} /> Dry run
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'rgb(150,155,180)' }}>
                <input type="checkbox" checked={deepCrawl} onChange={e => setDeepCrawl(e.target.checked)} />
                Deep crawl
              </label>
              <button className="btn btn-primary" onClick={run} disabled={running || !selected}>
                {running ? <><Loader2 size={14} className="animate-spin" /> Monitoring…</> : <><Play size={14} /> Run surface</>}
              </button>
            </div>
          </div>
          <p className="text-xs mt-3" style={{ color: 'rgb(100,105,130)' }}>
            Dry run scores and gates every prospect without writing anything to the lead inbox, and without spending
            Apollo or Hunter credits on enrichment.
          </p>
        </div>

        {running && (
          <div className="rounded-xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Loader2 size={22} className="animate-spin mx-auto mb-3" style={{ color: '#38bdf8' }} />
            <p className="text-sm text-white">Harvesting the surface, profiling contract authority, scoring.</p>
            <p className="text-xs mt-1" style={{ color: 'rgb(100,105,130)' }}>
              A full surface takes 1–3 minutes — each prospect gets a live site crawl and an authority dossier.
            </p>
          </div>
        )}

        {result?.error && (
          <div className="rounded-xl p-5" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.25)' }}>
            <p className="text-sm font-semibold" style={{ color: '#f87171' }}>{result.error}</p>
          </div>
        )}

        {/* ── Funnel ───────────────────────────────────────────────── */}
        {result && !result.error && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: 'Candidates', value: result.candidates_found, hint: 'organisations the surface surfaced' },
                { label: 'Profiled', value: result.profiled, hint: 'full authority dossiers built' },
                { label: 'Rejected', value: result.rejected, hint: 'hit a disqualifying rule' },
                { label: 'Failed gate', value: result.gate_failed, hint: 'missing one of the six requirements' },
                { label: 'Approved', value: result.approved, hint: 'cleared every requirement' },
                { label: 'Tier 1', value: result.tier_1, hint: 'score 82+' },
                { label: result.saved > 0 ? 'Saved' : 'Not saved', value: result.saved, hint: result.saved > 0 ? 'written to the lead inbox' : 'dry run' },
              ].map(s => (
                <div key={s.label} className="stat-card" style={{ padding: '14px 16px' }} title={s.hint}>
                  <div className="text-xl font-bold text-white">{s.value}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'rgb(120,127,160)' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <p className="text-xs" style={{ color: 'rgb(100,105,130)' }}>
              Harvested via <span className="mono">{result.harvested_via}</span>
              {result.skipped_duplicate > 0 && ` · ${result.skipped_duplicate} already in the lead inbox`}
              {result.skipped_no_authority_angle > 0 && ` · ${result.skipped_no_authority_angle} dropped with no authority angle`}
              {result.insert_failed > 0 && ` · ${result.insert_failed} failed to save`}
            </p>

            {/* ── Prospects ──────────────────────────────────────────── */}
            <div className="space-y-3">
              {result.prospects.length === 0 && (
                <div className="rounded-xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Radio size={20} className="mx-auto mb-2" style={{ color: 'rgb(100,105,130)' }} />
                  <p className="text-sm" style={{ color: 'rgb(150,155,180)' }}>
                    Nothing on this surface carried a dated authority event. That is a normal result — try another
                    surface, or come back when it has moved.
                  </p>
                </div>
              )}

              {result.prospects.map(p => {
                const ob = outcomeBadge(p.outcome)
                const tc = tierColor(p.tier)
                const open = expanded === p.organization
                return (
                  <div key={p.organization} className="rounded-xl card-hover" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <button
                      onClick={() => setExpanded(open ? null : p.organization)}
                      className="w-full text-left p-4 flex items-start gap-3"
                    >
                      {open ? <ChevronDown size={15} className="mt-1 shrink-0" style={{ color: 'rgb(120,127,160)' }} />
                            : <ChevronRight size={15} className="mt-1 shrink-0" style={{ color: 'rgb(120,127,160)' }} />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">{p.organization}</span>
                          <span className="badge" style={{ color: tc.c, background: tc.bg, borderColor: tc.b }}>
                            {p.tier_label} · {p.score}
                          </span>
                          <span className="badge" style={{ color: ob.c, background: ob.bg, borderColor: ob.b }}>
                            <ob.Icon size={11} /> {ob.label}
                          </span>
                          {p.control_model && (
                            <span className="badge" style={{ color: 'rgb(150,155,180)', background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.09)' }}>
                              {p.control_model}
                            </span>
                          )}
                        </div>
                        {p.trigger?.what_happened && (
                          <p className="text-xs mt-1.5 line-clamp-2" style={{ color: 'rgb(150,155,180)' }}>
                            {p.trigger.what_happened}
                          </p>
                        )}
                        <p className="text-xs mt-1 mono" style={{ color: 'rgb(100,105,130)' }}>
                          {p.trigger?.date || 'undated'}
                          {p.trigger_age_days != null && ` · ${p.trigger_age_days}d ago`}
                          {p.trigger?.evidence_tier && ` · ${p.trigger.evidence_tier}`}
                          {p.powers?.length ? ` · ${p.powers.length} privileged power${p.powers.length === 1 ? '' : 's'}` : ''}
                        </p>
                      </div>
                    </button>

                    {open && (
                      <div className="px-4 pb-4 pl-12 space-y-4">
                        {/* Score breakdown */}
                        <div className="rounded-lg p-4" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <p className="text-xs font-semibold mb-3" style={{ color: 'rgb(150,155,180)' }}>
                            Score breakdown — computed from the dossier, not self-reported
                          </p>
                          {(Object.keys(COMPONENT_LABEL) as Array<keyof Breakdown>).map(k => (
                            <Bar key={k} label={COMPONENT_LABEL[k as string]} weight={WEIGHTS[k as string]} value={p.breakdown[k] as number} />
                          ))}
                          <div className="flex items-center justify-between text-xs pt-2 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <span style={{ color: 'rgb(150,155,180)' }}>
                              Weighted {p.breakdown.weighted_subtotal} − lock-in {p.breakdown.lock_in_penalty}
                            </span>
                            <span className="mono font-bold" style={{ color: tc.c }}>{p.breakdown.total}</span>
                          </div>
                          {p.breakdown.notes?.length > 0 && (
                            <ul className="mt-3 space-y-1">
                              {p.breakdown.notes.map((n, i) => (
                                <li key={i} className="text-xs" style={{ color: 'rgb(120,127,160)' }}>· {n}</li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* Powers */}
                        {p.powers && p.powers.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold mb-2" style={{ color: 'rgb(150,155,180)' }}>Privileged powers</p>
                            <div className="flex flex-wrap gap-1.5">
                              {p.powers.map((pw, i) => (
                                <span key={i} className="badge" style={{ color: '#38bdf8', background: 'rgba(56,189,248,0.08)', borderColor: 'rgba(56,189,248,0.2)' }}>{pw}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* The reverse-discovery chain: event -> authority -> gap
                            -> why now. Shown in that order because that is the
                            order the qualification actually happened in. */}
                        {(p.control_gap?.gap || p.why_now || p.authority_loss_scenario) && (
                          <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            {p.control_gap?.gap && (
                              <div>
                                <p className="text-xs font-semibold mb-1" style={{ color: 'rgb(150,155,180)' }}>
                                  Potential control gap
                                  <span className="badge ml-2" style={{
                                    color: p.control_gap.status === 'confirmed' ? '#34d399' : p.control_gap.status === 'inferred' ? '#fbbf24' : 'rgb(120,127,160)',
                                    background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)',
                                  }}>{p.control_gap.status}</span>
                                </p>
                                <p className="text-xs" style={{ color: 'rgb(180,185,205)' }}>{p.control_gap.gap}</p>
                                {p.control_gap.basis && (
                                  <p className="text-xs mt-1" style={{ color: 'rgb(120,127,160)' }}>Basis — {p.control_gap.basis}</p>
                                )}
                              </div>
                            )}
                            {p.gap_downgrades && p.gap_downgrades.length > 0 && (
                              <ul className="space-y-0.5">
                                {p.gap_downgrades.map((g, i) => (
                                  <li key={i} className="text-xs" style={{ color: '#fbbf24' }}>· {g}</li>
                                ))}
                              </ul>
                            )}
                            {p.authority_loss_scenario && (
                              <div>
                                <p className="text-xs font-semibold mb-1" style={{ color: 'rgb(150,155,180)' }}>If this authority were lost</p>
                                <p className="text-xs" style={{ color: 'rgb(180,185,205)' }}>{p.authority_loss_scenario}</p>
                              </div>
                            )}
                            {p.why_now && (
                              <div>
                                <p className="text-xs font-semibold mb-1" style={{ color: 'rgb(150,155,180)' }}>Why now</p>
                                <p className="text-xs" style={{ color: 'rgb(180,185,205)' }}>{p.why_now}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Why it did not pass */}
                        {(p.gate_failures?.length > 0 || p.rejections?.length > 0) && (
                          <div className="rounded-lg p-3" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.18)' }}>
                            {p.rejections?.length > 0 && (
                              <>
                                <p className="text-xs font-semibold mb-1" style={{ color: '#f87171' }}>Disqualified</p>
                                <ul className="space-y-0.5 mb-2">
                                  {p.rejections.map((r, i) => <li key={i} className="text-xs" style={{ color: 'rgb(180,150,155)' }}>· {r}</li>)}
                                </ul>
                              </>
                            )}
                            {p.gate_failures?.length > 0 && (
                              <>
                                <p className="text-xs font-semibold mb-1" style={{ color: '#fbbf24' }}>Missing approval requirements</p>
                                <ul className="space-y-0.5">
                                  {p.gate_failures.map((f, i) => <li key={i} className="text-xs" style={{ color: 'rgb(180,170,150)' }}>· {f}</li>)}
                                </ul>
                              </>
                            )}
                          </div>
                        )}

                        {/* Buyers */}
                        {p.buyers && p.buyers.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold mb-2" style={{ color: 'rgb(150,155,180)' }}>
                              Buyers <span style={{ color: 'rgb(100,105,130)' }}>· enriched only after qualifying</span>
                            </p>
                            <div className="space-y-1.5">
                              {p.buyers.map((b, i) => (
                                <div key={i} className="text-xs flex items-center gap-2 flex-wrap">
                                  <span className="text-white font-medium">{b.name}</span>
                                  <span style={{ color: 'rgb(150,155,180)' }}>{b.title}</span>
                                  {b.email && <span className="mono" style={{ color: '#34d399' }}>{b.email}</span>}
                                  <span className="badge" style={{ color: 'rgb(120,127,160)', background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>{b.source}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Outreach hypothesis */}
                        {p.hypothesis && (
                          <div className="rounded-lg p-4" style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.18)' }}>
                            <p className="text-xs font-semibold mb-2" style={{ color: '#34d399' }}>Outreach hypothesis</p>
                            <p className="text-xs mb-1.5" style={{ color: 'rgb(200,205,225)' }}>
                              <span style={{ color: 'rgb(120,127,160)' }}>Trigger — </span>{p.hypothesis.verified_trigger}
                            </p>
                            <p className="text-xs mb-1.5" style={{ color: 'rgb(200,205,225)' }}>
                              <span style={{ color: 'rgb(120,127,160)' }}>Authority implication — </span>{p.hypothesis.authority_implication}
                            </p>
                            <p className="text-xs" style={{ color: 'rgb(200,205,225)' }}>
                              <span style={{ color: 'rgb(120,127,160)' }}>Question — </span>{p.hypothesis.intelligent_question}
                            </p>
                          </div>
                        )}
                        {p.hypothesis_problems && p.hypothesis_problems.length > 0 && (
                          <div className="rounded-lg p-3" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)' }}>
                            <p className="text-xs font-semibold mb-1" style={{ color: '#fbbf24' }}>Hypothesis blocked — do not send</p>
                            <ul className="space-y-0.5">
                              {p.hypothesis_problems.map((h, i) => <li key={i} className="text-xs" style={{ color: 'rgb(180,170,150)' }}>· {h}</li>)}
                            </ul>
                          </div>
                        )}

                        {/* Links */}
                        <div className="flex items-center gap-3 flex-wrap text-xs">
                          {p.trigger?.evidence_url && (
                            <a href={p.trigger.evidence_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1" style={{ color: '#38bdf8' }}>
                              <ExternalLink size={11} /> Trigger evidence
                            </a>
                          )}
                          {p.website && (
                            <a href={p.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1" style={{ color: '#38bdf8' }}>
                              <ExternalLink size={11} /> {p.website.replace(/^https?:\/\//, '')}
                            </a>
                          )}
                          {p.lead_id && (
                            <a href={`/leads/${p.lead_id}`} className="flex items-center gap-1" style={{ color: '#34d399' }}>
                              <ExternalLink size={11} /> Open lead
                            </a>
                          )}
                          {p.insert_error && (
                            <span style={{ color: '#f87171' }}>Save failed: {p.insert_error}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
