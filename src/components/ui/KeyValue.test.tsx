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

  it('does NOT adopt the StatCard treatment — sans, not mono, no tabular-nums (design-intent pin)', () => {
    // KeyValue is deliberately a calm labelled fact, not a headline metric. This pins that intent
    // so a later "make it consistent with StatCard" edit fails loudly instead of silently landing.
    const css = readFileSync('src/components/ui/KeyValue.module.css', 'utf8')
    expect(css).toContain('var(--font-sans)')
    expect(css).not.toContain('var(--font-mono)')
    expect(css).not.toContain('tabular-nums')
  })
})
