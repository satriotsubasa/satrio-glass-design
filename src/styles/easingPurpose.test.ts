// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** The purpose-split easing contract, enforced on the kit's own CSS.
 *
 *  tokens.css defines one curve per JOB — `--ease-glass` for enter/exit, `--ease-move` for
 *  on-screen movement, `--ease-hover` for hover and colour. A split that is documented but not
 *  applied is worse than no split: it reads as intentional while every surface actually shares one
 *  curve. These scans pin the two halves that are mechanically checkable.
 *
 *  COLOUR properties (background, colour, border, shadow, filter) are a state change, not an
 *  entrance — they belong on `--ease-hover` at `--dur-hover`. `transform` is deliberately NOT in
 *  the list: press feedback is a scale on `--ease-glass` at `--dur-press`, which is correct and
 *  pinned by pressStates.test.ts. */

const COMPONENTS = fileURLToPath(new URL('../components/', import.meta.url))

/** Every shipped `*.module.css` under src/components, as { path, css } with comments stripped —
 *  prose may legitimately name a banned pairing to explain why it is banned. */
function moduleStyles(): { path: string; css: string }[] {
  const out: { path: string; css: string }[] = []
  for (const entry of readdirSync(COMPONENTS, { withFileTypes: true, recursive: true })) {
    if (!entry.name.endsWith('.module.css')) continue
    const full = join(entry.parentPath, entry.name)
    out.push({
      path: full.slice(full.indexOf('components')).replace(/\\/g, '/'),
      css: readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''),
    })
  }
  return out
}

/** `<prop> var(--dur-*) var(--ease-*)` occurrences whose property is colour-ish but whose curve is
 *  not the hover curve. The leading boundary keeps `border-color` from matching as `color`. */
function findMisCurvedColour(files: { path: string; css: string }[]): string[] {
  const COLOUR = /(?<![-\w])(background|border-color|box-shadow|filter|color) var\(--dur-([a-z]+)\) var\(--ease-([a-z]+)\)/g
  const out: string[] = []
  for (const { path, css } of files) {
    for (const m of css.matchAll(COLOUR)) {
      if (m[3] !== 'hover') out.push(`${path}: ${m[1]} on --ease-${m[3]} (expected --ease-hover)`)
    }
  }
  return out
}

describe('purpose-split easing contract', () => {
  const files = moduleStyles()

  it('scans a plausible corpus (a renamed directory must not pass vacuously)', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('transitions every colour property on the hover curve, never the enter/exit curve', () => {
    const wrong = findMisCurvedColour(files)
    expect(
      wrong,
      `colour is a state change, not an entrance — move these to var(--dur-hover) var(--ease-hover):\n${wrong.join('\n')}`,
    ).toEqual([])
  })

  it('keeps press feedback on the enter/exit curve at the press duration', () => {
    // The converse guard: a well-meaning sweep that moved `transform` onto the hover curve too
    // would make every press mushy. Press is a scale, and it stays where it is.
    const moved = files
      .filter(({ css }) => /transform var\(--dur-hover\)/.test(css))
      .map(({ path }) => path)
    expect(moved, 'press feedback must stay on var(--dur-press) var(--ease-glass)').toEqual([])
  })
})
