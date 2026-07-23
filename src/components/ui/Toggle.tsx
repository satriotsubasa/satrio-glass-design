import type { KeyboardEvent } from 'react'
import styles from './Toggle.module.css'

export interface ToggleProps {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  id?: string
  'aria-label'?: string
  className?: string
}

/**
 * An iOS-style glass switch — the settings kit's critical gap (~19 boolean AppSettings depend on
 * it). Fully controlled via `checked`/`onChange`. `role="switch"` + `aria-checked` carry the state
 * for assistive tech; the element is a real `<button>` so it's natively focusable and has a
 * ≥44px touch target (the visible pill is smaller, centered inside the hit area via padding, not
 * pseudo-element tricks). Space/Enter are handled explicitly (not just relied on as native button
 * behaviour) so the toggle behaves identically across browsers/test environments — `preventDefault`
 * on the keydown suppresses the browser's own synthetic click for that key, so `onChange` fires
 * exactly once per activation.
 */
export function Toggle({ checked, onChange, disabled, id, className, ...aria }: ToggleProps) {
  function handleClick() {
    if (disabled) return
    onChange(!checked)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    if (event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter') {
      event.preventDefault()
      onChange(!checked)
    }
  }

  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={[styles.toggle, className].filter(Boolean).join(' ')}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={aria['aria-label']}
    >
      <span className={styles.track} aria-hidden />
      <span className={styles.knob} aria-hidden />
    </button>
  )
}
