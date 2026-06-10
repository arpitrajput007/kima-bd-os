'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Save, Eye, EyeOff, Key, Brain, MessageSquare, Check,
  ExternalLink, AlertTriangle, CheckCircle2, XCircle,
  Settings2, Database, Globe, Zap, Copy, RefreshCw,
  Shield, ChevronRight, Info, Activity,
} from 'lucide-react'

type AIProvider = 'claude' | 'openai'

interface EnvStatus {
  anthropic: boolean
  openai: boolean
  supabase: boolean
  tavily: boolean
  exa: boolean
  apollo: boolean
  hunter: boolean
}

const MODEL_INFO: Record<AIProvider, {
  label: string
  subLabel: string
  desc: string
  color: string
  models: string[]
}> = {
  claude: {
    label: 'Claude',
    subLabel: 'Anthropic',
    desc: 'Deeper reasoning, nuanced pain-point extraction, better at reading tech stacks. Default for all research tasks.',
    color: '#a78bfa',
    models: ['claude-opus-4-5 (research)', 'claude-sonnet-4-5 (fast tasks)'],
  },
  openai: {
    label: 'GPT-4o',
    subLabel: 'OpenAI',
    desc: 'Natural tone, message variation and conversational drafting. Recommended for outreach copy.',
    color: '#34d399',
    models: ['gpt-4o (drafting)', 'gpt-4o-mini (light tasks)'],
  },
}

const ENV_VARS = [
  { key: 'ANTHROPIC_API_KEY',  label: 'Anthropic (Claude)',  link: 'https://console.anthropic.com/settings/keys',  color: '#a78bfa', statusKey: 'anthropic' as keyof EnvStatus, critical: true },
  { key: 'OPENAI_API_KEY',     label: 'OpenAI (GPT-4o)',     link: 'https://platform.openai.com/api-keys',          color: '#34d399', statusKey: 'openai'    as keyof EnvStatus, critical: true },
  { key: 'EXA_API_KEY',        label: 'Exa (lead search)',   link: 'https://dashboard.exa.ai',                      color: '#38bdf8', statusKey: 'exa'       as keyof EnvStatus, critical: false },
  { key: 'TAVILY_API_KEY',     label: 'Tavily (web search)', link: 'https://tavily.com',                            color: '#fbbf24', statusKey: 'tavily'    as keyof EnvStatus, critical: false },
  { key: 'APOLLO_API_KEY',     label: 'Apollo (enrichment)', link: 'https://developer.apollo.io',                   color: '#fb923c', statusKey: 'apollo'    as keyof EnvStatus, critical: false },
  { key: 'HUNTER_API_KEY',     label: 'Hunter (email)',      link: 'https://hunter.io/api-keys',                    color: '#f472b6', statusKey: 'hunter'    as keyof EnvStatus, critical: false },
]

const QUICK_LINKS = [
  { label: 'Supabase Dashboard',       url: 'https://supabase.com/dashboard/project/wwjhtpizwxwsovzjdrog',            icon: Database },
  { label: 'Supabase SQL Editor',      url: 'https://supabase.com/dashboard/project/wwjhtpizwxwsovzjdrog/sql',        icon: Database },
  { label: 'Anthropic Console',        url: 'https://console.anthropic.com',                                          icon: Brain },
  { label: 'OpenAI API Keys',          url: 'https://platform.openai.com/api-keys',                                   icon: Key },
  { label: 'Exa Dashboard',            url: 'https://dashboard.exa.ai',                                               icon: Globe },
  { label: 'Vercel Deployments',       url: 'https://vercel.com/dashboard',                                           icon: Zap },
]

export default function SettingsPage() {
  const [researchAI, setResearchAI]     = useState<AIProvider>('claude')
  const [draftingAI, setDraftingAI]     = useState<AIProvider>('openai')
  const [envStatus, setEnvStatus]       = useState<EnvStatus | null>(null)
  const [checking, setChecking]         = useState(false)
  const [copiedKey, setCopiedKey]       = useState<string | null>(null)
  const [prefsSaved, setPrefsSaved]     = useState(false)
  const [activityLog, setActivityLog]   = useState(false)

  useEffect(() => {
    const r = localStorage.getItem('bd_research_ai') as AIProvider | null
    const d = localStorage.getItem('bd_drafting_ai') as AIProvider | null
    if (r === 'claude' || r === 'openai') setResearchAI(r)
    if (d === 'claude' || d === 'openai') setDraftingAI(d)
    setActivityLog(localStorage.getItem('bd_show_activity_log') === 'true')
    checkEnvStatus()
  }, [])

  const toggleActivityLog = (val: boolean) => {
    setActivityLog(val)
    localStorage.setItem('bd_show_activity_log', val ? 'true' : 'false')
    window.dispatchEvent(new Event('bd_activity_log_toggle'))
    toast.success(val ? 'Agent Activity Log enabled' : 'Agent Activity Log hidden')
  }

  const checkEnvStatus = async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/settings/env-check')
      if (res.ok) {
        const data = await res.json()
        setEnvStatus(data)
      }
    } catch {
      // silently fail — env check is optional
    } finally {
      setChecking(false)
    }
  }

  const saveModelPrefs = () => {
    localStorage.setItem('bd_research_ai', researchAI)
    localStorage.setItem('bd_drafting_ai', draftingAI)
    setPrefsSaved(true)
    toast.success('AI model preferences saved')
    setTimeout(() => setPrefsSaved(false), 2000)
  }

  const copyEnvTemplate = () => {
    const template = `# Kima BD OS — Environment Variables
NEXT_PUBLIC_SUPABASE_URL=https://wwjhtpizwxwsovzjdrog.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
EXA_API_KEY=your_exa_key
TAVILY_API_KEY=tvly-...
APOLLO_API_KEY=your_apollo_key
HUNTER_API_KEY=your_hunter_key
NEXT_PUBLIC_APP_URL=http://localhost:3000`
    navigator.clipboard.writeText(template)
    setCopiedKey('template')
    toast.success('Template copied to clipboard')
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const missingCritical = ENV_VARS.filter(v => v.critical && envStatus && !envStatus[v.statusKey])

  return (
    <div className="fade-in">

      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2">
              <Settings2 size={18} style={{ color: '#a78bfa' }} />
              Settings
            </h1>
            <p style={{ fontSize: 12, marginTop: 4, color: 'rgb(100,106,135)', fontWeight: 500 }}>
              API keys, AI model preferences, and tool configuration
            </p>
          </div>
          <button
            onClick={checkEnvStatus}
            disabled={checking}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgb(160,165,195)' }}
          >
            <RefreshCw size={12} style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }} />
            {checking ? 'Checking…' : 'Refresh status'}
          </button>
        </div>
      </div>
      <div style={{ padding: '16px 32px', width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Critical warning banner ─────────────────────────────────── */}
        {missingCritical.length > 0 && (
          <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <AlertTriangle size={14} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', marginBottom: 3 }}>
                Missing critical API keys — some features will not work
              </div>
              <div style={{ fontSize: 11, color: 'rgb(180,160,100)' }}>
                {missingCritical.map(v => v.label).join(', ')} {missingCritical.length === 1 ? 'key is' : 'keys are'} not configured.
                Add {missingCritical.length === 1 ? 'it' : 'them'} to your <code style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.1)', padding: '1px 5px', borderRadius: 3 }}>.env.local</code> file and restart the dev server.
              </div>
            </div>
          </div>
        )}

        {/* ── Two-column layout ───────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* LEFT: API Key Status */}
          <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Key size={13} style={{ color: '#a78bfa' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>API Key Status</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {envStatus && (
                  <span style={{ fontSize: 10, color: 'rgb(120,127,160)' }}>
                    {Object.values(envStatus).filter(Boolean).length}/{Object.keys(envStatus).length} configured
                  </span>
                )}
              </div>
            </div>
            <div style={{ padding: '8px 0' }}>
              {ENV_VARS.map(v => {
                const isOk = envStatus ? envStatus[v.statusKey] : null
                return (
                  <div key={v.key}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 18px', borderBottom: '1px solid rgba(255,255,255,0.035)' }}>
                    {/* Status icon */}
                    <div style={{ flexShrink: 0 }}>
                      {isOk === null ? (
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                      ) : isOk ? (
                        <CheckCircle2 size={16} style={{ color: '#34d399' }} />
                      ) : (
                        <XCircle size={16} style={{ color: v.critical ? '#f87171' : '#6b7280' }} />
                      )}
                    </div>

                    {/* Label */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: isOk ? 'white' : 'rgb(140,147,180)' }}>
                          {v.label}
                        </span>
                        {v.critical && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'rgb(160,165,195)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            required
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: 'rgb(100,107,140)', fontFamily: 'monospace' }}>{v.key}</span>
                    </div>

                    {/* Get key link */}
                    {!isOk && (
                      <a href={v.link} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: v.color, textDecoration: 'none', flexShrink: 0 }}>
                        Get key <ExternalLink size={9} />
                      </a>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Setup instructions */}
            <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(167,139,250,0.04)' }}>
              <div style={{ fontSize: 11, color: 'rgb(140,147,180)', lineHeight: 1.6, marginBottom: 8 }}>
                Add keys to{' '}
                <code style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.12)', padding: '1px 5px', borderRadius: 3 }}>.env.local</code>
                {' '}in your project root, then restart the dev server.
              </div>
              <button onClick={copyEnvTemplate}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '5px 11px', borderRadius: 7, cursor: 'pointer', border: '1px solid rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.07)', color: '#a78bfa' }}>
                {copiedKey === 'template' ? <Check size={11} /> : <Copy size={11} />}
                {copiedKey === 'template' ? 'Copied!' : 'Copy .env.local template'}
              </button>
            </div>
          </div>

          {/* RIGHT: Claude debug info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Claude API Status card */}
            <div style={{ borderRadius: 14, border: `1px solid ${envStatus?.anthropic ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`, background: envStatus?.anthropic ? 'rgba(52,211,153,0.04)' : 'rgba(248,113,113,0.04)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${envStatus?.anthropic ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Brain size={13} style={{ color: envStatus?.anthropic ? '#34d399' : '#f87171' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Claude (Research AI)</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: envStatus?.anthropic ? '#34d399' : '#f87171' }}>
                  {envStatus?.anthropic ? 'Connected' : 'Not configured'}
                </span>
              </div>
              <div style={{ padding: '14px 18px' }}>
                {!envStatus?.anthropic ? (
                  <div style={{ fontSize: 12, lineHeight: 1.7, color: 'rgb(180,130,120)' }}>
                    <div style={{ fontWeight: 600, color: '#f87171', marginBottom: 6 }}>Why research/discover isn&apos;t fetching leads:</div>
                    <ol style={{ paddingLeft: 16, margin: 0, color: 'rgb(160,140,130)' }}>
                      <li>Claude is used for lead discovery, research, and weekly reports</li>
                      <li><code style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.1)', padding: '1px 4px', borderRadius: 3 }}>ANTHROPIC_API_KEY</code> is missing from .env.local</li>
                      <li>Go to{' '}
                        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa' }}>
                          console.anthropic.com
                        </a>
                        {' '}→ get your API key</li>
                      <li>Add it to .env.local and restart <code style={{ color: '#34d399' }}>npm run dev</code></li>
                    </ol>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, lineHeight: 1.7, color: 'rgb(140,160,140)' }}>
                    <div style={{ fontWeight: 600, color: '#34d399', marginBottom: 6 }}>Claude is ready</div>
                    <div style={{ color: 'rgb(140,150,140)' }}>
                      Models in use:
                      <ul style={{ paddingLeft: 14, margin: '4px 0 0', color: 'rgb(120,130,120)' }}>
                        <li>claude-opus-4-5 — deep research & analysis</li>
                        <li>claude-sonnet-4-5 — fast extraction tasks</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
              {!envStatus?.anthropic && (
                <div style={{ padding: '10px 18px', borderTop: `1px solid rgba(248,113,113,0.1)` }}>
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.08)', color: '#a78bfa', textDecoration: 'none' }}>
                    Get Anthropic API Key <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </div>

            {/* Supabase status */}
            <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database size={13} style={{ color: '#38bdf8' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Supabase</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#34d399' }}>Connected</span>
              </div>
              <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'Project ID', value: 'wwjhtpizwxwsovzjdrog' },
                  { label: 'Region', value: 'ap-south-1 (Mumbai)' },
                  { label: 'URL', value: 'wwjhtpizwxwsovzjdrog.supabase.co' },
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

          </div>
        </div>

        {/* ── AI Model Preferences ─────────────────────────────────────── */}
        <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={13} style={{ color: '#a78bfa' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>AI Model Preferences</span>
            <span style={{ marginLeft: 8, fontSize: 11, color: 'rgb(110,117,150)' }}>
              Saved locally in browser — not synced across devices
            </span>
          </div>

          <div style={{ padding: '18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

            {/* Research preference */}
            {([
              { task: 'research' as const, label: 'Research & Lead Discovery', icon: Brain, desc: 'Used when the agent fetches new leads, analyses companies, runs hack-monitor, generates weekly reports.' },
              { task: 'drafting' as const, label: 'Message Drafting',          icon: MessageSquare, desc: 'Used when generating outreach emails, LinkedIn messages, and follow-up sequences.' },
            ]).map(({ task, label, icon: Icon, desc }) => {
              const current = task === 'research' ? researchAI : draftingAI
              const setter  = task === 'research' ? setResearchAI : setDraftingAI
              const defaultVal: AIProvider = task === 'research' ? 'claude' : 'openai'

              return (
                <div key={task}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Icon size={12} style={{ color: 'rgb(140,147,180)' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{label}</span>
                    {current === defaultVal && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
                        recommended
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: 'rgb(110,117,150)', marginBottom: 10, lineHeight: 1.5 }}>{desc}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(['claude', 'openai'] as AIProvider[]).map(provider => {
                      const info = MODEL_INFO[provider]
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
                                <span key={m} style={{ fontSize: 9, fontFamily: 'monospace', padding: '1px 6px', borderRadius: 4, background: active ? info.color + '15' : 'rgba(255,255,255,0.05)', color: active ? info.color : 'rgb(100,107,140)', border: `1px solid ${active ? info.color + '25' : 'rgba(255,255,255,0.07)'}` }}>
                                  {m}
                                </span>
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
              <Info size={11} />
              Both models share the same saved research — switching doesn&apos;t lose any data
            </div>
            <button onClick={saveModelPrefs}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: prefsSaved ? '1px solid rgba(52,211,153,0.4)' : '1px solid rgba(167,139,250,0.3)', background: prefsSaved ? 'rgba(52,211,153,0.1)' : 'rgba(167,139,250,0.1)', color: prefsSaved ? '#34d399' : '#a78bfa', transition: 'all 0.2s' }}>
              {prefsSaved ? <Check size={13} /> : <Save size={13} />}
              {prefsSaved ? 'Saved!' : 'Save preferences'}
            </button>
          </div>
        </div>

        {/* ── Developer Tools ──────────────────────────────────────────── */}
        <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={13} style={{ color: '#a78bfa' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Developer Tools</span>
          </div>
          <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Activity size={12} style={{ color: activityLog ? '#a78bfa' : 'rgb(100,107,140)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: activityLog ? 'white' : 'rgb(160,165,195)' }}>
                  Agent Activity Log
                </span>
                {activityLog && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
                    on
                  </span>
                )}
              </div>
              <p style={{ fontSize: 11, color: 'rgb(100,107,140)', margin: 0, lineHeight: 1.5 }}>
                Show a floating panel that logs every API call the BD agent makes — Claude, Apollo, Hunter, Exa — with real-time status and timing. Useful for debugging and understanding tool usage.
              </p>
            </div>
            {/* Toggle switch */}
            <button
              onClick={() => toggleActivityLog(!activityLog)}
              style={{
                flexShrink: 0, width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                border: 'none', padding: 0, position: 'relative', transition: 'background 0.2s',
                background: activityLog ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.1)',
              }}
            >
              <span style={{
                position: 'absolute', top: 2, width: 20, height: 20, borderRadius: '50%',
                background: 'white', transition: 'left 0.2s',
                left: activityLog ? 22 : 2,
              }} />
            </button>
          </div>
        </div>

        {/* ── Quick Links + About — side by side ───────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Quick Links */}
          <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe size={13} style={{ color: '#38bdf8' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Quick Links</span>
            </div>
            <div style={{ padding: '6px 0' }}>
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

          {/* About + Security */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                    { label: 'Research AI',  value: `Claude Opus 4.5 (${researchAI === 'claude' ? 'active' : 'GPT-4o overriding'})` },
                    { label: 'Drafting AI',  value: `GPT-4o (${draftingAI === 'openai' ? 'active' : 'Claude overriding'})` },
                    { label: 'Data store',   value: 'Private Supabase (Postgres)' },
                    { label: 'Deployment',   value: 'Vercel · Edge Runtime' },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'rgb(100,107,140)' }}>{row.label}</span>
                      <span style={{ fontSize: 11, color: 'rgb(180,185,215)' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Version */}
            <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
  )
}
