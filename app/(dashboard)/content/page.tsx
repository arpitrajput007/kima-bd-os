'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Sparkles, Copy, RefreshCw, Loader2,
  Link2, CheckCheck, Image, Download,
  Zap, Hash, AlignLeft, AtSign, MessageCircle, X,
  Bookmark, BookmarkCheck, Trash2, ChevronDown, ChevronUp,
  Clock, CheckCircle2, Filter, History, RotateCcw,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────
interface ContentPost { id: string; text: string }
interface ContentResult {
  incident_summary: string
  root_cause: string
  kima_angle: string
  tweets: ContentPost[]
  thread: ContentPost[]
  linkedin: ContentPost[]
}
type TabKey     = 'tweets' | 'thread' | 'linkedin'
type PageView   = 'create' | 'saved' | 'sessions'
type PostType   = 'tweet' | 'linkedin' | 'thread_tweet'
type DraftStatus = 'saved' | 'posted'
type FilterType  = 'all' | 'tweet' | 'linkedin' | 'thread_tweet'

interface ContentDraft {
  id: string
  post_type: PostType
  text: string
  hook: string | null
  incident_summary: string | null
  root_cause: string | null
  kima_angle: string | null
  status: DraftStatus
  notes: string | null
  posted_at: string | null
  created_at: string
}

interface ContentSession {
  id: string
  source_url: string | null
  news_context: string | null
  incident_summary: string | null
  root_cause: string | null
  kima_angle: string | null
  tweets: ContentPost[]
  thread: ContentPost[]
  linkedin: ContentPost[]
  created_at: string
}

interface GraphicState {
  loading: boolean
  url: string | null
}

// ── Copy hook ──────────────────────────────────────────────────────────────────
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 1600)
  }
  return { copied, copy }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function CharBadge({ text }: { text: string }) {
  return (
    <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 600, color: 'rgba(255,255,255,0.2)' }}>
      {text.length} chars
    </span>
  )
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const TYPE_CFG: Record<PostType, { label: string; color: string; bg: string; border: string }> = {
  tweet:        { label: 'X / Tweet',   color: '#1da1f2', bg: 'rgba(29,161,242,0.08)',  border: 'rgba(29,161,242,0.2)' },
  linkedin:     { label: 'LinkedIn',    color: '#60a5fa', bg: 'rgba(10,102,194,0.08)',  border: 'rgba(10,102,194,0.25)' },
  thread_tweet: { label: 'Thread',      color: '#818cf8', bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.2)' },
}

// ── Graphic button ─────────────────────────────────────────────────────────────
function GraphicBtn({ postId, gs, onGenerate }: {
  postId: string; gs: GraphicState | undefined; onGenerate: (id: string) => void
}) {
  return (
    <button
      onClick={() => onGenerate(postId)}
      disabled={gs?.loading}
      title="Generate a DALL-E 3 graphic"
      style={{
        background: gs?.url ? 'rgba(167,139,250,0.12)' : 'none',
        border: gs?.url ? '1px solid rgba(167,139,250,0.25)' : 'none',
        borderRadius: 6, padding: gs?.url ? '2px 8px' : '2px 4px',
        cursor: gs?.loading ? 'default' : 'pointer',
        color: gs?.url ? '#a78bfa' : 'rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600,
      }}
    >
      {gs?.loading ? <Loader2 size={10} className="animate-spin" /> : <Image size={10} />}
      {gs?.loading ? 'Generating…' : gs?.url ? 'Graphic ✓' : 'Graphic'}
    </button>
  )
}

// ── Graphic modal ──────────────────────────────────────────────────────────────
function GraphicModal({ url, hook, onClose }: { url: string; hook: string; onClose: () => void }) {
  const [dl, setDl] = useState(false)
  const download = async () => {
    try {
      setDl(true)
      const res  = await fetch(url)
      const blob = await res.blob()
      const a    = document.createElement('a')
      a.href     = URL.createObjectURL(blob)
      a.download = `kima-graphic-${Date.now()}.png`
      a.click()
    } catch { toast.error('Download failed — right-click to save') }
    finally  { setDl(false) }
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ maxWidth: 780, width: '100%', borderRadius: 18, background: 'rgba(14,15,24,0.95)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Image size={11} color="#a78bfa" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Generated Graphic</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>DALL-E 3 · HD</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={download} disabled={dl} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa' }}>
              {dl ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />} Download
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex', padding: 4 }}><X size={16} /></button>
          </div>
        </div>
        <div style={{ position: 'relative', background: '#000' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Generated graphic" style={{ width: '100%', display: 'block', maxHeight: '60vh', objectFit: 'contain' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)', padding: '40px 24px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'white', lineHeight: 1.55, maxWidth: '80%', whiteSpace: 'pre-wrap' }}>{hook.slice(0, 200)}{hook.length > 200 ? '…' : ''}</div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: 'rgba(167,139,250,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Zap size={9} color="white" fill="white" /></div>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Kima BD OS</span>
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', lineHeight: 1.5 }}>Download the image and add your text in Canva or Figma. The overlay above is a preview only.</p>
        </div>
      </div>
    </div>
  )
}

// ── Section renderer (shared by Tweet + LinkedIn cards) ───────────────────────
function SectionBody({ text, accentColor }: { text: string; accentColor: string }) {
  const sections = text.split(/\n\n+/)
  return (
    <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {sections.map((s, i) => (
        <div key={i}>
          {i > 0 && <div style={{ height: 1, background: `${accentColor}18`, marginBottom: 14 }} />}
          <div style={{ fontSize: i === 0 ? 15 : 13.5, fontWeight: i === 0 ? 600 : 400, lineHeight: i === 0 ? 1.6 : 1.75, color: i === 0 ? 'rgb(235,240,255)' : 'rgb(200,208,232)', fontFamily: 'Inter, sans-serif', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{s}</div>
        </div>
      ))}
    </div>
  )
}

// ── Tweet card ─────────────────────────────────────────────────────────────────
function TweetCard({ post, index, copied, onCopy, gs, onGenerateGraphic, onViewGraphic, onSave, savedId }: {
  post: ContentPost; index: number; copied: string | null
  onCopy: (id: string, text: string) => void
  gs: GraphicState | undefined
  onGenerateGraphic: (id: string) => void
  onViewGraphic: (id: string) => void
  onSave: (post: ContentPost, type: PostType) => void
  savedId: string | null   // null = not saved yet, string = already saved
}) {
  const isCopied = copied === post.id
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(29,161,242,0.2)', background: 'rgba(10,12,22,0.8)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(29,161,242,0.05)', borderBottom: '1px solid rgba(29,161,242,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <AtSign size={11} color="#1da1f2" />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', color: '#1da1f2', textTransform: 'uppercase' }}>Post V{index + 1}</span>
          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(29,161,242,0.1)', border: '1px solid rgba(29,161,242,0.2)', color: 'rgba(29,161,242,0.7)', fontWeight: 700 }}>Premium</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CharBadge text={post.text} />
          {gs?.url
            ? <button onClick={() => onViewGraphic(post.id)} style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600 }}><Image size={10} /> View Graphic</button>
            : <GraphicBtn postId={post.id} gs={gs} onGenerate={onGenerateGraphic} />
          }
          <button onClick={() => savedId ? null : onSave(post, 'tweet')} title={savedId ? 'Saved to drafts' : 'Save to drafts'} style={{ background: 'none', border: 'none', cursor: savedId ? 'default' : 'pointer', color: savedId ? '#34d399' : 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600 }}>
            {savedId ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
            {savedId ? 'Saved' : 'Save'}
          </button>
          <button onClick={() => onCopy(post.id, post.text)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isCopied ? '#1da1f2' : 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}>
            {isCopied ? <CheckCheck size={11} /> : <Copy size={11} />}
            {isCopied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <SectionBody text={post.text} accentColor="#1da1f2" />
    </div>
  )
}

// ── Thread card ────────────────────────────────────────────────────────────────
function ThreadView({ thread, copied, onCopy, onSave, savedIds }: {
  thread: ContentPost[]; copied: string | null
  onCopy: (id: string, text: string) => void
  onSave: (post: ContentPost, type: PostType) => void
  savedIds: Record<string, string | null>
}) {
  const fullThread = thread.map(t => t.text).join('\n\n')
  const allCopied  = copied === 'thread_all'
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(29,161,242,0.2)', background: 'rgba(10,12,22,0.8)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', background: 'rgba(29,161,242,0.05)', borderBottom: '1px solid rgba(29,161,242,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Hash size={11} color="#1da1f2" />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', color: '#1da1f2', textTransform: 'uppercase' }}>Thread · {thread.length} tweets</span>
        </div>
        <button onClick={() => onCopy('thread_all', fullThread)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: allCopied ? '#1da1f2' : 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}>
          {allCopied ? <CheckCheck size={11} /> : <Copy size={11} />} Copy all
        </button>
      </div>
      <div style={{ padding: '8px 0' }}>
        {thread.map((post, i) => {
          const isCopied = copied === post.id
          const isLast   = i === thread.length - 1
          const isSaved  = !!savedIds[post.id]
          return (
            <div key={post.id} style={{ display: 'flex', gap: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingLeft: 20, paddingRight: 14, paddingTop: 4 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(29,161,242,0.1)', border: '1px solid rgba(29,161,242,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#1da1f2' }}>{i + 1}</span>
                </div>
                {!isLast && <div style={{ width: 1, flex: 1, minHeight: 16, background: 'rgba(29,161,242,0.15)', marginTop: 4 }} />}
              </div>
              <div style={{ flex: 1, paddingRight: 16, paddingTop: 4, paddingBottom: isLast ? 14 : 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 }}>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>{post.text.length} chars</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => isSaved ? null : onSave(post, 'thread_tweet')} style={{ background: 'none', border: 'none', cursor: isSaved ? 'default' : 'pointer', color: isSaved ? '#34d399' : 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}>
                      {isSaved ? <BookmarkCheck size={10} /> : <Bookmark size={10} />}
                    </button>
                    <button onClick={() => onCopy(post.id, post.text)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isCopied ? '#1da1f2' : 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}>
                      {isCopied ? <CheckCheck size={10} /> : <Copy size={10} />} {isCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.65, color: 'rgb(215,220,240)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{post.text}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── LinkedIn card ──────────────────────────────────────────────────────────────
function LinkedInCard({ post, index, copied, onCopy, gs, onGenerateGraphic, onViewGraphic, onSave, savedId }: {
  post: ContentPost; index: number; copied: string | null
  onCopy: (id: string, text: string) => void
  gs: GraphicState | undefined
  onGenerateGraphic: (id: string) => void
  onViewGraphic: (id: string) => void
  onSave: (post: ContentPost, type: PostType) => void
  savedId: string | null
}) {
  const isCopied = copied === post.id
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(10,102,194,0.25)', background: 'rgba(10,12,22,0.8)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', background: 'rgba(10,102,194,0.07)', borderBottom: '1px solid rgba(10,102,194,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <MessageCircle size={11} color="#0a66c2" />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', color: '#60a5fa', textTransform: 'uppercase' }}>LinkedIn Post V{index + 1}</span>
          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(10,102,194,0.12)', border: '1px solid rgba(10,102,194,0.25)', color: 'rgba(96,165,250,0.7)', fontWeight: 700 }}>Long-form</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CharBadge text={post.text} />
          {gs?.url
            ? <button onClick={() => onViewGraphic(post.id)} style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600 }}><Image size={10} /> View Graphic</button>
            : <GraphicBtn postId={post.id} gs={gs} onGenerate={onGenerateGraphic} />
          }
          <button onClick={() => savedId ? null : onSave(post, 'linkedin')} title={savedId ? 'Saved' : 'Save to drafts'} style={{ background: 'none', border: 'none', cursor: savedId ? 'default' : 'pointer', color: savedId ? '#34d399' : 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600 }}>
            {savedId ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
            {savedId ? 'Saved' : 'Save'}
          </button>
          <button onClick={() => onCopy(post.id, post.text)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isCopied ? '#60a5fa' : 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}>
            {isCopied ? <CheckCheck size={11} /> : <Copy size={11} />}
            {isCopied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <SectionBody text={post.text} accentColor="#0a66c2" />
    </div>
  )
}

// ── Incident analysis bar ──────────────────────────────────────────────────────
function IncidentBar({ data }: { data: ContentResult }) {
  return (
    <div style={{ borderRadius: 12, padding: '14px 16px', background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.15)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Agent Analysis</div>
      {[
        { label: 'Incident',           text: data.incident_summary },
        { label: 'Root cause',         text: data.root_cause       },
        { label: 'Kima/Aeredium angle',text: data.kima_angle       },
      ].map(({ label, text }) => (
        <div key={label} style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(251,191,36,0.6)', flexShrink: 0, minWidth: 110 }}>{label}</span>
          <span style={{ fontSize: 12, color: 'rgb(200,205,230)', lineHeight: 1.5 }}>{text}</span>
        </div>
      ))}
    </div>
  )
}

// ── Saved draft card ───────────────────────────────────────────────────────────
function SavedDraftCard({ draft, copied, onCopy, onMarkPosted, onDelete }: {
  draft: ContentDraft
  copied: string | null
  onCopy: (id: string, text: string) => void
  onMarkPosted: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const cfg    = TYPE_CFG[draft.post_type]
  const hook   = draft.hook || draft.text.slice(0, 120)
  const isCopied = copied === draft.id
  const isPosted = draft.status === 'posted'
  const sections = draft.text.split(/\n\n+/)

  const handleDelete = async () => {
    if (!confirm('Delete this draft?')) return
    setDeleting(true)
    onDelete(draft.id)
  }

  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden',
      border: `1px solid ${isPosted ? 'rgba(52,211,153,0.2)' : cfg.border}`,
      background: 'rgba(10,12,22,0.85)',
      boxShadow: '0 3px 16px rgba(0,0,0,0.25)',
      opacity: deleting ? 0.5 : 1,
      transition: 'opacity 0.2s',
    }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: isPosted ? 'rgba(52,211,153,0.05)' : cfg.bg, borderBottom: `1px solid ${isPosted ? 'rgba(52,211,153,0.15)' : cfg.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: isPosted ? 'rgba(52,211,153,0.12)' : `${cfg.color}18`, border: `1px solid ${isPosted ? 'rgba(52,211,153,0.3)' : `${cfg.color}33`}`, color: isPosted ? '#34d399' : cfg.color, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
            {isPosted ? '✓ Posted' : cfg.label}
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={9} /> {timeAgo(draft.created_at)}
          </span>
          {draft.incident_summary && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {draft.incident_summary.slice(0, 60)}{draft.incident_summary.length > 60 ? '…' : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!isPosted && (
            <button onClick={() => onMarkPosted(draft.id)} title="Mark as posted" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(52,211,153,0.5)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 5 }}>
              <CheckCircle2 size={11} /> Mark posted
            </button>
          )}
          <button onClick={() => onCopy(draft.id, draft.text)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isCopied ? cfg.color : 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600 }}>
            {isCopied ? <CheckCheck size={11} /> : <Copy size={11} />}
            {isCopied ? 'Copied' : 'Copy'}
          </button>
          <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button onClick={handleDelete} disabled={deleting} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(248,113,113,0.35)', display: 'flex', padding: '2px' }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* hook preview — always visible */}
      <div style={{ padding: '13px 16px 10px' }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.58, color: 'rgb(230,235,255)', fontFamily: 'Inter, sans-serif', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {hook.slice(0, 180)}{!expanded && hook.length > 180 ? '…' : ''}
        </div>
      </div>

      {/* expanded: full text with section dividers */}
      {expanded && sections.length > 1 && (
        <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sections.slice(1).map((s, i) => (
            <div key={i}>
              <div style={{ height: 1, background: `${cfg.color}18`, marginBottom: 12 }} />
              <div style={{ fontSize: 13, lineHeight: 1.72, color: 'rgb(190,198,225)', fontFamily: 'Inter, sans-serif', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{s}</div>
            </div>
          ))}
        </div>
      )}

      {/* incident context strip — expanded only */}
      {expanded && draft.incident_summary && (
        <div style={{ margin: '0 14px 14px', padding: '10px 12px', borderRadius: 8, background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.12)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Context</div>
          <div style={{ fontSize: 11, color: 'rgb(190,195,220)', lineHeight: 1.5 }}>{draft.incident_summary}</div>
          {draft.kima_angle && <div style={{ fontSize: 11, color: 'rgba(167,139,250,0.7)', marginTop: 4, lineHeight: 1.5 }}>Angle: {draft.kima_angle}</div>}
        </div>
      )}
    </div>
  )
}

// ── Tab config ─────────────────────────────────────────────────────────────────
const CONTENT_TABS: { key: TabKey; label: string; Icon: typeof Hash; color: string }[] = [
  { key: 'tweets',  label: 'Tweets',   Icon: AtSign,        color: '#1da1f2' },
  { key: 'thread',  label: 'Thread',   Icon: Hash,          color: '#1da1f2' },
  { key: 'linkedin',label: 'LinkedIn', Icon: MessageCircle, color: '#60a5fa' },
]

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: 'all',          label: 'All'      },
  { key: 'tweet',        label: 'X / Tweet'},
  { key: 'linkedin',     label: 'LinkedIn' },
  { key: 'thread_tweet', label: 'Thread'   },
]

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ContentStudioPage() {
  const [view, setView]         = useState<PageView>('create')
  const [news, setNews]         = useState('')
  const [url, setUrl]           = useState('')
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<ContentResult | null>(null)
  const [tab, setTab]           = useState<TabKey>('tweets')
  const { copied, copy }        = useCopy()

  // Graphic state
  const [graphicStates, setGraphicStates] = useState<Record<string, GraphicState>>({})
  const [graphicModal, setGraphicModal]   = useState<{ url: string; hook: string } | null>(null)

  // Saved drafts
  const [drafts, setDrafts]           = useState<ContentDraft[]>([])
  const [draftsLoading, setDraftsLoading] = useState(false)
  const [savedMap, setSavedMap]       = useState<Record<string, string>>({}) // postId → draftId
  const [filterType, setFilterType]   = useState<FilterType>('all')
  const [showPosted, setShowPosted]   = useState(false)

  // Sessions
  const [sessions, setSessions]           = useState<ContentSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true)
    try {
      const res  = await fetch('/api/content-sessions')
      const json = await res.json()
      setSessions(json.sessions || [])
    } catch { /* silent */ }
    finally  { setSessionsLoading(false) }
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  const restoreSession = (session: ContentSession) => {
    setUrl(session.source_url || '')
    setNews(session.news_context || '')
    setResult({
      incident_summary: session.incident_summary || '',
      root_cause: session.root_cause || '',
      kima_angle: session.kima_angle || '',
      tweets: session.tweets,
      thread: session.thread,
      linkedin: session.linkedin,
    })
    setSavedMap({})
    setGraphicStates({})
    setView('create')
    toast.success('Session restored')
  }

  // Load drafts on mount and when switching to saved view
  const loadDrafts = useCallback(async () => {
    setDraftsLoading(true)
    try {
      const res  = await fetch('/api/content-drafts')
      const json = await res.json()
      setDrafts(json.drafts || [])
    } catch { /* silent */ }
    finally  { setDraftsLoading(false) }
  }, [])

  useEffect(() => { loadDrafts() }, [loadDrafts])

  // Generate content
  const generate = async () => {
    if (!news.trim() && !url.trim()) { toast.error('Paste the news or a URL first'); return }
    setLoading(true)
    setResult(null)
    setGraphicStates({})
    setSavedMap({})
    try {
      const res  = await fetch('/api/ai/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ news: news.trim() || undefined, url: url.trim() || undefined }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResult(json.data)
      toast.success('Content generated')
      // Auto-save the full session silently
      fetch('/api/content-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_url: url.trim() || null,
          news_context: news.trim() || null,
          incident_summary: json.data.incident_summary,
          root_cause: json.data.root_cause,
          kima_angle: json.data.kima_angle,
          tweets: json.data.tweets,
          thread: json.data.thread,
          linkedin: json.data.linkedin,
        }),
      }).then(r => r.json()).then(s => {
        if (s.session) setSessions(prev => [s.session, ...prev])
      }).catch(() => { /* non-critical */ })
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Generation failed') }
    finally { setLoading(false) }
  }

  // Save a post to drafts
  const savePost = async (post: ContentPost, postType: PostType) => {
    if (!result || savedMap[post.id]) return
    const hook = post.text.split(/\n\n+/)[0] || ''
    try {
      const res  = await fetch('/api/content-drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_type: postType, text: post.text, hook, incident_summary: result.incident_summary, root_cause: result.root_cause, kima_angle: result.kima_angle }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSavedMap(prev => ({ ...prev, [post.id]: json.draft.id }))
      setDrafts(prev => [json.draft, ...prev])
      toast.success('Saved to drafts')
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Save failed') }
  }

  // Mark as posted
  const markPosted = async (id: string) => {
    try {
      const res  = await fetch(`/api/content-drafts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'posted' }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setDrafts(prev => prev.map(d => d.id === id ? json.draft : d))
      toast.success('Marked as posted')
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Update failed') }
  }

  // Delete a draft
  const deleteDraft = async (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id))
    try {
      await fetch(`/api/content-drafts/${id}`, { method: 'DELETE' })
    } catch { /* already removed from UI */ }
  }

  // Generate graphic
  const generateGraphic = async (postId: string, postType: 'tweet' | 'linkedin') => {
    if (!result) return
    const post = [...result.tweets, ...result.thread, ...result.linkedin].find(p => p.id === postId)
    if (!post) return
    const hook = post.text.split(/\n\n+/)[0] || post.text.slice(0, 200)
    setGraphicStates(prev => ({ ...prev, [postId]: { loading: true, url: null } }))
    try {
      const res  = await fetch('/api/ai/content/graphic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ incident_summary: result.incident_summary, root_cause: result.root_cause, hook, post_type: postType, content_id: postId }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setGraphicStates(prev => ({ ...prev, [postId]: { loading: false, url: json.image_url } }))
      setGraphicModal({ url: json.image_url, hook })
      toast.success('Graphic ready')
    } catch (err: unknown) {
      setGraphicStates(prev => ({ ...prev, [postId]: { loading: false, url: null } }))
      toast.error(err instanceof Error ? err.message : 'Graphic generation failed')
    }
  }

  const viewGraphic = (postId: string) => {
    const state = graphicStates[postId]
    if (!state?.url || !result) return
    const post = [...result.tweets, ...result.thread, ...result.linkedin].find(p => p.id === postId)
    setGraphicModal({ url: state.url, hook: post ? post.text.split(/\n\n+/)[0] : '' })
  }

  // Filtered drafts
  const filteredDrafts = drafts.filter(d => {
    if (!showPosted && d.status === 'posted') return false
    if (filterType !== 'all' && d.post_type !== filterType) return false
    return true
  })

  const savedCount  = drafts.filter(d => d.status === 'saved').length
  const postedCount = drafts.filter(d => d.status === 'posted').length

  return (
    <div className="fade-in">
      {/* Graphic modal */}
      {graphicModal && <GraphicModal url={graphicModal.url} hook={graphicModal.hook} onClose={() => setGraphicModal(null)} />}

      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-white">Content Studio</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>
            Incident → tweets, LinkedIn posts, graphics — all saved in one place
          </p>
        </div>

        {/* Top-level view switcher */}
        <div style={{ display: 'flex', gap: 4, padding: '3px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {([
            { key: 'create',   label: 'Create' },
            { key: 'saved',    label: `Saved Drafts${savedCount > 0 ? ` (${savedCount})` : ''}` },
            { key: 'sessions', label: `Sessions${sessions.length > 0 ? ` (${sessions.length})` : ''}` },
          ] as { key: PageView; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => setView(key)} style={{ padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: view === key ? 'rgba(255,255,255,0.08)' : 'none', color: view === key ? 'white' : 'rgba(255,255,255,0.35)', transition: 'all 0.15s' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          CREATE VIEW
      ════════════════════════════════════════════════════════ */}
      {view === 'create' && (
        <div className="p-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6" style={{ alignItems: 'start' }}>

            {/* LEFT: Input */}
            <div className="lg:col-span-2 space-y-4">
              <div style={{ borderRadius: 16, padding: '22px', background: 'rgba(18,19,32,0.9)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Zap size={13} color="#a78bfa" />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Incident Input</span>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgb(130,135,170)', marginBottom: 6 }}>Source URL (optional)</label>
                  <div style={{ position: 'relative' }}>
                    <Link2 size={12} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)' }} />
                    <input className="input-dark" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://rekt.news/... or a tweet URL" style={{ paddingLeft: 30, fontSize: 12 }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', marginTop: 5 }}>Reads full articles automatically · For tweets, paste the text below too</div>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgb(130,135,170)', marginBottom: 6 }}>News / Context</label>
                  <textarea className="input-dark" rows={7} value={news} onChange={e => setNews(e.target.value)} placeholder={"Paste the hack news, tweet text, or any context here.\n\nE.g.: Protocol X got hacked via compromised private keys. Lost $5M. Attacker drained the treasury through the bridge relayer."} style={{ fontSize: 12, resize: 'vertical', lineHeight: 1.6 }} />
                </div>

                <button onClick={generate} disabled={loading} className="btn btn-primary w-full justify-center" style={{ padding: '11px', fontSize: 13 }}>
                  {loading ? <><Loader2 size={15} className="animate-spin" /> Analysing &amp; Writing…</> : <><Sparkles size={15} /> Generate Content</>}
                </button>
              </div>

              {/* Tips */}
              <div style={{ borderRadius: 12, padding: '14px 16px', background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.12)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(167,139,250,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Works best with</div>
                {['Bridge / relayer / oracle hack news', 'Private key or custody compromises', 'Smart contract exploits', 'Cross-chain messaging failures', 'AI agent / autonomous payment exploits'].map(tip => (
                  <div key={tip} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 5 }}>
                    <span style={{ color: '#a78bfa', flexShrink: 0, marginTop: 1 }}>·</span>
                    <span style={{ fontSize: 11, color: 'rgb(150,155,190)', lineHeight: 1.5 }}>{tip}</span>
                  </div>
                ))}
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(167,139,250,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Bookmark size={9} color="rgba(167,139,250,0.6)" />
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(167,139,250,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Saving</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'rgb(130,135,170)', lineHeight: 1.5 }}>Click Save on any post to add it to Saved Drafts. Copy it to post when ready — mark it as posted to track it.</span>
                </div>
              </div>
            </div>

            {/* RIGHT: Output */}
            <div className="lg:col-span-3 space-y-5">
              {!result && !loading && (
                <div style={{ minHeight: 500, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(18,19,32,0.5)', border: '2px dashed rgba(255,255,255,0.06)' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 14, marginBottom: 16, background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlignLeft size={22} color="rgba(167,139,250,0.4)" />
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 6 }}>Paste an incident, get content</p>
                  <p style={{ fontSize: 12, color: 'rgb(90,95,130)', maxWidth: 320, textAlign: 'center', lineHeight: 1.6 }}>Drop a hack story or rekt.news URL. Agent reads it, maps it to Kima/Aeredium solutions, and writes posts. Save the ones you like — post when ready.</p>
                </div>
              )}

              {loading && (
                <div style={{ minHeight: 500, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(18,19,32,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Loader2 size={32} className="animate-spin mb-4" style={{ color: '#a78bfa' }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 4 }}>Reading the incident…</p>
                  <p style={{ fontSize: 12, color: 'rgb(90,95,130)' }}>Analysing root cause and mapping to Kima/Aeredium solutions</p>
                </div>
              )}

              {result && (
                <>
                  <IncidentBar data={result} />

                  {/* Tab bar */}
                  <div style={{ display: 'flex', gap: 6, padding: '4px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', width: 'fit-content' }}>
                    {CONTENT_TABS.map(({ key, label, Icon, color }) => {
                      const isActive = tab === key
                      return (
                        <button key={key} onClick={() => setTab(key)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', background: isActive ? 'rgba(255,255,255,0.07)' : 'none', border: `1px solid ${isActive ? 'rgba(255,255,255,0.1)' : 'transparent'}`, color: isActive ? color : 'rgba(255,255,255,0.35)' }}>
                          <Icon size={11} />{label}
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: isActive ? `${color}22` : 'rgba(255,255,255,0.05)', color: isActive ? color : 'rgba(255,255,255,0.25)', border: `1px solid ${isActive ? `${color}33` : 'transparent'}` }}>
                            {key === 'tweets' ? result.tweets.length : key === 'thread' ? result.thread.length : result.linkedin.length}
                          </span>
                        </button>
                      )
                    })}
                    <button onClick={generate} disabled={loading} style={{ marginLeft: 4, display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 7, fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }} title="Regenerate">
                      <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Regenerate
                    </button>
                  </div>

                  {tab === 'tweets' && (
                    <div className="space-y-4">
                      {result.tweets.map((post, i) => (
                        <TweetCard key={post.id} post={post} index={i} copied={copied} onCopy={copy}
                          gs={graphicStates[post.id]}
                          onGenerateGraphic={id => generateGraphic(id, 'tweet')}
                          onViewGraphic={viewGraphic}
                          onSave={savePost}
                          savedId={savedMap[post.id] || null}
                        />
                      ))}
                    </div>
                  )}

                  {tab === 'thread' && (
                    <ThreadView thread={result.thread} copied={copied} onCopy={copy}
                      onSave={savePost}
                      savedIds={Object.fromEntries(result.thread.map(p => [p.id, savedMap[p.id] || null]))}
                    />
                  )}

                  {tab === 'linkedin' && (
                    <div className="space-y-4">
                      {result.linkedin.map((post, i) => (
                        <LinkedInCard key={post.id} post={post} index={i} copied={copied} onCopy={copy}
                          gs={graphicStates[post.id]}
                          onGenerateGraphic={id => generateGraphic(id, 'linkedin')}
                          onViewGraphic={viewGraphic}
                          onSave={savePost}
                          savedId={savedMap[post.id] || null}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          SAVED DRAFTS VIEW
      ════════════════════════════════════════════════════════ */}
      {view === 'saved' && (
        <div className="p-8">
          {/* Stats bar */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total saved', value: drafts.length, color: '#a78bfa' },
              { label: 'Ready to post', value: savedCount, color: '#34d399' },
              { label: 'Posted', value: postedCount, color: 'rgba(255,255,255,0.3)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: '12px 18px', borderRadius: 10, background: 'rgba(18,19,32,0.8)', border: '1px solid rgba(255,255,255,0.07)', minWidth: 120 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4, fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', gap: 4, padding: '3px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {FILTER_TABS.map(({ key, label }) => (
                <button key={key} onClick={() => setFilterType(key)} style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: filterType === key ? 'rgba(255,255,255,0.08)' : 'none', color: filterType === key ? 'white' : 'rgba(255,255,255,0.35)' }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setShowPosted(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', background: showPosted ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.03)', color: showPosted ? '#34d399' : 'rgba(255,255,255,0.3)' }}>
                <Filter size={10} /> {showPosted ? 'Hide posted' : 'Show posted'}
              </button>
              <button onClick={loadDrafts} disabled={draftsLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.3)' }}>
                <RefreshCw size={10} className={draftsLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Draft list */}
          {draftsLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
              <Loader2 size={24} className="animate-spin" style={{ color: '#a78bfa' }} />
            </div>
          )}

          {!draftsLoading && filteredDrafts.length === 0 && (
            <div style={{ minHeight: 300, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(18,19,32,0.5)', border: '2px dashed rgba(255,255,255,0.06)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 14, background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bookmark size={20} color="rgba(167,139,250,0.4)" />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 6 }}>
                {drafts.length === 0 ? 'No saved drafts yet' : 'No drafts match this filter'}
              </p>
              <p style={{ fontSize: 12, color: 'rgb(90,95,130)', textAlign: 'center', lineHeight: 1.6, maxWidth: 280 }}>
                {drafts.length === 0
                  ? 'Go to Create, generate content, and click Save on posts you like.'
                  : 'Try a different filter or toggle Show posted.'}
              </p>
              {drafts.length === 0 && (
                <button onClick={() => setView('create')} className="btn btn-primary mt-4" style={{ fontSize: 12, padding: '7px 16px' }}>
                  <Sparkles size={13} /> Go to Create
                </button>
              )}
            </div>
          )}

          {!draftsLoading && filteredDrafts.length > 0 && (
            <div className="space-y-4">
              {filteredDrafts.map(draft => (
                <SavedDraftCard
                  key={draft.id}
                  draft={draft}
                  copied={copied}
                  onCopy={copy}
                  onMarkPosted={markPosted}
                  onDelete={deleteDraft}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          SESSIONS VIEW
      ════════════════════════════════════════════════════════ */}
      {view === 'sessions' && (
        <div className="p-8">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 3 }}>Generation History</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Every generation is auto-saved. Click Restore to reload any session.</div>
            </div>
            <button onClick={loadSessions} disabled={sessionsLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.3)' }}>
              <RefreshCw size={11} className={sessionsLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {sessionsLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
              <Loader2 size={24} className="animate-spin" style={{ color: '#a78bfa' }} />
            </div>
          )}

          {!sessionsLoading && sessions.length === 0 && (
            <div style={{ minHeight: 300, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(18,19,32,0.5)', border: '2px dashed rgba(255,255,255,0.06)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 14, background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <History size={20} color="rgba(167,139,250,0.4)" />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 6 }}>No sessions yet</p>
              <p style={{ fontSize: 12, color: 'rgb(90,95,130)', textAlign: 'center', lineHeight: 1.6, maxWidth: 280 }}>Generate content — each run is saved here automatically.</p>
              <button onClick={() => setView('create')} className="btn btn-primary mt-4" style={{ fontSize: 12, padding: '7px 16px' }}>
                <Sparkles size={13} /> Go to Create
              </button>
            </div>
          )}

          {!sessionsLoading && sessions.length > 0 && (
            <div className="space-y-3">
              {sessions.map(session => {
                const totalPosts = session.tweets.length + session.thread.length + session.linkedin.length
                const preview    = session.incident_summary || session.news_context || 'No summary'
                return (
                  <div key={session.id} style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(167,139,250,0.15)', background: 'rgba(10,12,22,0.85)', boxShadow: '0 3px 16px rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', background: 'rgba(167,139,250,0.05)', borderBottom: '1px solid rgba(167,139,250,0.1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <History size={12} color="#a78bfa" />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={9} /> {timeAgo(session.created_at)}
                            </span>
                            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(29,161,242,0.08)', border: '1px solid rgba(29,161,242,0.15)', color: 'rgba(29,161,242,0.7)', fontWeight: 700 }}>{session.tweets.length} tweets</span>
                            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', color: 'rgba(129,140,248,0.7)', fontWeight: 700 }}>{session.thread.length} thread</span>
                            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(10,102,194,0.08)', border: '1px solid rgba(10,102,194,0.2)', color: 'rgba(96,165,250,0.7)', fontWeight: 700 }}>{session.linkedin.length} LinkedIn</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => restoreSession(session)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa' }}
                      >
                        <RotateCcw size={11} /> Restore
                      </button>
                    </div>

                    <div style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'rgb(225,228,255)', lineHeight: 1.55, marginBottom: session.kima_angle ? 8 : 0 }}>
                        {preview.slice(0, 200)}{preview.length > 200 ? '…' : ''}
                      </div>
                      {session.kima_angle && (
                        <div style={{ fontSize: 11, color: 'rgba(167,139,250,0.65)', lineHeight: 1.5 }}>
                          Angle: {session.kima_angle.slice(0, 140)}{session.kima_angle.length > 140 ? '…' : ''}
                        </div>
                      )}
                      {session.source_url && (
                        <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Link2 size={9} /> {session.source_url.slice(0, 80)}{session.source_url.length > 80 ? '…' : ''}
                        </div>
                      )}
                    </div>

                    <div style={{ padding: '0 16px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                      {totalPosts === 0 ? (
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>No posts in this session</span>
                      ) : (
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{totalPosts} posts total — restore to view and save individual ones</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
