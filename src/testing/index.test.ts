// @vitest-environment node
import { existsSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as testing from './index'

/**
 * The testing barrel's public API, asserted literally — mirrors src/index.test.ts's guard on the
 * root barrel. Without this, a tidy-up of src/testing/index.ts can drop an export (TOKENS_CSS_PATH,
 * notably) while the full suite and tsc both stay green: nothing else in this repo imports through
 * the barrel, so the failure would land only in a consumer's
 * `import { runTokenUsagePolicy, TOKENS_CSS_PATH } from '@satrio/glass-design/testing'`.
 */
const VALUE_EXPORTS = [
  'TOKENS_CSS_PATH',
  'BRAND_TOKENS',
  'parseDeclaredTokens',
  'runBrandPolicy',
  'runPressStatePolicy',
  'runTokenUsagePolicy',
  'runInputZoomPolicy',
] as const

describe('testing barrel export contract', () => {
  it.each(VALUE_EXPORTS)('exports %s', (name) => {
    expect(
      (testing as Record<string, unknown>)[name],
      `@satrio/glass-design/testing must export "${name}"`,
    ).toBeDefined()
  })

  it('publishes TOKENS_CSS_PATH as an absolute, readable path to the package\'s own tokens.css', () => {
    expect(isAbsolute(testing.TOKENS_CSS_PATH)).toBe(true)
    expect(existsSync(testing.TOKENS_CSS_PATH)).toBe(true)
  })
})
