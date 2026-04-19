// Browser-side IAM (Casdoor-compatible) client for lux.id.
// When CORS blocks direct calls, fall back to OAuth authorize redirect.

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env

const IAM_URL = env.VITE_IAM_URL ?? 'https://lux.id'
const IAM_ORG = env.VITE_IAM_ORG ?? 'lux'
const IAM_APP = env.VITE_IAM_APP ?? 'app-lux'
const IAM_CLIENT_ID = env.VITE_IAM_CLIENT_ID ?? 'lux-cloud-client-id'
const REDIRECT_URL = env.VITE_REDIRECT_URL ?? 'https://cloud.lux.network'

export function getRedirectUrl(): string {
  return REDIRECT_URL
}

export function getCallbackUrl(): string {
  return `${window.location.origin}/callback`
}

export function getOAuthAuthorizeUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: IAM_CLIENT_ID,
    response_type: 'code',
    redirect_uri: getCallbackUrl(),
    scope: 'openid profile email',
    state: state ?? crypto.randomUUID(),
  })
  return `${IAM_URL}/oauth/authorize?${params.toString()}`
}

type CasdoorResponse = {
  status?: string
  msg?: string
  data?: unknown
}

async function post(path: string, body: Record<string, unknown>): Promise<CasdoorResponse> {
  const res = await fetch(`${IAM_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  // Non-2xx still returns a body in Casdoor; read either way.
  const text = await res.text()
  try {
    return text ? (JSON.parse(text) as CasdoorResponse) : {}
  } catch {
    throw new Error(`Unexpected response from IAM (${res.status})`)
  }
}

export async function login(email: string, password: string): Promise<void> {
  const data = await post('/api/login', {
    application: IAM_APP,
    organization: IAM_ORG,
    username: email,
    password,
    type: 'login',
  })
  if (data.status === 'error' || !data.data) {
    throw new Error(data.msg ?? 'Invalid credentials')
  }
  window.location.href = REDIRECT_URL
}

export async function signup(name: string, email: string, password: string): Promise<void> {
  const data = await post('/api/signup', {
    application: IAM_APP,
    organization: IAM_ORG,
    username: email,
    name,
    email,
    password,
    type: 'signup',
  })
  if (data.status === 'error') {
    throw new Error(data.msg ?? 'Signup failed')
  }
  window.location.href = REDIRECT_URL
}

export async function forgotPassword(email: string): Promise<void> {
  // Always succeeds from the UI's perspective to prevent email enumeration.
  try {
    await post('/api/send-verification-code', {
      application: IAM_APP,
      organization: IAM_ORG,
      dest: email,
      type: 'reset',
    })
  } catch {
    // swallow
  }
}

export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
}> {
  const res = await fetch(`${IAM_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: IAM_CLIENT_ID,
      code,
      redirect_uri: getCallbackUrl(),
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed: ${res.status} ${text}`)
  }
  return res.json()
}
