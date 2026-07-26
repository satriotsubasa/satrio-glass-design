import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Field } from './Field'
import { TextInput } from './TextInput'

describe('Field', () => {
  it('announces the error through a single live region and keeps the hint visible alongside it', () => {
    render(
      <Field label="Name" hint="your name" error="Required" htmlFor="n">
        <TextInput id="n" aria-describedby="n-hint n-error" />
      </Field>,
    )
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('alert')).toHaveTextContent('Required')
    expect(screen.getByText('your name')).toBeInTheDocument()
  })

  it('gives the hint and the error htmlFor-derived ids so aria-describedby can target them', () => {
    render(<Field label="Name" hint="your name" error="Required" htmlFor="n"><TextInput id="n" /></Field>)
    expect(screen.getByText('your name')).toHaveAttribute('id', 'n-hint')
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'n-error')
  })

  it('emits no ids when there is no htmlFor to derive them from', () => {
    render(<Field label="Name" hint="your name" error="Required"><TextInput /></Field>)
    expect(screen.getByText('your name')).not.toHaveAttribute('id')
    expect(screen.getByRole('alert')).not.toHaveAttribute('id')
  })

  it('renders no live region while the field is valid', () => {
    render(<Field label="Name" hint="your name" htmlFor="n"><TextInput id="n" /></Field>)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('your name')).toHaveAttribute('id', 'n-hint')
  })

  it('accepts rich nodes for hint and error', () => {
    render(
      <Field label="Name" hint={<span>see <b>docs</b></span>} error={<span>Required <a href="#x">why?</a></span>} htmlFor="n">
        <TextInput id="n" />
      </Field>,
    )
    expect(screen.getByRole('alert')).toContainElement(screen.getByRole('link', { name: 'why?' }))
    expect(screen.getByText('docs')).toBeInTheDocument()
  })

  it('renders the error after the hint so the hint does not move when validation fires', () => {
    const { container } = render(
      <Field label="Name" hint="your name" error="Required" htmlFor="n"><TextInput id="n" /></Field>,
    )
    expect(Array.from(container.querySelectorAll('p')).map((p) => p.textContent)).toEqual(['your name', 'Required'])
  })
})
