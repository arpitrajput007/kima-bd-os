// ── Deal Form Customization ────────────────────────────────────
//
// Lets the user hide built-in questions/sections and add their own
// ad-hoc questions to the "Add/Edit Deal" form without touching code.
// Layout config (what's hidden, what custom fields exist) is stored
// in localStorage — it's a per-browser display preference, not deal
// data. The actual answers to custom fields ARE deal data and live in
// the `custom_fields` JSONB column on `monthly_deals`.

export interface CustomFieldDef {
  key: string            // stable slug, used as the JSON key in custom_fields
  label: string
  type: 'text' | 'textarea'
}

export interface FieldMeta {
  key: string
  label: string
  section: string
}

export const DEAL_FORM_SECTIONS = [
  { key: 'company',        label: 'Company Information' },
  { key: 'classification', label: 'Lead Classification' },
  { key: 'opportunity',    label: 'Opportunity Details' },
  { key: 'potential',      label: 'Business Potential' },
  { key: 'impact',         label: 'Business Impact' },
  { key: 'feedback',       label: 'Product Feedback from Prospect' },
  { key: 'blockers',       label: 'Deal Blockers' },
  { key: 'notes',          label: 'Additional Notes' },
] as const

// Only simple label+input fields are individually hideable. Structured
// widgets (blocker chips, multi-selects backed by non-Field markup) are
// hidden at the section level only — see DEAL_FORM_SECTIONS above.
export const DEAL_FORM_FIELDS: FieldMeta[] = [
  { key: 'company_name',            label: 'Company Name',                             section: 'company' },
  { key: 'individual_name',         label: 'Individual Name',                          section: 'company' },
  { key: 'designation',             label: 'Designation / Role',                       section: 'company' },
  { key: 'website',                 label: 'Website',                                  section: 'company' },
  { key: 'industry',                label: 'Industry',                                 section: 'company' },
  { key: 'country',                 label: 'Country',                                  section: 'company' },

  { key: 'lead_type',               label: 'Lead Type',                                section: 'classification' },
  { key: 'status',                  label: 'Deal Status',                              section: 'classification' },
  { key: 'outreach_channel',        label: 'Primary Outreach Channel',                 section: 'classification' },
  { key: 'expected_close_date',     label: 'Expected Close Date',                      section: 'classification' },
  { key: 'month_year',              label: 'Reporting Month',                          section: 'classification' },

  { key: 'requirement',             label: 'Requirement — What are they looking for?', section: 'opportunity' },
  { key: 'problem_statement',       label: 'Problem Statement',                        section: 'opportunity' },
  { key: 'products_interested',     label: 'Products They Are Interested In',          section: 'opportunity' },
  { key: 'products_proposed',       label: 'Products We Proposed',                     section: 'opportunity' },

  { key: 'expected_monthly_volume', label: 'Expected Monthly Volume',                  section: 'potential' },
  { key: 'expected_yearly_volume',  label: 'Expected Yearly Volume',                   section: 'potential' },
  { key: 'estimated_revenue',       label: 'Estimated Revenue Opportunity',            section: 'potential' },
  { key: 'geographic_corridor',     label: 'Geographic Corridor',                      section: 'potential' },
  { key: 'end_users_count',         label: 'Number of End Users',                      section: 'potential' },
  { key: 'use_case',                label: 'Use Case',                                 section: 'potential' },
  { key: 'strategic_importance',    label: 'Strategic Importance',                     section: 'potential' },

  { key: 'business_impact',         label: 'What business can this opportunity bring?',section: 'impact' },
  { key: 'why_valuable',            label: 'Why is this customer valuable?',           section: 'impact' },
  { key: 'best_product_fit',        label: 'Which Kima / Aerpolice product fits best?',   section: 'impact' },
  { key: 'long_term_value',         label: 'Long-term strategic value',                section: 'impact' },

  { key: 'feature_requested',       label: 'Feature Requested',                        section: 'feedback' },
  { key: 'missing_functionality',   label: 'Missing Functionality',                    section: 'feedback' },
  { key: 'product_gaps',            label: 'Product Gaps Identified',                  section: 'feedback' },
  { key: 'integration_requested',   label: 'Integration Requested',                    section: 'feedback' },
  { key: 'api_requirements',        label: 'API Requirements',                         section: 'feedback' },
  { key: 'compliance_requirements', label: 'Compliance Requirements',                  section: 'feedback' },
  { key: 'technical_blockers',      label: 'Technical Blockers',                       section: 'feedback' },

  { key: 'notes',                   label: 'Notes',                                    section: 'notes' },
  { key: 'owner',                   label: 'Owner / Assigned To',                      section: 'notes' },
]

const HIDDEN_FIELDS_KEY   = 'bd_deal_hidden_fields'
const HIDDEN_SECTIONS_KEY = 'bd_deal_hidden_sections'
const CUSTOM_FIELDS_KEY   = 'bd_deal_custom_fields'

function readArray(key: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function getHiddenFields(): string[] { return readArray(HIDDEN_FIELDS_KEY) }
export function setHiddenFields(keys: string[]) {
  window.localStorage.setItem(HIDDEN_FIELDS_KEY, JSON.stringify(keys))
}

export function getHiddenSections(): string[] { return readArray(HIDDEN_SECTIONS_KEY) }
export function setHiddenSections(keys: string[]) {
  window.localStorage.setItem(HIDDEN_SECTIONS_KEY, JSON.stringify(keys))
}

export function getCustomFields(): CustomFieldDef[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CUSTOM_FIELDS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
export function setCustomFields(defs: CustomFieldDef[]) {
  window.localStorage.setItem(CUSTOM_FIELDS_KEY, JSON.stringify(defs))
}

export function slugifyFieldKey(label: string): string {
  return 'cf_' + label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}
