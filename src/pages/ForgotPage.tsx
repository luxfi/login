import { useState } from 'react'
import { Link } from 'wouter'
import { LuxWordmark } from '../components/LuxWordmark'
import { forgotPassword } from '../lib/iam'

export function ForgotPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // Always succeed (prevents email enumeration).
    await forgotPassword(email)
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="card">
      <div className="wordmark">
        <LuxWordmark />
      </div>
      <h1>Reset password</h1>
      <p className="subtitle">Enter your email and we'll send you a reset link.</p>

      {sent ? (
        <>
          <div className="info">
            If an account exists for <strong>{email}</strong>, you'll receive a
            password reset email shortly.
          </div>
          <p className="footnote">
            <Link href="/">Back to sign in</Link>
          </p>
        </>
      ) : (
        <>
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
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>

          <p className="footnote">
            Remember your password? <Link href="/">Sign in</Link>
          </p>
        </>
      )}
    </div>
  )
}
