'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BookOpen, Upload, Link2, FileText, Image as ImageIcon,
  Zap, Loader2, CheckCircle, AlertCircle, Archive, Trash2,
  Tag, Clock, Brain, Sparkles, ChevronDown, ChevronUp, X,
  Plus, Globe, FileUp, MessageSquare
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
  error?: string
}

interface ProcessStep {
  label: string
  done: boolean
  active: boolean
}

const KNOWLEDGE_TYPE_COLORS: Record<string, string> = {
  icp_signal: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  competitor_intel: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  market_trend: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  product_context: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  outreach_strategy: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  source_directory: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  general: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

const KNOWLEDGE_TYPE_LABELS: Record<string, string> = {
  icp_signal: 'ICP Signal',
  competitor_intel: 'Competitor Intel',
  market_trend: 'Market Trend',
  product_context: 'Product Context',
  outreach_strategy: 'Outreach Strategy',
  source_directory: 'Source Directory',
  general: 'General',
}

const SOURCE_TYPE_ICONS: Record<string, React.ReactNode> = {
  url: <Globe size={13} />,
  text: <MessageSquare size={13} />,
  file: <FileUp size={13} />,
  image: <ImageIcon size={13} />,
  screenshot: <ImageIcon size={13} />,
}

export default function LearnPage() {
  const supabase = createClient()
  const [mode, setMode] = useState<InputMode>('url')
  const [urlInput, setUrlInput] = useState('')
  const [textInput, setTextInput] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLearning, setIsLearning] = useState(false)
  const [result, setResult] = useState<LearnResult | null>(null)
  const [steps, setSteps] = useState<ProcessStep[]>([])
  const [knowledgeItems, setKnowledgeItems] = useState<AgentKnowledge[]>([])
  const [loadingKnowledge, setLoadingKnowledge] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const loadKnowledge = async () => {
    setLoadingKnowledge(true)
    const { data } = await supabase
      .from('agent_knowledge')
      .select('*')
      .order('created_at', { ascending: false })
    setKnowledgeItems(data || [])
    setLoadingKnowledge(false)
  }

  useEffect(() => { loadKnowledge() }, []) // eslint-disable-line

  const handleLearn = async () => {
    setResult(null)
    setIsLearning(true)

    const stepLabels = ['Extracting content', 'Synthesizing intelligence', 'Creating rules & sources', 'Saving to memory']
    setSteps(stepLabels.map((label, i) => ({ label, done: false, active: i === 0 })))

    // Simulate step progression
    const stepTimers = stepLabels.map((_, i) =>
      setTimeout(() => {
        setSteps(prev => prev.map((s, idx) => ({
          ...s,
          done: idx < i,
          active: idx === i,
        })))
      }, i * 2500)
    )

    try {
      let res: Response

      if (mode === 'file' && file) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('type', 'file')
        res = await fetch('/api/ai/learn', { method: 'POST', body: fd })
      } else if (mode === 'image' && imageFile) {
        const fd = new FormData()
        fd.append('file', imageFile)
        fd.append('type', 'image')
        res = await fetch('/api/ai/learn', { method: 'POST', body: fd })
      } else if (mode === 'url') {
        if (!urlInput.trim()) { toast.error('Please enter a URL'); setIsLearning(false); stepTimers.forEach(clearTimeout); return }
        res = await fetch('/api/ai/learn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'url', content: urlInput.trim(), source_name: urlInput.trim() }),
        })
      } else if (mode === 'text') {
        if (!textInput.trim()) { toast.error('Please enter some text'); setIsLearning(false); stepTimers.forEach(clearTimeout); return }
        res = await fetch('/api/ai/learn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'text', content: textInput.trim(), source_name: 'Manual input' }),
        })
      } else {
        toast.error('Please provide content to learn from')
        setIsLearning(false)
        stepTimers.forEach(clearTimeout)
        return
      }

      stepTimers.forEach(clearTimeout)
      const data: LearnResult = await res.json()

      setSteps(stepLabels.map(label => ({ label, done: true, active: false })))

      if (data.error) {
        toast.error(data.error)
        setResult({ ...data, success: false })
      } else {
        toast.success(`Learned! Created ${data.rules_created} rules & ${data.sources_created} sources`)
        setResult(data)
        loadKnowledge()
      }
    } catch (e) {
      stepTimers.forEach(clearTimeout)
      toast.error('Learning failed — check console')
      console.error(e)
    } finally {
      setIsLearning(false)
    }
  }

  const archiveKnowledge = async (id: string) => {
    await supabase.from('agent_knowledge').update({ status: 'archived' }).eq('id', id)
    toast.success('Archived')
    loadKnowledge()
  }

  const deleteKnowledge = async (id: string) => {
    if (!confirm('Delete this knowledge entry?')) return
    await supabase.from('agent_knowledge').delete().eq('id', id)
    toast.success('Deleted')
    loadKnowledge()
  }

  const onFileDrop = useCallback((e: React.DragEvent, isImage = false) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (!f) return
    if (isImage) {
      setImageFile(f)
      setMode('image')
    } else {
      setFile(f)
      setMode('file')
    }
  }, [])

  const activeItems = knowledgeItems.filter(k => k.status === 'active')
  const archivedItems = knowledgeItems.filter(k => k.status === 'archived')

  return (
    <div className="fade-in">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Brain size={20} style={{ color: '#a78bfa' }} />
            Make Agent Learn
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>
            {activeItems.length} active knowledge entries · Feed the agent — it gets smarter with every session
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa' }}>
          <Sparkles size={12} />
          GPT-4o Powered
        </div>
      </div>

      <div className="p-8 space-y-8">

        {/* ── Hero Card ───────────────────────────────── */}
        <div
          className="relative rounded-2xl overflow-hidden p-8"
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(79,70,229,0.08), rgba(14,14,22,0.95))',
            border: '1px solid rgba(124,58,237,0.25)',
            boxShadow: '0 0 60px rgba(124,58,237,0.07) inset',
          }}
        >
          {/* Glow orb */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />

          <div className="relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(79,70,229,0.3))', border: '1px solid rgba(124,58,237,0.4)', boxShadow: '0 4px 20px rgba(124,58,237,0.3)' }}>
                <Brain size={22} color="#a78bfa" />
              </div>
              <div>
                <div className="text-white font-bold text-base">Feed Your Agent Intelligence</div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(167,139,250,0.7)' }}>
                  Files · URLs · Text · Screenshots — any format, permanent memory
                </div>
              </div>
            </div>

            {/* Input Mode Tabs */}
            <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', width: 'fit-content' }}>
              {([
                { key: 'url', label: 'URL', icon: Globe },
                { key: 'text', label: 'Text', icon: MessageSquare },
                { key: 'file', label: 'File', icon: FileUp },
                { key: 'image', label: 'Image', icon: ImageIcon },
              ] as { key: InputMode; label: string; icon: React.ComponentType<{ size?: number }> }[]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200',
                    mode === key
                      ? 'text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  )}
                  style={mode === key ? {
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.5), rgba(79,70,229,0.4))',
                    boxShadow: '0 2px 8px rgba(124,58,237,0.3)',
                  } : {}}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>

            {/* Input Area */}
            <div className="space-y-4">

              {/* URL Mode */}
              {mode === 'url' && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Link2 size={13} style={{ color: 'rgba(167,139,250,0.7)' }} />
                    <span className="text-xs font-medium" style={{ color: 'rgb(160,160,180)' }}>
                      Paste any URL — article, blog, competitor page, LinkedIn post, news
                    </span>
                  </div>
                  <input
                    className="input-dark w-full"
                    style={{ fontSize: '13px' }}
                    placeholder="https://techcrunch.com/2025/..."
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !isLearning) handleLearn() }}
                  />
                </div>
              )}

              {/* Text Mode */}
              {mode === 'text' && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={13} style={{ color: 'rgba(167,139,250,0.7)' }} />
                    <span className="text-xs font-medium" style={{ color: 'rgb(160,160,180)' }}>
                      Paste notes, conversations, reports, product docs, or any raw text
                    </span>
                  </div>
                  <textarea
                    className="input-dark w-full"
                    style={{ fontSize: '13px', resize: 'vertical', minHeight: '120px' }}
                    placeholder="Paste your intelligence here — competitor analysis, market research, meeting notes, product context..."
                    value={textInput}
                    onChange={e => setTextInput(e.target.value)}
                  />
                </div>
              )}

              {/* File Mode */}
              {mode === 'file' && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Upload size={13} style={{ color: 'rgba(167,139,250,0.7)' }} />
                    <span className="text-xs font-medium" style={{ color: 'rgb(160,160,180)' }}>
                      Upload PDF, TXT, MD, or CSV files
                    </span>
                  </div>
                  <div
                    className={cn('rounded-xl p-8 text-center cursor-pointer transition-all duration-200', isDragging && 'scale-[1.01]')}
                    style={{
                      border: `2px dashed ${isDragging ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.1)'}`,
                      background: isDragging ? 'rgba(124,58,237,0.08)' : 'rgba(0,0,0,0.2)',
                    }}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={e => onFileDrop(e, false)}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {file ? (
                      <div className="flex items-center justify-center gap-3">
                        <FileText size={20} style={{ color: '#a78bfa' }} />
                        <div className="text-left">
                          <div className="text-sm font-semibold text-white">{file.name}</div>
                          <div className="text-xs" style={{ color: 'rgb(100,100,120)' }}>
                            {(file.size / 1024).toFixed(1)} KB · Click to change
                          </div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); setFile(null) }}
                          className="ml-2 p-1 rounded-lg hover:bg-white/10 transition-colors">
                          <X size={13} style={{ color: 'rgb(100,100,120)' }} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <FileUp size={28} className="mx-auto mb-3 opacity-30" style={{ color: '#a78bfa' }} />
                        <div className="text-sm font-medium text-white mb-1">Drop file here or click to browse</div>
                        <div className="text-xs" style={{ color: 'rgb(100,100,120)' }}>.pdf · .txt · .md · .csv</div>
                      </>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.csv,.doc,.docx" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]) }} />
                </div>
              )}

              {/* Image Mode */}
              {mode === 'image' && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ImageIcon size={13} style={{ color: 'rgba(167,139,250,0.7)' }} />
                    <span className="text-xs font-medium" style={{ color: 'rgb(160,160,180)' }}>
                      Drop screenshots, charts, whitepapers, or any image — GPT-4o Vision reads it
                    </span>
                  </div>
                  <div
                    className={cn('rounded-xl p-8 text-center cursor-pointer transition-all duration-200', isDragging && 'scale-[1.01]')}
                    style={{
                      border: `2px dashed ${isDragging ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.1)'}`,
                      background: isDragging ? 'rgba(124,58,237,0.08)' : 'rgba(0,0,0,0.2)',
                    }}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={e => onFileDrop(e, true)}
                    onClick={() => imageInputRef.current?.click()}
                  >
                    {imageFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <ImageIcon size={20} style={{ color: '#a78bfa' }} />
                        <div className="text-left">
                          <div className="text-sm font-semibold text-white">{imageFile.name}</div>
                          <div className="text-xs" style={{ color: 'rgb(100,100,120)' }}>
                            {(imageFile.size / 1024).toFixed(1)} KB · Click to change
                          </div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); setImageFile(null) }}
                          className="ml-2 p-1 rounded-lg hover:bg-white/10 transition-colors">
                          <X size={13} style={{ color: 'rgb(100,100,120)' }} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <ImageIcon size={28} className="mx-auto mb-3 opacity-30" style={{ color: '#a78bfa' }} />
                        <div className="text-sm font-medium text-white mb-1">Drop image here or click to browse</div>
                        <div className="text-xs" style={{ color: 'rgb(100,100,120)' }}>.png · .jpg · .jpeg · .webp · .gif</div>
                      </>
                    )}
                  </div>
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) setImageFile(e.target.files[0]) }} />
                </div>
              )}

              {/* CTA */}
              <button
                onClick={handleLearn}
                disabled={isLearning}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 relative overflow-hidden"
                style={{
                  background: isLearning
                    ? 'rgba(124,58,237,0.3)'
                    : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  color: 'white',
                  boxShadow: isLearning ? 'none' : '0 4px 24px rgba(124,58,237,0.4)',
                  border: '1px solid rgba(124,58,237,0.5)',
                  opacity: isLearning ? 0.8 : 1,
                }}
              >
                {isLearning ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Agent is learning...
                  </>
                ) : (
                  <>
                    <Brain size={16} />
                    Make Agent Learn
                    <Sparkles size={14} style={{ opacity: 0.7 }} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Processing Steps ─────────────────────────── */}
        {(isLearning || (steps.length > 0 && steps.every(s => s.done))) && (
          <div className="rounded-xl p-5 space-y-3"
            style={{ background: 'rgba(14,14,22,0.9)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-xs font-bold tracking-widest uppercase" style={{ color: 'rgb(100,100,120)' }}>
              Learning Pipeline
            </div>
            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={cn('w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500',
                    step.done ? 'bg-emerald-500/20' : step.active ? 'bg-violet-500/20' : 'bg-white/5')}>
                    {step.done
                      ? <CheckCircle size={12} style={{ color: '#34d399' }} />
                      : step.active
                        ? <Loader2 size={12} className="animate-spin" style={{ color: '#a78bfa' }} />
                        : <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                    }
                  </div>
                  <span className={cn('text-xs font-medium',
                    step.done ? 'text-emerald-400' : step.active ? 'text-violet-300' : 'text-zinc-600')}>
                    {step.label}
                    {step.active && '...'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Result Card ──────────────────────────────── */}
        {result && !isLearning && (
          <div className="rounded-xl overflow-hidden"
            style={{
              background: result.success !== false ? 'rgba(52,211,153,0.04)' : 'rgba(248,113,113,0.04)',
              border: `1px solid ${result.success !== false ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`,
            }}>
            <div className="p-5">
              {result.error ? (
                <div className="flex items-start gap-3">
                  <AlertCircle size={16} style={{ color: '#f87171', flexShrink: 0 }} />
                  <div>
                    <div className="text-sm font-semibold" style={{ color: '#f87171' }}>Learning Failed</div>
                    <div className="text-xs mt-1" style={{ color: 'rgba(248,113,113,0.8)' }}>{result.error}</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Success header */}
                  <div className="flex items-start gap-3">
                    <CheckCircle size={16} style={{ color: '#34d399', flexShrink: 0, marginTop: 2 }} />
                    <div className="flex-1">
                      <div className="text-sm font-bold text-white">{result.title}</div>
                      <div className="text-xs mt-1 leading-relaxed" style={{ color: 'rgb(140,145,175)' }}>{result.summary}</div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex flex-wrap gap-3">
                    {result.insights?.length > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}>
                        <Brain size={12} />
                        {result.insights.length} insights extracted
                      </div>
                    )}
                    {result.rules_created > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
                        <Zap size={12} />
                        {result.rules_created} new rules created
                      </div>
                    )}
                    {result.sources_created > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>
                        <Plus size={12} />
                        {result.sources_created} new sources added
                      </div>
                    )}
                  </div>

                  {/* Insights */}
                  {result.insights?.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold" style={{ color: 'rgb(100,100,120)' }}>Key Insights</div>
                      {result.insights.map((insight, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs" style={{ color: 'rgb(160,165,195)' }}>
                          <span className="mt-1 flex-shrink-0" style={{ color: '#a78bfa' }}>›</span>
                          {insight}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Created rules */}
                  {result.created_rules?.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold" style={{ color: 'rgb(100,100,120)' }}>New Agent Rules</div>
                      {result.created_rules.map((rule, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg"
                          style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)', color: 'rgb(160,165,195)' }}>
                          <Zap size={11} style={{ color: '#34d399', marginTop: 1, flexShrink: 0 }} />
                          {rule}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Created sources */}
                  {result.created_sources?.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold" style={{ color: 'rgb(100,100,120)' }}>New Discovery Sources</div>
                      {result.created_sources.map((src, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                          style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)', color: 'rgb(160,165,195)' }}>
                          <Globe size={11} style={{ color: '#60a5fa', flexShrink: 0 }} />
                          {src}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Knowledge Library ────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-bold text-white">Knowledge Library</div>
              <div className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>
                {activeItems.length} active entries injected into every future discovery run
              </div>
            </div>
            {archivedItems.length > 0 && (
              <span className="text-xs" style={{ color: 'rgb(90,90,110)' }}>{archivedItems.length} archived</span>
            )}
          </div>

          {loadingKnowledge ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin" style={{ color: '#a78bfa' }} />
            </div>
          ) : activeItems.length === 0 ? (
            <div className="rounded-xl p-12 text-center"
              style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <BookOpen size={32} className="mx-auto mb-3 opacity-20" style={{ color: 'rgb(140,140,160)' }} />
              <div className="text-sm font-medium text-white mb-1">No knowledge yet</div>
              <div className="text-xs" style={{ color: 'rgb(100,100,120)' }}>
                Feed the agent above — it will remember everything and get smarter over time
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {activeItems.map(item => (
                <div
                  key={item.id}
                  className="rounded-xl overflow-hidden transition-all duration-200"
                  style={{ background: 'rgba(20,20,30,0.85)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  {/* Main row */}
                  <div className="flex items-start gap-4 p-4">
                    {/* Source type icon */}
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)', color: '#a78bfa' }}>
                      {SOURCE_TYPE_ICONS[item.source_type || 'text'] || <FileText size={13} />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-white">{item.title}</span>
                        {item.knowledge_type && (
                          <span className={cn('badge text-[10px]', KNOWLEDGE_TYPE_COLORS[item.knowledge_type] || KNOWLEDGE_TYPE_COLORS.general)}>
                            {KNOWLEDGE_TYPE_LABELS[item.knowledge_type] || item.knowledge_type}
                          </span>
                        )}
                      </div>

                      {/* Tags */}
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap mb-2">
                          <Tag size={10} style={{ color: 'rgb(90,90,110)' }} />
                          {item.tags.map(tag => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgb(120,120,150)' }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: 'rgb(90,90,110)' }}>
                        {item.source_name && (
                          <span className="truncate max-w-[200px] mono">{item.source_name}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {formatDate(item.created_at)}
                        </span>
                        {(item.rules_created || 0) > 0 && (
                          <span style={{ color: '#34d399' }}>⚡ {item.rules_created} rules</span>
                        )}
                        {(item.sources_created || 0) > 0 && (
                          <span style={{ color: '#60a5fa' }}>🔍 {item.sources_created} sources</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        className="btn btn-ghost" style={{ padding: '4px 6px', fontSize: '11px', gap: '4px' }}>
                        {expandedId === item.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                      <button onClick={() => archiveKnowledge(item.id)} className="btn btn-ghost" style={{ padding: '4px' }} title="Archive">
                        <Archive size={13} />
                      </button>
                      <button onClick={() => deleteKnowledge(item.id)} className="btn btn-ghost" style={{ padding: '4px', color: '#f87171' }} title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {expandedId === item.id && (
                    <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="mt-3 text-xs leading-relaxed whitespace-pre-wrap rounded-lg p-4"
                        style={{ background: 'rgba(0,0,0,0.3)', color: 'rgb(160,165,195)', border: '1px solid rgba(255,255,255,0.05)', maxHeight: '300px', overflowY: 'auto' }}>
                        {item.content}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Archived section */}
        {archivedItems.length > 0 && (
          <div>
            <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: 'rgb(70,70,90)' }}>
              Archived ({archivedItems.length})
            </div>
            <div className="space-y-2">
              {archivedItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 rounded-xl opacity-40"
                  style={{ background: 'rgba(20,20,30,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-white line-through">{item.title}</span>
                    <span className="text-xs ml-2" style={{ color: 'rgb(70,70,90)' }}>· {formatDate(item.created_at)}</span>
                  </div>
                  <button onClick={() => deleteKnowledge(item.id)} className="btn btn-ghost" style={{ padding: '3px', color: '#f87171' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
