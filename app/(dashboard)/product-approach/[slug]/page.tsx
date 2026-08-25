'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ArrowLeft, Compass, Save, Loader2, ArrowRight } from 'lucide-react'
import { getProductSection } from '@/lib/product-sections'
import { formatDate } from '@/lib/utils'
import { notFound } from 'next/navigation'

export default function ProductApproachPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const section = getProductSection(slug)
  if (!section) notFound()

  const supabase = createClient()
  const [text, setText] = useState('')
  const [savedText, setSavedText] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    supabase.from('product_hunting_approach').select('approach_text, updated_at').eq('product_slug', slug).maybeSingle()
      .then(({ data }) => {
        setText(data?.approach_text || '')
        setSavedText(data?.approach_text || '')
        setUpdatedAt(data?.updated_at || null)
        setLoading(false)
      })
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('product_hunting_approach')
      .upsert({ product_slug: slug, approach_text: text, updated_at: new Date().toISOString() }, { onConflict: 'product_slug' })
    setSaving(false)
    if (error) { toast.error('Failed to save'); return }
    setSavedText(text)
    setUpdatedAt(new Date().toISOString())
    toast.success('Hunting approach saved')
  }

  const dirty = text !== savedText

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5 fade-in">
      <div>
        <Link href="/sources" className="inline-flex items-center gap-1.5 text-[12px] mb-3" style={{ color: 'var(--text-3)' }}>
          <ArrowLeft size={13} /> Back
        </Link>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Compass size={20} style={{ color: 'var(--text-2)' }} />
          {section.label} Customer Hunting Approach
        </h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-3)' }}>
          The strategy the agent should use to find {section.label} customers. Paste in your own notes at any time — this
          becomes the primary instruction the agent follows when you ask it to <Link href={`/product-resources/${slug}`} className="underline inline-flex items-center gap-1" style={{ color: 'var(--text-2)' }}>suggest resources <ArrowRight size={11} /></Link>.
        </p>
      </div>

      <div className="section-card p-4 space-y-3">
        {loading ? (
          <div className="p-8 text-center"><Loader2 size={20} className="animate-spin mx-auto" style={{ color: 'var(--text-3)' }} /></div>
        ) : (
          <>
            <textarea
              className="input w-full"
              rows={14}
              style={{ fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical' }}
              placeholder={section.defaultApproachPlaceholder}
              value={text}
              onChange={e => setText(e.target.value)}
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                {updatedAt ? `Last saved ${formatDate(updatedAt)}` : 'Not saved yet'}
              </span>
              <button className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save approach
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
