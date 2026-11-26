import styles from './SectionHeader.module.css'

export interface SectionHeaderProps {
  eyebrow?: string
  title: string
  subheading?: string
  action?: React.ReactNode
  /** `title` (default) is the 22px step. `headline` is 17px, for a section inside a card or
   *  under a PageHeader, so the page title is visibly the larger of the two. */
  size?: 'title' | 'headline'
}
export function SectionHeader({ eyebrow, title, subheading, action, size = 'title' }: SectionHeaderProps) {
  return (
    <div className={[styles.header, size === 'headline' ? styles.headline : ''].filter(Boolean).join(' ')}>
      <div className={styles.text}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h2 className={styles.title}>{title}</h2>
        {subheading && <p className={styles.sub}>{subheading}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
