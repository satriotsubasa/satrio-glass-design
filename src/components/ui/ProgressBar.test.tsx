import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ProgressBar } from './ProgressBar'
import styles from './ProgressBar.module.css'

// NOT `new URL('./…', import.meta.url)` — Vite statically rewrites that pattern into a
// `self.location`-based http URL under jsdom. Raw `import.meta.url` stays a file:// URL
// (same convention as Sheet.test.tsx).
const moduleCss = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'ProgressBar.module.css'), 'utf8')

/** The whole `selector { … }` rule body, matched at a line start so `.fillCap {` cannot match
 *  inside the shared `.fillBody, .fillCap {` prelude. */
function ruleOf(css: string, selector: string): string {
  const start = css.indexOf(`\n${selector} {`)
  expect(start, `${selector} rule must exist`).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('}', start))
}

describe('ProgressBar', () => {
  it('exposes progress as a 0..1 inline --bar-progress, clamped (transform-driven, not width)', () => {
    const { container, rerender } = render(<ProgressBar value={150} max={100} />)
    const fill = () => container.querySelector('[data-fill]') as HTMLElement
    expect(fill().style.getPropertyValue('--bar-progress')).toBe('1')
    expect(fill().style.width).toBe('') // the fill no longer animates width — layout-free

    rerender(<ProgressBar value={-5} max={100} />)
    expect(fill().style.getPropertyValue('--bar-progress')).toBe('0')

    rerender(<ProgressBar value={62} max={100} />)
    expect(fill().style.getPropertyValue('--bar-progress')).toBe('0.62')
  })

  describe('compositor-only structure (design/motion Task 13)', () => {
    it('renders the two painted layers (scaleX body + fixed-radius cap) inside the unscaled fill wrapper', () => {
      const { container } = render(<ProgressBar value={50} />)
      const fill = container.querySelector('[data-fill]') as HTMLElement
      expect(fill.querySelector(`.${styles.fillBody}`)).toBeTruthy()
      expect(fill.querySelector(`.${styles.fillCap}`)).toBeTruthy()
    })

    it('animates the fill body via scaleX(var(--bar-progress)) with origin left, transitioning transform — never width', () => {
      const body = ruleOf(moduleCss, '.fillBody')
      expect(body).toContain('scaleX(var(--bar-progress, 0))')
      expect(body).toContain('transform-origin: left center')
      expect(moduleCss).toMatch(/transition: transform var\(--dur-enter\) var\(--ease-glass\)/)
      expect(moduleCss).not.toMatch(/transition:[^;]*width/)
    })

    it('clips to the pill on the TRACK (overflow hidden + 999px radius) so the scaled body needs no radius of its own', () => {
      const track = ruleOf(moduleCss, '.track')
      expect(track).toContain('overflow: hidden')
      expect(track).toContain('border-radius: 999px')
      expect(ruleOf(moduleCss, '.fillBody')).not.toContain('border-radius')
    })

    it('keeps the leading end-cap round at any fraction: the cap layer translates (fixed geometry), never scales', () => {
      const cap = ruleOf(moduleCss, '.fillCap')
      expect(cap).toContain('border-radius: 999px')
      expect(cap).toContain('translateX(calc(var(--bar-progress, 0) * 100% - 100%))')
      expect(cap).not.toContain('scaleX')
    })

    it('keeps the wave mask on the UNSCALED wrapper so the 12px wavelength never stretches with progress', () => {
      // .wavy is applied to [data-fill] (the wrapper); the scaled layers must carry no mask.
      expect(ruleOf(moduleCss, '.wavy')).toContain('mask-image')
      expect(ruleOf(moduleCss, '.fillBody')).not.toContain('mask')
      const { container } = render(<ProgressBar value={50} barStyle="wavy" />)
      expect(container.querySelector('[data-fill]')).toHaveClass(styles.wavy)
      expect(container.querySelector(`.${styles.fillBody}`)).not.toHaveClass(styles.wavy)
    })
  })

  describe('color override', () => {
    it('sets the fill custom property (--bar-fill) inline when `color` is provided', () => {
      const { container } = render(<ProgressBar value={50} color="#9B59B6" />)
      const fill = container.querySelector('[data-fill]') as HTMLElement
      expect(fill.style.getPropertyValue('--bar-fill')).toBe('#9B59B6')
    })

    it('leaves the tone system untouched when `color` is absent — tone class applied, no inline --bar-fill', () => {
      const { container } = render(<ProgressBar value={50} tone="income" />)
      const fill = container.querySelector('[data-fill]') as HTMLElement
      expect(fill).toHaveClass(styles.income)
      expect(fill.style.getPropertyValue('--bar-fill')).toBe('')
    })

    it('adds the label-tinted contrast-floor class ONLY when `color` is set — tone-only fills keep painting pure var(--bar-fill)', () => {
      // The floor (color-mix 85% colour / 15% var(--label)) keeps arbitrary colours ≥3:1 against
      // the track in dark/black themes; the theme-tuned tone classes must never be re-tinted.
      const { container, rerender } = render(<ProgressBar value={50} color="#673AB7" />)
      expect(container.querySelector('[data-fill]')).toHaveClass(styles.customFill)

      rerender(<ProgressBar value={50} tone="income" />)
      expect(container.querySelector('[data-fill]')).not.toHaveClass(styles.customFill)
    })

    it('4b-N5 regression: the customFill color-mix contrast floor survives on the painted layers', () => {
      // .fill is a non-painting wrapper now, so the floor must land on BOTH layers or an
      // overridden colour paints un-floored.
      const floor = moduleCss.match(/\.customFill [^{]*{[^}]*}/)?.[0] ?? ''
      expect(floor).toContain('color-mix(in srgb, var(--bar-fill) 85%, var(--label))')
      expect(floor).toContain('.fillBody')
      expect(floor).toContain('.fillCap')
    })

    it('keeps the wavy mask class on the fill alongside an overridden colour (the mask is independent of the background)', () => {
      const { container } = render(<ProgressBar value={50} color="#00BCD4" barStyle="wavy" />)
      const fill = container.querySelector('[data-fill]') as HTMLElement
      expect(fill).toHaveClass(styles.wavy)
      expect(fill).toHaveClass(styles.customFill)
      expect(fill.style.getPropertyValue('--bar-fill')).toBe('#00BCD4')
    })
  })

  describe('barStyle prop', () => {
    it("stays the flat 'simple' fill by default — no wavy class", () => {
      const { container } = render(<ProgressBar value={50} />)
      expect(container.querySelector('[data-fill]')).not.toHaveClass(styles.wavy)
    })

    it('applies the wavy fill class when barStyle="wavy" is passed, reactively on rerender', () => {
      const { container, rerender } = render(<ProgressBar value={50} />)

      rerender(<ProgressBar value={50} barStyle="wavy" />)

      const fill = container.querySelector('[data-fill]') as HTMLElement
      expect(fill).toHaveClass(styles.wavy)

      // The role/aria contract is unchanged by the visual variant.
      const track = container.querySelector('[role="progressbar"]') as HTMLElement
      expect(track).toHaveAttribute('aria-valuenow', '50')
      expect(track).toHaveAttribute('aria-valuemax', '100')
    })
  })
})
