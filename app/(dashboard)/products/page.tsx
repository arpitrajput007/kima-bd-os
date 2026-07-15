'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Boxes, Check, X, ArrowRight, Sparkles, Package, Landmark, ShieldCheck,
  Layers, TrendingUp, Target, Swords, Quote, Plus, MessageCircle, Lightbulb,
  Users, MapPin, Zap, Trash2, Link2, FileText, File, ExternalLink, Loader2,
  type LucideIcon,
} from 'lucide-react'
import { PRODUCTS, COMPANY_ONE_LINER, TOGETHER_LINE, type Product } from '@/lib/products-showcase'
import { SectionHeader } from '@/components/monthly-reports/ui'
import { createClient } from '@/lib/supabase/client'
import AddProductModal from '@/components/AddProductModal'
import type { CustomProduct } from '@/lib/types'

const ACCENT: Record<Product['accent'], { color: string; bg: string; border: string; gradient: string; icon: LucideIcon }> = {
  violet: { color: 'rgb(167,139,250)', bg: 'rgba(124,58,237,0.1)', border: 'rgba(124,58,237,0.25)', gradient: 'linear-gradient(135deg, #7c3aed, #4f46e5)', icon: Package },
  blue:   { color: 'rgb(96,165,250)',  bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.25)',  gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', icon: Landmark },
  cyan:   { color: 'rgb(103,232,249)', bg: 'rgba(6,182,212,0.1)',   border: 'rgba(6,182,212,0.25)',   gradient: 'linear-gradient(135deg, #06b6d4, #0e7490)', icon: ShieldCheck },
}
const CUSTOM_ACCENT = { color: 'rgb(253,186,116)', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.25)', gradient: 'linear-gradient(135deg, #f97316, #c2410c)', icon: Sparkles }

const EMERALD = 'rgb(52,211,153)'
const AMBER = 'rgb(251,191,36)'
const ROSE = 'rgb(251,113,133)'

const VERDICT_COLOR: Record<string, string> = {
  'Strong Fit': EMERALD,
  'Moderate Fit': AMBER,
  'Weak Fit': ROSE,
  'Not a Fit': ROSE,
}

const SECTION_PAD: React.CSSProperties = { padding: '18px 22px 20px' }

function BulletList({ items, color }: { items: string[]; color: string }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[13px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
          <Check size={14} className="flex-shrink-0 mt-[3px]" style={{ color }} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function ProductDetail({ product }: { product: Product }) {
  const a = ACCENT[product.accent]
  const Icon = a.icon
  return (
    <div className="space-y-5 fade-in">
      {/* Hero */}
      <div className="stat-card" style={{ position: 'relative', overflow: 'hidden', padding: 28 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: a.gradient }} />
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: a.gradient, boxShadow: `0 4px 20px ${a.bg}` }}>
            <Icon size={26} color="white" />
          </div>
          <div className="flex-1 min-w-[220px]">
            <div className="badge mb-2" style={{ color: a.color, background: a.bg, borderColor: a.border }}>
              {product.category}
            </div>
            <h2 className="text-2xl font-bold text-white">{product.name}</h2>
            <p className="text-[14px] mt-1" style={{ color: 'var(--text-2)' }}>{product.tagline}</p>
          </div>
        </div>
        {product.credibility && (
          <div className="mt-5 pt-4 flex items-center gap-2 text-[12px]" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-3)' }}>
            <Sparkles size={12} style={{ color: a.color, flexShrink: 0 }} />
            {product.credibility}
          </div>
        )}
      </div>

      {/* What it is */}
      <div className="section-card">
        <SectionHeader icon={Layers} iconColor={a.color} title="What it is" />
        <div style={SECTION_PAD}>
          <BulletList items={product.whatItIs} color={a.color} />
        </div>
      </div>

      {/* Sub-products */}
      <div className="section-card">
        <SectionHeader
          icon={Boxes} iconColor={a.color}
          title={`Products under ${product.name}`}
          subtitle={`${product.subProducts.length} offering${product.subProducts.length === 1 ? '' : 's'}`}
        />
        <div style={SECTION_PAD}>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {product.subProducts.map((sp) => (
              <div key={sp.name} className="rounded-xl p-4 card-hover" style={{ background: 'rgb(var(--bg-surface-3))', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: a.bg }}>
                    <Check size={12} style={{ color: a.color }} />
                  </div>
                  <div className="text-[13px] font-semibold text-white">{sp.name}</div>
                </div>
                <div className="text-[12.5px] leading-relaxed mb-3" style={{ color: 'var(--text-2)' }}>{sp.description}</div>
                <div className="text-[11px] leading-relaxed pt-2.5" style={{ color: 'var(--text-3)', borderTop: '1px solid var(--border)' }}>
                  <span className="font-semibold" style={{ color: a.color }}>Best fit — </span>
                  {sp.bestFit}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Market fit + Gap filled */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div className="section-card">
          <SectionHeader icon={TrendingUp} iconColor={EMERALD} title="Why it's a market fit" />
          <div style={SECTION_PAD}>
            <BulletList items={product.marketFit} color={EMERALD} />
          </div>
        </div>
        <div className="section-card">
          <SectionHeader icon={Target} iconColor={AMBER} title="The gap it fills" />
          <div style={SECTION_PAD}>
            <BulletList items={product.gapFilled} color={AMBER} />
          </div>
        </div>
      </div>

      {/* Competitors */}
      <div className="section-card">
        <SectionHeader
          icon={Swords} iconColor={ROSE} title="Competitors & how we're better"
          subtitle={`${product.competitors.length} head-to-head comparison${product.competitors.length === 1 ? '' : 's'}`}
        />
        <div style={SECTION_PAD} className="space-y-3">
          {product.competitors.map((c) => (
            <div key={c.name} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <div className="px-4 py-2.5 text-[13px] font-semibold text-white" style={{ background: 'rgb(var(--bg-surface-3))', borderBottom: '1px solid var(--border)' }}>
                {c.name}
              </div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                <div className="p-4 flex items-start gap-2.5" style={{ background: 'rgba(251,113,133,0.05)' }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(251,113,133,0.15)' }}>
                    <X size={11} style={{ color: ROSE }} />
                  </div>
                  <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{c.weakness}</div>
                </div>
                <div className="p-4 flex items-start gap-2.5" style={{ background: 'rgba(52,211,153,0.05)' }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(52,211,153,0.15)' }}>
                    <Check size={11} style={{ color: EMERALD }} />
                  </div>
                  <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{c.ourEdge}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CustomProductDetail({ product, onDeleted }: { product: CustomProduct; onDeleted: (id: string) => void }) {
  const a = CUSTOM_ACCENT
  const Icon = a.icon
  const an = product.analysis
  const verdictColor = VERDICT_COLOR[an.market_fit?.verdict] ?? AMBER
  const [deleting, setDeleting] = useState(false)

  const remove = async () => {
    if (!confirm(`Remove "${product.name}" from your products?`)) return
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('custom_products').update({ status: 'archived' }).eq('id', product.id)
      if (error) throw error
      toast.success(`${product.name} removed`)
      onDeleted(product.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove product')
      setDeleting(false)
    }
  }

  const SourceIcon = product.source_type === 'url' ? Link2 : product.source_type === 'document' ? File : FileText

  return (
    <div className="space-y-5 fade-in">
      {/* Hero */}
      <div className="stat-card" style={{ position: 'relative', overflow: 'hidden', padding: 28 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: a.gradient }} />
        <div className="flex items-start gap-4 flex-wrap justify-between">
          <div className="flex items-start gap-4 flex-1 min-w-[220px]">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: a.gradient, boxShadow: `0 4px 20px ${a.bg}` }}>
              <Icon size={26} color="white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <div className="badge" style={{ color: a.color, background: a.bg, borderColor: a.border }}>
                  Added product
                </div>
                <div className="badge" style={{ color: verdictColor, background: verdictColor + '18', borderColor: verdictColor + '40' }}>
                  {an.market_fit?.verdict ?? 'Unassessed'}
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white">{product.name}</h2>
              {product.source_url ? (
                <a href={product.source_url} target="_blank" rel="noreferrer" className="text-[12.5px] mt-1 inline-flex items-center gap-1.5 hover:underline" style={{ color: 'var(--text-3)' }}>
                  <SourceIcon size={11} /> {product.source_url} <ExternalLink size={10} />
                </a>
              ) : (
                <div className="text-[12.5px] mt-1 inline-flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
                  <SourceIcon size={11} /> {product.source_filename || 'Pasted text'}
                </div>
              )}
            </div>
          </div>
          <button onClick={remove} disabled={deleting} className="btn btn-danger flex-shrink-0" style={{ padding: '7px 10px', fontSize: '12px' }} title="Remove this product">
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        </div>
      </div>

      {/* Layman explanation */}
      <div className="section-card">
        <SectionHeader icon={MessageCircle} iconColor={a.color} title="In plain English" />
        <div style={SECTION_PAD}>
          <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-1)' }}>{an.layman_explanation}</p>
        </div>
      </div>

      {/* Market fit */}
      <div className="section-card">
        <SectionHeader icon={TrendingUp} iconColor={verdictColor} title="Why it's a market fit" subtitle={an.market_fit?.verdict} />
        <div style={SECTION_PAD}>
          <BulletList items={an.market_fit?.reasoning ?? []} color={verdictColor} />
        </div>
      </div>

      {/* Use cases + Gap filled */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div className="section-card">
          <SectionHeader icon={Lightbulb} iconColor={AMBER} title="Real-life use cases" />
          <div style={SECTION_PAD}>
            <BulletList items={an.use_cases ?? []} color={AMBER} />
          </div>
        </div>
        <div className="section-card">
          <SectionHeader icon={Target} iconColor={EMERALD} title="The gap it fills" />
          <div style={SECTION_PAD}>
            <BulletList items={an.gap_filled ?? []} color={EMERALD} />
          </div>
        </div>
      </div>

      {/* ICP */}
      <div className="section-card">
        <SectionHeader icon={Users} iconColor={a.color} title="Ideal customer profile" />
        <div style={SECTION_PAD}>
          {an.icp?.description && (
            <p className="text-[13.5px] leading-relaxed mb-3" style={{ color: 'var(--text-1)' }}>{an.icp.description}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {(an.icp?.segments ?? []).map((s, i) => (
              <span key={i} className="badge" style={{ color: a.color, background: a.bg, borderColor: a.border }}>{s}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Where to find customers + Fastest closing */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div className="section-card">
          <SectionHeader icon={MapPin} iconColor="rgb(96,165,250)" title="Where & how to find customers" />
          <div style={SECTION_PAD}>
            <BulletList items={an.where_to_find_customers ?? []} color="rgb(96,165,250)" />
          </div>
        </div>
        <div className="section-card">
          <SectionHeader icon={Zap} iconColor={EMERALD} title="Fastest to close" subtitle="Prioritize these first" />
          <div style={SECTION_PAD} className="space-y-3">
            {(an.fastest_closing_segments ?? []).map((f, i) => (
              <div key={i} className="rounded-xl p-3.5" style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.15)' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Zap size={12} style={{ color: EMERALD, flexShrink: 0 }} />
                  <div className="text-[13px] font-semibold text-white">{f.segment}</div>
                </div>
                <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{f.why}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {!!an.sources?.length && (
        <div className="section-card">
          <SectionHeader icon={ExternalLink} iconColor="var(--text-3)" title="Sources" />
          <div style={SECTION_PAD} className="space-y-1.5">
            {an.sources.map((s, i) => (
              <a key={i} href={s} target="_blank" rel="noreferrer" className="block text-[12px] truncate hover:underline" style={{ color: 'rgb(96,165,250)' }}>{s}</a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function OverviewTab({ customProducts, onSelect, onSelectCustom, onAddClick }: {
  customProducts: CustomProduct[]
  onSelect: (slug: Product['slug']) => void
  onSelectCustom: (id: string) => void
  onAddClick: () => void
}) {
  return (
    <div className="space-y-5 fade-in">
      <div className="stat-card" style={{ position: 'relative', overflow: 'hidden', padding: 28, background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(6,182,212,0.05))' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #7c3aed, #06b6d4)' }} />
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={15} style={{ color: 'rgb(167,139,250)' }} />
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgb(167,139,250)', letterSpacing: '0.08em' }}>Kima Finance</span>
        </div>
        <p className="text-[16px] leading-relaxed text-white">{COMPANY_ONE_LINER}</p>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {PRODUCTS.map((p) => {
          const a = ACCENT[p.accent]
          const Icon = a.icon
          return (
            <button
              key={p.slug}
              onClick={() => onSelect(p.slug)}
              className="stat-card card-hover text-left"
              style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: a.gradient }} />
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: a.gradient, boxShadow: `0 4px 16px ${a.bg}` }}>
                  <Icon size={18} color="white" />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-white">{p.name}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>{p.category}</div>
                </div>
              </div>
              <p className="text-[12.5px] leading-relaxed mb-3" style={{ color: 'var(--text-2)' }}>{p.tagline}</p>
              <ul className="space-y-1.5 mb-3">
                {p.whatItIs.slice(0, 2).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] leading-snug" style={{ color: 'var(--text-3)' }}>
                    <Check size={11} className="flex-shrink-0 mt-[3px]" style={{ color: a.color }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: a.color }}>
                View details <ArrowRight size={12} />
              </div>
            </button>
          )
        })}

        {customProducts.map((cp) => {
          const a = CUSTOM_ACCENT
          const verdictColor = VERDICT_COLOR[cp.analysis?.market_fit?.verdict] ?? AMBER
          return (
            <button
              key={cp.id}
              onClick={() => onSelectCustom(cp.id)}
              className="stat-card card-hover text-left"
              style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: a.gradient }} />
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: a.gradient, boxShadow: `0 4px 16px ${a.bg}` }}>
                  <Sparkles size={18} color="white" />
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-bold text-white truncate">{cp.name}</div>
                  <div className="text-[11px]" style={{ color: verdictColor }}>{cp.analysis?.market_fit?.verdict ?? 'Unassessed'}</div>
                </div>
              </div>
              <p className="text-[12.5px] leading-relaxed mb-3 line-clamp-3" style={{ color: 'var(--text-2)' }}>{cp.analysis?.layman_explanation}</p>
              <div className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: a.color }}>
                View details <ArrowRight size={12} />
              </div>
            </button>
          )
        })}

        <button
          onClick={onAddClick}
          className="text-left flex flex-col items-center justify-center gap-2"
          style={{
            minHeight: 176, borderRadius: 14, cursor: 'pointer',
            border: '1px dashed var(--border-strong)', background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)' }}>
            <Plus size={18} style={{ color: 'rgb(167,139,250)' }} />
          </div>
          <div className="text-[13px] font-semibold" style={{ color: 'var(--text-2)' }}>Add a product</div>
          <div className="text-[11px] px-4 text-center" style={{ color: 'var(--text-3)' }}>Paste a URL or document — the agent researches it</div>
        </button>
      </div>

      <div className="section-card">
        <SectionHeader icon={Quote} iconColor="rgb(167,139,250)" title="How the three work together" />
        <div style={SECTION_PAD}>
          <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-1)' }}>{TOGETHER_LINE}</p>
        </div>
      </div>
    </div>
  )
}

type TabKey = 'overview' | Product['slug'] | `custom:${string}`

export default function ProductsPage() {
  const [tab, setTab] = useState<TabKey>('overview')
  const [customProducts, setCustomProducts] = useState<CustomProduct[]>([])
  const [loadingCustom, setLoadingCustom] = useState(true)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  const loadCustomProducts = useCallback(async () => {
    setLoadingCustom(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('custom_products')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (error) {
      if (error.message?.includes('does not exist') || error.code === 'PGRST205') setSetupNeeded(true)
    } else {
      setCustomProducts((data as CustomProduct[]) || [])
    }
    setLoadingCustom(false)
  }, [])

  useEffect(() => { loadCustomProducts() }, [loadCustomProducts])

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    ...PRODUCTS.map((p) => ({ key: p.slug as TabKey, label: p.name })),
    ...customProducts.map((cp) => ({ key: `custom:${cp.id}` as TabKey, label: cp.name })),
  ]

  const activeProduct = PRODUCTS.find((p) => p.slug === tab)
  const activeCustom = tab.startsWith('custom:') ? customProducts.find((cp) => `custom:${cp.id}` === tab) : undefined

  const handleAdded = (product: CustomProduct) => {
    setCustomProducts((prev) => [product, ...prev])
    setShowAddModal(false)
    setTab(`custom:${product.id}`)
  }

  const handleDeleted = (id: string) => {
    setCustomProducts((prev) => prev.filter((cp) => cp.id !== id))
    setTab('overview')
  }

  return (
    <div>
      <div className="page-header flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)' }}>
            <Boxes size={17} style={{ color: 'rgb(167,139,250)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Products</h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgb(100,106,135)' }}>
              What we build, why it&apos;s a market fit, the gap it fills, and how we compare — ready to share in any meeting.
            </p>
          </div>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-ai" style={{ fontSize: '12px' }}>
          <Plus size={13} /> Add product
        </button>
      </div>

      <div className="p-8 max-w-[1100px] mx-auto">
        {setupNeeded && (
          <div className="mb-5 p-3.5 rounded-xl text-[11px]" style={{ color: 'rgb(180,170,120)', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
            Run <code className="px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.07)' }}>supabase/add-custom-products.sql</code> in your Supabase SQL editor to enable adding your own products.
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {tabs.map((t) => {
            const isActive = tab === t.key
            const accent = t.key === 'overview'
              ? null
              : t.key.startsWith('custom:')
                ? CUSTOM_ACCENT
                : ACCENT[PRODUCTS.find((p) => p.slug === t.key)!.accent]
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="btn"
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  background: isActive ? (accent ? accent.bg : 'rgba(124,58,237,0.14)') : 'rgba(255,255,255,0.04)',
                  color: isActive ? (accent ? accent.color : 'rgb(167,139,250)') : 'var(--text-3)',
                  border: `1px solid ${isActive ? (accent ? accent.border : 'rgba(124,58,237,0.25)') : 'var(--border)'}`,
                }}
              >
                {t.label}
              </button>
            )
          })}
          {loadingCustom && <Loader2 size={13} className="animate-spin" style={{ color: 'var(--text-3)' }} />}
        </div>

        {tab === 'overview' && (
          <OverviewTab
            customProducts={customProducts}
            onSelect={setTab}
            onSelectCustom={(id) => setTab(`custom:${id}`)}
            onAddClick={() => setShowAddModal(true)}
          />
        )}
        {activeProduct && <ProductDetail product={activeProduct} />}
        {activeCustom && <CustomProductDetail product={activeCustom} onDeleted={handleDeleted} />}
      </div>

      {showAddModal && <AddProductModal onClose={() => setShowAddModal(false)} onAdded={handleAdded} />}
    </div>
  )
}
