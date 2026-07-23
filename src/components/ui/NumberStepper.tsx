import { Minus, Plus } from '@phosphor-icons/react'
import styles from './NumberStepper.module.css'

export interface NumberStepperProps {
  value: number
  onChange: (next: number) => void
  /** Inclusive lower bound (default 0). The − button disables and clamps at this value. */
  min?: number
  /** Inclusive upper bound (default Infinity). The + button disables and clamps at this value. */
  max?: number
  /** Amount each tap adds/subtracts (default 1). */
  step?: number
  /** Small uppercase caption under the numeric readout (e.g. "Periods"). */
  label?: string
  /** aria-label for the − button (default "Decrease"). */
  decrementLabel?: string
  /** aria-label for the + button (default "Increase"). */
  incrementLabel?: string
}

/**
 * A compact −/value/+ stepper (spec §F2 — the History "periods" control). PURELY controlled:
 * the parent owns `value`; this only emits the next CLAMPED value on a tap, so the caller can
 * never be handed an out-of-range number. Buttons disable at their respective bound. `label` adds
 * a small caption under the readout for context ("Periods"). Reused wherever a bounded integer
 * needs a touch-friendly ±.
 */
export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  label,
  decrementLabel = 'Decrease',
  incrementLabel = 'Increase',
}: NumberStepperProps) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next))
  const atMin = value <= min
  const atMax = value >= max

  return (
    <div className={styles.stepper}>
      <button
        type="button"
        className={styles.button}
        onClick={() => onChange(clamp(value - step))}
        disabled={atMin}
        aria-label={decrementLabel}
      >
        <Minus size={16} weight="bold" aria-hidden />
      </button>
      <div className={styles.readout}>
        <span className={styles.value}>{value}</span>
        {label ? <span className={styles.label}>{label}</span> : null}
      </div>
      <button
        type="button"
        className={styles.button}
        onClick={() => onChange(clamp(value + step))}
        disabled={atMax}
        aria-label={incrementLabel}
      >
        <Plus size={16} weight="bold" aria-hidden />
      </button>
    </div>
  )
}
