import type { ReactNode } from 'react'
import { Panel } from './Panel'
import { SectionLabel } from './SectionLabel'
import styles from './SettingsGroup.module.css'

export interface SettingsGroupProps {
  children: ReactNode
  label?: string
  className?: string
}

/**
 * A glass card (`Panel material="card"` — the `.dash-card` surface) wrapping a run of
 * `SettingRow`/`SettingRowControl` rows, with an optional `SectionLabel` caption above it. Rows
 * get a hairline divider between them (not around the group) via a child combinator, matching the
 * grouped-table-view look every Settings section shares.
 */
export function SettingsGroup({ children, label, className }: SettingsGroupProps) {
  return (
    <div className={[styles.wrap, className].filter(Boolean).join(' ')}>
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      <Panel as="section" material="card" padding="none" className={styles.card}>
        {children}
      </Panel>
    </div>
  )
}
