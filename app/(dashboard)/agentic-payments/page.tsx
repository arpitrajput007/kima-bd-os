'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  CreditCard, Search, ExternalLink, Plus, ChevronUp, ChevronDown,
  Filter, Download, CheckCircle, Loader2, Zap, BarChart2,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────
interface AgentTarget {
  company: string
  category: string
  categoryCode: string
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

// ── All 130+ companies from AEREDIUM AI Agent Governance Market Map ─
const ALL_TARGETS: AgentTarget[] = [

  // ══════════════════════════════════════════════════════════════
  // A – AGENT PAYMENTS (24 companies)
  // Platforms moving money on behalf of AI agents — SDKs, stablecoins, Lightning
  // ══════════════════════════════════════════════════════════════
  { company: 'Skyfire', category: 'Agent Payments', categoryCode: 'A', website: 'https://skyfire.xyz', painType: 'Identity & Liability', evidence: 'KYA protocol for agent identity; limited policy enforcement beyond verification', sourceLink: 'https://skyfire.xyz/contact', currentSolution: 'KYA Protocol for agent verification', governanceGap: 'Limited policy enforcement beyond identity verification', urgencyScore: 10, accessibilityScore: 9, strategicValueScore: 6, funding: '$10M', linkedIn: 'https://linkedin.com/company/skyfire-ai' },
  { company: 'Nevermined', category: 'Agent Payments', categoryCode: 'A', website: 'https://nevermined.io', painType: 'Spending Controls', evidence: 'Agent-native payment infra with metering & virtual card delegation; no cryptographic agent identity', sourceLink: 'https://nevermined.io/schedule-demo', currentSolution: 'PCI-compliant through VGS, scoped API keys', governanceGap: 'No cryptographic agent identity or threshold signing for high-value transactions', urgencyScore: 9, accessibilityScore: 8, strategicValueScore: 7, funding: 'Series A', linkedIn: 'https://linkedin.com/company/nevermined-ai' },
  { company: 'Coinbase AgentKit', category: 'Agent Payments', categoryCode: 'A', website: 'https://docs.cloud.coinbase.com/agentkit', painType: 'Key Management', evidence: '162M+ x402 transactions, $45M volume; AgentKit wallets need cryptographic governance', sourceLink: 'https://docs.cloud.coinbase.com/agentkit', currentSolution: 'Custodial wallets, AgentKit framework', governanceGap: 'No threshold signing or policy enforcement for autonomous agents', urgencyScore: 9, accessibilityScore: 3, strategicValueScore: 9, funding: 'Public', linkedIn: 'https://linkedin.com/company/coinbase' },
  { company: 'Stripe', category: 'Agent Payments', categoryCode: 'A', website: 'https://stripe.com', painType: 'Autonomous Auth', evidence: '$1.9T volume; Agentic Commerce Protocol (ACP) in development — lacks cryptographic agent authorization', sourceLink: 'https://stripe.com/partners', currentSolution: '99.999% uptime, proven fraud detection', governanceGap: 'ACP still in development; lacks cryptographic agent authorization', urgencyScore: 8, accessibilityScore: 2, strategicValueScore: 10, funding: '$95B valuation', linkedIn: 'https://linkedin.com/company/stripe' },
  { company: 'PayPal', category: 'Agent Payments', categoryCode: 'A', website: 'https://paypal.com', painType: 'Compliance Gap', evidence: '430M users, $1.5T volume; Financial OS for AI agents — agent workflows lack policy enforcement', sourceLink: 'https://paypal.com/partners', currentSolution: 'Multiparty Compute Protocol, established fraud systems', governanceGap: 'Agent workflows lack cryptographic policy enforcement', urgencyScore: 8, accessibilityScore: 2, strategicValueScore: 10, funding: 'Public', linkedIn: 'https://linkedin.com/company/paypal' },
  { company: 'Adyen', category: 'Agent Payments', categoryCode: 'A', website: 'https://adyen.com', painType: 'Cross-border Compliance', evidence: '€1.4T annual volume, 150+ currencies; no agent-specific cryptographic controls', sourceLink: 'https://adyen.com/partners', currentSolution: '99.999% uptime, banking licenses', governanceGap: 'No agent-specific cryptographic controls', urgencyScore: 7, accessibilityScore: 2, strategicValueScore: 9, funding: 'Public', linkedIn: 'https://linkedin.com/company/adyen' },
  { company: 'MoonPay', category: 'Agent Payments', categoryCode: 'A', website: 'https://moonpay.com', painType: 'Agent Wallet Governance', evidence: 'Crypto payment infrastructure powering agent wallets; no cryptographic governance over agent spending', sourceLink: 'https://moonpay.com', currentSolution: 'Standard crypto payment security', governanceGap: 'No cryptographic governance over agent wallet permissions', urgencyScore: 8, accessibilityScore: 7, strategicValueScore: 7, funding: '$555M', linkedIn: 'https://linkedin.com/company/moonpay' },
  { company: 'Circle (USDC)', category: 'Agent Payments', categoryCode: 'A', website: 'https://circle.com', painType: 'Programmable Policy', evidence: 'USDC is the dominant stablecoin used in agent payment rails; no programmable spending policy at issuance level', sourceLink: 'https://circle.com/partners', currentSolution: 'USDC, CCTP cross-chain transfer', governanceGap: 'No programmable policy enforcement or agent identity bound to USDC transactions', urgencyScore: 9, accessibilityScore: 4, strategicValueScore: 10, funding: '$1.1B', linkedIn: 'https://linkedin.com/company/circle-internet-financial' },
  { company: 'Ripple (XRPL)', category: 'Agent Payments', categoryCode: 'A', website: 'https://ripple.com', painType: 'Cross-border Agent Auth', evidence: 'XRPL used for cross-border agent payment rails; lacks cryptographic governance for autonomous agent transactions', sourceLink: 'https://ripple.com/enterprise', currentSolution: 'On-ledger escrow, multi-signing', governanceGap: 'No agent-specific policy enforcement layer for autonomous cross-border payments', urgencyScore: 7, accessibilityScore: 4, strategicValueScore: 9, funding: 'Public (XRP)', linkedIn: 'https://linkedin.com/company/ripple-labs' },
  { company: 'Solana Pay', category: 'Agent Payments', categoryCode: 'A', website: 'https://solanapay.com', painType: 'Agent Transaction Signing', evidence: 'Protocol for autonomous agent payments on Solana; no policy enforcement or threshold signing built into the standard', sourceLink: 'https://solanapay.com', currentSolution: 'QR-based payment requests, transaction requests', governanceGap: 'No cryptographic policy enforcement for autonomous agent payments', urgencyScore: 8, accessibilityScore: 6, strategicValueScore: 7, funding: 'Solana Foundation', linkedIn: 'https://linkedin.com/company/solana-foundation' },
  { company: 'Alchemy Pay', category: 'Agent Payments', categoryCode: 'A', website: 'https://alchemypay.org', painType: 'Fiat-Crypto Agent Bridge', evidence: 'Crypto-fiat gateway used in agent payment flows; no governance over which agents can initiate fiat conversions', sourceLink: 'https://alchemypay.org/business', currentSolution: 'Fiat-crypto gateway, 70+ countries', governanceGap: 'No agent identity or policy enforcement for autonomous fiat conversion requests', urgencyScore: 8, accessibilityScore: 7, strategicValueScore: 6, funding: '$10M+', linkedIn: 'https://linkedin.com/company/alchemypay' },
  { company: 'Request Network', category: 'Agent Payments', categoryCode: 'A', website: 'https://request.network', painType: 'Agent Invoice Auth', evidence: 'Crypto invoicing and payment protocol; agents can create invoices without cryptographic authorization controls', sourceLink: 'https://request.network/business', currentSolution: 'Decentralized payment request protocol', governanceGap: 'No cryptographic authorization for agent-created payment requests', urgencyScore: 7, accessibilityScore: 8, strategicValueScore: 5, funding: '$32M', linkedIn: 'https://linkedin.com/company/request-network' },
  { company: 'x402 Protocol', category: 'Agent Payments', categoryCode: 'A', website: 'https://x402.org', painType: 'HTTP Payment Governance', evidence: 'HTTP-native payment protocol for AI agents; no policy enforcement on which agents can initiate x402 payment flows', sourceLink: 'https://x402.org', currentSolution: 'HTTP 402 payment standard', governanceGap: 'No cryptographic governance layer over agent-initiated x402 payment requests', urgencyScore: 10, accessibilityScore: 9, strategicValueScore: 7, funding: 'Open Protocol', linkedIn: '' },
  { company: 'Fetch.ai', category: 'Agent Payments', categoryCode: 'A', website: 'https://fetch.ai', painType: 'Agent Economy Governance', evidence: 'AI agent marketplace with native payment token (FET); economic agents transact without cryptographic policy enforcement', sourceLink: 'https://fetch.ai/enterprise', currentSolution: 'FET token, agent registry', governanceGap: 'No threshold signing or cryptographic policy enforcement for high-value agent transactions', urgencyScore: 9, accessibilityScore: 7, strategicValueScore: 7, funding: '$40M+', linkedIn: 'https://linkedin.com/company/fetch-ai' },
  { company: 'Lit Protocol', category: 'Agent Payments', categoryCode: 'A', website: 'https://litprotocol.com', painType: 'Key Condition Governance', evidence: 'Programmable key conditions for agent signing; governance gap in defining complex multi-party agent payment policies', sourceLink: 'https://litprotocol.com/contact', currentSolution: 'Programmable MPC, condition-based signing', governanceGap: 'Complex multi-party agent payment policy enforcement lacks a governance layer', urgencyScore: 9, accessibilityScore: 8, strategicValueScore: 6, funding: '$15M+', linkedIn: 'https://linkedin.com/company/lit-protocol' },
  { company: 'Biconomy', category: 'Agent Payments', categoryCode: 'A', website: 'https://biconomy.io', painType: 'Gasless Agent Tx Governance', evidence: 'Gasless transaction infrastructure for agents (Paymaster); no policy enforcement for agent transaction sponsorship', sourceLink: 'https://biconomy.io/contact', currentSolution: 'ERC-4337 Paymaster, gasless relaying', governanceGap: 'No cryptographic governance over which agents can get gas sponsored', urgencyScore: 8, accessibilityScore: 8, strategicValueScore: 6, funding: '$28M', linkedIn: 'https://linkedin.com/company/biconomy' },
  { company: 'Quicknode', category: 'Agent Payments', categoryCode: 'A', website: 'https://quicknode.com', painType: 'Agent API Access Control', evidence: 'Blockchain API infrastructure used by agents for payment reads/writes; no agent-specific access control policy', sourceLink: 'https://quicknode.com/enterprise', currentSolution: 'API key-based access, rate limiting', governanceGap: 'No cryptographic policy enforcement for agent API payment actions', urgencyScore: 7, accessibilityScore: 6, strategicValueScore: 7, funding: '$60M+', linkedIn: 'https://linkedin.com/company/quicknode' },
  { company: 'Infura', category: 'Agent Payments', categoryCode: 'A', website: 'https://infura.io', painType: 'Agent RPC Governance', evidence: 'Web3 RPC provider used by agents to submit payment transactions; no governance over agent-submitted transactions', sourceLink: 'https://infura.io/contact', currentSolution: 'API keys, rate limiting, MetaMask integration', governanceGap: 'No cryptographic agent identity or policy enforcement for agent-submitted transactions', urgencyScore: 7, accessibilityScore: 5, strategicValueScore: 7, funding: 'ConsenSys ($700M)', linkedIn: 'https://linkedin.com/company/infura' },
  { company: 'Spheron Network', category: 'Agent Payments', categoryCode: 'A', website: 'https://spheron.network', painType: 'Compute Payment Governance', evidence: 'Decentralized compute payments for AI agents; autonomous compute purchasing lacks cryptographic policy enforcement', sourceLink: 'https://spheron.network', currentSolution: 'Decentralized compute marketplace', governanceGap: 'No cryptographic governance over agent-initiated compute payment requests', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 5, funding: '$8M+', linkedIn: 'https://linkedin.com/company/spheron-network' },
  { company: 'XMTP', category: 'Agent Payments', categoryCode: 'A', website: 'https://xmtp.org', painType: 'Agent Message + Payment Auth', evidence: 'Messaging protocol enabling agents to communicate and initiate payments; payment authorization not cryptographically governed', sourceLink: 'https://xmtp.org', currentSolution: 'Decentralized messaging with wallet-based identity', governanceGap: 'No policy enforcement for agent-initiated payment requests via messaging', urgencyScore: 7, accessibilityScore: 8, strategicValueScore: 6, funding: '$20M+', linkedIn: 'https://linkedin.com/company/xmtp' },
  { company: 'Stellar (Soroban)', category: 'Agent Payments', categoryCode: 'A', website: 'https://stellar.org', painType: 'Smart Contract Agent Auth', evidence: 'Soroban smart contracts powering agent payment logic; no cryptographic governance layer for agent-triggered contract calls', sourceLink: 'https://stellar.org/developers', currentSolution: 'Multi-sig, time-bounds, on-chain smart contracts', governanceGap: 'No agent-specific policy enforcement for autonomous Soroban contract execution', urgencyScore: 7, accessibilityScore: 5, strategicValueScore: 8, funding: 'Foundation', linkedIn: 'https://linkedin.com/company/stellar-development-foundation' },
  { company: 'Goat SDK', category: 'Agent Payments', categoryCode: 'A', website: 'https://goat.sdk.fun', painType: 'Agent Tool Payment Control', evidence: 'Open-source SDK connecting AI agents to onchain payment tools; no policy enforcement on which tools agents can execute', sourceLink: 'https://goat.sdk.fun', currentSolution: 'Plugin-based agent payment tools', governanceGap: 'No cryptographic policy enforcement or threshold signing for agent-executed payment tools', urgencyScore: 9, accessibilityScore: 10, strategicValueScore: 5, funding: 'Open Source (Crossmint)', linkedIn: '' },
  { company: 'Fleek', category: 'Agent Payments', categoryCode: 'A', website: 'https://fleek.xyz', painType: 'Agent Deployment Payment', evidence: 'Decentralized agent hosting and deployment; payment hooks for agent actions lack cryptographic authorization', sourceLink: 'https://fleek.xyz', currentSolution: 'Edge hosting, IPFS-based deployment', governanceGap: 'No cryptographic governance for agent-initiated payment actions in deployed workflows', urgencyScore: 7, accessibilityScore: 9, strategicValueScore: 5, funding: '$25M', linkedIn: 'https://linkedin.com/company/fleek-xyz' },
  { company: 'Near Protocol (Intents)', category: 'Agent Payments', categoryCode: 'A', website: 'https://near.org', painType: 'Agent Intent Governance', evidence: 'NEAR Intents framework for autonomous agent commerce; intent-based transactions lack cryptographic policy enforcement', sourceLink: 'https://near.org/developers', currentSolution: 'Chain Abstraction, Named wallets', governanceGap: 'No cryptographic policy enforcement or threshold signing for agent-executed intents', urgencyScore: 8, accessibilityScore: 6, strategicValueScore: 7, funding: '$800M+', linkedIn: 'https://linkedin.com/company/near-protocol' },

  // ══════════════════════════════════════════════════════════════
  // B – AGENT WALLETS (19 companies)
  // MPC, smart account & embedded wallet infra for autonomous agent signing
  // ══════════════════════════════════════════════════════════════
  { company: 'Anchorage Digital', category: 'Agent Wallets', categoryCode: 'B', website: 'https://anchorage.com', painType: 'Regulatory Compliance', evidence: 'First agentic banking platform; Fed-regulated bank — agent authorization lacks cryptographic enforcement', sourceLink: 'https://anchorage.com/enterprise', currentSolution: 'Fed-regulated digital asset bank', governanceGap: 'Agent authorization lacks cryptographic enforcement', urgencyScore: 10, accessibilityScore: 5, strategicValueScore: 9, funding: '$250M+', linkedIn: 'https://linkedin.com/company/anchorage' },
  { company: 'Cobo', category: 'Agent Wallets', categoryCode: 'B', website: 'https://cobo.com', painType: 'Key Management', evidence: 'Cobo Agentic Wallet with MPC security; limited threshold signing for agent authorization', sourceLink: 'https://cobo.com/enterprise', currentSolution: 'MPC security, Pact-based permissions', governanceGap: 'Limited threshold signing for agent authorization', urgencyScore: 9, accessibilityScore: 6, strategicValueScore: 8, funding: '$100M+', linkedIn: 'https://linkedin.com/company/cobo-io' },
  { company: 'Crossmint', category: 'Agent Wallets', categoryCode: 'B', website: 'https://crossmint.com', painType: 'Policy Enforcement', evidence: 'Dual-key architecture (Owner Key + Agent Key); limited cryptographic authorization beyond dual-key', sourceLink: 'https://crossmint.com/partners', currentSolution: 'Non-custodial, Owner Key + Agent Key', governanceGap: 'Limited cryptographic authorization beyond dual-key', urgencyScore: 9, accessibilityScore: 7, strategicValueScore: 7, funding: '$50M+', linkedIn: 'https://linkedin.com/company/crossmint' },
  { company: 'Openfort', category: 'Agent Wallets', categoryCode: 'B', website: 'https://openfort.io', painType: 'Spending Limits', evidence: 'Smart accounts + session keys for AI agents; limited threshold signing for agent operations', sourceLink: 'https://openfort.io/contact', currentSolution: 'Smart accounts, session keys', governanceGap: 'Limited threshold signing for agent operations', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 5, funding: '$10M+', linkedIn: 'https://linkedin.com/company/openfort' },
  { company: 'BitGo', category: 'Agent Wallets', categoryCode: 'B', website: 'https://bitgo.com', painType: 'Agent Authorization', evidence: 'Institutional custody with multi-sig and MPC; agent-specific policies not natively supported', sourceLink: 'https://bitgo.com/enterprise', currentSolution: 'Multi-sig, MPC, cold storage', governanceGap: 'Agent-specific policies not natively supported', urgencyScore: 7, accessibilityScore: 4, strategicValueScore: 8, funding: '$500M+', linkedIn: 'https://linkedin.com/company/bitgo' },
  { company: 'Privy', category: 'Agent Wallets', categoryCode: 'B', website: 'https://privy.io', painType: 'Agent Authorization', evidence: 'Embedded wallets used by thousands of apps; agent authorization not natively cryptographically enforced', sourceLink: 'https://privy.io', currentSolution: 'Embedded wallet infrastructure', governanceGap: 'Agent authorization lacks cryptographic enforcement layer', urgencyScore: 8, accessibilityScore: 8, strategicValueScore: 7, funding: '$40M+', linkedIn: 'https://linkedin.com/company/privy-io' },
  { company: 'Dynamic', category: 'Agent Wallets', categoryCode: 'B', website: 'https://dynamic.xyz', painType: 'Identity & Policy Controls', evidence: 'Wallet infrastructure for web3 apps; identity and policy controls for agents not yet cryptographically enforced', sourceLink: 'https://dynamic.xyz', currentSolution: 'Wallet infrastructure', governanceGap: 'Identity and policy controls not cryptographically enforced for agents', urgencyScore: 8, accessibilityScore: 8, strategicValueScore: 7, funding: '$13.5M', linkedIn: 'https://linkedin.com/company/dynamic-xyz' },
  { company: 'Safe (Gnosis Safe)', category: 'Agent Wallets', categoryCode: 'B', website: 'https://safe.global', painType: 'Multi-Agent Multi-Sig', evidence: '$100B+ secured; multi-sig smart wallet used for multi-agent operations; no agent-specific policy enforcement beyond standard multi-sig', sourceLink: 'https://safe.global/business', currentSolution: 'Multi-sig smart contracts', governanceGap: 'No agent-specific policy enforcement or threshold signing beyond standard multi-sig', urgencyScore: 9, accessibilityScore: 6, strategicValueScore: 9, funding: '$100M+', linkedIn: 'https://linkedin.com/company/safe-global' },
  { company: 'Turnkey', category: 'Agent Wallets', categoryCode: 'B', website: 'https://turnkey.com', painType: 'Agent Key Policy', evidence: 'API-first wallet infrastructure for AI agents; key policies are configurable but lack cryptographic agent governance', sourceLink: 'https://turnkey.com', currentSolution: 'Secure enclave key management, policy engine', governanceGap: 'Key policies lack cryptographic binding to agent identity for autonomous operations', urgencyScore: 9, accessibilityScore: 8, strategicValueScore: 7, funding: '$30M+', linkedIn: 'https://linkedin.com/company/turnkey-io' },
  { company: 'Magic (Fortmatic)', category: 'Agent Wallets', categoryCode: 'B', website: 'https://magic.link', painType: 'Agent Auth Layer', evidence: 'Wallet SDK used in agent auth flows; no cryptographic policy enforcement for agent-specific actions', sourceLink: 'https://magic.link/enterprise', currentSolution: 'Delegated key management, HSM-based', governanceGap: 'No cryptographic policy enforcement or threshold signing for agent operations', urgencyScore: 7, accessibilityScore: 7, strategicValueScore: 6, funding: '$80M+', linkedIn: 'https://linkedin.com/company/magic-labs' },
  { company: 'Web3Auth', category: 'Agent Wallets', categoryCode: 'B', website: 'https://web3auth.io', painType: 'Agent MPC Control', evidence: 'MPC wallet SDK used in agent identity flows; agent-specific authorization policies not cryptographically enforced', sourceLink: 'https://web3auth.io/enterprise', currentSolution: 'MPC-based wallet, social login', governanceGap: 'Agent authorization and spending policies not cryptographically enforced', urgencyScore: 7, accessibilityScore: 8, strategicValueScore: 6, funding: '$13M+', linkedIn: 'https://linkedin.com/company/web3auth' },
  { company: 'Particle Network', category: 'Agent Wallets', categoryCode: 'B', website: 'https://particle.network', painType: 'Intent-Centric Agent Control', evidence: 'Chain abstraction + intent-centric wallet for agents; intent execution lacks cryptographic policy enforcement', sourceLink: 'https://particle.network', currentSolution: 'Universal Account, chain abstraction', governanceGap: 'Agent intent execution lacks cryptographic governance layer', urgencyScore: 8, accessibilityScore: 8, strategicValueScore: 7, funding: '$25M+', linkedIn: 'https://linkedin.com/company/particle-network' },
  { company: 'Capsule', category: 'Agent Wallets', categoryCode: 'B', website: 'https://usecapsule.com', painType: 'Agent Session Key Governance', evidence: 'Embedded MPC wallet for agent identity; session key governance for autonomous agents is not cryptographically bound', sourceLink: 'https://usecapsule.com', currentSolution: 'MPC, passkey-based wallet', governanceGap: 'Session key governance for autonomous agent operations lacks cryptographic enforcement', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 5, funding: '$10M+', linkedIn: 'https://linkedin.com/company/capsule-co' },
  { company: 'Dfns', category: 'Agent Wallets', categoryCode: 'B', website: 'https://dfns.co', painType: 'Institutional Agent Signing', evidence: 'Institutional-grade MPC wallet API for autonomous agents; threshold signing for agent operations is not policy-governed', sourceLink: 'https://dfns.co/enterprise', currentSolution: 'MPC, FIDO2, institutional wallet API', governanceGap: 'Threshold signing for agent operations lacks policy-based governance', urgencyScore: 9, accessibilityScore: 7, strategicValueScore: 7, funding: '$25M+', linkedIn: 'https://linkedin.com/company/dfns' },
  { company: 'ZeroDev', category: 'Agent Wallets', categoryCode: 'B', website: 'https://zerodev.app', painType: 'Smart Account Agent Policy', evidence: 'ERC-4337 smart accounts and session keys for AI agents; agent policies are flexible but not cryptographically governed at identity level', sourceLink: 'https://zerodev.app', currentSolution: 'ERC-4337, session keys, plugins', governanceGap: 'Agent policies lack cryptographic binding to verifiable agent identity', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 6, funding: '$7M+', linkedIn: 'https://linkedin.com/company/zerodev' },
  { company: 'Pimlico', category: 'Agent Wallets', categoryCode: 'B', website: 'https://pimlico.io', painType: 'Agent Paymaster Governance', evidence: 'ERC-4337 bundler and Paymaster infrastructure used by agents; no governance over agent-sponsored transactions', sourceLink: 'https://pimlico.io', currentSolution: 'Bundler, Paymaster, ERC-4337', governanceGap: 'No cryptographic governance over which agents can get transaction sponsorship', urgencyScore: 7, accessibilityScore: 9, strategicValueScore: 5, funding: '$4.2M', linkedIn: 'https://linkedin.com/company/pimlico' },
  { company: 'Kite AI', category: 'Agent Wallets', categoryCode: 'B', website: 'https://gokite.ai', painType: 'Agent Identity & Delegation', evidence: 'Agent passport/wallet product — identity and delegation gaps require cryptographic enforcement', sourceLink: 'https://gokite.ai', currentSolution: 'Agent passport framework', governanceGap: 'Agent identity and delegation lacks cryptographic enforcement', urgencyScore: 9, accessibilityScore: 9, strategicValueScore: 6, funding: 'Not disclosed', linkedIn: 'https://linkedin.com/company/kite-ai' },
  { company: 'Claw Wallet', category: 'Agent Wallets', categoryCode: 'B', website: 'https://clawwallet.ai', painType: 'Autonomous Transaction Security', evidence: 'Purpose-built AI agent wallets; autonomous transaction security is a core unsolved gap', sourceLink: 'https://clawwallet.ai', currentSolution: 'AI agent wallet framework', governanceGap: 'No cryptographic policy enforcement for autonomous transactions', urgencyScore: 9, accessibilityScore: 10, strategicValueScore: 5, funding: 'Early stage', linkedIn: 'https://linkedin.com/company/claw-wallet' },
  { company: 'Sequence', category: 'Agent Wallets', categoryCode: 'B', website: 'https://sequence.xyz', painType: 'Agent Smart Wallet Governance', evidence: 'Smart wallet infrastructure for games and agents; no cryptographic governance over agent transaction policies', sourceLink: 'https://sequence.xyz/business', currentSolution: 'Smart contract wallet, gasless transactions', governanceGap: 'Agent transaction policies lack cryptographic enforcement', urgencyScore: 7, accessibilityScore: 8, strategicValueScore: 6, funding: '$45M+', linkedIn: 'https://linkedin.com/company/horizon-blockchain-games' },

  // ══════════════════════════════════════════════════════════════
  // C – AI TRADING / DEFI AGENTS (18 companies)
  // Autonomous agents executing trades, managing LP positions and lending strategies
  // ══════════════════════════════════════════════════════════════
  { company: 'Valory (Olas)', category: 'AI Trading / DeFi Agents', categoryCode: 'C', website: 'https://valory.xyz', painType: 'Agent Identity', evidence: 'Olas agent marketplace for autonomous economic agents; no cryptographic agent identity or threshold signing', sourceLink: 'https://valory.xyz/contact', currentSolution: 'Used Nevermined for payments', governanceGap: 'No cryptographic agent identity or threshold signing', urgencyScore: 10, accessibilityScore: 8, strategicValueScore: 7, funding: '$20M+', linkedIn: 'https://linkedin.com/company/valory-xyz' },
  { company: 'Rivo Finance', category: 'AI Trading / DeFi Agents', categoryCode: 'C', website: 'https://rivo.finance', painType: 'Trade Authorization', evidence: 'Maneki agent for portfolio analysis & yield optimization; no policy enforcement for autonomous trades', sourceLink: 'https://rivo.finance/contact', currentSolution: 'Not disclosed', governanceGap: 'No policy enforcement for autonomous trades', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 5, funding: 'Seed', linkedIn: 'https://linkedin.com/company/rivo-finance' },
  { company: 'Velvet Capital', category: 'AI Trading / DeFi Agents', categoryCode: 'C', website: 'https://velvet.capital', painType: 'Portfolio Authorization', evidence: 'Autonomous portfolio management for DeFi; no threshold signing for portfolio changes', sourceLink: 'https://velvet.capital/contact', currentSolution: 'Not disclosed', governanceGap: 'No threshold signing for portfolio changes', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 5, funding: 'Seed', linkedIn: 'https://linkedin.com/company/velvet-capital' },
  { company: 'SingularityDAO', category: 'AI Trading / DeFi Agents', categoryCode: 'C', website: 'https://singularitydao.ai', painType: 'Vault Security', evidence: 'DynaSets — onchain vaults where AI rebalances portfolios; no cryptographic policy enforcement for AI rebalancing', sourceLink: 'https://singularitydao.ai/contact', currentSolution: 'Onchain smart contracts', governanceGap: 'No cryptographic policy enforcement for AI rebalancing', urgencyScore: 8, accessibilityScore: 8, strategicValueScore: 6, funding: 'Not disclosed', linkedIn: 'https://linkedin.com/company/singularity-dao' },
  { company: 'Bitget', category: 'AI Trading / DeFi Agents', categoryCode: 'C', website: 'https://bitget.com', painType: 'Automated Action Governance', evidence: 'AI-powered crypto operations at scale; no governance over automated trading actions', sourceLink: 'https://bitget.com', currentSolution: 'Centralized exchange controls', governanceGap: 'No cryptographic governance over automated agent actions', urgencyScore: 8, accessibilityScore: 4, strategicValueScore: 8, funding: 'Not disclosed', linkedIn: 'https://linkedin.com/company/bitget' },
  { company: 'Hyperliquid', category: 'AI Trading / DeFi Agents', categoryCode: 'C', website: 'https://hyperliquid.xyz', painType: 'Risk Controls', evidence: 'Automated trading ecosystem with high agent activity; risk controls lack cryptographic enforcement', sourceLink: 'https://hyperliquid.xyz', currentSolution: 'On-chain order book', governanceGap: 'Automated trading risk controls lack cryptographic enforcement', urgencyScore: 8, accessibilityScore: 7, strategicValueScore: 8, funding: 'Not disclosed', linkedIn: 'https://linkedin.com/company/hyperliquid' },
  { company: 'dYdX', category: 'AI Trading / DeFi Agents', categoryCode: 'C', website: 'https://dydx.trade', painType: 'Policy Enforcement', evidence: 'Programmatic trading with agents; policy enforcement for automated strategies not cryptographically enforced', sourceLink: 'https://dydx.trade', currentSolution: 'Decentralized derivatives protocol', governanceGap: 'No cryptographic policy enforcement for programmatic agent strategies', urgencyScore: 8, accessibilityScore: 6, strategicValueScore: 8, funding: '$65M', linkedIn: 'https://linkedin.com/company/dydx' },
  { company: 'Aave', category: 'AI Trading / DeFi Agents', categoryCode: 'C', website: 'https://aave.com', painType: 'Safe Execution', evidence: 'Autonomous treasury strategies on Aave; safe execution of agent actions lacks cryptographic governance', sourceLink: 'https://aave.com', currentSolution: 'Smart contract governance', governanceGap: 'Autonomous treasury strategy execution lacks cryptographic agent governance', urgencyScore: 8, accessibilityScore: 5, strategicValueScore: 9, funding: 'Public protocol', linkedIn: 'https://linkedin.com/company/aave' },
  { company: 'Yearn Finance', category: 'AI Trading / DeFi Agents', categoryCode: 'C', website: 'https://yearn.fi', painType: 'Governance & Auditability', evidence: 'Yield automation with agent strategies; governance and auditability of automated actions lacks enforcement', sourceLink: 'https://yearn.fi', currentSolution: 'DAO governance', governanceGap: 'Yield automation governance and auditability lack cryptographic enforcement', urgencyScore: 7, accessibilityScore: 7, strategicValueScore: 7, funding: 'Protocol', linkedIn: 'https://linkedin.com/company/yearn-finance' },
  { company: 'Morpho Labs', category: 'AI Trading / DeFi Agents', categoryCode: 'C', website: 'https://morpho.org', painType: 'AI Lending Strategy Auth', evidence: 'Optimized lending protocol with AI-driven strategies; no cryptographic governance for autonomous reallocation decisions', sourceLink: 'https://morpho.org', currentSolution: 'On-chain smart contracts, DAO governance', governanceGap: 'Autonomous lending strategy execution lacks cryptographic agent governance', urgencyScore: 8, accessibilityScore: 7, strategicValueScore: 8, funding: '$18M+', linkedIn: 'https://linkedin.com/company/morpho-labs' },
  { company: 'GMX', category: 'AI Trading / DeFi Agents', categoryCode: 'C', website: 'https://gmx.io', painType: 'Perp Trading Agent Control', evidence: 'Leading perp DEX used by AI trading agents; no cryptographic policy enforcement for agent-executed perpetual positions', sourceLink: 'https://gmx.io', currentSolution: 'Smart contract-based perpetuals', governanceGap: 'AI trading agents operating on GMX lack cryptographic governance over position sizes and execution', urgencyScore: 8, accessibilityScore: 6, strategicValueScore: 7, funding: 'Protocol', linkedIn: '' },
  { company: 'Gauntlet', category: 'AI Trading / DeFi Agents', categoryCode: 'C', website: 'https://gauntlet.network', painType: 'Risk Model Governance', evidence: 'AI-driven risk management for DeFi protocols; autonomous risk parameter changes lack cryptographic governance', sourceLink: 'https://gauntlet.network', currentSolution: 'Simulation-based risk modeling', governanceGap: 'Autonomous risk parameter adjustments lack cryptographic policy enforcement', urgencyScore: 9, accessibilityScore: 7, strategicValueScore: 8, funding: '$23M+', linkedIn: 'https://linkedin.com/company/gauntlet-networks' },
  { company: 'Chaos Labs', category: 'AI Trading / DeFi Agents', categoryCode: 'C', website: 'https://chaoslabs.xyz', painType: 'Agent Risk Audit Trail', evidence: 'Autonomous risk simulation for DeFi protocols; audit trail for AI-driven risk decisions lacks cryptographic immutability', sourceLink: 'https://chaoslabs.xyz', currentSolution: 'Simulation engine, oracle monitoring', governanceGap: 'Audit trail for autonomous risk agent decisions lacks cryptographic enforcement', urgencyScore: 8, accessibilityScore: 8, strategicValueScore: 7, funding: '$20M+', linkedIn: 'https://linkedin.com/company/chaos-labs' },
  { company: 'Numerai', category: 'AI Trading / DeFi Agents', categoryCode: 'C', website: 'https://numer.ai', painType: 'Model Authorization', evidence: 'Crowd-sourced AI hedge fund with autonomous model-driven trading; no cryptographic governance for model-authorized trades', sourceLink: 'https://numer.ai', currentSolution: 'Staking-based model selection', governanceGap: 'No cryptographic governance binding AI model identity to authorized trade execution', urgencyScore: 7, accessibilityScore: 7, strategicValueScore: 7, funding: '$60M+', linkedIn: 'https://linkedin.com/company/numerai' },
  { company: 'Curve Finance', category: 'AI Trading / DeFi Agents', categoryCode: 'C', website: 'https://curve.fi', painType: 'LP Agent Governance', evidence: 'Stablecoin AMM with significant AI agent LP management; autonomous LP position changes lack policy enforcement', sourceLink: 'https://curve.fi', currentSolution: 'DAO governance, veToken model', governanceGap: 'AI agent LP management lacks cryptographic policy enforcement', urgencyScore: 7, accessibilityScore: 5, strategicValueScore: 8, funding: 'Protocol', linkedIn: '' },
  { company: 'Uniswap', category: 'AI Trading / DeFi Agents', categoryCode: 'C', website: 'https://uniswap.org', painType: 'Autonomous Liquidity Governance', evidence: '$2T+ volume; AI agents managing liquidity positions; no cryptographic governance for autonomous LP operations', sourceLink: 'https://uniswap.org', currentSolution: 'Smart contracts, DAO governance', governanceGap: 'Autonomous liquidity management by AI agents lacks cryptographic policy enforcement', urgencyScore: 7, accessibilityScore: 4, strategicValueScore: 10, funding: 'Protocol', linkedIn: 'https://linkedin.com/company/uniswap-labs' },
  { company: 'AI Arena', category: 'AI Trading / DeFi Agents', categoryCode: 'C', website: 'https://aiarena.io', painType: 'Agent Stake Governance', evidence: 'Competitive AI agent platform with financial stakes; staking and reward mechanics lack cryptographic agent governance', sourceLink: 'https://aiarena.io', currentSolution: 'Smart contracts, NFT-based agents', governanceGap: 'No cryptographic governance binding agent identity to staking and financial decisions', urgencyScore: 7, accessibilityScore: 9, strategicValueScore: 5, funding: '$6M+', linkedIn: 'https://linkedin.com/company/ai-arena' },
  { company: 'Ondo Finance', category: 'AI Trading / DeFi Agents', categoryCode: 'C', website: 'https://ondo.finance', painType: 'RWA Agent Authorization', evidence: 'Tokenized RWA (USDY, OUSG) increasingly used in AI agent portfolios; agent-initiated RWA purchases lack governance', sourceLink: 'https://ondo.finance', currentSolution: 'KYC/AML compliance, smart contracts', governanceGap: 'AI agent authorization for RWA purchases lacks cryptographic policy enforcement', urgencyScore: 8, accessibilityScore: 6, strategicValueScore: 8, funding: '$46M+', linkedIn: 'https://linkedin.com/company/ondo-finance' },

  // ══════════════════════════════════════════════════════════════
  // D – TREASURY AUTOMATION (12 companies)
  // DAO and corporate treasury management driven by AI agents
  // ══════════════════════════════════════════════════════════════
  { company: 'Modern Treasury', category: 'Treasury Automation', categoryCode: 'D', website: 'https://moderntreasury.com', painType: 'Payment Authorization', evidence: 'AI agents using LangGraph for payment ops; human approvals not cryptographically enforced', sourceLink: 'https://moderntreasury.com/partners', currentSolution: 'Human-in-the-loop approvals, granular permissioning, audit trails', governanceGap: 'Human approvals not cryptographically enforced', urgencyScore: 10, accessibilityScore: 5, strategicValueScore: 8, funding: '$150M+', linkedIn: 'https://linkedin.com/company/modern-treasury' },
  { company: 'Atlar', category: 'Treasury Automation', categoryCode: 'D', website: 'https://atlar.com', painType: 'Audit Trail', evidence: 'AI agents for treasury: autonomous cash positioning & payments; no cryptographic authorization for payment approvals', sourceLink: 'https://atlar.com/contact/sales', currentSolution: 'Secure access to treasury data, user group privileges', governanceGap: 'No cryptographic authorization for payment approvals', urgencyScore: 9, accessibilityScore: 6, strategicValueScore: 8, funding: '$100M+', linkedIn: 'https://linkedin.com/company/atlar' },
  { company: 'Ramp', category: 'Treasury Automation', categoryCode: 'D', website: 'https://ramp.com', painType: 'Spending Controls', evidence: '$2.8B funding; AI agents handle finance automation — agent spending lacks cryptographic enforcement', sourceLink: 'https://ramp.com/enterprise', currentSolution: 'Standard fintech security', governanceGap: 'Agent spending lacks cryptographic enforcement', urgencyScore: 8, accessibilityScore: 5, strategicValueScore: 9, funding: '$2.8B', linkedIn: 'https://linkedin.com/company/ramp-business' },
  { company: 'Bottomline (Bea)', category: 'Treasury Automation', categoryCode: 'D', website: 'https://bottomline.com', painType: 'Compliance', evidence: 'Bea AI agent acts as digital team member handling payments; no cryptographic authorization for payment help requests', sourceLink: 'https://bottomline.com/contact', currentSolution: 'Secure environment, data not exposed to public LLMs', governanceGap: 'No cryptographic authorization for payment help requests', urgencyScore: 8, accessibilityScore: 3, strategicValueScore: 7, funding: 'Public', linkedIn: 'https://linkedin.com/company/bottomline-technologies' },
  { company: 'Zip (Spend)', category: 'Treasury Automation', categoryCode: 'D', website: 'https://zip.co', painType: 'Transaction Auth', evidence: '$358M funding; finance automation agents move money — no cryptographic agent authorization', sourceLink: 'https://zip.co/enterprise', currentSolution: 'Standard fintech security', governanceGap: 'No cryptographic agent authorization', urgencyScore: 7, accessibilityScore: 6, strategicValueScore: 7, funding: '$358M', linkedIn: 'https://linkedin.com/company/zip-co' },
  { company: 'Brex', category: 'Treasury Automation', categoryCode: 'D', website: 'https://brex.com', painType: 'Governed Payments', evidence: 'Corporate treasury automation with AI; governed payments lack cryptographic policy enforcement for agents', sourceLink: 'https://brex.com', currentSolution: 'Corporate card controls, spend limits', governanceGap: 'Agent-driven corporate payments lack cryptographic governance', urgencyScore: 8, accessibilityScore: 6, strategicValueScore: 8, funding: '$1.5B', linkedIn: 'https://linkedin.com/company/brex' },
  { company: 'Airbase', category: 'Treasury Automation', categoryCode: 'D', website: 'https://airbase.com', painType: 'Policy Enforcement', evidence: 'Spend management automation; policy enforcement for automated approvals lacks cryptographic layer', sourceLink: 'https://airbase.com', currentSolution: 'Approval workflows, spend controls', governanceGap: 'Automated approval policy enforcement lacks cryptographic enforcement', urgencyScore: 7, accessibilityScore: 7, strategicValueScore: 7, funding: '$60M', linkedIn: 'https://linkedin.com/company/airbase' },
  { company: 'Tipalti', category: 'Treasury Automation', categoryCode: 'D', website: 'https://tipalti.com', painType: 'Audit & Settlement Controls', evidence: 'Global payouts automation; audit and settlement controls for agents lack cryptographic enforcement', sourceLink: 'https://tipalti.com', currentSolution: 'AP automation, compliance', governanceGap: 'Global payout audit and settlement controls lack cryptographic enforcement', urgencyScore: 7, accessibilityScore: 5, strategicValueScore: 8, funding: '$270M', linkedIn: 'https://linkedin.com/company/tipalti' },
  { company: 'Mesh Payments', category: 'Treasury Automation', categoryCode: 'D', website: 'https://meshpayments.com', painType: 'Approval Automation', evidence: 'Finance automation with AI; approval automation lacks cryptographic policy enforcement', sourceLink: 'https://meshpayments.com', currentSolution: 'Payment controls', governanceGap: 'AI-driven approval automation lacks cryptographic policy enforcement', urgencyScore: 7, accessibilityScore: 8, strategicValueScore: 6, funding: '$180M', linkedIn: 'https://linkedin.com/company/mesh-payments' },
  { company: 'Bill.com', category: 'Treasury Automation', categoryCode: 'D', website: 'https://bill.com', painType: 'AP/AR Agent Auth', evidence: 'AI-powered AP/AR automation for SMBs; agent-initiated payment approvals lack cryptographic enforcement', sourceLink: 'https://bill.com/enterprise', currentSolution: 'Multi-user approval workflows', governanceGap: 'Agent-initiated AP/AR actions lack cryptographic policy enforcement', urgencyScore: 7, accessibilityScore: 4, strategicValueScore: 8, funding: 'Public', linkedIn: 'https://linkedin.com/company/bill-com' },
  { company: 'Navan (TripActions)', category: 'Treasury Automation', categoryCode: 'D', website: 'https://navan.com', painType: 'Expense Agent Governance', evidence: 'AI-driven T&E expense management; autonomous expense submissions lack cryptographic agent policy enforcement', sourceLink: 'https://navan.com/enterprise', currentSolution: 'AI expense categorization, policy rules', governanceGap: 'Autonomous expense agent actions lack cryptographic governance', urgencyScore: 6, accessibilityScore: 5, strategicValueScore: 7, funding: '$1.5B+', linkedIn: 'https://linkedin.com/company/navan' },
  { company: 'Coupa Software', category: 'Treasury Automation', categoryCode: 'D', website: 'https://coupa.com', painType: 'Spend Intelligence Governance', evidence: 'Business spend management with AI; autonomous spend recommendations lack cryptographic authorization layer', sourceLink: 'https://coupa.com/enterprise', currentSolution: 'AI recommendations, approval workflows', governanceGap: 'AI-driven spend actions lack cryptographic policy enforcement', urgencyScore: 7, accessibilityScore: 3, strategicValueScore: 8, funding: 'Public ($8B acquisition)', linkedIn: 'https://linkedin.com/company/coupa-software' },

  // ══════════════════════════════════════════════════════════════
  // E – ENTERPRISE AI AGENTS (14 companies)
  // Enterprise workflow agents with financial action authority
  // ══════════════════════════════════════════════════════════════
  { company: 'LangChain', category: 'Enterprise AI Agents', categoryCode: 'E', website: 'https://langchain.com', painType: 'Production Auth', evidence: '$160M funding; agent framework customers need governance for production agents — no native cryptographic enforcement', sourceLink: 'https://langchain.com/enterprise', currentSolution: 'Open source framework', governanceGap: 'No native cryptographic governance', urgencyScore: 8, accessibilityScore: 7, strategicValueScore: 7, funding: '$160M', linkedIn: 'https://linkedin.com/company/langchain' },
  { company: 'Cohere', category: 'Enterprise AI Agents', categoryCode: 'E', website: 'https://cohere.com', painType: 'Agent Governance', evidence: '$1.5B funding; enterprise agent platform — customers building agents need governance layer', sourceLink: 'https://cohere.com/enterprise', currentSolution: 'Enterprise security', governanceGap: 'No native agent governance layer', urgencyScore: 7, accessibilityScore: 4, strategicValueScore: 9, funding: '$1.5B', linkedIn: 'https://linkedin.com/company/cohere-ai' },
  { company: 'Sierra AI', category: 'Enterprise AI Agents', categoryCode: 'E', website: 'https://sierra.ai', painType: 'Authorization', evidence: '$635M funding; enterprise agents that could access financial systems — no cryptographic enforcement for agent actions', sourceLink: 'https://sierra.ai/enterprise', currentSolution: 'Enterprise security standards', governanceGap: 'No cryptographic enforcement for agent actions', urgencyScore: 7, accessibilityScore: 5, strategicValueScore: 9, funding: '$635M', linkedIn: 'https://linkedin.com/company/sierra-ai' },
  { company: 'Decagon', category: 'Enterprise AI Agents', categoryCode: 'E', website: 'https://decagon.ai', painType: 'Liability', evidence: '$481M funding; customer experience agents — no cryptographic controls for agent actions', sourceLink: 'https://decagon.ai/enterprise', currentSolution: 'Enterprise security', governanceGap: 'No cryptographic controls for agent actions', urgencyScore: 6, accessibilityScore: 6, strategicValueScore: 8, funding: '$481M', linkedIn: 'https://linkedin.com/company/decagon-ai' },
  { company: 'Glean', category: 'Enterprise AI Agents', categoryCode: 'E', website: 'https://glean.com', painType: 'Data Access Control', evidence: '$765M funding; enterprise agents access financial data — no cryptographic enforcement for agent data access', sourceLink: 'https://glean.com/partners', currentSolution: 'Enterprise security, SOC 2', governanceGap: 'No cryptographic enforcement for agent data access', urgencyScore: 6, accessibilityScore: 5, strategicValueScore: 9, funding: '$765M', linkedIn: 'https://linkedin.com/company/glean' },
  { company: 'Microsoft (Copilot)', category: 'Enterprise AI Agents', categoryCode: 'E', website: 'https://microsoft.com', painType: 'Enterprise Agent Governance', evidence: 'Copilot ecosystem with millions of enterprise agents; governance at enterprise scale is a massive unsolved problem', sourceLink: 'https://microsoft.com', currentSolution: 'Azure Active Directory, enterprise security', governanceGap: 'No cryptographic governance layer for autonomous Copilot agent actions', urgencyScore: 9, accessibilityScore: 1, strategicValueScore: 10, funding: 'Public', linkedIn: 'https://linkedin.com/company/microsoft' },
  { company: 'Salesforce (Agentforce)', category: 'Enterprise AI Agents', categoryCode: 'E', website: 'https://salesforce.com', painType: 'Agent Permissions & Audit', evidence: 'Agentforce deployed to enterprise customers; agent permissions and audit trails not cryptographically enforced', sourceLink: 'https://salesforce.com', currentSolution: 'Salesforce Shield, permission sets', governanceGap: 'Agent permissions and audit trails lack cryptographic enforcement', urgencyScore: 8, accessibilityScore: 1, strategicValueScore: 10, funding: 'Public', linkedIn: 'https://linkedin.com/company/salesforce' },
  { company: 'Google Cloud (Vertex AI)', category: 'Enterprise AI Agents', categoryCode: 'E', website: 'https://cloud.google.com', painType: 'Secure Autonomous Execution', evidence: 'AI agents via Vertex AI at global scale; secure autonomous execution lacks cryptographic policy layer', sourceLink: 'https://cloud.google.com', currentSolution: 'IAM, VPC, enterprise security', governanceGap: 'No cryptographic policy enforcement layer for autonomous agent execution', urgencyScore: 8, accessibilityScore: 1, strategicValueScore: 10, funding: 'Public', linkedIn: 'https://linkedin.com/company/google-cloud' },
  { company: 'IBM (Watsonx)', category: 'Enterprise AI Agents', categoryCode: 'E', website: 'https://ibm.com', painType: 'Compliance & Governance', evidence: 'Watsonx agents deployed in regulated industries; compliance and governance need cryptographic enforcement', sourceLink: 'https://ibm.com', currentSolution: 'IBM Security, compliance frameworks', governanceGap: 'Agent compliance and governance lack cryptographic enforcement in regulated sectors', urgencyScore: 8, accessibilityScore: 1, strategicValueScore: 9, funding: 'Public', linkedIn: 'https://linkedin.com/company/ibm' },
  { company: 'ServiceNow', category: 'Enterprise AI Agents', categoryCode: 'E', website: 'https://servicenow.com', painType: 'Agent Authorization', evidence: 'Enterprise workflow agents across IT/HR/Finance; agent authorization for sensitive workflows not cryptographically enforced', sourceLink: 'https://servicenow.com', currentSolution: 'RBAC, enterprise security', governanceGap: 'Agent authorization for sensitive enterprise workflows lacks cryptographic enforcement', urgencyScore: 7, accessibilityScore: 2, strategicValueScore: 9, funding: 'Public', linkedIn: 'https://linkedin.com/company/servicenow' },
  { company: 'UiPath', category: 'Enterprise AI Agents', categoryCode: 'E', website: 'https://uipath.com', painType: 'RPA + Agent Governance', evidence: 'RPA + AI agent platform with $1B+ revenue; autonomous financial process agents lack cryptographic governance', sourceLink: 'https://uipath.com/enterprise', currentSolution: 'Role-based access, audit logs', governanceGap: 'Autonomous financial process agents lack cryptographic policy enforcement', urgencyScore: 8, accessibilityScore: 3, strategicValueScore: 9, funding: 'Public', linkedIn: 'https://linkedin.com/company/uipath' },
  { company: 'Automation Anywhere', category: 'Enterprise AI Agents', categoryCode: 'E', website: 'https://automationanywhere.com', painType: 'Autonomous Process Auth', evidence: 'Enterprise AI + RPA with financial process automation; autonomous process agents lack cryptographic authorization', sourceLink: 'https://automationanywhere.com/enterprise', currentSolution: 'Role-based access controls', governanceGap: 'Autonomous financial process agents lack cryptographic policy enforcement', urgencyScore: 7, accessibilityScore: 3, strategicValueScore: 8, funding: '$838M', linkedIn: 'https://linkedin.com/company/automation-anywhere' },
  { company: 'SAP (Joule)', category: 'Enterprise AI Agents', categoryCode: 'E', website: 'https://sap.com', painType: 'ERP Agent Governance', evidence: 'Joule AI agents embedded in SAP ERP/finance workflows; agent-initiated financial actions lack cryptographic governance', sourceLink: 'https://sap.com/enterprise', currentSolution: 'SAP GRC, enterprise security', governanceGap: 'ERP financial agent actions lack cryptographic policy enforcement', urgencyScore: 8, accessibilityScore: 1, strategicValueScore: 10, funding: 'Public', linkedIn: 'https://linkedin.com/company/sap' },
  { company: 'Workday (AI)', category: 'Enterprise AI Agents', categoryCode: 'E', website: 'https://workday.com', painType: 'Finance Agent Auth', evidence: 'AI agents in Workday Finance/HR cloud; autonomous payroll and financial action agents lack cryptographic governance', sourceLink: 'https://workday.com/enterprise', currentSolution: 'Workday Security, RBAC', governanceGap: 'Finance and HR agent actions lack cryptographic policy enforcement', urgencyScore: 7, accessibilityScore: 2, strategicValueScore: 9, funding: 'Public', linkedIn: 'https://linkedin.com/company/workday' },

  // ══════════════════════════════════════════════════════════════
  // F – AGENT-TO-AGENT COMMERCE (12 companies)
  // Multi-agent frameworks where agents buy and sell services from each other
  // ══════════════════════════════════════════════════════════════
  { company: 'Presta', category: 'Agent-to-Agent Commerce', categoryCode: 'F', website: 'https://wearepresta.com', painType: 'Reputation & Dispute', evidence: 'AI Agent Marketplace 2026 — agent-to-agent transactions need cryptographic identity & governance', sourceLink: 'https://wearepresta.com/contact', currentSolution: 'Not disclosed', governanceGap: 'No cryptographic agent identity or transaction authorization', urgencyScore: 9, accessibilityScore: 10, strategicValueScore: 5, funding: 'Not disclosed', linkedIn: 'https://linkedin.com/company/wearepresta' },
  { company: 'Tines', category: 'Agent-to-Agent Commerce', categoryCode: 'F', website: 'https://tines.com', painType: 'Workflow Auth', evidence: '$271M funding; no-code agentic workflows — agents trigger payments needing governance', sourceLink: 'https://tines.com/partners', currentSolution: 'Enterprise security, SOC 2', governanceGap: 'No cryptographic authorization for agent-triggered actions', urgencyScore: 7, accessibilityScore: 5, strategicValueScore: 7, funding: '$271M', linkedIn: 'https://linkedin.com/company/tines' },
  { company: 'AutoGen (Microsoft)', category: 'Agent-to-Agent Commerce', categoryCode: 'F', website: 'https://microsoft.github.io/autogen', painType: 'Multi-Agent Transaction Auth', evidence: 'Microsoft multi-agent orchestration framework; agents negotiating and executing transactions lack cryptographic governance', sourceLink: 'https://microsoft.github.io/autogen', currentSolution: 'Open source framework', governanceGap: 'No cryptographic governance for agent-to-agent transaction authorization', urgencyScore: 9, accessibilityScore: 8, strategicValueScore: 7, funding: 'Microsoft Research', linkedIn: 'https://linkedin.com/company/microsoft' },
  { company: 'CrewAI', category: 'Agent-to-Agent Commerce', categoryCode: 'F', website: 'https://crewai.com', painType: 'Crew Commerce Governance', evidence: 'Multi-agent crew framework with commercial task execution; agent crews executing financial tasks lack governance', sourceLink: 'https://crewai.com', currentSolution: 'Open source framework', governanceGap: 'Agent crew financial task execution lacks cryptographic policy enforcement', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 6, funding: '$18M+', linkedIn: 'https://linkedin.com/company/crewai' },
  { company: 'AgentLayer', category: 'Agent-to-Agent Commerce', categoryCode: 'F', website: 'https://agentlayer.xyz', painType: 'Agent Commerce Identity', evidence: 'Agent-to-agent communication and commerce protocol; agent commerce lacks cryptographic identity and governance', sourceLink: 'https://agentlayer.xyz', currentSolution: 'Layer-2 for agent communication', governanceGap: 'No cryptographic agent identity or policy enforcement for agent commerce', urgencyScore: 9, accessibilityScore: 9, strategicValueScore: 6, funding: 'Early stage', linkedIn: 'https://linkedin.com/company/agentlayer' },
  { company: 'Autonolas (Olas)', category: 'Agent-to-Agent Commerce', categoryCode: 'F', website: 'https://olas.network', painType: 'Service Commerce Governance', evidence: 'Multi-agent service network for autonomous economic services; service commerce lacks cryptographic governance', sourceLink: 'https://olas.network', currentSolution: 'Staking, on-chain service registry', governanceGap: 'Autonomous service commerce lacks cryptographic policy enforcement', urgencyScore: 9, accessibilityScore: 8, strategicValueScore: 7, funding: '$20M+', linkedIn: 'https://linkedin.com/company/autonolas' },
  { company: 'SuperAGI', category: 'Agent-to-Agent Commerce', categoryCode: 'F', website: 'https://superagi.com', painType: 'Autonomous Agent Commerce', evidence: 'Open-source autonomous agent platform; agents executing commercial tasks lack cryptographic governance', sourceLink: 'https://superagi.com', currentSolution: 'Open source platform', governanceGap: 'Autonomous commercial agent actions lack cryptographic enforcement', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 5, funding: '$5M+', linkedIn: 'https://linkedin.com/company/superagi' },
  { company: 'Fixie.ai', category: 'Agent-to-Agent Commerce', categoryCode: 'F', website: 'https://fixie.ai', painType: 'Agent Tool Commerce', evidence: 'AI agent development platform with tool marketplace; agent tool purchases and commerce lack governance', sourceLink: 'https://fixie.ai', currentSolution: 'API-based tool integration', governanceGap: 'Agent-to-agent tool commerce lacks cryptographic policy enforcement', urgencyScore: 7, accessibilityScore: 9, strategicValueScore: 5, funding: '$17M', linkedIn: 'https://linkedin.com/company/fixie-ai' },
  { company: 'LlamaIndex', category: 'Agent-to-Agent Commerce', categoryCode: 'F', website: 'https://llamaindex.ai', painType: 'Agent Data Commerce', evidence: 'Agent data framework with tool and data exchange; agent-to-agent data commerce lacks governance layer', sourceLink: 'https://llamaindex.ai/enterprise', currentSolution: 'Open source framework', governanceGap: 'Agent data commerce and tool exchange lack cryptographic governance', urgencyScore: 7, accessibilityScore: 7, strategicValueScore: 6, funding: '$18M+', linkedIn: 'https://linkedin.com/company/llamaindex' },
  { company: 'Swarm (OpenAI)', category: 'Agent-to-Agent Commerce', categoryCode: 'F', website: 'https://openai.com/research', painType: 'Multi-Agent Coordination Auth', evidence: 'OpenAI multi-agent orchestration framework; agent coordination involving financial actions lacks governance', sourceLink: 'https://openai.com', currentSolution: 'OpenAI API, function calling', governanceGap: 'No cryptographic governance for multi-agent coordination involving financial actions', urgencyScore: 8, accessibilityScore: 3, strategicValueScore: 10, funding: '$50B+ valuation', linkedIn: 'https://linkedin.com/company/openai' },
  { company: 'AgentGPT', category: 'Agent-to-Agent Commerce', categoryCode: 'F', website: 'https://agentgpt.reworkd.ai', painType: 'Autonomous Task Commerce', evidence: 'Web-based autonomous agent framework; agents executing commercial tasks lack cryptographic authorization', sourceLink: 'https://agentgpt.reworkd.ai', currentSolution: 'Web-based agent execution', governanceGap: 'Autonomous commercial task execution lacks cryptographic governance', urgencyScore: 7, accessibilityScore: 9, strategicValueScore: 4, funding: '$1.25M', linkedIn: 'https://linkedin.com/company/reworkd' },
  { company: 'AutoGPT', category: 'Agent-to-Agent Commerce', categoryCode: 'F', website: 'https://autogpt.net', painType: 'Autonomous Action Governance', evidence: 'Pioneering autonomous agent framework; uncontrolled agent actions in commercial contexts lack cryptographic governance', sourceLink: 'https://autogpt.net', currentSolution: 'Open source', governanceGap: 'Autonomous commercial agent actions lack cryptographic policy enforcement', urgencyScore: 8, accessibilityScore: 8, strategicValueScore: 5, funding: 'Open Source', linkedIn: '' },

  // ══════════════════════════════════════════════════════════════
  // G – AUTONOMOUS PROCUREMENT (15 companies)
  // AI agents autonomously sourcing, negotiating, and creating purchase commitments
  // ══════════════════════════════════════════════════════════════
  { company: 'Pactum AI', category: 'Autonomous Procurement', categoryCode: 'G', website: 'https://pactum.ai', painType: 'Negotiation Auth', evidence: 'Autonomous negotiation AI for tail spend — needs cryptographic authorization for procurement decisions', sourceLink: 'https://pactum.ai/contact', currentSolution: 'Not disclosed', governanceGap: 'No policy enforcement for autonomous negotiations', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 5, funding: 'Seed', linkedIn: 'https://linkedin.com/company/pactum-ai' },
  { company: 'Keelvar', category: 'Autonomous Procurement', categoryCode: 'G', website: 'https://keelvar.com', painType: 'Sourcing Compliance', evidence: 'Autonomous sourcing AI — agents execute procurement needing governance', sourceLink: 'https://keelvar.com/contact', currentSolution: 'Enterprise security', governanceGap: 'No cryptographic authorization for sourcing decisions', urgencyScore: 7, accessibilityScore: 7, strategicValueScore: 6, funding: 'Not disclosed', linkedIn: 'https://linkedin.com/company/keelvar' },
  { company: 'Arkestro', category: 'Autonomous Procurement', categoryCode: 'G', website: 'https://arkestro.com', painType: 'Purchase Auth', evidence: 'Predictive sourcing intelligence — agents may execute purchases needing governance', sourceLink: 'https://arkestro.com/partners', currentSolution: 'Enterprise security', governanceGap: 'No cryptographic enforcement for procurement actions', urgencyScore: 7, accessibilityScore: 6, strategicValueScore: 6, funding: '$50M+', linkedIn: 'https://linkedin.com/company/arkestro' },
  { company: 'Suplari', category: 'Autonomous Procurement', categoryCode: 'G', website: 'https://suplari.com', painType: 'Transaction Auth', evidence: 'Autonomous procurement AI for spend management — agents execute transactions needing governance', sourceLink: 'https://suplari.com/contact', currentSolution: 'Enterprise security', governanceGap: 'No cryptographic authorization for transactions', urgencyScore: 7, accessibilityScore: 7, strategicValueScore: 5, funding: 'Not disclosed', linkedIn: 'https://linkedin.com/company/suplari' },
  { company: 'Jaggaer', category: 'Autonomous Procurement', categoryCode: 'G', website: 'https://jaggaer.com', painType: 'Intelligent Sourcing Governance', evidence: 'AI-driven sourcing and procurement platform; autonomous sourcing agent decisions lack cryptographic authorization', sourceLink: 'https://jaggaer.com/contact', currentSolution: 'Enterprise procurement platform', governanceGap: 'Autonomous sourcing decisions lack cryptographic policy enforcement', urgencyScore: 8, accessibilityScore: 5, strategicValueScore: 7, funding: '$500M+', linkedIn: 'https://linkedin.com/company/jaggaer' },
  { company: 'GEP SMART', category: 'Autonomous Procurement', categoryCode: 'G', website: 'https://gep.com', painType: 'Procurement AI Auth', evidence: 'AI-powered procurement platform for enterprises; autonomous procurement actions lack cryptographic governance', sourceLink: 'https://gep.com/contact', currentSolution: 'Enterprise security, SOC 2', governanceGap: 'Autonomous procurement agent actions lack cryptographic policy enforcement', urgencyScore: 7, accessibilityScore: 4, strategicValueScore: 7, funding: 'Private', linkedIn: 'https://linkedin.com/company/gep' },
  { company: 'SAP Ariba', category: 'Autonomous Procurement', categoryCode: 'G', website: 'https://sap.com/ariba', painType: 'Enterprise Procurement Governance', evidence: 'Enterprise procurement network with AI; autonomous procurement agents lack cryptographic governance', sourceLink: 'https://sap.com/ariba', currentSolution: 'SAP GRC, enterprise controls', governanceGap: 'Autonomous procurement agent actions lack cryptographic enforcement in regulated enterprises', urgencyScore: 7, accessibilityScore: 2, strategicValueScore: 9, funding: 'SAP (Public)', linkedIn: 'https://linkedin.com/company/sap' },
  { company: 'Ivalua', category: 'Autonomous Procurement', categoryCode: 'G', website: 'https://ivalua.com', painType: 'Procurement Decision Auth', evidence: 'AI-driven source-to-pay platform; procurement decision agents lack cryptographic authorization layer', sourceLink: 'https://ivalua.com/contact', currentSolution: 'Enterprise access control', governanceGap: 'Procurement decision agents lack cryptographic policy enforcement', urgencyScore: 7, accessibilityScore: 5, strategicValueScore: 6, funding: '$60M+', linkedIn: 'https://linkedin.com/company/ivalua' },
  { company: 'Procurify', category: 'Autonomous Procurement', categoryCode: 'G', website: 'https://procurify.com', painType: 'Spend Request Governance', evidence: 'Spend management with AI; automated purchase requests lack cryptographic agent governance', sourceLink: 'https://procurify.com', currentSolution: 'Approval workflows, spend controls', governanceGap: 'Automated purchase request agents lack cryptographic policy enforcement', urgencyScore: 7, accessibilityScore: 7, strategicValueScore: 5, funding: '$50M+', linkedIn: 'https://linkedin.com/company/procurify' },
  { company: 'Fairmarkit', category: 'Autonomous Procurement', categoryCode: 'G', website: 'https://fairmarkit.com', painType: 'Autonomous Sourcing Auth', evidence: 'Autonomous procurement platform for tail spend; sourcing agent decisions lack cryptographic enforcement', sourceLink: 'https://fairmarkit.com/contact', currentSolution: 'AI-driven competitive bidding', governanceGap: 'Autonomous sourcing agent decisions lack cryptographic policy enforcement', urgencyScore: 8, accessibilityScore: 8, strategicValueScore: 5, funding: '$35M+', linkedIn: 'https://linkedin.com/company/fairmarkit' },
  { company: 'Scoutbee', category: 'Autonomous Procurement', categoryCode: 'G', website: 'https://scoutbee.com', painType: 'Supplier Discovery Governance', evidence: 'AI supplier discovery agent; supplier selection decisions lack cryptographic authorization', sourceLink: 'https://scoutbee.com/contact', currentSolution: 'AI supplier intelligence', governanceGap: 'AI-driven supplier selection lacks cryptographic policy enforcement', urgencyScore: 7, accessibilityScore: 8, strategicValueScore: 5, funding: '$60M+', linkedIn: 'https://linkedin.com/company/scoutbee' },
  { company: 'Globality', category: 'Autonomous Procurement', categoryCode: 'G', website: 'https://globality.com', painType: 'Autonomous Sourcing Control', evidence: 'Autonomous AI sourcing for services procurement; agent-driven sourcing commitments lack cryptographic governance', sourceLink: 'https://globality.com/contact', currentSolution: 'AI-driven smart sourcing', governanceGap: 'Autonomous procurement commitment agents lack cryptographic policy enforcement', urgencyScore: 8, accessibilityScore: 7, strategicValueScore: 6, funding: '$300M+', linkedIn: 'https://linkedin.com/company/globality' },
  { company: 'Tradogram', category: 'Autonomous Procurement', categoryCode: 'G', website: 'https://tradogram.com', painType: 'PO Automation Auth', evidence: 'AI procurement management; automated PO creation by agents lacks cryptographic authorization', sourceLink: 'https://tradogram.com', currentSolution: 'Procurement workflow management', governanceGap: 'Agent-automated PO creation lacks cryptographic policy enforcement', urgencyScore: 6, accessibilityScore: 8, strategicValueScore: 4, funding: 'Not disclosed', linkedIn: 'https://linkedin.com/company/tradogram' },
  { company: 'Zip (Procurement)', category: 'Autonomous Procurement', categoryCode: 'G', website: 'https://ziphq.com', painType: 'Intake-to-Procure Governance', evidence: 'Intake-to-procure automation with AI; autonomous procurement intake agents lack cryptographic governance', sourceLink: 'https://ziphq.com/enterprise', currentSolution: 'Workflow automation, approval routing', governanceGap: 'Autonomous procurement intake agents lack cryptographic policy enforcement', urgencyScore: 8, accessibilityScore: 7, strategicValueScore: 6, funding: '$180M+', linkedIn: 'https://linkedin.com/company/zip-hq' },
  { company: 'Simfoni', category: 'Autonomous Procurement', categoryCode: 'G', website: 'https://simfoni.com', painType: 'Spend Analytics Agent Auth', evidence: 'AI spend analytics and automation; autonomous spend decision agents lack cryptographic governance', sourceLink: 'https://simfoni.com/contact', currentSolution: 'Spend analytics platform', governanceGap: 'Autonomous spend analytics agent actions lack cryptographic enforcement', urgencyScore: 6, accessibilityScore: 8, strategicValueScore: 5, funding: 'Not disclosed', linkedIn: 'https://linkedin.com/company/simfoni' },

  // ══════════════════════════════════════════════════════════════
  // H – FINANCIAL INFRASTRUCTURE (16 companies)
  // Settlement rails, compliance, custody, and analytics
  // ══════════════════════════════════════════════════════════════
  { company: 'Alchemy', category: 'Financial Infrastructure', categoryCode: 'H', website: 'https://alchemy.com', painType: 'Agent Authorization', evidence: 'Agent wallet demo with $45M volume & 162M transactions; needs cryptographic governance for agent autonomy', sourceLink: 'https://alchemy.com/partners', currentSolution: 'Blockchain infrastructure security', governanceGap: 'No threshold signing for agent operations', urgencyScore: 9, accessibilityScore: 4, strategicValueScore: 9, funding: '$700M+', linkedIn: 'https://linkedin.com/company/alchemyinc' },
  { company: 'Lightning Labs', category: 'Financial Infrastructure', categoryCode: 'H', website: 'https://lightning.engineering', painType: 'Key Management', evidence: 'AI agents on Lightning Network via L402; no policy enforcement for agent payments', sourceLink: 'https://lightning.engineering/contact', currentSolution: 'Lightning Network security', governanceGap: 'No policy enforcement for agent payments', urgencyScore: 8, accessibilityScore: 7, strategicValueScore: 6, funding: '$70M+', linkedIn: 'https://linkedin.com/company/lightning-labs' },
  { company: 'BNB Chain', category: 'Financial Infrastructure', categoryCode: 'H', website: 'https://bnbchain.org', painType: 'On-chain Identity', evidence: 'ERC-8004 (AI agent identity) + BAP-578 deployed; agent identity lacks cryptographic policy enforcement', sourceLink: 'https://bnbchain.org/partners', currentSolution: 'Blockchain security', governanceGap: 'Agent identity lacks cryptographic policy enforcement', urgencyScore: 8, accessibilityScore: 4, strategicValueScore: 9, funding: 'Not disclosed', linkedIn: 'https://linkedin.com/company/bnbchain' },
  { company: 'Visa', category: 'Financial Infrastructure', categoryCode: 'H', website: 'https://visa.com', painType: 'Agent Auth at Scale', evidence: '$1T+ volume researching agent payments; no agent-specific cryptographic controls', sourceLink: 'https://developer.visa.com', currentSolution: 'Established payment security', governanceGap: 'No agent-specific cryptographic controls', urgencyScore: 7, accessibilityScore: 1, strategicValueScore: 10, funding: 'Public', linkedIn: 'https://linkedin.com/company/visa' },
  { company: 'Mastercard', category: 'Financial Infrastructure', categoryCode: 'H', website: 'https://mastercard.com', painType: 'Agent Auth at Scale', evidence: 'Agentic payments infra + virtual card platforms for AI agents; no agent-specific cryptographic enforcement', sourceLink: 'https://developer.mastercard.com', currentSolution: 'Established payment security', governanceGap: 'No agent-specific cryptographic enforcement', urgencyScore: 7, accessibilityScore: 1, strategicValueScore: 10, funding: 'Public', linkedIn: 'https://linkedin.com/company/mastercard' },
  { company: 'Fireblocks', category: 'Financial Infrastructure', categoryCode: 'H', website: 'https://fireblocks.com', painType: 'Agent MPC Governance', evidence: '$8B+ secured; MPC-based custody for agent operations — agent-specific policy enforcement not natively built', sourceLink: 'https://fireblocks.com/enterprise', currentSolution: 'MPC-CMP, policy engine, HSM', governanceGap: 'Agent-specific cryptographic governance layer not natively supported for autonomous agent operations', urgencyScore: 9, accessibilityScore: 5, strategicValueScore: 9, funding: '$1.1B', linkedIn: 'https://linkedin.com/company/fireblocks' },
  { company: 'Chainalysis', category: 'Financial Infrastructure', categoryCode: 'H', website: 'https://chainalysis.com', painType: 'Agent Compliance Audit', evidence: 'Blockchain analytics for compliance; agent-initiated transactions need immutable audit trail governance', sourceLink: 'https://chainalysis.com/enterprise', currentSolution: 'Transaction monitoring, KYT', governanceGap: 'Agent-initiated transaction audit trails lack cryptographic immutability and policy binding', urgencyScore: 8, accessibilityScore: 4, strategicValueScore: 8, funding: '$536M', linkedIn: 'https://linkedin.com/company/chainalysis' },
  { company: 'TRM Labs', category: 'Financial Infrastructure', categoryCode: 'H', website: 'https://trmlabs.com', painType: 'Agent Risk Intelligence', evidence: 'Blockchain risk intelligence for compliance; agent transactions need real-time risk governance', sourceLink: 'https://trmlabs.com/contact', currentSolution: 'On-chain risk scoring, AML', governanceGap: 'Agent transaction risk governance lacks cryptographic policy enforcement', urgencyScore: 8, accessibilityScore: 6, strategicValueScore: 7, funding: '$180M', linkedIn: 'https://linkedin.com/company/trm-labs' },
  { company: 'Elliptic', category: 'Financial Infrastructure', categoryCode: 'H', website: 'https://elliptic.co', painType: 'Agent Compliance Controls', evidence: 'Crypto compliance intelligence; agent-initiated transactions need compliance governance layer', sourceLink: 'https://elliptic.co/enterprise', currentSolution: 'AML, sanctions screening', governanceGap: 'Agent-initiated transaction compliance controls lack cryptographic enforcement', urgencyScore: 7, accessibilityScore: 6, strategicValueScore: 7, funding: '$60M+', linkedIn: 'https://linkedin.com/company/elliptic' },
  { company: 'Copper', category: 'Financial Infrastructure', categoryCode: 'H', website: 'https://copper.co', painType: 'Prime Broker Agent Governance', evidence: 'Digital asset prime brokerage; agent-driven prime brokerage operations lack cryptographic governance', sourceLink: 'https://copper.co/enterprise', currentSolution: 'ClearLoop, MPC custody', governanceGap: 'Agent-driven prime brokerage operations lack cryptographic policy enforcement', urgencyScore: 8, accessibilityScore: 5, strategicValueScore: 8, funding: '$75M+', linkedIn: 'https://linkedin.com/company/copper-co' },
  { company: 'Metaco (Ripple)', category: 'Financial Infrastructure', categoryCode: 'H', website: 'https://metaco.com', painType: 'Digital Asset Agent Orchestration', evidence: 'Digital asset orchestration for banks; agent-driven asset management operations lack cryptographic governance', sourceLink: 'https://metaco.com/enterprise', currentSolution: 'HARMONIZE platform, HSM', governanceGap: 'Agent-driven digital asset orchestration lacks cryptographic policy enforcement', urgencyScore: 8, accessibilityScore: 4, strategicValueScore: 8, funding: 'Ripple acquisition ($250M)', linkedIn: 'https://linkedin.com/company/metaco' },
  { company: 'Talos', category: 'Financial Infrastructure', categoryCode: 'H', website: 'https://talos.com', painType: 'Institutional Trading Agent Control', evidence: 'Institutional crypto trading infrastructure; autonomous trading agent operations lack cryptographic governance', sourceLink: 'https://talos.com/contact', currentSolution: 'FIX protocol, institutional controls', governanceGap: 'Autonomous trading agent operations lack cryptographic policy enforcement', urgencyScore: 8, accessibilityScore: 5, strategicValueScore: 8, funding: '$105M', linkedIn: 'https://linkedin.com/company/talos-trading' },
  { company: 'Coinbase Institutional', category: 'Financial Infrastructure', categoryCode: 'H', website: 'https://institutional.coinbase.com', painType: 'Agent Custody Governance', evidence: 'Institutional crypto custody; agent-authorized custody operations lack cryptographic governance layer', sourceLink: 'https://institutional.coinbase.com', currentSolution: 'Cold storage, multi-sig', governanceGap: 'Agent-authorized custody and settlement operations lack cryptographic policy enforcement', urgencyScore: 7, accessibilityScore: 3, strategicValueScore: 9, funding: 'Public', linkedIn: 'https://linkedin.com/company/coinbase' },
  { company: 'Paxos', category: 'Financial Infrastructure', categoryCode: 'H', website: 'https://paxos.com', painType: 'Settlement Agent Auth', evidence: 'Regulated stablecoin and settlement infrastructure; agent-initiated settlement lacks cryptographic governance', sourceLink: 'https://paxos.com/enterprise', currentSolution: 'Regulated infrastructure, NYDFS licensed', governanceGap: 'Agent-initiated settlement and stablecoin operations lack cryptographic policy enforcement', urgencyScore: 8, accessibilityScore: 4, strategicValueScore: 8, funding: '$540M', linkedIn: 'https://linkedin.com/company/paxos' },
  { company: 'Zero Hash', category: 'Financial Infrastructure', categoryCode: 'H', website: 'https://zerohash.com', painType: 'Embedded Crypto Agent Rails', evidence: 'Embedded crypto infrastructure powering agent payment backends; agent-initiated operations lack cryptographic governance', sourceLink: 'https://zerohash.com/contact', currentSolution: 'B2B crypto infrastructure, compliance stack', governanceGap: 'Agent-initiated embedded crypto operations lack cryptographic policy enforcement', urgencyScore: 8, accessibilityScore: 6, strategicValueScore: 7, funding: '$35M+', linkedIn: 'https://linkedin.com/company/zero-hash' },
  { company: 'Anchorage (Settlement)', category: 'Financial Infrastructure', categoryCode: 'H', website: 'https://anchorage.com', painType: 'Regulated Agent Settlement', evidence: 'First federally chartered digital asset bank; agent-initiated regulated settlement lacks cryptographic governance', sourceLink: 'https://anchorage.com/enterprise', currentSolution: 'Fed-chartered bank, MPC', governanceGap: 'Agent-initiated regulated settlement operations lack cryptographic policy enforcement', urgencyScore: 9, accessibilityScore: 4, strategicValueScore: 9, funding: '$350M+', linkedIn: 'https://linkedin.com/company/anchorage' },
]

// ── Category metadata ──────────────────────────────────────────
const CATEGORY_META: Record<string, { code: string; color: string; description: string }> = {
  'Agent Payments':          { code: 'A', color: '#a78bfa', description: 'Platforms moving money on behalf of AI agents — SDKs, stablecoins, Lightning' },
  'Agent Wallets':           { code: 'B', color: '#38bdf8', description: 'MPC, smart account & embedded wallet infra for autonomous agent signing' },
  'AI Trading / DeFi Agents':{ code: 'C', color: '#34d399', description: 'Autonomous agents executing trades, managing LP positions and lending strategies' },
  'Treasury Automation':     { code: 'D', color: '#fbbf24', description: 'DAO and corporate treasury management driven by AI agents' },
  'Enterprise AI Agents':    { code: 'E', color: '#f472b6', description: 'Enterprise workflow agents with financial action authority (ERP, RPA, procurement)' },
  'Agent-to-Agent Commerce': { code: 'F', color: '#fb923c', description: 'Multi-agent frameworks where agents buy and sell services from each other' },
  'Autonomous Procurement':  { code: 'G', color: '#818cf8', description: 'AI agents autonomously sourcing, negotiating, and creating purchase commitments' },
  'Financial Infrastructure':{ code: 'H', color: '#22d3ee', description: 'Settlement rails, compliance, custody, and analytics underpinning agent finance' },
}

const CATEGORIES = ['All', ...Object.keys(CATEGORY_META)]
type SortKey = 'company' | 'urgencyScore' | 'accessibilityScore' | 'strategicValueScore' | 'total'

function scoreColor(score: number) {
  if (score >= 9) return { color: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.3)' }
  if (score >= 7) return { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)' }
  return { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' }
}

function ScorePill({ score }: { score: number }) {
  const { color, bg, border } = scoreColor(score)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, padding: '3px 8px', borderRadius: 7, fontSize: 12, fontWeight: 700, color, background: bg, border: `1px solid ${border}` }}>
      {score}
    </span>
  )
}

export default function AgenticPaymentsPage() {
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState<SortKey>('total')
  const [sortAsc, setSortAsc] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [bulkAdding, setBulkAdding] = useState<string | null>(null)

  const filtered = ALL_TARGETS.filter(t => {
    const matchCat = category === 'All' || t.category === category
    const q = search.toLowerCase()
    const matchSearch = !q ||
      t.company.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.painType.toLowerCase().includes(q) ||
      t.governanceGap.toLowerCase().includes(q) ||
      t.categoryCode.toLowerCase().includes(q)
    return matchCat && matchSearch
  })

  const totalScore = (t: AgentTarget) => t.urgencyScore + t.accessibilityScore + t.strategicValueScore

  const sorted = [...filtered].sort((a, b) => {
    let diff = 0
    if (sort === 'company') diff = a.company.localeCompare(b.company)
    else if (sort === 'urgencyScore') diff = a.urgencyScore - b.urgencyScore
    else if (sort === 'accessibilityScore') diff = a.accessibilityScore - b.accessibilityScore
    else if (sort === 'strategicValueScore') diff = a.strategicValueScore - b.strategicValueScore
    else diff = totalScore(a) - totalScore(b)
    return sortAsc ? diff : -diff
  })

  const toggleSort = (key: SortKey) => {
    if (sort === key) setSortAsc(s => !s)
    else { setSort(key); setSortAsc(false) }
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sort === k
      ? (sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
      : <ChevronDown size={11} style={{ opacity: 0.3 }} />

  const addToPipeline = async (t: AgentTarget) => {
    setAdding(t.company)
    try {
      const { error } = await supabase.from('leads').insert({
        company_name: t.company,
        website: t.website,
        twitter_url: null,
        description: t.evidence,
        industry_category: t.category,
        customer_category: ['Agentic Payments Customer'],
        product_to_sell: 'Agentic payment rails',
        pain_point: t.governanceGap,
        pain_point_severity: t.urgencyScore >= 9 ? 'critical' : t.urgencyScore >= 7 ? 'high' : 'medium',
        pain_point_evidence: t.evidence,
        pain_point_evidence_type: 'agent_analysis',
        kima_fit: `Kima provides the agentic payment rails that ${t.company} needs: ${t.governanceGap}`,
        trigger_reason: `${t.company} is building in the ${t.category} space with a clear payment/governance gap: ${t.governanceGap}`,
        settlement_angle: t.currentSolution,
        integration_feasibility: t.accessibilityScore >= 8 ? 'high' : t.accessibilityScore >= 5 ? 'medium' : 'low',
        lead_score: Math.round((t.urgencyScore + t.accessibilityScore + t.strategicValueScore) / 30 * 100),
        priority: t.urgencyScore >= 9 ? 'excellent' : t.urgencyScore >= 7 ? 'qualified' : 'needs_research',
        status: 'new',
        source_url: t.sourceLink,
        updated_at: new Date().toISOString(),
      })
      if (error) {
        if (error.code === '23505') { toast(`${t.company} already in your pipeline`); setAdded(s => new Set([...s, t.company])) }
        else toast.error('Failed to add: ' + error.message)
      } else {
        toast.success(`✓ ${t.company} added to BD pipeline`)
        setAdded(s => new Set([...s, t.company]))
      }
    } catch { toast.error('Failed') }
    setAdding(null)
  }

  const bulkAddCategory = async (cat: string) => {
    const targets = ALL_TARGETS.filter(t => t.category === cat && !added.has(t.company))
    if (!targets.length) { toast('All companies in this category already added'); return }
    if (!confirm(`Add all ${targets.length} companies from "${cat}" to your BD pipeline?`)) return
    setBulkAdding(cat)
    let successCount = 0
    for (const t of targets) {
      try {
        const { error } = await supabase.from('leads').insert({
          company_name: t.company,
          website: t.website,
          twitter_url: null,
          description: t.evidence,
          industry_category: t.category,
          customer_category: ['Agentic Payments Customer'],
          product_to_sell: 'Agentic payment rails',
          pain_point: t.governanceGap,
          pain_point_severity: t.urgencyScore >= 9 ? 'critical' : t.urgencyScore >= 7 ? 'high' : 'medium',
          pain_point_evidence: t.evidence,
          pain_point_evidence_type: 'agent_analysis',
          kima_fit: `Kima provides the agentic payment rails that ${t.company} needs: ${t.governanceGap}`,
          trigger_reason: `${t.company} is building in the ${t.category} space with a clear payment/governance gap: ${t.governanceGap}`,
          settlement_angle: t.currentSolution,
          integration_feasibility: t.accessibilityScore >= 8 ? 'high' : t.accessibilityScore >= 5 ? 'medium' : 'low',
          lead_score: Math.round((t.urgencyScore + t.accessibilityScore + t.strategicValueScore) / 30 * 100),
          priority: t.urgencyScore >= 9 ? 'excellent' : t.urgencyScore >= 7 ? 'qualified' : 'needs_research',
          status: 'new',
          source_url: t.sourceLink,
          updated_at: new Date().toISOString(),
        })
        if (!error || error.code === '23505') {
          successCount++
          setAdded(s => new Set([...s, t.company]))
        }
      } catch { /* continue */ }
    }
    toast.success(`Added ${successCount} companies from ${cat} to pipeline`)
    setBulkAdding(null)
  }

  // Stats
  const topTargets = ALL_TARGETS.filter(t => totalScore(t) >= 22).length
  const avgScore = Math.round(ALL_TARGETS.reduce((s, t) => s + totalScore(t), 0) / ALL_TARGETS.length)
  const activeCatMeta = category !== 'All' ? CATEGORY_META[category] : null

  return (
    <div className="fade-in">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2">
              <CreditCard size={18} style={{ color: '#a78bfa' }} />
              Agentic Payments
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)', marginLeft: 4 }}>
                AEREDIUM Market Map
              </span>
            </h1>
            <p style={{ fontSize: 12, marginTop: 4, color: 'rgb(100,106,135)', fontWeight: 500 }}>
              {ALL_TARGETS.length} companies · 8 categories · AI Agent Governance gap intelligence
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* Bulk add current category */}
            {category !== 'All' && (
              <button
                onClick={() => bulkAddCategory(category)}
                disabled={bulkAdding === category}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${activeCatMeta?.color ?? '#a78bfa'}50`, background: `${activeCatMeta?.color ?? '#a78bfa'}14`, color: activeCatMeta?.color ?? '#a78bfa' }}
              >
                {bulkAdding === category ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                Bulk Add {category}
              </button>
            )}
            {/* Export */}
            <button
              onClick={() => {
                const csv = ['Company,Category,Website,Pain Type,Governance Gap,Urgency,Accessibility,Strategic Value,Total Score',
                  ...sorted.map(t => `"${t.company}","${t.category}","${t.website}","${t.painType}","${t.governanceGap}",${t.urgencyScore},${t.accessibilityScore},${t.strategicValueScore},${totalScore(t)}`)
                ].join('\n')
                const a = document.createElement('a'); a.href = 'data:text/csv,' + encodeURIComponent(csv); a.download = 'agentic-payments-targets.csv'; a.click()
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgb(160,165,195)' }}
            >
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 36px' }}>

        {/* ── Stats row ──────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Companies', value: ALL_TARGETS.length, color: '#a78bfa' },
            { label: 'Top Priority (≥22)', value: topTargets, color: '#34d399' },
            { label: 'Market Categories', value: 8, color: '#38bdf8' },
            { label: 'Avg Score /30', value: avgScore, color: '#fbbf24' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${s.color}20`, borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'rgb(120,127,160)', marginTop: 5 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Score legend ───────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, fontSize: 11, color: 'rgb(120,127,160)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: 'rgb(150,155,185)' }}>Score guide:</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#34d399', display: 'inline-block' }} />9–10 = Critical/Excellent</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#fbbf24', display: 'inline-block' }} />7–8 = High/Good</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#f87171', display: 'inline-block' }} />1–6 = Low</span>
          <span style={{ marginLeft: 8 }}>· <b>Urgency</b>: how urgently they need Kima · <b>Accessibility</b>: how easy to reach (10=startup, 1=public corp) · <b>Strategic Value</b>: market impact</span>
        </div>

        {/* ── Category pills ─────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search box */}
          <div style={{ position: 'relative', flex: '0 0 240px' }}>
            <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgb(120,127,160)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search company, pain, category…"
              style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <Filter size={13} style={{ color: 'rgb(120,127,160)', flexShrink: 0 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => {
              const meta = cat !== 'All' ? CATEGORY_META[cat] : null
              const isActive = category === cat
              const col = meta?.color ?? '#a78bfa'
              const count = cat === 'All' ? ALL_TARGETS.length : ALL_TARGETS.filter(t => t.category === cat).length
              return (
                <button key={cat} onClick={() => setCategory(cat)}
                  style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5, border: `1px solid ${isActive ? col + '60' : 'rgba(255,255,255,0.08)'}`, background: isActive ? col + '18' : 'rgba(255,255,255,0.03)', color: isActive ? col : 'rgb(150,155,185)', transition: 'all 0.15s' }}>
                  {meta && <span style={{ fontWeight: 800, fontSize: 9, padding: '1px 5px', borderRadius: 4, background: isActive ? col + '30' : 'rgba(255,255,255,0.06)', color: isActive ? col : 'rgb(120,127,160)' }}>{meta.code}</span>}
                  {cat}
                  <span style={{ fontWeight: 700, color: isActive ? col : 'rgb(130,137,170)', fontSize: 10 }}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Category description strip ─────────────────────────── */}
        {activeCatMeta && (
          <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 10, background: `${activeCatMeta.color}0c`, border: `1px solid ${activeCatMeta.color}25`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart2 size={13} style={{ color: activeCatMeta.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: activeCatMeta.color }}>{activeCatMeta.code} — {category}</span>
            <span style={{ fontSize: 11, color: 'rgb(140,147,180)' }}>{activeCatMeta.description}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: activeCatMeta.color, fontWeight: 700 }}>{filtered.length} companies</span>
          </div>
        )}

        {/* ── Table ─────────────────────────────────────────────── */}
        <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '40px 190px 150px 1fr 1fr 70px 70px 80px 70px 130px', gap: 0, background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '10px 16px', alignItems: 'center' }}>
            {[
              { label: '#', key: null },
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
            const catMeta = CATEGORY_META[t.category]
            const col = catMeta?.color ?? '#a78bfa'
            return (
              <div key={t.company + idx}>
                <div
                  style={{ display: 'grid', gridTemplateColumns: '40px 190px 150px 1fr 1fr 70px 70px 80px 70px 130px', gap: 0, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)', alignItems: 'center', transition: 'background 0.12s', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = `${col}08`}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)'}
                  onClick={() => setExpanded(isExpanded ? null : t.company)}
                >
                  {/* Rank */}
                  <div style={{ fontSize: 11, color: 'rgb(90,97,130)', fontWeight: 600 }}>{idx + 1}</div>

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
                    <span style={{ fontSize: 10, fontWeight: 700, color: col, background: col + '15', border: `1px solid ${col}30`, padding: '2px 7px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 800, opacity: 0.8 }}>{t.categoryCode}</span>
                      {t.category.length > 18 ? t.category.slice(0, 17) + '…' : t.category}
                    </span>
                  </div>

                  {/* Pain + Gap */}
                  <div style={{ paddingRight: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: 2 }}>{t.painType}</div>
                    <div style={{ fontSize: 11, color: 'rgb(160,165,195)', lineHeight: 1.4 }}>{t.governanceGap.slice(0, 75)}{t.governanceGap.length > 75 ? '…' : ''}</div>
                  </div>

                  {/* Current Solution */}
                  <div style={{ paddingRight: 12 }}>
                    <div style={{ fontSize: 11, color: 'rgb(140,145,175)', lineHeight: 1.4 }}>{t.currentSolution.slice(0, 65)}{t.currentSolution.length > 65 ? '…' : ''}</div>
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
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${col}50`, background: col + '14', color: col, opacity: adding === t.company ? 0.7 : 1, transition: 'all 0.15s' }}>
                        {adding === t.company ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                        Add to BD
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded detail row */}
                {isExpanded && (
                  <div style={{ padding: '16px 20px 20px 72px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: `linear-gradient(90deg, ${col}08 0%, rgba(0,0,0,0) 60%)` }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: col, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Evidence</div>
                        <p style={{ fontSize: 12, color: 'rgb(160,165,195)', lineHeight: 1.55, margin: 0 }}>{t.evidence}</p>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: col, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Governance Gap</div>
                        <p style={{ fontSize: 12, color: 'rgb(160,165,195)', lineHeight: 1.55, margin: 0 }}>{t.governanceGap}</p>
                        <div style={{ marginTop: 10, fontSize: 10, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Current Solution</div>
                        <p style={{ fontSize: 12, color: 'rgb(130,135,165)', lineHeight: 1.55, margin: 0 }}>{t.currentSolution}</p>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: col, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Links & Details</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <a href={t.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#38bdf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}><ExternalLink size={11} /> Website</a>
                          {t.linkedIn && <a href={t.linkedIn} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#818cf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}><ExternalLink size={11} /> LinkedIn</a>}
                          {t.sourceLink && <a href={t.sourceLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#a78bfa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}><ExternalLink size={11} /> Contact/Source</a>}
                          <div style={{ marginTop: 4, fontSize: 11, color: 'rgb(120,127,160)' }}>Funding: <span style={{ color: 'rgb(200,205,225)', fontWeight: 600 }}>{t.funding}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {sorted.length === 0 && (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: 'rgb(120,127,160)' }}>
              <CreditCard size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>No companies match your filters</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Try adjusting your search or category filter</div>
            </div>
          )}
        </div>

        {/* ── Category overview grid ─────────────────────────────── */}
        {category === 'All' && !search && (
          <div style={{ marginTop: 32 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgb(180,185,215)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={14} style={{ color: '#a78bfa' }} /> Category Breakdown
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {Object.entries(CATEGORY_META).map(([cat, meta]) => {
                const catTargets = ALL_TARGETS.filter(t => t.category === cat)
                const avgCat = Math.round(catTargets.reduce((s, t) => s + totalScore(t), 0) / catTargets.length)
                const top = catTargets.filter(t => totalScore(t) >= 22).length
                return (
                  <button key={cat} onClick={() => setCategory(cat)}
                    style={{ padding: '14px 16px', borderRadius: 12, border: `1px solid ${meta.color}22`, background: `${meta.color}08`, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${meta.color}16`; e.currentTarget.style.borderColor = `${meta.color}44` }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${meta.color}08`; e.currentTarget.style.borderColor = `${meta.color}22` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 6px', borderRadius: 5, background: meta.color + '25', color: meta.color }}>{meta.code}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{cat}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgb(120,127,160)', marginBottom: 8, lineHeight: 1.4 }}>{meta.description.slice(0, 60)}…</div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div><span style={{ fontSize: 18, fontWeight: 800, color: meta.color }}>{catTargets.length}</span><span style={{ fontSize: 10, color: 'rgb(120,127,160)', marginLeft: 3 }}>companies</span></div>
                      <div><span style={{ fontSize: 18, fontWeight: 800, color: '#34d399' }}>{top}</span><span style={{ fontSize: 10, color: 'rgb(120,127,160)', marginLeft: 3 }}>top priority</span></div>
                      <div><span style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24' }}>{avgCat}</span><span style={{ fontSize: 10, color: 'rgb(120,127,160)', marginLeft: 3 }}>avg/30</span></div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
