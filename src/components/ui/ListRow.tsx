import styles from './ListRow.module.css'
export interface ListRowProps {
  leading?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode
  trailing?: React.ReactNode; onClick?: () => void; href?: string
}
export function ListRow({ leading, title, subtitle, trailing, onClick, href }: ListRowProps) {
  const interactive = Boolean(onClick || href)
  const inner = (
    <>
      {leading && <span className={styles.leading}>{leading}</span>}
      <span className={styles.body}>
        <span className={styles.title}>{title}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </span>
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </>
  )
  const cls = `${styles.row} ${interactive ? styles.interactive : ''}`
  if (href) return <a className={cls} href={href}>{inner}</a>
  if (onClick) return <button type="button" className={cls} onClick={onClick}>{inner}</button>
  return <div className={cls}>{inner}</div>
}
