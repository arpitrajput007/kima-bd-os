'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Mic, MicOff, Square, Loader2, Brain, Sparkles, CheckCircle,
  ChevronDown, MessageSquare, Volume2, VolumeX, Plus,
  Zap, Clock, BookOpen, History, Send, X, Download,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface Session {
  id: string
  title: string
  summary?: string
  message_count: number
  knowledge_extracted: boolean
  created_at: string
}

interface ExtractionResult {
  success: boolean
  summary: string
  feedback_points: string[]
  rules_created: number
  sources_created: number
  knowledge_title: string
  error?: string
}

// ── Speech Recognition Types ───────────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}
interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}
interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}
interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult
  length: number
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance
    webkitSpeechRecognition: new () => SpeechRecognitionInstance
  }
}

// ── Waveform bars ──────────────────────────────────────────────────────────
function WaveformBars({ active, color = '#a78bfa' }: { active: boolean; color?: string }) {
  return (
    <div className="flex items-center gap-[3px] h-5">
      {[1, 2, 3, 4, 5, 4, 3].map((h, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-150"
          style={{
            width: 3,
            height: active ? `${Math.random() * 16 + 4}px` : `${h * 2}px`,
            background: color,
            opacity: active ? 1 : 0.35,
            animation: active ? `waveBar ${0.6 + i * 0.1}s ease-in-out infinite alternate` : 'none',
            animationDelay: `${i * 0.08}s`,
          }}
        />
      ))}
    </div>
  )
}

// ── Agent Avatar ──────────────────────────────────────────────────────────
function AgentAvatar({ speaking }: { speaking: boolean }) {
  return (
    <div
      className="relative w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.5), rgba(79,70,229,0.4))',
        border: `1px solid ${speaking ? 'rgba(124,58,237,0.7)' : 'rgba(124,58,237,0.3)'}`,
        boxShadow: speaking ? '0 0 16px rgba(124,58,237,0.5)' : 'none',
        transition: 'all 0.3s ease',
      }}
    >
      <Brain size={16} color="#a78bfa" />
      {speaking && (
        <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center"
          style={{ background: '#34d399', border: '1px solid rgb(10,11,16)' }}>
          <Volume2 size={7} color="white" />
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function VoicePage() {
  const supabase = createClient()

  // Session state
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [showSessions, setShowSessions] = useState(false)

  // Messages
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')

  // UI state
  const [isListening, setIsListening] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [transcript, setTranscript] = useState('')   // live interim transcript
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractResult, setExtractResult] = useState<ExtractionResult | null>(null)
  const [speechSupported, setSpeechSupported] = useState(true)

  // Refs
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const messageHistoryRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])

  // ── Init speech recognition ───────────────────────────────────────────────
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setSpeechSupported(false); return }
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'
    recognitionRef.current = rec
  }, [])

  // ── Load sessions ─────────────────────────────────────────────────────────
  const loadSessions = async () => {
    const { data } = await supabase
      .from('voice_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    setSessions(data || [])
  }

  useEffect(() => { loadSessions() }, []) // eslint-disable-line

  // ── Auto scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, transcript])

  // ── Start new session ─────────────────────────────────────────────────────
  const startNewSession = () => {
    setCurrentSession(null)
    setMessages([])
    setExtractResult(null)
    messageHistoryRef.current = []
    toast.success('New session started')
  }

  // ── Load session messages ─────────────────────────────────────────────────
  const loadSession = async (session: Session) => {
    setCurrentSession(session)
    setShowSessions(false)
    setExtractResult(null)
    const { data } = await supabase
      .from('voice_messages')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
    const msgs: Message[] = (data || []).map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: new Date(m.created_at),
    }))
    setMessages(msgs)
    messageHistoryRef.current = msgs.map(m => ({ role: m.role, content: m.content }))
  }

  // ── TTS playback ──────────────────────────────────────────────────────────
  const speak = async (text: string) => {
    if (isMuted) return
    try {
      setIsSpeaking(true)
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('TTS failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url) }
      audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(url) }
      await audio.play()
    } catch (e) {
      console.error('[TTS]', e)
      setIsSpeaking(false)
    }
  }

  const stopSpeaking = () => {
    audioRef.current?.pause()
    audioRef.current = null
    setIsSpeaking(false)
  }

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isThinking) return

    // Stop any playing audio
    stopSpeaking()

    // Add user message optimistically
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    messageHistoryRef.current.push({ role: 'user', content: trimmed })
    setInputText('')
    setTranscript('')
    setIsThinking(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          session_id: currentSession?.id,
          messages: messageHistoryRef.current.slice(-18),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const agentMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, agentMsg])
      messageHistoryRef.current.push({ role: 'assistant', content: data.reply })

      // Update session reference
      if (!currentSession && data.session_id) {
        setTimeout(() => {
          loadSessions().then(() => {
            supabase.from('voice_sessions').select('*').eq('id', data.session_id).single()
              .then(({ data: s }) => { if (s) setCurrentSession(s) })
          })
        }, 1500) // wait for auto-title
      }

      // Speak the reply
      speak(data.reply)
    } catch (e) {
      toast.error('Agent failed to respond')
      console.error('[sendMessage]', e)
    } finally {
      setIsThinking(false)
    }
  }, [currentSession, isThinking, isMuted]) // eslint-disable-line

  // ── Voice input (push-to-talk) ────────────────────────────────────────────
  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
      return
    }

    // Stop agent if speaking
    stopSpeaking()
    setTranscript('')
    setIsListening(true)

    const rec = recognitionRef.current
    let finalTranscript = ''

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) finalTranscript += t
        else interim += t
      }
      setTranscript(finalTranscript + interim)
    }

    rec.onerror = () => { setIsListening(false); setTranscript('') }
    rec.onend = () => {
      setIsListening(false)
      if (finalTranscript.trim()) {
        sendMessage(finalTranscript.trim())
      }
    }

    rec.start()
  }, [isListening, sendMessage])

  // ── Extract session insights ──────────────────────────────────────────────
  const extractInsights = async () => {
    if (!currentSession) { toast.error('No active session to extract'); return }
    if (messages.length < 2) { toast.error('Have a longer conversation first'); return }
    setIsExtracting(true)
    try {
      const res = await fetch('/api/ai/extract-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: currentSession.id }),
      })
      const data: ExtractionResult = await res.json()
      if (data.error) throw new Error(data.error)
      setExtractResult(data)
      toast.success(`Insights extracted! ${data.rules_created} rules, ${data.sources_created} sources created`)
      loadSessions()
    } catch (e) {
      toast.error('Extraction failed')
      console.error(e)
    } finally {
      setIsExtracting(false)
    }
  }

  // ── Keyboard shortcut: Enter to send ─────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputText)
    }
  }

  const hasMessages = messages.length > 0

  return (
    <>
      {/* Waveform animation */}
      <style>{`
        @keyframes waveBar {
          from { transform: scaleY(0.3); }
          to   { transform: scaleY(1.2); }
        }
        @keyframes micPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.4); }
          50%       { box-shadow: 0 0 0 16px rgba(124,58,237,0); }
        }
        @keyframes listeningRing {
          0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          100% { box-shadow: 0 0 0 24px rgba(239,68,68,0); }
        }
        .mic-idle   { animation: micPulse 2.5s ease-in-out infinite; }
        .mic-active { animation: listeningRing 1s ease-out infinite; }
      `}</style>

      <div className="fade-in flex flex-col" style={{ height: '100vh', overflow: 'hidden' }}>

        {/* ── Page Header ───────────────────────────────────── */}
        <div className="page-header flex items-center justify-between" style={{ flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2.5">
                <Mic size={18} style={{ color: '#a78bfa' }} />
                Voice Chat
              </h1>
              <p className="text-[12px] mt-0.5 font-medium" style={{ color: 'rgb(100,106,135)' }}>
                {currentSession
                  ? `${currentSession.title} · ${messages.length} messages`
                  : 'Talk to your agent — it learns from every conversation'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mute toggle */}
            <button
              onClick={() => { stopSpeaking(); setIsMuted(m => !m) }}
              className={cn('btn btn-secondary', isMuted && 'opacity-50')}
              style={{ padding: '7px 12px', fontSize: '12px', gap: '6px' }}
            >
              {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              {isMuted ? 'Muted' : 'Voice On'}
            </button>
            {/* Session history dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSessions(s => !s)}
                className="btn btn-secondary"
                style={{ padding: '7px 12px', fontSize: '12px', gap: '6px' }}
              >
                <History size={13} /> Sessions <ChevronDown size={11} />
              </button>
              {showSessions && (
                <div
                  className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden z-50"
                  style={{
                    background: 'rgb(20,22,33)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                    width: '280px',
                    maxHeight: '360px',
                    overflowY: 'auto',
                  }}
                >
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                    <div className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'rgb(100,106,135)' }}>Past Sessions</div>
                  </div>
                  {sessions.length === 0 ? (
                    <div className="px-4 py-6 text-center text-[12px]" style={{ color: 'rgb(100,106,135)' }}>No sessions yet</div>
                  ) : sessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => loadSession(s)}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                    >
                      <MessageSquare size={13} style={{ color: '#a78bfa', flexShrink: 0, marginTop: 1 }} />
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-white truncate">{s.title}</div>
                        <div className="text-[11px] flex items-center gap-2 mt-0.5" style={{ color: 'rgb(100,106,135)' }}>
                          <Clock size={10} />{formatDate(s.created_at)}
                          {s.knowledge_extracted && (
                            <span style={{ color: '#34d399' }}>· ✓ Learned</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* New session */}
            <button onClick={startNewSession} className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '12px', gap: '6px' }}>
              <Plus size={13} /> New Session
            </button>
          </div>
        </div>

        {/* ── Main body: 2-column layout ─────────────────── */}
        <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

          {/* ── Left: Conversation ───────────────────────── */}
          <div className="flex flex-col flex-1 overflow-hidden" style={{ minWidth: 0 }}>

            {/* Messages area */}
            <div
              className="flex-1 overflow-y-auto"
              style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}
            >
              {/* Empty state */}
              {!hasMessages && (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 mx-auto"
                    style={{
                      background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.15))',
                      border: '1px solid rgba(124,58,237,0.3)',
                      boxShadow: '0 0 40px rgba(124,58,237,0.1)',
                    }}
                  >
                    <Brain size={32} color="#a78bfa" />
                  </div>
                  <div className="text-[18px] font-bold text-white mb-2">Ready to talk</div>
                  <div className="text-[13px] max-w-md leading-relaxed" style={{ color: 'rgb(100,106,135)' }}>
                    Tap the mic and start speaking, or type below.
                    Discuss BD strategy, analyse companies, brainstorm outreach — the agent knows your full context.
                  </div>
                  <div className="mt-8 grid grid-cols-2 gap-3 max-w-sm w-full">
                    {[
                      'Which leads should I prioritize today?',
                      'What\'s our best outreach angle for DeFi protocols?',
                      'Tell me about our competitive advantage vs Ripple',
                      'Review our ICP — are we missing any verticals?',
                    ].map(prompt => (
                      <button
                        key={prompt}
                        onClick={() => sendMessage(prompt)}
                        className="text-left px-3 py-2.5 rounded-xl text-[11px] font-medium transition-all duration-150 hover:scale-[1.02]"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: 'rgb(160,165,195)',
                        }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message bubbles */}
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user'
                const isLast = idx === messages.length - 1
                return (
                  <div key={msg.id} className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
                    {!isUser && <AgentAvatar speaking={isSpeaking && isLast} />}
                    <div
                      className={cn('max-w-[70%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed')}
                      style={isUser ? {
                        background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(79,70,229,0.25))',
                        border: '1px solid rgba(124,58,237,0.3)',
                        color: 'rgb(220,225,255)',
                        borderBottomRightRadius: '6px',
                      } : {
                        background: 'rgba(20,22,33,0.95)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        color: 'rgb(200,205,230)',
                        borderBottomLeftRadius: '6px',
                      }}
                    >
                      {!isUser && isSpeaking && isLast && (
                        <div className="flex items-center gap-2 mb-2">
                          <WaveformBars active color="#a78bfa" />
                          <span className="text-[10px] font-semibold" style={{ color: '#a78bfa' }}>Speaking...</span>
                        </div>
                      )}
                      {msg.content}
                      <div className="text-[10px] mt-1.5" style={{ color: 'rgba(160,165,195,0.4)' }}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isUser && <span className="ml-1.5 inline-flex items-center gap-1"><Mic size={9} /></span>}
                      </div>
                    </div>
                    {isUser && (
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>
                        <span className="text-[14px]">👤</span>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Thinking state */}
              {isThinking && (
                <div className="flex gap-3">
                  <AgentAvatar speaking={false} />
                  <div className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-bl-md"
                    style={{ background: 'rgba(20,22,33,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full"
                          style={{
                            background: '#a78bfa',
                            animation: `waveBar 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
                          }} />
                      ))}
                    </div>
                    <span className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>Thinking...</span>
                  </div>
                </div>
              )}

              {/* Live interim transcript */}
              {isListening && transcript && (
                <div className="flex gap-3 justify-end">
                  <div className="max-w-[70%] px-4 py-3 rounded-2xl rounded-br-md text-[13px] italic"
                    style={{
                      background: 'rgba(124,58,237,0.1)',
                      border: '1px dashed rgba(124,58,237,0.3)',
                      color: 'rgba(167,139,250,0.7)',
                    }}>
                    {transcript}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ── Bottom Controls ──────────────────────────── */}
            <div style={{
              padding: '16px 32px 20px',
              background: 'rgba(10,11,16,0.95)',
              borderTop: '1px solid rgba(255,255,255,0.055)',
              flexShrink: 0,
            }}>
              {/* Extraction result banner */}
              {extractResult && !extractResult.error && (
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4"
                  style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)' }}
                >
                  <CheckCircle size={14} style={{ color: '#34d399', flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-semibold" style={{ color: '#34d399' }}>
                      Insights extracted — {extractResult.rules_created} rules · {extractResult.sources_created} sources
                    </span>
                    {extractResult.knowledge_title && (
                      <span className="text-[11px] ml-2" style={{ color: 'rgb(100,106,135)' }}>
                        → {extractResult.knowledge_title}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setExtractResult(null)}>
                    <X size={13} style={{ color: 'rgb(100,106,135)' }} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3">

                {/* Mic button */}
                {speechSupported && (
                  <button
                    onClick={toggleListening}
                    disabled={isThinking}
                    className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200"
                    style={{
                      background: isListening
                        ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
                        : 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(79,70,229,0.25))',
                      border: `1px solid ${isListening ? 'rgba(220,38,38,0.5)' : 'rgba(124,58,237,0.4)'}`,
                    }}
                    title={isListening ? 'Stop listening' : 'Tap to speak'}
                  >
                    {isListening
                      ? <Square size={16} color="white" />
                      : <Mic size={18} color="#a78bfa" />
                    }
                  </button>
                )}

                {/* Listening indicator */}
                {isListening && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)' }}>
                    <div className="w-2 h-2 rounded-full bg-red-500 status-pulse" />
                    <WaveformBars active color="#ef4444" />
                    <span className="text-[11px] font-semibold" style={{ color: '#ef4444' }}>Listening...</span>
                  </div>
                )}

                {/* Text input */}
                {!isListening && (
                  <>
                    <div className="flex-1 relative">
                      <input
                        ref={inputRef}
                        className="input-dark w-full"
                        style={{ fontSize: '13px', paddingRight: '44px', paddingLeft: '14px' }}
                        placeholder={speechSupported ? 'Type or tap mic to speak...' : 'Type your message...'}
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isThinking}
                      />
                    </div>
                    <button
                      onClick={() => sendMessage(inputText)}
                      disabled={!inputText.trim() || isThinking}
                      className="btn btn-primary flex-shrink-0"
                      style={{ padding: '11px 16px' }}
                    >
                      {isThinking
                        ? <Loader2 size={15} className="animate-spin" />
                        : <Send size={15} />
                      }
                    </button>
                  </>
                )}

                {/* Stop speaking */}
                {isSpeaking && (
                  <button
                    onClick={stopSpeaking}
                    className="flex-shrink-0 btn btn-secondary"
                    style={{ padding: '11px 12px' }}
                    title="Stop speaking"
                  >
                    <Square size={13} style={{ color: '#a78bfa' }} />
                  </button>
                )}
              </div>

              {/* Footer hint */}
              <div className="flex items-center justify-between mt-2.5">
                <div className="text-[11px]" style={{ color: 'rgb(70,75,95)' }}>
                  {speechSupported
                    ? 'Tap mic → speak → tap again to send  ·  or type and press Enter'
                    : 'Type your message and press Enter'}
                </div>
                <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'rgb(70,75,95)' }}>
                  <Sparkles size={10} style={{ color: '#a78bfa' }} />
                  GPT-4o · Nova voice
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Session Context Panel ─────────────── */}
          <div
            style={{
              width: '280px',
              flexShrink: 0,
              borderLeft: '1px solid rgba(255,255,255,0.055)',
              background: 'rgba(15,16,24,0.8)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Session info */}
            <div className="p-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.055)' }}>
              <div className="text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: 'rgb(100,106,135)' }}>
                Current Session
              </div>
              {currentSession ? (
                <div>
                  <div className="text-[13px] font-semibold text-white mb-1">{currentSession.title}</div>
                  <div className="text-[11px] flex items-center gap-2" style={{ color: 'rgb(100,106,135)' }}>
                    <MessageSquare size={10} />{messages.length} messages
                    <Clock size={10} />{formatDate(currentSession.created_at)}
                  </div>
                  {currentSession.knowledge_extracted && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: '#34d399' }}>
                      <CheckCircle size={11} /> Insights already extracted
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[12px]" style={{ color: 'rgb(100,106,135)' }}>
                  No session yet — start talking to begin
                </div>
              )}
            </div>

            {/* Extract insights CTA */}
            <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.055)' }}>
              <button
                onClick={extractInsights}
                disabled={isExtracting || !currentSession || messages.length < 2}
                className="btn w-full justify-center"
                style={{
                  padding: '10px 14px',
                  fontSize: '12px',
                  background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(52,211,153,0.1))',
                  border: '1px solid rgba(124,58,237,0.3)',
                  color: '#a78bfa',
                  opacity: (!currentSession || messages.length < 2) ? 0.4 : 1,
                }}
              >
                {isExtracting
                  ? <><Loader2 size={13} className="animate-spin" />Extracting...</>
                  : <><Download size={13} />Extract Insights</>
                }
              </button>
              <div className="text-[10px] mt-1.5 text-center" style={{ color: 'rgb(70,75,95)' }}>
                Saves session to agent memory & creates rules
              </div>
            </div>

            {/* Extraction result */}
            {extractResult && !extractResult.error && (
              <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.055)' }}>
                <div className="text-[11px] font-bold tracking-widest uppercase mb-2" style={{ color: 'rgb(100,106,135)' }}>
                  Extracted
                </div>
                <div className="text-[12px] leading-relaxed mb-2" style={{ color: 'rgb(140,145,175)' }}>
                  {extractResult.summary?.slice(0, 180)}
                </div>
                {extractResult.feedback_points?.slice(0, 3).map((p, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] mb-1" style={{ color: 'rgb(120,125,155)' }}>
                    <span style={{ color: '#34d399' }}>›</span>{p}
                  </div>
                ))}
              </div>
            )}

            {/* Stats */}
            <div className="p-4 space-y-3">
              <div className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'rgb(100,106,135)' }}>
                Agent Context
              </div>
              {[
                { icon: Brain,    label: 'Knowledge entries',  color: '#a78bfa' },
                { icon: Zap,      label: 'Active rules',       color: '#34d399' },
                { icon: BookOpen, label: 'Past sessions',      color: '#60a5fa' },
              ].map(({ icon: Icon, label, color }, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Icon size={13} style={{ color, flexShrink: 0 }} />
                  <span className="text-[12px]" style={{ color: 'rgb(140,145,175)' }}>{label}</span>
                  <span className="ml-auto text-[12px] font-bold tabular-nums" style={{ color }}>
                    {i === 0 ? '—' : i === 1 ? '—' : sessions.length}
                  </span>
                </div>
              ))}
            </div>

            {/* How to use tips */}
            <div className="p-4 mt-auto border-t" style={{ borderColor: 'rgba(255,255,255,0.055)' }}>
              <div className="text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: 'rgb(100,106,135)' }}>
                Tips
              </div>
              {[
                'Correct the agent when it\'s wrong — it learns',
                'Discuss a lead in detail before extracting',
                'Extract insights at the end of each session',
                'Resume any past session to continue context',
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px] mb-2" style={{ color: 'rgb(90,95,115)' }}>
                  <span style={{ color: 'rgb(90,95,115)', flexShrink: 0 }}>·</span>{tip}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
