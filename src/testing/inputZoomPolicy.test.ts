// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  countFlooredFontSizes,
  findStaleAllowlist,
  findUnflooredFontSizes,
  type ScannedFile,
} from './inputZoomPolicy'

// ---- fixtures ----

/** The sanctioned floor idiom, plus whitespace and token-name variations. */
const flooredInput: ScannedFile = {
  path: 'src/control.module.css',
  content: `
    .control { font-size: max(16px, var(--fs-body)); }
    .search { font-size: max( 16px , var(--fs-caption) ); }
  `,
}

/** A raw sub-16px font-size (the iOS zoom offender) alongside a floored one. */
const rawInput: ScannedFile = {
  path: 'src/Login.module.css',
  content: `
    .field { font-size: max(16px, var(--fs-body)); }
    .hint { font-size: 12px; }
  `,
}

describe('findUnflooredFontSizes', () => {
  it('passes a file whose every font-size is the max(16px, var(--fs-*)) floor', () => {
    expect(findUnflooredFontSizes([flooredInput])).toEqual([])
  })

  it('flags a bare sub-16px font-size', () => {
    expect(findUnflooredFontSizes([rawInput])).toEqual([{ path: 'src/Login.module.css', value: '12px' }])
  })

  it('rejects a plain var(--fs-*) with no 16px floor (that opts out of the zoom guard)', () => {
    const noFloor: ScannedFile = { path: 'src/x.module.css', content: '.x { font-size: var(--fs-body); }' }
    expect(findUnflooredFontSizes([noFloor])).toEqual([{ path: 'src/x.module.css', value: 'var(--fs-body)' }])
  })

  it('honours a documented rawInputAllowlist exception (option handling)', () => {
    expect(findUnflooredFontSizes([rawInput], ['src/Login.module.css: 12px'])).toEqual([])
  })

  it('scopes the allowlist key by path — an entry for another file does not apply', () => {
    expect(findUnflooredFontSizes([rawInput], ['src/Other.module.css: 12px'])).toEqual([
      { path: 'src/Login.module.css', value: '12px' },
    ])
  })
})

describe('countFlooredFontSizes', () => {
  it('counts the floor idiom, whitespace variants included', () => {
    expect(countFlooredFontSizes([flooredInput])).toBe(2)
  })
})

describe('findStaleAllowlist', () => {
  it('reports an allowlist entry whose site no longer exists', () => {
    expect(findStaleAllowlist([rawInput], ['src/Login.module.css: 99px'])).toEqual(['src/Login.module.css: 99px'])
  })

  it('keeps a live allowlist entry', () => {
    expect(findStaleAllowlist([rawInput], ['src/Login.module.css: 12px'])).toEqual([])
  })
})
