import styles from './SegmentedControl.module.css'
export interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  ariaLabel?: string
  /** Dims the whole control and disables every segment; the active option stays visible. */
  disabled?: boolean
}
export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel, disabled }: SegmentedControlProps<T>) {
  return (
    <div className={`${styles.wrap}${disabled ? ` ${styles.disabled}` : ''}`} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" className={`${styles.seg} ${o.value === value ? styles.active : ''}`}
          aria-pressed={o.value === value} disabled={disabled} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
