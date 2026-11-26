import { CaretLeft } from '@phosphor-icons/react'
import { IconButton } from './IconButton'
import styles from './PageHeader.module.css'

export interface PageHeaderProps {
  eyebrow?: string
  title: string
  subheading?: React.ReactNode
  action?: React.ReactNode
  /** A back control before the title, for a page reached from another: `label` is its
   *  accessible name ("Back to accounts"). */
  back?: { label: string; onClick: () => void }
  className?: string
}

// The page title (h1) — the page-level counterpart to SectionHeader's in-page title (h2). Same
// slot API (eyebrow/title/subheading/action), different heading level and type step: PageHeader
// renders at --fs-large-title, SectionHeader at --fs-title. One page has one PageHeader; a page
// can have many SectionHeaders under it.
export function PageHeader({ eyebrow, title, subheading, action, back, className }: PageHeaderProps) {
  return (
    <div className={[styles.header, back ? styles.withBack : '', className].filter(Boolean).join(' ')}>
      {back && (
        <IconButton className={styles.back} label={back.label} icon={<CaretLeft size={20} />} onClick={back.onClick} />
      )}
      <div className={styles.text}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 className={styles.title}>{title}</h1>
        {subheading != null && <p className={styles.sub}>{subheading}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
