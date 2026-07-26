import styles from './Field.module.css'

export interface FieldProps {
  label?: string
  /* Persistent helper copy. Stays rendered alongside `error` — the format rule is most needed
     at the moment the user got the format wrong, so hint and error are additive, not XOR. */
  hint?: React.ReactNode
  /* Validation copy, rendered into a role="alert" live region. role="alert" is assertive, so
     `error` must only carry a message once it is worth interrupting a screen reader for — set
     it on submit or blur, never per keystroke. */
  error?: React.ReactNode
  htmlFor?: string
  children: React.ReactNode
}

/* Field publishes `${htmlFor}-hint` / `${htmlFor}-error` ids and the CALLER points its control's
   aria-describedby at them. Field must not wire that itself: `children` is often a wrapper
   element rather than the control, so cloning would describe the wrapper. Same reason
   aria-invalid stays on the control primitives (TextInput/Textarea `invalid`) — they own the
   element the attribute has to sit on. No htmlFor means no ids: an id the caller cannot name is
   DOM noise, and it is only nameable when the caller already owns the control id. */
export function Field({ label, hint, error, htmlFor, children }: FieldProps) {
  return (
    <div className={styles.field}>
      {label && <label className={styles.label} htmlFor={htmlFor}>{label}</label>}
      {children}
      {hint ? <p id={htmlFor ? `${htmlFor}-hint` : undefined} className={styles.hint}>{hint}</p> : null}
      {error ? <p id={htmlFor ? `${htmlFor}-error` : undefined} className={styles.error} role="alert">{error}</p> : null}
    </div>
  )
}
