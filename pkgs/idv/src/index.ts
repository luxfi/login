// @luxfi/id-idv — pluggable identity-verification (IDV/KYC) for the Lux
// onboarding engine. A vendor-agnostic provider contract + registry + a
// self-contained flow component. Ships a dev `stub` provider; real vendors
// (Persona/Onfido/Veriff/custom) implement `IDVProvider` and register at
// startup. Clean-room Lux implementation.

export {
  isTerminal,
  TERMINAL_STATUSES,
  type IDVProvider,
  type IDVCheckKind,
  type IDVStatus,
  type IDVSubject,
  type IDVSessionInit,
  type IDVSessionHandle,
  type IDVStatusReport,
} from './provider'

export {
  registerProvider,
  setActiveProvider,
  getActiveProvider,
  hasActiveProvider,
  startSession,
  getStatus,
} from './registry'

export { createStubProvider, type StubOptions } from './providers/stub'

export { IDVFlow, type IDVFlowProps } from './ui/IDVFlow'
