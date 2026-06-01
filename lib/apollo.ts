// ============================================================
// Apollo.io API client — real companies & verified contacts.
// All functions fail soft (return [] / null) so the agent keeps
// working even if the key is missing or Apollo errors.
// ============================================================

const APOLLO_BASE = 'https://api.apollo.io/api/v1'

export function apolloConfigured(): boolean {
  return !!process.env.APOLLO_API_KEY
}

function headers() {
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'X-Api-Key': process.env.APOLLO_API_KEY || '',
  }
}

// Strip protocol/path → bare domain (apollo keys on domain).
export function toDomain(websiteOrDomain?: string): string {
  if (!websiteOrDomain) return ''
  return websiteOrDomain.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').trim().toLowerCase()
}

// Default BD decision-maker titles to target.
export const BD_TITLES = [
  'Head of Partnerships', 'Head of Business Development', 'VP Partnerships',
  'VP Business Development', 'Partnerships', 'Business Development',
  'Chief Business Officer', 'Head of Growth', 'CEO', 'Founder', 'Co-Founder', 'CTO',
]

export interface ApolloContact {
  name: string | null
  first_name?: string
  last_name?: string
  title: string | null
  linkedin_url: string | null
  email: string | null
  email_status: string | null
  seniority: string | null
}

export interface ApolloOrg {
  name?: string
  website_url?: string
  primary_domain?: string
  industry?: string
  short_description?: string
  keywords?: string[]
  estimated_num_employees?: number
  annual_revenue?: number
  founded_year?: number
  linkedin_url?: string
  country?: string
}

// An Apollo email is only useful when it's actually unlocked & not a placeholder.
function realEmail(email?: string | null, status?: string | null): string | null {
  if (!email) return null
  if (/email_not_unlocked|not_unlocked|@domain\.com$/i.test(email)) return null
  if (status === 'unavailable') return null
  return email
}

interface ApolloPerson {
  name?: string; first_name?: string; last_name?: string; title?: string
  linkedin_url?: string; email?: string; email_status?: string; seniority?: string
}

// Reveal a single person's email via People Match (costs an Apollo credit).
async function revealEmail(p: ApolloPerson): Promise<{ email: string | null; status: string | null }> {
  try {
    const body: Record<string, unknown> = { reveal_personal_emails: true }
    if (p.linkedin_url) body.linkedin_url = p.linkedin_url
    else if (p.first_name && p.last_name) { body.first_name = p.first_name; body.last_name = p.last_name }
    const res = await fetch(`${APOLLO_BASE}/people/match`, {
      method: 'POST', headers: headers(), body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return { email: null, status: null }
    const data = await res.json()
    const person = data?.person
    return { email: realEmail(person?.email, person?.email_status), status: person?.email_status || null }
  } catch { return { email: null, status: null } }
}

// Find decision-maker contacts at a company by domain.
// opts.reveal → unlock real emails for the top `opts.revealLimit` people (credit cost).
export async function apolloFindContacts(
  domain: string,
  titles: string[] = BD_TITLES,
  opts: { perPage?: number; reveal?: boolean; revealLimit?: number } = {}
): Promise<ApolloContact[]> {
  if (!apolloConfigured()) return []
  const d = toDomain(domain)
  if (!d) return []
  try {
    const res = await fetch(`${APOLLO_BASE}/mixed_people/search`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({
        q_organization_domains: d,
        person_titles: titles,
        person_seniorities: ['owner', 'founder', 'c_suite', 'partner', 'vp', 'head', 'director'],
        page: 1,
        per_page: opts.perPage || 5,
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const data = await res.json()
    const people: ApolloPerson[] = Array.isArray(data?.people) ? data.people : []
    const mapped: ApolloContact[] = people.map(p => ({
      name: p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
      first_name: p.first_name,
      last_name: p.last_name,
      title: p.title || null,
      linkedin_url: p.linkedin_url || null,
      email: realEmail(p.email, p.email_status),
      email_status: p.email_status || null,
      seniority: p.seniority || null,
    }))

    if (opts.reveal) {
      const limit = opts.revealLimit ?? 2
      for (let i = 0; i < mapped.length && i < limit; i++) {
        if (!mapped[i].email) {
          const r = await revealEmail(people[i])
          if (r.email) { mapped[i].email = r.email; mapped[i].email_status = r.status }
        }
      }
    }
    return mapped
  } catch { return [] }
}

// Enrich a single organization by domain.
export async function apolloEnrichOrganization(domain: string): Promise<ApolloOrg | null> {
  if (!apolloConfigured()) return null
  const d = toDomain(domain)
  if (!d) return null
  try {
    const res = await fetch(`${APOLLO_BASE}/organizations/enrich?domain=${encodeURIComponent(d)}`, {
      method: 'GET', headers: headers(), signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data?.organization as ApolloOrg) || null
  } catch { return null }
}

export interface ApolloCompany { name: string; website: string; description: string; source_url: string }

// Search Apollo for companies matching free-text keywords (a "find companies" source).
export async function apolloSearchCompanies(query: string, size = 15): Promise<ApolloCompany[]> {
  if (!apolloConfigured() || !query.trim()) return []
  try {
    const res = await fetch(`${APOLLO_BASE}/mixed_companies/search`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({
        q_organization_keyword_tags: query.split(',').map(s => s.trim()).filter(Boolean),
        page: 1,
        per_page: Math.min(size, 25),
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return []
    const data = await res.json()
    const orgs: ApolloOrg[] = Array.isArray(data?.organizations) ? data.organizations
      : Array.isArray(data?.accounts) ? data.accounts : []
    return orgs.map(o => {
      const website = o.website_url || (o.primary_domain ? `https://${o.primary_domain}` : '')
      const desc = o.short_description
        || [o.industry, o.keywords?.slice(0, 4).join(', ')].filter(Boolean).join(' — ')
        || ''
      return {
        name: o.name || '',
        website,
        description: desc,
        source_url: o.linkedin_url || website,
      }
    }).filter(c => c.name)
  } catch { return [] }
}
