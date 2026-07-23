import ctl from './control.module.css'
export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> { invalid?: boolean; mono?: boolean }
export function TextInput({ invalid, mono, className, ...rest }: TextInputProps) {
  return <input className={[ctl.control, invalid ? ctl.invalid : '', mono ? ctl.mono : '', className].filter(Boolean).join(' ')} aria-invalid={invalid || undefined} {...rest} />
}
