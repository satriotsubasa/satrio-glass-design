// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { describe, it, expect } from 'vitest'
import { BACKDROP_PRESETS_WITH_RULES } from '../lib/backdrops'

/** CSS consumers of the appearance signals the kit's own stylesheets carry: appAnimations ->
 *  data-motion (global.css + the Button spinner / Skeleton shimmer / ProgressBar wave opt-outs),
 *  scrollBehavior -> data-scroll-behavior, colorfulInterface -> data-colorful-interface, plus the
 *  theme cross-fade. Ported from the finance kit's appearanceConsumers.test.ts, trimmed to the CSS
 *  this PACKAGE owns — the app-level consumers (AppShell, DashboardHero, ExchangeRatesPage,
 *  LegacyImportSheet, WalletSwitcherWidget, BudgetProgressBar) stay in their apps. (highTextContrast
 *  is covered in tokens.test.ts; the framer-motion side of appAnimations in AppMotionConfig.test.tsx.) */
function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
}

const globalCss = read('./global.css')
const tokensCss = read('./tokens.css')
const skeletonCss = read('../components/ui/Skeleton.module.css')
const buttonCss = read('../components/ui/Button.module.css')
const progressBarCss = read('../components/ui/ProgressBar.module.css')
const backdropsCss = read('./backdrops.css')
const legibilityCss = read('./legibility.css')
/** Comment-stripped legibility.css — for whole-file substring scans where the prose in this
 *  file's own header comment (which legitimately DISCUSSES selectors like `data-theme-mode`
 *  and `.backdrop-chrome` in English) would otherwise read as a false hit. */
const legibilityCssNoComments = legibilityCss.replace(/\/\*[\s\S]*?\*\//g, '')

/** The declarations of the (single) `@media (prefers-reduced-motion: reduce)` rule in global.css:
 *  from the rule's own opening brace (the second `{` after the media prelude) to its `}`. */
function osReducedMotionRule(css: string): { selector: string; declarations: string } {
  const mediaStart = css.indexOf('@media (prefers-reduced-motion: reduce)')
  expect(mediaStart, 'global.css must have a prefers-reduced-motion: reduce media query').toBeGreaterThan(-1)
  const mediaOpen = css.indexOf('{', mediaStart)
  const ruleOpen = css.indexOf('{', mediaOpen + 1)
  return {
    selector: css.slice(mediaOpen + 1, ruleOpen),
    declarations: css.slice(ruleOpen + 1, css.indexOf('}', ruleOpen)),
  }
}

describe('global.css data-motion gating (Settings: appAnimations)', () => {
  it("collapses every animation/transition to one instant frame under 'none' (elements + pseudo-elements)", () => {
    const start = globalCss.indexOf(":root[data-motion='none']")
    expect(start).toBeGreaterThan(-1)
    const block = globalCss.slice(start, globalCss.indexOf('}', start))
    expect(block).toContain('::before')
    expect(block).toContain('::after')
    expect(block).toContain('animation-duration: 0.001ms !important')
    expect(block).toContain('animation-iteration-count: 1 !important') // stops loops re-running the instant frame
    expect(block).toContain('transition-duration: 0.001ms !important')
  })

  it("caps transitions AND one-shot animations short-but-visible under 'reduced'", () => {
    const start = globalCss.indexOf(":root[data-motion='reduced']")
    expect(start).toBeGreaterThan(-1)
    const block = globalCss.slice(start, globalCss.indexOf('}', start))
    expect(block).toContain('::before')
    expect(block).toContain('::after')
    expect(block).toContain('transition-duration: 60ms !important')
    // One-shot keyframe animations (Modal pop, disclosure reveal) get the same near-instant cap —
    // loops that must not strobe either opt out at their source (Skeleton, wavy) or re-assert their
    // authored duration (Button spinner, below).
    expect(block).toContain('animation-duration: 60ms !important')
  })

  it("re-asserts the FUNCTIONAL Button spinner's authored duration under 'reduced' (a 60ms loop would strobe)", () => {
    const start = buttonCss.indexOf(":global(:root[data-motion='reduced']) .spinner")
    expect(start).toBeGreaterThan(-1)
    const block = buttonCss.slice(start, buttonCss.indexOf('}', start))
    expect(block).toContain('animation-duration: 0.6s !important') // the authored spin speed
  })

  it("has no rule for 'all' — the OS prefers-reduced-motion media query stays the only default gate", () => {
    expect(globalCss).not.toContain(":root[data-motion='all']")
    expect(globalCss).toContain('prefers-reduced-motion: reduce')
  })

  it('kills the decorative Skeleton shimmer loop at its source for reduced AND none', () => {
    expect(skeletonCss).toContain(":global(:root[data-motion='reduced']) .skeleton")
    expect(skeletonCss).toContain(":global(:root[data-motion='none']) .skeleton")
  })
})

describe('global.css OS prefers-reduced-motion tier (Apple §14: reduced means gentler, not none)', () => {
  it("routes the OS signal to the SAME 60ms gentle tier as data-motion='reduced' — string-equal durations, so neither block can drift alone", () => {
    const { declarations } = osReducedMotionRule(globalCss)
    const reducedStart = globalCss.indexOf(":root[data-motion='reduced']")
    const reducedBlock = globalCss.slice(reducedStart, globalCss.indexOf('}', reducedStart))

    const durations = (block: string) => block.match(/(?:animation|transition)-duration:[^;]+/g)
    expect(durations(declarations)).toEqual(durations(reducedBlock))
    expect(durations(declarations)).toEqual([
      'animation-duration: 60ms !important',
      'transition-duration: 60ms !important',
    ])
  })

  it('covers pseudo-elements too (::before/::after), like both data-motion tiers', () => {
    const { selector } = osReducedMotionRule(globalCss)
    expect(selector).toContain('*::before')
    expect(selector).toContain('*::after')
  })

  it("keeps the 0.001ms instant tier reachable ONLY from the explicit 'none' setting — which still caps loops to one iteration", () => {
    const { declarations } = osReducedMotionRule(globalCss)
    expect(declarations).not.toContain('0.001ms')

    const noneStart = globalCss.indexOf(":root[data-motion='none']")
    const noneBlock = globalCss.slice(noneStart, globalCss.indexOf('}', noneStart))
    expect(noneBlock).toContain('animation-duration: 0.001ms !important')
    expect(noneBlock).toContain('animation-iteration-count: 1 !important')
  })
})

describe('global.css theme cross-fade (.theme-transition, stamped transiently by applyTheme)', () => {
  it('transitions the root/body/backdrop colour layers under the transient class', () => {
    const start = globalCss.indexOf(':root.theme-transition')
    expect(start, 'global.css must have the .theme-transition rule applyTheme stamps').toBeGreaterThan(-1)
    const ruleOpen = globalCss.indexOf('{', start)
    const selector = globalCss.slice(start, ruleOpen)
    // All three paint layers of the app chrome: the token host, the canvas colour, and the
    // viewport-fixed backdrop pseudo-element.
    expect(selector).toContain(':root.theme-transition body')
    expect(selector).toContain(':root.theme-transition body::before')
    const block = globalCss.slice(ruleOpen, globalCss.indexOf('}', ruleOpen))
    expect(block).toContain('background-color 260ms')
    expect(block).toContain('color 260ms')
  })

  it('is NOT gated behind prefers-reduced-motion — Apple §14 keeps colour changes: easing the dark↔light brightness jump IS the accommodation (the reduce tiers merely cap it to 60ms)', () => {
    // No no-preference wrap anywhere in global.css…
    expect(globalCss).not.toContain('prefers-reduced-motion: no-preference')
    // …and the rule sits at the TOP LEVEL of the stylesheet, before (so provably outside) the
    // reduce media query.
    const mediaStart = globalCss.indexOf('@media (prefers-reduced-motion: reduce)')
    const ruleStart = globalCss.indexOf(':root.theme-transition')
    expect(ruleStart).toBeGreaterThan(-1)
    expect(ruleStart).toBeLessThan(mediaStart)
  })
})

describe('global.css data-scroll-behavior mapping (Settings: scrollBehavior)', () => {
  it("maps 'simple' to instant programmatic scrolls + no overscroll", () => {
    const start = globalCss.indexOf(":root[data-scroll-behavior='simple']")
    expect(start).toBeGreaterThan(-1)
    const block = globalCss.slice(start, globalCss.indexOf('}', start))
    expect(block).toContain('scroll-behavior: auto')
    expect(block).toContain('overscroll-behavior-y: none')
  })

  it("maps 'stretch' to a contained local edge effect", () => {
    const start = globalCss.indexOf(":root[data-scroll-behavior='stretch']")
    expect(start).toBeGreaterThan(-1)
    expect(globalCss.slice(start, globalCss.indexOf('}', start))).toContain('overscroll-behavior-y: contain')
  })

  it("maps 'bounce' to the platform's native edge effect", () => {
    const start = globalCss.indexOf(":root[data-scroll-behavior='bounce']")
    expect(start).toBeGreaterThan(-1)
    expect(globalCss.slice(start, globalCss.indexOf('}', start))).toContain('overscroll-behavior-y: auto')
  })

  it("keeps 'default' rule-free and applies each mapping to both root and body (viewport propagation)", () => {
    expect(globalCss).not.toContain(":root[data-scroll-behavior='default']")
    for (const mode of ['simple', 'stretch', 'bounce']) {
      expect(globalCss, `body coverage for ${mode}`).toContain(`:root[data-scroll-behavior='${mode}'] body`)
    }
  })
})

describe('floating-control lanes data-left-handed-mode (Settings: leftHandedMode)', () => {
  // The FAB lives in ONE kit module (components/ui/Fab.module.css) — but this stays a SCAN of src/
  // for `.fab {` rather than a direct read of that file, because the scan is the guard against the
  // pre-extraction failure mode: a page shipping its own `.fab` copy without the mirror rule (2 FABs
  // shipped, 1 rule: the Accounts FAB stayed pinned bottom-right for left-handed users). Exactly one
  // module may define `.fab`; a stray copy fails here by construction. (FIN's third assertion —
  // the removed floating mobile ThemeToggle, read from AppShell CSS — is NOT ported: that layout CSS
  // ships in the apps, not this package.)
  const srcRoot = fileURLToPath(new URL('../', import.meta.url))
  const fabModules: [relativePath: string, css: string][] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.module.css')) {
        const css = readFileSync(full, 'utf8')
        if (/\.fab\s*\{/.test(css)) fabModules.push([relative(srcRoot, full).replace(/\\/g, '/'), css])
      }
    }
  }
  walk(srcRoot)

  it('the scan finds EXACTLY the single kit Fab module — no page-local .fab copies', () => {
    expect(fabModules.map(([relativePath]) => relativePath)).toEqual(['components/ui/Fab.module.css'])
  })

  it.each(fabModules)('moves the %s FAB to the LEFT lane with the exact mirrored offset, on MOBILE only', (_name, css) => {
    const start = css.indexOf(":global(:root[data-left-handed-mode='on']) .fab")
    expect(start).toBeGreaterThan(-1)
    const block = css.slice(start, css.indexOf('}', start))
    expect(block).toContain('right: auto')
    expect(block).toContain('left: 20px') // mirrors the base rule's `right: 20px` lane
    // Desktop (≥1024px) must keep the FAB bottom-RIGHT: the fixed Sidebar owns the left edge and a
    // mirrored FAB (higher z-index) would float on top of it.
    const mediaStart = css.indexOf('@media (max-width: 1023.98px)')
    expect(mediaStart).toBeGreaterThan(-1)
    expect(start).toBeGreaterThan(mediaStart) // the swap lives inside the mobile media query
    // Base lane stays bottom-RIGHT outside left-handed mode.
    expect(css).toMatch(/\.fab\s*\{[^}]*right:\s*20px/)
  })
})

describe('tokens.css data-colorful-interface backdrop gate (Settings: colorfulInterface / "Material You")', () => {
  it("strips the accent tint from the backdrop when 'off' — a plain --bg gradient with no accent mix", () => {
    const start = tokensCss.indexOf(":root[data-colorful-interface='off']")
    expect(start).toBeGreaterThan(-1)
    const block = tokensCss.slice(start, tokensCss.indexOf('}', start))
    expect(block).toContain('--backdrop:')
    expect(block).toContain('var(--bg)')
    expect(block).not.toContain('--accent') // the whole point: no accent in the neutral backdrop
  })

  it("keeps 'on' rule-free — the stock :root --backdrop stays the single tinted source of truth", () => {
    expect(tokensCss).not.toContain("data-colorful-interface='on'")
    // And the default really is accent-tinted (the thing the gate removes).
    const rootBlock = tokensCss.slice(tokensCss.indexOf(':root {'), tokensCss.indexOf(':root[data-theme="dark"]'))
    expect(rootBlock).toMatch(/--backdrop:[\s\S]*?color-mix\(in srgb, var\(--accent\)/)
  })
})

describe('backdrops.css data-backdrop presets (Settings: the Appearance backdrop picker)', () => {
  /** Declarations of the first rule whose prelude starts with `selector`. */
  function scopeBlock(selector: string): string {
    const start = backdropsCss.indexOf(selector)
    expect(start, `rule "${selector}" must exist in backdrops.css`).toBeGreaterThan(-1)
    const open = backdropsCss.indexOf('{', start)
    return backdropsCss.slice(open + 1, backdropsCss.indexOf('}', open))
  }

  it('defines --backdrop for every preset that claims a rule', () => {
    for (const preset of BACKDROP_PRESETS_WITH_RULES) {
      expect(scopeBlock(`:root[data-backdrop='${preset}']`)).toContain('--backdrop:')
    }
  })

  it("has NO rule for 'minimal' — attribute absence IS the stock package backdrop", () => {
    expect(backdropsCss).not.toContain("data-backdrop='minimal'")
  })

  it('scopes each preset per theme exactly as its tuning requires — mesh/aurora light+dark+black, wallpaper light only', () => {
    /** wallpaper is theme-agnostic BY DESIGN: --backdrop-image is a single token a brand
     *  redeclares per theme in its own brand.css, so the preset itself needs only one rule. A
     *  dark or black wallpaper SCOPE would be dead weight that could silently drift out of sync
     *  with that redeclaration. */
    const PRESET_THEME_SCOPES: Record<string, readonly ('light' | 'dark' | 'black')[]> = {
      mesh: ['light', 'dark', 'black'],
      aurora: ['light', 'dark', 'black'],
      wallpaper: ['light'],
    }
    expect(Object.keys(PRESET_THEME_SCOPES).sort()).toEqual([...BACKDROP_PRESETS_WITH_RULES].sort())

    for (const [preset, scopes] of Object.entries(PRESET_THEME_SCOPES)) {
      expect(scopes, `${preset} must at least cover light`).toContain('light')
      const selectors = {
        light: `:root[data-backdrop='${preset}']`,
        dark: `:root[data-theme='dark'][data-backdrop='${preset}']`,
        black: `:root[data-theme-mode='black'][data-backdrop='${preset}']`,
      } as const
      for (const theme of ['light', 'dark', 'black'] as const) {
        const present = backdropsCss.includes(selectors[theme])
        const shouldBePresent = scopes.includes(theme)
        expect(
          present,
          `${preset}'s ${theme} scope must be ${shouldBePresent ? 'present (listed in the table)' : 'ABSENT (not listed — a stray rule could silently drift)'}`,
        ).toBe(shouldBePresent)
      }
    }
  })

  it('composes mesh and aurora from palette TOKENS only, so they re-skin per brand — no hardcoded colour anywhere', () => {
    for (const preset of ['mesh', 'aurora'] as const) {
      for (const theme of ['light', 'dark', 'black'] as const) {
        const selector =
          theme === 'light' ? `:root[data-backdrop='${preset}']`
          : theme === 'dark' ? `:root[data-theme='dark'][data-backdrop='${preset}']`
          : `:root[data-theme-mode='black'][data-backdrop='${preset}']`
        const block = scopeBlock(selector)
        expect(block, `${preset} ${theme} must color-mix`).toContain('color-mix(in srgb')
        for (const token of ['var(--accent)', 'var(--accent-fill)', 'var(--income)', 'var(--expense)', 'var(--bg)']) {
          // aurora's black scope deliberately DROPS the --expense radial entirely (see the
          // comment in backdrops.css) rather than tuning it to near-zero — skip that one
          // combination instead of weakening the assertion for every other scope.
          if (preset === 'aurora' && theme === 'black' && token === 'var(--expense)') continue
          expect(block, `${preset} ${theme} must mix ${token}`).toContain(token)
        }
        expect(block, `${preset} ${theme} must not hardcode a hex colour`).not.toMatch(/#[0-9a-f]{3,8}\b/i)
        expect(block, `${preset} ${theme} must not hardcode an rgb()/rgba()`).not.toMatch(/\brgba?\(/)
        expect(block, `${preset} ${theme} must not reference an image`).not.toContain('url(')
      }
    }
  })

  it('routes the wallpaper preset through the app-supplied --backdrop-image token, never a package asset path', () => {
    const block = scopeBlock(":root[data-backdrop='wallpaper']")
    expect(block).toContain('var(--backdrop-image)')
    // The package ships no images — a hardcoded path would 404 in every consumer.
    expect(backdropsCss).not.toContain('url(')
  })

  it("the colorfulInterface OFF calm gate beats every preset — flat --bg wash, positioned AFTER all valued preset scopes (0-3-0 tie broken by source order)", () => {
    const calmStart = backdropsCss.indexOf(":root[data-colorful-interface='off'][data-backdrop]")
    expect(calmStart, 'calm-gate rule must exist').toBeGreaterThan(-1)
    const block = scopeBlock(":root[data-colorful-interface='off'][data-backdrop]")
    expect(block).toContain('--backdrop:')
    expect(block).toContain('var(--bg)')
    expect(block).not.toContain('--accent')
    expect(block).not.toContain('url(')
    expect(calmStart, 'calm gate must sit after every valued data-backdrop scope').toBeGreaterThan(
      backdropsCss.lastIndexOf("[data-backdrop='"),
    )
  })

  it('flattens every preset under OS Reduce Transparency — theme-scoped, plain --bg, and is the LAST thing in the file', () => {
    const mediaStart = backdropsCss.indexOf('@media (prefers-reduced-transparency: reduce)')
    expect(mediaStart).toBeGreaterThan(-1)
    const mediaOpen = backdropsCss.indexOf('{', mediaStart)
    const ruleOpen = backdropsCss.indexOf('{', mediaOpen + 1)
    const selector = backdropsCss.slice(mediaOpen + 1, ruleOpen)
    expect(selector).toContain(':root[data-backdrop]')
    expect(selector).toContain(":root[data-theme='dark'][data-backdrop]")
    expect(selector).toContain(":root[data-theme-mode='black'][data-backdrop]")
    const block = backdropsCss.slice(ruleOpen + 1, backdropsCss.indexOf('}', ruleOpen))
    expect(block).toContain('--backdrop:')
    expect(block).toContain('var(--bg)')
    expect(block).not.toContain('url(')
    expect(block).not.toContain('color-mix')
    expect(
      backdropsCss.indexOf('{', backdropsCss.indexOf('}', ruleOpen)),
      'no rule may follow the reduced-transparency block',
    ).toBe(-1)
  })

  it('never touches --backdrop under OS Increase Contrast — the image keeps painting; the legibility layer answers contrast by going opaque on fills instead', () => {
    expect(backdropsCss).not.toContain('prefers-contrast: more')
  })

  it("declares nothing but --backdrop, and its first non-comment content is the @import of legibility.css", () => {
    const stripped = backdropsCss.replace(/\/\*[\s\S]*?\*\//g, '').trimStart()
    expect(stripped.startsWith("@import './legibility.css';")).toBe(true)
    const withoutImport = stripped.replace(/@import\s+'\.\/legibility\.css';/, '')
    const declared = new Set([...withoutImport.matchAll(/(?:^|[;{])\s*(--?[a-z-]+)\s*:/g)].map((match) => match[1]))
    expect([...declared]).toEqual(['--backdrop'])
  })
})

describe('legibility layer (the inseparable half of the backdrop contract — styles/legibility.css)', () => {
  /** Declarations of the first rule whose prelude contains `selector`, searching from `from`. */
  function block(css: string, selector: string, from = 0): string {
    const start = css.indexOf(selector, from)
    expect(start, `rule "${selector}" must exist`).toBeGreaterThan(-1)
    const open = css.indexOf('{', start)
    return css.slice(open + 1, css.indexOf('}', open))
  }

  /** Split a selector list on TOP-LEVEL commas only (commas inside :is()/:not() stay put). */
  function splitTopLevel(selector: string): string[] {
    const parts: string[] = []
    let depth = 0
    let current = ''
    for (const ch of selector) {
      if (ch === '(') depth++
      if (ch === ')') depth--
      if (ch === ',' && depth === 0) {
        parts.push(current)
        current = ''
      } else current += ch
    }
    parts.push(current)
    return parts.map((part) => part.trim()).filter(Boolean)
  }

  it('MINIMAL-UNTOUCHED GUARD: every selector in legibility.css is gated on the VALUE-LESS [data-backdrop] — no rule can match when the attribute is absent', () => {
    const stripped = legibilityCss.replace(/\/\*[\s\S]*?\*\//g, '')
    const preludes = [...stripped.matchAll(/([^{};]+)\{/g)]
      .map((match) => match[1].replace(/^[\s}]+/, '').trim())
      .filter((prelude) => !prelude.startsWith('@media'))
    expect(preludes.length).toBeGreaterThan(5) // the scan must not go vacuous
    for (const prelude of preludes) {
      for (const part of splitTopLevel(prelude)) {
        expect(part, `unscoped selector "${part}" in legibility.css — minimal mode must stay byte-identical`).toContain(
          '[data-backdrop]',
        )
      }
    }
    expect(legibilityCss).not.toContain("data-backdrop='minimal'")
  })

  it('MINIMAL-UNTOUCHED GUARD: every prelude in backdrops.css matches a valued or value-less [data-backdrop]', () => {
    const stripped = backdropsCss.replace(/\/\*[\s\S]*?\*\//g, '')
    const preludes = [...stripped.matchAll(/([^{};]+)\{/g)]
      .map((match) => match[1].replace(/^[\s}]+/, '').trim())
      .filter((prelude) => !prelude.startsWith('@media'))
    expect(preludes.length).toBeGreaterThan(5)
    for (const prelude of preludes) {
      for (const part of splitTopLevel(prelude)) {
        expect(part, `unscoped selector "${part}" in backdrops.css`).toMatch(/\[data-backdrop(?:=|\])/)
      }
    }
  })

  describe('the one-unit guarantee: a preset cannot ship without its legibility layer', () => {
    it('package.json exports the presets but never the legibility layer on its own', () => {
      const packageJson = JSON.parse(
        readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
      ) as { exports: Record<string, string> }
      expect(Object.keys(packageJson.exports)).toContain('./styles/backdrops.css')
      expect(Object.keys(packageJson.exports)).not.toContain('./styles/legibility.css')
    })

    it('is one of an explicit ALLOW-LIST of shipped stylesheets that may reference [data-backdrop] — not "count the files"', () => {
      const srcRoot = fileURLToPath(new URL('../', import.meta.url))
      const matches: string[] = []
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, entry.name)
          if (entry.isDirectory()) {
            if (entry.name === 'docs') continue // the docs app is not shipped (package.json "files")
            walk(full)
          } else if (entry.name.endsWith('.css') && /\[data-backdrop/.test(readFileSync(full, 'utf8'))) {
            matches.push(relative(srcRoot, full).replace(/\\/g, '/'))
          }
        }
      }
      walk(srcRoot)
      // An ALLOW-LIST, not "exactly these two files forever": a later change legitimately adds
      // :global(:root[data-backdrop]) rules to component modules, which extends this list by a
      // deliberate edit rather than an unnoticed drift.
      expect(matches.sort()).toEqual(['styles/backdrops.css', 'styles/legibility.css'])
    })

    it('keeps the two files PROPERTY-DISJOINT — backdrops.css declares only --backdrop; legibility.css never declares it — which is what makes the @import order provably irrelevant', () => {
      const stripped = backdropsCss.replace(/\/\*[\s\S]*?\*\//g, '')
      const withoutImport = stripped.replace(/@import\s+'\.\/legibility\.css';/, '')
      const declared = new Set([...withoutImport.matchAll(/(?:^|[;{])\s*(--?[a-z-]+)\s*:/g)].map((match) => match[1]))
      expect([...declared]).toEqual(['--backdrop'])
      expect(legibilityCss).not.toContain('--backdrop:')
    })
  })

  it('protects on-backdrop text with theme-paired shadow directions — light glow / dark shadow, no black twin (black inherits dark)', () => {
    const light = block(legibilityCss, ':root[data-backdrop] :is(main, .backdrop-scope) {')
    expect(light).toContain('rgba(255, 250, 246')
    const dark = block(legibilityCss, ":root[data-theme='dark'][data-backdrop] :is(main, .backdrop-scope)")
    expect(dark).toContain('rgba(0, 0, 0')
    expect(legibilityCssNoComments).not.toContain("data-theme-mode='black'")
  })

  it('bounds both text-shadow rules to :is(main, .backdrop-scope) — sheets/modals/toasts portal outside and must never inherit the glow', () => {
    const lightPrelude = legibilityCss.slice(0, legibilityCss.indexOf('{'))
    expect(lightPrelude).toContain(':is(main, .backdrop-scope)')
    const darkStart = legibilityCss.indexOf(":root[data-theme='dark'][data-backdrop]")
    expect(darkStart).toBeGreaterThan(-1)
    const darkPrelude = legibilityCss.slice(darkStart, legibilityCss.indexOf('{', darkStart))
    expect(darkPrelude).toContain(':is(main, .backdrop-scope)')
  })

  it('writes the material reset AFTER both text-shadow rules — their shared (0,4,0) specificity makes this a SOURCE-ORDER bound, not a specificity one', () => {
    const lightIdx = legibilityCss.indexOf(':root[data-backdrop] :is(main, .backdrop-scope) {')
    const darkIdx = legibilityCss.indexOf(":root[data-theme='dark'][data-backdrop] :is(main, .backdrop-scope)")
    const resetIdx = legibilityCss.indexOf(':is(.glass, .glass-strong, .panel-material, .dash-card)')
    expect(lightIdx).toBeGreaterThan(-1)
    expect(darkIdx).toBeGreaterThan(lightIdx)
    expect(resetIdx, 'the material reset must come after both text-shadow rules').toBeGreaterThan(darkIdx)
  })

  it("bounds the reset and the h+p exclusion list to EXACTLY the material classes global.css defines — derived, not hardcoded, with a floor so the derivation cannot go vacuous", () => {
    const reduceStart = globalCss.indexOf('@media (prefers-reduced-transparency: reduce)')
    // Comment-stripped: global.css's OWN prose (e.g. "tokens.css, not a replacement") would
    // otherwise read as a stray ".css" class to the naive class-name scan below.
    const reduceBlock = globalCss
      .slice(reduceStart, globalCss.indexOf('@media', reduceStart + 1))
      .replace(/\/\*[\s\S]*?\*\//g, '')
    const materials = [...new Set(reduceBlock.match(/\.[a-z][a-z0-9-]*(?=\s*[,{])/g) ?? [])]
    expect(materials.length, 'the derivation went vacuous').toBeGreaterThanOrEqual(4)

    const materialList = materials.join(', ')
    const notList = materials.map((name) => `${name} *`).join(', ')
    expect(legibilityCss, 'the material reset must cover exactly the derived material classes').toContain(
      `:is(${materialList})`,
    )
    expect(
      legibilityCss,
      "the h+p promotion's exclusion list must cover exactly the derived material classes",
    ).toContain(`:not(${notList})`)
  })

  it("promotes the two on-backdrop text ramps the kit's own components produce (SectionHeader's h2+p, SettingsGroup's SectionLabel <p> before its .dash-card)", () => {
    expect(block(legibilityCss, ':is(h1, h2, h3) + p')).toContain('color-mix(in srgb, var(--label) 45%, var(--label-2))')
    expect(block(legibilityCss, 'p:has(+ .dash-card)')).toContain('color: var(--label-2)')
  })

  it("the .backdrop-chrome utility stands down for pressed toggles on EVERY rule, not just the base one", () => {
    const preludes = [...legibilityCssNoComments.matchAll(/[^{}]*\.backdrop-chrome[^{}]*(?=\{)/g)].map((match) => match[0])
    expect(preludes.length).toBeGreaterThanOrEqual(4) // base, hover, calm-gate, reduce, contrast
    for (const prelude of preludes) {
      expect(prelude, `"${prelude.trim()}" must stand down for a pressed toggle`).toContain(":not([aria-pressed='true'])")
    }
    const base = block(legibilityCss, ".backdrop-chrome:not([aria-pressed='true']) {")
    expect(base).toContain('background: var(--nav-bg)')
    expect(base).toContain('border: 0.5px solid var(--glass-border)')
    expect(base).toContain('backdrop-filter: blur(var(--blur-chrome)) saturate(150%)')
    expect(base).toContain('-webkit-backdrop-filter: blur(var(--blur-chrome)) saturate(150%)')
  })

  it("stands the WHOLE legibility layer down when data-colorful-interface='off' — one attribute more specific than every rule above, so it wins outright with no ordering dependency on the preset", () => {
    const calmPrefix = ":root[data-colorful-interface='off'][data-backdrop]"
    expect(block(legibilityCss, `${calmPrefix} :is(main, .backdrop-scope) {`)).toContain('text-shadow: none')
    expect(block(legibilityCss, `${calmPrefix} :is(main, .backdrop-scope) :is(h1, h2, h3) + p`)).toContain(
      'color: var(--label-2)',
    )
    expect(block(legibilityCss, `${calmPrefix} :is(main, .backdrop-scope) p:has(+ .dash-card)`)).toContain(
      'color: var(--label-3)',
    )
    const calmChrome = block(legibilityCss, `${calmPrefix} .backdrop-chrome:not([aria-pressed='true'])`)
    expect(calmChrome).toContain('background: var(--surface)')
    expect(calmChrome).toContain('backdrop-filter: none')
    // The calm gate's text-shadow rule ties the dark-scope text rule at (0,4,0) — it must come
    // after it in source order to win in the dark theme too.
    const darkTextIdx = legibilityCss.indexOf(":root[data-theme='dark'][data-backdrop] :is(main, .backdrop-scope)")
    expect(legibilityCss.indexOf(calmPrefix)).toBeGreaterThan(darkTextIdx)
  })

  it('stands the whole layer down under OS Reduce Transparency — theme-scoped shadows off, ramps back to stock, chrome opaque with NO border-color override', () => {
    const reduceStart = legibilityCss.indexOf('@media (prefers-reduced-transparency: reduce)')
    const contrastStart = legibilityCss.indexOf('@media (prefers-contrast: more)')
    expect(reduceStart).toBeGreaterThan(-1)
    expect(contrastStart, 'reduce must precede contrast, matching tokens.css/global.css ordering').toBeGreaterThan(
      reduceStart,
    )
    const reduceBlock = legibilityCss.slice(reduceStart, contrastStart)
    expect(block(reduceBlock, ':is(main, .backdrop-scope)')).toContain('text-shadow: none')
    expect(reduceBlock).toContain(":root[data-theme='dark'][data-backdrop] :is(main, .backdrop-scope)")
    expect(block(reduceBlock, ':is(h1, h2, h3) + p')).toContain('color: var(--label-2)')
    expect(block(reduceBlock, 'p:has(+ .dash-card)')).toContain('color: var(--label-3)')
    const chrome = block(reduceBlock, ".backdrop-chrome:not([aria-pressed='true'])")
    expect(chrome).toContain('background: var(--surface)')
    expect(chrome).toContain('backdrop-filter: none')
    // The DROP (not just the reorder) is the actual fix for the hairline: no border-color
    // override here, so the base translucent border resolves and can still promote to
    // --label-3 if Increase Contrast is ALSO on.
    expect(chrome).not.toContain('border-color')
  })

  it('keeps the ambient shadows under OS Increase Contrast (the image still paints) and neutralises only .backdrop-chrome, whose fill just went opaque', () => {
    const contrastStart = legibilityCss.indexOf('@media (prefers-contrast: more)')
    expect(contrastStart).toBeGreaterThan(-1)
    const contrastBlock = legibilityCss.slice(contrastStart)
    const chrome = block(contrastBlock, ".backdrop-chrome:not([aria-pressed='true'])")
    expect(chrome).toContain('background: var(--surface)')
    expect(chrome).toContain('backdrop-filter: none')
    // A halo on glyph edges over a now-opaque fill is a contrast REGRESSION, not a gain.
    expect(chrome).toContain('text-shadow: none')
    // The region-wide shadow rules are untouched here — contrast keeps them; only the
    // now-opaque chrome control gets the explicit reset.
    expect(contrastBlock).not.toContain(':is(main, .backdrop-scope) {')
  })

  it("keeps prefers-contrast: more as legibility.css's TERMINAL block — nothing may follow it", () => {
    const contrastStart = legibilityCss.indexOf('@media (prefers-contrast: more)')
    expect(contrastStart).toBeGreaterThan(-1)
    const mediaOpen = legibilityCss.indexOf('{', contrastStart)
    const ruleOpen = legibilityCss.indexOf('{', mediaOpen + 1)
    const ruleClose = legibilityCss.indexOf('}', ruleOpen)
    const mediaClose = legibilityCss.indexOf('}', ruleClose + 1)
    expect(legibilityCss.indexOf('{', mediaClose), 'no rule may follow the prefers-contrast: more block').toBe(-1)
  })

  it('keeps .dash-card overflow-free — a sticky child inside a card must survive', () => {
    const ruleStart = globalCss.indexOf('.dash-card {')
    expect(ruleStart).toBeGreaterThan(-1)
    const ruleBlock = globalCss.slice(ruleStart, globalCss.indexOf('}', ruleStart))
    expect(ruleBlock).not.toContain('overflow')
  })
})

describe("progress-bar 'wavy' drift motion gating (Settings: progressBarStyle × appAnimations)", () => {
  it('masks the fill with the repeating SVG wave', () => {
    expect(progressBarCss).toContain('.wavy')
    expect(progressBarCss).toMatch(/mask-image:.*var\(--progress-wave\)/)
    expect(progressBarCss).toContain('url("data:image/svg+xml')
  })

  it('kills the decorative wave drift at its source under data-motion reduced AND none, plus the OS preference', () => {
    // Same contract as the Skeleton shimmer: global.css's 'none' rule would collapse it anyway, but
    // the OS media rule caps duration WITHOUT an iteration cap — a looping 0.001ms animation would
    // re-queue forever, so the module must opt out explicitly.
    expect(progressBarCss).toContain(":global(:root[data-motion='reduced']) .wavy")
    expect(progressBarCss).toContain(":global(:root[data-motion='none']) .wavy")
    expect(progressBarCss).toContain('prefers-reduced-motion: reduce')
  })
})
