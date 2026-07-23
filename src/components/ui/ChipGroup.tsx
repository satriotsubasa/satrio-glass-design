import styles from './ChipGroup.module.css'

export interface ChipGroupOption {
  value: string
  label: string
}

export interface ChipGroupProps {
  value: string
  options: ChipGroupOption[]
  onChange: (value: string) => void
  'aria-label'?: string
  className?: string
}

/**
 * A wrapping row of pill buttons — visually the `Chip` language, single-select like
 * `SegmentedControl` (`aria-pressed` per button, `role="group"` on the wrap). For option sets that
 * don't fit a segmented bar (e.g. `dateOrder`'s 6 options).
 */
export function ChipGroup({ value, options, onChange, className, ...aria }: ChipGroupProps) {
  return (
    <div className={[styles.wrap, className].filter(Boolean).join(' ')} role="group" aria-label={aria['aria-label']}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            className={active ? `${styles.chip} ${styles.active}` : styles.chip}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
