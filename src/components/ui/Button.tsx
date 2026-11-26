import styles from './Button.module.css'

interface ButtonLook {
  /** `link` is text-only: accent-coloured, no chassis, sized by its own text. */
  variant?: 'primary' | 'tonal' | 'ghost' | 'outline' | 'danger' | 'link'
  /** `tap` is the 44px platform minimum. `md` stays 42px: moving it would resize every consumer. */
  size?: 'sm' | 'md' | 'tap' | 'lg'
  iconOnly?: boolean
  /** Fully rounded ends (a circle when `iconOnly`). */
  round?: boolean
}

function lookClass({ variant = 'primary', size = 'md', iconOnly = false, round = false }: ButtonLook, className?: string) {
  return [styles.btn, styles[variant], styles[size], iconOnly ? styles.iconOnly : '', round ? styles.round : '', className]
    .filter(Boolean).join(' ')
}

/** Extends the full intrinsic button prop set INCLUDING `ref` (React 19 ref-as-prop — it lands
 *  in `...rest` and is forwarded onto the native `<button>`). */
export interface ButtonProps extends React.ComponentPropsWithRef<'button'>, ButtonLook {
  loading?: boolean
}

export function Button({
  variant = 'primary', size = 'md', iconOnly = false, round = false, loading = false,
  disabled, className, children, ...rest
}: ButtonProps) {
  return (
    <button
      className={lookClass({ variant, size, iconOnly, round }, className)}
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

/** A navigation that should look like a Button: a real `<a>`, so it opens in a new tab, shows its
 *  address and is announced as a link. Same variants and sizes as Button; there is no disabled or
 *  loading state because a link has neither. */
export interface ButtonLinkProps extends React.ComponentPropsWithRef<'a'>, ButtonLook {}

export function ButtonLink({ variant = 'primary', size = 'md', iconOnly = false, round = false, className, children, ...rest }: ButtonLinkProps) {
  return (
    <a className={lookClass({ variant, size, iconOnly, round }, className)} {...rest}>
      {children}
    </a>
  )
}
