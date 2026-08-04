import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from './EmptyState'
import styles from './EmptyState.module.css'

// NOT `new URL(<string literal>, import.meta.url)` — Vite statically rewrites that pattern into a
// `self.location`-based http URL under jsdom. Raw `import.meta.url` stays a file:// URL (same
// convention as ListRow.test.tsx).
const moduleCss = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'EmptyState.module.css'), 'utf8')

function ruleOf(css: string, selector: string): string {
  // EmptyState.module.css opens with `.empty { … }` on line 1 (no leading newline), unlike
  // ListRow.module.css's rules — so match either start-of-string or a preceding newline.
  const escaped = selector.replace(/[.[\]]/g, '\\$&')
  const match = css.match(new RegExp(`(?:^|\\n)(${escaped} \\{)`))
  expect(match, `${selector} rule must exist`).not.toBeNull()
  const start = match!.index! + match![0].indexOf(match![1])
  return css.slice(start, css.indexOf('}', start))
}

describe('EmptyState', () => {
  it('renders the title and, when given, the optional description/action', () => {
    render(<EmptyState title="No transactions yet" description="Add your first one" action={<button>Add</button>} />)
    expect(screen.getByText('No transactions yet')).toBeInTheDocument()
    expect(screen.getByText('Add your first one')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  describe('size', () => {
    it("defaults to 'md' — the root element's className is EXACTLY what v1.2.0 produced, byte-identical, not just still containing .empty", () => {
      // Byte-identical to v1.2.0 is the standing constraint: a consumer that never passes `size` must
      // get the identical className string EmptyState emitted before this prop existed. `.toBe(styles.empty)`
      // (not `.toHaveClass`) is what catches a regression where a modifier class gets appended on
      // the default path even though `.empty` is still present.
      const { container } = render(<EmptyState title="No transactions yet" />)
      const root = container.firstElementChild as HTMLElement
      expect(root.className).toBe(styles.empty)
    })

    it('the base .empty rule must keep the original padding — the default size stays byte-identical to v1.2.0', () => {
      const rule = ruleOf(moduleCss, '.empty')
      expect(rule).toContain('padding: var(--space-4) var(--space-2)')
    })

    it('the base .title rule must keep sizing at --fs-headline — the default size stays byte-identical to v1.2.0', () => {
      const rule = ruleOf(moduleCss, '.title')
      expect(rule).toContain('font-size: var(--fs-headline)')
    })

    it('the base .desc rule must keep sizing at --fs-callout — the default size stays byte-identical to v1.2.0', () => {
      const rule = ruleOf(moduleCss, '.desc')
      expect(rule).toContain('font-size: var(--fs-callout)')
    })

    it("size='sm' adds a modifier class to the root alongside .empty, rather than replacing it", () => {
      const { container } = render(<EmptyState title="No transactions yet" size="sm" />)
      const root = container.firstElementChild as HTMLElement
      expect(root).toHaveClass(styles.empty)
      expect(root).toHaveClass(styles.sm)
      // And it must NOT be the exact default string — the modifier really did get appended.
      expect(root.className).not.toBe(styles.empty)
    })

    it('the sm modifier applies the specified overrides: padding, title size paired with its leading, description size', () => {
      const padding = ruleOf(moduleCss, '.sm')
      expect(padding).toContain('padding: var(--space-2)')

      // A size step on a wrapping element must pair its own leading (tokens.css documents this bug
      // class as why the leading ramp is unitless) — otherwise a smaller font renders inside the
      // taller line box its old, bigger size left behind.
      const title = ruleOf(moduleCss, '.sm .title')
      expect(title).toContain('font-size: var(--fs-body)')
      expect(title).toContain('line-height: var(--lh-body)')

      const desc = ruleOf(moduleCss, '.sm .desc')
      expect(desc).toContain('font-size: var(--fs-caption)')
    })
  })
})
