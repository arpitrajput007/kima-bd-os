'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Sparkles, Copy, RefreshCw, Loader2,
  Link2, CheckCheck, Image, Download,
  Zap, Hash, AlignLeft, AtSign, MessageCircle, X,
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

type TabKey = 'tweets' | 'thread' | 'linkedin'
type PostType = 'tweet' | 'linkedin'

interface GraphicState {
  loading: boolean
  url: string | null
}

// ── Copy-with-flash hook ───────────────────────────────────────────────────────
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 1600)
  }
  return { copied, copy }
}

// ── Character counter badge ────────────────────────────────────────────────────
function CharBadge({ text }: { text: string }) {
  return (
    <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 600, color: 'rgba(255,255,255,0.2)' }}>
      {text.length} chars
    </span>
  )
}

// ── Generate Graphic button ────────────────────────────────────────────────────
function GraphicBtn({
  postId, graphicState, onGenerate,
}: {
  postId: string
  graphicState: GraphicState | undefined
  onGenerate: (postId: string) => void
}) {
  const isLoading = graphicState?.loading
  const hasUrl = !!graphicState?.url
  return (
    <button
      onClick={() => onGenerate(postId)}
      disabled={isLoading}
      title="Generate graphic for this post"
      style={{
        background: hasUrl ? 'rgba(167,139,250,0.12)' : 'none',
        border: hasUrl ? '1px solid rgba(167,139,250,0.25)' : 'none',
        borderRadius: 6, padding: hasUrl ? '2px 8px' : '2px 4px',
        cursor: isLoading ? 'default' : 'pointer',
        color: hasUrl ? '#a78bfa' : 'rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600,
        transition: 'all 0.15s',
      }}
    >
      {isLoading
        ? <Loader2 size={10} className="animate-spin" />
        : <Image size={10} />}
      {isLoading ? 'Generating…' : hasUrl ? 'Graphic ✓' : 'Graphic'}
    </button>
  )
}

// ── Graphic modal ──────────────────────────────────────────────────────────────
function GraphicModal({
  url, hook, onClose,
}: { url: string; hook: string; onClose: () => void }) {
  const [downloading, setDownloading] = useState(false)

  const download = async () => {
    try {
      setDownloading(true)
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `kima-graphic-${Date.now()}.png`
      a.click()
    } catch {
      toast.error('Download failed — try right-clicking the image')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 780, width: '100%', borderRadius: 18,
          background: 'rgba(14,15,24,0.95)', border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)', overflow: 'hidden',
        }}
      >
        {/* modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Image size={11} color="#a78bfa" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Generated Graphic</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>DALL-E 3 · HD</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={download}
              disabled={downloading}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)',
                color: '#a78bfa',
              }}
            >
              {downloading ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
              Download
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex', padding: 4 }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* image */}
        <div style={{ position: 'relative', background: '#000' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Generated graphic"
            style={{ width: '100%', display: 'block', maxHeight: '60vh', objectFit: 'contain' }}
          />
          {/* text overlay — hook text in bottom-left */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
            padding: '40px 24px 20px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'white', lineHeight: 1.55, maxWidth: '80%', whiteSpace: 'pre-wrap' }}>
              {hook.slice(0, 200)}{hook.length > 200 ? '…' : ''}
            </div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: 'rgba(167,139,250,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={9} color="white" fill="white" />
              </div>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Kima BD OS</span>
            </div>
          </div>
        </div>

        {/* footer tip */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', lineHeight: 1.5 }}>
            Tip: Download the image and add your own text/branding in Canva or Figma for the final post. The overlay above is a preview only.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Tweet card ─────────────────────────────────────────────────────────────────
function TweetCard({
  post, index, copied, onCopy, graphicState, onGenerateGraphic, onViewGraphic,
}: {
  post: ContentPost
  index: number
  copied: string | null
  onCopy: (id: string, text: string) => void
  graphicState: GraphicState | undefined
  onGenerateGraphic: (postId: string) => void
  onViewGraphic: (postId: string) => void
}) {
  const isCopied = copied === post.id
  const sections = post.text.split(/\n\n+/)

  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden',
      border: '1px solid rgba(29,161,242,0.2)',
      background: 'rgba(10,12,22,0.8)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    }}>
      {/* header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', background: 'rgba(29,161,242,0.05)',
        borderBottom: '1px solid rgba(29,161,242,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <AtSign size={11} color="#1da1f2" />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', color: '#1da1f2', textTransform: 'uppercase' }}>
            Post V{index + 1}
          </span>
          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(29,161,242,0.1)', border: '1px solid rgba(29,161,242,0.2)', color: 'rgba(29,161,242,0.7)', fontWeight: 700 }}>
            Premium
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CharBadge text={post.text} />
          {graphicState?.url ? (
            <button
              onClick={() => onViewGraphic(post.id)}
              style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600 }}
            >
              <Image size={10} /> View Graphic
            </button>
          ) : (
            <GraphicBtn postId={post.id} graphicState={graphicState} onGenerate={onGenerateGraphic} />
          )}
          <button
            onClick={() => onCopy(post.id, post.text)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isCopied ? '#1da1f2' : 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}
          >
            {isCopied ? <CheckCheck size={11} /> : <Copy size={11} />}
            {isCopied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      {/* body — render sections with dividers */}
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sections.map((section, i) => (
          <div key={i}>
            {i > 0 && (
              <div style={{ height: 1, background: 'rgba(29,161,242,0.08)', marginBottom: 14 }} />
            )}
            <div style={{
              fontSize: i === 0 ? 15 : 13.5,
              fontWeight: i === 0 ? 600 : 400,
              lineHeight: 1.7,
              color: i === 0 ? 'rgb(235,238,255)' : 'rgb(200,205,230)',
              fontFamily: 'Inter, sans-serif',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {section}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Thread card ────────────────────────────────────────────────────────────────
function ThreadView({
  thread, copied, onCopy,
}: { thread: ContentPost[]; copied: string | null; onCopy: (id: string, text: string) => void }) {
  const fullThread = thread.map(t => t.text).join('\n\n')
  const allCopied = copied === 'thread_all'
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(29,161,242,0.2)', background: 'rgba(10,12,22,0.8)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
      {/* header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 16px', background: 'rgba(29,161,242,0.05)',
        borderBottom: '1px solid rgba(29,161,242,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Hash size={11} color="#1da1f2" />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', color: '#1da1f2', textTransform: 'uppercase' }}>
            Thread · {thread.length} tweets
          </span>
        </div>
        <button
          onClick={() => onCopy('thread_all', fullThread)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: allCopied ? '#1da1f2' : 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}
        >
          {allCopied ? <CheckCheck size={11} /> : <Copy size={11} />}
          Copy all
        </button>
      </div>

      {/* tweets */}
      <div style={{ padding: '8px 0' }}>
        {thread.map((post, i) => {
          const isCopied = copied === post.id
          const isLast = i === thread.length - 1
          return (
            <div key={post.id} style={{ display: 'flex', gap: 0 }}>
              {/* thread line */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingLeft: 20, paddingRight: 14, paddingTop: 4 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(29,161,242,0.1)', border: '1px solid rgba(29,161,242,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#1da1f2' }}>{i + 1}</span>
                </div>
                {!isLast && <div style={{ width: 1, flex: 1, minHeight: 16, background: 'rgba(29,161,242,0.15)', marginTop: 4 }} />}
              </div>
              {/* content */}
              <div style={{ flex: 1, paddingRight: 16, paddingTop: 4, paddingBottom: isLast ? 14 : 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>{post.text.length} chars</span>
                  <button
                    onClick={() => onCopy(post.id, post.text)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: isCopied ? '#1da1f2' : 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}
                  >
                    {isCopied ? <CheckCheck size={10} /> : <Copy size={10} />}
                    {isCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.65, color: 'rgb(215,220,240)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {post.text}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── LinkedIn card ──────────────────────────────────────────────────────────────
function LinkedInCard({
  post, index, copied, onCopy, graphicState, onGenerateGraphic, onViewGraphic,
}: {
  post: ContentPost
  index: number
  copied: string | null
  onCopy: (id: string, text: string) => void
  graphicState: GraphicState | undefined
  onGenerateGraphic: (postId: string) => void
  onViewGraphic: (postId: string) => void
}) {
  const isCopied = copied === post.id
  const sections = post.text.split(/\n\n+/)

  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden',
      border: '1px solid rgba(10,102,194,0.25)',
      background: 'rgba(10,12,22,0.8)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    }}>
      {/* header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 16px', background: 'rgba(10,102,194,0.07)',
        borderBottom: '1px solid rgba(10,102,194,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <MessageCircle size={11} color="#0a66c2" />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', color: '#60a5fa', textTransform: 'uppercase' }}>
            LinkedIn Post V{index + 1}
          </span>
          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(10,102,194,0.12)', border: '1px solid rgba(10,102,194,0.25)', color: 'rgba(96,165,250,0.7)', fontWeight: 700 }}>
            Long-form
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CharBadge text={post.text} />
          {graphicState?.url ? (
            <button
              onClick={() => onViewGraphic(post.id)}
              style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600 }}
            >
              <Image size={10} /> View Graphic
            </button>
          ) : (
            <GraphicBtn postId={post.id} graphicState={graphicState} onGenerate={onGenerateGraphic} />
          )}
          <button
            onClick={() => onCopy(post.id, post.text)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isCopied ? '#60a5fa' : 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}
          >
            {isCopied ? <CheckCheck size={11} /> : <Copy size={11} />}
            {isCopied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      {/* body — hook bigger + dividers between parts */}
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sections.map((section, i) => (
          <div key={i}>
            {i > 0 && (
              <div style={{ height: 1, background: 'rgba(10,102,194,0.1)', marginBottom: 14 }} />
            )}
            <div style={{
              fontSize: i === 0 ? 15.5 : 13.5,
              fontWeight: i === 0 ? 600 : 400,
              lineHeight: i === 0 ? 1.6 : 1.78,
              color: i === 0 ? 'rgb(235,240,255)' : 'rgb(200,208,232)',
              fontFamily: 'Inter, sans-serif',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {section}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Incident analysis bar ──────────────────────────────────────────────────────
function IncidentBar({ data }: { data: ContentResult }) {
  return (
    <div style={{
      borderRadius: 12, padding: '14px 16px',
      background: 'rgba(251,191,36,0.04)',
      border: '1px solid rgba(251,191,36,0.15)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
        Agent Analysis
      </div>
      {[
        { label: 'Incident', text: data.incident_summary },
        { label: 'Root cause', text: data.root_cause },
        { label: 'Kima/Aeredium angle', text: data.kima_angle },
      ].map(({ label, text }) => (
        <div key={label} style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(251,191,36,0.6)', flexShrink: 0, minWidth: 110 }}>
            {label}
          </span>
          <span style={{ fontSize: 12, color: 'rgb(200,205,230)', lineHeight: 1.5 }}>{text}</span>
        </div>
      ))}
    </div>
  )
}

// ── Tab config ─────────────────────────────────────────────────────────────────
const TABS: { key: TabKey; label: string; Icon: typeof Hash; color: string }[] = [
  { key: 'tweets',  label: 'Tweets',   Icon: AtSign,         color: '#1da1f2' },
  { key: 'thread',  label: 'Thread',   Icon: Hash,           color: '#1da1f2' },
  { key: 'linkedin',label: 'LinkedIn', Icon: MessageCircle,  color: '#60a5fa' },
]

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ContentStudioPage() {
  const [news, setNews]         = useState('')
  const [url, setUrl]           = useState('')
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<ContentResult | null>(null)
  const [tab, setTab]           = useState<TabKey>('tweets')
  const { copied, copy }        = useCopy()

  // Graphic state: keyed by post.id
  const [graphicStates, setGraphicStates] = useState<Record<string, GraphicState>>({})
  // Which graphic is currently showing in the modal
  const [graphicModal, setGraphicModal]   = useState<{ url: string; hook: string } | null>(null)

  const generate = async () => {
    if (!news.trim() && !url.trim()) {
      toast.error('Paste the news or a URL first')
      return
    }
    setLoading(true)
    setResult(null)
    setGraphicStates({})
    try {
      const res = await fetch('/api/ai/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ news: news.trim() || undefined, url: url.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResult(json.data)
      toast.success('Content generated')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  const generateGraphic = async (postId: string, postType: PostType) => {
    if (!result) return
    const post = [
      ...result.tweets, ...result.thread, ...result.linkedin,
    ].find(p => p.id === postId)
    if (!post) return

    // Hook = first paragraph of the post
    const hook = post.text.split(/\n\n+/)[0] || post.text.slice(0, 200)

    setGraphicStates(prev => ({ ...prev, [postId]: { loading: true, url: null } }))
    try {
      const res = await fetch('/api/ai/content/graphic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_summary: result.incident_summary,
          root_cause: result.root_cause,
          hook,
          post_type: postType,
          content_id: postId,
        }),
      })
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
    const hook = post ? post.text.split(/\n\n+/)[0] : ''
    setGraphicModal({ url: state.url, hook })
  }

  return (
    <div className="fade-in">
      {/* Graphic modal */}
      {graphicModal && (
        <GraphicModal
          url={graphicModal.url}
          hook={graphicModal.hook}
          onClose={() => setGraphicModal(null)}
        />
      )}

      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-white">Content Studio</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>
            Drop a hack/incident → agent writes tweets &amp; LinkedIn posts + generates graphics
          </p>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6" style={{ alignItems: 'start' }}>

          {/* ── LEFT: Input panel (2 cols) ── */}
          <div className="lg:col-span-2 space-y-4">
            <div style={{ borderRadius: 16, padding: '22px', background: 'rgba(18,19,32,0.9)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={13} color="#a78bfa" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Incident Input</span>
              </div>

              {/* URL field */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgb(130,135,170)', marginBottom: 6 }}>
                  Source URL (optional)
                </label>
                <div style={{ position: 'relative' }}>
                  <Link2 size={12} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)' }} />
                  <input
                    className="input-dark"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://rekt.news/... or paste a tweet URL"
                    style={{ paddingLeft: 30, fontSize: 12 }}
                  />
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', marginTop: 5 }}>
                  Reads full articles automatically · For tweets, paste the text below too
                </div>
              </div>

              {/* News text */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgb(130,135,170)', marginBottom: 6 }}>
                  News / Context
                </label>
                <textarea
                  className="input-dark"
                  rows={7}
                  value={news}
                  onChange={e => setNews(e.target.value)}
                  placeholder={"Paste the hack news, tweet text, or any context here.\n\nE.g.: Protocol X got hacked via compromised private keys. Lost $5M. Attacker drained the treasury through the bridge relayer.\n\n(For Twitter links: paste the tweet text here too)"}
                  style={{ fontSize: 12, resize: 'vertical', lineHeight: 1.6 }}
                />
              </div>

              {/* Generate button */}
              <button
                onClick={generate}
                disabled={loading}
                className="btn btn-primary w-full justify-center"
                style={{ padding: '11px', fontSize: 13 }}
              >
                {loading
                  ? <><Loader2 size={15} className="animate-spin" /> Analysing &amp; Writing…</>
                  : <><Sparkles size={15} /> Generate Content</>}
              </button>
            </div>

            {/* Tips card */}
            <div style={{ borderRadius: 12, padding: '14px 16px', background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.12)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(167,139,250,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Works best with</div>
              {[
                'Bridge / relayer / oracle hack news',
                'Private key or custody compromises',
                'Smart contract exploits',
                'Cross-chain messaging failures',
                'AI agent / autonomous payment exploits',
              ].map(tip => (
                <div key={tip} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 5 }}>
                  <span style={{ color: '#a78bfa', flexShrink: 0, marginTop: 1 }}>·</span>
                  <span style={{ fontSize: 11, color: 'rgb(150,155,190)', lineHeight: 1.5 }}>{tip}</span>
                </div>
              ))}
              {/* Graphic tip */}
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(167,139,250,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Image size={9} color="rgba(167,139,250,0.6)" />
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(167,139,250,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Graphics</span>
                </div>
                <span style={{ fontSize: 11, color: 'rgb(130,135,170)', lineHeight: 1.5 }}>
                  Each post has a &quot;Graphic&quot; button. Generates a DALL-E 3 cinematic illustration matched to the incident. Download + add text in Canva.
                </span>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Output panel (3 cols) ── */}
          <div className="lg:col-span-3 space-y-5">
            {!result && !loading && (
              <div style={{
                minHeight: 500, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(18,19,32,0.5)', border: '2px dashed rgba(255,255,255,0.06)',
              }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, marginBottom: 16, background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlignLeft size={22} color="rgba(167,139,250,0.4)" />
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 6 }}>Paste an incident, get content</p>
                <p style={{ fontSize: 12, color: 'rgb(90,95,130)', maxWidth: 320, textAlign: 'center', lineHeight: 1.6 }}>
                  Drop a hack story, rekt.news URL, or any news about a Web3 security failure. The agent reads it, maps it to our solutions, and writes ready-to-post content — with graphics.
                </p>
              </div>
            )}

            {loading && (
              <div style={{
                minHeight: 500, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(18,19,32,0.5)', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <Loader2 size={32} className="animate-spin mb-4" style={{ color: '#a78bfa' }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 4 }}>Reading the incident…</p>
                <p style={{ fontSize: 12, color: 'rgb(90,95,130)' }}>Analysing root cause and mapping to Kima/Aeredium solutions</p>
              </div>
            )}

            {result && (
              <>
                {/* Incident analysis */}
                <IncidentBar data={result} />

                {/* Tab bar */}
                <div style={{ display: 'flex', gap: 6, padding: '4px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', width: 'fit-content' }}>
                  {TABS.map(({ key, label, Icon, color }) => {
                    const isActive = tab === key
                    return (
                      <button
                        key={key}
                        onClick={() => setTab(key)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', transition: 'all 0.15s',
                          background: isActive ? 'rgba(255,255,255,0.07)' : 'none',
                          border: `1px solid ${isActive ? 'rgba(255,255,255,0.1)' : 'transparent'}`,
                          color: isActive ? color : 'rgba(255,255,255,0.35)',
                        }}
                      >
                        <Icon size={11} />
                        {label}
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                          background: isActive ? `${color}22` : 'rgba(255,255,255,0.05)',
                          color: isActive ? color : 'rgba(255,255,255,0.25)',
                          border: `1px solid ${isActive ? `${color}33` : 'transparent'}`,
                        }}>
                          {key === 'tweets' ? result.tweets.length : key === 'thread' ? result.thread.length : result.linkedin.length}
                        </span>
                      </button>
                    )
                  })}

                  <button
                    onClick={generate}
                    disabled={loading}
                    style={{
                      marginLeft: 4, display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 11px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
                    }}
                    title="Regenerate all content"
                  >
                    <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                    Regenerate
                  </button>
                </div>

                {/* Tweets tab */}
                {tab === 'tweets' && (
                  <div className="space-y-4">
                    {result.tweets.map((post, i) => (
                      <TweetCard
                        key={post.id} post={post} index={i} copied={copied} onCopy={copy}
                        graphicState={graphicStates[post.id]}
                        onGenerateGraphic={id => generateGraphic(id, 'tweet')}
                        onViewGraphic={viewGraphic}
                      />
                    ))}
                  </div>
                )}

                {/* Thread tab */}
                {tab === 'thread' && (
                  <ThreadView thread={result.thread} copied={copied} onCopy={copy} />
                )}

                {/* LinkedIn tab */}
                {tab === 'linkedin' && (
                  <div className="space-y-4">
                    {result.linkedin.map((post, i) => (
                      <LinkedInCard
                        key={post.id} post={post} index={i} copied={copied} onCopy={copy}
                        graphicState={graphicStates[post.id]}
                        onGenerateGraphic={id => generateGraphic(id, 'linkedin')}
                        onViewGraphic={viewGraphic}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
