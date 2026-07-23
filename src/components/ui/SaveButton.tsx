import { useEffect, useState } from 'react'
import { Check, FloppyDisk } from '@phosphor-icons/react'
import { Button } from './Button'
import styles from './SaveButton.module.css'

export interface SaveButtonProps {
  /** Whether the form has unsaved changes vs. its persisted state. Drives the enabled/label
   *  state and clears a stale "Saved" tick the moment the user edits again. */
  dirty: boolean
  /**
   *  Persists the form and resolves whether the write LANDED. SaveButton reaches the "Saved"
   *  state only on a `true` result — a silently-failed persist (e.g. the settings store's
   *  `updateSettings` resolving `false` after its own error toast) leaves the button back at
   *  "Save" with the draft intact, never a misleading "Saved". Must not throw for the failure
   *  path (return `false`); a thrown error is treated as not-saved too.
   */
  onSave: () => Promise<boolean>
  className?: string
}

/**
 * SaveButton — the shared header save-state control (spec §S8, built in F6, reused by F7 Tax).
 * A three-state machine over the kit `Button`:
 *   - dirty            → filled "Save" (enabled)
 *   - saving           → "Saving" (disabled, in-flight)
 *   - clean + saved ok → "Saved" + Check (disabled)
 *   - clean, no tick   → ghost "Save" (disabled)
 * The saving/savedTick state is owned here so both calculator pages get identical behavior; the
 * page owns only `dirty` and the async `onSave` that returns its persist result.
 */
export function SaveButton({ dirty, onSave, className }: SaveButtonProps) {
  const [saving, setSaving] = useState(false)
  const [savedTick, setSavedTick] = useState(false)

  // Editing again after a save clears the tick, so "Saved" only ever shows for a clean form
  // whose most recent write succeeded.
  useEffect(() => {
    if (dirty && savedTick) setSavedTick(false)
  }, [dirty, savedTick])

  const handleClick = async () => {
    if (saving) return
    setSaving(true)
    setSavedTick(false)
    try {
      const ok = await onSave()
      // Gate the "Saved" state on the persist RESULT — a failed write never shows "Saved".
      if (ok) setSavedTick(true)
    } catch {
      // A thrown persist is a failed save: leave the tick off (the store surfaces its own toast).
    } finally {
      setSaving(false)
    }
  }

  const showSaved = savedTick && !dirty && !saving
  const label = saving ? 'Saving' : showSaved ? 'Saved' : 'Save'

  return (
    <Button
      type="button"
      size="sm"
      variant={dirty ? 'primary' : 'ghost'}
      disabled={!dirty || saving}
      onClick={handleClick}
      className={[styles.save, className].filter(Boolean).join(' ')}
    >
      {showSaved ? <Check size={16} weight="bold" /> : <FloppyDisk size={16} />}
      {label}
    </Button>
  )
}
