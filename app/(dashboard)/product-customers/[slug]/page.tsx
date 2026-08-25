'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, ArrowRight, Database, Compass } from 'lucide-react'
import { getProductSection } from '@/lib/product-sections'
import { notFound } from 'next/navigation'

export default function ProductCustomersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const section = getProductSection(slug)
  if (!section) notFound()

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5 fade-in">
      <div>
        <Link href="/leads" className="inline-flex items-center gap-1.5 text-[12px] mb-3" style={{ color: 'var(--text-3)' }}>
          <ArrowLeft size={13} /> Lead Inbox
        </Link>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Users size={20} style={{ color: 'var(--text-2)' }} />
          {section.label} Customers
        </h1>
      </div>

      <div className="section-card p-6 text-center space-y-4">
        <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>
          {section.label} doesn&apos;t have a dedicated customer list wired up yet. Set the hunting approach and add
          resources first, then this page will be wired to pull matching leads once that pipeline exists.
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Link href={`/product-approach/${slug}`} className="btn btn-secondary">
            <Compass size={14} /> Set hunting approach
          </Link>
          <Link href={`/product-resources/${slug}`} className="btn btn-secondary">
            <Database size={14} /> Manage resources
          </Link>
          <Link href="/leads" className="btn btn-ghost">
            View all leads <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}
