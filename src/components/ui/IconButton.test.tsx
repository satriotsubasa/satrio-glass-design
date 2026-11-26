import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button, ButtonLink } from './Button'
import { IconButton } from './IconButton'
import { Pressable } from './Pressable'

const css = (name: string) => readFileSync(`src/components/ui/${name}.module.css`, 'utf8')

describe('IconButton', () => {
  it('is named by its label, is a plain button by default, and fires onClick', async () => {
    const onClick = vi.fn()
    render(<IconButton label="Back" icon={<svg data-testid="glyph" />} onClick={onClick} />)
    const button = screen.getByRole('button', { name: 'Back' })
    expect(button).toHaveAttribute('type', 'button')
    expect(screen.getByTestId('glyph')).toBeInTheDocument()
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('draws at 32, 36 or 44px, 36 by default', () => {
    const { rerender } = render(<IconButton label="Close" icon={<svg />} />)
    expect(screen.getByRole('button').className).toMatch(/s36/)
    rerender(<IconButton label="Close" icon={<svg />} size={32} />)
    expect(screen.getByRole('button').className).toMatch(/s32/)
    rerender(<IconButton label="Close" icon={<svg />} size={44} />)
    expect(screen.getByRole('button').className).toMatch(/s44/)
  })

  it('takes a tap over at least the 44px minimum whatever size is drawn', () => {
    const source = css('IconButton')
    // The tap area is a pseudo-element inset by half the shortfall: negative under 44px, never positive.
    expect(source).toMatch(/\.icon::before\s*\{[^}]*inset:\s*min\(0px,\s*calc\(\(var\(--icon-button-size\) - var\(--tap-min\)\) \/ 2\)\)/)
    expect(source).toMatch(/\.icon\s*\{[^}]*position:\s*relative/)
    expect(source).toMatch(/\.s32\s*\{\s*--icon-button-size:\s*32px/)
    expect(source).toMatch(/\.s44\s*\{\s*--icon-button-size:\s*var\(--control-md\)/)
  })

  it('does not fire while loading, and keeps its name', async () => {
    const onClick = vi.fn()
    render(<IconButton label="Refresh" icon={<svg data-testid="glyph" />} loading onClick={onClick} />)
    const button = screen.getByRole('button', { name: 'Refresh' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByTestId('glyph')).toBeNull()
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('Button — the 1.7 forms', () => {
  it('has a 44px size that leaves md where it was', () => {
    const source = css('Button')
    expect(source).toMatch(/\.tap\s*\{\s*height:\s*var\(--control-md\)/)
    expect(source).toMatch(/\.md\s*\{\s*height:\s*42px/)
    render(<Button size="tap">Pay</Button>)
    expect(screen.getByRole('button', { name: 'Pay' }).className).toMatch(/tap/)
  })

  it('round gives pill ends; link drops the chassis and outranks the size', () => {
    const source = css('Button')
    expect(source).toMatch(/\.round\s*\{\s*border-radius:\s*var\(--radius-pill\)/)
    expect(source).toMatch(/\.link\.link\s*\{[^}]*height:\s*auto[^}]*padding:\s*0[^}]*background:\s*none[^}]*color:\s*var\(--accent\)/)
    render(<Button variant="link" round>Forgot password?</Button>)
    const button = screen.getByRole('button', { name: 'Forgot password?' })
    expect(button.className).toMatch(/link/)
    expect(button.className).toMatch(/round/)
  })

  it('ButtonLink is a real link with the button look', () => {
    render(<ButtonLink href="/terms" variant="outline" size="tap">Terms</ButtonLink>)
    const link = screen.getByRole('link', { name: 'Terms' })
    expect(link).toHaveAttribute('href', '/terms')
    expect(link.className).toMatch(/btn/)
    expect(link.className).toMatch(/outline/)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('Pressable', () => {
  it('is a plain button that does not submit a form, and fires onClick', async () => {
    const onClick = vi.fn()
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    render(<form onSubmit={onSubmit}><Pressable onClick={onClick}>Groceries</Pressable></form>)
    const target = screen.getByRole('button', { name: 'Groceries' })
    expect(target).toHaveAttribute('type', 'button')
    await userEvent.click(target)
    expect(onClick).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('as="a" is a link and carries no button type', () => {
    render(<Pressable as="a" href="/accounts/1">DBS</Pressable>)
    const link = screen.getByRole('link', { name: 'DBS' })
    expect(link).toHaveAttribute('href', '/accounts/1')
    expect(link).not.toHaveAttribute('type')
    expect(link).not.toHaveAttribute('as')
  })

  it('a disabled one does nothing', async () => {
    const onClick = vi.fn()
    render(<Pressable disabled onClick={onClick}>Archived</Pressable>)
    await userEvent.click(screen.getByRole('button', { name: 'Archived' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('has no look of its own, but presses on the house scale and shows the focus ring', () => {
    const source = css('Pressable')
    expect(source).toMatch(/\.pressable\s*\{[^}]*background:\s*none[^}]*font:\s*inherit[^}]*color:\s*inherit/)
    expect(source).toMatch(/\.compact:active:not\(:disabled\)\s*\{\s*transform:\s*scale\(0\.97\)/)
    expect(source).toMatch(/\.large:active:not\(:disabled\)\s*\{\s*transform:\s*scale\(0\.98\)/)
    expect(source).toMatch(/\.pressable:focus-visible\s*\{[^}]*box-shadow:\s*var\(--ring\)/)
    render(<Pressable press="none">Row</Pressable>)
    expect(screen.getByRole('button').className).not.toMatch(/compact|large/)
  })
})
