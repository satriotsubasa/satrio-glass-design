# @satrio/glass-design

satrio glass — the shared design language for Satrio Tsubasa's apps: tokens, materials, motion,
components, and the policy tests that enforce them across every consumer.

## What this is

One design system consumed by every app instead of forked per-app. It ships CSS custom-property
tokens (type ramp, spacing, a four-tier blur ladder, purpose-split easings/durations), the
materials and motion built on top of them (`.glass`/`.glass-strong`/`.panel-material`, theme
cross-fade, icon-shape clips), ~30 generic UI components (buttons, fields, sheets, chips, lists,
settings furniture, toast), a small set of decoupled providers (motion config, icon weight, error
boundary), and — the part that actually keeps apps from drifting apart again — a runnable policy
test suite (`@satrio/glass-design/testing`) that each consumer wires into its own vitest run to
enforce the same rules the package enforces on itself. The gallery in this repo (`src/docs`) is
both the visual QA surface and this package's docs, deployed at `design.satrio.io`.

## Install

No npm registry — installed as a git dependency, pinned to a tag:

```
npm i github:satriotsubasa/satrio-glass-design#v1.0.0
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
```

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

## Brand layer

Palette, accents, surface tints, corner radii, and material thickness are re-skinned per app via a
small `brand.css` against a fixed token allowlist — without forking `tokens.css`. Read
[`docs/brand-layer.md`](./docs/brand-layer.md) before writing one: it covers the allowlist, the
import-order mechanism, and the a11y "collapse-tail" rule that `runBrandPolicy` enforces. A
copy-ready starting point ships at `@satrio/glass-design/styles/brand-template.css`.

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

1. **finance.satrio.io** first — the design system's origin (its `tokens.css` began as a copy of
   satrio.io's), so re-pointing it at this package is close to a file move; its existing scan
   tests keep the migration honest.
2. **satrio.io** (the portfolio site) next — it keeps its cool palette and iOS-blue dark mode via
   its own `brand.css` rather than unifying on finance's warm palette; see
   [`docs/brand-layer.md`](./docs/brand-layer.md) for how a per-theme override interacts with the
   a11y collapse tail.
3. New sites start straight at `npm install` + a thin shell.
