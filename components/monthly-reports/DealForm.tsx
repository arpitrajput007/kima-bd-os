'use client'

import { useState } from 'react'
import { Loader2, ChevronDown, ChevronUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DEAL_STATUSES, LEAD_TYPES, OUTREACH_CHANNELS,
  BLOCKER_TYPES, KIMA_PRODUCTS, dealStatusMeta,
} from '@/lib/monthly-reports-types'
import type { MonthlyDeal, DealBlocker, DealProductFeedback } from '@/lib/monthly-reports-types'

// ── Types ─────────────────────────────────────────────────────

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
}

interface Props {
  initialData?: Partial<MonthlyDeal>
  defaultMonthYear: string
  saving: boolean
  onSave: (data: DealFormData) => void
  onCancel: () => void
}

// ── UI Helpers ─────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgb(140,140,170)' }}>
        {label}{required && <span style={{ color: '#f87171' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = "w-full rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 transition-all"
const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', '--tw-ring-color': 'rgba(167,139,250,0.4)' } as React.CSSProperties

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} style={{ ...inputStyle, ...props.style }} />
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} rows={props.rows ?? 3} className={cn(inputCls, props.className)} style={{ ...inputStyle, resize: 'vertical', ...props.style }} />
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(inputCls, props.className)} style={{ ...inputStyle, ...props.style }}>
      {children}
    </select>
  )
}

function SectionCard({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        style={{ borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'rgb(140,140,170)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</span>
        {open ? <ChevronUp size={14} style={{ color: 'rgb(100,100,120)' }} /> : <ChevronDown size={14} style={{ color: 'rgb(100,100,120)' }} />}
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  )
}

function RadioGroup({ options, value, onChange }: { options: readonly { value: string; label: string }[] | readonly string[]; value: string; onChange: (v: string) => void }) {
  const items = options.map(o => typeof o === 'string' ? { value: o, label: o } : o)
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={value === o.value
            ? { background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(167,139,250,0.5)', color: '#a78bfa' }
            : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgb(130,130,160)' }
          }
        >
          {o.label}
        </button>
      ))}
    </div>
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
  })

  const set = (field: keyof DealFormData, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const setPF = (field: keyof DealProductFeedback, value: string) =>
    setForm(prev => ({ ...prev, product_feedback: { ...prev.product_feedback, [field]: value } }))

  const toggleBlocker = (type: string) => {
    const exists = form.blockers.find(b => b.type === type)
    if (exists) {
      set('blockers', form.blockers.filter(b => b.type !== type))
    } else {
      set('blockers', [...form.blockers, { type, notes: '', resolved: false }])
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.company_name.trim()) return
    onSave(form)
  }

  const statusMeta = dealStatusMeta(form.status as never)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* ── 1. Company Information ─────────────────────── */}
      <SectionCard title="Company Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Company Name" required>
            <Input
              value={form.company_name}
              onChange={e => set('company_name', e.target.value)}
              placeholder="e.g. Stripe, Binance, Coinbase"
              required
            />
          </Field>
          <Field label="Individual Name">
            <Input value={form.individual_name} onChange={e => set('individual_name', e.target.value)} placeholder="Contact person's name" />
          </Field>
          <Field label="Designation / Role">
            <Input value={form.designation} onChange={e => set('designation', e.target.value)} placeholder="e.g. Head of Payments, CTO" />
          </Field>
          <Field label="Website">
            <Input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://" type="url" />
          </Field>
          <Field label="Industry">
            <Input value={form.industry} onChange={e => set('industry', e.target.value)} placeholder="e.g. Fintech, DeFi, Gaming" />
          </Field>
          <Field label="Country">
            <Input value={form.country} onChange={e => set('country', e.target.value)} placeholder="e.g. UAE, Singapore, USA" />
          </Field>
        </div>
      </SectionCard>

      {/* ── 2. Lead Classification ──────────────────────── */}
      <SectionCard title="Lead Classification">
        <div className="space-y-4">
          <Field label="Lead Type">
            <RadioGroup options={LEAD_TYPES} value={form.lead_type} onChange={v => set('lead_type', v)} />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Deal Status">
              <Select value={form.status} onChange={e => set('status', e.target.value)}>
                {DEAL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </Field>
            <Field label="Primary Outreach Channel">
              <Select value={form.outreach_channel} onChange={e => set('outreach_channel', e.target.value)}>
                <option value="">Select channel…</option>
                {OUTREACH_CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Expected Close Date">
              <Input value={form.expected_close_date} onChange={e => set('expected_close_date', e.target.value)} type="date" />
            </Field>
            <Field label="Reporting Month">
              <Input value={form.month_year} onChange={e => set('month_year', e.target.value)} type="month" />
            </Field>
          </div>
        </div>
      </SectionCard>

      {/* ── 3. Opportunity Details ─────────────────────── */}
      <SectionCard title="Opportunity Details">
        <div className="space-y-4">
          <Field label="Requirement — What are they looking for?">
            <Textarea value={form.requirement} onChange={e => set('requirement', e.target.value)} placeholder="Describe their specific requirement…" />
          </Field>
          <Field label="Problem Statement — What problem are they solving?">
            <Textarea value={form.problem_statement} onChange={e => set('problem_statement', e.target.value)} placeholder="Explain the core problem they're trying to solve…" />
          </Field>
          <Field label="Products They Are Interested In">
            <MultiChip options={KIMA_PRODUCTS} selected={form.products_interested} onChange={v => set('products_interested', v)} />
          </Field>
          <Field label="Products We Proposed">
            <MultiChip options={KIMA_PRODUCTS} selected={form.products_proposed} onChange={v => set('products_proposed', v)} />
          </Field>
        </div>
      </SectionCard>

      {/* ── 4. Business Potential ──────────────────────── */}
      <SectionCard title="Business Potential">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Expected Monthly Volume">
              <Input value={form.expected_monthly_volume} onChange={e => set('expected_monthly_volume', e.target.value)} placeholder="e.g. $2M/month" />
            </Field>
            <Field label="Expected Yearly Volume">
              <Input value={form.expected_yearly_volume} onChange={e => set('expected_yearly_volume', e.target.value)} placeholder="e.g. $24M/year" />
            </Field>
            <Field label="Estimated Revenue Opportunity">
              <Input value={form.estimated_revenue} onChange={e => set('estimated_revenue', e.target.value)} placeholder="e.g. $200K/year" />
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Geographic Corridor">
              <Input value={form.geographic_corridor} onChange={e => set('geographic_corridor', e.target.value)} placeholder="e.g. UAE → India, US → EU" />
            </Field>
            <Field label="Number of End Users (if known)">
              <Input value={form.end_users_count} onChange={e => set('end_users_count', e.target.value)} placeholder="e.g. 50,000 users" />
            </Field>
          </div>
          <Field label="Use Case">
            <Textarea value={form.use_case} onChange={e => set('use_case', e.target.value)} placeholder="Describe the specific use case for Kima's products…" />
          </Field>
          <Field label="Strategic Importance">
            <RadioGroup
              options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]}
              value={form.strategic_importance}
              onChange={v => set('strategic_importance', v)}
            />
          </Field>
        </div>
      </SectionCard>

      {/* ── 5. Business Impact ─────────────────────────── */}
      <SectionCard title="Business Impact" defaultOpen={false}>
        <div className="space-y-4">
          <Field label="What business can this opportunity bring?">
            <Textarea value={form.business_impact} onChange={e => set('business_impact', e.target.value)} placeholder="Quantify the impact: revenue, volume, strategic positioning…" />
          </Field>
          <Field label="Why is this customer valuable?">
            <Textarea value={form.why_valuable} onChange={e => set('why_valuable', e.target.value)} placeholder="Network effects, brand value, market access, reference customer…" />
          </Field>
          <Field label="Which Kima / Aergap product fits best?">
            <Input value={form.best_product_fit} onChange={e => set('best_product_fit', e.target.value)} placeholder="e.g. Aergap cross-chain settlement" />
          </Field>
          <Field label="Long-term strategic value">
            <Textarea value={form.long_term_value} onChange={e => set('long_term_value', e.target.value)} placeholder="Partnership, ecosystem growth, data, integrations…" />
          </Field>
        </div>
      </SectionCard>

      {/* ── 6. Product Feedback ────────────────────────── */}
      <SectionCard title="Product Feedback from Prospect" defaultOpen={false}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Feature Requested">
              <Textarea rows={2} value={form.product_feedback.feature_requested || ''} onChange={e => setPF('feature_requested', e.target.value)} placeholder="Specific features they asked for…" />
            </Field>
            <Field label="Missing Functionality">
              <Textarea rows={2} value={form.product_feedback.missing_functionality || ''} onChange={e => setPF('missing_functionality', e.target.value)} placeholder="What's missing from our current offering…" />
            </Field>
            <Field label="Product Gaps Identified">
              <Textarea rows={2} value={form.product_feedback.product_gaps || ''} onChange={e => setPF('product_gaps', e.target.value)} placeholder="Gaps compared to competitors…" />
            </Field>
            <Field label="Integration Requested">
              <Textarea rows={2} value={form.product_feedback.integration_requested || ''} onChange={e => setPF('integration_requested', e.target.value)} placeholder="Third-party integrations they need…" />
            </Field>
            <Field label="API Requirements">
              <Textarea rows={2} value={form.product_feedback.api_requirements || ''} onChange={e => setPF('api_requirements', e.target.value)} placeholder="API capabilities they need…" />
            </Field>
            <Field label="Compliance Requirements">
              <Textarea rows={2} value={form.product_feedback.compliance_requirements || ''} onChange={e => setPF('compliance_requirements', e.target.value)} placeholder="Regulatory or compliance needs…" />
            </Field>
          </div>
          <Field label="Technical Blockers">
            <Textarea rows={2} value={form.product_feedback.technical_blockers || ''} onChange={e => setPF('technical_blockers', e.target.value)} placeholder="Technical limitations that block the deal…" />
          </Field>
        </div>
      </SectionCard>

      {/* ── 7. Blockers ────────────────────────────────── */}
      <SectionCard title="Deal Blockers" defaultOpen={false}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {BLOCKER_TYPES.map(b => {
              const active = form.blockers.some(bl => bl.type === b.value)
              return (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => toggleBlocker(b.value)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={active
                    ? { background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171' }
                    : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgb(130,130,160)' }
                  }
                >
                  {active && <X size={10} />}{b.label}
                </button>
              )
            })}
          </div>
          {form.blockers.length > 0 && (
            <div className="space-y-2 mt-3">
              {form.blockers.map((bl, i) => {
                const meta = BLOCKER_TYPES.find(b => b.value === bl.type)
                return (
                  <div key={bl.type} className="rounded-lg p-3" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.12)' }}>
                    <div className="text-xs font-medium mb-1.5" style={{ color: '#f87171' }}>{meta?.label}</div>
                    <Input
                      value={bl.notes || ''}
                      onChange={e => {
                        const updated = [...form.blockers]
                        updated[i] = { ...updated[i], notes: e.target.value }
                        set('blockers', updated)
                      }}
                      placeholder="Notes on this blocker…"
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── 8. Notes ───────────────────────────────────── */}
      <SectionCard title="Additional Notes" defaultOpen={false}>
        <div className="space-y-4">
          <Field label="Notes">
            <Textarea rows={4} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional context, next steps, or observations…" />
          </Field>
          <Field label="Owner / Assigned To">
            <Input value={form.owner} onChange={e => set('owner', e.target.value)} placeholder="e.g. Arpit" />
          </Field>
        </div>
      </SectionCard>

      {/* ── Actions ────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2 pb-6">
        <button type="button" onClick={onCancel} className="btn btn-ghost" style={{ fontSize: '13px' }}>
          Cancel
        </button>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs" style={{ color: 'rgb(100,100,120)' }}>
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusMeta.color }} />
            {statusMeta.label}
          </div>
          <button type="submit" disabled={saving || !form.company_name.trim()} className="btn btn-ai" style={{ fontSize: '13px' }}>
            {saving ? <><Loader2 size={13} className="animate-spin" />Saving…</> : 'Save Deal'}
          </button>
        </div>
      </div>
    </form>
  )
}
