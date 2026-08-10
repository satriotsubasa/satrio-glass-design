import { Children, cloneElement, isValidElement, useEffect, useRef } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import styles from './Stagger.module.css'

export interface StaggerProps {
  children: ReactNode
  /** Delay between consecutive children, in ms. 30–80 is the usable band: past that the list
   *  stops reading as one group arriving and starts reading as a slow queue. */
  step?: number
  /** Stop staggering after this many children. Beyond it every remaining child shares the last
   *  delay, so a long list never ends in a visible wait. */
  max?: number
  className?: string
}

/**
 * Cascades its children in on FIRST MOUNT ONLY.
 *
 * The "first mount only" part is the whole design, not a detail. A cascade is decorative, and
 * emil's frequency rule puts anything seen tens of times a day in "remove or drastically reduce"
 * — so a list that re-cascades every time a filter, a sort or a keystroke changes its contents is
 * strictly worse than no animation at all. After the first render this component stops adding the
 * animation entirely: rows that arrive later simply appear.
 *
 * Use it for a route's first paint. Do not use it for search results.
 *
 * Children must be elements that accept `className` and `style` (every kit component does);
 * strings, numbers and fragments are passed through untouched rather than wrapped, because an
 * extra wrapper element would break `ul > li` and flex/grid gap layouts.
 */
export function Stagger({ children, step = 40, max = 8, className }: StaggerProps) {
  // Not state: flipping state here would re-render and cancel the very animation being played.
  // A ref read during the next render is enough — nothing needs to re-render for this to be true.
  const firstRender = useRef(true)
  useEffect(() => {
    firstRender.current = false
  }, [])
  const cascade = firstRender.current

  return (
    <div className={[styles.group, className].filter(Boolean).join(' ')}>
      {Children.map(children, (child, index) => {
        if (!cascade || !isValidElement(child)) return child
        const element = child as ReactElement<{ className?: string; style?: CSSProperties }>
        return cloneElement(element, {
          className: [element.props.className, styles.item].filter(Boolean).join(' '),
          style: {
            ...element.props.style,
            animationDelay: `${Math.min(index, max) * step}ms`,
          },
        })
      })}
    </div>
  )
}
