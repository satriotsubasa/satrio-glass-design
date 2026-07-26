import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TOKENS_CSS_PATH } from './paths'

/**
 * Which tokens a consumer brand file MAY override. Everything else is the
 * system's structure — one language across apps — and stays locked:
 * type ramp (--fs/--lh/--tracking), spacing, blur LADDER TIERS, easings,
 * durations, --app-font-scale.
 */
export const BRAND_TOKENS: ReadonlySet<string> = new Set([
  // neutral palette + text
  '--bg', '--surface', '--surface-2', '--label', '--label-2', '--label-3', '--separator',
  // accent + status
  '--accent', '--accent-fill', '--danger', '--income', '--expense', '--warning', '--warning-fill',
  // glass + surface tints (colors, not blur amounts)
  '--glass-bg', '--glass-bg-strong', '--glass-border', '--glass-highlight', '--glass-shadow',
  '--shadow-sheet', '--sheet-bg', '--menu-bg', '--nav-bg',
  '--panel-bg', '--panel-border',
  '--card-bg', '--card-border', '--card-highlight', '--card-shadow',
  '--backdrop',
  // geometry
  '--radius-card', '--radius-tile', '--radius-control',
  // material thickness ALIASES (retargetable; ladder tiers --blur-* are locked)
  '--glass-blur', '--panel-blur', '--card-blur',
])

/**
 * The two OS accessibility signals whose token collapse a later-in-cascade brand
 * override can silently defeat. tokens.css re-zeroes every blur and pins the
 * translucent surface fills to the opaque --surface inside BOTH of these @media
 * blocks (the contrast block additionally promotes the hairline borders); a brand
 * override of a managed token at :root beats them by source order and must
 * therefore re-assert the token under each block that governs it.
 */
export const A11Y_MEDIA = [
  'prefers-reduced-transparency: reduce',
  'prefers-contrast: more',
] as const

type Scope = string

/** Normalise a media condition to a whitespace/paren-free key for comparison. */
function normalizeMediaCondition(condition: string): string {
  return condition.replace(/[()\s]/g, '').toLowerCase()
}

const A11Y_BY_NORMALIZED = new Map<string, string>(
  A11Y_MEDIA.map((feature) => [normalizeMediaCondition(feature), feature]),
)

/** Map a raw `@media` condition to its canonical a11y key, or the trimmed condition. */
function scopeForMedia(condition: string): Scope {
  return A11Y_BY_NORMALIZED.get(normalizeMediaCondition(condition)) ?? condition.trim()
}

/** Themes an override can apply to. The black theme is painted with BOTH
 * data-theme="dark" and data-theme-mode="black" (applyTheme.ts), so a dark-scoped
 * rule also governs the black theme. */
type Theme = 'light' | 'dark' | 'black'

/** Selector scope for a :root-anchored declaration: how specific the rule is and
 * which themes it governs. Custom-property overrides only ever anchor on :root plus
 * an optional theme attribute, so these three scopes cover the whole vocabulary. */
const SELECTOR_SCOPES: Record<string, { specificity: number; themes: readonly Theme[] }> = {
  root: { specificity: 1, themes: ['light', 'dark', 'black'] },
  dark: { specificity: 2, themes: ['dark', 'black'] },
  black: { specificity: 2, themes: ['black'] },
}

function selectorScope(key: string): { specificity: number; themes: readonly Theme[] } {
  return SELECTOR_SCOPES[key] ?? SELECTOR_SCOPES.root
}

/** Map one selector to its scope key. data-theme-mode is tested first because it
 * contains "data-theme" as a substring; both quote styles are accepted. */
function selectorKeyFor(selector: string): string {
  if (/data-theme-mode\s*=\s*['"]?black/i.test(selector)) return 'black'
  if (/data-theme\s*=\s*['"]?dark/i.test(selector)) return 'dark'
  return 'root'
}

/** Split a selector list ("a, b, c") into its distinct scope keys. */
function parseSelectorList(selectorText: string): string[] {
  const keys: string[] = []
  for (const part of selectorText.split(',')) {
    const trimmed = part.trim()
    if (trimmed.length === 0) continue
    const key = selectorKeyFor(trimmed)
    if (!keys.includes(key)) keys.push(key)
  }
  return keys
}

/** A scope key is `${media}|${selector}`; media never contains '|'. */
function parseScopeKey(key: string): { media: string; selector: string } {
  const bar = key.indexOf('|')
  if (bar === -1) return { media: key, selector: 'root' }
  return { media: key.slice(0, bar), selector: key.slice(bar + 1) }
}

type Frame = { kind: 'media'; media: Scope } | { kind: 'rule'; selectors: string[] }

/**
 * Split css into (scope, declarations) chunks without a CSS-parser dependency.
 * Each declaration is recorded once per selector it is written against, under a
 * scope key `${media}|${selector}`:
 *   - media: 'base' outside any a11y @media, else the canonical A11Y_MEDIA feature
 *     string (a non-a11y @media keeps its raw trimmed condition).
 *   - selector: 'root' for plain :root, 'dark' / 'black' for the theme-scoped
 *     selectors — a selector list records the declaration under each of its scopes.
 * The selector dimension is what lets the collapse check reason about specificity:
 * a theme-scoped override (0,2,0) beats a media :root tail (0,1,0) regardless of
 * source order, so its tail must carry a selector of at least equal specificity.
 *
 * Comments are stripped first so commented-out template declarations never count.
 * A declaration is `--name:` at a property position; `var(--name)` usages carry no
 * following colon, so the colon lookahead excludes them.
 */
export function parseDeclaredTokens(css: string): Map<string, string[]> {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const declared = new Map<string, string[]>()
  const stack: Frame[] = []
  const n = source.length
  let i = 0
  let segmentStart = 0

  const currentMedia = (): Scope => {
    for (let f = stack.length - 1; f >= 0; f -= 1) {
      const frame = stack[f]
      if (frame.kind === 'media') return frame.media
    }
    return 'base'
  }

  const currentSelectors = (): string[] | undefined => {
    for (let f = stack.length - 1; f >= 0; f -= 1) {
      const frame = stack[f]
      if (frame.kind === 'rule') return frame.selectors
    }
    return undefined
  }

  const record = (token: string, scopeKey: string): void => {
    const scopes = declared.get(token)
    if (scopes === undefined) declared.set(token, [scopeKey])
    else if (!scopes.includes(scopeKey)) scopes.push(scopeKey)
  }

  while (i < n) {
    const ch = source[i]

    // @media header — consume through its opening brace and push a media frame.
    if (ch === '@' && source.startsWith('@media', i)) {
      const braceIndex = source.indexOf('{', i)
      if (braceIndex === -1) break
      const condition = source.slice(i + '@media'.length, braceIndex)
      stack.push({ kind: 'media', media: scopeForMedia(condition) })
      i = braceIndex + 1
      segmentStart = i
      continue
    }

    if (ch === '{') {
      stack.push({ kind: 'rule', selectors: parseSelectorList(source.slice(segmentStart, i)) })
      i += 1
      segmentStart = i
      continue
    }

    if (ch === '}') {
      stack.pop()
      i += 1
      segmentStart = i
      continue
    }

    if (ch === ';') {
      i += 1
      segmentStart = i
      continue
    }

    // Custom-property declaration: --name followed by a colon, inside a rule block.
    if (ch === '-' && source[i + 1] === '-') {
      const match = /^--[a-z0-9-]+/i.exec(source.slice(i))
      if (match) {
        const token = match[0]
        let j = i + token.length
        while (j < n && /\s/.test(source[j])) j += 1
        const selectors = currentSelectors()
        if (source[j] === ':' && selectors) {
          const media = currentMedia()
          for (const selector of selectors) record(token, `${media}|${selector}`)
        }
        i += token.length
        continue
      }
    }

    i += 1
  }

  return declared
}

/** Every custom property the brand file declares that is NOT brand-overridable. */
export function findDisallowedTokens(brandCss: string): string[] {
  const disallowed: string[] = []
  for (const token of parseDeclaredTokens(brandCss).keys()) {
    if (!BRAND_TOKENS.has(token)) disallowed.push(token)
  }
  return disallowed
}

/**
 * Whether the a11y-tail selectors out-rank an override's selector for every theme
 * the override governs. Equal specificity is sufficient because the tail sits later
 * in source order; a plain :root tail (specificity 1) therefore does NOT cover a
 * theme-scoped override (specificity 2), the failure the collapse check must catch.
 */
function tailCoversOverride(overrideSelector: string, tailSelectors: string[]): boolean {
  const override = selectorScope(overrideSelector)
  return override.themes.every((theme) =>
    tailSelectors.some((tail) => {
      const scope = selectorScope(tail)
      return scope.themes.includes(theme) && scope.specificity >= override.specificity
    }),
  )
}

/**
 * For every collapse-managed token the brand file overrides outside the a11y media
 * (its :root / theme blocks), the a11y blocks in tokens.css that govern it whose
 * collapse the brand file fails to re-assert at sufficient selector specificity.
 * The ground truth (which token collapses under which media) is derived from
 * tokens.css itself, so it tracks the a11y contract without a hardcoded list.
 */
export function findMissingCollapseTails(
  brandCss: string,
  tokensCss: string,
): Array<{ token: string; media: string }> {
  const brandDeclared = parseDeclaredTokens(brandCss)
  const tokensDeclared = parseDeclaredTokens(tokensCss)
  const missing: Array<{ token: string; media: string }> = []
  for (const [token, scopeKeys] of brandDeclared) {
    const scopes = scopeKeys.map(parseScopeKey)
    const baseOverrides = scopes.filter((scope) => scope.media === 'base')
    if (baseOverrides.length === 0) continue
    const collapsedUnder = new Set(
      (tokensDeclared.get(token) ?? []).map((key) => parseScopeKey(key).media),
    )
    for (const media of A11Y_MEDIA) {
      if (!collapsedUnder.has(media)) continue
      const tailSelectors = scopes
        .filter((scope) => scope.media === media)
        .map((scope) => scope.selector)
      const covered = baseOverrides.every((override) =>
        tailCoversOverride(override.selector, tailSelectors),
      )
      if (!covered) missing.push({ token, media })
    }
  }
  return missing
}

/**
 * Register the brand-policy suite for a consumer's brand.css. Two guarantees:
 * the file overrides only brand-approved tokens, and every collapse-managed token
 * it touches re-asserts the a11y collapse so a later-cascade override cannot
 * silently defeat Reduce Transparency / Increase Contrast.
 *
 * Paths are plain strings, resolved against `process.cwd()` when relative. Never wrap one in
 * `fileURLToPath(new URL(<string literal>, import.meta.url))` (Vite and vitest rewrite that
 * expression into an http dev-server URL under a jsdom/happy-dom test environment).
 *
 * @example
 * // src/styles/brand.policy.test.ts — in the consumer's own vitest run:
 * import { runBrandPolicy } from '@satrio/glass-design/testing'
 * runBrandPolicy({ brandCssPath: 'src/styles/brand.css' })
 */
export function runBrandPolicy({
  brandCssPath,
  tokensCssPath,
}: {
  brandCssPath: string
  /** defaults to TOKENS_CSS_PATH — this package's own tokens.css */
  tokensCssPath?: string
}): void {
  describe('brand policy: ' + brandCssPath, () => {
    it('overrides only brand-approved tokens', () => {
      const brandCss = readFileSync(resolve(process.cwd(), brandCssPath), 'utf8')
      const disallowed = findDisallowedTokens(brandCss)
      expect(
        disallowed,
        disallowed.length === 0
          ? ''
          : `brand.css overrides locked structural token(s) ${disallowed.join(', ')} — only ` +
            'BRAND_TOKENS (palette, accents, surface tints, geometry, blur aliases) may be branded.',
      ).toEqual([])
    })

    it('re-asserts the a11y collapse for every collapse-managed token it overrides', () => {
      const brandCss = readFileSync(resolve(process.cwd(), brandCssPath), 'utf8')
      const tokensCss = readFileSync(resolve(process.cwd(), tokensCssPath ?? TOKENS_CSS_PATH), 'utf8')
      const missing = findMissingCollapseTails(brandCss, tokensCss)
      expect(
        missing,
        missing.length === 0
          ? ''
          : 'brand.css overrides collapse-managed tokens without re-asserting the a11y tail — add ' +
            missing.map(({ token, media }) => `${token} under @media (${media})`).join('; ') +
            '. An override beats tokens.css\'s collapse by source order (theme-scoped overrides ' +
            'also by specificity); re-declare each in the matching @media block at the end of ' +
            'brand.css under a selector that covers the override\'s scope (a plain :root tail does ' +
            'not cover a :root[data-theme=…] override).',
      ).toEqual([])
    })
  })
}
