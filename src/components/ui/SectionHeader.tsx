import styles from './SectionHeader.module.css'

export interface SectionHeaderProps {
  eyebrow?: string
  title: string
  subheading?: string
  action?: React.ReactNode
}
export function SectionHeader({ eyebrow, title, subheading, action }: SectionHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.text}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h2 className={styles.title}>{title}</h2>
        {subheading && <p className={styles.sub}>{subheading}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
