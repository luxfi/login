import type {
  IDVProvider,
  IDVSessionHandle,
  IDVSessionInit,
  IDVStatusReport,
} from './provider'

/**
 * Process-wide registry of installed IDV providers, keyed by provider id.
 *
 * One active provider drives the verification UI; the host swaps it with
 * `setActiveProvider`. The first registered provider becomes active by
 * default so a single `registerProvider(stub)` in dev is enough to run.
 */
const registry = new Map<string, IDVProvider>()
let active: IDVProvider | null = null

export function registerProvider(provider: IDVProvider): void {
  registry.set(provider.id, provider)
  if (!active) active = provider
}

export function setActiveProvider(id: string): void {
  const provider = registry.get(id)
  if (!provider) throw new Error(`IDV provider not registered: ${id}`)
  active = provider
}

export function getActiveProvider(): IDVProvider {
  if (!active) {
    throw new Error('No IDV provider registered. Call registerProvider() at startup.')
  }
  return active
}

/** True when at least one provider is installed (lets the UI degrade gracefully). */
export function hasActiveProvider(): boolean {
  return active !== null
}

export async function startSession(init: IDVSessionInit): Promise<IDVSessionHandle> {
  return getActiveProvider().start(init)
}

export async function getStatus(sessionId: string): Promise<IDVStatusReport> {
  return getActiveProvider().status(sessionId)
}
