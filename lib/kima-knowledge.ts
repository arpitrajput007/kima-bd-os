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

// ── AERKEY (standalone deep-dive — do not treat as a minor Aeredium bullet) ──
export const AERKEY_KNOWLEDGE = `AERKEY — TEE-attested threshold ECDSA signing. Cryptographic key governance, not just custody.

What AERKey actually is:
AERKey is Aeredium's threshold-signing product: private keys are split via threshold ECDSA and every signing operation runs inside hardware-attested TEEs (Trusted Execution Environments) across three independent cloud providers (AWS Nitro, Azure SEV-SNP, GCP Confidential Space). A signing key is never assembled, never reconstructed in one place, and never held by a single human, server, or cloud vendor. Policy — who can sign, how much, under what conditions — is enforced cryptographically at the key level, not as a software rule that a compromised process can route around.

How it's different from standard MPC custody (Fireblocks, Coinbase Custody, Copper, Fordefi, etc.):
- Those platforms shard key material across parties (MPC) but the signing computation itself typically runs in ordinary server processes — trust the operator's software and infra security.
- AERKey performs the signing operation itself inside hardware-attested enclaves spread across three different cloud providers, so no single cloud, insider, or compromised host can produce a valid signature alone.
- This is "key governance" (cryptographically enforced policy on WHO/HOW MUCH can be signed) layered on top of threshold custody — not just "where the key shards live."

WHO AERKEY IS FOR:
- Custodians and MPC/custody wallet providers who want a stronger signing guarantee than software-only MPC, or who want to white-label/resell a harder security story to institutional clients.
- Exchanges, prime brokers, and OTC desks that need hardware-grade accountability for hot/warm wallet signing at scale.
- Banks and institutions issuing their own wallets or tokenized asset custody (an Aeredium "Participant" or "Service offering" engagement model) that need provable, auditable signing policy — not just an internal spreadsheet of approvers.
- Treasury and payment platforms (including AI-agent treasury/payroll tools) that need spend-limit or multi-party-approval enforcement built into the signature itself, so a compromised app layer cannot force an unauthorized transfer.
- Any company currently doing multisig-via-hardware-wallets-and-spreadsheets that has outgrown that process as transaction volume or headcount grows.

Key buying trigger: a security incident, insurance/compliance audit, or institutional client due-diligence questionnaire that asks "where do your keys live, who can sign, and can you prove it" — and the honest answer today involves a single MPC vendor, a single cloud, or manual multisig coordination.

WHEN AERKEY IS NOT THE RIGHT ANSWER:
- Early-stage teams with a single small hot wallet and no institutional counterparties — a standard multisig (Safe, etc.) is sufficient and AERKey is overkill.
- Companies that only need custody (holding keys safely) and have no signing-policy or governance requirement — a plain custodian may suffice.
- Companies with no near-term plans to handle institutional volume, funds, or regulated assets.

Key contacts: Head of Security / CISO, Head of Custody or Treasury, VP Engineering, Founder/CTO (smaller companies), Compliance/Risk lead (institutions).
Trigger events: security incident or near-miss, new institutional client requiring custody proof, compliance/security hire, expansion into custody/treasury products, funding round earmarked for infrastructure hardening.`

// ── Consultant reasoning framework ───────────────────────────────────────────
// Injected into enrichment and bd-brief prompts to force the right order of
// reasoning. This is the single most important quality lever in the system.
//
// SCOPE: this agent finds leads for TWO products only — Aerpolice and AER360.
// Kima and Aeredium's general Institutional L1 are out of scope for lead
// generation/qualification/outreach (KIMA_KNOWLEDGE and AEREDIUM_KNOWLEDGE
// below are kept as raw exports only for the Reaction Studio content tool,
// which still comments on Kima Finance's full product line — they are
// deliberately NOT composed into PRODUCT_BRAIN/FULL_BRAIN/PRODUCTS_CATALOG).
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
- What infrastructure do they already have? (Which wallets, custody/signing solutions, agent frameworks, harnesses)
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
- Does Aerpolice solve a REAL AI-agent governance problem they have — do they have agents taking consequential financial or system actions with no identity/policy/audit layer?
- Does AER360 solve a REAL custody / key-signing / agent-spend-control problem they have — is their key management, wallet security, or per-agent spend policy weaker than what a hardware-enforced threshold-signing platform would give them?

CRITICAL: "No fit" is a perfectly valid — and valuable — conclusion for either or both products. If neither product solves a real problem this company has, say so plainly. Do NOT force a fit into Kima, Aeredium's Institutional L1, cross-chain settlement, or anything outside Aerpolice/AER360 — those products are not part of this agent's mandate, regardless of how good a "fit" the company might otherwise be for them.
- If you force a recommendation where none exists, you waste the BD team's time and destroy trust in the agent's judgment.
- 3 highly credible, deeply reasoned opportunities > 30 generic suggestions.

TEST: If you replaced the company name with a different company and the analysis still made sense — you have failed. The output must be specific to THIS company.

STEP 4 — HYPOTHESIZE STRATEGICALLY
For a product that isn't an immediate fit, ask: "Under what future conditions would this become relevant?"
- "When they start giving agents financial authority, Aerpolice becomes critical because..."
- "If they start handling institutional volume or funds, AER360's hardware-enforced signing would matter because..."
Label these clearly as forward-looking hypotheses, not current opportunities.
════════════════════════════════════════════════════════`

// ── Competitor battlecards ───────────────────────────────────────────────────
export const BATTLECARDS = `COMPETITIVE POSITIONING (use as ammo, never generic):

vs Fireblocks / Coinbase Custody-style MPC custody:
Those platforms shard key material across parties (MPC), but the signing computation itself typically runs in ordinary server processes — you're trusting the operator's software and infra security, not hardware. AER360's AERKey performs the signing operation itself inside three independent hardware-attested enclaves, so no single cloud, insider, or compromised host can produce a valid signature alone — and the Policy Engine enforces spend rules at the hardware level that signs, not a software layer sitting in front of the vault.

vs plain multisig (Gnosis Safe, hardware wallets + spreadsheets):
Multisig proves M-of-N humans signed, but enforces nothing about who can propose what, to whom, or how often, and gives an AI agent no native way to hold its own bounded wallet. AER360 gives every human or agent signer its own identity, a cryptographically enforced policy (limits, quorums, allowlists, per-transaction biometric confirmation), and a tamper-evident audit chain — not a spreadsheet of who's allowed to approve what.

vs Skyfire / software-only agent governance (KYA tokens, MCP gates, RBAC):
These verify who an agent is, but enforcement is logical/software-level — a compromised agent runtime or a prompt injection can still pass the check and execute an unauthorized action. Aerpolice's Triple Gate evaluates identity + intent + limits before an action executes, not after, and a denied Pact never reaches the world. Skyfire's own settlement is EVM-only USDC plus card networks with no verifiable audit trail. Aerpolice pairs with AER360 to add hardware-enforced signing underneath — the decision layer and the vault the money actually lives in are both bound by cryptographic policy, not app-layer trust.`

// ── Agentic payments (priority wedge) ────────────────────────────────────────
export const AGENTIC_PAYMENTS = `AGENTIC PAYMENTS (highest-priority wedge):

THE PROBLEM — TWO GAPS every agentic payment / AI-agent company hits once agents start touching real money:
1. Software-level mandate enforcement — identity layers (e.g. KYA tokens, MCP gates, permission systems) can verify who the agent is, but a compromised agent runtime or prompt injection can still pass those checks and execute an unauthorized transaction. Policy enforcement is logical, not cryptographic — it can be bypassed.
2. No verifiable audit trail, and no hardware guarantee under the decision — even where a gate exists, there is often no cryptographic proof a transaction was authorized, within policy, and untampered, AND the wallet the agent actually signs from is still a normal hot wallet or software-MPC key that a determined attacker (or a bypassed gate) can move.

OUR ANSWER — TWO PRODUCTS, ONE STORY:
- Aerpolice governs the DECISION: Agent Identity proves who the agent is. The Triple Gate blocks an unauthorized action before it executes — not after. The Audit Trail gives the cryptographic, signed proof enterprises and regulators demand.
- AER360 governs the EXECUTION: even if a decision layer were somehow bypassed, the agent's own child wallet is bound to one of twelve hardware-enforced policy templates — the signing enclaves refuse to produce a signature outside policy, no matter what instructed them to.
Together: "Aerpolice decides whether an agent's action is allowed to happen. AER360 is the vault the agent's money actually lives in, and it physically cannot sign outside the policy you set." Position as additive — sell either alone, or both together for the strongest story.

ICP — WHO TO TARGET:
- AI-native product companies (seed to Series A) that sell agent products to enterprises where agents take real consequential actions: payments, data access, procurement, expense approvals.
- PRIMARY URGENCY SIGNAL: enterprise deals stalling in security review because they cannot demonstrate agent identity, policy enforcement, and audit trail. This is the live buying signal.
- Also target: agentic commerce / autonomous-checkout startups, MCP-based tooling, AI wallet builders, agent marketplaces, anyone building "let an AI agent pay / transact" features.
- Also target (AER360 angle): custodians, MPC wallet providers, exchanges, treasuries, and funds relying on software-only key management or ad hoc multisig who are about to hand an agent real spending authority.

SOURCING POOLS (confirmed high-fit):
- YC W24/S24 AI agents category
- a16z portfolio: autonomous workflow, procurement, expense, customer-ops agents
- ProductHunt AI agent launches (last 6 months)
- LinkedIn Sales Navigator: CTO + "agentic" / "autonomous" at seed–Series A AI/fintech companies
- MCP server/tool directories and marketplaces (glama, Pulse MCP, etc.) — anyone shipping an MCP-connected agent that touches money or systems of record
- Digital-asset custody / key-management company lists — candidates for AER360 directly, independent of any agent angle

CONTACTS: Founders/CEOs at small companies; Head of Product, VP Engineering, Head of Trust, Head of Security/CISO, Head of Custody or Treasury at larger ones.
TRIGGER EVENTS to watch: enterprise customer announcement, funding round closed, compliance/security hire, a security incident or near-miss, an AI agent product launch, a decision to give an agent real spending authority for the first time.

DISCOVERY QUESTION (most diagnostic): "When you sell to enterprise customers, what do they ask about your agents' permissions and audit trail?" — if enterprise customers are already asking this, there is a confirmed live buying signal.

RESONANCE SCENARIOS (reference these in outreach — buyers respond strongly):
1. Payment drain: agent pays for data hiding a malicious instruction; the Triple Gate holds and logs it before the transaction executes.
2. HFT gate: human approval fatigue on fast agents; the Policy Gate catches the bad call that slipped through.
3. Insider/key theft: a founder or employee walks away with (or is coerced into using) a wallet's key; with AER360 there is no assembled key to walk away with.

KEY COMPETITORS IN THIS SPACE:
- Skyfire: KYA Token (agent identity) + Agentic Wallet (USDC on EVM + tokenized cards) + Buy for Me (autonomous checkout). Settlement is EVM-only USDC + card networks. Policy is software-level, not key-level. No verifiable audit trail. Position Aerpolice + AER360 as additive to or replacing Skyfire.
- Software-only governance tools (MCP gates, RBAC, KYA tokens): verify who the agent is but a compromised runtime or prompt injection can still pass those checks and execute unauthorized transactions — policy enforcement is logical, not cryptographic. Aerpolice's Triple Gate is hardware-enforced, not software-level.
- Fireblocks / Coinbase Custody-style MPC custody: signing computation runs in ordinary server processes, not hardware-attested enclaves — see battlecard above.`

// ── Target customer categories ───────────────────────────────────────────────
export const TARGET_CATEGORIES_BLOCK = `TARGET CUSTOMER CATEGORIES:
1. Agentic Payments / AI-Agent Customer — AI agents or agentic-commerce products that take financial or system actions and need both a decision-layer gate (Aerpolice) and a hardware-governed wallet (AER360) to move money safely
2. Aerpolice Governance Customer — company building/operating AI agents with financial or system authority and no identity/policy/audit layer yet
3. AER360 Custody / Key-Governance Customer — custodians, MPC wallet providers, exchanges, treasuries, or funds relying on software-only key management or ad hoc multisig`

// ── Ideal customer profile ───────────────────────────────────────────────────
export const ICP_BLOCK = `IDEAL CUSTOMER PROFILES (ICP):
- AI agent / agentic-commerce builders needing safe autonomous payments — specifically seed–Series A AI-native product companies selling agent products to enterprises where agents take consequential actions (payments, procurement, data access); primary urgency = enterprise deals stalling in security review
- MCP-based tooling, AI wallet builders, agent marketplaces, autonomous-checkout startups
- Custodians and MPC wallet providers (Fireblocks-style) wanting a stronger signing guarantee, or a white-label story for institutional clients, than software-only MPC gives them
- Exchanges, prime brokers, OTC desks, and treasuries handling institutional volume on software-only or ad hoc multisig key management
- Companies about to give an AI agent real financial authority for the first time (treasury, payroll, procurement agents) with no per-agent policy/spend-limit framework in place`

// ── AERPOLICE ───────────────────────────────────────────────────────────────────
export const AERPOLICE_KNOWLEDGE = `AERPOLICE — "The agentic trust fabric." Binds every AI agent to a cryptographic identity, governs what it's allowed to do with policy you set, and proves every action with a signed audit trail.

The core problem it answers:
Agents now act on your behalf: they move money, reach into systems of record, and make calls no one reviews. They authenticate as you, hold your tokens, and call tools at machine speed. A single confused-deputy prompt injection or a self-approved action can move real money or leak a system of record — and by the time anyone notices, it's already done. Capability raced ahead of control.

The mechanic — BIND, GOVERN, PROVE:
- BIND (Identity): every agent is bound to its own cryptographic identity, backed by AERKey signing. No anonymous actors, no shared tokens, no agent acting as a deputy on credentials it was never granted. Roles and scopes are resolved per agent, never a blanket token, and owner authority is kept isolated — out of the agent's reach. Every request the agent makes is signed and attributable to it alone.
- GOVERN (Policy — the "Triple Gate"): every proposed action becomes a "Pact" that must clear three gates before it runs — (1) identity bound, (2) intent within an allowlist, (3) within configured limits. Each Pact resolves to one explicit outcome: accept, deny, or requires_owner_approval. Policy is checked at decision time, so a denied action never reaches the world. This is what catches confused-deputy and prompt-injection attempts — even an agent that's been tricked into proposing a bad action gets stopped at the gate, not after the fact.
- Human escalation: when a Pact crosses a threshold or touches a sensitive system, it pauses for an out-of-band owner approval. The agent can propose an action; it can never approve its own.
- Kill switch: a four-level hierarchy — agent, role, tenant, global. Any level can be halted in one move, manually or automatically on an anomaly (e.g. a rate spike), and in-flight Pacts stop before they settle.
- PROVE (Audit): every decision, approval, and transaction is a signed, human-readable record. Full session replay, step by step. Tamper-evident, tied to the agent's own key, exportable for compliance — not a log an administrator could quietly edit.

Integration: exposed as MCP tools, so it plugs into the agents and harnesses teams already run — MCP servers, Claude agents, autonomous wallets, robotics fleets, systems of record, custom harnesses — without requiring them to change how the agent itself works.

Self-serve qualification hook: Aerpolice offers a public "Agent Containment Index" — a 12-question, in-browser quiz that scores how far a breach would get through a company's current agent stack. Useful as a diagnostic to reference in outreach or point a prospect to directly.

What Aerpolice is NOT:
Aerpolice does not replace wallets, custody providers, banks, or payment infrastructure. It governs what autonomous agents are ALLOWED to do with those systems. (AER360 is the product that actually holds and signs from the wallet underneath — see below.)

The right framing: "Stripe governs payments for businesses. Okta governs access for employees. Aerpolice governs economic authority for AI agents."

WHO AERPOLICE IS FOR:
- Companies building AI agents that take consequential financial or system actions (payments, procurement, expense approvals, treasury management, trading, data access)
- AI-native companies selling agent products to enterprises where the enterprise asks: "Can you prove your agent won't go rogue? Can you audit every action? Can we set spending limits?"
- Primary urgency signal: enterprise deals stalling in security review because the company cannot demonstrate agent identity, policy enforcement, and audit trail
- Also relevant: agentic commerce startups, autonomous checkout, MCP-based financial tooling, AI wallet builders, robotics fleets making real-world commitments

WHEN AERPOLICE IS NOT THE RIGHT ANSWER:
- A company using AI for recommendations, analysis, or content — but not for executing financial or system-changing transactions. "Uses AI" is not the same as "has autonomous agents with financial authority."
- A company where a human always approves every financial action before it executes. If every payment has a human in the loop already, Aerpolice adds friction, not value.
- A company with no near-term plans to give agents financial or system autonomy.
- Do NOT force Aerpolice into a pitch where it doesn't naturally fit. It will read as desperation.

Key contacts: Founder/CEO (small companies); Head of Product, VP Engineering, Head of AI, Head of Trust, Security leads (larger).
Trigger events: enterprise customer announcement, funding round, compliance/security hire, AI agent product launch.`

// ── AER360 ────────────────────────────────────────────────────────────────────
export const AER360_KNOWLEDGE = `AER360 — "Key, Policy, Wallet & AI Agents. One Platform." A unified custody and governed-automation platform built on four pillars: AERKey, the AERKey Wallet, the Policy Engine, and the Agent Control Center. Core idea: "nothing signs unchecked, and everything is on the record."

The core problem it answers:
Every custody disaster — the exchange that lost a billion dollars, the founder who walked away with the keys — comes down to the same flaw: somewhere, a complete private key existed, and someone got to it. Separately, as AI agents start moving money, an ungoverned agent with a shared hot wallet is the same flaw wearing a different face — nothing stops it from moving more than it should.

The four pillars:
1. AERKey (the key): threshold cryptography running CGGMP24, the most advanced published threshold-signing protocol, the latest in the protocol family trusted by large institutional custodians. Three independent machines each hold a fragment of the signing key inside a sealed hardware enclave that not even AEREDIUM's own engineers can open. The enclaves compute a valid, ordinary signature together — but the full key is never assembled anywhere, not even for a millisecond. If a party misbehaves during signing, the protocol identifies the culprit rather than failing silently. There is nothing to steal, nothing to leak, no insider who can walk out the door with the funds.
2. Policy Engine: every transaction is tested before it's signed. Enforces per-transaction limits, approval quorums (e.g. one signer approved up to $5,000, a $6,000 transfer needs a second approval), destination allowlists, verified identity, and a biometric confirmation bound to the exact transaction — not a session or login. The enclaves refuse to sign without cryptographic proof the policy engine approved this specific transaction: enforcement lives in the same hardware that signs, not a web server sitting in front of the vault.
3. AERKey Wallet: a custodial wallet with nothing to custody in the old sense — no seed phrase to write down, lose, or get phished, because there is no assembled key to back up. Accounts live on the threshold cluster itself; the owner approves each transaction with biometrics bound to that exact transaction.
4. Agent Control Center: lets an owner create child wallets for AI agents — one agent, one wallet, one policy, no sharing, no ambiguity about who did what. Each agent's wallet is bound to one of twelve predefined agent policy templates, so an agent operates inside limits (how much, how often, to whom) chosen before it ever moved a cent, enforced by the same hardware that enforces the limits of a human signer.

Audit: every event — request, approval, refusal, signature — is written to a tamper-evident audit chain sealed by the threshold cluster itself, not an administrator-editable log. Verifiable years later.

WHO AER360 IS FOR:
- Institutional custodians and treasury operators who need high-security asset management with governed automation
- Exchanges, prime brokers, OTC desks, and funds that need hardware-grade signing accountability at scale, beyond what software-only MPC gives them
- Custodians and MPC wallet providers (Fireblocks, Coinbase Custody, Copper, Fordefi-style) who want a stronger signing guarantee than software-only MPC, or who want to white-label a harder security story to institutional clients
- Companies about to give an AI agent real financial authority for the first time and need per-agent wallets with an enforced spend policy — not a shared hot wallet and a spreadsheet of who's allowed to do what
- Teams that outgrew "multisig via hardware wallets + a spreadsheet" as transaction volume or headcount grew

Buying triggers: a security incident or near-miss (insider theft, key compromise, a phished signer), an institutional client's due-diligence questionnaire asking "where do your keys live, who can sign, and can you prove it," the decision to let an AI agent move real money for the first time, or growth past the point where manual multisig coordination scales.

WHEN AER360 IS NOT THE RIGHT ANSWER:
- A team with one small hot wallet, no institutional counterparties, and no near-term plans to give an agent financial authority — a standard multisig (Safe, etc.) is enough and AER360 is overkill.
- A company that only needs basic custody with no signing-policy or governance requirement.
- No funds or agents actually moving meaningful money yet (pre-revenue / idea stage).

Key contacts: Head of Security/CISO, Head of Custody or Treasury, VP Engineering, Founder/CTO (smaller companies), Compliance/Risk lead (institutions).
Trigger events: security incident or near-miss, new institutional client requiring custody proof, compliance/security hire, expansion into custody/treasury products, funding round earmarked for infrastructure hardening, first AI agent given spending authority.`

// ── Per-lead product focus (deterministic routing) ───────────────────────────
// Decides which product LEADS the pitch for a given lead: an AI-agent company
// should get an Aerpolice-first pitch, a custody/key-management company should
// get an AER360-first pitch, and a company that's genuinely both gets a joint
// pitch. Deterministic — does NOT depend on the learn/approval rule loop
// (which only applies after manual approval).

export type ProductFocus = 'aerpolice' | 'aer360' | 'both'

export interface LeadFocusInput {
  company_name?: string | null
  description?: string | null
  product_summary?: string | null
  business_model?: string | null
  industry_category?: string | null
  customer_category?: string[] | string | null
  product_to_sell?: string | null
  aerpolice_fit?: string | null
  aeredium_fit?: string | null // DB column name kept for compatibility — represents AER360 fit going forward
}

// Strong signals only — we do NOT want to mistakenly pitch Aerpolice to a
// company that mentions "agent" once with no financial/system authority angle.
const AI_AGENT_KEYWORDS = [
  'ai agent', 'ai agents', 'agentic', 'autonomous agent', 'autonomous agents',
  'autonomous checkout', 'agent payment', 'agent payments', 'agent wallet',
  'agents that pay', 'agent that pays', 'agent-to-agent', 'model context protocol',
  'agent identity', 'agent governance', 'agentic commerce', 'ai-native',
]

// Signals that this company's real pain is custody/key-signing/treasury, not
// (or not only) agent governance — the AER360 wedge.
const CUSTODY_KEYWORDS = [
  'fireblocks', 'coinbase custody', 'mpc custody', 'mpc wallet', 'multisig', 'multi-sig',
  'threshold signing', 'threshold ecdsa', 'key management', 'custody', 'custodian',
  'signing key', 'seed phrase', 'hot wallet', 'cold wallet', 'treasury', 'prime broker',
  'otc desk', 'institutional custody', 'digital asset custody',
]

export function isAiAgentLead(lead: LeadFocusInput): boolean {
  const cats = Array.isArray(lead.customer_category)
    ? lead.customer_category
    : lead.customer_category ? [lead.customer_category] : []
  if (cats.some(c => (c || '').toLowerCase().includes('agentic'))) return true

  const industry = (lead.industry_category || '').toLowerCase()
  if (industry.includes('ai commerce') || industry.includes('payment agent') || industry.includes('ai agent')) return true

  const hay = [lead.company_name, lead.description, lead.product_summary, lead.business_model]
    .filter(Boolean).join(' ').toLowerCase()
  return AI_AGENT_KEYWORDS.some(k => hay.includes(k))
}

export function isCustodyLead(lead: LeadFocusInput): boolean {
  const cats = Array.isArray(lead.customer_category)
    ? lead.customer_category
    : lead.customer_category ? [lead.customer_category] : []
  if (cats.some(c => {
    const cl = (c || '').toLowerCase()
    return cl.includes('aerkey') || cl.includes('fireblocks') || cl.includes('custody')
  })) return true

  const industry = (lead.industry_category || '').toLowerCase()
  if (industry.includes('custody') || industry.includes('treasury') || industry.includes('exchange')) return true

  const hay = [lead.company_name, lead.description, lead.product_summary, lead.business_model]
    .filter(Boolean).join(' ').toLowerCase()
  return CUSTODY_KEYWORDS.some(k => hay.includes(k))
}

export const AERPOLICE_FOCUS_DIRECTIVE = `══ PRODUCT FOCUS FOR THIS LEAD — AERPOLICE (AI-agent governance) ══

This lead's primary pain is AI-agent governance. Lead with Aerpolice.

LEAD WITH AERPOLICE:
- Bind — every agent gets its own cryptographic identity, no shared tokens
- Govern — the Triple Gate (identity, intent, limits) blocks an unauthorized action BEFORE it executes, not after; hardware-enforced, not software-level
- Prove — a signed, replayable audit record for every decision and transaction
- A four-level kill switch (agent/role/tenant/global) to halt anything instantly

THE HOOK (use when it fits their situation): enterprise deals stalling in security review because they can't prove agent identity, policy enforcement, and audit trail. That is the live buying signal.

FRAMING LINE you may use: "Stripe governs payments for businesses. Okta governs access for employees. Aerpolice governs economic authority for AI agents."

Only mention AER360 if it's genuinely additive — e.g. their agent will also need a hardware-governed wallet to hold the funds it's allowed to move — and only after Aerpolice is established, one sentence maximum.`

export const AER360_FOCUS_DIRECTIVE = `══ PRODUCT FOCUS FOR THIS LEAD — AER360 (custody / key-governance) ══

This lead's primary pain is custody, key-signing, or treasury governance. Lead with AER360.

LEAD WITH AER360:
- AERKey — threshold signing (CGGMP24) across three hardware enclaves; the key is never assembled anywhere, not even for a millisecond
- Policy Engine — per-transaction limits, approval quorums, destination allowlists, biometric confirmation bound to the exact transaction; enforced by the hardware that signs, not a web server in front of it
- AERKey Wallet — no seed phrase to lose or phish, because there's no assembled key to back up
- Agent Control Center — if they're also giving AI agents spending authority, each agent gets its own child wallet under one of twelve hardware-enforced policy templates
- A tamper-evident audit chain, sealed by the cluster itself, verifiable years later

Only mention Aerpolice if they also operate or plan AI agents that need a decision-layer gate in front of this wallet — one sentence maximum, after AER360 is established.`

export const BOTH_FOCUS_DIRECTIVE = `══ PRODUCT FOCUS FOR THIS LEAD — AERPOLICE + AER360 (genuine dual fit) ══

This lead is building or operating AI agents that need both a decision-layer gate (Aerpolice) and a hardware-governed wallet those agents actually transact from (AER360). Lead with whichever is the sharper hook for their specific situation, then bring in the second product as the natural next layer.

FRAMING LINE you may use: "Aerpolice decides whether the agent's action is allowed. AER360 is the vault it physically can't sign outside of."

Don't force both products into every sentence — one clear primary thread, one clean second mention.`

// Resolve the right focus + directive for a lead. Use this in every outreach /
// drafting path so the product choice is consistent and deterministic.
// Prefers the lead's own saved fit fields (populated during qualification)
// over re-deriving from a keyword scan, since those reflect an AI's actual
// research on this specific company rather than a generic heuristic.
export function productFocusDirective(lead: LeadFocusInput): { focus: ProductFocus; directive: string } {
  const hasAerpoliceFit = !!(lead.aerpolice_fit && lead.aerpolice_fit.trim())
  const hasAer360Fit = !!(lead.aeredium_fit && lead.aeredium_fit.trim())

  let focus: ProductFocus
  if (hasAerpoliceFit && hasAer360Fit) focus = 'both'
  else if (hasAerpoliceFit) focus = 'aerpolice'
  else if (hasAer360Fit) focus = 'aer360'
  else {
    // No saved fit yet (e.g. called pre-qualification) — fall back to keyword heuristics.
    const agent = isAiAgentLead(lead)
    const custody = isCustodyLead(lead)
    focus = agent && custody ? 'both' : custody ? 'aer360' : 'aerpolice'
  }

  const directive =
    focus === 'both' ? BOTH_FOCUS_DIRECTIVE
    : focus === 'aer360' ? AER360_FOCUS_DIRECTIVE
    : AERPOLICE_FOCUS_DIRECTIVE

  return { focus, directive }
}

// ── Composed blocks for prompts ──────────────────────────────────────────────
// These are the ONLY blocks injected into discover/qualify-lead/enrich-lead/
// outreach/chat/copilot/bd-brief prompts — scoped to Aerpolice + AER360 only.

// Compact product context (use in token-tight calls like company extraction)
export const PRODUCT_BRAIN_COMPACT = `${AERPOLICE_KNOWLEDGE}

${AER360_KNOWLEDGE}`

// Full product brain (research, scoring, outreach, chat, learn)
export const PRODUCT_BRAIN = `${CONSULTANT_FRAMEWORK}

${AERPOLICE_KNOWLEDGE}

${AER360_KNOWLEDGE}

${AGENTIC_PAYMENTS}

${TARGET_CATEGORIES_BLOCK}

${BATTLECARDS}`

// Everything, including ICP (for strategy/advisory contexts like the voice agent)
export const FULL_BRAIN = `${PRODUCT_BRAIN}

${ICP_BLOCK}`

// ── Full product catalog (used in qualify-lead to evaluate all products) ──────
export const PRODUCTS_CATALOG = `COMPLETE PRODUCT CATALOG — evaluate every lead against ALL of these:

━━ AERPOLICE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Aerpolice Agent Identity
   Every agent bound to its own cryptographic identity (AERKey-signed) — no shared tokens, no anonymous actors. Proves who (or what) acted for enterprise and regulatory compliance.
   Best fit: AI-native companies selling agents to enterprises; companies where regulators ask "which agent did what?"; MCP-based tooling where agent identity matters.

2. Aerpolice Agent Policy + Execution Gate (the "Triple Gate")
   Every proposed action becomes a Pact checked against identity, intent, and limits before it executes — resolves to accept/deny/requires_owner_approval. Stops unauthorized agent calls before they happen, not after.
   Best fit: companies whose AI agents take consequential actions (payments, procurement, data access); companies with enterprise customers demanding policy enforcement proof; AI wallet builders; agentic commerce startups.

3. Aerpolice Audit Trail
   Signed, replayable record of every decision, approval, and transaction — tamper-evident, tied to the agent's own key. Satisfies enterprise security review and regulatory audit requirements.
   Best fit: any AI-native company facing enterprise security review; companies where agents make financial or compliance-sensitive decisions; highly regulated verticals (finance, healthcare, legal).

4. Aerpolice Controls (kill switch + human escalation)
   Four-level kill switch (agent/role/tenant/global) plus threshold-triggered owner approval for large or sensitive actions.
   Best fit: any company giving an agent real financial or system authority for the first time and wanting an instant way to halt it.

━━ AER360 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. AER360 AERKey (Threshold Signing)
   CGGMP24 threshold ECDSA across three hardware-attested enclaves — the signing key is never assembled anywhere, not even for a millisecond.
   Best fit: custodians; MPC wallet providers; companies needing hardware-grade signing accountability beyond software-only MPC.

6. AER360 Policy Engine
   Per-transaction limits, approval quorums, destination allowlists, and per-transaction biometric confirmation — enforced by the same hardware that signs.
   Best fit: treasury operators and custodians who need policy enforced cryptographically, not by a web server in front of the vault.

7. AER360 AERKey Wallet
   Custodial wallet with no seed phrase to lose or phish, because there's no assembled key to back up.
   Best fit: institutions and funds wanting a safer custody wallet than seed-phrase or software-MPC-based options.

8. AER360 Agent Control Center
   Per-agent child wallets, each bound to one of twelve hardware-enforced spend-policy templates.
   Best fit: any company about to give an AI agent real financial authority for the first time and wanting a bounded, auditable wallet for it rather than a shared hot wallet.`
