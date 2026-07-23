import { useCallback, useEffect, useRef } from 'react'
import type { KeyboardEvent, MouseEvent, PointerEvent, WheelEvent } from 'react'

type VelocitySample = { x: number; t: number }

type DragState = {
  pointerId: number | null
  startX: number
  startScrollLeft: number
  moved: boolean
  /** Rolling window of recent pointer positions (pruned to VELOCITY_WINDOW_MS on every push).
   *  Release velocity is measured across this window instead of the last inter-frame delta —
   *  a single sample pair is dominated by pointer jitter, and worse, it goes STALE: pointermove
   *  stops firing the instant the pointer stops, so "drag, hold still, release" would fling the
   *  rail with the velocity from before the hold. An emptied/aged-out window reads as ≈0. */
  history: VelocitySample[]
}

/** Nominal frame duration (60Hz) the legacy per-frame factors below were tuned against.
 *  Decay is expressed as `factor ** (dt / FRAME_MS)` so a 120Hz ProMotion panel — or a
 *  stuttering 30Hz one — decelerates over the same wall-clock time as a 60Hz display. */
const FRAME_MS = 16.667
/** Longest dt a single momentum/wheel step may integrate. A backgrounded tab stops rAF
 *  entirely; without this clamp the first frame after resume would integrate the whole
 *  gap (seconds) as one giant teleporting step. */
const MAX_FRAME_DT_MS = 50
/** How far back the release-velocity measurement looks. ~100ms ≈ 6-12 pointer samples:
 *  long enough to average out jitter, short enough that a deliberate stop empties it. */
const VELOCITY_WINDOW_MS = 100
/** Fling friction per nominal frame (dt-normalized at use sites). */
const MOMENTUM_DECAY_PER_FRAME = 0.93
/** Extra damping per nominal frame while pinned at either scroll boundary. */
const BOUNDARY_DECAY_PER_FRAME = 0.72
/** Fraction of the remaining wheel distance covered per nominal frame. */
const WHEEL_EASE_PER_FRAME = 0.18

function pruneHistory(history: VelocitySample[], now: number) {
  while (history.length > 0 && now - history[0].t > VELOCITY_WINDOW_MS) {
    history.shift()
  }
}

function clampScrollLeft(rail: HTMLDivElement, nextScrollLeft: number) {
  return Math.max(0, Math.min(nextScrollLeft, rail.scrollWidth - rail.clientWidth))
}

/** Every real browser implements the Pointer Events capture trio; jsdom (this repo's test
 *  environment) does not, so calling them unconditionally throws as soon as a test drives a
 *  synthetic pointerdown/pointerup sequence through a rail (e.g. `@testing-library/user-event`'s
 *  `click`, which synthesizes a full pointer sequence). Feature-detecting here — rather than at
 *  each call site — keeps every caller a plain `if` without repeating the `typeof` checks, and
 *  matches this repo's existing convention of feature-detecting browser APIs jsdom lacks (see
 *  `MonthTabs.tsx`'s `scrollIntoView`/`matchMedia` guard). No behavior change in any real browser,
 *  where all three methods are always present. */
function hasPointerCaptureSupport(rail: HTMLDivElement): rail is HTMLDivElement & {
  hasPointerCapture: (pointerId: number) => boolean
  setPointerCapture: (pointerId: number) => void
  releasePointerCapture: (pointerId: number) => void
} {
  return (
    typeof rail.hasPointerCapture === 'function' &&
    typeof rail.setPointerCapture === 'function' &&
    typeof rail.releasePointerCapture === 'function'
  )
}

/**
 * Ported (behaviorally) from the Next.js app's `useHorizontalRail` hook, with the fling
 * physics since made precise: release velocity is measured over a ~100ms sample window
 * (not the last inter-frame delta) and the momentum/wheel decay is dt-normalized so it is
 * frame-rate independent. Drives a horizontally-scrolling "rail" (wallet carousel, etc.) with:
 * - mouse-drag-to-scroll with momentum on release,
 * - wheel-to-horizontal-scroll (eased toward a target), including shift+wheel,
 * - keyboard ArrowLeft/ArrowRight paging,
 * - click suppression after a drag so a drag-release doesn't also fire a click.
 */
export function useHorizontalRail() {
  const railRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<DragState>({
    pointerId: null,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
    history: [],
  })
  const wheelTargetRef = useRef<number | null>(null)
  const wheelAnimationFrameRef = useRef<number | null>(null)
  /** performance.now() of the previous wheel-ease tick; null whenever the loop isn't running. */
  const wheelLastTimeRef = useRef<number | null>(null)
  const momentumFrameRef = useRef<number | null>(null)
  const momentumVelocityRef = useRef(0)
  /** performance.now() of the previous momentum tick; null whenever no fling is in flight.
   *  MUST be reset on cancel — a stale timestamp would make a later fling's first frame
   *  integrate the entire idle gap as one giant dt. */
  const momentumLastTimeRef = useRef<number | null>(null)

  const cancelWheelAnimation = useCallback(() => {
    if (wheelAnimationFrameRef.current !== null) {
      cancelAnimationFrame(wheelAnimationFrameRef.current)
      wheelAnimationFrameRef.current = null
    }
    wheelLastTimeRef.current = null
  }, [])

  const cancelMomentum = useCallback(() => {
    if (momentumFrameRef.current !== null) {
      cancelAnimationFrame(momentumFrameRef.current)
      momentumFrameRef.current = null
    }
    momentumVelocityRef.current = 0
    momentumLastTimeRef.current = null
  }, [])

  const animateWheel = useCallback(() => {
    const rail = railRef.current
    if (!rail || wheelTargetRef.current === null) {
      wheelAnimationFrameRef.current = null
      wheelLastTimeRef.current = null
      return
    }

    // First tick after (re)scheduling counts as one nominal frame so the wheel still responds
    // on the very first frame; after that, real elapsed time (clamped) drives the ease.
    const now = performance.now()
    const dt = Math.min(Math.max(now - (wheelLastTimeRef.current ?? now - FRAME_MS), 0), MAX_FRAME_DT_MS)
    wheelLastTimeRef.current = now

    // dt-normalized exponential approach: the REMAINING distance decays as
    // (1 - 0.18) ** (dt / FRAME_MS), which reduces to the legacy `* 0.18` step at exactly 60Hz.
    const step = 1 - Math.pow(1 - WHEEL_EASE_PER_FRAME, dt / FRAME_MS)
    const nextScrollLeft = rail.scrollLeft + (wheelTargetRef.current - rail.scrollLeft) * step
    rail.scrollLeft = clampScrollLeft(rail, nextScrollLeft)

    if (Math.abs((wheelTargetRef.current ?? 0) - rail.scrollLeft) < 0.6) {
      rail.scrollLeft = clampScrollLeft(rail, wheelTargetRef.current ?? rail.scrollLeft)
      wheelAnimationFrameRef.current = null
      wheelLastTimeRef.current = null
      return
    }

    wheelAnimationFrameRef.current = requestAnimationFrame(animateWheel)
  }, [])

  const startMomentum = useCallback(() => {
    const rail = railRef.current
    if (!rail || Math.abs(momentumVelocityRef.current) < 0.05) {
      momentumFrameRef.current = null
      momentumVelocityRef.current = 0
      momentumLastTimeRef.current = null
      return
    }

    // Velocity is px/ms, so each tick integrates the REAL elapsed time (clamped so a
    // background-tab gap can't teleport) instead of the legacy hardcoded `* 18` ms step.
    const now = performance.now()
    const dt = Math.min(Math.max(now - (momentumLastTimeRef.current ?? now), 0), MAX_FRAME_DT_MS)
    momentumLastTimeRef.current = now

    const nextScrollLeft = clampScrollLeft(rail, rail.scrollLeft + momentumVelocityRef.current * dt)
    rail.scrollLeft = nextScrollLeft
    momentumVelocityRef.current *= Math.pow(MOMENTUM_DECAY_PER_FRAME, dt / FRAME_MS)

    if (nextScrollLeft <= 0 || nextScrollLeft >= rail.scrollWidth - rail.clientWidth) {
      momentumVelocityRef.current *= Math.pow(BOUNDARY_DECAY_PER_FRAME, dt / FRAME_MS)
    }

    momentumFrameRef.current = requestAnimationFrame(startMomentum)
  }, [])

  const handleWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    const rail = railRef.current
    if (!rail) return

    const canScrollHorizontally = rail.scrollWidth > rail.clientWidth + 12
    if (!canScrollHorizontally) return

    const prefersHorizontalDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
    const delta = prefersHorizontalDelta ? event.deltaX : (event.shiftKey ? event.deltaX || event.deltaY : event.deltaY)
    if (Math.abs(delta) < 0.1) return

    event.preventDefault()
    cancelMomentum()

    // Accumulate onto the previous target ONLY while a wheel ease is actually in flight (so a
    // burst of ticks compounds instead of each re-basing on a barely-moved scrollLeft). At any
    // other time the ref may be STALE: momentum advances scrollLeft without resyncing it, so
    // seeding from the ref after a fling would ease the rail hundreds of px BACKWARDS to the
    // pre-fling target. An idle wheel tick always starts from where the rail actually is.
    const base = wheelAnimationFrameRef.current !== null && wheelTargetRef.current !== null
      ? wheelTargetRef.current
      : rail.scrollLeft
    const nextTarget = clampScrollLeft(rail, base + delta)
    wheelTargetRef.current = nextTarget

    if (wheelAnimationFrameRef.current === null) {
      wheelAnimationFrameRef.current = requestAnimationFrame(animateWheel)
    }
  }, [animateWheel, cancelMomentum])

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const rail = railRef.current
    if (!rail || event.pointerType !== 'mouse' || event.button !== 0) return

    cancelWheelAnimation()
    cancelMomentum()
    wheelTargetRef.current = rail.scrollLeft

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: rail.scrollLeft,
      moved: false,
      history: [{ x: event.clientX, t: performance.now() }],
    }
  }, [cancelMomentum, cancelWheelAnimation])

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const rail = railRef.current
    if (!rail) return

    const dragState = dragStateRef.current
    if (dragState.pointerId !== event.pointerId) return

    const delta = event.clientX - dragState.startX
    if (!dragStateRef.current.moved && Math.abs(delta) > 8) {
      dragStateRef.current.moved = true
      // Capture only now that a genuine horizontal drag is underway. Capturing on
      // pointerdown would steal move/up events from a child tile and break its
      // tap / 800ms long-press gestures (touch never captured, which is why mobile worked).
      if (hasPointerCaptureSupport(rail) && !rail.hasPointerCapture(event.pointerId)) {
        rail.setPointerCapture(event.pointerId)
      }
    }

    const now = performance.now()
    dragState.history.push({ x: event.clientX, t: now })
    pruneHistory(dragState.history, now)

    if (!dragStateRef.current.moved) return

    event.preventDefault()
    rail.scrollLeft = clampScrollLeft(rail, dragState.startScrollLeft - delta)
    wheelTargetRef.current = rail.scrollLeft
  }, [])

  const clearPointerState = useCallback((event?: PointerEvent<HTMLDivElement>) => {
    const rail = railRef.current
    const dragState = dragStateRef.current

    // Only the pointer that STARTED the drag may end it — a foreign pointer's up/cancel (a
    // second mouse-ish pointer, a stray touch) must not cut the active drag short. Same
    // convention as handlePointerMove/handlePointerLeave's pointerId checks above.
    if (event && dragState.pointerId !== null && dragState.pointerId !== event.pointerId) return

    if (
      event && rail && dragState.pointerId === event.pointerId &&
      hasPointerCaptureSupport(rail) && rail.hasPointerCapture(event.pointerId)
    ) {
      rail.releasePointerCapture(event.pointerId)
    }

    // Measure release velocity across the surviving ~100ms window: oldest in-window sample →
    // the pointer's latest position, over the time from that sample to NOW. Holding still ages
    // every sample out of the window (pointermove stops firing), so the history empties and a
    // drag-then-hold-then-release correctly reads as velocity 0 — no phantom fling.
    const now = performance.now()
    const history = dragState.history
    pruneHistory(history, now)
    let velocity = 0
    if (history.length > 0) {
      const oldest = history[0]
      const latest = history[history.length - 1]
      const elapsed = Math.max(now - oldest.t, 1)
      // Same sign convention as the old single-sample delta: pointer moving LEFT (x decreasing)
      // scrolls content RIGHT (scrollLeft increasing), so velocity is (older x − newer x) / dt.
      velocity = (oldest.x - latest.x) / elapsed
    }

    if (dragState.moved && Math.abs(velocity) > 0.03) {
      momentumVelocityRef.current = velocity
      momentumLastTimeRef.current = now
      if (momentumFrameRef.current === null) {
        momentumFrameRef.current = requestAnimationFrame(startMomentum)
      }
    }

    dragStateRef.current = {
      pointerId: null,
      startX: 0,
      startScrollLeft: rail?.scrollLeft ?? 0,
      moved: dragState.moved,
      history: [],
    }
  }, [startMomentum])

  const handlePointerLeave = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const rail = railRef.current
    if (!rail) return

    const dragState = dragStateRef.current
    if (dragState.pointerId !== event.pointerId) return
    if (hasPointerCaptureSupport(rail) && rail.hasPointerCapture(event.pointerId)) return

    clearPointerState(event)
  }, [clearPointerState])

  const handleClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.moved) return

    event.preventDefault()
    event.stopPropagation()
    dragStateRef.current.moved = false
  }, [])

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const rail = railRef.current
    if (!rail) return

    const canScrollHorizontally = rail.scrollWidth > rail.clientWidth + 12
    if (!canScrollHorizontally) return

    const step = Math.max(rail.clientWidth * 0.72, 160)
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      wheelTargetRef.current = clampScrollLeft(rail, rail.scrollLeft + step)
      cancelMomentum()
      if (wheelAnimationFrameRef.current === null) {
        wheelAnimationFrameRef.current = requestAnimationFrame(animateWheel)
      }
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      wheelTargetRef.current = clampScrollLeft(rail, rail.scrollLeft - step)
      cancelMomentum()
      if (wheelAnimationFrameRef.current === null) {
        wheelAnimationFrameRef.current = requestAnimationFrame(animateWheel)
      }
    }
  }, [animateWheel, cancelMomentum])

  useEffect(() => () => {
    cancelWheelAnimation()
    cancelMomentum()
  }, [cancelMomentum, cancelWheelAnimation])

  return {
    railRef,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp: clearPointerState,
    handlePointerCancel: clearPointerState,
    handlePointerLeave,
    handleClickCapture,
    handleKeyDown,
  }
}
