import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Press-state + hover-gating policy — a consumer-facing test factory.
 *
 * The house press state is a scale — `scale(0.97)` on compact controls, `scale(0.98)` on large
 * full-width rows, `scale(0.94)` on FABs — not a `translateY(1px)` nudge (below perception on a
 * 42px+ control, and `-webkit-tap-highlight-color: transparent` already removes the platform's own
 * press affordance, so the scale is the ONLY press feedback left on mobile). Hover, meanwhile, is a
 * pointer-only affordance: an ungated `:hover` sticks on touch after the finger lifts (the tap
 * "highlights" and never un-highlights).
 *
 * These are SCANS, not a hand-maintained list — the hand-maintained approach is how the misses ship
 * (a page copies a row without the gate or the press). A future module that does so fails here by
 * construction.
 *
 * The parser and every check below are lifted verbatim from the finance kit's proven
 * `pressStates.test.ts`; this factory only parameterizes the roots, the FAB allowlist, the
 * composed-modifier map, and the corpus-plausibility floors so any consumer can run it over their
 * own component/feature CSS.
 */

const toPosix = (p: string): string => p.replace(/\\/g, '/')

/** A scanned file: its display path (root-relative, posix) and raw text. */
export interface ScannedFile {
  path: string
  content: string
}

/** Walk each root (resolved against `process.cwd()`), keeping files whose posix path passes
 *  `keep`. The display path preserves the root as the consumer wrote it, so failure messages read
 *  back exactly like the option the consumer passed (`src/components/ui/Fab.module.css`). */
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

const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** Every selector-with-`:hover` in the file, paired with whether an enclosing block is a
 *  `hover: hover` media query. Tiny brace-stack parser — CSS Modules files have no nesting other
 *  than @media, but the stack handles any depth. */
export function hoverSelectors(css: string): { selector: string; gated: boolean }[] {
  const found: { selector: string; gated: boolean }[] = []
  const stack: string[] = []
  let buf = ''
  for (const ch of stripComments(css)) {
    if (ch === '{') {
      const prelude = buf.replace(/\s+/g, ' ').trim()
      if (prelude.includes(':hover')) {
        found.push({ selector: prelude, gated: stack.some((p) => /@media[^{]*hover:\s*hover/.test(p)) })
      }
      stack.push(prelude)
      buf = ''
    } else if (ch === '}') {
      stack.pop()
      buf = ''
    } else {
      buf += ch
    }
  }
  return found
}

/** The press-target classes of a (possibly grouped) hover prelude — the classes whose controls
 *  must ALSO declare an :active press state.
 *
 *  The prelude is split on commas and EVERY part is classified independently (validating only the
 *  first part of `.a:hover, .b:hover` fails open for `.b`). Within a part, the subject is the class
 *  of the compound the `:hover` hangs off — the LAST class in that compound, so
 *  `.rowMain:not(.rowMainStatic):hover` -> rowMain, `button.rowMain:hover` -> rowMain,
 *  `.row:hover .chevron` -> row. A part whose hover compound carries NO class (`a:hover`,
 *  `.helpText a:hover`) is a bare-element/descendant hover — a text link or the like, not a
 *  pressable control — and yields no subject: EXEMPT from pairing, not an error. Parts without any
 *  `:hover` (grouped alongside one that has it) are skipped outright. `:not(...)` groups are
 *  stripped up front — they take no selector lists here, and stripping keeps both the comma split
 *  and the class extraction from tripping on their contents. */
export function pressSubjects(prelude: string): string[] {
  const subjects: string[] = []
  for (const part of prelude.replace(/:not\([^)]*\)/g, '').split(',')) {
    if (!part.includes(':hover')) continue
    const compound = part.trim().split(/[\s>+~]+/).find((token) => token.includes(':hover'))
    const classes = compound ? [...compound.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((m) => m[1]) : []
    if (classes.length > 0) subjects.push(classes[classes.length - 1])
  }
  return subjects
}

/** Every `:hover` selector that is NOT inside a `@media (hover: hover)` block. */
export function findUngatedHovers(files: ScannedFile[]): { path: string; selector: string }[] {
  const out: { path: string; selector: string }[] = []
  for (const { path, content } of files) {
    for (const { selector, gated } of hoverSelectors(content)) {
      if (!gated) out.push({ path, selector })
    }
  }
  return out
}

const activeRe = (className: string): RegExp => new RegExp(`\\.${className}(?::not\\([^)]*\\))*:active\\b`)

/** Every tappable hover whose press subject never declares an `:active` press state in its file.
 *  `composedModifiers` maps `path -> { modifierClass: baseClass }` for a modifier class that is only
 *  ever composed onto a base class in the markup and so inherits the base's `:active`; the base is
 *  what gets verified, so the map cannot go stale silently. */
export function findUnpairedHovers(
  files: ScannedFile[],
  composedModifiers: Record<string, Record<string, string>> = {},
): { path: string; selector: string; base: string }[] {
  const out: { path: string; selector: string; base: string }[] = []
  for (const { path, content } of files) {
    const css = stripComments(content)
    for (const { selector } of hoverSelectors(content)) {
      for (const subject of pressSubjects(selector)) {
        const base = composedModifiers[path]?.[subject] ?? subject
        if (!activeRe(base).test(css)) out.push({ path, selector, base })
      }
    }
  }
  return out
}

/** Total number of press subjects across the corpus (a plausibility floor for the pairing scan,
 *  which fails OPEN for exempt hovers — a regression that classified everything as exempt would
 *  otherwise turn the whole scan into a silent no-op). */
export function countPressSubjects(files: ScannedFile[]): number {
  return files.reduce(
    (n, { content }) => n + hoverSelectors(content).reduce((m, { selector }) => m + pressSubjects(selector).length, 0),
    0,
  )
}

export interface PressStatePolicyOptions {
  /** Directory roots (relative to `process.cwd()` or absolute) walked for `*.module.css` (the hover
   *  scans) and `*.{css,ts,tsx}` excluding tests (the translateY scan). */
  cssRoots: string[]
  /** The EXACT set of module display paths permitted to define `.fab` (e.g.
   *  `['src/components/ui/Fab.module.css']`). A stray page-local `.fab` copy — the pre-extraction
   *  value-drift failure mode — fails the scan. Defaults to `[]` (no FABs allowed). */
  fabModules?: string[]
  /** `displayPath -> { modifierClass: baseClass }` for hovers whose press subject is a modifier
   *  only ever composed onto a base class in the markup (it inherits the base's `:active`). */
  composedModifiers?: Record<string, Record<string, string>>
  /** Corpus-plausibility floor: `*.module.css` count must exceed this. Defaults to the finance
   *  kit's 30 — LOWER it for a small/young consumer (the JSDoc-documented knob). */
  minModules?: number
  /** Corpus-plausibility floor: total press-subject count must exceed this. Defaults to 30's
   *  companion, 20 — lower it for a small consumer. */
  minPressSubjects?: number
}

/**
 * Register the press-state + hover-gating suite for one or more CSS roots.
 *
 * Guards, all as SCANS over `cssRoots`:
 *  - every `:hover` rule sits inside a `@media (hover: hover)` block (no sticky hover on touch);
 *  - every tappable `:hover` is paired with an `:active` press state on the same control;
 *  - no `translateY(1px)` press states survive anywhere (the house press is `scale()`);
 *  - exactly the declared `fabModules` define `.fab`, each with a `scale(0.94)` press over a
 *    transition that names `transform`;
 *  - the `pressSubjects` parser contract holds (registered as its own describe every run).
 *
 * @example
 * // In the consumer's own vitest run (e.g. finance.satrio.io / satrio.io):
 * import { runPressStatePolicy } from '@satrio/glass-design/testing'
 * runPressStatePolicy({
 *   cssRoots: ['src/features'],
 *   fabModules: ['src/components/ui/Fab.module.css'],
 *   composedModifiers: { 'src/features/x.module.css': { danger: 'actionButton' } },
 * })
 */
export function runPressStatePolicy({
  cssRoots,
  fabModules = [],
  composedModifiers = {},
  minModules = 30,
  minPressSubjects = 20,
}: PressStatePolicyOptions): void {
  const scope = cssRoots.join(', ')
  const moduleFiles = collectFiles(cssRoots, (relative) => relative.endsWith('.module.css'))
  const sourceFiles = collectFiles(
    cssRoots,
    (relative) => /\.(css|ts|tsx)$/.test(relative) && !/\.test\.tsx?$/.test(relative),
  )

  describe(`hover gating + press pairing (${scope})`, () => {
    it('scans a plausible corpus', () => {
      expect(
        moduleFiles.length,
        `expected more than ${minModules} *.module.css under ${scope} — found ${moduleFiles.length}; lower minModules if this consumer is genuinely small`,
      ).toBeGreaterThan(minModules)
    })

    it('keeps EVERY :hover rule inside a `@media (hover: hover)` block', () => {
      const ungated = findUngatedHovers(moduleFiles)
      expect(
        ungated,
        ungated
          .map(({ path, selector }) => `ungated ":hover" in ${path} — "${selector}" must sit inside @media (hover: hover) [and (pointer: fine)] or touch devices get sticky hover`)
          .join('\n'),
      ).toEqual([])
    })

    it('pairs every tappable :hover with an :active press state on the same control', () => {
      // A control that lights up under the pointer but gives nothing back under the finger is
      // half-finished feedback (emil: press feedback is the UI "truly listening"). Hovers with NO
      // class subject (bare-element/descendant hovers like `.helpText a:hover`) are exempt.
      const unpaired = findUnpairedHovers(moduleFiles, composedModifiers)
      expect(
        unpaired,
        unpaired
          .map(({ path, selector, base }) => `${path} — "${selector}" hovers but ".${base}" never declares an :active press state`)
          .join('\n'),
      ).toEqual([])
    })

    it('the pairing scan still bites: the corpus yields a plausible number of press subjects', () => {
      expect(
        countPressSubjects(moduleFiles),
        `fewer than ${minPressSubjects} press subjects under ${scope} — the pairing scan may have gone silently exempt`,
      ).toBeGreaterThan(minPressSubjects)
    })

    describe('pressSubjects parser contract (the pairing scan is only as good as its parser)', () => {
      it('grouped selectors: EVERY comma part is classified, not just the first', () => {
        expect(pressSubjects('.a:hover, .b:hover')).toEqual(['a', 'b'])
      })

      it('bare element hovers are exempt — no class subject to press', () => {
        expect(pressSubjects('a:hover')).toEqual([])
      })

      it('descendant element hovers are exempt — the hover hangs off the element, not the class', () => {
        expect(pressSubjects('.helpText a:hover')).toEqual([])
      })

      it('keeps the established subject shapes: qualified, :not()-guarded, ancestor-hover', () => {
        expect(pressSubjects('button.rowMain:hover')).toEqual(['rowMain'])
        expect(pressSubjects('.day:not(.daySelected):hover')).toEqual(['day'])
        expect(pressSubjects('.row:hover .chevron')).toEqual(['row'])
      })

      it('mixed group: validates the class part, exempts the element part, skips the hoverless part', () => {
        expect(pressSubjects('.card:hover, .helpText a:hover, .card:focus-visible')).toEqual(['card'])
      })
    })
  })

  describe(`house press scale (${scope})`, () => {
    it('leaves NO translateY(1px) anywhere — the house press is scale (0.97 compact / 0.98 large rows / 0.94 FABs)', () => {
      const offenders = sourceFiles.filter(({ content }) => content.includes('translateY(1px)'))
      expect(
        offenders,
        offenders
          .map(({ path }) => `translateY(1px) press state in ${path} — use the house scale() press (0.97 compact / 0.98 large rows / 0.94 FABs)`)
          .join('\n'),
      ).toEqual([])
    })

    it('presses each declared FAB with scale(0.94) over a transition that names transform, and finds no stray .fab copies', () => {
      const fabFiles = moduleFiles.filter(({ content }) => /\.fab\s*\{/.test(content))
      expect(
        fabFiles.map(({ path }) => path).sort(),
        `exactly the declared fabModules may define .fab — expected [${fabModules.join(', ')}], found [${fabFiles.map(({ path }) => path).join(', ')}]`,
      ).toEqual(fabModules.slice().sort())
      for (const { path, content } of fabFiles) {
        const active = content.match(/\.fab:active\s*\{([^}]*)\}/)
        expect(active, `${path} .fab has no :active press state`).toBeTruthy()
        expect(active![1], `${path} .fab press must be the shared scale(0.94)`).toContain('transform: scale(0.94)')
        const base = content.match(/\.fab\s*\{([^}]*)\}/)
        expect(base![1]).toMatch(/transition:[^;]*transform var\(--dur-press\) var\(--ease-glass\)/)
      }
    })
  })
}
