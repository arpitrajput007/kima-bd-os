'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BookOpen, Upload, Link2, FileText, Image as ImageIcon,
  Zap, Loader2, CheckCircle, AlertCircle, Archive, Trash2,
  Tag, Clock, Brain, Sparkles, ChevronDown, ChevronUp, X,
  Plus, Globe, FileUp, MessageSquare, Database, Activity,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import type { AgentKnowledge } from '@/lib/types'

type InputMode = 'url' | 'text' | 'file' | 'image'

interface LearnResult {
  success: boolean
  title: string
  summary: string
  knowledge_type: string
  tags: string[]
  insights: string[]
  rules_created: number
  sources_created: number
  created_rules: string[]
  created_sources: string[]
  doc_meta?: string | null
  error?: string
}

interface ProcessStep {
  label: string
  done: boolean
  active: boolean
}

const KNOWLEDGE_TYPE_COLORS: Record<string, string> = {
  icp_signal:        'bg-violet-500/15 text-violet-300 border-violet-500/30',
  competitor_intel:  'bg-rose-500/15 text-rose-300 border-rose-500/30',
  market_trend:      'bg-blue-500/15 text-blue-300 border-blue-500/30',
  product_context:   'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  outreach_strategy: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  source_directory:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  general:           'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

const KNOWLEDGE_TYPE_LABELS: Record<string, string> = {
  icp_signal:        'ICP Signal',
  competitor_intel:  'Competitor Intel',
  market_trend:      'Market Trend',
  product_context:   'Product Context',
  outreach_strategy: 'Outreach Strategy',
  source_directory:  'Source Directory',
  general:           'General',
}

const MODE_CONFIG: {
  key: InputMode
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  hint: string
}[] = [
  { key: 'url',   label: 'URL',        icon: Globe,          hint: 'Paste any link — article, competitor page, news, LinkedIn post' },
  { key: 'text',  label: 'Text',       icon: MessageSquare,  hint: 'Paste raw notes, meeting transcripts, product docs, reports' },
  { key: 'file',  label: 'File',       icon: FileUp,         hint: 'Upload PDF, DOCX, DOC, TXT, MD, CSV — full content extracted' },
  { key: 'image', label: 'Screenshot', icon: ImageIcon,      hint: 'Drop any image — GPT-4o Vision reads and extracts all text' },
]

function StatCard({
  label, value, sub, icon: Icon, color, bg, border,
}: {
  label: string; value: number | string; sub?: string
  icon: React.ComponentType<{ size?: number; color?: string }>
  color: string; bg: string; border: string
}) {
  return (
    <div className="stat-card" style={{ borderColor: border }}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: bg }}>
          <Icon size={18} color={color} />
        </div>
      </div>
      <div className="text-[32px] font-bold tabular-nums leading-none mb-1.5 text-white">{value}</div>
      <div className="text-[12px] font-medium" style={{ color: 'rgb(110,115,145)' }}>{label}</div>
      {sub && <div className="text-[11px] mt-0.5 font-medium" style={{ color }}>{sub}</div>}
    </div>
  )
}

export default function LearnPage() {
  const supabase = createClient()
  const [mode, setMode]               = useState<InputMode>('url')
  const [urlInput, setUrlInput]       = useState('')
  const [textInput, setTextInput]     = useState('')
  const [file, setFile]               = useState<File | null>(null)
  const [imageFile, setImageFile]     = useState<File | null>(null)
  const [isDragging, setIsDragging]   = useState(false)
  const [isLearning, setIsLearning]   = useState(false)
  const [result, setResult]           = useState<LearnResult | null>(null)
  const [steps, setSteps]             = useState<ProcessStep[]>([])
  const [knowledgeItems, setKnowledgeItems] = useState<AgentKnowledge[]>([])
  const [loadingKnowledge, setLoadingKnowledge] = useState(true)
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const loadKnowledge = async () => {
    setLoadingKnowledge(true)
    const { data } = await supabase
      .from('agent_knowledge')
      .select('*')
      .order('created_at', { ascending: false })
    setKnowledgeItems(data || [])
    setLoadingKnowledge(false)
  }

  // Approval gate removed — drain any rules still stuck in pending_approval
  // from before so everything previously taught actually applies.
  const drainPendingRules = async () => {
    await supabase
      .from('agent_rules')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('status', 'pending_approval')
  }

  useEffect(() => { loadKnowledge(); drainPendingRules() }, []) // eslint-disable-line

  const activeItems   = knowledgeItems.filter(k => k.status === 'active')
  const archivedItems = knowledgeItems.filter(k => k.status === 'archived')
  const totalRules    = activeItems.reduce((s, k) => s + (k.rules_created || 0), 0)
  const totalSources  = activeItems.reduce((s, k) => s + (k.sources_created || 0), 0)

  const handleLearn = async () => {
    setResult(null)
    setIsLearning(true)
    const stepLabels = ['Extracting content', 'Synthesizing intelligence', 'Creating rules & sources', 'Saving to memory']
    setSteps(stepLabels.map((label, i) => ({ label, done: false, active: i === 0 })))
    const stepTimers = stepLabels.map((_, i) =>
      setTimeout(() => {
        setSteps(prev => prev.map((s, idx) => ({ ...s, done: idx < i, active: idx === i })))
      }, i * 2600)
    )
    try {
      let res: Response
      if (mode === 'file' && file) {
        const fd = new FormData(); fd.append('file', file); fd.append('type', 'file')
        res = await fetch('/api/ai/learn', { method: 'POST', body: fd })
      } else if (mode === 'image' && imageFile) {
        const fd = new FormData(); fd.append('file', imageFile); fd.append('type', 'image')
        res = await fetch('/api/ai/learn', { method: 'POST', body: fd })
      } else if (mode === 'url') {
        if (!urlInput.trim()) { toast.error('Please enter a URL'); setIsLearning(false); stepTimers.forEach(clearTimeout); return }
        res = await fetch('/api/ai/learn', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'url', content: urlInput.trim(), source_name: urlInput.trim() }),
        })
      } else if (mode === 'text') {
        if (!textInput.trim()) { toast.error('Please enter some text'); setIsLearning(false); stepTimers.forEach(clearTimeout); return }
        res = await fetch('/api/ai/learn', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'text', content: textInput.trim(), source_name: 'Manual input' }),
        })
      } else {
        toast.error('Please provide content to learn from'); setIsLearning(false); stepTimers.forEach(clearTimeout); return
      }
      stepTimers.forEach(clearTimeout)
      const data: LearnResult = await res.json()
      setSteps(stepLabels.map(label => ({ label, done: true, active: false })))
      if (data.error) { toast.error(data.error); setResult({ ...data, success: false }) }
      else {
        toast.success(
          data.rules_created > 0
            ? `Learned! ${data.rules_created} new rule${data.rules_created > 1 ? 's' : ''} now active`
            : 'Learned and saved to memory',
        )
        setResult(data)
        loadKnowledge()
        // scroll to the knowledge library after a brief delay
        setTimeout(() => suggestionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400)
      }
    } catch (e) {
      stepTimers.forEach(clearTimeout)
      toast.error('Learning failed — check console'); console.error(e)
    } finally { setIsLearning(false) }
  }

  const archiveKnowledge = async (id: string) => {
    await supabase.from('agent_knowledge').update({ status: 'archived' }).eq('id', id)
    toast.success('Archived'); loadKnowledge()
  }
  const deleteKnowledge = async (id: string) => {
    if (!confirm('Delete this knowledge entry?')) return
    await supabase.from('agent_knowledge').delete().eq('id', id)
    toast.success('Deleted'); loadKnowledge()
  }

  const onDrop = useCallback((e: React.DragEvent, isImage = false) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]; if (!f) return
    if (isImage) { setImageFile(f); setMode('image') }
    else { setFile(f); setMode('file') }
  }, [])

  const currentMode = MODE_CONFIG.find(m => m.key === mode)!

  return (
    <div className="fade-in">

      {/* ── Page Header ─────────────────────────────────── */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2.5">
            <Brain size={18} style={{ color: '#a78bfa' }} />
            Make Agent Learn
          </h1>
          <p className="text-[12px] mt-1 font-medium" style={{ color: 'rgb(100,106,135)' }}>
            Feed intelligence · Agent improves with every session · {activeItems.length} active memories
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
            style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.18)', color: '#34d399' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse" />
            Memory Active
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
            style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.18)', color: '#a78bfa' }}>
            <Sparkles size={12} />
            GPT-4o Vision
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────── */}
      <div style={{ padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* ── Stats Row ──────────────────────────────────── */}
        <div>
          <div className="text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: 'rgb(100,106,135)' }}>
            Memory Overview
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Active Memories"  value={activeItems.length}  icon={Brain}    color="#a78bfa" bg="rgba(167,139,250,0.1)"  border="rgba(167,139,250,0.18)" sub="injected into every run" />
            <StatCard label="Rules Created"    value={totalRules}          icon={Zap}      color="#34d399" bg="rgba(52,211,153,0.1)"   border="rgba(52,211,153,0.18)"  sub="from learning sessions" />
            <StatCard label="Sources Added"    value={totalSources}        icon={Database} color="#60a5fa" bg="rgba(96,165,250,0.1)"   border="rgba(96,165,250,0.18)"  sub="auto-discovered" />
            <StatCard label="Archived"         value={archivedItems.length} icon={Archive} color="#6b7280" bg="rgba(107,114,128,0.1)"  border="rgba(107,114,128,0.18)" />
          </div>
        </div>

        {/* ── Main Grid ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Left: Feed Panel (3/5) ─────────────────── */}
          <div className="lg:col-span-3 flex flex-col gap-5">

            {/* Input Card */}
            <div className="section-card" style={{ borderColor: 'rgba(124,58,237,0.2)' }}>
              {/* Card header */}
              <div className="section-card-header" style={{ background: 'rgba(124,58,237,0.04)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(79,70,229,0.3))', border: '1px solid rgba(124,58,237,0.4)' }}>
                    <Brain size={14} color="#a78bfa" />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-white">Feed Intelligence</div>
                    <div className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>
                      {currentMode.hint}
                    </div>
                  </div>
                </div>
                {/* Mode tabs */}
                <div className="flex gap-0.5 p-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {MODE_CONFIG.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setMode(key)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-150',
                        mode === key ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                      )}
                      style={mode === key ? {
                        background: 'linear-gradient(135deg, rgba(124,58,237,0.55), rgba(79,70,229,0.4))',
                        boxShadow: '0 1px 6px rgba(124,58,237,0.35)',
                      } : {}}
                    >
                      <Icon size={11} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input body */}
              <div className="p-5 space-y-4">

                {/* URL */}
                {mode === 'url' && (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2"
                        style={{ color: 'rgba(167,139,250,0.6)' }} />
                      <input
                        className="input-dark"
                        style={{ fontSize: '13px', paddingLeft: '36px' }}
                        placeholder="https://techcrunch.com/2025/fintech-raises..."
                        value={urlInput}
                        onChange={e => setUrlInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !isLearning) handleLearn() }}
                      />
                    </div>
                  </div>
                )}

                {/* Text */}
                {mode === 'text' && (
                  <div className="relative">
                    <FileText size={14} className="absolute left-3.5 top-3.5"
                      style={{ color: 'rgba(167,139,250,0.6)' }} />
                    <textarea
                      className="input-dark"
                      style={{ fontSize: '13px', paddingLeft: '36px', resize: 'vertical', minHeight: '130px' }}
                      placeholder="Paste meeting notes, competitor analysis, product docs, market research..."
                      value={textInput}
                      onChange={e => setTextInput(e.target.value)}
                    />
                  </div>
                )}

                {/* File drop zone */}
                {(mode === 'file' || mode === 'image') && (() => {
                  const isImg = mode === 'image'
                  const currentFile = isImg ? imageFile : file
                  const ref = isImg ? imageInputRef : fileInputRef
                  const accept = isImg ? 'image/*' : '.pdf,.docx,.doc,.txt,.md,.csv'
                  const acceptLabel = isImg ? '.png · .jpg · .jpeg · .webp' : '.pdf · .docx · .doc · .txt · .md · .csv'
                  const Icon = isImg ? ImageIcon : FileUp
                  return (
                    <div
                      className={cn('rounded-xl transition-all duration-200 cursor-pointer', isDragging && 'scale-[1.01]')}
                      style={{
                        border: `2px dashed ${isDragging ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.09)'}`,
                        background: isDragging ? 'rgba(124,58,237,0.07)' : 'rgba(0,0,0,0.25)',
                        minHeight: '140px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={e => onDrop(e, isImg)}
                      onClick={() => ref.current?.click()}
                    >
                      {currentFile ? (
                        <div className="flex items-center gap-3 p-4">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)' }}>
                            <Icon size={18} style={{ color: '#a78bfa' }} />
                          </div>
                          <div>
                            <div className="text-[13px] font-semibold text-white">{currentFile.name}</div>
                            <div className="text-[11px] mt-0.5" style={{ color: 'rgb(100,106,135)' }}>
                              {(currentFile.size / 1024).toFixed(1)} KB · Click to change
                            </div>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); isImg ? setImageFile(null) : setFile(null) }}
                            className="ml-3 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                          >
                            <X size={13} style={{ color: 'rgb(100,106,135)' }} />
                          </button>
                        </div>
                      ) : (
                        <div className="text-center p-6">
                          <Icon size={28} className="mx-auto mb-2.5" style={{ color: 'rgba(167,139,250,0.3)' }} />
                          <div className="text-[13px] font-semibold text-white mb-1">
                            Drop {isImg ? 'image' : 'file'} here or click to browse
                          </div>
                          <div className="text-[11px]" style={{ color: 'rgb(90,95,115)' }}>{acceptLabel}</div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* CTA Button */}
                <button
                  onClick={handleLearn}
                  disabled={isLearning}
                  className="btn btn-primary w-full justify-center"
                  style={{
                    padding: '13px 20px',
                    fontSize: '13px',
                    background: isLearning
                      ? 'rgba(124,58,237,0.35)'
                      : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                    boxShadow: isLearning ? 'none' : '0 4px 20px rgba(124,58,237,0.35)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {isLearning ? (
                    <><Loader2 size={15} className="animate-spin" />Agent is learning...</>
                  ) : (
                    <><Brain size={15} />Make Agent Learn<Sparkles size={13} style={{ opacity: 0.6 }} /></>
                  )}
                </button>
              </div>
            </div>

            {/* ── Pipeline Steps (shown while learning or after) ── */}
            {steps.length > 0 && (
              <div className="section-card">
                <div className="section-card-header">
                  <div className="flex items-center gap-2">
                    <Activity size={14} style={{ color: 'rgb(130,135,165)' }} />
                    <span className="text-[13px] font-semibold text-white">Learning Pipeline</span>
                  </div>
                  {steps.every(s => s.done) && (
                    <span className="badge" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', borderColor: 'rgba(52,211,153,0.25)', fontSize: '11px' }}>
                      Complete
                    </span>
                  )}
                </div>
                <div className="p-5 space-y-3">
                  {steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500',
                        step.done ? 'bg-emerald-500/15' : step.active ? 'bg-violet-500/15' : 'bg-white/4'
                      )}>
                        {step.done
                          ? <CheckCircle size={13} style={{ color: '#34d399' }} />
                          : step.active
                            ? <Loader2 size={13} className="animate-spin" style={{ color: '#a78bfa' }} />
                            : <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                        }
                      </div>
                      <div className="flex-1">
                        <span className={cn('text-[12px] font-medium',
                          step.done ? 'text-emerald-400' : step.active ? 'text-violet-300' : 'text-zinc-600')}>
                          {step.label}{step.active && '...'}
                        </span>
                      </div>
                      {step.done && (
                        <CheckCircle size={11} style={{ color: 'rgba(52,211,153,0.5)' }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Result Card ──────────────────────────────── */}
            {result && !isLearning && (
              <div className="section-card" style={{
                borderColor: result.success !== false ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)',
              }}>
                <div className="section-card-header" style={{
                  background: result.success !== false ? 'rgba(52,211,153,0.04)' : 'rgba(248,113,113,0.04)',
                }}>
                  <div className="flex items-center gap-2">
                    {result.error
                      ? <AlertCircle size={14} style={{ color: '#f87171' }} />
                      : <CheckCircle size={14} style={{ color: '#34d399' }} />
                    }
                    <span className="text-[13px] font-semibold" style={{ color: result.error ? '#f87171' : 'white' }}>
                      {result.error ? 'Learning Failed' : result.title}
                    </span>
                  </div>
                  {!result.error && result.knowledge_type && (
                    <span className={cn('badge', KNOWLEDGE_TYPE_COLORS[result.knowledge_type] || KNOWLEDGE_TYPE_COLORS.general)}
                      style={{ fontSize: '11px' }}>
                      {KNOWLEDGE_TYPE_LABELS[result.knowledge_type] || result.knowledge_type}
                    </span>
                  )}
                </div>

                <div className="p-5 space-y-4">
                  {result.error ? (
                    <p className="text-[13px]" style={{ color: 'rgba(248,113,113,0.8)' }}>{result.error}</p>
                  ) : (
                    <>
                      <p className="text-[12px] leading-relaxed" style={{ color: 'rgb(140,145,175)' }}>{result.summary}</p>

                      {/* Mini stat row */}
                      <div className="flex gap-3 flex-wrap">
                        {result.doc_meta && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                            style={{ background: 'rgba(34,211,238,0.08)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.2)' }}>
                            <FileUp size={11} />{result.doc_meta}
                          </div>
                        )}
                        {(result.insights?.length || 0) > 0 && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                            style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}>
                            <Brain size={11} />{result.insights.length} insights
                          </div>
                        )}
                        {result.rules_created > 0 && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                            style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
                            <Zap size={11} />{result.rules_created} new rules
                          </div>
                        )}
                        {result.sources_created > 0 && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                            style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>
                            <Plus size={11} />{result.sources_created} new sources
                          </div>
                        )}
                      </div>

                      {/* Insights list */}
                      {result.insights?.length > 0 && (
                        <div>
                          <div className="text-[11px] font-bold tracking-widest uppercase mb-2" style={{ color: 'rgb(100,106,135)' }}>
                            Key Insights
                          </div>
                          <div className="space-y-1.5">
                            {result.insights.map((insight, i) => (
                              <div key={i} className="flex items-start gap-2 text-[12px]" style={{ color: 'rgb(160,165,195)' }}>
                                <span className="mt-0.5 flex-shrink-0 font-bold" style={{ color: '#a78bfa' }}>›</span>
                                {insight}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Created rules */}
                      {result.created_rules?.length > 0 && (
                        <div>
                          <div className="text-[11px] font-bold tracking-widest uppercase mb-2" style={{ color: 'rgb(100,106,135)' }}>
                            Rules Created
                          </div>
                          <div className="space-y-1.5">
                            {result.created_rules.map((rule, i) => (
                              <div key={i} className="flex items-start gap-2 text-[12px] px-3 py-2 rounded-lg"
                                style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.12)', color: 'rgb(160,165,195)' }}>
                                <Zap size={11} style={{ color: '#34d399', marginTop: 1, flexShrink: 0 }} />{rule}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Created sources */}
                      {result.created_sources?.length > 0 && (
                        <div>
                          <div className="text-[11px] font-bold tracking-widest uppercase mb-2" style={{ color: 'rgb(100,106,135)' }}>
                            Sources Added
                          </div>
                          <div className="space-y-1.5">
                            {result.created_sources.map((src, i) => (
                              <div key={i} className="flex items-center gap-2 text-[12px] px-3 py-2 rounded-lg"
                                style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.12)', color: 'rgb(160,165,195)' }}>
                                <Globe size={11} style={{ color: '#60a5fa', flexShrink: 0 }} />{src}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: How it works + quick tips (2/5) ─── */}
          <div className="lg:col-span-2 flex flex-col gap-5">

            {/* How it works */}
            <div className="section-card" style={{ borderColor: 'rgba(124,58,237,0.15)' }}>
              <div className="section-card-header" style={{ background: 'rgba(124,58,237,0.04)' }}>
                <div className="flex items-center gap-2">
                  <Zap size={14} style={{ color: '#a78bfa' }} />
                  <span className="text-[13px] font-semibold" style={{ color: '#a78bfa' }}>How It Works</span>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {[
                  { step: '01', label: 'You feed content', desc: 'URL, text, file, or screenshot — any format', color: '#60a5fa' },
                  { step: '02', label: 'GPT-4o synthesizes', desc: 'Extracts Kima/Aeredium BD intelligence', color: '#a78bfa' },
                  { step: '03', label: 'Rules & sources saved', desc: 'Auto-creates agent rules & discovery sources', color: '#34d399' },
                  { step: '04', label: 'Memory injected', desc: 'Every future discovery run uses this knowledge', color: '#fbbf24' },
                ].map(({ step, label, desc, color }) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                      style={{ background: `rgba(${color === '#60a5fa' ? '96,165,250' : color === '#a78bfa' ? '167,139,250' : color === '#34d399' ? '52,211,153' : '251,191,36'},0.12)`, color }}>
                      {step}
                    </div>
                    <div>
                      <div className="text-[12px] font-semibold text-white">{label}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'rgb(100,106,135)' }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Best sources to feed */}
            <div className="section-card">
              <div className="section-card-header">
                <div className="flex items-center gap-2">
                  <BookOpen size={14} style={{ color: 'rgb(130,135,165)' }} />
                  <span className="text-[13px] font-semibold text-white">What to Feed</span>
                </div>
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {[
                  { icon: Globe,        label: 'Competitor websites',       sub: 'Ripple, Fireblocks, Transak...',   color: '#f87171' },
                  { icon: FileText,     label: 'News & funding articles',   sub: 'TechCrunch, DeFi Pulse, Decrypt', color: '#60a5fa' },
                  { icon: MessageSquare,label: 'Meeting notes',             sub: 'Call transcripts, notes, CRM',    color: '#34d399' },
                  { icon: FileUp,       label: 'PDF / DOCX / DOC files',   sub: 'Reports, whitepapers, proposals', color: '#22d3ee' },
                  { icon: ImageIcon,    label: 'Screenshots',               sub: 'Dashboards, slides, charts',      color: '#fbbf24' },
                  { icon: Upload,       label: 'CSV / prospect lists',      sub: 'Company lists, target accounts',  color: '#a78bfa' },
                ].map(({ icon: Icon, label, sub, color }) => (
                  <div key={label} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <Icon size={13} style={{ color }} />
                    </div>
                    <div>
                      <div className="text-[12px] font-semibold text-white">{label}</div>
                      <div className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>{sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── Knowledge Library ──────────────────────────── */}
        <div ref={suggestionsRef}>
          <div className="text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: 'rgb(100,106,135)' }}>
            Knowledge Library
          </div>

          <div className="section-card">
            <div className="section-card-header">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(124,58,237,0.12)' }}>
                  <Database size={14} style={{ color: '#a78bfa' }} />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white">Persistent Memory Store</div>
                  <div className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>
                    {activeItems.length} active entries · Injected into every discovery & research call
                  </div>
                </div>
              </div>
            </div>

            {loadingKnowledge ? (
              <div className="flex justify-center py-12">
                <Loader2 size={22} className="animate-spin" style={{ color: '#a78bfa' }} />
              </div>
            ) : activeItems.length === 0 ? (
              <div className="p-14 text-center">
                <Brain size={40} className="mx-auto mb-4 opacity-15" style={{ color: 'rgb(160,165,195)' }} />
                <div className="text-[14px] font-semibold text-white mb-2">No memories yet</div>
                <div className="text-[12px]" style={{ color: 'rgb(100,106,135)', lineHeight: '1.7' }}>
                  Feed the agent above — it remembers everything permanently
                  <br />and gets sharper with every learning session.
                </div>
              </div>
            ) : (
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Knowledge</th>
                    <th className="text-left">Type</th>
                    <th className="text-left">Tags</th>
                    <th className="text-center">Rules</th>
                    <th className="text-center">Sources</th>
                    <th className="text-left">Added</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {activeItems.map(item => (
                    <>
                      <tr
                        key={item.id}
                        className="cursor-pointer"
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      >
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.18)', color: '#a78bfa' }}>
                              {item.source_type === 'url' ? <Globe size={12} />
                                : item.source_type === 'image' || item.source_type === 'screenshot' ? <ImageIcon size={12} />
                                : item.source_type === 'file' ? <FileUp size={12} />
                                : <MessageSquare size={12} />}
                            </div>
                            <div>
                              <div className="text-[13px] font-semibold text-white">{item.title}</div>
                              {item.source_name && (
                                <div className="text-[11px] mono truncate max-w-[200px]" style={{ color: 'rgb(100,106,135)' }}>
                                  {item.source_name}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          {item.knowledge_type && (
                            <span className={cn('badge', KNOWLEDGE_TYPE_COLORS[item.knowledge_type] || KNOWLEDGE_TYPE_COLORS.general)}
                              style={{ fontSize: '10px' }}>
                              {KNOWLEDGE_TYPE_LABELS[item.knowledge_type] || item.knowledge_type}
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="flex gap-1 flex-wrap">
                            {(item.tags || []).slice(0, 3).map(tag => (
                              <span key={tag} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
                                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgb(120,125,155)' }}>
                                <Tag size={9} />{tag}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="text-center">
                          {(item.rules_created || 0) > 0
                            ? <span className="text-[12px] font-bold" style={{ color: '#34d399' }}>+{item.rules_created}</span>
                            : <span style={{ color: 'rgb(70,75,95)' }}>—</span>}
                        </td>
                        <td className="text-center">
                          {(item.sources_created || 0) > 0
                            ? <span className="text-[12px] font-bold" style={{ color: '#60a5fa' }}>+{item.sources_created}</span>
                            : <span style={{ color: 'rgb(70,75,95)' }}>—</span>}
                        </td>
                        <td>
                          <span className="flex items-center gap-1 text-[11px]" style={{ color: 'rgb(100,106,135)' }}>
                            <Clock size={10} />{formatDate(item.created_at)}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button className="btn btn-ghost" style={{ padding: '4px' }}
                              onClick={e => { e.stopPropagation(); setExpandedId(expandedId === item.id ? null : item.id) }}>
                              {expandedId === item.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                            <button className="btn btn-ghost" style={{ padding: '4px' }} title="Archive"
                              onClick={e => { e.stopPropagation(); archiveKnowledge(item.id) }}>
                              <Archive size={13} />
                            </button>
                            <button className="btn btn-ghost" style={{ padding: '4px', color: '#f87171' }} title="Delete"
                              onClick={e => { e.stopPropagation(); deleteKnowledge(item.id) }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === item.id && (
                        <tr key={`${item.id}-expanded`}>
                          <td colSpan={7} style={{ padding: '0 18px 16px' }}>
                            <div className="text-[12px] leading-relaxed whitespace-pre-wrap rounded-lg p-4"
                              style={{
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(124,58,237,0.15)',
                                color: 'rgb(140,145,175)',
                                maxHeight: '200px',
                                overflowY: 'auto',
                              }}>
                              {item.content}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Archived */}
        {archivedItems.length > 0 && (
          <div>
            <div className="text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: 'rgb(60,65,80)' }}>
              Archived ({archivedItems.length})
            </div>
            <div className="space-y-1.5">
              {archivedItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 rounded-xl opacity-35"
                  style={{ background: 'rgba(20,20,30,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-[12px] text-white line-through flex-1">{item.title}</span>
                  <span className="text-[11px]" style={{ color: 'rgb(70,70,90)' }}>{formatDate(item.created_at)}</span>
                  <button className="btn btn-ghost" style={{ padding: '3px', color: '#f87171' }}
                    onClick={() => deleteKnowledge(item.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input ref={fileInputRef}  type="file" accept=".pdf,.docx,.doc,.txt,.md,.csv" className="hidden"
        onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]) }} />
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files?.[0]) setImageFile(e.target.files[0]) }} />
    </div>
  )
}
