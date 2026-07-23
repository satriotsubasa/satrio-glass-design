import { Modal } from './Modal'
import { Button } from './Button'
export interface ConfirmDialogProps {
  open: boolean; title: string; message?: string
  confirmLabel?: string; cancelLabel?: string; tone?: 'default' | 'danger'
  /** True while the confirmed action is still in flight (e.g. an optimistic delete awaiting its
   *  result). Disables BOTH Cancel and Confirm (and puts Confirm in its loading state) so a
   *  stray Cancel or a second Confirm click can't be accepted mid-flight, and guards the Modal's
   *  own dismiss path (Escape / outside click) the same way. Defaults to false — existing
   *  callers are unaffected. */
  busy?: boolean
  onConfirm: () => void; onCancel: () => void
}
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'default', busy = false, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal open={open} onOpenChange={(o) => { if (!o && !busy) onCancel() }} title={title}
      footer={<>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy} loading={busy}>{confirmLabel}</Button>
      </>}>
      {message && <p style={{ color: 'var(--label-2)', margin: 0 }}>{message}</p>}
    </Modal>
  )
}
