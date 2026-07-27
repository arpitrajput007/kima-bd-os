'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2, Copy, Check, ExternalLink, RefreshCw, Send, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getActor } from '@/lib/actor'
import { buildTarget, channelDeepLink, logTouch, type OutreachMeta } from '@/lib/outreach'
import { getStatusColor, getStatusLabel, cn } from '@/lib/utils'
import type { Lead } from '@/lib/types'

interface Draft { channel: string; subject?: string; text: string }

const CHANNEL_LABEL: Record<string, string> = {
  telegram: 'Telegram', linkedin: 'LinkedIn', twitter: 'Twitter/X',
  email: 'Email', discord: 'Discord', call: 'Call', other: 'Other',
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export function FollowUpDraftCard({ lead, onSent, delayMs = 0 }: { lead: Lead; onSent: () => void; delayMs?: number }) {
  const supabase = createClient()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [meta, setMeta] = useState<OutreachMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchDraft = useCallback(async () => {
    const res = await fetch('/api/ai/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'followup', lead_id: lead.id, stage: lead.follow_up_stage ?? 0 }),
    }).then(r => r.json())
    if (res.error) throw new Error(res.error)
    return res.data as { draft: Draft; meta: OutreachMeta }
  }, [lead.id, lead.follow_up_stage])

  // Generating a draft for every overdue lead at once can burst past the
  // model's tokens-per-minute limit, so calls are staggered (delayMs) and a
  // single 429 gets one automatic retry after a short backoff before we
  // surface an error.
  const generate = useCallback(async (opts?: { skipDelay?: boolean }) => {
    setLoading(true)
    setError(null)
    if (!opts?.skipDelay && delayMs > 0) await sleep(delayMs)
    try {
      const data = await fetchDraft()
      setDraft(data.draft)
      setMeta(data.meta)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to draft follow-up'
      if (/rate limit|429/i.test(message)) {
        await sleep(4000 + Math.random() * 3000)
        try {
          const data = await fetchDraft()
          setDraft(data.draft)
          setMeta(data.meta)
          setLoading(false)
          return
        } catch (e2) {
          setError(e2 instanceof Error ? e2.message : 'Failed to draft follow-up')
          setLoading(false)
          return
        }
      }
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [delayMs, fetchDraft])

  useEffect(() => { generate() }, [generate]) // eslint-disable-line

  const regenerate = () => generate({ skipDelay: true })

  const overdueDays = lead.next_follow_up_at
    ? Math.max(0, Math.floor((Date.now() - new Date(lead.next_follow_up_at).getTime()) / 86400000))
    : 0

  const copy = () => {
    if (!draft) return
    navigator.clipboard.writeText(draft.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const deepLink = draft && meta ? channelDeepLink(draft.channel, buildTarget(meta), draft.text, draft.subject) : null

  const markSent = async () => {
    if (!draft) return
    setSending(true)
    const { error: err } = await logTouch(supabase, {
      leadId: lead.id,
      channel: draft.channel,
      text: draft.text,
      subject: draft.subject,
      contactId: meta?.contact?.id,
      kind: 'followup',
      currentStage: lead.follow_up_stage ?? 0,
    })
    if (!err) {
      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        type: 'email',
        channel: draft.channel,
        content: `Follow-up sent via ${CHANNEL_LABEL[draft.channel] || draft.channel}: ${draft.text.slice(0, 200)}`,
        performed_by: getActor(),
      })
      toast.success(`Follow-up logged for ${lead.company_name}`)
      onSent()
    } else {
      toast.error('Failed to log follow-up')
    }
    setSending(false)
  }

  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(251,191,36,0.18)' }}>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/leads/${lead.id}`} className="text-sm font-bold text-white hover:text-violet-300 transition-colors">
            {lead.company_name}
          </Link>
          <span className={cn('badge', getStatusColor(lead.status))} style={{ fontSize: '10px' }}>{getStatusLabel(lead.status)}</span>
          {lead.last_channel && (
            <span className="badge text-xs" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgb(180,185,210)', borderColor: 'rgba(255,255,255,0.1)', fontSize: '10px' }}>
              last via {CHANNEL_LABEL[lead.last_channel] || lead.last_channel}
            </span>
          )}
          {overdueDays > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#f87171' }}>
              <Clock size={11} /> {overdueDays}d overdue
            </span>
          )}
        </div>
        <button onClick={regenerate} disabled={loading} className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Regenerate
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'rgb(140,140,160)', padding: '14px 0' }}>
          <Loader2 size={13} className="animate-spin" /> Drafting a follow-up…
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 text-xs" style={{ color: '#f87171', padding: '10px 0' }}>
          <span>{error}</span>
          <button onClick={regenerate} className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}>
            <RefreshCw size={11} /> Retry
          </button>
        </div>
      ) : draft ? (
        <>
          <div className="flex items-center gap-2 mb-2">
            <span className="badge text-xs" style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', borderColor: 'rgba(167,139,250,0.25)', fontSize: '10px' }}>
              {CHANNEL_LABEL[draft.channel] || draft.channel}
            </span>
            {draft.subject && <span className="text-xs" style={{ color: 'rgb(160,165,195)' }}>Subject: {draft.subject}</span>}
          </div>
          <textarea
            value={draft.text}
            onChange={e => setDraft(d => d ? { ...d, text: e.target.value } : d)}
            rows={4}
            className="input-dark"
            style={{ width: '100%', resize: 'vertical', fontSize: 13, lineHeight: 1.5, boxSizing: 'border-box' }}
          />
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button onClick={copy} className="btn btn-secondary" style={{ fontSize: 12, padding: '7px 12px' }}>
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
            </button>
            {deepLink && (
              <a href={deepLink} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ fontSize: 12, padding: '7px 12px' }}>
                <ExternalLink size={12} /> Open {CHANNEL_LABEL[draft.channel] || draft.channel}
              </a>
            )}
            <button onClick={markSent} disabled={sending} className="btn btn-primary" style={{ fontSize: 12, padding: '7px 12px', marginLeft: 'auto' }}>
              {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Mark Sent &amp; Reschedule
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
