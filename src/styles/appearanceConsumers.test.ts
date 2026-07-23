// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { describe, it, expect } from 'vitest'

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
