import { cn } from '~/util'

/**
 * Lux wordmark. A bold "LUX" with the period in Lux green (`text-primary`,
 * #12FF80). Self-contained — no external SVG asset to ship. `className`
 * controls height/color of the text; the accent dot stays Lux green.
 */
export function LuxMark({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-flex items-baseline font-extrabold tracking-tight', className)}
      style={{ fontSize: '1.5rem', lineHeight: 1 }}
    >
      LUX
      <span className="text-primary">.</span>
    </span>
  )
}
