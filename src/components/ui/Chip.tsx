import styles from './Chip.module.css'
export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'accent' | 'income' | 'expense' | 'warning'
  size?: 'sm' | 'md'
}
export function Chip({ tone = 'neutral', size = 'md', className, ...rest }: ChipProps) {
  return <span className={[styles.chip, styles[tone], styles[size], className].filter(Boolean).join(' ')} {...rest} />
}
