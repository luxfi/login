import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { IamProvider } from '@hanzo/iam/react'
import { iamProviderConfig } from '@luxfi/id-auth'
import { router } from './router'
import './app.css'

/**
 * Entry. `IamProvider` owns the single `@hanzo/iam` PKCE client (Lux brand,
 * `lux.id` / `lux-id`) and exposes it via `useIam()` to the auth flow and the
 * callback page. `RouterProvider` drives the three routes.
 */
const el = document.getElementById('root')
if (!el) throw new Error('#root element missing')

createRoot(el).render(
  <StrictMode>
    <IamProvider config={iamProviderConfig()} autoInit={false}>
      <RouterProvider router={router} />
    </IamProvider>
  </StrictMode>,
)
