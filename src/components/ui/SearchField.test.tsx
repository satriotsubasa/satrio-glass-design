import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchField } from './SearchField'

describe('SearchField', () => {
  it('renders the controlled value and fires onChange per keystroke', async () => {
    const onChange = vi.fn()
    render(<SearchField value="" onChange={onChange} autoFocus={false} />)
    await userEvent.type(screen.getByRole('textbox'), 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('shows the inline clear only when there is text, and it clears via onChange by default', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<SearchField value="" onChange={onChange} autoFocus={false} />)
    expect(screen.queryByRole('button', { name: 'Clear search text' })).not.toBeInTheDocument()

    rerender(<SearchField value="coffee" onChange={onChange} autoFocus={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Clear search text' }))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('uses onClear when provided instead of onChange', async () => {
    const onChange = vi.fn()
    const onClear = vi.fn()
    render(<SearchField value="x" onChange={onChange} onClear={onClear} autoFocus={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Clear search text' }))
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('focuses the input on mount when autoFocus is on (default)', () => {
    render(<SearchField value="" onChange={vi.fn()} />)
    expect(screen.getByRole('textbox')).toHaveFocus()
  })

  it('does not steal focus when autoFocus is false', () => {
    render(<SearchField value="" onChange={vi.fn()} autoFocus={false} />)
    expect(screen.getByRole('textbox')).not.toHaveFocus()
  })
})
