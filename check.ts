import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function main() {
  const { data, error } = await supabase
    .from('leads')
    .select('id, company_name, status, updated_at, contacted_at')
    .order('updated_at', { ascending: false })
    .limit(10)
    
  console.log('Leads:', data)
  console.log('Error:', error)
}

main()
