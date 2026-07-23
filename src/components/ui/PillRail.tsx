import type { ReactNode } from 'react'
import { useHorizontalRail } from '../../hooks/useHorizontalRail'
import styles from './PillRail.module.css'

export interface PillRailProps {
  children: ReactNode
  className?: string
  /** When provided, renders as `role="group"` with this label — honest ARIA for a scrollable
   *  row of plain buttons (not a real tab/listbox widget), mirroring `MonthTabs`. Omit for a
   *  strip whose chips are already independently labelled and don't need a group landmark. */
  ariaLabel?: string
}

/**
 * Shared horizontal-scroll "pill rail" wrapper — wires one `useHorizontalRail` instance (desktop
 * wheel-to-horizontal + click-drag + keyboard ArrowLeft/Right, plus click-suppression after a
 * real drag) to a clip-safe `overflow-x: auto` strip. Uses the same padding-inline/padding-block +
 * net-zero negative margin-inline pattern as the dashboard rails (`WalletSwitcherWidget`,
 * `MonthTabs`) so edge chips get breathing room for hover/focus states without visually shifting
 * the strip relative to sibling content.
 *
 * Used by every pill/chip strip in the transaction editor that can overflow a single row: the
 * wallet/goal/loan strips (`WalletPicker`), the subcategory strip (`CategoryPicker`'s `SubStrip`),
 * the amount keypad's wallet-switch strip, and the review section's budget-exclusion strip — see
 * the Phase 3b-3.1 Task 2 report for the full list of conversions.
 */
export function PillRail({ children, className, ariaLabel }: PillRailProps) {
  const {
    railRef,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handlePointerLeave,
    handleClickCapture,
    handleKeyDown,
  } = useHorizontalRail()

  return (
    <div
      ref={railRef}
      className={[styles.rail, className].filter(Boolean).join(' ')}
      role={ariaLabel ? 'group' : undefined}
      aria-label={ariaLabel}
      tabIndex={0}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      onClickCapture={handleClickCapture}
    >
      {children}
    </div>
  )
}
