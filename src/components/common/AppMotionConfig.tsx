import type { ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'

/** The app-level animation preference this wrapper maps onto framer-motion's `reducedMotion`.
 *  Copied verbatim from the consuming app's settings union — this package holds no settings
 *  store of its own; callers own the store and pass the current mode down via `animations`. */
export type AppAnimations = 'all' | 'reduced' | 'none'

/**
 * Maps the Settings `appAnimations` mode onto framer-motion's `MotionConfig.reducedMotion`,
 * which only knows 'always' | 'never' | 'user':
 *
 * - 'all'     → 'user'   — framer follows the OS prefers-reduced-motion preference (its default).
 * - 'reduced' → 'always' — framer has no in-between tier, so 'reduced' takes the same 'always'
 *                          gate as 'none': spring/layout/transform animations snap while
 *                          opacity/color animations still run (framer's reduced-motion
 *                          semantics). CSS transitions get the milder 60ms cap from global.css's
 *                          `:root[data-motion='reduced']` block instead.
 * - 'none'    → 'always' — same framer gate; global.css's `:root[data-motion='none']` block
 *                          makes every CSS transition/animation instant on top. Framer's
 *                          'always' intentionally keeps opacity/color tweens (its accessibility
 *                          stance), so e.g. sheet/backdrop fades remain — movement is gone.
 *
 * Note `reducedMotion: 'always'` gates ANIMATIONS only, not gestures: drag (and the Sheet's
 * swipe-to-dismiss) keeps working. The Sheet's own `useReducedMotion()` reads ONLY the OS-level
 * preference (framer's public hook never consults MotionConfig), so this wrapper cannot flip the
 * Sheet's `dragEnabled` off — verified against framer-motion 12's
 * `utils/reduced-motion/use-reduced-motion.mjs` (OS media query only) vs the internal
 * `useReducedMotionConfig`/`VisualElement.shouldReduceMotion` (MotionConfig-aware, animations
 * only — positional keys get `{ type: false }`, gestures untouched).
 */
export function motionConfigReducedMotion(mode: AppAnimations): 'always' | 'user' {
  return mode === 'all' ? 'user' : 'always'
}

/**
 * The framer-motion consumer for Settings > appAnimations. Wraps the app once (App.tsx, next to
 * IconProvider) and re-renders when `animations` changes, keeping the context value live (context
 * flows through `createPortal`, so portal'd Sheets/Modals are covered too). This component holds
 * no settings store of its own — the caller reads `appAnimations` from its own store and passes it
 * down via `animations`. The CSS side of the same setting lives in the consuming app's global.css
 * (`data-motion` blocks).
 *
 * MOUNT-TIME SEMANTICS, verified against framer-motion 12: a motion element reads
 * `MotionConfig.reducedMotion` once, when its VisualElement mounts (`useVisualElement` passes it
 * to the constructor only on first render; `VisualElement.mount()` resolves
 * `shouldReduceMotion` once and `update()` never refreshes it). So flipping the setting applies
 * to motion elements mounted AFTERWARD; already-mounted ones keep their mount-time gate until
 * they remount. In practice that covers everything: the app's framer surfaces (Sheet
 * open/close, per-route mounts) all mount fresh after a settings change, and an animations
 * setting reasonably applies "from now on". (Forcing live retune via `key={mode}` on
 * MotionConfig would remount the ENTIRE app subtree — unmounting every page — for a rare
 * settings flip; deliberately not worth it.)
 */
export function AppMotionConfig({ children, animations = 'all' }: { children: ReactNode; animations?: AppAnimations }) {
  return <MotionConfig reducedMotion={motionConfigReducedMotion(animations)}>{children}</MotionConfig>
}
