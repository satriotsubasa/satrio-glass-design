import styles from './PageHeader.module.css'

export interface PageHeaderProps {
  eyebrow?: string
  title: string
  subheading?: string
  action?: React.ReactNode
  className?: string
}

// The page title (h1) — the page-level counterpart to SectionHeader's in-page title (h2). Same
// slot API (eyebrow/title/subheading/action), different heading level and type step: PageHeader
// renders at --fs-large-title, SectionHeader at --fs-title. One page has one PageHeader; a page
// can have many SectionHeaders under it.
export function PageHeader({ eyebrow, title, subheading, action, className }: PageHeaderProps) {
  return (
    <div className={[styles.header, className].filter(Boolean).join(' ')}>
      <div className={styles.text}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 className={styles.title}>{title}</h1>
        {subheading && <p className={styles.sub}>{subheading}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
