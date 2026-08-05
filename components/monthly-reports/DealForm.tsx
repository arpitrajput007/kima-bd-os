'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  Loader2, X, Sparkles, Plus, Building2, Boxes, Target, FileText,
  AlertTriangle, Lightbulb,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  DEAL_STATUSES, BLOCKER_TYPES, KIMA_PRODUCTS, LEAD_TYPES, dealStatusMeta, blockerLabel, isNoiseBlockerLabel,
} from '@/lib/monthly-reports-types'
import type { MonthlyDeal, DealBlocker, DealProductFeedback } from '@/lib/monthly-reports-types'
import type { Lead } from '@/lib/types'
import { AiFixButton } from './ui'

// Minimal shape pulled from `leads` for the Company Name autocomplete — just
// enough to filter by name and auto-fill the handful of Deal fields that have
// a clean 1:1 source in the CRM record.
type CrmLeadOption = Pick<Lead,
  | 'id' | 'company_name' | 'industry_category' | 'pain_point' | 'description'
  | 'kima_fit' | 'aeredium_fit' | 'aerpolice_fit' | 'product_matches'
>

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

function MultiChip({
  options, selected, onChange, customOptions, onRemoveCustom,
}: {
  options: readonly string[]
  selected: string[]
  onChange: (v: string[]) => void
  customOptions?: string[]
  onRemoveCustom?: (v: string) => void
}) {
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v])
  const allOptions = customOptions ? [...options, ...customOptions] : options
  return (
    <div className="flex flex-wrap gap-2">
      {allOptions.map(o => {
        const isCustom = customOptions?.includes(o)
        const isSelected = selected.includes(o)
        return (
          <span
            key={o}
            className="inline-flex items-center rounded-lg text-xs font-medium transition-all"
            style={isSelected
              ? { background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(167,139,250,0.5)', color: '#a78bfa' }
              : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgb(130,130,160)' }
            }
          >
            <button type="button" onClick={() => toggle(o)} className="pl-3 pr-1.5 py-1.5">
              {isSelected && <span className="mr-1">✓</span>}{o}
            </button>
            {isCustom && (
              <button
                type="button"
                onClick={() => onRemoveCustom?.(o)}
                title="Remove this product"
                className="flex items-center justify-center rounded mr-1.5"
                style={{ width: 16, height: 16, color: 'inherit', opacity: 0.6 }}
              >
                <X size={11} />
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}

function SectionHeader({ icon: Icon, color, title, subtitle }: { icon: React.ElementType; color: string; title: string; subtitle?: string }) {
  return (
    <div className="section-card-header">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}1a` }}>
          <Icon size={14} style={{ color }} />
        </div>
        <div>
          <div className="text-[13px] font-semibold text-white">{title}</div>
          {subtitle && <div className="text-[11px]" style={{ color: 'rgb(100,106,135)' }}>{subtitle}</div>}
        </div>
      </div>
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

  // ── Company Name autocomplete against existing CRM leads ─────
  // Loaded once on mount; filtered client-side as the rep types so picking a
  // known company can auto-fill the rest of the form from what's already
  // known about them, without a round-trip per keystroke.
  const [crmLeads, setCrmLeads] = useState<CrmLeadOption[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('leads')
      .select('id, company_name, industry_category, pain_point, description, kima_fit, aeredium_fit, aerpolice_fit, product_matches')
      .order('company_name')
      .limit(1000)
      .then(({ data }) => { if (data) setCrmLeads(data as CrmLeadOption[]) })
  }, [])

  const companyQuery = form.company_name.trim().toLowerCase()
  const companySuggestions = useMemo(() => {
    if (!companyQuery) return []
    return crmLeads
      .filter(l => l.company_name.toLowerCase().includes(companyQuery))
      .slice(0, 8)
  }, [crmLeads, companyQuery])

  // Fills every field below that has a clean source on the CRM record —
  // Industry, Product Fit, Lead Context, and Solution. Overwrites rather than
  // only filling blanks since this only runs on an explicit click of a named
  // company, so the rep clearly means "load Acme's data now."
  const applyLeadAutofill = (lead: CrmLeadOption) => {
    set('company_name', lead.company_name)
    if (lead.industry_category) set('industry', lead.industry_category)

    const context = lead.pain_point || lead.description
    if (context) set('requirement', context)

    const fits = [
      lead.kima_fit && `Kima: ${lead.kima_fit}`,
      lead.aeredium_fit && `Aeredium: ${lead.aeredium_fit}`,
      lead.aerpolice_fit && `Aerpolice: ${lead.aerpolice_fit}`,
    ].filter(Boolean) as string[]
    if (fits.length) set('best_product_fit', fits.join('\n\n'))

    const matchedProducts = (lead.product_matches || [])
      .filter(m => m.match === 'strong' || m.match === 'partial')
      .map(m => m.product)
    if (matchedProducts.length) {
      const newCustom = matchedProducts.filter(p => !KIMA_PRODUCTS.includes(p as never) && !customProducts.includes(p))
      if (newCustom.length) setCustomProducts(prev => [...prev, ...newCustom])
      set('products_interested', Array.from(new Set([...form.products_interested, ...matchedProducts])))
    }

    setShowSuggestions(false)
    toast.success(`Auto-filled from ${lead.company_name}'s CRM record — review before saving`)
  }

  // ── Custom products (Product Fit chips beyond the standard catalog) ──
  const [customProducts, setCustomProducts] = useState<string[]>(
    () => (d.products_interested || []).filter(p => !KIMA_PRODUCTS.includes(p as never))
  )
  const [customProductInput, setCustomProductInput] = useState('')

  const addCustomProduct = () => {
    const label = customProductInput.trim()
    if (!label) return
    if (KIMA_PRODUCTS.includes(label as never) || customProducts.includes(label)) {
      set('products_interested', form.products_interested.includes(label) ? form.products_interested : [...form.products_interested, label])
      setCustomProductInput('')
      return
    }
    setCustomProducts(prev => [...prev, label])
    set('products_interested', [...form.products_interested, label])
    setCustomProductInput('')
  }

  const removeCustomProduct = (label: string) => {
    setCustomProducts(prev => prev.filter(p => p !== label))
    set('products_interested', form.products_interested.filter(p => p !== label))
  }

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
    if (isNoiseBlockerLabel(label)) {
      toast.message("If there's no blocker, just leave this section empty instead of adding one", { duration: 4000 })
      setCustomBlockerInput('')
      return
    }
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
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Company ──────────────────────────────────── */}
      <div className="section-card card-hover">
        <SectionHeader icon={Building2} color="#60a5fa" title="Company" subtitle="Who they are and what they deal in" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ padding: '20px 22px' }}>
          <Field label="Company Name" hint="Pick a match from your CRM to auto-fill Industry, Product Fit, Lead Context, and Solution">
            <div style={{ position: 'relative' }}>
              <Input
                value={form.company_name}
                onChange={e => { set('company_name', e.target.value); setShowSuggestions(true) }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => { setTimeout(() => setShowSuggestions(false), 150); estimateVolume() }}
                placeholder="e.g. Stripe, Binance, Coinbase"
                autoComplete="off"
              />
              {showSuggestions && companySuggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 100,
                  background: 'rgb(14,16,28)', border: '1px solid rgba(124,58,237,0.25)',
                  borderRadius: 12, overflow: 'hidden',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                }}>
                  {companySuggestions.map((lead, idx) => {
                    const name = lead.company_name
                    const qi = name.toLowerCase().indexOf(companyQuery)
                    return (
                      <button
                        key={lead.id}
                        type="button"
                        onMouseDown={() => applyLeadAutofill(lead)}
                        style={{
                          width: '100%', display: 'flex', flexDirection: 'column', gap: 2,
                          padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer',
                          borderBottom: idx < companySuggestions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                          textAlign: 'left', transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.1)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>
                          {qi === -1 ? name : (
                            <>
                              {name.slice(0, qi)}
                              <mark style={{ background: 'rgba(167,139,250,0.3)', color: '#c4b5fd', borderRadius: 3, padding: '0 2px' }}>
                                {name.slice(qi, qi + companyQuery.length)}
                              </mark>
                              {name.slice(qi + companyQuery.length)}
                            </>
                          )}
                        </span>
                        {lead.industry_category && (
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{lead.industry_category}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </Field>
          <Field label="Deals In" hint="What the company deals in — industry / category">
            <Input value={form.industry} onChange={e => set('industry', e.target.value)} placeholder="e.g. Crypto, Banking, Agent Wallets" />
          </Field>
        </div>
        <div style={{ padding: '0 22px 20px' }}>
          <Field label="Deal Type" hint="Is this a B2B, B2C, or other kind of deal?">
            <div className="flex flex-wrap gap-2">
              {LEAD_TYPES.map(t => {
                const isSelected = form.lead_type === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('lead_type', isSelected ? '' : t)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={isSelected
                      ? { background: 'rgba(96,165,250,0.2)', border: '1px solid rgba(96,165,250,0.5)', color: '#60a5fa' }
                      : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgb(130,130,160)' }
                    }
                  >
                    {isSelected && <span className="mr-1">✓</span>}{t}
                  </button>
                )
              })}
            </div>
          </Field>
        </div>
      </div>

      {/* ── Product Fit ──────────────────────────────── */}
      <div className="section-card card-hover">
        <SectionHeader icon={Boxes} color="#a78bfa" title="Product Fit" subtitle="Which Kima / Aeredium / Aerpolice products fit this lead" />
        <div style={{ padding: '20px 22px' }}>
          <MultiChip
            options={KIMA_PRODUCTS}
            selected={form.products_interested}
            onChange={v => set('products_interested', v)}
            customOptions={customProducts}
            onRemoveCustom={removeCustomProduct}
          />
          <div className="flex items-center gap-2 mt-3">
            <Input
              value={customProductInput}
              onChange={e => setCustomProductInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomProduct() } }}
              placeholder="Add a product not in the list…"
              className="flex-1"
            />
            <button
              type="button"
              onClick={addCustomProduct}
              disabled={!customProductInput.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 inline-flex items-center gap-1"
              style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)', color: '#a78bfa', opacity: customProductInput.trim() ? 1 : 0.5 }}
            >
              <Plus size={12} />Add
            </button>
          </div>
        </div>
      </div>

      {/* ── Deal Details ─────────────────────────────── */}
      <div className="section-card card-hover">
        <SectionHeader icon={Target} color="#34d399" title="Deal Details" subtitle="Stage, timing, and size of the opportunity" />
        <div style={{ padding: '20px 22px' }} className="space-y-4">
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
        </div>
      </div>

      {/* ── Lead Context ─────────────────────────────── */}
      <div className="section-card card-hover">
        <SectionHeader icon={FileText} color="#22d3ee" title="Lead Context" />
        <div style={{ padding: '20px 22px' }}>
          <Field
            label="Brief about Lead Context"
            action={<AiFixButton value={form.requirement} onFixed={v => set('requirement', v)} />}
          >
            <Textarea value={form.requirement} onChange={e => set('requirement', e.target.value)} placeholder="Who they are, what they need, why now…" />
          </Field>
        </div>
      </div>

      {/* ── Blockers ─────────────────────────────────── */}
      <div className="section-card card-hover">
        <SectionHeader icon={AlertTriangle} color="#f87171" title="Blockers" subtitle="What's standing between this lead and a close" />
        <div style={{ padding: '20px 22px' }}>
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
        </div>
      </div>

      {/* ── Solution ─────────────────────────────────── */}
      <div className="section-card card-hover">
        <SectionHeader icon={Lightbulb} color="#fbbf24" title="Solution" subtitle="The Kima / Aeredium / Aerpolice solution proposed for this lead" />
        <div style={{ padding: '20px 22px' }}>
          <Field
            label="Solution"
            action={<AiFixButton value={form.best_product_fit} onFixed={v => set('best_product_fit', v)} />}
          >
            <Textarea value={form.best_product_fit} onChange={e => set('best_product_fit', e.target.value)} placeholder="e.g. Aerpolice cross-chain settlement solves their bridge exposure…" />
          </Field>
        </div>
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
