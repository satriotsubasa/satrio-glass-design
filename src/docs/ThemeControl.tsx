import { useEffect, useState } from 'react'
import { SegmentedControl } from '@satrio/glass-design'

export type DocsThemeMode = 'light' | 'dark' | 'black' | 'system'

const STORAGE_KEY = 'glass-docs-theme'

const THEME_OPTIONS: { value: DocsThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'black', label: 'Black' },
]

function readStoredMode(): DocsThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'black' || raw === 'system') return raw
  } catch {
    // storage may be unavailable (private mode / SSR) — fall through to the default
  }
  return 'system'
}

/**
 * The single theme-stamping mapping. PAIRED with the inline pre-paint boot script in index.html,
 * which duplicates this exact mapping so <html> is themed before first paint (a module import
 * runs too late). Any change here must be mirrored there.
 */
export function applyDocsTheme(mode: DocsThemeMode): void {
  const prefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode
  const root = document.documentElement
  root.dataset.theme = resolved === 'black' ? 'dark' : resolved
  // 'black' is the OLED variant of the dark theme: data-theme stays 'dark', data-theme-mode gates
  // the extra overrides. Removed when leaving black so a later switch doesn't strand the attribute.
  if (resolved === 'black') root.dataset.themeMode = 'black'
  else delete root.dataset.themeMode
  root.style.colorScheme = resolved === 'light' ? 'light' : 'dark'
}

/**
 * The docs app's theme switcher — a package `SegmentedControl` over light/dark/black/system that
 * persists to localStorage['glass-docs-theme'] and stamps <html> via `applyDocsTheme` (the same
 * mapping the pre-paint boot script runs). Mount effect re-asserts the stored theme; the change
 * handler stamps every switch.
 */
export function ThemeControl() {
  const [mode, setMode] = useState<DocsThemeMode>(readStoredMode)

  useEffect(() => {
    applyDocsTheme(mode)
    // Mount-only: the change handler owns every subsequent stamp.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleChange(next: DocsThemeMode) {
    setMode(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // storage unavailable — the in-memory state still drives the stamp below
    }
    applyDocsTheme(next)
  }

  return <SegmentedControl options={THEME_OPTIONS} value={mode} onChange={handleChange} ariaLabel="Theme" />
}
