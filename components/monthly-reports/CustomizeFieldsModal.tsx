'use client'

import { useState } from 'react'
import { X, Eye, EyeOff, Trash2, Plus } from 'lucide-react'
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xl rounded-xl flex flex-col"
        style={{ background: '#111119', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '85vh' }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <div className="text-sm font-semibold text-white">Customize Deal Fields</div>
            <div className="text-[11px] mt-0.5" style={{ color: 'rgb(100,106,135)' }}>
              Hide questions you don&apos;t use, or add your own — no code required.
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5" style={{ color: 'rgb(140,140,170)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1 px-5 pt-3">
          {([
            { key: 'builtin' as const, label: 'Visible Questions' },
            { key: 'custom' as const,  label: `Custom Questions (${customFields.length})` },
          ]).map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={tab === t.key
                ? { background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.4)', color: '#a78bfa' }
                : { background: 'transparent', border: '1px solid transparent', color: 'rgb(130,130,160)' }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto px-5 py-4" style={{ flex: 1 }}>
          {tab === 'builtin' ? (
            <div className="space-y-4">
              {DEAL_FORM_SECTIONS.map(section => {
                const sectionHidden = hiddenSections.has(section.key)
                const fields = DEAL_FORM_FIELDS.filter(f => f.section === section.key)
                return (
                  <div key={section.key} className="rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center justify-between px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <span className="text-xs font-semibold" style={{ color: sectionHidden ? 'rgb(100,106,135)' : 'white' }}>
                        {section.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleSection(section.key)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium"
                        style={sectionHidden
                          ? { background: 'rgba(255,255,255,0.05)', color: 'rgb(130,130,160)' }
                          : { background: 'rgba(52,211,153,0.12)', color: '#34d399' }}
                      >
                        {sectionHidden ? <><EyeOff size={10} />Hidden</> : <><Eye size={10} />Visible</>}
                      </button>
                    </div>
                    {!sectionHidden && fields.length > 0 && (
                      <div className="p-2 flex flex-wrap gap-1.5">
                        {fields.map(f => {
                          const fieldHidden = hiddenFields.has(f.key)
                          return (
                            <button
                              key={f.key}
                              type="button"
                              onClick={() => toggleField(f.key)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all"
                              style={fieldHidden
                                ? { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgb(90,95,120)', textDecoration: 'line-through' }
                                : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgb(190,190,215)' }}
                            >
                              {fieldHidden ? <EyeOff size={9} /> : <Eye size={9} />}{f.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {section.key === 'blockers' && (
                      <div className="px-3 pb-2 text-[10px]" style={{ color: 'rgb(90,95,120)' }}>
                        Blockers are hidden/shown as a whole section — individual blocker types can&apos;t be toggled here.
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomField() } }}
                  placeholder="New question, e.g. 'Preferred settlement currency'"
                  className="input-dark flex-1"
                />
                <select value={newType} onChange={e => setNewType(e.target.value as 'text' | 'textarea')} className="input-dark" style={{ width: 120 }}>
                  <option value="text">Short answer</option>
                  <option value="textarea">Long answer</option>
                </select>
                <button
                  type="button"
                  onClick={addCustomField}
                  disabled={!newLabel.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 flex-shrink-0"
                  style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)', color: '#a78bfa', opacity: newLabel.trim() ? 1 : 0.5 }}
                >
                  <Plus size={12} />Add
                </button>
              </div>

              {customFields.length === 0 ? (
                <p className="text-xs" style={{ color: 'rgb(100,106,135)' }}>
                  No custom questions yet. Anything you add here shows up in its own &quot;Custom Fields&quot; section on every deal.
                </p>
              ) : (
                <div className="space-y-2">
                  {customFields.map(f => (
                    <div key={f.key} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>
                        <div className="text-xs font-medium text-white">{f.label}</div>
                        <div className="text-[10px]" style={{ color: 'rgb(100,106,135)' }}>{f.type === 'textarea' ? 'Long answer' : 'Short answer'}</div>
                      </div>
                      <button type="button" onClick={() => removeCustomField(f.key)} style={{ color: 'rgb(140,140,170)' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button type="button" onClick={onClose} className="btn btn-ai" style={{ fontSize: '12px' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
