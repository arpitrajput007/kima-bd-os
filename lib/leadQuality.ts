// ============================================================
// Shared lead-quality heuristics.
// isGenericName() rejects category/segment labels that slip in as if they were
// real companies (e.g. "Crypto Exchanges", "Banks", "Stablecoin Issuers").
// Used by discovery (to block new ones) and the cleanup route (to purge old ones).
// ============================================================

const GENERIC_WORDS = [
  'issuers', 'platforms', 'platform', 'providers', 'provider', 'protocols', 'protocol',
  'wallets', 'wallet', 'exchanges', 'exchange', 'companies', 'company', 'projects',
  'solutions', 'services', 'networks', 'apps', 'startups', 'builders', 'firms',
  'custody', 'custodians', 'lending', 'staking', 'bridges', 'bridge', 'aggregators',
  'neobanks', 'banks', 'bank', 'fintechs', 'fintech', 'dexs', 'dexes', 'cexs', 'rails',
  'stablecoins', 'stablecoin', 'gateways', 'processors', 'marketplaces', 'ecosystem',
  'institutions', 'enterprises', 'organizations', 'merchants', 'issuance', 'desks',
  'aggregator', 'remittance', 'payments', 'payment', 'settlements', 'settlement',
]

const GENERIC_EXACT = new Set([
  'defi', 'cefi', 'web3', 'web2', 'crypto', 'blockchain', 'payments', 'payment',
  'rwa', 'nft', 'nfts', 'dao', 'daos', 'l1', 'l2', 'cbdc', 'cbdcs', 'others', 'other',
  'banks', 'exchanges', 'wallets', 'custody', 'lending',
])

export function isGenericName(name: string): boolean {
  const n = (name || '').trim().toLowerCase()
  if (!n || n.length < 2) return true
  if (GENERIC_EXACT.has(n)) return true
  const words = n.split(/\s+/)
  // Short label made only of category words → it's a segment, not a company.
  if (words.length <= 4 && words.every(w => GENERIC_WORDS.includes(w) || GENERIC_EXACT.has(w))) return true
  // Ends in a category word with only generic/qualifier tokens before it
  // (e.g. "Cross-border Payment Providers", "Crypto Exchanges").
  const last = words[words.length - 1]
  if (GENERIC_WORDS.includes(last) && words.every(w =>
    GENERIC_WORDS.includes(w) || GENERIC_EXACT.has(w) ||
    /^(cross|on|off|multi|inter|de|cross-border|fiat|tokenized|digital|institutional|crypto|web3|global|major|large|small|traditional|regional)/.test(w)
  )) return true
  return false
}
