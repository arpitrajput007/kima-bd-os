'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Sun, Target, Flame, ArrowRight, MessageSquare, Mail, Link2,
  AtSign, CheckCircle, Eye, Loader2, RefreshCw, Clock, CalendarCheck,
  Sparkles, Zap, TrendingUp, Wand2, Copy, ExternalLink, Download, ShieldAlert, Trash2,
} from 'lucide-react'
import { cn, getScoreBg, truncate } from '@/lib/utils'
import type { Lead, Contact } from '@/lib/types'
import {
  buildTarget, channelDeepLink, logTouch, followUpDue,
  MAX_FOLLOWUPS, FOLLOWUP_GAP_DAYS, type OutreachMeta,
} from '@/lib/outreach'

type LeadActivity = { id: string; type: string; channel?: string }
type LeadWithContacts = Lead & { contacts?: Contact[]; lead_activities?: LeadActivity[] }

// Statuses that mean "ready to reach out" — agent has researched, you haven't contacted yet
const READY_STATUSES = ['new', 'researching', 'qualified', 'approved', 'needs_more_research']
const DAILY_GOAL_CAP = 30

function bestContact(contacts?: Contact[]): Contact | null {
  if (!contacts || contacts.length === 0) return null
  const rank: Record<string, number> = { high: 0, medium: 1, low: 2, unknown: 3 }
  return [...contacts].sort(
    (a, b) => (rank[a.contact_confidence || 'unknown'] ?? 3) - (rank[b.contact_confidence || 'unknown'] ?? 3)
  )[0]
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

// Local YYYY-MM-DD key for grouping leads by the day they came in.
function dayKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Human label for a day key: "Today" / "Yesterday" / "Mon, Jun 1".
function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - date.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

interface AgentDraft { channel: string; subject?: string; text: string }

// A due follow-up: draft a fresh-angle nudge inline, then open the channel
// and log the touch (advancing the lead's follow-up stage).
function FollowUpRow({ lead, onSent }: { lead: LeadWithContacts; onSent: () => void }) {
  const supabase = createClient()
  const [draft, setDraft] = useState<AgentDraft | null>(null)
  const [meta, setMeta] = useState<OutreachMeta | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [sending, setSending] = useState(false)
  const stage = lead.follow_up_stage ?? 0
  const baseDate = lead.last_contacted_at || lead.updated_at

  const draftFollowup = async () => {
    setDrafting(true)
    try {
      const res = await fetch('/api/ai/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'followup', lead_id: lead.id, stage }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setDraft(json.data?.draft || null)
      setMeta(json.data?.meta || null)
      if (!json.data?.draft) toast.error('No follow-up returned — try again')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Draft failed')
    } finally {
      setDrafting(false)
    }
  }

  const sendFollowup = async () => {
    if (!draft) return
    setSending(true)
    const target = buildTarget(meta)
    const url = channelDeepLink(draft.channel, target, draft.text, draft.subject)
    const fullText = draft.subject ? `${draft.subject}\n\n${draft.text}` : draft.text
    const { error } = await logTouch(supabase, {
      leadId: lead.id,
      channel: draft.channel,
      text: draft.text,
      subject: draft.subject,
      contactId: meta?.contact?.id,
      kind: 'followup',
      currentStage: stage,
    })
    setSending(false)
    if (error) { toast.error('Could not log the follow-up'); return }
    if (url) {
      if (draft.channel !== 'email') navigator.clipboard.writeText(fullText)
      window.open(url, '_blank')
    } else {
      navigator.clipboard.writeText(fullText)
    }
    toast.success(`Follow-up #${stage + 1} logged`)
    onSent()
  }

  return (
    <div className="px-3 py-2.5 rounded-lg" style={{ background: draft ? 'rgba(251,191,36,0.04)' : 'transparent' }}>
      <div className="flex items-center justify-between gap-2">
        <Link href={`/leads/${lead.id}`} className="min-w-0">
          <div className="text-[13px] font-semibold text-white truncate hover:text-violet-300 transition-colors">{lead.company_name}</div>
          <div className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>
            {baseDate ? `Last touch ${daysSince(baseDate)}d ago` : 'Contacted'} · follow-up #{stage + 1} of {MAX_FOLLOWUPS}
          </div>
        </Link>
        {!draft ? (
          <button onClick={draftFollowup} disabled={drafting}
            className="btn btn-secondary flex-shrink-0" style={{ fontSize: '11px', padding: '5px 10px' }}>
            {drafting ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            Draft follow-up
          </button>
        ) : (
          <ArrowRight size={14} style={{ color: 'rgb(110,115,145)' }} className="flex-shrink-0" />
        )}
      </div>

      {draft && (
        <div className="mt-2.5 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(251,191,36,0.18)' }}>
          {draft.subject && (
            <div className="px-3 pt-2 text-[11px]" style={{ color: '#fbbf24' }}>
              <span style={{ opacity: 0.7 }}>Subject: </span><span className="text-white">{draft.subject}</span>
            </div>
          )}
          <pre className="px-3 py-2.5 text-[12px] leading-relaxed whitespace-pre-wrap"
            style={{ color: 'rgb(210,210,230)', fontFamily: 'Inter, sans-serif', background: 'rgba(22,22,34,0.5)' }}>
            {draft.text}
          </pre>
          <div className="flex items-center gap-1.5 px-3 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button onClick={() => { navigator.clipboard.writeText(draft.subject ? `${draft.subject}\n\n${draft.text}` : draft.text); toast.success('Copied!') }}
              className="btn btn-ghost" style={{ fontSize: '11px', padding: '3px 8px' }}>
              <Copy size={11} /> Copy
            </button>
            <button onClick={draftFollowup} disabled={drafting}
              className="btn btn-ghost" style={{ fontSize: '11px', padding: '3px 8px' }}>
              <RefreshCw size={11} className={drafting ? 'animate-spin' : ''} /> Redraft
            </button>
            <button onClick={sendFollowup} disabled={sending}
              className="btn btn-primary ml-auto" style={{ fontSize: '11px', padding: '4px 10px' }}>
              {sending ? <Loader2 size={11} className="animate-spin" /> : <ExternalLink size={11} />} Open &amp; send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// One lead card in the plan — used for both today's picks and the date-grouped backlog.
function PlanLeadCard({ lead, rank, actionLoading, onContacted, onReserved, onDelete }: {
  lead: LeadWithContacts; rank: number | null; actionLoading: string | null
  onContacted: (id: string) => void; onReserved?: (id: string) => void; onDelete?: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleDelete = () => {
    if (confirmDelete) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
      onDelete?.(lead.id)
    } else {
      setConfirmDelete(true)
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 3000)
    }
  }
  const contact = bestContact(lead.contacts)
  const waiting = daysSince(lead.created_at)
  return (
    <div className="section-card" style={{ padding: '18px 20px' }}>
      <div className="flex items-start gap-4">
        {/* Rank + avatar */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0 pt-0.5">
          {rank != null && <div className="text-[11px] font-bold tabular-nums" style={{ color: 'rgb(90,95,120)' }}>#{rank}</div>}
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-bold"
            style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
            {lead.company_name.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <Link href={`/leads/${lead.id}`}
              className="text-[14px] font-bold text-white hover:text-violet-300 transition-colors">
              {lead.company_name}
            </Link>
            {lead.lead_score != null && (
              <span className={cn('badge', getScoreBg(lead.lead_score))} style={{ fontSize: '10px' }}>
                {lead.lead_score}
              </span>
            )}
            {(lead.customer_category || []).slice(0, 1).map(cat => (
              <span key={cat} className="badge" style={{ fontSize: '10px', padding: '1px 6px', background: 'rgba(139,92,246,0.1)', color: '#a78bfa', borderColor: 'rgba(139,92,246,0.2)' }}>
                {cat.replace(' Customer', '')}
              </span>
            ))}
            {lead.product_to_sell && (
              <span className="text-[11px]" style={{ color: 'rgb(110,115,145)' }}>· {lead.product_to_sell}</span>
            )}
            {waiting >= 1 && (
              <span className="text-[11px]" style={{ color: waiting >= 3 ? '#fbbf24' : 'rgb(110,115,145)' }}>
                · waiting {waiting}d
              </span>
            )}
          </div>

          {/* Pain point — the "why" */}
          {lead.pain_point && (
            <div className="text-[12px] mb-2.5 leading-relaxed" style={{ color: 'rgb(150,155,185)' }}>
              <span style={{ color: '#fb7185', fontWeight: 600 }}>Pain: </span>
              {truncate(lead.pain_point, 150)}
            </div>
          )}

          {/* Contact line — who to message */}
          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            <span style={{ color: 'rgb(100,106,135)' }}>Reach out to:</span>
            {contact ? (
              <>
                <span className="font-semibold text-white">
                  {contact.name || contact.role || 'Decision maker'}
                </span>
                {contact.role && contact.name && (
                  <span style={{ color: 'rgb(110,115,145)' }}>· {contact.role}</span>
                )}
                <div className="flex items-center gap-1.5 ml-1">
                  {contact.linkedin_url && (
                    <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer"
                      className="contact-chip" title="LinkedIn"><Link2 size={12} /></a>
                  )}
                  {contact.twitter_url && (
                    <a href={contact.twitter_url} target="_blank" rel="noopener noreferrer"
                      className="contact-chip" title="Twitter/X"><AtSign size={12} /></a>
                  )}
                  {contact.email && (
                    <a href={`mailto:${contact.email}`}
                      className="contact-chip" title={contact.email}><Mail size={12} /></a>
                  )}
                </div>
              </>
            ) : (
              <span style={{ color: 'rgb(110,115,145)' }} className="italic">
                No contact yet — open the lead to find one
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 flex-shrink-0 w-[150px]">
          <Link href={`/outreach?lead=${lead.id}`}
            className="btn btn-primary justify-center" style={{ fontSize: '12px', padding: '8px 12px' }}>
            <MessageSquare size={13} /> Draft message
          </Link>
          <button
            onClick={() => onContacted(lead.id)}
            disabled={actionLoading === lead.id}
            className="btn btn-secondary justify-center" style={{ fontSize: '12px', padding: '7px 12px', color: '#34d399' }}>
            {actionLoading === lead.id
              ? <Loader2 size={13} className="animate-spin" />
              : <><CheckCircle size={13} /> Mark contacted</>}
          </button>
          {onReserved && (
            <button
              onClick={() => onReserved(lead.id)}
              disabled={actionLoading === lead.id}
              className="btn btn-ghost justify-center"
              title="Too big to approach now — save for later when you're bigger"
              style={{ fontSize: '11px', padding: '5px 12px', color: '#818cf8', borderColor: 'rgba(129,140,248,0.25)', background: 'rgba(129,140,248,0.06)' }}>
              <Clock size={12} /> Reserve for later
            </button>
          )}
          <Link href={`/leads/${lead.id}`}
            className="btn btn-ghost justify-center" style={{ fontSize: '11px', padding: '5px 12px', color: 'rgb(130,135,165)' }}>
            <Eye size={12} /> View details
          </Link>
          {onDelete && (
            <button
              onClick={handleDelete}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: '11px', fontWeight: 600, transition: 'all 0.15s',
                background: confirmDelete ? 'rgba(244,63,94,0.14)' : 'rgba(255,255,255,0.04)',
                color: confirmDelete ? '#f43f5e' : 'rgba(255,255,255,0.22)',
                borderTop: `1px solid ${confirmDelete ? 'rgba(244,63,94,0.25)' : 'rgba(255,255,255,0.06)'}`,
              }}>
              <Trash2 size={11} />
              {confirmDelete ? 'Confirm delete?' : 'Remove lead'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TodayPage() {
  const supabase = createClient()
  const [leads, setLeads]       = useState<LeadWithContacts[]>([])  // all leads (followups, reserved, etc.)
  const [planLeads, setPlanLeads] = useState<LeadWithContacts[]>([]) // server-filtered for the plan
  const [loading, setLoading]   = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const [hackFetching, setHackFetching] = useState(false)
  const [bgJob, setBgJob] = useState<{ status: string; sources_done: number; sources_total: number; leads_saved: number; current_source?: string } | null>(null)
  const [contactingLead, setContactingLead] = useState<LeadWithContacts | null>(null)

  // Poll for background job status (runs even if user navigates away and comes back).
  const pollJob = useCallback(async () => {
    const res = await fetch('/api/leads/run-all-sources').then(r => r.json()).catch(() => null)
    if (res && res.status === 'running') {
      setBgJob(res)
      setTimeout(pollJob, 4000) // keep polling every 4s
    } else if (res && res.status === 'done') {
      setBgJob(null)
      toast.success(`Discovery done — ${res.leads_saved} new lead${res.leads_saved !== 1 ? 's' : ''} saved`)
      loadData()
    } else {
      setBgJob(null)
    }
  }, []) // eslint-disable-line

  // On mount: check if a job is already running from a previous session.
  useEffect(() => { pollJob() }, [pollJob])

  // Chain discover calls source-by-source from the frontend.
  // Each /api/ai/discover call = 1 source = fits within Vercel's 60s limit.
  // Total run time scales with number of sources but quality is never sacrificed.
  const fetchFreshLeads = async () => {
    setFetching(true)
    try {
      const { data: sources, error } = await supabase
        .from('sources')
        .select('id, source_name')
        .eq('status', 'active')
        .not('source_url_or_query', 'is', null)
      if (error || !sources?.length) {
        toast.error('No active sources. Add some in Discovery Sources.')
        return
      }
      const researchAI = (typeof window !== 'undefined' ? localStorage.getItem('bd_research_ai') : null) || 'claude'
      setBgJob({ status: 'running', sources_done: 0, sources_total: sources.length, leads_saved: 0, current_source: sources[0].source_name })
      let totalSaved = 0
      for (let i = 0; i < sources.length; i++) {
        const src = sources[i]
        setBgJob({ status: 'running', sources_done: i, sources_total: sources.length, leads_saved: totalSaved, current_source: src.source_name })
        try {
          const res = await fetch('/api/ai/discover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_id: src.id, research_ai: researchAI }),
          })
          const data = await res.json()
          totalSaved += data.saved || 0
        } catch { /* one failing source should not abort the rest */ }
        setBgJob({ status: 'running', sources_done: i + 1, sources_total: sources.length, leads_saved: totalSaved, current_source: src.source_name })
      }
      setBgJob(null)
      if (totalSaved > 0) {
        toast.success(`Discovery complete — ${totalSaved} new lead${totalSaved !== 1 ? 's' : ''} added`)
        loadData()
      } else {
        toast('Discovery complete — no new leads found (all already in pipeline or below quality threshold)')
      }
    } catch {
      toast.error('Discovery failed')
    } finally {
      setFetching(false)
    }
  }

  // Scan rekt.news + Exa for recently hacked protocols.
  const fetchHackedLeads = async () => {
    setHackFetching(true)
    try {
      const res = await fetch('/api/leads/hack-monitor', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Hack monitor failed'); return }
      if (data.saved > 0) {
        toast.success(`Found ${data.saved} hacked protocol${data.saved > 1 ? 's' : ''} from last 120 days: ${data.leads_saved?.join(', ')}`)
        loadData()
      } else {
        toast(data.message || 'No new hacked protocols found')
      }
    } catch {
      toast.error('Hack monitor failed')
    } finally {
      setHackFetching(false)
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    // Run both queries in parallel:
    // 1. All leads — used for followups, reserved, contacts-today count (needs all statuses)
    // 2. Plan leads — server-side filtered so the DB itself excludes anything contacted/non-ready
    const [allRes, planRes] = await Promise.all([
      supabase
        .from('leads')
        .select('*, contacts(*), lead_activities(id, type, channel)')
        .order('lead_score', { ascending: false, nullsFirst: false })
        .limit(300),
      supabase
        .from('leads')
        .select('*, contacts(*)')
        .in('status', READY_STATUSES)          // DB-level: only ready statuses
        .is('contacted_at', null)               // DB-level: never contacted
        .order('lead_score', { ascending: false, nullsFirst: false })
        .limit(300),
    ])
    if (allRes.error) toast.error('Failed to load leads')
    else setLeads((allRes.data as LeadWithContacts[]) || [])
    if (!planRes.error) setPlanLeads((planRes.data as LeadWithContacts[]) || [])
    setLoading(false)
  }, []) // eslint-disable-line

  useEffect(() => { loadData() }, [loadData])

  const markContacted = async (id: string, channel: string, note: string, followUpDays: number) => {
    setActionLoading(id)
    const now = new Date()
    const followUpAt = new Date(now.getTime() + followUpDays * 86400000)
    const { error } = await supabase.from('leads').update({
      status: 'contacted',
      contacted_at: now.toISOString(),
      last_contacted_at: now.toISOString(),
      last_channel: channel,
      follow_up_stage: 0,
      next_follow_up_at: followUpAt.toISOString(),
      updated_at: now.toISOString(),
    }).eq('id', id)
    if (!error) {
      await supabase.from('lead_activities').insert({
        lead_id: id, type: 'email', channel,
        content: note || `Reached out via ${channel}`,
        follow_up_at: followUpAt.toISOString(),
      })
      toast.success(`Logged — follow-up in ${followUpDays} days`); loadData()
    } else { toast.error('Update failed') }
    setActionLoading(null)
    setContactingLead(null)
  }

  const markReserved = async (id: string) => {
    setActionLoading(id)
    const { error } = await supabase
      .from('leads')
      .update({ status: 'reserved', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) toast.error('Update failed')
    else { toast.success('Saved for later — will appear in your Reserved pipeline'); loadData() }
    setActionLoading(null)
  }

  const deleteLead = async (id: string) => {
    const lead = [...leads, ...planLeads].find(l => l.id === id)
    await supabase.from('leads').delete().eq('id', id)
    setPlanLeads(prev => prev.filter(l => l.id !== id))
    setLeads(prev => prev.filter(l => l.id !== id))
    toast(`${lead?.company_name ?? 'Lead'} removed from pipeline`)
  }

  const unReserve = async (id: string) => {
    setActionLoading(id)
    const { error } = await supabase
      .from('leads')
      .update({ status: 'new', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) toast.error('Update failed')
    else { toast.success('Moved back to active pipeline'); loadData() }
    setActionLoading(null)
  }

  // ── Build today's plan ────────────────────────────────────────────────────
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Company names already touched in any way (non-ready status OR contacted_at set).
  // Used to deduplicate: if "Acme" is 'contacted' in one row and 'new' in another,
  // the 'new' row is also excluded.
  const touchedCompanyNames = new Set(
    leads
      .filter(l => !READY_STATUSES.includes(l.status) || !!l.contacted_at)
      .map(l => l.company_name.toLowerCase().trim())
  )

  // planLeads is already server-side filtered (READY status + contacted_at IS NULL).
  // Client-side: also remove company-name duplicates against the touched set.
  const readyLeads = planLeads.filter(
    l => !touchedCompanyNames.has(l.company_name.toLowerCase().trim())
  )

  // Leads that arrived in the last 24 hours — drives the dynamic daily goal.
  const freshLeads = readyLeads.filter(l => new Date(l.created_at) >= last24h)
  // Goal = however many fresh leads came in, capped at DAILY_GOAL_CAP. Never forced.
  const DAILY_GOAL = Math.min(freshLeads.length, DAILY_GOAL_CAP)
  // Reserved leads (saved for later — too big right now)
  const reservedLeads = leads.filter(l => l.status === 'reserved')
  // Group EVERY un-contacted lead by the day it came in, newest day first — this is
  // the date-wise plan: "on Jun 1 reach out to these, on Jun 2 these…".
  const planGroups: { key: string; label: string; leads: LeadWithContacts[] }[] = []
  {
    const map = new Map<string, LeadWithContacts[]>()
    readyLeads.forEach(l => {
      const k = dayKey(l.created_at)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(l)
    })
    Array.from(map.keys()).sort((a, b) => b.localeCompare(a)).forEach(k => {
      // Highest-score leads first within each day.
      const dayLeads = map.get(k)!.sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0))
      planGroups.push({ key: k, label: dayLabel(k), leads: dayLeads })
    })
  }

  const followUps = leads.filter(followUpDue)

  const toBook = leads.filter(l => l.status === 'replied')

  const contactedToday = leads.filter(
    l => ['contacted', 'replied', 'meeting_booked'].includes(l.status) &&
      new Date(l.updated_at) >= today
  ).length

  const goalPct = Math.min((contactedToday / DAILY_GOAL) * 100, 100)
  const goalHit = contactedToday >= DAILY_GOAL

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <>
    <div className="fade-in">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2">
            <Sun size={18} style={{ color: '#fbbf24' }} />
            Today&apos;s Plan
          </h1>
          <p className="text-[12px] mt-1 font-medium" style={{ color: 'rgb(100,106,135)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {greeting}, let&apos;s close some deals
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={loadData} className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '12px' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button onClick={fetchFreshLeads} disabled={fetching || !!bgJob}
            className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '12px', opacity: (fetching || bgJob) ? 0.8 : 1 }}>
            {fetching
              ? <><Loader2 size={13} className="animate-spin" /> Starting…</>
              : <><Download size={13} /> Fetch fresh leads</>}
          </button>
          <button onClick={fetchHackedLeads} disabled={hackFetching}
            className="btn btn-secondary" style={{ padding: '7px 14px', fontSize: '12px', borderColor: 'rgba(251,113,133,0.35)', color: '#fb7185' }}
            title="Scan rekt.news + Exa for bridge/protocol hacks in the last 120 days and add them as leads">
            {hackFetching
              ? <><Loader2 size={13} className="animate-spin" /> Scanning hacks…</>
              : <><ShieldAlert size={13} /> Scan hacked protocols</>}
          </button>
        </div>
      </div>

      {/* Background job status banner */}
      {bgJob && bgJob.status === 'running' && (
        <div style={{ margin: '0 36px', padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(56,189,248,0.25)', background: 'rgba(56,189,248,0.06)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
          <Loader2 size={14} className="animate-spin" color="#38bdf8" style={{ flexShrink: 0 }} />
          <span style={{ color: '#38bdf8', fontWeight: 600 }}>Discovery running</span>
          <span style={{ color: 'rgb(150,155,185)' }}>
            {bgJob.current_source ? ` · ${bgJob.current_source}` : ''}
            {' '}· {bgJob.sources_done}/{bgJob.sources_total} sources · {bgJob.leads_saved} leads found
          </span>
        </div>
      )}

      <div style={{ padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* ── Daily goal banner ──────────────────────────── */}
        <div className="section-card" style={{ borderColor: goalHit ? 'rgba(52,211,153,0.3)' : 'rgba(124,58,237,0.2)' }}>
          <div className="p-6 flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: goalHit ? 'rgba(52,211,153,0.12)' : 'rgba(124,58,237,0.12)' }}>
              {goalHit ? <CheckCircle size={26} style={{ color: '#34d399' }} /> : <Target size={26} style={{ color: '#a78bfa' }} />}
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-bold text-white mb-1">
                {DAILY_GOAL === 0
                  ? 'No fresh leads in the last 24h — run discovery'
                  : goalHit
                    ? `Daily goal smashed — ${contactedToday} reached out today 🔥`
                    : `Reach out to ${DAILY_GOAL} fresh lead${DAILY_GOAL !== 1 ? 's' : ''} today`}
              </div>
              <div className="text-[12px] mb-3" style={{ color: 'rgb(130,135,165)' }}>
                {DAILY_GOAL === 0
                  ? 'Hit "Fetch fresh leads" above to pull new prospects from your sources.'
                  : goalHit
                    ? 'You cleared every fresh lead from the last 24h. Anything more is a bonus.'
                    : `${contactedToday} of ${DAILY_GOAL} done · ${DAILY_GOAL - contactedToday} to go · based on last 24h of discovery`}
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${goalPct}%`, background: goalHit ? '#34d399' : 'linear-gradient(90deg,#7c3aed,#a78bfa)' }} />
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-[36px] font-bold tabular-nums leading-none"
                style={{ color: goalHit ? '#34d399' : 'white' }}>{contactedToday}</div>
              <div className="text-[11px] font-medium" style={{ color: 'rgb(100,106,135)' }}>reached today</div>
            </div>
          </div>
        </div>

        {/* ── Date-wise plan: who to reach out to, by day ─── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Flame size={14} style={{ color: '#fb7185' }} />
            <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'rgb(100,106,135)' }}>
              Reach-out plan · by day · {readyLeads.length} waiting
            </span>
          </div>

          {loading ? (
            <div className="section-card p-10 text-center text-[13px]" style={{ color: 'rgb(100,106,135)' }}>
              <Loader2 size={20} className="animate-spin mx-auto mb-3" style={{ color: '#a78bfa' }} />
              Building your plan…
            </div>
          ) : planGroups.length === 0 ? (
            <div className="section-card p-14 text-center">
              <Sparkles size={40} className="mx-auto mb-4 opacity-15" style={{ color: 'rgb(160,165,195)' }} />
              <div className="text-[14px] font-semibold text-white mb-2">Inbox zero — every researched lead is handled</div>
              <div className="text-[12px] mb-5" style={{ color: 'rgb(100,106,135)', lineHeight: '1.7' }}>
                Run discovery to surface fresh leads, then come back and crush them.
              </div>
              <Link href="/sources" className="btn btn-primary" style={{ fontSize: '12px', padding: '8px 16px' }}>
                <Zap size={13} /> Run discovery
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {planGroups.map((group, gi) => {
                const isToday = group.label === 'Today'
                return (
                  <div key={group.key}>
                    <div className="flex items-center gap-2 mb-3">
                      <CalendarCheck size={14} style={{ color: isToday ? '#fb7185' : '#fbbf24' }} />
                      <span className="text-[13px] font-bold" style={{ color: isToday ? '#fb7185' : 'white' }}>{group.label}</span>
                      <span className="badge" style={{ fontSize: '10px', padding: '1px 7px', background: isToday ? 'rgba(251,113,133,0.1)' : 'rgba(255,255,255,0.05)', color: isToday ? '#fb7185' : 'rgb(150,155,185)', borderColor: isToday ? 'rgba(251,113,133,0.2)' : 'rgba(255,255,255,0.08)' }}>
                        {group.leads.length} to reach out
                      </span>
                      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    </div>
                    <div className="flex flex-col gap-3">
                      {group.leads.map((lead, i) => (
                        <PlanLeadCard key={lead.id} lead={lead} rank={gi === 0 ? i + 1 : null} actionLoading={actionLoading} onContacted={(id) => setContactingLead(leads.find(l => l.id === id) || null)} onReserved={markReserved} onDelete={deleteLead} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Follow-ups + book meetings ─────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Follow-ups due */}
          <div className="section-card">
            <div className="section-card-header">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.1)' }}>
                  <Clock size={14} style={{ color: '#fbbf24' }} />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white">Follow-ups due</div>
                  <div className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>No reply after {FOLLOWUP_GAP_DAYS} days — draft &amp; send in one click</div>
                </div>
              </div>
              <span className="badge" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', borderColor: 'rgba(251,191,36,0.2)', fontSize: '11px' }}>
                {followUps.length}
              </span>
            </div>
            <div className="p-3 flex flex-col gap-1">
              {followUps.length === 0 ? (
                <div className="text-[12px] text-center py-6" style={{ color: 'rgb(100,106,135)' }}>Nothing to chase right now</div>
              ) : followUps.slice(0, 6).map(lead => (
                <FollowUpRow key={lead.id} lead={lead} onSent={loadData} />
              ))}
            </div>
          </div>

          {/* Ready to book */}
          <div className="section-card">
            <div className="section-card-header">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.1)' }}>
                  <CalendarCheck size={14} style={{ color: '#34d399' }} />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white">Replied — book the meeting</div>
                  <div className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>Hottest of the hot. Don&apos;t let these go cold</div>
                </div>
              </div>
              <span className="badge" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', borderColor: 'rgba(52,211,153,0.2)', fontSize: '11px' }}>
                {toBook.length}
              </span>
            </div>
            <div className="p-3">
              {toBook.length === 0 ? (
                <div className="text-[12px] text-center py-6" style={{ color: 'rgb(100,106,135)' }}>
                  No replies yet — keep the outreach flowing
                </div>
              ) : toBook.slice(0, 6).map(lead => (
                <Link key={lead.id} href={`/leads/${lead.id}`}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors hover:bg-white/[0.03]">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-white truncate">{lead.company_name}</div>
                    <div className="text-[11px]" style={{ color: '#34d399' }}>Replied · ready to close</div>
                  </div>
                  <TrendingUp size={14} style={{ color: '#34d399' }} />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Reserved pipeline ─────────────────────────── */}
        {reservedLeads.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} style={{ color: '#818cf8' }} />
              <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'rgb(100,106,135)' }}>
                Reserved for later · {reservedLeads.length}
              </span>
            </div>
            <p className="text-[12px] mb-4" style={{ color: 'rgb(100,106,135)' }}>
              Companies that are too big to approach right now. Move them back to active pipeline when you&apos;re ready.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reservedLeads.map(lead => (
                <div key={lead.id} className="section-card" style={{ padding: '14px 18px', borderColor: 'rgba(129,140,248,0.15)', background: 'rgba(129,140,248,0.03)' }}>
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[12px] font-bold flex-shrink-0"
                      style={{ background: 'rgba(129,140,248,0.12)', color: '#818cf8' }}>
                      {lead.company_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/leads/${lead.id}`} className="text-[13px] font-semibold text-white hover:text-indigo-300 transition-colors">
                          {lead.company_name}
                        </Link>
                        {lead.lead_score != null && (
                          <span className={cn('badge', getScoreBg(lead.lead_score))} style={{ fontSize: '10px' }}>{lead.lead_score}</span>
                        )}
                        {lead.website && (
                          <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-[11px]" style={{ color: 'rgb(110,115,145)' }}>
                            {lead.website.replace(/^https?:\/\//, '').slice(0, 30)}
                          </a>
                        )}
                      </div>
                      {lead.pain_point && (
                        <div className="text-[11px] mt-1" style={{ color: 'rgb(140,145,175)' }}>{truncate(lead.pain_point, 100)}</div>
                      )}
                    </div>
                    <button
                      onClick={() => unReserve(lead.id)}
                      disabled={actionLoading === lead.id}
                      className="btn btn-ghost flex-shrink-0"
                      style={{ fontSize: '11px', padding: '5px 10px', color: '#818cf8', borderColor: 'rgba(129,140,248,0.3)' }}>
                      {actionLoading === lead.id ? <Loader2 size={12} className="animate-spin" /> : '↑ Move to active'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>

    {/* Contacted Modal */}
    {contactingLead && <TodayContactedModal lead={contactingLead}
      onClose={() => setContactingLead(null)}
      onSaved={(channel, note, days) => markContacted(contactingLead.id, channel, note, days)} />}
    </>
  )
}

/* ── Mini contacted modal for Today's Plan ──────────────── */
const TODAY_CHANNELS = [
  { id: 'telegram', label: 'Telegram', color: '#22d3ee' },
  { id: 'twitter',  label: 'Twitter',  color: '#38bdf8' },
  { id: 'linkedin', label: 'LinkedIn', color: '#60a5fa' },
  { id: 'email',    label: 'Email',    color: '#a78bfa' },
  { id: 'discord',  label: 'Discord',  color: '#818cf8' },
]

function TodayContactedModal({ lead, onClose, onSaved }: {
  lead: LeadWithContacts
  onClose: () => void
  onSaved: (channel: string, note: string, days: number) => void
}) {
  const [channel, setChannel] = useState('')
  const [note, setNote] = useState('')
  const [days, setDays] = useState('7')

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(4,4,10,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 440, background: 'linear-gradient(180deg,rgb(18,19,30),rgb(13,13,21))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 24, boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>Mark as Contacted</div>
            <div style={{ fontSize: 11, color: 'rgb(120,127,160)', marginTop: 2 }}>{lead.company_name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgb(120,127,160)', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgb(150,155,185)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Where? *</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {TODAY_CHANNELS.map(ch => (
            <button key={ch.id} onClick={() => setChannel(ch.id)}
              style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${channel === ch.id ? ch.color + '60' : 'rgba(255,255,255,0.08)'}`,
                background: channel === ch.id ? ch.color + '18' : 'rgba(255,255,255,0.03)',
                color: channel === ch.id ? ch.color : 'rgb(150,155,185)' }}>
              {ch.label}
            </button>
          ))}
        </div>

        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="What did you send? (optional)" rows={2}
          style={{ width: '100%', resize: 'none', padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.35)', color: 'white', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }} />

        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgb(150,155,185)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Follow-up in</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {['3','5','7','14'].map(d => (
            <button key={d} onClick={() => setDays(d)}
              style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${days === d ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.08)'}`,
                background: days === d ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.03)',
                color: days === d ? '#a78bfa' : 'rgb(150,155,185)' }}>{d}d
            </button>
          ))}
        </div>

        <button onClick={() => channel && onSaved(channel, note, parseInt(days))} disabled={!channel}
          style={{ width: '100%', padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: channel ? 'pointer' : 'not-allowed',
            background: channel ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${channel ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.06)'}`,
            color: channel ? '#34d399' : 'rgb(100,107,140)' }}>
          ✓ Log outreach &amp; set follow-up
        </button>
      </div>
    </div>
  )
}
