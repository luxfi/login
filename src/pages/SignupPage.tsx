import { useState } from 'react'
import { Link } from 'wouter'
import { LuxWordmark } from '../components/LuxWordmark'
import { getOAuthAuthorizeUrl, signup } from '../lib/iam'

export function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signup(name, email, password)
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
      <h1 className="title-only">Create account</h1>

      {error && <div className="alert">{error}</div>}

      <form className="stack" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            className="input"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>

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
          <label htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>

        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <div className="divider">or</div>

      <button className="btn" onClick={handleOAuth}>
        Sign up with Lux ID
      </button>

      <p className="footnote">
        Already have an account? <Link href="/">Sign in</Link>
      </p>
    </div>
  )
}
