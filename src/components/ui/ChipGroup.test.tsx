import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChipGroup } from './ChipGroup'

const OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'mdy', label: 'MDY' },
  { value: 'dmy', label: 'DMY' },
]

describe('ChipGroup', () => {
  it('marks the active option aria-pressed and leaves the rest unpressed', () => {
    render(<ChipGroup value="mdy" options={OPTIONS} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Default' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'MDY' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'DMY' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('fires onChange with the clicked option value', async () => {
    const onChange = vi.fn()
    render(<ChipGroup value="mdy" options={OPTIONS} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'DMY' }))
    expect(onChange).toHaveBeenCalledWith('dmy')
  })
})
