import { createClient } from '@/lib/supabase/client'

export interface AssignToPlutoResult {
  ok: boolean
  created: boolean
  error?: string
}

/**
 * Assigns a company to Pluto by name. If the company already has a lead
 * row, it's just flagged assigned_to='pluto'. If not, `createFields` is
 * used to insert a brand-new lead (pre-assigned) so nothing needs to be
 * manually added to the pipeline first.
 */
export async function assignLeadToPluto(
  companyName: string,
  createFields?: Record<string, unknown>
): Promise<AssignToPlutoResult> {
  const supabase = createClient()

  const { data: existing, error: lookupError } = await supabase
    .from('leads')
    .select('id')
    .eq('company_name', companyName)
    .order('created_at', { ascending: false })
    .limit(1)

  if (lookupError) return { ok: false, created: false, error: lookupError.message }

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from('leads')
      .update({ assigned_to: 'pluto', updated_at: new Date().toISOString() })
      .eq('id', existing[0].id)
    return { ok: !error, created: false, error: error?.message }
  }

  if (!createFields) return { ok: false, created: false, error: 'Not in your pipeline yet' }

  const { error } = await supabase.from('leads').insert({
    company_name: companyName,
    status: 'new',
    assigned_to: 'pluto',
    updated_at: new Date().toISOString(),
    ...createFields,
  })
  return { ok: !error, created: true, error: error?.message }
}
