'use client'

import { useState } from 'react'
import {
  Boxes, Check, X, ArrowRight, Sparkles, Package, Landmark, ShieldCheck,
  Layers, TrendingUp, Target, Swords, Quote,
  type LucideIcon,
} from 'lucide-react'
import { PRODUCTS, COMPANY_ONE_LINER, TOGETHER_LINE, type Product } from '@/lib/products-showcase'
import { SectionHeader } from '@/components/monthly-reports/ui'

const ACCENT: Record<Product['accent'], { color: string; bg: string; border: string; gradient: string; icon: LucideIcon }> = {
  violet: { color: 'rgb(167,139,250)', bg: 'rgba(124,58,237,0.1)', border: 'rgba(124,58,237,0.25)', gradient: 'linear-gradient(135deg, #7c3aed, #4f46e5)', icon: Package },
  blue:   { color: 'rgb(96,165,250)',  bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.25)',  gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', icon: Landmark },
  cyan:   { color: 'rgb(103,232,249)', bg: 'rgba(6,182,212,0.1)',   border: 'rgba(6,182,212,0.25)',   gradient: 'linear-gradient(135deg, #06b6d4, #0e7490)', icon: ShieldCheck },
}

const EMERALD = 'rgb(52,211,153)'
const AMBER = 'rgb(251,191,36)'
const ROSE = 'rgb(251,113,133)'

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

function OverviewTab({ onSelect }: { onSelect: (slug: Product['slug']) => void }) {
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

export default function ProductsPage() {
  const [tab, setTab] = useState<'overview' | Product['slug']>('overview')

  const tabs: { key: 'overview' | Product['slug']; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    ...PRODUCTS.map((p) => ({ key: p.slug, label: p.name })),
  ]

  const activeProduct = PRODUCTS.find((p) => p.slug === tab)

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
      </div>

      <div className="p-8 max-w-[1100px] mx-auto">
        {/* Tabs */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {tabs.map((t) => {
            const isActive = tab === t.key
            const accent = t.key === 'overview' ? null : ACCENT[PRODUCTS.find((p) => p.slug === t.key)!.accent]
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
        </div>

        {tab === 'overview' && <OverviewTab onSelect={setTab} />}
        {activeProduct && <ProductDetail product={activeProduct} />}
      </div>
    </div>
  )
}
