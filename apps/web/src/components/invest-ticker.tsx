import { useEffect, useRef, useState } from 'react'
import { cn } from '~/util'
import { getConfig } from '~/lib/runtime'
import {
  CATEGORIES,
  CYCLE_LABELS,
  FINALE_LINES,
} from './ticker-data'
import {
  GEOMETRY_DESKTOP,
  GEOMETRY_MOBILE,
  MOBILE_QUERY,
  type TickerGeometry,
  dwellAt,
  categoryOffset,
  FINALE_HOLD_MS,
  CATEGORY_GAP_MS,
} from './ticker-motion'

/**
 * InvestTicker — the login centerpiece.
 *
 * Reads "Invest in {category} {SYMBOL}", cycling the active category through
 * stocks → bonds → … → crypto, then resolving to "anything." The symbol cycle
 * accelerates exponentially across the whole asset universe (slow + readable →
 * a blur). Behind the headline, a vertical column of category labels scrolls
 * with the active one in focus and the rest receding into a depth blur under a
 * top/bottom fade mask. On the finale, three marketing lines stagger in and
 * the last sweeps grey → white → Lux green.
 *
 * Clean-room implementation of the documented UX. Composes two pure modules:
 * `ticker-data` (the asset universe) and `ticker-motion` (the speed curve +
 * responsive geometry). The component owns only timers and render.
 */

const EXCHANGE_HOST = getConfig().exchangeHost
const API_HOST = getConfig().apiHost

// Top/bottom fade so the scrolling column dissolves at the viewport edges.
const COLUMN_MASK =
  'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)'
// Decelerating ease for the column slide and the cross-fades.
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'
// Row offset that places the active label on the focus line of the column.
const FOCUS_ROW = 2

const FALLBACK_ASSET_COUNT = 13_000

/** Pick the compact vs full geometry, tracking the breakpoint via matchMedia. */
function useGeometry(): TickerGeometry {
  const [geometry, setGeometry] = useState<TickerGeometry>(() => {
    if (typeof window === 'undefined') return GEOMETRY_DESKTOP
    return window.matchMedia(MOBILE_QUERY).matches ? GEOMETRY_MOBILE : GEOMETRY_DESKTOP
  })
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY)
    const sync = () => setGeometry(mql.matches ? GEOMETRY_MOBILE : GEOMETRY_DESKTOP)
    sync()
    mql.addEventListener('change', sync)
    return () => mql.removeEventListener('change', sync)
  }, [])
  return geometry
}

/** Live total-asset count from the Lux ATS, falling back to a headline number. */
function useAssetCount(): number {
  const [count, setCount] = useState(FALLBACK_ASSET_COUNT)
  useEffect(() => {
    const ac = new AbortController()
    fetch(`${API_HOST}/v1/ats/assets/count`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { count?: number } | null) => {
        if (d?.count && d.count > FALLBACK_ASSET_COUNT) setCount(d.count)
      })
      .catch(() => {})
    return () => ac.abort()
  }, [])
  return count
}

/** Shortest wrap-around distance between two indices on a ring of size `n`. */
function ringDistance(a: number, b: number, n: number): number {
  const d = Math.abs(a - b)
  return Math.min(d, n - d)
}

export interface InvestTickerProps {
  readonly className?: string
}

export default function InvestTicker({ className }: InvestTickerProps) {
  const geo = useGeometry()
  const assetCount = useAssetCount()
  // catIndex ranges 0..CATEGORIES.length; the last value is the "anything." finale.
  const [catIndex, setCatIndex] = useState(0)
  const [symbolIndex, setSymbolIndex] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onFinale = catIndex >= CATEGORIES.length
  const category = onFinale ? null : CATEGORIES[catIndex]!
  const asset = category?.assets[symbolIndex]

  // Drive the symbol cycle and category/finale advancement off a single
  // self-scheduling timeout so each step can carry its own (accelerating)
  // dwell time. Re-armed whenever the active category changes.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)

    const advanceCategory = () => {
      setSymbolIndex(0)
      setCatIndex((c) => (c + 1 > CATEGORIES.length ? 0 : c + 1))
    }

    if (onFinale) {
      timer.current = setTimeout(advanceCategory, FINALE_HOLD_MS)
      return () => void (timer.current && clearTimeout(timer.current))
    }

    const assets = category!.assets
    const offset = categoryOffset(catIndex)

    const step = (i: number) => {
      setSymbolIndex(i)
      if (i >= assets.length - 1) {
        timer.current = setTimeout(advanceCategory, CATEGORY_GAP_MS)
        return
      }
      timer.current = setTimeout(() => step(i + 1), dwellAt(offset + i))
    }

    timer.current = setTimeout(() => step(1), dwellAt(offset))
    return () => void (timer.current && clearTimeout(timer.current))
  }, [catIndex, onFinale, category])

  // Scrolling column. Three concatenated copies of the label ring give a
  // seamless wrap; we translate to keep the active label on the focus row.
  const ring = CYCLE_LABELS.length
  const rows = [...CYCLE_LABELS, ...CYCLE_LABELS, ...CYCLE_LABELS]
  const activeRing = catIndex % ring
  const translateY = -((ring + activeRing - FOCUS_ROW) * geo.rowHeight)
  const activeLabel = CYCLE_LABELS[activeRing]!

  return (
    <div className={cn('flex flex-col items-center', className)}>
      {/* Headline + scrolling column share one fixed-height stage. */}
      <div
        className="relative w-full"
        style={{ height: geo.visibleRows * geo.rowHeight, maxWidth: 480 }}
      >
        {/* Depth-blurred scrolling category column behind the headline. */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            maskImage: COLUMN_MASK,
            WebkitMaskImage: COLUMN_MASK,
            opacity: onFinale ? 0 : 1,
            transition: `opacity 0.8s ${EASE}`,
          }}
        >
          <div
            className="will-change-transform"
            style={{
              transform: `translateY(${translateY}px)`,
              transition: `transform 0.7s ${EASE}`,
            }}
          >
            {rows.map((label, i) => {
              const d = ringDistance(i % ring, activeRing, ring)
              const focused = d === 0
              const opacity = focused ? 1 : d === 1 ? 0.45 : d === 2 ? 0.25 : 0.15
              const blur = focused ? 0 : d === 1 ? 0 : d === 2 ? 1.5 : Math.min(d * 1.5, 4)
              return (
                <div
                  key={`${label}-${i}`}
                  className="flex items-center"
                  style={{
                    height: geo.rowHeight,
                    paddingLeft: geo.columnPadLeft,
                    opacity,
                    filter: blur > 0 ? `blur(${blur}px)` : undefined,
                    transition: `all 0.7s ${EASE}`,
                  }}
                >
                  <span
                    className={cn(
                      'font-bold whitespace-nowrap',
                      focused ? 'text-transparent' : 'text-muted-foreground',
                    )}
                    style={{ fontSize: geo.fontSize }}
                  >
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* "Invest in {active} {SYMBOL}" — pinned, never scrolls. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className="shrink-0 font-bold whitespace-nowrap text-foreground"
            style={{ fontSize: geo.fontSize }}
          >
            Invest in&nbsp;
          </span>
          <div className="flex items-center gap-3 overflow-hidden">
            {category ? (
              <a
                href={`${EXCHANGE_HOST}${category.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="pointer-events-auto cursor-pointer font-bold whitespace-nowrap text-foreground transition-colors hover:text-primary"
                style={{ fontSize: geo.fontSize }}
              >
                {activeLabel}
              </a>
            ) : (
              <span
                className="animate-glow font-bold whitespace-nowrap text-foreground"
                style={{ fontSize: geo.fontSize }}
              >
                {activeLabel}
              </span>
            )}

            {asset && (
              <a
                href={`${EXCHANGE_HOST}/${asset.symbol}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group/sym pointer-events-auto flex cursor-pointer items-center whitespace-nowrap"
                style={{ width: geo.symbolWidth, transition: `color 0.3s ${EASE}` }}
              >
                <span
                  className="font-bold text-foreground/70 transition-colors group-hover/sym:text-primary"
                  style={{ fontSize: geo.fontSize }}
                >
                  {asset.symbol}
                </span>
                <span
                  className={cn(
                    'font-medium opacity-0 transition-opacity duration-300 group-hover/sym:opacity-100',
                    asset.move >= 0 ? 'text-success-9' : 'text-danger-9',
                  )}
                  style={{ fontSize: Math.max(11, geo.subtitleSize - 2) }}
                >
                  &nbsp;{asset.move >= 0 ? '▲' : '▼'} {Math.abs(asset.move).toFixed(1)}%
                </span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Finale — three lines stagger in; the last sweeps to Lux blue. */}
      <div className="flex min-h-[60px] flex-col items-center gap-1.5 px-3 text-center">
        {onFinale &&
          finaleLines(assetCount).map((line, i) => {
            const isLast = i === FINALE_LINES.length - 1
            return (
              <span
                key={i}
                className={cn(
                  'font-medium tracking-tight opacity-0',
                  isLast ? 'animate-line-glow-wave' : 'animate-fade-in',
                )}
                style={{
                  animationDelay: `${0.3 + i * 0.9}s`,
                  animationFillMode: 'forwards',
                  fontSize: geo.subtitleSize,
                }}
              >
                {line}
              </span>
            )
          })}
      </div>
    </div>
  )
}

/** Render the finale copy, substituting the live asset count into line one. */
function finaleLines(count: number): readonly string[] {
  const pretty = count >= 1000 ? `${Math.floor(count / 1000).toLocaleString()}k+` : `${count}`
  return [`${pretty} assets across every market`, FINALE_LINES[1]!, FINALE_LINES[2]!]
}
