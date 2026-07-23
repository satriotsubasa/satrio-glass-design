import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NumberStepper } from './NumberStepper'

describe('NumberStepper', () => {
  it('renders the value and an optional label caption', () => {
    render(<NumberStepper value={20} onChange={vi.fn()} label="Periods" />)
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('Periods')).toBeInTheDocument()
  })

  it('increments and decrements by step, emitting the next value', async () => {
    const onChange = vi.fn()
    render(<NumberStepper value={10} onChange={onChange} step={2} />)
    await userEvent.click(screen.getByRole('button', { name: 'Increase' }))
    expect(onChange).toHaveBeenLastCalledWith(12)
    await userEvent.click(screen.getByRole('button', { name: 'Decrease' }))
    expect(onChange).toHaveBeenLastCalledWith(8)
  })

  it('clamps the emitted value to [min, max]', async () => {
    const onChange = vi.fn()
    render(<NumberStepper value={3} onChange={onChange} min={3} max={24} step={5} />)
    // Already at min: the − button is disabled, so no emit.
    expect(screen.getByRole('button', { name: 'Decrease' })).toBeDisabled()
    // + would overshoot from 3 by 5 → 8, still within bounds.
    await userEvent.click(screen.getByRole('button', { name: 'Increase' }))
    expect(onChange).toHaveBeenLastCalledWith(8)
  })

  it('clamps at the max bound and disables the + button there', async () => {
    const onChange = vi.fn()
    render(<NumberStepper value={24} onChange={onChange} min={3} max={24} />)
    expect(screen.getByRole('button', { name: 'Increase' })).toBeDisabled()
    // Decrement still works and stays in range.
    await userEvent.click(screen.getByRole('button', { name: 'Decrease' }))
    expect(onChange).toHaveBeenLastCalledWith(23)
  })

  it('honors custom aria-labels for the two buttons', () => {
    render(
      <NumberStepper
        value={5}
        onChange={vi.fn()}
        decrementLabel="Fewer periods"
        incrementLabel="More periods"
      />,
    )
    expect(screen.getByRole('button', { name: 'Fewer periods' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More periods' })).toBeInTheDocument()
  })
})
