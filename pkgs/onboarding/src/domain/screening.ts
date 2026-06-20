/**
 * Country-risk / CIP screening — the advisory jurisdiction check.
 *
 * Maps a declared country of residence to a risk action so the flow can warn
 * (or hard-stop) before submit. Four actions, increasing in severity:
 *
 *   allow    — proceed normally (low / medium risk).
 *   edd      — enhanced due diligence; documents may be requested later.
 *   escalate — additional compliance review required before approval.
 *   block    — we cannot open an account for this jurisdiction; stop here.
 *
 * This is ADVISORY UX only. Authoritative enforcement is server-side (the BD
 * CIP gate); a host that wires a live risk API can override the static table.
 * A screening failure must never silently approve — `block` is the only action
 * that stops the flow, and it does so loudly.
 *
 * Clean-room: original Lux implementation. The action taxonomy mirrors a
 * standard sanctions/jurisdiction model; the country list and copy are written
 * here with Lux branding (no third-party guidance table is embedded).
 */

export type RiskAction = 'allow' | 'edd' | 'escalate' | 'block'

export interface ScreeningResult {
  readonly action: RiskAction
  /** Whether this action stops the applicant from continuing. */
  readonly blocking: boolean
  readonly tone: 'ok' | 'warn' | 'error'
  /** Applicant-facing one-liner. */
  readonly message: string
}

/**
 * Static, conservative risk table keyed by ISO 3166-1 alpha-2. Absent a live
 * API, unknown countries default to `escalate` (review) rather than `allow`,
 * so the safe default is *more* scrutiny, never less. Comprehensive sanctions
 * enforcement remains server-side.
 */
const RISK_TABLE: Readonly<Record<string, RiskAction>> = {
  US: 'allow',
  CA: 'allow',
  GB: 'allow',
  AU: 'allow',
  DE: 'allow',
  FR: 'allow',
  JP: 'allow',
  SG: 'allow',
  // A representative high-risk / sanctioned set that hard-blocks.
  KP: 'block', // North Korea
  IR: 'block', // Iran
  SY: 'block', // Syria
  CU: 'block', // Cuba
}

/**
 * Screen a declared country code. `'OTHER'` (or any code not in the table)
 * resolves to `escalate` — the applicant may continue but is flagged for
 * compliance review.
 */
export function screenCountry(countryCode: string | undefined): ScreeningResult {
  const code = (countryCode ?? '').toUpperCase()
  const action: RiskAction = code && code in RISK_TABLE ? RISK_TABLE[code]! : 'escalate'
  return toResult(action)
}

function toResult(action: RiskAction): ScreeningResult {
  switch (action) {
    case 'block':
      return {
        action,
        blocking: true,
        tone: 'error',
        message: 'We’re unable to open a Lux account for this country at this time.',
      }
    case 'escalate':
      return {
        action,
        blocking: false,
        tone: 'warn',
        message:
          'Accounts associated with this country require additional review by our compliance team before approval.',
      }
    case 'edd':
      return {
        action,
        blocking: false,
        tone: 'warn',
        message:
          'This country requires enhanced due diligence — we may request additional documents during review.',
      }
    case 'allow':
      return { action, blocking: false, tone: 'ok', message: 'No jurisdiction restrictions found.' }
  }
}
