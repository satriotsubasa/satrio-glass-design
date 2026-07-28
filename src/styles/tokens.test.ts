// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { describe, it, expect } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8')

describe('tokens.css', () => {
  it('defines the core token families on :root', () => {
    for (const token of [
      '--bg', '--surface', '--label', '--label-2', '--label-3', '--separator',
      '--accent', '--accent-fill', '--danger', '--income', '--expense',
      '--warning', '--warning-fill',
      '--radius-card', '--radius-tile', '--radius-control',
      '--space-1', '--space-2', '--space-3', '--space-4',
      '--fs-large-title', '--fs-title', '--fs-headline', '--fs-body', '--fs-callout', '--fs-caption',
      '--fs-caption2',
      '--font-sans', '--font-mono',
      // --chrome-bg is deliberately NOT in this list: deleted as verified-dead (design/motion
      // plan Task 7) — zero consumers across src/; the real nav chrome fill is --nav-bg. Its
      // name claimed to be the chrome fill while editing it changed nothing. Do not re-add.
      '--glass-blur', '--glass-bg', '--sheet-bg', '--panel-bg', '--panel-blur',
      '--glass-border', '--glass-highlight', '--glass-shadow',
      '--backdrop',
    ]) {
      expect(css, `missing ${token}`).toContain(token)
    }
  })

  it('multiplies every type-ramp SIZE by --app-font-scale (the fontScale setting consumer)', () => {
    const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf(':root[data-theme="dark"]'))
    expect(lightBlock).toContain('--app-font-scale: 1')
    for (const token of [
      '--fs-large-title', '--fs-title', '--fs-headline', '--fs-body', '--fs-callout', '--fs-caption',
      '--fs-caption2',
    ]) {
      const pattern = new RegExp(`${token}:\\s*calc\\([^)]*\\* var\\(--app-font-scale\\)\\)`)
      expect(css, `${token} must scale with --app-font-scale`).toMatch(pattern)
    }
  })

  it('multiplies every spacing token by --app-font-scale (spacing joins Dynamic Type)', () => {
    // Task 15 (design/motion plan): Apple §15 — "scale layout WITH the text, so a larger font
    // doesn't break the layout." The type ramp scaled 0.85–1.2 while every gap stayed frozen,
    // so at Large the app packed 20% more text into identical padding — the opposite of what
    // the setting promises. Radii are deliberately NOT scaled (surface property, not density).
    for (const token of ['--space-1', '--space-2', '--space-3', '--space-4']) {
      const pattern = new RegExp(`${token}:\\s*calc\\([^)]*\\* var\\(--app-font-scale\\)\\)`)
      expect(css, `${token} must scale with --app-font-scale`).toMatch(pattern)
    }
  })

  it('keeps every type-ramp LEADING unitless (a ratio, never absolute px)', () => {
    // A unitless line-height applies to the already-scaled font-size AND inherits as a ratio, so
    // the --app-font-scale multiply is redundant — and the old absolute-px form was harmful: it
    // froze inherited leading at body's 22px for the 182 rules that set a --fs-* size without
    // their own line-height (12px captions in 22px line boxes, nav labels 6px too tall).
    for (const token of [
      '--lh-large-title', '--lh-title', '--lh-headline', '--lh-body', '--lh-callout', '--lh-caption',
      '--lh-caption2',
    ]) {
      const pattern = new RegExp(`${token}:\\s*[\\d.]+\\s*;`)
      expect(css, `${token} must be a unitless ratio`).toMatch(pattern)
    }
  })

  it('defines the whole tracking ramp in em (em resolves against the already-scaled font-size)', () => {
    for (const token of [
      '--tracking-large-title', '--tracking-title', '--tracking-headline', '--tracking-body',
      '--tracking-callout', '--tracking-caption', '--tracking-eyebrow',
    ]) {
      const pattern = new RegExp(`${token}:\\s*-?[\\d.]+em\\s*;`)
      expect(css, `${token} must be defined with an em value`).toMatch(pattern)
    }
  })

  it('caps --dur-enter at 300ms (emil §4: UI animations must stay under 300ms — encodes the cap so it cannot regress)', () => {
    const match = css.match(/--dur-enter:\s*([\d.]+)ms/)
    expect(match, '--dur-enter must be defined in ms').not.toBeNull()
    expect(Number(match![1])).toBeLessThanOrEqual(300)
  })

  it('defines every fs/lh/tracking/space/dur/ease/blur token consumed anywhere in src/**/*.{css,ts,tsx} (token-existence guard)', () => {
    // The guard for the silent-invalid-declaration class of bug: an unresolvable var() makes the
    // declaration invalid at computed-value time — no build error, no lint error, the property
    // just falls back to inherit/initial (this is exactly how --fs-title-2 shipped a transfer
    // headline at body size). A mistyped token in any stylesheet fails HERE instead.
    // TS/TSX are scanned too: the Toaster (AppShell.tsx) and the Gallery swatches consume
    // var(--blur-*) INLINE in TSX — a CSS-only scan was blind to exactly those consumers. The
    // extraction regex anchors on `var(--<prefix>-`, so non-token `var(` text in TS never
    // false-positives.
    const srcDir = fileURLToPath(new URL('../', import.meta.url))
    const consumerFiles = readdirSync(srcDir, { recursive: true })
      .map(String)
      .filter((relative) => /\.(css|ts|tsx)$/.test(relative))

    const defined = new Set(css.match(/--(?:fs|lh|tracking|space|dur|ease|blur)-[a-z0-9-]+(?=\s*:)/g))
    expect(defined.size).toBeGreaterThan(0)

    for (const relative of consumerFiles) {
      const fileCss = readFileSync(join(srcDir, relative), 'utf8')
      for (const match of fileCss.matchAll(/var\(\s*(--(?:fs|lh|tracking|space|dur|ease|blur)-[a-z0-9-]+)/g)) {
        expect(defined, `${match[1]} is used in src/${relative.replace(/\\/g, '/')} but not defined in tokens.css`)
          .toContain(match[1])
      }
    }
  })

  it('keeps every letter-spacing on the tracking ramp — zero raw values in src/**/*.css outside tokens.css', () => {
    // Task 8 (typography sweep): the 67 ad-hoc letter-spacing values (7 different eyebrow
    // trackings alone, -0.02em and -0.01em on the SAME size in the same file) were replaced with
    // the --tracking-* ramp. Apple §15: tracking is size-specific — the token names the size
    // step, so a rule can no longer carry a tracking that contradicts its own font-size.
    // Any deliberate exception must carry an inline CSS comment at the site AND an entry here.
    const allowlist: string[] = [] // stays empty — no exception has earned one
    const srcDir = fileURLToPath(new URL('../', import.meta.url))
    const files = readdirSync(srcDir, { recursive: true })
      .map(String)
      .filter((relative) => relative.endsWith('.css'))
      .filter((relative) => !relative.replace(/\\/g, '/').endsWith('styles/tokens.css'))
    expect(files.length).toBeGreaterThan(0)
    for (const relative of files) {
      const content = readFileSync(join(srcDir, relative), 'utf8')
      for (const match of content.matchAll(/letter-spacing:\s*([^;]+);/g)) {
        const value = match[1].trim()
        if (allowlist.includes(`${relative.replace(/\\/g, '/')}: ${value}`)) continue
        expect(value, `raw letter-spacing "${value}" in src/${relative.replace(/\\/g, '/')} — use the var(--tracking-*) step that matches the rule's font size`)
          .toMatch(/^var\(--tracking-[a-z-]+\)$/)
      }
    }
  })

  it('keeps every font-size on the type ramp — no bare px/rem/em values in src/**/*.css outside documented exceptions', () => {
    // Task 8: a bare px/rem font-size opts out of the Settings fontScale (rem is ROOT-relative
    // and domEffects.ts removes the root font-size override — this is how the whole legacy
    // import flow shipped immune to text size). Allowed forms, all of which track the scale:
    //   - anything referencing var(--fs-…): plain tokens, calc()s, and the two iOS zoom guards
    //     max(16px, var(--fs-body)) (SearchField / AmountRangeInputs — the 16px focus-zoom floor
    //     STAYS, §4; max() lets the field rejoin the ramp above fontScale ≈1.07)
    //   - the clamp'd hero form calc(clamp(…) * var(--app-font-scale, 1)) and other direct
    //     --app-font-scale multiplies (e.g. CategoryComposer's 26px icon-glyph fallback)
    // Everything else needs an inline CSS comment at the site AND an allowlist entry here.
    // Deliberate font-size off-ramps only; every entry must name a real file in this repo —
    // the stale-entry check below enforces it.
    const allowlist: string[] = []
    const srcDir = fileURLToPath(new URL('../', import.meta.url))
    const files = readdirSync(srcDir, { recursive: true })
      .map(String)
      .filter((relative) => relative.endsWith('.css'))
      .filter((relative) => !relative.replace(/\\/g, '/').endsWith('styles/tokens.css'))
    expect(files.length).toBeGreaterThan(0)
    const seen: string[] = []
    for (const relative of files) {
      const content = readFileSync(join(srcDir, relative), 'utf8')
      for (const match of content.matchAll(/font-size:\s*([^;]+);/g)) {
        const value = match[1].trim()
        if (/var\(--fs-|var\(--app-font-scale/.test(value)) continue
        const key = `${relative.replace(/\\/g, '/')}: ${value}`
        seen.push(key)
        expect(allowlist, `bare font-size "${value}" in src/${relative.replace(/\\/g, '/')} — use a --fs-* ramp step (or a documented, allowlisted exception)`)
          .toContain(key)
      }
    }
    // the allowlist must not outlive its sites — a stale entry is a hole in the scan
    for (const entry of allowlist) {
      expect(seen, `stale allowlist entry "${entry}" — the site no longer exists, remove it`).toContain(entry)
    }
  })

  it('defines a dark theme override block', () => {
    expect(css).toContain(':root[data-theme="dark"]')
  })

  it('defines the black theme override', () => {
    expect(css).toContain('data-theme-mode="black"')
  })

  it('collapses glass under reduced transparency', () => {
    expect(css).toContain('prefers-reduced-transparency: reduce')
  })

  it('defines the four-tier material blur ladder with the correct DIRECTION: sheet > chrome > card > chip (Apple §12: bigger surfaces read as thicker)', () => {
    // The pre-ladder values were exactly backwards (sheets 20px, dash-cards 30px over a smooth
    // gradient). This numeric parse encodes the direction so it cannot silently invert again.
    // match() takes the FIRST occurrence — the :root definition, not the 0px a11y re-zeroes in
    // the media blocks at the end of the file.
    const read = (token: string): number => {
      const match = css.match(new RegExp(`${token}:\\s*([\\d.]+)px`))
      expect(match, `${token} must be defined with a px value`).not.toBeNull()
      return Number(match![1])
    }
    const chip = read('--blur-chip')
    const card = read('--blur-card')
    const chrome = read('--blur-chrome')
    const sheet = read('--blur-sheet')
    expect(card, '--blur-card must be thicker than --blur-chip').toBeGreaterThan(chip)
    expect(chrome, '--blur-chrome must be thicker than --blur-card').toBeGreaterThan(card)
    expect(sheet, '--blur-sheet must be the thickest tier').toBeGreaterThan(chrome)
  })

  it('zeroes every blur tier AND pins the translucent surface fills opaque under prefers-reduced-transparency (the a11y collapse covers the whole ladder, not just the legacy glass/panel tokens)', () => {
    const start = css.indexOf('@media (prefers-reduced-transparency: reduce)')
    expect(start).toBeGreaterThan(-1)
    const block = css.slice(start, css.indexOf('@media', start + 1) === -1 ? css.length : css.indexOf('@media', start + 1))
    for (const token of [
      '--glass-blur', '--panel-blur', '--card-blur',
      '--blur-chip', '--blur-card', '--blur-chrome', '--blur-sheet',
    ]) {
      expect(block, `${token} must collapse to 0px under reduced transparency`)
        .toMatch(new RegExp(`${token}:\\s*0px`))
    }
    // Class-less consumers (Sheet, Modal, Select, and the nav/sidebar chromes downstream) read
    // these fills directly — the .glass/.panel-material/.dash-card fallbacks in global.css cannot
    // reach them, so only the token pin removes their translucency.
    for (const token of ['--glass-bg', '--glass-bg-strong', '--panel-bg', '--card-bg', '--sheet-bg', '--menu-bg', '--nav-bg']) {
      expect(block, `${token} must pin to the opaque --surface under reduced transparency`)
        .toMatch(new RegExp(`${token}:\\s*var\\(--surface\\)`))
    }
    // The fills are theme-overridden at 0-2-0, so the block needs the theme-scoped selectors to
    // win — and dark/black resolve var(--surface) per theme.
    expect(block).toContain(":root[data-theme='dark']")
    expect(block).toContain(":root[data-theme-mode='black']")
    // Ordering: theme-scoped now, so it must sit AFTER every theme + high-text-contrast block.
    expect(start).toBeGreaterThan(css.indexOf(":root[data-theme-mode='black'][data-high-text-contrast='on']"))
    // Borders stay OUT: a translucent border paints over the element's own opaque background, so
    // it leaks no backdrop. Promoting them is the CONTRAST block's job, not this one.
    for (const token of ['--glass-border', '--panel-border', '--card-border']) {
      expect(block, `${token} must NOT be promoted under reduced transparency — that is contrast-only`)
        .not.toContain(`${token}:`)
    }
  })

  it('ships a prefers-contrast: more block that zeroes each blur and pins the translucent surfaces opaque (OS Increase Contrast — Apple §14\'s third independent signal)', () => {
    const start = css.indexOf('@media (prefers-contrast: more)')
    expect(start, 'tokens.css must handle the OS contrast preference').toBeGreaterThan(-1)
    const block = css.slice(start)
    for (const token of [
      '--glass-blur', '--panel-blur', '--card-blur',
      '--blur-chip', '--blur-card', '--blur-chrome', '--blur-sheet',
    ]) {
      expect(block, `${token} must be zeroed under prefers-contrast: more`)
        .toMatch(new RegExp(`${token}:\\s*0px`))
    }
    // --nav-bg is in this list because its consumers (nav.bar/aside.bar) are element-qualified
    // at 0-1-1 — they beat the .glass opaque fallback by specificity, so ONLY the token pin can
    // make the two primary navigation chromes opaque under OS Increase Contrast.
    for (const token of ['--glass-bg', '--glass-bg-strong', '--panel-bg', '--card-bg', '--sheet-bg', '--menu-bg', '--nav-bg']) {
      expect(block, `${token} must pin to the opaque --surface under prefers-contrast: more`)
        .toMatch(new RegExp(`${token}:\\s*var\\(--surface\\)`))
    }
    // The surface pins are theme-overridden at 0-2-0 specificity, so the block needs the
    // theme-scoped selectors to win — and dark/black resolve var(--surface) per theme.
    expect(block).toContain(":root[data-theme='dark']")
    expect(block).toContain(":root[data-theme-mode='black']")
    // Ordering (§5 gate): the block ADDS alongside the data-high-text-contrast contract — it
    // must sit AFTER those blocks, never between the theme blocks and them.
    expect(start).toBeGreaterThan(css.indexOf(":root[data-theme-mode='black'][data-high-text-contrast='on']"))
  })

  it('defines --shadow-sheet warm in the light scope and overrides it (true black) in the dark scope', () => {
    // Same convention as --glass-shadow/--card-shadow: warm rgba(86,55,43,…) on light (a literal
    // neutral black casts a cold grey shadow adjacent to warm card shadows), black on dark.
    // Black inherits the dark value via data-theme="dark" (applyTheme.ts) — already black.
    const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf(':root[data-theme="dark"]'))
    const darkBlock = css.slice(
      css.indexOf(':root[data-theme="dark"]'),
      css.indexOf(':root[data-theme-mode="black"]'),
    )
    expect(lightBlock).toMatch(/--shadow-sheet:[^;]*rgba\(86, 55, 43/)
    expect(darkBlock).toMatch(/--shadow-sheet:[^;]*rgba\(0, 0, 0/)
  })

  it('keeps every backdrop blur on the token ladder — zero literal blur(Npx) anywhere in src/ outside tokens.css', () => {
    // The four surfaces that hardcoded a 20px blur (Sheet, Modal, Select, the Toaster) were
    // exactly the ones the reduced-transparency collapse could never reach. Every blur must
    // resolve through a var() so the a11y media blocks above govern ALL of them. (This scan is
    // also why no comment in src/ may spell out a literal px blur inside the function form.)
    const srcDir = fileURLToPath(new URL('../', import.meta.url))
    const files = readdirSync(srcDir, { recursive: true })
      .map(String)
      .filter((relative) => /\.(css|ts|tsx)$/.test(relative))
      .filter((relative) => !relative.replace(/\\/g, '/').endsWith('styles/tokens.css'))
    expect(files.length).toBeGreaterThan(0)
    for (const relative of files) {
      const content = readFileSync(join(srcDir, relative), 'utf8')
      expect(content, `literal blur(<px>) in src/${relative.replace(/\\/g, '/')} — route it through a --blur-* tier`)
        .not.toMatch(/blur\(\s*\d/)
    }
  })

  it('defines the unified dash-card surface tokens on :root', () => {
    const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf(':root[data-theme="dark"]'))
    for (const token of [
      // --card-scrim is deliberately NOT in this list: deleted as verified-dead (design/motion
      // plan Task 7) together with the .dash-card::before layer that consumed it — it was
      // rgba(0,0,0,0) with no theme override, a permanent fully-transparent paint layer on
      // every dashboard card. Cards aren't modal; a card scrim has no job. Do not re-add.
      '--card-bg', '--card-border', '--card-highlight', '--card-blur', '--card-shadow',
    ]) {
      expect(lightBlock, `missing ${token} on light :root`).toContain(token)
    }
  })

  it('themes the warning tone per scheme — light + dark scopes (black inherits dark via data-theme="dark", like --income/--expense)', () => {
    const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf(':root[data-theme="dark"]'))
    const darkBlock = css.slice(
      css.indexOf(':root[data-theme="dark"]'),
      css.indexOf(':root[data-theme-mode="black"]'),
    )
    for (const token of ['--warning:', '--warning-fill:']) {
      expect(lightBlock, `missing ${token} on light :root`).toContain(token)
      expect(darkBlock, `missing ${token} override in dark scope`).toContain(token)
    }
  })

  it('defines high-text-contrast overrides for all three themes (Settings: highTextContrast → data-high-text-contrast="on")', () => {
    const selectors = [
      ":root[data-high-text-contrast='on']",
      ":root[data-theme='dark'][data-high-text-contrast='on']",
      ":root[data-theme-mode='black'][data-high-text-contrast='on']",
    ]
    for (const selector of selectors) {
      const start = css.indexOf(selector)
      expect(start, `missing ${selector}`).toBeGreaterThan(-1)
      const block = css.slice(start, css.indexOf('}', start))
      for (const token of ['--label-2:', '--label-3:', '--separator:']) {
        expect(block, `${selector} must strengthen ${token}`).toContain(token)
      }
    }

    // The light block ties with the plain dark theme block at specificity 0-2-0, and the black
    // combo ties with the dark combo at 0-3-0 — file ORDER is the tie-break, so the contrast
    // blocks must come after the theme blocks, with the black combo after the dark combo.
    expect(css.indexOf(selectors[0])).toBeGreaterThan(css.indexOf(':root[data-theme-mode="black"]'))
    expect(css.indexOf(selectors[2])).toBeGreaterThan(css.indexOf(selectors[1]))
  })

  it('re-grounds sheet/menu/strong-glass fills in the BLACK scope (the "silently inherits dark" trap)', () => {
    // applyTheme.ts paints BOTH data-theme="dark" AND data-theme-mode="black" for the black
    // theme, so any surface token the black block omits inherits the DARK value unnoticed —
    // that is exactly how sheets, menus and strong glass shipped as warm-brown rgb(38,28,25)
    // slabs on the #050505 OLED canvas. These three must stay explicitly overridden.
    const start = css.indexOf(':root[data-theme-mode="black"]')
    expect(start).toBeGreaterThan(-1)
    const blackBlock = css.slice(start, css.indexOf('}', start))
    for (const token of ['--sheet-bg:', '--menu-bg:', '--glass-bg-strong:']) {
      expect(blackBlock, `black theme must override ${token} or it inherits the dark (brown) value`)
        .toContain(token)
    }
  })

  it('keeps the verified-dead tokens deleted everywhere in src/ — no definitions, no usages', () => {
    // --chrome-bg (real chrome fill: --nav-bg), --card-scrim and --panel-scrim (fully-transparent
    // no-op scrims) were deleted as verified-dead by the design/motion plan (Task 7). This scan
    // fails if anyone re-adds a definition OR a consumer under any of the three names.
    const deadTokens = ['--chrome-bg', '--card-scrim', '--panel-scrim']
    const srcDir = fileURLToPath(new URL('../', import.meta.url))
    const files = readdirSync(srcDir, { recursive: true })
      .map(String)
      .filter((relative) => /\.(css|ts|tsx)$/.test(relative))
      // this file necessarily names the dead tokens (in this very assertion) — skip it
      .filter((relative) => !relative.replace(/\\/g, '/').endsWith('styles/tokens.test.ts'))
    expect(files.length).toBeGreaterThan(0)
    for (const relative of files) {
      const content = readFileSync(join(srcDir, relative), 'utf8')
      for (const token of deadTokens) {
        expect(content, `${token} was deleted as verified-dead but appears in src/${relative.replace(/\\/g, '/')}`)
          .not.toContain(token)
      }
    }
  })

  it('declares no --backdrop* token inside either a11y @media block (satrio.io brand.css:31 already pins --backdrop at base :root with no a11y tail — collapsing a --backdrop* token here would demand one and break that consumer\'s brand policy suite)', () => {
    const reduceStart = css.indexOf('@media (prefers-reduced-transparency: reduce)')
    const contrastStart = css.indexOf('@media (prefers-contrast: more)')
    expect(reduceStart, 'missing the reduced-transparency block').toBeGreaterThan(-1)
    expect(contrastStart, 'missing the contrast block').toBeGreaterThan(-1)
    const reduceBlock = css.slice(reduceStart, contrastStart)
    const contrastBlock = css.slice(contrastStart)
    for (const block of [reduceBlock, contrastBlock]) {
      expect(block, 'a --backdrop* token must never be declared inside an a11y @media block')
        .not.toMatch(/--backdrop[a-z0-9-]*\s*:/i)
    }
  })

  it('overrides card-bg and card-shadow in the dark and black scopes', () => {
    const darkBlock = css.slice(
      css.indexOf(':root[data-theme="dark"]'),
      css.indexOf(':root[data-theme-mode="black"]'),
    )
    const blackBlock = css.slice(css.indexOf(':root[data-theme-mode="black"]'))

    for (const token of ['--card-bg', '--card-shadow']) {
      expect(darkBlock, `missing ${token} override in dark scope`).toContain(token)
      expect(blackBlock, `missing ${token} override in black scope`).toContain(token)
    }
  })
})
