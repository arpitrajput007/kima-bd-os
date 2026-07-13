'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Mail, Send, XCircle, Save, Loader2, ExternalLink, Clock, CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'

const C = {
  pageBg: '#070A12',
  cardBg: '#101522',
  nestedBg: '#151A2A',
  border: '1px solid rgba(255,255,255,0.08)',
}

interface DraftRow {
  id: string
  lead_id: string
  contact_id: string | null
  message: string
  created_at: string
  leads: { id: string; company_name: string } | null
  contacts: { name: string | null; email: string | null } | null
}

interface SentRow {
  id: string
  status: string
  created_at: string
  leads: { company_name: string } | null
  contacts: { email: string | null } | null
}

function splitSubject(message: string): { subject: string; body: string } {
  const match = message.match(/^Subject: (.+)$/m)
  if (!match) return { subject: '', body: message }
  return { subject: match[1], body: message.replace(/^Subject: .+\n\n/, '') }
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ borderRadius: 14, border: C.border, background: C.cardBg, padding: '16px 18px', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'white', lineHeight: 1, marginBottom: 5 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'rgb(110,115,145)', fontWeight: 500 }}>{label}</div>
      <div style={{ width: 24, height: 3, borderRadius: 2, background: color, opacity: 0.5, marginTop: 8 }} />
    </div>
  )
}

function DraftEditor({
  draft,
  highlight,
  onDone,
}: {
  draft: DraftRow
  highlight: boolean
  onDone: (id: string) => void
}) {
  const initial = splitSubject(draft.message)
  const [subject, setSubject] = useState(initial.subject)
  const [body, setBody] = useState(initial.body)
  const [busy, setBusy] = useState<'send' | 'discard' | 'save' | null>(null)
  const dirty = subject !== initial.subject || body !== initial.body
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (highlight && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlight])

  const call = async (action: 'send' | 'discard' | 'save') => {
    setBusy(action)
    try {
      const res = await fetch('/api/leads/approve-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draft.id, action, subject, text: body }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || `Failed to ${action}`)
        setBusy(null)
        return
      }
      const company = draft.leads?.company_name || 'lead'
      if (action === 'send') toast.success(`Sent to ${company}`)
      else if (action === 'discard') toast.success(`Discarded draft for ${company}`)
      else toast.success('Draft saved')

      if (action === 'save') { setBusy(null); return }
      onDone(draft.id)
    } catch {
      toast.error(`Failed to ${action}`)
      setBusy(null)
    }
  }

  return (
    <div ref={ref} style={{
      borderRadius: 16,
      border: highlight ? '1px solid rgba(96,165,250,0.5)' : C.border,
      background: C.cardBg,
      padding: '18px 20px',
      boxShadow: highlight ? '0 0 0 3px rgba(96,165,250,0.15)' : undefined,
      transition: 'box-shadow 0.3s, border-color 0.3s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, background: 'rgba(96,165,250,0.1)',
            border: '1px solid rgba(96,165,250,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Mail size={15} color="#60a5fa" />
          </div>
          <div style={{ minWidth: 0 }}>
            <Link href={`/leads/${draft.lead_id}`} style={{ fontSize: 14, fontWeight: 700, color: 'white', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {draft.leads?.company_name || 'Unknown lead'}
              <ExternalLink size={11} color="rgba(148,163,184,0.5)" />
            </Link>
            <div style={{ fontSize: 11.5, color: 'rgb(140,145,180)' }}>
              to {draft.contacts?.email || <span style={{ color: 'rgb(248,113,133)' }}>no email on file</span>}
              {draft.contacts?.name ? ` (${draft.contacts.name})` : ''}
            </div>
          </div>
        </div>
        {dirty && (
          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'rgb(251,191,36)', flexShrink: 0 }}>
            Unsaved edits
          </span>
        )}
      </div>

      <input
        value={subject}
        onChange={e => setSubject(e.target.value)}
        placeholder="Subject"
        style={{
          width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9,
          background: C.nestedBg, border: '1px solid rgba(255,255,255,0.06)', color: 'white',
          fontSize: 13, fontWeight: 600, marginBottom: 8, fontFamily: 'inherit',
        }}
      />
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={7}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 9,
          background: C.nestedBg, border: '1px solid rgba(255,255,255,0.06)', color: 'rgb(210,215,240)',
          fontSize: 13, lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit', marginBottom: 12,
        }}
      />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => call('send')}
          disabled={busy !== null}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, fontSize: 12.5, fontWeight: 700,
            background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399',
            cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy && busy !== 'send' ? 0.5 : 1,
          }}
        >
          {busy === 'send' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          Send
        </button>
        <button
          onClick={() => call('save')}
          disabled={busy !== null || !dirty}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, fontSize: 12.5, fontWeight: 700,
            background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.28)', color: '#60a5fa',
            cursor: (busy || !dirty) ? 'default' : 'pointer', fontFamily: 'inherit', opacity: (busy && busy !== 'save') || !dirty ? 0.4 : 1,
          }}
        >
          {busy === 'save' ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Save
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => call('discard')}
          disabled={busy !== null}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, fontSize: 12.5, fontWeight: 700,
            background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171',
            cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy && busy !== 'discard' ? 0.5 : 1,
          }}
        >
          {busy === 'discard' ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
          Discard
        </button>
      </div>
    </div>
  )
}

function EmailReachoutInner() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('id')

  const [drafts, setDrafts] = useState<DraftRow[]>([])
  const [sent, setSent] = useState<SentRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [{ data: d }, { data: s }] = await Promise.all([
      supabase
        .from('outreach_messages')
        .select('id, lead_id, contact_id, message, created_at, leads(id, company_name), contacts(name, email)')
        .eq('channel', 'email')
        .eq('status', 'draft')
        .order('created_at', { ascending: true }),
      supabase
        .from('outreach_messages')
        .select('id, status, created_at, leads(company_name), contacts(email)')
        .eq('channel', 'email')
        .in('status', ['sent', 'replied'])
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    if (d) setDrafts(d as unknown as DraftRow[])
    if (s) setSent(s as unknown as SentRow[])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  const handleDone = (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id))
  }

  return (
    <div style={{ minHeight: '100vh', background: C.pageBg, padding: '32px 32px 60px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(96,165,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(96,165,250,0.25)' }}>
            <Mail size={16} color="#60a5fa" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>Email Reachout</h1>
        </div>
        <p style={{ fontSize: 13, color: 'rgb(100,107,140)', margin: 0 }}>
          Every AI-drafted email waits here for you — read it in full, edit anything, then send. Nothing goes out until you click Send.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 28, flexWrap: 'wrap' }}>
        <StatCard label="Drafts awaiting approval" value={drafts.length} color="rgb(251,191,36)" />
        <StatCard label="Sent (last 20)" value={sent.filter(s => s.status === 'sent').length} color="rgb(96,165,250)" />
        <StatCard label="Replied" value={sent.filter(s => s.status === 'replied').length} color="rgb(52,211,153)" />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Loader2 size={22} className="animate-spin" color="rgb(96,165,250)" />
        </div>
      ) : drafts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', borderRadius: 16, border: C.border, background: C.cardBg }}>
          <Mail size={22} color="rgba(96,165,250,0.4)" style={{ marginBottom: 12 }} />
          <p style={{ color: 'rgb(100,107,140)', fontSize: 13.5, margin: 0 }}>
            No drafts waiting. The daily outreach cron will queue new ones here for review.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 36 }}>
          {drafts.map(d => (
            <DraftEditor key={d.id} draft={d} highlight={highlightId === d.id} onDone={handleDone} />
          ))}
        </div>
      )}

      {sent.length > 0 && (
        <>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'rgb(140,145,180)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
            Recently sent
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sent.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
                border: C.border, background: C.cardBg,
              }}>
                {s.status === 'replied'
                  ? <CheckCircle2 size={13} color="rgb(52,211,153)" />
                  : <Clock size={13} color="rgb(148,163,184)" />}
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'white' }}>{s.leads?.company_name || 'Unknown'}</span>
                <span style={{ fontSize: 11.5, color: 'rgb(100,107,140)' }}>to {s.contacts?.email || '—'}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: s.status === 'replied' ? 'rgb(52,211,153)' : 'rgb(100,107,140)', fontWeight: 600 }}>
                  {s.status === 'replied' ? 'Replied' : 'Sent'}
                </span>
                <span style={{ fontSize: 11, color: 'rgb(80,87,120)' }}>
                  {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function EmailReachoutPage() {
  return (
    <Suspense fallback={null}>
      <EmailReachoutInner />
    </Suspense>
  )
}
