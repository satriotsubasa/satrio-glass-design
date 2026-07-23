import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toggle } from './Toggle'

describe('Toggle', () => {
  it('reflects checked=true via aria-checked', () => {
    render(<Toggle checked onChange={vi.fn()} aria-label="Demo toggle" />)
    expect(screen.getByRole('switch', { name: 'Demo toggle' })).toHaveAttribute('aria-checked', 'true')
  })

  it('reflects checked=false via aria-checked', () => {
    render(<Toggle checked={false} onChange={vi.fn()} aria-label="Demo toggle" />)
    expect(screen.getByRole('switch', { name: 'Demo toggle' })).toHaveAttribute('aria-checked', 'false')
  })

  it('fires onChange with the toggled value on click', async () => {
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} aria-label="Demo toggle" />)
    await userEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('fires onChange with the toggled value on Space', async () => {
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} aria-label="Demo toggle" />)
    screen.getByRole('switch').focus()
    await userEvent.keyboard(' ')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('fires onChange with the toggled value on Enter', async () => {
    const onChange = vi.fn()
    render(<Toggle checked onChange={onChange} aria-label="Demo toggle" />)
    screen.getByRole('switch').focus()
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('does not fire onChange when disabled (click or keyboard)', async () => {
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} disabled aria-label="Demo toggle" />)
    const el = screen.getByRole('switch')
    expect(el).toBeDisabled()
    await userEvent.click(el)
    expect(onChange).not.toHaveBeenCalled()
  })
})
