/**
 * Lux brand identity configuration.
 *
 * One place that resolves the runtime-configurable Lux endpoints. The SPA
 * passes these into the `@hanzo/iam` PKCE client and the ticker. Values are
 * read from Vite `import.meta.env` with hard Lux defaults, so a missing env
 * degrades to the canonical production hosts — never to a wrong brand.
 *
 * HIP-0111: `iamServerUrl` is the Lux brand's OWN issuer host (`lux.id`),
 * NOT `iam.hanzo.ai`. OIDC discovery must be host-relative or the SDK
 * resolves to the IAM SPA HTML catch-all.
 */
export interface BrandConfig {
  /** OIDC issuer / IAM origin for the Lux brand. */
  readonly iamServerUrl: string
  /** OAuth2 client_id for this app (the `lux-id` IAM application). */
  readonly clientId: string
  /** This app's public origin; the PKCE redirect lands at `${origin}/auth/callback`. */
  readonly publicOrigin: string
  /** Lux exchange host the ticker symbols/categories link into. */
  readonly exchangeHost: string
  /** Lux API host (asset count, live market data). */
  readonly apiHost: string
}

function env(key: string): string | undefined {
  const v = (import.meta.env as Record<string, string | undefined>)[key]
  return v && v.length > 0 ? v : undefined
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

/**
 * Resolve the Lux brand config. Reads `VITE_*` overrides, falls back to the
 * canonical Lux production hosts. `publicOrigin` defaults to the live origin
 * in the browser so the redirect URI matches wherever the SPA is served.
 */
export function getBrand(): BrandConfig {
  const publicOrigin =
    env('VITE_PUBLIC_ORIGIN') ??
    (typeof window !== 'undefined' ? window.location.origin : 'https://lux.id')
  return {
    iamServerUrl: trimSlash(env('VITE_IAM_SERVER_URL') ?? 'https://lux.id'),
    clientId: env('VITE_IAM_CLIENT_ID') ?? 'lux-id',
    publicOrigin: trimSlash(publicOrigin),
    exchangeHost: trimSlash(env('VITE_EXCHANGE_HOST') ?? 'https://lux.exchange'),
    apiHost: trimSlash(env('VITE_API_HOST') ?? 'https://api.lux.network'),
  }
}
