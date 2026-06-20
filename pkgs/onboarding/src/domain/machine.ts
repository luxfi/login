/**
 * Flow machine — the pure, React-free engine that walks a {@link FlowSpec}.
 *
 * Everything stateful about *navigating* a flow lives here as plain functions
 * over `(flow, data, stepId)`:
 *
 *   • `activeSteps`    — the steps actually shown, after `enabledWhen` reveals.
 *   • `nextStepId` / `prevStepId` — move through the active steps only, so a
 *     disabled step is skipped in both directions.
 *   • `visibleFields`  — the fields shown for a step, after `visibleWhen`.
 *   • `validateStep`   — field errors for a step (required + custom + format),
 *     ignoring hidden fields.
 *   • `firstIncompleteStep` — the resume point: the first active step that
 *     fails validation. Drives `/onboarding` → `/onboarding/$step` and the
 *     post-auth handoff (incomplete profile → onboarding).
 *
 * The UI layer (`ui/OnboardingRunner`) holds only the answer map and the
 * current step id, and calls into here. The domain never imports React.
 *
 * Clean-room: original Lux implementation.
 */
import type { FieldSpec, FlowSpec, FormData, FormValue, StepSpec } from './types.ts'

/** Map of `fieldName → error message` for the invalid fields in a step. */
export type StepErrors = Record<string, string>

/** Steps whose `enabledWhen` predicate passes (or is absent), in flow order. */
export function activeSteps(flow: FlowSpec, data: FormData): StepSpec[] {
  return flow.steps.filter((s) => !s.enabledWhen || s.enabledWhen(data))
}

/** The index of `stepId` within the active steps, or -1 if not active. */
export function activeIndex(flow: FlowSpec, data: FormData, stepId: string): number {
  return activeSteps(flow, data).findIndex((s) => s.id === stepId)
}

/** Resolve a step spec by id regardless of enabled state, or undefined. */
export function stepById(flow: FlowSpec, stepId: string): StepSpec | undefined {
  return flow.steps.find((s) => s.id === stepId)
}

/** The id of the first active step (where `/onboarding` lands by default). */
export function firstStepId(flow: FlowSpec, data: FormData): string {
  const steps = activeSteps(flow, data)
  if (steps.length === 0) throw new Error(`flow ${flow.id} has no active steps`)
  return steps[0]!.id
}

/**
 * The active step after `stepId`, or null at the end of the flow. Because the
 * set of active steps depends on `data`, pass the latest answers so a step that
 * a prior answer just revealed/hid is accounted for.
 */
export function nextStepId(flow: FlowSpec, data: FormData, stepId: string): string | null {
  const steps = activeSteps(flow, data)
  const i = steps.findIndex((s) => s.id === stepId)
  if (i < 0 || i + 1 >= steps.length) return null
  return steps[i + 1]!.id
}

/** The active step before `stepId`, or null at the head of the flow. */
export function prevStepId(flow: FlowSpec, data: FormData, stepId: string): string | null {
  const steps = activeSteps(flow, data)
  const i = steps.findIndex((s) => s.id === stepId)
  if (i <= 0) return null
  return steps[i - 1]!.id
}

/** True when `stepId` is the last active step (the review/submit step). */
export function isLastStep(flow: FlowSpec, data: FormData, stepId: string): boolean {
  return nextStepId(flow, data, stepId) === null
}

/** The fields of a step whose `visibleWhen` passes (or is absent). */
export function visibleFields(step: StepSpec, data: FormData): FieldSpec[] {
  if (!step.fields) return []
  return step.fields.filter((f) => !f.visibleWhen || f.visibleWhen(data))
}

/**
 * Validate a single step against the current answers. Hidden fields are
 * neither required nor validated. Returns an empty object when the step is
 * complete. Non-form steps (account-type, document, screening, review) carry
 * their completeness in `data` via a synthetic field name (see
 * `stepCompletionKey`) and are validated against that.
 */
export function validateStep(step: StepSpec, data: FormData): StepErrors {
  const errors: StepErrors = {}

  // Special steps record their own completion flag rather than form fields.
  const kind = step.kind ?? 'form'
  if (kind !== 'form') {
    const key = stepCompletionKey(step)
    // `review` needs no precondition; the others must have recorded a result.
    if (kind !== 'review' && data[key] !== true) {
      errors[key] = pendingMessage(kind)
    }
    return errors
  }

  for (const field of visibleFields(step, data)) {
    const value = data[field.name]
    if (field.required && isEmpty(value)) {
      errors[field.name] = `${field.label} is required.`
      continue
    }
    if (!isEmpty(value) && field.validate) {
      const msg = field.validate(value, data)
      if (msg) errors[field.name] = msg
    }
  }
  return errors
}

/** True when a step has no validation errors against the current answers. */
export function isStepComplete(step: StepSpec, data: FormData): boolean {
  return Object.keys(validateStep(step, data)).length === 0
}

/**
 * The resume point: the first active step that is not yet complete. Returns
 * null when every active step validates (the flow is finished). Used to route
 * `/onboarding` to the right `$step` and to decide, post-login, whether a user
 * with an incomplete profile must be sent into onboarding.
 */
export function firstIncompleteStep(flow: FlowSpec, data: FormData): string | null {
  for (const step of activeSteps(flow, data)) {
    if (!isStepComplete(step, data)) return step.id
  }
  return null
}

/**
 * Whether the whole flow is complete for the given answers — the gate the
 * host checks before calling its submit/`onComplete`.
 */
export function isFlowComplete(flow: FlowSpec, data: FormData): boolean {
  return firstIncompleteStep(flow, data) === null
}

/**
 * Synthetic `FormData` key a non-form step uses to record completion. e.g. the
 * `document` step sets `__done:document = true` once IDV returns `passed`; the
 * `screening` step sets `__done:screening = true` once the check clears.
 * Keeping it inside `FormData` means the whole flow's progress round-trips
 * through one serializable map (drafts, resume) with no side channel.
 */
export function stepCompletionKey(step: StepSpec): string {
  return `__done:${step.id}`
}

// ── internals ───────────────────────────────────────────────────────

function isEmpty(v: FormValue): boolean {
  if (v === undefined) return true
  if (typeof v === 'string') return v.trim().length === 0
  // booleans (checkboxes) are never "empty"; false is a valid answer.
  return false
}

function pendingMessage(kind: StepSpec['kind']): string {
  switch (kind) {
    case 'account-type':
      return 'Choose an account type to continue.'
    case 'document':
      return 'Complete identity verification to continue.'
    case 'screening':
      return 'The compliance check has not cleared yet.'
    default:
      return 'This step is not complete.'
  }
}
