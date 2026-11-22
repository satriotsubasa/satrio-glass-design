import { useEffect, useRef } from 'react'
import * as RDialog from '@radix-ui/react-dialog'
import styles from './Modal.module.css'
export interface ModalProps { open: boolean; onOpenChange: (open: boolean) => void; title?: string; children: React.ReactNode; footer?: React.ReactNode }
export function Modal({ open, onOpenChange, title, children, footer }: ModalProps) {
  // Radix returns focus to its Trigger on close. This Modal is controlled and has none, so focus
  // fell to <body> after every confirm dialog and page menu. Record what had focus when `open`
  // flipped true (during render: the last moment before Radix moves focus in) and hand it back.
  const openerRef = useRef<HTMLElement | null>(null)
  const wasOpenRef = useRef(false)
  if (open && !wasOpenRef.current && typeof document !== 'undefined') {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
  }
  useEffect(() => { wasOpenRef.current = open })
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className={styles.backdrop} />
        <RDialog.Content className={styles.modal} aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            const opener = openerRef.current
            if (!opener?.isConnected) return // leave it to Radix
            event.preventDefault()
            opener.focus()
          }}>
          {title && <RDialog.Title className={styles.title}>{title}</RDialog.Title>}
          <div>{children}</div>
          {footer && <div className={styles.footer}>{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}
