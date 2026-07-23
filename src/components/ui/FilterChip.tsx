import styles from './FilterChip.module.css'

export interface FilterChipProps {
  label: string
  active: boolean
  onClick: () => void
  /** Optional identity dot (accounts / goals / loans carry their own colour). */
  colour?: string
}

/**
 * A multi-select filter pill — active state via `aria-pressed`, with an optional leading colour
 * dot for entities that carry their own identity colour (accounts, goals, loans). Promoted from
 * SearchPage's local chip so the shared TransactionFilterSheet (/search + /transactions) and any
 * future filter surface all press/label/announce identically.
 */
export function FilterChip({ label, active, onClick, colour }: FilterChipProps) {
  return (
    <button
      type="button"
      className={active ? `${styles.chip} ${styles.chipActive}` : styles.chip}
      aria-pressed={active}
      onClick={onClick}
    >
      {colour ? <span className={styles.dot} style={{ backgroundColor: colour }} aria-hidden /> : null}
      {label}
    </button>
  )
}
