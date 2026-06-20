import { useEffect, useRef, useState } from 'react'
import { getActiveProvider } from '../registry'
import {
  isTerminal,
  type IDVCheckKind,
  type IDVSessionHandle,
  type IDVStatusReport,
  type IDVSubject,
} from '../provider'

/**
 * IDVFlow — mounts the active provider's verification session and tracks it
 * to a terminal verdict.
 *
 * Hosted providers redirect the browser to `hostedUrl`; embed providers render
 * an inline iframe and this component polls `status` every few seconds until
 * the verdict is terminal. Vendor web SDKs that need full postMessage init can
 * be wired by a host that overrides this component — the iframe here is the
 * safe, dependency-free default.
 *
 * Clean-room Lux implementation; `lux-id-idv-*` classes match the app theme.
 */
export interface IDVFlowProps {
  readonly subject: IDVSubject
  readonly check: IDVCheckKind
  /** Where a hosted vendor flow returns the user. */
  readonly redirectUri: string
  /** Polling cadence for embed sessions (ms). Default 4000. */
  readonly pollMs?: number
  /** Fires on every status change. */
  readonly onChange?: (report: IDVStatusReport) => void
  /** Fires once when the status becomes terminal. */
  readonly onTerminal?: (report: IDVStatusReport) => void
}

export function IDVFlow({
  subject,
  check,
  redirectUri,
  pollMs = 4000,
  onChange,
  onTerminal,
}: IDVFlowProps) {
  const [handle, setHandle] = useState<IDVSessionHandle | null>(null)
  const [report, setReport] = useState<IDVStatusReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Keep the latest callbacks without re-arming the session effect.
  const onChangeRef = useRef(onChange)
  const onTerminalRef = useRef(onTerminal)
  onChangeRef.current = onChange
  onTerminalRef.current = onTerminal

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setInterval> | null = null
    const provider = getActiveProvider()

    provider
      .start({ subject, check, redirectUri })
      .then((h) => {
        if (stopped) return
        setHandle(h)
        // Hosted flow → leave the SPA for the vendor immediately.
        if (h.hostedUrl && !h.embed) {
          window.location.href = h.hostedUrl
          return
        }
        // Embed flow → poll for the verdict while the iframe is mounted.
        timer = setInterval(async () => {
          try {
            const next = await provider.status(h.id)
            if (stopped) return
            setReport(next)
            onChangeRef.current?.(next)
            if (isTerminal(next.status)) {
              if (timer) clearInterval(timer)
              onTerminalRef.current?.(next)
            }
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
          }
        }, pollMs)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))

    return () => {
      stopped = true
      if (timer) clearInterval(timer)
    }
    // A new subject / check / redirect mints a fresh session.
  }, [subject, check, redirectUri, pollMs])

  if (error) {
    return (
      <p role="alert" className="lux-id-idv-error">
        {error}
      </p>
    )
  }
  if (!handle) return <p className="lux-id-idv-status">Starting verification…</p>
  if (handle.embed) {
    return (
      <div className="lux-id-idv-embed" data-provider={handle.provider}>
        <iframe
          title="Identity verification"
          src={handle.embed.sdkUrl}
          style={{ width: '100%', minHeight: 480, border: 0, borderRadius: 12 }}
        />
        {report ? (
          <p className="lux-id-idv-status">Status: {report.status}</p>
        ) : null}
      </div>
    )
  }
  return <p className="lux-id-idv-status">Redirecting…</p>
}
