'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Save, Eye, EyeOff, Key, Brain, MessageSquare, Check, ExternalLink } from 'lucide-react'

type AIProvider = 'claude' | 'openai'

const MODEL_INFO: Record<AIProvider, { label: string; desc: string; color: string }> = {
  claude: {
    label: 'Claude (Anthropic)',
    desc: 'Better at nuanced analysis, specific pain-point extraction, reading tech stacks. Recommended for research.',
    color: '#a78bfa',
  },
  openai: {
    label: 'GPT-4o (OpenAI)',
    desc: 'Strong at natural tone, message variation, and conversational drafting. Recommended for outreach.',
    color: '#60a5fa',
  },
}

export default function SettingsPage() {
  const [showKey, setShowKey] = useState(false)
  const [openaiKey, setOpenaiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [researchAI, setResearchAI] = useState<AIProvider>('claude')
  const [draftingAI, setDraftingAI] = useState<AIProvider>('openai')

  // Load saved prefs from localStorage on mount
  useEffect(() => {
    const r = localStorage.getItem('bd_research_ai') as AIProvider | null
    const d = localStorage.getItem('bd_drafting_ai') as AIProvider | null
    if (r === 'claude' || r === 'openai') setResearchAI(r)
    if (d === 'claude' || d === 'openai') setDraftingAI(d)
  }, [])

  const saveModelPrefs = () => {
    localStorage.setItem('bd_research_ai', researchAI)
    localStorage.setItem('bd_drafting_ai', draftingAI)
    toast.success('AI model preferences saved')
  }

  const handleSave = () => {
    toast.info('To update API keys, edit the .env.local file in your project root and restart the dev server.')
    setSaved(true)
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>Configure your Kima BD OS</p>
      </div>

      <div className="p-8 max-w-2xl space-y-8">
        {/* API Keys */}
        <div className="rounded-xl p-5" style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Key size={15} style={{ color: '#a78bfa' }} />
            <h2 className="text-sm font-semibold text-white">API Configuration</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(160,160,180)' }}>
                OpenAI API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  className="input-dark"
                  placeholder="sk-..."
                  value={openaiKey}
                  onChange={e => setOpenaiKey(e.target.value)}
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 btn btn-ghost"
                  style={{ padding: '2px' }}
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-xs mt-2" style={{ color: 'rgb(100,100,120)' }}>
                Add this to your <code className="mono" style={{ color: '#a78bfa', background: 'rgba(139,92,246,0.1)', padding: '1px 4px', borderRadius: '3px' }}>.env.local</code> file as{' '}
                <code className="mono" style={{ color: '#a78bfa' }}>OPENAI_API_KEY</code>
              </p>
            </div>

            <div className="p-4 rounded-xl text-xs" style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
              <div className="font-semibold mb-2" style={{ color: '#60a5fa' }}>Current Configuration</div>
              <div className="space-y-1.5" style={{ color: 'rgb(140,160,180)' }}>
                <div>Supabase URL: <span className="text-white">https://wwjhtpizwxwsovzjdrog.supabase.co</span></div>
                <div>Project ID: <span className="text-white">wwjhtpizwxwsovzjdrog</span></div>
                <div>OpenAI: <span style={{ color: process.env.NEXT_PUBLIC_SUPABASE_URL ? '#34d399' : '#f87171' }}>Check .env.local</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="rounded-xl p-5" style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="text-sm font-semibold text-white mb-4">Quick Links</h2>
          <div className="space-y-2">
            {[
              { label: 'Supabase Dashboard', url: 'https://supabase.com/dashboard/project/wwjhtpizwxwsovzjdrog' },
              { label: 'Supabase SQL Editor (run schema)', url: 'https://supabase.com/dashboard/project/wwjhtpizwxwsovzjdrog/sql' },
              { label: 'Supabase Auth Users', url: 'https://supabase.com/dashboard/project/wwjhtpizwxwsovzjdrog/auth/users' },
              { label: 'OpenAI API Keys', url: 'https://platform.openai.com/api-keys' },
              { label: 'Vercel (deploy)', url: 'https://vercel.com/new' },
            ].map(({ label, url }) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg hover:bg-white/[0.04] transition-colors"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-sm" style={{ color: 'rgb(200,200,220)' }}>{label}</span>
                <ExternalLink size={13} style={{ color: 'rgb(100,100,120)' }} />
              </a>
            ))}
          </div>
        </div>

        {/* Setup Instructions */}
        <div className="rounded-xl p-5" style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="text-sm font-semibold text-white mb-4">Setup Checklist</h2>
          <div className="space-y-3">
            {[
              { step: '1. Run the Supabase schema SQL', done: true, link: 'https://supabase.com/dashboard/project/wwjhtpizwxwsovzjdrog/sql', linkText: 'Open SQL Editor' },
              { step: '2. Create your account in Supabase Auth', done: false, link: 'https://supabase.com/dashboard/project/wwjhtpizwxwsovzjdrog/auth/users', linkText: 'Add User' },
              { step: '3. Add your OpenAI API key to .env.local', done: false },
              { step: '4. Restart the dev server: npm run dev', done: false },
              { step: '5. Log in and add your first lead', done: false },
              { step: '6. Use AI actions to research and score', done: false },
            ].map(({ step, done, link, linkText }) => (
              <div key={step} className="flex items-center gap-3">
                <div className={cn('w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs', done ? 'bg-emerald-500/20' : 'bg-zinc-800')}
                  style={{ border: done ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(255,255,255,0.08)' }}>
                  {done ? '✓' : ''}
                </div>
                <span className="text-sm flex-1" style={{ color: done ? 'rgb(180,180,200)' : 'rgb(200,200,220)' }}>{step}</span>
                {link && (
                  <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs" style={{ color: '#60a5fa' }}>
                    {linkText} →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* AI Model Preferences */}
        <div className="rounded-xl p-5" style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Brain size={15} style={{ color: '#a78bfa' }} />
            <h2 className="text-sm font-semibold text-white">AI Model Preferences</h2>
          </div>
          <p className="text-xs mb-5" style={{ color: 'rgb(100,100,120)' }}>
            Choose which AI handles research vs message drafting. Both models read the same saved research — OpenAI for drafting sees everything Claude discovered, and vice versa.
          </p>

          {(['research', 'drafting'] as const).map(task => {
            const current = task === 'research' ? researchAI : draftingAI
            const setter  = task === 'research' ? setResearchAI : setDraftingAI
            const Icon    = task === 'research' ? Brain : MessageSquare
            const defaultVal: AIProvider = task === 'research' ? 'claude' : 'openai'
            return (
              <div key={task} className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={13} style={{ color: 'rgb(160,160,180)' }} />
                  <span className="text-xs font-semibold" style={{ color: 'rgb(200,200,220)' }}>
                    {task === 'research' ? 'Research & Analysis' : 'Message Drafting'}
                  </span>
                  {current === defaultVal && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>recommended</span>
                  )}
                </div>
                <div className="flex gap-3">
                  {(['claude', 'openai'] as AIProvider[]).map(provider => {
                    const info = MODEL_INFO[provider]
                    const active = current === provider
                    return (
                      <button
                        key={provider}
                        onClick={() => setter(provider)}
                        className="flex-1 text-left p-3 rounded-xl transition-all"
                        style={{
                          background: active ? `rgba(${provider === 'claude' ? '167,139,250' : '96,165,250'},0.1)` : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${active ? info.color : 'rgba(255,255,255,0.08)'}`,
                          cursor: 'pointer',
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold" style={{ color: active ? info.color : 'rgb(180,180,200)' }}>{info.label}</span>
                          {active && <Check size={12} style={{ color: info.color }} />}
                        </div>
                        <p className="text-[11px] leading-relaxed" style={{ color: 'rgb(120,120,140)' }}>{info.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <button onClick={saveModelPrefs} className="btn btn-primary text-xs" style={{ padding: '7px 18px' }}>
            <Save size={13} /> Save preferences
          </button>
        </div>

        <div className="rounded-xl p-4 text-xs" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)', color: 'rgb(160,140,200)' }}>
          <strong style={{ color: '#a78bfa' }}>About Kima BD OS:</strong> This is a private, internal BD tool built for Arpit to manage Kima and Aeredium business development. All data is stored in your private Supabase instance. Research uses Claude Opus 4.5 by default; outreach drafting uses GPT-4o. Both can be changed above.
        </div>
      </div>
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
