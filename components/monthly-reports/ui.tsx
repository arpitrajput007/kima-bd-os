'use client'

import { useState } from 'react'
import { ArrowUpRight, Pencil, Check, X, RotateCcw } from 'lucide-react'

// ── Shared visual primitives for the Monthly Reports feature ────
// Mirrors the KpiCard / MiniBar / section-card-header pattern used
// across the app's flagship dashboards (see my-performance/page.tsx)
// so this feature reads at the same polish level as the rest of the app.

export function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0
  return (
    <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: 3,
        width: `${pct}%`,
        background: color,
        transition: 'width 0.8s cubic-bezier(.16,1,.3,1)',
      }} />
    </div>
  )
}

export function KpiCard({
  label, value, sub, color, icon: Icon, loading,
  editable, isOverridden, onEditSave, onResetOverride,
}: {
  label: string
  value: string | number
  sub?: string
  color: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  loading?: boolean
  /** Show a pencil icon that opens an inline numeric editor. */
  editable?: boolean
  /** Whether the current value is a manual override (shows a reset control). */
  isOverridden?: boolean
  onEditSave?: (value: number) => void
  onResetOverride?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function startEdit() {
    setDraft(String(value))
    setEditing(true)
  }
  function save() {
    const n = Number(draft)
    if (Number.isFinite(n)) onEditSave?.(n)
    setEditing(false)
  }

  return (
    <div className="stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color, opacity: 0.5, borderRadius: '14px 14px 0 0' }} />
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: color + '15', border: `1px solid ${color}22` }}>
          <Icon size={16} style={{ color }} />
        </div>
        {editable && !editing ? (
          <button onClick={startEdit} title="Edit value" className="flex items-center justify-center"
            style={{ width: 20, height: 20, borderRadius: 6, color, opacity: 0.5 }}>
            <Pencil size={12} />
          </button>
        ) : !editing ? (
          <ArrowUpRight size={13} style={{ color, opacity: 0.4 }} />
        ) : null}
      </div>

      {editing ? (
        <div className="flex items-center gap-1.5 mb-1">
          <input
            autoFocus
            type="number"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            className="input-dark"
            style={{ padding: '4px 8px', fontSize: 16, height: 30, width: '100%' }}
          />
          <button onClick={save} title="Save" style={{ color: '#4ade80', flexShrink: 0 }}><Check size={14} /></button>
          <button onClick={() => setEditing(false)} title="Cancel" style={{ color: '#f87171', flexShrink: 0 }}><X size={14} /></button>
        </div>
      ) : (
        <div className="text-[26px] font-bold tabular-nums leading-none text-white mb-1" style={loading ? { opacity: 0.18 } : {}}>
          {loading ? '—' : value}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <div className="text-[11px] font-medium" style={{ color: 'rgb(100,106,135)' }}>{label}</div>
        {isOverridden && !editing && (
          <button onClick={onResetOverride} title="Reset to calculated value"
            style={{ color: 'rgb(100,106,135)', opacity: 0.7, flexShrink: 0 }}>
            <RotateCcw size={10} />
          </button>
        )}
      </div>
      {sub && <div className="text-[10px] font-semibold mt-1" style={{ color }}>{sub}</div>}
    </div>
  )
}

/** Small inline pencil-to-edit number used in list rows (e.g. category/channel breakdowns). */
export function InlineEditableNumber({
  value, color, isOverridden, onSave, onReset,
}: {
  value: number
  color: string
  isOverridden?: boolean
  onSave: (value: number) => void
  onReset?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function startEdit() {
    setDraft(String(value))
    setEditing(true)
  }
  function save() {
    const n = Number(draft)
    if (Number.isFinite(n)) onSave(n)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          className="input-dark"
          style={{ padding: '2px 6px', fontSize: 13, height: 24, width: 64 }}
        />
        <button onClick={save} title="Save" style={{ color: '#4ade80', flexShrink: 0 }}><Check size={12} /></button>
        <button onClick={() => setEditing(false)} title="Cancel" style={{ color: '#f87171', flexShrink: 0 }}><X size={12} /></button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[14px] font-bold tabular-nums text-white">{value}</span>
      <button onClick={startEdit} title="Edit value" className="flex items-center justify-center" style={{ color, opacity: 0.5 }}>
        <Pencil size={11} />
      </button>
      {isOverridden && onReset && (
        <button onClick={onReset} title="Reset to calculated value" style={{ color: 'rgb(100,106,135)', opacity: 0.7 }}>
          <RotateCcw size={10} />
        </button>
      )}
    </div>
  )
}

export function SectionHeader({
  icon: Icon, iconColor, title, subtitle, right,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  iconColor: string
  title: string
  subtitle?: string
  right?: React.ReactNode
}) {
  return (
    <div className="section-card-header">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconColor + '18' }}>
          <Icon size={14} style={{ color: iconColor }} />
        </div>
        <div>
          <div className="text-[13px] font-semibold text-white">{title}</div>
          {subtitle && <div className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>{subtitle}</div>}
        </div>
      </div>
      {right}
    </div>
  )
}
