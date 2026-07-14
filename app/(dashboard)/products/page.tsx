'use client'

import { useState } from 'react'
import {
  Boxes, Check, X, ArrowRight, Sparkles, Package, Landmark, ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { PRODUCTS, COMPANY_ONE_LINER, TOGETHER_LINE, type Product } from '@/lib/products-showcase'

const ACCENT: Record<Product['accent'], { color: string; bg: string; border: string; icon: LucideIcon }> = {
  violet: { color: 'rgb(167,139,250)', bg: 'rgba(124,58,237,0.1)', border: 'rgba(124,58,237,0.25)', icon: Package },
  blue:   { color: 'rgb(96,165,250)',  bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.25)',  icon: Landmark },
  cyan:   { color: 'rgb(103,232,249)', bg: 'rgba(6,182,212,0.1)',   border: 'rgba(6,182,212,0.25)',   icon: ShieldCheck },
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)', letterSpacing: '0.08em' }}>
      {children}
    </div>
  )
}

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
    <div className="space-y-6 fade-in">
      {/* Hero */}
      <div className="section-card p-6">
        <div className="flex items-start gap-4 flex-wrap justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: a.bg, border: `1px solid ${a.border}` }}>
              <Icon size={22} style={{ color: a.color }} />
            </div>
            <div>
              <div className="badge mb-2" style={{ color: a.color, background: a.bg, borderColor: a.border }}>
                {product.category}
              </div>
              <h2 className="text-xl font-bold text-white">{product.name}</h2>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-2)' }}>{product.tagline}</p>
            </div>
          </div>
        </div>
        {product.credibility && (
          <div className="mt-4 pt-4 text-[12px]" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-3)' }}>
            {product.credibility}
          </div>
        )}
      </div>

      {/* What it is */}
      <div className="section-card p-6">
        <SectionLabel>What it is</SectionLabel>
        <BulletList items={product.whatItIs} color={a.color} />
      </div>

      {/* Sub-products */}
      <div className="section-card p-6">
        <SectionLabel>Products under {product.name}</SectionLabel>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {product.subProducts.map((sp) => (
            <div key={sp.name} className="rounded-xl p-4 card-hover" style={{ background: 'rgb(var(--bg-surface-3))', border: '1px solid var(--border)' }}>
              <div className="text-[13px] font-semibold text-white mb-1.5">{sp.name}</div>
              <div className="text-[12.5px] leading-relaxed mb-3" style={{ color: 'var(--text-2)' }}>{sp.description}</div>
              <div className="text-[11px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
                <span className="font-semibold" style={{ color: a.color }}>Best fit — </span>
                {sp.bestFit}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Market fit + Gap filled */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div className="section-card p-6">
          <SectionLabel>Why it&apos;s a market fit</SectionLabel>
          <BulletList items={product.marketFit} color="rgb(52,211,153)" />
        </div>
        <div className="section-card p-6">
          <SectionLabel>The gap it fills</SectionLabel>
          <BulletList items={product.gapFilled} color="rgb(251,191,36)" />
        </div>
      </div>

      {/* Competitors */}
      <div className="section-card p-6">
        <SectionLabel>Competitors &amp; how we&apos;re better</SectionLabel>
        <div className="space-y-3">
          {product.competitors.map((c) => (
            <div key={c.name} className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-surface-3))', border: '1px solid var(--border)' }}>
              <div className="text-[13px] font-semibold text-white mb-3">{c.name}</div>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                <div className="flex items-start gap-2">
                  <X size={14} className="flex-shrink-0 mt-[3px]" style={{ color: 'rgb(251,113,133)' }} />
                  <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{c.weakness}</div>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="flex-shrink-0 mt-[3px]" style={{ color: 'rgb(52,211,153)' }} />
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
    <div className="space-y-6 fade-in">
      <div className="section-card p-6" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(6,182,212,0.05))' }}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={15} style={{ color: 'rgb(167,139,250)' }} />
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgb(167,139,250)', letterSpacing: '0.08em' }}>Kima Finance</span>
        </div>
        <p className="text-[15px] leading-relaxed text-white">{COMPANY_ONE_LINER}</p>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {PRODUCTS.map((p) => {
          const a = ACCENT[p.accent]
          const Icon = a.icon
          return (
            <button
              key={p.slug}
              onClick={() => onSelect(p.slug)}
              className="section-card card-hover p-5 text-left"
              style={{ cursor: 'pointer' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: a.bg, border: `1px solid ${a.border}` }}>
                  <Icon size={17} style={{ color: a.color }} />
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

      <div className="section-card p-6">
        <SectionLabel>How the three work together</SectionLabel>
        <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{TOGETHER_LINE}</p>
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
        <div className="flex items-center gap-2 mb-6 flex-wrap">
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
