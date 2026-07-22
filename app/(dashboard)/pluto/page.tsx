'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Eye, RefreshCw, Send, CheckCircle2, Clock, Bell, Users, TrendingUp, Shield, Globe, Layers, Trash2,
} from 'lucide-react'
import { cn, getStatusColor, getStatusLabel, formatDate } from '@/lib/utils'
import type { Lead } from '@/lib/types'
import { WEB3_AGENTS } from '@/lib/web3-agent-companies'
import { WEB2_COMPANIES } from '@/lib/web2-agent-companies'

const CONTACTED_STATUSES = new Set(['contacted', 'replied', 'meeting_booked', 'proposal_sent', 'negotiating', 'integration', 'won'])
const CLOSED_STATUSES = new Set(['rejected', 'archived'])

const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
const WEB3_NAMES = new Set(WEB3_AGENTS.map(a => norm(a.company)))
const WEB2_NAMES = new Set(WEB2_COMPANIES.map(c => norm(c.co)))

type Tab = 'all' | 'to_reach_out' | 'awaiting_reply' | 'overdue'
type Group = 'web3' | 'web2' | 'other'

function groupOf(companyName: string): Group {
  const n = norm(companyName)
  if (WEB3_NAMES.has(n)) return 'web3'
  if (WEB2_NAMES.has(n)) return 'web2'
  return 'other'
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ size?: number; color?: string }>; label: string; value: number; color: string
}) {
  return (
    <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}18`, border: `1px solid ${color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 19, fontWeight: 700, color: 'white', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'rgb(140,140,160)', marginTop: 3 }}>{label}</div>
      </div>
    </div>
  )
}

function LeadGroupTable({ title, icon: Icon, color, leads, now, onDelete }: {
  title: string
  icon: React.ComponentType<{ size?: number; color?: string }>
  color: string
  leads: Lead[]
  now: number
  onDelete: (id: string) => void
}) {
  if (leads.length === 0) return null
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} color={color} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{title}</span>
        <span className="badge text-xs" style={{ background: `${color}15`, color, borderColor: `${color}35`, fontSize: '10px', padding: '1px 6px' }}>
          {leads.length}
        </span>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(22,22,34,0.8)' }}>
        <div className="overflow-x-auto">
          <table className="w-full data-table" style={{ marginBottom: 0 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.015)' }}>
                <th className="text-left">Company</th>
                <th className="text-left">Status</th>
                <th className="text-left">Last Channel</th>
                <th className="text-left">Next Follow-up</th>
                <th className="text-left">Assigned</th>
                <th className="text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => {
                const overdue = !!lead.next_follow_up_at && new Date(lead.next_follow_up_at).getTime() <= now
                return (
                  <tr key={lead.id}>
                    <td>
                      <Link href={`/leads/${lead.id}`} className="text-sm font-medium text-white hover:text-violet-300 transition-colors">
                        {lead.company_name}
                      </Link>
                    </td>
                    <td><span className={cn('badge', getStatusColor(lead.status))}>{getStatusLabel(lead.status)}</span></td>
                    <td><span className="text-xs" style={{ color: 'rgb(140,140,160)' }}>{lead.last_channel || '—'}</span></td>
                    <td>
                      {lead.next_follow_up_at ? (
                        <span className="text-xs" style={{ color: overdue ? '#f87171' : 'rgb(140,140,160)', fontWeight: overdue ? 700 : 400 }}>
                          {overdue && <Clock size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />}
                          {formatDate(lead.next_follow_up_at)}
                        </span>
                      ) : <span className="text-xs" style={{ color: 'rgb(90,95,120)' }}>—</span>}
                    </td>
                    <td><span className="text-xs" style={{ color: 'rgb(100,100,120)' }}>{formatDate(lead.created_at)}</span></td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Link href={`/leads/${lead.id}`} className="btn btn-ghost p-1.5" title="Open — Discuss Lead &amp; Mark Contacted" style={{ padding: 5 }}>
                          <Eye size={13} />
                        </Link>
                        {CONTACTED_STATUSES.has(lead.status) && (
                          <CheckCircle2 size={13} style={{ color: '#34d399' }} />
                        )}
                        <button
                          onClick={() => onDelete(lead.id)}
                          className="btn btn-ghost p-1.5"
                          title="Delete lead"
                          style={{ padding: 5, color: '#f87171' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function PlutoPage() {
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')

  const loadLeads = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('assigned_to', 'pluto')
      .order('next_follow_up_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
    setLeads((data || []) as Lead[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadLeads() }, [loadLeads])

  const deleteLead = useCallback(async (id: string) => {
    const lead = leads.find(l => l.id === id)
    if (!confirm(`Delete ${lead?.company_name ?? 'this lead'}? This cannot be undone.`)) return
    await supabase.from('leads').delete().eq('id', id)
    setLeads(prev => prev.filter(l => l.id !== id))
    toast(`${lead?.company_name ?? 'Lead'} deleted`)
  }, [leads, supabase])

  const now = Date.now()
  const stats = useMemo(() => {
    const active = leads.filter(l => !CLOSED_STATUSES.has(l.status))
    const reachedOut = active.filter(l => CONTACTED_STATUSES.has(l.status))
    const replied = active.filter(l => ['replied', 'meeting_booked', 'proposal_sent', 'negotiating', 'integration', 'won'].includes(l.status))
    const overdue = active.filter(l => l.next_follow_up_at && new Date(l.next_follow_up_at).getTime() <= now)
    return {
      assigned: active.length,
      toReachOut: active.length - reachedOut.length,
      reachedOut: reachedOut.length,
      replied: replied.length,
      overdue: overdue.length,
    }
  }, [leads, now])

  const filtered = useMemo(() => {
    const active = leads.filter(l => !CLOSED_STATUSES.has(l.status))
    switch (tab) {
      case 'to_reach_out':
        return active.filter(l => !CONTACTED_STATUSES.has(l.status))
      case 'awaiting_reply':
        return active.filter(l => l.status === 'contacted')
      case 'overdue':
        return active.filter(l => l.next_follow_up_at && new Date(l.next_follow_up_at).getTime() <= now)
      default:
        return active
    }
  }, [leads, tab, now])

  const groups = useMemo(() => {
    const web3: Lead[] = [], web2: Lead[] = [], other: Lead[] = []
    for (const l of filtered) {
      const g = groupOf(l.company_name)
      if (g === 'web3') web3.push(l)
      else if (g === 'web2') web2.push(l)
      else other.push(l)
    }
    return { web3, web2, other }
  }, [filtered])

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Users size={18} style={{ color: '#fbbf24' }} />
              Pluto&apos;s Section
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>
              {loading ? 'Loading…' : `${stats.assigned} lead${stats.assigned !== 1 ? 's' : ''} assigned`} · reachout, follow-up &amp; discuss-lead only — assign leads to Pluto from the Lead Inbox
            </p>
          </div>
          <button onClick={loadLeads} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Stats — lets you check how efficiently Pluto is working */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <StatCard icon={Users} label="Assigned to Pluto" value={stats.assigned} color="#fbbf24" />
          <StatCard icon={Send} label="Reached Out" value={stats.reachedOut} color="#22d3ee" />
          <StatCard icon={TrendingUp} label="Replied" value={stats.replied} color="#34d399" />
          <StatCard icon={Bell} label="Follow-ups Overdue" value={stats.overdue} color="#f87171" />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {([
            ['all', 'All'],
            ['to_reach_out', 'To Reach Out'],
            ['awaiting_reply', 'Awaiting Reply'],
            ['overdue', 'Follow-up Overdue'],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={tab === id ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pb-6">
        {filtered.length === 0 ? (
          <div className="rounded-xl p-10 text-center" style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-sm" style={{ color: 'rgb(140,140,160)' }}>
              {leads.length === 0 ? 'No leads assigned to Pluto yet.' : 'Nothing in this view.'}
            </div>
          </div>
        ) : (
          <>
            <LeadGroupTable title="Web3 AI Agent Companies" icon={Shield} color="#a78bfa" leads={groups.web3} now={now} onDelete={deleteLead} />
            <LeadGroupTable title="Web2 AI Agent Companies" icon={Globe} color="#38bdf8" leads={groups.web2} now={now} onDelete={deleteLead} />
            <LeadGroupTable title="Other Assigned Leads" icon={Layers} color="#fbbf24" leads={groups.other} now={now} onDelete={deleteLead} />
          </>
        )}
      </div>
    </div>
  )
}
