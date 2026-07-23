import styles from './Panel.module.css'

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: 'div' | 'section'
  material?: 'glass' | 'content' | 'solid' | 'card' | 'none'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}
export function Panel({ as = 'div', material = 'content', padding = 'md', className, ...rest }: PanelProps) {
  const Tag = as
  const mat =
    material === 'glass' ? 'glass'
    : material === 'content' ? 'panel-material'
    : material === 'card' ? 'dash-card'
    : material === 'none' ? ''
    : styles.solid
  return <Tag className={[styles.panel, mat, styles[`p_${padding}`], className].filter(Boolean).join(' ')} {...rest} />
}
