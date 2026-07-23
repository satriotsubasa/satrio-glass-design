import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Field } from './Field'
import { TextInput } from './TextInput'

describe('Field', () => {
  it('shows the error and hides the hint when error is present', () => {
    render(<Field label="Name" hint="your name" error="Required" htmlFor="n"><TextInput id="n" /></Field>)
    expect(screen.getByText('Required')).toBeInTheDocument()
    expect(screen.queryByText('your name')).not.toBeInTheDocument()
  })
})
