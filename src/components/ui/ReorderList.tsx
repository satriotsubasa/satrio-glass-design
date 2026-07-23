import type { ReactNode } from 'react'
import { CaretUp, CaretDown } from '@phosphor-icons/react'
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
  className?: string
}

/**
 * A reorderable list of rows (shared by the Input Prompts + Dashboard Widgets sub-pages, matching
 * the shipped Wallets reorder UX). Sorts `items` by `getOrder` ascending before rendering; each
 * row pairs `renderRow(item)` — which supplies its own content, including any enable/visibility
 * control — with a stacked up/down chevron control. The first row's "up" and the last row's "down"
 * are disabled. Clicking a chevron fires `onMove(key, direction)`; this component holds no
 * ordering state of its own — the caller re-derives order/persists it.
 */
export function ReorderList<T>({ items, getKey, getOrder, onMove, renderRow, getLabel, className }: ReorderListProps<T>) {
  const sorted = [...items].sort((a, b) => getOrder(a) - getOrder(b))

  return (
    <div className={[styles.list, className].filter(Boolean).join(' ')}>
      {sorted.map((item, index) => {
        const key = getKey(item)
        const isFirst = index === 0
        const isLast = index === sorted.length - 1
        const label = getLabel ? getLabel(item) : `item ${index + 1}`
        return (
          <div key={key} className={styles.row}>
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
          </div>
        )
      })}
    </div>
  )
}
