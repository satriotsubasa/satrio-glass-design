import ctl from './control.module.css'
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { invalid?: boolean }
export function Textarea({ invalid, className, ...rest }: TextareaProps) {
  return <textarea className={[ctl.control, ctl.textarea, invalid ? ctl.invalid : '', className].filter(Boolean).join(' ')} aria-invalid={invalid || undefined} {...rest} />
}
