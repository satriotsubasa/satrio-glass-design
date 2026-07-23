import type { ReactNode } from 'react'
import { Plus } from '@phosphor-icons/react'
import styles from './Fab.module.css'

export interface FabProps {
  'aria-label': string
  onClick: () => void
  /** Defaults to the bold 24px Plus — every current page's create action. */
  children?: ReactNode
}

/** The shared floating action button — fixed-position chrome (bottom lane, above the mobile
 *  dock), extracted from the four byte-identical page-local copies. All geometry/material lives
 *  in Fab.module.css, the ONLY module allowed to define `.fab` (appearanceConsumers.test.ts and
 *  pressStates.test.ts scan src/ and fail on any second definition). */
export function Fab({ 'aria-label': ariaLabel, onClick, children }: FabProps) {
  return (
    <button type="button" className={styles.fab} aria-label={ariaLabel} onClick={onClick}>
      {children ?? <Plus size={24} weight="bold" />}
    </button>
  )
}
