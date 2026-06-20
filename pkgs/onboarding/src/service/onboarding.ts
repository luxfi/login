/**
 * Onboarding service — IAM-backed persistence for a KYC application.
 *
 * One way: every read/write goes through the canonical IAM REST surface under
 * `/v1/iam/*` (the same Casdoor-compat paths the auth client uses), carrying
 * the user's bearer token. There is no separate onboarding backend — the
 * application draft lives on the IAM user record, which is the identity
 * registry.
 *
 *   loadDraft()    GET  /v1/iam/get-account            → saved answers (resume)
 *   saveDraft()    POST /v1/iam/update-user (scoped)   ← persist answers
 *   submit()       POST /v1/iam/update-user (scoped)   ← mark submitted
 *
 * Answers are JSON-serialized into a single scoped user column
 * (`properties.luxOnboarding`) so a partially-completed application
 * round-trips through one field and the rest of the user row is untouched
 * (Casdoor replaces unscoped writes wholesale). SSN-last-4 is the only
 * regulated identifier collected client-side; full SSN never is.
 *
 * Token is supplied by the host through `getAccessToken` (the portal already
 * holds the session after login). The service never stores it.
 *
 * Clean-room: original Lux implementation, following the @hanzo/id-onboarding
 * service shape (Result-typed, column-scoped IAM writes, fetch-injectable).
 */
import type { FlowId, FormData } from '../domain/types.ts'

/** Result of a write that can fail gracefully (no throw on expected errors). */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string }

/** A persisted application draft: which flow, the answers, and submit state. */
export interface ApplicationDraft {
  readonly flow: FlowId
  readonly data: FormData
  readonly submitted: boolean
  /** Unix-ms of the last save; absent for a brand-new applicant. */
  readonly updatedAt?: number
}

export interface OnboardingService {
  /** The signed-in user's `{owner, name}`, or null when no session. */
  account(): Promise<{ owner: string; name: string } | null>
  /** Saved draft for the signed-in user, or null when none exists. */
  loadDraft(): Promise<ApplicationDraft | null>
  /** Persist the current answers (partial save / resume point). */
  saveDraft(input: { flow: FlowId; data: FormData }): Promise<Result<ApplicationDraft>>
  /** Persist the answers and mark the application submitted. */
  submit(input: { flow: FlowId; data: FormData }): Promise<Result<ApplicationDraft>>
}

export interface OnboardingServiceOptions {
  /** IAM origin, no trailing slash (the Lux brand issuer, i.e. lux.id). */
  readonly iamUrl: string
  /** Owning org slug, carried as the default `owner` on writes. */
  readonly orgId: string
  /** Bearer-token provider; resolves null when no session is present. */
  readonly getAccessToken: () => Promise<string | null> | string | null
  /** Override fetch (testing). Defaults to global fetch. */
  readonly fetchImpl?: typeof fetch
}

/** IAM user-property key the application draft is serialized under. */
const DRAFT_PROPERTY = 'luxOnboarding'

const trimSlash = (s: string): string => s.replace(/\/+$/, '')

export function createOnboardingService(opts: OnboardingServiceOptions): OnboardingService {
  const base = trimSlash(opts.iamUrl)
  const f = opts.fetchImpl ?? fetch

  async function authHeaders(json = true): Promise<HeadersInit> {
    const token = await opts.getAccessToken()
    const h: Record<string, string> = { Accept: 'application/json' }
    if (json) h['Content-Type'] = 'application/json'
    if (token) h.Authorization = `Bearer ${token}`
    return h
  }

  /** Read the signed-in user's `{owner, name}` + raw row from get-account. */
  async function getAccountRow(): Promise<{
    owner: string
    name: string
    properties: Record<string, unknown>
  } | null> {
    const url = new URL('/v1/iam/get-account', base)
    try {
      const res = await f(url.toString(), { headers: await authHeaders(false), credentials: 'include' })
      if (!res.ok) return null
      const body = (await res.json()) as Record<string, unknown>
      const data = (body.data ?? body) as Record<string, unknown>
      const owner = typeof data.owner === 'string' ? data.owner : ''
      const name = typeof data.name === 'string' ? data.name : ''
      if (!owner || !name) return null
      const properties =
        typeof data.properties === 'object' && data.properties !== null
          ? (data.properties as Record<string, unknown>)
          : {}
      return { owner, name, properties }
    } catch {
      return null
    }
  }

  async function account(): Promise<{ owner: string; name: string } | null> {
    const row = await getAccountRow()
    return row ? { owner: row.owner, name: row.name } : null
  }

  async function loadDraft(): Promise<ApplicationDraft | null> {
    const row = await getAccountRow()
    if (!row) return null
    const raw = row.properties[DRAFT_PROPERTY]
    if (typeof raw !== 'string' || raw.length === 0) return null
    return parseDraft(raw)
  }

  async function persist(
    input: { flow: FlowId; data: FormData },
    submitted: boolean,
  ): Promise<Result<ApplicationDraft>> {
    const row = await getAccountRow()
    if (!row) return { ok: false, error: 'not signed in' }

    const draft: ApplicationDraft = {
      flow: input.flow,
      data: input.data,
      submitted,
      updatedAt: Date.now(),
    }
    // Merge into the existing properties bag so unrelated props survive.
    const properties = { ...row.properties, [DRAFT_PROPERTY]: JSON.stringify(draft) }

    const url = new URL('/v1/iam/update-user', base)
    url.searchParams.set('id', `${row.owner}/${row.name}`)
    // Scope the write to the single `properties` column so the rest of the
    // user row is untouched (Casdoor replaces unscoped writes wholesale).
    url.searchParams.set('columns', 'properties')
    try {
      const res = await f(url.toString(), {
        method: 'POST',
        headers: await authHeaders(),
        credentials: 'include',
        body: JSON.stringify({ owner: row.owner, name: row.name, properties }),
      })
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (body.status === 'error') return { ok: false, error: msgOf(body) }
      return { ok: true, value: draft }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  }

  return {
    account,
    loadDraft,
    saveDraft: (input) => persist(input, false),
    submit: (input) => persist(input, true),
  }
}

/** Parse a serialized draft, tolerating shape drift; null if unusable. */
function parseDraft(raw: string): ApplicationDraft | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const obj = parsed as Record<string, unknown>
  const flow = obj.flow === 'lite' ? 'lite' : 'exchange-full'
  const data =
    typeof obj.data === 'object' && obj.data !== null ? (obj.data as FormData) : ({} as FormData)
  return {
    flow,
    data,
    submitted: obj.submitted === true,
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : undefined,
  }
}

function msgOf(body: Record<string, unknown>): string {
  return typeof body.msg === 'string' && body.msg ? body.msg : 'request failed'
}
