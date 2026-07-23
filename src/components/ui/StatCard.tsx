import styles from './StatCard.module.css'

export interface StatCardProps {
  label: string
  value: React.ReactNode
  delta?: string
  deltaTone?: 'income' | 'expense' | 'neutral'
  icon?: React.ReactNode
  /** 'card' (default) renders as its own `.dash-card` surface; 'bare' is layout-only/transparent,
   *  for use when a parent `Panel` (material="card") already provides the single surface. */
  surface?: 'card' | 'bare'
}

export function StatCard({ label, value, delta, deltaTone = 'neutral', icon, surface = 'card' }: StatCardProps) {
  return (
    <div className={surface === 'bare' ? styles.card : `${styles.card} dash-card`}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        {icon && <span className={styles.icon}>{icon}</span>}
      </div>
      <div className={styles.value}>{value}</div>
      {delta && <div className={`${styles.delta} ${styles[deltaTone]}`}>{delta}</div>}
    </div>
  )
}
