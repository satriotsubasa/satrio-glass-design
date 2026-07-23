// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { definedTokens, findUndefinedTokenUsages, type ScannedFile } from './tokenUsagePolicy'

// The package's own token-existence guard (styles/tokens.test.ts) scans EVERY src file — including
// this one. To exercise findUndefinedTokenUsages against a token that exists nowhere, the fixtures
// below build their `var(--…)` usages through `cssVar()` rather than as raw literals, so this file
// never itself carries a literal `var(--<undefined-structural-token>)` for that guard to (correctly)
// flag. The finder sees the assembled value, exactly as it would in a real consumer file.
const cssVar = (name: string): string => `var(${name})`

// ---- fixtures (token DEFINITIONS are safe as literals: the guard only scans var() USAGES) ----

/** A token source (kit-style tokens.css slice). */
const tokensSource = `
:root {
  --fs-body: calc(15px * var(--app-font-scale));
  --lh-body: 1.46;
  --space-2: calc(8px * var(--app-font-scale));
  --blur-card: 24px;
}
`

/** A second source (a consumer brand.css) that adds one more token. */
const brandSource = `
:root {
  --dur-press: 140ms;
}
`

describe('definedTokens', () => {
  it('extracts every fs/lh/space/dur/blur DEFINITION (property position only)', () => {
    expect([...definedTokens([tokensSource])].sort()).toEqual(
      ['--blur-card', '--fs-body', '--lh-body', '--space-2'].sort(),
    )
  })

  it('unions definitions across multiple sources (tokens.css + brand.css)', () => {
    expect(definedTokens([tokensSource, brandSource]).has('--dur-press')).toBe(true)
  })

  it('does not treat a var() usage as a definition (the colon lookahead)', () => {
    expect(definedTokens([`.x { font-size: ${cssVar('--fs-body')}; }`]).size).toBe(0)
  })
})

describe('findUndefinedTokenUsages', () => {
  const defined = definedTokens([tokensSource, brandSource])

  it('passes a consumer that only uses defined tokens', () => {
    const consumers: ScannedFile[] = [
      { path: 'src/a.module.css', content: `.a { font-size: ${cssVar('--fs-body')}; gap: ${cssVar('--space-2')}; }` },
    ]
    expect(findUndefinedTokenUsages(defined, consumers)).toEqual([])
  })

  it('reports a var() consuming a token defined in NO source', () => {
    const consumers: ScannedFile[] = [
      { path: 'src/b.module.css', content: `.b { font-size: ${cssVar('--fs-title-2')}; }` },
    ]
    expect(findUndefinedTokenUsages(defined, consumers)).toEqual([
      { path: 'src/b.module.css', token: '--fs-title-2' },
    ])
  })

  it('catches an inline var(--blur-*) consumed in TSX, not just CSS', () => {
    const consumers: ScannedFile[] = [
      { path: 'src/Toaster.tsx', content: `const s = { backdropFilter: 'blur(${cssVar('--blur-nope')})' }` },
    ]
    expect(findUndefinedTokenUsages(defined, consumers)).toEqual([
      { path: 'src/Toaster.tsx', token: '--blur-nope' },
    ])
  })

  it('accepts a token that only the brand source defines (definition union works end to end)', () => {
    const consumers: ScannedFile[] = [
      { path: 'src/c.module.css', content: `.c { transition-duration: ${cssVar('--dur-press')}; }` },
    ]
    expect(findUndefinedTokenUsages(defined, consumers)).toEqual([])
  })
})
