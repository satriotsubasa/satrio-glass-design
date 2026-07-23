import styles from './Button.module.css'

/** Extends the full intrinsic button prop set INCLUDING `ref` (React 19 ref-as-prop — it lands
 *  in `...rest` and is forwarded onto the native `<button>`). */
export interface ButtonProps extends React.ComponentPropsWithRef<'button'> {
  variant?: 'primary' | 'tonal' | 'ghost' | 'outline' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  iconOnly?: boolean
  loading?: boolean
}

export function Button({
  variant = 'primary', size = 'md', iconOnly = false, loading = false,
  disabled, className, children, ...rest
}: ButtonProps) {
  return (
    <button
      className={[styles.btn, styles[variant], styles[size], iconOnly ? styles.iconOnly : '', className]
        .filter(Boolean).join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading
        ? <>
            <span className={styles.spinner} aria-hidden />
            <span className={styles.srOnly}>{children}</span>
          </>
        : children}
    </button>
  )
}
