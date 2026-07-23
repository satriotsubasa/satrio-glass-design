import { useEffect, useRef } from 'react'
import { MagnifyingGlass, X } from '@phosphor-icons/react'
import styles from './SearchField.module.css'

export interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  /** Clears the text via the inline X. Defaults to `onChange('')`. This is distinct from the
   *  page's header X, which clears search + every filter + inbound params. */
  onClear?: () => void
  placeholder?: string
  /** Focus the input on mount — the /search page opens ready to type (spec F1 Q1 ADOPTED).
   *  Default true; pass false for catalogue/embedded use where stealing focus is unwanted. */
  autoFocus?: boolean
  'aria-label'?: string
}

/**
 * The /search page's free-text field (spec §F1 kit): a leading MagnifyingGlass, a 16px input
 * (the one deliberate opt-out of the 15px `--fs-body` scale — see the CSS note; iOS Safari zooms
 * the viewport on focus below 16px), and an inline clear X shown only while there's text. Purely
 * controlled — the page owns the value and (per F1) debounces it into the filter pipeline.
 */
export function SearchField({
  value,
  onChange,
  onClear,
  placeholder = 'Search transactions...',
  autoFocus = true,
  ...aria
}: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
    // Run once on mount; re-focusing on every `autoFocus` flip is never wanted here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clear = () => (onClear ? onClear() : onChange(''))

  return (
    <div className={styles.wrap}>
      <MagnifyingGlass size={16} weight="bold" className={styles.icon} aria-hidden />
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={aria['aria-label'] ?? 'Search transactions'}
      />
      {value ? (
        <button type="button" className={styles.clear} onClick={clear} aria-label="Clear search text">
          <X size={15} weight="bold" />
        </button>
      ) : null}
    </div>
  )
}
