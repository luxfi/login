import { CATEGORIES } from './ticker-data'

/**
 * Motion model for the InvestTicker, kept pure and separate from the React
 * component. Two concerns live here:
 *
 *   1. The exponential acceleration curve — a single global index across every
 *      asset in every category maps to a per-step dwell time. The ticker
 *      starts slow and readable and ramps to a blur by the last crypto symbol.
 *   2. The responsive geometry table — row height, paddings, and font size
 *      switch at the mobile breakpoint.
 *
 * Nothing here touches the DOM; the component reads these values and renders.
 */

/** Total assets across all categories — the denominator of the speed curve. */
export const TOTAL_ASSETS = CATEGORIES.reduce((n, c) => n + c.assets.length, 0)

/** Dwell on the first asset: slow enough to read. */
const DWELL_START_MS = 320
/** Dwell on the last asset: a blur. */
const DWELL_END_MS = 35

/**
 * Dwell time, in ms, for the asset at `globalIndex` (0-based across the whole
 * universe). Geometric interpolation between the start and end dwell, so the
 * acceleration feels smooth and exponential rather than linear:
 *
 *     dwell(i) = START · (END / START) ^ (i / (TOTAL - 1))
 *
 * Clamped at `DWELL_END_MS` so it never undershoots on the final symbol.
 */
export function dwellAt(globalIndex: number): number {
  if (TOTAL_ASSETS <= 1) return DWELL_END_MS
  const t = globalIndex / (TOTAL_ASSETS - 1)
  const ms = DWELL_START_MS * Math.pow(DWELL_END_MS / DWELL_START_MS, t)
  return Math.max(DWELL_END_MS, Math.round(ms))
}

/** Global index of the first asset of category `catIndex`. */
export function categoryOffset(catIndex: number): number {
  let n = 0
  for (let i = 0; i < catIndex; i++) n += CATEGORIES[i]!.assets.length
  return n
}

/** How long the finale ("anything." + lines) holds before the cycle restarts. */
export const FINALE_HOLD_MS = 5200

/** Brief beat between the last symbol of a category and the next category. */
export const CATEGORY_GAP_MS = 220

export interface TickerGeometry {
  /** Per-row height in px; also the vertical translate step of the column. */
  readonly rowHeight: number
  /** Left padding of the scrolling column so it aligns under the headline. */
  readonly columnPadLeft: number
  /** Headline + active-label font size in px. */
  readonly fontSize: number
  /** Fixed width reserved for the symbol+delta link, prevents reflow jitter. */
  readonly symbolWidth: number
  /** Finale subtitle font size in px. */
  readonly subtitleSize: number
  /** Visible rows in the masked column viewport. */
  readonly visibleRows: number
}

export const GEOMETRY_DESKTOP: TickerGeometry = {
  rowHeight: 40,
  columnPadLeft: 158,
  fontSize: 26,
  symbolWidth: 104,
  subtitleSize: 16,
  visibleRows: 5,
}

export const GEOMETRY_MOBILE: TickerGeometry = {
  rowHeight: 32,
  columnPadLeft: 78,
  fontSize: 20,
  symbolWidth: 80,
  subtitleSize: 13,
  visibleRows: 5,
}

/** Media query that selects the compact geometry. */
export const MOBILE_QUERY = '(max-width: 639px)'
