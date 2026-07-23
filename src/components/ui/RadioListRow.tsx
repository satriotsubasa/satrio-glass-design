import type { KeyboardEvent } from 'react'
import styles from './RadioListRow.module.css'

export interface RadioListOption {
  value: string
  label: string
  example?: string
}

export interface RadioListRowProps {
  value: string
  options: RadioListOption[]
  onChange: (value: string) => void
  'aria-label'?: string
  className?: string
}

/**
 * A vertical list of full-width radio rows — a dot + label on the left, a right-aligned muted
 * `example` string (e.g. a formatted-date preview for `dateFormatType`). `role="radiogroup"` +
 * `role="radio"` with a roving tabindex; the full WAI-ARIA radio-group key set moves focus AND
 * selection between rows — ArrowDown/ArrowRight next (wrapping), ArrowUp/ArrowLeft previous
 * (wrapping), Home first, End last — and Space/Enter select the focused row via the button's
 * own activation.
 */
export function RadioListRow({ value, options, onChange, className, ...aria }: RadioListRowProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        nextIndex = (index + 1) % options.length
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        nextIndex = (index - 1 + options.length) % options.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = options.length - 1
        break
      default:
        return
    }
    event.preventDefault()
    onChange(options[nextIndex].value)
    const group = event.currentTarget.parentElement
    const nextButton = group?.children[nextIndex] as HTMLElement | undefined
    nextButton?.focus()
  }

  const hasSelection = options.some((option) => option.value === value)

  return (
    <div role="radiogroup" className={[styles.group, className].filter(Boolean).join(' ')} aria-label={aria['aria-label']}>
      {options.map((option, index) => {
        const selected = option.value === value
        const tabbable = selected || (!hasSelection && index === 0)
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={tabbable ? 0 : -1}
            className={styles.row}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <span className={selected ? `${styles.dot} ${styles.dotSelected}` : styles.dot} aria-hidden>
              <span className={styles.dotInner} aria-hidden />
            </span>
            <span className={styles.label}>{option.label}</span>
            {option.example ? <span className={styles.example}>{option.example}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
