import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Token-existence policy — a consumer-facing test factory.
 *
 * Guards the silent-invalid-declaration class of bug: an unresolvable `var()` makes the declaration
 * invalid at computed-value time — no build error, no lint error, the property just falls back to
 * inherit/initial (this is exactly how a mistyped `--fs-title-2` shipped a headline at body size). A
 * mistyped structural token in any stylesheet — or a `var(--blur-*)` consumed inline in TSX (the
 * Toaster, gallery swatches) that a CSS-only scan would miss — fails HERE instead.
 *
 * The extraction regexes are lifted verbatim from the finance kit's `tokens.test.ts` token-existence
 * guard; this factory only parameterizes the source roots and the token-definition files, so a
 * consumer runs it over THEIR `src` with the kit's `tokens.css` PLUS their own `brand.css` as the
 * definition sources.
 */

const toPosix = (p: string): string => p.replace(/\\/g, '/')

/** A scanned file: its display path (root-relative, posix) and raw text. */
export interface ScannedFile {
  path: string
  content: string
}

function collectFiles(roots: string[], keep: (posixRelative: string) => boolean): ScannedFile[] {
  const files: ScannedFile[] = []
  for (const root of roots) {
    const absRoot = resolve(process.cwd(), root)
    const displayRoot = toPosix(root).replace(/\/+$/, '')
    for (const entry of readdirSync(absRoot, { recursive: true })) {
      const relative = toPosix(String(entry))
      if (!keep(relative)) continue
      files.push({ path: `${displayRoot}/${relative}`, content: readFileSync(resolve(absRoot, relative), 'utf8') })
    }
  }
  return files
}

/** A definition matches `--<prefix>-<name>` immediately followed by a colon (a property position);
 *  `var(--<prefix>-…)` usages carry no following colon, so the lookahead excludes them. */
const DEFINITION_RE = /--(?:fs|lh|tracking|space|dur|ease|blur)-[a-z0-9-]+(?=\s*:)/g
/** A usage anchors on `var(--<prefix>-` so non-token `var(` text in TS never false-positives. */
const USAGE_RE = /var\(\s*(--(?:fs|lh|tracking|space|dur|ease|blur)-[a-z0-9-]+)/g

/** The set of `--fs|lh|tracking|space|dur|ease|blur-*` tokens DEFINED across the given token-source
 *  file contents (their union — pass tokens.css AND a brand.css to accept both). */
export function definedTokens(tokenCssContents: string[]): Set<string> {
  const defined = new Set<string>()
  for (const css of tokenCssContents) {
    for (const match of css.match(DEFINITION_RE) ?? []) defined.add(match)
  }
  return defined
}

/** Every `var(--fs|lh|tracking|space|dur|ease|blur-*)` consumed in `consumers` that is NOT in
 *  `defined`. */
export function findUndefinedTokenUsages(
  defined: Set<string>,
  consumers: ScannedFile[],
): { path: string; token: string }[] {
  const out: { path: string; token: string }[] = []
  for (const { path, content } of consumers) {
    for (const match of content.matchAll(USAGE_RE)) {
      if (!defined.has(match[1])) out.push({ path, token: match[1] })
    }
  }
  return out
}

export interface TokenUsagePolicyOptions {
  /** Directory roots (relative to `process.cwd()` or absolute) walked for `*.{css,ts,tsx}` whose
   *  structural-token usages are checked. */
  srcRoots: string[]
  /** The token-DEFINITION files (e.g. the kit's `tokens.css` plus the consumer's `brand.css`). A
   *  token defined in ANY of them counts as defined. */
  tokenCssPaths: string[]
}

/**
 * Register the token-existence suite: every `--fs|lh|tracking|space|dur|ease|blur-*` consumed under
 * `srcRoots` must be defined in one of `tokenCssPaths`.
 *
 * @example
 * // In the consumer's own vitest run, checking their src against the kit + their brand overrides:
 * import { runTokenUsagePolicy } from '@satrio/glass-design/testing'
 * import { fileURLToPath } from 'node:url'
 * runTokenUsagePolicy({
 *   srcRoots: ['src'],
 *   tokenCssPaths: [
 *     fileURLToPath(new URL('../node_modules/@satrio/glass-design/src/styles/tokens.css', import.meta.url)),
 *     'src/styles/brand.css',
 *   ],
 * })
 */
export function runTokenUsagePolicy({ srcRoots, tokenCssPaths }: TokenUsagePolicyOptions): void {
  describe(`token-existence guard (${srcRoots.join(', ')})`, () => {
    it('defines every fs/lh/tracking/space/dur/ease/blur token consumed under srcRoots', () => {
      const defined = definedTokens(tokenCssPaths.map((p) => readFileSync(resolve(process.cwd(), p), 'utf8')))
      expect(
        defined.size,
        `no --fs/--lh/--tracking/--space/--dur/--ease/--blur tokens defined across ${tokenCssPaths.join(', ')} — check tokenCssPaths`,
      ).toBeGreaterThan(0)

      const consumers = collectFiles(srcRoots, (relative) => /\.(css|ts|tsx)$/.test(relative))
      const undefinedUsages = findUndefinedTokenUsages(defined, consumers)
      expect(
        undefinedUsages,
        undefinedUsages
          .map(({ path, token }) => `${token} is used in ${path} but not defined in any of ${tokenCssPaths.join(', ')} — an unresolvable var() silently falls back to inherit/initial (no build error)`)
          .join('\n'),
      ).toEqual([])
    })
  })
}
