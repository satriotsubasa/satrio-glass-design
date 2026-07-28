// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BACKDROP_PRESET_OPTIONS, BACKDROP_PRESETS_WITH_RULES } from './backdrops'

/** Contract guard for the lib/backdrops DATA — the picker options and the "which presets ship a
 *  rule" list. The CSS-side structural guarantees (the one-unit import/export, the legibility
 *  layer, the a11y stand-downs) live in styles/appearanceConsumers.test.ts; this file only pins
 *  the TypeScript contract an app's Appearance picker consumes. */
describe('backdrops contract', () => {
  it('exposes the four presets in picker order', () => {
    expect(BACKDROP_PRESET_OPTIONS.map((option) => option.value)).toEqual([
      'minimal',
      'mesh',
      'aurora',
      'wallpaper',
    ])
    for (const option of BACKDROP_PRESET_OPTIONS) {
      expect(option.label).toBeTruthy()
    }
  })

  it("keeps 'minimal' the only rule-free preset", () => {
    expect(BACKDROP_PRESETS_WITH_RULES).toEqual(
      BACKDROP_PRESET_OPTIONS.map((option) => option.value).filter((value) => value !== 'minimal'),
    )
  })

  it('defines a backdrops.css rule for every preset that claims one', () => {
    // The iconShapes.test.ts idiom: the TS list is only a contract if the shipped stylesheet
    // actually styles each value it claims.
    const backdropsCss = readFileSync(new URL('../styles/backdrops.css', import.meta.url), 'utf8')
    for (const preset of BACKDROP_PRESETS_WITH_RULES) {
      expect(backdropsCss, `backdrops.css must style data-backdrop='${preset}'`).toContain(
        `:root[data-backdrop='${preset}']`,
      )
    }
  })
})
