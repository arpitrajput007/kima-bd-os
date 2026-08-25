'use client'

import { useEffect, useState, useCallback, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, ExternalLink, Trash2, Loader2, Building2, Users,
  CheckCircle, Swords, X, Save,
} from 'lucide-react'
import { productBySlug } from '@/lib/competitor-products'
import { AssignToPlutoButton } from '@/components/AssignToPlutoButton'

interface Competitor {
  id: string
  product_slug: string
  name: string
  website: string | null
  weakness: string | null
  our_edge: string | null
  notes: string | null
}

interface CompetitorCustomer {
  id: string
  competitor_id: string
  company_name: string
  website: string | null
  region: string | null
  contact_name: string | null
  contact_title: string | null
  contact_email: string | null
  contact_linkedin: string | null
  pain_point: string | null
  source_url: string | null
  status: string
  notes: string | null
}

const STATUS_OPTIONS = ['not_contacted', 'researching', 'contacted', 'replied', 'in_pipeline', 'not_a_fit'] as const
const STATUS_COLOR: Record<string, string> = {
  not_contacted: '#818cf8', researching: '#fbbf24', contacted: '#38bdf8',
  replied: '#34d399', in_pipeline: '#a78bfa', not_a_fit: '#6b7280',
}
const STATUS_LABEL: Record<string, string> = {
  not_contacted: 'Not contacted', researching: 'Researching', contacted: 'Contacted',
  replied: 'Replied', in_pipeline: 'In pipeline', not_a_fit: 'Not a fit',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)', color: 'white', fontSize: 12, outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'rgb(120,127,160)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }

export default function CompetitorProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const product = productBySlug(slug)

  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [customers, setCustomers] = useState<CompetitorCustomer[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddCompetitor, setShowAddCompetitor] = useState(false)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [savingCompetitor, setSavingCompetitor] = useState(false)
  const [savingCustomer, setSavingCustomer] = useState(false)
  const [addedToBd, setAddedToBd] = useState<Set<string>>(new Set())

  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: comp } = await supabase.from('competitors').select('*').eq('product_slug', slug).order('name')
    setCompetitors(comp || [])
    if (comp?.length && !selected) setSelected(comp[0].id)
    setLoading(false)
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!selected) { setCustomers([]); return }
    supabase.from('competitor_customers').select('*').eq('competitor_id', selected).order('company_name')
      .then(({ data }) => setCustomers(data || []))
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeCompetitor = competitors.find(c => c.id === selected)

  const addCompetitor = async (form: FormData) => {
    const name = String(form.get('name') || '').trim()
    if (!name) return
    setSavingCompetitor(true)
    const { data, error } = await supabase.from('competitors').insert({
      product_slug: slug,
      name,
      website: String(form.get('website') || '') || null,
      weakness: String(form.get('weakness') || '') || null,
      our_edge: String(form.get('our_edge') || '') || null,
    }).select().single()
    setSavingCompetitor(false)
    if (error) { toast.error(error.code === '23505' ? `${name} already tracked for this product` : error.message); return }
    toast.success(`${name} added`)
    setCompetitors(c => [...c, data].sort((a, b) => a.name.localeCompare(b.name)))
    setSelected(data.id)
    setShowAddCompetitor(false)
  }

  const deleteCompetitor = async (c: Competitor) => {
    if (!confirm(`Delete ${c.name} and all its tracked customers?`)) return
    const { error } = await supabase.from('competitors').delete().eq('id', c.id)
    if (error) { toast.error(error.message); return }
    setCompetitors(cs => cs.filter(x => x.id !== c.id))
    if (selected === c.id) setSelected(null)
    toast.success(`${c.name} removed`)
  }

  const addCustomer = async (form: FormData) => {
    const company_name = String(form.get('company_name') || '').trim()
    if (!company_name || !selected) return
    setSavingCustomer(true)
    const { data, error } = await supabase.from('competitor_customers').insert({
      competitor_id: selected,
      company_name,
      website: String(form.get('website') || '') || null,
      region: String(form.get('region') || '') || null,
      contact_name: String(form.get('contact_name') || '') || null,
      contact_title: String(form.get('contact_title') || '') || null,
      contact_email: String(form.get('contact_email') || '') || null,
      contact_linkedin: String(form.get('contact_linkedin') || '') || null,
      pain_point: String(form.get('pain_point') || '') || null,
      source_url: String(form.get('source_url') || '') || null,
      notes: String(form.get('notes') || '') || null,
    }).select().single()
    setSavingCustomer(false)
    if (error) { toast.error(error.code === '23505' ? `${company_name} already tracked for this competitor` : error.message); return }
    toast.success(`${company_name} added`)
    setCustomers(cs => [...cs, data].sort((a, b) => a.company_name.localeCompare(b.company_name)))
    setShowAddCustomer(false)
  }

  const updateStatus = async (row: CompetitorCustomer, status: string) => {
    setCustomers(cs => cs.map(c => c.id === row.id ? { ...c, status } : c))
    const { error } = await supabase.from('competitor_customers').update({ status, updated_at: new Date().toISOString() }).eq('id', row.id)
    if (error) toast.error(error.message)
  }

  const deleteCustomer = async (row: CompetitorCustomer) => {
    if (!confirm(`Remove ${row.company_name}?`)) return
    const { error } = await supabase.from('competitor_customers').delete().eq('id', row.id)
    if (error) { toast.error(error.message); return }
    setCustomers(cs => cs.filter(c => c.id !== row.id))
  }

  const addToPipeline = async (row: CompetitorCustomer) => {
    const { error } = await supabase.from('leads').insert({
      company_name: row.company_name,
      status: 'new',
      website: row.website,
      region: row.region,
      classification: 'customer',
      competitor_or_current_provider: activeCompetitor?.name,
      competitor_context: row.pain_point,
      pain_point: row.pain_point,
      pain_point_source_url: row.source_url,
      pain_point_evidence_type: row.source_url ? 'verified_source' : 'agent_analysis',
      source_url: row.source_url,
      product_to_sell: product?.name,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      if (error.code === '23505') { toast(`${row.company_name} is already in your pipeline`); setAddedToBd(s => new Set([...s, row.id])) }
      else toast.error('Failed to add: ' + error.message)
      return
    }
    toast.success(`${row.company_name} added to BD pipeline`)
    setAddedToBd(s => new Set([...s, row.id]))
    updateStatus(row, 'in_pipeline')
  }

  if (!product) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'rgb(150,155,185)' }}>
        Unknown product &quot;{slug}&quot;. <Link href="/competitors" style={{ color: '#a78bfa' }}>Back to Competitors</Link>
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <Link href="/competitors" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgb(120,127,160)', textDecoration: 'none', marginBottom: 6 }}>
            <ArrowLeft size={12} /> Competitors &amp; Customers
          </Link>
          <h1 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2">
            <Swords size={18} style={{ color: product.color }} /> {product.name} — Competitors
          </h1>
          <p className="text-[12px] mt-1 font-medium" style={{ color: 'rgb(100,106,135)' }}>{product.blurb}</p>
        </div>
      </div>

      <div style={{ padding: '20px 36px', display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'flex-start' }}>
        {/* Competitor list */}
        <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgb(150,155,185)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Competitors</span>
            <button onClick={() => setShowAddCompetitor(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: product.color, background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <Plus size={13} /> Add
            </button>
          </div>

          {showAddCompetitor && (
            <form action={addCompetitor} style={{ padding: 14, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.02)' }}>
              <div><label style={labelStyle}>Name*</label><input name="name" required style={inputStyle} placeholder="Competitor name" /></div>
              <div><label style={labelStyle}>Website</label><input name="website" style={inputStyle} placeholder="https://…" /></div>
              <div><label style={labelStyle}>Weakness</label><textarea name="weakness" rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Where they fall short" /></div>
              <div><label style={labelStyle}>Our edge</label><textarea name="our_edge" rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Why we win against them" /></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={savingCompetitor} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${product.color}55`, background: `${product.color}18`, color: product.color }}>
                  {savingCompetitor ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                </button>
                <button type="button" onClick={() => setShowAddCompetitor(false)} style={{ padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgb(150,155,185)' }}>
                  <X size={12} />
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'rgb(120,127,160)', fontSize: 12 }}><Loader2 size={14} className="animate-spin" style={{ display: 'inline' }} /></div>
          ) : competitors.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'rgb(120,127,160)' }}>No competitors tracked yet.</div>
          ) : (
            competitors.map(c => (
              <div key={c.id} onClick={() => setSelected(c.id)}
                style={{ padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', background: selected === c.id ? `${product.color}12` : 'transparent', borderLeft: selected === c.id ? `2px solid ${product.color}` : '2px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{c.name}</div>
                  <button onClick={e => { e.stopPropagation(); deleteCompetitor(c) }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgb(100,107,140)', padding: 2 }}>
                    <Trash2 size={12} />
                  </button>
                </div>
                {c.website && <div style={{ fontSize: 10, color: 'rgb(100,107,140)', marginTop: 2 }}>{c.website.replace(/^https?:\/\//, '')}</div>}
              </div>
            ))
          )}
        </div>

        {/* Customers of selected competitor */}
        <div>
          {!activeCompetitor ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'rgb(120,127,160)', fontSize: 13 }}>
              {competitors.length === 0 ? 'Add a competitor to start tracking their customers.' : 'Select a competitor to see their customers.'}
            </div>
          ) : (
            <>
              {(activeCompetitor.weakness || activeCompetitor.our_edge) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {activeCompetitor.weakness && (
                    <div style={{ borderRadius: 12, border: '1px solid rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.05)', padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Their weakness</div>
                      <div style={{ fontSize: 12, color: 'rgb(210,215,235)', lineHeight: 1.5 }}>{activeCompetitor.weakness}</div>
                    </div>
                  )}
                  {activeCompetitor.our_edge && (
                    <div style={{ borderRadius: 12, border: `1px solid ${product.color}30`, background: `${product.color}0a`, padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: product.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Our edge</div>
                      <div style={{ fontSize: 12, color: 'rgb(210,215,235)', lineHeight: 1.5 }}>{activeCompetitor.our_edge}</div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'white' }}>
                  <Users size={14} style={{ color: product.color }} /> {activeCompetitor.name}&apos;s customers ({customers.length})
                </div>
                <button onClick={() => setShowAddCustomer(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${product.color}45`, background: `${product.color}12`, color: product.color }}>
                  <Plus size={12} /> Add customer
                </button>
              </div>

              {showAddCustomer && (
                <form action={addCustomer} style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', padding: 14, marginBottom: 14, background: 'rgba(255,255,255,0.02)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label style={labelStyle}>Company*</label><input name="company_name" required style={inputStyle} /></div>
                  <div><label style={labelStyle}>Website</label><input name="website" style={inputStyle} placeholder="https://…" /></div>
                  <div><label style={labelStyle}>Region</label><input name="region" style={inputStyle} /></div>
                  <div><label style={labelStyle}>Source / evidence URL</label><input name="source_url" style={inputStyle} placeholder="https://…" /></div>
                  <div><label style={labelStyle}>Contact name</label><input name="contact_name" style={inputStyle} /></div>
                  <div><label style={labelStyle}>Contact title</label><input name="contact_title" style={inputStyle} /></div>
                  <div><label style={labelStyle}>Contact email</label><input name="contact_email" style={inputStyle} /></div>
                  <div><label style={labelStyle}>Contact LinkedIn</label><input name="contact_linkedin" style={inputStyle} placeholder="https://linkedin.com/in/…" /></div>
                  <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Why they might switch (pain point)</label><textarea name="pain_point" rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
                  <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Notes</label><textarea name="notes" rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                    <button type="submit" disabled={savingCustomer} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${product.color}55`, background: `${product.color}18`, color: product.color }}>
                      {savingCustomer ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                    </button>
                    <button type="button" onClick={() => setShowAddCustomer(false)} style={{ padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgb(150,155,185)' }}>
                      <X size={12} />
                    </button>
                  </div>
                </form>
              )}

              <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                {customers.length === 0 ? (
                  <div style={{ padding: '30px 16px', textAlign: 'center', fontSize: 12, color: 'rgb(120,127,160)' }}>
                    No customers tracked for {activeCompetitor.name} yet. Add one, or share a list and it'll be added here.
                  </div>
                ) : customers.map((row, idx) => (
                  <div key={row.id} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{row.company_name}</span>
                          {row.website && (
                            <a href={row.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'rgb(110,115,150)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <ExternalLink size={9} />{row.website.replace(/^https?:\/\//, '')}
                            </a>
                          )}
                          {row.region && <span style={{ fontSize: 10, color: 'rgb(100,107,140)' }}>· {row.region}</span>}
                        </div>
                        {row.pain_point && <div style={{ fontSize: 11, color: 'rgb(160,165,195)', marginTop: 4, lineHeight: 1.45 }}>{row.pain_point}</div>}
                        {(row.contact_name || row.contact_email) && (
                          <div style={{ fontSize: 10, color: 'rgb(120,127,160)', marginTop: 4 }}>
                            {row.contact_name}{row.contact_title ? `, ${row.contact_title}` : ''}{row.contact_email ? ` · ${row.contact_email}` : ''}
                            {row.contact_linkedin && <> · <a href={row.contact_linkedin} target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', textDecoration: 'none' }}>LinkedIn</a></>}
                          </div>
                        )}
                        {row.source_url && (
                          <a href={row.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: '#818cf8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 4 }}>
                            <ExternalLink size={9} /> Evidence
                          </a>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                        <select value={row.status} onChange={e => updateStatus(row, e.target.value)}
                          style={{ fontSize: 10, fontWeight: 600, color: STATUS_COLOR[row.status], background: `${STATUS_COLOR[row.status]}14`, border: `1px solid ${STATUS_COLOR[row.status]}35`, borderRadius: 6, padding: '3px 6px', cursor: 'pointer' }}>
                          {STATUS_OPTIONS.map(s => <option key={s} value={s} style={{ background: '#0B0F1A', color: 'white' }}>{STATUS_LABEL[s]}</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: 5 }}>
                          {addedToBd.has(row.id) ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: '#34d399' }}><CheckCircle size={11} /> Added</span>
                          ) : (
                            <button onClick={() => addToPipeline(row)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 7, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: `1px solid ${product.color}40`, background: `${product.color}10`, color: product.color }}>
                              <Plus size={10} /> Add to BD
                            </button>
                          )}
                          <AssignToPlutoButton
                            companyName={row.company_name}
                            createFields={{
                              website: row.website, region: row.region, classification: 'customer',
                              competitor_or_current_provider: activeCompetitor.name, competitor_context: row.pain_point,
                              pain_point: row.pain_point, pain_point_source_url: row.source_url,
                              source_url: row.source_url, product_to_sell: product.name,
                            }}
                            compact
                          />
                          <button onClick={() => deleteCustomer(row)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgb(100,107,140)', padding: 3 }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
