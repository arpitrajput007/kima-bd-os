'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2, Clock } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { SectionHeader, AiFixButton } from './ui'
import type { TimeAllocation } from '@/lib/monthly-reports-types'

export const TIME_PIE_COLORS = [
  '#a78bfa', '#22d3ee', '#34d399', '#fbbf24', '#f472b6',
  '#60a5fa', '#fb923c', '#f87171', '#4ade80', '#c084fc',
]

export function timeByResponsibility(entries: TimeAllocation[]) {
  const map = new Map<string, number>()
  entries.forEach(e => map.set(e.responsibility, (map.get(e.responsibility) || 0) + Number(e.percentage || 0)))
  return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

export function TimeAllocationSection({
  entries, onAdd, onDelete, saving, setupNeeded,
}: {
  entries: TimeAllocation[]
  onAdd: (responsibility: string, percentage: number) => void | Promise<void>
  onDelete: (id: string) => void
  saving?: boolean
  setupNeeded?: boolean
}) {
  const [responsibility, setResponsibility] = useState('')
  const [percentage, setPercentage] = useState('')

  const byResponsibility = useMemo(() => timeByResponsibility(entries), [entries])
  const totalPct = byResponsibility.reduce((a, b) => a + b.value, 0)

  async function submit() {
    if (!responsibility.trim() || !percentage || Number(percentage) <= 0) return
    await onAdd(responsibility.trim(), Number(percentage))
    setResponsibility(''); setPercentage('')
  }

  return (
    <div className="section-card">
      <SectionHeader
        icon={Clock} iconColor="#f472b6"
        title="Time Allocation"
        subtitle="Where your time went this month — by responsibility, as a % of your time"
        right={<span className="text-[15px] font-bold tabular-nums" style={{ color: totalPct > 100 ? '#f87171' : '#fff' }}>{totalPct}%</span>}
      />
      <div style={{ padding: '18px 22px 20px' }}>
        {setupNeeded && (
          <div className="mb-4 p-3.5 rounded-xl text-[11px]" style={{ color: 'rgb(180,170,120)', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
            Run <code className="px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.07)' }}>supabase/add-time-tracking-and-overrides.sql</code> in your Supabase SQL editor to enable time tracking.
          </div>
        )}

        <div className="flex gap-2 flex-wrap items-center mb-5">
          <input
            value={responsibility}
            onChange={e => setResponsibility(e.target.value)}
            placeholder="Responsibility / task"
            className="input-dark"
            style={{ flex: '2 1 220px' }}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
          />
          <AiFixButton value={responsibility} onFixed={setResponsibility} />
          <input
            value={percentage}
            onChange={e => setPercentage(e.target.value)}
            type="number" min={0} max={100} step={5}
            placeholder="% of time"
            className="input-dark"
            style={{ width: 100 }}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
          />
          <button onClick={submit} disabled={saving} className="btn btn-ai" style={{ fontSize: '12px', gap: 6 }}>
            <Plus size={13} />Add
          </button>
        </div>

        {entries.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: 'rgb(90,90,110)' }}>
            No time logged yet — add the responsibilities you&apos;re spending time on this month.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={byResponsibility} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {byResponsibility.map((entry, i) => <Cell key={entry.name} fill={TIME_PIE_COLORS[i % TIME_PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'rgb(20,22,33)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 9, fontSize: 12, color: 'rgb(160,165,195)' }}
                    formatter={(v, n) => [`${v}%`, n]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-1">
                {byResponsibility.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-1.5">
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: TIME_PIE_COLORS[i % TIME_PIE_COLORS.length] }} />
                    <span className="text-[10px]" style={{ color: 'rgb(100,106,135)' }}>
                      {c.name} · {c.value}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2" style={{ maxHeight: 260, overflowY: 'auto' }}>
              {entries.map(e => (
                <div key={e.id} className="flex items-start justify-between gap-3 p-3 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white">{e.responsibility}</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs font-bold tabular-nums" style={{ color: '#f472b6' }}>{e.percentage}%</span>
                    <button onClick={() => onDelete(e.id)} title="Delete entry" style={{ color: 'rgb(120,120,150)' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
