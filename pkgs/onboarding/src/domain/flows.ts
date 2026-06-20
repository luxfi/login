/**
 * The two shipped flows, declared as data.
 *
 *   • `exchange-full` — the regulated Lux-exchange onboarding, modelled on the
 *     aggressive "get people in fast, verify only when money moves" pattern.
 *     Every possible step is declared once; `enabledWhen` predicates reveal the
 *     heavier compliance steps only when a prior answer triggers them. Order:
 *       account-type → name → birthday → address → (entity info) → funding →
 *       (accreditation) → (ID verification) → (screening) → review.
 *
 *     Friction is deferred, not front-loaded:
 *       - SSN / tax-id is collected only once the applicant chooses to fund.
 *       - Government-ID verification (the IDV document handoff) reveals ONLY for
 *         a deposit of $5,000 or more — small / "fund later" applicants skip it
 *         entirely and reach `review` in a handful of single-question screens.
 *       - Country-risk screening reveals only for non-US residents.
 *   • `lite` — the minimal AI-app flow: email already verified by `@hanzo/iam`,
 *     so this just collects a display name and lands on review.
 *
 * This module is the ONLY place a flow is described. Adding a field, a step, or
 * a whole new flow is an edit here — never a new route or component. The runner
 * (`ui/OnboardingRunner`) and the resolver (`domain/machine`) consume these
 * specs unchanged.
 *
 * Clean-room: original Lux flow definitions. The set of regulated steps (CIP
 * identity, deposit-tier gating, document capture, country-risk screening) is
 * dictated by US BD/ATS onboarding requirements, not by any prior source; field
 * copy and predicates are written here.
 */
import {
  isAccountType,
  type FieldSpec,
  type FlowSpec,
  type FormData,
  type StepSpec,
} from './types'

/**
 * Deposit threshold (USD) at or above which a government-ID verification is
 * required before the account opens. Below it — including "fund later" — the
 * applicant onboards with no document upload. Single source for the gate AND
 * the copy that explains it.
 */
export const IDV_DEPOSIT_THRESHOLD = 5000

// ── Shared predicates ───────────────────────────────────────────────

/** True for an individual (natural-person) applicant. */
const isIndividual = (d: FormData): boolean => d.accountType === 'individual'

/** True for any entity (everything that is not an individual). */
const isEntity = (d: FormData): boolean =>
  typeof d.accountType === 'string' && isAccountType(d.accountType) && d.accountType !== 'individual'

/** True when the applicant declared a non-US country of residence. */
const isNonUs = (d: FormData): boolean =>
  typeof d.country === 'string' && d.country.length > 0 && d.country !== 'US'

/** True once the applicant chose to fund now (either deposit tier), not later. */
const isFunding = (d: FormData): boolean =>
  d.fundingPlan === 'standard' || d.fundingPlan === 'large'

/**
 * True only when the chosen deposit tier is at/above {@link IDV_DEPOSIT_THRESHOLD}.
 * This is the single gate for the document (photo-ID) step: small and
 * fund-later applicants never see it.
 */
const requiresIdv = (d: FormData): boolean => d.fundingPlan === 'large'

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

// Identity is split into single-question screens (name → birthday → address)
// so each ask is a fast, focused tap on mobile rather than one dense form.

const nameStep: StepSpec = {
  id: 'name',
  title: 'What’s your name?',
  byline: 'It helps us verify your identity. Use your legal name.',
  phase: 1,
  fields: [
    { name: 'legalFirstName', label: 'Legal first name', kind: 'text', required: true },
    { name: 'legalLastName', label: 'Legal last name', kind: 'text', required: true },
  ],
}

const dobStep: StepSpec = {
  id: 'birthday',
  title: 'When’s your birthday?',
  byline: 'You must be 18 or older to open an account.',
  phase: 1,
  fields: [
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
  ],
}

const addressStep: StepSpec = {
  id: 'address',
  title: 'What’s your address?',
  byline: 'It helps us verify your identity — we won’t send you marketing mail.',
  phase: 1,
  fields: [COUNTRY_FIELD, ...addressFields],
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

/**
 * Funding intent — the pivot that keeps onboarding aggressive. Picking "fund
 * later" lands the applicant on review with no SSN and no document upload. The
 * tax-id / SSN fields reveal only once they choose to deposit; the document
 * (photo-ID) step reveals only for the $5,000+ tier (see `requiresIdv`).
 */
const fundingStep: StepSpec = {
  id: 'funding',
  title: 'How would you like to start?',
  byline: 'Explore Lux first and fund whenever you’re ready — no verification to look around.',
  phase: 2,
  fields: [
    {
      name: 'fundingPlan',
      label: 'Choose how you’d like to begin',
      kind: 'select',
      required: true,
      options: [
        { value: 'later', label: 'Explore first — fund my account later' },
        { value: 'standard', label: `Deposit under $${IDV_DEPOSIT_THRESHOLD.toLocaleString()}` },
        {
          value: 'large',
          label: `Deposit $${IDV_DEPOSIT_THRESHOLD.toLocaleString()} or more`,
        },
      ],
      help: `Deposits of $${IDV_DEPOSIT_THRESHOLD.toLocaleString()}+ require a quick photo-ID check; smaller amounts don’t.`,
    },
    {
      name: 'ssnLast4',
      label: 'Last 4 of SSN',
      kind: 'ssn-last4',
      help: 'US persons funding an account — required by the IRS for a regulated exchange. We never collect your full SSN in the browser.',
      // Only US persons who chose to fund; hidden (and unvalidated) otherwise.
      visibleWhen: (d) => isFunding(d) && !isNonUs(d),
      required: true,
      validate: (v) => (typeof v === 'string' && /^\d{4}$/.test(v) ? null : 'Enter the last 4 digits.'),
    },
    {
      name: 'taxId',
      label: 'Tax identification number',
      kind: 'text',
      help: 'Your local tax ID (non-US residents funding an account).',
      visibleWhen: (d) => isFunding(d) && isNonUs(d),
      required: true,
    },
  ],
}

const accreditationStep: StepSpec = {
  id: 'accreditation',
  title: 'Accreditation',
  byline: 'Regulated offerings require an accredited-investor attestation.',
  phase: 2,
  // Entities attest accreditation up front; individuals are not gated on it to
  // start, so this is skipped for the natural-person path.
  enabledWhen: isEntity,
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
  byline: `A quick government-ID + selfie check — required for deposits of $${IDV_DEPOSIT_THRESHOLD.toLocaleString()} or more. Handled by our verification partner.`,
  kind: 'document',
  phase: 3,
  // Individuals scan a document + selfie; entities run a business (KYB) check.
  check: 'document+selfie',
}

const entityDocumentStep: StepSpec = {
  id: 'entity-document',
  title: 'Verify the entity',
  byline: 'Upload formation documents and beneficial-ownership information.',
  kind: 'document',
  phase: 3,
  enabledWhen: isEntity,
  check: 'business',
}

const screeningStep: StepSpec = {
  id: 'screening',
  title: 'Compliance check',
  byline: 'A jurisdiction and sanctions screening against your declared country.',
  kind: 'screening',
  phase: 3,
  // US residents clear automatically; only surface this screen for non-US.
  enabledWhen: isNonUs,
}

const reviewStep: StepSpec = {
  id: 'review',
  title: 'Review & submit',
  byline: 'Confirm everything is correct, then submit your application.',
  kind: 'review',
  phase: 3,
}

/**
 * The regulated exchange flow. Every possible step is listed once in order;
 * `enabledWhen` keeps the default individual path short (account-type → name →
 * birthday → address → funding → review) and reveals SSN, document IDV,
 * accreditation, entity, and screening only when an answer triggers them.
 */
export const EXCHANGE_FULL: FlowSpec = {
  id: 'exchange-full',
  title: 'Lux Exchange',
  steps: [
    accountTypeStep,
    nameStep,
    dobStep,
    addressStep,
    entityStep,
    fundingStep,
    accreditationStep,
    { ...documentStep, enabledWhen: (d) => isIndividual(d) && requiresIdv(d) },
    entityDocumentStep,
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
