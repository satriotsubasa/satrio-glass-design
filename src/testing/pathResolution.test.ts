// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Source guard: SHIPPED source and the consumer-facing docs must never use
 * `new URL(<string literal>, import.meta.url)` to resolve a filesystem path.
 *
 * CONSTRAINT: two transforms rewrite that exact literal expression whenever the module is
 * transformed for Vite's CLIENT environment — which is what a `jsdom`/`happy-dom` vitest
 * environment uses:
 *   - Vite's `vite:asset-import-meta-url` replaces the string literal with a dev-server URL path;
 *   - Vitest's `vitest:normalize-url` then replaces `import.meta.url` with `self.location`.
 * The expression evaluates to `http://localhost:3000/…` and `fileURLToPath` throws
 * `TypeError: The URL must be of scheme file`. Both transforms match the literal TEXT (a string
 * literal argument and the identifier `URL`), so `dirname(fileURLToPath(import.meta.url))` +
 * `join()` — and plain `process.cwd()`-relative string paths — are untouched everywhere.
 *
 * Every test file in THIS repo declares `// @vitest-environment node`, whose SSR transform runs
 * neither plugin, so the failure cannot be reproduced from inside this repo — hence a SOURCE scan.
 * Test files never ship (package.json "files" excludes them) and may keep the simple pattern.
 */

/** `new URL(<string literal>, import.meta.url)` — the exact shape both transforms match. */
const REWRITTEN_PATTERN = /new\s+URL\s*\(\s*(?:'[^']+'|"[^"]+"|`[^`]+`)\s*,\s*import\.meta\.url/

const toPosix = (p: string): string => p.replace(/\\/g, '/')

const srcDir = dirname(dirname(fileURLToPath(import.meta.url)))
const repoRoot = dirname(srcDir)

/** Paths excluded from the shipped set, mirroring package.json "files" negations. */
const NOT_SHIPPED = [/(^|\/)docs\//, /(^|\/)test\//, /\.test\.tsx?$/]

const shippedSources = readdirSync(srcDir, { recursive: true })
  .map((entry) => toPosix(String(entry)))
  .filter((relative) => /\.tsx?$/.test(relative))
  .filter((relative) => !NOT_SHIPPED.some((re) => re.test(relative)))

const docFiles = ['README.md', ...readdirSync(join(repoRoot, 'docs')).map((e) => `docs/${String(e)}`)].filter(
  (relative) => relative.endsWith('.md'),
)

const testSources = readdirSync(srcDir, { recursive: true })
  .map((entry) => toPosix(String(entry)))
  .filter((relative) => /\.test\.tsx?$/.test(relative))

describe('shipped path resolution never uses the Vite-rewritten new URL idiom', () => {
  it('scans a plausible corpus of shipped sources and docs', () => {
    expect(shippedSources.length, 'no shipped .ts/.tsx found under src — did the layout change?').toBeGreaterThan(20)
    expect(shippedSources, 'the policy factories must be in the scanned set').toContain('testing/brandPolicy.ts')
    expect(docFiles, 'the README must be in the scanned doc set').toContain('README.md')
  })

  it('still bites: the pattern matches the idiom it bans and clears the sanctioned one', () => {
    expect(REWRITTEN_PATTERN.test("fileURLToPath(new URL('../styles/tokens.css', import.meta.url))")).toBe(true)
    expect(REWRITTEN_PATTERN.test("join(dirname(fileURLToPath(import.meta.url)), '..', 'styles', 'tokens.css')")).toBe(
      false,
    )
  })

  it('leaves the idiom out of every shipped source file', () => {
    const offenders = shippedSources.filter((relative) =>
      REWRITTEN_PATTERN.test(readFileSync(join(srcDir, relative), 'utf8')),
    )
    expect(
      offenders,
      offenders
        .map(
          (relative) =>
            `src/${relative} uses new URL(<string literal>, import.meta.url) — in a consumer's jsdom test run Vite + vitest rewrite it into an http dev-server URL and fileURLToPath throws "The URL must be of scheme file"; use join(dirname(fileURLToPath(import.meta.url)), …) or a process.cwd()-relative string path`,
        )
        .join('\n'),
    ).toEqual([])
  })

  it('keeps every test file that DOES use the idiom pinned to the node environment', () => {
    // Test files never ship, so they may keep the simple idiom — but only under the SSR transform,
    // which is what `// @vitest-environment node` selects. Without the pragma this repo's default
    // jsdom environment would rewrite it and the file would fail on its first path read.
    const offenders = testSources.filter((relative) => {
      const content = readFileSync(join(srcDir, relative), 'utf8')
      return REWRITTEN_PATTERN.test(content) && !content.startsWith('// @vitest-environment node')
    })
    expect(
      offenders,
      offenders
        .map(
          (relative) =>
            `src/${relative} uses new URL(<string literal>, import.meta.url) without a leading "// @vitest-environment node" pragma — under this repo's default jsdom environment the expression is rewritten into an http dev-server URL and fileURLToPath throws`,
        )
        .join('\n'),
    ).toEqual([])
  })

  it('never teaches the idiom in the consumer-facing docs', () => {
    const offenders = docFiles.filter((relative) =>
      REWRITTEN_PATTERN.test(readFileSync(join(repoRoot, relative), 'utf8')),
    )
    expect(
      offenders,
      offenders
        .map(
          (relative) =>
            `${relative} teaches new URL(<string literal>, import.meta.url) — it throws in a consumer's jsdom test run; document plain process.cwd()-relative string paths and TOKENS_CSS_PATH instead`,
        )
        .join('\n'),
    ).toEqual([])
  })
})
