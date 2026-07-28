// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  A11Y_MEDIA,
  BRAND_TOKENS,
  findDisallowedTokens,
  findMissingCollapseTails,
  findUnthemedBackdropImage,
  parseDeclaredTokens,
  runBrandPolicy,
} from './brandPolicy'

const tokensCss = readFileSync(fileURLToPath(new URL('../styles/tokens.css', import.meta.url)), 'utf8')

// ---- fixtures (string CSS the parser + checks run against) ----

/** 1. overrides only brand-approved tokens, no collapse-managed ones → clean. */
const brandApprovedOnly = `
:root {
  --bg: #f2f2f7;
  --accent: #cf5410;
}
`

/** 2. overrides a locked type-ramp token → allowlist check must flag it. */
const brandTypeRamp = `
:root {
  --fs-body: 20px;
}
`

/** 3. overrides a collapse-managed blur alias in :root with NO a11y tail. */
const brandBlurNoTail = `
:root {
  --panel-blur: 30px;
}
`

/** 4. same override, WITH both a11y tails re-asserting the collapse → clean. */
const brandBlurWithTails = `
:root {
  --panel-blur: 30px;
}
@media (prefers-reduced-transparency: reduce) {
  :root { --panel-blur: 0px; }
}
@media (prefers-contrast: more) {
  :root { --panel-blur: 0px; }
}
`

/** 5. overrides a surface fill pinned under BOTH a11y blocks, no tail. */
const brandGlassBgNoTail = `
:root {
  --glass-bg: rgba(255, 255, 255, 0.5);
}
`

/** parser-focused: themed base scopes, a commented-out declaration, an a11y tail. */
const brandThemedWithComment = `
:root {
  --bg: #ffffff;
  /* --danger: #ff0000;  commented-out — must NOT be parsed as declared */
}
:root[data-theme='dark'] {
  --bg: #000000;
}
@media (prefers-contrast: more) {
  :root, :root[data-theme='dark'] {
    --glass-bg: var(--surface);
  }
}
`

/** parser-focused: a black-theme-scoped override. */
const brandBlackScope = `
:root[data-theme-mode='black'] {
  --surface-2: #050505;
}
`

/** 6a. dark-scoped --glass-bg override whose contrast tail is only :root — the
 * (0,1,0) tail loses to the (0,2,0) override, so Increase Contrast stays broken. */
const brandDarkGlassRootTail = `
:root[data-theme='dark'] {
  --glass-bg: rgba(20, 20, 20, 0.4);
}
@media (prefers-contrast: more) {
  :root { --glass-bg: var(--surface); }
}
`

/** 6b. same dark override, tails under BOTH media carry the matching theme-scoped selector -> safe. */
const brandDarkGlassDarkTail = `
:root[data-theme='dark'] {
  --glass-bg: rgba(20, 20, 20, 0.4);
}
@media (prefers-reduced-transparency: reduce) {
  :root[data-theme='dark'] { --glass-bg: var(--surface); }
}
@media (prefers-contrast: more) {
  :root[data-theme='dark'] { --glass-bg: var(--surface); }
}
`

/** 7. wallpaper set at base :root only — no dark scope. The unthemed guard must flag this. */
const brandWallpaperLightOnly = `
:root {
  --backdrop-image: url('/wallpapers/light.jpg');
}
`

/** 8. wallpaper set at :root AND the dark scope — themed, guard must pass. */
const brandWallpaperThemed = `
:root {
  --backdrop-image: url('/wallpapers/light.jpg');
}
:root[data-theme='dark'] {
  --backdrop-image: url('/wallpapers/dark.jpg');
}
`

/** 9. wallpaper set at :root and a BLACK scope only — black is a strict subset of dark, so this
 * must NOT satisfy the guard: an ordinary (non-black) dark-theme user still gets the light photo. */
const brandWallpaperBlackOnly = `
:root {
  --backdrop-image: url('/wallpapers/light.jpg');
}
:root[data-theme-mode='black'] {
  --backdrop-image: url('/wallpapers/dark.jpg');
}
`

describe('BRAND_TOKENS allowlist', () => {
  it('locks the structural token families out (type ramp, spacing, blur tiers, easings)', () => {
    for (const locked of [
      '--fs-body', '--lh-body', '--tracking-body', '--space-1', '--space-2',
      '--blur-chip', '--blur-card', '--blur-chrome', '--blur-sheet',
      '--ease-glass', '--dur-enter', '--app-font-scale',
    ]) {
      expect(BRAND_TOKENS.has(locked), `${locked} must stay locked out of BRAND_TOKENS`).toBe(false)
    }
  })

  it('admits the brandable colour, geometry, and material-alias tokens', () => {
    for (const brandable of [
      '--bg', '--surface', '--label', '--accent', '--danger',
      '--glass-bg', '--card-bg', '--nav-bg', '--backdrop', '--backdrop-image',
      '--radius-card', '--glass-blur', '--panel-blur', '--card-blur',
    ]) {
      expect(BRAND_TOKENS.has(brandable), `${brandable} must be brand-overridable`).toBe(true)
    }
  })
})

describe('parseDeclaredTokens', () => {
  it('records base :root declarations under "base|root"', () => {
    const declared = parseDeclaredTokens(brandApprovedOnly)
    expect(declared.get('--bg')).toEqual(['base|root'])
    expect(declared.get('--accent')).toEqual(['base|root'])
    expect(declared.size).toBe(2)
  })

  it('distinguishes a theme-scoped base declaration from a plain :root one', () => {
    const declared = parseDeclaredTokens(brandThemedWithComment)
    // --bg is set in :root (base|root) and in :root[data-theme='dark'] (base|dark)
    expect(declared.get('--bg')).toEqual(['base|root', 'base|dark'])
  })

  it('maps a data-theme-mode black selector to the black scope', () => {
    const declared = parseDeclaredTokens(brandBlackScope)
    expect(declared.get('--surface-2')).toEqual(['base|black'])
  })

  it('ignores declarations inside /* */ comments', () => {
    const declared = parseDeclaredTokens(brandThemedWithComment)
    expect(declared.has('--danger')).toBe(false)
  })

  it('records each selector in an a11y @media selector list under its own scope', () => {
    const declared = parseDeclaredTokens(brandThemedWithComment)
    expect(declared.get('--glass-bg')).toEqual([
      'prefers-contrast: more|root',
      'prefers-contrast: more|dark',
    ])
  })

  it('records a token declared in base AND both a11y tails under all three media', () => {
    const declared = parseDeclaredTokens(brandBlurWithTails)
    expect(declared.get('--panel-blur')).toEqual([
      'base|root',
      'prefers-reduced-transparency: reduce|root',
      'prefers-contrast: more|root',
    ])
  })

  it('does not confuse var(--x) usages for declarations', () => {
    const declared = parseDeclaredTokens(brandThemedWithComment)
    // --surface appears only inside var(--surface) — a usage, never a declaration here
    expect(declared.has('--surface')).toBe(false)
  })
})

describe('findDisallowedTokens (allowlist check)', () => {
  it('passes a file that overrides only brand-approved tokens', () => {
    expect(findDisallowedTokens(brandApprovedOnly)).toEqual([])
  })

  it('reports exactly the locked token a file tries to override', () => {
    expect(findDisallowedTokens(brandTypeRamp)).toEqual(['--fs-body'])
  })

  it('does not flag a brand-approved collapse-managed token', () => {
    expect(findDisallowedTokens(brandBlurNoTail)).toEqual([])
  })
})

describe('findMissingCollapseTails (collapse-coverage check)', () => {
  it('passes a file that overrides no collapse-managed token', () => {
    expect(findMissingCollapseTails(brandApprovedOnly, tokensCss)).toEqual([])
  })

  it('reports a base blur override with no tail under BOTH a11y blocks', () => {
    expect(findMissingCollapseTails(brandBlurNoTail, tokensCss)).toEqual([
      { token: '--panel-blur', media: 'prefers-reduced-transparency: reduce' },
      { token: '--panel-blur', media: 'prefers-contrast: more' },
    ])
  })

  it('passes once both a11y tails re-assert the collapse', () => {
    expect(findMissingCollapseTails(brandBlurWithTails, tokensCss)).toEqual([])
  })

  it('reports a surface-fill override with no tail under BOTH a11y blocks', () => {
    expect(findMissingCollapseTails(brandGlassBgNoTail, tokensCss)).toEqual([
      { token: '--glass-bg', media: 'prefers-reduced-transparency: reduce' },
      { token: '--glass-bg', media: 'prefers-contrast: more' },
    ])
  })

  it('reports a theme-scoped override whose only tail is a lower-specificity :root', () => {
    // The tail declares --glass-bg under the right media, but at :root (0,1,0) it
    // loses to the :root[data-theme='dark'] override (0,2,0) — contrast stays broken.
    expect(findMissingCollapseTails(brandDarkGlassRootTail, tokensCss)).toEqual([
      { token: '--glass-bg', media: 'prefers-reduced-transparency: reduce' },
      { token: '--glass-bg', media: 'prefers-contrast: more' },
    ])
  })

  it('passes a theme-scoped override whose tail carries the matching theme selector', () => {
    expect(findMissingCollapseTails(brandDarkGlassDarkTail, tokensCss)).toEqual([])
  })
})

describe('findUnthemedBackdropImage (wallpaper theme-coverage check)', () => {
  it('is false when the file never declares --backdrop-image', () => {
    expect(findUnthemedBackdropImage(brandApprovedOnly)).toBe(false)
  })

  it('flags a base :root wallpaper with no dark scope', () => {
    expect(findUnthemedBackdropImage(brandWallpaperLightOnly)).toBe(true)
  })

  it('passes once the dark scope repeats the token', () => {
    expect(findUnthemedBackdropImage(brandWallpaperThemed)).toBe(false)
  })

  it('does not accept a black-only scope as satisfying the dark requirement (black is a strict subset of dark — an ordinary dark-theme user would still get the light photo)', () => {
    expect(findUnthemedBackdropImage(brandWallpaperBlackOnly)).toBe(true)
  })
})

// The shipped template's tail, checked DIRECTLY against tokens.css rather than through
// runBrandPolicy (below). Every value line above the tail is commented out — a deliberate
// starting point for a consumer to uncomment — so the template never carries a live base
// override, and findMissingCollapseTails's `baseOverrides.length === 0 -> continue` skips every
// token as a result: runBrandPolicy's collapse-tail check cannot exercise this file's tail AT
// ALL. This suite is what actually holds the tail to tokens.css, and fails naming the exact
// token(s) if a line is ever lost from it.
describe('brand-template.css tail coverage (derived from tokens.css)', () => {
  const templateCss = readFileSync(
    fileURLToPath(new URL('../styles/brand-template.css', import.meta.url)),
    'utf8',
  )

  it('ships with no live base declaration — the check above is intentionally vacuous, not accidental', () => {
    const declared = parseDeclaredTokens(templateCss)
    const liveBase = Array.from(declared.entries())
      .filter(([, scopeKeys]) => scopeKeys.some((key) => key.startsWith('base|')))
      .map(([token]) => token)
    expect(liveBase, 'every value line in brand-template.css should ship commented out').toEqual([])
  })

  it('re-asserts every collapse-managed brand-approved token from tokens.css at all three tail scopes', () => {
    const tokensDeclared = parseDeclaredTokens(tokensCss)
    const templateDeclared = parseDeclaredTokens(templateCss)
    const missing: string[] = []
    for (const media of A11Y_MEDIA) {
      for (const [token, scopeKeys] of tokensDeclared) {
        if (!BRAND_TOKENS.has(token)) continue
        if (!scopeKeys.some((key) => key.startsWith(`${media}|`))) continue
        for (const scope of ['root', 'dark', 'black']) {
          const key = `${media}|${scope}`
          if (!(templateDeclared.get(token) ?? []).includes(key)) missing.push(`${token} @ (${media}) [${scope}]`)
        }
      }
    }
    expect(
      missing,
      missing.length === 0 ? '' : `brand-template.css's mandatory tail is missing: ${missing.join(', ')}`,
    ).toEqual([])
  })
})

// runBrandPolicy used exactly as a consumer would: register the real suite over the shipped
// template. Its disallowed-token check is meaningful here — it would catch a locked structural
// token left uncommented. Its collapse-tail check is VACUOUS against this specific file: with no
// live base override (see above), findMissingCollapseTails has no override to require a tail
// FOR, so this call cannot prove the tail is complete — the derived suite above does that.
runBrandPolicy({
  brandCssPath: fileURLToPath(new URL('../styles/brand-template.css', import.meta.url)),
})
