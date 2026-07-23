import styles from './Skeleton.module.css'
export interface SkeletonProps { width?: string; height?: string; radius?: string; className?: string }
export function Skeleton({ width = '100%', height = '1em', radius = '8px', className }: SkeletonProps) {
  return <span className={[styles.skeleton, className].filter(Boolean).join(' ')} style={{ width, height, borderRadius: radius }} aria-hidden />
}
