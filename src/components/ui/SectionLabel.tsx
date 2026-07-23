import type { ReactNode } from 'react'
import styles from './SectionLabel.module.css'

export interface SectionLabelProps {
  children: ReactNode
  className?: string
}

/** An uppercase, letter-spaced eyebrow caption — the small muted heading above a `SettingsGroup`. */
export function SectionLabel({ children, className }: SectionLabelProps) {
  return <p className={[styles.label, className].filter(Boolean).join(' ')}>{children}</p>
}
