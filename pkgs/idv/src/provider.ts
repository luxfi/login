/**
 * IDV (identity-verification) provider contract.
 *
 * The Lux onboarding engine triggers document/biometric verification through
 * a single pluggable interface so the portal never hard-couples to one KYC
 * vendor. A provider knows how to:
 *
 *   1. start  — mint a verification session for a subject + check kind,
 *   2. status — report the current/terminal verdict of a session,
 *   3. cancel — (optional) abandon an in-flight session.
 *
 * Vendors (Persona, Onfido, Veriff, Sumsub, a custom BD backend) or the
 * in-process `stub` register at app startup via `registerProvider`. The UI
 * (`IDVFlow`) mounts whatever the active provider returns — a hosted redirect
 * or an inline embed — and polls `status` until terminal.
 *
 * Clean-room: this contract is an original Lux implementation. It is a generic
 * vendor-adaptor shape; no third-party verification SDK is bundled here.
 */

/** The kind of verification check a session performs. */
export type IDVCheckKind =
  | 'document' // government ID document scan
  | 'selfie' // selfie / liveness match against the document
  | 'document+selfie' // both, in one session (the common KYC bundle)
  | 'proof-of-address' // residential-address document
  | 'business' // KYB: business-entity verification

/** Lifecycle status of a verification session. */
export type IDVStatus =
  | 'pending' // session created, user has not started
  | 'in_progress' // user is mid-flow
  | 'awaiting_review' // submitted, a human/automated reviewer is deciding
  | 'passed' // verification succeeded
  | 'failed' // verification was rejected
  | 'expired' // session timed out before completion
  | 'cancelled' // abandoned by the user or the host

/** Statuses past which a session will not change. */
export const TERMINAL_STATUSES: ReadonlySet<IDVStatus> = new Set([
  'passed',
  'failed',
  'expired',
  'cancelled',
])

export function isTerminal(status: IDVStatus): boolean {
  return TERMINAL_STATUSES.has(status)
}

/** Who is being verified. */
export interface IDVSubject {
  /** Stable subject id (typically the IAM user id, `owner/name`). */
  readonly subjectId: string
  /** Tenant org slug, for multi-tenant vendors. */
  readonly orgId: string
  /** Carried through for vendor pre-fill; never required. */
  readonly email?: string
  readonly displayName?: string
}

export interface IDVSessionInit {
  readonly subject: IDVSubject
  readonly check: IDVCheckKind
  /** Where the vendor sends the user after a hosted flow completes. */
  readonly redirectUri: string
  /** Optional vendor-specific metadata pass-through. */
  readonly metadata?: Readonly<Record<string, string>>
}

export interface IDVSessionHandle {
  readonly id: string
  /** id of the provider that minted the session. */
  readonly provider: string
  /** Redirect target for a hosted vendor flow (mutually exclusive with embed). */
  readonly hostedUrl?: string
  /** Inline-embed config for a vendor web SDK (mutually exclusive with hosted). */
  readonly embed?: {
    readonly sdkUrl: string
    readonly token: string
    readonly env?: 'sandbox' | 'production'
  }
}

export interface IDVStatusReport {
  readonly id: string
  readonly status: IDVStatus
  /** Human-readable reason on a non-passing terminal status. */
  readonly reason?: string
  /** Provider-specific result blob, retained for the audit trail. */
  readonly raw?: Readonly<Record<string, unknown>>
}

export interface IDVProvider {
  readonly id: string
  start(init: IDVSessionInit): Promise<IDVSessionHandle>
  status(sessionId: string): Promise<IDVStatusReport>
  cancel?(sessionId: string): Promise<void>
}
