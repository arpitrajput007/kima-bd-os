import type { AerpoliceDossier } from '@/lib/aerpolice-discovery'

export const TODAY = new Date('2026-09-07T00:00:00Z')
export function isoDaysAgo(days: number, from: Date = TODAY): string {
  return new Date(from.getTime() - days * 86400000).toISOString().slice(0, 10)
}

const BASE: AerpoliceDossier = {
  organization: 'Rainmaker',
  website: 'https://rainmaker.fun',
  segment: 'S1 Trading',
  agent_product: 'Autonomous Polymarket trading agent',
  wallet_key: {
    status: 'Yes',
    evidence: "Agent executes Polymarket entries/exits from each user's own wallet.",
    evidence_url: 'https://rainmaker.fun/how-it-works',
    evidence_tier: 'official_docs',
    signal_type: 'agent_controlled_eoa',
  },
  irreversible: {
    status: 'Yes',
    action_type: 'polymarket_trade',
    action: 'Filled Polymarket order and final market settlement.',
    evidence_url: 'https://rainmaker.fun/',
    evidence_tier: 'onchain_verified',
  },
  production_confirmed: true,
  production_evidence: 'Live settled fills published through the current date.',
  api_fiat_rail_only: false,
  trigger: {
    type: 'autonomous_trading_launch',
    what_happened: 'Live US Open fills and settled outcomes were published.',
    date: isoDaysAgo(5),
    evidence_url: 'https://rainmaker.fun/',
    evidence_tier: 'official_docs',
  },
  past_loss: {
    description: 'Public record includes losing settled trades (-100%), showing real capital exposure.',
    evidence_url: 'https://rainmaker.fun/',
  },
  current_controls: 'User wallet; autonomous execution; user sets stake and turns Auto on.',
  gap_to_investigate: 'Where is the non-bypassable mandate enforced before the wallet signs each order?',
  integration_fit_rationale: 'Wallet-level mandate enforcement is directly applicable — no existing policy layer described.',
  buyer: { target: 'Founder / CTO', contact_path: 'Website + public X; reference a specific settled fill.', reachable: true },
  first_question: 'What is the largest position the agent can open from a user wallet before anyone on your team notices?',
  recommended_route: 'direct_sales',
  route_rationale: 'Live production trading, no governance layer described, reachable founder.',
  facts: ['Rainmaker publishes settled Polymarket fills from user wallets.'],
  inferences: ['Likely relies on the agent runtime itself to enforce limits, given no external policy layer is mentioned.'],
  unknowns: ['Whether mandate constraints are enforced outside the agent runtime.'],
  project_active: true,
  team_public: true,
  rejection_flags: [],
}

export const DIRECT_SALES_DOSSIER: AerpoliceDossier = BASE

export const NO_WALLET_KEY_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'ChatHelper',
  wallet_key: { status: 'No', evidence: 'Human manually signs every transaction; agent only recommends trades.', evidence_url: 'https://chathelper.example/docs', evidence_tier: 'official_docs', signal_type: null },
}

export const UNKNOWN_WALLET_KEY_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'Hey Anon Launchpad',
  wallet_key: { status: 'Unknown', evidence: 'Launchpad promises guaranteed on-chain execution, but public key custody is not explicit.', evidence_url: 'https://launchpad.example/registry', evidence_tier: 'aggregator_directory', signal_type: null },
}

export const NO_IRREVERSIBLE_ACTION_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'RefundBot',
  irreversible: { status: 'No', action_type: null, action: 'Issues refunds via a support dashboard; no on-chain settlement.', evidence_url: 'https://refundbot.example/docs', evidence_tier: 'official_docs' },
}

export const UNKNOWN_IRREVERSIBLE_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'Sapiom',
  irreversible: { status: 'Unknown', action_type: null, action: 'Most documented activity is service purchasing/runtime cost rather than proven on-chain settlement.', evidence_url: null, evidence_tier: 'none' },
}

export const TESTNET_ONLY_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'Testnet Trader',
  production_confirmed: false,
  production_evidence: 'Only testnet transactions documented; no mainnet usage found.',
}

export const API_FIAT_RAIL_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'Hyperbots',
  segment: 'S1 Trading',
  wallet_key: { status: 'No', evidence: 'Executes AP/AR through banking and card rails, not a wallet.', evidence_url: 'https://hyperbots.example/docs', evidence_tier: 'official_docs', signal_type: null },
  api_fiat_rail_only: true,
}

export const INACTIVE_DOSSIER: AerpoliceDossier = { ...BASE, organization: 'Ghostware', project_active: false }

export const S3_WALLET_INFRA_NO_GAP_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'Openfort',
  segment: 'S3 Wallet Infra',
  wallet_key: { status: 'Yes', evidence: 'Agent wallets autonomously sign EVM/Solana transactions within programmable controls.', evidence_url: 'https://openfort.example/solutions', evidence_tier: 'official_docs', signal_type: 'agent_wallet_infra_provided' },
  gap_to_investigate: 'Gap not confirmed',
  recommended_route: 'learning_oem',
  route_rationale: 'Direct competitor with an existing policy-gated key product — learning conversation only.',
}

export const S3_WALLET_INFRA_VERIFIED_GAP_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'NicheWalletCo',
  segment: 'S3 Wallet Infra',
  wallet_key: { status: 'Yes', evidence: 'Agent wallets sign transactions with no independent policy layer described.', evidence_url: 'https://nichewallet.example/docs', evidence_tier: 'official_docs', signal_type: 'agent_wallet_infra_provided' },
  gap_to_investigate: 'No independent kill switch or external mandate enforcement described anywhere in the docs — the application itself is the only checkpoint.',
  recommended_route: 'direct_sales',
  route_rationale: 'Verified residual gap: no external enforcement layer exists today, and the buyer is reachable.',
}

export const NO_TRIGGER_NO_BUYER_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'QuietStartup',
  trigger: { type: null, what_happened: '', date: null, evidence_url: null, evidence_tier: 'none' },
  buyer: { target: 'Unknown', contact_path: '', reachable: false },
  team_public: false,
  recommended_route: 'design_partner',
}

export const STALE_TRIGGER_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'OldNews Protocol',
  trigger: { ...BASE.trigger, date: isoDaysAgo(45) },
}

export const OLD_LOSS_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'DrainedWallet Inc',
  past_loss: { description: 'Agent wallet was drained via a compromised session key.', evidence_url: 'https://example.com/postmortem' },
}
