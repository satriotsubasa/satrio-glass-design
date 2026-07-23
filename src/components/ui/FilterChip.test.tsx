import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterChip } from './FilterChip'

describe('FilterChip', () => {
  it('renders a button with the label and aria-pressed=false when inactive', () => {
    render(<FilterChip label="Groceries" active={false} onClick={() => {}} />)
    const chip = screen.getByRole('button', { name: 'Groceries' })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    expect(chip).toHaveAttribute('type', 'button')
  })

  it('reflects the active state via aria-pressed=true', () => {
    render(<FilterChip label="Income" active onClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'Income' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('fires onClick when tapped', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<FilterChip label="Paid" active={false} onClick={onClick} />)
    await user.click(screen.getByRole('button', { name: 'Paid' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders an aria-hidden colour dot only when colour is provided', () => {
    const { rerender } = render(
      <FilterChip label="OCBC SG" active={false} onClick={() => {}} colour="#4A90D9" />,
    )
    const chip = screen.getByRole('button', { name: 'OCBC SG' })
    const dot = chip.querySelector('span[aria-hidden]') as HTMLElement
    expect(dot).not.toBeNull()
    expect(dot.style.backgroundColor).toBe('rgb(74, 144, 217)')

    rerender(<FilterChip label="OCBC SG" active={false} onClick={() => {}} />)
    expect(chip.querySelector('span[aria-hidden]')).toBeNull()
  })
})
