import type { CSSProperties } from 'react'
import styles from './ProgressBar.module.css'

/** Visual variant of the fill: 'simple' (default) is the classic flat fill; 'wavy' scallops the
 *  fill's top edge via a CSS mask (see ProgressBar.module.css). Purely visual — progress math,
 *  role, and aria values are identical in both styles. */
export type ProgressBarStyle = 'simple' | 'wavy'

export interface ProgressBarProps {
  value: number
  max?: number
  tone?: 'accent' | 'income' | 'expense' | 'warning'
  /** Exact CSS colour for the FILL (e.g. an objective's own `colour`) — wins over `tone` when
   *  set. Mechanism: the tone classes only set the `--bar-fill` custom property and the fill's
   *  painted layers read `background: var(--bar-fill)`; this prop writes `--bar-fill` INLINE on
   *  the fill wrapper, which beats the class-level value in the cascade and inherits into the
   *  layers. Overridden fills also get `.customFill`, a label-tinted contrast floor
   *  (`color-mix` 85% colour / 15% var(--label)) so an arbitrary colour can't vanish against
   *  the track in dark/black themes — the theme-tuned tone classes stay pure.
   *  The wavy style is a mask on the fill wrapper, independent of the background, so it keeps
   *  applying over an overridden colour. */
  color?: string
  /** 'simple' (default) or 'wavy' — see ProgressBarStyle. This component holds no app-level
   *  settings of its own; callers that want the fill's style tied to a user setting read it
   *  from their own store and pass it down here. */
  barStyle?: ProgressBarStyle
}

export function ProgressBar({ value, max = 100, tone = 'accent', color, barStyle = 'simple' }: ProgressBarProps) {
  const wavy = barStyle === 'wavy'

  const pct = Math.max(0, Math.min(100, max <= 0 ? 0 : (value / max) * 100))
  // Progress is exposed as a 0..1 custom property, not a width — the module CSS animates the
  // fill via transform: scaleX(var(--bar-progress)) (compositor-only; see ProgressBar.module.css
  // for the cap-safe two-layer structure that keeps the 999px end cap round at any fraction).
  const fillStyle: CSSProperties = {}
  ;(fillStyle as Record<string, string>)['--bar-progress'] = String(pct / 100)
  if (color) (fillStyle as Record<string, string>)['--bar-fill'] = color
  return (
    <div className={styles.track} role="progressbar" aria-valuenow={Math.max(0, Math.min(max, value))} aria-valuemin={0} aria-valuemax={max}>
      <div
        className={`${styles.fill} ${styles[tone]}${color ? ` ${styles.customFill}` : ''}${wavy ? ` ${styles.wavy}` : ''}`}
        data-fill
        style={fillStyle}
      >
        <div className={styles.fillBody} />
        <div className={styles.fillCap} />
      </div>
    </div>
  )
}
