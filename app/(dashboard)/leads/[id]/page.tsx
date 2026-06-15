'use client'

import { useEffect, useState, use, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, ExternalLink, Star, Edit3 as Edit, Save, X, Loader2,
  Sparkles, Target, Shield, Users, MessageSquare, ThumbsUp,
  Copy, CheckCircle, CheckCircle2, AlertTriangle, Globe, Link2, Send,
  ChevronDown, ChevronUp, RefreshCw, Building2, Brain,
  FileSearch, Puzzle, Calendar, Mail, Wand2,
  MapPin, AtSign, MessageCircle, Plus, Trash2, History,
  BadgeCheck, AlertCircle, Lightbulb
} from 'lucide-react'
import {
  cn, getScoreBg, getStatusColor, getStatusLabel, getSeverityColor,
  getConfidenceColor, formatDate, isHttpUrl, pickBestUrl
} from '@/lib/utils'
import {
  buildTarget, channelDeepLink, logTouch, recordOutcome,
  type OutreachMeta, type OutreachOutcome,
} from '@/lib/outreach'
import type { Lead, Contact, ContactTouch, OutreachMessage, UseCase } from '@/lib/types'
import { INDUSTRY_CATEGORIES, CUSTOMER_CATEGORIES, PRODUCTS_TO_SELL, REGIONS } from '@/lib/types'
import { actStart, actFinish, ACTION_TOOL, ACTION_LABEL } from '@/lib/agent-activity'

type AIAction = 'research' | 'pain_points' | 'kima_fit' | 'aeredium_fit' | 'classify' | 'score' | 'contacts' | null

/* ── Design tokens (matching reference exactly) ──────────────── */
const C = {
  pageBg:      '#070A12',
  containerBg: '#0B0F1A',
  headerBg:    'linear-gradient(to right, #0C1020, #090B13)',
  cardBg:      '#101522',
  nestedBg:    '#151A2A',
  border:      '1px solid rgba(255,255,255,0.08)',
  borderStrong:'1px solid rgba(255,255,255,0.12)',
}

/* ── Primitive components ────────────────────────────────────── */

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={{
      borderRadius: 16, border: C.border, background: C.cardBg,
      padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.4)', ...style
    }}>
      {children}
    </section>
  )
}

function InfoBlock({ title, value }: { title: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'rgb(100,107,140)', marginBottom: 8, fontWeight: 600 }}>
        {title}
      </p>
      <p style={{ fontSize: 14, lineHeight: 1.65, color: 'rgb(210,215,235)' }}>{value}</p>
    </div>
  )
}

// Renders a prose string as clean bullet points
function ProseBullets({ text, color = 'rgb(210,215,235)', dotColor = 'rgba(167,139,250,0.7)', fontSize = 13 }: {
  text: string; color?: string; dotColor?: string; fontSize?: number
}) {
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-Z—])|(?<=\n)\s*/)
    .map(s => s.trim().replace(/^[•·\-–—]\s*/, ''))
    .filter(s => s.length > 8)

  if (sentences.length <= 1) {
    return <p style={{ fontSize, lineHeight: 1.7, color, margin: 0 }}>{text}</p>
  }

  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sentences.map((s, i) => (
        <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, marginTop: 7, width: 5, height: 5, borderRadius: '50%', background: dotColor }} />
          <span style={{ fontSize, lineHeight: 1.65, color }}>{s}</span>
        </li>
      ))}
    </ul>
  )
}

function SocialChip({ icon: Icon, label, href, color }: {
  icon: React.ComponentType<{ size?: number }>; label: string; href: string; color: string
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px',
        borderRadius: 8, fontSize: 12, fontWeight: 500, textDecoration: 'none',
        border: `1px solid ${color}40`, background: `${color}14`, color,
      }}>
      <Icon size={13} />
      {label}
    </a>
  )
}

function TagBadge({ label, variant = 'gray' }: { label: string; variant?: 'purple' | 'blue' | 'gray' | 'green' }) {
  const styles: Record<string, React.CSSProperties> = {
    purple: { border: '1px solid rgba(168,85,247,0.35)', background: 'rgba(168,85,247,0.12)', color: 'rgb(196,167,252)' },
    blue:   { border: '1px solid rgba(96,165,250,0.35)',  background: 'rgba(96,165,250,0.1)',   color: 'rgb(147,197,253)' },
    green:  { border: '1px solid rgba(52,211,153,0.35)',  background: 'rgba(52,211,153,0.1)',   color: 'rgb(110,231,183)' },
    gray:   { border: '1px solid rgba(255,255,255,0.1)',  background: 'rgba(255,255,255,0.05)', color: 'rgb(203,213,225)' },
  }
  return (
    <span style={{ borderRadius: 8, padding: '6px 14px', fontSize: 13, ...styles[variant] }}>
      {label}
    </span>
  )
}

function ActionBtn({ icon: Icon, label, variant = 'default', onClick, disabled, href }: {
  icon: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>; label: string
  variant?: 'default' | 'green' | 'red' | 'purple' | 'cyan'
  onClick?: () => void; disabled?: boolean; href?: string
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: { border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgb(203,213,225)' },
    green:   { border: '1px solid rgba(52,211,153,0.3)',  background: 'rgba(52,211,153,0.1)',   color: 'rgb(110,231,183)' },
    red:     { border: '1px solid rgba(248,113,133,0.3)', background: 'rgba(248,113,133,0.1)',  color: 'rgb(252,165,165)' },
    purple:  { border: '1px solid rgba(168,85,247,0.4)',  background: 'rgba(168,85,247,0.13)',  color: 'rgb(196,167,252)' },
    cyan:    { border: '1px solid rgba(34,211,238,0.4)',  background: 'rgba(34,211,238,0.12)',  color: 'rgb(103,232,249)' },
  }
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
    transition: 'all 0.18s', fontFamily: 'inherit', whiteSpace: 'nowrap',
    ...styles[variant]
  }
  if (href) return <Link href={href} style={base}><Icon size={14} />{label}</Link>
  return <button style={base} onClick={onClick} disabled={disabled}><Icon size={14} />{label}</button>
}

function FindingCard({ icon: Icon, title, subtitle, body, rightLabel, rightValue, pill, pillVariant = 'purple', expanded, onToggle, children }: {
  icon: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>; title: string; subtitle?: string
  body?: string | null; rightLabel?: string; rightValue?: string | null
  pill?: string | null; pillVariant?: 'purple' | 'red' | 'green'
  expanded: boolean; onToggle: () => void; children?: React.ReactNode
}) {
  const iconBg: Record<string, React.CSSProperties> = {
    purple: { background: 'rgba(168,85,247,0.13)', color: 'rgb(196,167,252)' },
    red:    { background: 'rgba(248,113,133,0.12)', color: 'rgb(252,165,165)' },
    green:  { background: 'rgba(52,211,153,0.12)',  color: 'rgb(110,231,183)' },
  }
  const pillSty: Record<string, React.CSSProperties> = {
    red:    { border: '1px solid rgba(248,113,133,0.4)', background: 'rgba(248,113,133,0.1)', color: 'rgb(252,165,165)' },
    green:  { border: '1px solid rgba(52,211,153,0.4)',  background: 'rgba(52,211,153,0.1)',  color: 'rgb(110,231,183)' },
    purple: { border: '1px solid rgba(168,85,247,0.4)',  background: 'rgba(168,85,247,0.1)',  color: 'rgb(196,167,252)' },
  }
  return (
    <div style={{ borderRadius: 16, border: C.border, background: C.cardBg, boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
      {/* row */}
      <div style={{ width: '100%', padding: '18px 20px', display: 'grid', gridTemplateColumns: '1fr auto 24px', gap: 20, alignItems: 'center', borderBottom: expanded ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
        {/* left */}
        <div onClick={onToggle} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', textAlign: 'left', cursor: 'pointer' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...iconBg[pillVariant] }}>
            <Icon size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'white', margin: 0, lineHeight: 1.3 }}>{title}</h3>
            {subtitle && <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'rgb(100,107,140)', marginTop: 4, marginBottom: 0 }}>{subtitle}</p>}
            {body && <p style={{ fontSize: 13, color: 'rgb(190,195,220)', marginTop: 6, lineHeight: 1.6 }}>{body}</p>}
          </div>
        </div>
        {/* right label + pill/link */}
        <div style={{ minWidth: 200 }}>
          {rightLabel && <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'rgb(100,107,140)', marginBottom: 8 }}>{rightLabel}</p>}
          {rightValue && (
            isHttpUrl(rightValue) ? (
              <a href={rightValue} target="_blank" rel="noopener noreferrer" title={rightValue}
                style={{ fontSize: 13, color: 'rgb(96,165,250)', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rightValue}</span>
                <ExternalLink size={13} style={{ flexShrink: 0 }} />
              </a>
            ) : (
              <p style={{ fontSize: 13, color: 'rgb(96,165,250)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rightValue}</span>
                <ExternalLink size={13} />
              </p>
            )
          )}
          {pill && (
            <span style={{ display: 'inline-flex', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 500, ...pillSty[pillVariant] }}>
              {pill}
            </span>
          )}
        </div>
        {/* chevron */}
        <div onClick={onToggle} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {expanded ? <ChevronUp size={18} color="rgb(100,107,140)" /> : <ChevronDown size={18} color="rgb(100,107,140)" />}
        </div>
      </div>
      {/* expanded body */}
      {expanded && children && (
        <div style={{ padding: '20px 24px' }}>{children}</div>
      )}
    </div>
  )
}

function StatStrip({ score, confidence, addedAt }: { score?: number | null; confidence?: number | null; addedAt: string }) {
  const scoreColor = score == null ? '#a78bfa' : score >= 85 ? '#c084fc' : score >= 70 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171'
  const pct = score != null ? Math.min(score, 100) : 0
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, borderRadius: 16, border: C.border, background: C.cardBg, padding: 20 }}>
      {/* Score */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgb(148,163,184)', fontSize: 13 }}>
          <Star size={14} color="#c084fc" />
          Lead Score
        </div>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 30, fontWeight: 600, color: scoreColor, fontVariantNumeric: 'tabular-nums' }}>{score ?? '—'}</span>
          {score != null && (
            <div style={{ height: 8, width: 80, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: '#7c3aed', transition: 'width 0.6s ease' }} />
            </div>
          )}
        </div>
      </div>
      {/* Confidence */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgb(148,163,184)', fontSize: 13 }}>
          <Shield size={14} color="#c084fc" />
          Confidence
        </div>
        <div style={{ marginTop: 10 }}>
          <span style={{ fontSize: 30, fontWeight: 600, color: '#c084fc', fontVariantNumeric: 'tabular-nums' }}>{confidence ?? '—'}</span>
        </div>
      </div>
      {/* Added */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgb(148,163,184)', fontSize: 13 }}>
          <Calendar size={14} color="#c084fc" />
          Added
        </div>
        <div style={{ marginTop: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'rgb(203,213,225)' }}>{formatDate(addedAt)}</span>
        </div>
      </div>
    </div>
  )
}

const ALL_OUTREACH_CHANNELS = [
  { id: 'twitter',  label: 'X (Twitter)', color: '#38bdf8' },
  { id: 'linkedin', label: 'LinkedIn',    color: '#60a5fa' },
  { id: 'email',    label: 'Email',       color: '#a78bfa' },
  { id: 'telegram', label: 'Telegram',    color: '#22d3ee' },
]

function ContactCard({ contact, onRefresh, onUpdate, refreshing }: {
  contact: Contact; onRefresh: () => void; onUpdate: () => void; refreshing: boolean
}) {
  const supabase = createClient()
  const [enriching, setEnriching] = useState(false)
  const initials = contact.name
    ? contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const confStyle: React.CSSProperties = contact.contact_confidence === 'high'
    ? { border: '1px solid rgba(52,211,153,0.4)', background: 'rgba(52,211,153,0.1)', color: 'rgb(110,231,183)' }
    : contact.contact_confidence === 'low'
    ? { border: '1px solid rgba(248,113,133,0.4)', background: 'rgba(248,113,133,0.1)', color: 'rgb(252,165,165)' }
    : { border: '1px solid rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.1)', color: 'rgb(253,224,71)' }

  // Extract display handle from URL
  const twitterHandle = contact.twitter_url?.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]+)/)?.[1]
  const linkedinPath = contact.linkedin_url?.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\/?/, '').replace(/\/$/, '')
  const githubUser = contact.github_url?.match(/github\.com\/([A-Za-z0-9_-]+)/)?.[1]

  const hasSocials = contact.email || contact.twitter_url || contact.linkedin_url || contact.github_url

  // Per-person outreach tracking — optimistic UI (turns green instantly)
  const [localTouched, setLocalTouched] = useState<ContactTouch[]>(contact.contacted_channels || [])
  useEffect(() => { setLocalTouched(contact.contacted_channels || []) }, [contact.contacted_channels])
  const touchedSet = new Set(localTouched.map(t => t.channel))

  const toggleContactChannel = async (chId: string) => {
    const alreadyTouched = touchedSet.has(chId)
    const updated: ContactTouch[] = alreadyTouched
      ? localTouched.filter(t => t.channel !== chId)
      : [...localTouched, { channel: chId, contacted_at: new Date().toISOString() }]

    // Optimistic: flip colour immediately, no waiting
    setLocalTouched(updated)

    const { error } = await supabase.from('contacts').update({ contacted_channels: updated }).eq('id', contact.id)
    if (error) {
      setLocalTouched(localTouched) // revert on failure
      toast.error('Could not save — run the add-contact-channels.sql migration in Supabase')
    } else {
      const chLabel = ALL_OUTREACH_CHANNELS.find(c => c.id === chId)?.label || chId
      toast.success(alreadyTouched ? 'Removed from log' : `✓ Contacted via ${chLabel}`)
      onUpdate()
    }
  }

  // One-click enrich: search Exa for this person's profiles
  const enrichContact = async () => {
    if (!contact.name) return
    setEnriching(true)
    const actId = actStart({ tool: 'Exa', action: `Find handles — ${contact.name}`, page: 'Lead Detail · Contacts', timestamp: Date.now() })
    const t0 = Date.now()
    try {
      const res = await fetch('/api/ai/enrich-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contact.id, name: contact.name, role: contact.role }),
      })
      const data = await res.json()
      if (data.twitter_url || data.linkedin_url || data.github_url || data.email) {
        await supabase.from('contacts').update({
          twitter_url: data.twitter_url || contact.twitter_url,
          linkedin_url: data.linkedin_url || contact.linkedin_url,
          github_url: data.github_url || contact.github_url,
          email: data.email || contact.email,
        }).eq('id', contact.id)
        const found = [data.twitter_url && 'Twitter', data.linkedin_url && 'LinkedIn', data.github_url && 'GitHub', data.email && 'Email'].filter(Boolean).join(', ')
        actFinish(actId, 'success', `Found: ${found}`, Date.now() - t0)
        toast.success(`Found: ${found}`)
        onRefresh()
      } else {
        actFinish(actId, 'success', 'No new handles found', Date.now() - t0)
        toast('No new handles found for this person')
      }
    } catch {
      actFinish(actId, 'error', 'Enrichment failed', Date.now() - t0)
      toast.error('Enrichment failed')
    }
    finally { setEnriching(false) }
  }

  return (
    <div style={{ borderRadius: 16, border: C.border, background: C.nestedBg, padding: '18px 20px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(124,58,237,0.3),rgba(56,189,248,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#a78bfa', flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{contact.name || '—'}</div>
            <div style={{ fontSize: 12, color: 'rgb(148,163,184)', marginTop: 2 }}>{contact.role}</div>
          </div>
        </div>
        {contact.contact_confidence && (
          <span style={{ borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 600, flexShrink: 0, ...confStyle }}>
            {contact.contact_confidence.charAt(0).toUpperCase() + contact.contact_confidence.slice(1)}
          </span>
        )}
      </div>

      {/* Social chips — show actual handles, not generic labels */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: hasSocials ? 14 : 0 }}>
        {contact.twitter_url && (
          <a href={contact.twitter_url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.08)', color: '#38bdf8' }}>
            <AtSign size={12} />@{twitterHandle || 'Twitter'}
          </a>
        )}
        {contact.linkedin_url && (
          <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.08)', color: '#60a5fa' }}>
            <ExternalLink size={12} />{linkedinPath ? `in/${linkedinPath.slice(0, 20)}` : 'LinkedIn'}
          </a>
        )}
        {contact.github_url && (
          <a href={contact.github_url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.08)', color: '#a78bfa' }}>
            <Link2 size={12} />{githubUser || 'GitHub'}
          </a>
        )}
        {contact.email && (
          <button onClick={() => { navigator.clipboard.writeText(contact.email!); toast.success('Email copied') }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.08)', color: '#c084fc' }}>
            <Mail size={12} />{contact.email.length > 28 ? contact.email.slice(0, 28) + '…' : contact.email}
          </button>
        )}
        {contact.telegram && (
          <a href={contact.telegram.startsWith('http') ? contact.telegram : `https://t.me/${contact.telegram}`} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(34,211,238,0.3)', background: 'rgba(34,211,238,0.08)', color: '#22d3ee' }}>
            <Send size={12} />{contact.telegram.replace(/^.*t\.me\//, '@')}
          </a>
        )}
      </div>

      {/* Reason */}
      {contact.reason_this_person && (
        <div style={{ fontSize: 12, color: 'rgb(150,155,185)', lineHeight: 1.55, marginBottom: 14, paddingLeft: 2 }}>
          {contact.reason_this_person}
        </div>
      )}

      {/* Footer actions */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={onRefresh} disabled={refreshing || enriching}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgb(196,167,252)', background: 'none', border: 'none', cursor: 'pointer', opacity: refreshing ? 0.5 : 1 }}>
          {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Refresh
        </button>
        {!hasSocials && (
          <button onClick={enrichContact} disabled={enriching || refreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#34d399', background: 'none', border: 'none', cursor: 'pointer', opacity: enriching ? 0.5 : 1 }}>
            {enriching ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Find handles
          </button>
        )}
        {hasSocials && !contact.email && (
          <button onClick={enrichContact} disabled={enriching || refreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fbbf24', background: 'none', border: 'none', cursor: 'pointer', opacity: enriching ? 0.5 : 1 }}>
            {enriching ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Find email
          </button>
        )}
      </div>

      {/* ── Per-person outreach log — always show all 4 channels ── */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgb(100,107,140)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>
          Contacted via
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALL_OUTREACH_CHANNELS.map(ch => {
            const touched = touchedSet.has(ch.id)
            const touchData = localTouched.find(t => t.channel === ch.id)
            const whenStr = touchData
              ? new Date(touchData.contacted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : ''
            return (
              <button key={ch.id} onClick={() => toggleContactChannel(ch.id)}
                title={touched ? `Contacted ${whenStr} · click to undo` : `Mark as contacted via ${ch.label}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${touched ? ch.color + '55' : 'rgba(255,255,255,0.08)'}`,
                  background: touched ? ch.color + '18' : 'rgba(255,255,255,0.03)',
                  color: touched ? ch.color : 'rgb(120,127,160)',
                  transition: 'all 0.15s',
                }}>
                {touched ? <CheckCircle2 size={11} /> : <Plus size={11} />}
                {ch.label}
                {touched && whenStr && (
                  <span style={{ fontSize: 10, opacity: 0.7 }}>{whenStr}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function AccordionPanel({ icon: Icon, title, iconColor, expanded, onToggle, children }: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; title: string; iconColor: string
  expanded: boolean; onToggle: () => void; children?: React.ReactNode
}) {
  return (
    <div style={{ borderRadius: 16, border: C.border, background: C.cardBg, boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
      <button onClick={onToggle} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: expanded ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon size={18} style={{ color: iconColor }} />
          <h3 style={{ fontSize: 15, fontWeight: 500, color: 'rgb(241,245,249)', margin: 0 }}>{title}</h3>
        </div>
        {expanded ? <ChevronUp size={18} color="rgb(100,107,140)" /> : <ChevronDown size={18} color="rgb(100,107,140)" />}
      </button>
      {expanded && children && <div style={{ padding: '20px 22px' }}>{children}</div>}
    </div>
  )
}

/* ── Contacted Modal ──────────────────────────────────── */
const CHANNELS: { id: string; label: string; icon: string; color: string }[] = [
  { id: 'telegram',  label: 'Telegram',  icon: '✈️', color: '#22d3ee' },
  { id: 'twitter',   label: 'Twitter / X', icon: '𝕏', color: '#38bdf8' },
  { id: 'linkedin',  label: 'LinkedIn',  icon: 'in', color: '#60a5fa' },
  { id: 'email',     label: 'Email',     icon: '✉️', color: '#a78bfa' },
  { id: 'discord',   label: 'Discord',   icon: '💬', color: '#818cf8' },
  { id: 'call',      label: 'Call',      icon: '📞', color: '#34d399' },
]

const CONTACTED_STATUSES_SET = new Set(['contacted', 'replied', 'meeting_booked', 'proposal_sent', 'negotiating', 'integration', 'won'])

function ContactedModal({ lead, onClose, onSaved }: {
  lead: Lead; onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [channel, setChannel] = useState('')
  const [note, setNote] = useState('')
  const [followUpDays, setFollowUpDays] = useState('3')
  const [saving, setSaving] = useState(false)
  const [prevActivities, setPrevActivities] = useState<Array<{ channel: string; created_at: string }>>([])

  useEffect(() => {
    supabase
      .from('lead_activities')
      .select('channel, created_at')
      .eq('lead_id', lead.id)
      .not('channel', 'is', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => setPrevActivities(data || []))
  }, [lead.id]) // eslint-disable-line

  const prevChannelCounts = prevActivities.reduce<Record<string, number>>((acc, a) => {
    if (a.channel) acc[a.channel] = (acc[a.channel] || 0) + 1
    return acc
  }, {})
  const isRecontact = CONTACTED_STATUSES_SET.has(lead.status)

  const save = async () => {
    if (!channel) { toast.error('Pick a channel'); return }
    setSaving(true)
    const now = new Date()
    const followUpAt = new Date(now.getTime() + parseInt(followUpDays) * 86400000)

    // 1. Update lead — never downgrade status if already in a contacted state
    await supabase.from('leads').update({
      ...(isRecontact ? {} : { status: 'contacted' }),
      contacted_at: lead.contacted_at || now.toISOString(),   // preserve first-contact time
      last_contacted_at: now.toISOString(),
      last_channel: channel,
      next_follow_up_at: followUpAt.toISOString(),
      updated_at: now.toISOString(),
    }).eq('id', lead.id)

    // 2. Log it as a CRM activity with channel + follow-up date
    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      type: 'email',   // maps to outreach in the timeline
      channel,
      content: note.trim() || `Reached out via ${CHANNELS.find(c => c.id === channel)?.label}`,
      scheduled_at: null,
      follow_up_at: followUpAt.toISOString(),
    })

    setSaving(false)
    toast.success(`Logged — follow-up in ${followUpDays} days`)
    onSaved()
    onClose()
  }

  const modalContent = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(4,4,10,0.82)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, background: 'linear-gradient(180deg, rgb(18,19,30), rgb(13,13,21))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28, boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'white' }}>
              {isRecontact ? 'Log Another Outreach' : 'Mark as Contacted'}
            </div>
            <div style={{ fontSize: 12, color: 'rgb(120,127,160)', marginTop: 3 }}>{lead.company_name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgb(120,127,160)', cursor: 'pointer' }}><X size={16} /></button>
        </div>

        {/* Previous contact history */}
        {prevActivities.length > 0 && (
          <div style={{ marginBottom: 18, padding: '10px 14px', borderRadius: 10, background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.18)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#34d399', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={12} />
              Previously contacted · {prevActivities.length} {prevActivities.length === 1 ? 'time' : 'times'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(prevChannelCounts).map(([ch, count]) => {
                const def = CHANNELS.find(c => c.id === ch)
                if (!def) return null
                return (
                  <span key={ch} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: `1px solid ${def.color}40`, background: `${def.color}10`, color: def.color }}>
                    {def.icon} {def.label} {count > 1 ? `×${count}` : ''}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Channel picker */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgb(150,155,185)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Where did you reach out? *</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {CHANNELS.map(ch => {
              const prevCount = prevChannelCounts[ch.id] || 0
              const isSelected = channel === ch.id
              return (
                <button key={ch.id} onClick={() => setChannel(ch.id)}
                  style={{ padding: '10px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center', fontFamily: 'inherit',
                    border: `1px solid ${isSelected ? ch.color + '70' : prevCount > 0 ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    background: isSelected ? ch.color + '1a' : prevCount > 0 ? 'rgba(52,211,153,0.07)' : 'rgba(255,255,255,0.03)',
                    color: isSelected ? ch.color : prevCount > 0 ? '#34d399' : 'rgb(150,155,185)' }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{ch.icon}</div>
                  {ch.label}
                  {prevCount > 0 && !isSelected && (
                    <div style={{ fontSize: 9, marginTop: 2, opacity: 0.8 }}>✓ used ×{prevCount}</div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Note */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgb(150,155,185)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Note (optional)</div>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="What did you send? Key points, message thread, etc."
            rows={3}
            style={{ width: '100%', resize: 'none', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.35)', color: 'white', fontSize: 13, fontFamily: 'inherit', lineHeight: 1.6, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Follow-up */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgb(150,155,185)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Follow-up reminder</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['1', '3', '5', '7', '14'].map(d => (
              <button key={d} onClick={() => setFollowUpDays(d)}
                style={{ flex: 1, padding: '8px 0', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  border: `1px solid ${followUpDays === d ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  background: followUpDays === d ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.03)',
                  color: followUpDays === d ? '#a78bfa' : 'rgb(150,155,185)' }}>
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgb(150,155,185)' }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving || !channel}
            style={{ flex: 2, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: saving || !channel ? 'not-allowed' : 'pointer', background: channel ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${channel ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.06)'}`, color: channel ? '#34d399' : 'rgb(100,107,140)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: saving ? 0.7 : 1 }}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><CheckCircle size={14} /> Log & set follow-up</>}
          </button>
        </div>
      </div>
    </div>
  )
  if (typeof window === 'undefined') return null
  return createPortal(modalContent, document.body)
}

/* ── Real Use Cases section ─────────────────────────────── */
// ── Bullet renderer: handles both new (array) and legacy (string) formats ──
function UCPoints({ value, color }: { value: string | string[] | unknown; color: string }) {
  const pts: string[] = Array.isArray(value)
    ? (value as string[]).filter(Boolean)
    : typeof value === 'string' && value.trim()
      ? value.split(/(?<=[.!?])\s+(?=[A-Z—])|\n/).map(s => s.trim()).filter(s => s.length > 8)
      : []
  if (!pts.length) return null
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
      {pts.map((pt, i) => (
        <li key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, marginTop: 5, width: 5, height: 5, borderRadius: '50%', background: color, opacity: 0.8 }} />
          <span style={{ fontSize: 13, lineHeight: 1.6, color: 'rgb(210,215,235)' }}>{pt.replace(/^[•·\-–—]\s*/, '')}</span>
        </li>
      ))}
    </ul>
  )
}

function UseCasesSection({ lead, onGenerated }: { lead: Lead; onGenerated: (cases: UseCase[]) => void }) {
  const [generating, setGenerating] = useState(false)
  const cases: UseCase[] = (lead.use_cases as UseCase[]) || []

  const generate = async () => {
    setGenerating(true)
    const actId = actStart({ tool: 'Claude', action: 'Generate Use Cases', page: `Lead — ${lead.company_name}`, timestamp: Date.now() })
    const t0 = Date.now()
    try {
      const res = await fetch('/api/ai/use-cases', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onGenerated(json.use_cases)
      actFinish(actId, 'success', `${json.use_cases.length} use cases generated`, Date.now() - t0)
      toast.success(`${json.use_cases.length} use cases generated`)
    } catch (err: unknown) {
      actFinish(actId, 'error', err instanceof Error ? err.message : 'Generation failed', Date.now() - t0)
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally { setGenerating(false) }
  }

  const feasColor = (f: string) =>
    f === 'high'   ? { bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)',  text: 'rgb(110,231,183)' } :
    f === 'medium' ? { bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)',  text: 'rgb(253,224,71)'  } :
                     { bg: 'rgba(252,165,165,0.1)', border: 'rgba(252,165,165,0.25)', text: 'rgb(252,165,165)' }

  const impactColor = (i: string) =>
    i === 'transformative' ? { bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)', text: 'rgb(196,167,252)' } :
    i === 'significant'    ? { bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.25)', text: 'rgb(147,197,253)' } :
                             { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)', text: 'rgb(160,165,195)' }

  const catColor = (c: string): string => ({
    Settlement: 'rgb(52,211,153)', Payments: 'rgb(96,165,250)',
    Treasury: 'rgb(251,191,36)', Security: 'rgb(252,165,165)',
    'On/Off-ramp': 'rgb(167,139,250)', Agentic: 'rgb(34,211,238)',
    DvP: 'rgb(110,231,183)', Other: 'rgb(160,165,195)',
  }[c] ?? 'rgb(160,165,195)')

  const hasAerediumRole = (uc: UseCase) => {
    const r = uc.aeredium_role
    if (!r) return false
    if (Array.isArray(r)) return (r as string[]).some(s => s.trim().length > 0)
    return typeof r === 'string' && r.trim().length > 0
  }

  return (
    <div style={{ padding: '0 24px 24px' }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(99,102,241,0.2))', border: '1px solid rgba(124,58,237,0.35)' }}>
            <Puzzle size={16} color="rgb(167,139,250)" />
          </div>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'white', margin: 0, letterSpacing: '-0.02em' }}>Real Use Cases</h2>
            <p style={{ fontSize: 11, color: 'rgb(100,107,140)', margin: '2px 0 0', letterSpacing: '0.04em' }}>
              How Kima &amp; Aeredium work with {lead.company_name} · backed by research
            </p>
          </div>
        </div>
        <button onClick={generate} disabled={generating}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10,
            fontSize: 12, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer',
            opacity: generating ? 0.7 : 1, fontFamily: 'inherit',
            background: cases.length > 0
              ? 'rgba(124,58,237,0.08)' : 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(99,102,241,0.15))',
            border: '1px solid rgba(124,58,237,0.3)', color: 'rgb(167,139,250)',
          }}>
          {generating
            ? <><Loader2 size={13} className="animate-spin" />Researching...</>
            : cases.length > 0
              ? <><RefreshCw size={12} />Regenerate</>
              : <><Sparkles size={12} />Generate Use Cases</>}
        </button>
      </div>

      {/* Empty state */}
      {cases.length === 0 && !generating && (
        <div style={{ borderRadius: 16, border: '1px dashed rgba(124,58,237,0.2)', background: 'rgba(124,58,237,0.03)', padding: '48px 24px', textAlign: 'center' }}>
          <Puzzle size={36} color="rgba(167,139,250,0.3)" style={{ margin: '0 auto 14px' }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 8 }}>No use cases yet</p>
          <p style={{ fontSize: 13, color: 'rgb(100,107,140)', lineHeight: 1.65, maxWidth: 420, margin: '0 auto 20px' }}>
            The agent researches {lead.company_name}&apos;s workflows and pain points, then builds concrete scenarios showing exactly how Kima, Aeredium, and Aergap each fit.
          </p>
          <button onClick={generate} disabled={generating}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: 'white', border: 'none', boxShadow: '0 2px 14px rgba(124,58,237,0.3)' }}>
            <Sparkles size={14} /> Generate Use Cases
          </button>
        </div>
      )}

      {/* Generating skeleton */}
      {generating && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[0, 1].map(i => (
            <div key={i} style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', background: C.cardBg, padding: '20px 24px', opacity: 0.5 + i * 0.2 }}>
              <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.06)', marginBottom: 10, width: '30%' }} />
              <div style={{ height: 17, borderRadius: 8, background: 'rgba(255,255,255,0.08)', marginBottom: 16, width: '65%' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[100,85,92].map((w, j) => <div key={j} style={{ height: 11, borderRadius: 5, background: 'rgba(255,255,255,0.05)', width: `${w}%` }} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Use case list — vertical, readable */}
      {cases.length > 0 && !generating && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {cases.map((uc, idx) => {
            const feas   = feasColor(uc.feasibility)
            const impact = impactColor(uc.impact)
            const cc     = catColor(uc.category)
            return (
              <div key={uc.id || idx} style={{
                borderRadius: 18, border: '1px solid rgba(255,255,255,0.08)',
                background: C.cardBg, overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.28)',
              }}>
                {/* ── Header ── */}
                <div style={{ padding: '18px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  {/* Index bubble */}
                  <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 9, background: `${cc}18`, border: `1px solid ${cc}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: cc, marginTop: 2 }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Pills row */}
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 9 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: `${cc}18`, color: cc, border: `1px solid ${cc}30`, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        {uc.category}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: feas.bg, color: feas.text, border: `1px solid ${feas.border}` }}>
                        {uc.feasibility} feasibility
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: impact.bg, color: impact.text, border: `1px solid ${impact.border}` }}>
                        {uc.impact}
                      </span>
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: 0, lineHeight: 1.35, letterSpacing: '-0.015em' }}>
                      {uc.title}
                    </h3>
                  </div>
                </div>

                {/* ── Body: 2-col on wide, stacked on narrow ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>

                  {/* Left col: Scenario + Why Now */}
                  <div style={{ padding: '20px 24px', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 11 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'rgb(100,107,140)' }}>📖 The Situation</span>
                      </div>
                      <UCPoints value={uc.scenario} color="rgb(147,155,200)" />
                    </div>

                    {uc.why_now && (typeof uc.why_now === 'string' ? uc.why_now.trim() : true) && (
                      <div style={{ display: 'flex', gap: 9, padding: '10px 14px', borderRadius: 10, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                        <Lightbulb size={13} color="#fbbf24" style={{ flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#fbbf24', display: 'block', marginBottom: 4 }}>Why Now</span>
                          <span style={{ fontSize: 12, color: 'rgb(210,185,130)', lineHeight: 1.55 }}>{uc.why_now as string}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right col: Roles + Outcomes */}
                  <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Kima role */}
                    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.18)' }}>
                      <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgb(167,139,250)', marginBottom: 10 }}>
                        ⚡ Kima&apos;s Role
                      </div>
                      <UCPoints value={uc.kima_role} color="rgb(167,139,250)" />
                    </div>

                    {/* Aeredium role — only if relevant */}
                    {hasAerediumRole(uc) && (
                      <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.18)' }}>
                        <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgb(103,232,249)', marginBottom: 10 }}>
                          🛡 Aeredium&apos;s Role
                        </div>
                        <UCPoints value={uc.aeredium_role} color="rgb(103,232,249)" />
                      </div>
                    )}

                    {/* Outcomes */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ padding: '12px 14px', borderRadius: 11, background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
                        <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgb(52,211,153)', marginBottom: 8 }}>
                          For {lead.company_name.split(' ')[0]}
                        </div>
                        <UCPoints value={uc.outcome_for_company} color="rgb(52,211,153)" />
                      </div>
                      <div style={{ padding: '12px 14px', borderRadius: 11, background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.18)' }}>
                        <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgb(167,139,250)', marginBottom: 8 }}>
                          For Kima
                        </div>
                        <UCPoints value={uc.outcome_for_kima} color="rgb(167,139,250)" />
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════ */
export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [lead, setLead] = useState<Lead | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [outreachMessages, setOutreachMessages] = useState<OutreachMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Lead>>({})
  const [saving, setSaving] = useState(false)
  const [aiAction, setAiAction] = useState<AIAction>(null)
  const [apolloLoading, setApolloLoading] = useState(false)

  // ── Activity log: write directly to window.__bda so the panel's
  //    250ms poller always sees it regardless of module bundling ──
  const actRef = useRef<Record<string, string>>({})
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.__bda) window.__bda = { events: [], v: 0 }
    const toolMap: Record<string, string> = {
      research: 'Claude', classify: 'Claude', kima_fit: 'Claude',
      aeredium_fit: 'Claude', score: 'Claude', contacts: 'ContactFinder', pain_points: 'Claude',
    }
    const labelMap: Record<string, string> = {
      research: 'Research Company', classify: 'Classify Lead', kima_fit: 'Kima Fit Analysis',
      aeredium_fit: 'Aeredium Fit Analysis', score: 'Score Lead',
      contacts: 'Find Contacts', pain_points: 'Identify Pain Points',
    }
    if (aiAction) {
      const id = Math.random().toString(36).slice(2, 10)
      actRef.current[aiAction] = id
      window.__bda.events = [
        { id, timestamp: Date.now(), tool: (toolMap[aiAction] ?? 'Claude') as import('@/lib/agent-activity').ToolName,
          action: labelMap[aiAction] ?? aiAction,
          page: `Lead — ${lead?.company_name ?? ''}`, status: 'pending' as const },
        ...window.__bda.events,
      ].slice(0, 100)
      window.__bda.v++
    } else {
      // aiAction cleared — resolve all pending
      Object.values(actRef.current).forEach(id => {
        window.__bda!.events = window.__bda!.events.map(e =>
          e.id === id ? { ...e, status: 'success' as const } : e
        )
        window.__bda!.v++
      })
      actRef.current = {}
    }
  }, [aiAction]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.__bda) window.__bda = { events: [], v: 0 }
    if (apolloLoading) {
      const id = Math.random().toString(36).slice(2, 10)
      actRef.current['apollo'] = id
      window.__bda.events = [
        { id, timestamp: Date.now(), tool: 'Apollo' as import('@/lib/agent-activity').ToolName,
          action: 'Find Decision-Makers',
          page: `Lead — ${lead?.company_name ?? ''}`, status: 'pending' as const },
        ...window.__bda.events,
      ].slice(0, 100)
      window.__bda.v++
    } else if (actRef.current['apollo']) {
      const id = actRef.current['apollo']
      window.__bda!.events = window.__bda!.events.map(e =>
        e.id === id ? { ...e, status: 'success' as const } : e
      )
      window.__bda!.v++
      delete actRef.current['apollo']
    }
  }, [apolloLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const [discussOpen, setDiscussOpen] = useState(false)
  const [contactedModalOpen, setContactedModalOpen] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    overview: true, research: true, pain: true, kima: true,
    aeredium: true, contacts: true, outreach: true, feedback: false
  })

  const toggle = (k: string) => setExpanded(s => ({ ...s, [k]: !s[k] }))

  const loadLead = async () => {
    const [leadRes, contactsRes, outreachRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase.from('contacts').select('*').eq('lead_id', id).order('created_at'),
      supabase.from('outreach_messages').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
    ])
    if (leadRes.error) { toast.error('Lead not found'); router.push('/leads'); return }
    setLead(leadRes.data); setEditForm(leadRes.data)
    setContacts(contactsRes.data || [])
    setOutreachMessages(outreachRes.data || [])
    setLoading(false)
  }

  useEffect(() => { loadLead() }, [id]) // eslint-disable-line

  const saveEdits = async () => {
    if (!lead) return; setSaving(true)
    const score = editForm.lead_score
    const priority = score != null
      ? score >= 85 ? 'excellent' : score >= 70 ? 'qualified' : score >= 50 ? 'needs_research' : 'low_priority'
      : editForm.priority
    const { error } = await supabase.from('leads')
      .update({ ...editForm, priority, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) toast.error('Failed to save')
    else { toast.success('Lead updated'); setEditing(false); loadLead() }
    setSaving(false)
  }

  const updateStatus = async (status: string) => {
    const now = new Date().toISOString()
    const contactedStatuses = ['contacted', 'replied', 'meeting_booked', 'proposal_sent', 'negotiating', 'integration', 'won']
    const patch: Record<string, string | null> = { status, updated_at: now }
    // Whenever status advances to a "contacted or beyond" state, stamp contacted_at
    // so Today's Plan always filters it out regardless of which path set the status.
    if (contactedStatuses.includes(status)) {
      patch.contacted_at = now
      patch.last_contacted_at = now
    }
    const { error } = await supabase.from('leads').update(patch).eq('id', id)
    if (error) toast.error('Update failed')
    else { toast.success(`Status: ${getStatusLabel(status as Lead['status'])}`); loadLead() }
  }

  const runAI = async (action: AIAction) => {
    if (!lead || !action) return
    setAiAction(action)
    const tool = ACTION_TOOL[action] ?? 'Claude'
    const label = ACTION_LABEL[action] ?? action
    const actId = actStart({ tool, action: label, page: `Lead — ${lead.company_name}`, timestamp: Date.now() })
    const t0 = Date.now()
    try {
      const res = await fetch('/api/ai/research', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, company_name: lead.company_name, website: lead.website, description: lead.description || lead.product_summary })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      if (action === 'research') {
        const bestSource = pickBestUrl([...(json.data.source_urls || []), lead.website])
        await supabase.from('leads').update({
          description: json.data.company_summary || lead.description,
          business_model: json.data.business_model, product_summary: json.data.product_summary,
          supported_chains_or_rails: json.data.supported_chains_or_rails,
          current_providers: json.data.current_providers, trigger_reason: json.data.trigger_reason,
          facts: json.data.facts?.map((f: string) => ({ text: f })) || [],
          assumptions: json.data.assumptions?.map((a: string) => ({ text: a })) || [],
          ...(bestSource ? { source_url: bestSource } : {}),
          updated_at: new Date().toISOString()
        }).eq('id', id); loadLead()
      } else if (action === 'classify') {
        await supabase.from('leads').update({
          industry_category: json.data.industry_category, customer_category: json.data.customer_category,
          product_to_sell: json.data.product_to_sell, region: json.data.region,
          updated_at: new Date().toISOString()
        }).eq('id', id); loadLead()
      } else if (action === 'pain_points') {
        await supabase.from('leads').update({
          pain_point: json.data.pain_point,
          pain_point_severity: json.data.pain_point_severity,
          pain_point_evidence: json.data.pain_point_evidence,
          pain_point_source_url: json.data.pain_point_source_url || null,
          pain_point_evidence_type: json.data.pain_point_evidence_type || 'agent_analysis',
          updated_at: new Date().toISOString()
        }).eq('id', id); loadLead()
      } else if (action === 'kima_fit') {
        await supabase.from('leads').update({
          kima_fit: json.data.kima_fit, suggested_use_case: json.data.suggested_use_case,
          settlement_angle: json.data.settlement_angle, integration_feasibility: json.data.integration_feasibility,
          updated_at: new Date().toISOString()
        }).eq('id', id); loadLead()
      } else if (action === 'aeredium_fit') {
        await supabase.from('leads').update({
          aeredium_fit: json.data.aeredium_fit, security_angle: json.data.security_angle,
          risk_angle: json.data.risk_angle, updated_at: new Date().toISOString()
        }).eq('id', id); loadLead()
      } else if (action === 'score') {
        const s = json.data.lead_score
        await supabase.from('leads').update({
          lead_score: s, confidence_score: json.data.confidence_score,
          priority: s >= 85 ? 'excellent' : s >= 70 ? 'qualified' : s >= 50 ? 'needs_research' : 'low_priority',
          updated_at: new Date().toISOString()
        }).eq('id', id); loadLead()
      } else if (action === 'contacts') {
        // Delete all existing contacts and replace with fresh ones
        await supabase.from('contacts').delete().eq('lead_id', id)

        for (const c of (json.data.suggested_contacts || []).slice(0, 6)) {
          if (!c.name) continue // skip nameless contacts entirely
          await supabase.from('contacts').insert({
            lead_id: id,
            name: c.name,
            role: c.role || c.ideal_contact_title,
            company: lead.company_name,
            contact_confidence: c.contact_confidence,
            reason_this_person: c.why_this_person,
            email: c.email_pattern || null,
            linkedin_url: c.linkedin_url || null,
            twitter_url: c.twitter_url || null,
            github_url: c.github_url || null,
          })
        }
        loadLead()
      }
      actFinish(actId, 'success', `${label} complete`, Date.now() - t0)
      toast.success(`AI ${action.replace('_', ' ')} complete`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI action failed'
      actFinish(actId, 'error', msg, Date.now() - t0)
      toast.error(msg)
    } finally { setAiAction(null) }
  }

  // Pull REAL decision-maker contacts (with verified emails) from Apollo.
  const findApolloContacts = async () => {
    if (!lead) return
    setApolloLoading(true)
    const actId = actStart({ tool: 'Apollo', action: 'Find Decision-Makers', page: `Lead — ${lead.company_name}`, timestamp: Date.now() })
    const t0 = Date.now()
    try {
      const res = await fetch('/api/leads/apollo-enrich', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      if ((json.total ?? 0) > 0) {
        const parts = []
        if (json.discovered > 0) parts.push(`${json.discovered} new contact${json.discovered > 1 ? 's' : ''} found`)
        if (json.verified   > 0) parts.push(`${json.verified} email${json.verified > 1 ? 's' : ''} verified`)
        actFinish(actId, 'success', parts.join(' · '), Date.now() - t0)
        toast.success(`Apollo: ${parts.join(' · ')}`)
        loadLead()
      } else {
        actFinish(actId, 'success', json.message || 'No results', Date.now() - t0)
        toast(json.message || 'Apollo found nothing for this company')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Apollo lookup failed'
      actFinish(actId, 'error', msg, Date.now() - t0)
      toast.error(msg)
    } finally { setApolloLoading(false) }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280 }}>
      <Loader2 size={24} className="animate-spin" color="#a78bfa" />
    </div>
  )
  if (!lead) return null

  const ic = 'input-dark'; const is = { fontSize: '13px', padding: '8px 11px' }

  const isContacted = CONTACTED_STATUSES_SET.has(lead.status)

  /* status badge color */
  const statusBadgeStyle: React.CSSProperties = lead.status === 'approved'
    ? { border: '1px solid rgba(52,211,153,0.4)', background: 'rgba(52,211,153,0.1)', color: 'rgb(110,231,183)' }
    : lead.status === 'rejected'
    ? { border: '1px solid rgba(248,113,133,0.4)', background: 'rgba(248,113,133,0.1)', color: 'rgb(252,165,165)' }
    : lead.status === 'contacted' || lead.status === 'replied'
    ? { border: '1px solid rgba(34,211,238,0.4)', background: 'rgba(34,211,238,0.1)', color: 'rgb(103,232,249)' }
    : { border: '1px solid rgba(96,165,250,0.4)', background: 'rgba(96,165,250,0.1)', color: 'rgb(147,197,253)' }

  return (
    <div className="fade-in" style={{ background: C.pageBg, minHeight: '100vh', padding: 16 }}>
      <div style={{ borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', background: C.containerBg, boxShadow: '0 40px 80px rgba(0,0,0,0.6)', overflow: 'hidden' }}>

        {/* ══ HEADER ══════════════════════════════════════════ */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: C.headerBg }}>

          {/* Row 1: back + identity + actions */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

              {/* Back + avatar group */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Link href="/leads" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgb(203,213,225)', textDecoration: 'none' }}>
                  <ArrowLeft size={15} />
                </Link>
                {/* Avatar */}
                <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #6d28d9, #3730a3)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(109,40,217,0.4)', fontSize: 22, fontWeight: 700, color: 'rgb(221,214,254)' }}>
                  {lead.company_name.charAt(0).toUpperCase()}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: 28, fontWeight: 600, color: 'white', margin: 0, letterSpacing: '-0.02em' }}>
                    {lead.company_name}
                  </h1>
                  {lead.priority === 'excellent' && <Star size={18} color="#c084fc" fill="#c084fc" />}
                  {lead.lead_score != null && (
                    <span style={{ borderRadius: 999, border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.13)', padding: '4px 14px', fontSize: 13, color: 'rgb(196,167,252)' }}>
                      {lead.lead_score}
                    </span>
                  )}
                  <span style={{ borderRadius: 999, padding: '4px 14px', fontSize: 13, ...statusBadgeStyle }}>
                    {getStatusLabel(lead.status)}
                  </span>
                </div>
                {lead.website && (
                  <a href={lead.website} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13, color: 'rgb(100,116,139)', textDecoration: 'none' }}>
                    <Globe size={13} />
                    {lead.website}
                    <ExternalLink size={12} />
                  </a>
                )}
                {(lead.website || lead.twitter_url || lead.telegram_url || lead.discord_url) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {lead.website && <SocialChip icon={Globe} label="Website" href={lead.website} color="#60a5fa" />}
                    {lead.twitter_url && <SocialChip icon={AtSign} label={`@${lead.twitter_url.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]+)/)?.[1] || 'Twitter'}`} href={lead.twitter_url} color="#38bdf8" />}
                    {lead.telegram_url && <SocialChip icon={Send} label={lead.telegram_url.match(/t\.me\/([A-Za-z0-9_+]+)/)?.[1] ? `t.me/${lead.telegram_url.match(/t\.me\/([A-Za-z0-9_+]+)/)?.[1]}` : 'Telegram'} href={lead.telegram_url} color="#22d3ee" />}
                    {lead.discord_url && <SocialChip icon={MessageCircle} label="Discord" href={lead.discord_url} color="#818cf8" />}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
              {!editing ? (
                <ActionBtn icon={Edit} label="Edit" onClick={() => setEditing(true)} />
              ) : (
                <>
                  <ActionBtn icon={saving ? Loader2 : Save} label={saving ? 'Saving…' : 'Save'} variant="purple" onClick={saveEdits} disabled={saving} />
                  <ActionBtn icon={X} label="Cancel" onClick={() => setEditing(false)} />
                </>
              )}
              {!isContacted && lead.status !== 'approved' && (
                <ActionBtn icon={CheckCircle} label="Approve" variant="green" onClick={() => updateStatus('approved')} />
              )}
              {!isContacted && lead.status !== 'rejected' && (
                <ActionBtn icon={X} label="Reject" variant="red" onClick={() => updateStatus('rejected')} />
              )}
              <ActionBtn
                icon={isContacted ? CheckCircle2 : Send}
                label={isContacted ? 'Log Another Contact' : 'Mark Contacted'}
                variant={isContacted ? 'green' : 'default'}
                onClick={() => setContactedModalOpen(true)}
              />
              <ActionBtn icon={Brain} label="Discuss Lead" variant="cyan" onClick={() => setDiscussOpen(true)} />
              <ActionBtn icon={MessageSquare} label="Outreach Studio" variant="purple" href={`/outreach?lead=${lead.id}`} />
            </div>
          </div>

          {/* Row 2: AI Actions */}
          <div style={{ marginTop: 22, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgb(203,213,225)', marginRight: 4 }}>
              <Sparkles size={14} color="#c084fc" />
              <span>AI Actions</span>
            </div>
            {([
              { action: 'research' as AIAction,    label: 'Research Company'     },
              { action: 'pain_points' as AIAction, label: 'Identify Pain Points' },
              { action: 'kima_fit' as AIAction,    label: 'Kima Fit'             },
              { action: 'aeredium_fit' as AIAction,label: 'Aeredium Fit'         },
              { action: 'classify' as AIAction,    label: 'Classify'             },
              { action: 'score' as AIAction,       label: 'Score Lead'           },
              { action: 'contacts' as AIAction,    label: 'Find Contacts'        },
            ]).map(({ action, label }) => (
              <button key={action} onClick={() => runAI(action)} disabled={aiAction !== null}
                style={{ borderRadius: 9, border: '1px solid rgba(168,85,247,0.28)', background: 'rgba(168,85,247,0.09)', padding: '8px 14px', fontSize: 13, color: 'rgb(196,167,252)', cursor: aiAction !== null ? 'not-allowed' : 'pointer', opacity: aiAction !== null && aiAction !== action ? 0.45 : 1, display: 'inline-flex', alignItems: 'center', gap: 7, transition: 'background 0.15s', fontFamily: 'inherit' }}>
                {aiAction === action ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {label}
              </button>
            ))}
            {/* Apollo — real verified contacts (not guessed) */}
            <button onClick={findApolloContacts} disabled={apolloLoading}
              title="Verify this lead's contacts against Apollo.io and attach their real verified emails"
              style={{ borderRadius: 9, border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.1)', padding: '8px 14px', fontSize: 13, color: 'rgb(110,231,183)', cursor: apolloLoading ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, transition: 'background 0.15s', fontFamily: 'inherit' }}>
              {apolloLoading ? <Loader2 size={12} className="animate-spin" /> : <Users size={12} />}
              Apollo: Verify Emails
            </button>
          </div>
        </div>

        {/* ══ BODY ════════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: 16, padding: 16 }}>

          {/* ── LEFT COLUMN ──────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Company Overview card */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <Building2 size={20} color="#c084fc" />
                <h2 style={{ fontSize: 19, fontWeight: 600, color: 'white', margin: 0 }}>Company Overview</h2>
              </div>

              {/* Tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
                {(lead.customer_category || []).map(cat => (
                  <TagBadge key={cat} label={cat} variant="purple" />
                ))}
                {lead.industry_category && <TagBadge label={lead.industry_category} variant="blue" />}
                {lead.region && <TagBadge label={lead.region} variant="gray" />}
              </div>

              {/* Edit form */}
              {editing ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[['company_name','Company Name'],['website','Website']].map(([k,l]) => (
                    <div key={k}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgb(100,107,140)', marginBottom: 6 }}>{l}</label>
                      <input className={ic} style={is} value={(editForm as Record<string,string>)[k] || ''} onChange={e => setEditForm(f => ({ ...f, [k]: e.target.value }))} />
                    </div>
                  ))}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgb(100,107,140)', marginBottom: 6 }}>Industry</label>
                    <select className={ic} style={is} value={editForm.industry_category || ''} onChange={e => setEditForm(f => ({ ...f, industry_category: e.target.value }))}>
                      <option value="">Select</option>
                      {INDUSTRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgb(100,107,140)', marginBottom: 6 }}>Region</label>
                    <select className={ic} style={is} value={editForm.region || ''} onChange={e => setEditForm(f => ({ ...f, region: e.target.value }))}>
                      <option value="">Select</option>
                      {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgb(100,107,140)', marginBottom: 6 }}>Product to Sell</label>
                    <select className={ic} style={is} value={editForm.product_to_sell || ''} onChange={e => setEditForm(f => ({ ...f, product_to_sell: e.target.value }))}>
                      <option value="">Select</option>
                      {PRODUCTS_TO_SELL.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgb(100,107,140)', marginBottom: 6 }}>Status</label>
                    <select className={ic} style={is} value={editForm.status || 'new'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as Lead['status'] }))}>
                      {['new','researching','qualified','approved','rejected','contacted','replied','meeting_booked','archived','needs_more_research'].map(s =>
                        <option key={s} value={s}>{getStatusLabel(s as Lead['status'])}</option>
                      )}
                    </select>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgb(100,107,140)', marginBottom: 6 }}>Description</label>
                    <textarea className={ic} style={{ ...is, resize: 'vertical' }} rows={3} value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgb(100,107,140)', marginBottom: 6 }}>Lead Score</label>
                    <input className={ic} style={is} type="number" min="0" max="100" value={editForm.lead_score || ''} onChange={e => setEditForm(f => ({ ...f, lead_score: parseInt(e.target.value) || undefined }))} />
                  </div>
                </div>
              ) : (
                <>
                  {/* 2-col info grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '20px 0' }}>
                    <InfoBlock title="Product to Sell"    value={lead.product_to_sell} />
                    <InfoBlock title="Suggested Use Case" value={lead.suggested_use_case} />
                    <InfoBlock title="Business Model"     value={lead.business_model} />
                    <InfoBlock title="Current Providers"  value={lead.current_providers} />
                  </div>
                  {/* full-width fields */}
                  <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <InfoBlock title="Supported Chains / Rails" value={lead.supported_chains_or_rails} />
                    <InfoBlock title="Description"              value={lead.description || lead.product_summary} />
                  </div>
                </>
              )}
            </Card>

            {/* Stats strip */}
            <StatStrip score={lead.lead_score} confidence={lead.confidence_score} addedAt={lead.created_at} />

            {/* Research Findings */}
            <FindingCard
              icon={FileSearch} title="Research Findings" pillVariant="purple"
              subtitle={lead.trigger_reason ? 'Trigger / Reason to Reach Out Now' : undefined}
              body={lead.trigger_reason || 'No research findings yet.'}
              rightLabel={lead.source_url ? 'Source' : undefined}
              rightValue={lead.source_url}
              expanded={expanded.research} onToggle={() => toggle('research')}
            >
              {(lead.facts as {text:string}[] || []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(lead.facts as {text:string}[]).map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'rgb(190,195,220)' }}>
                      <span style={{ color: '#34d399', flexShrink: 0 }}>✓</span>
                      {f.text || String(f)}
                    </div>
                  ))}
                </div>
              )}
              {!lead.trigger_reason && (
                <button onClick={() => runAI('research')} disabled={aiAction !== null}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 9, border: '1px solid rgba(168,85,247,0.28)', background: 'rgba(168,85,247,0.09)', padding: '8px 14px', fontSize: 13, color: 'rgb(196,167,252)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Sparkles size={12} />Research with AI
                </button>
              )}
            </FindingCard>

            {/* Pain Point */}
            <FindingCard
              icon={AlertTriangle} title="Pain Point Analysis" pillVariant="red"
              body={lead.pain_point || 'No pain point identified yet.'}
              rightLabel={lead.pain_point_severity ? 'Severity' : undefined}
              pill={lead.pain_point_severity ? lead.pain_point_severity.charAt(0).toUpperCase() + lead.pain_point_severity.slice(1) : undefined}
              expanded={expanded.pain} onToggle={() => toggle('pain')}
            >
              {lead.pain_point ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {lead.pain_point_evidence && (() => {
                    const t = lead.pain_point_evidence_type || 'agent_analysis'
                    const config = t === 'verified_source'
                      ? { label: 'Verified Source', color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.3)', icon: BadgeCheck, sub: 'Backed by a real article or announcement' }
                      : t === 'agent_analysis'
                      ? { label: 'Agent Analysis', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.3)', icon: Brain, sub: 'Reasoned from their tech stack & public facts' }
                      : { label: 'Inferred', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.3)', icon: Lightbulb, sub: 'General industry knowledge — verify before using in outreach' }
                    const Icon = config.icon
                    return (
                      <div style={{ borderRadius: 12, border: `1px solid ${config.border}`, background: config.bg, padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <Icon size={14} color={config.color} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: config.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Evidence · {config.label}</span>
                          <span style={{ fontSize: 11, color: 'rgb(120,127,160)', marginLeft: 'auto' }}>{config.sub}</span>
                        </div>
                        <ProseBullets text={lead.pain_point_evidence!} color="rgb(220,225,240)" dotColor={config.color} />
                        {lead.pain_point_source_url && (
                          <a href={lead.pain_point_source_url} target="_blank" rel="noopener noreferrer"
                            style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: config.color, textDecoration: 'none', padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: `1px solid ${config.border}` }}>
                            <ExternalLink size={12} /> View source · {lead.pain_point_source_url.replace(/^https?:\/\//, '').slice(0, 45)}{lead.pain_point_source_url.length > 50 ? '…' : ''}
                          </a>
                        )}
                        {!lead.pain_point_source_url && t === 'verified_source' && (
                          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#fbbf24' }}>
                            <AlertCircle size={11} /> Marked as verified but no source URL — re-run pain point analysis
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  {editing && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgb(100,107,140)', marginBottom: 6 }}>Pain Point</label>
                        <textarea className={ic} style={{ ...is, resize: 'vertical' }} rows={2} value={editForm.pain_point || ''} onChange={e => setEditForm(f => ({ ...f, pain_point: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgb(100,107,140)', marginBottom: 6 }}>Severity</label>
                        <select className={ic} style={is} value={editForm.pain_point_severity || ''} onChange={e => setEditForm(f => ({ ...f, pain_point_severity: e.target.value as Lead['pain_point_severity'] }))}>
                          <option value="">Select</option>
                          {['critical','high','medium','low'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => runAI('pain_points')} disabled={aiAction !== null}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 9, border: '1px solid rgba(248,113,133,0.28)', background: 'rgba(248,113,133,0.09)', padding: '8px 14px', fontSize: 13, color: 'rgb(252,165,165)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Sparkles size={12} />Identify with AI
                </button>
              )}
            </FindingCard>

            {/* Kima Fit */}
            <FindingCard
              icon={Puzzle} title="Kima Fit" pillVariant="green"
              body={lead.kima_fit ? lead.kima_fit.split('\n')[0] : 'Kima fit not analyzed yet.'}
              expanded={expanded.kima} onToggle={() => toggle('kima')}
            >
              {lead.kima_fit ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Main pitch */}
                  <div style={{ borderRadius: 12, border: '1px solid rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.06)', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <Puzzle size={14} color="#34d399" />
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.08em' }}>How Kima helps</span>
                    </div>
                    <ProseBullets text={lead.kima_fit!} color="rgb(220,225,240)" dotColor="rgba(52,211,153,0.7)" />
                  </div>
                  {/* Use case + feasibility */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {lead.suggested_use_case && (
                      <div style={{ borderRadius: 10, border: '1px solid rgba(96,165,250,0.2)', background: 'rgba(96,165,250,0.06)', padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgb(147,197,253)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Use Case</div>
                        <div style={{ fontSize: 12, color: 'rgb(220,225,240)', lineHeight: 1.5 }}>{lead.suggested_use_case}</div>
                      </div>
                    )}
                    {lead.integration_feasibility && (
                      <div style={{ borderRadius: 10, border: '1px solid rgba(34,211,153,0.2)', background: 'rgba(34,211,153,0.06)', padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgb(110,231,183)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Integration</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: lead.integration_feasibility === 'high' ? '#34d399' : lead.integration_feasibility === 'medium' ? '#fbbf24' : '#f87171' }}>
                          {lead.integration_feasibility?.charAt(0).toUpperCase() + lead.integration_feasibility?.slice(1)}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Settlement Angle */}
                  {lead.settlement_angle && (
                    <div style={{ borderRadius: 12, border: '1px solid rgba(168,85,247,0.2)', background: 'rgba(168,85,247,0.06)', padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <ArrowRight size={14} color="#c084fc" />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Settlement Angle</span>
                      </div>
                      <ProseBullets text={lead.settlement_angle} color="rgb(220,225,240)" dotColor="rgba(192,132,252,0.7)" />
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => runAI('kima_fit')} disabled={aiAction !== null}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 9, border: '1px solid rgba(52,211,153,0.28)', background: 'rgba(52,211,153,0.09)', padding: '8px 14px', fontSize: 13, color: 'rgb(110,231,183)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Sparkles size={12} />Analyze Kima Fit
                </button>
              )}
            </FindingCard>

            {/* Aeredium Fit */}
            <FindingCard
              icon={Shield} title="Aeredium Fit" pillVariant="purple"
              body={lead.aeredium_fit ? lead.aeredium_fit.split('\n')[0] : 'Aeredium fit not analyzed yet.'}
              expanded={expanded.aeredium} onToggle={() => toggle('aeredium')}
            >
              {lead.aeredium_fit ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Main pitch */}
                  <div style={{ borderRadius: 12, border: '1px solid rgba(168,85,247,0.2)', background: 'rgba(168,85,247,0.06)', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <Shield size={14} color="#c084fc" />
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Trust & Security</span>
                    </div>
                    <ProseBullets text={lead.aeredium_fit!} color="rgb(220,225,240)" dotColor="rgba(192,132,252,0.7)" />
                  </div>
                  {/* Risk Angle */}
                  {lead.risk_angle && (
                    <div style={{ borderRadius: 12, border: '1px solid rgba(244,114,182,0.2)', background: 'rgba(244,114,182,0.06)', padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <AlertTriangle size={14} color='#f472b6' />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#f472b6', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Risk Angle</span>
                      </div>
                      <ProseBullets text={lead.risk_angle} color="rgb(220,225,240)" dotColor="rgba(244,114,182,0.7)" />
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => runAI('aeredium_fit')} disabled={aiAction !== null}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 9, border: '1px solid rgba(168,85,247,0.28)', background: 'rgba(168,85,247,0.09)', padding: '8px 14px', fontSize: 13, color: 'rgb(196,167,252)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Sparkles size={12} />Analyze Aeredium Fit
                </button>
              )}
            </FindingCard>

          </div>

          {/* ── RIGHT COLUMN ──────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Contacts card */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <Users size={20} color="#c084fc" />
                <h2 style={{ fontSize: 19, fontWeight: 600, color: 'white', margin: 0 }}>Contacts</h2>
                <span style={{ borderRadius: 999, background: 'rgba(168,85,247,0.18)', color: 'rgb(196,167,252)', padding: '2px 10px', fontSize: 13 }}>
                  {contacts.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {contacts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <Users size={32} color="rgba(196,167,252,0.3)" style={{ margin: '0 auto 12px' }} />
                    <p style={{ fontSize: 13, color: 'rgb(100,107,140)', marginBottom: 16 }}>No contacts found yet</p>
                    <button onClick={() => runAI('contacts')} disabled={aiAction !== null}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 9, border: '1px solid rgba(168,85,247,0.28)', background: 'rgba(168,85,247,0.09)', padding: '8px 16px', fontSize: 13, color: 'rgb(196,167,252)', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <Sparkles size={12} />Find with AI
                    </button>
                  </div>
                ) : (
                  contacts.map(contact => (
                    <ContactCard key={contact.id} contact={contact}
                      onRefresh={() => runAI('contacts')}
                      onUpdate={loadLead}
                      refreshing={aiAction === 'contacts'} />
                  ))
                )}
              </div>
            </Card>

            {/* Outreach accordion — draft & send right here */}
            <AccordionPanel icon={MessageSquare} title="Outreach" iconColor="rgb(253,224,71)"
              expanded={expanded.outreach} onToggle={() => toggle('outreach')}>
              <InlineOutreach lead={lead} onSent={loadLead} />

              {outreachMessages.length > 0 && (
                <OutcomeBar lead={lead} onRecorded={loadLead} />
              )}

              {outreachMessages.length > 0 && (
                <div style={{ marginTop: 18, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 16 }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgb(100,107,140)', marginBottom: 12 }}>
                    Sent &amp; saved ({outreachMessages.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {outreachMessages.map(msg => (
                      <div key={msg.id} style={{ borderRadius: 12, border: '1px solid rgba(253,224,71,0.12)', background: 'rgba(253,224,71,0.04)', padding: 14 }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                          <span style={{ borderRadius: 6, border: '1px solid rgba(253,224,71,0.2)', background: 'rgba(253,224,71,0.08)', padding: '3px 10px', fontSize: 11, color: 'rgb(253,224,71)' }}>{msg.channel}</span>
                          <span style={{ borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', padding: '3px 10px', fontSize: 11, color: msg.status === 'sent' ? 'rgb(110,231,183)' : 'rgb(100,107,140)' }}>{msg.status}</span>
                          <span style={{ fontSize: 11, color: 'rgb(100,107,140)', alignSelf: 'center' }}>{formatDate(msg.created_at)}</span>
                        </div>
                        {msg.message && (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                              <button onClick={() => { navigator.clipboard.writeText(msg.message!); toast.success('Copied') }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgb(100,107,140)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                <Copy size={10} />Copy
                              </button>
                            </div>
                            <div style={{ fontSize: 12, lineHeight: 1.65, color: 'rgb(190,195,220)', whiteSpace: 'pre-wrap', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 12 }}>
                              {msg.message}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </AccordionPanel>

            {/* Feedback accordion */}
            <AccordionPanel icon={CheckCircle} title="Log Outcome / Feedback" iconColor="rgb(110,231,183)"
              expanded={expanded.feedback} onToggle={() => toggle('feedback')}>
              <FeedbackForm leadId={lead.id} onSaved={loadLead} />
            </AccordionPanel>

          </div>
        </div>

      </div>

      {/* ── Real Use Cases — outside overflow:hidden container ── */}
      <div style={{ marginTop: 16, borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', background: '#0B0F1A', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>
        <UseCasesSection
          lead={lead}
          onGenerated={() => loadLead()}
        />
      </div>

      {discussOpen && <DiscussPanel lead={lead} onClose={() => setDiscussOpen(false)} />}
      {contactedModalOpen && <ContactedModal lead={lead} onClose={() => setContactedModalOpen(false)} onSaved={loadLead} />}
    </div>
  )
}

/* ── Discuss Lead: research-grounded chat that teaches the agent ──────────── */
interface ChatMsg { role: 'user' | 'assistant'; content: string }

// Lightweight renderer: **bold**, "- " bullets, and paragraph spacing.
function RichText({ text }: { text: string }) {
  const renderInline = (s: string, keyBase: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={`${keyBase}-${i}`} style={{ color: 'white', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
        : <span key={`${keyBase}-${i}`}>{part}</span>,
    )
  const lines = text.split('\n')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd()
        if (!line.trim()) return <div key={i} style={{ height: 2 }} />
        if (/^\s*[-*•]\s+/.test(line)) {
          return (
            <div key={i} style={{ display: 'flex', gap: 8, paddingLeft: 2 }}>
              <span style={{ color: 'rgb(103,232,249)', flexShrink: 0, lineHeight: 1.6 }}>•</span>
              <span style={{ flex: 1, lineHeight: 1.6 }}>{renderInline(line.replace(/^\s*[-*•]\s+/, ''), `${i}`)}</span>
            </div>
          )
        }
        return <div key={i} style={{ lineHeight: 1.65 }}>{renderInline(line, `${i}`)}</div>
      })}
    </div>
  )
}

interface DiscussionSession { id: string; title: string; message_count: number; updated_at: string }

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function DiscussPanel({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const supabase = createClient()
  const [sessions, setSessions] = useState<DiscussionSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [dossier, setDossier] = useState<string>('')
  const [shown, setShown] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const researched = dossier.length > 0

  // Portal availability + slide-in + body scroll lock + autofocus.
  useEffect(() => {
    setMounted(true)
    const t = requestAnimationFrame(() => setShown(true))
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const f = setTimeout(() => inputRef.current?.focus(), 120)
    return () => { cancelAnimationFrame(t); clearTimeout(f); document.body.style.overflow = prevOverflow }
  }, [])

  // Load this lead's past conversations and open the most recent one.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('lead_discussions')
        .select('id, title, message_count, updated_at')
        .eq('lead_id', lead.id)
        .order('updated_at', { ascending: false })
      const list = (data || []) as DiscussionSession[]
      setSessions(list)
      if (list.length) loadSession(list[0].id)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  async function loadSession(id: string) {
    setActiveId(id)
    setListOpen(false)
    const { data } = await supabase
      .from('lead_discussion_messages')
      .select('role, content')
      .eq('discussion_id', id)
      .order('created_at', { ascending: true })
    setMessages((data || []).map((m: { role: string; content: string }) => ({ role: m.role as 'user' | 'assistant', content: m.content })))
  }

  function newConversation() {
    // Persist what we learned from the current thread before starting fresh.
    distill(messages)
    setActiveId(null)
    setMessages([])
    setListOpen(false)
    setTimeout(() => inputRef.current?.focus(), 60)
  }

  async function deleteSession(id: string) {
    await supabase.from('lead_discussions').delete().eq('id', id)
    const remaining = sessions.filter(s => s.id !== id)
    setSessions(remaining)
    if (activeId === id) {
      if (remaining.length) loadSession(remaining[0].id)
      else { setActiveId(null); setMessages([]) }
    }
  }

  // Distill a transcript into the agent's memory (fire-and-forget).
  function distill(transcript: ChatMsg[]) {
    if (transcript.filter(m => m.role === 'user').length >= 1 && transcript.length >= 2) {
      fetch('/api/ai/discuss', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'distill', lead_id: lead.id, transcript }),
      }).then(r => r.json()).then(j => {
        if (j?.saved) toast.success('Saved what I learned to the agent's memory')
      }).catch(() => {})
    }
  }

  // Save what was learned when the panel closes (auto, no extra click).
  const closeAndLearn = () => {
    distill(messages)
    setShown(false)
    setTimeout(onClose, 180) // let the slide-out play
  }

  const ask = async (q: string) => {
    const question = q.trim()
    if (!question || thinking) return

    // Lazily create a thread on the first message of a new conversation.
    let sessionId = activeId
    if (!sessionId) {
      const { data } = await supabase
        .from('lead_discussions')
        .insert({ lead_id: lead.id, title: question.slice(0, 70) })
        .select('id, title, message_count, updated_at')
        .single()
      if (data) {
        sessionId = data.id
        setActiveId(data.id)
        setSessions(prev => [data as DiscussionSession, ...prev])
      }
    }

    const next = [...messages, { role: 'user' as const, content: question }]
    setMessages(next)
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setThinking(true)
    if (sessionId) supabase.from('lead_discussion_messages').insert({ discussion_id: sessionId, lead_id: lead.id, role: 'user', content: question }).then(() => {})

    try {
      const res = await fetch('/api/ai/discuss', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id, message: question, messages, dossier: dossier || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      if (json.dossier) setDossier(json.dossier)
      setMessages([...next, { role: 'assistant', content: json.reply }])
      if (sessionId) {
        const ts = new Date().toISOString()
        const count = next.length + 1
        supabase.from('lead_discussion_messages').insert({ discussion_id: sessionId, lead_id: lead.id, role: 'assistant', content: json.reply }).then(() => {})
        supabase.from('lead_discussions').update({ message_count: count, updated_at: ts }).eq('id', sessionId).then(() => {})
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, message_count: count, updated_at: ts } : s)
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at)))
      }
    } catch (err: unknown) {
      setMessages([...next, { role: 'assistant', content: `⚠️ ${err instanceof Error ? err.message : 'Something went wrong'}` }])
    } finally {
      setThinking(false)
    }
  }

  const starters = [
    'How does their tech work and where do Kima, Aeredium & Aergap each fit?',
    'Do they have AI agents taking real consequential actions — are they an Aergap customer?',
    'What\'s the strongest angle to pitch the full suite here?',
    'What objections will they raise, and how do I counter them?',
  ]

  if (!mounted) return null

  const panel = (
    <div onClick={closeAndLearn}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: shown ? 'rgba(4,4,10,0.6)' : 'rgba(4,4,10,0)', backdropFilter: 'blur(3px)', display: 'flex', justifyContent: 'flex-end', transition: 'background 0.25s ease' }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          width: 'min(580px, 100vw)', height: '100dvh', background: 'linear-gradient(180deg, rgb(17,18,28), rgb(12,12,19))',
          borderLeft: '1px solid rgba(34,211,238,0.25)', display: 'flex', flexDirection: 'column',
          boxShadow: '-40px 0 90px rgba(0,0,0,0.65)', position: 'relative', overflow: 'hidden',
          transform: shown ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.22,1,0.36,1)',
        }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'rgba(34,211,238,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, rgba(34,211,238,0.25), rgba(34,211,238,0.08))', border: '1px solid rgba(34,211,238,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Brain size={17} color="rgb(103,232,249)" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Discuss {lead.company_name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: researched ? 'rgb(110,231,183)' : 'rgb(120,127,160)', marginTop: 1 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: researched ? 'rgb(110,231,183)' : 'rgb(120,127,160)' }} />
                {researched ? 'Live research loaded · ask anything' : 'Researches live on your first question'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button onClick={() => setListOpen(v => !v)} title="Conversation history"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 9, border: `1px solid ${listOpen ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.1)'}`, background: listOpen ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.04)', color: listOpen ? 'rgb(103,232,249)' : 'rgb(160,167,190)', cursor: 'pointer', position: 'relative' }}>
              <History size={15} />
              {sessions.length > 0 && (
                <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 15, height: 15, padding: '0 3px', borderRadius: 999, background: 'rgb(34,211,238)', color: 'rgb(8,12,16)', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{sessions.length}</span>
              )}
            </button>
            <button onClick={newConversation} title="New conversation"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgb(160,167,190)', cursor: 'pointer' }}>
              <Plus size={16} />
            </button>
            <button onClick={closeAndLearn} title="Close"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgb(160,167,190)', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 13, color: 'rgb(150,157,180)', lineHeight: 1.65, margin: 0 }}>
                Ask anything about <span style={{ color: 'rgb(103,232,249)' }}>{lead.company_name}</span> — how their tech works, whether they have AI agents taking real actions, and where <strong style={{ color: 'white' }}>Kima / Aeredium / Aergap</strong> each plug in. I research them live and remember what we figure out.
              </p>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgb(100,107,140)', marginTop: 2 }}>Try asking</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {starters.map(s => (
                  <button key={s} onClick={() => ask(s)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', borderRadius: 11, border: '1px solid rgba(34,211,238,0.18)', background: 'rgba(34,211,238,0.05)', padding: '11px 13px', fontSize: 12.5, color: 'rgb(190,225,235)', cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.45, transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,211,238,0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(34,211,238,0.05)')}>
                    <Sparkles size={13} color="rgb(103,232,249)" style={{ flexShrink: 0 }} />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            m.role === 'user' ? (
              <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ maxWidth: '85%', borderRadius: '14px 14px 4px 14px', padding: '10px 14px', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'rgba(168,85,247,0.18)', border: '1px solid rgba(168,85,247,0.32)', color: 'rgb(228,218,252)' }}>
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <Brain size={13} color="rgb(103,232,249)" />
                </div>
                <div style={{ flex: 1, minWidth: 0, borderRadius: '4px 14px 14px 14px', padding: '11px 14px', fontSize: 13, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgb(208,213,230)' }}>
                  <RichText text={m.content} />
                </div>
              </div>
            )
          ))}

          {thinking && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Loader2 size={13} className="animate-spin" color="rgb(103,232,249)" />
              </div>
              <div style={{ fontSize: 12.5, color: 'rgb(120,200,215)', lineHeight: 1.5 }}>
                {researched ? 'Thinking…' : `Researching ${lead.company_name} live — first answer takes a few seconds…`}
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div style={{ padding: '12px 16px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', borderRadius: 13, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', padding: 6 }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
              }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input) } }}
              placeholder={`Ask about ${lead.company_name}…`}
              rows={1}
              style={{ flex: 1, resize: 'none', maxHeight: 140, border: 'none', background: 'transparent', padding: '8px 10px', fontSize: 13, color: 'white', fontFamily: 'inherit', lineHeight: 1.5, outline: 'none' }}
            />
            <button onClick={() => ask(input)} disabled={thinking || !input.trim()}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, flexShrink: 0, borderRadius: 10, border: 'none', background: thinking || !input.trim() ? 'rgba(34,211,238,0.12)' : 'rgb(34,211,238)', color: thinking || !input.trim() ? 'rgb(103,232,249)' : 'rgb(8,12,16)', cursor: thinking || !input.trim() ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}>
              {thinking ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
          <div style={{ fontSize: 10.5, color: 'rgb(90,97,125)', marginTop: 7, textAlign: 'center' }}>
            Enter to send · Shift+Enter for a new line · closing saves what I learned
          </div>
        </div>

        {/* Conversations drawer (this lead's chat history) */}
        <div onClick={() => setListOpen(false)}
          style={{ position: 'absolute', inset: 0, zIndex: 5, background: listOpen ? 'rgba(4,4,10,0.45)' : 'rgba(4,4,10,0)', pointerEvents: listOpen ? 'auto' : 'none', transition: 'background 0.2s ease' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: 'min(300px, 82%)', background: 'linear-gradient(180deg, rgb(20,21,32), rgb(14,14,22))', borderRight: '1px solid rgba(34,211,238,0.22)', boxShadow: '24px 0 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', transform: listOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.26s cubic-bezier(0.22,1,0.36,1)' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgb(190,225,235)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Conversations</div>
              <button onClick={newConversation} title="New conversation"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 8, border: '1px solid rgba(34,211,238,0.3)', background: 'rgba(34,211,238,0.1)', color: 'rgb(103,232,249)', fontSize: 11, fontWeight: 600, padding: '5px 9px', cursor: 'pointer' }}>
                <Plus size={12} /> New
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sessions.length === 0 && (
                <div style={{ fontSize: 12, color: 'rgb(110,117,145)', padding: '16px 10px', lineHeight: 1.6 }}>
                  No conversations yet. Ask a question and it'll be saved here so you can review it later.
                </div>
              )}
              {sessions.map(s => (
                <div key={s.id} onClick={() => loadSession(s.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, padding: '9px 10px', cursor: 'pointer', border: `1px solid ${activeId === s.id ? 'rgba(34,211,238,0.3)' : 'transparent'}`, background: activeId === s.id ? 'rgba(34,211,238,0.08)' : 'transparent' }}
                  onMouseEnter={e => { if (activeId !== s.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={e => { if (activeId !== s.id) e.currentTarget.style.background = 'transparent' }}>
                  <MessageSquare size={13} color={activeId === s.id ? 'rgb(103,232,249)' : 'rgb(120,127,160)'} style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, color: activeId === s.id ? 'white' : 'rgb(200,205,222)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                    <div style={{ fontSize: 10, color: 'rgb(110,117,145)', marginTop: 1 }}>{relTime(s.updated_at)} · {s.message_count} msg</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteSession(s.id) }} title="Delete conversation"
                    style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 7, border: 'none', background: 'transparent', color: 'rgb(120,127,160)', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.12)'; e.currentTarget.style.color = 'rgb(248,113,113)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgb(120,127,160)' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(panel, document.body)
}

/* ── Outcome bar: one-tap capture of what happened (feeds the learning loop) ── */
function OutcomeBar({ lead, onRecorded }: { lead: Lead; onRecorded: () => void }) {
  const supabase = createClient()
  const [saving, setSaving] = useState<OutreachOutcome | null>(null)

  // Already resolved — show the result instead of the prompt.
  if (lead.status === 'replied' || lead.status === 'meeting_booked') {
    const label = lead.status === 'meeting_booked' ? 'Meeting booked 🎉' : 'They replied'
    return (
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, border: '1px solid rgba(110,231,183,0.25)', background: 'rgba(110,231,183,0.07)', padding: '10px 14px', fontSize: 12, color: 'rgb(110,231,183)' }}>
        <CheckCircle2 size={14} />{label} · outcome logged, the agent is learning from this
      </div>
    )
  }
  if (lead.status === 'archived') return null

  const record = async (outcome: OutreachOutcome) => {
    setSaving(outcome)
    const { error } = await recordOutcome(supabase, { leadId: lead.id, outcome })
    setSaving(null)
    if (error) { toast.error('Could not save outcome'); return }
    toast.success(
      outcome === 'no_response' ? 'Marked dead — stopped chasing' : 'Logged — the agent learns from what converts',
    )
    onRecorded()
  }

  const btn = (o: OutreachOutcome, Icon: React.ComponentType<{ size?: number }>, label: string, color: string) => (
    <button onClick={() => record(o)} disabled={saving !== null}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8, border: `1px solid ${color}33`, background: `${color}14`, padding: '7px 12px', fontSize: 12, color, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving && saving !== o ? 0.5 : 1, fontFamily: 'inherit' }}>
      {saving === o ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}{label}
    </button>
  )

  return (
    <div style={{ marginTop: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: 'rgb(150,157,180)', marginBottom: 10 }}>How did it go? Logging the outcome trains the agent on what converts.</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {btn('replied', CheckCircle2, 'They replied', 'rgb(110,231,183)')}
        {btn('meeting_booked', Calendar, 'Meeting booked', 'rgb(196,167,252)')}
        {btn('no_response', X, 'No reply / dead', 'rgb(148,163,184)')}
      </div>
    </div>
  )
}

/* ── Inline outreach: draft 3 human variations & send in place ──── */
interface InlineDraft { id: string; label: string; channel: string; subject?: string; text: string }

const inlineChannelIcon: Record<string, React.ComponentType<{ size?: number }>> = {
  telegram: Send, twitter: AtSign, linkedin: MessageSquare, email: Mail,
}

function InlineOutreach({ lead, onSent }: { lead: Lead; onSent: () => void }) {
  const supabase = createClient()
  const [drafts, setDrafts] = useState<InlineDraft[]>([])
  const [meta, setMeta] = useState<OutreachMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)

  const draft = async () => {
    setLoading(true); setDrafts([]); setMeta(null)
    try {
      const res = await fetch('/api/ai/outreach', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'auto', lead_id: lead.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setDrafts(json.data?.drafts || [])
      setMeta(json.data?.meta || null)
      if (!(json.data?.drafts || []).length) toast.error('No drafts returned — try again')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Draft failed')
    } finally { setLoading(false) }
  }

  const copy = (d: InlineDraft) => {
    navigator.clipboard.writeText(d.subject ? `${d.subject}\n\n${d.text}` : d.text)
    toast.success('Copied!')
  }

  const send = async (d: InlineDraft) => {
    setSendingId(d.id)
    const target = buildTarget(meta)
    const url = channelDeepLink(d.channel, target, d.text, d.subject)
    const fullText = d.subject ? `${d.subject}\n\n${d.text}` : d.text
    const { error } = await logTouch(supabase, {
      leadId: lead.id, channel: d.channel, text: d.text, subject: d.subject,
      contactId: meta?.contact?.id, kind: 'initial',
    })
    setSendingId(null)
    if (error) { toast.error('Could not log the touch'); return }
    if (url) {
      if (d.channel !== 'email') navigator.clipboard.writeText(fullText)
      window.open(url, '_blank')
      toast.success('Logged as contacted · follow-up in 5 days')
    } else {
      navigator.clipboard.writeText(fullText)
      toast.success('Logged · no destination on file — text copied')
    }
    onSent()
  }

  if (drafts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
        <p style={{ fontSize: 13, color: 'rgb(100,107,140)', marginBottom: 14 }}>
          Let the agent draft 3 human, research-backed messages for {lead.company_name}
        </p>
        <button onClick={draft} disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 9, border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.13)', padding: '9px 18px', fontSize: 13, color: 'rgb(196,167,252)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, fontFamily: 'inherit', fontWeight: 500 }}>
          {loading ? <><Loader2 size={13} className="animate-spin" />Drafting…</> : <><Wand2 size={13} />Draft with AI</>}
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'rgb(196,167,252)' }}>
          <Wand2 size={13} />Agent drafts · 3 variations
        </span>
        <button onClick={draft} disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgb(100,107,140)', background: 'none', border: 'none', cursor: 'pointer' }}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />Regenerate
        </button>
      </div>

      {drafts.map(d => {
        const Icon = inlineChannelIcon[d.channel] || MessageSquare
        return (
          <div key={d.id} style={{ borderRadius: 12, border: '1px solid rgba(168,85,247,0.18)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(168,85,247,0.08)', borderBottom: '1px solid rgba(168,85,247,0.12)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: 'rgb(196,167,252)' }}>
                <Icon size={12} />{d.label}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => copy(d)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgb(150,157,180)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
                  <Copy size={10} />Copy
                </button>
                <button onClick={() => send(d)} disabled={sendingId === d.id}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgb(196,167,252)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
                  {sendingId === d.id ? <Loader2 size={10} className="animate-spin" /> : <ExternalLink size={10} />}Open &amp; send
                </button>
              </div>
            </div>
            {d.subject && (
              <div style={{ padding: '8px 12px 0', fontSize: 11, color: '#fbbf24' }}>
                <span style={{ opacity: 0.7 }}>Subject: </span><span style={{ color: 'white' }}>{d.subject}</span>
              </div>
            )}
            <pre style={{ margin: 0, padding: 12, fontSize: 12, lineHeight: 1.65, color: 'rgb(200,205,225)', whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif', background: 'rgba(22,22,34,0.5)' }}>
              {d.text}
            </pre>
          </div>
        )
      })}
    </div>
  )
}

/* ── Feedback form ────────────────────────────────────────────── */
function FeedbackForm({ leadId, onSaved }: { leadId: string; onSaved: () => void }) {
  const supabase = createClient()
  const [form, setForm] = useState({ action_taken: '', lead_quality: '', pain_point_accuracy: '', contact_accuracy: '', message_quality: '', outcome: '', rejection_reason: '', arpit_notes: '' })
  const [saving, setSaving] = useState(false)
  const ic = 'input-dark'; const is = { fontSize: '12px', padding: '7px 10px' }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.from('feedback_memory').insert({
      lead_id: leadId, ...form,
      action_taken: form.action_taken || null, lead_quality: form.lead_quality || null,
      pain_point_accuracy: form.pain_point_accuracy || null, contact_accuracy: form.contact_accuracy || null,
      message_quality: form.message_quality || null, outcome: form.outcome || null,
      rejection_reason: form.rejection_reason || null, arpit_notes: form.arpit_notes || null,
    })
    if (error) toast.error('Failed to save feedback')
    else { toast.success('Feedback saved — training the agent'); onSaved() }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          { label: 'Action Taken', key: 'action_taken', opts: [['approved','Approved'],['rejected','Rejected'],['edited','Edited'],['contacted','Contacted'],['replied','Replied'],['meeting_booked','Meeting Booked'],['deal_closed','Deal Closed'],['needs_more_research','Needs Research']] },
          { label: 'Lead Quality', key: 'lead_quality', opts: [['excellent','Excellent'],['good','Good'],['average','Average'],['poor','Poor']] },
          { label: 'Pain Point Accuracy', key: 'pain_point_accuracy', opts: [['very_accurate','Very Accurate'],['mostly_accurate','Mostly Accurate'],['partially_accurate','Partially'],['inaccurate','Inaccurate']] },
          { label: 'Outcome', key: 'outcome', opts: [['replied','Replied'],['meeting_booked','Meeting Booked'],['deal_closed','Deal Closed 🎉'],['no_response','No Response'],['rejected_by_prospect','Rejected'],['not_yet_sent','Not Sent']] },
        ].map(({ label, key, opts }) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgb(100,107,140)', marginBottom: 6 }}>{label}</label>
            <select className={ic} style={is} value={(form as Record<string,string>)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}>
              <option value="">Select</option>
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgb(100,107,140)', marginBottom: 6 }}>Your Notes</label>
        <textarea className={ic} style={{ fontSize: '12px', resize: 'vertical' }} rows={2} value={form.arpit_notes}
          onChange={e => setForm(f => ({ ...f, arpit_notes: e.target.value }))} placeholder="Notes for the agent to learn from…" />
      </div>
      <button type="submit" disabled={saving}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 9, border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.1)', padding: '9px 14px', fontSize: 13, color: 'rgb(110,231,183)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'inherit', fontWeight: 500 }}>
        {saving ? <><Loader2 size={13} className="animate-spin" />Saving…</> : <><Save size={13} />Save Feedback</>}
      </button>
    </form>
  )
}
