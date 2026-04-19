import { useState } from 'react'
import { Link } from 'wouter'
import { LuxWordmark } from '../components/LuxWordmark'
import { getOAuthAuthorizeUrl, login } from '../lib/iam'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  function handleOAuth() {
    window.location.href = getOAuthAuthorizeUrl()
  }

  return (
    <div className="card">
      <div className="wordmark">
        <LuxWordmark />
      </div>
      <h1 className="title-only">Sign in</h1>

      {error && <div className="alert">{error}</div>}

      <form className="stack" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="field">
          <div className="field-row">
            <label htmlFor="password">Password</label>
            <Link href="/forgot">Forgot password?</Link>
          </div>
          <input
            id="password"
            className="input"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
        </div>

        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div className="divider">or</div>

      <button className="btn" onClick={handleOAuth}>
        Sign in with Lux ID
      </button>

      <p className="footnote">
        Don't have an account? <Link href="/signup">Sign up</Link>
      </p>
    </div>
  )
}
