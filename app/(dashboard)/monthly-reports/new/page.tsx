'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import DealForm from '@/components/monthly-reports/DealForm'
import type { DealFormData } from '@/components/monthly-reports/DealForm'
import { currentMonthYear } from '@/lib/monthly-reports-types'

export default function NewDealPage() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  async function handleSave(data: DealFormData) {
    setSaving(true)
    try {
      const { data: created, error } = await supabase
        .from('monthly_deals')
        .insert({
          ...data,
          products_interested: data.products_interested,
          products_proposed:   data.products_proposed,
          product_feedback:    data.product_feedback,
          blockers:            data.blockers,
          // "" is not a valid Postgres `date` — an unset close date must be null.
          expected_close_date: data.expected_close_date || null,
          // Nothing on this form is required — company_name is NOT NULL in the
          // DB, so fall back to a placeholder rather than blocking the save.
          company_name: data.company_name.trim() || 'Untitled Deal',
        })
        .select('id')
        .single()

      if (error) throw error
      toast.success('Deal added successfully')
      router.push(`/monthly-reports/${created.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || 'Failed to save deal'
      toast.error(msg)
      setSaving(false)
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header flex items-center gap-4">
        <Link href="/monthly-reports" className="btn btn-ghost" style={{ fontSize: '12px', gap: '6px', textDecoration: 'none' }}>
          <ArrowLeft size={13} />Back
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Add New Deal</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgb(100,100,120)' }}>
            Track a new opportunity — fill in as much or as little as you know now.
          </p>
        </div>
      </div>
      <div style={{ padding: '28px 36px' }}>
        <DealForm
          defaultMonthYear={currentMonthYear()}
          saving={saving}
          onSave={handleSave}
          onCancel={() => router.push('/monthly-reports')}
        />
      </div>
    </div>
  )
}
