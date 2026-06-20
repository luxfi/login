import { useEffect, useState } from 'react'
import { useIam } from '@hanzo/iam/react'
import { LuxMark } from '~/components/lux-mark'

/**
 * OAuth/OIDC callback. Completes the same `@hanzo/iam` PKCE client that
 * `UnifiedAuthFlow` started — `handleCallback` reads back the exact
 * `code_verifier` + `state` the SDK stored, exchanges the code at
 * `/v1/iam/oauth/token`, and persists tokens in session storage.
 *
 * On success, forward to whichever app initiated the flow (the optional
 * `return_to` query param, same-origin only) or hand off to `/onboarding`,
 * which resumes an incomplete KYC application or forwards a finished applicant
 * on to the Lux exchange.
 */
export function Callback() {
  const iam = useIam()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    iam.sdk
      .handleCallback(window.location.href)
      .then((tok) => {
        const params = new URLSearchParams(window.location.search)
        const returnTo = safeReturnTo(params.get('return_to'))
        if (returnTo) {
          returnTo.searchParams.set('access_token', tok.accessToken)
          if (tok.refreshToken) returnTo.searchParams.set('refresh_token', tok.refreshToken)
          if (tok.idToken) returnTo.searchParams.set('id_token', tok.idToken)
          window.location.replace(returnTo.toString())
          return
        }
        // No explicit return target → hand off to onboarding, which resolves
        // the resume step (incomplete profile → KYC) or forwards an already-
        // submitted applicant straight on to the exchange.
        window.location.replace('/onboarding')
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [iam])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5">
      <LuxMark className="text-foreground" />
      {error ? (
        <p role="alert" className="text-sm text-danger-9">
          {error}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Completing sign-in…</p>
      )}
    </main>
  )
}

/**
 * Only honor a same-origin `return_to` to avoid an open-redirect that leaks
 * the freshly minted tokens to an arbitrary host.
 */
function safeReturnTo(raw: string | null): URL | null {
  if (!raw) return null
  try {
    const url = new URL(raw, window.location.origin)
    return url.origin === window.location.origin ? url : null
  } catch {
    return null
  }
}
