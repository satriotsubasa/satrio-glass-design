import { readFileSync } from 'node:fs'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('renders children and fires onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
  it('is disabled and does not fire when loading', async () => {
    const onClick = vi.fn()
    render(<Button loading onClick={onClick}>Save</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    await userEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })
  it('presses with the house scale() over a transition that names transform (design/motion plan, Task 3)', () => {
    // The press state must be a scale (emil: "scale(0.97) on :active"), not the old 1px nudge —
    // and the transition list must name `transform`, or the scale snaps on with no release ease.
    const css = readFileSync('src/components/ui/Button.module.css', 'utf8')
    const active = css.match(/\.btn:active[^{]*\{([^}]*)\}/)
    expect(active?.[1]).toContain('scale(')
    expect(active?.[1]).not.toContain('translateY')
    const transition = css.match(/\.btn\s*\{[^}]*transition:([^;]*);/)
    expect(transition?.[1]).toContain('transform')
  })
  it("re-asserts the functional loading spinner's authored speed under the OS prefers-reduced-motion (twin of the data-motion='reduced' re-assert)", () => {
    // global.css routes the OS Reduce Motion signal to the 60ms gentle tier — an infinite spin
    // loop capped to 60ms strobes at ~16Hz, so the spinner must re-assert 0.6s on BOTH paths.
    // (cwd-relative read: this file runs in the jsdom environment, where import.meta.url is an
    // http URL — the node-env new URL(…, import.meta.url) pattern doesn't work here.)
    const css = readFileSync('src/components/ui/Button.module.css', 'utf8')
    const osStart = css.indexOf('@media (prefers-reduced-motion: reduce)')
    expect(osStart).toBeGreaterThan(-1)
    const osBlock = css.slice(osStart)
    expect(osBlock).toContain('.spinner')
    expect(osBlock).toContain('animation-duration: 0.6s !important')
  })
})
