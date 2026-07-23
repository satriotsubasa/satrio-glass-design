import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RadioListRow } from './RadioListRow'

const OPTIONS = [
  { value: 'full', label: 'Full', example: 'Mon, 12 Jul 2026' },
  { value: 'dateOnly', label: 'Date only', example: '12 Jul 2026' },
  { value: 'numeric', label: 'Numeric', example: '12/07/2026' },
]

describe('RadioListRow', () => {
  it('renders a radiogroup with one radio per option, checked reflecting value', () => {
    render(<RadioListRow value="dateOnly" options={OPTIONS} onChange={vi.fn()} aria-label="Date format" />)
    expect(screen.getByRole('radiogroup', { name: 'Date format' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Full/ })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: /Date only/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Numeric/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('fires onChange with the clicked option value', async () => {
    const onChange = vi.fn()
    render(<RadioListRow value="full" options={OPTIONS} onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: /Numeric/ }))
    expect(onChange).toHaveBeenCalledWith('numeric')
  })

  it('moves selection with ArrowDown/ArrowUp', async () => {
    const onChange = vi.fn()
    render(<RadioListRow value="full" options={OPTIONS} onChange={onChange} />)
    screen.getByRole('radio', { name: /Full/ }).focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(onChange).toHaveBeenCalledWith('dateOnly')
  })

  it('moves selection AND focus with ArrowRight/ArrowLeft (the horizontal pair of the WAI-ARIA radio pattern)', async () => {
    const onChange = vi.fn()
    render(<RadioListRow value="full" options={OPTIONS} onChange={onChange} />)
    screen.getByRole('radio', { name: /Full/ }).focus()

    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('dateOnly')
    expect(screen.getByRole('radio', { name: /Date only/ })).toHaveFocus()

    await userEvent.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith('full')
    expect(screen.getByRole('radio', { name: /Full/ })).toHaveFocus()
  })

  it('Home selects the FIRST option, End the LAST, moving focus with the selection', async () => {
    const onChange = vi.fn()
    render(<RadioListRow value="dateOnly" options={OPTIONS} onChange={onChange} />)
    screen.getByRole('radio', { name: /Date only/ }).focus()

    await userEvent.keyboard('{Home}')
    expect(onChange).toHaveBeenLastCalledWith('full')
    expect(screen.getByRole('radio', { name: /Full/ })).toHaveFocus()

    await userEvent.keyboard('{End}')
    expect(onChange).toHaveBeenLastCalledWith('numeric')
    expect(screen.getByRole('radio', { name: /Numeric/ })).toHaveFocus()
  })

  it('wraps at both edges (Left/Up from the first row → last; Right/Down from the last row → first)', async () => {
    const onChange = vi.fn()
    render(<RadioListRow value="full" options={OPTIONS} onChange={onChange} />)

    screen.getByRole('radio', { name: /Full/ }).focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith('numeric')

    screen.getByRole('radio', { name: /Numeric/ }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('full')
  })

  it('ignores unrelated keys (no selection change, no preventDefault side effects)', async () => {
    const onChange = vi.fn()
    render(<RadioListRow value="full" options={OPTIONS} onChange={onChange} />)
    screen.getByRole('radio', { name: /Full/ }).focus()
    await userEvent.keyboard('{PageDown}a')
    expect(onChange).not.toHaveBeenCalled()
  })
})
