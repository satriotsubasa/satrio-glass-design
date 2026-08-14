import styles from './KeyValue.module.css'

export interface KeyValueProps {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  /** Take the same content inset a StatCard's root carries, so a KeyValue and a StatCard sitting
   *  in one grid or row share their left edges and top alignment. Bare (the default) a KeyValue
   *  has no padding at all, which offsets it from any carded sibling by exactly that inset.
   *  PADDING ONLY — inset does not move a KeyValue toward the StatCard treatment; the type stays
   *  sans, body-size and untabulated. */
  inset?: boolean
  className?: string
}

// Stacked label-over-value. No grid logic — consumers own packing. Deliberately NOT the StatCard
// treatment: sans, body-size, no tabular-nums — a calm labelled fact, not a headline metric.
export function KeyValue({ label, value, detail, inset, className }: KeyValueProps) {
  return (
    <div className={[styles.keyValue, inset && styles.inset, className].filter(Boolean).join(' ')}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {detail && <span className={styles.detail}>{detail}</span>}
    </div>
  )
}
