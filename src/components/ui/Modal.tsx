import * as RDialog from '@radix-ui/react-dialog'
import styles from './Modal.module.css'
export interface ModalProps { open: boolean; onOpenChange: (open: boolean) => void; title?: string; children: React.ReactNode; footer?: React.ReactNode }
export function Modal({ open, onOpenChange, title, children, footer }: ModalProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className={styles.backdrop} />
        <RDialog.Content className={styles.modal} aria-describedby={undefined}>
          {title && <RDialog.Title className={styles.title}>{title}</RDialog.Title>}
          <div>{children}</div>
          {footer && <div className={styles.footer}>{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}
