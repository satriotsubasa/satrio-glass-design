import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Modal } from './Modal'

// The Modal is controlled and has no Radix Trigger. Radix restores focus to its trigger on close,
// so with none, closing a confirm dialog or a page menu left focus on <body>.
describe('Modal — focus returns to what opened it', () => {
  it('restores the element that had focus when the modal opened', async () => {
    const ui = (open: boolean) => (
      <>
        <button type="button">opener</button>
        <Modal open={open} onOpenChange={vi.fn()} title="Confirm">
          <button type="button">inside</button>
        </Modal>
      </>
    )
    const { rerender } = render(ui(false))
    const opener = screen.getByRole('button', { name: 'opener' })
    opener.focus()

    rerender(ui(true))
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Confirm' }).contains(document.activeElement)).toBe(true),
    )

    rerender(ui(false))
    await waitFor(() => expect(document.activeElement).toBe(opener))
  })
})
