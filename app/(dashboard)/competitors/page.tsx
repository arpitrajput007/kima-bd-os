'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Swords, ArrowRight, Building2, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { COMPETITOR_PRODUCTS } from '@/lib/competitor-products'

interface ProductStats {
  competitors: number
  customers: number
}

export default function CompetitorsIndexPage() {
  const [stats, setStats] = useState<Record<string, ProductStats>>({})

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    ;(async () => {
      const { data: competitors } = await supabase.from('competitors').select('id, product_slug')
      if (!competitors || cancelled) return
      const { data: customers } = await supabase.from('competitor_customers').select('id, competitor_id')
      const byId = new Map(competitors.map(c => [c.id, c.product_slug]))
      const next: Record<string, ProductStats> = {}
      for (const c of competitors) {
        next[c.product_slug] ??= { competitors: 0, customers: 0 }
        next[c.product_slug].competitors += 1
      }
      for (const row of customers || []) {
        const slug = byId.get(row.competitor_id)
        if (!slug) continue
        next[slug] ??= { competitors: 0, customers: 0 }
        next[slug].customers += 1
      }
      if (!cancelled) setStats(next)
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2">
          <Swords size={18} style={{ color: '#f87171' }} /> Competitors &amp; Customers
        </h1>
        <p className="text-[12px] mt-1 font-medium" style={{ color: 'rgb(100,106,135)' }}>
          Pick a product to see who competes with it, and which of that competitor&apos;s customers might be worth reaching out to
        </p>
      </div>

      <div style={{ padding: '20px 36px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {COMPETITOR_PRODUCTS.map(p => {
            const s = stats[p.slug]
            return (
              <Link
                key={p.slug}
                href={`/competitors/${p.slug}`}
                style={{
                  display: 'block',
                  borderRadius: 16,
                  border: `1px solid ${p.color}25`,
                  background: 'rgba(255,255,255,0.025)',
                  padding: '20px 22px',
                  textDecoration: 'none',
                  transition: 'transform 0.12s, border-color 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${p.color}60`; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = `${p.color}25`; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'white' }}>{p.name}</div>
                  <ArrowRight size={16} style={{ color: p.color }} />
                </div>
                <div style={{ fontSize: 12, color: 'rgb(150,155,185)', marginTop: 4, marginBottom: 16 }}>{p.blurb}</div>
                <div style={{ display: 'flex', gap: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgb(160,165,195)' }}>
                    <Building2 size={13} style={{ color: p.color }} />
                    {s ? s.competitors : '–'} competitor{s?.competitors === 1 ? '' : 's'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgb(160,165,195)' }}>
                    <Users size={13} style={{ color: p.color }} />
                    {s ? s.customers : '–'} customer{s?.customers === 1 ? '' : 's'} tracked
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
