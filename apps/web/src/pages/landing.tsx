import InvestTicker from '~/components/invest-ticker'
import { UnifiedAuthFlow } from '~/components/unified-auth-flow'
import { LuxMark } from '~/components/lux-mark'

/**
 * Landing — the unified auth surface. The InvestTicker is the centerpiece;
 * the clean-room UnifiedAuthFlow sits beneath it. A single, centered column
 * on a near-black canvas with the Lux mark up top.
 */
export function Landing() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 px-5 py-12">
      <div className="flex flex-col items-center gap-2">
        <LuxMark className="text-foreground" />
        <p className="text-sm text-muted-foreground">Sign in to Lux</p>
      </div>

      <InvestTicker />

      <UnifiedAuthFlow />

      <p className="max-w-sm text-center text-xs text-muted-foreground/70">
        By continuing you agree to the Lux Terms of Service and Privacy Policy.
      </p>
    </main>
  )
}
