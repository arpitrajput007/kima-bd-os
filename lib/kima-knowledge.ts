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
export const AGENTIC_PAYMENTS = `AGENTIC PAYMENTS (high-priority wedge):
AI agents cannot be trusted with money today. Tool/permission gates (e.g. MCP gates) can be bypassed, prompt injection can drain funds, and there is no execution accountability — no way to prove an agent's transaction was authorized and untampered. This blocks autonomous AI commerce.

Our answer: Aeredium provides the security/trust layer for agent money movement — TEE-attested execution where no human OR agent can forge or tamper with a block, threshold-governed access to funds/APIs, and verifiable execution accountability. Kima provides the safe settlement rails so agents can move real value across chains and fiat via a single API without touching bridges or custodians. Together we make AI agents reliable enough to hold and move real money.

Target signals: AI agent frameworks, agentic commerce / autonomous-checkout startups, MCP-based tooling, AI wallets, agent marketplaces, anyone building "let an AI agent pay / transact" features.`

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
- AI agent / agentic-commerce builders needing safe autonomous payments
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
