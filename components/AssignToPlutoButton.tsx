'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { UserPlus, UserCheck, Loader2 } from 'lucide-react'
import { assignLeadToPluto } from '@/lib/pluto'

export function AssignToPlutoButton({
  companyName,
  createFields,
  initialAssigned = false,
  compact = false,
  onAssigned,
}: {
  companyName: string
  /** Fields to insert a new lead with if this company isn't in the pipeline yet. Omit to only allow assigning existing leads. */
  createFields?: Record<string, unknown>
  initialAssigned?: boolean
  compact?: boolean
  onAssigned?: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [assigned, setAssigned] = useState(initialAssigned)

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setLoading(true)
    const res = await assignLeadToPluto(companyName, createFields)
    setLoading(false)
    if (res.ok) {
      setAssigned(true)
      toast.success(res.created ? `${companyName} added to pipeline & assigned to Pluto` : `${companyName} assigned to Pluto`)
      onAssigned?.()
    } else {
      toast.error(res.error || `Couldn't assign ${companyName}`)
    }
  }

  if (assigned) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#fbbf24',
        padding: compact ? '5px 10px' : '6px 12px',
      }}>
        <UserCheck size={12} /> With Pluto
      </span>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title="Assign this company to Pluto for outreach — creates the lead if it isn't in your pipeline yet"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: compact ? '5px 10px' : '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
        border: '1px solid rgba(251,191,36,0.35)', background: 'rgba(251,191,36,0.1)', color: '#fbbf24',
        whiteSpace: 'nowrap',
      }}
    >
      {loading ? <Loader2 size={11} className="animate-spin" /> : <UserPlus size={11} />}
      Assign to Pluto
    </button>
  )
}
