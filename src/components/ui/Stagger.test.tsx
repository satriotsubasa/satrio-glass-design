import { readFileSync } from 'node:fs'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Stagger } from './Stagger'

const css = readFileSync('src/components/ui/Stagger.module.css', 'utf8')

const delayOf = (el: HTMLElement) => el.style.animationDelay

describe('Stagger', () => {
  it('cascades its children on first mount', () => {
    render(
      <Stagger step={40}>
        <p>one</p>
        <p>two</p>
        <p>three</p>
      </Stagger>,
    )
    expect(delayOf(screen.getByText('one'))).toBe('0ms')
    expect(delayOf(screen.getByText('two'))).toBe('40ms')
    expect(delayOf(screen.getByText('three'))).toBe('80ms')
  })

  it('caps the delay so a long list never ends in a visible wait', () => {
    render(
      <Stagger step={40} max={2}>
        <p>a</p><p>b</p><p>c</p><p>d</p>
      </Stagger>,
    )
    expect(delayOf(screen.getByText('c'))).toBe('80ms')
    expect(delayOf(screen.getByText('d'))).toBe('80ms')
  })

  it('does NOT re-cascade when the contents change — the point of the component', async () => {
    // A list that re-cascades on every filter keystroke is worse than no animation. After the
    // first render the component stops decorating entirely; later rows just appear.
    function Filterable() {
      const [query, setQuery] = useState('')
      const rows = ['apple', 'apricot', 'banana'].filter((r) => r.startsWith(query))
      return (
        <>
          <input aria-label="filter" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Stagger>{rows.map((r) => <p key={r}>{r}</p>)}</Stagger>
        </>
      )
    }
    render(<Filterable />)
    expect(delayOf(screen.getByText('apricot'))).toBe('40ms')

    await userEvent.type(screen.getByLabelText('filter'), 'b')
    const banana = screen.getByText('banana')
    expect(delayOf(banana), 'a row arriving after mount must not be delayed').toBe('')
    expect(banana.className, 'nor animated').not.toMatch(/item/)
  })

  it('passes non-element children through untouched rather than wrapping them', () => {
    // Wrapping would break `ul > li` and flex/grid gap layouts.
    const { container } = render(<Stagger>plain text</Stagger>)
    expect(container.textContent).toBe('plain text')
  })

  it('preserves a child’s own className and style', () => {
    render(
      <Stagger>
        <p className="mine" style={{ color: 'red' }}>x</p>
      </Stagger>,
    )
    const el = screen.getByText('x')
    expect(el.className).toMatch(/mine/)
    expect(el.style.color).toBe('red')
    expect(el.style.animationDelay).toBe('0ms')
  })

  it('is layout-neutral so it can sit inside an existing flex or grid parent', () => {
    expect(css).toMatch(/\.group\s*\{[^}]*display:\s*contents/)
  })

  it('drops the cascade AND its delays under both reduced-motion signals', () => {
    // Gentler is not enough here: a staggered set of instant appearances is still a queue.
    expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*?animation-delay:\s*0ms/)
    expect(css).toMatch(/data-motion='none'[\s\S]*?animation-delay:\s*0ms/)
  })
})
