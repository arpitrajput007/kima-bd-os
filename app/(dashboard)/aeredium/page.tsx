'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Shield, Search, ExternalLink, Plus, ChevronUp, ChevronDown,
  Filter, Download, CheckCircle, Loader2,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────
interface Target {
  company: string
  category: string
  website: string
  painType: string
  evidence: string
  sourceLink: string
  currentSolution: string
  governanceGap: string
  urgencyScore: number
  accessibilityScore: number
  strategicValueScore: number
  funding: string
  linkedIn: string
}

// ── Static target data ────────────────────────────────────────
const TARGETS: Target[] = [
  // Agent Payments
  { company: 'Skyfire', category: 'Agent Payments', website: 'https://skyfire.xyz', painType: 'Identity & Liability', evidence: 'KYA protocol for agent identity; limited policy enforcement beyond verification', sourceLink: 'https://skyfire.xyz/contact', currentSolution: 'KYA Protocol for agent verification', governanceGap: 'Limited policy enforcement beyond identity verification', urgencyScore: 10, accessibilityScore: 9, strategicValueScore: 6, funding: '$10M', linkedIn: 'https://linkedin.com/company/skyfire-ai' },
  { company: 'Nevermined', category: 'Agent Payments', website: 'https://nevermined.io', painType: 'Spending Controls', evidence: 'Agent-native payment infra with metering & virtual card delegation; no cryptographic agent identity', sourceLink: 'https://nevermined.io/schedule-demo', currentSolution: 'PCI-compliant through VGS, scoped API keys', governanceGap: 'No cryptographic agent identity or threshold signing for high-value transactions', urgencyScore: 9, accessibilityScore: 8, strategicValueScore: 7, funding: 'Series A', linkedIn: 'https://linkedin.com/company/nevermined-ai' },
  { company: 'Coinbase Commerce', category: 'Agent Payments', website: 'https://commerce.coinbase.com', painType: 'Key Management', evidence: '162M+ x402 transactions, $45M volume; AgentKit wallets need cryptographic governance', sourceLink: 'https://docs.cloud.coinbase.com/agentkit', currentSolution: 'Custodial wallets, AgentKit framework', governanceGap: 'No threshold signing or policy enforcement for autonomous agents', urgencyScore: 9, accessibilityScore: 3, strategicValueScore: 9, funding: 'Public', linkedIn: 'https://linkedin.com/company/coinbase' },
  { company: 'Stripe', category: 'Agent Payments', website: 'https://stripe.com', painType: 'Autonomous Auth', evidence: '$1.9T volume; Agentic Commerce Protocol (ACP) in development — lacks cryptographic agent authorization', sourceLink: 'https://stripe.com/partners', currentSolution: '99.999% uptime, proven fraud detection', governanceGap: 'ACP still in development; lacks cryptographic agent authorization', urgencyScore: 8, accessibilityScore: 2, strategicValueScore: 10, funding: '$95B valuation', linkedIn: 'https://linkedin.com/company/stripe' },
  { company: 'PayPal', category: 'Agent Payments', website: 'https://paypal.com', painType: 'Compliance Gap', evidence: '430M users, $1.5T volume; Financial OS for AI agents — agent workflows lack policy enforcement', sourceLink: 'https://paypal.com/partners', currentSolution: 'Multiparty Compute Protocol, established fraud systems', governanceGap: 'Agent workflows lack cryptographic policy enforcement', urgencyScore: 8, accessibilityScore: 2, strategicValueScore: 10, funding: 'Public', linkedIn: 'https://linkedin.com/company/paypal' },
  { company: 'Adyen', category: 'Agent Payments', website: 'https://adyen.com', painType: 'Cross-border Compliance', evidence: '€1.4T annual volume, 150+ currencies; no agent-specific cryptographic controls', sourceLink: 'https://adyen.com/partners', currentSolution: '99.999% uptime, banking licenses', governanceGap: 'No agent-specific cryptographic controls', urgencyScore: 7, accessibilityScore: 2, strategicValueScore: 9, funding: 'Public', linkedIn: 'https://linkedin.com/company/adyen' },

  // Agent Wallets
  { company: 'Anchorage Digital', category: 'Agent Wallets', website: 'https://anchorage.com', painType: 'Regulatory Compliance', evidence: 'First agentic banking platform; Fed-regulated bank — agent authorization lacks cryptographic enforcement', sourceLink: 'https://anchorage.com/enterprise', currentSolution: 'Fed-regulated digital asset bank', governanceGap: 'Agent authorization lacks cryptographic enforcement', urgencyScore: 10, accessibilityScore: 5, strategicValueScore: 9, funding: '$250M+', linkedIn: 'https://linkedin.com/company/anchorage' },
  { company: 'Cobo', category: 'Agent Wallets', website: 'https://cobo.com', painType: 'Key Management', evidence: 'Cobo Agentic Wallet with MPC security; limited threshold signing for agent authorization', sourceLink: 'https://cobo.com/enterprise', currentSolution: 'MPC security, Pact-based permissions', governanceGap: 'Limited threshold signing for agent authorization', urgencyScore: 9, accessibilityScore: 6, strategicValueScore: 8, funding: '$100M+', linkedIn: 'https://linkedin.com/company/cobo-io' },
  { company: 'Crossmint', category: 'Agent Wallets', website: 'https://crossmint.com', painType: 'Policy Enforcement', evidence: 'Dual-key architecture (Owner Key + Agent Key); limited cryptographic authorization beyond dual-key', sourceLink: 'https://crossmint.com/partners', currentSolution: 'Non-custodial, Owner Key + Agent Key', governanceGap: 'Limited cryptographic authorization beyond dual-key', urgencyScore: 9, accessibilityScore: 7, strategicValueScore: 7, funding: '$50M+', linkedIn: 'https://linkedin.com/company/crossmint' },
  { company: 'Openfort', category: 'Agent Wallets', website: 'https://openfort.io', painType: 'Spending Limits', evidence: 'Smart accounts + session keys for AI agents; limited threshold signing for agent operations', sourceLink: 'https://openfort.io/contact', currentSolution: 'Smart accounts, session keys', governanceGap: 'Limited threshold signing for agent operations', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 5, funding: '$10M+', linkedIn: 'https://linkedin.com/company/openfort' },
  { company: 'BitGo', category: 'Agent Wallets', website: 'https://bitgo.com', painType: 'Agent Authorization', evidence: 'Institutional custody with multi-sig and MPC; agent-specific policies not natively supported', sourceLink: 'https://bitgo.com/enterprise', currentSolution: 'Multi-sig, MPC, cold storage', governanceGap: 'Agent-specific policies not natively supported', urgencyScore: 7, accessibilityScore: 4, strategicValueScore: 8, funding: '$500M+', linkedIn: 'https://linkedin.com/company/bitgo' },

  // AI Trading / DeFi Agents
  { company: 'Valory (Olas)', category: 'AI Trading / DeFi Agents', website: 'https://valory.xyz', painType: 'Agent Identity', evidence: 'Olas agent marketplace for autonomous economic agents; no cryptographic agent identity or threshold signing', sourceLink: 'https://valory.xyz/contact', currentSolution: 'Used Nevermined for payments', governanceGap: 'No cryptographic agent identity or threshold signing', urgencyScore: 10, accessibilityScore: 8, strategicValueScore: 7, funding: '$20M+', linkedIn: 'https://linkedin.com/company/valory-xyz' },
  { company: 'Rivo Finance', category: 'AI Trading / DeFi Agents', website: 'https://rivo.finance', painType: 'Trade Authorization', evidence: 'Maneki agent for portfolio analysis & yield optimization; no policy enforcement for autonomous trades', sourceLink: 'https://rivo.finance/contact', currentSolution: 'Not disclosed', governanceGap: 'No policy enforcement for autonomous trades', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 5, funding: 'Seed', linkedIn: 'https://linkedin.com/company/rivo-finance' },
  { company: 'Velvet Capital', category: 'AI Trading / DeFi Agents', website: 'https://velvet.capital', painType: 'Portfolio Authorization', evidence: 'Autonomous portfolio management for DeFi; no threshold signing for portfolio changes', sourceLink: 'https://velvet.capital/contact', currentSolution: 'Not disclosed', governanceGap: 'No threshold signing for portfolio changes', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 5, funding: 'Seed', linkedIn: 'https://linkedin.com/company/velvet-capital' },
  { company: 'SingularityDAO', category: 'AI Trading / DeFi Agents', website: 'https://singularitydao.ai', painType: 'Vault Security', evidence: 'DynaSets — onchain vaults where AI rebalances portfolios; no cryptographic policy enforcement for AI rebalancing', sourceLink: 'https://singularitydao.ai/contact', currentSolution: 'Onchain smart contracts', governanceGap: 'No cryptographic policy enforcement for AI rebalancing', urgencyScore: 8, accessibilityScore: 8, strategicValueScore: 6, funding: 'Not disclosed', linkedIn: 'https://linkedin.com/company/singularity-dao' },

  // Treasury Automation
  { company: 'Modern Treasury', category: 'Treasury Automation', website: 'https://moderntreasury.com', painType: 'Payment Authorization', evidence: 'AI agents using LangGraph for payment ops; human approvals not cryptographically enforced', sourceLink: 'https://moderntreasury.com/partners', currentSolution: 'Human-in-the-loop approvals, granular permissioning, audit trails', governanceGap: 'Human approvals not cryptographically enforced', urgencyScore: 10, accessibilityScore: 5, strategicValueScore: 8, funding: '$150M+', linkedIn: 'https://linkedin.com/company/modern-treasury' },
  { company: 'Atlar', category: 'Treasury Automation', website: 'https://atlar.com', painType: 'Audit Trail', evidence: 'AI agents for treasury: autonomous cash positioning & payments; no cryptographic authorization for payment approvals', sourceLink: 'https://atlar.com/contact/sales', currentSolution: 'Secure access to treasury data, user group privileges', governanceGap: 'No cryptographic authorization for payment approvals', urgencyScore: 9, accessibilityScore: 6, strategicValueScore: 8, funding: '$100M+', linkedIn: 'https://linkedin.com/company/atlar' },
  { company: 'Ramp', category: 'Treasury Automation', website: 'https://ramp.com', painType: 'Spending Controls', evidence: '$2.8B funding; AI agents handle finance automation — agent spending lacks cryptographic enforcement', sourceLink: 'https://ramp.com/enterprise', currentSolution: 'Standard fintech security', governanceGap: 'Agent spending lacks cryptographic enforcement', urgencyScore: 8, accessibilityScore: 5, strategicValueScore: 9, funding: '$2.8B', linkedIn: 'https://linkedin.com/company/ramp-business' },
  { company: 'Bottomline (Bea)', category: 'Treasury Automation', website: 'https://bottomline.com', painType: 'Compliance', evidence: 'Bea AI agent acts as digital team member handling payments; no cryptographic authorization for payment help requests', sourceLink: 'https://bottomline.com/contact', currentSolution: 'Secure environment, data not exposed to public LLMs', governanceGap: 'No cryptographic authorization for payment help requests', urgencyScore: 8, accessibilityScore: 3, strategicValueScore: 7, funding: 'Public', linkedIn: 'https://linkedin.com/company/bottomline-technologies' },
  { company: 'Zip', category: 'Treasury Automation', website: 'https://zip.co', painType: 'Transaction Auth', evidence: '$358M funding; finance automation agents move money — no cryptographic agent authorization', sourceLink: 'https://zip.co/enterprise', currentSolution: 'Standard fintech security', governanceGap: 'No cryptographic agent authorization', urgencyScore: 7, accessibilityScore: 6, strategicValueScore: 7, funding: '$358M', linkedIn: 'https://linkedin.com/company/zip-co' },

  // Enterprise AI Agents
  { company: 'LangChain', category: 'Enterprise AI Agents', website: 'https://langchain.com', painType: 'Production Auth', evidence: '$160M funding; agent framework customers need governance for production agents — no native cryptographic enforcement', sourceLink: 'https://langchain.com/enterprise', currentSolution: 'Open source framework', governanceGap: 'No native cryptographic governance', urgencyScore: 8, accessibilityScore: 7, strategicValueScore: 7, funding: '$160M', linkedIn: 'https://linkedin.com/company/langchain' },
  { company: 'Cohere', category: 'Enterprise AI Agents', website: 'https://cohere.com', painType: 'Agent Governance', evidence: '$1.5B funding; enterprise agent platform — customers building agents need governance layer', sourceLink: 'https://cohere.com/enterprise', currentSolution: 'Enterprise security', governanceGap: 'No native agent governance layer', urgencyScore: 7, accessibilityScore: 4, strategicValueScore: 9, funding: '$1.5B', linkedIn: 'https://linkedin.com/company/cohere-ai' },
  { company: 'Sierra AI', category: 'Enterprise AI Agents', website: 'https://sierra.ai', painType: 'Authorization', evidence: '$635M funding; enterprise agents that could access financial systems — no cryptographic enforcement for agent actions', sourceLink: 'https://sierra.ai/enterprise', currentSolution: 'Enterprise security standards', governanceGap: 'No cryptographic enforcement for agent actions', urgencyScore: 7, accessibilityScore: 5, strategicValueScore: 9, funding: '$635M', linkedIn: 'https://linkedin.com/company/sierra-ai' },
  { company: 'Decagon', category: 'Enterprise AI Agents', website: 'https://decagon.ai', painType: 'Liability', evidence: '$481M funding; customer experience agents — no cryptographic controls for agent actions', sourceLink: 'https://decagon.ai/enterprise', currentSolution: 'Enterprise security', governanceGap: 'No cryptographic controls for agent actions', urgencyScore: 6, accessibilityScore: 6, strategicValueScore: 8, funding: '$481M', linkedIn: 'https://linkedin.com/company/decagon-ai' },
  { company: 'Glean', category: 'Enterprise AI Agents', website: 'https://glean.com', painType: 'Data Access Control', evidence: '$765M funding; enterprise agents access financial data — no cryptographic enforcement for agent data access', sourceLink: 'https://glean.com/partners', currentSolution: 'Enterprise security, SOC 2', governanceGap: 'No cryptographic enforcement for agent data access', urgencyScore: 6, accessibilityScore: 5, strategicValueScore: 9, funding: '$765M', linkedIn: 'https://linkedin.com/company/glean' },

  // Agent-to-Agent Commerce
  { company: 'Presta', category: 'Agent-to-Agent Commerce', website: 'https://wearepresta.com', painType: 'Reputation & Dispute', evidence: 'AI Agent Marketplace 2026 — agent-to-agent transactions need cryptographic identity & governance', sourceLink: 'https://wearepresta.com/contact', currentSolution: 'Not disclosed', governanceGap: 'No cryptographic agent identity or transaction authorization', urgencyScore: 9, accessibilityScore: 10, strategicValueScore: 5, funding: 'Not disclosed', linkedIn: 'https://linkedin.com/company/wearepresta' },
  { company: 'Tines', category: 'Agent-to-Agent Commerce', website: 'https://tines.com', painType: 'Workflow Auth', evidence: '$271M funding; no-code agentic workflows — agents trigger payments needing governance', sourceLink: 'https://tines.com/partners', currentSolution: 'Enterprise security, SOC 2', governanceGap: 'No cryptographic authorization for agent-triggered actions', urgencyScore: 7, accessibilityScore: 5, strategicValueScore: 7, funding: '$271M', linkedIn: 'https://linkedin.com/company/tines' },

  // Autonomous Procurement
  { company: 'Pactum AI', category: 'Autonomous Procurement', website: 'https://pactum.ai', painType: 'Negotiation Auth', evidence: 'Autonomous negotiation AI for tail spend — needs cryptographic authorization for procurement decisions', sourceLink: 'https://pactum.ai/contact', currentSolution: 'Not disclosed', governanceGap: 'No policy enforcement for autonomous negotiations', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 5, funding: 'Seed', linkedIn: 'https://linkedin.com/company/pactum-ai' },
  { company: 'Keelvar', category: 'Autonomous Procurement', website: 'https://keelvar.com', painType: 'Sourcing Compliance', evidence: 'Autonomous sourcing AI — agents execute procurement needing governance', sourceLink: 'https://keelvar.com/contact', currentSolution: 'Enterprise security', governanceGap: 'No cryptographic authorization for sourcing decisions', urgencyScore: 7, accessibilityScore: 7, strategicValueScore: 6, funding: 'Not disclosed', linkedIn: 'https://linkedin.com/company/keelvar' },
  { company: 'Arkestro', category: 'Autonomous Procurement', website: 'https://arkestro.com', painType: 'Purchase Auth', evidence: 'Predictive sourcing intelligence — agents may execute purchases needing governance', sourceLink: 'https://arkestro.com/partners', currentSolution: 'Enterprise security', governanceGap: 'No cryptographic enforcement for procurement actions', urgencyScore: 7, accessibilityScore: 6, strategicValueScore: 6, funding: '$50M+', linkedIn: 'https://linkedin.com/company/arkestro' },
  { company: 'Suplari', category: 'Autonomous Procurement', website: 'https://suplari.com', painType: 'Transaction Auth', evidence: 'Autonomous procurement AI for spend management — agents execute transactions needing governance', sourceLink: 'https://suplari.com/contact', currentSolution: 'Enterprise security', governanceGap: 'No cryptographic authorization for transactions', urgencyScore: 7, accessibilityScore: 7, strategicValueScore: 5, funding: 'Not disclosed', linkedIn: 'https://linkedin.com/company/suplari' },

  // Financial Infrastructure
  { company: 'Alchemy', category: 'Financial Infrastructure', website: 'https://alchemy.com', painType: 'Agent Authorization', evidence: 'Agent wallet demo with $45M volume & 162M transactions; needs cryptographic governance for agent autonomy', sourceLink: 'https://alchemy.com/partners', currentSolution: 'Blockchain infrastructure security', governanceGap: 'No threshold signing for agent operations', urgencyScore: 9, accessibilityScore: 4, strategicValueScore: 9, funding: '$700M+', linkedIn: 'https://linkedin.com/company/alchemyinc' },
  { company: 'Lightning Labs', category: 'Financial Infrastructure', website: 'https://lightning.engineering', painType: 'Key Management', evidence: 'AI agents on Lightning Network via L402; no policy enforcement for agent payments', sourceLink: 'https://lightning.engineering/contact', currentSolution: 'Lightning Network security', governanceGap: 'No policy enforcement for agent payments', urgencyScore: 8, accessibilityScore: 7, strategicValueScore: 6, funding: '$70M+', linkedIn: 'https://linkedin.com/company/lightning-labs' },
  { company: 'BNB Chain', category: 'Financial Infrastructure', website: 'https://bnbchain.org', painType: 'On-chain Identity', evidence: 'ERC-8004 (AI agent identity) + BAP-578 deployed; agent identity lacks cryptographic policy enforcement', sourceLink: 'https://bnbchain.org/partners', currentSolution: 'Blockchain security', governanceGap: 'Agent identity lacks cryptographic policy enforcement', urgencyScore: 8, accessibilityScore: 4, strategicValueScore: 9, funding: 'Not disclosed', linkedIn: 'https://linkedin.com/company/bnbchain' },
  { company: 'Visa', category: 'Financial Infrastructure', website: 'https://visa.com', painType: 'Agent Auth at Scale', evidence: '$1T+ volume researching agent payments; no agent-specific cryptographic controls', sourceLink: 'https://developer.visa.com', currentSolution: 'Established payment security', governanceGap: 'No agent-specific cryptographic controls', urgencyScore: 7, accessibilityScore: 1, strategicValueScore: 10, funding: 'Public', linkedIn: 'https://linkedin.com/company/visa' },
  { company: 'Mastercard', category: 'Financial Infrastructure', website: 'https://mastercard.com', painType: 'Agent Auth at Scale', evidence: 'Agentic payments infra + virtual card platforms for AI agents; no agent-specific cryptographic enforcement', sourceLink: 'https://developer.mastercard.com', currentSolution: 'Established payment security', governanceGap: 'No agent-specific cryptographic enforcement', urgencyScore: 7, accessibilityScore: 1, strategicValueScore: 10, funding: 'Public', linkedIn: 'https://linkedin.com/company/mastercard' },
]

const CATEGORIES = ['All', ...Array.from(new Set(TARGETS.map(t => t.category))).sort()]

type SortKey = 'company' | 'urgencyScore' | 'accessibilityScore' | 'strategicValueScore' | 'total'

function scoreColor(score: number) {
  if (score >= 9) return { color: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.3)' }
  if (score >= 7) return { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)' }
  return { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' }
}

function ScorePill({ score, label }: { score: number; label?: string }) {
  const { color, bg, border } = scoreColor(score)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, padding: '3px 8px', borderRadius: 7, fontSize: 12, fontWeight: 700, color, background: bg, border: `1px solid ${border}` }}>
      {score}{label ? ` ${label}` : ''}
    </span>
  )
}

export default function AerediumPage() {
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState<SortKey>('total')
  const [sortAsc, setSortAsc] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)

  // Filter
  const filtered = TARGETS.filter(t => {
    const matchCat = category === 'All' || t.category === category
    const q = search.toLowerCase()
    const matchSearch = !q || t.company.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.painType.toLowerCase().includes(q) || t.governanceGap.toLowerCase().includes(q)
    return matchCat && matchSearch
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const totalA = a.urgencyScore + a.accessibilityScore + a.strategicValueScore
    const totalB = b.urgencyScore + b.accessibilityScore + b.strategicValueScore
    let diff = 0
    if (sort === 'company') diff = a.company.localeCompare(b.company)
    else if (sort === 'urgencyScore') diff = a.urgencyScore - b.urgencyScore
    else if (sort === 'accessibilityScore') diff = a.accessibilityScore - b.accessibilityScore
    else if (sort === 'strategicValueScore') diff = a.strategicValueScore - b.strategicValueScore
    else diff = totalA - totalB
    return sortAsc ? diff : -diff
  })

  const toggleSort = (key: SortKey) => {
    if (sort === key) setSortAsc(s => !s)
    else { setSort(key); setSortAsc(false) }
  }

  const SortIcon = ({ k }: { k: SortKey }) => sort === k
    ? (sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
    : <ChevronDown size={11} style={{ opacity: 0.3 }} />

  const addToPipeline = async (t: Target) => {
    setAdding(t.company)
    try {
      const { error } = await supabase.from('leads').insert({
        company_name: t.company,
        website: t.website,
        twitter_url: null,
        description: t.evidence,
        industry_category: t.category,
        customer_category: ['Agentic Payments Customer'],
        product_to_sell: 'Aeredium governance layer',
        pain_point: t.governanceGap,
        pain_point_severity: t.urgencyScore >= 9 ? 'critical' : t.urgencyScore >= 7 ? 'high' : 'medium',
        pain_point_evidence: t.evidence,
        pain_point_evidence_type: 'agent_analysis',
        kima_fit: `Aeredium provides the cryptographic governance layer that ${t.company} needs: ${t.governanceGap}`,
        trigger_reason: `${t.company} is building agent infrastructure in the ${t.category} space with a clear governance gap: ${t.governanceGap}`,
        settlement_angle: t.currentSolution,
        integration_feasibility: t.accessibilityScore >= 8 ? 'high' : t.accessibilityScore >= 5 ? 'medium' : 'low',
        lead_score: Math.round((t.urgencyScore + t.accessibilityScore + t.strategicValueScore) / 30 * 100),
        priority: t.urgencyScore >= 9 ? 'excellent' : t.urgencyScore >= 7 ? 'qualified' : 'needs_research',
        status: 'new',
        source_url: t.sourceLink,
        updated_at: new Date().toISOString(),
      })
      if (error) {
        if (error.code === '23505') { toast(`${t.company} is already in your pipeline`); setAdded(s => new Set([...s, t.company])) }
        else toast.error('Failed to add: ' + error.message)
      } else {
        toast.success(`${t.company} added to BD pipeline`)
        setAdded(s => new Set([...s, t.company]))
      }
    } catch { toast.error('Failed') }
    setAdding(null)
  }

  // Stat totals
  const totalScore = (t: Target) => t.urgencyScore + t.accessibilityScore + t.strategicValueScore
  const avgTotal = Math.round(sorted.reduce((s, t) => s + totalScore(t), 0) / (sorted.length || 1))
  const topTargets = sorted.filter(t => totalScore(t) >= 22).length

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2">
            <Shield size={18} style={{ color: '#818cf8' }} /> Aeredium Targets
          </h1>
          <p className="text-[12px] mt-1 font-medium" style={{ color: 'rgb(100,106,135)' }}>
            {filtered.length} companies · {CATEGORIES.length - 1} categories · Cryptographic governance gap intelligence
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              const csv = ['Company,Category,Website,Pain Type,Governance Gap,Urgency,Accessibility,Strategic Value,Total Score',
                ...sorted.map(t => `"${t.company}","${t.category}","${t.website}","${t.painType}","${t.governanceGap}",${t.urgencyScore},${t.accessibilityScore},${t.strategicValueScore},${totalScore(t)}`)
              ].join('\n')
              const a = document.createElement('a'); a.href = 'data:text/csv,' + encodeURIComponent(csv); a.download = 'aeredium-targets.csv'; a.click()
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgb(160,165,195)' }}>
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 36px' }}>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Targets', value: TARGETS.length, color: '#818cf8' },
            { label: 'High Priority (≥22)', value: topTargets, color: '#34d399' },
            { label: 'Categories', value: CATEGORIES.length - 1, color: '#38bdf8' },
            { label: 'Avg Score', value: `${avgTotal}/30`, color: '#fbbf24' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${s.color}20`, borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'rgb(120,127,160)', marginTop: 5 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Score legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, fontSize: 11, color: 'rgb(120,127,160)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: 'rgb(150,155,185)' }}>Score guide:</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#34d399', display: 'inline-block' }} />9–10 = Critical/Excellent</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#fbbf24', display: 'inline-block' }} />7–8 = High/Good</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#f87171', display: 'inline-block' }} />1–6 = Low</span>
          <span style={{ marginLeft: 8 }}>· <b>Urgency</b>: how urgently they need governance · <b>Accessibility</b>: how easy to reach (10=startup, 1=public corp) · <b>Strategic Value</b>: market impact</span>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '0 0 260px' }}>
            <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgb(120,127,160)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company, pain, category…"
              style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <Filter size={13} style={{ color: 'rgb(120,127,160)', flexShrink: 0 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${category === cat ? 'rgba(129,140,248,0.5)' : 'rgba(255,255,255,0.08)'}`, background: category === cat ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.03)', color: category === cat ? '#818cf8' : 'rgb(150,155,185)', whiteSpace: 'nowrap' }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 160px 1fr 1fr 80px 80px 80px 80px 130px', gap: 0, background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '10px 16px', alignItems: 'center' }}>
            {[
              { label: 'Company', key: 'company' as SortKey },
              { label: 'Category', key: null },
              { label: 'Pain Type / Gap', key: null },
              { label: 'Current Solution', key: null },
              { label: 'Urgency', key: 'urgencyScore' as SortKey },
              { label: 'Access', key: 'accessibilityScore' as SortKey },
              { label: 'Strategic', key: 'strategicValueScore' as SortKey },
              { label: 'Total', key: 'total' as SortKey },
              { label: 'Action', key: null },
            ].map((col, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 700, color: 'rgb(120,127,160)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4, cursor: col.key ? 'pointer' : 'default', userSelect: 'none' }}
                onClick={() => col.key && toggleSort(col.key)}>
                {col.label}{col.key && <SortIcon k={col.key} />}
              </div>
            ))}
          </div>

          {/* Rows */}
          {sorted.map((t, idx) => {
            const total = totalScore(t)
            const isExpanded = expanded === t.company
            const isAdded = added.has(t.company)
            return (
              <div key={t.company}>
                <div
                  style={{ display: 'grid', gridTemplateColumns: '200px 160px 1fr 1fr 80px 80px 80px 80px 130px', gap: 0, padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)', alignItems: 'center', transition: 'background 0.12s', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(129,140,248,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)'}
                  onClick={() => setExpanded(isExpanded ? null : t.company)}>

                  {/* Company */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 2 }}>{t.company}</div>
                    <a href={t.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      style={{ fontSize: 10, color: 'rgb(110,115,150)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <ExternalLink size={9} />{t.website.replace(/^https?:\/\//, '').slice(0, 22)}
                    </a>
                  </div>

                  {/* Category */}
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#818cf8', background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', padding: '2px 8px', borderRadius: 6 }}>
                      {t.category}
                    </span>
                  </div>

                  {/* Pain + Gap */}
                  <div style={{ paddingRight: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: 3 }}>{t.painType}</div>
                    <div style={{ fontSize: 11, color: 'rgb(160,165,195)', lineHeight: 1.45 }}>{t.governanceGap.slice(0, 80)}{t.governanceGap.length > 80 ? '…' : ''}</div>
                  </div>

                  {/* Current Solution */}
                  <div style={{ paddingRight: 12 }}>
                    <div style={{ fontSize: 11, color: 'rgb(140,145,175)', lineHeight: 1.45 }}>{t.currentSolution.slice(0, 70)}{t.currentSolution.length > 70 ? '…' : ''}</div>
                    <div style={{ fontSize: 10, color: 'rgb(100,107,140)', marginTop: 2 }}>{t.funding}</div>
                  </div>

                  {/* Scores */}
                  <div style={{ textAlign: 'center' }}><ScorePill score={t.urgencyScore} /></div>
                  <div style={{ textAlign: 'center' }}><ScorePill score={t.accessibilityScore} /></div>
                  <div style={{ textAlign: 'center' }}><ScorePill score={t.strategicValueScore} /></div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: total >= 22 ? '#34d399' : total >= 18 ? '#fbbf24' : '#f87171' }}>{total}</span>
                    <span style={{ fontSize: 10, color: 'rgb(100,107,140)' }}>/30</span>
                  </div>

                  {/* Action */}
                  <div onClick={e => e.stopPropagation()}>
                    {isAdded ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#34d399' }}>
                        <CheckCircle size={13} /> Added
                      </span>
                    ) : (
                      <button onClick={() => addToPipeline(t)} disabled={adding === t.company}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(129,140,248,0.35)', background: 'rgba(129,140,248,0.1)', color: '#818cf8', opacity: adding === t.company ? 0.7 : 1 }}>
                        {adding === t.company ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                        Add to BD
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded detail row */}
                {isExpanded && (
                  <div style={{ padding: '16px 20px 20px 20px', background: 'rgba(129,140,248,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                      <div style={{ borderRadius: 12, border: '1px solid rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.05)', padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Evidence</div>
                        <div style={{ fontSize: 12, color: 'rgb(210,215,235)', lineHeight: 1.6 }}>{t.evidence}</div>
                      </div>
                      <div style={{ borderRadius: 12, border: '1px solid rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.05)', padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Governance Gap</div>
                        <div style={{ fontSize: 12, color: 'rgb(210,215,235)', lineHeight: 1.6 }}>{t.governanceGap}</div>
                      </div>
                      <div style={{ borderRadius: 12, border: '1px solid rgba(129,140,248,0.2)', background: 'rgba(129,140,248,0.05)', padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Contact & Links</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <a href={t.sourceLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#818cf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <ExternalLink size={11} /> Partnership / Contact page
                          </a>
                          <a href={t.linkedIn} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <ExternalLink size={11} /> LinkedIn
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ fontSize: 11, color: 'rgb(90,95,120)', marginTop: 14, textAlign: 'center' }}>
          Click any row to expand · Sort by column headers · "Add to BD" pushes to your lead pipeline
        </div>
      </div>
    </div>
  )
}
