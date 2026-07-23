import { readFileSync } from 'node:fs'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SegmentedControl } from './SegmentedControl'

describe('SegmentedControl', () => {
  it('marks the active option and fires onChange', async () => {
    const onChange = vi.fn()
    render(<SegmentedControl value="a" onChange={onChange}
      options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} />)
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('disabled: still marks the active option but never fires onChange', async () => {
    const onChange = vi.fn()
    render(<SegmentedControl value="a" onChange={onChange} disabled
      options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} />)
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'B' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('recessed track (design/motion plan, Task 6): the wrap no longer wears the shared .glass chrome class — it recesses via an opaque surface-2 fill + inset shadow', () => {
    // The control always sits ON a translucent parent (.dash-card, .sheet); a backdrop-filter
    // there sampled only the parent's flat fill (an element with backdrop-filter is a Backdrop
    // Root for descendants) while its white film compounded into a milky blob. The redesign is
    // the iOS idiom: recessed track, raised active pill.
    render(<SegmentedControl value="a" onChange={() => {}} ariaLabel="Recessed"
      options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} />)
    expect(screen.getByRole('group', { name: 'Recessed' }).className).not.toMatch(/\bglass\b/)

    const css = readFileSync('src/components/ui/SegmentedControl.module.css', 'utf8')
    const wrap = css.match(/\.wrap\s*\{([^}]*)\}/)
    expect(wrap?.[1]).toContain('background: var(--surface-2)')
    expect(wrap?.[1]).toMatch(/box-shadow:\s*inset/)
    // The raised pill: .active carries a small drop shadow out of the recessed track.
    const active = css.match(/\.active\s*\{([^}]*)\}/)
    expect(active?.[1]).toMatch(/box-shadow:/)
  })

  it('presses with the house scale() over a transition that names transform (design/motion plan, Task 3)', () => {
    // Two-part contract: :active is a scale (not the old 1px nudge), AND `transform` is in the
    // transition list — without it the press snaps on and snaps back with no release ease.
    const css = readFileSync('src/components/ui/SegmentedControl.module.css', 'utf8')
    const active = css.match(/\.seg:active\s*\{([^}]*)\}/)
    expect(active?.[1]).toContain('scale(')
    expect(active?.[1]).not.toContain('translateY')
    const transition = css.match(/\.seg\s*\{[^}]*transition:([^;]*);/)
    expect(transition?.[1]).toContain('transform')
  })
})
