'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Eye, EyeOff, Trash2, Plus, Settings2, RotateCcw,
  Building2, Tag, Target, DollarSign, TrendingUp, MessageSquare, AlertTriangle, FileText,
} from 'lucide-react'
import { DEAL_FORM_SECTIONS, DEAL_FORM_FIELDS, slugifyFieldKey } from '@/lib/deal-form-config'
import type { CustomFieldDef } from '@/lib/deal-form-config'

interface Props {
  onClose: () => void
  hiddenFields: Set<string>
  hiddenSections: Set<string>
  customFields: CustomFieldDef[]
  onHiddenFieldsChange: (keys: Set<string>) => void
  onHiddenSectionsChange: (keys: Set<string>) => void
  onCustomFieldsChange: (defs: CustomFieldDef[]) => void
}

const SECTION_META: Record<string, { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; color: string }> = {
  company:        { icon: Building2,     color: '#67e8f9' },
  classification: { icon: Tag,           color: '#a78bfa' },
  opportunity:    { icon: Target,        color: '#fbbf24' },
  potential:      { icon: DollarSign,    color: '#4ade80' },
  impact:         { icon: TrendingUp,    color: '#60a5fa' },
  feedback:       { icon: MessageSquare, color: '#f472b6' },
  blockers:       { icon: AlertTriangle, color: '#f87171' },
  notes:          { icon: FileText,      color: '#9ca3af' },
}

export default function CustomizeFieldsModal({
  onClose, hiddenFields, hiddenSections, customFields,
  onHiddenFieldsChange, onHiddenSectionsChange, onCustomFieldsChange,
}: Props) {
  const [tab, setTab] = useState<'builtin' | 'custom'>('builtin')
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<'text' | 'textarea'>('text')

  const toggleSection = (key: string) => {
    const next = new Set(hiddenSections)
    if (next.has(key)) next.delete(key); else next.add(key)
    onHiddenSectionsChange(next)
  }

  const toggleField = (key: string) => {
    const next = new Set(hiddenFields)
    if (next.has(key)) next.delete(key); else next.add(key)
    onHiddenFieldsChange(next)
  }

  const addCustomField = () => {
    const label = newLabel.trim()
    if (!label) return
    const key = slugifyFieldKey(label)
    if (!key || customFields.some(f => f.key === key)) { setNewLabel(''); return }
    onCustomFieldsChange([...customFields, { key, label, type: newType }])
    setNewLabel('')
  }

  const removeCustomField = (key: string) => {
    onCustomFieldsChange(customFields.filter(f => f.key !== key))
  }

  const resetAll = () => {
    onHiddenFieldsChange(new Set())
    onHiddenSectionsChange(new Set())
  }

  const hiddenCount = hiddenFields.size + hiddenSections.size

  // Portalled to <body> — a `.fade-in` ancestor keeps a lingering `transform`
  // after its entrance animation (fill-mode: forwards), which would otherwise
  // become the containing block for this `position: fixed` overlay and center
  // it against the whole scrollable page instead of the viewport.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl flex flex-col fade-in"
        style={{ background: 'rgb(15,16,24)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, maxHeight: '85vh', boxShadow: '0 24px 64px rgba(0,0,0,0.45)' }}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.28)' }}>
              <Settings2 size={16} style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Customize Deal Fields</div>
              <div className="text-[11px] mt-0.5" style={{ color: 'rgb(100,106,135)' }}>
                Hide questions you don&apos;t use, or add your own — no code required.
              </div>
            </div>
          </div>
          <button
            type="button" onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
            style={{ color: 'rgb(140,140,170)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Tabs ────────────────────────────────────────── */}
        <div className="px-6 pt-4">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {([
              { key: 'builtin' as const, label: 'Visible Questions' },
              { key: 'custom' as const,  label: `Custom Questions (${customFields.length})` },
            ]).map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={tab === t.key
                  ? { background: 'rgba(167,139,250,0.16)', color: '#a78bfa' }
                  : { background: 'transparent', color: 'rgb(120,120,150)' }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────── */}
        <div className="overflow-y-auto px-6 py-5" style={{ flex: 1 }}>
          {tab === 'builtin' ? (
            <div className="space-y-3">
              {DEAL_FORM_SECTIONS.map(section => {
                const sectionHidden = hiddenSections.has(section.key)
                const fields = DEAL_FORM_FIELDS.filter(f => f.section === section.key)
                const meta = SECTION_META[section.key]
                const Icon = meta.icon
                return (
                  <div key={section.key} className="rounded-xl overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center justify-between px-3.5 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: meta.color + '18', opacity: sectionHidden ? 0.5 : 1 }}>
                          <Icon size={13} style={{ color: meta.color }} />
                        </div>
                        <span className="text-[13px] font-semibold truncate" style={{ color: sectionHidden ? 'rgb(100,106,135)' : 'white' }}>
                          {section.label}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleSection(section.key)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold flex-shrink-0 transition-all"
                        style={sectionHidden
                          ? { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgb(130,130,160)' }
                          : { background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }}
                      >
                        {sectionHidden ? <><EyeOff size={11} />Hidden</> : <><Eye size={11} />Visible</>}
                      </button>
                    </div>
                    {!sectionHidden && fields.length > 0 && (
                      <div className="px-3.5 pb-3.5 flex flex-wrap gap-1.5">
                        {fields.map(f => {
                          const fieldHidden = hiddenFields.has(f.key)
                          return (
                            <button
                              key={f.key}
                              type="button"
                              onClick={() => toggleField(f.key)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all"
                              style={fieldHidden
                                ? { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgb(85,90,115)', textDecoration: 'line-through' }
                                : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgb(200,200,225)' }}
                            >
                              {fieldHidden ? <EyeOff size={10} style={{ opacity: 0.6 }} /> : <Eye size={10} style={{ opacity: 0.6 }} />}
                              {f.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {section.key === 'blockers' && !sectionHidden && (
                      <div className="px-3.5 pb-3.5 text-[10px]" style={{ color: 'rgb(90,95,120)' }}>
                        Blockers are hidden/shown as a whole section — individual blocker types can&apos;t be toggled here.
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <input
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomField() } }}
                  placeholder="New question, e.g. 'Preferred settlement currency'"
                  className="input-dark flex-1"
                />
                <select value={newType} onChange={e => setNewType(e.target.value as 'text' | 'textarea')} className="input-dark" style={{ width: 130, flexShrink: 0 }}>
                  <option value="text">Short answer</option>
                  <option value="textarea">Long answer</option>
                </select>
                <button
                  type="button"
                  onClick={addCustomField}
                  disabled={!newLabel.trim()}
                  className="btn btn-ai flex-shrink-0"
                  style={{ fontSize: '12px', gap: 6 }}
                >
                  <Plus size={13} />Add
                </button>
              </div>

              {customFields.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare size={26} className="mx-auto mb-3 opacity-15" style={{ color: '#a78bfa' }} />
                  <p className="text-xs" style={{ color: 'rgb(100,106,135)' }}>
                    No custom questions yet. Anything you add here shows up in its own &quot;Custom Fields&quot; section on every deal.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {customFields.map(f => (
                    <div key={f.key} className="flex items-center justify-between rounded-xl px-3.5 py-2.5"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(167,139,250,0.12)' }}>
                          <MessageSquare size={12} style={{ color: '#a78bfa' }} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-white truncate">{f.label}</div>
                          <div className="text-[10px]" style={{ color: 'rgb(100,106,135)' }}>{f.type === 'textarea' ? 'Long answer' : 'Short answer'}</div>
                        </div>
                      </div>
                      <button type="button" onClick={() => removeCustomField(f.key)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                        style={{ color: 'rgb(140,140,170)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.1)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgb(140,140,170)'; e.currentTarget.style.background = 'transparent' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {hiddenCount > 0 ? (
            <button type="button" onClick={resetAll} className="btn btn-ghost" style={{ fontSize: '11px', gap: 6, padding: '7px 10px' }}>
              <RotateCcw size={11} />Reset {hiddenCount} hidden
            </button>
          ) : <span />}
          <button type="button" onClick={onClose} className="btn btn-ai" style={{ fontSize: '12px' }}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
