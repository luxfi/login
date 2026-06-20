import { getBrand } from '@luxfi/id-auth'

/**
 * Runtime config for the web app. The source ticker called `getConfig()` for
 * `exchangeHost` / `apiHost`; here those resolve from the ONE brand config in
 * `@luxfi/id-auth` (`getBrand()`), so the IAM client and the ticker links
 * share a single source of hosts. No second copy of the host strings.
 *
 *   exchangeHost → https://lux.exchange   (ticker symbol/category links)
 *   apiHost      → https://api.lux.network (live asset count)
 */
export interface RuntimeConfig {
  readonly exchangeHost: string
  readonly apiHost: string
}

let cached: RuntimeConfig | null = null

export function getConfig(): RuntimeConfig {
  if (cached) return cached
  const brand = getBrand()
  cached = { exchangeHost: brand.exchangeHost, apiHost: brand.apiHost }
  return cached
}
