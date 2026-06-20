# Lux ID (`~/work/lux/id`)

Unified login for the Lux ecosystem (`lux.network` / `lux.exchange`). Vite +
React 19 + TanStack Router SPA, authenticating through Hanzo IAM via the
`@hanzo/iam` SDK, Lux brand (`lux.id` / `lux-id`).

The login centerpiece is the **InvestTicker** — an accelerating asset ticker
that cycles "Invest in {category} {SYMBOL}" through stocks → bonds → … → crypto
and resolves to "anything." with a Lux-green glow finale.

## Layout

```
pkgs/auth   @luxfi/id-auth   IAM PKCE wiring (framework-agnostic)
  brand.ts        BrandConfig — runtime Lux endpoints (VITE_* overrides → prod defaults)
  iam.ts          createIam() single @hanzo/iam/browser client + iamProviderConfig()
  types.ts        AuthMethod = email|phone|github|google|web3 (no WebAuthn); PROVIDER_KEY
apps/web    @luxfi/id-web    the SPA
  components/
    invest-ticker.tsx   the centerpiece (clean-room reimpl — see IP note)
    ticker-data.ts      asset universe + cycle labels + finale copy (pure)
    ticker-motion.ts    exponential accel curve + responsive geometry (pure, DOM-free)
    unified-auth-flow.tsx  email/phone OTP toggle + GitHub/Google/Web3 buttons
    provider-icons.tsx  clean-room inline marks
    lux-mark.tsx        LUX wordmark, Lux-green accent
  pages/landing.tsx     ticker + auth flow
  pages/callback.tsx    OIDC PKCE callback (same-origin-gated return_to)
  router.tsx            / , /login→/ , /auth/callback
  main.tsx              IamProvider(iamProviderConfig) → RouterProvider
  app.css               Tailwind v4 @theme tokens + keyframes
```

## Auth (HIP-0111)

One way: every sign-in method drives the SAME `@hanzo/iam` PKCE redirect
(`useIam().login` → `signinRedirect`). IAM owns every credential step; the SPA
never handles a password or OTP code.

- `serverUrl = https://lux.id`, `client_id = lux-id`, PKCE S256, scope
  `openid profile email`, redirect `${origin}/auth/callback`.
- OIDC paths host-relative: `/v1/iam/oauth/{authorize,token,userinfo}` +
  `/v1/iam/.well-known/jwks` (discovery resolves these).
- Social: `signinRedirect({ additionalParams: { provider: 'github'|'google'|'web3' } })`.
- OTP: `signinRedirect({ additionalParams: { login_hint, code_method: 'email'|'phone' } })`.

## Brand

- Primary = **Lux green `#12FF80`** (canonical `brand.primaryColor` across Lux
  repos). The ticker glow finale sweeps to Lux green, NOT the source's blue.
- Exchange links → `https://lux.exchange`; live asset count → `https://api.lux.network`.
- ZERO `@partner` / partner / liquid-brand strings (verified). The lone
  "liquidity" is the financial term in marketing copy.

## InvestTicker IP provenance (IMPORTANT)

The InvestTicker is a **clean-room reimplementation**, not a copy. The source
`apps/web/src/components/invest-ticker.tsx` in the archived liquidity repo
git-blames 421/544 lines to `arthur.ash@example.internal` and its true creation
commit (`7562e8f`) is his — so per the IP author-gate it was reimplemented from
the documented UX behavior, with original module decomposition, data, naming,
and JSX. The animation keyframes were likewise recreated clean-room (the source
CSS was mixed-author including artem). No artem-authored code was copied.

## Commands (run inside this dir only)

```
pnpm install
pnpm tc       # tsc --noEmit across workspaces (auth + web)
pnpm build    # vite production build
pnpm dev      # vite dev server :5173
pnpm preview  # serve dist :5174
```

Env overrides (all optional; default to prod Lux hosts):
`VITE_IAM_SERVER_URL`, `VITE_IAM_CLIENT_ID`, `VITE_PUBLIC_ORIGIN`,
`VITE_EXCHANGE_HOST`, `VITE_API_HOST`.

## Status

- Milestone 1 (login + InvestTicker): DONE — `tsc` + `pnpm build` green;
  headless render verified (ticker cycles to finale, lux.exchange links, all
  auth methods present).
- Milestone 2 (exchange IDV/KYC onboarding): NOT STARTED. Reimplement
  clean-room from the archived `pkgs/onboarding/src/ui/views/*` — author-gate
  each view (most are artem; bring only Zach/Woo Bin) and strip liquidity brand.
- Milestone 3 (AI-focused `~/work/hanzo/id`): SEPARATE repo, already a mature
  white-label IAM portal; not part of this tree.
