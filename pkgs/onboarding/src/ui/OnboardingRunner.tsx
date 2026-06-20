import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { IDVFlow, type IDVCheckKind, type IDVStatusReport } from '@luxfi/id-idv'
import {
  ACCOUNT_TYPES,
  type AccountType,
  type FieldSpec,
  type FlowSpec,
  type FormData,
  type FormValue,
  type StepSpec,
} from '../domain/types.ts'
import {
  activeSteps,
  isLastStep,
  nextStepId,
  prevStepId,
  stepById,
  stepCompletionKey,
  validateStep,
  visibleFields,
  type StepErrors,
} from '../domain/machine.ts'
import { screenCountry } from '../domain/screening.ts'

/**
 * OnboardingRunner — the ONE component that renders any {@link FlowSpec}.
 *
 * It holds exactly two pieces of state: the answer map (`FormData`) and the
 * current step id. Everything about *which* step is shown, *which* fields are
 * visible, whether a step validates, and what comes next is delegated to the
 * pure `domain/machine`. Adding a step or field never touches this file — it
 * is an edit to `domain/flows`.
 *
 * Special step kinds get purpose-built panels (account-type selector, the IDV
 * document handoff via `@luxfi/id-idv`, the country-risk screening, and the
 * review/submit read-back); plain `form` steps are rendered field-by-field by
 * a single generic renderer that switches on `FieldKind`.
 *
 * Routing: the host owns the URL. `stepId` is controlled by the host (so the
 * resumable `/onboarding/$step` route maps a path segment to a step), and the
 * runner reports navigation via `onStepChange`. The host persists `data`
 * through the service between steps for resume.
 *
 * Clean-room Lux implementation. Tailwind utility classes match the lux/id web
 * app theme (`text-foreground`, `text-primary` = Lux green `#12FF80`, etc.).
 */
export interface OnboardingRunnerProps {
  /** The flow to render (`exchange-full` or `lite`, from `domain/flows`). */
  readonly flow: FlowSpec
  /** Current answers; the host owns this and persists it between steps. */
  readonly data: FormData
  /** Current step id (host-controlled, maps to `/onboarding/$step`). */
  readonly stepId: string
  /** IDV subject id (the IAM user id) for the document step. */
  readonly subjectId: string
  /** Tenant org slug for the IDV subject. */
  readonly orgId: string
  /** Patch answers (merge). The host saves a draft on each patch. */
  readonly onPatch: (patch: FormData) => void
  /** Navigate to another step. The host updates the URL. */
  readonly onStepChange: (stepId: string) => void
  /** Final submit, called from the review step with the complete answers. */
  readonly onSubmit: (data: FormData) => Promise<void> | void
  /** Where a hosted IDV vendor returns the user (defaults to current URL). */
  readonly idvRedirectUri?: string
}

export function OnboardingRunner({
  flow,
  data,
  stepId,
  subjectId,
  orgId,
  onPatch,
  onStepChange,
  onSubmit,
  idvRedirectUri,
}: OnboardingRunnerProps) {
  const step = stepById(flow, stepId)
  const steps = useMemo(() => activeSteps(flow, data), [flow, data])
  const index = steps.findIndex((s) => s.id === stepId)

  const [showErrors, setShowErrors] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const errors: StepErrors = step ? validateStep(step, data) : {}
  const stepValid = Object.keys(errors).length === 0

  const goNext = useCallback(() => {
    if (!step) return
    if (!stepValid) {
      setShowErrors(true)
      return
    }
    setShowErrors(false)
    const next = nextStepId(flow, data, stepId)
    if (next) onStepChange(next)
  }, [flow, data, stepId, step, stepValid, onStepChange])

  const goBack = useCallback(() => {
    setShowErrors(false)
    const prev = prevStepId(flow, data, stepId)
    if (prev) onStepChange(prev)
  }, [flow, data, stepId, onStepChange])

  const doSubmit = useCallback(async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit(data)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }, [data, onSubmit])

  if (!step) {
    return (
      <p role="alert" className="lux-id-ob-error text-sm text-danger-9">
        Unknown step “{stepId}”.
      </p>
    )
  }

  const kind = step.kind ?? 'form'
  const last = isLastStep(flow, data, stepId)
  const showBack = index > 0

  return (
    <section className="lux-id-ob mx-auto flex w-full max-w-lg flex-col gap-6">
      <Progress steps={steps} activeIndex={index} />

      <header className="lux-id-ob-head flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">{step.title}</h1>
        {step.byline ? <p className="text-sm text-muted-foreground">{step.byline}</p> : null}
      </header>

      <div className="lux-id-ob-body flex flex-col gap-4">
        {kind === 'account-type' ? (
          <AccountTypePanel
            value={typeof data.accountType === 'string' ? (data.accountType as AccountType) : undefined}
            onChoose={(t) => onPatch({ accountType: t, [stepCompletionKey(step)]: true })}
          />
        ) : null}

        {kind === 'form' ? (
          <FormPanel step={step} data={data} errors={errors} showErrors={showErrors} onPatch={onPatch} />
        ) : null}

        {kind === 'document' ? (
          <DocumentPanel
            step={step}
            subjectId={subjectId}
            orgId={orgId}
            email={typeof data.email === 'string' ? data.email : undefined}
            redirectUri={idvRedirectUri ?? currentUrl()}
            done={data[stepCompletionKey(step)] === true}
            onPassed={() => onPatch({ [stepCompletionKey(step)]: true })}
          />
        ) : null}

        {kind === 'screening' ? (
          <ScreeningPanel
            country={typeof data.country === 'string' ? data.country : undefined}
            onCleared={() => onPatch({ [stepCompletionKey(step)]: true })}
          />
        ) : null}

        {kind === 'review' ? <ReviewPanel flow={flow} data={data} /> : null}
      </div>

      {submitError ? (
        <p role="alert" className="lux-id-ob-error text-sm text-danger-9">
          {submitError}
        </p>
      ) : null}

      <nav className="lux-id-ob-actions flex items-center justify-between gap-3">
        {showBack ? (
          <button type="button" className="lux-id-btn-ghost" onClick={goBack} disabled={submitting}>
            Back
          </button>
        ) : (
          <span />
        )}
        {last ? (
          <button
            type="button"
            className="lux-id-btn-primary"
            onClick={doSubmit}
            disabled={submitting || !stepValid}
          >
            {submitting ? 'Submitting…' : 'Submit application'}
          </button>
        ) : (
          <button type="button" className="lux-id-btn-primary" onClick={goNext} disabled={submitting}>
            Continue
          </button>
        )}
      </nav>
    </section>
  )
}

// ── Progress ────────────────────────────────────────────────────────

/** Phase-grouped progress bar driven by the active steps' `phase`. */
function Progress({ steps, activeIndex }: { steps: readonly StepSpec[]; activeIndex: number }) {
  return (
    <div
      className="lux-id-ob-progress flex gap-1.5"
      role="progressbar"
      aria-valuenow={activeIndex + 1}
      aria-valuemax={steps.length}
    >
      {steps.map((s, i) => (
        <span
          key={s.id}
          aria-hidden
          className={
            'h-1 flex-1 rounded-full transition-colors ' +
            (i <= activeIndex ? 'bg-primary' : 'bg-border')
          }
        />
      ))}
    </div>
  )
}

// ── Account-type selector ───────────────────────────────────────────

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  individual: 'Individual',
  corporate: 'Corporation',
  llc: 'LLC',
  lp: 'Limited Partnership',
  trust: 'Trust',
  other: 'Other entity',
}

function AccountTypePanel({
  value,
  onChoose,
}: {
  value?: AccountType
  onChoose: (t: AccountType) => void
}) {
  return (
    <ul className="lux-id-ob-accttypes grid grid-cols-2 gap-3">
      {ACCOUNT_TYPES.map((t) => {
        const selected = value === t
        return (
          <li key={t}>
            <button
              type="button"
              onClick={() => onChoose(t)}
              aria-pressed={selected}
              className={
                'lux-id-acct-tile w-full rounded-xl border px-4 py-4 text-left text-sm transition-colors ' +
                (selected
                  ? 'border-primary bg-surface-2 text-foreground'
                  : 'border-border bg-surface text-muted-foreground hover:border-primary/60')
              }
            >
              {ACCOUNT_TYPE_LABELS[t]}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ── Generic form renderer ───────────────────────────────────────────

function FormPanel({
  step,
  data,
  errors,
  showErrors,
  onPatch,
}: {
  step: StepSpec
  data: FormData
  errors: StepErrors
  showErrors: boolean
  onPatch: (patch: FormData) => void
}) {
  const fields = visibleFields(step, data)
  return (
    <form
      className="lux-id-ob-form flex flex-col gap-4"
      onSubmit={(e: FormEvent) => e.preventDefault()}
      noValidate
    >
      {fields.map((field) => (
        <Field
          key={field.name}
          field={field}
          value={data[field.name]}
          error={showErrors ? errors[field.name] : undefined}
          onChange={(value) => onPatch({ [field.name]: value })}
        />
      ))}
    </form>
  )
}

/** One field, rendered by `kind`. The only place a control is chosen. */
function Field({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldSpec
  value: FormValue
  error?: string
  onChange: (value: FormValue) => void
}) {
  const id = `f-${field.name}`
  const describedBy = error ? `${id}-err` : field.help ? `${id}-help` : undefined

  if (field.kind === 'checkbox') {
    return (
      <div className="lux-id-field lux-id-field-check flex flex-col gap-1">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            id={id}
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            aria-describedby={describedBy}
          />
          <span>{field.label}</span>
        </label>
        {field.help ? (
          <p id={`${id}-help`} className="text-xs text-muted-foreground">
            {field.help}
          </p>
        ) : null}
        {error ? <FieldError id={`${id}-err`} msg={error} /> : null}
      </div>
    )
  }

  if (field.kind === 'select') {
    return (
      <div className="lux-id-field flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm text-foreground">
          {field.label}
        </label>
        <select
          id={id}
          className="lux-id-input rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
        >
          <option value="" disabled>
            Select…
          </option>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {field.help ? (
          <p id={`${id}-help`} className="text-xs text-muted-foreground">
            {field.help}
          </p>
        ) : null}
        {error ? <FieldError id={`${id}-err`} msg={error} /> : null}
      </div>
    )
  }

  // text-like inputs: text / email / tel / date / ssn-last4
  const inputType =
    field.kind === 'email'
      ? 'email'
      : field.kind === 'tel'
        ? 'tel'
        : field.kind === 'date'
          ? 'date'
          : 'text'
  return (
    <div className="lux-id-field flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-foreground">
        {field.label}
      </label>
      <input
        id={id}
        type={inputType}
        className="lux-id-input rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
        value={typeof value === 'string' ? value : ''}
        placeholder={field.placeholder}
        // SSN-last-4: 4 numeric digits, never the full SSN client-side.
        inputMode={field.kind === 'ssn-last4' ? 'numeric' : undefined}
        maxLength={field.kind === 'ssn-last4' ? 4 : undefined}
        onChange={(e) =>
          onChange(field.kind === 'ssn-last4' ? e.target.value.replace(/\D/g, '').slice(0, 4) : e.target.value)
        }
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
      />
      {field.help ? (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          {field.help}
        </p>
      ) : null}
      {error ? <FieldError id={`${id}-err`} msg={error} /> : null}
    </div>
  )
}

function FieldError({ id, msg }: { id: string; msg: string }) {
  return (
    <p id={id} role="alert" className="lux-id-field-err text-xs text-danger-9">
      {msg}
    </p>
  )
}

// ── Document (IDV handoff) ──────────────────────────────────────────

function DocumentPanel({
  step,
  subjectId,
  orgId,
  email,
  redirectUri,
  done,
  onPassed,
}: {
  step: StepSpec
  subjectId: string
  orgId: string
  email?: string
  redirectUri: string
  done: boolean
  onPassed: () => void
}) {
  const [report, setReport] = useState<IDVStatusReport | null>(null)
  const check: IDVCheckKind = step.check ?? 'document+selfie'

  if (done) {
    return (
      <p className="lux-id-ob-info rounded-lg border border-primary/40 bg-surface px-4 py-3 text-sm text-foreground">
        Identity verification complete.
      </p>
    )
  }

  return (
    <div className="lux-id-ob-idv flex flex-col gap-3">
      <IDVFlow
        subject={{ subjectId, orgId, email }}
        check={check}
        redirectUri={redirectUri}
        onChange={setReport}
        onTerminal={(r) => {
          setReport(r)
          if (r.status === 'passed') onPassed()
        }}
      />
      {report && report.status !== 'passed' && report.reason ? (
        <p role="alert" className="text-xs text-danger-9">
          {report.reason}
        </p>
      ) : null}
    </div>
  )
}

// ── Screening (country-risk / CIP) ──────────────────────────────────

function ScreeningPanel({ country, onCleared }: { country?: string; onCleared: () => void }) {
  const result = useMemo(() => screenCountry(country), [country])
  // A non-blocking result clears the step the moment it renders; a blocking
  // result never clears, so the runner keeps Continue disabled at submit.
  if (!result.blocking) onCleared()

  const toneClass =
    result.tone === 'error'
      ? 'border-danger-9/40 text-danger-9'
      : result.tone === 'warn'
        ? 'border-primary/40 text-foreground'
        : 'border-border text-muted-foreground'

  return (
    <div className={'lux-id-ob-screening rounded-lg border bg-surface px-4 py-3 text-sm ' + toneClass}>
      <p className="font-medium">
        {result.action === 'allow'
          ? 'Cleared'
          : result.action === 'block'
            ? 'Cannot proceed'
            : 'Additional review'}
      </p>
      <p className="mt-1 text-muted-foreground">{result.message}</p>
    </div>
  )
}

// ── Review / submit read-back ───────────────────────────────────────

function ReviewPanel({ flow, data }: { flow: FlowSpec; data: FormData }) {
  // Read back every visible answer across the active form steps, in order.
  const rows = useMemo(() => {
    const out: { label: string; value: string }[] = []
    for (const step of activeSteps(flow, data)) {
      for (const field of visibleFields(step, data)) {
        const v = data[field.name]
        if (v === undefined || v === '') continue
        out.push({ label: field.label, value: renderValue(field, v) })
      }
    }
    return out
  }, [flow, data])

  return (
    <dl className="lux-id-ob-review grid grid-cols-1 gap-3">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing to review.</p>
      ) : (
        rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-4 border-b border-border pb-2">
            <dt className="text-sm text-muted-foreground">{r.label}</dt>
            <dd className="text-sm text-foreground">{r.value}</dd>
          </div>
        ))
      )}
    </dl>
  )
}

/** Human-render a stored field value for the review read-back. */
function renderValue(field: FieldSpec, v: FormValue): string {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (field.kind === 'ssn-last4') return `••• •• ${v}`
  if (field.kind === 'select') {
    const opt = field.options?.find((o) => o.value === v)
    return opt ? opt.label : String(v)
  }
  return String(v)
}

function currentUrl(): string {
  return typeof window !== 'undefined' ? window.location.href : 'https://lux.id/onboarding'
}
