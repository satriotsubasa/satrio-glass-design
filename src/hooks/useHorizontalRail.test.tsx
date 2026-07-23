import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'

import { useHorizontalRail } from './useHorizontalRail'

/** Minimal consumer mirroring PillRail's wiring exactly (same handler → same prop), so the
 *  hook is exercised through real React synthetic events rather than by calling handlers
 *  with hand-built objects. */
function Harness() {
  const {
    railRef,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handlePointerLeave,
    handleClickCapture,
    handleKeyDown,
  } = useHorizontalRail()

  return (
    <div
      data-testid="rail"
      ref={railRef}
      tabIndex={0}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      onClickCapture={handleClickCapture}
    />
  )
}

/** Manual clock + rAF harness (same pattern as `useCountUp.test.ts`): `performance.now()` reads
 *  a variable the test advances, and rAF callbacks queue until the test flushes a frame — so the
 *  velocity window and the momentum/wheel decay run on a fully deterministic timeline. */
let nowMs: number
let rafQueue: Map<number, FrameRequestCallback>
let nextRafId: number

/** Advance the clock by `dtMs`, then run every queued rAF callback (as one display frame). */
function flushFrame(dtMs: number) {
  nowMs += dtMs
  const callbacks = Array.from(rafQueue.values())
  rafQueue.clear()
  for (const callback of callbacks) callback(nowMs)
}

beforeEach(() => {
  nowMs = 0
  rafQueue = new Map()
  nextRafId = 1
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextRafId++
    rafQueue.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafQueue.delete(id)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const MOUSE = { pointerId: 1, pointerType: 'mouse', button: 0 }

/** Render a rail with mocked scroll metrics (jsdom has no layout): 1000px content in a 300px
 *  viewport → 700px of scrollable range, plenty for an un-clamped fling. */
function setupRail() {
  const view = render(<Harness />)
  const rail = view.getByTestId('rail')
  Object.defineProperty(rail, 'scrollWidth', { value: 1000, configurable: true })
  Object.defineProperty(rail, 'clientWidth', { value: 300, configurable: true })
  return { rail, unmount: view.unmount }
}

/** Drive a mouse drag: pointerdown at `startX`, then `deltas[i]` px of leftward travel every
 *  `stepMs`. Leftward pointer travel scrolls content rightward (scrollLeft increases). */
function dragLeft(rail: HTMLElement, startX: number, deltas: number[], stepMs: number) {
  fireEvent.pointerDown(rail, { ...MOUSE, clientX: startX })
  let x = startX
  for (const delta of deltas) {
    nowMs += stepMs
    x -= delta
    fireEvent.pointerMove(rail, { pointerId: 1, clientX: x })
  }
  return x
}

describe('useHorizontalRail — release velocity window', () => {
  it('measures release velocity across the ~100ms window, not the last sample pair', () => {
    const { rail } = setupRail()

    // Jittered but on-average-constant drag: alternating 20px/12px steps every 16ms average
    // exactly 1 px/ms. A last-pair implementation would read 12/16 = 0.75 px/ms (or 1.25,
    // depending on parity) — the window must average the jitter away and read 1.0 px/ms.
    dragLeft(rail, 400, [20, 12, 20, 12, 20, 12, 20, 12, 20, 12, 20, 12], 16)
    expect(rail.scrollLeft).toBe(192) // drag tracked 1:1 during the gesture (192px of travel)

    fireEvent.pointerUp(rail, { pointerId: 1 }) // release with zero dwell → full fling
    expect(rafQueue.size).toBe(1) // momentum scheduled

    // First momentum frame: displacement = velocity × dt = 1.0 px/ms × 16.667ms.
    // A stale last-pair velocity (0.75) would land at 204.5 instead.
    flushFrame(16.667)
    expect(rail.scrollLeft).toBeCloseTo(192 + 16.667, 3)
  })

  it('drag, HOLD 2s, release → velocity ≈ 0 and NO momentum (the stale-velocity bug)', () => {
    const { rail } = setupRail()

    // A genuinely fast drag (1 px/ms)…
    dragLeft(rail, 400, [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16], 16)
    expect(rail.scrollLeft).toBe(192)

    // …then the pointer stops dead. pointermove stops firing, so nothing new enters the
    // history; every sample ages past the 100ms window during the hold.
    nowMs += 2000
    fireEvent.pointerUp(rail, { pointerId: 1 })

    // The old single-sample code retained the pre-hold velocity here and flung the rail.
    expect(rafQueue.size).toBe(0) // no momentum frame scheduled
    flushFrame(16.667)
    expect(rail.scrollLeft).toBe(192) // and the rail stays exactly where the user left it
  })
})

describe('useHorizontalRail — dt-normalized momentum decay', () => {
  /** Fling at exactly 1 px/ms, then run the momentum loop at `stepMs` per frame for `frames`
   *  frames (same wall-clock total across calls) and report the coasted distance. */
  function flingDistance(stepMs: number, frames: number): number {
    nowMs = 0
    const { rail, unmount } = setupRail()
    dragLeft(rail, 400, [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16], 16)
    fireEvent.pointerUp(rail, { pointerId: 1 })
    const releaseScrollLeft = rail.scrollLeft
    for (let i = 0; i < frames; i++) flushFrame(stepMs)
    const distance = rail.scrollLeft - releaseScrollLeft
    unmount() // cancels the still-pending momentum frame before the next run
    return distance
  }

  it('coasts the same distance over the same elapsed time at 60Hz and 120Hz', () => {
    // 500ms of coasting either way: 30 × 16.667ms vs 60 × 8.3335ms. The legacy per-frame
    // `*= 0.93` decayed twice as fast at 120Hz (≈11% less distance over this window and a
    // fling that dies in half the time); dt-normalized decay leaves only the integration-step
    // (Riemann) error, well under 3%.
    const at60Hz = flingDistance(16.667, 30)
    const at120Hz = flingDistance(8.3335, 60)

    expect(at60Hz).toBeGreaterThan(100) // sanity: a real fling, nowhere near the 700px clamp
    expect(Math.abs(at60Hz - at120Hz) / at60Hz).toBeLessThan(0.03)
  })

  it('clamps a huge frame gap (background tab) to 50ms — no teleport on resume', () => {
    const { rail } = setupRail()
    dragLeft(rail, 400, [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16], 16)
    fireEvent.pointerUp(rail, { pointerId: 1 }) // velocity = 1 px/ms

    flushFrame(16.667) // normal frame: +16.667px, velocity decays to 0.93
    expect(rail.scrollLeft).toBeCloseTo(208.667, 3)

    // The tab goes to the background for 500ms. That frame must integrate as 50ms
    // (0.93 px/ms × 50ms = 46.5px), NOT as 500ms (which would teleport +465px).
    flushFrame(500)
    expect(rail.scrollLeft).toBeCloseTo(208.667 + 46.5, 3)
    expect(rafQueue.size).toBe(1) // fling still alive and coasting
  })
})

describe('useHorizontalRail — wheel after a fling (stale wheel-target)', () => {
  it('a wheel tick AFTER a completed fling eases FORWARD from the flung position, not back to the stale pre-fling target', () => {
    const { rail } = setupRail()

    // Drag to scrollLeft 192 (the final pointermove syncs the wheel target ref to 192)…
    dragLeft(rail, 400, [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16], 16)
    fireEvent.pointerUp(rail, { pointerId: 1 }) // …then fling at 1 px/ms.

    // Let the momentum run to natural exhaustion (velocity decays below the 0.05 cutoff).
    // Momentum advances scrollLeft WITHOUT resyncing the wheel target ref.
    for (let i = 0; i < 200 && rafQueue.size > 0; i++) flushFrame(16.667)
    expect(rafQueue.size).toBe(0) // fling fully settled
    const flung = rail.scrollLeft
    expect(flung).toBeGreaterThan(300) // sanity: coasted far past the stale 192 target

    // One forward wheel tick. Seeding from the stale ref would target 192 + 30 = 222 — easing
    // the rail hundreds of px BACKWARDS; an idle tick must seed from live scrollLeft instead.
    fireEvent.wheel(rail, { deltaY: 30 })
    flushFrame(16.667)
    expect(rail.scrollLeft).toBeGreaterThan(flung) // first ease frame moves FORWARD

    for (let i = 0; i < 400 && rafQueue.size > 0; i++) flushFrame(16.667)
    expect(rail.scrollLeft).toBeCloseTo(flung + 30, 1) // and settles exactly one tick ahead
  })
})

describe('useHorizontalRail — pointerId guard on drag end', () => {
  it("a foreign pointer's pointerup does NOT end the active mouse drag", () => {
    const { rail } = setupRail()

    dragLeft(rail, 400, [16, 16, 16, 16], 16)
    expect(rail.scrollLeft).toBe(64)

    // A stray up from a pointer that never started this drag must be ignored…
    fireEvent.pointerUp(rail, { pointerId: 99 })

    // …so the original pointer's next move still tracks 1:1 (a cleared drag would ignore it).
    nowMs += 16
    fireEvent.pointerMove(rail, { pointerId: 1, clientX: 400 - 64 - 16 })
    expect(rail.scrollLeft).toBe(80)

    // The owning pointer still ends the drag normally — release velocity ≈ 1 px/ms → momentum.
    fireEvent.pointerUp(rail, { pointerId: 1 })
    expect(rafQueue.size).toBe(1)
  })
})

describe('useHorizontalRail — dt-normalized wheel easing', () => {
  it('keeps the legacy 18%-of-remaining step at exactly 60Hz', () => {
    const { rail } = setupRail()
    fireEvent.wheel(rail, { deltaY: 300 }) // target 300, animation scheduled
    expect(rafQueue.size).toBe(1)

    flushFrame(16.667) // one nominal frame → same 0.18 step the legacy code took
    expect(rail.scrollLeft).toBeCloseTo(300 * 0.18, 3)
  })

  it('eases the same amount over the same elapsed time at 60Hz and 120Hz', () => {
    function wheelProgress(stepMs: number, frames: number): number {
      nowMs = 0
      const { rail, unmount } = setupRail()
      fireEvent.wheel(rail, { deltaY: 300 })
      for (let i = 0; i < frames; i++) flushFrame(stepMs)
      const progress = rail.scrollLeft
      unmount()
      return progress
    }

    // 200ms of easing toward the 300px target either way.
    const at60Hz = wheelProgress(16.667, 12)
    const at120Hz = wheelProgress(8.3335, 24)

    expect(at60Hz).toBeGreaterThan(200) // sanity: most of the way there, not yet snapped
    expect(Math.abs(at60Hz - at120Hz)).toBeLessThan(300 * 0.02)
  })
})
