// ── AERKey Customers — Aeredium BD Intelligence Data ────────────────
// Smaller/emerging crypto exchanges, market makers, and payment infra
// companies where AERKey (TEE-attested threshold ECDSA signing) is a
// fast-close fit: real custody/signing exposure, lean teams, single
// decision-maker sales cycles.

export interface AerkeyCustomer {
  company: string
  category: string
  stageSignal: string
  whyFit: string
  sourceConfidence: string
}

export const AERKEY_CUSTOMERS: AerkeyCustomer[] = [
  { company: 'BitDelta', category: 'Emerging-market crypto exchange (Turkey/India focus)', stageSignal: 'Founded 2023, active in 120+ countries but still young', whyFit: "Already publicly documented as a Fireblocks customer - concrete redundancy/backup-signer pitch, and as a 2023-founded company it's small enough for a founder/CTO to say yes fast", sourceConfidence: 'Sourced directly - Slashdot exchange comparison' },
  { company: 'Zerocard', category: 'Crypto-to-card spending infra (Lagos, Nigeria)', stageSignal: 'Small team, African fintech startup', whyFit: 'Converts stablecoin balances to card-swipeable fiat at the point of sale - real, constant signing/conversion volume, and as a lean startup it needs an affordable, fast-to-integrate signing partner rather than an enterprise contract', sourceConfidence: 'Sourced directly - TechCabal African crypto sector report' },
  { company: 'CoinCircuit', category: 'Merchant crypto payment gateway', stageSignal: 'Small, merchant-focused startup', whyFit: 'Handles crypto-to-local-currency settlement for merchants - real custody/signing exposure at a scale a founder can decide on directly, no procurement committee', sourceConfidence: 'Sourced directly - TechCabal African crypto sector report' },
  { company: 'Helicarrier (formerly Buycoins)', category: 'Crypto exchange/infrastructure (Nigeria/Africa)', stageSignal: 'Y Combinator-backed', whyFit: 'YC-backed means a lean, technical founding team used to evaluating and adopting new infra quickly - classic fast-decision profile', sourceConfidence: 'Sourced directly - Y Combinator company directory' },
  { company: 'Sendcash', category: 'Diaspora remittance app (Africa-focused)', stageSignal: 'Y Combinator-backed, early stage', whyFit: "Cross-border remittance means real fund movement at volume, small team means single-founder decision-making, and it's exactly the payment-rail use case Aeredium already positions around", sourceConfidence: 'Sourced directly - Y Combinator company directory' },
  { company: 'Rio', category: 'Stablecoin liquidity provider (LATAM)', stageSignal: 'Y Combinator-backed', whyFit: 'Explicitly a stablecoin liquidity business for LATAM fintechs - direct signing/custody need, small team, and LATAM is underserved by the big incumbent custodians so less likely to already be locked in', sourceConfidence: 'Sourced directly - Y Combinator company directory' },
  { company: 'EthosX', category: 'DeFi derivatives platform', stageSignal: 'Y Combinator-backed, early stage', whyFit: 'Builds financial derivatives without centralized clearinghouses - real admin-key/treasury signing surface, small technical team can evaluate and adopt fast', sourceConfidence: 'Sourced directly - Y Combinator company directory' },
  { company: 'Archer', category: 'Stablecoin banking infra for AI data-economy companies', stageSignal: 'Y Combinator-backed, early stage', whyFit: 'Explicitly building stablecoin banking and payouts - direct custody/signing need, and the AI-data-economy angle is a fresh, uncrowded niche with no entrenched custody vendor yet', sourceConfidence: 'Sourced directly - Y Combinator company directory' },
  { company: 'Flux', category: 'Mobile P2P crypto/fiat payments app', stageSignal: 'Y Combinator-backed, early stage', whyFit: 'Merchant and freelancer P2P payment app handling real crypto/fiat conversion - small team, fast adoption decisions, genuine signing volume even if individual transaction sizes are modest', sourceConfidence: 'Sourced directly - Y Combinator company directory' },
  { company: 'Kairon Labs', category: 'Boutique crypto market maker (Belgium)', stageSignal: 'Smaller/mid-tier market maker (utility-token focus vs. the billion-dollar desks)', whyFit: 'Positions itself as boutique and client-focused rather than competing at Wintermute/GSR scale - more likely to have a single decision-maker and be open to a newer vendor relationship', sourceConfidence: 'Sourced - market maker comparison rankings' },
  { company: 'Foxbit', category: 'Crypto exchange (Brazil)', stageSignal: 'Founded 2014, regional/established but not a global mega-exchange', whyFit: 'Long-operating regional exchange with real accumulated custody exposure, but LatAm is less saturated by the big custody incumbents than the US/EU/India markets', sourceConfidence: 'Sourced - crypto exchange startup directory' },
  { company: 'Bit2Me', category: 'Crypto exchange (Spain)', stageSignal: 'Founded 2014, regional exchange', whyFit: 'Established regional player in an EU market facing the MiCA compliance deadline - real trigger event, and a smaller team than the global exchanges means faster internal sign-off', sourceConfidence: 'Sourced - crypto exchange startup directory' },
  { company: 'Newton', category: 'No-fee crypto exchange (Canada)', stageSignal: 'Regional/mid-size exchange', whyFit: 'Canadian market is smaller and less contested by the big US custody vendors - real custody need with less competition for your pitch', sourceConfidence: 'Sourced - crypto exchange startup directory' },
  { company: 'BuyUcoin', category: 'India crypto exchange', stageSignal: 'FIU-IND registered but smaller scale than CoinDCX/WazirX (carried over from your original list, re-flagged here as genuinely mid-tier)', whyFit: 'Smaller Indian exchange - real compliance-conscious custody need, but likely a faster, less bureaucratic sales cycle than the market leaders', sourceConfidence: 'Sourced - FIU-IND registrant list' },
  { company: 'Pyor', category: 'India crypto/VDA service provider', stageSignal: 'FIU-IND registered, limited public profile - likely early/small stage', whyFit: 'Small enough that a discovery call could directly reach the actual decision-maker rather than navigating a large org chart', sourceConfidence: 'Sourced - FIU-IND registrant list' },
  { company: 'Bytex', category: 'India crypto/VDA service provider', stageSignal: 'FIU-IND registered, limited public profile - likely early/small stage', whyFit: 'Same logic as Pyor - small, reachable, real compliance-driven custody need', sourceConfidence: 'Sourced - FIU-IND registrant list' },
]

export const AERKEY_CATEGORIES: string[] = [
  'All',
  ...Array.from(new Set(AERKEY_CUSTOMERS.map(c => c.category))),
]
