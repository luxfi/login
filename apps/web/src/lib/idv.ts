import { createStubProvider, hasActiveProvider, registerProvider } from '@luxfi/id-idv'

/**
 * Install the IDV provider for the onboarding document step.
 *
 * The onboarding runner's document step calls the active `@luxfi/id-idv`
 * provider; without one registered it throws. Today the app ships the in-
 * process `stub` (settles to `passed` after a beat) so the full KYC walkthrough
 * reaches a verdict in dev. A real deployment swaps this for a hosted vendor
 * adaptor (Persona / Onfido / a Lux BD backend) by registering that provider
 * here instead — the runner is unchanged.
 *
 * Idempotent: registering only happens once, so calling this from the
 * onboarding page render is safe.
 */
export function ensureIdvProvider(): void {
  if (hasActiveProvider()) return
  registerProvider(createStubProvider({ outcome: 'passed', settleMs: 1200 }))
}
