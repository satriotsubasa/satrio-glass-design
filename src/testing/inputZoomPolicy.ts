import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * iOS focus-zoom floor policy — a consumer-facing test factory.
 *
 * iOS Safari zooms the viewport when a focused `<input>`/`<textarea>` has a computed font-size below
 * 16px, and refuses to zoom back out until the field blurs — so on mobile every real text-entry
 * control MUST floor its font-size at 16px. The kit's ramp is entirely sub-16px (`--fs-body` 15px,
 * `--fs-callout` 13px, `--fs-caption` 12px), so the sanctioned idiom is `max(16px, var(--fs-*))`: it
 * holds the 16px zoom guard at every fontScale, still references a ramp token (so the token-usage
 * scan passes), and lets the field grow past 16px once the user scales type up.
 *
 * The `.control` chokepoint floors TextInput, Textarea, and every kit consumer in ONE declaration.
 * The FLOOR check is lifted from the finance kit's `inputZoom.test.ts`; this factory generalizes it
 * from named-rule assertions to a scan: EVERY `font-size` in the given input-CSS `cssPaths` must be
 * the floor idiom, unless it is a documented `rawInputAllowlist` exception (a font-size that is not
 * a focus-zooming text input — e.g. a label glyph in the same module).
 */

const toPosix = (p: string): string => p.replace(/\\/g, '/')

const FONT_SIZE_RE = /font-size:\s*([^;]+);/g
/** The sanctioned floor: `max(16px, var(--fs-*))` (whitespace-tolerant, whole-value). */
const FLOOR_RE = /^max\(\s*16px\s*,\s*var\(--fs-[a-z0-9-]+\)\s*\)$/

/** A scanned CSS file: display path + raw text. */
export interface ScannedFile {
  path: string
  content: string
}

/** Every `font-size` value in `files` that is neither the `max(16px, var(--fs-*))` floor nor an
 *  allowlisted `${path}: ${value}` exception. */
export function findUnflooredFontSizes(
  files: ScannedFile[],
  allowlist: string[] = [],
): { path: string; value: string }[] {
  const out: { path: string; value: string }[] = []
  for (const { path, content } of files) {
    for (const match of content.matchAll(FONT_SIZE_RE)) {
      const value = match[1].trim()
      if (FLOOR_RE.test(value)) continue
      if (allowlist.includes(`${path}: ${value}`)) continue
      out.push({ path, value })
    }
  }
  return out
}

/** How many `font-size` declarations across `files` actually carry the 16px floor (a plausibility
 *  guard, so an empty/renamed set of paths cannot pass the scan vacuously). */
export function countFlooredFontSizes(files: ScannedFile[]): number {
  let n = 0
  for (const { content } of files) {
    for (const match of content.matchAll(FONT_SIZE_RE)) {
      if (FLOOR_RE.test(match[1].trim())) n += 1
    }
  }
  return n
}

/** Allowlist entries whose `${path}: ${value}` site no longer exists in `files` (a stale entry is a
 *  hole in the scan). */
export function findStaleAllowlist(files: ScannedFile[], allowlist: string[]): string[] {
  const present = new Set<string>()
  for (const { path, content } of files) {
    for (const match of content.matchAll(FONT_SIZE_RE)) present.add(`${path}: ${match[1].trim()}`)
  }
  return allowlist.filter((entry) => !present.has(entry))
}

export interface InputZoomPolicyOptions {
  /** CSS files (relative to `process.cwd()` or absolute) that style text-entry controls — every
   *  `font-size` in them is held to the 16px floor. */
  cssPaths: string[]
  /** Documented `${displayPath}: ${value}` exceptions for a `font-size` that is NOT a focus-zooming
   *  text input (e.g. an icon glyph sized in px inside an input module). A stale entry fails. */
  rawInputAllowlist?: string[]
}

/**
 * Register the iOS input-zoom floor suite over `cssPaths`.
 *
 * @example
 * // In the consumer's own vitest run, over the CSS files that style their raw inputs:
 * import { runInputZoomPolicy } from '@satrio/glass-design/testing'
 * runInputZoomPolicy({
 *   cssPaths: ['src/features/auth/LoginPage.module.css'],
 *   rawInputAllowlist: [], // grows only with a documented non-input font-size
 * })
 */
export function runInputZoomPolicy({ cssPaths, rawInputAllowlist = [] }: InputZoomPolicyOptions): void {
  const files: ScannedFile[] = cssPaths.map((p) => ({
    path: toPosix(p),
    content: readFileSync(resolve(process.cwd(), p), 'utf8'),
  }))

  describe(`iOS focus-zoom floor (${cssPaths.join(', ')})`, () => {
    it('floors every text-input font-size at 16px via max(16px, var(--fs-*))', () => {
      const unfloored = findUnflooredFontSizes(files, rawInputAllowlist)
      expect(
        unfloored,
        unfloored
          .map(({ path, value }) => `font-size "${value}" in ${path} sits below the iOS 16px focus-zoom floor — use max(16px, var(--fs-*)), or add "${path}: ${value}" to rawInputAllowlist if it is not a focus-zooming text input`)
          .join('\n'),
      ).toEqual([])
    })

    it('actually finds a 16px floor (the scan is not vacuously green)', () => {
      expect(
        countFlooredFontSizes(files),
        `no max(16px, var(--fs-*)) floor found in ${cssPaths.join(', ')} — did the input CSS paths change?`,
      ).toBeGreaterThan(0)
    })

    it('carries no stale rawInputAllowlist entries', () => {
      const stale = findStaleAllowlist(files, rawInputAllowlist)
      expect(
        stale,
        stale.map((entry) => `stale rawInputAllowlist entry "${entry}" — the site no longer exists, remove it`).join('\n'),
      ).toEqual([])
    })
  })
}
