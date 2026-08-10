// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  countFlooredFontSizes,
  findFloorlessFiles,
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

/** A sub-16px font-size with no trailing semicolon — it is the LAST declaration in its rule, which
 *  is valid CSS (`.x { font-size: 14px }`), but has no terminating `;` before the closing `}`. */
const unterminatedRawInput: ScannedFile = {
  path: 'src/Unterminated.module.css',
  content: '.x { color: red; font-size: 14px }',
}

/** The floor idiom with no trailing semicolon — same unterminated-declaration shape, but already
 *  compliant, so it must still count/pass. */
const unterminatedFlooredInput: ScannedFile = {
  path: 'src/UnterminatedFloor.module.css',
  content: '.x { font-size: max(16px, var(--fs-body)) }',
}

/** A commented-out (or annotating) font-size in the LAST rule of a file — the `[;}]` terminator can
 *  otherwise scan straight into the comment body and stop at the rule's real closing `}`,
 *  misreading the comment text itself as the declared value. */
const commentedOutInput: ScannedFile = {
  path: 'src/Commented.module.css',
  content: '.a {\n  color: red;\n  /* font-size: 12px was here, now floored */\n}',
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

  it('flags a sub-16px font-size with no trailing semicolon (last declaration in its rule)', () => {
    expect(findUnflooredFontSizes([unterminatedRawInput])).toEqual([
      { path: 'src/Unterminated.module.css', value: '14px' },
    ])
  })

  it('ignores a commented-out font-size in the last rule of a file (comments are stripped before the widened terminator can scan into one)', () => {
    expect(findUnflooredFontSizes([commentedOutInput])).toEqual([])
  })
})

describe('countFlooredFontSizes', () => {
  it('counts the floor idiom, whitespace variants included', () => {
    expect(countFlooredFontSizes([flooredInput])).toBe(2)
  })

  it('counts a floor idiom with no trailing semicolon (last declaration in its rule)', () => {
    expect(countFlooredFontSizes([unterminatedFlooredInput])).toBe(1)
  })
})

describe('findFloorlessFiles', () => {
  it('returns [] when every file carries its own floor', () => {
    // flooredInput has two floors; rawInput has one — both are covered per-file.
    expect(findFloorlessFiles([flooredInput, rawInput])).toEqual([])
  })

  it('names a file that has font-sizes but no floor, even beside a floored sibling', () => {
    const floorless: ScannedFile = { path: 'src/x.module.css', content: '.x { font-size: var(--fs-body); }' }
    expect(findFloorlessFiles([flooredInput, floorless])).toEqual(['src/x.module.css'])
  })

  it('names a file whose only floor was deleted (the per-file hole the set-wide count misses)', () => {
    const deleted: ScannedFile = { path: 'src/control.module.css', content: '.control { color: red; }' }
    // countFlooredFontSizes stays > 0 across the pair (rawInput still floors), yet control lost its floor.
    expect(countFlooredFontSizes([deleted, rawInput])).toBeGreaterThan(0)
    expect(findFloorlessFiles([deleted, rawInput])).toEqual(['src/control.module.css'])
  })

  it('names a file whose only font-size is an unterminated raw value (no floor, no semicolon) — characterization only: a file with no floor is reported floorless under any terminator pattern, so this alone does not exercise the terminator regex', () => {
    expect(findFloorlessFiles([unterminatedRawInput])).toEqual(['src/Unterminated.module.css'])
  })

  it('does NOT name a file whose only font-size is an unterminated FLOOR as floorless — the discriminating case: a terminator requiring a trailing ";" misses this floor entirely and would wrongly report the file floorless; a terminator that also accepts a bare "}" finds and counts it', () => {
    expect(findFloorlessFiles([unterminatedFlooredInput])).toEqual([])
  })
})

describe('findStaleAllowlist', () => {
  it('reports an allowlist entry whose site no longer exists', () => {
    expect(findStaleAllowlist([rawInput], ['src/Login.module.css: 99px'])).toEqual(['src/Login.module.css: 99px'])
  })

  it('keeps a live allowlist entry', () => {
    expect(findStaleAllowlist([rawInput], ['src/Login.module.css: 12px'])).toEqual([])
  })

  it('keeps a live allowlist entry whose site has no trailing semicolon', () => {
    expect(findStaleAllowlist([unterminatedRawInput], ['src/Unterminated.module.css: 14px'])).toEqual([])
  })
})
