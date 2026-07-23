import { useMemo, type ReactNode } from 'react'
import { IconContext, type IconWeight } from '@phosphor-icons/react'

interface IconProviderProps {
  children: ReactNode
  /** The user's chosen Phosphor icon weight. This package holds no settings store of its own —
   *  the caller reads `iconWeight` from its own store and passes it down here. Defaults to
   *  'duotone' so a caller that hasn't wired a store yet still gets a valid weight. */
  weight?: IconWeight
}

/**
 * Mounts the Phosphor `IconContext` at the app root so every `CategoryIcon`
 * (and any other Phosphor icon) inherits the caller's chosen weight, and always
 * inherits color from the surrounding element via `currentColor` rather than
 * a hardcoded hex.
 */
export function IconProvider({ children, weight = 'duotone' }: IconProviderProps) {
  // Memoize so a parent re-render (e.g. a theme-mode change above this provider)
  // doesn't hand every Phosphor icon in the tree a fresh context value and force
  // needless re-renders — the value only actually changes when `weight` changes.
  const value = useMemo(() => ({ weight, color: 'currentColor' }), [weight])

  return <IconContext.Provider value={value}>{children}</IconContext.Provider>
}
