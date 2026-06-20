import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  Outlet,
} from '@tanstack/react-router'
import { Landing } from '~/pages/landing'
import { Callback } from '~/pages/callback'
import { OnboardingPage } from '~/pages/onboarding'

/**
 * Route tree (code-based, no codegen).
 *
 *   /                  → Landing (InvestTicker + UnifiedAuthFlow)
 *   /login             → permanent redirect to / (one auth surface, one path)
 *   /auth/callback     → OIDC PKCE callback
 *   /onboarding        → resolves the resume step, redirects to $step
 *   /onboarding/$step  → the resumable KYC runner (one component, any step)
 *
 * The root just renders the active child; brand/theme is global CSS, so no
 * layout chrome is needed here.
 */

/** Parse the `?flow=` selector shared by both onboarding routes. */
function validateFlowSearch(search: Record<string, unknown>): { flow?: 'exchange-full' | 'lite' } {
  const flow = search.flow
  return flow === 'lite' || flow === 'exchange-full' ? { flow } : {}
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Landing,
})

const loginRedirectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: () => {
    throw redirect({ to: '/', replace: true })
  },
})

const callbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/callback',
  component: Callback,
})

const onboardingIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
  validateSearch: validateFlowSearch,
  component: OnboardingPage,
})

const onboardingStepRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding/$step',
  validateSearch: validateFlowSearch,
  component: OnboardingPage,
})

const routeTree = rootRoute.addChildren([
  landingRoute,
  loginRedirectRoute,
  callbackRoute,
  onboardingIndexRoute,
  onboardingStepRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
