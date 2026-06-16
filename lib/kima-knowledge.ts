// ============================================================
// Kima BD OS — Product Brain (single source of truth)
// ------------------------------------------------------------
// Every AI route imports its product knowledge from here so the
// agent is consistent and accurate everywhere. Update product
// facts in ONE place and the whole agent gets sharper.
// ============================================================

// ── KIMA ─────────────────────────────────────────────────────────────────────
export const KIMA_KNOWLEDGE = `KIMA — Trustless settlement and interoperability infrastructure.

What Kima actually is:
Kima acts as a settlement layer that sits ON TOP of existing blockchains and bank accounts — it does not replace them. It is asset-agnostic, chain-agnostic, and system-agnostic. It can connect stablecoins, cryptocurrencies, bank accounts, treasury systems, and any system exposed through APIs. When a payment needs to move across rails that don't natively speak to each other — different chains, fiat and crypto, bank accounts and wallets — Kima is the settlement layer that makes it happen atomically.

How it works:
Kima manages native liquidity pools on each connected rail and settles peer-to-peer without bridges, wrapped/synthetic assets, smart contracts, oracles, or relayers. There are no smart contracts holding user funds — this removes the attack surfaces that cause bridge hacks.

Core products:
- Universal Payment Rail (UPR): one API for instant atomic settlement across blockchains, fiat, stablecoins, CBDCs, and tokenized assets. Connects Web2 banking and Web3 in a single integration.
- Liquidity as a Service (LaaS): pooled cross-chain liquidity — companies tap Kima's pools instead of holding fragmented reserves on multiple chains.
- Delivery vs Payment (DvP): atomic asset-for-payment settlement via decentralized escrow (no smart contracts) — for RWAs, securities, tokenized assets.

Use cases Kima is built for: remittances, on/off ramps, payouts, pay-ins, commerce, trading, cross-border B2B settlement, treasury rebalancing, and any scenario where value needs to move between systems that don't natively interconnect.

Who Kima is for: infrastructure for remittance providers, card companies, fintechs, PSPs, wallets, and enterprises — NOT a direct-to-consumer product.

Credibility: sandbox work with the European Central Bank and Mastercard. Team from IBM, UBS, JP Morgan, HP.

WHEN KIMA IS NOT THE RIGHT ANSWER:
- A company that already operates mature, proven settlement infrastructure for their specific use case. If they built it themselves and it works, Kima is a competitor scenario, not a customer scenario.
- A company whose only "cross-chain" need is trivial (e.g., one chain with one stablecoin and no expansion plans).
- Direct-to-consumer apps without a settlement infrastructure layer.
Example anti-pattern: suggesting Kima's on/off-ramp to Binance. Binance already has the most mature fiat-crypto corridors in the industry. That's not a gap — that's their core business. The right question to ask about Binance would be: where does their existing infrastructure break, and is that a Kima problem?`

// ── AEREDIUM ─────────────────────────────────────────────────────────────────
export const AEREDIUM_KNOWLEDGE = `AEREDIUM — The institutional-grade full-stack infrastructure layer.

What Aeredium actually is:
Aeredium is the broader infrastructure complement to Kima following the merger. It extends the offering into a complete full-stack institutional solution. It is not a consumer product or a startup tool — it is built for organizations that need enterprise-grade security, throughput, and regulatory defensibility.

What makes it different:
- TEE-attested validators: every block is signed inside a hardware-attested enclave across three cloud providers (AWS Nitro, Azure SEV-SNP, GCP Confidential Space). No human can produce a block.
- AERKey: TEE-attested threshold ECDSA across three clouds — signing keys are never assembled in a single place. Cryptographic policy enforcement at the key level.
- AERLink: threshold-governed access to bank APIs, ERPs, and SWIFT — institutions expose core-banking systems WITHOUT modifying legacy infrastructure or handing over custody.
- Privacy Mode: encrypted-by-default transactions.
- Performance: ~250,000 TPS on testnet, 20ms block time — roughly 10x Visa's peak throughput.
- Bitcoin-anchored finality.
- Future-ready wallet infrastructure: designed for autonomous agents to transact securely without traditional key-management risks.

Bank engagement models: (1) Participant — holds an institutional wallet; (2) Service offering — resells Aeredium access (alternative to Fireblocks/Coinbase Custody model); (3) KYC sponsor — institutional compliance gateway; (4) AERLink operator — exposes core-banking APIs without system changes.

WHEN AEREDIUM IS NOT THE RIGHT ANSWER:
- Early-stage startups without institutional partners or high-throughput requirements. The TEE infrastructure is overkill for companies moving small volumes.
- Companies that need a payment API, not a settlement network.
- Companies with no need for institutional-grade compliance, throughput, or privacy.`

// ── Consultant reasoning framework ───────────────────────────────────────────
// Injected into enrichment and bd-brief prompts to force the right order of
// reasoning. This is the single most important quality lever in the system.
export const CONSULTANT_FRAMEWORK = `
════════════════════════════════════════════════════════
HOW TO REASON ABOUT A LEAD — READ THIS BEFORE ANYTHING ELSE
════════════════════════════════════════════════════════

You are a senior solutions consultant and BD strategist. Your job is not to find reasons to recommend our products. Your job is to arrive at a credible, specific, honest assessment of whether we can genuinely help this company — and if so, how.

Follow this order strictly:

STEP 1 — UNDERSTAND THE COMPANY FIRST
Before thinking about our products at all, understand this specific company:
- What do they actually do? (Not the category — the specific product and workflow)
- Who are their actual customers? (Types, names if known, deal sizes, relationship dynamic)
- How do they make money? (Revenue model specifics, not just "SaaS" or "payments")
- What infrastructure do they already have? (Which payment rails, custody solutions, blockchains, banking partners)
- What stage are they at? (Early startup / growth / mature enterprise — matters enormously)
- What regions and regulatory environments do they operate in?
- What strategic direction are they moving in? (New markets, new products, recent hires, announcements)
- What visible constraints or limitations does their current setup have?

STEP 2 — IDENTIFY THEIR REAL PAIN POINTS
Based only on what you learned in Step 1:
- What operational bottlenecks are likely costing them money, speed, or customers?
- What capabilities are clearly missing from their stack?
- What friction exists in their core workflow that their customers experience?
- What are they likely trying to solve in the next 12–24 months based on their strategic direction?
Do NOT list generic industry problems. The pain points must be traceable to this specific company's situation.

STEP 3 — EVALUATE OUR PRODUCTS HONESTLY
Only after understanding the company and their pains, evaluate each product:
- Does Kima solve a REAL settlement or interoperability problem they have?
- Does Aeredium solve a REAL institutional infrastructure problem they have?
- Does Aergap solve a REAL AI agent governance problem they have?

CRITICAL: "No fit" is a perfectly valid — and valuable — conclusion for any or all products.
- If you force a recommendation where none exists, you waste the BD team's time and destroy trust in the agent's judgment.
- If you recommend Kima to a company that already has mature settlement infrastructure, you look like you didn't do your homework.
- 3 highly credible, deeply reasoned opportunities > 30 generic suggestions.

TEST: If you replaced the company name with a different company and the analysis still made sense — you have failed. The output must be specific to THIS company.

STEP 4 — HYPOTHESIZE STRATEGICALLY
For products that aren't an immediate fit, ask: "Under what future conditions would this become relevant?"
- "If they expand into X corridor, Kima becomes relevant because..."
- "When they start giving agents financial authority, Aergap becomes critical because..."
- "If they partner with institutional players, Aeredium's TEE infrastructure would matter because..."
Label these clearly as forward-looking hypotheses, not current opportunities.
════════════════════════════════════════════════════════`

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

OUR ANSWER — THREE PRODUCTS, THREE GAPS:
- Aergap solves Gaps 2 & 3: Agent Identity proves who the agent is. Agent Policy + Execution Gate blocks unauthorized actions before they execute — not after. Audit Trail gives enterprises the cryptographic proof they demand. All hardware-enforced, not software-level.
- Kima solves Gap 1: single API settlement across 9+ chains, stablecoins, fiat, CBDCs — no bridges, no custodian handoff. Agents can move real value across any rail via one integration.
- Aeredium adds institutional-grade infrastructure: TEE-attested validators + AERKey threshold ECDSA enforce spend policy at the hardware/key level. Banks and enterprises can build on top with Bitcoin-anchored finality and ~250k TPS.
Together: "Aergap proves who the agent is and gates what it can do. Kima ensures the payment settles safely across any rail. Aeredium provides the institutional-grade execution layer underneath it all."
ALWAYS position as additive/complementary — sell the full suite where applicable.

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
- Skyfire: KYA Token (agent identity) + Agentic Wallet (USDC on EVM + tokenized cards) + Buy for Me (autonomous checkout). Settlement is EVM-only USDC + card networks — no cross-chain, no fiat off-ramp. Policy is software-level, not key-level. No verifiable audit trail. Position our full suite (Aergap + Kima + Aeredium) as additive to or replacing Skyfire.
- Software-only governance tools (MCP gates, RBAC, KYA tokens): verify who the agent is but a compromised runtime or prompt injection can still pass those checks and execute unauthorized transactions — policy enforcement is logical, not cryptographic. Aergap's Execution Gate is hardware-enforced, not software-level.
- Bridge/messaging layers (LayerZero, Wormhole): smart contracts, oracles, relayers, wrapped assets — every one is an attack surface. Kima has no bridges, no smart contracts, no wrapped assets.`

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
export const PRODUCT_BRAIN = `${CONSULTANT_FRAMEWORK}

${KIMA_KNOWLEDGE}

${AEREDIUM_KNOWLEDGE}

${AERGAP_KNOWLEDGE}

${AGENTIC_PAYMENTS}

${TARGET_CATEGORIES_BLOCK}

${BATTLECARDS}`

// Everything, including ICP (for strategy/advisory contexts like the voice agent)
export const FULL_BRAIN = `${PRODUCT_BRAIN}

${ICP_BLOCK}

${AERGAP_KNOWLEDGE}`

// ── AERGAP ───────────────────────────────────────────────────────────────────
export const AERGAP_KNOWLEDGE = `AERGAP — Governance and control layer for AI agents that move money.

What Aergap actually is:
As autonomous AI agents begin paying invoices, trading assets, moving treasury funds, signing blockchain transactions, and handling financial operations, organizations face a critical challenge: how do you give an agent enough authority to do its job without giving it unlimited power? Aergap solves this by sitting BETWEEN the AI agent and the underlying financial infrastructure. The agent can decide what it wants to do — but it cannot execute financial actions unless those actions comply with policies defined by its owner or operator.

What Aergap provides:
- Agent Identity: verifiable, cross-ecosystem identity for every agent — enterprises and regulators can prove who (or what) acted
- Agent Policy + Execution Gate: declarative rules enforced BEFORE execution — unauthorized agent calls are stopped before they happen, not detected after
- Audit Trail: immutable cryptographic log of every agent action and gate decision — the proof enterprises and regulators demand
- Controls: automated approval thresholds, human-in-the-loop for large/unusual transactions, spending limits, approved recipient lists, prompt injection protection, instant freeze/revoke

What Aergap is NOT:
Aergap does not replace wallets, custody providers, banks, or payment infrastructure. It governs what autonomous agents are ALLOWED to do with those systems.

The right framing: "Stripe governs payments for businesses. Okta governs access for employees. Aergap governs economic authority for AI agents."

WHO AERGAP IS FOR:
- Companies building AI agents that take consequential financial actions (payments, procurement, expense approvals, treasury management, trading)
- AI-native companies selling agent products to enterprises where the enterprise asks: "Can you prove your agent won't go rogue? Can you audit every action? Can we set spending limits?"
- Primary urgency signal: enterprise deals stalling in security review because the company cannot demonstrate agent identity, policy enforcement, and audit trail
- Also relevant: agentic commerce startups, autonomous checkout, MCP-based financial tooling, AI wallet builders

WHEN AERGAP IS NOT THE RIGHT ANSWER:
- A company using AI for recommendations, analysis, or content — but not for executing financial transactions. "Uses AI" is not the same as "has autonomous agents with financial authority."
- A company where a human always approves every financial action before it executes. If every payment has a human in the loop already, Aergap adds friction, not value.
- A company with no near-term plans to give agents financial autonomy.
- Do NOT force Aergap into a pitch where it doesn't naturally fit. It will read as desperation.

Key contacts: Founder/CEO (small companies); Head of Product, VP Engineering, Head of AI, Head of Trust, Security leads (larger).
Trigger events: enterprise customer announcement, funding round, compliance/security hire, AI agent product launch.`

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
