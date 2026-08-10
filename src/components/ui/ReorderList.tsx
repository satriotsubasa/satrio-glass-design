import type { ReactNode } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { CaretUp, CaretDown, DotsSixVertical } from '@phosphor-icons/react'
import styles from './ReorderList.module.css'

export interface ReorderListProps<T> {
  items: T[]
  getKey: (item: T) => string
  getOrder: (item: T) => number
  onMove: (key: string, direction: 'up' | 'down') => void
  renderRow: (item: T) => ReactNode
  /** Optional per-item name for the move buttons' aria-labels (e.g. `widget.label`). When
   *  provided, buttons announce "Move {label} up/down" so a screen-reader user reordering a
   *  list of named rows (Dashboard Widgets, Input Prompts) knows which row moved. Falls back
   *  to the index-based "Move item {n} up/down" when omitted. */
  getLabel?: (item: T) => string
  /** Opt into pointer dragging IN ADDITION to the chevrons. The chevrons are never removed: drag
   *  is a pointer-only affordance, so a list that could only be reordered by dragging would be
   *  unusable by keyboard and by most assistive tech. Requires `onReorder`. */
  draggable?: boolean
  /** Fires with the full key order after a drag settles. Only used when `draggable`. */
  onReorder?: (keys: string[]) => void
  className?: string
}

/** One draggable row. Split out because `useDragControls` is a hook and cannot be called from
 *  inside a map callback. `dragListener={false}` + explicit controls mean the row only moves when
 *  the HANDLE is pressed — dragging from the body would swallow presses on whatever interactive
 *  content `renderRow` supplies (toggles, links), which is the usual way a drag list breaks. */
function DraggableRow({ value, label, children }: { value: string; label: string; children: ReactNode }) {
  const controls = useDragControls()
  return (
    <Reorder.Item value={value} dragListener={false} dragControls={controls} className={styles.row}>
      {/* Pointer-only affordance, deliberately out of the tab order and hidden from assistive
          tech: it duplicates the chevrons, which already expose reordering to everyone. Exposing
          it too would add a focus stop that does nothing on keyboard. */}
      <span
        className={styles.dragHandle}
        onPointerDown={(event) => controls.start(event)}
        aria-hidden="true"
        data-testid={`drag-handle-${label}`}
      >
        <DotsSixVertical size={15} weight="bold" />
      </span>
      {children}
    </Reorder.Item>
  )
}

/**
 * A reorderable list of rows (shared by the Input Prompts + Dashboard Widgets sub-pages, matching
 * the shipped Wallets reorder UX). Sorts `items` by `getOrder` ascending before rendering; each
 * row pairs `renderRow(item)` — which supplies its own content, including any enable/visibility
 * control — with a stacked up/down chevron control. The first row's "up" and the last row's "down"
 * are disabled. Clicking a chevron fires `onMove(key, direction)`; this component holds no
 * ordering state of its own — the caller re-derives order/persists it.
 *
 * With `draggable`, rows additionally drag by a handle and `onReorder` fires with the settled key
 * order. The chevron path is unchanged and still present.
 */
export function ReorderList<T>({
  items, getKey, getOrder, onMove, renderRow, getLabel, draggable, onReorder, className,
}: ReorderListProps<T>) {
  const sorted = [...items].sort((a, b) => getOrder(a) - getOrder(b))

  const rowInner = (item: T, index: number, isFirst: boolean, isLast: boolean) => {
    const key = getKey(item)
    const label = getLabel ? getLabel(item) : `item ${index + 1}`
    return (
      <>
        <div className={styles.content}>{renderRow(item)}</div>
        <div className={styles.moveControls}>
          <button
            type="button"
            className={styles.moveBtn}
            aria-label={`Move ${label} up`}
            disabled={isFirst}
            onClick={() => onMove(key, 'up')}
          >
            <CaretUp size={13} weight="bold" />
          </button>
          <button
            type="button"
            className={styles.moveBtn}
            aria-label={`Move ${label} down`}
            disabled={isLast}
            onClick={() => onMove(key, 'down')}
          >
            <CaretDown size={13} weight="bold" />
          </button>
        </div>
      </>
    )
  }

  if (draggable) {
    return (
      <Reorder.Group
        axis="y"
        values={sorted.map(getKey)}
        onReorder={(keys) => onReorder?.(keys as string[])}
        className={[styles.list, className].filter(Boolean).join(' ')}
      >
        {sorted.map((item, index) => (
          <DraggableRow
            key={getKey(item)}
            value={getKey(item)}
            label={getLabel ? getLabel(item) : `item ${index + 1}`}
          >
            {rowInner(item, index, index === 0, index === sorted.length - 1)}
          </DraggableRow>
        ))}
      </Reorder.Group>
    )
  }

  return (
    <div className={[styles.list, className].filter(Boolean).join(' ')}>
      {sorted.map((item, index) => (
        <div key={getKey(item)} className={styles.row}>
          {rowInner(item, index, index === 0, index === sorted.length - 1)}
        </div>
      ))}
    </div>
  )
}
