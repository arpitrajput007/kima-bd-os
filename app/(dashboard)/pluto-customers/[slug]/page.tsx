'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users } from 'lucide-react'
import { getProductSection } from '@/lib/product-sections'
import { notFound } from 'next/navigation'
import { PlutoAerpoliceCustomersList } from '@/components/PlutoAerpoliceCustomersList'

// Companies Pluto (assistant) sourced himself and brought to reach out —
// kept separate from each product's own "Customers" page (which is the
// BD/agent-provided pipeline) so it's clear who found which prospect.
const PLUTO_LISTS: Record<string, boolean> = {
  aerpolice: true,
}

export default function PlutoCustomersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const section = getProductSection(slug)
  if (!section) notFound()

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5 fade-in">
      <div>
        <Link href={`/product-customers/${slug}`} className="inline-flex items-center gap-1.5 text-[12px] mb-3" style={{ color: 'var(--text-3)' }}>
          <ArrowLeft size={13} /> {section.label} Customers
        </Link>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Users size={20} style={{ color: 'var(--text-2)' }} />
          Pluto&apos;s Customers <span className="text-[13px] font-normal" style={{ color: 'var(--text-3)' }}>— {section.label}</span>
        </h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-3)' }}>
          Companies Pluto sourced himself and brought to reach out — kept separate from the {section.label} Customers
          pipeline so you can see who found which prospect.
        </p>
      </div>

      {PLUTO_LISTS[slug] ? (
        <PlutoAerpoliceCustomersList />
      ) : (
        <div className="section-card p-6 text-center">
          <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>
            Pluto hasn&apos;t brought a customer list for {section.label} yet.
          </p>
        </div>
      )}
    </div>
  )
}
