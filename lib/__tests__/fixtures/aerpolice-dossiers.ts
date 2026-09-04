import type { AerpoliceDossier } from '@/lib/aerpolice-discovery'

export const TODAY = new Date('2026-09-02T00:00:00Z')
export function isoDaysAgo(days: number, from: Date = TODAY): string {
  return new Date(from.getTime() - days * 86400000).toISOString().slice(0, 10)
}

const BASE: AerpoliceDossier = {
  organization: 'Rallied',
  website: 'https://www.rallied.ai',
  agent_product: 'AI agent for IT service management',
  company_size_band: 'startup',
  company_size_basis: 'Small Atlassian Marketplace vendor, ~15 employees estimated from LinkedIn.',
  verified_action: {
    action_type: 'provision_revoke_access',
    description: 'Resolves IT tickets, runs approved fixes, handles password and access changes with MFA.',
    status: 'confirmed',
    evidence_url: 'https://marketplace.atlassian.com/apps/275987459/rallied-ai-agent-for-itsm',
    evidence_tier: 'marketplace',
    additional_actions: ['reset_password', 'modify_account'],
  },
  trigger: {
    type: 'agent_ga_launch',
    what_happened: 'Rallied listed its action-taking ITSM agent in the Atlassian Marketplace.',
    date: isoDaysAgo(5),
    evidence_url: 'https://marketplace.atlassian.com/apps/275987459/rallied-ai-agent-for-itsm',
    evidence_tier: 'marketplace',
  },
  structural_fit: { segments: ['it_ops'], rationale: 'IT service management agent with write access to identity systems.' },
  current_controls: {
    has_own_identity: 'unknown', shared_service_account: 'unknown', credentials_or_oauth_scope: 'not public',
    authorization_external_to_runtime: 'unknown', limits_supported: 'MFA required, approved fixes only — not public beyond that',
    human_escalation: 'unknown', independent_kill_switch: 'unknown', audit_log_explains_why: 'unknown', audit_verifiable_by_customer: 'unknown',
    stated_summary: 'MFA and "approved fixes" are stated; independent per-agent policy, kill control and signed evidence are not public.',
  },
  control_gap: {
    gap: 'No independent kill switch per agent; authorization is enforced inside the same runtime that executes the action, with no external approval step.',
    status: 'confirmed',
    basis: 'Docs describe a single in-process policy check with no external escalation or kill control.',
  },
  consequence: { financial: null, operational: 'Password/access changes without independent verification could lock out or over-provision users.', regulatory: null, reputational: null },
  recommended_motion: 'direct_design_partner_pilot',
  motion_rationale: 'Small, founder-led, no competing governance layer documented.',
  buyer: { role: 'Founder / CTO / Product Lead', name: null, identifiable: true, public_channel: 'https://www.rallied.ai/careers' },
  first_qualification_question: 'Can an IT owner stop one agent and prove which policy allowed a specific password or access change?',
  facts: ['Rallied lists MFA-gated password/access changes on its Atlassian Marketplace listing.'],
  inferences: ['Likely relies on the agent runtime itself to enforce limits, given no external policy layer is mentioned.'],
  unknowns: ['Whether authorization is enforced outside the agent runtime.', 'Whether one agent can be killed independently.'],
  team_public: true,
  project_active: true,
  rejection_flags: [],
}

export const CONFIRMED_ACTION_FRESH_TRIGGER_DOSSIER: AerpoliceDossier = BASE

export const NO_TRIGGER_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'Furl',
  trigger: { type: null, what_happened: '', date: null, evidence_url: null, evidence_tier: 'none' },
}

export const STALE_TRIGGER_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'Snyk',
  trigger: { ...BASE.trigger, date: isoDaysAgo(400) },
}

export const NO_BUYER_ROUTE_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'Anon Agent Co',
  team_public: false,
  buyer: { role: 'Unknown', name: null, identifiable: false, public_channel: null },
}

export const NO_ACTION_EVIDENCE_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'ChatHelper',
  verified_action: {
    action_type: null, description: 'Answers customer questions in a chat widget.', status: 'unknown',
    evidence_url: null, evidence_tier: 'none', additional_actions: [],
  },
}

export const SOCIAL_ONLY_ACTION_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'HypeAgent',
  verified_action: { ...BASE.verified_action, evidence_tier: 'social' },
}

export const EQUIVALENT_OFFERING_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'GovernedAI Inc',
  recommended_motion: 'reject',
  rejection_flags: ['equivalent_offering'],
}

export const ENTERPRISE_NO_STRONG_TRIGGER_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'MegaCorp',
  company_size_band: 'enterprise_large',
  company_size_basis: '50,000+ employees per public filings.',
  buyer: { role: 'Unknown', name: null, identifiable: false, public_channel: null },
  team_public: false,
}

export const ENTERPRISE_STRONG_TRIGGER_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'MegaBank',
  company_size_band: 'enterprise_large',
  company_size_basis: '10,000+ employees, public filings.',
}

export const INACTIVE_DOSSIER: AerpoliceDossier = { ...BASE, organization: 'Ghostware', project_active: false }

export const OVERCLAIMED_GAP_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'CapabilityOnly',
  control_gap: { gap: 'The agent is action-taking and able to execute changes autonomously.', status: 'confirmed', basis: 'It can act, so it must have a gap.' },
}

export const GENUINE_GAP_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'RealGap Inc',
  control_gap: { gap: 'No independent kill switch per agent; authorization is enforced inside the same runtime that executes the action, with no external approval step.', status: 'confirmed', basis: 'Docs describe a single in-process policy check with no external escalation or kill control.' },
}

export const UNCONFIRMED_GAP_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'ActionOnlyCo',
  control_gap: { gap: 'Gap not confirmed', status: 'unknown', basis: 'Only the action-taking capability is documented, not the control layer.' },
}

export const OEM_INTEGRATION_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'ConnectorHub MCP',
  recommended_motion: 'oem_integration',
  motion_rationale: 'Ships an MCP server that third parties embed — not an end-user buyer of governance themselves.',
}

export const PARTNERSHIP_DOSSIER: AerpoliceDossier = {
  ...BASE,
  organization: 'AgentFrame',
  recommended_motion: 'partnership',
  motion_rationale: 'Agent framework builder — a channel partner, not a direct customer.',
}
