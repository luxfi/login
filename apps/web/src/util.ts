import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Conditional-classnames helper. `clsx` resolves the conditional/array/object
 * forms; `twMerge` then collapses conflicting Tailwind utilities so the last
 * one wins (e.g. `px-2 px-4` → `px-4`). Local, dependency-light `cn` so the
 * ticker has no external shared-util dependency.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
