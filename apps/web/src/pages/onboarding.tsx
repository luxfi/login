import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { useIam } from '@hanzo/iam/react'
import { getBrand } from '@luxfi/id-auth'
import {
  createOnboardingService,
  firstIncompleteStep,
  firstStepId,
  flowById,
  OnboardingRunner,
  type FlowId,
  type FormData,
} from '@luxfi/id-onboarding'
import { LuxMark } from '~/components/lux-mark'
import { ensureIdvProvider } from '~/lib/idv'

/**
 * Onboarding page — the resumable KYC surface.
 *
 * Mounts the `@luxfi/id-onboarding` runner against an IAM-backed service. The
 * URL is the source of truth for the current step (`/onboarding/$step`); a bare
 * `/onboarding` resolves the resume point (first incomplete step) and replaces
 * the URL with it. The flow is selected by `?flow=lite|exchange-full`
 * (defaults to the regulated `exchange-full`).
 *
 * Post-auth handoff: an unauthenticated visitor is bounced to the login
 * surface (`/`). After login the host sends users with an incomplete profile
 * here — this page then lands them on their resume step.
 *
 * Answers persist to IAM on every change (debounced) so a reload or a hosted-
 * IDV redirect round-trips back to the same step with the same data.
 */
export function OnboardingPage() {
  const iam = useIam()
  const navigate = useNavigate()
  const { step: stepParam } = useParams({ strict: false }) as { step?: string }
  const search = useSearch({ strict: false }) as { flow?: string }

  // Register a dev IDV provider once so the document step can mint sessions.
  ensureIdvProvider()

  const brand = useMemo(() => getBrand(), [])
  const flowId: FlowId = search.flow === 'lite' ? 'lite' : 'exchange-full'
  const flow = useMemo(() => flowById(flowId), [flowId])

  const service = useMemo(
    () =>
      createOnboardingService({
        iamUrl: brand.iamServerUrl,
        orgId: 'lux',
        getAccessToken: () => iam.accessToken,
      }),
    [brand.iamServerUrl, iam.accessToken],
  )

  const [data, setData] = useState<FormData>({})
  const [loaded, setLoaded] = useState(false)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)

  // ── Auth gate: bounce anonymous visitors to the login surface. ──────
  useEffect(() => {
    if (!iam.isLoading && !iam.isAuthenticated) {
      navigate({ to: '/', replace: true })
    }
  }, [iam.isLoading, iam.isAuthenticated, navigate])

  // ── Load any saved draft once authenticated (resume). ───────────────
  useEffect(() => {
    if (!iam.isAuthenticated) return
    let cancelled = false
    service.loadDraft().then((draft) => {
      if (cancelled) return
      if (draft && draft.flow === flowId) {
        setData(draft.data)
        setAlreadySubmitted(draft.submitted)
      }
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [iam.isAuthenticated, service, flowId])

  // ── Resolve a bare /onboarding to the resume step. ──────────────────
  // A user who already submitted is done — send them on to the exchange
  // rather than back into the (now read-only) flow. Otherwise land on the
  // first incomplete step, or the head of the flow for a brand-new applicant.
  useEffect(() => {
    if (!loaded || stepParam) return
    if (alreadySubmitted) {
      window.location.replace(brand.exchangeHost)
      return
    }
    const resume = firstIncompleteStep(flow, data) ?? firstStepId(flow, data)
    navigate({ to: '/onboarding/$step', params: { step: resume }, search: { flow: flowId }, replace: true })
  }, [loaded, stepParam, alreadySubmitted, flow, data, flowId, brand.exchangeHost, navigate])

  // ── Debounced persistence of answers. ───────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persist = useCallback(
    (next: FormData) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        void service.saveDraft({ flow: flowId, data: next })
      }, 600)
    },
    [service, flowId],
  )

  const onPatch = useCallback(
    (patch: FormData) => {
      setData((prev) => {
        const next = { ...prev, ...patch }
        persist(next)
        return next
      })
    },
    [persist],
  )

  const onStepChange = useCallback(
    (step: string) => {
      navigate({ to: '/onboarding/$step', params: { step }, search: { flow: flowId } })
    },
    [navigate, flowId],
  )

  const onSubmit = useCallback(
    async (final: FormData) => {
      const res = await service.submit({ flow: flowId, data: final })
      if (!res.ok) throw new Error(res.error)
      navigate({ to: '/onboarding/$step', params: { step: 'done' }, search: { flow: flowId }, replace: true })
    },
    [service, flowId, navigate],
  )

  // ── Render states ───────────────────────────────────────────────────
  const subjectId = iam.user ? `${iam.user.owner}/${iam.user.name}` : ''

  if (iam.isLoading || !iam.isAuthenticated || !loaded) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5">
        <LuxMark className="text-foreground" />
        <p className="text-sm text-muted-foreground">Loading your application…</p>
      </main>
    )
  }

  // The terminal success screen lives at /onboarding/done.
  if (stepParam === 'done') {
    return <OnboardingDone flowId={flowId} />
  }

  // Waiting for the redirect to the resume step.
  if (!stepParam) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5">
        <LuxMark className="text-foreground" />
        <p className="text-sm text-muted-foreground">Resuming…</p>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col items-center gap-10 px-5 py-12">
      <div className="flex flex-col items-center gap-2">
        <LuxMark className="text-foreground" />
        <p className="text-sm text-muted-foreground">{flow.title} — verification</p>
      </div>
      <OnboardingRunner
        flow={flow}
        data={data}
        stepId={stepParam}
        subjectId={subjectId}
        orgId="lux"
        onPatch={onPatch}
        onStepChange={onStepChange}
        onSubmit={onSubmit}
      />
    </main>
  )
}

/** Terminal success screen after submit. */
function OnboardingDone({ flowId }: { flowId: FlowId }) {
  const title = flowId === 'lite' ? 'Lux' : 'Lux Exchange'
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-5 text-center">
      <LuxMark className="text-foreground" />
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-semibold text-primary">Application submitted</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Thanks — your {title} application is in review. We’ll email you as soon as it’s approved.
        </p>
      </div>
      <a href={getBrand().exchangeHost} className="lux-id-btn-primary no-underline">
        Continue to {title}
      </a>
    </main>
  )
}
