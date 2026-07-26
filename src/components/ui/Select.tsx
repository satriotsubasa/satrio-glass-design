import * as RSelect from '@radix-ui/react-select'
import styles from './Select.module.css'

export interface SelectOption { value: string; label: string; icon?: React.ReactNode }
export interface SelectProps {
  value?: string
  onValueChange?: (v: string) => void
  options: SelectOption[]
  placeholder?: string
  invalid?: boolean
  id?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
  'aria-describedby'?: string
}
export function Select({ value, onValueChange, options, placeholder, invalid, id, disabled, className, ...aria }: SelectProps) {
  return (
    <RSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RSelect.Trigger id={id} aria-invalid={invalid || undefined}
        className={`${styles.trigger} ${invalid ? styles.invalid : ''} ${className ?? ''}`} {...aria}>
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon className={styles.chevron}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content className={styles.content} position="popper" sideOffset={6}>
          <RSelect.Viewport>
            {options.map((o) => (
              <RSelect.Item key={o.value} value={o.value} className={styles.item}>
                {o.icon && <span className={styles.itemIcon}>{o.icon}</span>}
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
                <RSelect.ItemIndicator className={styles.indicator}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5L20 7" /></svg>
                </RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  )
}
