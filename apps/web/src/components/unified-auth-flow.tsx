import { useState, type FormEvent } from 'react'
import { useIam } from '@hanzo/iam/react'
import { PROVIDER_KEY, SOCIAL_ORDER, type OtpChannel, type SocialProvider } from '@luxfi/id-auth'
import { cn } from '~/util'
import {
  GitHubIcon,
  GoogleIcon,
  WalletIcon,
  MailIcon,
  PhoneIcon,
} from './provider-icons'

/**
 * UnifiedAuthFlow — the sign-in surface beneath the ticker.
 *
 * Every method drives the ONE `@hanzo/iam` PKCE redirect (`useIam().login`,
 * which calls the SDK's `signinRedirect`). The IAM server owns the actual
 * credential step; the SPA never sends an OTP code or touches a password.
 *
 *   - Email / phone OTP: an identifier field. On submit we redirect to
 *     `/oauth/authorize` with `login_hint=<identifier>` and a `code_method`
 *     hint (`email` | `phone`), so IAM presents the right verification step.
 *   - GitHub / Google / Web3: redirect with `provider=<key>`.
 *
 * No WebAuthn / FaceID. The `/auth/callback` route completes the same SDK
 * client's `handleCallback`.
 */

const SOCIAL_META: Record<
  SocialProvider,
  { label: string; Icon: typeof GitHubIcon }
> = {
  github: { label: 'GitHub', Icon: GitHubIcon },
  google: { label: 'Google', Icon: GoogleIcon },
  web3: { label: 'Wallet', Icon: WalletIcon },
}

export interface UnifiedAuthFlowProps {
  readonly className?: string
}

export function UnifiedAuthFlow({ className }: UnifiedAuthFlowProps) {
  const iam = useIam()
  const [channel, setChannel] = useState<OtpChannel>('email')
  const [identifier, setIdentifier] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function redirect(additionalParams: Record<string, string>, tag: string) {
    setError(null)
    setBusy(tag)
    iam.login({ additionalParams }).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(null)
    })
  }

  function onOtpSubmit(e: FormEvent) {
    e.preventDefault()
    const value = identifier.trim()
    if (!value) return
    redirect({ login_hint: value, code_method: channel }, 'otp')
  }

  const otpPlaceholder = channel === 'email' ? 'you@lux.network' : '+1 (555) 000-0000'
  const otpType = channel === 'email' ? 'email' : 'tel'
  const otpAutoComplete = channel === 'email' ? 'email' : 'tel'

  return (
    <div className={cn('w-full max-w-sm', className)}>
      {/* Social + Web3 */}
      <div className="flex flex-col gap-2.5">
        {SOCIAL_ORDER.map((p) => {
          const { label, Icon } = SOCIAL_META[p]
          return (
            <button
              key={p}
              type="button"
              data-provider={p}
              disabled={busy !== null}
              onClick={() => redirect({ provider: PROVIDER_KEY[p] }, `social:${p}`)}
              className={cn(
                'flex h-11 items-center justify-center gap-2.5 rounded-xl border border-border bg-surface px-4',
                'text-sm font-medium text-foreground transition-colors',
                'hover:border-primary/40 hover:bg-surface-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <Icon />
              <span>Continue with {label}</span>
            </button>
          )
        })}
      </div>

      {/* Divider */}
      <div className="my-5 flex items-center gap-3 text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wider">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* Email / phone OTP */}
      <form onSubmit={onOtpSubmit} className="flex flex-col gap-3">
        <div
          role="tablist"
          aria-label="One-time code channel"
          className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface p-1"
        >
          {(['email', 'phone'] as const).map((c) => {
            const Icon = c === 'email' ? MailIcon : PhoneIcon
            const selected = channel === c
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setChannel(c)}
                className={cn(
                  'flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-medium capitalize transition-colors',
                  selected
                    ? 'bg-surface-2 text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon />
                {c}
              </button>
            )
          })}
        </div>

        <input
          type={otpType}
          inputMode={channel === 'phone' ? 'tel' : 'email'}
          autoComplete={otpAutoComplete}
          placeholder={otpPlaceholder}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          className={cn(
            'h-11 rounded-xl border border-border bg-surface px-4 text-sm text-foreground',
            'placeholder:text-muted-foreground/70 outline-none transition-colors',
            'focus:border-primary/60',
          )}
        />

        <button
          type="submit"
          disabled={busy !== null || identifier.trim().length === 0}
          className={cn(
            'h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-background transition-opacity',
            'hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {busy === 'otp' ? 'Redirecting…' : 'Continue with code'}
        </button>
      </form>

      {error ? (
        <p role="alert" className="mt-3 text-center text-sm text-danger-9">
          {error}
        </p>
      ) : null}
    </div>
  )
}
