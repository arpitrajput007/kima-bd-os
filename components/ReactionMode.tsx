'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  RefreshCw, Loader2, Sparkles, Copy, CheckCheck,
  ArrowLeft, Bookmark, BookmarkCheck, Trash2, CheckCircle2,
  Clock, ChevronDown, ChevronUp, Zap, Rss, Hash, MessageSquare,
  Lightbulb, Filter,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────
interface ReactionNewsItem {
  id: string
  topic: string
  title: string
  url: string | null
  source: string | null
  summary: string | null
  published_at: string | null
  used: boolean
  created_at: string
}

interface ReactionResult {
  post_short: string
  post_medium: string
  post_long: string
  alt_hooks: string[]
  titles: string[]
  comment_ideas: string[]
  takeaway: string
  hashtags: string[]
}

interface ReactionDraft {
  id: string
  news_title: string | null
  news_url: string | null
  news_topic: string | null
  post_short: string
  post_medium: string
  post_long: string
  hook: string | null
  alt_hooks: string[]
  titles: string[]
  comment_ideas: string[]
  takeaway: string | null
  hashtags: string[]
  status: 'saved' | 'posted'
  created_at: string
}

type TopMode   = 'feed' | 'saved'
type FeedSub   = 'list' | 'generate'
type LengthTab = 'short' | 'medium' | 'long'

// ── Helpers ────────────────────────────────────────────────────────────────────
function timeAgo(iso: string | null) {
  if (!iso) return ''
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

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

const TOPIC_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  'AI Agents':        { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',  border: 'rgba(167,139,250,0.25)' },
  'Agentic AI':       { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',  border: 'rgba(167,139,250,0.25)' },
  'AI Payments':      { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',  border: 'rgba(167,139,250,0.25)' },
  'AI Commerce':      { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',  border: 'rgba(167,139,250,0.25)' },
  'Security':         { color: '#f87171', bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.25)' },
  'Fundraising':      { color: '#34d399', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.25)'  },
  'DeFi':             { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.25)'  },
  'Crypto':           { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.25)'  },
  'Cross-chain':      { color: '#38bdf8', bg: 'rgba(56,189,248,0.1)',   border: 'rgba(56,189,248,0.25)'  },
  'Stablecoins':      { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.25)'  },
  'Payments':         { color: '#22d3ee', bg: 'rgba(34,211,238,0.1)',   border: 'rgba(34,211,238,0.25)'  },
  'Treasury':         { color: '#22d3ee', bg: 'rgba(34,211,238,0.1)',   border: 'rgba(34,211,238,0.25)'  },
  'Regulations':      { color: '#fb923c', bg: 'rgba(251,146,60,0.1)',   border: 'rgba(251,146,60,0.25)'  },
  'Developer Tooling':{ color: '#e879f9', bg: 'rgba(232,121,249,0.1)',  border: 'rgba(232,121,249,0.25)' },
  'Enterprise':       { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.25)' },
  'Product Launches': { color: '#34d399', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.25)'  },
}
const DEFAULT_TOPIC_COLOR = { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' }

function topicColor(topic: string) {
  return TOPIC_COLORS[topic] || DEFAULT_TOPIC_COLOR
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

// ── Topic badge ────────────────────────────────────────────────────────────────
function TopicBadge({ topic }: { topic: string }) {
  const c = topicColor(topic)
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: c.bg, border: `1px solid ${c.border}`, color: c.color, textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0 }}>
      {topic}
    </span>
  )
}

// ── Collapsible section ────────────────────────────────────────────────────────
function CollapsibleSection({ title, icon, children, accent = '#a78bfa' }: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  accent?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderRadius: 10, border: `1px solid ${accent}22`, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: `${accent}08`, border: 'none', cursor: 'pointer', color: 'white' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ color: accent }}>{icon}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>{title}</span>
        </div>
        {open ? <ChevronUp size={12} color={accent} /> : <ChevronDown size={12} color={accent} />}
      </button>
      {open && (
        <div style={{ padding: '12px 14px', borderTop: `1px solid ${accent}18`, background: 'rgba(0,0,0,0.2)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── News item card ─────────────────────────────────────────────────────────────
function NewsCard({ item, onReact }: { item: ReactionNewsItem; onReact: (item: ReactionNewsItem) => void }) {
  const c = topicColor(item.topic)
  const sourceName = item.source && item.source !== 'exa' ? item.source : item.topic
  return (
    <div style={{
      borderRadius: 12,
      border: `1px solid ${item.used ? 'rgba(255,255,255,0.04)' : c.border}`,
      background: 'rgba(12,13,22,0.9)',
      padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
      opacity: item.used ? 0.6 : 1,
      transition: 'border-color 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <TopicBadge topic={item.topic} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Rss size={9} /> {sourceName}
            </span>
            {item.published_at && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <Clock size={9} /> {timeAgo(item.published_at)}
              </span>
            )}
            {item.used && (
              <span style={{ fontSize: 9, color: 'rgba(52,211,153,0.6)', fontWeight: 700 }}>✓ reacted</span>
            )}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgb(225,228,255)', lineHeight: 1.5, wordBreak: 'break-word' }}>
            {item.title}
          </div>
          {item.summary && (
            <div style={{ fontSize: 11.5, color: 'rgb(140,148,180)', lineHeight: 1.6 }}>
              {item.summary.slice(0, 200)}{item.summary.length > 200 ? '…' : ''}
            </div>
          )}
        </div>
        <button
          onClick={() => onReact(item)}
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: `${c.color}18`, border: `1px solid ${c.border}`, color: c.color, cursor: 'pointer', whiteSpace: 'nowrap', marginTop: 2 }}
        >
          <Sparkles size={11} /> React
        </button>
      </div>
    </div>
  )
}

// ── Post viewer ────────────────────────────────────────────────────────────────
function PostViewer({ text, label, copied, onCopy, copyId, accent = '#60a5fa' }: {
  text: string; label: string; copied: string | null
  onCopy: (id: string, text: string) => void; copyId: string; accent?: string
}) {
  const wc = wordCount(text)
  const isCopied = copied === copyId
  const sections = text.split(/\n\n+/)
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${accent}30`, background: 'rgba(10,12,22,0.9)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: `${accent}08`, borderBottom: `1px solid ${accent}18` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: `${accent}14`, border: `1px solid ${accent}28`, color: accent, fontWeight: 700 }}>{wc} words</span>
        </div>
        <button
          onClick={() => onCopy(copyId, text)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: isCopied ? accent : 'rgba(255,255,255,0.3)' }}
        >
          {isCopied ? <CheckCheck size={11} /> : <Copy size={11} />}
          {isCopied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sections.map((s, i) => (
          <div key={i}>
            {i > 0 && <div style={{ height: 1, background: `${accent}14`, marginBottom: 14 }} />}
            <div style={{ fontSize: i === 0 ? 14.5 : 13.5, fontWeight: i === 0 ? 600 : 400, lineHeight: i === 0 ? 1.62 : 1.78, color: i === 0 ? 'rgb(232,236,255)' : 'rgb(195,202,228)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {s}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Generate view ──────────────────────────────────────────────────────────────
function GenerateView({ item, onBack, onSaved }: {
  item: ReactionNewsItem
  onBack: () => void
  onSaved: (draft: ReactionDraft) => void
}) {
  const [generating, setGenerating]   = useState(false)
  const [result, setResult]           = useState<ReactionResult | null>(null)
  const [lengthTab, setLengthTab]     = useState<LengthTab>('medium')
  const [savedId, setSavedId]         = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)
  const [showExtras, setShowExtras]   = useState(false)
  const { copied, copy }              = useCopy()
  const c = topicColor(item.topic)

  const generate = async () => {
    setGenerating(true)
    setResult(null)
    setSavedId(null)
    try {
      const res = await fetch('/api/reaction/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          news_item_id: item.id,
          title:    item.title,
          url:      item.url,
          summary:  item.summary,
          topic:    item.topic,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResult(json.data)
      setShowExtras(false)
      toast.success('Post generated')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const savePost = async () => {
    if (!result || savedId || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/reaction-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          news_item_id:  item.id,
          news_title:    item.title,
          news_url:      item.url,
          news_topic:    item.topic,
          post_short:    result.post_short,
          post_medium:   result.post_medium,
          post_long:     result.post_long,
          alt_hooks:     result.alt_hooks,
          titles:        result.titles,
          comment_ideas: result.comment_ideas,
          takeaway:      result.takeaway,
          hashtags:      result.hashtags,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSavedId(json.draft.id)
      onSaved(json.draft)
      toast.success('Saved to drafts')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const currentPost = result
    ? (lengthTab === 'short' ? result.post_short : lengthTab === 'medium' ? result.post_medium : result.post_long)
    : ''

  const LENGTH_TABS: Array<{ key: LengthTab; label: string; range: string }> = [
    { key: 'short',  label: 'Short',  range: '150–250w' },
    { key: 'medium', label: 'Medium', range: '300–500w' },
    { key: 'long',   label: 'Long',   range: '600–900w' },
  ]

  return (
    <div>
      {/* Back + article header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', marginTop: 2 }}>
          <ArrowLeft size={15} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <TopicBadge topic={item.topic} />
            {item.source && item.source !== 'exa' && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{item.source}</span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'white', lineHeight: 1.5, wordBreak: 'break-word' }}>
            {item.title}
          </div>
          {item.summary && (
            <div style={{ fontSize: 11.5, color: 'rgb(130,140,170)', lineHeight: 1.55, marginTop: 5 }}>
              {item.summary.slice(0, 240)}{item.summary.length > 240 ? '…' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={generate}
        disabled={generating}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px', borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', background: generating ? 'rgba(96,165,250,0.12)' : 'linear-gradient(135deg, rgba(96,165,250,0.25), rgba(96,165,250,0.1))', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', marginBottom: 24 }}
      >
        {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
        {generating ? 'Researching and writing…' : result ? 'Regenerate' : 'Generate Reaction Post'}
      </button>

      {generating && (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: -16, marginBottom: 20 }}>
          Reading the source, forming an opinion, writing three drafts…
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Length tabs + save */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', gap: 3, padding: '3px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {LENGTH_TABS.map(({ key, label, range }) => (
                <button
                  key={key}
                  onClick={() => setLengthTab(key)}
                  style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: lengthTab === key ? 'rgba(96,165,250,0.15)' : 'none', color: lengthTab === key ? '#60a5fa' : 'rgba(255,255,255,0.35)', transition: 'all 0.15s' }}
                  title={range}
                >
                  {label}
                  <span style={{ marginLeft: 4, fontSize: 9, opacity: 0.6 }}>{wordCount(key === 'short' ? result.post_short : key === 'medium' ? result.post_medium : result.post_long)}w</span>
                </button>
              ))}
            </div>
            <button
              onClick={savePost}
              disabled={!!savedId || saving}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: savedId ? 'default' : 'pointer', border: savedId ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(255,255,255,0.1)', background: savedId ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.04)', color: savedId ? '#34d399' : 'rgba(255,255,255,0.5)' }}
            >
              {saving ? <Loader2 size={11} className="animate-spin" /> : savedId ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
              {savedId ? 'Saved' : 'Save all drafts'}
            </button>
          </div>

          {/* Active length post */}
          <PostViewer
            text={currentPost}
            label={lengthTab === 'short' ? 'Short · 150–250 words' : lengthTab === 'medium' ? 'Medium · 300–500 words' : 'Long-form · 600–900 words'}
            copied={copied}
            onCopy={copy}
            copyId={`post-${lengthTab}`}
            accent="#60a5fa"
          />

          {/* Takeaway + Hashtags (always visible) */}
          <div style={{ borderRadius: 10, padding: '12px 14px', background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.14)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>One-line takeaway</div>
            <div style={{ fontSize: 13, color: 'rgb(230,225,200)', lineHeight: 1.6, fontStyle: 'italic' }}>
              {result.takeaway}
            </div>
            {result.hashtags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {result.hashtags.map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', cursor: 'pointer' }}
                    onClick={() => copy(`hash-${h}`, h)}>
                    #{h.replace(/^#/, '')}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Extras: collapsible */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CollapsibleSection title="5 Alternative Hooks" icon={<Zap size={11} />} accent="#a78bfa">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.alt_hooks.map((hook, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(167,139,250,0.5)', flexShrink: 0, marginTop: 2 }}>{i + 1}</span>
                    <span style={{ fontSize: 12.5, color: 'rgb(200,205,230)', lineHeight: 1.6, flex: 1 }}>{hook}</span>
                    <button onClick={() => copy(`hook-${i}`, hook)} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: copied === `hook-${i}` ? '#a78bfa' : 'rgba(255,255,255,0.2)', marginTop: 2 }}>
                      {copied === `hook-${i}` ? <CheckCheck size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="3 Article Titles" icon={<Hash size={11} />} accent="#34d399">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {result.titles.map((title, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(52,211,153,0.5)', flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: 12.5, color: 'rgb(200,210,220)', lineHeight: 1.55, flex: 1 }}>{title}</span>
                    <button onClick={() => copy(`title-${i}`, title)} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: copied === `title-${i}` ? '#34d399' : 'rgba(255,255,255,0.2)' }}>
                      {copied === `title-${i}` ? <CheckCheck size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="5 Comment Ideas (post under your own post)" icon={<MessageSquare size={11} />} accent="#22d3ee">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {result.comment_ideas.map((comment, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(34,211,238,0.5)', flexShrink: 0, marginTop: 2 }}>{i + 1}</span>
                    <span style={{ fontSize: 12, color: 'rgb(190,200,220)', lineHeight: 1.65, flex: 1 }}>{comment}</span>
                    <button onClick={() => copy(`cmt-${i}`, comment)} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: copied === `cmt-${i}` ? '#22d3ee' : 'rgba(255,255,255,0.2)', marginTop: 2 }}>
                      {copied === `cmt-${i}` ? <CheckCheck size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Draft card ─────────────────────────────────────────────────────────────────
function DraftCard({ draft, copied, onCopy, onMarkPosted, onDelete }: {
  draft: ReactionDraft
  copied: string | null
  onCopy: (id: string, text: string) => void
  onMarkPosted: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [activeLength, setActiveLength] = useState<LengthTab>('medium')
  const isPosted = draft.status === 'posted'
  const tc = topicColor(draft.news_topic || '')
  const preview = draft.hook || draft.post_medium.slice(0, 160)
  const activePost = activeLength === 'short' ? draft.post_short : activeLength === 'medium' ? draft.post_medium : draft.post_long

  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${isPosted ? 'rgba(52,211,153,0.18)' : 'rgba(96,165,250,0.2)'}`, background: 'rgba(10,12,22,0.9)', boxShadow: '0 3px 16px rgba(0,0,0,0.2)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: isPosted ? 'rgba(52,211,153,0.05)' : 'rgba(96,165,250,0.05)', borderBottom: `1px solid ${isPosted ? 'rgba(52,211,153,0.12)' : 'rgba(96,165,250,0.12)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {draft.news_topic && <TopicBadge topic={draft.news_topic} />}
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock size={9} /> {timeAgo(draft.created_at)}
          </span>
          {isPosted && (
            <span style={{ fontSize: 9, color: '#34d399', fontWeight: 700 }}>✓ Posted</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {!isPosted && (
            <button onClick={() => onMarkPosted(draft.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', background: 'none', border: '1px solid rgba(52,211,153,0.2)', color: 'rgba(52,211,153,0.6)' }}>
              <CheckCircle2 size={10} /> Posted
            </button>
          )}
          <button onClick={() => onCopy(`draft-${draft.id}`, activePost)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: copied === `draft-${draft.id}` ? '#60a5fa' : 'rgba(255,255,255,0.3)' }}>
            {copied === `draft-${draft.id}` ? <CheckCheck size={11} /> : <Copy size={11} />}
            Copy
          </button>
          <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex' }}>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button onClick={() => { if (confirm('Delete this draft?')) onDelete(draft.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(248,113,113,0.35)', display: 'flex', padding: '2px' }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* News title */}
      {draft.news_title && (
        <div style={{ padding: '8px 14px 0', fontSize: 10, color: 'rgba(255,255,255,0.25)', lineHeight: 1.4 }}>
          → {draft.news_title.slice(0, 120)}{draft.news_title.length > 120 ? '…' : ''}
        </div>
      )}

      {/* Post preview */}
      <div style={{ padding: '10px 14px' }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.58, color: 'rgb(225,230,255)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {preview.slice(0, 200)}{!expanded && preview.length > 200 ? '…' : ''}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Length switcher */}
          <div style={{ display: 'flex', gap: 3, width: 'fit-content', padding: '3px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {(['short', 'medium', 'long'] as LengthTab[]).map(l => (
              <button key={l} onClick={() => setActiveLength(l)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: 'none', background: activeLength === l ? 'rgba(96,165,250,0.15)' : 'none', color: activeLength === l ? '#60a5fa' : 'rgba(255,255,255,0.3)' }}>
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>

          {/* Full post */}
          <div style={{ fontSize: 12.5, lineHeight: 1.75, color: 'rgb(190,198,228)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {activePost.split(/\n\n+/).slice(1).join('\n\n')}
          </div>

          {/* Takeaway */}
          {draft.takeaway && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Takeaway</div>
              <div style={{ fontSize: 11.5, color: 'rgb(225,215,180)', lineHeight: 1.55, fontStyle: 'italic' }}>{draft.takeaway}</div>
            </div>
          )}

          {/* Comment ideas preview */}
          {draft.comment_ideas.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(34,211,238,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Comment ideas</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {draft.comment_ideas.slice(0, 3).map((c, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'rgb(170,180,210)', lineHeight: 1.55, display: 'flex', gap: 6 }}>
                    <span style={{ color: 'rgba(34,211,238,0.4)', flexShrink: 0 }}>·</span>
                    {c}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ReactionMode() {
  const [topMode, setTopMode]         = useState<TopMode>('feed')
  const [feedSub, setFeedSub]         = useState<FeedSub>('list')
  const [items, setItems]             = useState<ReactionNewsItem[]>([])
  const [loadingFeed, setLoadingFeed] = useState(false)
  const [refreshing, setRefreshing]   = useState(false)
  const [topicFilter, setTopicFilter] = useState('All')
  const [selectedItem, setSelectedItem] = useState<ReactionNewsItem | null>(null)
  const [drafts, setDrafts]           = useState<ReactionDraft[]>([])
  const [draftsLoading, setDraftsLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'saved' | 'posted'>('all')
  const { copied, copy }              = useCopy()

  const loadFeed = useCallback(async () => {
    setLoadingFeed(true)
    try {
      const res  = await fetch('/api/reaction/fetch-news')
      const json = await res.json()
      setItems(json.items || [])
    } catch { /* silent */ }
    finally  { setLoadingFeed(false) }
  }, [])

  const refreshFeed = async () => {
    setRefreshing(true)
    try {
      const res  = await fetch('/api/reaction/fetch-news', { method: 'POST' })
      const json = await res.json()
      setItems(json.items || [])
      toast.success(`Feed refreshed — ${json.fetched_count} new item${json.fetched_count === 1 ? '' : 's'}`)
    } catch { toast.error('Refresh failed') }
    finally  { setRefreshing(false) }
  }

  const loadDrafts = useCallback(async () => {
    setDraftsLoading(true)
    try {
      const res  = await fetch('/api/reaction-drafts')
      const json = await res.json()
      setDrafts(json.drafts || [])
    } catch { /* silent */ }
    finally  { setDraftsLoading(false) }
  }, [])

  useEffect(() => { loadFeed(); loadDrafts() }, [loadFeed, loadDrafts])

  const handleReact = (item: ReactionNewsItem) => {
    setSelectedItem(item)
    setFeedSub('generate')
  }

  const handleDraftSaved = (draft: ReactionDraft) => {
    setDrafts(prev => [draft, ...prev])
    // Mark item as used in local state
    if (selectedItem) {
      setItems(prev => prev.map(i => i.id === selectedItem.id ? { ...i, used: true } : i))
    }
  }

  const markPosted = async (id: string) => {
    try {
      const res  = await fetch(`/api/reaction-drafts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'posted' }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setDrafts(prev => prev.map(d => d.id === id ? json.draft : d))
      toast.success('Marked as posted')
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Update failed') }
  }

  const deleteDraft = async (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id))
    try { await fetch(`/api/reaction-drafts/${id}`, { method: 'DELETE' }) }
    catch { /* already removed from UI */ }
  }

  // Unique topics from loaded items
  const topics = ['All', ...Array.from(new Set(items.map(i => i.topic))).sort()]

  const filteredItems = topicFilter === 'All'
    ? items
    : items.filter(i => i.topic === topicFilter)

  const filteredDrafts = drafts.filter(d => {
    if (filterStatus === 'saved')  return d.status === 'saved'
    if (filterStatus === 'posted') return d.status === 'posted'
    return true
  })

  const savedCount  = drafts.filter(d => d.status === 'saved').length
  const postedCount = drafts.filter(d => d.status === 'posted').length

  return (
    <div style={{ padding: '32px 32px 48px' }}>
      {/* ── Section header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lightbulb size={14} color="#60a5fa" />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: 0 }}>Reaction Studio</h2>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
            News from 20 topic areas → your personal LinkedIn reaction, ready to post
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: '3px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {([
            { key: 'feed' as TopMode, label: `News Feed${items.length > 0 ? ` (${items.length})` : ''}` },
            { key: 'saved' as TopMode, label: `Saved${drafts.length > 0 ? ` (${drafts.length})` : ''}` },
          ]).map(({ key, label }) => (
            <button key={key} onClick={() => { setTopMode(key); if (key === 'feed') setFeedSub('list') }} style={{ padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: topMode === key ? 'rgba(255,255,255,0.08)' : 'none', color: topMode === key ? 'white' : 'rgba(255,255,255,0.35)', transition: 'all 0.15s' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════
          FEED MODE
      ════════════════════════════════════ */}
      {topMode === 'feed' && feedSub === 'list' && (
        <div>
          {/* Topic filters + refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
              {topics.map(t => {
                const c = t === 'All' ? null : topicColor(t)
                const isActive = topicFilter === t
                return (
                  <button
                    key={t}
                    onClick={() => setTopicFilter(t)}
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                      border: isActive ? `1px solid ${c?.border || 'rgba(255,255,255,0.2)'}` : '1px solid rgba(255,255,255,0.07)',
                      background: isActive ? (c?.bg || 'rgba(255,255,255,0.08)') : 'rgba(255,255,255,0.02)',
                      color: isActive ? (c?.color || 'white') : 'rgba(255,255,255,0.35)',
                    }}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
            <button
              onClick={refreshFeed}
              disabled={refreshing}
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.5)' }}
            >
              <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Fetching…' : 'Refresh'}
            </button>
          </div>

          {/* Loading */}
          {loadingFeed && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
              <Loader2 size={28} className="animate-spin" style={{ color: '#60a5fa' }} />
            </div>
          )}

          {/* Empty */}
          {!loadingFeed && filteredItems.length === 0 && (
            <div style={{ minHeight: 320, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(18,19,32,0.5)', border: '2px dashed rgba(255,255,255,0.06)', gap: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: 13, background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Rss size={22} color="rgba(96,165,250,0.4)" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 5 }}>
                  {items.length === 0 ? 'No news yet' : 'No items match this filter'}
                </div>
                <div style={{ fontSize: 12, color: 'rgb(90,95,130)', lineHeight: 1.6, maxWidth: 320 }}>
                  {items.length === 0
                    ? 'Click Refresh to pull the latest news across all 20 topic areas. Takes ~20 seconds the first time.'
                    : 'Try "All" to see everything, or pick a different topic.'}
                </div>
              </div>
              {items.length === 0 && (
                <button onClick={refreshFeed} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa' }}>
                  <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                  {refreshing ? 'Fetching…' : 'Fetch News Now'}
                </button>
              )}
            </div>
          )}

          {/* News item list */}
          {!loadingFeed && filteredItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredItems.map(item => (
                <NewsCard key={item.id} item={item} onReact={handleReact} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════
          GENERATE MODE
      ════════════════════════════════════ */}
      {topMode === 'feed' && feedSub === 'generate' && selectedItem && (
        <GenerateView
          item={selectedItem}
          onBack={() => setFeedSub('list')}
          onSaved={handleDraftSaved}
        />
      )}

      {/* ════════════════════════════════════
          SAVED MODE
      ════════════════════════════════════ */}
      {topMode === 'saved' && (
        <div>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 22 }}>
            {[
              { label: 'Total saved', value: drafts.length, color: '#60a5fa' },
              { label: 'Ready to post', value: savedCount,  color: '#34d399' },
              { label: 'Posted',        value: postedCount, color: 'rgba(255,255,255,0.3)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: '12px 18px', borderRadius: 10, background: 'rgba(18,19,32,0.8)', border: '1px solid rgba(255,255,255,0.07)', minWidth: 110 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4, fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Filter + refresh */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', gap: 3, padding: '3px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {([
                { key: 'all' as const,    label: 'All' },
                { key: 'saved' as const,  label: 'Ready' },
                { key: 'posted' as const, label: 'Posted' },
              ]).map(({ key, label }) => (
                <button key={key} onClick={() => setFilterStatus(key)} style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: filterStatus === key ? 'rgba(255,255,255,0.08)' : 'none', color: filterStatus === key ? 'white' : 'rgba(255,255,255,0.35)' }}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={loadDrafts} disabled={draftsLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.3)' }}>
              <RefreshCw size={10} className={draftsLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {draftsLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
              <Loader2 size={24} className="animate-spin" style={{ color: '#60a5fa' }} />
            </div>
          )}

          {!draftsLoading && filteredDrafts.length === 0 && (
            <div style={{ minHeight: 280, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(18,19,32,0.5)', border: '2px dashed rgba(255,255,255,0.06)', gap: 10 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bookmark size={20} color="rgba(96,165,250,0.4)" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 5 }}>
                  {drafts.length === 0 ? 'No saved posts yet' : 'Nothing matches this filter'}
                </div>
                <div style={{ fontSize: 12, color: 'rgb(90,95,130)', lineHeight: 1.6, maxWidth: 280 }}>
                  {drafts.length === 0 ? 'Go to News Feed, pick a story, generate a post, and save it.' : 'Try All to see everything.'}
                </div>
              </div>
              {drafts.length === 0 && (
                <button onClick={() => { setTopMode('feed'); setFeedSub('list') }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa' }}>
                  <Sparkles size={13} /> Go to News Feed
                </button>
              )}
            </div>
          )}

          {!draftsLoading && filteredDrafts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredDrafts.map(draft => (
                <DraftCard
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
    </div>
  )
}
