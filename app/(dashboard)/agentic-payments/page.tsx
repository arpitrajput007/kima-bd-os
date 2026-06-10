'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { agentActivity } from '@/lib/agent-activity'
import {
  CreditCard, Search, ExternalLink, Plus, ChevronUp, ChevronDown,
  Filter, Download, CheckCircle, Loader2, Zap, BarChart2,
} from 'lucide-react'

// == Types  -  exact spreadsheet columns ========================
interface AgentTarget {
  company: string
  category: string
  categoryCode: string
  website: string
  description: string       // "Desc" column
  whyAeredium: string       // "Why AEREDIUM" column
  governanceGap: string     // "Governance Gap" column
  painPoints: string        // "Pain Points" column
  funding: string           // "Funding" column
  urgencyScore: number
  accessibilityScore: number
  strategicValueScore: number
  linkedIn: string
  sourceLink: string
}

// == All 130 companies  -  exact spreadsheet format ==============
const ALL_TARGETS: AgentTarget[] = [

  // ==============================================================
  // A  -  AGENT PAYMENTS (24)
  // ==============================================================
  {
    company: 'Skyfire', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://skyfire.xyz',
    description: 'KYA (Know Your Agent) protocol enabling AI agents to hold wallets and make payments autonomously. Provides agent verification and identity layer for autonomous payments.',
    whyAeredium: 'Skyfire verifies agent identity but stops short of cryptographic policy enforcement  -  Aeredium layers threshold signing and spend-policy governance on top of Skyfire\'s KYA identity so every payment is bound by machine-readable rules.',
    governanceGap: 'Limited policy enforcement beyond identity verification  -  no threshold signing or spend controls post-verification.',
    painPoints: 'Identity & Liability: agents can be verified but still act outside allowed policy bounds without cryptographic enforcement.',
    funding: '$10M', urgencyScore: 10, accessibilityScore: 9, strategicValueScore: 6,
    linkedIn: 'https://linkedin.com/company/skyfire-ai', sourceLink: 'https://skyfire.xyz/contact',
  },
  {
    company: 'Nevermined', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://nevermined.io',
    description: 'Agent-native payment infrastructure with metering, virtual card delegation and scoped API keys. PCI-compliant via VGS. Used by AI agent builders to monetise and manage agent payments.',
    whyAeredium: 'Nevermined handles metering and delegation but has no cryptographic agent identity layer  -  Aeredium adds MPC-based threshold signing so high-value delegated payments require multi-party authorisation before execution.',
    governanceGap: 'No cryptographic agent identity or threshold signing for high-value delegated transactions.',
    painPoints: 'Spending Controls: virtual card delegation lacks cryptographic binding to agent identity.',
    funding: 'Series A', urgencyScore: 9, accessibilityScore: 8, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/nevermined-ai', sourceLink: 'https://nevermined.io/schedule-demo',
  },
  {
    company: 'Coinbase AgentKit', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://docs.cloud.coinbase.com/agentkit',
    description: 'Open-source SDK letting AI agents hold wallets and transact onchain. Powers the x402 payment standard with 162M+ transactions and $45M volume. Core building block for agentic commerce.',
    whyAeredium: 'AgentKit gives agents wallets but no governance over what those wallets can do autonomously  -  Aeredium provides the cryptographic policy layer that defines, enforces and audits every agent action before it hits the chain.',
    governanceGap: 'No threshold signing or policy enforcement for autonomous wallet operations at scale.',
    painPoints: 'Key Management: custodial agent wallets lack cryptographic spend-policy enforcement.',
    funding: 'Public (Coinbase)', urgencyScore: 9, accessibilityScore: 3, strategicValueScore: 9,
    linkedIn: 'https://linkedin.com/company/coinbase', sourceLink: 'https://docs.cloud.coinbase.com/agentkit',
  },
  {
    company: 'Stripe', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://stripe.com',
    description: '$1.9T annual payment volume. Actively building Agentic Commerce Protocol (ACP) to enable AI agents to transact on behalf of users. Largest payment processor exploring autonomous agent rails.',
    whyAeredium: 'Stripe\'s ACP is being built without a cryptographic agent authorisation layer  -  Aeredium provides the MPC-based threshold signing and policy enforcement that makes ACP enterprise-safe and regulator-ready.',
    governanceGap: 'ACP still in development; no cryptographic agent authorisation  -  human-in-the-loop remains manual.',
    painPoints: 'Autonomous Auth: agents initiating payments on behalf of users have no cryptographic governance.',
    funding: '$95B valuation', urgencyScore: 8, accessibilityScore: 2, strategicValueScore: 10,
    linkedIn: 'https://linkedin.com/company/stripe', sourceLink: 'https://stripe.com/partners',
  },
  {
    company: 'PayPal', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://paypal.com',
    description: '430M users, $1.5T volume. Positioning as the "Financial OS for AI agents." Launched AI agent payment features; agents can initiate payments on behalf of consumers and businesses.',
    whyAeredium: 'PayPal\'s agent financial OS needs a cryptographic governance layer  -  Aeredium binds agent identity to machine-readable spend policies and enforces threshold signing before any autonomous payment executes.',
    governanceGap: 'Agent payment workflows lack cryptographic policy enforcement  -  any authorised agent can spend without bounds.',
    painPoints: 'Compliance Gap: no cryptographic audit trail for agent-initiated transactions at $1.5T scale.',
    funding: 'Public', urgencyScore: 8, accessibilityScore: 2, strategicValueScore: 10,
    linkedIn: 'https://linkedin.com/company/paypal', sourceLink: 'https://paypal.com/partners',
  },
  {
    company: 'Adyen', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://adyen.com',
    description: '1.4T annual volume, 150+ currencies, 99.999% uptime. Full-stack payment platform with banking licences across EU, US, and APAC. Exploring agent-initiated payment flows for enterprise clients.',
    whyAeredium: 'Adyen processes enterprise payments with no agent-specific controls  -  Aeredium adds cryptographic agent identity and threshold signing so autonomous payment initiations are governed and auditable.',
    governanceGap: 'No agent-specific cryptographic controls  -  agent-initiated transactions indistinguishable from human-initiated.',
    painPoints: 'Cross-border Compliance: regulators require agent-payment audit trails Adyen cannot currently provide.',
    funding: 'Public', urgencyScore: 7, accessibilityScore: 2, strategicValueScore: 9,
    linkedIn: 'https://linkedin.com/company/adyen', sourceLink: 'https://adyen.com/partners',
  },
  {
    company: 'MoonPay', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://moonpay.com',
    description: '$555M funded crypto payment infrastructure. Powers fiat-to-crypto on-ramps for wallets, exchanges and AI agent backends. Processes millions of crypto purchases monthly.',
    whyAeredium: 'MoonPay\'s on-ramp is used by agent wallets with no governance over which agents can trigger fiat conversions  -  Aeredium enforces cryptographic spend policies and agent identity at the point of on-ramp initiation.',
    governanceGap: 'No cryptographic governance over agent wallet permissions for fiat conversion triggers.',
    painPoints: 'Agent Wallet Governance: autonomous agents can trigger unlimited on-ramp requests without policy bounds.',
    funding: '$555M', urgencyScore: 8, accessibilityScore: 7, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/moonpay', sourceLink: 'https://moonpay.com',
  },
  {
    company: 'Circle (USDC)', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://circle.com',
    description: '$1.1B funded. Issuer of USDC, the dominant stablecoin for agent payment rails. Cross-Chain Transfer Protocol (CCTP) used by agents for multi-chain settlement. Core stablecoin infrastructure for agentic commerce.',
    whyAeredium: 'USDC powers agent payments but carries no programmable spending policy at issuance  -  Aeredium wraps USDC flows with cryptographic policy enforcement and agent identity so every USDC payment by an agent is governed.',
    governanceGap: 'No programmable policy enforcement or agent identity bound to USDC transactions at issuance level.',
    painPoints: 'Programmable Policy: USDC lacks native agent governance layer for autonomous spending decisions.',
    funding: '$1.1B', urgencyScore: 9, accessibilityScore: 4, strategicValueScore: 10,
    linkedIn: 'https://linkedin.com/company/circle-internet-financial', sourceLink: 'https://circle.com/partners',
  },
  {
    company: 'Ripple (XRPL)', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://ripple.com',
    description: 'Cross-border payment network with $10B+ in customer value delivered. XRP Ledger with multi-signing and escrow. Increasingly used for agent-to-agent cross-border payment settlement rails.',
    whyAeredium: 'XRPL multi-signing is not agent-aware  -  Aeredium adds an agent-identity-bound threshold signing layer so cross-border payments by autonomous agents require cryptographic multi-party authorisation.',
    governanceGap: 'No agent-specific policy enforcement layer for autonomous cross-border payments beyond standard multi-sig.',
    painPoints: 'Cross-border Agent Auth: autonomous agents can initiate unlimited cross-border payments without governance.',
    funding: 'Public (XRP)', urgencyScore: 7, accessibilityScore: 4, strategicValueScore: 9,
    linkedIn: 'https://linkedin.com/company/ripple-labs', sourceLink: 'https://ripple.com/enterprise',
  },
  {
    company: 'Solana Pay', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://solanapay.com',
    description: 'Open payment protocol for merchants and developers on Solana. Enables QR-based and programmatic payment requests. Increasingly adopted by AI agents for autonomous Solana payment flows.',
    whyAeredium: 'Solana Pay provides the payment request standard but no governance over agent-initiated requests  -  Aeredium adds cryptographic agent identity and threshold signing to the Solana Pay flow.',
    governanceGap: 'No policy enforcement or threshold signing built into the standard for autonomous agent payments.',
    painPoints: 'Agent Transaction Signing: agents can submit unlimited payment requests with no cryptographic spend governance.',
    funding: 'Solana Foundation', urgencyScore: 8, accessibilityScore: 6, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/solana-foundation', sourceLink: 'https://solanapay.com',
  },
  {
    company: 'Alchemy Pay', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://alchemypay.org',
    description: '$10M+ funded crypto-fiat gateway covering 70+ countries. Enables seamless fiat-to-crypto conversion used in agent payment flows. On-ramp and off-ramp infrastructure for autonomous wallets.',
    whyAeredium: 'Alchemy Pay\'s gateway is used by autonomous agent wallets with no control over which agents can trigger fiat conversions  -  Aeredium enforces agent identity and cryptographic policy at every on/off-ramp call.',
    governanceGap: 'No agent identity or policy enforcement for autonomous fiat conversion requests.',
    painPoints: 'Fiat-Crypto Agent Bridge: any agent with wallet access can trigger unlimited fiat conversions.',
    funding: '$10M+', urgencyScore: 8, accessibilityScore: 7, strategicValueScore: 6,
    linkedIn: 'https://linkedin.com/company/alchemypay', sourceLink: 'https://alchemypay.org/business',
  },
  {
    company: 'Request Network', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://request.network',
    description: '$32M funded decentralised payment request protocol. Enables crypto invoicing and payment flows. Used by agent systems to create and settle payment requests autonomously.',
    whyAeredium: 'Request Network lets agents create payment requests with no authorisation controls  -  Aeredium adds cryptographic agent identity and threshold signing so agent-created invoices require policy-bound approval.',
    governanceGap: 'No cryptographic authorisation for agent-created payment requests  -  any agent can raise invoices.',
    painPoints: 'Agent Invoice Auth: agents can create and submit unlimited payment requests without governance.',
    funding: '$32M', urgencyScore: 7, accessibilityScore: 8, strategicValueScore: 5,
    linkedIn: 'https://linkedin.com/company/request-network', sourceLink: 'https://request.network/business',
  },
  {
    company: 'x402 Protocol', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://x402.org',
    description: 'HTTP-native payment protocol for AI agents using HTTP 402 status. Allows agents to autonomously pay for APIs and web services. Backed by Coinbase; becoming the standard for agent micropayments.',
    whyAeredium: 'x402 is the emerging standard for agent payments with zero governance layer  -  Aeredium provides the cryptographic policy enforcement that makes x402 enterprise-safe by binding agent identity to every 402 payment flow.',
    governanceGap: 'No cryptographic governance layer over agent-initiated x402 payment requests  -  any agent can pay any endpoint.',
    painPoints: 'HTTP Payment Governance: x402 standard has no mechanism for policy enforcement or agent authorisation.',
    funding: 'Open Protocol (Coinbase-backed)', urgencyScore: 10, accessibilityScore: 9, strategicValueScore: 7,
    linkedIn: '', sourceLink: 'https://x402.org',
  },
  {
    company: 'Fetch.ai', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://fetch.ai',
    description: '$40M+ funded AI agent marketplace with native FET payment token. Autonomous economic agents transact services and data. One of the largest live agent economy networks.',
    whyAeredium: 'Fetch.ai\'s agent economy uses FET for payments with no threshold signing or spend governance  -  Aeredium adds cryptographic policy enforcement so high-value agent-to-agent transactions require multi-party authorisation.',
    governanceGap: 'No threshold signing or cryptographic policy enforcement for high-value agent-economy transactions.',
    painPoints: 'Agent Economy Governance: autonomous agents transact freely with no spend limits or policy bounds.',
    funding: '$40M+', urgencyScore: 9, accessibilityScore: 7, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/fetch-ai', sourceLink: 'https://fetch.ai/enterprise',
  },
  {
    company: 'Lit Protocol', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://litprotocol.com',
    description: '$15M+ funded programmable MPC key management. Enables condition-based signing for AI agents. Used to define access control for agent wallets and decentralised key management.',
    whyAeredium: 'Lit handles condition-based signing but lacks complex multi-party spend-policy governance  -  Aeredium layers policy enforcement and agent identity governance on top of Lit\'s MPC for enterprise-grade agent payment controls.',
    governanceGap: 'Complex multi-party agent payment policy enforcement lacks a governance layer above key conditions.',
    painPoints: 'Key Condition Governance: Lit conditions are not agent-identity-aware for multi-party authorisation flows.',
    funding: '$15M+', urgencyScore: 9, accessibilityScore: 8, strategicValueScore: 6,
    linkedIn: 'https://linkedin.com/company/lit-protocol', sourceLink: 'https://litprotocol.com/contact',
  },
  {
    company: 'Biconomy', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://biconomy.io',
    description: '$28M funded. ERC-4337 Paymaster and gasless transaction infrastructure. Enables AI agents to transact without holding ETH for gas. Widely used in agent wallet backends for seamless UX.',
    whyAeredium: 'Biconomy sponsors gas for agent transactions with no governance over which agents qualify  -  Aeredium enforces cryptographic agent identity verification before gas sponsorship is granted.',
    governanceGap: 'No cryptographic governance over which agents can get gas sponsored  -  any wallet can exploit Paymaster.',
    painPoints: 'Gasless Agent Tx Governance: Paymaster sponsorship lacks agent identity binding and policy enforcement.',
    funding: '$28M', urgencyScore: 8, accessibilityScore: 8, strategicValueScore: 6,
    linkedIn: 'https://linkedin.com/company/biconomy', sourceLink: 'https://biconomy.io/contact',
  },
  {
    company: 'Quicknode', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://quicknode.com',
    description: '$60M+ funded blockchain API infrastructure. Provides RPC endpoints used by agents for payment reads and writes. Enterprise-grade blockchain access for agent payment backends.',
    whyAeredium: 'Quicknode provides API access used by agents to submit payment transactions with no agent-specific governance  -  Aeredium adds policy enforcement so agent RPC calls are bound by cryptographic spend rules.',
    governanceGap: 'No cryptographic policy enforcement for agent API payment actions  -  API key access is not agent-identity-aware.',
    painPoints: 'Agent API Access Control: API key access doesn\'t bind to agent identity or payment policies.',
    funding: '$60M+', urgencyScore: 7, accessibilityScore: 6, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/quicknode', sourceLink: 'https://quicknode.com/enterprise',
  },
  {
    company: 'Infura', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://infura.io',
    description: 'ConsenSys web3 RPC provider used by millions of developers and agents to submit blockchain transactions. Core web3 infrastructure for MetaMask and enterprise agent backends.',
    whyAeredium: 'Infura processes agent-submitted transactions with no awareness of agent identity or spend policy  -  Aeredium provides the governance layer that enforces cryptographic agent identity before transactions are relayed.',
    governanceGap: 'No cryptographic agent identity or policy enforcement for agent-submitted transactions via RPC.',
    painPoints: 'Agent RPC Governance: agents can submit unlimited payment transactions with no identity or spend governance.',
    funding: 'ConsenSys ($700M)', urgencyScore: 7, accessibilityScore: 5, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/infura', sourceLink: 'https://infura.io/contact',
  },
  {
    company: 'Spheron Network', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://spheron.network',
    description: '$8M+ funded decentralised compute marketplace. AI agents autonomously purchase compute resources. Provides the infra layer for autonomous agent compute procurement and payment.',
    whyAeredium: 'Spheron lets agents autonomously purchase compute with no governance over spend  -  Aeredium enforces cryptographic policy so agent compute purchases require authorisation above set thresholds.',
    governanceGap: 'No cryptographic governance over agent-initiated compute payment requests  -  unlimited autonomous spend.',
    painPoints: 'Compute Payment Governance: agents can autonomously purchase unlimited compute with no policy bounds.',
    funding: '$8M+', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 5,
    linkedIn: 'https://linkedin.com/company/spheron-network', sourceLink: 'https://spheron.network',
  },
  {
    company: 'XMTP', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://xmtp.org',
    description: '$20M+ funded decentralised messaging protocol with wallet-based identity. Enabling agents to communicate and initiate payment flows via messages. Emerging standard for agent-to-agent messaging with payment triggers.',
    whyAeredium: 'XMTP enables payment requests via messaging with no policy enforcement on which agents can trigger them  -  Aeredium adds cryptographic governance so agent payment requests via XMTP are bound by spend policies.',
    governanceGap: 'No policy enforcement for agent-initiated payment requests via messaging  -  any wallet identity can trigger.',
    painPoints: 'Agent Message + Payment Auth: XMTP payment triggers lack agent identity binding and spend governance.',
    funding: '$20M+', urgencyScore: 7, accessibilityScore: 8, strategicValueScore: 6,
    linkedIn: 'https://linkedin.com/company/xmtp', sourceLink: 'https://xmtp.org',
  },
  {
    company: 'Stellar (Soroban)', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://stellar.org',
    description: 'Stellar Foundation blockchain with Soroban smart contracts. Multi-sig and time-bound transaction features. Used for agent payment logic and stablecoin settlement on low-cost rails.',
    whyAeredium: 'Soroban smart contracts lack an agent-specific governance layer  -  Aeredium adds cryptographic agent identity and threshold signing so autonomous contract calls are policy-enforced before execution.',
    governanceGap: 'No agent-specific policy enforcement for autonomous Soroban smart contract execution.',
    painPoints: 'Smart Contract Agent Auth: Soroban lacks agent-identity-aware authorisation for autonomous payment calls.',
    funding: 'Stellar Development Foundation', urgencyScore: 7, accessibilityScore: 5, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/stellar-development-foundation', sourceLink: 'https://stellar.org/developers',
  },
  {
    company: 'Goat SDK', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://goat.sdk.fun',
    description: 'Open-source SDK by Crossmint connecting AI agents to onchain payment tools as LLM plugins. Supports 200+ protocols. The de facto standard for plugging AI agents into payment rails.',
    whyAeredium: 'Goat SDK plugins give agents unrestricted access to payment tools with no policy enforcement  -  Aeredium layers cryptographic governance so agents can only execute payment plugins within defined policy bounds.',
    governanceGap: 'No cryptographic policy enforcement or threshold signing for agent-executed payment tools.',
    painPoints: 'Agent Tool Payment Control: agents can execute any payment plugin without authorisation governance.',
    funding: 'Open Source (Crossmint-backed)', urgencyScore: 9, accessibilityScore: 10, strategicValueScore: 5,
    linkedIn: '', sourceLink: 'https://goat.sdk.fun',
  },
  {
    company: 'Fleek', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://fleek.xyz',
    description: '$25M funded decentralised agent hosting and deployment platform. Enables developers to deploy AI agents at the edge. Agents deployed on Fleek can initiate payment hooks as part of their workflows.',
    whyAeredium: 'Fleek-deployed agents have payment hooks with no governance layer  -  Aeredium enforces cryptographic policy so deployed agent payment actions are bound by spend rules and require threshold authorisation.',
    governanceGap: 'No cryptographic governance for agent-initiated payment actions in deployed edge workflows.',
    painPoints: 'Agent Deployment Payment: deployed agents can trigger payment hooks without identity or spend governance.',
    funding: '$25M', urgencyScore: 7, accessibilityScore: 9, strategicValueScore: 5,
    linkedIn: 'https://linkedin.com/company/fleek-xyz', sourceLink: 'https://fleek.xyz',
  },
  {
    company: 'Near Protocol (Intents)', category: 'Agent Payments', categoryCode: 'A',
    website: 'https://near.org',
    description: '$800M+ funded L1 blockchain with Chain Abstraction and NEAR Intents framework. Enables intent-based autonomous agent commerce across chains. Named wallet accounts ease agent identity.',
    whyAeredium: 'NEAR Intents execute autonomous agent transactions across chains with no cryptographic governance layer  -  Aeredium provides threshold signing and policy enforcement so intent-based agent transactions require multi-party authorisation.',
    governanceGap: 'No cryptographic policy enforcement or threshold signing for agent-executed cross-chain intents.',
    painPoints: 'Agent Intent Governance: intent-based autonomous transactions lack cryptographic spend-policy enforcement.',
    funding: '$800M+', urgencyScore: 8, accessibilityScore: 6, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/near-protocol', sourceLink: 'https://near.org/developers',
  },

  // ==============================================================
  // B  -  AGENT WALLETS (19)
  // ==============================================================
  {
    company: 'Anchorage Digital', category: 'Agent Wallets', categoryCode: 'B',
    website: 'https://anchorage.com',
    description: 'First federally chartered digital asset bank in the US. MPC-based institutional custody with regulatory compliance. Pioneering the "agentic banking platform" for AI-driven treasury operations.',
    whyAeredium: 'Anchorage is building agentic banking but agent authorisation relies on human approvals  -  Aeredium replaces manual approval flows with cryptographic threshold signing and policy enforcement that satisfies federal regulators.',
    governanceGap: 'Agent authorisation for banking operations lacks cryptographic enforcement  -  human approval flows remain manual and unauditable.',
    painPoints: 'Regulatory Compliance: federal regulators require cryptographic, immutable audit trails for agent-initiated transactions.',
    funding: '$350M+', urgencyScore: 10, accessibilityScore: 5, strategicValueScore: 9,
    linkedIn: 'https://linkedin.com/company/anchorage', sourceLink: 'https://anchorage.com/enterprise',
  },
  {
    company: 'Cobo', category: 'Agent Wallets', categoryCode: 'B',
    website: 'https://cobo.com',
    description: '$100M+ funded. Launched "Cobo Agentic Wallet"  -  MPC-based wallet specifically for AI agents. Pact permission system for scoped agent access. Major player in institutional agent wallet space.',
    whyAeredium: 'Cobo\'s Pact permissions are rule-based but not cryptographically enforced with threshold signing  -  Aeredium adds MPC threshold signing bound to agent identity so Cobo wallet operations require multi-party authorisation.',
    governanceGap: 'Limited threshold signing for agent authorisation  -  Pact rules are not cryptographically bound to agent identity.',
    painPoints: 'Key Management: MPC security without threshold signing governance leaves high-value agent operations unprotected.',
    funding: '$100M+', urgencyScore: 9, accessibilityScore: 6, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/cobo-io', sourceLink: 'https://cobo.com/enterprise',
  },
  {
    company: 'Crossmint', category: 'Agent Wallets', categoryCode: 'B',
    website: 'https://crossmint.com',
    description: '$50M+ funded. Dual-key architecture (Owner Key + Agent Key) for AI agent wallets. NFT and token infrastructure for web3 apps. Leading embedded wallet provider used by agent builders.',
    whyAeredium: 'Crossmint\'s dual-key model provides delegation but no threshold signing for high-value operations  -  Aeredium adds multi-party cryptographic authorisation above the Agent Key level for enterprise-grade governance.',
    governanceGap: 'Limited cryptographic authorisation beyond dual-key  -  no threshold signing for high-value agent operations.',
    painPoints: 'Policy Enforcement: dual-key delegation allows agents to act within a broad scope without spending governance.',
    funding: '$50M+', urgencyScore: 9, accessibilityScore: 7, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/crossmint', sourceLink: 'https://crossmint.com/partners',
  },
  {
    company: 'Openfort', category: 'Agent Wallets', categoryCode: 'B',
    website: 'https://openfort.io',
    description: '$10M+ funded smart account infrastructure with session keys for AI agents. ERC-4337 smart accounts enabling scoped agent signing. Focused on gaming and consumer agent wallet use cases.',
    whyAeredium: 'Openfort session keys give agents time-bound access but no threshold signing for large operations  -  Aeredium adds multi-party cryptographic authorisation so session-key operations above thresholds require approval.',
    governanceGap: 'Limited threshold signing for agent operations  -  session keys have time bounds but no spend-policy governance.',
    painPoints: 'Spending Limits: session keys don\'t enforce spend limits cryptographically  -  agents can transact up to session scope.',
    funding: '$10M+', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 5,
    linkedIn: 'https://linkedin.com/company/openfort', sourceLink: 'https://openfort.io/contact',
  },
  {
    company: 'BitGo', category: 'Agent Wallets', categoryCode: 'B',
    website: 'https://bitgo.com',
    description: '$500M+ funded. Institutional custody with multi-sig and MPC. Secures $60B+ in digital assets. Major institutional custody provider exploring agent-driven treasury operations for enterprise clients.',
    whyAeredium: 'BitGo\'s multi-sig is not agent-aware  -  Aeredium layers agent-specific cryptographic policies so BitGo-custodied assets can only be moved by agents that satisfy defined governance rules and threshold signatures.',
    governanceGap: 'Agent-specific policies not natively supported  -  existing multi-sig treats agent transactions as human-initiated.',
    painPoints: 'Agent Authorisation: institution-grade custody without agent-identity-aware policy enforcement.',
    funding: '$500M+', urgencyScore: 7, accessibilityScore: 4, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/bitgo', sourceLink: 'https://bitgo.com/enterprise',
  },
  {
    company: 'Privy', category: 'Agent Wallets', categoryCode: 'B',
    website: 'https://privy.io',
    description: '$40M+ funded embedded wallet SDK used by thousands of apps. Server-side wallet delegation for AI agents. Rapidly adopted as the go-to embedded wallet for AI agent builders.',
    whyAeredium: 'Privy server wallets delegate to agents but don\'t enforce cryptographic spend policies  -  Aeredium provides the policy enforcement layer so Privy agent wallets are bound by machine-readable spend rules.',
    governanceGap: 'Agent authorisation lacks cryptographic enforcement layer  -  server wallet delegation is not policy-bound.',
    painPoints: 'Agent Authorisation: delegated server wallets allow agents to spend within delegated scope with no sub-limits.',
    funding: '$40M+', urgencyScore: 8, accessibilityScore: 8, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/privy-io', sourceLink: 'https://privy.io',
  },
  {
    company: 'Dynamic', category: 'Agent Wallets', categoryCode: 'B',
    website: 'https://dynamic.xyz',
    description: '$13.5M funded wallet infrastructure for web3 apps. Multi-chain wallet connectors with identity and access primitives. Growing adoption by AI agent builders for agent identity management.',
    whyAeredium: 'Dynamic provides wallet identity but no cryptographic spend-policy enforcement for agents  -  Aeredium adds the policy layer that binds Dynamic-managed agent identities to machine-readable spending governance.',
    governanceGap: 'Identity and policy controls not cryptographically enforced for agent operations  -  identity alone is insufficient.',
    painPoints: 'Identity & Policy Controls: wallet identity without spend-policy governance leaves agent actions unconstrained.',
    funding: '$13.5M', urgencyScore: 8, accessibilityScore: 8, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/dynamic-xyz', sourceLink: 'https://dynamic.xyz',
  },
  {
    company: 'Safe (Gnosis Safe)', category: 'Agent Wallets', categoryCode: 'B',
    website: 'https://safe.global',
    description: '$100M+ funded. $100B+ secured in smart contract wallets. Standard multi-sig infrastructure for DAOs and enterprises. Increasingly used for multi-agent treasury operations requiring M-of-N signing.',
    whyAeredium: 'Safe multi-sig is not agent-identity-aware  -  Aeredium adds agent-specific cryptographic policies so Safe signers for agent operations are defined by machine-readable governance rules, not just key sets.',
    governanceGap: 'No agent-specific policy enforcement  -  multi-sig treats agent signers identically to human signers.',
    painPoints: 'Multi-Agent Multi-Sig: standard multi-sig cannot enforce agent-specific spend policies or audit agent actions.',
    funding: '$100M+', urgencyScore: 9, accessibilityScore: 6, strategicValueScore: 9,
    linkedIn: 'https://linkedin.com/company/safe-global', sourceLink: 'https://safe.global/business',
  },
  {
    company: 'Turnkey', category: 'Agent Wallets', categoryCode: 'B',
    website: 'https://turnkey.com',
    description: '$30M+ funded API-first wallet infrastructure using secure enclaves. Policy engine for signing rules. Specifically designed for AI agent key management with granular access control.',
    whyAeredium: 'Turnkey\'s policy engine is configurable but not cryptographically bound to verifiable agent identity  -  Aeredium adds the agent identity layer so Turnkey policies are provably linked to specific autonomous agents.',
    governanceGap: 'Key policies lack cryptographic binding to agent identity for autonomous operations  -  policies are rules, not proofs.',
    painPoints: 'Agent Key Policy: policy engine doesn\'t verify which agent is triggering signing  -  only key possession is checked.',
    funding: '$30M+', urgencyScore: 9, accessibilityScore: 8, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/turnkey-io', sourceLink: 'https://turnkey.com',
  },
  {
    company: 'Magic (Fortmatic)', category: 'Agent Wallets', categoryCode: 'B',
    website: 'https://magic.link',
    description: '$80M+ funded. HSM-based delegated key management. Auth SDK used in agent authentication flows across thousands of apps. Widely adopted as the wallet layer for consumer and enterprise agents.',
    whyAeredium: 'Magic provides key delegation but no spend-policy enforcement for agent operations  -  Aeredium adds cryptographic governance so Magic-delegated agent keys are bound by machine-readable spend limits.',
    governanceGap: 'No cryptographic policy enforcement or threshold signing for agent operations using delegated keys.',
    painPoints: 'Agent Auth Layer: HSM delegation without spend governance allows agents to act freely within delegated scope.',
    funding: '$80M+', urgencyScore: 7, accessibilityScore: 7, strategicValueScore: 6,
    linkedIn: 'https://linkedin.com/company/magic-labs', sourceLink: 'https://magic.link/enterprise',
  },
  {
    company: 'Web3Auth', category: 'Agent Wallets', categoryCode: 'B',
    website: 'https://web3auth.io',
    description: '$13M+ funded MPC wallet with social login. Used for agent identity flows with non-custodial key management. Threshold Signature Scheme (TSS) for distributed key generation.',
    whyAeredium: 'Web3Auth\'s TSS handles key generation but not agent-specific spend-policy governance  -  Aeredium adds the policy enforcement layer that defines what each agent can do with Web3Auth-managed keys.',
    governanceGap: 'Agent authorisation and spending policies not cryptographically enforced  -  TSS manages keys, not agent behaviour.',
    painPoints: 'Agent MPC Control: MPC key management without spend-policy governance leaves agent actions unconstrained.',
    funding: '$13M+', urgencyScore: 7, accessibilityScore: 8, strategicValueScore: 6,
    linkedIn: 'https://linkedin.com/company/web3auth', sourceLink: 'https://web3auth.io/enterprise',
  },
  {
    company: 'Particle Network', category: 'Agent Wallets', categoryCode: 'B',
    website: 'https://particle.network',
    description: '$25M+ funded. Universal Account with chain abstraction for intent-centric agent operations. Enables agents to transact across chains with a single wallet without managing chain-specific keys.',
    whyAeredium: 'Particle\'s Universal Account enables cross-chain agent intents with no cryptographic governance  -  Aeredium provides the policy enforcement layer that governs which intents an agent can execute and at what amounts.',
    governanceGap: 'Agent intent execution lacks cryptographic governance layer  -  any intent signed by the Universal Account executes.',
    painPoints: 'Intent-Centric Agent Control: cross-chain intent execution without spend governance enables unconstrained agent spend.',
    funding: '$25M+', urgencyScore: 8, accessibilityScore: 8, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/particle-network', sourceLink: 'https://particle.network',
  },
  {
    company: 'Capsule', category: 'Agent Wallets', categoryCode: 'B',
    website: 'https://usecapsule.com',
    description: '$10M+ funded embedded MPC wallet with passkey-based authentication. Session key infrastructure for AI agents. Used by agent builders for seamless agent key management.',
    whyAeredium: 'Capsule session keys give agents time-bound signing scope but no spend-policy governance  -  Aeredium enforces cryptographic spend limits within Capsule session keys so agents cannot exceed policy bounds.',
    governanceGap: 'Session key governance for autonomous agent operations lacks cryptographic enforcement  -  time bounds without spend limits.',
    painPoints: 'Agent Session Key Governance: passkey-session model lacks cryptographic spend-policy binding for autonomous agents.',
    funding: '$10M+', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 5,
    linkedIn: 'https://linkedin.com/company/capsule-co', sourceLink: 'https://usecapsule.com',
  },
  {
    company: 'Dfns', category: 'Agent Wallets', categoryCode: 'B',
    website: 'https://dfns.co',
    description: '$25M+ funded institutional-grade MPC wallet API. FIDO2 + MPC for secure key management. Built for enterprises and fintech building autonomous agent financial operations.',
    whyAeredium: 'Dfns MPC manages keys but threshold signing for agent operations is not policy-governed  -  Aeredium adds agent-identity-bound policies so Dfns-managed threshold signatures require cryptographic governance rules.',
    governanceGap: 'Threshold signing for agent operations lacks policy-based governance  -  threshold is key-count, not policy-enforced.',
    painPoints: 'Institutional Agent Signing: MPC threshold signing without policy governance is insufficient for regulated institutions.',
    funding: '$25M+', urgencyScore: 9, accessibilityScore: 7, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/dfns', sourceLink: 'https://dfns.co/enterprise',
  },
  {
    company: 'ZeroDev', category: 'Agent Wallets', categoryCode: 'B',
    website: 'https://zerodev.app',
    description: '$7M+ funded ERC-4337 smart account SDK with session keys and plugins for AI agents. Enables gasless agent transactions. Leading ERC-4337 SDK for agent smart account implementation.',
    whyAeredium: 'ZeroDev session keys and plugins give agents flexible access but no cryptographic agent-identity governance  -  Aeredium adds identity-bound policy enforcement so ZeroDev agent sessions are constrained by verifiable rules.',
    governanceGap: 'Agent policies lack cryptographic binding to verifiable agent identity  -  session keys are not agent-identity-aware.',
    painPoints: 'Smart Account Agent Policy: session key flexibility without identity-bound governance enables policy bypass.',
    funding: '$7M+', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 6,
    linkedIn: 'https://linkedin.com/company/zerodev', sourceLink: 'https://zerodev.app',
  },
  {
    company: 'Pimlico', category: 'Agent Wallets', categoryCode: 'B',
    website: 'https://pimlico.io',
    description: '$4.2M funded ERC-4337 bundler and Paymaster infrastructure. Enables gas sponsorship for AI agent transactions. Core infrastructure for ERC-4337 agent wallet deployments.',
    whyAeredium: 'Pimlico sponsors gas for any wallet using the Paymaster with no agent identity governance  -  Aeredium enforces cryptographic agent identity verification before Paymaster sponsorship is granted.',
    governanceGap: 'No cryptographic governance over which agents can get transaction sponsorship  -  Paymaster is identity-agnostic.',
    painPoints: 'Agent Paymaster Governance: gas sponsorship without agent identity binding enables Paymaster exploitation.',
    funding: '$4.2M', urgencyScore: 7, accessibilityScore: 9, strategicValueScore: 5,
    linkedIn: 'https://linkedin.com/company/pimlico', sourceLink: 'https://pimlico.io',
  },
  {
    company: 'Kite AI', category: 'Agent Wallets', categoryCode: 'B',
    website: 'https://gokite.ai',
    description: 'Agent passport and wallet product providing on-chain AI agent identity. Purpose-built for autonomous agent identity management and delegation in the agentic economy.',
    whyAeredium: 'Kite AI provides agent passports but delegation lacks cryptographic enforcement  -  Aeredium adds threshold signing and policy governance so Kite-identified agents operate within cryptographically defined bounds.',
    governanceGap: 'Agent identity and delegation lacks cryptographic enforcement  -  passport exists but spend governance does not.',
    painPoints: 'Agent Identity & Delegation: agent passport without policy enforcement leaves agents unconstrained after identity.',
    funding: 'Not disclosed', urgencyScore: 9, accessibilityScore: 9, strategicValueScore: 6,
    linkedIn: 'https://linkedin.com/company/kite-ai', sourceLink: 'https://gokite.ai',
  },
  {
    company: 'Claw Wallet', category: 'Agent Wallets', categoryCode: 'B',
    website: 'https://clawwallet.ai',
    description: 'Purpose-built AI agent wallet platform. Designed from the ground up for autonomous agent transaction security. Early-stage startup focused exclusively on the agent wallet problem.',
    whyAeredium: 'Claw Wallet builds agent wallets but lacks cryptographic threshold signing and spend-policy enforcement  -  Aeredium provides the governance primitives that make Claw Wallet enterprise-deployable.',
    governanceGap: 'No cryptographic policy enforcement for autonomous transactions  -  autonomous transaction security is unsolved.',
    painPoints: 'Autonomous Transaction Security: agent wallet without threshold signing governance is not enterprise-ready.',
    funding: 'Early stage', urgencyScore: 9, accessibilityScore: 10, strategicValueScore: 5,
    linkedIn: 'https://linkedin.com/company/claw-wallet', sourceLink: 'https://clawwallet.ai',
  },
  {
    company: 'Sequence', category: 'Agent Wallets', categoryCode: 'B',
    website: 'https://sequence.xyz',
    description: '$45M+ funded smart wallet infrastructure originally for gaming, expanding to AI agents. Gasless transactions, smart contract wallets, and embedded wallet SDK. Cross-platform agent wallet layer.',
    whyAeredium: 'Sequence smart wallets lack agent-specific transaction policy governance  -  Aeredium adds cryptographic policy enforcement so Sequence-powered agent wallets are bound by machine-readable spend rules.',
    governanceGap: 'Agent transaction policies lack cryptographic enforcement  -  smart wallet is flexible but not governance-aware.',
    painPoints: 'Agent Smart Wallet Governance: smart wallet flexibility without policy enforcement enables unconstrained agent spend.',
    funding: '$45M+', urgencyScore: 7, accessibilityScore: 8, strategicValueScore: 6,
    linkedIn: 'https://linkedin.com/company/horizon-blockchain-games', sourceLink: 'https://sequence.xyz/business',
  },

  // ==============================================================
  // C  -  AI TRADING / DEFI AGENTS (18)
  // ==============================================================
  {
    company: 'Valory (Olas)', category: 'AI Trading / DeFi Agents', categoryCode: 'C',
    website: 'https://valory.xyz',
    description: '$20M+ funded. Builders of the Olas autonomous agent protocol  -  a marketplace for economic agents that manage DeFi positions, trade, and execute financial strategies autonomously.',
    whyAeredium: 'Olas agents operate in the economy with no cryptographic agent identity or threshold signing  -  Aeredium provides the identity and governance layer that makes Olas agents auditable and enterprise-safe.',
    governanceGap: 'No cryptographic agent identity or threshold signing  -  Olas agents act freely in financial markets without governance.',
    painPoints: 'Agent Identity: economic agents transacting in live markets have no verifiable cryptographic identity bound to actions.',
    funding: '$20M+', urgencyScore: 10, accessibilityScore: 8, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/valory-xyz', sourceLink: 'https://valory.xyz/contact',
  },
  {
    company: 'Rivo Finance', category: 'AI Trading / DeFi Agents', categoryCode: 'C',
    website: 'https://rivo.finance',
    description: 'Seed stage. Maneki AI agent for DeFi portfolio analysis and yield optimisation. Agents autonomously analyse and rebalance DeFi positions across protocols.',
    whyAeredium: 'Maneki agents execute portfolio decisions with no policy enforcement  -  Aeredium provides threshold signing so high-value rebalancing trades require multi-party authorisation before execution.',
    governanceGap: 'No policy enforcement for autonomous trades  -  agents can rebalance portfolios without spend limits or approval.',
    painPoints: 'Trade Authorisation: yield-optimisation agents execute trades without cryptographic authorisation governance.',
    funding: 'Seed', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 5,
    linkedIn: 'https://linkedin.com/company/rivo-finance', sourceLink: 'https://rivo.finance/contact',
  },
  {
    company: 'Velvet Capital', category: 'AI Trading / DeFi Agents', categoryCode: 'C',
    website: 'https://velvet.capital',
    description: 'Seed stage. Autonomous portfolio management platform for DeFi. AI agents manage and rebalance on-chain portfolios across multiple DeFi protocols without human intervention.',
    whyAeredium: 'Velvet agents rebalance portfolios autonomously with no threshold signing  -  Aeredium adds multi-party cryptographic authorisation so large portfolio changes require governance approval.',
    governanceGap: 'No threshold signing for portfolio changes  -  agents can rebalance any amount without multi-party authorisation.',
    painPoints: 'Portfolio Authorisation: autonomous rebalancing without threshold signing exposes large portfolios to agent error.',
    funding: 'Seed', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 5,
    linkedIn: 'https://linkedin.com/company/velvet-capital', sourceLink: 'https://velvet.capital/contact',
  },
  {
    company: 'SingularityDAO', category: 'AI Trading / DeFi Agents', categoryCode: 'C',
    website: 'https://singularitydao.ai',
    description: 'DynaSets  -  on-chain vaults where AI agents autonomously rebalance portfolios. Combines SingularityNET AI with on-chain vault mechanics for fully autonomous portfolio management.',
    whyAeredium: 'DynaSet AI rebalances vaults autonomously with no cryptographic policy enforcement  -  Aeredium adds the governance layer that constrains AI rebalancing actions within defined risk and spend policies.',
    governanceGap: 'No cryptographic policy enforcement for AI rebalancing  -  vaults are fully autonomous without governance bounds.',
    painPoints: 'Vault Security: AI-managed vaults without policy enforcement expose user funds to unconstrained AI decisions.',
    funding: 'Not disclosed', urgencyScore: 8, accessibilityScore: 8, strategicValueScore: 6,
    linkedIn: 'https://linkedin.com/company/singularity-dao', sourceLink: 'https://singularitydao.ai/contact',
  },
  {
    company: 'Bitget', category: 'AI Trading / DeFi Agents', categoryCode: 'C',
    website: 'https://bitget.com',
    description: 'Top-5 global crypto exchange with AI-powered trading operations. Copy trading and automated strategy features widely used by AI trading agents. $100B+ monthly trading volume.',
    whyAeredium: 'Bitget\'s AI trading features have no governance over automated agent actions  -  Aeredium provides cryptographic policy enforcement so AI trading agents operate within defined risk bounds.',
    governanceGap: 'No cryptographic governance over automated agent trading actions  -  AI bots trade without policy constraints.',
    painPoints: 'Automated Action Governance: AI trading bots execute without cryptographic spend or risk governance.',
    funding: 'Not disclosed', urgencyScore: 8, accessibilityScore: 4, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/bitget', sourceLink: 'https://bitget.com',
  },
  {
    company: 'Hyperliquid', category: 'AI Trading / DeFi Agents', categoryCode: 'C',
    website: 'https://hyperliquid.xyz',
    description: 'High-performance on-chain perpetuals DEX with significant AI agent trading activity. Order book DEX with $1B+ daily volume. Popular venue for autonomous agent trading strategies.',
    whyAeredium: 'Hyperliquid hosts significant agent trading with no risk controls beyond smart contract limits  -  Aeredium adds cryptographic governance so agent trading strategies have enforced risk limits.',
    governanceGap: 'Automated trading risk controls lack cryptographic enforcement  -  on-chain limits don\'t govern agent strategy scope.',
    painPoints: 'Risk Controls: agent trading strategies on Hyperliquid operate without cryptographic risk-bound governance.',
    funding: 'Not disclosed', urgencyScore: 8, accessibilityScore: 7, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/hyperliquid', sourceLink: 'https://hyperliquid.xyz',
  },
  {
    company: 'dYdX', category: 'AI Trading / DeFi Agents', categoryCode: 'C',
    website: 'https://dydx.trade',
    description: '$65M funded. Leading decentralised perpetuals DEX. Programmatic trading via API widely used by AI agents. Cosmos-based chain with institutional-grade on-chain order book.',
    whyAeredium: 'dYdX programmatic trading by agents has no cryptographic policy enforcement  -  Aeredium provides the governance layer that constrains AI strategy execution within defined risk and position limits.',
    governanceGap: 'No cryptographic policy enforcement for programmatic agent trading strategies  -  API access equals unlimited trading.',
    painPoints: 'Policy Enforcement: programmatic trading via API lacks cryptographic bounds on agent strategy execution.',
    funding: '$65M', urgencyScore: 8, accessibilityScore: 6, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/dydx', sourceLink: 'https://dydx.trade',
  },
  {
    company: 'Aave', category: 'AI Trading / DeFi Agents', categoryCode: 'C',
    website: 'https://aave.com',
    description: 'Largest DeFi lending protocol with $15B+ TVL. AI agents autonomously manage treasury strategies  -  supplying, borrowing, and liquidating positions. Core DeFi protocol for autonomous agent finance.',
    whyAeredium: 'Aave is used by AI agents for autonomous treasury strategies with no governance over agent-executed liquidations  -  Aeredium provides threshold signing so high-value Aave operations require multi-party authorisation.',
    governanceGap: 'Autonomous treasury strategy execution on Aave lacks cryptographic agent governance  -  any authorised wallet can act.',
    painPoints: 'Safe Execution: AI agents managing lending positions on Aave operate without spend or strategy governance.',
    funding: 'Public protocol', urgencyScore: 8, accessibilityScore: 5, strategicValueScore: 9,
    linkedIn: 'https://linkedin.com/company/aave', sourceLink: 'https://aave.com',
  },
  {
    company: 'Yearn Finance', category: 'AI Trading / DeFi Agents', categoryCode: 'C',
    website: 'https://yearn.fi',
    description: 'DeFi yield aggregator with AI-automated vault strategies. DAO-governed protocol where agents autonomously optimise yields across DeFi. Pioneer of automated yield optimisation.',
    whyAeredium: 'Yearn\'s automated strategies have no cryptographic enforcement for agent governance decisions  -  Aeredium adds an immutable audit trail and threshold signing so Yearn vault strategies are provably governed.',
    governanceGap: 'Yield automation governance and auditability lack cryptographic enforcement  -  DAO voting is slow and non-binding.',
    painPoints: 'Governance & Auditability: automated vault strategies lack cryptographic audit trails required by institutional investors.',
    funding: 'Protocol', urgencyScore: 7, accessibilityScore: 7, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/yearn-finance', sourceLink: 'https://yearn.fi',
  },
  {
    company: 'Morpho Labs', category: 'AI Trading / DeFi Agents', categoryCode: 'C',
    website: 'https://morpho.org',
    description: '$18M+ funded. Morpho Optimiser  -  AI-driven lending protocol that optimises rates between lenders and borrowers. Curated vaults with autonomous AI reallocation strategies.',
    whyAeredium: 'Morpho\'s AI-driven reallocation strategies operate autonomously with no cryptographic governance  -  Aeredium adds policy-bound threshold signing so vault reallocation above thresholds requires multi-party authorisation.',
    governanceGap: 'Autonomous lending strategy execution lacks cryptographic agent governance  -  reallocation is unconstrained by policy.',
    painPoints: 'AI Lending Strategy Auth: autonomous lending reallocation without governance exposes protocol to AI decision risk.',
    funding: '$18M+', urgencyScore: 8, accessibilityScore: 7, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/morpho-labs', sourceLink: 'https://morpho.org',
  },
  {
    company: 'GMX', category: 'AI Trading / DeFi Agents', categoryCode: 'C',
    website: 'https://gmx.io',
    description: 'Leading perpetuals DEX on Arbitrum and Avalanche. $500M+ TVL. Significant AI agent trading activity. GLP liquidity pool model with autonomous LP rebalancing by AI agents.',
    whyAeredium: 'GMX hosts AI agent trading with no cryptographic governance over position sizes  -  Aeredium provides policy enforcement so agent perpetual positions have enforced risk governance.',
    governanceGap: 'AI trading agents on GMX operate without cryptographic governance over position sizes and execution.',
    painPoints: 'Perp Trading Agent Control: autonomous perpetual position management without policy governance risks runaway losses.',
    funding: 'Protocol', urgencyScore: 8, accessibilityScore: 6, strategicValueScore: 7,
    linkedIn: '', sourceLink: 'https://gmx.io',
  },
  {
    company: 'Gauntlet', category: 'AI Trading / DeFi Agents', categoryCode: 'C',
    website: 'https://gauntlet.network',
    description: '$23M+ funded. AI-driven risk management for DeFi protocols (Aave, Compound, Uniswap). Autonomous agents adjust risk parameters  -  collateral ratios, interest rates, liquidation thresholds.',
    whyAeredium: 'Gauntlet agents autonomously adjust risk parameters with no cryptographic enforcement of change scope  -  Aeredium adds policy governance so risk parameter changes require cryptographic multi-party authorisation.',
    governanceGap: 'Autonomous risk parameter adjustments lack cryptographic policy enforcement  -  agents can change rates without bounds.',
    painPoints: 'Risk Model Governance: risk parameter changes by AI agents lack cryptographic authorisation governance.',
    funding: '$23M+', urgencyScore: 9, accessibilityScore: 7, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/gauntlet-networks', sourceLink: 'https://gauntlet.network',
  },
  {
    company: 'Chaos Labs', category: 'AI Trading / DeFi Agents', categoryCode: 'C',
    website: 'https://chaoslabs.xyz',
    description: '$20M+ funded. Autonomous risk simulation and oracle monitoring for DeFi protocols. Agents monitor and flag risk events, with some autonomous parameter adjustment capabilities.',
    whyAeredium: 'Chaos Labs agents make autonomous risk decisions with no cryptographic audit trail  -  Aeredium provides immutable audit governance so every risk agent decision is cryptographically logged and verifiable.',
    governanceGap: 'Audit trail for autonomous risk agent decisions lacks cryptographic immutability  -  logs are mutable and unverifiable.',
    painPoints: 'Agent Risk Audit Trail: risk agent decisions without immutable audit trail cannot satisfy institutional compliance.',
    funding: '$20M+', urgencyScore: 8, accessibilityScore: 8, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/chaos-labs', sourceLink: 'https://chaoslabs.xyz',
  },
  {
    company: 'Numerai', category: 'AI Trading / DeFi Agents', categoryCode: 'C',
    website: 'https://numer.ai',
    description: '$60M+ funded. Crowd-sourced AI hedge fund using anonymous data scientists\' models. Autonomous model selection drives live trading. NMR staking aligns incentives with model accuracy.',
    whyAeredium: 'Numerai\'s model-driven trading has no cryptographic binding between model identity and authorised execution  -  Aeredium provides the governance layer that cryptographically links model identity to trade authorisation.',
    governanceGap: 'No cryptographic governance binding AI model identity to authorised trade execution  -  staking is incentive, not governance.',
    painPoints: 'Model Authorisation: model-driven trades execute without cryptographic binding of model identity to authorisation.',
    funding: '$60M+', urgencyScore: 7, accessibilityScore: 7, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/numerai', sourceLink: 'https://numer.ai',
  },
  {
    company: 'Curve Finance', category: 'AI Trading / DeFi Agents', categoryCode: 'C',
    website: 'https://curve.fi',
    description: 'Leading stablecoin AMM with $5B+ TVL. veToken governance model. AI agents autonomously manage LP positions in Curve pools. Critical stablecoin liquidity infrastructure.',
    whyAeredium: 'AI agents managing Curve LP positions have no cryptographic governance over position changes  -  Aeredium adds policy-bound threshold signing so large LP rebalancing requires multi-party authorisation.',
    governanceGap: 'AI agent LP management lacks cryptographic policy enforcement  -  agents can enter/exit positions without bounds.',
    painPoints: 'LP Agent Governance: autonomous LP management without governance exposes large liquidity positions to agent risk.',
    funding: 'Protocol', urgencyScore: 7, accessibilityScore: 5, strategicValueScore: 8,
    linkedIn: '', sourceLink: 'https://curve.fi',
  },
  {
    company: 'Uniswap', category: 'AI Trading / DeFi Agents', categoryCode: 'C',
    website: 'https://uniswap.org',
    description: 'Largest DEX by volume ($2T+ lifetime). Uniswap v4 hooks enabling sophisticated AI agent LP strategies. Standard liquidity infrastructure for autonomous agent market-making.',
    whyAeredium: 'AI agents managing Uniswap liquidity positions operate without any governance layer  -  Aeredium provides cryptographic policy enforcement so autonomous Uniswap LP operations have defined governance bounds.',
    governanceGap: 'Autonomous liquidity management by AI agents lacks cryptographic policy enforcement  -  unlimited LP operations.',
    painPoints: 'Autonomous Liquidity Governance: AI agent LP strategies on the largest DEX have no spend or strategy governance.',
    funding: 'Protocol', urgencyScore: 7, accessibilityScore: 4, strategicValueScore: 10,
    linkedIn: 'https://linkedin.com/company/uniswap-labs', sourceLink: 'https://uniswap.org',
  },
  {
    company: 'AI Arena', category: 'AI Trading / DeFi Agents', categoryCode: 'C',
    website: 'https://aiarena.io',
    description: '$6M+ funded. Competitive AI agent platform where AI agents fight in tournaments with financial stakes. NFT-based agents with staking and reward mechanics on-chain.',
    whyAeredium: 'AI Arena agents have financial stakes managed without cryptographic governance  -  Aeredium adds identity-bound policy enforcement so staking and reward mechanics are governed by cryptographic rules.',
    governanceGap: 'No cryptographic governance binding agent identity to staking and financial decisions in the arena economy.',
    painPoints: 'Agent Stake Governance: staking and reward mechanics without governance create exploitable financial dynamics.',
    funding: '$6M+', urgencyScore: 7, accessibilityScore: 9, strategicValueScore: 5,
    linkedIn: 'https://linkedin.com/company/ai-arena', sourceLink: 'https://aiarena.io',
  },
  {
    company: 'Ondo Finance', category: 'AI Trading / DeFi Agents', categoryCode: 'C',
    website: 'https://ondo.finance',
    description: '$46M+ funded. Tokenised RWA (USDY, OUSG) for institutional and DeFi investors. AI agent portfolios increasingly hold USDY for yield. Bridging TradFi yield products to DeFi agent portfolios.',
    whyAeredium: 'AI agents purchasing Ondo RWA products have no governance over purchase authorisation  -  Aeredium adds cryptographic policy enforcement so agent RWA purchases require identity-bound authorisation.',
    governanceGap: 'AI agent authorisation for RWA purchases lacks cryptographic policy enforcement  -  KYC exists but agent governance does not.',
    painPoints: 'RWA Agent Authorisation: AI agents buying regulated RWA products need cryptographic authorisation governance.',
    funding: '$46M+', urgencyScore: 8, accessibilityScore: 6, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/ondo-finance', sourceLink: 'https://ondo.finance',
  },

  // ==============================================================
  // D  -  TREASURY AUTOMATION (12)
  // ==============================================================
  {
    company: 'Modern Treasury', category: 'Treasury Automation', categoryCode: 'D',
    website: 'https://moderntreasury.com',
    description: '$150M+ funded. Powering treasury operations via API for companies like Brex and Marqeta. AI agents using LangGraph for autonomous payment operations  -  cash positioning, reconciliation, and payment initiation.',
    whyAeredium: 'Modern Treasury AI agents initiate payments autonomously but human approval workflows are not cryptographically enforced  -  Aeredium replaces manual approval with cryptographic threshold signing for every agent payment.',
    governanceGap: 'Human approvals for agent payment operations are not cryptographically enforced  -  approvals are UI-based, not binding.',
    painPoints: 'Payment Authorisation: AI agents can propose payments that bypass cryptographic multi-party authorisation.',
    funding: '$150M+', urgencyScore: 10, accessibilityScore: 5, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/modern-treasury', sourceLink: 'https://moderntreasury.com/partners',
  },
  {
    company: 'Atlar', category: 'Treasury Automation', categoryCode: 'D',
    website: 'https://atlar.com',
    description: '$100M+ funded. AI agents for treasury: autonomous cash positioning and payment initiation. Connects to bank accounts directly via API for real-time treasury management.',
    whyAeredium: 'Atlar AI agents autonomously position cash and initiate payments with no cryptographic authorisation  -  Aeredium provides threshold signing so bank-level payment approvals are cryptographically enforced.',
    governanceGap: 'No cryptographic authorisation for autonomous payment approvals  -  access control is role-based, not cryptographic.',
    painPoints: 'Audit Trail: autonomous treasury operations need cryptographic audit trails for bank compliance and regulators.',
    funding: '$100M+', urgencyScore: 9, accessibilityScore: 6, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/atlar', sourceLink: 'https://atlar.com/contact/sales',
  },
  {
    company: 'Ramp', category: 'Treasury Automation', categoryCode: 'D',
    website: 'https://ramp.com',
    description: '$2.8B funded corporate expense and treasury automation. AI agents handle finance automation  -  expense categorisation, vendor payments, and treasury rebalancing. Growing into full AI finance operations.',
    whyAeredium: 'Ramp AI agents handle finance automation with spend controls that are policy-based, not cryptographically enforced  -  Aeredium adds cryptographic policy binding so agent spend limits are provably enforced.',
    governanceGap: 'Agent spending lacks cryptographic enforcement  -  spend limits are software rules, not cryptographic guarantees.',
    painPoints: 'Spending Controls: AI finance agents with software-only spend limits are insufficient for enterprise compliance.',
    funding: '$2.8B', urgencyScore: 8, accessibilityScore: 5, strategicValueScore: 9,
    linkedIn: 'https://linkedin.com/company/ramp-business', sourceLink: 'https://ramp.com/enterprise',
  },
  {
    company: 'Bottomline (Bea)', category: 'Treasury Automation', categoryCode: 'D',
    website: 'https://bottomline.com',
    description: 'Public company. Bea  -  AI agent acting as a "digital team member" for B2B payment operations. Handles payment help requests, invoice queries, and payment initiation on behalf of treasury teams.',
    whyAeredium: 'Bea handles payment operations in a "secure environment" but human approval is not cryptographically enforced  -  Aeredium adds threshold signing so Bea-initiated payments require cryptographic multi-party authorisation.',
    governanceGap: 'No cryptographic authorisation for payment help requests  -  Bea\'s secure environment is not a cryptographic guarantee.',
    painPoints: 'Compliance: B2B payment agent operating without cryptographic authorisation cannot satisfy audit requirements.',
    funding: 'Public', urgencyScore: 8, accessibilityScore: 3, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/bottomline-technologies', sourceLink: 'https://bottomline.com/contact',
  },
  {
    company: 'Zip (Spend)', category: 'Treasury Automation', categoryCode: 'D',
    website: 'https://zip.co',
    description: '$358M funded. Buy-now-pay-later and expense management with AI automation. Finance automation agents handle payment flows and approval routing for enterprise spend management.',
    whyAeredium: 'Zip finance automation agents move money with software approval controls  -  Aeredium adds cryptographic enforcement so agent-initiated payments require threshold authorisation before execution.',
    governanceGap: 'No cryptographic agent authorisation  -  finance automation relies on software approval chains, not cryptographic proofs.',
    painPoints: 'Transaction Auth: agent-initiated payments in BNPL flows lack cryptographic authorisation governance.',
    funding: '$358M', urgencyScore: 7, accessibilityScore: 6, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/zip-co', sourceLink: 'https://zip.co/enterprise',
  },
  {
    company: 'Brex', category: 'Treasury Automation', categoryCode: 'D',
    website: 'https://brex.com',
    description: '$1.5B funded corporate card and treasury platform. AI-powered spend management with autonomous expense and treasury recommendations. Moving toward full AI-driven corporate finance operations.',
    whyAeredium: 'Brex AI treasury operations rely on software policy rules without cryptographic enforcement  -  Aeredium provides the cryptographic governance layer that makes Brex agent payments provably policy-bound.',
    governanceGap: 'Agent-driven corporate payments lack cryptographic governance  -  spend policies are software rules only.',
    painPoints: 'Governed Payments: corporate treasury AI agent actions need cryptographic enforcement for audit and compliance.',
    funding: '$1.5B', urgencyScore: 8, accessibilityScore: 6, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/brex', sourceLink: 'https://brex.com',
  },
  {
    company: 'Airbase', category: 'Treasury Automation', categoryCode: 'D',
    website: 'https://airbase.com',
    description: '$60M funded. Spend management platform with AI-powered approval automation. Intelligent spend controls and automated PO matching. AI agents handling expense approval workflows.',
    whyAeredium: 'Airbase automated approvals are workflow-based, not cryptographically enforced  -  Aeredium adds threshold signing so automated approval decisions are cryptographically bound and auditable.',
    governanceGap: 'Automated approval policy enforcement lacks cryptographic enforcement  -  workflow approvals are mutable and unverifiable.',
    painPoints: 'Policy Enforcement: AI-automated approvals without cryptographic binding cannot satisfy enterprise audit requirements.',
    funding: '$60M', urgencyScore: 7, accessibilityScore: 7, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/airbase', sourceLink: 'https://airbase.com',
  },
  {
    company: 'Tipalti', category: 'Treasury Automation', categoryCode: 'D',
    website: 'https://tipalti.com',
    description: '$270M funded. Global AP automation with AI. Processes $50B+ in payments annually. AI agents for global payouts, invoice processing, and compliance checks across 190+ countries.',
    whyAeredium: 'Tipalti global payouts via AI agents lack cryptographic audit trails required by regulators  -  Aeredium provides immutable, cryptographic settlement records tied to agent identity for every payout.',
    governanceGap: 'Global payout audit and settlement controls for agents lack cryptographic enforcement  -  compliance is rules-based.',
    painPoints: 'Audit & Settlement Controls: $50B+ in agent-assisted payouts needs cryptographic audit trails, not just logs.',
    funding: '$270M', urgencyScore: 7, accessibilityScore: 5, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/tipalti', sourceLink: 'https://tipalti.com',
  },
  {
    company: 'Mesh Payments', category: 'Treasury Automation', categoryCode: 'D',
    website: 'https://meshpayments.com',
    description: '$180M funded. Finance automation platform with AI-powered approval and payment automation. Corporate payments and travel expense management with autonomous AI processing.',
    whyAeredium: 'Mesh AI approval automation relies on workflow rules without cryptographic enforcement  -  Aeredium adds threshold signing so AI-driven payment approvals are cryptographically bound.',
    governanceGap: 'AI-driven approval automation lacks cryptographic policy enforcement  -  approvals are workflow gates, not cryptographic proofs.',
    painPoints: 'Approval Automation: AI payment approvals without cryptographic binding cannot satisfy enterprise compliance auditors.',
    funding: '$180M', urgencyScore: 7, accessibilityScore: 8, strategicValueScore: 6,
    linkedIn: 'https://linkedin.com/company/mesh-payments', sourceLink: 'https://meshpayments.com',
  },
  {
    company: 'Bill.com', category: 'Treasury Automation', categoryCode: 'D',
    website: 'https://bill.com',
    description: 'Public company. AI-powered AP/AR automation for SMBs and mid-market. $300B+ in payments processed. AI agents handling invoice approval and payment initiation for thousands of businesses.',
    whyAeredium: 'Bill.com AI agents initiate AP/AR payments with multi-user approval workflows that are software-enforced, not cryptographic  -  Aeredium adds cryptographic threshold signing so agent-initiated payments are provably authorised.',
    governanceGap: 'Agent-initiated AP/AR actions lack cryptographic policy enforcement  -  multi-user approvals are UI-based.',
    painPoints: 'AP/AR Agent Auth: AI-driven invoice approval and payment initiation without cryptographic authorisation.',
    funding: 'Public', urgencyScore: 7, accessibilityScore: 4, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/bill-com', sourceLink: 'https://bill.com/enterprise',
  },
  {
    company: 'Navan (TripActions)', category: 'Treasury Automation', categoryCode: 'D',
    website: 'https://navan.com',
    description: '$1.5B+ funded. AI-driven T&E and expense management platform. Autonomous expense submission, categorisation, and policy checking by AI. Moving toward full autonomous expense operations.',
    whyAeredium: 'Navan AI agents autonomously categorise and submit expenses with policy rules that are not cryptographically enforced  -  Aeredium adds cryptographic governance so agent-submitted expenses are provably policy-bound.',
    governanceGap: 'Autonomous expense agent actions lack cryptographic governance  -  AI policy rules are software-enforced only.',
    painPoints: 'Expense Agent Governance: AI expense automation without cryptographic enforcement cannot satisfy enterprise audit.',
    funding: '$1.5B+', urgencyScore: 6, accessibilityScore: 5, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/navan', sourceLink: 'https://navan.com/enterprise',
  },
  {
    company: 'Coupa Software', category: 'Treasury Automation', categoryCode: 'D',
    website: 'https://coupa.com',
    description: '$8B acquisition (Vista Equity). Business spend management with AI-powered recommendations. AI-driven spend intelligence with autonomous approval and spend management capabilities.',
    whyAeredium: 'Coupa AI spend recommendations and approvals are workflow-based without cryptographic enforcement  -  Aeredium adds the cryptographic governance layer that enterprises need for AI-driven spend management compliance.',
    governanceGap: 'AI-driven spend actions lack cryptographic policy enforcement  -  AI recommendations become actions without governance.',
    painPoints: 'Spend Intelligence Governance: $8B platform with AI spend actions needs cryptographic governance for enterprise compliance.',
    funding: '$8B acquisition', urgencyScore: 7, accessibilityScore: 3, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/coupa-software', sourceLink: 'https://coupa.com/enterprise',
  },

  // ==============================================================
  // E  -  ENTERPRISE AI AGENTS (14)
  // ==============================================================
  {
    company: 'LangChain', category: 'Enterprise AI Agents', categoryCode: 'E',
    website: 'https://langchain.com',
    description: '$160M funded. Most popular AI agent framework. LangGraph enables stateful agent workflows. Used by thousands of enterprises building production AI agents with financial action capabilities.',
    whyAeredium: 'LangChain agents built for production have no native cryptographic governance  -  Aeredium provides the governance layer that enterprise LangChain deployments need to enforce agent policies cryptographically.',
    governanceGap: 'No native cryptographic governance  -  enterprise agents built on LangChain operate without policy enforcement.',
    painPoints: 'Production Auth: production LangChain agents with financial action capabilities have no cryptographic governance layer.',
    funding: '$160M', urgencyScore: 8, accessibilityScore: 7, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/langchain', sourceLink: 'https://langchain.com/enterprise',
  },
  {
    company: 'Cohere', category: 'Enterprise AI Agents', categoryCode: 'E',
    website: 'https://cohere.com',
    description: '$1.5B funded. Enterprise AI platform for building agents. Command R+ model optimised for enterprise workflows. Customers build financial and operational agents on Cohere\'s platform.',
    whyAeredium: 'Enterprise agents built on Cohere operate without a cryptographic governance layer  -  Aeredium is the governance middleware that Cohere platform customers need to deploy agents in regulated industries.',
    governanceGap: 'No native agent governance layer  -  Cohere platform agents lack cryptographic policy enforcement.',
    painPoints: 'Agent Governance: $1.5B enterprise platform enabling agents that can take financial actions without governance.',
    funding: '$1.5B', urgencyScore: 7, accessibilityScore: 4, strategicValueScore: 9,
    linkedIn: 'https://linkedin.com/company/cohere-ai', sourceLink: 'https://cohere.com/enterprise',
  },
  {
    company: 'Sierra AI', category: 'Enterprise AI Agents', categoryCode: 'E',
    website: 'https://sierra.ai',
    description: '$635M funded. Enterprise AI agent platform for customer experience. Sierra agents can access financial systems, process refunds, and take financial actions on behalf of businesses.',
    whyAeredium: 'Sierra agents can access financial systems with no cryptographic enforcement for those actions  -  Aeredium provides the governance layer that makes Sierra agents enterprise-safe for financial action authority.',
    governanceGap: 'No cryptographic enforcement for agent actions  -  agents accessing financial systems operate without policy governance.',
    painPoints: 'Authorisation: $635M platform deploying agents with financial action authority and no cryptographic governance.',
    funding: '$635M', urgencyScore: 7, accessibilityScore: 5, strategicValueScore: 9,
    linkedIn: 'https://linkedin.com/company/sierra-ai', sourceLink: 'https://sierra.ai/enterprise',
  },
  {
    company: 'Decagon', category: 'Enterprise AI Agents', categoryCode: 'E',
    website: 'https://decagon.ai',
    description: '$481M funded. AI customer experience agents deployed by enterprises. Agents handle refunds, account actions, and financial transactions as part of customer support workflows.',
    whyAeredium: 'Decagon agents taking financial actions on behalf of enterprises have no cryptographic controls  -  Aeredium provides policy enforcement so agent-initiated customer financial actions are cryptographically governed.',
    governanceGap: 'No cryptographic controls for agent financial actions  -  customer-facing agents act without policy governance.',
    painPoints: 'Liability: agents with financial action authority (refunds, account actions) have no cryptographic liability control.',
    funding: '$481M', urgencyScore: 6, accessibilityScore: 6, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/decagon-ai', sourceLink: 'https://decagon.ai/enterprise',
  },
  {
    company: 'Glean', category: 'Enterprise AI Agents', categoryCode: 'E',
    website: 'https://glean.com',
    description: '$765M funded. Enterprise AI agent with deep access to company data. Glean agents search, summarise and take actions across enterprise systems  -  including financial data and ERP systems.',
    whyAeredium: 'Glean agents accessing financial data and ERP systems have no cryptographic enforcement for data access  -  Aeredium provides the governance layer that cryptographically controls which data and actions agents can access.',
    governanceGap: 'No cryptographic enforcement for agent data access  -  enterprise data access is permission-based, not cryptographic.',
    painPoints: 'Data Access Control: agents with financial data access need cryptographic enforcement, not just permission rules.',
    funding: '$765M', urgencyScore: 6, accessibilityScore: 5, strategicValueScore: 9,
    linkedIn: 'https://linkedin.com/company/glean', sourceLink: 'https://glean.com/partners',
  },
  {
    company: 'Microsoft (Copilot)', category: 'Enterprise AI Agents', categoryCode: 'E',
    website: 'https://microsoft.com',
    description: 'Public company. Copilot ecosystem with millions of enterprise agents across M365, Azure, and Dynamics. Copilot agents can take financial actions in ERP, finance, and procurement workflows at global scale.',
    whyAeredium: 'Millions of Copilot agents taking financial actions have no cryptographic governance layer  -  Aeredium is the enterprise-grade governance middleware that Microsoft needs to make Copilot agents enterprise-safe at scale.',
    governanceGap: 'No cryptographic governance layer for autonomous Copilot agent actions  -  Azure AD is access control, not agent governance.',
    painPoints: 'Enterprise Agent Governance: millions of agents with financial action authority and no cryptographic governance.',
    funding: 'Public ($3T)', urgencyScore: 9, accessibilityScore: 1, strategicValueScore: 10,
    linkedIn: 'https://linkedin.com/company/microsoft', sourceLink: 'https://microsoft.com',
  },
  {
    company: 'Salesforce (Agentforce)', category: 'Enterprise AI Agents', categoryCode: 'E',
    website: 'https://salesforce.com',
    description: 'Public company. Agentforce  -  enterprise AI agent platform deployed across thousands of enterprise customers. Agents take sales, service, and financial actions autonomously within Salesforce.',
    whyAeredium: 'Agentforce agents with financial action authority use Salesforce Shield for security but not cryptographic governance  -  Aeredium provides the cryptographic policy enforcement that Agentforce needs for regulated industries.',
    governanceGap: 'Agent permissions and audit trails lack cryptographic enforcement  -  Salesforce Shield is audit logging, not governance.',
    painPoints: 'Agent Permissions & Audit: enterprise agents need cryptographic audit trails, not just Salesforce Shield logs.',
    funding: 'Public ($200B)', urgencyScore: 8, accessibilityScore: 1, strategicValueScore: 10,
    linkedIn: 'https://linkedin.com/company/salesforce', sourceLink: 'https://salesforce.com',
  },
  {
    company: 'Google Cloud (Vertex AI)', category: 'Enterprise AI Agents', categoryCode: 'E',
    website: 'https://cloud.google.com',
    description: 'Public company. Vertex AI Agent Builder enabling enterprise agents at global scale. Agents integrated with Google Workspace and enterprise systems can take financial and operational actions.',
    whyAeredium: 'Vertex AI agents have IAM access control but no cryptographic policy enforcement for autonomous actions  -  Aeredium provides the governance layer that makes Vertex AI agents deployable in regulated enterprise environments.',
    governanceGap: 'No cryptographic policy enforcement layer for autonomous agent execution  -  IAM is access control, not agent governance.',
    painPoints: 'Secure Autonomous Execution: enterprise agents executing at global scale without cryptographic governance governance.',
    funding: 'Public ($2T)', urgencyScore: 8, accessibilityScore: 1, strategicValueScore: 10,
    linkedIn: 'https://linkedin.com/company/google-cloud', sourceLink: 'https://cloud.google.com',
  },
  {
    company: 'IBM (Watsonx)', category: 'Enterprise AI Agents', categoryCode: 'E',
    website: 'https://ibm.com',
    description: 'Public company. Watsonx AI agents deployed in highly regulated industries  -  banking, insurance, healthcare, government. IBM\'s enterprise AI platform for autonomous business operations.',
    whyAeredium: 'Watsonx agents deployed in regulated industries use IBM Security frameworks that are not cryptographic governance  -  Aeredium provides the cryptographic governance layer required by banking and insurance regulators.',
    governanceGap: 'Agent compliance and governance lack cryptographic enforcement in regulated sectors  -  IBM Security is framework, not proof.',
    painPoints: 'Compliance & Governance: agents in banking and insurance need cryptographic governance, not just compliance frameworks.',
    funding: 'Public ($140B)', urgencyScore: 8, accessibilityScore: 1, strategicValueScore: 9,
    linkedIn: 'https://linkedin.com/company/ibm', sourceLink: 'https://ibm.com',
  },
  {
    company: 'ServiceNow', category: 'Enterprise AI Agents', categoryCode: 'E',
    website: 'https://servicenow.com',
    description: 'Public company. Enterprise workflow automation platform with AI agents across IT, HR, Finance, and procurement. AI agents handling sensitive financial workflows and procurement approvals.',
    whyAeredium: 'ServiceNow AI agents in Finance workflows use RBAC that is not cryptographically enforced  -  Aeredium adds cryptographic policy binding so agent-initiated financial workflow actions require threshold authorisation.',
    governanceGap: 'Agent authorisation for sensitive enterprise workflows lacks cryptographic enforcement  -  RBAC is access control only.',
    painPoints: 'Agent Authorisation: enterprise finance workflow agents need cryptographic authorisation, not just RBAC rules.',
    funding: 'Public ($155B)', urgencyScore: 7, accessibilityScore: 2, strategicValueScore: 9,
    linkedIn: 'https://linkedin.com/company/servicenow', sourceLink: 'https://servicenow.com',
  },
  {
    company: 'UiPath', category: 'Enterprise AI Agents', categoryCode: 'E',
    website: 'https://uipath.com',
    description: 'Public company. RPA + AI agent platform with $1B+ revenue. Autonomous financial process agents handle invoice processing, payment approvals, and treasury operations for Fortune 500 companies.',
    whyAeredium: 'UiPath RPA + AI agents handling financial processes use role-based access without cryptographic enforcement  -  Aeredium provides cryptographic policy governance so autonomous financial processes are bound by verifiable rules.',
    governanceGap: 'Autonomous financial process agents lack cryptographic policy enforcement  -  RBAC audit logs are not cryptographic proofs.',
    painPoints: 'RPA + Agent Governance: $1B platform with autonomous finance agents and no cryptographic governance layer.',
    funding: 'Public', urgencyScore: 8, accessibilityScore: 3, strategicValueScore: 9,
    linkedIn: 'https://linkedin.com/company/uipath', sourceLink: 'https://uipath.com/enterprise',
  },
  {
    company: 'Automation Anywhere', category: 'Enterprise AI Agents', categoryCode: 'E',
    website: 'https://automationanywhere.com',
    description: '$838M funded. Enterprise intelligent automation with AI agents  -  "AARI" agent handles complex business processes including financial workflows, payment processing, and compliance operations.',
    whyAeredium: 'AARI autonomous financial process agents use role-based controls that are not cryptographically enforced  -  Aeredium adds threshold signing so autonomous financial process actions require cryptographic authorisation.',
    governanceGap: 'Autonomous financial process agents lack cryptographic policy enforcement  -  software access control is not governance.',
    painPoints: 'Autonomous Process Auth: finance automation agents need cryptographic governance for regulated enterprise deployment.',
    funding: '$838M', urgencyScore: 7, accessibilityScore: 3, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/automation-anywhere', sourceLink: 'https://automationanywhere.com/enterprise',
  },
  {
    company: 'SAP (Joule)', category: 'Enterprise AI Agents', categoryCode: 'E',
    website: 'https://sap.com',
    description: 'Public company. Joule AI agent embedded across SAP ERP, Finance, and HR workflows. Used by 440,000+ enterprises. Joule agents can initiate purchase orders, approve invoices, and trigger financial actions.',
    whyAeredium: 'Joule agents embedded in SAP ERP financial workflows use SAP GRC that is not cryptographic governance  -  Aeredium provides the cryptographic policy enforcement that SAP enterprise customers need for regulated financial agent operations.',
    governanceGap: 'ERP financial agent actions lack cryptographic policy enforcement  -  SAP GRC is compliance framework, not agent governance.',
    painPoints: 'ERP Agent Governance: agents triggering purchase orders and financial approvals without cryptographic governance.',
    funding: 'Public ($200B)', urgencyScore: 8, accessibilityScore: 1, strategicValueScore: 10,
    linkedIn: 'https://linkedin.com/company/sap', sourceLink: 'https://sap.com/enterprise',
  },
  {
    company: 'Workday (AI)', category: 'Enterprise AI Agents', categoryCode: 'E',
    website: 'https://workday.com',
    description: 'Public company. AI agents in Workday Finance and HCM cloud. Autonomous payroll processing, financial close operations, and expense management by AI agents for 10,000+ enterprise customers.',
    whyAeredium: 'Workday AI agents handling payroll and financial close use Workday Security without cryptographic governance  -  Aeredium provides the governance layer that Workday customers need for AI-driven financial operations in regulated sectors.',
    governanceGap: 'Finance and HR agent actions lack cryptographic policy enforcement  -  Workday Security is access control, not agent governance.',
    painPoints: 'Finance Agent Auth: autonomous payroll and financial close agents need cryptographic governance for compliance.',
    funding: 'Public ($55B)', urgencyScore: 7, accessibilityScore: 2, strategicValueScore: 9,
    linkedIn: 'https://linkedin.com/company/workday', sourceLink: 'https://workday.com/enterprise',
  },

  // ==============================================================
  // F  -  AGENT-TO-AGENT COMMERCE (12)
  // ==============================================================
  {
    company: 'Presta', category: 'Agent-to-Agent Commerce', categoryCode: 'F',
    website: 'https://wearepresta.com',
    description: 'AI Agent Marketplace for 2026  -  enabling agents to buy and sell services from each other. One of the first purpose-built platforms for agent-to-agent commerce and service transactions.',
    whyAeredium: 'Presta agent commerce has no cryptographic agent identity or transaction authorisation  -  Aeredium provides the identity and governance layer that makes agent-to-agent commerce auditable and dispute-resolvable.',
    governanceGap: 'No cryptographic agent identity or transaction authorisation  -  agent commerce is unverifiable and ungoverned.',
    painPoints: 'Reputation & Dispute: agent-to-agent transactions without identity governance cannot resolve disputes or build reputation.',
    funding: 'Not disclosed', urgencyScore: 9, accessibilityScore: 10, strategicValueScore: 5,
    linkedIn: 'https://linkedin.com/company/wearepresta', sourceLink: 'https://wearepresta.com/contact',
  },
  {
    company: 'Tines', category: 'Agent-to-Agent Commerce', categoryCode: 'F',
    website: 'https://tines.com',
    description: '$271M funded. No-code agentic workflow automation platform. AI agents trigger payments, notifications, and external actions as part of automated workflows. SOC 2 compliant enterprise platform.',
    whyAeredium: 'Tines agents trigger payment actions in workflows with no cryptographic authorisation  -  Aeredium provides threshold signing so agent-triggered payment actions in Tines workflows require multi-party authorisation.',
    governanceGap: 'No cryptographic authorisation for agent-triggered payment actions  -  workflow triggers execute without governance.',
    painPoints: 'Workflow Auth: agents triggering financial actions in automated workflows need cryptographic authorisation governance.',
    funding: '$271M', urgencyScore: 7, accessibilityScore: 5, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/tines', sourceLink: 'https://tines.com/partners',
  },
  {
    company: 'AutoGen (Microsoft)', category: 'Agent-to-Agent Commerce', categoryCode: 'F',
    website: 'https://microsoft.github.io/autogen',
    description: 'Microsoft Research multi-agent orchestration framework. Enables agents to negotiate, collaborate and execute tasks  -  including financial transactions. Foundation for Microsoft\'s multi-agent commerce vision.',
    whyAeredium: 'AutoGen agents negotiating and executing financial transactions have no cryptographic governance  -  Aeredium provides the authorisation layer that makes AutoGen agent-to-agent financial transactions provably governed.',
    governanceGap: 'No cryptographic governance for agent-to-agent transaction authorisation  -  multi-agent coordination is trust-based.',
    painPoints: 'Multi-Agent Transaction Auth: agent-to-agent financial transactions without cryptographic authorisation governance.',
    funding: 'Microsoft Research', urgencyScore: 9, accessibilityScore: 8, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/microsoft', sourceLink: 'https://microsoft.github.io/autogen',
  },
  {
    company: 'CrewAI', category: 'Agent-to-Agent Commerce', categoryCode: 'F',
    website: 'https://crewai.com',
    description: '$18M+ funded. Multi-agent crew orchestration framework. Agent crews collaborate on commercial tasks  -  research, analysis, and financial operations. Fastest-growing multi-agent framework by adoption.',
    whyAeredium: 'CrewAI agent crews executing financial tasks have no cryptographic governance  -  Aeredium provides the policy enforcement layer that makes CrewAI agent crews enterprise-deployable for financial operations.',
    governanceGap: 'Agent crew financial task execution lacks cryptographic policy enforcement  -  crews act without governance bounds.',
    painPoints: 'Crew Commerce Governance: multi-agent crews executing financial tasks need cryptographic governance for enterprise use.',
    funding: '$18M+', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 6,
    linkedIn: 'https://linkedin.com/company/crewai', sourceLink: 'https://crewai.com',
  },
  {
    company: 'AgentLayer', category: 'Agent-to-Agent Commerce', categoryCode: 'F',
    website: 'https://agentlayer.xyz',
    description: 'Early-stage agent-to-agent communication and commerce protocol. Layer-2 infrastructure for agent economic activity. Purpose-built for the emerging agent-to-agent commerce market.',
    whyAeredium: 'AgentLayer agent commerce lacks cryptographic identity and governance  -  Aeredium provides the identity and policy enforcement layer that makes AgentLayer commerce verifiable and enterprise-safe.',
    governanceGap: 'No cryptographic agent identity or policy enforcement for agent commerce  -  agent identity is asserted, not proven.',
    painPoints: 'Agent Commerce Identity: agent-to-agent commerce without cryptographic identity cannot establish trust or governance.',
    funding: 'Early stage', urgencyScore: 9, accessibilityScore: 9, strategicValueScore: 6,
    linkedIn: 'https://linkedin.com/company/agentlayer', sourceLink: 'https://agentlayer.xyz',
  },
  {
    company: 'Autonolas (Olas)', category: 'Agent-to-Agent Commerce', categoryCode: 'F',
    website: 'https://olas.network',
    description: '$20M+ funded. Multi-agent service network for autonomous economic services. On-chain service registry with staking. Agents provide and consume services in an autonomous service economy.',
    whyAeredium: 'Olas service commerce uses staking for incentive alignment but no cryptographic policy governance  -  Aeredium provides threshold signing and policy enforcement so Olas service transactions are cryptographically governed.',
    governanceGap: 'Autonomous service commerce lacks cryptographic policy enforcement  -  staking is incentive alignment, not governance.',
    painPoints: 'Service Commerce Governance: agent service transactions without cryptographic governance cannot satisfy enterprise buyers.',
    funding: '$20M+', urgencyScore: 9, accessibilityScore: 8, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/autonolas', sourceLink: 'https://olas.network',
  },
  {
    company: 'SuperAGI', category: 'Agent-to-Agent Commerce', categoryCode: 'F',
    website: 'https://superagi.com',
    description: '$5M+ funded open-source autonomous agent platform. Agents execute commercial tasks autonomously  -  research, development, and business operations. Growing developer ecosystem for autonomous agent commerce.',
    whyAeredium: 'SuperAGI agents executing commercial tasks have no cryptographic governance  -  Aeredium provides the policy enforcement layer that makes SuperAGI agents enterprise-safe for autonomous commercial operations.',
    governanceGap: 'Autonomous commercial agent actions lack cryptographic enforcement  -  open-source agents operate without governance.',
    painPoints: 'Autonomous Agent Commerce: open-source agents executing commercial tasks without governance are enterprise-unsafe.',
    funding: '$5M+', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 5,
    linkedIn: 'https://linkedin.com/company/superagi', sourceLink: 'https://superagi.com',
  },
  {
    company: 'Fixie.ai', category: 'Agent-to-Agent Commerce', categoryCode: 'F',
    website: 'https://fixie.ai',
    description: '$17M funded. AI agent development platform with tool marketplace. Agents can purchase and use tools from the Fixie marketplace autonomously. Pioneer in agent tool commerce.',
    whyAeredium: 'Fixie agent tool commerce lacks cryptographic governance for agent tool purchases  -  Aeredium provides policy enforcement so agent tool purchases from the Fixie marketplace are bounded by spend policies.',
    governanceGap: 'Agent-to-agent tool commerce lacks cryptographic policy enforcement  -  any agent can purchase any tool without bounds.',
    painPoints: 'Agent Tool Commerce: autonomous tool purchases in the agent marketplace have no spend governance.',
    funding: '$17M', urgencyScore: 7, accessibilityScore: 9, strategicValueScore: 5,
    linkedIn: 'https://linkedin.com/company/fixie-ai', sourceLink: 'https://fixie.ai',
  },
  {
    company: 'LlamaIndex', category: 'Agent-to-Agent Commerce', categoryCode: 'F',
    website: 'https://llamaindex.ai',
    description: '$18M+ funded. AI agent data framework enabling agents to connect to and query data sources. Tool and data exchange capabilities for agent-to-agent data commerce.',
    whyAeredium: 'LlamaIndex agent data exchange lacks cryptographic governance  -  Aeredium provides the governance layer that makes agent data commerce auditable and policy-bound for enterprise data governance requirements.',
    governanceGap: 'Agent data commerce and tool exchange lack cryptographic governance  -  data exchange is API-access-based only.',
    painPoints: 'Agent Data Commerce: agent-to-agent data exchange without cryptographic governance violates enterprise data governance.',
    funding: '$18M+', urgencyScore: 7, accessibilityScore: 7, strategicValueScore: 6,
    linkedIn: 'https://linkedin.com/company/llamaindex', sourceLink: 'https://llamaindex.ai/enterprise',
  },
  {
    company: 'Swarm (OpenAI)', category: 'Agent-to-Agent Commerce', categoryCode: 'F',
    website: 'https://openai.com/research',
    description: 'OpenAI multi-agent orchestration framework for handoff-based agent coordination. Enables agents to pass tasks between specialised agents. Foundation for OpenAI\'s multi-agent commerce vision.',
    whyAeredium: 'Swarm agent coordination involving financial actions has no cryptographic governance  -  Aeredium provides the governance layer that makes OpenAI multi-agent financial coordination enterprise-deployable.',
    governanceGap: 'No cryptographic governance for multi-agent coordination involving financial actions  -  handoffs are trust-based.',
    painPoints: 'Multi-Agent Coordination Auth: agent handoffs triggering financial actions without cryptographic authorisation governance.',
    funding: '$50B+ valuation', urgencyScore: 8, accessibilityScore: 3, strategicValueScore: 10,
    linkedIn: 'https://linkedin.com/company/openai', sourceLink: 'https://openai.com',
  },
  {
    company: 'AgentGPT', category: 'Agent-to-Agent Commerce', categoryCode: 'F',
    website: 'https://agentgpt.reworkd.ai',
    description: '$1.25M funded. Web-based autonomous agent framework. Agents execute multi-step tasks autonomously including commercial operations. Popular consumer-facing autonomous agent platform.',
    whyAeredium: 'AgentGPT autonomous commercial task execution has no cryptographic governance  -  Aeredium provides the policy enforcement layer that makes AgentGPT agent commerce safe for business use.',
    governanceGap: 'Autonomous commercial task execution lacks cryptographic governance  -  agents act freely without policy bounds.',
    painPoints: 'Autonomous Task Commerce: consumer-facing autonomous agents executing commercial tasks with no governance.',
    funding: '$1.25M', urgencyScore: 7, accessibilityScore: 9, strategicValueScore: 4,
    linkedIn: 'https://linkedin.com/company/reworkd', sourceLink: 'https://agentgpt.reworkd.ai',
  },
  {
    company: 'AutoGPT', category: 'Agent-to-Agent Commerce', categoryCode: 'F',
    website: 'https://autogpt.net',
    description: 'Pioneering open-source autonomous agent framework. Sparked the autonomous agent revolution. Agents execute long-horizon tasks including commercial operations without human intervention.',
    whyAeredium: 'AutoGPT autonomous actions in commercial contexts have no cryptographic governance  -  Aeredium provides the governance layer that transforms AutoGPT-style agents from experimental to enterprise-deployable.',
    governanceGap: 'Autonomous commercial agent actions lack cryptographic policy enforcement  -  autonomous operation is ungoverned.',
    painPoints: 'Autonomous Action Governance: pioneer autonomous agent framework with zero cryptographic governance layer.',
    funding: 'Open Source', urgencyScore: 8, accessibilityScore: 8, strategicValueScore: 5,
    linkedIn: '', sourceLink: 'https://autogpt.net',
  },

  // ==============================================================
  // G  -  AUTONOMOUS PROCUREMENT (15)
  // ==============================================================
  {
    company: 'Pactum AI', category: 'Autonomous Procurement', categoryCode: 'G',
    website: 'https://pactum.ai',
    description: 'Seed stage. Autonomous negotiation AI for tail spend procurement. AI agents negotiate directly with suppliers without human intervention. Used by Walmart and Maersk for automated supplier negotiations.',
    whyAeredium: 'Pactum AI agents negotiate supplier contracts autonomously with no cryptographic authorisation  -  Aeredium provides the governance layer that makes autonomous procurement decisions auditable and enterprise-compliant.',
    governanceGap: 'No policy enforcement for autonomous negotiations  -  agents negotiate and commit to terms without governance bounds.',
    painPoints: 'Negotiation Auth: autonomous supplier negotiations without cryptographic authorisation creates unenforceable commitments.',
    funding: 'Seed', urgencyScore: 8, accessibilityScore: 9, strategicValueScore: 5,
    linkedIn: 'https://linkedin.com/company/pactum-ai', sourceLink: 'https://pactum.ai/contact',
  },
  {
    company: 'Keelvar', category: 'Autonomous Procurement', categoryCode: 'G',
    website: 'https://keelvar.com',
    description: 'Autonomous sourcing optimisation AI. AI agents execute procurement sourcing events, evaluate suppliers, and award contracts. Used by global enterprises for automated strategic sourcing.',
    whyAeredium: 'Keelvar sourcing agents award contracts autonomously without cryptographic authorisation  -  Aeredium provides policy enforcement so sourcing agent decisions above defined thresholds require cryptographic approval.',
    governanceGap: 'No cryptographic authorisation for sourcing decisions  -  agents award contracts without threshold-based governance.',
    painPoints: 'Sourcing Compliance: autonomous contract award without cryptographic authorisation risks procurement fraud exposure.',
    funding: 'Not disclosed', urgencyScore: 7, accessibilityScore: 7, strategicValueScore: 6,
    linkedIn: 'https://linkedin.com/company/keelvar', sourceLink: 'https://keelvar.com/contact',
  },
  {
    company: 'Arkestro', category: 'Autonomous Procurement', categoryCode: 'G',
    website: 'https://arkestro.com',
    description: '$50M+ funded. Predictive sourcing intelligence  -  AI predicts optimal sourcing decisions and agents execute them. Autonomous purchase commitments for enterprise procurement.',
    whyAeredium: 'Arkestro agents execute predictive sourcing purchases without cryptographic authorisation  -  Aeredium adds governance so AI-predicted procurement actions above thresholds require cryptographic approval.',
    governanceGap: 'No cryptographic enforcement for procurement actions  -  predictive AI recommendations execute without governance.',
    painPoints: 'Purchase Auth: AI-predicted procurement commitments executing without cryptographic authorisation governance.',
    funding: '$50M+', urgencyScore: 7, accessibilityScore: 6, strategicValueScore: 6,
    linkedIn: 'https://linkedin.com/company/arkestro', sourceLink: 'https://arkestro.com/partners',
  },
  {
    company: 'Suplari', category: 'Autonomous Procurement', categoryCode: 'G',
    website: 'https://suplari.com',
    description: 'Autonomous procurement AI for spend management. AI agents execute spend management decisions and supplier transactions. Focused on autonomous procurement for enterprise spend optimisation.',
    whyAeredium: 'Suplari agents execute spend management transactions without cryptographic authorisation  -  Aeredium provides policy enforcement so autonomous spend decisions require threshold-based cryptographic approval.',
    governanceGap: 'No cryptographic authorisation for transactions  -  autonomous spend management executes without governance.',
    painPoints: 'Transaction Auth: autonomous spend management agents executing without cryptographic authorisation governance.',
    funding: 'Not disclosed', urgencyScore: 7, accessibilityScore: 7, strategicValueScore: 5,
    linkedIn: 'https://linkedin.com/company/suplari', sourceLink: 'https://suplari.com/contact',
  },
  {
    company: 'Jaggaer', category: 'Autonomous Procurement', categoryCode: 'G',
    website: 'https://jaggaer.com',
    description: '$500M+ funded. AI-driven sourcing and procurement platform. Autonomous sourcing agents handle supplier discovery, RFP, and contract award. Enterprise procurement for Fortune 500 companies.',
    whyAeredium: 'Jaggaer sourcing agents make autonomous sourcing decisions without cryptographic authorisation  -  Aeredium provides governance so Jaggaer agent sourcing decisions above thresholds require cryptographic multi-party approval.',
    governanceGap: 'Autonomous sourcing decisions lack cryptographic policy enforcement  -  enterprise procurement agents act without governance.',
    painPoints: 'Intelligent Sourcing Governance: $500M platform with autonomous sourcing agents and no cryptographic governance.',
    funding: '$500M+', urgencyScore: 8, accessibilityScore: 5, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/jaggaer', sourceLink: 'https://jaggaer.com/contact',
  },
  {
    company: 'GEP SMART', category: 'Autonomous Procurement', categoryCode: 'G',
    website: 'https://gep.com',
    description: 'Private. AI-powered procurement platform with autonomous procurement capabilities. AI agents handle source-to-pay automation for global enterprise procurement operations.',
    whyAeredium: 'GEP AI procurement agents handle source-to-pay without cryptographic governance  -  Aeredium provides the governance layer that GEP enterprise customers need for regulated autonomous procurement compliance.',
    governanceGap: 'Autonomous procurement agent actions lack cryptographic policy enforcement  -  SOC 2 is security, not agent governance.',
    painPoints: 'Procurement AI Auth: autonomous source-to-pay actions without cryptographic governance for enterprise compliance.',
    funding: 'Private', urgencyScore: 7, accessibilityScore: 4, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/gep', sourceLink: 'https://gep.com/contact',
  },
  {
    company: 'SAP Ariba', category: 'Autonomous Procurement', categoryCode: 'G',
    website: 'https://sap.com/ariba',
    description: 'SAP procurement network (public company). Enterprise procurement network connecting buyers and suppliers globally. AI-embedded procurement agents for autonomous source-to-pay operations.',
    whyAeredium: 'SAP Ariba AI procurement agents operate without cryptographic governance  -  Aeredium provides the governance layer that makes SAP Ariba autonomous procurement compliant for regulated enterprise buyers.',
    governanceGap: 'Autonomous procurement agent actions lack cryptographic enforcement in regulated enterprise environments.',
    painPoints: 'Enterprise Procurement Governance: global procurement network with AI agents and no cryptographic governance layer.',
    funding: 'SAP Public ($200B)', urgencyScore: 7, accessibilityScore: 2, strategicValueScore: 9,
    linkedIn: 'https://linkedin.com/company/sap', sourceLink: 'https://sap.com/ariba',
  },
  {
    company: 'Ivalua', category: 'Autonomous Procurement', categoryCode: 'G',
    website: 'https://ivalua.com',
    description: '$60M+ funded. AI-driven source-to-pay platform. Procurement decision agents with autonomous approval and sourcing capabilities. Used by major global enterprises for autonomous procurement.',
    whyAeredium: 'Ivalua procurement decision agents use access control without cryptographic enforcement  -  Aeredium adds threshold signing so Ivalua agent procurement decisions above thresholds require cryptographic approval.',
    governanceGap: 'Procurement decision agents lack cryptographic authorisation layer  -  access control is role-based, not cryptographic.',
    painPoints: 'Procurement Decision Auth: autonomous procurement decisions need cryptographic governance for enterprise audit.',
    funding: '$60M+', urgencyScore: 7, accessibilityScore: 5, strategicValueScore: 6,
    linkedIn: 'https://linkedin.com/company/ivalua', sourceLink: 'https://ivalua.com/contact',
  },
  {
    company: 'Procurify', category: 'Autonomous Procurement', categoryCode: 'G',
    website: 'https://procurify.com',
    description: '$50M+ funded. Spend management with AI-powered approval automation. Agents handle purchase request approval, budget checking, and PO creation autonomously.',
    whyAeredium: 'Procurify AI approval automation relies on workflow controls without cryptographic enforcement  -  Aeredium adds threshold signing so automated procurement approvals are cryptographically bound and auditable.',
    governanceGap: 'Automated purchase request agents lack cryptographic policy enforcement  -  workflow gates are software rules only.',
    painPoints: 'Spend Request Governance: AI-automated purchase approvals without cryptographic binding fail enterprise audits.',
    funding: '$50M+', urgencyScore: 7, accessibilityScore: 7, strategicValueScore: 5,
    linkedIn: 'https://linkedin.com/company/procurify', sourceLink: 'https://procurify.com',
  },
  {
    company: 'Fairmarkit', category: 'Autonomous Procurement', categoryCode: 'G',
    website: 'https://fairmarkit.com',
    description: '$35M+ funded. Autonomous procurement platform for tail spend. AI agents autonomously source, evaluate, and award tail spend contracts without human intervention.',
    whyAeredium: 'Fairmarkit sourcing agents award contracts autonomously without cryptographic authorisation  -  Aeredium provides governance so autonomous tail spend sourcing decisions are cryptographically enforced and auditable.',
    governanceGap: 'Autonomous sourcing agent decisions lack cryptographic policy enforcement  -  tail spend awards without governance.',
    painPoints: 'Autonomous Sourcing Auth: tail spend contracts awarded autonomously without cryptographic authorisation governance.',
    funding: '$35M+', urgencyScore: 8, accessibilityScore: 8, strategicValueScore: 5,
    linkedIn: 'https://linkedin.com/company/fairmarkit', sourceLink: 'https://fairmarkit.com/contact',
  },
  {
    company: 'Scoutbee', category: 'Autonomous Procurement', categoryCode: 'G',
    website: 'https://scoutbee.com',
    description: '$60M+ funded. AI-powered supplier discovery and intelligence. Agents autonomously discover, evaluate, and recommend suppliers for enterprise procurement decisions.',
    whyAeredium: 'Scoutbee AI supplier selection decisions lack cryptographic authorisation  -  Aeredium provides governance so supplier selection decisions above defined thresholds require cryptographic multi-party approval.',
    governanceGap: 'AI-driven supplier selection lacks cryptographic policy enforcement  -  selections are AI recommendations, not governed decisions.',
    painPoints: 'Supplier Discovery Governance: autonomous supplier selection without governance creates uncontrolled procurement risk.',
    funding: '$60M+', urgencyScore: 7, accessibilityScore: 8, strategicValueScore: 5,
    linkedIn: 'https://linkedin.com/company/scoutbee', sourceLink: 'https://scoutbee.com/contact',
  },
  {
    company: 'Globality', category: 'Autonomous Procurement', categoryCode: 'G',
    website: 'https://globality.com',
    description: '$300M+ funded. Autonomous AI sourcing for services procurement. AI agents autonomously scope, source, and select service suppliers  -  creating procurement commitments without RFP.',
    whyAeredium: 'Globality autonomous sourcing commitments lack cryptographic authorisation  -  Aeredium provides the governance layer that makes Globality autonomous service procurement compliant for enterprise buyers.',
    governanceGap: 'Autonomous procurement commitment agents lack cryptographic policy enforcement  -  sourcing commitments are unverifiable.',
    painPoints: 'Autonomous Sourcing Control: $300M platform creating autonomous procurement commitments without governance.',
    funding: '$300M+', urgencyScore: 8, accessibilityScore: 7, strategicValueScore: 6,
    linkedIn: 'https://linkedin.com/company/globality', sourceLink: 'https://globality.com/contact',
  },
  {
    company: 'Zip (Procurement)', category: 'Autonomous Procurement', categoryCode: 'G',
    website: 'https://ziphq.com',
    description: '$180M+ funded. Intake-to-procure automation platform. AI agents handle the full procurement intake workflow  -  request, approval routing, and PO creation  -  autonomously.',
    whyAeredium: 'Zip AI procurement intake agents use workflow automation without cryptographic enforcement  -  Aeredium adds threshold signing so Zip agent procurement approvals above defined thresholds are cryptographically governed.',
    governanceGap: 'Autonomous procurement intake agents lack cryptographic policy enforcement  -  workflow automation is not governance.',
    painPoints: 'Intake-to-Procure Governance: autonomous procurement workflow agents with no cryptographic authorisation governance.',
    funding: '$180M+', urgencyScore: 8, accessibilityScore: 7, strategicValueScore: 6,
    linkedIn: 'https://linkedin.com/company/zip-hq', sourceLink: 'https://ziphq.com/enterprise',
  },
  {
    company: 'Simfoni', category: 'Autonomous Procurement', categoryCode: 'G',
    website: 'https://simfoni.com',
    description: 'AI spend analytics and procurement automation. Agents analyse spend and autonomously execute procurement optimisation actions. Focused on autonomous spend management for enterprises.',
    whyAeredium: 'Simfoni spend analytics agents execute autonomous actions without cryptographic governance  -  Aeredium provides policy enforcement so autonomous spend optimisation actions are bounded by cryptographic governance rules.',
    governanceGap: 'Autonomous spend analytics agent actions lack cryptographic enforcement  -  analytics-to-action is uncontrolled.',
    painPoints: 'Spend Analytics Agent Auth: analytics-driven autonomous spend actions without cryptographic governance governance.',
    funding: 'Not disclosed', urgencyScore: 6, accessibilityScore: 8, strategicValueScore: 5,
    linkedIn: 'https://linkedin.com/company/simfoni', sourceLink: 'https://simfoni.com/contact',
  },

  // ==============================================================
  // H  -  FINANCIAL INFRASTRUCTURE (16)
  // ==============================================================
  {
    company: 'Alchemy', category: 'Financial Infrastructure', categoryCode: 'H',
    website: 'https://alchemy.com',
    description: '$700M+ funded. Blockchain infrastructure platform powering agent wallet demos with $45M volume and 162M transactions. Core web3 infrastructure for agent payment backends at scale.',
    whyAeredium: 'Alchemy processes agent transactions at massive scale with no agent-specific governance  -  Aeredium provides the threshold signing and policy enforcement layer that makes Alchemy-powered agent operations enterprise-safe.',
    governanceGap: 'No threshold signing for agent operations  -  Alchemy infrastructure is agent-unaware at the governance level.',
    painPoints: 'Agent Authorisation: $700M infrastructure processing agent transactions without agent-specific governance layer.',
    funding: '$700M+', urgencyScore: 9, accessibilityScore: 4, strategicValueScore: 9,
    linkedIn: 'https://linkedin.com/company/alchemyinc', sourceLink: 'https://alchemy.com/partners',
  },
  {
    company: 'Lightning Labs', category: 'Financial Infrastructure', categoryCode: 'H',
    website: 'https://lightning.engineering',
    description: '$70M+ funded. Core Lightning Network development team. L402 protocol enables AI agents to pay for API access using Lightning micropayments. Pioneer of machine-to-machine payments.',
    whyAeredium: 'L402 agent payments on Lightning lack policy enforcement  -  Aeredium provides the governance layer that enforces cryptographic spend policies for agent Lightning payments and provides audit trails.',
    governanceGap: 'No policy enforcement for agent payments  -  Lightning payments are anonymous and ungoverned by design.',
    painPoints: 'Key Management: Lightning agent payments without policy enforcement cannot satisfy enterprise payment governance.',
    funding: '$70M+', urgencyScore: 8, accessibilityScore: 7, strategicValueScore: 6,
    linkedIn: 'https://linkedin.com/company/lightning-labs', sourceLink: 'https://lightning.engineering/contact',
  },
  {
    company: 'BNB Chain', category: 'Financial Infrastructure', categoryCode: 'H',
    website: 'https://bnbchain.org',
    description: 'Binance-backed L1 blockchain. Deployed ERC-8004 (AI agent identity standard) and BAP-578. Actively building the blockchain infrastructure for AI agent identity and payments.',
    whyAeredium: 'BNB Chain\'s ERC-8004 provides agent identity on-chain but lacks cryptographic policy enforcement  -  Aeredium adds the policy governance layer that enforces what an ERC-8004-identified agent is authorised to do.',
    governanceGap: 'Agent identity lacks cryptographic policy enforcement  -  ERC-8004 identifies agents but doesn\'t govern their actions.',
    painPoints: 'On-chain Identity: on-chain agent identity standard without policy governance layer is identification, not governance.',
    funding: 'Binance', urgencyScore: 8, accessibilityScore: 4, strategicValueScore: 9,
    linkedIn: 'https://linkedin.com/company/bnbchain', sourceLink: 'https://bnbchain.org/partners',
  },
  {
    company: 'Visa', category: 'Financial Infrastructure', categoryCode: 'H',
    website: 'https://visa.com',
    description: 'Public company. $1T+ annual volume. Actively researching AI agent payment infrastructure. Published research on autonomous agent payment systems. Core global payment rail exploring agent authorisation.',
    whyAeredium: 'Visa\'s agent payment research lacks a cryptographic agent authorisation standard  -  Aeredium provides the MPC-based threshold signing and policy enforcement standard that Visa needs for enterprise-grade agent payments.',
    governanceGap: 'No agent-specific cryptographic controls  -  Visa\'s established security is not agent-identity-aware.',
    painPoints: 'Agent Auth at Scale: $1T+ payment rail without agent-specific cryptographic governance for autonomous transactions.',
    funding: 'Public ($500B)', urgencyScore: 7, accessibilityScore: 1, strategicValueScore: 10,
    linkedIn: 'https://linkedin.com/company/visa', sourceLink: 'https://developer.visa.com',
  },
  {
    company: 'Mastercard', category: 'Financial Infrastructure', categoryCode: 'H',
    website: 'https://mastercard.com',
    description: 'Public company. Actively building agentic payment infrastructure and virtual card platforms for AI agents. Agent Tokens initiative for AI agent payment authorisation. Core global payment rail.',
    whyAeredium: 'Mastercard\'s Agent Tokens are a payment standard without cryptographic policy enforcement  -  Aeredium provides the MPC-based governance layer that makes Mastercard Agent Tokens enterprise-safe and auditable.',
    governanceGap: 'No agent-specific cryptographic enforcement  -  Agent Tokens identify agents but don\'t enforce spend policies.',
    painPoints: 'Agent Auth at Scale: global payment rail building agent tokens without cryptographic policy governance layer.',
    funding: 'Public ($400B)', urgencyScore: 7, accessibilityScore: 1, strategicValueScore: 10,
    linkedIn: 'https://linkedin.com/company/mastercard', sourceLink: 'https://developer.mastercard.com',
  },
  {
    company: 'Fireblocks', category: 'Financial Infrastructure', categoryCode: 'H',
    website: 'https://fireblocks.com',
    description: '$1.1B funded. MPC-CMP custody securing $8B+ in digital assets. Policy engine for transaction signing. Institutional custody infrastructure used by 1,800+ financial institutions.',
    whyAeredium: 'Fireblocks MPC-CMP is institutional-grade but not agent-identity-aware  -  Aeredium provides the agent-specific governance layer that defines what autonomous agents can do within Fireblocks-custodied infrastructure.',
    governanceGap: 'Agent-specific cryptographic governance layer not natively supported  -  Fireblocks policy engine is not agent-identity-aware.',
    painPoints: 'Agent MPC Governance: institutional MPC without agent-specific governance is insufficient for autonomous agent operations.',
    funding: '$1.1B', urgencyScore: 9, accessibilityScore: 5, strategicValueScore: 9,
    linkedIn: 'https://linkedin.com/company/fireblocks', sourceLink: 'https://fireblocks.com/enterprise',
  },
  {
    company: 'Chainalysis', category: 'Financial Infrastructure', categoryCode: 'H',
    website: 'https://chainalysis.com',
    description: '$536M funded. Blockchain analytics platform for compliance. Know Your Transaction (KYT) for real-time transaction monitoring. Used by exchanges, governments, and financial institutions.',
    whyAeredium: 'Chainalysis monitors agent-initiated transactions after the fact  -  Aeredium provides the pre-execution governance layer that makes agent transactions compliant before they hit the chain for Chainalysis to monitor.',
    governanceGap: 'Agent-initiated transaction audit trails lack cryptographic immutability  -  Chainalysis monitors but cannot prevent ungoverned agent actions.',
    painPoints: 'Agent Compliance Audit: reactive transaction monitoring is insufficient  -  agent governance must be pre-execution.',
    funding: '$536M', urgencyScore: 8, accessibilityScore: 4, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/chainalysis', sourceLink: 'https://chainalysis.com/enterprise',
  },
  {
    company: 'TRM Labs', category: 'Financial Infrastructure', categoryCode: 'H',
    website: 'https://trmlabs.com',
    description: '$180M funded. Blockchain risk intelligence for compliance and fraud prevention. Real-time risk scoring for transactions. Used by VASPs, banks, and government agencies.',
    whyAeredium: 'TRM Labs provides risk intelligence for agent transactions but cannot prevent ungoverned agent actions  -  Aeredium provides pre-execution governance so TRM-monitored agent transactions are policy-bound before submission.',
    governanceGap: 'Agent transaction risk governance lacks cryptographic policy enforcement  -  TRM flags risk after the fact.',
    painPoints: 'Agent Risk Intelligence: risk scoring without pre-execution governance cannot prevent agent-initiated financial risk.',
    funding: '$180M', urgencyScore: 8, accessibilityScore: 6, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/trm-labs', sourceLink: 'https://trmlabs.com/contact',
  },
  {
    company: 'Elliptic', category: 'Financial Infrastructure', categoryCode: 'H',
    website: 'https://elliptic.co',
    description: '$60M+ funded. Crypto compliance intelligence platform. AML and sanctions screening for crypto transactions. Used by exchanges and financial institutions for compliance operations.',
    whyAeredium: 'Elliptic compliance checks agent-initiated transactions reactively  -  Aeredium provides the pre-execution governance layer that ensures agent transactions satisfy compliance requirements before execution.',
    governanceGap: 'Agent-initiated transaction compliance controls lack cryptographic enforcement  -  Elliptic screens, not governs.',
    painPoints: 'Agent Compliance Controls: post-execution AML screening insufficient for autonomous agent transaction governance.',
    funding: '$60M+', urgencyScore: 7, accessibilityScore: 6, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/elliptic', sourceLink: 'https://elliptic.co/enterprise',
  },
  {
    company: 'Copper', category: 'Financial Infrastructure', categoryCode: 'H',
    website: 'https://copper.co',
    description: '$75M+ funded. Digital asset prime brokerage with ClearLoop settlement. MPC custody for institutional asset management. Used by hedge funds and institutional investors for crypto operations.',
    whyAeredium: 'Copper prime brokerage operations driven by AI agents lack agent-specific cryptographic governance  -  Aeredium provides the policy enforcement layer that makes Copper-powered autonomous agent operations compliant.',
    governanceGap: 'Agent-driven prime brokerage operations lack cryptographic policy enforcement  -  MPC custody is not agent-governance.',
    painPoints: 'Prime Broker Agent Governance: institutional prime brokerage with autonomous agent operations and no governance.',
    funding: '$75M+', urgencyScore: 8, accessibilityScore: 5, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/copper-co', sourceLink: 'https://copper.co/enterprise',
  },
  {
    company: 'Metaco (Ripple)', category: 'Financial Infrastructure', categoryCode: 'H',
    website: 'https://metaco.com',
    description: 'Acquired by Ripple for $250M. HARMONIZE digital asset orchestration platform for banks and financial institutions. Institutional-grade digital asset management infrastructure.',
    whyAeredium: 'Metaco HARMONIZE orchestrates digital assets for banks but agent-driven operations lack cryptographic governance  -  Aeredium provides the agent-specific policy enforcement layer for Metaco-powered institutional agent operations.',
    governanceGap: 'Agent-driven digital asset orchestration lacks cryptographic policy enforcement  -  HSM is key management, not agent governance.',
    painPoints: 'Digital Asset Agent Orchestration: bank-grade orchestration without agent governance is enterprise-unsafe for autonomous ops.',
    funding: '$250M (Ripple)', urgencyScore: 8, accessibilityScore: 4, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/metaco', sourceLink: 'https://metaco.com/enterprise',
  },
  {
    company: 'Talos', category: 'Financial Infrastructure', categoryCode: 'H',
    website: 'https://talos.com',
    description: '$105M funded. Institutional crypto trading infrastructure. FIX protocol connectivity for institutional crypto trading. Used by banks and funds for autonomous crypto trading operations.',
    whyAeredium: 'Talos institutional trading infrastructure used by autonomous agents lacks agent-specific cryptographic governance  -  Aeredium provides the governance layer that constrains autonomous agent trading within defined institutional policies.',
    governanceGap: 'Autonomous trading agent operations lack cryptographic policy enforcement  -  FIX protocol is connectivity, not governance.',
    painPoints: 'Institutional Trading Agent Control: institutional trading infra with autonomous agents and no cryptographic governance.',
    funding: '$105M', urgencyScore: 8, accessibilityScore: 5, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/talos-trading', sourceLink: 'https://talos.com/contact',
  },
  {
    company: 'Paxos', category: 'Financial Infrastructure', categoryCode: 'H',
    website: 'https://paxos.com',
    description: '$540M funded. NYDFS-regulated stablecoin and settlement infrastructure. Issuer of PYUSD (PayPal USD) and PAXG. Real-time gross settlement infrastructure for institutional crypto.',
    whyAeredium: 'Paxos regulated settlement infrastructure used by agents lacks cryptographic agent governance  -  Aeredium provides the policy enforcement layer that makes Paxos-powered agent settlement compliant for regulated institutions.',
    governanceGap: 'Agent-initiated settlement and stablecoin operations lack cryptographic policy enforcement beyond regulatory approval.',
    painPoints: 'Settlement Agent Auth: regulated stablecoin settlement with autonomous agent operations needs cryptographic governance.',
    funding: '$540M', urgencyScore: 8, accessibilityScore: 4, strategicValueScore: 8,
    linkedIn: 'https://linkedin.com/company/paxos', sourceLink: 'https://paxos.com/enterprise',
  },
  {
    company: 'Zero Hash', category: 'Financial Infrastructure', categoryCode: 'H',
    website: 'https://zerohash.com',
    description: '$35M+ funded. B2B embedded crypto infrastructure. Powers crypto features for fintech and enterprise payment backends. Used as the crypto rails for agent payment infrastructure deployments.',
    whyAeredium: 'Zero Hash embedded crypto operations powering agent payment backends lack agent-specific governance  -  Aeredium provides cryptographic policy enforcement for Zero Hash-powered autonomous agent crypto operations.',
    governanceGap: 'Agent-initiated embedded crypto operations lack cryptographic policy enforcement  -  API access is not agent governance.',
    painPoints: 'Embedded Crypto Agent Rails: B2B crypto infrastructure for agent backends without agent governance layer.',
    funding: '$35M+', urgencyScore: 8, accessibilityScore: 6, strategicValueScore: 7,
    linkedIn: 'https://linkedin.com/company/zero-hash', sourceLink: 'https://zerohash.com/contact',
  },
  {
    company: 'Coinbase Institutional', category: 'Financial Infrastructure', categoryCode: 'H',
    website: 'https://institutional.coinbase.com',
    description: 'Public company (Coinbase). Institutional crypto custody, prime brokerage, and trading. Agent-powered institutional crypto operations. $130B+ in institutional assets under management.',
    whyAeredium: 'Coinbase Institutional\'s agent-authorised custody operations use cold storage and multi-sig that is not agent-identity-aware  -  Aeredium provides agent-specific policy enforcement for Coinbase Institutional-powered agent operations.',
    governanceGap: 'Agent-authorised custody and settlement operations lack cryptographic policy enforcement  -  multi-sig is not agent-aware.',
    painPoints: 'Agent Custody Governance: institutional custody with autonomous agent operations and no agent-specific governance.',
    funding: 'Public', urgencyScore: 7, accessibilityScore: 3, strategicValueScore: 9,
    linkedIn: 'https://linkedin.com/company/coinbase', sourceLink: 'https://institutional.coinbase.com',
  },
  {
    company: 'Anchorage (Settlement)', category: 'Financial Infrastructure', categoryCode: 'H',
    website: 'https://anchorage.com',
    description: 'First federally chartered digital asset bank. Regulated settlement infrastructure for institutional digital asset operations. Agent-initiated regulated settlement for institutional clients.',
    whyAeredium: 'Anchorage regulated settlement for agent-initiated operations lacks cryptographic agent governance  -  Aeredium provides the policy enforcement layer that makes Anchorage-powered agent settlement compliant at the federal level.',
    governanceGap: 'Agent-initiated regulated settlement operations lack cryptographic policy enforcement  -  bank charter is not agent governance.',
    painPoints: 'Regulated Agent Settlement: federally chartered settlement infrastructure with agent operations and no cryptographic governance.',
    funding: '$350M+', urgencyScore: 9, accessibilityScore: 4, strategicValueScore: 9,
    linkedIn: 'https://linkedin.com/company/anchorage', sourceLink: 'https://anchorage.com/enterprise',
  },
]

// == Category metadata ==========================================
const CATEGORY_META: Record<string, { code: string; color: string; description: string }> = {
  'Agent Payments':           { code: 'A', color: '#a78bfa', description: 'Platforms moving money on behalf of AI agents  -  SDKs, stablecoins, Lightning' },
  'Agent Wallets':            { code: 'B', color: '#38bdf8', description: 'MPC, smart account & embedded wallet infra for autonomous agent signing' },
  'AI Trading / DeFi Agents':{ code: 'C', color: '#34d399', description: 'Autonomous agents executing trades, managing LP positions and lending strategies' },
  'Treasury Automation':      { code: 'D', color: '#fbbf24', description: 'DAO and corporate treasury management driven by AI agents' },
  'Enterprise AI Agents':     { code: 'E', color: '#f472b6', description: 'Enterprise workflow agents with financial action authority (ERP, RPA, procurement)' },
  'Agent-to-Agent Commerce':  { code: 'F', color: '#fb923c', description: 'Multi-agent frameworks where agents buy and sell services from each other' },
  'Autonomous Procurement':   { code: 'G', color: '#818cf8', description: 'AI agents autonomously sourcing, negotiating, and creating purchase commitments' },
  'Financial Infrastructure': { code: 'H', color: '#22d3ee', description: 'Settlement rails, compliance, custody, and analytics underpinning agent finance' },
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
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, padding: '2px 7px', borderRadius: 6, fontSize: 11, fontWeight: 700, color, background: bg, border: `1px solid ${border}` }}>
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
  const [enriching, setEnriching] = useState<Set<string>>(new Set())
  const [bulkAdding, setBulkAdding] = useState<string | null>(null)

  const filtered = ALL_TARGETS.filter(t => {
    const matchCat = category === 'All' || t.category === category
    const q = search.toLowerCase()
    const matchSearch = !q ||
      t.company.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.whyAeredium.toLowerCase().includes(q) ||
      t.governanceGap.toLowerCase().includes(q) ||
      t.painPoints.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
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
      ? (sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)
      : <ChevronDown size={10} style={{ opacity: 0.3 }} />

  const kickOffEnrichment = (leadId: string, companyName: string) => {
    setEnriching(s => new Set([...s, companyName]))

    // Log each enrichment phase to the activity panel
    const a1 = agentActivity.start({ tool: 'Claude',        action: 'Research + Classify + Fit Analysis', page: `Agentic Payments — ${companyName}`, timestamp: Date.now() })
    const a2 = agentActivity.start({ tool: 'ContactFinder', action: 'Find Contacts',                      page: `Agentic Payments — ${companyName}`, timestamp: Date.now() })
    const a3 = agentActivity.start({ tool: 'Claude',        action: 'Generate Use Cases',                 page: `Agentic Payments — ${companyName}`, timestamp: Date.now() })
    const t0 = Date.now()

    fetch('/api/ai/enrich-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId }),
    })
      .then(r => r.json())
      .then(res => {
        const dur = Date.now() - t0
        if (res.success) {
          agentActivity.finish(a1, 'success', 'Research complete', Math.round(dur * 0.4))
          agentActivity.finish(a2, 'success', 'Contacts saved',    Math.round(dur * 0.3))
          agentActivity.finish(a3, 'success', 'Use cases ready',   Math.round(dur * 0.3))
          toast.success(`✓ ${companyName} fully enriched — contacts, use cases & research ready`)
        } else {
          agentActivity.finish(a1, 'error', 'Partial enrichment')
          agentActivity.finish(a2, 'error', 'Partial enrichment')
          agentActivity.finish(a3, 'error', 'Partial enrichment')
          toast.error(`Enrichment partial for ${companyName}`)
        }
      })
      .catch(() => {
        agentActivity.finish(a1, 'error', 'Pipeline failed')
        agentActivity.finish(a2, 'error', 'Pipeline failed')
        agentActivity.finish(a3, 'error', 'Pipeline failed')
        toast.error(`Enrichment failed for ${companyName}`)
      })
      .finally(() => setEnriching(s => { const n = new Set(s); n.delete(companyName); return n }))
  }

  const addToPipeline = async (t: AgentTarget) => {
    setAdding(t.company)
    try {
      const { data: newLead, error } = await supabase.from('leads').insert({
        company_name: t.company,
        website: t.website,
        description: t.description,
        industry_category: t.category,
        customer_category: ['Agentic Payments Customer'],
        product_to_sell: 'Agentic payment rails',
        pain_point: t.painPoints,
        pain_point_severity: t.urgencyScore >= 9 ? 'critical' : t.urgencyScore >= 7 ? 'high' : 'medium',
        pain_point_evidence: t.whyAeredium,
        pain_point_evidence_type: 'agent_analysis',
        kima_fit: t.whyAeredium,
        aeredium_fit: t.governanceGap,
        trigger_reason: `${t.company} — ${t.governanceGap}`,
        integration_feasibility: t.accessibilityScore >= 8 ? 'high' : t.accessibilityScore >= 5 ? 'medium' : 'low',
        lead_score: Math.round(totalScore(t) / 30 * 100),
        priority: t.urgencyScore >= 9 ? 'excellent' : t.urgencyScore >= 7 ? 'qualified' : 'needs_research',
        status: 'approved',   // immediately visible in Today's Plan
        source_url: t.sourceLink,
        updated_at: new Date().toISOString(),
      }).select('id').single()

      if (error) {
        if (error.code === '23505') { toast(`${t.company} already in pipeline`); setAdded(s => new Set([...s, t.company])) }
        else toast.error('Failed: ' + error.message)
        setAdding(null)
        return
      }

      setAdded(s => new Set([...s, t.company]))
      toast(`${t.company} added — running full AI research in background…`, { icon: '🔬' })

      // Fire-and-forget enrichment pipeline
      if (newLead?.id) kickOffEnrichment(newLead.id, t.company)

    } catch { toast.error('Failed') }
    setAdding(null)
  }

  const bulkAddCategory = async (cat: string) => {
    const targets = ALL_TARGETS.filter(t => t.category === cat && !added.has(t.company))
    if (!targets.length) { toast('All companies in this category already added'); return }
    if (!confirm(`Add all ${targets.length} companies from "${cat}" to BD pipeline?`)) return
    setBulkAdding(cat)
    let successCount = 0
    for (const t of targets) {
      try {
        const { error } = await supabase.from('leads').insert({
          company_name: t.company,
          website: t.website,
          description: t.description,
          industry_category: t.category,
          customer_category: ['Agentic Payments Customer'],
          product_to_sell: 'Agentic payment rails',
          pain_point: t.painPoints,
          pain_point_severity: t.urgencyScore >= 9 ? 'critical' : t.urgencyScore >= 7 ? 'high' : 'medium',
          pain_point_evidence: t.whyAeredium,
          pain_point_evidence_type: 'agent_analysis',
          kima_fit: t.whyAeredium,
          trigger_reason: `${t.company}  -  ${t.governanceGap}`,
          integration_feasibility: t.accessibilityScore >= 8 ? 'high' : t.accessibilityScore >= 5 ? 'medium' : 'low',
          lead_score: Math.round(totalScore(t) / 30 * 100),
          priority: t.urgencyScore >= 9 ? 'excellent' : t.urgencyScore >= 7 ? 'qualified' : 'needs_research',
          status: 'new',
          source_url: t.sourceLink,
          updated_at: new Date().toISOString(),
        })
        if (!error || error.code === '23505') { successCount++; setAdded(s => new Set([...s, t.company])) }
      } catch { /* continue */ }
    }
    toast.success(`Added ${successCount} companies from "${cat}" to pipeline`)
    setBulkAdding(null)
  }

  const activeCatMeta = category !== 'All' ? CATEGORY_META[category] : null
  const topTargets = ALL_TARGETS.filter(t => totalScore(t) >= 22).length
  const avgScore = Math.round(ALL_TARGETS.reduce((s, t) => s + totalScore(t), 0) / ALL_TARGETS.length)

  return (
    <div className="fade-in">
      {/* == Header ================================================ */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2">
              <CreditCard size={18} style={{ color: '#a78bfa' }} />
              Agentic Payments
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}>
                AEREDIUM MARKET MAP
              </span>
            </h1>
            <p style={{ fontSize: 12, marginTop: 4, color: 'rgb(100,106,135)', fontWeight: 500 }}>
              {ALL_TARGETS.length} companies  8 categories  AI Agent Governance gap intelligence
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {category !== 'All' && (
              <button onClick={() => bulkAddCategory(category)} disabled={bulkAdding === category}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${activeCatMeta?.color ?? '#a78bfa'}50`, background: `${activeCatMeta?.color ?? '#a78bfa'}14`, color: activeCatMeta?.color ?? '#a78bfa' }}>
                {bulkAdding === category ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                Bulk Add {category} ({ALL_TARGETS.filter(t => t.category === category && !added.has(t.company)).length})
              </button>
            )}
            <button
              onClick={() => {
                const csv = ['Company,Category,Website,Description,Why AEREDIUM,Governance Gap,Pain Points,Funding,Urgency,Accessibility,Strategic,Total',
                  ...sorted.map(t => `"${t.company}","${t.category}","${t.website}","${t.description.replace(/"/g, '""')}","${t.whyAeredium.replace(/"/g, '""')}","${t.governanceGap.replace(/"/g, '""')}","${t.painPoints.replace(/"/g, '""')}","${t.funding}",${t.urgencyScore},${t.accessibilityScore},${t.strategicValueScore},${totalScore(t)}`)
                ].join('\n')
                const a = document.createElement('a'); a.href = 'data:text/csv,' + encodeURIComponent(csv); a.download = 'agentic-payments.csv'; a.click()
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgb(160,165,195)' }}>
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 32px' }}>

        {/* == Stats =============================================== */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
          {[
            { label: 'Total Companies', value: ALL_TARGETS.length, color: '#a78bfa' },
            { label: 'Top Priority (22/30)', value: topTargets, color: '#34d399' },
            { label: 'Market Categories', value: 8, color: '#38bdf8' },
            { label: 'Avg Score /30', value: avgScore, color: '#fbbf24' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${s.color}20`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'rgb(120,127,160)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* == Category + Search =================================== */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgb(120,127,160)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search companies, pain points, gaps..."
              style={{ padding: '7px 12px 7px 30px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'white', fontSize: 12, outline: 'none', width: 260 }} />
          </div>
          <Filter size={13} style={{ color: 'rgb(120,127,160)' }} />
          {CATEGORIES.map(cat => {
            const meta = cat !== 'All' ? CATEGORY_META[cat] : null
            const isActive = category === cat
            const col = meta?.color ?? '#a78bfa'
            const count = cat === 'All' ? ALL_TARGETS.length : ALL_TARGETS.filter(t => t.category === cat).length
            return (
              <button key={cat} onClick={() => setCategory(cat)}
                style={{ padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5, border: `1px solid ${isActive ? col + '60' : 'rgba(255,255,255,0.08)'}`, background: isActive ? col + '18' : 'rgba(255,255,255,0.03)', color: isActive ? col : 'rgb(150,155,185)', transition: 'all 0.15s' }}>
                {meta && <span style={{ fontWeight: 800, fontSize: 9, padding: '1px 4px', borderRadius: 3, background: isActive ? col + '30' : 'rgba(255,255,255,0.07)', color: isActive ? col : 'rgb(120,127,160)' }}>{meta.code}</span>}
                {cat}
                <span style={{ fontWeight: 700, fontSize: 10 }}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Category description strip */}
        {activeCatMeta && (
          <div style={{ marginBottom: 12, padding: '9px 14px', borderRadius: 9, background: `${activeCatMeta.color}0c`, border: `1px solid ${activeCatMeta.color}25`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart2 size={12} style={{ color: activeCatMeta.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: activeCatMeta.color }}>{activeCatMeta.code}  -  {category}</span>
            <span style={{ fontSize: 11, color: 'rgb(140,147,180)' }}>  {activeCatMeta.description}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: activeCatMeta.color, fontWeight: 700 }}>{filtered.length} companies</span>
          </div>
        )}

        {/* == MAIN TABLE — horizontal scroll, full text, no truncation == */}
        <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ minWidth: 1860 }}>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '210px 150px 290px 310px 290px 210px 100px 72px 72px 64px 116px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '11px 20px', alignItems: 'center', gap: 0, position: 'sticky', top: 0, zIndex: 10 }}>
            {([
              { label: 'Company',        key: 'company' as SortKey },
              { label: 'Website',        key: null },
              { label: 'Description',    key: null },
              { label: 'Why Aeredium',   key: null },
              { label: 'Governance Gap', key: null },
              { label: 'Pain Points',    key: null },
              { label: 'Funding',        key: null },
              { label: 'Urgency',        key: 'urgencyScore' as SortKey },
              { label: 'Access',         key: 'accessibilityScore' as SortKey },
              { label: 'Total',          key: 'total' as SortKey },
              { label: 'Action',         key: null },
            ] as { label: string; key: SortKey | null }[]).map((col, i) => (
              <div key={i}
                style={{ fontSize: 10, fontWeight: 700, color: 'rgb(120,127,160)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 3, cursor: col.key ? 'pointer' : 'default', userSelect: 'none' }}
                onClick={() => col.key && toggleSort(col.key)}>
                {col.label}{col.key && <SortIcon k={col.key} />}
              </div>
            ))}
          </div>

          {/* Rows */}
          {sorted.map((t, idx) => {
            const total = totalScore(t)
            const isAdded = added.has(t.company)
            const catMeta = CATEGORY_META[t.category]
            const col = catMeta?.color ?? '#a78bfa'
            return (
              <div key={t.company + idx}
                style={{ display: 'grid', gridTemplateColumns: '210px 150px 290px 310px 290px 210px 100px 72px 72px 64px 116px', gap: 0, padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)', alignItems: 'start', transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = `${col}09`}
                onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)'}
              >
                {/* Company */}
                <div style={{ paddingRight: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: col + '22', color: col, flexShrink: 0 }}>{t.categoryCode}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'white', lineHeight: 1.3 }}>{t.company}</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: col, background: col + '12', border: `1px solid ${col}25`, padding: '2px 8px', borderRadius: 6, display: 'inline-block' }}>
                    {t.category}
                  </span>
                </div>

                {/* Website */}
                <div style={{ paddingRight: 12 }}>
                  <a href={t.website} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 11, color: '#38bdf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5, wordBreak: 'break-all' }}>
                    <ExternalLink size={10} style={{ flexShrink: 0 }} />
                    {t.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                  {t.linkedIn && (
                    <a href={t.linkedIn} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: '#818cf8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <ExternalLink size={10} /> LinkedIn
                    </a>
                  )}
                </div>

                {/* Description — full text */}
                <div style={{ paddingRight: 16 }}>
                  <p style={{ fontSize: 12, color: 'rgb(175,180,210)', lineHeight: 1.65, margin: 0 }}>
                    {t.description}
                  </p>
                </div>

                {/* Why AEREDIUM — full text */}
                <div style={{ paddingRight: 16 }}>
                  <p style={{ fontSize: 12, color: 'rgb(192,167,252)', lineHeight: 1.65, margin: 0 }}>
                    {t.whyAeredium}
                  </p>
                </div>

                {/* Governance Gap — full text */}
                <div style={{ paddingRight: 16 }}>
                  <p style={{ fontSize: 12, color: 'rgb(251,200,60)', lineHeight: 1.65, margin: 0 }}>
                    {t.governanceGap}
                  </p>
                </div>

                {/* Pain Points — full text */}
                <div style={{ paddingRight: 12 }}>
                  <p style={{ fontSize: 12, color: 'rgb(252,135,135)', lineHeight: 1.65, margin: 0 }}>
                    {t.painPoints}
                  </p>
                </div>

                {/* Funding */}
                <div style={{ paddingTop: 2 }}>
                  <span style={{ fontSize: 12, color: 'rgb(52,211,153)', fontWeight: 600 }}>{t.funding}</span>
                </div>

                {/* Urgency */}
                <div style={{ textAlign: 'center', paddingTop: 2 }}><ScorePill score={t.urgencyScore} /></div>

                {/* Accessibility */}
                <div style={{ textAlign: 'center', paddingTop: 2 }}><ScorePill score={t.accessibilityScore} /></div>

                {/* Total */}
                <div style={{ textAlign: 'center', paddingTop: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: total >= 22 ? '#34d399' : total >= 18 ? '#fbbf24' : '#f87171' }}>{total}</span>
                </div>

                {/* Add to BD */}
                <div style={{ paddingTop: 2 }}>
                  {isAdded && !enriching.has(t.company) ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#34d399' }}>
                      <CheckCircle size={12} /> Ready
                    </span>
                  ) : isAdded && enriching.has(t.company) ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#fbbf24' }}>
                      <Loader2 size={11} className="animate-spin" /> Enriching…
                    </span>
                  ) : (
                    <button onClick={() => addToPipeline(t)} disabled={adding === t.company}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${col}50`, background: col + '14', color: col, opacity: adding === t.company ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                      {adding === t.company ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                      Add to BD
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {sorted.length === 0 && (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: 'rgb(120,127,160)' }}>
              <CreditCard size={28} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>No companies match your filters</div>
            </div>
          )}

          </div>{/* end minWidth wrapper */}
        </div>{/* end overflow-x scroll container */}

        {/* == Category overview (shown only on All view) =========== */}
        {category === 'All' && !search && (
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgb(160,165,200)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <BarChart2 size={13} style={{ color: '#a78bfa' }} /> Category Breakdown
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {Object.entries(CATEGORY_META).map(([cat, meta]) => {
                const cats = ALL_TARGETS.filter(t => t.category === cat)
                const avg = Math.round(cats.reduce((s, t) => s + totalScore(t), 0) / cats.length)
                const top = cats.filter(t => totalScore(t) >= 22).length
                return (
                  <button key={cat} onClick={() => setCategory(cat)}
                    style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${meta.color}20`, background: `${meta.color}08`, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${meta.color}15`; e.currentTarget.style.borderColor = `${meta.color}40` }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${meta.color}08`; e.currentTarget.style.borderColor = `${meta.color}20` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: meta.color + '25', color: meta.color }}>{meta.code}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{cat}</span>
                    </div>
                    <p style={{ fontSize: 10, color: 'rgb(110,117,150)', marginBottom: 8, lineHeight: 1.4, margin: '0 0 8px' }}>{meta.description}</p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <span><span style={{ fontSize: 16, fontWeight: 800, color: meta.color }}>{cats.length}</span><span style={{ fontSize: 9, color: 'rgb(110,117,150)', marginLeft: 2 }}>cos</span></span>
                      <span><span style={{ fontSize: 16, fontWeight: 800, color: '#34d399' }}>{top}</span><span style={{ fontSize: 9, color: 'rgb(110,117,150)', marginLeft: 2 }}>top</span></span>
                      <span><span style={{ fontSize: 16, fontWeight: 800, color: '#fbbf24' }}>{avg}</span><span style={{ fontSize: 9, color: 'rgb(110,117,150)', marginLeft: 2 }}>/30</span></span>
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
