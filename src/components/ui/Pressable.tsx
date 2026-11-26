import styles from './Pressable.module.css'

interface PressableOwn {
  /** How far it gives when pressed: `compact` (0.97) for tiles and small targets, `large` (0.98)
   *  for full-width rows and cards, `none` when the content animates the press itself. */
  press?: 'compact' | 'large' | 'none'
}

export type PressableProps =
  | (PressableOwn & { as?: 'button' } & React.ComponentPropsWithRef<'button'>)
  | (PressableOwn & { as: 'a' } & React.ComponentPropsWithRef<'a'>)

/**
 * A tap target with no look of its own: a row, a tile, a card that does something when pressed.
 * It brings what every hand-made one has to remember: a real `<button>` (or `<a>`), no browser
 * chrome, the inherited font and colour, the house press scale, the focus ring, and a disabled
 * state. Lay out and paint the inside with `className`.
 */
export function Pressable(props: PressableProps) {
  const { press = 'compact', className, ...rest } = props
  const classes = [styles.pressable, styles[press], className].filter(Boolean).join(' ')
  if (rest.as === 'a') {
    const { as: _as, ...anchor } = rest
    return <a className={classes} {...anchor} />
  }
  const { as: _as, type = 'button', ...buttonProps } = rest
  return <button type={type} className={classes} {...buttonProps} />
}
