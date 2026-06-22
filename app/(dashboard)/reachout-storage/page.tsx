'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Send, CheckCircle2, XCircle, Calendar, Clock, ChevronDown, ChevronUp,
  Filter, BarChart3, MessageSquare, ThumbsUp, TrendingUp, Inbox,
  ExternalLink, Copy, CheckCheck,
} from 'lucide-react'
import Link from 'next/link'

/* ── Types ────────────────────────────────────────────────── */
interface ReachoutRecord {
  id: string
  lead_id: string
  contact_id: string | null
  channel: string
  message: string | null
  status: 'draft' | 'sent' | 'delivered' | 'replied' | 'archived'
  created_at: string
  updated_at: string
  leads: { id: string; company_name: string; website: string | null; industry_category: string | null } | null
  contacts: { id: string; name: string | null; role: string | null } | null
}

/* ── Design tokens ─────────────────────────────────────────── */
const C = {
  pageBg: '#070A12',
  cardBg: '#101522',
  nestedBg: '#151A2A',
  border: '1px solid rgba(255,255,255,0.08)',
}

const CHANNEL_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  linkedin: { label: 'LinkedIn', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.3)' },
  telegram: { label: 'Telegram', color: '#22d3ee', bg: 'rgba(34,211,238,0.1)',  border: 'rgba(34,211,238,0.3)' },
  twitter:  { label: 'X / Twitter', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.3)' },
  email:    { label: 'Email', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)' },
}

const OUTCOME_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof CheckCircle2 }> = {
  draft:    { label: 'Draft',      color: 'rgb(251,191,36)',   bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.25)',  icon: MessageSquare },
  sent:     { label: 'Pending',    color: 'rgb(148,163,184)',  bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)',  icon: Clock },
  replied:  { label: 'Replied ✓',  color: 'rgb(52,211,153)',   bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.3)',   icon: CheckCircle2 },
  archived: { label: 'No Response', color: 'rgb(248,113,133)', bg: 'rgba(248,113,133,0.08)', border: 'rgba(248,113,133,0.2)', icon: XCircle },
}

/* ── Stat card ─────────────────────────────────────────────── */
function StatCard({ label, value, sub, color, bg }: {
  label: string; value: number | string; sub?: string; color: string; bg: string
}) {
  return (
    <div style={{ borderRadius: 16, border: C.border, background: C.cardBg, padding: '20px 22px', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 32, fontWeight: 700, color: 'white', lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgb(110,115,145)', fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

/* ── Record card ───────────────────────────────────────────── */
function RecordCard({ record, onOutcomeChange }: { record: ReachoutRecord; onOutcomeChange: (id: string, status: 'replied' | 'archived') => Promise<void> }) {
  const [expanded, setExpanded] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [copied, setCopied] = useState(false)

  const ch = CHANNEL_CFG[record.channel] || { label: record.channel, color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)' }
  const outcome = OUTCOME_CFG[record.status] || OUTCOME_CFG.sent
  const OutcomeIcon = outcome.icon

  const companyName = record.leads?.company_name || 'Unknown Company'
  const contactName = record.contacts?.name || null
  const contactRole = record.contacts?.role || null

  const dateStr = new Date(record.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  const markOutcome = async (status: 'replied' | 'archived') => {
    setUpdating(true)
    await onOutcomeChange(record.id, status)
    setUpdating(false)
  }

  const copyMessage = () => {
    if (record.message) {
      navigator.clipboard.writeText(record.message)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  const initials = companyName.slice(0, 2).toUpperCase()
  const hasMessage = Boolean(record.message?.trim())
  const preview = record.message?.slice(0, 160)
  const isLong = (record.message?.length || 0) > 160

  return (
    <div style={{ borderRadius: 16, border: C.border, background: C.cardBg, padding: '18px 20px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0, flex: 1 }}>
          {/* Company avatar */}
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,rgba(124,58,237,0.35),rgba(56,189,248,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#a78bfa', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Link href={`/leads/${record.lead_id}`}
                style={{ fontSize: 14, fontWeight: 700, color: 'white', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#a78bfa')}
                onMouseLeave={e => (e.currentTarget.style.color = 'white')}>
                {companyName}
              </Link>
              {record.leads?.website && (
                <a href={record.leads.website.startsWith('http') ? record.leads.website : `https://${record.leads.website}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: 'rgba(148,163,184,0.5)', display: 'inline-flex' }}>
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
            {contactName && (
              <div style={{ fontSize: 12, color: 'rgb(148,163,184)', marginTop: 2 }}>
                {contactName}{contactRole && <span style={{ color: 'rgb(100,107,140)' }}> · {contactRole}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Channel + date */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, background: ch.bg, border: `1px solid ${ch.border}`, color: ch.color }}>
            {ch.label}
          </span>
          <span style={{ fontSize: 11, color: 'rgb(100,107,140)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Calendar size={10} />{dateStr}
          </span>
        </div>
      </div>

      {/* Message body */}
      {hasMessage ? (
        <div style={{ borderRadius: 10, background: C.nestedBg, border: '1px solid rgba(255,255,255,0.05)', padding: '12px 14px', marginBottom: 14 }}>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: 'rgb(196,207,228)', margin: 0, whiteSpace: 'pre-wrap' }}>
            {expanded ? record.message : preview}{isLong && !expanded ? '…' : ''}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            {isLong && (
              <button onClick={() => setExpanded(!expanded)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgb(100,107,140)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {expanded ? 'Show less' : 'Show full message'}
              </button>
            )}
            <button onClick={copyMessage}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: copied ? 'rgb(52,211,153)' : 'rgb(100,107,140)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 'auto' }}>
              {copied ? <CheckCheck size={11} /> : <Copy size={11} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 14, fontSize: 12, color: 'rgb(80,87,120)', fontStyle: 'italic', padding: '8px 0' }}>
          No message saved — click a channel on the contact card to capture next time
        </div>
      )}

      {/* Outcome row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Current status badge */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: outcome.bg, border: `1px solid ${outcome.border}`, color: outcome.color }}>
          <OutcomeIcon size={11} />{outcome.label}
        </span>

        {record.status === 'draft' && (
          <>
            <div style={{ flex: 1 }} />
            <Link href={`/leads/${record.lead_id}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.08)', color: 'rgb(251,191,36)' }}>
              <Send size={12} />Go send it →
            </Link>
          </>
        )}

        {/* Action buttons — only show if pending */}
        {record.status === 'sent' && (
          <>
            <div style={{ flex: 1 }} />
            <button onClick={() => markOutcome('replied')} disabled={updating}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: updating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.1)', color: 'rgb(52,211,153)', opacity: updating ? 0.5 : 1 }}>
              <CheckCircle2 size={13} />Got a reply
            </button>
            <button onClick={() => markOutcome('archived')} disabled={updating}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: updating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', border: '1px solid rgba(248,113,133,0.3)', background: 'rgba(248,113,133,0.08)', color: 'rgb(248,113,133)', opacity: updating ? 0.5 : 1 }}>
              <XCircle size={13} />No response
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════ */
export default function ReachoutStoragePage() {
  const supabase = createClient()
  const [records, setRecords] = useState<ReachoutRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filterChannel, setFilterChannel] = useState<string>('all')
  const [filterOutcome, setFilterOutcome] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('outreach_messages')
      .select('*, leads(id, company_name, website, industry_category), contacts(id, name, role)')
      .not('message', 'is', null)
      .order('created_at', { ascending: false })
    if (!error && data) setRecords(data as unknown as ReachoutRecord[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const handleOutcomeChange = async (id: string, status: 'replied' | 'archived') => {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('outreach_messages')
      .update({ status, updated_at: now })
      .eq('id', id)
    if (error) { toast.error('Could not update outcome'); return }

    setRecords(prev => prev.map(r => r.id === id ? { ...r, status } : r))

    // If replied, also update the lead status
    const record = records.find(r => r.id === id)
    if (record?.lead_id && status === 'replied') {
      await supabase.from('leads').update({ status: 'replied', updated_at: now }).eq('id', record.lead_id)
      toast.success('Marked as replied — lead status updated')
    } else {
      toast.success(status === 'archived' ? 'Marked as no response' : 'Outcome saved')
    }
  }

  /* ── Filtered view ── */
  const filtered = records.filter(r => {
    if (filterChannel !== 'all' && r.channel !== filterChannel) return false
    if (filterOutcome !== 'all' && r.status !== filterOutcome) return false
    return true
  })

  /* ── Stats ── */
  const totalDrafts = records.filter(r => r.status === 'draft').length
  const sent = records.filter(r => r.status !== 'draft')
  const totalSent = sent.length
  const totalReplied = records.filter(r => r.status === 'replied').length
  const totalNoResponse = records.filter(r => r.status === 'archived').length
  const replyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0
  const withMessage = records.filter(r => r.message?.trim()).length

  /* ── Best channel ── */
  const channelStats: Record<string, { sent: number; replied: number }> = {}
  for (const r of records) {
    if (!channelStats[r.channel]) channelStats[r.channel] = { sent: 0, replied: 0 }
    channelStats[r.channel].sent++
    if (r.status === 'replied') channelStats[r.channel].replied++
  }
  const bestChannel = Object.entries(channelStats)
    .filter(([, v]) => v.sent >= 2)
    .sort((a, b) => (b[1].replied / b[1].sent) - (a[1].replied / a[1].sent))[0]

  return (
    <div style={{ minHeight: '100vh', background: C.pageBg, padding: '32px 32px 60px' }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(96,165,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(96,165,250,0.25)' }}>
            <Send size={16} color="#60a5fa" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>Reachout Storage</h1>
        </div>
        <p style={{ fontSize: 13, color: 'rgb(100,107,140)', margin: 0 }}>
          Every message you sent, tracked by project and contact — mark what worked, let AI learn from it.
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 28, flexWrap: 'wrap' }}>
        <StatCard label="Drafts waiting" value={totalDrafts}
          sub={totalDrafts > 0 ? 'Ready to send' : undefined}
          color="rgb(251,191,36)" bg="rgba(251,191,36,0.08)" />
        <StatCard label="Total sent" value={totalSent} color="rgb(96,165,250)" bg="rgba(96,165,250,0.1)" />
        <StatCard label="Got a reply" value={totalReplied}
          sub={totalSent > 0 ? `${replyRate}% reply rate` : undefined}
          color="rgb(52,211,153)" bg="rgba(52,211,153,0.1)" />
        <StatCard label="Best channel" value={bestChannel ? (CHANNEL_CFG[bestChannel[0]]?.label ?? bestChannel[0]) : '—'}
          sub={bestChannel ? `${Math.round(bestChannel[1].replied / bestChannel[1].sent * 100)}% reply rate` : undefined}
          color="rgb(167,139,250)" bg="rgba(167,139,250,0.1)" />
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgb(100,107,140)', fontWeight: 600 }}>
          <Filter size={12} />Filter:
        </span>

        {/* Channel filter */}
        {['all', 'linkedin', 'telegram', 'twitter', 'email'].map(ch => {
          const cfg = ch === 'all' ? null : CHANNEL_CFG[ch]
          const active = filterChannel === ch
          return (
            <button key={ch} onClick={() => setFilterChannel(ch)}
              style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', border: active ? `1px solid ${cfg?.border ?? 'rgba(167,139,250,0.4)'}` : '1px solid rgba(255,255,255,0.08)', background: active ? (cfg?.bg ?? 'rgba(167,139,250,0.12)') : 'rgba(255,255,255,0.02)', color: active ? (cfg?.color ?? '#a78bfa') : 'rgb(120,127,160)' }}>
              {ch === 'all' ? 'All channels' : (cfg?.label ?? ch)}
            </button>
          )
        })}

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />

        {/* Outcome filter */}
        {[
          { key: 'all', label: 'All' },
          { key: 'draft', label: '📝 Drafts' },
          { key: 'sent', label: '⏳ Pending' },
          { key: 'replied', label: '✓ Replied' },
          { key: 'archived', label: '✗ No response' },
        ].map(({ key, label }) => {
          const active = filterOutcome === key
          return (
            <button key={key} onClick={() => setFilterOutcome(key)}
              style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', border: active ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(255,255,255,0.08)', background: active ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.02)', color: active ? '#a78bfa' : 'rgb(120,127,160)' }}>
              {label}
            </button>
          )
        })}

        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'rgb(80,87,120)' }}>
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Records list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(96,165,250,0.2)', borderTopColor: '#60a5fa', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: 'rgb(100,107,140)', fontSize: 13 }}>Loading outreach records…</p>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Inbox size={22} color="rgba(96,165,250,0.5)" />
          </div>
          <p style={{ color: 'rgb(100,107,140)', fontSize: 14, margin: 0 }}>
            {records.length === 0
              ? 'No outreach messages saved yet. Open a lead → Contacts and mark a channel — you\'ll be prompted to paste your message.'
              : 'No records match this filter.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(r => (
            <RecordCard key={r.id} record={r} onOutcomeChange={handleOutcomeChange} />
          ))}
        </div>
      )}

      {/* AI learning note */}
      {totalReplied >= 2 && (
        <div style={{ marginTop: 32, borderRadius: 14, border: '1px solid rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.04)', padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <TrendingUp size={16} color="rgb(52,211,153)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgb(52,211,153)', marginBottom: 4 }}>
              AI is learning from your winning messages
            </div>
            <div style={{ fontSize: 12, color: 'rgb(100,107,140)', lineHeight: 1.6 }}>
              You have {totalReplied} messages that got replies. The Outreach Studio already uses these as reference examples when drafting new messages — it mirrors voice, structure, and length from what has actually worked for you.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
