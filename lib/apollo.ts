// ============================================================
// Apollo.io API client.
//
// NOTE ON KEY TIER: standard API keys (like this project uses) can access
//   - POST /v1/mixed_companies/search   → find companies by keyword
//   - POST /v1/people/match             → enrich/verify a known person (+email)
// but NOT the master-only people search / org enrich endpoints. So contact
// discovery works by ENRICHING candidate names (from the AI), not by raw search.
//
// All functions fail soft (return [] / null) so the agent keeps working even
// if the key is missing, the endpoint is gated, or Apollo errors.
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

export interface ApolloContact {
  name: string | null
  title: string | null
  linkedin_url: string | null
  email: string | null
  email_status: string | null
  seniority: string | null
}

interface ApolloPerson {
  name?: string; first_name?: string; last_name?: string; title?: string
  linkedin_url?: string; email?: string; email_status?: string; seniority?: string
}

function emailDomain(email?: string | null): string {
  if (!email) return ''
  const at = email.lastIndexOf('@')
  return at >= 0 ? email.slice(at + 1).toLowerCase() : ''
}

// Verify/enrich ONE known person via People Match. Returns a contact only when
// Apollo's match is trustworthy for this company — i.e. the returned work email
// is on the company's own domain (this filters out wrong-person mismatches).
// reveal=true also unlocks personal emails (costs an extra Apollo credit).
export async function apolloMatchPerson(input: {
  name: string
  domain: string
  organizationName?: string
  reveal?: boolean
}): Promise<ApolloContact | null> {
  if (!apolloConfigured()) return null
  const domain = toDomain(input.domain)
  if (!input.name || !domain) return null
  try {
    const body: Record<string, unknown> = { name: input.name, domain }
    if (input.organizationName) body.organization_name = input.organizationName
    if (input.reveal) body.reveal_personal_emails = true

    const res = await fetch(`${APOLLO_BASE}/people/match`, {
      method: 'POST', headers: headers(), body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const p: ApolloPerson | undefined = data?.person
    if (!p) return null

    const name = p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || null
    // Trust the email only when it sits on the company's own domain — this is the
    // guard that prevents Apollo's fuzzy name-matching from attaching a stranger.
    const email = emailDomain(p.email) === domain ? (p.email as string) : null

    // If we couldn't confirm via domain-matched email, the whole match is suspect.
    if (!email) return null

    return {
      name,
      title: p.title || null,
      linkedin_url: p.linkedin_url || null,
      email,
      email_status: p.email_status || null,
      seniority: p.seniority || null,
    }
  } catch { return null }
}

// Enrich a batch of candidate names (e.g. from the AI's suggested contacts).
export async function apolloEnrichContacts(
  domain: string,
  organizationName: string,
  candidates: { name?: string | null; role?: string | null }[],
  opts: { reveal?: boolean; limit?: number } = {}
): Promise<ApolloContact[]> {
  const d = toDomain(domain)
  if (!apolloConfigured() || !d) return []
  const named = candidates.filter(c => c.name && String(c.name).trim().length > 2 && !/^null$/i.test(String(c.name).trim()))
  const out: ApolloContact[] = []
  const limit = opts.limit ?? 3
  for (const c of named.slice(0, limit)) {
    const hit = await apolloMatchPerson({ name: String(c.name), domain: d, organizationName, reveal: opts.reveal })
    if (hit) out.push(hit)
  }
  return out
}

export interface ApolloPersonResult {
  name: string; title: string; email?: string; linkedin_url?: string; seniority?: string
}

// Search Apollo for people at a company by domain. Uses the mixed_people/search endpoint.
// Returns verified contacts with real names, titles, and emails where available.
export async function apolloSearchPeople(companyName: string, domain: string): Promise<ApolloPersonResult[]> {
  if (!apolloConfigured() || !domain) return []
  try {
    const res = await fetch(`${APOLLO_BASE}/mixed_people/search`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({
        q_organization_domains: [domain],
        person_seniorities: ['owner', 'founder', 'c_suite', 'vp', 'director', 'manager'],
        page: 1, per_page: 10,
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const data = await res.json()
    interface ApolloPeopleResult { name?: string; title?: string; email?: string; linkedin_url?: string; seniority?: string; email_status?: string }
    const people: ApolloPeopleResult[] = Array.isArray(data?.people) ? data.people : []
    return people
      .filter(p => p.name && p.name.toLowerCase() !== 'unknown')
      .map(p => ({
        name: p.name || '',
        title: p.title || '',
        email: p.email_status === 'verified' || p.email_status === 'likely to engage' ? p.email : undefined,
        linkedin_url: p.linkedin_url || undefined,
        seniority: p.seniority || undefined,
      }))
  } catch { return [] }
}

export interface ApolloCompany { name: string; website: string; description: string; source_url: string }

// Search Apollo for companies matching free-text keyword tags (a "find companies" source).
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
    interface Org { name?: string; website_url?: string; primary_domain?: string; short_description?: string; industry?: string; keywords?: string[]; linkedin_url?: string }
    const orgs: Org[] = Array.isArray(data?.organizations) ? data.organizations
      : Array.isArray(data?.accounts) ? data.accounts : []
    return orgs.map(o => {
      const website = o.website_url || (o.primary_domain ? `https://${o.primary_domain}` : '')
      const desc = o.short_description
        || [o.industry, o.keywords?.slice(0, 5).join(', ')].filter(Boolean).join(' — ')
        || `Company matching "${query}"`
      return { name: o.name || '', website, description: desc, source_url: o.linkedin_url || website }
    }).filter(c => c.name)
  } catch { return [] }
}
