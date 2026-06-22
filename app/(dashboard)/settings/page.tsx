'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Save, Key, Brain, MessageSquare, Check,
  ExternalLink, AlertTriangle, CheckCircle2, XCircle,
  Settings2, Database, Globe, Zap, Copy, RefreshCw,
  Shield, ChevronRight, Info, Activity, Clock, Wifi, WifiOff,
  AlertCircle, TrendingDown,
} from 'lucide-react'
import type { APIStatus, APIHealth } from '@/app/api/settings/api-health/route'

type AIProvider = 'claude' | 'openai'

interface HealthResult {
  anthropic:  APIHealth
  openai:     APIHealth
  hunter:     APIHealth
  exa:        APIHealth
  tavily:     APIHealth
  apollo:     APIHealth
  perplexity: APIHealth
  _cached?:   boolean
  _age_s?:    number
}

const MODEL_INFO: Record<AIProvider, { label: string; subLabel: string; desc: string; color: string; models: string[] }> = {
  claude: {
    label: 'Claude', subLabel: 'Anthropic',
    desc: 'Deeper reasoning, nuanced pain-point extraction, better at reading tech stacks. Default for all research tasks.',
    color: '#a78bfa', models: ['claude-opus-4-8 (research)', 'claude-haiku-4-5 (fast tasks)'],
  },
  openai: {
    label: 'GPT-4o', subLabel: 'OpenAI',
    desc: 'Natural tone, message variation and conversational drafting. Recommended for outreach copy.',
    color: '#34d399', models: ['gpt-4o (drafting)', 'gpt-4o-mini (light tasks)'],
  },
}

const API_CFG: {
  key: keyof Omit<HealthResult, '_cached' | '_age_s'>
  label: string
  envKey: string
  color: string
  link: string
  critical: boolean
  desc: string
}[] = [
  { key: 'anthropic', label: 'Anthropic (Claude)',  envKey: 'ANTHROPIC_API_KEY', color: '#a78bfa', link: 'https://console.anthropic.com/settings/keys',  critical: true,  desc: 'Research, enrichment, outreach AI' },
  { key: 'openai',    label: 'OpenAI (GPT-4o)',     envKey: 'OPENAI_API_KEY',    color: '#34d399', link: 'https://platform.openai.com/api-keys',          critical: true,  desc: 'Message drafting, co-pilot' },
  { key: 'exa',       label: 'Exa',                 envKey: 'EXA_API_KEY',       color: '#38bdf8', link: 'https://dashboard.exa.ai',                      critical: false, desc: 'Lead search & discovery' },
  { key: 'tavily',    label: 'Tavily',               envKey: 'TAVILY_API_KEY',    color: '#fbbf24', link: 'https://tavily.com',                            critical: false, desc: 'Web search & research' },
  { key: 'apollo',      label: 'Apollo',               envKey: 'APOLLO_API_KEY',      color: '#fb923c', link: 'https://developer.apollo.io',                    critical: false, desc: 'Contact enrichment & email' },
  { key: 'hunter',      label: 'Hunter.io',            envKey: 'HUNTER_API_KEY',      color: '#f472b6', link: 'https://hunter.io/api-keys',                     critical: false, desc: 'Email finder by domain' },
  { key: 'perplexity',  label: 'Perplexity (Sonar)',   envKey: 'PERPLEXITY_API_KEY',  color: '#818cf8', link: 'https://www.perplexity.ai/settings/api',           critical: false, desc: 'Real-time web research with citations' },
]

const STATUS_CFG: Record<APIStatus, { label: string; color: string; bg: string; border: string; icon: typeof CheckCircle2 }> = {
  ok:             { label: 'OK',            color: 'rgb(52,211,153)',   bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.3)',   icon: CheckCircle2 },
  not_configured: { label: 'Not set',       color: 'rgb(100,107,140)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', icon: AlertCircle },
  unauthorized:   { label: 'Invalid key',   color: 'rgb(248,113,133)', bg: 'rgba(248,113,133,0.1)',  border: 'rgba(248,113,133,0.3)',  icon: XCircle },
  exhausted:      { label: 'Exhausted',     color: 'rgb(251,146,60)',  bg: 'rgba(251,146,60,0.1)',   border: 'rgba(251,146,60,0.3)',   icon: TrendingDown },
  rate_limited:   { label: 'Low / limited', color: 'rgb(251,191,36)',  bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.25)',  icon: AlertTriangle },
  error:          { label: 'Error',         color: 'rgb(248,113,133)', bg: 'rgba(248,113,133,0.08)', border: 'rgba(248,113,133,0.2)',  icon: WifiOff },
}

const QUICK_LINKS = [
  { label: 'Supabase Dashboard',  url: 'https://supabase.com/dashboard/project/wwjhtpizwxwsovzjdrog',        icon: Database },
  { label: 'Supabase SQL Editor', url: 'https://supabase.com/dashboard/project/wwjhtpizwxwsovzjdrog/sql',    icon: Database },
  { label: 'Anthropic Console',   url: 'https://console.anthropic.com',                                        icon: Brain },
  { label: 'OpenAI API Keys',     url: 'https://platform.openai.com/api-keys',                                icon: Key },
  { label: 'Exa Dashboard',       url: 'https://dashboard.exa.ai',                                            icon: Globe },
  { label: 'Vercel Deployments',  url: 'https://vercel.com/dashboard',                                        icon: Zap },
]

function StatusBadge({ status }: { status: APIStatus }) {
  const cfg = STATUS_CFG[status]
  const Icon = cfg.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, flexShrink: 0 }}>
      <Icon size={11} />{cfg.label}
    </span>
  )
}

function CreditBar({ credits }: { credits: { used: number; available: number } }) {
  const pct = Math.min(100, Math.round((credits.used / credits.available) * 100))
  const color = pct >= 100 ? 'rgb(248,113,133)' : pct >= 85 ? 'rgb(251,146,60)' : pct >= 60 ? 'rgb(251,191,36)' : 'rgb(52,211,153)'
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.5s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 10, color: 'rgb(80,87,120)' }}>{credits.used} used</span>
        <span style={{ fontSize: 10, color: 'rgb(80,87,120)' }}>{credits.available} total</span>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [researchAI, setResearchAI]   = useState<AIProvider>('claude')
  const [draftingAI, setDraftingAI]   = useState<AIProvider>('openai')
  const [health, setHealth]           = useState<HealthResult | null>(null)
  const [checking, setChecking]       = useState(false)
  const [checkedAt, setCheckedAt]     = useState<Date | null>(null)
  const [copiedKey, setCopiedKey]     = useState<string | null>(null)
  const [prefsSaved, setPrefsSaved]   = useState(false)
  const [activityLog, setActivityLog] = useState(false)

  const fetchHealth = useCallback(async (force = false) => {
    setChecking(true)
    try {
      const res = await fetch(`/api/settings/api-health${force ? '?force=1' : ''}`)
      if (res.ok) {
        const data: HealthResult = await res.json()
        setHealth(data)
        setCheckedAt(new Date())
        // Persist broken status to localStorage for sidebar badge
        const broken = API_CFG
          .filter(c => data[c.key]?.status !== 'ok' && data[c.key]?.status !== 'not_configured')
          .map(c => c.label)
        localStorage.setItem('bd_api_issues', JSON.stringify(broken))
        window.dispatchEvent(new CustomEvent('bd_api_health_update', { detail: { broken } }))
      }
    } catch {
      toast.error('Health check failed — check your network')
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    const r = localStorage.getItem('bd_research_ai') as AIProvider | null
    const d = localStorage.getItem('bd_drafting_ai') as AIProvider | null
    if (r === 'claude' || r === 'openai') setResearchAI(r)
    if (d === 'claude' || d === 'openai') setDraftingAI(d)
    setActivityLog(localStorage.getItem('bd_show_activity_log') === 'true')
    fetchHealth(false)
  }, [fetchHealth])

  const toggleActivityLog = (val: boolean) => {
    setActivityLog(val)
    localStorage.setItem('bd_show_activity_log', val ? 'true' : 'false')
    window.dispatchEvent(new Event('bd_activity_log_toggle'))
    toast.success(val ? 'Agent Activity Log enabled' : 'Agent Activity Log hidden')
  }

  const saveModelPrefs = () => {
    localStorage.setItem('bd_research_ai', researchAI)
    localStorage.setItem('bd_drafting_ai', draftingAI)
    setPrefsSaved(true)
    toast.success('AI model preferences saved')
    setTimeout(() => setPrefsSaved(false), 2000)
  }

  const copyEnvTemplate = () => {
    const t = `# Kima BD OS — Environment Variables
NEXT_PUBLIC_SUPABASE_URL=https://wwjhtpizwxwsovzjdrog.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
EXA_API_KEY=your_exa_key
TAVILY_API_KEY=tvly-...
APOLLO_API_KEY=your_apollo_key
HUNTER_API_KEY=your_hunter_key
PERPLEXITY_API_KEY=pplx-...
NEXT_PUBLIC_APP_URL=http://localhost:3000`
    navigator.clipboard.writeText(t)
    setCopiedKey('template')
    toast.success('Template copied to clipboard')
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // Compute issues for the alert banner
  const brokenAPIs = health
    ? API_CFG.filter(c => {
        const s = health[c.key]?.status
        return s && s !== 'ok' && s !== 'not_configured'
      })
    : []
  const criticalBroken = brokenAPIs.filter(c => c.critical)

  return (
    <div className="fade-in">
      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2">
              <Settings2 size={18} style={{ color: '#a78bfa' }} />
              Settings
            </h1>
            <p style={{ fontSize: 12, marginTop: 4, color: 'rgb(100,106,135)', fontWeight: 500 }}>
              API health, keys, AI model preferences, and tool configuration
            </p>
          </div>
          <button onClick={() => fetchHealth(true)} disabled={checking}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgb(160,165,195)' }}>
            <RefreshCw size={12} style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }} />
            {checking ? 'Checking…' : 'Re-check all APIs'}
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 32px', width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Critical broken banner ────────────────────────── */}
        {criticalBroken.length > 0 && (
          <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(248,113,133,0.06)', border: '1px solid rgba(248,113,133,0.3)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <XCircle size={16} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171', marginBottom: 4 }}>
                Critical API broken — some features will fail
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {criticalBroken.map(c => (
                  <div key={c.key} style={{ fontSize: 12, color: 'rgb(200,150,150)' }}>
                    <span style={{ fontWeight: 600 }}>{c.label}</span>
                    <span style={{ color: 'rgb(160,120,120)' }}> — {health![c.key].detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Non-critical issues banner */}
        {brokenAPIs.length > criticalBroken.length && (
          <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(251,146,60,0.05)', border: '1px solid rgba(251,146,60,0.25)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <AlertTriangle size={14} style={{ color: '#fb923c', flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fb923c', marginBottom: 3 }}>
                {brokenAPIs.filter(c => !c.critical).length} supporting API{brokenAPIs.filter(c => !c.critical).length > 1 ? 's' : ''} have issues
              </div>
              <div style={{ fontSize: 11, color: 'rgb(180,140,90)', lineHeight: 1.6 }}>
                {brokenAPIs.filter(c => !c.critical).map(c => (
                  <span key={c.key}><span style={{ fontWeight: 600 }}>{c.label}</span>: {health![c.key].detail} · </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── API Health ────────────────────────────────────── */}
        <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wifi size={13} style={{ color: '#a78bfa' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>API Health</span>
            {health && !checking && (
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgb(80,87,120)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={10} />
                {health._cached ? `cached · ${health._age_s}s ago` : `checked at ${checkedAt?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
              </span>
            )}
            {checking && (
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgb(167,139,250)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} />Checking…
              </span>
            )}
          </div>

          <div style={{ padding: '8px 0' }}>
            {API_CFG.map((cfg, i) => {
              const apiHealth = health?.[cfg.key]
              const status = apiHealth?.status ?? 'not_configured'
              const StatusIcon = STATUS_CFG[status].icon
              const statusCfg = STATUS_CFG[status]
              const isLast = i === API_CFG.length - 1

              return (
                <div key={cfg.key}
                  style={{ padding: '12px 18px', borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.035)', background: (status === 'exhausted' || status === 'unauthorized') ? 'rgba(248,113,133,0.02)' : status === 'rate_limited' ? 'rgba(251,191,36,0.02)' : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {/* Status icon */}
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <StatusIcon size={13} style={{ color: statusCfg.color }} />
                    </div>

                    {/* Label + detail */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: status === 'not_configured' ? 'rgb(100,107,140)' : 'white' }}>
                          {cfg.label}
                        </span>
                        {cfg.critical && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'rgb(160,165,195)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            required
                          </span>
                        )}
                        <StatusBadge status={status} />
                      </div>

                      <div style={{ fontSize: 11, color: status === 'ok' ? 'rgb(100,140,100)' : status === 'exhausted' || status === 'unauthorized' ? 'rgb(200,130,130)' : status === 'rate_limited' ? 'rgb(200,170,100)' : 'rgb(100,107,140)', lineHeight: 1.5 }}>
                        {apiHealth?.detail ?? '—'}
                      </div>

                      <div style={{ fontSize: 10, color: 'rgb(70,77,110)', marginTop: 2 }}>{cfg.desc}</div>

                      {/* Credit bar for Hunter */}
                      {apiHealth?.credits && <CreditBar credits={apiHealth.credits} />}
                    </div>

                    {/* Action */}
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {(status === 'exhausted' || status === 'unauthorized' || status === 'not_configured') && (
                        <a href={cfg.link} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 7, border: `1px solid ${cfg.color}33`, background: `${cfg.color}10`, color: cfg.color, textDecoration: 'none' }}>
                          {status === 'exhausted' ? 'Add credits' : status === 'unauthorized' ? 'Replace key' : 'Get key'}
                          <ExternalLink size={9} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer note */}
          <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={11} style={{ color: 'rgb(80,87,120)', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'rgb(80,87,120)', lineHeight: 1.5 }}>
              Results are cached for 5 minutes — click &quot;Re-check all APIs&quot; to force a fresh check. Exa and Tavily checks each consume 1 credit.
            </span>
          </div>
        </div>

        {/* ── .env.local setup ──────────────────────────────── */}
        <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Key size={13} style={{ color: '#a78bfa' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Environment Setup</span>
          </div>
          <div style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 12, color: 'rgb(140,147,180)', lineHeight: 1.6, marginBottom: 10 }}>
              Add keys to{' '}
              <code style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.12)', padding: '1px 5px', borderRadius: 3 }}>.env.local</code>
              {' '}in your project root, then restart the dev server. Keys are never exposed to the browser.
            </div>
            <button onClick={copyEnvTemplate}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 7, cursor: 'pointer', border: '1px solid rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.07)', color: '#a78bfa' }}>
              {copiedKey === 'template' ? <Check size={11} /> : <Copy size={11} />}
              {copiedKey === 'template' ? 'Copied!' : 'Copy .env.local template'}
            </button>
          </div>
        </div>

        {/* ── AI Model Preferences ──────────────────────────── */}
        <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={13} style={{ color: '#a78bfa' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>AI Model Preferences</span>
            <span style={{ marginLeft: 8, fontSize: 11, color: 'rgb(110,117,150)' }}>Saved locally — not synced across devices</span>
          </div>
          <div style={{ padding: '18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            {([
              { task: 'research' as const, label: 'Research & Lead Discovery', icon: Brain, desc: 'Used when the agent fetches new leads, analyses companies, runs hack-monitor, generates weekly reports.' },
              { task: 'drafting' as const, label: 'Message Drafting',          icon: MessageSquare, desc: 'Used when generating outreach emails, LinkedIn messages, and follow-up sequences.' },
            ]).map(({ task, label, icon: Icon, desc }) => {
              const current   = task === 'research' ? researchAI : draftingAI
              const setter    = task === 'research' ? setResearchAI : setDraftingAI
              const defaultV: AIProvider = task === 'research' ? 'claude' : 'openai'
              return (
                <div key={task}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Icon size={12} style={{ color: 'rgb(140,147,180)' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{label}</span>
                    {current === defaultV && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>recommended</span>}
                  </div>
                  <p style={{ fontSize: 11, color: 'rgb(110,117,150)', marginBottom: 10, lineHeight: 1.5 }}>{desc}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(['claude', 'openai'] as AIProvider[]).map(provider => {
                      const info   = MODEL_INFO[provider]
                      const active = current === provider
                      return (
                        <button key={provider} onClick={() => setter(provider)}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s', border: `1px solid ${active ? info.color + '50' : 'rgba(255,255,255,0.07)'}`, background: active ? info.color + '10' : 'rgba(255,255,255,0.02)' }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${active ? info.color : 'rgba(255,255,255,0.2)'}`, background: active ? info.color : 'transparent', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: active ? info.color : 'rgb(180,185,215)' }}>{info.label}</span>
                              <span style={{ fontSize: 10, color: 'rgb(100,107,140)' }}>by {info.subLabel}</span>
                            </div>
                            <p style={{ fontSize: 11, color: 'rgb(110,117,150)', margin: 0, lineHeight: 1.4 }}>{info.desc}</p>
                            <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                              {info.models.map(m => (
                                <span key={m} style={{ fontSize: 9, fontFamily: 'monospace', padding: '1px 6px', borderRadius: 4, background: active ? info.color + '15' : 'rgba(255,255,255,0.05)', color: active ? info.color : 'rgb(100,107,140)', border: `1px solid ${active ? info.color + '25' : 'rgba(255,255,255,0.07)'}` }}>{m}</span>
                              ))}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, color: 'rgb(100,107,140)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Info size={11} />Both models share the same saved research — switching doesn&apos;t lose any data
            </div>
            <button onClick={saveModelPrefs}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: prefsSaved ? '1px solid rgba(52,211,153,0.4)' : '1px solid rgba(167,139,250,0.3)', background: prefsSaved ? 'rgba(52,211,153,0.1)' : 'rgba(167,139,250,0.1)', color: prefsSaved ? '#34d399' : '#a78bfa', transition: 'all 0.2s' }}>
              {prefsSaved ? <Check size={13} /> : <Save size={13} />}
              {prefsSaved ? 'Saved!' : 'Save preferences'}
            </button>
          </div>
        </div>

        {/* ── Bottom row ────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Developer tools */}
          <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={13} style={{ color: '#a78bfa' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Developer Tools</span>
            </div>
            <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Activity size={12} style={{ color: activityLog ? '#a78bfa' : 'rgb(100,107,140)' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: activityLog ? 'white' : 'rgb(160,165,195)' }}>Agent Activity Log</span>
                  {activityLog && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>on</span>}
                </div>
                <p style={{ fontSize: 11, color: 'rgb(100,107,140)', margin: 0, lineHeight: 1.5 }}>
                  Floating panel showing every API call the agent makes — Claude, Apollo, Hunter, Exa — with real-time status and timing.
                </p>
              </div>
              <button onClick={() => toggleActivityLog(!activityLog)}
                style={{ flexShrink: 0, width: 44, height: 24, borderRadius: 12, cursor: 'pointer', border: 'none', padding: 0, position: 'relative', transition: 'background 0.2s', background: activityLog ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.1)' }}>
                <span style={{ position: 'absolute', top: 2, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s', left: activityLog ? 22 : 2 }} />
              </button>
            </div>
          </div>

          {/* Quick Links */}
          <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe size={13} style={{ color: '#38bdf8' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Quick Links</span>
            </div>
            <div style={{ padding: '4px 0' }}>
              {QUICK_LINKS.map(({ label, url, icon: Icon }) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px', textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.035)', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Icon size={12} style={{ color: 'rgb(100,107,140)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'rgb(190,195,220)', flex: 1 }}>{label}</span>
                  <ChevronRight size={12} style={{ color: 'rgb(80,87,120)' }} />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ── Supabase + About ──────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={13} style={{ color: '#38bdf8' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Supabase</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#34d399' }}>Connected</span>
            </div>
            <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Project ID', value: 'wwjhtpizwxwsovzjdrog' },
                { label: 'Region',     value: 'ap-south-1 (Mumbai)' },
                { label: 'URL',        value: 'wwjhtpizwxwsovzjdrog.supabase.co' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'rgb(110,117,150)' }}>{row.label}</span>
                  <span style={{ fontSize: 11, color: 'rgb(190,195,220)', fontFamily: 'monospace' }}>{row.value}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8 }}>
              <a href="https://supabase.com/dashboard/project/wwjhtpizwxwsovzjdrog" target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '5px 11px', borderRadius: 7, border: '1px solid rgba(56,189,248,0.2)', background: 'rgba(56,189,248,0.06)', color: '#38bdf8', textDecoration: 'none' }}>
                Dashboard <ExternalLink size={9} />
              </a>
              <a href="https://supabase.com/dashboard/project/wwjhtpizwxwsovzjdrog/sql" target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '5px 11px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'rgb(160,165,195)', textDecoration: 'none' }}>
                SQL Editor <ExternalLink size={9} />
              </a>
            </div>
          </div>

          <div style={{ borderRadius: 14, border: '1px solid rgba(167,139,250,0.12)', background: 'rgba(167,139,250,0.04)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(167,139,250,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={13} style={{ color: '#a78bfa' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>About Kima BD OS</span>
            </div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12, color: 'rgb(140,150,185)', lineHeight: 1.6, margin: 0 }}>
                Private internal BD tool for Arpit to manage Kima and Aeredium business development.
                All data lives in a private Supabase instance — nothing is shared externally.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'Research AI', value: `Claude Opus 4.8 (${researchAI === 'claude' ? 'active' : 'GPT-4o overriding'})` },
                  { label: 'Drafting AI', value: `GPT-4o (${draftingAI === 'openai' ? 'active' : 'Claude overriding'})` },
                  { label: 'Data store',  value: 'Private Supabase (Postgres)' },
                  { label: 'Deployment',  value: 'Vercel · Edge Runtime' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'rgb(100,107,140)' }}>{row.label}</span>
                    <span style={{ fontSize: 11, color: 'rgb(180,185,215)' }}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>Kima BD OS</div>
                  <div style={{ fontSize: 10, color: 'rgb(100,107,140)', marginTop: 2 }}>Built by Antigravity · v2.0</div>
                </div>
                <a href="https://github.com/arpitrajput007/kima-bd-os" target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '5px 11px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'rgb(160,165,195)', textDecoration: 'none' }}>
                  GitHub <ExternalLink size={9} />
                </a>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
