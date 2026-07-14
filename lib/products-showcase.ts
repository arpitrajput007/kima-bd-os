// ============================================================
// Products Showcase — meeting-ready content
// ------------------------------------------------------------
// Presentation layer on top of the product brain in
// kima-knowledge.ts. Keep facts in sync with that file; this
// file only reshapes them into bullets for the /products page.
// ============================================================

export interface SubProduct {
  name: string
  description: string
  bestFit: string
}

export interface Competitor {
  name: string
  weakness: string
  ourEdge: string
}

export interface Product {
  slug: 'kima' | 'aeredium' | 'aerpolice'
  name: string
  tagline: string
  category: string
  accent: 'violet' | 'blue' | 'cyan'
  whatItIs: string[]
  subProducts: SubProduct[]
  marketFit: string[]
  gapFilled: string[]
  competitors: Competitor[]
  credibility?: string
}

export const COMPANY_ONE_LINER =
  'Kima Finance builds the trust and settlement infrastructure that lets money — fiat, stablecoins, crypto, and now AI agents — move safely across any rail, without bridges, custody handoffs, or blind trust in software.'

export const TOGETHER_LINE =
  'Aerpolice proves who the agent is and gates what it can do. Kima ensures the payment settles safely across any rail. Aeredium provides the institutional-grade execution layer underneath it all.'

export const PRODUCTS: Product[] = [
  {
    slug: 'kima',
    name: 'Kima',
    tagline: 'Trustless settlement and interoperability infrastructure',
    category: 'Cross-Chain & Cross-Rail Settlement',
    accent: 'violet',
    whatItIs: [
      'A settlement layer that sits on top of existing blockchains and bank accounts — it does not replace them',
      'Asset-agnostic, chain-agnostic, system-agnostic: connects stablecoins, crypto, bank accounts, treasury systems, and anything reachable via an API',
      'Manages native liquidity pools on each connected rail and settles peer-to-peer — no bridges, no wrapped/synthetic assets, no smart contracts, no oracles, no relayers',
      'No smart contracts ever hold user funds, which removes the exact attack surface that causes bridge hacks',
      'Built for infrastructure players — remittance providers, card companies, fintechs, PSPs, wallets, enterprises — not direct-to-consumer',
    ],
    subProducts: [
      {
        name: 'Universal Payment Rail (UPR)',
        description: 'One API for instant, atomic settlement across blockchains, fiat, stablecoins, CBDCs, and tokenized assets — connects Web2 banking and Web3 in a single integration.',
        bestFit: 'Cross-border fintechs, PSPs adding stablecoin settlement, wallets needing on/off-ramp, DEXs needing cross-chain deposits',
      },
      {
        name: 'Liquidity as a Service (LaaS)',
        description: 'On-demand pooled cross-chain liquidity — companies tap Kima’s pools instead of holding fragmented reserves on multiple chains.',
        bestFit: 'Protocols with liquidity fragmented across chains, market makers, lending protocols with collateral on different chains',
      },
      {
        name: 'Delivery vs Payment (DvP)',
        description: 'Atomic asset-for-payment settlement via decentralized escrow — no smart contracts holding funds.',
        bestFit: 'RWA platforms, tokenized securities, institutional OTC desks needing simultaneous asset + payment settlement',
      },
    ],
    marketFit: [
      'Cross-border payments today run on SWIFT / correspondent banking: slow (T+2/T+3), expensive FX and wire fees, opaque',
      'Crypto-native cross-chain movement runs on bridges, which have lost billions of dollars to smart contract, oracle, and relayer exploits',
      'Every fintech, PSP, wallet, and enterprise that needs to move value across two or more rails (chains, fiat, stablecoins) hits this same wall independently — no shared, neutral infrastructure exists to solve it once',
      'Validated in sandbox work with the European Central Bank and Mastercard',
    ],
    gapFilled: [
      'No single API today spans blockchains + fiat + stablecoins + CBDCs + tokenized assets atomically — companies otherwise integrate each rail one at a time, each with its own risk and custody model',
      'Existing cross-chain infrastructure (bridges) requires trusting smart contracts, oracles, and relayers — Kima removes all of them by settling natively, peer-to-peer',
      'Fills the gap between Web2 banking rails and Web3 rails, which today require entirely separate integrations, teams, and compliance stacks',
    ],
    competitors: [
      {
        name: 'Bridges & cross-chain messaging (LayerZero and similar)',
        weakness: 'Depend on smart contracts, off-chain message verification, oracles, relayers, and wrapped/synthetic assets — every one of those is an attack surface, and bridge hacks have cost the industry billions',
        ourEdge: 'Native peer-to-peer settlement with no smart contracts, no oracles, no relayers, and no wrapped assets to exploit',
      },
      {
        name: 'SWIFT / correspondent banking (status quo cross-border)',
        weakness: 'Slow (T+2/T+3 settlement), expensive FX and wire fees, opaque tracking',
        ourEdge: 'Instant, atomic settlement across fiat, stablecoin, and CBDC through one API, with compliance built in',
      },
    ],
    credibility: 'Team from IBM, UBS, JP Morgan, and HP.',
  },
  {
    slug: 'aeredium',
    name: 'Aeredium',
    tagline: 'The institutional-grade full-stack infrastructure layer',
    category: 'Institutional Settlement L1',
    accent: 'blue',
    whatItIs: [
      'The broader infrastructure complement to Kima following the merger — extends the offering into a complete, full-stack institutional solution',
      'Not a consumer product or a startup tool — built for organizations that need enterprise-grade security, throughput, and regulatory defensibility',
      'TEE-attested validators: every block is signed inside a hardware-attested enclave across three cloud providers (AWS Nitro, Azure SEV-SNP, GCP Confidential Space) — no human can produce a block',
      'Privacy Mode with encrypted-by-default transactions, and Bitcoin-anchored finality',
      'Performance: ~250,000 TPS on testnet at a 20ms block time — roughly 10x Visa’s peak throughput',
      'Future-ready wallet infrastructure designed for autonomous agents to transact securely without traditional key-management risk',
    ],
    subProducts: [
      {
        name: 'Aeredium Institutional L1',
        description: 'EVM-compatible L1 with TEE-attested validators across AWS Nitro, Azure SEV-SNP, and GCP Confidential Space. ~250k TPS, 20ms block time, Bitcoin-anchored finality, privacy mode.',
        bestFit: 'Banks, institutional asset managers, fintechs needing regulated high-throughput settlement, custodians wanting to offer their own settlement network',
      },
      {
        name: 'AERLink (Bank API Bridge)',
        description: 'Threshold-governed access to bank APIs, ERPs, and SWIFT — institutions expose core-banking systems without modifying legacy infrastructure or handing over custody.',
        bestFit: 'Fintechs needing bank-ledger connectivity, cross-border payment companies, neobanks building on correspondent banks',
      },
      {
        name: 'AERKey (TEE Threshold Signing)',
        description: 'TEE-attested threshold ECDSA across three cloud providers — signing keys are never assembled in a single place. Cryptographic policy enforcement at the key level.',
        bestFit: 'Custodians, MPC wallet providers, companies needing hardware-grade signing accountability and key governance',
      },
    ],
    marketFit: [
      'Banks and institutions need native settlement infrastructure without giving up custody — no neutral, high-throughput option like this exists today',
      'MPC custody platforms sit on top of existing chains and inherit bridge risk and custody-handoff exposure; institutions increasingly want infrastructure, not another wrapper',
      'Regulators are moving toward demanding cryptographic, hardware-enforced proof of transaction integrity — not just policy documents',
      'Four flexible bank engagement models: Participant (institutional wallet holder), Service offering (resells Aeredium access), KYC sponsor (compliance gateway), AERLink operator (exposes core-banking APIs)',
    ],
    gapFilled: [
      'No institutional-grade L1 offers TEE-attested validation across three independent cloud providers where no single human or party can produce a block',
      'Banks previously had to choose between building settlement infrastructure from scratch or handing custody to a third party — AERLink lets them expose core-banking systems via threshold-governed access without modifying legacy infrastructure or losing custody',
      'Closes the throughput/finality trade-off: slow, decentralized chains versus fast, centralized rails — Aeredium delivers ~250k TPS with Bitcoin-anchored finality',
    ],
    competitors: [
      {
        name: 'Fireblocks & Coinbase Custody-style custody platforms',
        weakness: 'An MPC custody/wallet layer that sits on top of existing chains — still inherits bridge risk, still requires a custody handoff, and throughput is limited by the underlying chain',
        ourEdge: 'Native institutional infrastructure on its own L1 — no bridge verifier sets to compromise, encrypted-by-default, Bitcoin-anchored finality, far higher throughput. Via AERLink, banks expose core systems without giving up custody, and can even resell Aeredium access as their own offering',
      },
    ],
  },
  {
    slug: 'aerpolice',
    name: 'Aerpolice',
    tagline: 'Governance and control layer for AI agents that move money',
    category: 'AI Agent Governance',
    accent: 'cyan',
    whatItIs: [
      'Sits between the AI agent and the underlying financial infrastructure',
      'The agent can decide what it wants to do — but it cannot execute a financial action unless that action complies with policies defined by its owner or operator',
      'Framing that lands in a room: "Stripe governs payments for businesses. Okta governs access for employees. Aerpolice governs economic authority for AI agents."',
      'Does not replace wallets, custody providers, banks, or payment infrastructure — it governs what autonomous agents are allowed to do with them',
    ],
    subProducts: [
      {
        name: 'Agent Identity',
        description: 'Verifiable, cross-ecosystem identity for every agent — enterprises and regulators can prove who (or what) acted.',
        bestFit: 'AI-native companies selling agents to enterprises; regulated environments where "which agent did what?" must be answerable',
      },
      {
        name: 'Agent Policy + Execution Gate',
        description: 'Declarative rules enforced before execution — unauthorized agent calls are stopped before they happen, not detected after, and enforcement is hardware-level, not software-level.',
        bestFit: 'Companies whose agents take consequential actions: payments, procurement, data access, treasury',
      },
      {
        name: 'Audit Trail',
        description: 'Immutable cryptographic log of every agent action and gate decision — the proof enterprises and regulators demand.',
        bestFit: 'Any AI-native company facing enterprise security review; regulated verticals such as finance, healthcare, legal',
      },
      {
        name: 'Controls',
        description: 'Automated approval thresholds, human-in-the-loop for large or unusual transactions, spending limits, approved-recipient lists, prompt-injection protection, instant freeze/revoke.',
        bestFit: 'Any company giving an agent real financial authority for the first time',
      },
    ],
    marketFit: [
      'AI agents are starting to pay invoices, trade assets, move treasury funds, and sign transactions — with no standard way to bound what they are allowed to do',
      'Confirmed, live buying signal: enterprise deals for AI-agent vendors are stalling in security review because the vendor cannot prove agent identity, policy enforcement, or provide an audit trail',
      'Every agentic-payments company independently hits the same three gaps: narrow settlement rails, software-only mandate enforcement, and no verifiable audit trail',
    ],
    gapFilled: [
      'Identity layers (KYA tokens, MCP gates, permission systems) verify who the agent is, but a compromised runtime or prompt injection can still pass those checks — policy enforcement in those systems is logical, not cryptographic. Aerpolice enforces at the hardware/key level, before execution',
      'No current agent-payment stack gives enterprises or regulators a cryptographic, immutable proof that a transaction was authorized, within policy, and untampered — Aerpolice’s Audit Trail closes that gap',
      'Most agent wallets settle only on card networks or USDC on EVM — the moment a flow goes cross-chain, non-EVM, agent-to-agent, or needs a fiat off-ramp, it breaks. (Solved jointly with Kima’s single-API settlement.)',
    ],
    competitors: [
      {
        name: 'Skyfire',
        weakness: 'KYA Token (identity) + Agentic Wallet (USDC on EVM + tokenized cards) + Buy for Me (autonomous checkout). Settlement is EVM-only USDC plus card networks — no cross-chain, no fiat off-ramp. Policy enforcement is software-level, not key-level. No verifiable audit trail.',
        ourEdge: 'The full suite — Aerpolice + Kima + Aeredium — offers a hardware-enforced policy gate, a cryptographic audit trail, and settlement across 9+ chains, fiat, and CBDCs, not just EVM/USDC',
      },
      {
        name: 'Software-only governance tools (MCP gates, RBAC, KYA tokens)',
        weakness: 'Verify identity, but policy enforcement is logical/software-level — a compromised agent runtime or prompt injection can still slip through',
        ourEdge: 'Aerpolice’s Execution Gate is hardware-enforced (TEE), not software-level — unauthorized actions are blocked before they execute, not detected after',
      },
    ],
  },
]
