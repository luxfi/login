'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LuxWordmark } from '@/components/lux-wordmark'
import { getOAuthAuthorizeUrl } from '@/lib/oauth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Invalid credentials')
        return
      }

      // Redirect to target after successful login
      window.location.href = data.redirect ?? '/'
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleOAuthLogin() {
    window.location.href = getOAuthAuthorizeUrl()
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex justify-center mb-10">
        <LuxWordmark />
      </div>

      <h1 className="text-xl font-semibold text-center mb-8">
        Sign in
      </h1>

      {error && (
        <div className="mb-4 p-3 text-sm bg-surface border border-red-900/50 text-red-400 rounded-lg">
          {error}
        </div>
      )}

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

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-neutral-400">
              Password
            </label>
            <Link
              href="/forgot"
              className="text-sm text-neutral-500 hover:text-white transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-400 transition-colors"
            placeholder="Enter your password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-white text-black font-medium rounded-lg hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-black px-3 text-neutral-500">or</span>
        </div>
      </div>

      <button
        onClick={handleOAuthLogin}
        className="w-full py-2.5 bg-surface border border-border text-white font-medium rounded-lg hover:border-neutral-400 transition-colors"
      >
        Sign in with Lux ID
      </button>

      <p className="mt-6 text-center text-sm text-neutral-500">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-white hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  )
}
