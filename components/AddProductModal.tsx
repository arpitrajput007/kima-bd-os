'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { X, Sparkles, Loader2, Link2, FileUp, FileText, File } from 'lucide-react'
import type { CustomProduct } from '@/lib/types'

interface Props {
  onClose: () => void
  onAdded: (product: CustomProduct) => void
}

type SourceMode = 'url' | 'document' | 'text'

const MODES: { key: SourceMode; label: string; icon: typeof Link2 }[] = [
  { key: 'url', label: 'URL', icon: Link2 },
  { key: 'document', label: 'Document', icon: FileUp },
  { key: 'text', label: 'Paste text', icon: FileText },
]

export default function AddProductModal({ onClose, onAdded }: Props) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState<SourceMode>('url')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canSubmit =
    name.trim().length > 0 &&
    !loading &&
    (mode === 'url' ? url.trim().startsWith('http') : mode === 'document' ? !!file : text.trim().length >= 50)

  const submit = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError('')
    try {
      let res: Response
      if (mode === 'document' && file) {
        const fd = new FormData()
        fd.append('name', name.trim())
        fd.append('file', file)
        res = await fetch('/api/ai/product-research', { method: 'POST', body: fd })
      } else {
        res = await fetch('/api/ai/product-research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            sourceType: mode,
            content: mode === 'url' ? url.trim() : text.trim(),
          }),
        })
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Research failed')
      toast.success(`${name.trim()} researched and added`)
      onAdded(data.product as CustomProduct)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Research failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', zIndex: 10000 }}
      onClick={loading ? undefined : onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg flex flex-col fade-in"
        style={{ background: 'rgb(15,16,24)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, maxHeight: '88vh', boxShadow: '0 24px 64px rgba(0,0,0,0.45)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}>
              <Sparkles size={16} style={{ color: 'rgb(167,139,250)' }} />
            </div>
            <div>
              <div className="text-[14px] font-semibold text-white">Add a product</div>
              <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>Paste a URL, upload a doc, or describe it — the agent researches the rest</div>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={loading} className="btn btn-ghost" style={{ padding: 6 }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-4" style={{ flex: 1 }}>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-3)' }}>Product / service name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Kima Liquidity as a Service"
              className="input-dark"
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-3)' }}>Source</label>
            <div className="flex items-center gap-2 mb-3">
              {MODES.map(m => {
                const isActive = mode === m.key
                const Icon = m.icon
                return (
                  <button
                    key={m.key}
                    type="button"
                    disabled={loading}
                    onClick={() => setMode(m.key)}
                    className="btn"
                    style={{
                      padding: '7px 12px',
                      fontSize: '12px',
                      background: isActive ? 'rgba(124,58,237,0.14)' : 'rgba(255,255,255,0.04)',
                      color: isActive ? 'rgb(167,139,250)' : 'var(--text-3)',
                      border: `1px solid ${isActive ? 'rgba(124,58,237,0.25)' : 'var(--border)'}`,
                    }}
                  >
                    <Icon size={12} /> {m.label}
                  </button>
                )
              })}
            </div>

            {mode === 'url' && (
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com/product"
                className="input-dark"
                disabled={loading}
              />
            )}

            {mode === 'document' && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.md"
                  className="hidden"
                  disabled={loading}
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-xl flex items-center gap-3 px-4 py-3.5 text-left"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border-strong)' }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(124,58,237,0.1)' }}>
                    <File size={14} style={{ color: 'rgb(167,139,250)' }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium truncate" style={{ color: file ? 'var(--text-1)' : 'var(--text-3)' }}>
                      {file ? file.name : 'Click to choose a file'}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>PDF, DOCX, or plain text</div>
                  </div>
                </button>
              </div>
            )}

            {mode === 'text' && (
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Paste a product description, spec sheet, or notes — the more detail, the better the analysis."
                className="input-dark"
                disabled={loading}
                rows={6}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            )}
          </div>

          {error && (
            <div className="text-[12px] rounded-lg px-3 py-2.5" style={{ color: 'rgb(251,113,133)', background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.2)' }}>
              {error}
            </div>
          )}

          {loading && (
            <div className="text-[12px] rounded-lg px-3 py-2.5 flex items-center gap-2" style={{ color: 'rgb(167,139,250)', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
              <Loader2 size={13} className="animate-spin flex-shrink-0" />
              Researching — reading the source, pulling market context, and building the analysis. This can take up to a minute.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button type="button" onClick={onClose} disabled={loading} className="btn btn-secondary" style={{ fontSize: '12px' }}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={!canSubmit} className="btn btn-ai" style={{ fontSize: '12px' }}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Research & analyze
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
