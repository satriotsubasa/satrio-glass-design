import type { ReactNode } from 'react'
import styles from './SettingRowControl.module.css'

export interface SettingRowControlProps {
  icon?: ReactNode
  label: string
  description?: string
  children: ReactNode
  className?: string
}

/**
 * The inline "text left, control right" idiom: label/description on the left, an arbitrary
 * control (a Toggle/Select/SegmentedControl) right-aligned in `children`. Unlike `SettingRow`,
 * this is always a plain `<div>` — the control itself owns interactivity/keyboard handling.
 */
export function SettingRowControl({ icon, label, description, children, className }: SettingRowControlProps) {
  return (
    <div className={[styles.row, className].filter(Boolean).join(' ')}>
      <span className={styles.main}>
        {icon ? <span className={`${styles.iconTile} icon-shape`}>{icon}</span> : null}
        <span className={styles.text}>
          <span className={styles.label}>{label}</span>
          {description ? <span className={styles.description}>{description}</span> : null}
        </span>
      </span>
      <span className={styles.control}>{children}</span>
    </div>
  )
}
