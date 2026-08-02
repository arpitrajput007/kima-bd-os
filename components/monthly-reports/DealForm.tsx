'use client'

import { useState, useRef, useCallback } from 'react'
import { Loader2, X, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  DEAL_STATUSES, BLOCKER_TYPES, KIMA_PRODUCTS, dealStatusMeta, blockerLabel,
} from '@/lib/monthly-reports-types'
import type { MonthlyDeal, DealBlocker, DealProductFeedback } from '@/lib/monthly-reports-types'
import { AiFixButton } from './ui'

// ── Types ─────────────────────────────────────────────────────
// Keeps every column DealForm has ever written so nothing already saved on
// existing deals (via the old, larger form) gets clobbered on save — the UI
// below only exposes the 10 fields the team actually wants to fill in.

export interface DealFormData {
  company_name: string
  individual_name: string
  designation: string
  website: string
  industry: string
  country: string
  lead_type: string
  requirement: string
  problem_statement: string
  products_interested: string[]
  products_proposed: string[]
  status: string
  expected_close_date: string
  expected_monthly_volume: string
  expected_yearly_volume: string
  estimated_revenue: string
  geographic_corridor: string
  use_case: string
  end_users_count: string
  strategic_importance: string
  business_impact: string
  why_valuable: string
  best_product_fit: string
  long_term_value: string
  product_feedback: DealProductFeedback
  blockers: DealBlocker[]
  outreach_channel: string
  month_year: string
  owner: string
  notes: string
  custom_fields: Record<string, string>
}

interface Props {
  initialData?: Partial<MonthlyDeal>
  defaultMonthYear: string
  saving: boolean
  onSave: (data: DealFormData) => void
  onCancel: () => void
}

// ── UI Helpers ─────────────────────────────────────────────────

function Field({ label, required, action, hint, children }: { label: string; required?: boolean; action?: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <label className="block text-xs font-medium" style={{ color: 'rgb(140,140,170)' }}>
          {label}{required && <span style={{ color: '#f87171' }}> *</span>}
        </label>
        {action}
      </div>
      {children}
      {hint && <p className="text-[10.5px] mt-1" style={{ color: 'rgb(90,96,125)' }}>{hint}</p>}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn('input-dark', props.className)} />
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement | null>(null)

  const autoGrow = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  return (
    <textarea
      {...props}
      ref={el => { ref.current = el; autoGrow(el) }}
      rows={props.rows ?? 3}
      className={cn('input-dark', props.className)}
      style={{ resize: 'vertical', overflow: 'hidden', minHeight: '2.6em', ...props.style }}
      onInput={e => { autoGrow(e.currentTarget); props.onInput?.(e) }}
    />
  )
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn('input-dark', props.className)}>
      {children}
    </select>
  )
}

function MultiChip({ options, selected, onChange }: { options: readonly string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v])
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button
          key={o}
          type="button"
          onClick={() => toggle(o)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={selected.includes(o)
            ? { background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(167,139,250,0.5)', color: '#a78bfa' }
            : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgb(130,130,160)' }
          }
        >
          {selected.includes(o) && <span className="mr-1">✓</span>}{o}
        </button>
      ))}
    </div>
  )
}

// ── Main Form ──────────────────────────────────────────────────
// Deliberately just the 10 fields the team actually tracks per deal — company
// name, deals in, product fit, stage, monthly volume, rev opportunity,
// expected close date, lead context, blockers, and solution.

export default function DealForm({ initialData, defaultMonthYear, saving, onSave, onCancel }: Props) {
  const d = initialData || {}

  const [form, setForm] = useState<DealFormData>({
    company_name:             d.company_name || '',
    individual_name:          d.individual_name || '',
    designation:              d.designation || '',
    website:                  d.website || '',
    industry:                 d.industry || '',
    country:                  d.country || '',
    lead_type:                d.lead_type || '',
    requirement:              d.requirement || '',
    problem_statement:        d.problem_statement || '',
    products_interested:      d.products_interested || [],
    products_proposed:        d.products_proposed || [],
    status:                   d.status || 'new',
    expected_close_date:      d.expected_close_date || '',
    expected_monthly_volume:  d.expected_monthly_volume || '',
    expected_yearly_volume:   d.expected_yearly_volume || '',
    estimated_revenue:        d.estimated_revenue || '',
    geographic_corridor:      d.geographic_corridor || '',
    use_case:                 d.use_case || '',
    end_users_count:          d.end_users_count || '',
    strategic_importance:     d.strategic_importance || 'medium',
    business_impact:          d.business_impact || '',
    why_valuable:             d.why_valuable || '',
    best_product_fit:         d.best_product_fit || '',
    long_term_value:          d.long_term_value || '',
    product_feedback:         d.product_feedback || {},
    blockers:                 d.blockers || [],
    outreach_channel:         d.outreach_channel || '',
    month_year:               d.month_year || defaultMonthYear,
    owner:                    d.owner || '',
    notes:                    d.notes || '',
    custom_fields:            d.custom_fields || {},
  })

  const set = (field: keyof DealFormData, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const toggleBlocker = (type: string) => {
    const exists = form.blockers.find(b => b.type === type)
    if (exists) {
      set('blockers', form.blockers.filter(b => b.type !== type))
    } else {
      set('blockers', [...form.blockers, { type, notes: '', resolved: false }])
    }
  }

  const [customBlockerInput, setCustomBlockerInput] = useState('')

  const addCustomBlocker = () => {
    const label = customBlockerInput.trim()
    if (!label) return
    const slug = 'custom_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    if (!slug || form.blockers.some(b => b.type === slug)) { setCustomBlockerInput(''); return }
    set('blockers', [...form.blockers, { type: slug, label, notes: '', resolved: false }])
    setCustomBlockerInput('')
  }

  const removeBlocker = (type: string) => {
    set('blockers', form.blockers.filter(b => b.type !== type))
  }

  // ── Monthly Volume auto-fill ────────────────────────────────
  // When the rep tabs out of Company Name, look up an expected monthly
  // volume from public signal. Leaves the field untouched if it's already
  // been filled in (AI or manual) so it never clobbers a manual entry.
  const [estimating, setEstimating] = useState(false)
  const [volumeSource, setVolumeSource] = useState<'ai' | null>(d.expected_monthly_volume ? null : null)
  const lastEstimatedFor = useRef<string>('')

  const estimateVolume = async () => {
    const name = form.company_name.trim()
    if (!name || form.expected_monthly_volume.trim() || estimating) return
    if (lastEstimatedFor.current === name) return
    lastEstimatedFor.current = name
    setEstimating(true)
    try {
      const res = await fetch('/api/ai/estimate-volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: name, industry: form.industry }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Estimate failed')
      if (data.data?.monthly_volume) {
        set('expected_monthly_volume', data.data.monthly_volume)
        setVolumeSource('ai')
      } else {
        toast.message('No public data found for monthly volume — add it manually', { duration: 3500 })
      }
    } catch {
      // Silent — this is a nice-to-have autofill, not a blocking action.
    } finally {
      setEstimating(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(form)
  }

  const statusMeta = dealStatusMeta(form.status as never)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="section-card card-hover" style={{ padding: '24px 26px' }}>

        {/* Row 1 — Company Name / Deals In */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Company Name">
            <Input
              value={form.company_name}
              onChange={e => set('company_name', e.target.value)}
              onBlur={estimateVolume}
              placeholder="e.g. Stripe, Binance, Coinbase"
            />
          </Field>
          <Field label="Deals In" hint="What the company deals in — industry / category">
            <Input value={form.industry} onChange={e => set('industry', e.target.value)} placeholder="e.g. Crypto, Banking, Agent Wallets" />
          </Field>
        </div>

        <div className="my-5" style={{ borderTop: '1px solid var(--border)' }} />

        {/* Row 2 — Product Fit */}
        <Field label="Product Fit" hint="Which Kima / Aeredium / Aerpolice products fit this lead">
          <MultiChip options={KIMA_PRODUCTS} selected={form.products_interested} onChange={v => set('products_interested', v)} />
        </Field>

        <div className="my-5" style={{ borderTop: '1px solid var(--border)' }} />

        {/* Row 3 — Stage / Expected Close Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Stage">
            <Select value={form.status} onChange={e => set('status', e.target.value)}>
              {DEAL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Expected Close Date">
            <Input value={form.expected_close_date} onChange={e => set('expected_close_date', e.target.value)} type="date" />
          </Field>
        </div>

        <div className="my-5" style={{ borderTop: '1px solid var(--border)' }} />

        {/* Row 4 — Monthly Volume / Rev Opportunity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Monthly Volume"
            hint={estimating ? 'Estimating from public data…' : volumeSource === 'ai' ? 'AI estimate — edit if you know the real number' : 'Auto-fills after Company Name if public data exists'}
            action={estimating ? <Loader2 size={12} className="animate-spin" style={{ color: 'rgb(140,140,170)' }} /> : volumeSource === 'ai' ? <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: '#a78bfa' }}><Sparkles size={10} />AI</span> : undefined}
          >
            <Input
              value={form.expected_monthly_volume}
              onChange={e => { set('expected_monthly_volume', e.target.value); setVolumeSource(null) }}
              placeholder="e.g. $2M/month"
            />
          </Field>
          <Field label="Rev Opportunity">
            <Input value={form.estimated_revenue} onChange={e => set('estimated_revenue', e.target.value)} placeholder="e.g. $200K/year" />
          </Field>
        </div>

        <div className="my-5" style={{ borderTop: '1px solid var(--border)' }} />

        {/* Row 5 — Lead Context */}
        <Field
          label="Brief about Lead Context"
          action={<AiFixButton value={form.requirement} onFixed={v => set('requirement', v)} />}
        >
          <Textarea value={form.requirement} onChange={e => set('requirement', e.target.value)} placeholder="Who they are, what they need, why now…" />
        </Field>

        <div className="my-5" style={{ borderTop: '1px solid var(--border)' }} />

        {/* Row 6 — Blockers */}
        <Field label="Blockers">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Select
                value=""
                onChange={e => { if (e.target.value) toggleBlocker(e.target.value) }}
                className="flex-1"
              >
                <option value="">Pick a common blocker…</option>
                {BLOCKER_TYPES.filter(b => !form.blockers.some(bl => bl.type === b.value)).map(b => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </Select>
              <Input
                value={customBlockerInput}
                onChange={e => setCustomBlockerInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomBlocker() } }}
                placeholder="Or type your own…"
                className="flex-1"
              />
              <button
                type="button"
                onClick={addCustomBlocker}
                disabled={!customBlockerInput.trim()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0"
                style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)', color: '#a78bfa', opacity: customBlockerInput.trim() ? 1 : 0.5 }}
              >
                + Add
              </button>
            </div>

            {form.blockers.length > 0 && (
              <div className="space-y-2">
                {form.blockers.map((bl, i) => (
                  <div key={bl.type} className="rounded-lg p-3" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.12)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-xs font-medium" style={{ color: '#f87171' }}>{blockerLabel(bl)}</div>
                      <button
                        type="button"
                        onClick={() => removeBlocker(bl.type)}
                        className="flex items-center justify-center rounded"
                        style={{ color: 'rgb(140,140,170)', width: 18, height: 18 }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <Textarea
                      rows={2}
                      value={bl.notes || ''}
                      onChange={e => {
                        const updated = [...form.blockers]
                        updated[i] = { ...updated[i], notes: e.target.value }
                        set('blockers', updated)
                      }}
                      placeholder="Notes on this blocker…"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Field>

        <div className="my-5" style={{ borderTop: '1px solid var(--border)' }} />

        {/* Row 7 — Solution */}
        <Field
          label="Solution"
          hint="The Kima / Aeredium / Aerpolice solution proposed for this lead"
          action={<AiFixButton value={form.best_product_fit} onFixed={v => set('best_product_fit', v)} />}
        >
          <Textarea value={form.best_product_fit} onChange={e => set('best_product_fit', e.target.value)} placeholder="e.g. Aerpolice cross-chain settlement solves their bridge exposure…" />
        </Field>
      </div>

      {/* ── Actions ────────────────────────────────────── */}
      <div
        className="flex items-center justify-between"
        style={{
          position: 'sticky',
          bottom: 0,
          marginLeft: -36,
          marginRight: -36,
          marginTop: 8,
          padding: '14px 36px',
          background: 'rgba(10,11,16,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border)',
          zIndex: 10,
        }}
      >
        <button type="button" onClick={onCancel} className="btn btn-ghost" style={{ fontSize: '13px' }}>
          Cancel
        </button>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs" style={{ color: 'rgb(100,100,120)' }}>
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusMeta.color }} />
            {statusMeta.label}
          </div>
          <button type="submit" disabled={saving} className="btn btn-ai" style={{ fontSize: '13px' }}>
            {saving ? <><Loader2 size={13} className="animate-spin" />Saving…</> : 'Save Deal'}
          </button>
        </div>
      </div>
    </form>
  )
}
