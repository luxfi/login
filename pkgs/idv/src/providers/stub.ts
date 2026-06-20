import type {
  IDVProvider,
  IDVSessionHandle,
  IDVSessionInit,
  IDVStatus,
  IDVStatusReport,
} from '../provider'

/**
 * In-process stub IDV provider — dev/test only.
 *
 * Mints an embed-style session (so the UI renders inline rather than
 * redirecting away) and advances it through the lifecycle on a timer so an
 * end-to-end onboarding walkthrough reaches a terminal verdict without any
 * real vendor. Configurable outcome + delay; defaults to `passed` after a
 * short beat.
 */
export interface StubOptions {
  /** Terminal verdict to settle on. Default `passed`. */
  readonly outcome?: Extract<IDVStatus, 'passed' | 'failed' | 'awaiting_review'>
  /** Milliseconds before the session settles to `outcome`. Default 1200. */
  readonly settleMs?: number
  /** Reason string attached to a non-passing outcome. */
  readonly reason?: string
}

interface StubSession {
  status: IDVStatus
  settleAt: number
  outcome: IDVStatus
  reason?: string
}

export function createStubProvider(opts: StubOptions = {}): IDVProvider {
  const settleMs = opts.settleMs ?? 1200
  const outcome: IDVStatus = opts.outcome ?? 'passed'
  const sessions = new Map<string, StubSession>()

  return {
    id: 'stub',

    async start(init: IDVSessionInit): Promise<IDVSessionHandle> {
      const id = `stub_${randomId()}`
      sessions.set(id, {
        status: 'in_progress',
        settleAt: Date.now() + settleMs,
        outcome,
        reason: opts.reason,
      })
      return {
        id,
        provider: 'stub',
        embed: {
          // A harmless inline document so the embed renders something real in
          // dev. No external vendor is contacted.
          sdkUrl: `data:text/html,${encodeURIComponent(
            `<!doctype html><meta charset=utf-8><body style="margin:0;display:grid;place-items:center;height:100vh;background:#0e1014;color:#8a929c;font:14px system-ui">` +
              `Stub verification (${init.check})… settling to ${outcome}.</body>`,
          )}`,
          token: id,
          env: 'sandbox',
        },
      }
    },

    async status(sessionId: string): Promise<IDVStatusReport> {
      const s = sessions.get(sessionId)
      if (!s) return { id: sessionId, status: 'expired', reason: 'unknown session' }
      if (s.status === 'in_progress' && Date.now() >= s.settleAt) {
        s.status = s.outcome
      }
      return {
        id: sessionId,
        status: s.status,
        reason: s.status === s.outcome && s.outcome !== 'passed' ? s.reason : undefined,
        raw: { stub: true },
      }
    },

    async cancel(sessionId: string): Promise<void> {
      const s = sessions.get(sessionId)
      if (s) s.status = 'cancelled'
    },
  }
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 12)
  }
  return Math.random().toString(36).slice(2, 14)
}
