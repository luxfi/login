/**
 * The two shipped flows, declared as data.
 *
 *   • `exchange-full` — the regulated Lux-exchange KYC. Every possible step is
 *     declared once; `enabledWhen` predicates reveal entity-only steps based on
 *     the chosen account type and accreditation answer. Order:
 *       account-type → identity → (entity info) → accreditation → document →
 *       screening → review.
 *   • `lite` — the minimal AI-app flow: email already verified by `@hanzo/iam`,
 *     so this just collects a display name and lands on review.
 *
 * This module is the ONLY place a flow is described. Adding a field, a step, or
 * a whole new flow is an edit here — never a new route or component. The runner
 * (`ui/OnboardingRunner`) and the resolver (`domain/machine`) consume these
 * specs unchanged.
 *
 * Clean-room: original Lux flow definitions. The set of regulated KYC steps
 * (CIP identity, accreditation, document capture, country-risk screening) is
 * dictated by US BD/ATS onboarding requirements, not by any prior source;
 * field copy and predicates are written here.
 */
import {
  isAccountType,
  type FieldSpec,
  type FlowSpec,
  type FormData,
  type StepSpec,
} from './types'

// ── Shared predicates ───────────────────────────────────────────────

/** True for an individual (natural-person) applicant. */
const isIndividual = (d: FormData): boolean => d.accountType === 'individual'

/** True for any entity (everything that is not an individual). */
const isEntity = (d: FormData): boolean =>
  typeof d.accountType === 'string' && isAccountType(d.accountType) && d.accountType !== 'individual'

/** True when the applicant declared a non-US country of residence. */
const isNonUs = (d: FormData): boolean =>
  typeof d.country === 'string' && d.country.length > 0 && d.country !== 'US'

// ── Shared field fragments ──────────────────────────────────────────

/** Country of legal residence. Drives non-US reveals + the screening check. */
const COUNTRY_FIELD: FieldSpec = {
  name: 'country',
  label: 'Country of residence',
  kind: 'select',
  required: true,
  options: [
    { value: 'US', label: 'United States' },
    { value: 'CA', label: 'Canada' },
    { value: 'GB', label: 'United Kingdom' },
    { value: 'AU', label: 'Australia' },
    { value: 'DE', label: 'Germany' },
    { value: 'FR', label: 'France' },
    { value: 'JP', label: 'Japan' },
    { value: 'SG', label: 'Singapore' },
    { value: 'OTHER', label: 'Other' },
  ],
  help: 'Determines the verification path and any jurisdiction restrictions.',
}

/** Residential-address fragment shared by individual + entity-principal steps. */
const addressFields: readonly FieldSpec[] = [
  {
    name: 'addressLine1',
    label: 'Residential address',
    kind: 'text',
    placeholder: 'Street address',
    required: true,
  },
  { name: 'addressLine2', label: 'Apt, suite, etc. (optional)', kind: 'text' },
  { name: 'city', label: 'City', kind: 'text', required: true },
  { name: 'state', label: 'State / Province', kind: 'text', required: true },
  { name: 'postalCode', label: 'Postal code', kind: 'text', required: true },
] as const

// ── exchange-full ───────────────────────────────────────────────────

const accountTypeStep: StepSpec = {
  id: 'account-type',
  title: 'What kind of account?',
  byline: 'This determines the information we collect to verify you.',
  kind: 'account-type',
  phase: 1,
}

const identityStep: StepSpec = {
  id: 'identity',
  title: 'Your identity',
  byline: 'Legal details, exactly as they appear on your government ID.',
  phase: 1,
  fields: [
    { name: 'legalFirstName', label: 'Legal first name', kind: 'text', required: true },
    { name: 'legalLastName', label: 'Legal last name', kind: 'text', required: true },
    {
      name: 'dob',
      label: 'Date of birth',
      kind: 'date',
      required: true,
      validate: (v) => {
        if (typeof v !== 'string' || !v) return null
        const age = yearsSince(v)
        if (age === null) return 'Enter a valid date.'
        if (age < 18) return 'You must be at least 18 to open an account.'
        if (age > 120) return 'Enter a valid date of birth.'
        return null
      },
    },
    COUNTRY_FIELD,
    ...addressFields,
    {
      name: 'ssnLast4',
      label: 'Last 4 of SSN',
      kind: 'ssn-last4',
      help: 'US persons only. We never collect your full SSN in the browser.',
      // US residents only; reveal hides AND skips validation for non-US.
      visibleWhen: (d) => !isNonUs(d),
      required: true,
      validate: (v) => (typeof v === 'string' && /^\d{4}$/.test(v) ? null : 'Enter the last 4 digits.'),
    },
    {
      name: 'taxId',
      label: 'Tax identification number',
      kind: 'text',
      help: 'Your local tax ID (non-US residents).',
      visibleWhen: isNonUs,
      required: true,
    },
  ],
}

const entityStep: StepSpec = {
  id: 'entity',
  title: 'Entity details',
  byline: 'Tell us about the organization opening this account.',
  phase: 1,
  // Only for entity account types; skipped entirely for individuals.
  enabledWhen: isEntity,
  fields: [
    { name: 'entityLegalName', label: 'Legal entity name', kind: 'text', required: true },
    {
      name: 'entityCountry',
      label: 'Country of formation',
      kind: 'select',
      required: true,
      options: COUNTRY_FIELD.options,
    },
    {
      name: 'entityTaxId',
      label: 'Entity tax ID (EIN)',
      kind: 'text',
      required: true,
      help: 'Employer Identification Number or local equivalent.',
    },
    {
      name: 'controlPersonName',
      label: 'Authorized control person',
      kind: 'text',
      required: true,
      help: 'The individual authorized to act for the entity.',
    },
  ],
}

const accreditationStep: StepSpec = {
  id: 'accreditation',
  title: 'Accreditation',
  byline: 'Regulated offerings require an accredited-investor attestation.',
  phase: 2,
  fields: [
    {
      name: 'accredited',
      label: 'I am an accredited investor',
      kind: 'checkbox',
      help: 'Income over $200k (individual) / $300k (joint), or net worth over $1M excluding primary residence.',
    },
    {
      name: 'accreditationBasis',
      label: 'Basis for accreditation',
      kind: 'select',
      // Only ask the basis once they attest.
      visibleWhen: (d) => d.accredited === true,
      required: true,
      options: [
        { value: 'income', label: 'Income test' },
        { value: 'net-worth', label: 'Net-worth test' },
        { value: 'professional', label: 'Professional certification (Series 7/65/82)' },
        { value: 'entity', label: 'Entity with > $5M in assets' },
      ],
    },
  ],
}

const documentStep: StepSpec = {
  id: 'document',
  title: 'Verify your ID',
  byline: 'Upload a government-issued photo ID. This is handled by our verification partner.',
  kind: 'document',
  phase: 2,
  // Individuals scan a document + selfie; entities run a business (KYB) check.
  check: 'document+selfie',
}

const entityDocumentStep: StepSpec = {
  id: 'entity-document',
  title: 'Verify the entity',
  byline: 'Upload formation documents and beneficial-ownership information.',
  kind: 'document',
  phase: 2,
  enabledWhen: isEntity,
  check: 'business',
}

const screeningStep: StepSpec = {
  id: 'screening',
  title: 'Compliance check',
  byline: 'A jurisdiction and sanctions screening against your declared country.',
  kind: 'screening',
  phase: 3,
}

const reviewStep: StepSpec = {
  id: 'review',
  title: 'Review & submit',
  byline: 'Confirm everything is correct, then submit your application.',
  kind: 'review',
  phase: 3,
}

/**
 * The regulated exchange KYC flow. The `document` step only applies to
 * individuals (entities go through `entity-document`); we gate it with the
 * step-level `enabledWhen` rather than two near-identical specs.
 */
export const EXCHANGE_FULL: FlowSpec = {
  id: 'exchange-full',
  title: 'Lux Exchange',
  steps: [
    accountTypeStep,
    identityStep,
    entityStep,
    { ...documentStep, enabledWhen: isIndividual },
    entityDocumentStep,
    accreditationStep,
    screeningStep,
    reviewStep,
  ],
}

// ── lite ────────────────────────────────────────────────────────────

/**
 * The minimal flow for non-regulated Lux apps. Email is already verified by
 * the `@hanzo/iam` login that precedes onboarding, so this only captures a
 * display name and lands on review.
 */
export const LITE: FlowSpec = {
  id: 'lite',
  title: 'Lux',
  steps: [
    {
      id: 'profile',
      title: 'Set up your profile',
      byline: 'A display name is all we need to get you started.',
      phase: 1,
      fields: [
        { name: 'displayName', label: 'Display name', kind: 'text', required: true, placeholder: 'Satoshi' },
      ],
    },
    reviewStep,
  ],
}

// ── Registry ────────────────────────────────────────────────────────

export const FLOWS = { 'exchange-full': EXCHANGE_FULL, lite: LITE } as const

/** Resolve a flow by id; defaults to the regulated `exchange-full`. */
export function flowById(id: string | null | undefined): FlowSpec {
  if (id === 'lite') return LITE
  return EXCHANGE_FULL
}

// ── helpers ─────────────────────────────────────────────────────────

/** Whole years between an ISO date and today, or null if unparseable. */
function yearsSince(iso: string): number | null {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - then.getFullYear()
  const m = now.getMonth() - then.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < then.getDate())) age--
  return age
}
