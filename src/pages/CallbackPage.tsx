import { useEffect, useState } from 'react'
import { LuxWordmark } from '../components/LuxWordmark'
import { exchangeCodeForToken, getRedirectUrl } from '../lib/iam'

export function CallbackPage() {
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const errorParam = params.get('error')

    if (errorParam) {
      setError(params.get('error_description') ?? errorParam)
      return
    }
    if (!code) {
      setError('No authorization code received')
      return
    }

    exchangeCodeForToken(code)
      .then((token) => {
        sessionStorage.setItem('lux_access_token', token.access_token)
        if (token.refresh_token) {
          sessionStorage.setItem('lux_refresh_token', token.refresh_token)
        }
        window.location.href = getRedirectUrl()
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Authentication failed')
      })
  }, [])

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="wordmark">
          <LuxWordmark />
        </div>
        <div className="alert">{error}</div>
        <a href="/" className="footnote" style={{ display: 'block' }}>
          Back to sign in
        </a>
      </div>
    )
  }

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div className="wordmark">
        <LuxWordmark />
      </div>
      <div className="spinner-row">
        <span className="spinner" />
        <span>Completing sign in...</span>
      </div>
    </div>
  )
}
