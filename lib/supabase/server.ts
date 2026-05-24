import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Simple server-side Supabase client — no auth required
export async function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
