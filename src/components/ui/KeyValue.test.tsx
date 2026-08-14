import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KeyValue } from './KeyValue'

describe('KeyValue', () => {
  it('renders the label and value', () => {
    render(<KeyValue label="Status" value="Active" />)
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders the optional detail line when given, and omits it when absent', () => {
    const { rerender } = render(<KeyValue label="Dose" value="2 of 3" detail="Next due Sep 12" />)
    expect(screen.getByText('Next due Sep 12')).toBeInTheDocument()

    rerender(<KeyValue label="Dose" value="2 of 3" />)
    expect(screen.queryByText('Next due Sep 12')).not.toBeInTheDocument()
  })

  it('accepts ReactNode for value and detail, not just strings', () => {
    render(<KeyValue label="Plan" value={<strong>Premium</strong>} detail={<em>renews monthly</em>} />)
    expect(screen.getByText('Premium').tagName).toBe('STRONG')
    expect(screen.getByText('renews monthly').tagName).toBe('EM')
  })

  it('merges a consumer className onto the root instead of replacing the component\'s own class', () => {
    const { container } = render(<KeyValue label="Status" value="Active" className="consumer-class" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.classList.contains('consumer-class')).toBe(true)
    // The component's own root class must still be present — a real CSS module hash, not empty.
    const ownClasses = Array.from(root.classList).filter((c) => c !== 'consumer-class')
    expect(ownClasses.length).toBeGreaterThan(0)
  })

  it('renders with no className passed at all (default path stays untouched)', () => {
    const { container } = render(<KeyValue label="Status" value="Active" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.classList.length).toBeGreaterThan(0)
  })

  describe('inset', () => {
    it('adds NO class by default — a consumer that never passes it renders byte-identically to v1.3.0', () => {
      // The invisibility contract: the default path must emit the SAME className string it
      // emitted before the prop existed, not an equivalent one. `toBe` against the module class
      // is what catches an appended modifier; toHaveClass would sail straight through.
      const { container: bare } = render(<KeyValue label="Status" value="Active" />)
      const { container: explicit } = render(<KeyValue label="Status" value="Active" inset={false} />)
      const bareRoot = bare.firstElementChild as HTMLElement
      const explicitRoot = explicit.firstElementChild as HTMLElement
      expect(explicitRoot.className).toBe(bareRoot.className)
      expect(bareRoot.classList.length).toBe(1)
    })

    it('adds exactly one modifier class when true, keeping the base class', () => {
      const { container: bare } = render(<KeyValue label="Status" value="Active" />)
      const { container: inset } = render(<KeyValue label="Status" value="Active" inset />)
      const bareRoot = bare.firstElementChild as HTMLElement
      const insetRoot = inset.firstElementChild as HTMLElement
      expect(insetRoot.classList.length).toBe(2)
      expect(insetRoot.classList).toContain(bareRoot.classList[0])
    })

    it('carries StatCard’s inset, from the same token — so a mixed grid row keeps its left edge', () => {
      const css = readFileSync('src/components/ui/KeyValue.module.css', 'utf8')
      const statCard = readFileSync('src/components/ui/StatCard.module.css', 'utf8')
      const insetPadding = css.match(/\.inset\s*\{[^}]*padding:\s*(var\(--space-\d\))/)?.[1]
      const cardPadding = statCard.match(/\.card\s*\{[^}]*padding:\s*(var\(--space-\d\))/)?.[1]
      expect(insetPadding, 'inset must declare a padding').toBeTruthy()
      expect(insetPadding, 'and it must be the SAME token StatCard uses, not a copy of its value').toBe(cardPadding)
    })

    it('changes padding ONLY — inset must not drag KeyValue toward the StatCard treatment', () => {
      const css = readFileSync('src/components/ui/KeyValue.module.css', 'utf8')
      const insetRule = css.slice(css.indexOf('.inset'), css.indexOf('}', css.indexOf('.inset')) + 1)
      expect(insetRule).toMatch(/padding:/)
      for (const forbidden of ['font-family', 'font-size', 'font-weight', 'font-variant', 'background', 'border-radius']) {
        expect(insetRule, `inset must not set ${forbidden}`).not.toContain(forbidden)
      }
    })
  })

  it('does NOT adopt the StatCard treatment — sans, not mono, no tabular-nums (design-intent pin)', () => {
    // KeyValue is deliberately a calm labelled fact, not a headline metric. This pins that intent
    // so a later "make it consistent with StatCard" edit fails loudly instead of silently landing.
    const css = readFileSync('src/components/ui/KeyValue.module.css', 'utf8')
    expect(css).toContain('var(--font-sans)')
    expect(css).not.toContain('var(--font-mono)')
    expect(css).not.toContain('tabular-nums')
  })
})
