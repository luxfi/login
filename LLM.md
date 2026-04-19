# LLM.md - Lux Login

## Overview
Lux Network sign-in UI (login, signup, forgot password, OAuth callback) backed
by Lux IAM at `https://lux.id`. The primary flow now redirects users directly
to `lux.id`; this service still builds a Vite 8 + React 19 SPA for embeddable
/ self-hosted deployments.

## Tech Stack
- **Runtime**: Vite 8 + React 19 (SPA)
- **Router**: wouter
- **Styling**: pure CSS (Basel Grotesk, matches lux.cloud dark theme)
- **Container**: `ghcr.io/hanzoai/spa` (serves `dist/` as SPA)

## Build & Run
```bash
pnpm install
pnpm dev        # vite dev server on :3000
pnpm build      # typecheck + vite build -> dist/
pnpm typecheck
```

## Structure
```
login/
  Dockerfile            # build stage + ghcr.io/hanzoai/spa
  index.html
  package.json
  src/
    main.tsx
    App.tsx             # wouter routes: /, /login, /signup, /forgot, /callback
    styles.css
    components/
      LuxWordmark.tsx
    lib/
      iam.ts            # browser client for lux.id (Casdoor API + OAuth)
    pages/
      LoginPage.tsx
      SignupPage.tsx
      ForgotPage.tsx
      CallbackPage.tsx
  tsconfig.json
  vite.config.ts
```

## Env
Copy `.env.example`. All variables are `VITE_*` (injected at build time):
- `VITE_IAM_URL`          default `https://lux.id`
- `VITE_IAM_CLIENT_ID`    OAuth client ID
- `VITE_IAM_ORG`          Casdoor organization (`lux`)
- `VITE_IAM_APP`          Casdoor application (`app-lux`)
- `VITE_REDIRECT_URL`     post-login redirect target

## Auth flow
- Password login/signup: browser `POST` to `${VITE_IAM_URL}/api/login|signup`
  against lux.id (Casdoor). Requires lux.id to allow CORS from the hosting
  origin.
- OAuth fallback: `getOAuthAuthorizeUrl()` redirects to
  `${VITE_IAM_URL}/oauth/authorize`; the `/callback` page exchanges the code.
