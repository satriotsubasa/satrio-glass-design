import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('renders the title as an h1 — the page title, distinct from SectionHeader\'s h2', () => {
    render(<PageHeader title="Overview" />)
    const heading = screen.getByText('Overview')
    expect(heading.tagName).toBe('H1')
  })

  it('renders the optional eyebrow and subheading when given, and omits them when absent', () => {
    const { rerender } = render(<PageHeader eyebrow="This Month" title="Overview" subheading="A live PageHeader" />)
    expect(screen.getByText('This Month')).toBeInTheDocument()
    expect(screen.getByText('A live PageHeader')).toBeInTheDocument()

    rerender(<PageHeader title="Overview" />)
    expect(screen.queryByText('This Month')).not.toBeInTheDocument()
    expect(screen.queryByText('A live PageHeader')).not.toBeInTheDocument()
  })

  it('renders the optional action slot when given, and omits it when absent', () => {
    const { rerender } = render(<PageHeader title="Overview" action={<button>See all</button>} />)
    expect(screen.getByRole('button', { name: 'See all' })).toBeInTheDocument()

    rerender(<PageHeader title="Overview" />)
    expect(screen.queryByRole('button', { name: 'See all' })).not.toBeInTheDocument()
  })

  it('merges a consumer className onto the root instead of replacing the component\'s own class', () => {
    const { container } = render(<PageHeader title="Overview" className="consumer-class" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.classList.contains('consumer-class')).toBe(true)
    // The component's own root class must still be present — a real CSS module hash, not empty.
    const ownClasses = Array.from(root.classList).filter((c) => c !== 'consumer-class')
    expect(ownClasses.length).toBeGreaterThan(0)
  })

  it('renders with no className passed at all (default path stays untouched)', () => {
    const { container } = render(<PageHeader title="Overview" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.classList.length).toBeGreaterThan(0)
  })

  it('uses all three large-title tokens on its h1 — size, leading, and tracking (design-intent pin: PageHeader is --fs-large-title\'s first component consumer)', () => {
    const css = readFileSync('src/components/ui/PageHeader.module.css', 'utf8')
    expect(css).toContain('var(--fs-large-title)')
    expect(css).toContain('var(--lh-large-title)')
    expect(css).toContain('var(--tracking-large-title)')
  })
})
