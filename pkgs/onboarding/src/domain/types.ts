/**
 * Onboarding domain — the declarative flow model.
 *
 * The whole point of this package: an onboarding/verification flow is *data*,
 * not code. One runner (`ui/OnboardingRunner`) consumes a `FlowSpec` — an
 * ordered list of `StepSpec`s, each a list of `FieldSpec`s — and renders it.
 * Adding a step, reordering, or standing up a whole new app's flow is a config
 * edit here, never a new route or component.
 *
 * Two flows ship (see `domain/flows`):
 *   • `exchange-full` — the regulated Lux-exchange KYC: account-type select →
 *     identity (legal name, DOB, residential address, gov-ID / SSN-last4) →
 *     accreditation → document upload → country-risk / CIP screening →
 *     review + submit.
 *   • `lite` — the minimal AI-app flow: email-verified, name, done.
 *
 * This module is React-free and fully serializable (predicates aside), so the
 * UI layer renders it without the domain importing React, and a host can
 * persist a resume point.
 *
 * Clean-room: original Lux design. The `enabledWhen` progressive-reveal idea
 * is a common config-driven-form pattern; this implementation is written here.
 */

/** Stable id for a flow (the `?flow=` selector + draft-storage key suffix). */
export type FlowId = 'exchange-full' | 'lite'

/**
 * The kind of account a regulated applicant is opening. Drives which entity
 * steps reveal. `individual` covers a natural person; the rest are entities.
 */
export type AccountType =
  | 'individual'
  | 'corporate'
  | 'llc'
  | 'lp'
  | 'trust'
  | 'other'

export const ACCOUNT_TYPES: readonly AccountType[] = [
  'individual',
  'corporate',
  'llc',
  'lp',
  'trust',
  'other',
] as const

export function isAccountType(v: string): v is AccountType {
  return (ACCOUNT_TYPES as readonly string[]).includes(v)
}

/**
 * Accumulated answers across a flow, keyed by `FieldSpec.name`. Values are the
 * primitive form values (string for text/select/date, boolean for checkbox,
 * string for the chosen account type / uploaded-document handle). Serializable
 * so a draft round-trips through storage untouched.
 */
export type FormData = Record<string, FormValue>
export type FormValue = string | boolean | undefined

/** A single input within a step. The renderer switches on `kind`. */
export interface FieldSpec {
  /** Key into {@link FormData}. Unique within the whole flow. */
  readonly name: string
  /** Visible label. */
  readonly label: string
  /** Input kind the generic renderer maps to a control. */
  readonly kind: FieldKind
  /** Placeholder for text-like inputs. */
  readonly placeholder?: string
  /** One-line help under the field. */
  readonly help?: string
  /** Required-ness. A required field with an empty value blocks Continue. */
  readonly required?: boolean
  /** Options for `select`. */
  readonly options?: readonly FieldOption[]
  /** Extra per-field validation beyond required/format. Returns an error or null. */
  readonly validate?: (value: FormValue, data: FormData) => string | null
  /**
   * Per-field visibility predicate (e.g. visa fields only for non-US). When it
   * returns false the field is hidden AND not validated.
   */
  readonly visibleWhen?: (data: FormData) => boolean
}

export type FieldKind =
  | 'text'
  | 'email'
  | 'tel'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'ssn-last4' // 4-digit last-4-of-SSN (regulated identity, never full SSN client-side)

export interface FieldOption {
  readonly value: string
  readonly label: string
}

/**
 * What a step *does*. Most steps are `form` (render their fields). A few are
 * special and the runner hands them to a purpose-built component:
 *   • `account-type` — the entity/individual selector (writes `accountType`).
 *   • `document`     — government-ID / KYB document capture (the IDV handoff).
 *   • `screening`    — country-risk + CIP-lite check; advisory, may warn.
 *   • `review`       — read-back of everything + submit.
 */
export type StepKind = 'form' | 'account-type' | 'document' | 'screening' | 'review'

/** A high-level grouping for the progress bar. */
export type Phase = 1 | 2 | 3

/** One step in a flow. */
export interface StepSpec {
  /** URL-safe id; the route is `/onboarding/$step` where $step === this id. */
  readonly id: string
  /** Heading at the top of the step. */
  readonly title: string
  /** One-line subhead under the title. */
  readonly byline?: string
  /** What the step does; defaults to `form`. */
  readonly kind?: StepKind
  /** Progress-bar phase; defaults to 1. */
  readonly phase?: Phase
  /** Fields for a `form` step. */
  readonly fields?: readonly FieldSpec[]
  /**
   * Progressive-reveal predicate. When present and it returns false, the step
   * is skipped in both directions (Continue and Back) so one flow definition
   * can declare every possible step and reveal each based on prior answers.
   *
   * e.g. accreditation only for the regulated path; entity-info steps only for
   * the matching account type.
   */
  readonly enabledWhen?: (data: FormData) => boolean
  /** For `document` steps: which IDV check to run. */
  readonly check?: 'document' | 'document+selfie' | 'business'
}

/** A complete, named flow. */
export interface FlowSpec {
  readonly id: FlowId
  /** Display name used in headers / the success screen. */
  readonly title: string
  /** Ordered superset of steps; `enabledWhen` decides which actually show. */
  readonly steps: readonly StepSpec[]
}
