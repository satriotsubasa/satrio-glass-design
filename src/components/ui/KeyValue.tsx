import styles from './KeyValue.module.css'

export interface KeyValueProps {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  className?: string
}

// Stacked label-over-value. No grid logic — consumers own packing. Deliberately NOT the StatCard
// treatment: sans, body-size, no tabular-nums — a calm labelled fact, not a headline metric.
export function KeyValue({ label, value, detail, className }: KeyValueProps) {
  return (
    <div className={[styles.keyValue, className].filter(Boolean).join(' ')}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {detail && <span className={styles.detail}>{detail}</span>}
    </div>
  )
}
