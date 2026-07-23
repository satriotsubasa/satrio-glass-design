// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  countPressSubjects,
  findUngatedHovers,
  findUnpairedHovers,
  hoverSelectors,
  pressSubjects,
  type ScannedFile,
} from './pressStatePolicy'

// ---- fixtures (in-memory module CSS the parser + checks run against) ----

/** A gated hover paired with an :active press — the clean shape. */
const cleanButton: ScannedFile = {
  path: 'fixtures/Button.module.css',
  content: `
    .btn { transition: transform var(--dur-press) var(--ease-glass); }
    .btn:active { transform: scale(0.97); }
    @media (hover: hover) { .btn:hover { filter: brightness(1.05); } }
  `,
}

/** A hover that escapes the @media (hover: hover) gate. */
const ungatedHover: ScannedFile = {
  path: 'fixtures/Clear.module.css',
  content: `
    .clear { border-radius: 999px; }
    .clear:active { transform: scale(0.97); }
    .clear:hover { background: rgba(0,0,0,0.08); }
  `,
}

/** A modifier class (.ghost) that hovers but has no :active of its own — its base (.btn) does. */
const composedModifier: ScannedFile = {
  path: 'fixtures/Ghost.module.css',
  content: `
    .btn { color: var(--label); }
    .btn:active { transform: scale(0.97); }
    @media (hover: hover) { .ghost:hover { background: rgba(0,0,0,0.08); } }
  `,
}

describe('hoverSelectors (brace-stack gating parser)', () => {
  it('marks a hover inside @media (hover: hover) as gated', () => {
    expect(hoverSelectors(cleanButton.content)).toEqual([{ selector: '.btn:hover', gated: true }])
  })

  it('marks a top-level hover as ungated', () => {
    expect(hoverSelectors(ungatedHover.content)).toEqual([{ selector: '.clear:hover', gated: false }])
  })

  it('ignores :hover text inside comments', () => {
    expect(hoverSelectors('/* .ghost:hover was here */ .btn { color: red; }')).toEqual([])
  })
})

describe('findUngatedHovers', () => {
  it('reports only the ungated hover', () => {
    expect(findUngatedHovers([cleanButton, ungatedHover])).toEqual([
      { path: 'fixtures/Clear.module.css', selector: '.clear:hover' },
    ])
  })
})

describe('findUnpairedHovers (composedModifiers option handling)', () => {
  it('passes a hover whose own class declares :active', () => {
    expect(findUnpairedHovers([cleanButton])).toEqual([])
  })

  it('flags a modifier hover as unpaired WITHOUT a composedModifiers mapping', () => {
    expect(findUnpairedHovers([composedModifier])).toEqual([
      { path: 'fixtures/Ghost.module.css', selector: '.ghost:hover', base: 'ghost' },
    ])
  })

  it('passes the modifier hover once mapped to its base class', () => {
    expect(
      findUnpairedHovers([composedModifier], { 'fixtures/Ghost.module.css': { ghost: 'btn' } }),
    ).toEqual([])
  })

  it('scopes the mapping by file path — a mapping for another file does not apply', () => {
    expect(
      findUnpairedHovers([composedModifier], { 'fixtures/Other.module.css': { ghost: 'btn' } }),
    ).toEqual([{ path: 'fixtures/Ghost.module.css', selector: '.ghost:hover', base: 'ghost' }])
  })
})

describe('countPressSubjects', () => {
  it('sums subjects across the corpus, exempting bare-element hovers', () => {
    const bareElement: ScannedFile = { path: 'fixtures/Link.module.css', content: '.helpText a:hover { color: red; }' }
    expect(countPressSubjects([cleanButton, composedModifier, bareElement])).toBe(2)
  })
})

describe('pressSubjects parser contract (unit)', () => {
  it('classifies every comma part and exempts bare/descendant element hovers', () => {
    expect(pressSubjects('.card:hover, .helpText a:hover, .card:focus-visible')).toEqual(['card'])
    expect(pressSubjects('a:hover')).toEqual([])
  })
})
