import styles from './EmptyState.module.css'
export interface EmptyStateProps {
  icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode
  // 'md' (default) is the original padding/type-size behaviour, unchanged. 'sm' shrinks the whole
  // block for a tighter host (e.g. an inline card slot) — less padding, a body-size title, a
  // caption-size description.
  size?: 'md' | 'sm'
}
export function EmptyState({ icon, title, description, action, size = 'md' }: EmptyStateProps) {
  // Ternary, not `styles[size]`: '.md' is deliberately never declared in EmptyState.module.css, so
  // indexing by size would emit an `undefined` class token on the default path and break the
  // byte-identical (`toBe(styles.empty)`) guarantee for a consumer that never passes `size`.
  const rootCls = size === 'sm' ? `${styles.empty} ${styles.sm}` : styles.empty
  return (
    <div className={rootCls}>
      {icon && <div className={styles.icon}>{icon}</div>}
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.desc}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
