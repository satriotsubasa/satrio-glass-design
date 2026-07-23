// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { describe, it, expect } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('./global.css', import.meta.url)), 'utf8')

/** The `icon-shape` system in global.css: `<html data-icon-shape>` (set by `applyIconShape`)
 *  reshapes every opted-in `.icon-shape` container; `.icon-shape--*` are the standalone
 *  per-shape classes the Appearance picker + /gallery use to render a specific shape. */
describe('global.css icon-shape system', () => {
  it('reshapes .icon-shape containers from the root data-icon-shape attribute', () => {
    for (const shape of ['circle', 'pebble', 'clover', 'blossom', 'flower']) {
      expect(css, `missing root-driven rule for ${shape}`).toContain(
        `:root[data-icon-shape='${shape}'] .icon-shape`,
      )
    }
  })

  it('keeps the default look for rounded-square (no root-driven override)', () => {
    expect(css).not.toContain(":root[data-icon-shape='rounded-square']")
  })

  it('clips the lobed shapes via the IconShapeDefs clipPaths', () => {
    for (const shape of ['clover', 'blossom', 'flower']) {
      expect(css).toContain(`clip-path: url(#icon-shape-${shape})`)
    }
  })

  it('defines a standalone per-shape class for all six options (picker previews)', () => {
    for (const shape of ['circle', 'rounded-square', 'pebble', 'clover', 'blossom', 'flower']) {
      expect(css, `missing .icon-shape--${shape}`).toContain(`.icon-shape--${shape}`)
    }
  })
})
