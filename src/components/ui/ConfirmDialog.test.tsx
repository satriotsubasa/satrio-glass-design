import { readFileSync } from 'node:fs'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfirmDialog } from './ConfirmDialog'

function renderDialog(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  return render(
    <ConfirmDialog
      open
      title="Delete this transaction?"
      message="This can't be undone."
      confirmLabel="Delete"
      tone="danger"
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
      {...overrides}
    />,
  )
}

describe('ConfirmDialog', () => {
  it('leaves Cancel and Confirm enabled by default (busy defaults to false)', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled()
  })

  it('disables both Cancel and Confirm while busy, and shows the Confirm button loading', () => {
    renderDialog({ busy: true })
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    // Button renders a visually-hidden label + spinner while `loading` — the accessible name
    // still resolves via that sr-only text.
    const confirmButton = screen.getByRole('button', { name: 'Delete' })
    expect(confirmButton).toBeDisabled()
    expect(confirmButton).toHaveAttribute('aria-busy', 'true')
  })

  it('does not call onCancel when Cancel is clicked while busy', () => {
    const onCancel = vi.fn()
    renderDialog({ busy: true, onCancel })
    screen.getByRole('button', { name: 'Cancel' }).click()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('does not call onConfirm when Confirm is clicked while busy', () => {
    const onConfirm = vi.fn()
    renderDialog({ busy: true, onConfirm })
    screen.getByRole('button', { name: 'Delete' }).click()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  describe('exit animation (design/motion plan, Task 5)', () => {
    // Radix stamps data-state="closed" and its Presence layer only delays unmount while a CSS
    // animation is running on that state — with no closed-state animation every ConfirmDialog
    // fades in over 220ms and teleports out on a single frame. These assertions pin the exit
    // pair. (cwd-relative read: jsdom environment, so the node-env new URL(…, import.meta.url)
    // pattern doesn't work here — same convention as Button.test.tsx.)
    const css = readFileSync('src/components/ui/Modal.module.css', 'utf8')

    it('declares popOut and fadeOut keyframes in the module CSS', () => {
      expect(css).toMatch(/@keyframes popOut\s*\{/)
      expect(css).toMatch(/@keyframes fadeOut\s*\{/)
      // popOut leaves toward where the enter came from (pop's from-point): scale(0.96), with the
      // centering translate preserved so the exit doesn't yank the modal off-center.
      const popOut = css.match(/@keyframes popOut\s*\{([^}]*\{[^}]*\})*[^}]*\}/)?.[0]
      expect(popOut).toContain('translate(-50%,-50%) scale(0.96)')
      const fadeOut = css.match(/@keyframes fadeOut\s*\{([^}]*\{[^}]*\})*[^}]*\}/)?.[0]
      expect(fadeOut).toContain('opacity: 0')
    })

    it('applies both keyframes on [data-state="closed"] (modal → popOut, backdrop → fadeOut)', () => {
      const modalClosed = css.match(/\.modal\[data-state="closed"\]\s*\{([^}]*)\}/)?.[1]
      expect(modalClosed).toContain('popOut')
      const backdropClosed = css.match(/\.backdrop\[data-state="closed"\]\s*\{([^}]*)\}/)?.[1]
      expect(backdropClosed).toContain('fadeOut')
    })

    it('exits faster than it enters (asymmetric by design, emil §4)', () => {
      // The pair used to be hand-typed (160ms out / 220ms in) and this asserted the two literals
      // against each other. They are tokens now, so the asymmetry lives one level up: the file
      // must reach for the exit token on the way out and the enter token on the way in, and
      // tokens.css must keep exit shorter than enter. Asserting the relationship where it is
      // actually decided is stronger than asserting two numbers that no longer appear here.
      const enter = css.match(/\.modal\[data-state="open"\]\s*\{[^}]*animation:[^;]*?var\(--dur-([a-z]+)\)/)
      const exit = css.match(/\.modal\[data-state="closed"\]\s*\{[^}]*animation:[^;]*?var\(--dur-([a-z]+)\)/)
      expect(enter?.[1], 'the modal enter must use the enter duration token').toBe('enter')
      expect(exit?.[1], 'the modal exit must use the exit duration token').toBe('exit')

      const tokens = readFileSync('src/styles/tokens.css', 'utf8')
      const ms = (name: string) => Number(tokens.match(new RegExp(`--dur-${name}:\\s*(\\d+)ms`))![1])
      expect(ms('exit'), 'the exit token must stay shorter than the enter token').toBeLessThan(ms('enter'))
    })

    it('carries no local reduced-motion override — the global tiers cap the one-shot pair', () => {
      // The old `animation: none` under prefers-reduced-motion routed the OS signal to a hard
      // cut (and left Radix no closed-state animation to wait on → instant unmount), contradicting
      // global.css's 60ms gentle tier, which names Modal pop as exactly the kind of one-shot it
      // caps. The tiers reach CSS-module classes via the universal selector — nothing local
      // needed. (Match real rules, not the comment that records this decision.)
      expect(css).not.toContain('@media (prefers-reduced-motion')
      expect(css).not.toMatch(/animation:\s*none\s*[;}]/)
    })
  })
})
