'use client'

// Every email the agent wants to send sits here as a draft first — nothing
// goes out until you click Send. Mirrors FollowUpNotifications/
// NewReplyNotifications in look, mounted alongside them in the dashboard layout.

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Mail, Check, X, Loader2, Maximize2 } from 'lucide-react'
import { toast } from 'sonner'

interface PendingDraft {
  id: string
  lead_id: string
  message: string
  created_at: string
  leads: { company_name: string } | null
  contacts: { email: string | null } | null
}

const POLL_MS = 60_000

function splitSubject(message: string): { subject: string; body: string } {
  const match = message.match(/^Subject: (.+)$/m)
  if (!match) return { subject: '(no subject)', body: message }
  return { subject: match[1], body: message.replace(/^Subject: .+\n\n/, '') }
}

function DraftCard({
  draft,
  onDone,
}: {
  draft: PendingDraft
  onDone: (id: string) => void
}) {
  const [busy, setBusy] = useState<'send' | 'discard' | null>(null)
  const { subject, body } = splitSubject(draft.message)

  const act = async (action: 'send' | 'discard') => {
    setBusy(action)
    try {
      const res = await fetch('/api/leads/approve-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draft.id, action }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || `Failed to ${action}`)
        setBusy(null)
        return
      }
      toast.success(
        action === 'send'
          ? `Sent to ${draft.leads?.company_name || 'lead'}`
          : `Discarded draft for ${draft.leads?.company_name || 'lead'}`,
      )
      onDone(draft.id)
    } catch {
      toast.error(`Failed to ${action}`)
      setBusy(null)
    }
  }

  return (
    <div style={{
      width: 340,
      borderRadius: 14,
      border: '1px solid rgba(96,165,250,0.22)',
      background: 'linear-gradient(160deg, rgba(22,23,38,0.99), rgba(14,15,26,0.99))',
      boxShadow: '0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(96,165,250,0.06)',
      backdropFilter: 'blur(20px)',
      overflow: 'hidden',
    }}>
      <div style={{ height: 3, background: 'linear-gradient(90deg, #60a5fa, rgba(96,165,250,0.3))' }} />
      <div style={{ padding: '13px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 9 }}>
          <div style={{
            flexShrink: 0, width: 32, height: 32, borderRadius: 9,
            background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mail size={14} color="#60a5fa" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {draft.leads?.company_name || 'Unknown lead'}
            </div>
            <div style={{ fontSize: 11, color: 'rgb(140,145,180)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              to {draft.contacts?.email || '—'}
            </div>
          </div>
          <Link
            href={`/email-reachout?id=${draft.id}`}
            title="View full email & edit"
            style={{
              flexShrink: 0, width: 26, height: 26, borderRadius: 7, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'rgb(140,145,180)',
              border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
            }}
          >
            <Maximize2 size={12} />
          </Link>
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgb(210,215,240)', marginBottom: 4 }}>
          {subject}
        </div>
        <div style={{
          fontSize: 11.5, color: 'rgb(160,165,200)', lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          marginBottom: 12,
        }}>
          {body}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => act('send')}
            disabled={busy !== null}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)',
              color: '#34d399', cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
              opacity: busy && busy !== 'send' ? 0.5 : 1,
            }}
          >
            {busy === 'send' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Send
          </button>
          <button
            onClick={() => act('discard')}
            disabled={busy !== null}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
              color: '#f87171', cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
              opacity: busy && busy !== 'discard' ? 0.5 : 1,
            }}
          >
            {busy === 'discard' ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
            Discard
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PendingOutreachApprovals() {
  const supabase = createClient()
  const [mounted, setMounted] = useState(false)
  const [drafts, setDrafts] = useState<PendingDraft[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => { setMounted(true) }, [])

  const fetchDrafts = useCallback(async () => {
    const { data } = await supabase
      .from('outreach_messages')
      .select('id, lead_id, message, created_at, leads(company_name), contacts(email)')
      .eq('channel', 'email')
      .eq('status', 'draft')
      .order('created_at', { ascending: true })
      .limit(10)
    if (data) setDrafts(data as unknown as PendingDraft[])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchDrafts()
    timerRef.current = setInterval(fetchDrafts, POLL_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fetchDrafts])

  const handleDone = (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id))
  }

  if (!mounted || drafts.length === 0) return null

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 48,
      left: 20,
      zIndex: 9994,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      maxHeight: 'calc(100vh - 70px)',
      overflowY: 'auto',
      overflowX: 'visible',
      paddingBottom: 4,
    }}>
      <Link href="/email-reachout" style={{
        width: 340, boxSizing: 'border-box', padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 600,
        background: 'rgba(20,21,35,0.95)', border: '1px solid rgba(255,255,255,0.1)',
        color: 'rgb(160,165,200)', backdropFilter: 'blur(20px)', textDecoration: 'none',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{drafts.length} draft{drafts.length === 1 ? '' : 's'} awaiting approval</span>
        <span style={{ color: '#60a5fa' }}>Open →</span>
      </Link>
      {drafts.slice(0, 5).map(draft => (
        <DraftCard key={draft.id} draft={draft} onDone={handleDone} />
      ))}
    </div>,
    document.body,
  )
}
