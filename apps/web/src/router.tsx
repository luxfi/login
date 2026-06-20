import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  Outlet,
} from '@tanstack/react-router'
import { Landing } from '~/pages/landing'
import { Callback } from '~/pages/callback'

/**
 * Route tree (code-based, no codegen).
 *
 *   /              → Landing (InvestTicker + UnifiedAuthFlow)
 *   /login         → permanent redirect to / (one auth surface, one path)
 *   /auth/callback → OIDC PKCE callback
 *
 * The root just renders the active child; brand/theme is global CSS, so no
 * layout chrome is needed here.
 */

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

const routeTree = rootRoute.addChildren([landingRoute, loginRedirectRoute, callbackRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
