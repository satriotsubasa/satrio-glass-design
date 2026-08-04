import styles from './ListRow.module.css'
export interface ListRowProps {
  leading?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode
  trailing?: React.ReactNode; onClick?: () => void; href?: string
  // 'truncate' (default) is the original single-line ellipsis behaviour, unchanged. 'clamp2' wraps
  // the title onto up to two lines instead of truncating it to one.
  titleWrap?: 'truncate' | 'clamp2'
}
export function ListRow({ leading, title, subtitle, trailing, onClick, href, titleWrap = 'truncate' }: ListRowProps) {
  const interactive = Boolean(onClick || href)
  const titleCls = titleWrap === 'clamp2' ? `${styles.title} ${styles.clamp2}` : styles.title
  const inner = (
    <>
      {leading && <span className={styles.leading}>{leading}</span>}
      <span className={styles.body}>
        <span className={titleCls}>{title}</span>
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
