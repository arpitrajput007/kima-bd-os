'use client'

import { useEffect, useState, useCallback } from 'react'
import { readTimeData, TIME_STORAGE_KEY } from '@/components/TimeTracker'
import type { DayData } from '@/components/TimeTracker'
import { Clock, BarChart2, Calendar, Flame, RotateCcw, TrendingUp } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

// ── Helpers ────────────────────────────────────────────────────

function fmt(seconds: number, short = false): string {
  if (seconds < 60) return short ? `${seconds}s` : `${seconds} sec`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function fmtHours(seconds: number): number {
  return Math.round((seconds / 3600) * 10) / 10
}

const PAGE_LABELS: Record<string, string> = {
  '/dashboard':             'BD Command Center',
  '/leads':                 'Lead Inbox',
  '/crm':                   'CRM',
  '/copilot':               'AI Co-Pilot',
  '/aergap-copilot':        'Aergap Co-Pilot',
  '/aergap-web2-copilot':   'Web2 Co-Pilot',
  '/today':                 "Today's Plan",
  '/reports':               'Weekly Learning',
  '/export-reports':        'Export Reports',
  '/time-tracker':          'Time Tracker',
  '/my-performance':        'My Performance',
  '/outreach':              'Outreach Studio',
  '/sources':               'Discovery Sources',
  '/feedback':              'Feedback Memory',
  '/agent-rules':           'Agent Rules',
  '/content':               'Content Studio',
  '/learn':                 'Make Agent Learn',
  '/voice':                 'Voice Chat',
  '/aeredium':              'Aeredium Targets',
  '/agentic-payments':      'Agentic Payments',
  '/money-touching-agents': 'Money Touching Agents',
  '/web2-agent-companies':  'Web2 Agent Companies',
  '/reachout-storage':      'Reachout Storage',
  '/settings':              'Settings',
}

function pageLabel(path: string): string {
  return PAGE_LABELS[path] || path.replace('/', '').replace(/-/g, ' ')
}

function dateLabel(key: string): string {
  const d = new Date(key + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function last7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })
}

function startOfWeekISO(): string {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().slice(0, 10)
}

function startOfMonthISO(): string {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

// ── Component ──────────────────────────────────────────────────

export default function TimeTrackerPage() {
  const [data, setData] = useState<Record<string, DayData>>({})

  const refresh = useCallback(() => setData(readTimeData()), [])

  useEffect(() => {
    refresh()
    window.addEventListener(TIME_STORAGE_KEY.replace('kima_', 'kima_time_'), refresh)
    window.addEventListener('kima_time_update', refresh)
    return () => {
      window.removeEventListener('kima_time_update', refresh)
    }
  }, [refresh])

  const today = isoToday()
  const weekStart = startOfWeekISO()
  const monthStart = startOfMonthISO()

  const todayData = data[today] || { total: 0, byPage: {} }

  const weekTotal = Object.entries(data)
    .filter(([k]) => k >= weekStart)
    .reduce((s, [, v]) => s + v.total, 0)

  const monthTotal = Object.entries(data)
    .filter(([k]) => k >= monthStart)
    .reduce((s, [, v]) => s + v.total, 0)

  const allTime = Object.values(data).reduce((s, v) => s + v.total, 0)

  // Last 7 days chart data
  const chartDays = last7Days()
  const chartData = chartDays.map(d => ({
    day: new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
    hours: fmtHours(data[d]?.total || 0),
    isToday: d === today,
  }))

  // All-time page breakdown
  const allPageSecs: Record<string, number> = {}
  Object.values(data).forEach(day => {
    Object.entries(day.byPage).forEach(([page, secs]) => {
      allPageSecs[page] = (allPageSecs[page] || 0) + secs
    })
  })
  const sortedPages = Object.entries(allPageSecs).sort((a, b) => b[1] - a[1])
  const maxPageSecs = sortedPages[0]?.[1] || 1

  // Day history (most recent first)
  const dayHistory = Object.entries(data)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 14)

  // Streak — consecutive days with >0 time
  let streak = 0
  const check = new Date()
  while (true) {
    const key = check.toISOString().slice(0, 10)
    if (data[key]?.total > 0) { streak++; check.setDate(check.getDate() - 1) }
    else break
  }

  return (
    <div className="fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Time Tracker</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>
            How much time you spend on Kima BD OS — tracked live while the tab is active.
          </p>
        </div>
        <button
          onClick={refresh}
          className="btn btn-ghost"
          style={{ fontSize: '12px', gap: '6px' }}
        >
          <RotateCcw size={12} />Refresh
        </button>
      </div>

      <div className="p-8 space-y-6">

        {/* ── Top stat cards ─────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Today', value: fmt(todayData.total), icon: Clock, color: '#a78bfa', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.18)' },
            { label: 'This Week', value: fmt(weekTotal), icon: Calendar, color: '#67e8f9', bg: 'rgba(6,182,212,0.07)', border: 'rgba(6,182,212,0.15)' },
            { label: 'This Month', value: fmt(monthTotal), icon: BarChart2, color: '#34d399', bg: 'rgba(52,211,153,0.07)', border: 'rgba(52,211,153,0.15)' },
            { label: 'Day Streak', value: `${streak}d`, icon: Flame, color: '#fbbf24', bg: 'rgba(251,191,36,0.07)', border: 'rgba(251,191,36,0.15)' },
          ].map(({ label, value, icon: Icon, color, bg, border }) => (
            <div key={label} className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${border}` }}>
              <div className="flex items-center gap-2 mb-3">
                <Icon size={13} style={{ color }} />
                <span className="text-xs font-medium" style={{ color: 'rgb(110,110,140)' }}>{label}</span>
              </div>
              <div className="text-2xl font-bold" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* ── All-time total ──────────────────────────────── */}
        <div
          className="rounded-xl p-5 flex items-center gap-4"
          style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <TrendingUp size={18} style={{ color: '#a78bfa', flexShrink: 0 }} />
          <div>
            <div className="text-xs font-medium mb-0.5" style={{ color: 'rgb(110,110,140)' }}>All-time total on Kima BD OS</div>
            <div className="text-lg font-bold text-white">{fmt(allTime)}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs" style={{ color: 'rgb(80,80,100)' }}>Average per day</div>
            <div className="text-sm font-semibold" style={{ color: 'rgb(160,160,190)' }}>
              {Object.keys(data).length > 0 ? fmt(Math.round(allTime / Object.keys(data).length)) : '—'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ── Last 7 days chart ───────────────────────── */}
          <div className="rounded-xl p-5" style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-xs font-semibold mb-4" style={{ color: 'rgb(140,140,170)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Last 7 Days (hours)
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} barSize={28}>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'rgb(90,90,110)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'rgb(90,90,110)' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ background: 'rgb(20,20,30)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12, color: '#fff' }}
                  formatter={(v: unknown) => [`${v}h`, 'Time']}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.isToday ? '#a78bfa' : 'rgba(139,92,246,0.35)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Today's breakdown ──────────────────────── */}
          <div className="rounded-xl p-5" style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-xs font-semibold mb-4" style={{ color: 'rgb(140,140,170)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Today by Section
            </div>
            {Object.keys(todayData.byPage).length === 0 ? (
              <div className="flex items-center justify-center h-32" style={{ color: 'rgb(80,80,100)', fontSize: 13 }}>
                No activity recorded today yet
              </div>
            ) : (
              <div className="space-y-2.5 overflow-y-auto" style={{ maxHeight: 180 }}>
                {Object.entries(todayData.byPage)
                  .sort((a, b) => b[1] - a[1])
                  .map(([page, secs]) => (
                    <div key={page}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs" style={{ color: 'rgb(160,160,190)' }}>{pageLabel(page)}</span>
                        <span className="text-xs font-semibold" style={{ color: '#a78bfa' }}>{fmt(secs)}</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 2,
                          width: `${Math.round((secs / todayData.total) * 100)}%`,
                          background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                        }} />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* ── All-time section breakdown ─────────────────── */}
        <div className="rounded-xl p-5" style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-xs font-semibold mb-4" style={{ color: 'rgb(140,140,170)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            All-time by Section
          </div>
          {sortedPages.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'rgb(80,80,100)' }}>No data yet — start using the app and check back.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3">
              {sortedPages.map(([page, secs]) => (
                <div key={page}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: 'rgb(160,160,190)' }}>{pageLabel(page)}</span>
                    <span className="text-xs font-semibold" style={{ color: 'rgb(200,200,220)' }}>{fmt(secs)}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      width: `${Math.round((secs / maxPageSecs) * 100)}%`,
                      background: 'rgba(139,92,246,0.6)',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Day history ────────────────────────────────── */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-xs font-semibold" style={{ color: 'rgb(140,140,170)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Daily History (last 14 days)
            </span>
          </div>
          {dayHistory.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'rgb(80,80,100)' }}>No history yet.</p>
          ) : (
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 20px', fontSize: 11, color: 'rgb(90,90,110)', fontWeight: 600 }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '10px 20px', fontSize: 11, color: 'rgb(90,90,110)', fontWeight: 600 }}>Total Time</th>
                  <th style={{ textAlign: 'left', padding: '10px 20px', fontSize: 11, color: 'rgb(90,90,110)', fontWeight: 600 }}>Top Section</th>
                </tr>
              </thead>
              <tbody>
                {dayHistory.map(([dateKey, dayData]) => {
                  const topPage = Object.entries(dayData.byPage).sort((a,b) => b[1]-a[1])[0]
                  const isToday = dateKey === today
                  return (
                    <tr key={dateKey} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 20px', fontSize: 12, color: isToday ? '#a78bfa' : 'rgb(200,200,220)', fontWeight: isToday ? 600 : 400 }}>
                        {isToday ? 'Today' : dateLabel(dateKey)}
                      </td>
                      <td style={{ padding: '10px 20px', fontSize: 12, color: 'rgb(200,200,220)', fontWeight: 600 }}>
                        {fmt(dayData.total)}
                      </td>
                      <td style={{ padding: '10px 20px', fontSize: 12, color: 'rgb(130,130,160)' }}>
                        {topPage ? `${pageLabel(topPage[0])} (${fmt(topPage[1])})` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}
