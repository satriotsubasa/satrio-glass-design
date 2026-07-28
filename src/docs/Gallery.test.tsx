import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

// The Backdrop section stamps the REAL <html data-backdrop> — a failed assertion or a missing
// cleanup would otherwise leak the attribute into sibling tests in this same file.
afterEach(() => {
  delete document.documentElement.dataset.backdrop
})

describe('Gallery', () => {
  it('renders the reference-consumer shell — the heading and a PillRail pill mount', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Component Gallery' })).toBeInTheDocument()
    // A PillRail pill — the strip mounts one <button> per item; proves the rail rendered.
    expect(screen.getByRole('button', { name: 'Subscriptions' })).toBeInTheDocument()
  })

  it('wires the Field demo section exactly as its subheading claims: every rendered hint/error id is targeted by some control\'s aria-describedby, and every aria-describedby token resolves to a real element', () => {
    render(<App />)

    // Scope to the "Field, TextInput, Textarea, Select" section — its subheading claims each
    // control points aria-describedby at Field's published ${htmlFor}-hint / ${htmlFor}-error
    // ids. Making that claim a live assertion is what catches both a control that silently drops
    // its wiring and an aria-describedby token that dangles (points at an id nothing renders).
    const heading = screen.getByRole('heading', { name: 'Field, TextInput, Textarea, Select' })
    const section = heading.closest('section')
    if (!section) throw new Error('Field demo section not found')

    const describedTokens = new Set<string>()
    const describers = Array.from(section.querySelectorAll('[aria-describedby]'))
    expect(describers.length).toBeGreaterThan(0)
    for (const el of describers) {
      const tokens = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
      expect(tokens.length).toBeGreaterThan(0)
      for (const token of tokens) {
        describedTokens.add(token)
        expect(document.getElementById(token), `aria-describedby="${token}" has no matching element`).not.toBeNull()
      }
    }

    // Every hint/error <p> Field renders in this section must be named by some control's
    // aria-describedby — the section claims this for ALL of them, not only the two with an error.
    const hintAndErrorIds = Array.from(section.querySelectorAll('p[id$="-hint"], p[id$="-error"]')).map((el) => el.id)
    expect(hintAndErrorIds.length).toBeGreaterThan(0)
    for (const id of hintAndErrorIds) {
      expect(describedTokens.has(id), `#${id} is rendered but nothing in the section points aria-describedby at it`).toBe(true)
    }
  })

  it('carries backdrop-scope on the page root — the gallery renders outside any <main>, so without it the legibility layer never reaches this page', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Component Gallery' }).closest('.backdrop-scope')).not.toBeNull()
  })

  it('stamps <html data-backdrop> live from the Backdrop switcher, with Minimal REMOVING the attribute', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Mesh' }))
    expect(document.documentElement.dataset.backdrop).toBe('mesh')

    await user.click(screen.getByRole('button', { name: 'Wallpaper' }))
    expect(document.documentElement.dataset.backdrop).toBe('wallpaper')

    await user.click(screen.getByRole('button', { name: 'Minimal' }))
    expect(document.documentElement.hasAttribute('data-backdrop')).toBe(false)
  })

  it('restores the mount-time data-backdrop on unmount — leaving the gallery leaves no trace on the document', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)

    await user.click(screen.getByRole('button', { name: 'Aurora' }))
    expect(document.documentElement.dataset.backdrop).toBe('aurora')

    unmount()
    expect(document.documentElement.hasAttribute('data-backdrop')).toBe(false)
  })

  it('renders the Backdrop section on material="none" so the legibility text-shadow can actually reach it', () => {
    render(<App />)
    const section = screen.getByRole('heading', { name: 'Backdrops' }).closest('section')
    if (!section) throw new Error('Backdrop section not found')
    // material="none" means no .panel-material wrapper — the control sample beside it is a real
    // .dash-card, proving the section still demonstrates the material-reset half of the contract.
    expect(section.querySelector('.panel-material')).toBeNull()
    expect(section.querySelector('.dash-card')).not.toBeNull()
  })
})
