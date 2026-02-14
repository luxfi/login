'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LuxWordmark } from '@/components/lux-wordmark'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to send reset email')
        return
      }

      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex justify-center mb-10">
        <LuxWordmark />
      </div>

      <h1 className="text-xl font-semibold text-center mb-2">
        Reset password
      </h1>
      <p className="text-sm text-neutral-500 text-center mb-8">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      {error && (
        <div className="mb-4 p-3 text-sm bg-surface border border-red-900/50 text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {sent ? (
        <div className="text-center">
          <div className="mb-4 p-4 bg-surface border border-border rounded-lg">
            <p className="text-sm text-neutral-300">
              If an account exists for <span className="text-white font-medium">{email}</span>,
              you&apos;ll receive a password reset email shortly.
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-neutral-500 hover:text-white transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-400 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-400 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-white text-black font-medium rounded-lg hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500">
            Remember your password?{' '}
            <Link href="/" className="text-white hover:underline">
              Sign in
            </Link>
          </p>
        </>
      )}
    </div>
  )
}
