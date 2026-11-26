import { readFileSync } from 'node:fs'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { Menu, MenuItem, MenuRow } from './Menu'

/** jsdom has no matchMedia; a wide screen is one that says yes to the popover query. */
function setWide(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: wide && query === '(min-width: 640px)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  // @ts-expect-error restoring jsdom's absence of matchMedia
  delete window.matchMedia
})

function Harness({ anchored = true, onEdit = vi.fn(), onDelete = vi.fn() }: { anchored?: boolean; onEdit?: () => void; onDelete?: () => void }) {
  const [open, setOpen] = useState(false)
  const [grouped, setGrouped] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={anchorRef} onClick={() => setOpen(true)}>More</button>
      <button>Elsewhere</button>
      <Menu open={open} onOpenChange={setOpen} title="Account" anchorRef={anchored ? anchorRef : undefined}>
        <MenuItem label="Edit" onSelect={onEdit} />
        <MenuItem label="Archive" onSelect={vi.fn()} disabled />
        <MenuRow label="Group by color">
          <input type="checkbox" aria-label="Group by color" checked={grouped} onChange={() => setGrouped((value) => !value)} />
        </MenuRow>
        <MenuItem label="Delete" tone="danger" onSelect={onDelete} keepOpen />
      </Menu>
    </>
  )
}

describe('Menu on a phone: an action sheet', () => {
  it('opens as a dialog named by its title, holding a menu of the items', () => {
    setWide(false)
    render(<Harness />)
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'More' }))

    const dialog = screen.getByRole('dialog', { name: 'Account' })
    const menu = within(dialog).getByRole('menu', { name: 'Account' })
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Edit', 'Archive', 'Delete'])
  })

  it('is the form used when no trigger is given, even on a wide screen', () => {
    setWide(true)
    render(<Harness anchored={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByRole('dialog', { name: 'Account' })).toBeInTheDocument()
  })
})

describe('Menu on a wide screen: a popover by its trigger', () => {
  function openWide(props: Parameters<typeof Harness>[0] = {}) {
    setWide(true)
    render(<Harness {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    return screen.getByRole('menu', { name: 'Account' })
  }

  it('is a menu and not a dialog: nothing is dimmed, and focus lands on the first item', () => {
    const menu = openWide()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(menu.style.top).not.toBe('')
    expect(menu.style.right).not.toBe('')
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus()
  })

  it('choosing an item runs it and closes the menu', () => {
    const onEdit = vi.fn()
    openWide({ onEdit })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('an item marked keepOpen runs and leaves the menu up; a row with a control never closes it', () => {
    const onDelete = vi.fn()
    openWide({ onDelete })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Group by color' }))
    expect(screen.getByRole('checkbox', { name: 'Group by color' })).toBeChecked()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledOnce()
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('a disabled item does nothing and is skipped by the arrow keys, which wrap', () => {
    openWide()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Archive' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'ArrowUp' })
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Home' })
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus()
  })

  it('Escape closes it and gives focus back to the trigger', () => {
    openWide()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('button', { name: 'More' })).toHaveFocus()
  })

  it('a press anywhere outside closes it; a press inside does not', () => {
    const menu = openWide()
    fireEvent.mouseDown(menu)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('Menu styles', () => {
  const css = readFileSync('src/components/ui/Menu.module.css', 'utf8')
  it('the popover is floating chrome on the popover layer, with the menu elevation', () => {
    expect(css).toMatch(/\.popover\s*\{[^}]*z-index:\s*var\(--z-popover\)/)
    expect(css).toMatch(/\.popover\s*\{[^}]*background:\s*var\(--menu-bg\)/)
    expect(css).toMatch(/\.popover\s*\{[^}]*var\(--elev-menu\)/)
  })
  it('an item is at least the 44px control height and a destructive one is the negative colour', () => {
    expect(css).toMatch(/\.item, \.row\s*\{[^}]*min-height:\s*var\(--control-md\)/)
    expect(css).toMatch(/\.danger\s*\{\s*color:\s*var\(--negative\)/)
  })
})
