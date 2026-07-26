# The brand layer

satrio glass ships one visual language shared across apps. The **brand layer** is how a
single app re-skins that language — palette, accents, surface tints, corner radii, material
thickness — **without forking `tokens.css`**. You import the system, then a small `brand.css`
after it re-points a fixed allowlist of tokens.

Everything outside that allowlist — the type ramp, spacing, the blur ladder, motion — is the
system's *structure*. It stays identical everywhere so components behave and read the same in
every app. A policy test (`runBrandPolicy`) fails the build if a brand file crosses that line.

## Brand vs structure

Only these tokens are overridable. Each is the semantic knob named in plain language; the
system default lives in `tokens.css` and a copy-ready, pre-filled list lives in
`brand-template.css`.

### Neutral palette + text

| Token | Meaning |
| --- | --- |
| `--bg` | App background base colour (under the backdrop). |
| `--surface` | Primary opaque surface — cards, sheets, wells. |
| `--surface-2` | Recessed/secondary surface — grouped rows, inset wells. |
| `--label` | Primary text colour. |
| `--label-2` | Secondary text — subtitles, metadata. |
| `--label-3` | Tertiary text — hints, placeholders (also the border colour under Increase Contrast). |
| `--separator` | Hairline divider colour. |

### Accent + status

| Token | Meaning |
| --- | --- |
| `--accent` | Coloured glyphs/text on glass. |
| `--accent-fill` | Solid accent behind white text — buttons, badges. |
| `--danger` | Destructive / error tone. |
| `--income` | Positive / credit tone. |
| `--expense` | Negative / debit tone. |
| `--warning` | Warning text/glyphs on tinted chips. |
| `--warning-fill` | Solid warning fill behind no text — progress bars. |

### Glass + surface tints

| Token | Meaning |
| --- | --- |
| `--glass-bg` | Chrome glass fill — nav pill, controls. |
| `--glass-bg-strong` | Stronger chrome glass fill. |
| `--glass-border` | Glass hairline border. |
| `--glass-highlight` | Top inner highlight on glass. |
| `--glass-shadow` | Glass drop-shadow tint. |
| `--shadow-sheet` | Sheet / dialog drop shadow. |
| `--sheet-bg` | Modal sheet fill. |
| `--menu-bg` | Menu / popover fill. |
| `--nav-bg` | Bottom-nav + sidebar chrome fill (more opaque than `--glass-bg`). |
| `--panel-bg` | Translucent content-panel fill. |
| `--panel-border` | Content-panel border. |
| `--card-bg` | Dashboard-card fill. |
| `--card-border` | Card border. |
| `--card-highlight` | Card top highlight. |
| `--card-shadow` | Card drop shadow. |
| `--backdrop` | The full-viewport background image/gradient behind all glass. |

### Geometry

| Token | Meaning |
| --- | --- |
| `--radius-card` | Card / sheet corner radius. |
| `--radius-tile` | Tile / row corner radius. |
| `--radius-control` | Button / input corner radius. |

### Material thickness (aliases)

| Token | Meaning |
| --- | --- |
| `--glass-blur` | Chrome glass blur — alias, retarget to another ladder tier or a length. |
| `--panel-blur` | Content-panel blur — alias. |
| `--card-blur` | Dashboard-card blur — alias. |

These three are **aliases** onto the blur ladder (`--blur-chip/card/chrome/sheet`). You may
retarget an alias (e.g. point `--panel-blur` at a heavier tier or a literal length), but the
ladder tiers themselves are locked — they keep "bigger surface reads as thicker material"
consistent across apps.

## Import order

Cascade order is the whole mechanism. Import the system first, your brand file last:

```ts
import '@satrio/glass-design/styles/global.css' // pulls in tokens.css
import './brand.css'                            // your overrides win by coming later
```

## The collapse-tail rule (and why)

`tokens.css` ends with two accessibility blocks — `@media (prefers-reduced-transparency:
reduce)` and `@media (prefers-contrast: more)`. Both flatten every blur tier and pin the
translucent surface fills (`--glass-bg`, `--glass-bg-strong`, `--panel-bg`, `--card-bg`,
`--sheet-bg`, `--menu-bg`, `--nav-bg`) to the current theme's opaque `--surface`; the contrast
block additionally promotes the hairline borders to `--label-3`. Both use the theme-scoped
selector list (`:root, :root[data-theme='dark'], :root[data-theme-mode='black']`) because those
fills are re-declared at (0,2,0) inside the dark/black theme blocks — a plain `:root` pin would
lose to them by specificity, however late it sits in the file.

Your `brand.css` is imported *after* `tokens.css`. So a base override like
`:root { --panel-blur: 30px }` sits later in the cascade than those `@media` blocks and, at
equal specificity, **beats them** — Reduce Transparency would silently stop flattening your
blur. (A theme-scoped override such as `:root[data-theme='dark'] { --glass-bg: … }` is worse:
it wins by *specificity* regardless of order.)

The fix: whenever you override a collapse-managed token, **re-assert it inside the matching
`@media` block at the end of `brand.css`**. `brand-template.css` ships that tail pre-written
for every brandable managed token, so keeping it covers you automatically. `runBrandPolicy`
turns a forgotten tail into a test failure, naming the token and the missing block.

**The tail's selector must be at least as specific as the override's.** A theme-scoped
override such as `:root[data-theme='dark'] { --glass-bg: … }` has specificity (0,2,0) and
beats a plain `:root` tail (0,1,0) *by specificity* — so re-asserting it under `:root` alone
still leaves the tail broken in dark under EITHER a11y block (Reduce Transparency as much as
Increase Contrast — a too-weak selector loses the same way regardless of which `@media` block
it sits under). Hand-rolling a tail, match the override's scope, under BOTH blocks:

```css
/* override */
:root[data-theme='dark'] { --glass-bg: rgba(20, 20, 20, 0.4); }

/* WRONG — :root (0,1,0) loses to the dark override (0,2,0) */
@media (prefers-contrast: more) { :root { --glass-bg: var(--surface); } }

/* RIGHT — the tail carries the same theme scope (or a list that includes it), under BOTH
   a11y blocks: the reduced-transparency collapse and the contrast collapse are independent
   OS signals, each with its own tail requirement */
@media (prefers-reduced-transparency: reduce) {
  :root,
  :root[data-theme='dark'],
  :root[data-theme-mode='black'] { --glass-bg: var(--surface); }
}
@media (prefers-contrast: more) {
  :root,
  :root[data-theme='dark'],
  :root[data-theme-mode='black'] { --glass-bg: var(--surface); }
}
```

The template's tails use that three-selector list precisely so they cover a plain *or* a
theme-scoped override; `runBrandPolicy` fails a tail whose selector is too weak for the scope
it is meant to protect.

**Upgrading to 1.1:** The fills are now collapse-managed under Reduce Transparency as well as
Increase Contrast, so `runBrandPolicy` requires a reduced-transparency tail for any of the seven
you override at base. If you already keep the template tail verbatim, add the seven fill lines
to its reduced-transparency block; if you hand-rolled a tail, the failure message names the
exact token and media.

## Wiring `runBrandPolicy` into your app

`runBrandPolicy` registers a `describe`/`it` suite, so call it at the top level of a vitest
test file. `vitest` is an optional peer of this package — add it as a devDependency in the
consumer app.

```ts
// src/styles/brand.policy.test.ts
import { runBrandPolicy } from '@satrio/glass-design/testing'

runBrandPolicy({
  brandCssPath: 'src/styles/brand.css',
  // tokensCssPath is optional — defaults to the package's own tokens.css
})
```

`brandCssPath` is a plain string, resolved against `process.cwd()` when relative. Do **not** wrap
it in `fileURLToPath(new URL(<string literal>, import.meta.url))`: under a `jsdom`/`happy-dom` test
environment Vite and vitest rewrite that literal expression into an `http://` dev-server URL and
`fileURLToPath` throws `The URL must be of scheme file`.

It asserts two things: your file overrides **only** brand-approved tokens, and it re-asserts
the a11y collapse for every collapse-managed token it touches.

## What is deliberately NOT overridable

These stay locked so components render and scale identically across every app:

- **Type ramp** — `--fs-*`, `--lh-*`, `--tracking-*` (sizes, leading, tracking).
- **Spacing** — `--space-1…4`.
- **Blur ladder tiers** — `--blur-chip/card/chrome/sheet` (retarget the aliases instead).
- **Motion** — `--ease-*`, `--dur-*`.
- **Density** — `--app-font-scale`.
- **Fonts** — `--font-sans`, `--font-mono`.

If a site genuinely needs a knob that is not on the allowlist, that is a signal about the
*system*, not a reason to fork it: open an issue or PR against this repo
(`satrio-glass-design`) so the need is met once — as a new shared token or a new
`BRAND_TOKENS` entry — for every app, rather than diverging per app.
