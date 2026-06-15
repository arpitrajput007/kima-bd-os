// ============================================================
// Kima BD OS — Product Brain (single source of truth)
// ------------------------------------------------------------
// Every AI route imports its product knowledge from here so the
// agent is consistent and accurate everywhere. Update product
// facts in ONE place and the whole agent gets sharper.
// ============================================================

// ── KIMA (Kima Network / Kima Finance) ───────────────────────────────────────
export const KIMA_KNOWLEDGE = `KIMA — Universal settlement & cross-ecosystem money-transfer protocol.
Kima moves value across public blockchains, private/permissioned chains, and traditional bank accounts WITHOUT bridges, wrapped/synthetic assets, smart contracts, oracles, or relayers. Kima manages native liquidity pools on each chain and settles peer-to-peer — there are no smart contracts holding user funds, which removes the exact attack surfaces hackers exploit (smart-contract bugs, cross-chain messaging exploits, oracle/relayer compromise, wrapped-asset de-pegs).

Core products:
- Universal Payment Rail (UPR): ONE API for instant, atomic settlement across fiat, stablecoins, CBDCs, and tokenized assets, spanning 9+ chains and major fiat currencies. Connects Web2 banking and Web3 in a single integration.
- Liquidity as a Service (LaaS): tap pooled cross-chain liquidity without holding large reserves; built-in KYT/AML compliance.
- Delivery vs Payment (DvP): atomic asset-for-payment swaps via decentralized escrow (no smart contracts) — built for RWAs, securities, tokenized assets.

Security: MPC via TEE + TSS (threshold signatures), MPC vaults, quantum-resistant cryptography. Non-custodial and compliance-native (KYT/AML).

Primary use cases: cross-chain deposits/withdrawals, fiat-to-crypto on-ramp, crypto-to-fiat off-ramp, stablecoin payments, cross-border settlement (remittance/payroll/B2B), treasury rebalancing across chains, RWA delivery-versus-payment, in-app cross-chain wallets, DeFi lending collateral across chains.

Integration pitch: a single API integration — fast, instant, and hassle-free.

Credibility: partnerships/sandbox work with the European Central Bank and Mastercard (stablecoin card sandbox). Team from IBM, UBS, JP Morgan, HP.`

// ── AEREDIUM ─────────────────────────────────────────────────────────────────
export const AEREDIUM_KNOWLEDGE = `AEREDIUM — The trust layer for institutional settlement. An EVM-compatible Layer 1 built for banks and institutions.

What makes it structurally different:
- TEE-attested validators: every block is signed inside a hardware-attested enclave, spread across three cloud providers (AWS Nitro, Azure SEV-SNP, GCP Confidential Space). No human can produce a block — this removes validator/human compromise as an attack vector.
- AERKey: TEE-attested threshold ECDSA across the three clouds — signing keys are never assembled in any single place.
- AERLink: threshold-governed access to bank APIs, ERPs, and SWIFT, so institutions expose core-banking systems WITHOUT modifying legacy infrastructure or handing over custody.
- Bridgeless cross-chain settlement to EVM and non-EVM networks (Ethereum, Bitcoin, Solana, Polygon). Bitcoin-anchored finality. Encrypted-by-default transactions (Privacy Mode).

Performance: ~250,000 TPS end-to-end on testnet (mainnet target ~1M TPS), 50 blocks/sec, 20ms block time — roughly 10x Visa's peak throughput.

Bank engagement models: (1) Participant — bank holds an institutional wallet; (2) Service offering — bank resells Aeredium access (an alternative to the Fireblocks / Coinbase Custody model); (3) KYC sponsor — institutional compliance gateway; (4) AERLink operator — expose core-banking APIs without system changes.`

// ── Competitor battlecards ───────────────────────────────────────────────────
export const BATTLECARDS = `COMPETITIVE POSITIONING (use as ammo, never generic):

vs Bridges / LayerZero & cross-chain messaging:
Bridges and messaging layers depend on smart contracts, off-chain message verification, oracles, relayers, and wrapped/synthetic assets — every one of those is an attack surface, and bridge hacks have cost billions. Kima removes ALL of them: native settlement with no smart contracts, no oracles, no relayers, no wrapped assets. Best wedge for LayerZero ecosystem projects and recently-hacked protocols.

vs Fireblocks (and Coinbase Custody-style custody):
Fireblocks is an MPC custody/wallet layer that sits ON TOP of existing chains — you still inherit bridge risk, you still custody-handoff, throughput is limited. Aeredium is native institutional infrastructure (its own L1): no bridge verifier sets to compromise, encrypted-by-default, Bitcoin-anchored finality, far higher throughput, and via AERLink banks expose core systems WITHOUT giving up custody. Banks can even resell Aeredium access as their own offering.

vs status-quo cross-border (SWIFT / correspondent banking):
Slow (T+2/T+3), expensive FX and wire fees, opaque. Kima's UPR settles instantly and atomically across fiat/stablecoin/CBDC via one API, with compliance built in. Best wedge for cross-border fintechs, neobanks, exporters, and corridor businesses (UAE-India, EU-India, US-India).`

// ── Agentic payments (priority wedge) ────────────────────────────────────────
export const AGENTIC_PAYMENTS = `AGENTIC PAYMENTS (highest-priority wedge):

THE PROBLEM — THREE GAPS every agentic payment company hits:
1. Narrow settlement rails — most agent wallets settle on card networks or USDC on EVM only. The moment a flow goes cross-chain, non-EVM, agent-to-agent, or fiat off-ramp it breaks. No single API exists that spans all rails.
2. Software-level mandate enforcement — identity layers (e.g. KYA tokens, MCP gates, permission systems) can verify who the agent is but a compromised agent runtime or prompt injection can still pass those checks and execute unauthorized transactions. Policy enforcement is logical, not cryptographic — it can be bypassed.
3. No verifiable audit trail — there is no cryptographic proof that a transaction was authorized, within policy, and untampered. Enterprises and regulators demand this. No current agent payment stack provides it.

OUR ANSWER:
- Kima solves Gap 1: single API settlement across 9+ chains, stablecoins, fiat, CBDCs — no bridges, no custodian handoff. Agents can move real value across any rail via one integration.
- Aeredium solves Gaps 2 & 3: TEE-attested validators and AERKey threshold ECDSA enforce spend policy at the hardware/key level inside a hardware enclave — policy bypass becomes cryptographically impossible even if the agent runtime is compromised. Every block is TEE-attested across AWS Nitro, Azure SEV-SNP, and GCP Confidential Space, providing an immutable verifiable audit trail.
Together: "X proves who the agent is. Kima ensures the payment settles safely across any rail. Aeredium ensures execution is provably authorized and untamperable."
ALWAYS position as additive/complementary, not rip-and-replace.

ICP — WHO TO TARGET:
- AI-native product companies (seed to Series A) that sell agent products to enterprises where agents take real consequential actions: payments, data access, procurement, expense approvals.
- PRIMARY URGENCY SIGNAL: enterprise deals stalling in security review because they cannot demonstrate agent identity, policy enforcement, and audit trail. This is the live buying signal.
- Also target: agentic commerce / autonomous-checkout startups, MCP-based tooling, AI wallet builders, agent marketplaces, anyone building "let an AI agent pay / transact" features.

SOURCING POOLS (confirmed high-fit):
- YC W24/S24 AI agents category
- a16z portfolio: autonomous workflow, procurement, expense, customer-ops agents
- ProductHunt AI agent launches (last 6 months)
- LinkedIn Sales Navigator: CTO + "agentic" / "autonomous" at seed–Series A AI/fintech companies

CONTACTS: Founders/CEOs at small companies; Head of Product, VP Engineering, or Head of Trust at larger ones.
TRIGGER EVENTS to watch: enterprise customer announcement, funding round closed, compliance/security hire.

DISCOVERY QUESTION (most diagnostic): "When you sell to enterprise customers, what do they ask about your agents' permissions and audit trail?" — if enterprise customers are already asking this, there is a confirmed live buying signal.

RESONANCE SCENARIOS (reference these in outreach — buyers respond strongly):
1. Payment drain: agent pays for data hiding a malicious instruction; TEE execution gate holds and logs it before the transaction executes.
2. HFT gate: human approval fatigue on fast agents; policy gate catches the bad call that slipped through.

KEY COMPETITORS IN THIS SPACE:
- Aergap: governance-only sidecar (identity + policy + audit console). They explicitly defer "settlement and signing" — no settlement rails, no cryptographic execution guarantees, software-level policy only. Our wedge: Aeredium provides hardware-attested execution (TEE, not software policy) + AERKey cryptographic signing accountability. Kima provides settlement rails Aergap customers will eventually need and can't get from Aergap. Frame as "complete agent trust + settlement infrastructure" vs. "governance sidecar without rails."
- Skyfire: KYA Token (agent identity) + Agentic Wallet (USDC on EVM + tokenized cards) + Buy for Me (autonomous checkout). Settlement is EVM-only USDC + card networks — no cross-chain, no fiat off-ramp. Policy is software-level, not key-level. No verifiable audit trail. Position Kima + Aeredium as additive to Skyfire, not competitive.`

// ── Target customer categories ───────────────────────────────────────────────
export const TARGET_CATEGORIES_BLOCK = `TARGET CUSTOMER CATEGORIES:
1. Agentic Payments Customer — AI agents / agentic commerce that need a trust + settlement layer to move money safely
2. LayerZero Customer — projects using LayerZero or similar cross-chain messaging (bridge-risk wedge)
3. Hacked Protocol — projects hit by bridge / smart-contract / oracle / relayer exploits
4. Needs On/Off Ramp — companies needing fiat <-> crypto conversion
5. Fireblocks Customer — companies using Fireblocks or similar custody infra
6. Web2 Stablecoin Settlement Customer — traditional companies needing stablecoin settlement rails`

// ── Ideal customer profile ───────────────────────────────────────────────────
export const ICP_BLOCK = `IDEAL CUSTOMER PROFILES (ICP):
- AI agent / agentic-commerce builders needing safe autonomous payments — specifically seed–Series A AI-native product companies selling agent products to enterprises where agents take consequential actions (payments, procurement, data access); primary urgency = enterprise deals stalling in security review
- PSPs and payment gateways needing stablecoin settlement
- Cross-border fintechs (remittance, payroll, B2B payments), corridor businesses (UAE-India, EU-India, US-India)
- DEXs / wallets needing cross-chain settlement or on/off-ramp
- Recently-hacked protocols (bridge/oracle/relayer exploits) and LayerZero-ecosystem projects
- RWA platforms needing delivery-versus-payment settlement
- iGaming / payment-heavy platforms with high cross-border volume
- Banks & institutions needing native settlement infra (Aeredium) without custody handoff
- Web2 companies with SWIFT/wire friction (exporters, neobanks)`

// ── The mandatory outreach line ──────────────────────────────────────────────
export const SINGLE_API_LINE =
  'All of this is possible with a single API integration, which is completely free, instant, and hassle-free.'

// ── Composed blocks for prompts ──────────────────────────────────────────────

// Compact product context (use in token-tight calls like company extraction)
export const PRODUCT_BRAIN_COMPACT = `${KIMA_KNOWLEDGE}

${AEREDIUM_KNOWLEDGE}`

// Full product brain (research, scoring, outreach, chat, learn)
export const PRODUCT_BRAIN = `${KIMA_KNOWLEDGE}

${AEREDIUM_KNOWLEDGE}

${AGENTIC_PAYMENTS}

${TARGET_CATEGORIES_BLOCK}

${BATTLECARDS}`

// Everything, including ICP (for strategy/advisory contexts like the voice agent)
export const FULL_BRAIN = `${PRODUCT_BRAIN}

${ICP_BLOCK}`

// ── Aergap (third product we qualify leads for) ──────────────────────────────
export const AERGAP_KNOWLEDGE = `AERGAP — Trust & governance layer for AI agents that take high-stakes actions.
Aergap sits underneath AI agents and determines what they are allowed to do before they act.

Core products / capabilities:
- Agent Identity: verifiable, cross-ecosystem readable identity for every agent — enterprises and regulators can prove who (or what) acted
- Agent Policy: declarative rules governing exactly what each agent is permitted to do, enforced before execution
- Execution Gate: pre-action blocking (NOT post-hoc detection) — unauthorized calls are stopped before they happen, not logged after
- Audit Trail: immutable, unified cryptographic log of every agent action and gate decision — satisfies enterprise & regulatory audit requirements

Primary wedge: AI agents that can move money or perform irreversible actions.
Core message: "When an AI agent can move money, one wrong call cannot be undone. Aergap is the gate that determines what the agent is allowed to do before it acts."

ICP: AI-native product companies (seed–Series A) that sell agent products to enterprises where agents take real consequential actions — payments, data access, procurement, expense approvals.
Primary urgency signal: enterprise deals stalling in security review because the company cannot demonstrate agent identity, policy enforcement, and audit trail.
Key contacts: Founder/CEO (small companies); Head of Product, VP Engineering, Head of AI, Head of Trust, Security leads (larger).
Trigger events: enterprise customer announcement, funding round, compliance/security hire, AI product launch.`

// ── Full product catalog (used in qualify-lead to evaluate all products) ──────
export const PRODUCTS_CATALOG = `COMPLETE PRODUCT CATALOG — evaluate every lead against ALL of these:

━━ KIMA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Kima UPR (Universal Payment Rail)
   One API for instant atomic settlement across blockchains, fiat, stablecoins, CBDCs — no bridges, no wrapped assets, no smart contract risk. 9+ chains + major fiat corridors.
   Best fit: companies needing cross-chain or cross-rail value movement; cross-border fintechs; PSPs adding stablecoin settlement; wallets needing on/off-ramp; DEXs needing cross-chain deposits.

2. Kima LaaS (Liquidity as a Service)
   On-demand pooled cross-chain liquidity — companies tap Kima's pools instead of holding large fragmented reserves on multiple chains.
   Best fit: protocols with liquidity fragmented across chains; market makers; lending protocols with collateral on different chains.

3. Kima DvP (Delivery vs Payment)
   Atomic asset-for-payment settlement via decentralized escrow — no smart contracts holding funds.
   Best fit: RWA platforms, tokenized securities, institutional OTC desks needing simultaneous asset + payment settlement.

━━ AEREDIUM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. Aeredium Institutional L1
   EVM-compatible L1 with TEE-attested validators across AWS Nitro / Azure SEV-SNP / GCP Confidential Space. ~250k TPS, 20ms block time, Bitcoin-anchored finality, privacy mode.
   Best fit: banks; institutional asset managers; fintechs needing regulated high-throughput settlement; custodians wanting to offer their own settlement network.

5. Aeredium AERLink (Bank API Bridge)
   Threshold-governed access to bank APIs, ERPs, and SWIFT — institutions expose core-banking systems WITHOUT modifying legacy infrastructure or handing over custody.
   Best fit: fintechs that need to connect to bank ledgers; cross-border payment companies needing bank connectivity; neobanks building on top of correspondent banks.

6. Aeredium AERKey (TEE Threshold Signing)
   TEE-attested threshold ECDSA across three cloud providers — signing keys are never assembled in any single place. Cryptographic policy enforcement at key level.
   Best fit: custodians; MPC wallet providers; companies needing hardware-grade signing accountability and key governance.

━━ AERGAP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. Aergap Agent Identity
   Verifiable, cross-ecosystem readable identity for every AI agent — proves who acted for enterprise and regulatory compliance.
   Best fit: AI-native companies selling agents to enterprises; companies where regulators ask "which agent did what?"; MCP-based tooling where agent identity matters.

8. Aergap Agent Policy + Execution Gate
   Declarative spend/action policies enforced at the gate before execution — stops unauthorized agent calls before they happen, not after.
   Best fit: companies whose AI agents take consequential actions (payments, procurement, data access); companies with enterprise customers demanding policy enforcement proof; AI wallet builders; agentic commerce startups.

9. Aergap Audit Trail
   Immutable cryptographic log of every agent action and gate decision — satisfies enterprise security review and regulatory audit requirements.
   Best fit: any AI-native company facing enterprise security review; companies where agents make financial or compliance-sensitive decisions; highly regulated verticals (finance, healthcare, legal).`
