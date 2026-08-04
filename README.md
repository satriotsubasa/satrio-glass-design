# @satrio/glass-design

satrio glass — the shared design language for Satrio Tsubasa's apps: tokens, materials, motion,
components, and the policy tests that enforce them across every consumer.

## What this is

One design system consumed by every app instead of forked per-app. It ships CSS custom-property
tokens (type ramp, spacing, a four-tier blur ladder, purpose-split easings/durations), the
materials and motion built on top of them (`.glass`/`.glass-strong`/`.panel-material`, theme
cross-fade, icon-shape clips), ~30 generic UI components (buttons, fields, sheets, chips, lists,
settings furniture, toast, `KeyValue`'s labelled facts), a small set of decoupled providers (motion
config, icon weight, error boundary), and — the part that actually keeps apps from drifting apart
again — a runnable policy test suite (`@satrio/glass-design/testing`) that each consumer wires into
its own vitest run to enforce the same rules the package enforces on itself. The gallery in this
repo (`src/docs`) is both the visual QA surface and this package's docs, deployed at
`design.satrio.io`.

Headings come in two levels: `PageHeader` renders the page title as an `h1` (one per page), and
`SectionHeader` renders an in-page section title as an `h2` (a page can have many). Same slot API
(`eyebrow`/`title`/`subheading`/`action`), different heading level and type step.

## Install

No npm registry — installed as a git dependency, pinned to a tag:

```
npm i github:satriotsubasa/satrio-glass-design#v1.2.0
```

Peer dependencies you must already have (or add): `react@^19`, `react-dom@^19`,
`framer-motion@^12`, `@phosphor-icons/react@^2.1.0`. `vitest@>=3.0.0` is an optional peer — add it
if you wire the policy tests (below).

Consumers are Vite apps. Several components import `*.module.css`, so your `tsconfig`'s
`compilerOptions.types` needs `"vite/client"` (or a `vite-env.d.ts` with
`/// <reference types="vite/client" />`) — this repo's own `tsconfig.app.json` and
`src/vite-env.d.ts` do exactly that, and all three intended consumer apps already have it.

## Consumer wiring

Import order matters — fonts, then the system's global stylesheet, then your app's own brand
overrides last so they win the cascade:

```ts
// main.tsx / entry point
import '@satrio/glass-design/fonts'
import '@satrio/glass-design/styles/global.css' // pulls in tokens.css
import './brand.css' // your palette — copy from '@satrio/glass-design/styles/brand-template.css'
import '@satrio/glass-design/styles/backdrops.css' // optional: the 4-way backdrop system
```

Import `backdrops.css` **last**, after your own `brand.css` — the same "system, then brand, then
anything optional" order as the rest of this block. Skipping the import changes nothing: the
whole backdrop system is opt-in, so an app that never adds this line, and never stamps
`<html data-backdrop>`, behaves exactly as it did before this stylesheet existed. See
[Backdrops](#backdrops) below for the contract.

Mount the provider stack once, at the app root — this is exactly the stack this repo's own docs
shell (`src/docs/App.tsx`) wraps itself in, composed only from package exports + `react-hot-toast`
(a dependency of this package, but add it to your own app's `package.json` too so your import of
`Toaster` resolves without relying on hoisting):

```tsx
import {
  AppMotionConfig,
  IconProvider,
  IconShapeDefs,
  ErrorBoundary,
} from '@satrio/glass-design'
import { Toaster } from 'react-hot-toast'

export default function App() {
  return (
    <ErrorBoundary>
      <AppMotionConfig animations={appAnimations}> {/* 'all' | 'reduced' | 'none', from your settings store */}
        <IconProvider weight={iconWeight}> {/* your app's Phosphor icon weight */}
          <IconShapeDefs />
          {/* your app */}
          <Toaster position="bottom-center" />
        </IconProvider>
      </AppMotionConfig>
    </ErrorBoundary>
  )
}
```

To *fire* a toast, import `toast` from the `@satrio/glass-design/toast` subpath rather than the
root barrel — non-UI code (stores, hooks, effects) then reaches the helper without pulling the
component tree:

```ts
import { toast } from '@satrio/glass-design/toast'
```

The package declares `sideEffects` in its manifest, so the root barrel is tree-shakeable: importing
a handful of members from `@satrio/glass-design` does not drag the rest of the barrel — its CSS or
its third-party dependencies — into your entry chunk. A component reached only through your own
`lazy()` boundary is dropped from the eager bundle even though the import statement still comes
from the barrel. Measured effect of declaring `sideEffects` alone, consumer source unchanged: an
entry chunk went from 76,513 to 60,470 bytes gzip (−21%). No consumer needs a deep import for
bundle-size reasons.

### Pre-paint theme stamping

The theme (light/dark/black) must be stamped onto `<html>` **before first paint**, or the page
flashes the wrong theme on load — a module import runs too late for this, so it has to be an
inline script in `index.html`, duplicating (not importing) whatever mapping your own theme control
uses. Adapt this repo's own stamp (`index.html`, paired with `src/docs/ThemeControl.tsx`'s
`applyDocsTheme`) to your app's storage key and theme-mode mapping, and keep the two in sync
whenever either changes:

```html
<script>
  ;(function () {
    try {
      var mode = localStorage.getItem('YOUR-STORAGE-KEY') || 'system'
      if (mode === 'system')
        mode = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      var root = document.documentElement
      root.dataset.theme = mode === 'black' ? 'dark' : mode
      if (mode === 'black') root.dataset.themeMode = 'black'
      root.style.colorScheme = mode === 'light' ? 'light' : 'dark'
    } catch (e) {}
  })()
</script>
```

If your CSP disallows inline scripts, hash this exact script's content (see `public/_headers` in
this repo for the pattern) rather than adding `'unsafe-inline'`.

## Field / forms wiring

`Field` renders `hint` and `error` together, hint first, so the format rule stays visible after
validation fires rather than being replaced by it. `error` renders into a `role="alert"` live
region, which is assertive — set it only on submit or blur, never per keystroke, or it interrupts
a screen reader on every character typed.

When `Field` is given `htmlFor`, it publishes `${htmlFor}-hint` / `${htmlFor}-error` ids on the
hint/error text it renders — but it does not wire them anywhere itself (`children` is often a
wrapper around the real control, so `Field` cloning it would describe the wrapper instead). **The
caller owns the control and must add the wiring**, same as it already owns `aria-invalid`:

```tsx
<Field label="Amount" htmlFor="amount" hint="Enter a positive number" error={amountError}>
  <TextInput id="amount" invalid={!!amountError} aria-describedby="amount-hint amount-error" />
</Field>
```

Always list both ids in `aria-describedby`, even when only one of `hint`/`error` is set for this
render — the id for the absent one simply does not exist yet, and screen readers ignore an
idref that resolves to nothing. See `src/docs/Gallery.tsx`'s "Field, TextInput, Textarea, Select"
section for every combination wired this way.

Also move focus to the first invalid control on submit. Safari/VoiceOver do not reliably announce
a `role="alert"` node that is inserted already containing its text — moving focus there makes the
message audible via the `aria-describedby` description regardless, and is good form-UX besides.

## Brand layer

Palette, accents, surface tints, corner radii, and material thickness are re-skinned per app via a
small `brand.css` against a fixed token allowlist — without forking `tokens.css`. Read
[`docs/brand-layer.md`](./docs/brand-layer.md) before writing one: it covers the allowlist, the
import-order mechanism, and the a11y "collapse-tail" rule that `runBrandPolicy` enforces. A
copy-ready starting point ships at `@satrio/glass-design/styles/brand-template.css`.

## Backdrops

`@satrio/glass-design/styles/backdrops.css` is a new, optional subpath export: a four-way
background system driven by `<html data-backdrop>`, shipped together with its own legibility
layer so the two can never be taken apart. It changes nothing for an app that does not import it.

### The contract

`<html data-backdrop="mesh" | "aurora" | "wallpaper">` selects a preset. **Attribute absence is
`minimal`** — the stock accent-tinted `--backdrop` every app already has. No rule in the
stylesheet ever names `'minimal'`, so a build that never leaves it renders byte-identically to
one that never imported `backdrops.css` at all.

### The presets

- **`mesh`** and **`aurora`** are token-derived recipes: every layer is a `color-mix()` over
  `--accent`, `--accent-fill`, `--income`, `--expense` and `--bg`, tuned separately for light,
  dark and black. Because they read your palette tokens rather than literal colours, they
  re-skin with your `brand.css` for free — no preset-specific override needed.
- **`wallpaper`** paints a single image you supply through `--backdrop-image` (declared in
  `tokens.css`, defaulting to `none` — see [`docs/brand-layer.md`](./docs/brand-layer.md)). The
  value must be a bare `<image>` — a `url()`, an `image-set()`, or `none` — because the preset
  substitutes it straight into a `background` **shorthand**; anything carrying its own
  position/size/repeat there makes the whole declaration invalid at computed-value time, and the
  layer falls back to a flat `--bg` wash. URLs must be root-absolute, absolute, or `data:` — a
  relative `url()` inside a custom property is not reliably rebased across browsers, so the
  package never guesses (or ships) an asset path. `wallpaper` is a single, theme-agnostic rule:
  redeclare `--backdrop-image` under your own `:root[data-theme='dark']` scope in `brand.css` to
  swap the image per theme, the same way every other themed token in the system works.

### Wiring a picker

The package ships the **data** for a picker, not a DOM helper — you stamp the attribute
yourself, the same way this repo's own gallery demo does:

```tsx
import { BACKDROP_PRESET_OPTIONS, SegmentedControl, type BackdropPreset } from '@satrio/glass-design'

function BackdropPicker({ value, onChange }: { value: BackdropPreset; onChange: (v: BackdropPreset) => void }) {
  return (
    <SegmentedControl
      options={BACKDROP_PRESET_OPTIONS}
      value={value}
      onChange={(next) => {
        onChange(next)
        if (next === 'minimal') delete document.documentElement.dataset.backdrop
        else document.documentElement.dataset.backdrop = next
      }}
      ariaLabel="Backdrop preset"
    />
  )
}
```

`'minimal'` must **remove** the attribute rather than write the literal value `'minimal'` — that
is the one behavioural contract the data alone doesn't enforce for you.

### The legibility layer ships with it, by design

A busy backdrop without a legibility layer is a regression factory: every heading, caption and
floating icon button that used to sit on a flat gradient now sits on a photo or a saturated
sweep. So the first rule in `backdrops.css` is `@import './legibility.css'`, and the package
exports only the one stylesheet — `./styles/legibility.css` is deliberately absent from `package.json`'s
`exports`, so there is no supported way to take the presets without the protection. A test in
this repo fails the build if the two are ever separated.

The layer has three moving parts:

- An inherited `text-shadow` on `main` / `.backdrop-scope` (a light glow behind dark text, a dark
  shadow behind light text), **bounded** by a reset that zeroes it back to `none` on `.glass`,
  `.glass-strong`, `.panel-material`, `.dash-card`, `input` and `textarea` — so card-borne text
  and ordinary form fields stay stock.
- **`.backdrop-chrome`** — stamp it on a floating tonal/ghost icon-only button that sits straight
  on the page background, and it gets the nav pill's own material (`--nav-bg`, the chrome blur
  tier, the glass hairline) so it cannot dissolve into the image. It stands down for
  `[aria-pressed='true']`: if your toggle flips to an opaque filled variant, set `aria-pressed`
  alongside it, or the chrome paints over the fill.
- **`.backdrop-scope`** — the primary opt-in for an on-backdrop page root, not a fallback: the
  package ships no `<main>` of its own (its gallery page root carries this class for exactly that
  reason), so any app shell that doesn't wrap its whole page in a semantic `<main>` needs it too.

### Accessibility

- **Reduce Transparency** flattens every preset to a plain `--bg` wash *and* stands the whole
  legibility layer down with it — there is no image left to protect against.
- **Increase Contrast** is the opposite trade: the image keeps painting, so the shadows **stay**
  (they only add contrast) while `.backdrop-chrome` and the other translucent fills go opaque.
- **`data-colorful-interface="off"`** still beats every preset, and now stands the legibility
  layer down too.

### What stays in your app

The package ships the CSS contract and the picker's data — nothing that touches the DOM. The
following are deliberately not shipped:

1. The wallpaper image files themselves, and the `--backdrop-image` declarations that point at
   them per theme in your `brand.css`.
2. The settings key, its persistence, and its normalization — an unknown stored value must fall
   back to `minimal`.
3. The picker UI — feed it `BACKDROP_PRESET_OPTIONS`.
4. The pre-paint boot stamp in `index.html` — a module import runs too late for this, the same
   constraint the pre-paint theme stamp above documents, including its CSP-hash caveat if your
   app hashes inline scripts:

   ```html
   <script>
     ;(function () {
       try {
         var backdrop = localStorage.getItem('YOUR-BACKDROP-KEY')
         if (backdrop && backdrop !== 'minimal') document.documentElement.dataset.backdrop = backdrop
       } catch (e) {}
     })()
   </script>
   ```
5. If your app precaches assets with a service worker (e.g. `vite-plugin-pwa`/Workbox), your own
   precache manifest for the wallpaper images — a default Workbox glob typically covers only
   `js`/`css`/`html` and silently skips image extensions, so an uncached wallpaper 404s offline
   unless you add it explicitly (Workbox's `includeAssets`, or your tool's equivalent).
6. Any app-specific at-rest material exception your own sticky chrome needs — a control that was
   "transparent at rest" in the flat-gradient world may need a faint `--surface` backing once a
   busy preset sits behind it. That is a named, per-app idiom the package deliberately does not
   own, in the same shape `.backdrop-chrome` already uses: a base rule, an `@media (prefers-
   reduced-transparency: reduce)` twin, and an `@media (prefers-contrast: more)` twin.

## Policy tests

`@satrio/glass-design/testing` exports four test factories. Each registers its own
`describe`/`it` suite, so call them at the top level of a vitest file in your app (`vitest` is an
optional peer — add it as a devDependency).

Every path option is a plain string, resolved against `process.cwd()` (the directory you run
vitest from) when relative. Pass paths as strings — do **not** wrap them in
`fileURLToPath(new URL(<string literal>, import.meta.url))`: under a `jsdom`/`happy-dom` test
environment Vite and vitest rewrite that literal expression into an `http://` dev-server URL and
`fileURLToPath` throws `The URL must be of scheme file`. For the kit's own `tokens.css`, import the
exported `TOKENS_CSS_PATH` instead of hand-writing a `node_modules/…` path.

```ts
// src/styles/glassPolicy.test.ts
import {
  runBrandPolicy,
  runPressStatePolicy,
  runTokenUsagePolicy,
  runInputZoomPolicy,
  TOKENS_CSS_PATH,
} from '@satrio/glass-design/testing'

// Only BRAND_TOKENS may be overridden, and every collapse-managed token you override must
// re-assert the a11y collapse tail.
runBrandPolicy({
  brandCssPath: 'src/styles/brand.css',
  // tokensCssPath is optional — defaults to the package's own tokens.css
})

// Every :hover sits inside @media (hover: hover), is paired with an :active press state, no
// translateY(1px) press states survive, and only the declared modules define .fab.
runPressStatePolicy({
  cssRoots: ['src/features', 'src/components'],
  fabModules: [], // list your OWN local Fab.module.css paths, if you have any (most apps: none)
})

// Every var(--fs|lh|tracking|space|dur|ease|blur-*) used under srcRoots must be defined in
// tokens.css or your own brand.css.
runTokenUsagePolicy({
  srcRoots: ['src'],
  tokenCssPaths: [TOKENS_CSS_PATH, 'src/styles/brand.css'],
})

// Every font-size in your raw <input>/<textarea> CSS floors at 16px (iOS Safari's focus-zoom
// threshold) via max(16px, var(--fs-*)).
runInputZoomPolicy({
  cssPaths: ['src/features/auth/LoginPage.module.css'],
  rawInputAllowlist: [], // grows only with a documented non-input font-size
})
```

See each factory's JSDoc in `src/testing/*.ts` for the full option list (`composedModifiers`,
`minModules`/`minPressSubjects` floors, etc.).

## Docs app

The gallery in `src/docs` is this package's own docs and visual-QA surface, and the app the policy
tests above run against as their own dogfood target.

```
npm run dev      # vite dev server for the gallery
npm run build    # tsc -b && vite build → dist/ (deployed to design.satrio.io)
npm run preview  # serve the production build locally
npm test         # full vitest suite, including this package's own policy self-enforcement
```

**Every component change updates the gallery (`src/docs/Gallery.tsx`) in the same commit.** The
gallery is the canonical catalogue — there is no separate docs source to fall out of sync.

## Adoption order

1. **finance.satrio.io** — adopted. The design system's origin (its `tokens.css` began as a copy of
   satrio.io's), so re-pointing it at this package was close to a file move; its existing scan
   tests kept the migration honest.
2. **satrio.io** (the portfolio site) — adopted. It keeps its cool palette and iOS-blue dark mode
   via its own `brand.css` rather than unifying on finance's warm palette; see
   [`docs/brand-layer.md`](./docs/brand-layer.md) for how a per-theme override interacts with the
   a11y collapse tail.
3. New sites start straight at `npm install` + a thin shell.

Both consumer adoptions fed fixes back upstream, which is the intended direction: a problem found in
one app becomes a guard every app inherits.
