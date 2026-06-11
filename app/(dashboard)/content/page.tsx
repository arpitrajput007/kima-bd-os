'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Sparkles, Copy, RefreshCw, Loader2,
  Link2, CheckCheck, ChevronDown, ChevronUp,
  Zap, Hash, AlignLeft, AtSign, MessageCircle,
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
function CharBadge({ text, limit }: { text: string; limit?: number }) {
  const len = text.length
  const over = limit && len > limit
  return (
    <span style={{
      fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
      color: over ? '#f87171' : 'rgba(255,255,255,0.2)',
    }}>
      {len}{limit ? `/${limit}` : ''}
    </span>
  )
}

// ── Tweet card ─────────────────────────────────────────────────────────────────
function TweetCard({
  post, index, copied, onCopy,
}: { post: ContentPost; index: number; copied: string | null; onCopy: (id: string, text: string) => void }) {
  const isCopied = copied === post.id
  const over = post.text.length > 280
  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden',
      border: `1px solid ${over ? 'rgba(248,113,113,0.3)' : 'rgba(29,161,242,0.2)'}`,
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
            Tweet V{index + 1}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CharBadge text={post.text} limit={280} />
          <button
            onClick={() => onCopy(post.id, post.text)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isCopied ? '#1da1f2' : 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}
          >
            {isCopied ? <CheckCheck size={11} /> : <Copy size={11} />}
            {isCopied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      {/* body */}
      <div style={{ padding: '14px 16px', fontSize: 13.5, lineHeight: 1.68, color: 'rgb(220,224,242)', fontFamily: 'Inter, sans-serif', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {post.text}
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
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>{post.text.length}/280</span>
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
  post, index, copied, onCopy,
}: { post: ContentPost; index: number; copied: string | null; onCopy: (id: string, text: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const isCopied = copied === post.id
  const preview = post.text.slice(0, 220)
  const hasMore = post.text.length > 220

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
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CharBadge text={post.text} />
          <button
            onClick={() => onCopy(post.id, post.text)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isCopied ? '#60a5fa' : 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}
          >
            {isCopied ? <CheckCheck size={11} /> : <Copy size={11} />}
            {isCopied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      {/* body */}
      <div style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 13.5, lineHeight: 1.72, color: 'rgb(215,220,240)', fontFamily: 'Inter, sans-serif', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {expanded || !hasMore ? post.text : preview + '…'}
        </div>
        {hasMore && (
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#60a5fa', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {expanded ? <><ChevronUp size={11} /> Show less</> : <><ChevronDown size={11} /> Read more</>}
          </button>
        )}
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
  const [news, setNews]       = useState('')
  const [url, setUrl]         = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<ContentResult | null>(null)
  const [tab, setTab]         = useState<TabKey>('tweets')
  const { copied, copy }      = useCopy()

  const generate = async () => {
    if (!news.trim() && !url.trim()) {
      toast.error('Paste the news or a URL first')
      return
    }
    setLoading(true)
    setResult(null)
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

  return (
    <div className="fade-in">
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-white">Content Studio</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>
            Drop a hack/incident → agent writes tweets &amp; LinkedIn posts around Kima &amp; Aeredium solutions
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
                    placeholder="https://rekt.news/..."
                    style={{ paddingLeft: 30, fontSize: 12 }}
                  />
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', marginTop: 5 }}>
                  The agent fetches and reads the full article
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
                  placeholder={"Paste the hack news, tweet, or any context here.\n\nE.g.: Humanity Protocol got hacked via compromised private keys — lost $X. The attacker drained the treasury through the bridge relayer…"}
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
                  Drop a hack story, rekt.news URL, or any news about a Web3 security failure. The agent reads it, maps it to our solutions, and writes ready-to-post content.
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
                      <TweetCard key={post.id} post={post} index={i} copied={copied} onCopy={copy} />
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
                      <LinkedInCard key={post.id} post={post} index={i} copied={copied} onCopy={copy} />
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
