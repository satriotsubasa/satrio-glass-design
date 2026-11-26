import button from './Button.module.css'
import styles from './IconButton.module.css'

/** A button that is only an icon: back, close, clear, more. `label` is required and becomes the
 *  accessible name, because an icon has none. The drawn size is 32, 36 or 44px; whatever is drawn,
 *  the area that takes a tap is at least 44px (`--tap-min`). */
export interface IconButtonProps extends Omit<React.ComponentPropsWithRef<'button'>, 'children' | 'aria-label'> {
  label: string
  icon: React.ReactNode
  size?: 32 | 36 | 44
  variant?: 'ghost' | 'tonal' | 'outline' | 'primary' | 'danger'
  /** A circle (default) or the control radius. */
  round?: boolean
  loading?: boolean
}

export function IconButton({
  label, icon, size = 36, variant = 'ghost', round = true, loading = false, disabled, className, type = 'button', ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={[button.btn, button[variant], styles.icon, styles[`s${size}`], round ? button.round : '', className]
        .filter(Boolean).join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className={button.spinner} aria-hidden /> : icon}
    </button>
  )
}
