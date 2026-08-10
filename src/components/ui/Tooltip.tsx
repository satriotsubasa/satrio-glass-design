import * as RTooltip from '@radix-ui/react-tooltip'
import styles from './Tooltip.module.css'

/** Mount ONCE at the app root, alongside the other kit providers.
 *
 *  It is not optional and `Tooltip` deliberately does not self-provide: the provider is what makes
 *  a SECOND tooltip open instantly. Per-tooltip providers would each keep their own timer, so
 *  moving along a toolbar would re-pay the delay at every icon — the exact feeling this component
 *  exists to avoid. */
export interface TooltipProviderProps {
  children: React.ReactNode
  /** Wait before the FIRST tooltip opens, so brushing past a control does not flash one. */
  delayDuration?: number
  /** Window after one closes during which the next opens with NO delay. */
  skipDelayDuration?: number
}
export function TooltipProvider({
  children,
  delayDuration = 400,
  skipDelayDuration = 1500,
}: TooltipProviderProps) {
  return (
    <RTooltip.Provider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration}>
      {children}
    </RTooltip.Provider>
  )
}

export interface TooltipProps {
  /** The tip itself. Keep it short — a tooltip is a label, not documentation. */
  content: React.ReactNode
  /** The trigger. Must accept a ref and spread props (any kit control does). */
  children: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  className?: string
}

/**
 * A tooltip that opens on hover AND on keyboard focus, and scales from its trigger rather than
 * from its own centre.
 *
 * A tooltip may only ever REPEAT or NAME what is already reachable another way — it is invisible
 * to touch users and to anyone who never hovers, so putting information here that exists nowhere
 * else hides it from them. Icon-only controls still need their own accessible name.
 */
export function Tooltip({ content, children, side = 'top', align = 'center', className }: TooltipProps) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          align={align}
          sideOffset={6}
          className={`${styles.tip} ${className ?? ''}`}
        >
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  )
}
