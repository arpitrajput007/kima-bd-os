'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Bot, Brain, Send, Loader2, Sparkles, Plus, History, X,
  Mic, MicOff, Volume2, VolumeX, MessageSquare, Type,
  Lightbulb, Check, BookOpen, ChevronDown, Zap, Target, TrendingUp, Square,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Types ────────────────────────────────────────────────────
interface MemorySuggestion { title: string; content: string }
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  memory?: MemorySuggestion | null
  memorySaved?: boolean
}
interface Session { id: string; title: string; message_count: number; created_at: string }

// ── Speech recognition typings ───────────────────────────────
interface SREvent extends Event { results: SRResultList; resultIndex: number }
interface SRResult { [i: number]: { transcript: string }; isFinal: boolean }
interface SRResultList { [i: number]: SRResult; length: number }
interface SRInstance extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string
  start(): void; stop(): void; abort(): void
  onresult: ((e: SREvent) => void) | null
  onerror: ((e: Event) => void) | null
  onend: (() => void) | null
}

// ── Tiny markdown renderer (bold, bullets, numbered, headers) ─
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
      if (listType === 'ol') flush()
      listType = 'ul'
      list.push(<li key={`l${idx}`} style={{ lineHeight: 1.6 }}>{fmt(bullet[1])}</li>)
    } else if (numbered) {
      if (listType === 'ul') flush()
      listType = 'ol'
      list.push(<li key={`l${idx}`} style={{ lineHeight: 1.6 }}>{fmt(numbered[2])}</li>)
    } else if (header) {
      flush()
      out.push(<div key={`h${idx}`} style={{ fontWeight: 700, color: 'white', fontSize: 14, margin: '8px 0 4px' }}>{fmt(header[1])}</div>)
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

const STARTERS = [
  { icon: Target, label: 'What should I focus on today?', q: 'Looking at my whole pipeline right now, what are the 3 highest-leverage things I should do today and why?' },
  { icon: TrendingUp, label: 'Where am I losing deals?', q: 'Analyze my pipeline and outreach — where am I losing deals or leaking opportunities? Show me the patterns and the fix.' },
  { icon: Zap, label: 'Improve my outreach', q: 'Based on my reply rates per channel and what has converted, how should I improve my outreach? Be specific.' },
  { icon: Lightbulb, label: 'Find missed opportunities', q: 'Scan my leads and find missed opportunities — high-potential leads I have not acted on, stale conversations, or categories I am under-targeting.' },
]

export default function CopilotPage() {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [showSessions, setShowSessions] = useState(false)
  const [savingMem, setSavingMem] = useState<string | null>(null)

  // Voice (opt-in)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recRef = useRef<SRInstance | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  const abortRef = useRef<AbortController | null>(null)

  // Context counts for sidebar
  const [ctx, setCtx] = useState<{ knowledge: number; rules: number; leads: number }>({ knowledge: 0, rules: 0, leads: 0 })

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SRInstance; webkitSpeechRecognition?: new () => SRInstance }
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (SR) { const r = new SR(); r.continuous = false; r.interimResults = true; r.lang = 'en-US'; recRef.current = r }
  }, [])

  const loadSessions = useCallback(async () => {
    const { data } = await supabase.from('voice_sessions').select('id, title, message_count, created_at').order('created_at', { ascending: false }).limit(20)
    setSessions(data || [])
  }, []) // eslint-disable-line

  const loadCtx = useCallback(async () => {
    const [{ count: k }, { count: r }, { count: l }] = await Promise.all([
      supabase.from('agent_knowledge').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('agent_rules').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('leads').select('id', { count: 'exact', head: true }).not('status', 'in', '("rejected","archived")'),
    ])
    setCtx({ knowledge: k || 0, rules: r || 0, leads: l || 0 })
  }, []) // eslint-disable-line

  useEffect(() => { loadSessions(); loadCtx() }, [loadSessions, loadCtx])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, thinking, transcript])

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setThinking(false)
  }, [])

  const newSession = () => {
    setSessionId(null); setMessages([]); historyRef.current = []; setShowSessions(false)
    toast.success('New Co-Pilot chat')
  }

  const loadSession = async (s: Session) => {
    setSessionId(s.id); setShowSessions(false)
    const { data } = await supabase.from('voice_messages').select('id, role, content').eq('session_id', s.id).order('created_at', { ascending: true })
    const msgs: Message[] = (data || []).map(m => ({ id: m.id, role: m.role, content: m.content }))
    setMessages(msgs)
    historyRef.current = msgs.map(m => ({ role: m.role, content: m.content }))
  }

  // TTS
  const speak = async (text: string) => {
    if (!voiceEnabled) return
    try {
      setSpeaking(true)
      const res = await fetch('/api/ai/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text.replace(/[*#`]/g, '').slice(0, 1500) }) })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url); audioRef.current = audio
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url) }
      audio.onerror = () => { setSpeaking(false) }
      await audio.play()
    } catch { setSpeaking(false) }
  }
  const stopSpeaking = () => { audioRef.current?.pause(); audioRef.current = null; setSpeaking(false) }

  const send = useCallback(async (text: string) => {
    const q = text.trim()
    if (!q || thinking) return
    stopSpeaking()
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: q }
    setMessages(prev => [...prev, userMsg])
    historyRef.current.push({ role: 'user', content: q })
    setInput(''); setTranscript(''); setThinking(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, session_id: sessionId, messages: historyRef.current.slice(-16) }),
        signal: controller.signal,
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const agentMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: data.reply, memory: data.memory || null }
      setMessages(prev => [...prev, agentMsg])
      historyRef.current.push({ role: 'assistant', content: data.reply })
      if (!sessionId && data.session_id) { setSessionId(data.session_id); setTimeout(loadSessions, 1500) }
      speak(data.reply)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      toast.error(e instanceof Error ? e.message : 'Co-Pilot failed to respond')
    } finally {
      setThinking(false)
      abortRef.current = null
    }
  }, [sessionId, thinking, voiceEnabled]) // eslint-disable-line

  const saveMemory = async (msgId: string, mem: MemorySuggestion) => {
    setSavingMem(msgId)
    const res = await fetch('/api/ai/copilot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save_memory', title: mem.title, content: mem.content }) })
    const data = await res.json()
    setSavingMem(null)
    if (data.saved) {
      toast.success('Saved to long-term memory')
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, memorySaved: true } : m))
      loadCtx()
    } else {
      toast.error('Could not save')
    }
  }

  const dismissMemory = (msgId: string) =>
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, memory: null } : m))

  // Voice input (push to talk)
  const toggleListen = () => {
    if (!recRef.current) { toast.error('Voice input not supported in this browser'); return }
    if (listening) { recRef.current.stop(); setListening(false); return }
    stopSpeaking(); setTranscript(''); setListening(true)
    const rec = recRef.current
    let finalT = ''
    rec.onresult = (e: SREvent) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalT += t; else interim += t
      }
      setTranscript(finalT + interim)
    }
    rec.onerror = () => { setListening(false) }
    rec.onend = () => { setListening(false); const t = (finalT || transcript).trim(); if (t) send(t) }
    rec.start()
  }

  const toggleVoice = () => {
    setVoiceEnabled(v => {
      if (v) stopSpeaking()
      toast(v ? 'Voice off' : 'Voice on — replies will be spoken')
      return !v
    })
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2">
            <Bot size={18} style={{ color: '#a78bfa' }} /> AI Co-Pilot
          </h1>
          <p className="text-[12px] mt-1 font-medium" style={{ color: 'rgb(100,106,135)' }}>
            Your BD agent, on tap — strategy, pipeline, leads & knowledge. {messages.length > 0 && `· ${Math.ceil(messages.length / 2)} exchanges`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div style={{ display: 'flex', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <button onClick={() => voiceEnabled && toggleVoice()} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: !voiceEnabled ? 'rgba(167,139,250,0.18)' : 'transparent', color: !voiceEnabled ? '#a78bfa' : 'rgb(140,145,175)' }}>
              <Type size={13} /> Text
            </button>
            <button onClick={() => !voiceEnabled && toggleVoice()} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: voiceEnabled ? 'rgba(52,211,153,0.18)' : 'transparent', color: voiceEnabled ? '#34d399' : 'rgb(140,145,175)' }}>
              <Mic size={13} /> Voice
            </button>
          </div>
          {/* Sessions */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowSessions(s => !s)} className="btn btn-secondary" style={{ fontSize: 12, padding: '7px 12px' }}>
              <History size={13} /> Sessions <ChevronDown size={12} />
            </button>
            {showSessions && (
              <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 50, width: 280, maxHeight: 360, overflowY: 'auto', background: 'rgb(18,19,30)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 6, boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
                {sessions.length === 0 ? (
                  <div style={{ padding: 14, fontSize: 12, color: 'rgb(120,127,160)', textAlign: 'center' }}>No past chats yet</div>
                ) : sessions.map(s => (
                  <button key={s.id} onClick={() => loadSession(s)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 'none', background: sessionId === s.id ? 'rgba(167,139,250,0.12)' : 'transparent', color: 'white', cursor: 'pointer', marginBottom: 2 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                    <div style={{ fontSize: 10, color: 'rgb(110,117,145)', marginTop: 1 }}>{s.message_count} msgs</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={newSession} className="btn btn-primary" style={{ fontSize: 12, padding: '7px 12px' }}>
            <Plus size={13} /> New
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Chat column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
            {messages.length === 0 ? (
              <div style={{ maxWidth: 640, margin: '0 auto', paddingTop: 24 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(79,70,229,0.3))', border: '1px solid rgba(124,58,237,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Bot size={26} color="#a78bfa" />
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 8 }}>Ask me anything about the business.</h2>
                <p style={{ fontSize: 13, color: 'rgb(150,155,185)', lineHeight: 1.7, marginBottom: 24 }}>
                  I&apos;m your BD agent — I know the pipeline, leads, outreach, products, and strategy. Ask for analysis, next moves, or corrections. When you teach me something, I&apos;ll offer to remember it for good.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {STARTERS.map(s => {
                    const Icon = s.icon
                    return (
                      <button key={s.label} onClick={() => send(s.q)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '13px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'rgb(200,205,225)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.08)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.25)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
                        <Icon size={15} color="#a78bfa" style={{ flexShrink: 0 }} />
                        {s.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {messages.map(m => (
                  m.role === 'user' ? (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ maxWidth: '82%', borderRadius: '14px 14px 4px 14px', padding: '11px 15px', fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.3)', color: 'rgb(228,222,250)' }}>
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                        <Brain size={15} color="#a78bfa" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ borderRadius: '4px 14px 14px 14px', padding: '12px 16px', fontSize: 13.5, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgb(210,215,232)' }}>
                          <RichText text={m.content} />
                        </div>
                        {/* Memory suggestion */}
                        {m.memory && !m.memorySaved && (
                          <div style={{ marginTop: 8, borderRadius: 11, border: '1px solid rgba(251,191,36,0.25)', background: 'rgba(251,191,36,0.05)', padding: '11px 13px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                              <Lightbulb size={13} color="#fbbf24" />
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Save to memory?</span>
                            </div>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'white', marginBottom: 2 }}>{m.memory.title}</div>
                            <div style={{ fontSize: 12, color: 'rgb(180,185,210)', lineHeight: 1.5, marginBottom: 9 }}>{m.memory.content}</div>
                            <div style={{ display: 'flex', gap: 7 }}>
                              <button onClick={() => saveMemory(m.id, m.memory!)} disabled={savingMem === m.id}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: 'none', background: 'rgba(251,191,36,0.9)', color: '#1a1400', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                                {savingMem === m.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save to memory
                              </button>
                              <button onClick={() => dismissMemory(m.id)}
                                style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgb(150,155,185)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                                Not now
                              </button>
                            </div>
                          </div>
                        )}
                        {m.memorySaved && (
                          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#34d399' }}>
                            <Check size={13} /> Saved to long-term memory
                          </div>
                        )}
                      </div>
                    </div>
                  )
                ))}
                {thinking && (
                  <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Loader2 size={15} className="animate-spin" color="#a78bfa" />
                    </div>
                    <span style={{ fontSize: 13, color: 'rgb(150,155,185)' }}>Reading your pipeline & thinking…</span>
                    <button onClick={stopGeneration} title="Stop generation" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(248,113,133,0.35)', background: 'rgba(248,113,133,0.1)', color: '#fb7185', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                      <Square size={10} fill="#fb7185" /> Stop
                    </button>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}
          </div>

          {/* Composer */}
          <div style={{ padding: '14px 32px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ maxWidth: 760, margin: '0 auto' }}>
              {voiceEnabled && (transcript || listening) && (
                <div style={{ fontSize: 12, color: '#34d399', marginBottom: 8, minHeight: 16 }}>
                  {listening ? (transcript || 'Listening…') : transcript}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', padding: 7 }}>
                {voiceEnabled && (
                  <button onClick={toggleListen}
                    style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 11, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: listening ? '#34d399' : 'rgba(52,211,153,0.15)', color: listening ? '#06140d' : '#34d399' }}>
                    {listening ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                )}
                <textarea
                  value={input}
                  onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px' }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
                  placeholder={voiceEnabled ? 'Tap the mic or type…' : 'Ask your Co-Pilot anything — strategy, leads, outreach, knowledge…'}
                  rows={1}
                  style={{ flex: 1, resize: 'none', maxHeight: 160, border: 'none', background: 'transparent', padding: '9px 10px', fontSize: 13.5, color: 'white', fontFamily: 'inherit', lineHeight: 1.5, outline: 'none' }}
                />
                {voiceEnabled && speaking && (
                  <button onClick={stopSpeaking} title="Stop speaking" style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 11, border: 'none', cursor: 'pointer', background: 'rgba(251,113,133,0.15)', color: '#fb7185', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <VolumeX size={16} />
                  </button>
                )}
                <button
                  onClick={thinking ? stopGeneration : () => send(input)}
                  disabled={!thinking && !input.trim()}
                  style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 11, border: 'none', cursor: (!thinking && !input.trim()) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: thinking ? 'rgba(248,113,133,0.2)' : (input.trim() ? 'rgb(167,139,250)' : 'rgba(167,139,250,0.15)'), color: thinking ? '#fb7185' : (!input.trim() ? '#a78bfa' : '#0b0814') }}
                  title={thinking ? 'Stop generation' : 'Send'}>
                  {thinking ? <Square size={14} fill="#fb7185" /> : <Send size={16} />}
                </button>
              </div>
              <div style={{ fontSize: 10.5, color: 'rgb(90,97,125)', marginTop: 7, textAlign: 'center' }}>
                {voiceEnabled ? 'Voice on · replies are spoken · tap mic to talk' : 'Enter to send · Shift+Enter for a new line · I learn from your corrections'}
              </div>
            </div>
          </div>
        </div>

        {/* Context sidebar */}
        <div style={{ width: 240, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.06)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }} className="hidden lg:flex">
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgb(100,107,140)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Agent context</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: 'rgb(170,175,200)' }}>
                <BookOpen size={14} color="#a78bfa" /> Knowledge <span style={{ marginLeft: 'auto', color: 'white', fontWeight: 600 }}>{ctx.knowledge}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: 'rgb(170,175,200)' }}>
                <Zap size={14} color="#34d399" /> Active rules <span style={{ marginLeft: 'auto', color: 'white', fontWeight: 600 }}>{ctx.rules}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: 'rgb(170,175,200)' }}>
                <MessageSquare size={14} color="#38bdf8" /> Live leads <span style={{ marginLeft: 'auto', color: 'white', fontWeight: 600 }}>{ctx.leads}</span>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgb(100,107,140)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Tips</div>
            <ul style={{ fontSize: 11.5, color: 'rgb(140,145,175)', lineHeight: 1.7, paddingLeft: 14, margin: 0 }}>
              <li>Correct me when I&apos;m wrong — I&apos;ll offer to remember it</li>
              <li>Ask for strategy, not just facts</li>
              <li>Toggle Voice to talk hands-free</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
