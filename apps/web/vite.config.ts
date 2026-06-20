import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

/**
 * Lux ID web app. Vite + React 19 + Tailwind v4 (CSS-first, no config file —
 * tokens live in `src/app.css` `@theme`). TanStack Router drives client-side
 * routing; the app is a static SPA served behind hanzoai/ingress.
 *
 * `~` aliases `src/` to match the import style ported from the source ticker.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '~': resolve(__dirname, 'src') },
  },
  server: { port: 5173, host: '0.0.0.0' },
  preview: { port: 5174, host: '0.0.0.0' },
  build: { target: 'es2022', sourcemap: true },
})
