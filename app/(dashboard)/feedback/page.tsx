'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate } from '@/lib/utils'
import { Brain, Loader2 } from 'lucide-react'
import type { FeedbackMemory } from '@/lib/types'

const ACTION_COLORS: Record<string, string> = {
  approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejected: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  contacted: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  replied: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  meeting_booked: 'bg-green-500/15 text-green-300 border-green-500/30',
  deal_closed: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  edited: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  needs_more_research: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
}

const OUTCOME_COLORS: Record<string, string> = {
  replied: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  meeting_booked: 'bg-green-500/15 text-green-300 border-green-500/30',
  deal_in_progress: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  deal_closed: 'bg-violet-500/15 text-violet-200 border-violet-500/40',
  no_response: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  rejected_by_prospect: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  not_yet_sent: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

export default function FeedbackPage() {
  const supabase = createClient()
  const [feedback, setFeedback] = useState<(FeedbackMemory & { lead?: { company_name: string; customer_category?: string[]; product_to_sell?: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const loadFeedback = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('feedback_memory')
      .select('*, lead:leads(company_name, customer_category, product_to_sell)')
      .order('created_at', { ascending: false })
      .limit(200)
    setFeedback(data || [])
    setLoading(false)
  }

  useEffect(() => { loadFeedback() }, [])

  const filtered = feedback.filter(f => !filter || f.action_taken === filter)

  const stats = {
    total: feedback.length,
    approved: feedback.filter(f => f.action_taken === 'approved').length,
    rejected: feedback.filter(f => f.action_taken === 'rejected').length,
    replied: feedback.filter(f => f.outcome === 'replied').length,
    meetings: feedback.filter(f => f.outcome === 'meeting_booked').length,
    deals: feedback.filter(f => f.outcome === 'deal_closed').length,
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold text-white">Feedback Memory</h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>
              Every action you take trains the agent. {feedback.length} feedback entries stored.
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 mt-3 flex-wrap">
          {[
            { label: 'Total', value: stats.total, color: 'rgb(160,160,180)' },
            { label: 'Approved', value: stats.approved, color: '#34d399' },
            { label: 'Rejected', value: stats.rejected, color: '#f87171' },
            { label: 'Replied', value: stats.replied, color: '#22d3ee' },
            { label: 'Meetings', value: stats.meetings, color: '#a78bfa' },
            { label: 'Deals', value: stats.deals, color: '#fbbf24' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-sm font-bold" style={{ color }}>{value}</span>
              <span className="text-xs" style={{ color: 'rgb(120,120,140)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-8 space-y-6">
        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilter('')}
            className={cn('badge cursor-pointer', !filter ? 'bg-violet-500/20 text-violet-200 border-violet-500/40' : 'bg-white/5 text-zinc-400 border-white/10')}
            style={{ padding: '5px 10px', fontSize: '12px' }}>
            All
          </button>
          {['approved', 'rejected', 'contacted', 'replied', 'meeting_booked', 'deal_closed'].map(action => (
            <button key={action} onClick={() => setFilter(action === filter ? '' : action)}
              className={cn('badge cursor-pointer', filter === action ? ACTION_COLORS[action] : 'bg-white/5 text-zinc-400 border-white/10')}
              style={{ padding: '5px 10px', fontSize: '12px' }}>
              {action.replace('_', ' ')}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#a78bfa' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Brain size={40} className="mx-auto mb-3 opacity-20" style={{ color: '#a78bfa' }} />
            <p className="text-sm font-medium text-white mb-1">No feedback yet</p>
            <p className="text-xs" style={{ color: 'rgb(100,100,120)' }}>
              Start approving, rejecting, and logging outcomes on leads. The agent learns from every action.
            </p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th className="text-left">Company</th>
                    <th className="text-left">Action</th>
                    <th className="text-left">Lead Quality</th>
                    <th className="text-left">Pain Accuracy</th>
                    <th className="text-left">Outcome</th>
                    <th className="text-left">Rejection Reason</th>
                    <th className="text-left">Notes</th>
                    <th className="text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(f => (
                    <tr key={f.id}>
                      <td>
                        <div className="text-sm font-medium text-white">{f.lead?.company_name || '—'}</div>
                        {f.lead?.product_to_sell && (
                          <div className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>{f.lead.product_to_sell}</div>
                        )}
                      </td>
                      <td>
                        {f.action_taken && (
                          <span className={cn('badge', ACTION_COLORS[f.action_taken] || 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30')} style={{ fontSize: '10px' }}>
                            {f.action_taken.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="text-xs" style={{ color: 'rgb(160,160,180)' }}>
                          {f.lead_quality || '—'}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs" style={{ color: 'rgb(160,160,180)' }}>
                          {f.pain_point_accuracy?.replace('_', ' ') || '—'}
                        </span>
                      </td>
                      <td>
                        {f.outcome ? (
                          <span className={cn('badge', OUTCOME_COLORS[f.outcome] || 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30')} style={{ fontSize: '10px' }}>
                            {f.outcome.replace('_', ' ')}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <span className="text-xs" style={{ color: 'rgb(160,160,180)' }}>
                          {f.rejection_reason || '—'}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs" style={{ color: 'rgb(140,140,160)', maxWidth: '180px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.arpit_notes || '—'}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs" style={{ color: 'rgb(100,100,120)' }}>
                          {formatDate(f.created_at)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
