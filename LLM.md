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
pkgs/idv    @luxfi/id-idv    pluggable IDV/KYC provider contract (M2)
  provider.ts     IDVProvider interface + IDVCheckKind/IDVStatus + isTerminal
  registry.ts     process-wide provider registry (first registered = active)
  providers/stub.ts  in-process dev provider (settles to passed on a timer)
  ui/IDVFlow.tsx  mounts active provider's session (hosted redirect | embed poll)
pkgs/onboarding  @luxfi/id-onboarding  declarative onboarding/KYC engine (M2)
  domain/types.ts     FlowSpec/StepSpec/FieldSpec — a flow is DATA, serializable
  domain/flows.ts     the two configs: exchange-full (regulated) + lite
  domain/machine.ts   pure engine: enabledWhen/visibleWhen reveals, validate, resume
  domain/screening.ts country-risk / CIP — allow|edd|escalate|block (advisory)
  service/onboarding.ts  IAM-backed draft persist (update-user, properties-scoped)
  ui/OnboardingRunner.tsx  ONE component renders any FlowSpec (generic field
                           renderer + account-type/document/screening/review panels)
  onboarding.test.ts  17 node:test cases (machine, screening, service)
  test-resolver.mjs   registerHooks shim so node:test resolves extensionless .ts
apps/web    @luxfi/id-web    the SPA
  components/
    invest-ticker.tsx   the centerpiece (clean-room reimpl — see IP note)
    ticker-data.ts      asset universe + cycle labels + finale copy (pure)
    ticker-motion.ts    exponential accel curve + responsive geometry (pure, DOM-free)
    unified-auth-flow.tsx  email/phone OTP toggle + GitHub/Google/Web3 buttons
    provider-icons.tsx  clean-room inline marks
    lux-mark.tsx        LUX wordmark, Lux-green accent
  lib/idv.ts            registers the @luxfi/id-idv stub provider (one place)
  pages/landing.tsx     ticker + auth flow
  pages/callback.tsx    OIDC PKCE callback; no return_to → hand off to /onboarding
  pages/onboarding.tsx  resumable KYC: useIam → service + OnboardingRunner
  router.tsx            / , /login→/ , /auth/callback , /onboarding , /onboarding/$step
  main.tsx              IamProvider(iamProviderConfig) → RouterProvider
  app.css               Tailwind v4 @theme tokens + keyframes + lux-id-btn-*
```

## M2 onboarding/KYC framework

A flow is **data**: `FlowSpec` = ordered `StepSpec[]`, each `FieldSpec[]`. ONE
pure machine (`domain/machine`) walks it, ONE React runner (`ui/Onboarding
Runner`) renders it. Adding a step/field/whole-flow is an edit to `domain/flows`
— never a new route or component. Two configs ship:

- **exchange-full** (regulated): account-type [individual/corporate/llc/lp/trust/
  other] → identity [legal name, DOB, country, residential address, SSN-last4 or
  taxID] → entity (entity types only) → document (IDV; individual=document+selfie,
  entity=business KYB) → accreditation (basis revealed on attest) → screening
  (country-risk) → review+submit.
- **lite**: email already verified by IAM → display name → review.

Progressive reveal is two-level: step-level `enabledWhen` (entity steps skipped
for individuals — `nextStepId`/`prevStepId` skip disabled in BOTH directions)
and field-level `visibleWhen` (SSN-last4 ↔ taxID by US/non-US; accreditation
basis on attest). Hidden fields are neither shown nor validated. `firstIncomplete
Step` is the resume point driving `/onboarding` → `/onboarding/$step` and the
post-auth handoff. SSN: only last-4 client-side, ever.

IDV is delegated to `@luxfi/id-idv` (the document step mounts `IDVFlow`); a real
deployment swaps the stub for a hosted vendor by registering it in `lib/idv.ts`
— runner unchanged. Persistence is IAM-only: the draft JSON rides one scoped
`properties.luxOnboarding` user column (no separate onboarding backend).

Gotcha (fixed): a non-form step records completion via a synthetic
`__done:<stepId>` key in FormData; the `screening` step's completion write MUST
be in a `useEffect`, not during render, or it infinite-loops (caught by the
headless KYC drive).

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

**M2 author-gate (git-proven, archived liquidity `pkgs/onboarding`):** every
flow file (`flows/individual.ts`, `corporate.ts`, …), every domain type
(`types/flow.ts`, `account-type.ts`, `step.ts`, `view.ts`), and every UI
view/component (`account-type-selector.tsx`, `document-capture.tsx`, …) has
`arthur.ash@example.internal` commits → ALL reimplemented clean-room. Only
`api/{cip-lite,country-risk,identity-config}.ts` are woo.bin-exclusive — but
those are liquidity-branded (`X-Org-Id: liquidity`, `verify.*.example.internal`,
Alpaca table, Eric-the-client) so NOT copied either; their *design* (the
`block/escalate/edd/allow` risk taxonomy + advisory-not-blocking principle)
informed `domain/screening.ts`, written fresh + Lux-branded. Net: **zero archive
code ported**; the whole of `@luxfi/id-{idv,onboarding}` is original Lux built on
the `~/work/hanzo/id/pkgs/{idv,onboarding}` domain/service/UI pattern.

## Commands (run inside this dir only)

```
pnpm install
pnpm tc       # tsc --noEmit across all workspaces (auth, idv, onboarding, web)
pnpm build    # vite production build
pnpm dev      # vite dev server :5173
pnpm preview  # serve dist :5174
pnpm --filter @luxfi/id-onboarding test   # 17 node:test cases (engine + service)
```

Env overrides (all optional; default to prod Lux hosts):
`VITE_IAM_SERVER_URL`, `VITE_IAM_CLIENT_ID`, `VITE_PUBLIC_ORIGIN`,
`VITE_EXCHANGE_HOST`, `VITE_API_HOST`.

## Status

- Milestone 1 (login + InvestTicker): DONE — `tsc` + `pnpm build` green;
  headless render verified (ticker cycles to finale, lux.exchange links, all
  auth methods present).
- Milestone 2 (exchange IDV/KYC onboarding): DONE — `@luxfi/id-idv` +
  `@luxfi/id-onboarding` packages + resumable `/onboarding[/$step]` routes +
  post-auth handoff. `pnpm -r tc` + `pnpm build` (149 modules) green; 17/17
  unit tests pass; headless-drove the full individual KYC path to submit
  (account-type → identity → IDV-passed → accreditation → screening-cleared →
  review → submitted), plus the lite flow and the non-US taxID↔SSN reveal.
  Clean-room: zero archive code (full M2 author-gate above). NOT deployed.
- Milestone 3 (AI-focused `~/work/hanzo/id`): SEPARATE repo, already a mature
  white-label IAM portal; not part of this tree.
