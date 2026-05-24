'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { INDUSTRY_CATEGORIES, CUSTOMER_CATEGORIES, PRODUCTS_TO_SELL, REGIONS } from '@/lib/types'

export default function NewLeadPage() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    company_name: '',
    website: '',
    industry_category: '',
    customer_category: [] as string[],
    product_to_sell: '',
    region: '',
    description: '',
    business_model: '',
    product_summary: '',
    supported_chains_or_rails: '',
    current_providers: '',
    pain_point: '',
    pain_point_severity: '',
    pain_point_evidence: '',
    kima_fit: '',
    aeredium_fit: '',
    suggested_use_case: '',
    trigger_reason: '',
    source_url: '',
    source_summary: '',
    lead_score: '',
    confidence_score: '',
    status: 'new',
  })

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const toggleCategory = (cat: string) => {
    setForm(f => ({
      ...f,
      customer_category: f.customer_category.includes(cat)
        ? f.customer_category.filter(c => c !== cat)
        : [...f.customer_category, cat]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.company_name.trim()) { toast.error('Company name is required'); return }
    setSaving(true)

    const score = form.lead_score ? parseInt(form.lead_score) : null
    const priority = score != null
      ? score >= 85 ? 'excellent' : score >= 70 ? 'qualified' : score >= 50 ? 'needs_research' : 'low_priority'
      : null

    const { data, error } = await supabase.from('leads').insert({
      company_name: form.company_name,
      website: form.website || null,
      industry_category: form.industry_category || null,
      customer_category: form.customer_category.length ? form.customer_category : null,
      product_to_sell: form.product_to_sell || null,
      region: form.region || null,
      description: form.description || null,
      business_model: form.business_model || null,
      product_summary: form.product_summary || null,
      supported_chains_or_rails: form.supported_chains_or_rails || null,
      current_providers: form.current_providers || null,
      pain_point: form.pain_point || null,
      pain_point_severity: form.pain_point_severity || null,
      pain_point_evidence: form.pain_point_evidence || null,
      kima_fit: form.kima_fit || null,
      aeredium_fit: form.aeredium_fit || null,
      suggested_use_case: form.suggested_use_case || null,
      trigger_reason: form.trigger_reason || null,
      source_url: form.source_url || null,
      source_summary: form.source_summary || null,
      lead_score: score,
      confidence_score: form.confidence_score ? parseInt(form.confidence_score) : null,
      priority,
      status: form.status,
    }).select().single()

    if (error) { toast.error('Failed to create lead: ' + error.message); setSaving(false); return }
    toast.success('Lead created successfully')
    router.push(`/leads/${data.id}`)
  }

  const inputClass = 'input-dark'
  const labelClass = 'block text-xs font-medium mb-1.5'
  const labelStyle = { color: 'rgb(160, 160, 180)' }
  const groupClass = 'space-y-4'
  const sectionClass = 'rounded-xl p-5'
  const sectionStyle = { background: 'rgba(22,22,34,0.8)', border: '1px solid rgba(255,255,255,0.06)' }

  return (
    <div className="fade-in">
      <div className="page-header flex items-center gap-4">
        <Link href="/leads" className="btn btn-ghost" style={{ padding: '6px' }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Add New Lead</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>
            Fill in what you know — AI can research the rest
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-8 max-w-4xl">
        {/* Company Basics */}
        <div className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-semibold text-white mb-4">Company Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>Company Name *</label>
              <input className={inputClass} value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="e.g. Stargate Finance" required />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Website</label>
              <input className={inputClass} value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://..." type="url" />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Industry Category</label>
              <select className={inputClass} value={form.industry_category} onChange={e => set('industry_category', e.target.value)}>
                <option value="">Select category</option>
                {INDUSTRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Region</label>
              <select className={inputClass} value={form.region} onChange={e => set('region', e.target.value)}>
                <option value="">Select region</option>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass} style={labelStyle}>Description</label>
              <textarea className={inputClass} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description of what this company does..." rows={2} style={{ resize: 'vertical' }} />
            </div>
          </div>
        </div>

        {/* Sales Classification */}
        <div className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-semibold text-white mb-4">Sales Classification</h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass} style={labelStyle}>Customer/Sales Categories (select all that apply)</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {CUSTOMER_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={cn('badge cursor-pointer transition-all',
                      form.customer_category.includes(cat)
                        ? 'bg-violet-500/20 text-violet-200 border-violet-500/40'
                        : 'bg-white/5 text-zinc-400 border-white/10 hover:border-white/20'
                    )}
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass} style={labelStyle}>Product to Sell</label>
                <select className={inputClass} value={form.product_to_sell} onChange={e => set('product_to_sell', e.target.value)}>
                  <option value="">Select product</option>
                  {PRODUCTS_TO_SELL.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Status</label>
                <select className={inputClass} value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="new">New</option>
                  <option value="researching">Researching</option>
                  <option value="qualified">Qualified</option>
                  <option value="approved">Approved</option>
                  <option value="needs_more_research">Needs More Research</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Pain Point */}
        <div className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-semibold text-white mb-4">Pain Point & Trigger</h2>
          <div className={groupClass}>
            <div>
              <label className={labelClass} style={labelStyle}>Pain Point</label>
              <textarea className={inputClass} value={form.pain_point} onChange={e => set('pain_point', e.target.value)} placeholder="What exact problem does this company have that Kima/Aeredium can solve?" rows={2} style={{ resize: 'vertical' }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass} style={labelStyle}>Pain Point Severity</label>
                <select className={inputClass} value={form.pain_point_severity} onChange={e => set('pain_point_severity', e.target.value)}>
                  <option value="">Select severity</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Trigger Reason (why reach out NOW?)</label>
                <input className={inputClass} value={form.trigger_reason} onChange={e => set('trigger_reason', e.target.value)} placeholder="e.g. Just raised Series A, recently hacked, expanding chains..." />
              </div>
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Evidence / Proof</label>
              <input className={inputClass} value={form.pain_point_evidence} onChange={e => set('pain_point_evidence', e.target.value)} placeholder="Source URL, quote, or evidence for the pain point" />
            </div>
          </div>
        </div>

        {/* Kima & Aeredium Fit */}
        <div className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-semibold text-white mb-4">Kima & Aeredium Fit</h2>
          <div className={groupClass}>
            <div>
              <label className={labelClass} style={labelStyle}>Kima Fit</label>
              <textarea className={inputClass} value={form.kima_fit} onChange={e => set('kima_fit', e.target.value)} placeholder="How exactly can Kima help this company? What use case?" rows={2} style={{ resize: 'vertical' }} />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Aeredium Fit</label>
              <textarea className={inputClass} value={form.aeredium_fit} onChange={e => set('aeredium_fit', e.target.value)} placeholder="How does Aeredium's TEE/compliance/execution layer strengthen the pitch?" rows={2} style={{ resize: 'vertical' }} />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Suggested Use Case</label>
              <input className={inputClass} value={form.suggested_use_case} onChange={e => set('suggested_use_case', e.target.value)} placeholder="e.g. Cross-chain USDT deposits, fiat-to-crypto onboarding..." />
            </div>
          </div>
        </div>

        {/* Source & Scoring */}
        <div className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-semibold text-white mb-4">Source & Scoring</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>Source URL</label>
              <input className={inputClass} value={form.source_url} onChange={e => set('source_url', e.target.value)} placeholder="https://... (where you found this lead)" type="url" />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Source Summary</label>
              <input className={inputClass} value={form.source_summary} onChange={e => set('source_summary', e.target.value)} placeholder="Brief note on the source" />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Lead Score (0–100)</label>
              <input className={inputClass} value={form.lead_score} onChange={e => set('lead_score', e.target.value)} placeholder="e.g. 82" type="number" min="0" max="100" />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Confidence Score (0–100)</label>
              <input className={inputClass} value={form.confidence_score} onChange={e => set('confidence_score', e.target.value)} placeholder="e.g. 75" type="number" min="0" max="100" />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{ padding: '10px 20px' }}
          >
            {saving ? <><Loader2 size={15} className="animate-spin" />Saving...</> : <><Save size={15} />Save Lead</>}
          </button>
          <Link href="/leads" className="btn btn-ghost" style={{ fontSize: '13px' }}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
