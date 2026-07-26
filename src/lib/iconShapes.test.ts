// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ICON_SHAPE_CLASSES,
  ICON_SHAPE_CLIP_PATHS,
  ICON_SHAPE_OPTIONS,
  LOBED_ICON_SHAPES,
} from './iconShapes'

/** Contract guard for the lib/iconShapes DATA — the piece neither sibling suite pins. IconShapeDefs'
 *  test only checks the clipPaths mount, and iconShape.test.ts only checks global.css carries the
 *  `.icon-shape--*` selectors. Neither pins the option ORDER the Appearance picker renders, the
 *  class-map VALUES the swatches and /gallery previews resolve against those selectors, nor the
 *  clip-path coordinate RANGES — yet a single out-of-unit-box coordinate mis-clips every lobed
 *  icon app-wide with both of those suites still green. */
describe('iconShapes contract', () => {
  it('exposes the six shape options in picker order', () => {
    expect(ICON_SHAPE_OPTIONS.map((option) => option.value)).toEqual([
      'circle',
      'rounded-square',
      'pebble',
      'clover',
      'blossom',
      'flower',
    ])
    for (const option of ICON_SHAPE_OPTIONS) {
      expect(option.label).toBeTruthy()
    }
  })

  it('resolves a per-shape preview class for every option', () => {
    for (const option of ICON_SHAPE_OPTIONS) {
      expect(ICON_SHAPE_CLASSES[option.value]).toBe(`icon-shape--${option.value}`)
    }
  })

  it('defines a global.css rule for every preview class the map resolves', () => {
    // The class map is only a contract if the stylesheet consumers load actually styles each value —
    // a typo on EITHER side (map or CSS) leaves a preview square with no shaping class.
    const globalCss = readFileSync(new URL('../styles/global.css', import.meta.url), 'utf8')
    for (const option of ICON_SHAPE_OPTIONS) {
      expect(globalCss, `global.css rule for ${option.value}`).toContain(
        `.${ICON_SHAPE_CLASSES[option.value]}`,
      )
    }
  })

  it('defines an objectBoundingBox clip path (id + path data) for each lobed shape', () => {
    expect(LOBED_ICON_SHAPES).toEqual(['clover', 'blossom', 'flower'])
    for (const shape of LOBED_ICON_SHAPES) {
      const clip = ICON_SHAPE_CLIP_PATHS[shape]
      expect(clip.id).toBe(`icon-shape-${shape}`)
      expect(clip.path.startsWith('M ')).toBe(true)
      expect(clip.path.trimEnd().endsWith('Z')).toBe(true)
      // objectBoundingBox space: every coordinate stays in (or a hair outside) the unit box.
      const coords = clip.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
      expect(coords.length).toBeGreaterThan(20)
      for (const value of coords) {
        expect(value).toBeGreaterThanOrEqual(-0.05)
        expect(value).toBeLessThanOrEqual(1.05)
      }
    }
  })
})
