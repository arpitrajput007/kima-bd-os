'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Send, Loader2, Plus, History, X,
  Lightbulb, Check, BookOpen, ChevronDown,
  Shield, Target, Users, FileText,
  MessageSquare, Zap, TrendingUp, ClipboardList,
  AlertTriangle, Brain,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────
interface MemorySuggestion { title: string; content: string }
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  memory?: MemorySuggestion | null
  memorySaved?: boolean
}
interface Session { id: string; title: string; message_count: number; created_at: string }

// ── Colours (cyan/teal — distinct from Kima's purple) ────────────────────────
const C = {
  primary:    '#06b6d4',   // cyan-500
  primaryDim: 'rgba(6,182,212,0.15)',
  primaryBorder: 'rgba(6,182,212,0.3)',
  primaryText: '#67e8f9',  // cyan-300
  bg:   'rgba(6,182,212,0.05)',
  glow: '0 0 20px rgba(6,182,212,0.12)',
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
function RichText({ text }: { text: string }) {
  const lines = text.split('\n')
  const out: React.ReactNode[] = []
  let list: React.ReactNode[] = []
  let listType: 'ul' | 'ol' | null = null

  const flush = () => {
    if (list.length) {
      out.push(listType === 'ol'
        ? <ol key={out.length} style={{ margin: '4px 0 8px', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>{list}</ol>
        : <ul key={out.length} style={{ margin: '4px 0 8px', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>{list}</ul>)
      list = []; listType = null
    }
  }

  const fmt = (s: string) => {
    const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    return parts.map((p, i) => {
      if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} style={{ color: 'white', fontWeight: 600 }}>{p.slice(2, -2)}</strong>
      if (p.startsWith('`') && p.endsWith('`')) return <code key={i} style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4, fontSize: '0.9em', fontFamily: 'monospace' }}>{p.slice(1, -1)}</code>
      return <span key={i}>{p}</span>
    })
  }

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*[-*]\s+(.*)/)
    const numbered = line.match(/^\s*(\d+)\.\s+(.*)/)
    const header = line.match(/^#{1,3}\s+(.*)/)
    if (bullet) {
      if (listType === 'ol') flush(); listType = 'ul'
      list.push(<li key={`l${idx}`} style={{ lineHeight: 1.6 }}>{fmt(bullet[1])}</li>)
    } else if (numbered) {
      if (listType === 'ul') flush(); listType = 'ol'
      list.push(<li key={`l${idx}`} style={{ lineHeight: 1.6 }}>{fmt(numbered[2])}</li>)
    } else if (header) {
      flush()
      out.push(<div key={`h${idx}`} style={{ fontWeight: 700, color: 'white', fontSize: 14, margin: '10px 0 4px' }}>{fmt(header[1])}</div>)
    } else if (line === '') {
      flush()
    } else {
      flush()
      out.push(<p key={`p${idx}`} style={{ margin: '0 0 6px', lineHeight: 1.65 }}>{fmt(line)}</p>)
    }
  })
  flush()
  return <div>{out}</div>
}

// ── Quick-start prompts ───────────────────────────────────────────────────────
const STARTERS = [
  {
    icon: Target,
    label: 'Research a company',
    q: 'Research this company for Aergap fit — give me company summary, ICP score, stakeholders to target, signals, and a cold outreach message:',
  },
  {
    icon: Users,
    label: 'Score my pipeline',
    q: 'Review my full agentic payments pipeline. Score each account on ANUM. Which ones should I prioritise for design partner conversations and which should I drop?',
  },
  {
    icon: FileText,
    label: 'Prep a discovery call',
    q: 'Help me prepare for a discovery call. Give me company-specific discovery questions, pain hypotheses, and questions that uncover urgency and governance blockers for:',
  },
  {
    icon: MessageSquare,
    label: 'Write outreach',
    q: 'Write cold outreach for Aergap targeting this company — LinkedIn connection note (under 300 chars), LinkedIn DM, and a cold email. Focus on discovery, not pitching:',
  },
  {
    icon: AlertTriangle,
    label: 'Handle an objection',
    q: 'Give me responses to this objection — short version, detailed version, founder-specific, and technical: "We already have permissions / RBAC / audit logs."',
  },
  {
    icon: ClipboardList,
    label: 'Create my daily plan',
    q: 'Create my daily plan. Top accounts to target today, priority follow-ups, discovery prep, outreach tasks, and daily goals — optimised for design partner conversion.',
  },
]

// ── ANUM score chip ───────────────────────────────────────────────────────────
const ANUM_LABELS = ['Authority', 'Need', 'Urgency', 'Money', 'Fit']

function AnumDisplay({ text }: { text: string }) {
  // Detect scores like "Authority: 8/10" or "A: 8" in the text
  const scores: Record<string, string> = {}
  ANUM_LABELS.forEach(label => {
    const match = text.match(new RegExp(`${label}[^:]*:\\s*(\\d+)`, 'i'))
    if (match) scores[label] = match[1]
  })
  if (Object.keys(scores).length < 2) return null
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
      {ANUM_LABELS.filter(l => scores[l]).map(label => (
        <div key={label} style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: C.primaryDim, border: C.primaryBorder, color: C.primaryText }}>
          {label[0]} <span style={{ color: 'white' }}>{scores[label]}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AergapCopilotPage() {
  const supabase = createClient()
  const [messages, setMessages]     = useState<Message[]>([])
  const [input, setInput]           = useState('')
  const [thinking, setThinking]     = useState(false)
  const [sessionId, setSessionId]   = useState<string | null>(null)
  const [sessions, setSessions]     = useState<Session[]>([])
  const [showSessions, setShowSessions] = useState(false)
  const [savingMem, setSavingMem]   = useState<string | null>(null)
  const endRef  = useRef<HTMLDivElement>(null)
  const histRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [ctx, setCtx] = useState({ knowledge: 0, rules: 0, agentic: 0 })

  const loadSessions = useCallback(async () => {
    const { data } = await supabase
      .from('voice_sessions').select('id, title, message_count, created_at')
      .ilike('title', '%[Aergap]%')
      .order('created_at', { ascending: false }).limit(30)
    setSessions(data || [])
  }, []) // eslint-disable-line

  const loadCtx = useCallback(async () => {
    const [{ count: k }, { count: r }, { count: a }] = await Promise.all([
      supabase.from('agent_knowledge').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('agent_rules').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('leads').select('id', { count: 'exact', head: true }).contains('customer_category', ['Agentic Payments Customer']),
    ])
    setCtx({ knowledge: k || 0, rules: r || 0, agentic: a || 0 })
  }, []) // eslint-disable-line

  useEffect(() => { loadSessions(); loadCtx() }, [loadSessions, loadCtx])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, thinking])

  const newSession = () => {
    setSessionId(null); setMessages([]); histRef.current = []
    setShowSessions(false); toast.success('New Aergap BD chat')
  }

  const loadSession = async (s: Session) => {
    setSessionId(s.id); setShowSessions(false)
    const { data } = await supabase.from('voice_messages')
      .select('id, role, content').eq('session_id', s.id).order('created_at', { ascending: true })
    const msgs: Message[] = (data || []).map(m => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content }))
    setMessages(msgs)
    histRef.current = msgs.map(m => ({ role: m.role, content: m.content }))
  }

  const send = useCallback(async (text: string) => {
    const q = text.trim()
    if (!q || thinking) return
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: q }
    setMessages(prev => [...prev, userMsg])
    histRef.current.push({ role: 'user', content: q })
    setInput(''); setThinking(true)
    if (textareaRef.current) { textareaRef.current.style.height = 'auto' }

    try {
      const res = await fetch('/api/ai/aergap-copilot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, session_id: sessionId, messages: histRef.current.slice(-16) }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const agentMsg: Message = {
        id: crypto.randomUUID(), role: 'assistant',
        content: data.reply, memory: data.memory || null,
      }
      setMessages(prev => [...prev, agentMsg])
      histRef.current.push({ role: 'assistant', content: data.reply })
      if (!sessionId && data.session_id) {
        setSessionId(data.session_id)
        // Load immediately (title already has [Aergap] prefix from creation)
        // then again after autoTitle finishes rewriting it (~3s OpenAI call)
        setTimeout(loadSessions, 500)
        setTimeout(loadSessions, 4000)
      } else {
        // Refresh list on every turn so titles stay current
        setTimeout(loadSessions, 500)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Co-Pilot failed to respond')
    } finally { setThinking(false) }
  }, [sessionId, thinking]) // eslint-disable-line

  const saveMemory = async (msgId: string, mem: MemorySuggestion) => {
    setSavingMem(msgId)
    const res = await fetch('/api/ai/aergap-copilot', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_memory', title: mem.title, content: mem.content }),
    })
    const data = await res.json()
    setSavingMem(null)
    if (data.saved) {
      toast.success('Saved to agent memory')
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, memorySaved: true } : m))
      loadCtx()
    } else { toast.error('Could not save') }
  }

  const dismissMemory = (msgId: string) =>
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, memory: null } : m))

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header ── */}
      <div className="page-header flex items-center justify-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, rgba(6,182,212,0.3), rgba(8,145,178,0.2))`, border: `1px solid ${C.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: C.glow }}>
            <Shield size={17} color={C.primary} />
          </div>
          <div>
            <h1 className="text-[17px] font-bold text-white tracking-tight flex items-center gap-2">
              Aergap BD Co-Pilot
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: C.primaryDim, color: C.primaryText, border: `1px solid ${C.primaryBorder}`, letterSpacing: '0.06em' }}>AGENT GOVERNANCE</span>
            </h1>
            <p style={{ fontSize: 11.5, color: 'rgb(100,106,135)', marginTop: 2 }}>
              Research · Score · Outreach · Discovery · Pipeline coaching
              {messages.length > 0 && ` · ${Math.ceil(messages.length / 2)} exchanges`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sessions dropdown */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowSessions(s => !s)} className="btn btn-secondary" style={{ fontSize: 12, padding: '7px 12px', borderColor: 'rgba(255,255,255,0.1)' }}>
              <History size={13} /> Sessions <ChevronDown size={12} />
            </button>
            {showSessions && (
              <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 50, width: 300, maxHeight: 380, overflowY: 'auto', background: 'rgb(14,15,24)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 6, boxShadow: '0 20px 50px rgba(0,0,0,0.7)' }}>
                <div style={{ padding: '6px 8px 4px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Aergap BD sessions</div>
                {sessions.length === 0 ? (
                  <div style={{ padding: 14, fontSize: 12, color: 'rgb(120,127,160)', textAlign: 'center' }}>No past chats yet</div>
                ) : sessions.map(s => (
                  <button key={s.id} onClick={() => loadSession(s)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 'none', background: sessionId === s.id ? C.primaryDim : 'transparent', color: 'white', cursor: 'pointer', marginBottom: 2 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: sessionId === s.id ? C.primaryText : 'white' }}>{s.title.replace('[Aergap] ', '')}</div>
                    <div style={{ fontSize: 10, color: 'rgb(110,117,145)', marginTop: 1 }}>{s.message_count} msgs</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={newSession} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${C.primaryBorder}`, background: C.primaryDim, color: C.primaryText }}>
            <Plus size={13} /> New chat
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* ── Chat area ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>

            {/* Empty state */}
            {messages.length === 0 && (
              <div style={{ maxWidth: 680, margin: '0 auto', paddingTop: 16 }}>
                {/* Banner */}
                <div style={{ borderRadius: 16, padding: '20px 22px', background: `linear-gradient(135deg, rgba(6,182,212,0.08), rgba(8,145,178,0.04))`, border: `1px solid ${C.primaryBorder}`, marginBottom: 28, boxShadow: C.glow }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: C.primaryDim, border: `1px solid ${C.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Shield size={22} color={C.primary} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 5 }}>Aergap BD Co-Pilot</div>
                      <div style={{ fontSize: 12.5, color: 'rgb(150,158,190)', lineHeight: 1.65 }}>
                        Dedicated to discovering where <strong style={{ color: 'white' }}>agent governance pain</strong> exists, generating qualified opportunities, and converting prospects into <strong style={{ color: C.primaryText }}>design partners</strong>.
                      </div>
                      <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', borderLeft: `3px solid ${C.primary}`, fontSize: 12, color: 'rgb(180,185,210)', fontStyle: 'italic', lineHeight: 1.55 }}>
                        "When an AI agent can move money, one wrong call cannot be undone. Aergap is the gate that determines what the agent is allowed to do before it acts."
                      </div>
                    </div>
                  </div>
                </div>

                {/* Starter grid */}
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Quick actions</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {STARTERS.map(s => {
                    const Icon = s.icon
                    return (
                      <button key={s.label} onClick={() => {
                        setInput(s.q)
                        textareaRef.current?.focus()
                        if (textareaRef.current) {
                          textareaRef.current.style.height = 'auto'
                          textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px'
                        }
                      }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '11px 13px', borderRadius: 11, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', color: 'rgb(190,196,220)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = C.primaryDim; e.currentTarget.style.borderColor = C.primaryBorder; e.currentTarget.style.color = 'white' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgb(190,196,220)' }}>
                        <Icon size={14} color={C.primary} style={{ flexShrink: 0 }} />
                        {s.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.length > 0 && (
              <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {messages.map(m => (
                  m.role === 'user' ? (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ maxWidth: '80%', borderRadius: '14px 14px 4px 14px', padding: '11px 15px', fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: C.primaryDim, border: `1px solid ${C.primaryBorder}`, color: '#e0f7fa' }}>
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: C.primaryDim, border: `1px solid ${C.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                        <Shield size={14} color={C.primary} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ borderRadius: '4px 14px 14px 14px', padding: '13px 16px', fontSize: 13.5, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgb(210,215,232)' }}>
                          <AnumDisplay text={m.content} />
                          <RichText text={m.content} />
                        </div>

                        {/* Memory suggestion */}
                        {m.memory && !m.memorySaved && (
                          <div style={{ marginTop: 8, borderRadius: 11, border: '1px solid rgba(251,191,36,0.25)', background: 'rgba(251,191,36,0.05)', padding: '11px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <Lightbulb size={13} color="#fbbf24" />
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Save to memory?</span>
                              </div>
                              <button onClick={() => dismissMemory(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex' }}><X size={13} /></button>
                            </div>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'white', marginBottom: 3 }}>{m.memory.title}</div>
                            <div style={{ fontSize: 12, color: 'rgb(180,185,210)', lineHeight: 1.5, marginBottom: 9 }}>{m.memory.content}</div>
                            <div style={{ display: 'flex', gap: 7 }}>
                              <button onClick={() => saveMemory(m.id, m.memory!)} disabled={savingMem === m.id}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: 'none', background: 'rgba(251,191,36,0.9)', color: '#1a1400', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                                {savingMem === m.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
                              </button>
                              <button onClick={() => dismissMemory(m.id)}
                                style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgb(150,155,185)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                                Skip
                              </button>
                            </div>
                          </div>
                        )}
                        {m.memorySaved && (
                          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#34d399' }}>
                            <Check size={12} /> Saved to agent memory
                          </div>
                        )}
                      </div>
                    </div>
                  )
                ))}

                {thinking && (
                  <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: C.primaryDim, border: `1px solid ${C.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Loader2 size={14} className="animate-spin" color={C.primary} />
                    </div>
                    <span style={{ fontSize: 13, color: 'rgb(130,137,170)' }}>Researching & thinking…</span>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}
          </div>

          {/* ── Composer ── */}
          <div style={{ padding: '12px 32px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ maxWidth: 780, margin: '0 auto' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', borderRadius: 14, border: `1px solid ${thinking ? C.primaryBorder : 'rgba(255,255,255,0.1)'}`, background: 'rgba(255,255,255,0.03)', padding: 7, transition: 'border-color 0.2s' }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px'
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
                  placeholder="Paste a company, LinkedIn URL, email thread, meeting notes, or ask anything about Aergap BD…"
                  rows={1}
                  style={{ flex: 1, resize: 'none', maxHeight: 180, border: 'none', background: 'transparent', padding: '9px 10px', fontSize: 13.5, color: 'white', fontFamily: 'inherit', lineHeight: 1.5, outline: 'none' }}
                />
                <button
                  onClick={() => send(input)}
                  disabled={thinking || !input.trim()}
                  style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 11, border: 'none', cursor: thinking || !input.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: thinking || !input.trim() ? C.primaryDim : C.primary, color: thinking || !input.trim() ? C.primary : '#001820', transition: 'all 0.15s' }}>
                  {thinking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
              <div style={{ fontSize: 10.5, color: 'rgb(80,88,115)', marginTop: 6, textAlign: 'center' }}>
                Enter to send · Shift+Enter for new line · Paste URLs, docs, or LinkedIn profiles and I'll read them · I learn from corrections
              </div>
            </div>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className={cn('hidden lg:flex')} style={{ width: 220, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.06)', padding: '20px 16px', flexDirection: 'column', gap: 18 }}>

          {/* Context stats */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgb(90,97,125)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Context loaded</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { icon: BookOpen, label: 'Knowledge', value: ctx.knowledge, color: C.primary },
                { icon: Zap,      label: 'Active rules', value: ctx.rules, color: '#a78bfa' },
                { icon: TrendingUp, label: 'Agentic leads', value: ctx.agentic, color: '#34d399' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgb(160,165,195)' }}>
                  <Icon size={13} color={color} /> {label}
                  <span style={{ marginLeft: 'auto', color: 'white', fontWeight: 700 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Objective reminder */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgb(90,97,125)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Current objective</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {['Discover governance pain', 'Validate demand', 'Secure discovery calls', 'Find design partners', 'Refine positioning'].map((obj, i) => (
                <div key={obj} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: C.primary, flexShrink: 0, marginTop: 2 }}>{i + 1}</span>
                  <span style={{ fontSize: 11, color: 'rgb(140,148,175)', lineHeight: 1.45 }}>{obj}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ICP reminder */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgb(90,97,125)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Hot signal</div>
            <div style={{ padding: '9px 11px', borderRadius: 9, background: C.bg, border: `1px solid ${C.primaryBorder}`, fontSize: 11, color: 'rgb(150,158,190)', lineHeight: 1.55 }}>
              Enterprise deal stalling in security review = <strong style={{ color: C.primaryText }}>live buying signal</strong>
            </div>
          </div>

          {/* Tips */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgb(90,97,125)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Tips</div>
            <ul style={{ fontSize: 11, color: 'rgb(130,138,170)', lineHeight: 1.65, paddingLeft: 14, margin: 0 }}>
              <li>Paste a LinkedIn URL to get a stakeholder map</li>
              <li>Paste meeting notes for ANUM scoring</li>
              <li>Ask for daily plan each morning</li>
              <li>Correct me — I'll save it to memory</li>
            </ul>
          </div>

          {/* Key differentiator */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14, marginTop: 'auto' }}>
            <div style={{ padding: '10px 12px', borderRadius: 9, background: 'rgba(0,0,0,0.3)', borderLeft: `3px solid ${C.primary}`, fontSize: 10.5, color: 'rgb(140,148,175)', lineHeight: 1.6, fontStyle: 'italic' }}>
              Gate fires <strong style={{ color: 'white', fontStyle: 'normal' }}>before</strong> the action. Not after.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
