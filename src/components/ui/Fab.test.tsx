import { readFileSync } from 'node:fs'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { Fab } from './Fab'

describe('Fab', () => {
  it('renders a labelled button and fires onClick', async () => {
    const onClick = vi.fn()
    render(<Fab aria-label="New transaction" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button', { name: 'New transaction' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('defaults to the Plus glyph but accepts custom children', () => {
    const { container, rerender } = render(<Fab aria-label="Add" onClick={() => {}} />)
    expect(container.querySelector('svg')).toBeInTheDocument() // the default 24px bold Plus
    rerender(
      <Fab aria-label="Search" onClick={() => {}}>
        <MagnifyingGlass data-testid="custom-glyph" size={24} weight="bold" />
      </Fab>,
    )
    expect(screen.getByTestId('custom-glyph')).toBeInTheDocument()
  })

  it('pins the rounded-rect tile geometry: 18px radius, 56px, dock-derived bottom lane', () => {
    // radius 18 (a tile, NOT the old 999px circle) and the lane formula: dock bottom is
    // max(safe-inset, 10px) and the pill is 64px tall, so +78px leaves a 14px gap above it.
    // Desktop has no dock (Sidebar instead) — plain corner offset. (cwd-relative read: jsdom
    // environment, where import.meta.url is an http URL.)
    const css = readFileSync('src/components/ui/Fab.module.css', 'utf8')
    const base = css.match(/\.fab\s*\{([^}]*)\}/)
    expect(base?.[1]).toContain('border-radius: 18px')
    expect(base?.[1]).toContain('width: 56px')
    expect(base?.[1]).toContain('height: 56px')
    expect(base?.[1]).toContain('bottom: calc(max(env(safe-area-inset-bottom, 0px), 10px) + 78px)')
    const desktop = css.slice(css.indexOf('@media (min-width: 1024px)'))
    expect(desktop).toContain('bottom: calc(env(safe-area-inset-bottom) + 28px)')
  })
})
