import { IAM } from '@hanzo/iam/browser'
import { getBrand, type BrandConfig } from './brand'

/**
 * The single `@hanzo/iam` browser PKCE client for the Lux `lux-id` app.
 *
 * One instance, one way. Every sign-in entry point (email/phone OTP, GitHub,
 * Google, Web3) drives the SAME client's `signinRedirect`, and the
 * `/auth/callback` route completes the SAME client's `handleCallback`. This
 * is load-bearing: the PKCE `code_verifier` + `state` the SDK writes to
 * session storage on redirect MUST be read back by the identical client on
 * callback, or the token exchange fails state validation.
 *
 * HIP-0111: `serverUrl` is the Lux brand's own issuer (`lux.id`), never
 * `iam.hanzo.ai`. The SDK resolves OIDC discovery host-relative against it
 * (`/.well-known/openid-configuration` → `/v1/iam/oauth/{authorize,token,
 * userinfo}` + `/v1/iam/.well-known/jwks`), scope `openid profile email`,
 * PKCE `S256`. The redirect lands at `${publicOrigin}/auth/callback`.
 */
export function createIam(brand: BrandConfig = getBrand()): IAM {
  return new IAM({
    serverUrl: brand.iamServerUrl,
    clientId: brand.clientId,
    redirectUri: `${brand.publicOrigin}/auth/callback`,
    scope: 'openid profile email',
  })
}

/**
 * Stable config object for `@hanzo/iam/react`'s `IamProvider`. The provider
 * constructs its own internal `IAM` from this — the same shape `createIam`
 * uses — so the provider-managed instance and any direct `createIam()` caller
 * stay byte-for-byte identical (same storage keys, same PKCE round-trip).
 */
export function iamProviderConfig(brand: BrandConfig = getBrand()): {
  serverUrl: string
  clientId: string
  redirectUri: string
  scope: string
} {
  return {
    serverUrl: brand.iamServerUrl,
    clientId: brand.clientId,
    redirectUri: `${brand.publicOrigin}/auth/callback`,
    scope: 'openid profile email',
  }
}
