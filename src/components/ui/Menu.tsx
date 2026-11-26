import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import button from './Button.module.css'
import { Sheet } from './Sheet'
import styles from './Menu.module.css'

/** From this width a menu is a small popover beside its trigger; below it, an action sheet. */
const POPOVER_QUERY = '(min-width: 640px)'

function prefersPopover(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(POPOVER_QUERY).matches
}

const MenuContext = createContext<{ close: () => void }>({ close: () => {} })

export interface MenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Names the menu: the action sheet's heading on a phone, the accessible name everywhere. */
  title: string
  /** The control that opened it. With one, a wide screen gets a popover beside it; without one
   *  (or on a phone) the menu is an action sheet. Focus returns to it on close. */
  anchorRef?: React.RefObject<HTMLElement | null>
  children: React.ReactNode
}

/**
 * A short list of actions for the thing in front of you: an overflow menu.
 *
 * It replaces the centred Modal of stacked buttons, which dimmed the whole screen for three
 * items. On a phone it is an action sheet rising from the bottom, where the thumb is. From 640px,
 * given the trigger, it is a popover anchored under it that dims nothing: Escape or a click
 * outside closes it, the arrow keys move through it, and focus goes back to the trigger.
 *
 * Children are `MenuItem`s (an action, closes the menu) and `MenuRow`s (a label with a control,
 * such as a toggle, that keeps the menu open).
 */
export function Menu({ open, onOpenChange, title, anchorRef, children }: MenuProps) {
  const close = () => onOpenChange(false)
  // Decided when it opens, so a menu does not change form under the pointer if the window is
  // resized while it is up.
  const [popover, setPopover] = useState(false)
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    const anchor = anchorRef?.current
    const asPopover = Boolean(anchor) && prefersPopover()
    setPopover(asPopover)
    if (asPopover && anchor) {
      const rect = anchor.getBoundingClientRect()
      setPosition({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) })
    }
  }, [open, anchorRef])

  const showPopover = open && popover && position !== null

  useEffect(() => {
    if (!showPopover) return
    const panel = panelRef.current
    const items = () => Array.from(panel?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])
    items()[0]?.focus()

    const finish = () => {
      onOpenChange(false)
      anchorRef?.current?.focus()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        finish()
        return
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return
      const list = items()
      if (list.length === 0) return
      event.preventDefault()
      const current = list.indexOf(document.activeElement as HTMLElement)
      const next =
        event.key === 'Home' ? 0
        : event.key === 'End' ? list.length - 1
        : event.key === 'ArrowDown' ? (current + 1) % list.length
        : (current - 1 + list.length) % list.length
      list[next].focus()
    }
    const onPointerDown = (event: PointerEvent | MouseEvent) => {
      const target = event.target as Node
      if (panel?.contains(target) || anchorRef?.current?.contains(target)) return
      onOpenChange(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
    // onOpenChange is the caller's setter; re-subscribing on its identity would steal focus back
    // to the first item on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPopover])

  if (open && popover) {
    if (!position) return null
    return createPortal(
      <MenuContext.Provider value={{ close }}>
        <div
          ref={panelRef}
          role="menu"
          aria-label={title}
          className={styles.popover}
          style={{ top: position.top, right: position.right }}
        >
          {children}
        </div>
      </MenuContext.Provider>,
      document.body,
    )
  }

  return (
    <Sheet open={open} onClose={close} title={title}>
      <MenuContext.Provider value={{ close }}>
        <div role="menu" aria-label={title} className={styles.list}>
          {children}
        </div>
      </MenuContext.Provider>
    </Sheet>
  )
}

export interface MenuItemProps {
  label: string
  icon?: React.ReactNode
  /** Shown at the end of the row: a count, the current value. */
  trailing?: React.ReactNode
  /** `danger` for an action that destroys something. */
  tone?: 'default' | 'danger'
  onSelect: () => void
  disabled?: boolean
  /** Shows a spinner and blocks the item while its action is being prepared. */
  loading?: boolean
  /** Leave the menu open after `onSelect` (the caller closes it, e.g. once a check resolves). */
  keepOpen?: boolean
}

export function MenuItem({ label, icon, trailing, tone = 'default', onSelect, disabled, loading = false, keepOpen = false }: MenuItemProps) {
  const { close } = useContext(MenuContext)
  return (
    <button
      type="button"
      role="menuitem"
      className={[styles.item, tone === 'danger' ? styles.danger : ''].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={() => {
        onSelect()
        if (!keepOpen) close()
      }}
    >
      <span className={styles.icon} aria-hidden>
        {loading ? <span className={button.spinner} /> : icon}
      </span>
      <span className={styles.label}>{label}</span>
      {trailing != null ? <span className={styles.trailing}>{trailing}</span> : null}
    </button>
  )
}

export interface MenuRowProps {
  label: string
  /** The control or value at the end of the row: a Toggle, a Chip. */
  children: React.ReactNode
}

/** A row that is not an action: a setting with its control, or a fact. It never closes the menu. */
export function MenuRow({ label, children }: MenuRowProps) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={styles.trailing}>{children}</span>
    </div>
  )
}
