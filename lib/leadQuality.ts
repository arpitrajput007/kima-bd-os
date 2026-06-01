// ============================================================
// Shared lead-quality heuristics.
// isGenericName() is a CHEAP first-pass that rejects obvious category/segment
// labels masquerading as companies (e.g. "Crypto Exchanges", "Banks",
// "Infrastructure", "AI"). It is intentionally aggressive. The authoritative
// check is the AI classifier (classifyCompanyNames) — this is just the fast gate.
// ============================================================

// Single tokens that are never a company on their own (sector / tech / segment words).
const GENERIC_EXACT = new Set([
  'defi', 'cefi', 'web3', 'web2', 'crypto', 'cryptocurrency', 'blockchain', 'blockchains',
  'payments', 'payment', 'rwa', 'rwas', 'nft', 'nfts', 'dao', 'daos', 'l1', 'l2', 'cbdc', 'cbdcs',
  'others', 'other', 'misc', 'general', 'various', 'tbd', 'unknown', 'na',
  'ai', 'ml', 'genai', 'agents', 'agentic', 'infra', 'infrastructure', 'analytics',
  'technology', 'technologies', 'tech', 'data', 'software', 'hardware', 'tools', 'tooling',
  'finance', 'fintech', 'fintechs', 'banking', 'banks', 'bank', 'neobanks', 'neobank',
  'exchanges', 'exchange', 'wallets', 'wallet', 'custody', 'custodians', 'lending', 'staking',
  'bridges', 'bridge', 'aggregators', 'aggregator', 'launchpads', 'launchpad', 'dex', 'dexs',
  'dexes', 'cex', 'cexs', 'cexes', 'stablecoins', 'stablecoin', 'remittance', 'remittances',
  'treasury', 'gaming', 'igaming', 'merchants', 'merchant', 'protocols', 'protocol',
  'platforms', 'platform', 'networks', 'network', 'solutions', 'solution', 'services', 'service',
  'applications', 'application', 'apps', 'app', 'products', 'product', 'startups', 'startup',
  'enterprises', 'enterprise', 'institutions', 'institution', 'businesses', 'business',
  'organizations', 'organization', 'companies', 'company', 'firms', 'firm', 'vendors', 'vendor',
  'providers', 'provider', 'operators', 'operator', 'players', 'player', 'markets', 'market',
  'sectors', 'sector', 'industries', 'industry', 'ecosystems', 'ecosystem', 'projects', 'project',
  'issuers', 'issuer', 'processors', 'processor', 'gateways', 'gateway', 'marketplaces', 'marketplace',
  'rails', 'rail', 'settlements', 'settlement', 'desks', 'desk', 'funds', 'fund', 'wallets', 'chains', 'chain',
])

// Words that, as the LAST word of a multi-word name, make it a category
// ("Lending Platforms", "Cross-border Payment Providers").
const GENERIC_TAIL = new Set([
  'platforms', 'platform', 'providers', 'provider', 'protocols', 'protocol', 'wallets', 'wallet',
  'exchanges', 'exchange', 'companies', 'company', 'projects', 'solutions', 'services', 'service',
  'networks', 'apps', 'startups', 'builders', 'firms', 'issuers', 'custody', 'custodians',
  'bridges', 'aggregators', 'neobanks', 'banks', 'bank', 'fintechs', 'fintech', 'dexs', 'dexes',
  'cexs', 'rails', 'stablecoins', 'gateways', 'processors', 'marketplaces', 'institutions',
  'enterprises', 'organizations', 'merchants', 'desks', 'tools', 'systems', 'infrastructure',
  'analytics', 'technologies', 'technology', 'finance',
])

// Qualifier prefixes that don't make a category specific.
const QUALIFIER = /^(cross|border|cross-border|on|off|multi|inter|de|fiat|tokenized|digital|institutional|crypto|web3|web2|global|major|large|small|traditional|regional|defi|cefi|enterprise|real-world|real|world|asset|data|payment|payments|settlement|blockchain|decentralized|centralized|smart|onchain|on-chain|b2b|b2c|p2p|next-gen|nextgen|emerging|leading|top|key|various|several|many|consumer|retail|wholesale)$/

export function isGenericName(name: string): boolean {
  const raw = (name || '').trim()
  if (!raw || raw.length < 2) return true
  const n = raw.toLowerCase().replace(/[.,]/g, '')
  const words = n.split(/[\s/&-]+/).filter(Boolean)

  if (words.length === 0) return true
  // Single-word category (e.g. "Infrastructure", "AI", "Payments", "Fintech").
  if (words.length === 1) return GENERIC_EXACT.has(words[0])
  // Every token is a generic/qualifier word → it's a segment, not a company.
  if (words.every(w => GENERIC_EXACT.has(w) || QUALIFIER.test(w))) return true
  // Ends in a category word and the rest are only generic/qualifier tokens
  // (e.g. "Analytics Platforms", "Cross-border Payment Providers").
  const last = words[words.length - 1]
  if (GENERIC_TAIL.has(last) && words.slice(0, -1).every(w => GENERIC_EXACT.has(w) || QUALIFIER.test(w))) return true
  return false
}
