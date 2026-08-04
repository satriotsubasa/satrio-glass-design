import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ListRow } from './ListRow'
import styles from './ListRow.module.css'

// NOT `new URL(<string literal>, import.meta.url)` — Vite statically rewrites that pattern into a
// `self.location`-based http URL under jsdom. Raw `import.meta.url` stays a file:// URL
// (same convention as ProgressBar.test.tsx).
const moduleCss = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'ListRow.module.css'), 'utf8')

function ruleOf(css: string, selector: string): string {
  const start = css.indexOf(`\n${selector} {`)
  expect(start, `${selector} rule must exist`).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('}', start))
}

describe('ListRow', () => {
  describe('titleWrap', () => {
    it("defaults to 'truncate' — the title element's className is EXACTLY what v1.2.0 produced, byte-identical, not just still containing .title", () => {
      // This is the invisibility proof for this commit: a consumer that never passes titleWrap must
      // get the identical className string ListRow emitted before this prop existed. Asserting
      // `.toBe(styles.title)` (not `.toHaveClass`) is what catches a regression where a modifier
      // class gets appended on the default path even though `.title` is still present — `toHaveClass`
      // would pass right through that bug, `.toBe` cannot.
      render(<ListRow title="Groceries at the corner store on Elm Street" />)
      const title = screen.getByText('Groceries at the corner store on Elm Street')
      expect(title.className).toBe(styles.title)
    })

    it("the base .title rule still carries the single-line ellipsis declarations (white-space: nowrap + text-overflow: ellipsis) — unmodified by this commit", () => {
      const rule = ruleOf(moduleCss, '.title')
      expect(rule).toContain('white-space: nowrap')
      expect(rule).toContain('text-overflow: ellipsis')
      expect(rule).toContain('overflow: hidden')
    })

    it("titleWrap='clamp2' adds a modifier class alongside .title, rather than replacing it", () => {
      render(<ListRow title="Groceries at the corner store on Elm Street" titleWrap="clamp2" />)
      const title = screen.getByText('Groceries at the corner store on Elm Street')
      expect(title).toHaveClass(styles.title)
      expect(title).toHaveClass(styles.clamp2)
      // And it must NOT be the exact default string — the modifier really did get appended.
      expect(title.className).not.toBe(styles.title)
    })

    it('the clamp2 rule carries all five two-line-clamp declarations', () => {
      const rule = ruleOf(moduleCss, '.clamp2')
      expect(rule).toContain('display: -webkit-box')
      expect(rule).toContain('-webkit-line-clamp: 2')
      expect(rule).toContain('-webkit-box-orient: vertical')
      expect(rule).toContain('overflow: hidden')
      expect(rule).toContain('white-space: normal')
    })
  })
})
