import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tooltip, TooltipProvider } from './Tooltip'
import { Button } from './Button'

const css = readFileSync('src/components/ui/Tooltip.module.css', 'utf8')

function mount(content = 'Copy link') {
  return render(
    <TooltipProvider delayDuration={0}>
      <Tooltip content={content}>
        <Button>Share</Button>
      </Tooltip>
    </TooltipProvider>,
  )
}

describe('Tooltip', () => {
  it('opens on keyboard focus, not only on hover — a tooltip reachable only by pointer is invisible to keyboard users', async () => {
    const user = userEvent.setup()
    mount()
    expect(screen.queryByRole('tooltip')).toBeNull()
    await user.tab()
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Copy link')
  })

  it('opens on hover', async () => {
    const user = userEvent.setup()
    mount()
    await user.hover(screen.getByRole('button', { name: 'Share' }))
    expect(await screen.findByRole('tooltip')).toBeInTheDocument()
  })

  it('describes its trigger, so the tip is announced with the control rather than as loose text', async () => {
    const user = userEvent.setup()
    mount()
    await user.tab()
    await screen.findByRole('tooltip')
    expect(screen.getByRole('button', { name: 'Share' })).toHaveAccessibleDescription('Copy link')
  })

  it('keeps the trigger as the caller supplied it (asChild) — no extra wrapper to break layout', () => {
    mount()
    const trigger = screen.getByRole('button', { name: 'Share' })
    expect(trigger.tagName).toBe('BUTTON')
  })

  it('scales from the trigger, never from its own centre', () => {
    // A tooltip is anchored to a control; centre-origin is the modal exception, not this.
    expect(css).toMatch(/transform-origin:\s*var\(--radix-tooltip-content-transform-origin\)/)
  })

  it('never enters from a zero scale — nothing in the real world appears from nothing', () => {
    // Comments stripped first: the rule's own prose names the banned value to explain the ban.
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(rules).toMatch(/@keyframes tipIn[\s\S]*?scale\(0\.9[0-9]\)/)
    expect(rules).not.toMatch(/scale\(0\)/)
  })

  it('takes the chrome blur tier, not the sheet tier — a tooltip is small floating chrome', () => {
    expect(css).toMatch(/blur\(var\(--blur-chrome\)\)/)
  })
})

describe('TooltipProvider', () => {
  it('defaults to a delay before the first tip and a skip window after it, so a second tip opens instantly', () => {
    // The delay stops a tip flashing as the pointer crosses a control; the skip window is what
    // makes moving ALONG a toolbar feel fast. Per-tooltip providers would re-pay the delay at
    // every icon, which is why the provider is mounted once and Tooltip never self-provides.
    const source = readFileSync('src/components/ui/Tooltip.tsx', 'utf8')
    expect(source).toMatch(/delayDuration = 400/)
    expect(source).toMatch(/skipDelayDuration = 1500/)
    expect(source, 'Tooltip must not wrap its own provider').not.toMatch(
      /export function Tooltip\([\s\S]*?RTooltip\.Provider/,
    )
  })
})
