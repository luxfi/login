// Synchronous ESM resolve hook for `node --test` (node:module registerHooks).
//
// The package source uses extensionless relative imports (the repo
// convention, shared with @luxfi/id-idv and the TypeScript `bundler`
// resolver). Node's `--experimental-strip-types` runtime resolver does NOT
// append `.ts`, so a bare `node --test` can't follow `./types` from
// `flows.ts`. This hook appends `.ts` / `.tsx` for relative specifiers with no
// extension, letting the tests run the real source unchanged — one import
// convention everywhere, no build step.
import { registerHooks } from 'node:module'
import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const RELATIVE = /^\.\.?\//
const HAS_EXT = /\.[cm]?[jt]sx?$|\.json$/

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (RELATIVE.test(specifier) && !HAS_EXT.test(specifier)) {
      for (const ext of ['.ts', '.tsx']) {
        const candidate = new URL(specifier + ext, context.parentURL)
        try {
          if (statSync(fileURLToPath(candidate)).isFile()) {
            return nextResolve(specifier + ext, context)
          }
        } catch {
          // try the next extension
        }
      }
    }
    return nextResolve(specifier, context)
  },
})
