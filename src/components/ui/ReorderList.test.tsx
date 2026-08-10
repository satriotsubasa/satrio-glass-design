import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReorderList } from './ReorderList'

interface Item {
  id: string
  label: string
  order: number
}

const ITEMS: Item[] = [
  { id: 'b', label: 'Second', order: 2 },
  { id: 'a', label: 'First', order: 1 },
  { id: 'c', label: 'Third', order: 3 },
]

function renderList(onMove = vi.fn()) {
  render(
    <ReorderList
      items={ITEMS}
      getKey={(item) => item.id}
      getOrder={(item) => item.order}
      onMove={onMove}
      renderRow={(item) => <span>{item.label}</span>}
    />,
  )
  return onMove
}

function renderLabeledList(onMove = vi.fn()) {
  render(
    <ReorderList
      items={ITEMS}
      getKey={(item) => item.id}
      getOrder={(item) => item.order}
      onMove={onMove}
      renderRow={(item) => <span>{item.label}</span>}
      getLabel={(item) => item.label}
    />,
  )
  return onMove
}

describe('ReorderList', () => {
  it('renders rows sorted by order ascending, not input order', () => {
    renderList()
    const labels = screen.getAllByText(/First|Second|Third/).map((el) => el.textContent)
    expect(labels).toEqual(['First', 'Second', 'Third'])
  })

  it('disables "up" on the first row and "down" on the last row only', () => {
    renderList()
    expect(screen.getByRole('button', { name: 'Move item 1 up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move item 1 down' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move item 2 up' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move item 2 down' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move item 3 down' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move item 3 up' })).not.toBeDisabled()
  })

  it('fires onMove with the item key and "down" when the down chevron is clicked', async () => {
    const onMove = renderList()
    await userEvent.click(screen.getByRole('button', { name: 'Move item 2 down' }))
    expect(onMove).toHaveBeenCalledWith('b', 'down')
  })

  it('fires onMove with the item key and "up" when the up chevron is clicked', async () => {
    const onMove = renderList()
    await userEvent.click(screen.getByRole('button', { name: 'Move item 3 up' }))
    expect(onMove).toHaveBeenCalledWith('c', 'up')
  })

  describe('with getLabel', () => {
    it('announces the item label instead of the index in the move buttons\' aria-labels', () => {
      renderLabeledList()
      expect(screen.getByRole('button', { name: 'Move First up' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Move First down' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Move Second up' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Move Second down' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Move Third up' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Move Third down' })).toBeInTheDocument()
    })

    it('fires onMove with the item key when a labeled button is clicked', async () => {
      const onMove = renderLabeledList()
      await userEvent.click(screen.getByRole('button', { name: 'Move Second down' }))
      expect(onMove).toHaveBeenCalledWith('b', 'down')
    })
  })

  describe('draggable mode', () => {
    function renderDraggable() {
      const onMove = vi.fn()
      const onReorder = vi.fn()
      render(
        <ReorderList
          items={ITEMS}
          getKey={(item) => item.id}
          getOrder={(item) => item.order}
          getLabel={(item) => item.label}
          onMove={onMove}
          onReorder={onReorder}
          draggable
          renderRow={(item) => <span>{item.label}</span>}
        />,
      )
      return { onMove, onReorder }
    }

    it('KEEPS the chevron path — drag is pointer-only, so it can never be the sole way to reorder', async () => {
      const { onMove } = renderDraggable()
      // This is the test that matters: a drag-only list is unusable by keyboard and by most
      // assistive tech. Adding drag must never remove the mechanism everyone else relies on.
      await userEvent.click(screen.getByRole('button', { name: 'Move Second down' }))
      expect(onMove).toHaveBeenCalledWith('b', 'down')
    })

    it('hides the drag handle from assistive tech and the tab order — it duplicates the chevrons', () => {
      renderDraggable()
      const handle = screen.getByTestId('drag-handle-First')
      expect(handle).toHaveAttribute('aria-hidden', 'true')
      expect(handle.tagName).not.toBe('BUTTON')
    })

    it('renders one handle per row, in sorted order', () => {
      renderDraggable()
      for (const label of ['First', 'Second', 'Third']) {
        expect(screen.getByTestId(`drag-handle-${label}`)).toBeInTheDocument()
      }
    })

    it('renders NO drag handle by default — the added mode must be opt-in', () => {
      renderList()
      expect(screen.queryByTestId('drag-handle-item 1')).toBeNull()
      expect(document.querySelector('[data-testid^="drag-handle"]')).toBeNull()
    })
  })
})
