'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Sparkles, Loader2, CheckCircle, Archive, ChevronDown, ChevronUp, TrendingUp, CheckSquare } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import type { LearningReport, AgentRule } from '@/lib/types'

export default function ReportsPage() {
  const supabase = createClient()
  const [reports, setReports] = useState<LearningReport[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [approvingRule, setApprovingRule] = useState<string | null>(null)

  const loadReports = async () => {
    const { data } = await supabase.from('learning_reports').select('*').order('created_at', { ascending: false })
    setReports(data || [])
    setLoading(false)
  }

  useEffect(() => { 
    loadReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const generateReport = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/weekly-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period: 'last_7_days' }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success('Weekly report generated')
      loadReports()
      setExpandedId(json.report_id)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate report'
      toast.error(msg)
    } finally {
      setGenerating(false)
    }
  }

  const approveReport = async (reportId: string) => {
    await supabase.from('learning_reports').update({ status: 'approved' }).eq('id', reportId)
    toast.success('Report approved')
    loadReports()
  }

  const archiveReport = async (reportId: string) => {
    await supabase.from('learning_reports').update({ status: 'archived' }).eq('id', reportId)
    loadReports()
  }

  const approveRuleSuggestion = async (report: LearningReport, rule: AgentRule & { reasoning: string }) => {
    setApprovingRule(rule.rule)
    const { error } = await supabase.from('agent_rules').insert({
      rule_type: rule.rule_type,
      rule: rule.rule,
      weight: rule.weight || 0,
      status: 'active',
    })
    if (error) toast.error('Failed to add rule')
    else toast.success('Rule approved and added to agent rules')
    setApprovingRule(null)
  }

  const STATUS_COLORS: Record<string, string> = {
    pending_review: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    archived: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  }

  return (
    <div className="fade-in page-container">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Weekly Learning Reports</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>
            AI-generated analysis of what&apos;s working and what&apos;s not. You approve rule changes before they go live.
          </p>
        </div>
        <button onClick={generateReport} disabled={generating} className="btn btn-ai" style={{ fontSize: '13px' }}>
          {generating ? <><Loader2 size={14} className="animate-spin" />Generating...</> : <><Sparkles size={14} />Generate Report</>}
        </button>
      </div>

      <div className="space-y-6 mt-6">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#a78bfa' }} /></div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16">
            <TrendingUp size={40} className="mx-auto mb-3 opacity-20" style={{ color: '#a78bfa' }} />
            <p className="text-sm font-medium text-white mb-1">No reports yet</p>
            <p className="text-xs mb-4" style={{ color: 'rgb(100,100,120)' }}>
              Generate your first weekly learning report. The AI will analyze all leads and feedback.
            </p>
            <button onClick={generateReport} disabled={generating} className="btn btn-ai" style={{ fontSize: '13px' }}>
              <Sparkles size={14} />Generate First Report
            </button>
          </div>
        ) : (
          reports.map(report => (
            <div key={report.id} className="rounded-xl overflow-hidden"
              style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {/* Report Header */}
              <div className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: expandedId === report.id ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <div className="flex items-center gap-3">
                  <button onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}>
                    {expandedId === report.id ? <ChevronUp size={16} style={{ color: 'rgb(140,140,160)' }} /> : <ChevronDown size={16} style={{ color: 'rgb(140,140,160)' }} />}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        {report.report_period?.replace('_', ' ') || 'Weekly Report'}
                      </span>
                      <span className={cn('badge', STATUS_COLORS[report.status] || STATUS_COLORS.pending_review)} style={{ fontSize: '10px' }}>
                        {report.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>{formatDate(report.created_at)}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {report.status === 'pending_review' && (
                    <button onClick={() => approveReport(report.id)} className="btn btn-success" style={{ fontSize: '12px', padding: '5px 10px' }}>
                      <CheckCircle size={12} />Approve Report
                    </button>
                  )}
                  <button onClick={() => archiveReport(report.id)} className="btn btn-ghost" style={{ fontSize: '12px', padding: '5px 8px', color: 'rgb(100,100,120)' }}>
                    <Archive size={12} />
                  </button>
                </div>
              </div>

              {expandedId === report.id && (
                <div className="p-5 space-y-6">
                  {/* Summary */}
                  {report.summary && (
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                      <div className="text-xs font-semibold mb-2" style={{ color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Executive Summary</div>
                      <p className="text-sm leading-relaxed" style={{ color: 'rgb(200,200,220)' }}>{report.summary}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Winning Patterns */}
                    {(report.winning_patterns as {pattern:string;evidence:string;recommendation:string}[] || []).length > 0 && (
                      <div>
                        <div className="text-xs font-semibold mb-3" style={{ color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          ✓ Winning Patterns
                        </div>
                        <div className="space-y-2">
                          {(report.winning_patterns as {pattern:string;recommendation:string}[]).map((p, i) => (
                            <div key={i} className="p-3 rounded-lg" style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.1)' }}>
                              <p className="text-xs font-medium mb-1" style={{ color: 'rgb(180,220,200)' }}>{p.pattern}</p>
                              {p.recommendation && <p className="text-xs" style={{ color: 'rgb(120,160,140)' }}>→ {p.recommendation}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rejected Patterns */}
                    {(report.rejected_patterns as {pattern:string;recommendation:string}[] || []).length > 0 && (
                      <div>
                        <div className="text-xs font-semibold mb-3" style={{ color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          ✗ Rejected Patterns
                        </div>
                        <div className="space-y-2">
                          {(report.rejected_patterns as {pattern:string;recommendation:string}[]).map((p, i) => (
                            <div key={i} className="p-3 rounded-lg" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.1)' }}>
                              <p className="text-xs font-medium mb-1" style={{ color: 'rgb(220,180,180)' }}>{p.pattern}</p>
                              {p.recommendation && <p className="text-xs" style={{ color: 'rgb(160,120,120)' }}>→ {p.recommendation}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Focus for next week */}
                  {report.scoring_changes_suggested && (report.scoring_changes_suggested as {change:string}[]).length > 0 && (
                    <div>
                      <div className="text-xs font-semibold mb-3" style={{ color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Scoring Changes Suggested
                      </div>
                      <div className="space-y-2">
                        {(report.scoring_changes_suggested as {change:string;reasoning:string;suggested_weight:number}[]).map((s, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.1)' }}>
                            <div className="flex-1">
                              <p className="text-xs font-medium" style={{ color: 'rgb(180,200,220)' }}>{s.change}</p>
                              {s.reasoning && <p className="text-xs mt-1" style={{ color: 'rgb(120,140,160)' }}>{s.reasoning}</p>}
                            </div>
                            {s.suggested_weight !== 0 && (
                              <span className={cn('badge flex-shrink-0', s.suggested_weight > 0 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border-rose-500/30')} style={{ fontSize: '10px' }}>
                                {s.suggested_weight > 0 ? '+' : ''}{s.suggested_weight}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested New Rules — requires approval */}
                  {report.new_rules_suggested && (report.new_rules_suggested as unknown as AgentRule[]).length > 0 && (
                    <div>
                      <div className="text-xs font-semibold mb-3" style={{ color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        ⚡ New Rules Suggested — Approve to Activate
                      </div>
                      <div className="space-y-2">
                        {(report.new_rules_suggested as unknown as (AgentRule & {reasoning:string})[]).map((rule, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.1)' }}>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="badge" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', borderColor: 'rgba(251,191,36,0.2)', fontSize: '9px' }}>
                                  {rule.rule_type}
                                </span>
                                {rule.weight !== 0 && (
                                  <span className={cn('badge', rule.weight > 0 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border-rose-500/30')} style={{ fontSize: '9px' }}>
                                    {rule.weight > 0 ? '+' : ''}{rule.weight}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs" style={{ color: 'rgb(200,190,160)' }}>{rule.rule}</p>
                              {rule.reasoning && <p className="text-xs mt-1" style={{ color: 'rgb(140,130,100)' }}>Reason: {rule.reasoning}</p>}
                            </div>
                            <button
                              onClick={() => approveRuleSuggestion(report, rule)}
                              disabled={approvingRule === rule.rule}
                              className="btn btn-success flex-shrink-0" style={{ fontSize: '11px', padding: '4px 8px' }}
                            >
                              {approvingRule === rule.rule ? <Loader2 size={10} className="animate-spin" /> : <CheckSquare size={10} />}
                              Approve
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
