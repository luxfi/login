// OAuth2 Authorization Code flow helpers for lux.id IAM (Casdoor-compatible)

const IAM_CLIENT_ID = process.env.NEXT_PUBLIC_IAM_CLIENT_ID ?? 'lux-cloud-client-id'
const IAM_AUTHORIZE_URL = process.env.NEXT_PUBLIC_IAM_AUTHORIZE_URL ?? 'https://lux.id/login/oauth/authorize'
const IAM_TOKEN_URL = process.env.NEXT_PUBLIC_IAM_TOKEN_URL ?? 'https://lux.id/api/login/oauth/access_token'
const REDIRECT_URL = process.env.NEXT_PUBLIC_REDIRECT_URL ?? 'https://cloud.lux.network'
const CALLBACK_URL = typeof window !== 'undefined'
  ? `${window.location.origin}/callback`
  : 'https://lux.id/login/callback'
const IAM_ORG = process.env.NEXT_PUBLIC_IAM_ORG ?? 'lux'

export function getOAuthAuthorizeUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: IAM_CLIENT_ID,
    response_type: 'code',
    redirect_uri: CALLBACK_URL,
    scope: 'openid profile email',
    state: state ?? crypto.randomUUID(),
  })
  return `${IAM_AUTHORIZE_URL}?${params.toString()}`
}

export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
}> {
  const res = await fetch(IAM_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: IAM_CLIENT_ID,
      code,
      redirect_uri: CALLBACK_URL,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed: ${res.status} ${text}`)
  }

  return res.json()
}

export function getRedirectUrl(): string {
  return REDIRECT_URL
}

export function getIamOrg(): string {
  return IAM_ORG
}

export function getIamClientId(): string {
  return IAM_CLIENT_ID
}
