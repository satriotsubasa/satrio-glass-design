import styles from './Field.module.css'
export interface FieldProps {
  label?: string; hint?: string; error?: string; htmlFor?: string; children: React.ReactNode
}
export function Field({ label, hint, error, htmlFor, children }: FieldProps) {
  return (
    <div className={styles.field}>
      {label && <label className={styles.label} htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <p className={styles.error}>{error}</p> : hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  )
}
