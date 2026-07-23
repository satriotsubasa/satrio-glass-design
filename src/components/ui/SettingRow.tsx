import type { ReactNode } from 'react'
import { CaretRight } from '@phosphor-icons/react'
import styles from './SettingRow.module.css'

export interface SettingRowProps {
  label: string
  description?: string
  icon?: ReactNode
  right?: ReactNode
  onClick?: () => void
  tone?: 'default' | 'destructive'
  disabled?: boolean
  className?: string
}

/**
 * The single-row idiom every Settings list uses: an optional leading icon tile + label/description
 * on the left, a `right` slot on the right. Ported (behaviour) from `$OLD`'s `SettingRow`
 * (`src/components/settings/sections/shared.tsx`), re-skinned in the glass kit's tokens.
 *
 * Renders as a real `<button>` whenever `onClick` is given — that covers both the pure-navigation
 * case (no `right` slot: a trailing chevron appears alone) AND a tappable row that ALSO previews a
 * value (e.g. Appearance's "Accent Color" row: a color swatch in `right` PLUS a chevron, opening a
 * picker sheet — mirrors `$OLD`'s combined swatch+chevron `right` node). Without `onClick`, a
 * `right` slot renders as a plain `<div>`: the control inside it (a Toggle/Select) owns its own
 * interactivity, and nesting it inside a `<button>` would create an invalid button-in-button.
 */
export function SettingRow({
  label,
  description,
  icon,
  right,
  onClick,
  tone = 'default',
  disabled,
  className,
}: SettingRowProps) {
  const labelClass = tone === 'destructive' ? `${styles.label} ${styles.destructive}` : styles.label

  const content = (
    <>
      <span className={styles.main}>
        {icon ? <span className={`${styles.iconTile} icon-shape`}>{icon}</span> : null}
        <span className={styles.text}>
          <span className={labelClass}>{label}</span>
          {description ? <span className={styles.description}>{description}</span> : null}
        </span>
      </span>
      {right ? (
        <span className={styles.right}>
          {right}
          {onClick ? <CaretRight size={16} className={styles.chevron} aria-hidden /> : null}
        </span>
      ) : onClick ? (
        <CaretRight size={16} className={styles.chevron} aria-hidden />
      ) : null}
    </>
  )

  const rowClassName = [styles.row, disabled ? styles.disabled : '', className].filter(Boolean).join(' ')

  if (onClick) {
    return (
      <button type="button" className={rowClassName} onClick={onClick} disabled={disabled}>
        {content}
      </button>
    )
  }

  return (
    <div className={rowClassName} aria-disabled={disabled || undefined}>
      {content}
    </div>
  )
}
