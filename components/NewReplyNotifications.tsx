'use client'

// Polls for leads that just flipped to 'replied' (set automatically by
// /api/cron/check-replies once Gmail sees a reply land in the thread) and
// toasts them so a response never gets missed.

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { MailCheck } from 'lucide-react'

interface RepliedLead {
  id: string
  company_name: string
  updated_at: string
}

const POLL_MS = 60_000

export default function NewReplyNotifications() {
  const supabase = createClient()
  const seenRef = useRef<Set<string> | null>(null)

  const poll = useCallback(async () => {
    const since = new Date(Date.now() - 3 * 86400000).toISOString()
    const { data } = await supabase
      .from('leads')
      .select('id, company_name, updated_at')
      .eq('status', 'replied')
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(20)

    const leads = (data ?? []) as RepliedLead[]

    if (seenRef.current === null) {
      // First load after mount — baseline, don't toast for history.
      seenRef.current = new Set(leads.map(l => l.id))
      return
    }

    for (const lead of leads) {
      if (seenRef.current.has(lead.id)) continue
      seenRef.current.add(lead.id)
      toast.success(`${lead.company_name} replied!`, {
        description: 'Go check the thread and close the loop.',
        icon: <MailCheck size={16} />,
        duration: 10_000,
        action: {
          label: 'Open',
          onClick: () => { window.location.href = '/crm' },
        },
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    poll()
    const timer = setInterval(poll, POLL_MS)
    return () => clearInterval(timer)
  }, [poll])

  return null
}
