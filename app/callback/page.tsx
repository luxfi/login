'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { LuxWordmark } from '@/components/lux-wordmark'
import { exchangeCodeForToken, getRedirectUrl } from '@/lib/oauth'

function CallbackHandler() {
  const searchParams = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code')
      const errorParam = searchParams.get('error')

      if (errorParam) {
        setError(searchParams.get('error_description') ?? errorParam)
        return
      }

      if (!code) {
        setError('No authorization code received')
        return
      }

      try {
        const token = await exchangeCodeForToken(code)

        // Store token
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('lux_access_token', token.access_token)
          if (token.refresh_token) {
            sessionStorage.setItem('lux_refresh_token', token.refresh_token)
          }
        }

        // Redirect to target
        window.location.href = getRedirectUrl()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed')
      }
    }

    handleCallback()
  }, [searchParams])

  if (error) {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-10">
          <LuxWordmark />
        </div>
        <div className="mb-4 p-4 bg-surface border border-red-900/50 text-red-400 rounded-lg text-sm">
          {error}
        </div>
        <a
          href="/"
          className="text-sm text-neutral-500 hover:text-white transition-colors"
        >
          Back to sign in
        </a>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm text-center">
      <div className="flex justify-center mb-10">
        <LuxWordmark />
      </div>
      <div className="flex items-center justify-center gap-3">
        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-neutral-400">Completing sign in...</span>
      </div>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-10">
            <LuxWordmark />
          </div>
          <div className="flex items-center justify-center gap-3">
            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-neutral-400">Loading...</span>
          </div>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  )
}
