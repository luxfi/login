// @luxfi/id-onboarding — the composable onboarding + IDV/KYC framework.
//
// A flow is *data*: an ordered list of step descriptors (`FlowSpec`), each a
// list of field descriptors. One pure machine (`domain/machine`) walks it —
// reveals, validation, resume point — and one React runner (`ui/Onboarding
// Runner`) renders it. Two flows ship: `exchange-full` (regulated KYC) and
// `lite` (email-verified minimal). IDV is delegated to @luxfi/id-idv; auth is
// @hanzo/iam via @luxfi/id-auth. Domain / service / UI split.

// ── Domain: the declarative model ───────────────────────────────────
export {
  ACCOUNT_TYPES,
  isAccountType,
  type AccountType,
  type FieldKind,
  type FieldOption,
  type FieldSpec,
  type FlowId,
  type FlowSpec,
  type FormData,
  type FormValue,
  type Phase,
  type StepKind,
  type StepSpec,
} from './domain/types'

export { EXCHANGE_FULL, LITE, FLOWS, flowById } from './domain/flows'

// ── Domain: the pure flow machine ───────────────────────────────────
export {
  activeSteps,
  activeIndex,
  stepById,
  firstStepId,
  nextStepId,
  prevStepId,
  isLastStep,
  visibleFields,
  validateStep,
  isStepComplete,
  firstIncompleteStep,
  isFlowComplete,
  stepCompletionKey,
  type StepErrors,
} from './domain/machine'

// ── Domain: country-risk / CIP screening ────────────────────────────
export {
  screenCountry,
  type RiskAction,
  type ScreeningResult,
} from './domain/screening'

// ── Service: IAM-backed persistence ─────────────────────────────────
export {
  createOnboardingService,
  type OnboardingService,
  type OnboardingServiceOptions,
  type ApplicationDraft,
  type Result,
} from './service/onboarding'

// ── UI: the runner that renders any FlowSpec ────────────────────────
export { OnboardingRunner, type OnboardingRunnerProps } from './ui/OnboardingRunner'
