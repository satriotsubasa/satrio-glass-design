import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

// The gallery mounts kit Sheets (framer-motion drag internals) and Radix Selects; jsdom
// implements neither pointer capture nor scrollIntoView — polyfill just enough that mounting
// doesn't throw.
beforeEach(() => {
  window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false)
  window.HTMLElement.prototype.setPointerCapture = vi.fn()
  window.HTMLElement.prototype.releasePointerCapture = vi.fn()
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

describe('Gallery', () => {
  it('renders the reference-consumer shell — the heading and a PillRail pill mount', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Component Gallery' })).toBeInTheDocument()
    // A PillRail pill — the strip mounts one <button> per item; proves the rail rendered.
    expect(screen.getByRole('button', { name: 'Subscriptions' })).toBeInTheDocument()
  })
})
