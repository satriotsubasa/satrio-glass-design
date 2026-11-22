// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/styles/global.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

describe('global.css resets', () => {
  // Browsers give form controls their own font family (Arial in Chrome on Windows), so every
  // button or input whose class named no family rendered in a second typeface.
  it('form controls inherit the font family, at zero specificity so any class still wins', () => {
    expect(css).toMatch(/:where\(button, input, select, textarea\)\s*\{\s*font-family:\s*inherit;?\s*\}/)
  })

  // `.icon-shape` was rounded only for the non-default shapes, so a tile that relied on it for
  // its corners rendered square under the default shape.
  it('icon tiles are rounded by default, at zero specificity so a tile with its own radius keeps it', () => {
    expect(css).toMatch(/:where\(\.icon-shape\)\s*\{\s*border-radius:\s*26%;?\s*\}/)
  })
})
