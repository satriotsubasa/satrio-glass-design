import styles from './EmptyState.module.css'
export interface EmptyStateProps { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      {icon && <div className={styles.icon}>{icon}</div>}
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.desc}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
