import { useContext, useState } from 'react'
import { describe, it, expect } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { MotionConfigContext } from 'framer-motion'
import { AppMotionConfig, motionConfigReducedMotion, type AppAnimations } from './AppMotionConfig'

/** Reads the reducedMotion value framer components would actually see under the wrapper. */
function Probe() {
  const { reducedMotion } = useContext(MotionConfigContext)
  return <div data-testid="probe">{String(reducedMotion)}</div>
}

describe('motionConfigReducedMotion', () => {
  it("maps 'all' to 'user' (framer follows the OS prefers-reduced-motion preference)", () => {
    expect(motionConfigReducedMotion('all')).toBe('user')
  })

  it("maps 'reduced' to 'always' (framer has no in-between tier — springs/layout snap; the milder CSS cap lives in global.css)", () => {
    expect(motionConfigReducedMotion('reduced')).toBe('always')
  })

  it("maps 'none' to 'always'", () => {
    expect(motionConfigReducedMotion('none')).toBe('always')
  })
})

describe('AppMotionConfig', () => {
  it.each([
    ['all', 'user'],
    ['reduced', 'always'],
    ['none', 'always'],
  ] as const)('provides MotionConfig reducedMotion=%s → "%s" from the animations prop', (mode, expected) => {
    render(
      <AppMotionConfig animations={mode}>
        <Probe />
      </AppMotionConfig>,
    )
    expect(screen.getByTestId('probe')).toHaveTextContent(expected)
  })

  it("defaults to 'all' → 'user' when the animations prop is omitted", () => {
    render(
      <AppMotionConfig>
        <Probe />
      </AppMotionConfig>,
    )
    expect(screen.getByTestId('probe')).toHaveTextContent('user')
  })

  // NOTE this probes the CONTEXT VALUE, which is what updates on a prop change. Mounted motion
  // elements read reducedMotion once at VisualElement mount (framer-motion 12 semantics — see
  // the component doc), so a flip applies to motion elements mounted afterward, not to ones
  // already on screen.
  it('updates the provided context value when the animations prop changes (new motion elements pick up the new mode)', () => {
    function Harness() {
      const [mode, setMode] = useState<AppAnimations>('all')
      return (
        <>
          <button onClick={() => setMode('none')}>flip</button>
          <AppMotionConfig animations={mode}>
            <Probe />
          </AppMotionConfig>
        </>
      )
    }

    render(<Harness />)
    expect(screen.getByTestId('probe')).toHaveTextContent('user')

    act(() => screen.getByText('flip').click())
    expect(screen.getByTestId('probe')).toHaveTextContent('always')
  })
})
