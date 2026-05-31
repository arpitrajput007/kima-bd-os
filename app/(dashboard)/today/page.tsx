'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Sun, Target, Flame, ArrowRight, MessageSquare, Mail, Link2,
  AtSign, CheckCircle, Eye, Loader2, RefreshCw, Clock, CalendarCheck,
  Sparkles, Zap, TrendingUp, Wand2, Copy, ExternalLink, Download,
} from 'lucide-react'
import { cn, getScoreBg, truncate } from '@/lib/utils'
import type { Lead, Contact } from '@/lib/types'
import {
  buildTarget, channelDeepLink, logTouch, followUpDue,
  MAX_FOLLOWUPS, FOLLOWUP_GAP_DAYS, type OutreachMeta,
} from '@/lib/outreach'

type LeadWithContacts = Lead & { contacts?: Contact[] }

// Statuses that mean "ready to reach out" — agent has researched, you haven't contacted yet
const READY_STATUSES = ['new', 'researching', 'qualified', 'approved', 'needs_more_research']
const DAILY_GOAL = 5

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
function PlanLeadCard({ lead, rank, actionLoading, onContacted }: {
  lead: LeadWithContacts; rank: number | null; actionLoading: string | null; onContacted: (id: string) => void
}) {
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
          <Link href={`/leads/${lead.id}`}
            className="btn btn-ghost justify-center" style={{ fontSize: '11px', padding: '5px 12px', color: 'rgb(130,135,165)' }}>
            <Eye size={12} /> View details
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function TodayPage() {
  const supabase = createClient()
  const [leads, setLeads] = useState<LeadWithContacts[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const [fetchProgress, setFetchProgress] = useState<string>('')

  // Run all active sources one-by-one and reload leads when done.
  const fetchFreshLeads = async () => {
    setFetching(true)
    setFetchProgress('Loading sources…')
    try {
      const { data: sources } = await supabase
        .from('sources')
        .select('id, source_name')
        .eq('status', 'active')
        .order('created_at', { ascending: true })
      if (!sources || sources.length === 0) {
        toast.error('No active sources found — add some in Discovery Sources')
        setFetching(false); setFetchProgress(''); return
      }
      let totalSaved = 0
      for (let i = 0; i < sources.length; i++) {
        const src = sources[i]
        setFetchProgress(`Running ${src.source_name} (${i + 1}/${sources.length})…`)
        try {
          const res = await fetch('/api/ai/discover', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_id: src.id }),
          })
          const data = await res.json()
          if (data.saved) totalSaved += data.saved
        } catch { /* one source failing shouldn't stop the rest */ }
      }
      setFetchProgress('')
      toast.success(totalSaved > 0 ? `Done! Found ${totalSaved} new leads` : 'Done — no new leads found (may already be at category cap)')
      loadData()
    } catch {
      toast.error('Fetch failed')
    } finally {
      setFetching(false); setFetchProgress('')
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('leads')
      .select('*, contacts(*)')
      .order('lead_score', { ascending: false, nullsFirst: false })
      .limit(300)
    if (error) toast.error('Failed to load leads')
    else setLeads((data as LeadWithContacts[]) || [])
    setLoading(false)
  }, []) // eslint-disable-line

  useEffect(() => { loadData() }, [loadData])

  const markContacted = async (id: string) => {
    setActionLoading(id)
    const now = new Date()
    const { error } = await supabase
      .from('leads')
      .update({
        status: 'contacted',
        contacted_at: now.toISOString(),
        last_contacted_at: now.toISOString(),
        follow_up_stage: 0,
        next_follow_up_at: new Date(now.getTime() + FOLLOWUP_GAP_DAYS * 86400000).toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', id)
    if (error) toast.error('Update failed')
    else { toast.success(`Marked contacted — follow-up scheduled in ${FOLLOWUP_GAP_DAYS} days`); loadData() }
    setActionLoading(null)
  }

  // ── Build today's plan ────────────────────────────────────────────────────
  const today = new Date(); today.setHours(0, 0, 0, 0)

  // All researched leads you haven't reached out to yet (sorted by score from the query).
  const readyLeads = leads.filter(l => READY_STATUSES.includes(l.status))
  // Top priorities to contact today.
  const todaysPicks = readyLeads.slice(0, DAILY_GOAL)
  // Everyone else still waiting — grouped by the day they came in, so nothing piles up invisibly.
  const backlog = readyLeads.slice(DAILY_GOAL)
  const backlogGroups: { key: string; label: string; leads: LeadWithContacts[] }[] = []
  {
    const map = new Map<string, LeadWithContacts[]>()
    backlog.forEach(l => {
      const k = dayKey(l.created_at)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(l)
    })
    Array.from(map.keys()).sort((a, b) => b.localeCompare(a)).forEach(k => {
      backlogGroups.push({ key: k, label: dayLabel(k), leads: map.get(k)! })
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={loadData} className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '12px' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button onClick={fetchFreshLeads} disabled={fetching}
            className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '12px', opacity: fetching ? 0.8 : 1 }}>
            {fetching
              ? <><Loader2 size={13} className="animate-spin" />{fetchProgress || 'Fetching…'}</>
              : <><Download size={13} /> Fetch fresh leads</>}
          </button>
        </div>
      </div>

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
                {goalHit
                  ? `Daily goal smashed — ${contactedToday} reached out today 🔥`
                  : `Reach out to ${DAILY_GOAL} leads today`}
              </div>
              <div className="text-[12px] mb-3" style={{ color: 'rgb(130,135,165)' }}>
                {goalHit
                  ? 'You hit your target. Anything more is a bonus.'
                  : `${contactedToday} of ${DAILY_GOAL} done · ${DAILY_GOAL - contactedToday} to go. The agent already did the research — you just hit send.`}
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

        {/* ── Reach out today ────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Flame size={14} style={{ color: '#fb7185' }} />
            <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'rgb(100,106,135)' }}>
              Reach out today · top {todaysPicks.length}
            </span>
          </div>

          {loading ? (
            <div className="section-card p-10 text-center text-[13px]" style={{ color: 'rgb(100,106,135)' }}>
              <Loader2 size={20} className="animate-spin mx-auto mb-3" style={{ color: '#a78bfa' }} />
              Building your plan…
            </div>
          ) : todaysPicks.length === 0 ? (
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
            <div className="flex flex-col gap-3">
              {todaysPicks.map((lead, i) => (
                <PlanLeadCard key={lead.id} lead={lead} rank={i + 1} actionLoading={actionLoading} onContacted={markContacted} />
              ))}
            </div>
          )}
        </div>

        {/* ── Backlog: still waiting, grouped by day ──────── */}
        {!loading && backlog.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CalendarCheck size={14} style={{ color: '#fbbf24' }} />
              <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'rgb(100,106,135)' }}>
                Still waiting · not reached out yet · {backlog.length}
              </span>
            </div>
            <p className="text-[12px] mb-4" style={{ color: 'rgb(100,106,135)' }}>
              Leads the agent found on earlier days that you haven&apos;t contacted. They keep stacking up here by date until you action them.
            </p>
            <div className="flex flex-col gap-7">
              {backlogGroups.map(group => (
                <div key={group.key}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-[12px] font-semibold text-white">{group.label}</span>
                    <span className="badge" style={{ fontSize: '10px', padding: '1px 7px', background: 'rgba(255,255,255,0.05)', color: 'rgb(150,155,185)', borderColor: 'rgba(255,255,255,0.08)' }}>
                      {group.leads.length} lead{group.leads.length > 1 ? 's' : ''}
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  </div>
                  <div className="flex flex-col gap-3">
                    {group.leads.map(lead => (
                      <PlanLeadCard key={lead.id} lead={lead} rank={null} actionLoading={actionLoading} onContacted={markContacted} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

      </div>
    </div>
  )
}
