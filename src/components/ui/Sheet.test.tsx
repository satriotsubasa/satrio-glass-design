import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sheet, makeSheetVariants, shouldDismiss } from './Sheet'

/** jsdom in this env ships no `window.matchMedia`; isBottomSheetViewport() guards on that and
 *  reads desktop. Stub it to steer the presentation branch, restore whatever was there before. */
function stubMatchMedia(matches: boolean): () => void {
  const original = window.matchMedia
  window.matchMedia = ((query: string) =>
    ({ matches, media: query, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() })) as unknown as typeof window.matchMedia
  return () => { window.matchMedia = original }
}

/** Await one browser rAF tick — lets framer's frameloop (PanSession's frame-throttled
 *  updatePoint, the postRender-deferred onDragEnd) process a step. */
function frame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

describe('shouldDismiss — projection contract: offset + projected coast > 120px', () => {
  // The release dismisses when the PROJECTED landing point crosses one 120px threshold:
  // project(v) = (v/1000) · 0.998/(1−0.998) ≈ v · 0.499 — Apple's deceleration form.
  it('a flick from rest dismisses: 601px/s projects to ~300px of coast', () => {
    expect(shouldDismiss(0, 601)).toBe(true)
  })
  it('a slow deliberate drag past the threshold dismisses even at rest (130 > 120)', () => {
    expect(shouldDismiss(130, 0)).toBe(true)
  })
  it('a short, slow drag springs back: 50px + ~50px projected ≈ 100px < 120', () => {
    expect(shouldDismiss(50, 100)).toBe(false)
  })
  it("closes the old rule's DEAD ZONE: 80px @ 500px/s lands at 80 + ~249 ≈ 329px", () => {
    // Under the old independent thresholds (offset > 90 || velocity > 600) this read as
    // neither (80 < 90, 500 < 600) and sprang back — though the throw was clearly a dismissal.
    expect(shouldDismiss(80, 500)).toBe(true)
  })
  it('INTENTIONAL behavior delta: a 91px drag released at rest NO LONGER dismisses (91 < 120)', () => {
    // The old rule dismissed at offset > 90 regardless of velocity. Deliberate change:
    // velocity ≈ 0 means the user stopped mid-drag and is hesitating — springing back is the
    // correct read. If user feedback disagrees, tune the 120px threshold in Sheet.tsx,
    // never the projection form.
    expect(shouldDismiss(91, 0)).toBe(false)
  })
})

/**
 * Mirrors the real editor→picker shape: the OUTER sheet is mounted (and can be opened) first,
 * while the INNER sheet's `open` state lives in a DESCENDANT of the outer's children — so
 * opening the inner re-renders only that descendant, never the outer Sheet. This is exactly the
 * commit pattern that broke the old registration-order Escape layering.
 */
function InnerHost({ onInnerClose }: { onInnerClose: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>open inner</button>
      <Sheet open={open} onClose={() => { onInnerClose(); setOpen(false) }} title="Inner">
        <button type="button">inner action</button>
      </Sheet>
    </>
  )
}

function NestedLateHarness({ onOuterClose, onInnerClose }: { onOuterClose: () => void; onInnerClose: () => void }) {
  const [outerOpen, setOuterOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOuterOpen(true)}>open outer</button>
      <Sheet open={outerOpen} onClose={() => { onOuterClose(); setOuterOpen(false) }} title="Outer">
        <InnerHost onInnerClose={onInnerClose} />
      </Sheet>
    </>
  )
}

describe('Sheet — Escape key layer-awareness (explicit sheet stack)', () => {
  it('calls onClose on a plain Escape keydown (no layer above handled it)', () => {
    const onClose = vi.fn()
    render(
      <Sheet open onClose={onClose} title="Test">
        <p>Body</p>
      </Sheet>,
    )

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    window.dispatchEvent(event)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onClose when the Escape keydown was already defaultPrevented (e.g. a stacked Radix ConfirmDialog handled it)', () => {
    const onClose = vi.fn()
    render(
      <Sheet open onClose={onClose} title="Test">
        <p>Body</p>
      </Sheet>,
    )

    // Simulate Radix's DismissableLayer having already consumed the Escape (it calls
    // preventDefault() on the event it handles) before this window listener runs.
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    event.preventDefault()
    window.dispatchEvent(event)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls preventDefault() after handling a plain Escape, so it acts as a DismissableLayer for a STACKED kit Sheet too', () => {
    const onClose = vi.fn()
    render(
      <Sheet open onClose={onClose} title="Test">
        <p>Body</p>
      </Sheet>,
    )

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    window.dispatchEvent(event)

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('two nested kit Sheets both open in the SAME commit: one Escape closes only the innermost (topmost) Sheet, not the outer one underneath it', () => {
    const onCloseOuter = vi.fn()
    const onCloseInner = vi.fn()
    render(
      <Sheet open onClose={onCloseOuter} title="Outer">
        <Sheet open onClose={onCloseInner} title="Inner">
          <p>Inner body</p>
        </Sheet>
      </Sheet>,
    )

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    window.dispatchEvent(event)

    expect(onCloseInner).toHaveBeenCalledTimes(1)
    expect(onCloseOuter).not.toHaveBeenCalled()
  })

  it('inner sheet opened in a LATER commit than the outer (the real picker flow): the first Escape closes ONLY the inner, the second closes the outer', async () => {
    const user = userEvent.setup()
    const onOuterClose = vi.fn()
    const onInnerClose = vi.fn()
    render(<NestedLateHarness onOuterClose={onOuterClose} onInnerClose={onInnerClose} />)

    await user.click(screen.getByRole('button', { name: 'open outer' }))
    await user.click(screen.getByRole('button', { name: 'open inner' }))

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onInnerClose).toHaveBeenCalledTimes(1)
    expect(onOuterClose).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onOuterClose).toHaveBeenCalledTimes(1)
    expect(onInnerClose).toHaveBeenCalledTimes(1)
  })
})

describe('Sheet — focus management (initial focus / trap / restore)', () => {
  it('moves focus to the dialog container on open and restores the opener on close (at the START of the exit animation)', () => {
    const ui = (open: boolean) => (
      <>
        <button type="button">opener</button>
        <Sheet open={open} onClose={vi.fn()} title="Test">
          <button type="button">inside</button>
        </Sheet>
      </>
    )
    const { rerender } = render(ui(false))
    const opener = screen.getByRole('button', { name: 'opener' })
    opener.focus()
    expect(document.activeElement).toBe(opener)

    rerender(ui(true))
    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: 'Test' }))

    // AnimatePresence keeps the dialog in the DOM while it exit-animates, but the restore runs
    // in the same commit `open` flips false — the opener regains focus immediately.
    rerender(ui(false))
    expect(document.activeElement).toBe(opener)
  })

  it('restores the opener when the whole Sheet unmounts while open (AmountKeypad-style `<Sheet open …>` consumers)', () => {
    render(<button type="button">opener</button>)
    const opener = screen.getByRole('button', { name: 'opener' })
    opener.focus()

    const { unmount } = render(
      <Sheet open onClose={vi.fn()} title="Keypad">
        <button type="button">key</button>
      </Sheet>,
    )
    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: 'Keypad' }))

    unmount()
    expect(document.activeElement).toBe(opener)
  })

  it('does not throw on close when the opener unmounted while the sheet was open (focus is left alone)', () => {
    const ui = (withOpener: boolean, open: boolean) => (
      <>
        {withOpener && <button type="button">opener</button>}
        <Sheet open={open} onClose={vi.fn()} title="Test">
          <button type="button">inside</button>
        </Sheet>
      </>
    )
    const { rerender } = render(ui(true, false))
    screen.getByRole('button', { name: 'opener' }).focus()
    rerender(ui(true, true))
    rerender(ui(false, true))
    expect(() => rerender(ui(false, false))).not.toThrow()
  })

  it('contains Tab at the boundaries: Tab on the last focusable wraps to the first, Shift+Tab on the first wraps to the last; middle elements keep native tabbing', () => {
    render(
      <Sheet open onClose={vi.fn()} title="Trap" footer={<button type="button">last</button>}>
        <button type="button">first</button>
        <button type="button">middle</button>
      </Sheet>,
    )
    const first = screen.getByRole('button', { name: 'first' })
    const middle = screen.getByRole('button', { name: 'middle' })
    const last = screen.getByRole('button', { name: 'last' })

    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)

    // A middle element's Tab is NOT intercepted — native focus traversal handles it (the portal
    // sits at the end of <body>, so in-dialog document order is already correct).
    middle.focus()
    const notPrevented = fireEvent.keyDown(middle, { key: 'Tab' })
    expect(notPrevented).toBe(true)
  })

  it('from the container itself (its initial-focus state): Tab moves to the first focusable, Shift+Tab wraps to the last', () => {
    render(
      <Sheet open onClose={vi.fn()} title="Trap">
        <button type="button">first</button>
        <button type="button">last</button>
      </Sheet>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Trap' })
    expect(document.activeElement).toBe(dialog)

    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'first' }))

    dialog.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'last' }))
  })

  it('a sheet with no focusable descendants keeps focus parked on the container (Tab is swallowed)', () => {
    render(
      <Sheet open onClose={vi.fn()} title="Empty">
        <p>Text only</p>
      </Sheet>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Empty' })
    expect(document.activeElement).toBe(dialog)

    const notPrevented = fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(notPrevented).toBe(false)
    expect(document.activeElement).toBe(dialog)
  })

  it("a NESTED sheet's Tab is contained by the inner trap only — the outer sheet's trap ignores keydowns whose target lives in the sibling portal", async () => {
    const user = userEvent.setup()
    render(<NestedLateHarness onOuterClose={vi.fn()} onInnerClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'open outer' }))
    await user.click(screen.getByRole('button', { name: 'open inner' }))

    // The inner sheet has exactly one focusable — it is both first AND last, so Tab wraps onto
    // itself instead of being hijacked into the outer sheet's focusables.
    const innerAction = screen.getByRole('button', { name: 'inner action' })
    innerAction.focus()
    fireEvent.keyDown(innerAction, { key: 'Tab' })
    expect(document.activeElement).toBe(innerAction)
  })

  it('nested restore chain: closing the inner restores its trigger inside the outer, closing the outer restores the original opener', async () => {
    const user = userEvent.setup()
    render(<NestedLateHarness onOuterClose={vi.fn()} onInnerClose={vi.fn()} />)

    const fab = screen.getByRole('button', { name: 'open outer' })
    await user.click(fab)
    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: 'Outer' }))

    const trigger = screen.getByRole('button', { name: 'open inner' })
    await user.click(trigger)
    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: 'Inner' }))

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.activeElement).toBe(trigger)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.activeElement).toBe(fab)
  })
})

describe('Sheet — parent push-back while a child sheet is stacked above (Apple §12)', () => {
  // The picker-over-editor shape: while a child sheet outranks its parent on the module stack,
  // the parent recedes (the `stacked` variant — scale 0.94, y −8) and restores to `visible`
  // when it is top-most again. `data-stacked` mirrors the animate state on the dialog element
  // (the variant itself is not observable from the DOM until the spring settles).
  it('marks the parent pushed-back while the inner sheet is open, and restores it when the inner closes', async () => {
    const user = userEvent.setup()
    render(<NestedLateHarness onOuterClose={vi.fn()} onInnerClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'open outer' }))
    const outer = screen.getByRole('dialog', { name: 'Outer' })
    expect(outer).not.toHaveAttribute('data-stacked') // alone on the stack → top-most

    await user.click(screen.getByRole('button', { name: 'open inner' }))
    expect(outer).toHaveAttribute('data-stacked', 'true') // a child is above → pushed back
    expect(screen.getByRole('dialog', { name: 'Inner' })).not.toHaveAttribute('data-stacked')

    fireEvent.keyDown(window, { key: 'Escape' }) // closes only the inner (stack top)
    expect(outer).not.toHaveAttribute('data-stacked') // top-most again → restored
  })

  it('the stacked variant recedes scale/y at full motion and stays still (opacity-only) under reduced motion', () => {
    // Reduced motion: the push-back is a decorative sweep the user did not author — the variant
    // must equal `visible` so no movement happens at all (Apple §14).
    expect(makeSheetVariants(false).stacked).toMatchObject({ opacity: 1, scale: 0.94, y: -8 })
    expect(makeSheetVariants(true).stacked).toEqual({ opacity: 1 })
  })
})

describe('Sheet — accessible naming', () => {
  it('names the dialog via aria-labelledby when provided, suppressing the aria-label-from-title path', () => {
    render(
      <Sheet open onClose={vi.fn()} title="Fallback Title" ariaLabelledby="sheet-heading">
        <h2 id="sheet-heading">Chrome Heading</h2>
      </Sheet>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Chrome Heading' })
    expect(dialog).toHaveAttribute('aria-labelledby', 'sheet-heading')
    expect(dialog).not.toHaveAttribute('aria-label')
  })

  it('keeps the aria-label-from-title path when no ariaLabelledby is given (backward compatible)', () => {
    render(
      <Sheet open onClose={vi.fn()} title="Plain Title">
        <p>Body</p>
      </Sheet>,
    )
    expect(screen.getByRole('dialog', { name: 'Plain Title' })).toHaveAttribute('aria-label', 'Plain Title')
  })
})

describe('Sheet — grabber-driven drag: framer must never stamp touch-action on the sheet again', () => {
  // THE regression guard for the tall-sheet mobile scroll bug. framer stamps an inline
  // `touch-action: pan-x` onto the draggable element whenever `drag` is set with
  // `dragListener !== false` (framer-motion render/html/use-props.mjs). The `.sheet` is itself
  // the `overflow-y: auto` scroller, so that stamp made any sheet taller than its max-height
  // (IconPickerSheet, CurrencyPicker, long category lists) unscrollable by finger —
  // unrecoverably, since the old `atTop` re-enable could only flip via an `onScroll` a blocked
  // touch can never fire. The drag now starts ONLY via dragControls (the grabber always; the
  // sheet body only while its content does not overflow — see the whole-surface suite below).
  it('default variant: drag is armed via dragControls, but NO inline touch-action appears on the sheet element', () => {
    render(
      <Sheet open onClose={vi.fn()} title="Default">
        <p>Body</p>
      </Sheet>,
    )

    // `Sheet` renders via `createPortal(..., document.body)` — the dialog isn't a descendant of
    // RTL's own container, so it has to be queried from `document.body` directly.
    const sheetEl = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(sheetEl).toBeTruthy()
    expect(sheetEl.style.touchAction).toBeFalsy()
  })

  it('full variant: drag is armed too (grabber-dismissable editors) — still NO inline touch-action on the sheet', () => {
    // The old full-variant drag ban was itself a workaround for the touch-action stamp; with the
    // grabber-driven model the ban is gone, and the stamp must STAY gone.
    render(
      <Sheet open onClose={vi.fn()} title="Full" variant="full">
        <p>Body</p>
      </Sheet>,
    )

    const sheetEl = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(sheetEl).toBeTruthy()
    expect(sheetEl.style.touchAction).toBeFalsy()
  })

  it('full variant: a grabber drag past the projection threshold requests close (swipe-dismiss reaches the full editors)', async () => {
    const onClose = vi.fn()
    render(
      <Sheet open onClose={onClose} title="Full editor" variant="full">
        <p>Editor body</p>
      </Sheet>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Full editor' })
    const grabber = dialog.querySelector('span[aria-hidden="true"]') as HTMLElement
    expect(grabber).toBeTruthy()

    const pointer = { pointerType: 'mouse', isPrimary: true, button: 0, clientX: 200 }
    fireEvent.pointerDown(grabber, { ...pointer, clientY: 300 })
    fireEvent.pointerMove(window, { ...pointer, clientY: 340 })
    await frame()
    await frame() // PanSession's frame-throttled updatePoint fires onDragStart past the 3px threshold
    fireEvent.pointerMove(window, { ...pointer, clientY: 520 })
    await frame()
    fireEvent.pointerUp(window, { ...pointer, clientY: 520 }) // offset +220 > 120px projection threshold

    await frame()
    await frame() // onDragEnd is frame.postRender-deferred
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('structural guard: Sheet.tsx keeps the REAL grabber-drag prop cluster — drag + dragListener={false} + dragControls', () => {
    // The rendered-style assertions above would also pass if drag were removed entirely; this
    // pins the mechanism itself so the framer stamp cannot return via a "simplifying" refactor
    // that re-enables the built-in drag listener.
    // NOT `new URL('./Sheet.tsx', import.meta.url)` — Vite statically rewrites that pattern
    // into a `self.location`-based http URL. Raw `import.meta.url` stays a file:// URL.
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Sheet.tsx'), 'utf8')
    // Anchored to the CONTIGUOUS JSX prop cluster (not a bare `dragListener={false}` match,
    // which a comment or template string could satisfy): the drag axis prop, the listener
    // suppression, and the dragControls handoff must sit together on the motion element.
    expect(source).toMatch(/drag=\{[^}]+\}\s+dragListener=\{false\}\s+dragControls=\{dragControls\}/)
    expect(source).toMatch(/dragControls=\{dragControls\}/)
  })
})

describe('Sheet — exit spring must actually receive the drag velocity (makeSheetVariants)', () => {
  // motion-dom's getSpringOptions() executes `springOptions.velocity = 0` whenever
  // duration/bounce keys are present WITHOUT physics keys — the old
  // `{ type: 'spring', bounce: 0, duration: 0.3, velocity }` exit produced byte-identical
  // trajectories for velocity 0 and 800: the whole custom-velocity channel was plumbing a
  // value the spring threw away. The exit's y spring must stay PHYSICS-KEYED.
  it('bottom-sheet exit: y is a stiffness/damping spring carrying the throw; duration/bounce must never reappear on it', () => {
    const restore = stubMatchMedia(true) // ≤640px — the bottom-sheet presentation
    try {
      const exit = makeSheetVariants(false).exit as unknown as (v: number) => {
        opacity: number
        y: string
        transition: Record<string, Record<string, unknown>>
      }
      const def = exit(842)
      expect(def.y).toBe('100%')
      expect(def.transition.y).toMatchObject({ type: 'spring', stiffness: 305, damping: 35, velocity: 842 })
      // The zeroing trap: these keys on the y spring would silently discard the velocity again.
      expect(def.transition.y.duration).toBeUndefined()
      expect(def.transition.y.bounce).toBeUndefined()
      // Opacity keeps its own tween, scoped per-value so the fade never routes through the spring.
      expect(def.transition.opacity).toMatchObject({ duration: 0.2 })
    } finally {
      restore()
    }
  })

  it('desktop centered dialog keeps its in-place fade/scale exit (no slide, no spring)', () => {
    const restore = stubMatchMedia(false)
    try {
      const exit = makeSheetVariants(false).exit as unknown as (v: number) => Record<string, unknown>
      const def = exit(842)
      expect(def).toMatchObject({ opacity: 0, scale: 0.96, y: 10 })
      expect((def.transition as Record<string, unknown>).duration).toBe(0.32)
    } finally {
      restore()
    }
  })

  it('reduced motion exits with the 0.2s cross-fade regardless of velocity', () => {
    const exit = makeSheetVariants(true).exit as unknown as (v: number) => Record<string, unknown>
    expect(exit(9999)).toEqual({ opacity: 0, transition: { duration: 0.2 } })
  })
})

describe('Sheet — backdrop click vs grabber drag (the synthesized-click guard)', () => {
  // Per UI Events, a mouse/pen drag that starts on the grabber and RELEASES over the backdrop
  // dispatches a `click` on their common ancestor — the backdrop ITSELF (so a target check
  // cannot help). Without the drag-session guard, an UPWARD (rubber-banded, non-dismissing)
  // drag still force-closed the sheet through that click. The sequence below drives framer's
  // real PanSession: pointerdown on the grabber arms dragControls, window pointermoves cross
  // the 3px pan threshold, pointerup releases — then the synthesized click lands BEFORE
  // framer's frame-deferred onDragEnd, exactly as in a real browser.
  it('a grabber drag released over the backdrop does NOT close the sheet; a later real click still does', async () => {
    const onClose = vi.fn()
    render(
      <Sheet open onClose={onClose} title="Guard">
        <p>Body</p>
      </Sheet>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Guard' })
    const backdrop = dialog.parentElement as HTMLElement
    const grabber = dialog.querySelector('span[aria-hidden="true"]') as HTMLElement
    expect(grabber).toBeTruthy()

    const pointer = { pointerType: 'mouse', isPrimary: true, button: 0, clientX: 200 }
    fireEvent.pointerDown(grabber, { ...pointer, clientY: 500 })
    fireEvent.pointerMove(window, { ...pointer, clientY: 480 })
    await frame()
    await frame() // PanSession's frame-throttled updatePoint fires onDragStart past the 3px threshold
    fireEvent.pointerMove(window, { ...pointer, clientY: 460 })
    await frame()
    fireEvent.pointerUp(window, { ...pointer, clientY: 460 }) // upward drag: offset −40 → spring back

    // The browser's synthesized click on the backdrop — jsdom doesn't synthesize it, so
    // dispatch it exactly where UI Events says it lands, before any frame has passed.
    fireEvent.click(backdrop)
    expect(onClose).not.toHaveBeenCalled()

    // Let onDragEnd (frame.postRender) and the one-frame-later session clear run.
    await frame()
    await frame()
    await frame()
    expect(onClose).not.toHaveBeenCalled() // the spring-back decision stood

    fireEvent.click(backdrop) // a REAL click after the session — closes normally
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a plain backdrop click (no drag session) closes the sheet', () => {
    const onClose = vi.fn()
    render(
      <Sheet open onClose={onClose} title="Plain">
        <p>Body</p>
      </Sheet>,
    )
    const backdrop = screen.getByRole('dialog', { name: 'Plain' }).parentElement as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('Sheet — body scroll lock while open (react-remove-scroll)', () => {
  // The page BEHIND a sheet used to keep scrolling under backdrop/sheet pans — the portal had no
  // scroll lock at all (the Radix Modal always had one via the react-remove-scroll Radix Dialog
  // composes in). The Sheet now wraps its open layer in <RemoveScroll>, whose lock is the
  // ref-counted `data-scroll-locked` attribute on <body> (react-remove-scroll-bar injects
  // `body[data-scroll-locked] { overflow: hidden }` against it).
  it('locks body scroll while open and releases it after the close finishes', async () => {
    const ui = (open: boolean) => (
      <Sheet open={open} onClose={vi.fn()} title="Lock">
        <p>Body</p>
      </Sheet>
    )
    const { rerender } = render(ui(false))
    expect(document.body).not.toHaveAttribute('data-scroll-locked')

    rerender(ui(true))
    expect(document.body).toHaveAttribute('data-scroll-locked')

    // The lock holds THROUGH the exit animation (the layer is still on screen) and releases
    // when AnimatePresence finally unmounts it.
    rerender(ui(false))
    await waitFor(() => expect(document.body).not.toHaveAttribute('data-scroll-locked'), { timeout: 3000 })
  })

  it('nested-safe: two open sheets ref-count the lock — inner closing keeps it, all closed releases it', async () => {
    const ui = (outerOpen: boolean, innerOpen: boolean) => (
      <Sheet open={outerOpen} onClose={vi.fn()} title="Outer">
        <Sheet open={innerOpen} onClose={vi.fn()} title="Inner">
          <p>Inner body</p>
        </Sheet>
      </Sheet>
    )
    const { rerender } = render(ui(true, true))
    expect(document.body.getAttribute('data-scroll-locked')).toBe('2')

    rerender(ui(true, false))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Inner' })).not.toBeInTheDocument(), { timeout: 3000 })
    expect(document.body).toHaveAttribute('data-scroll-locked') // outer still holds it

    rerender(ui(false, false))
    await waitFor(() => expect(document.body).not.toHaveAttribute('data-scroll-locked'), { timeout: 3000 })
  })
})

describe('Sheet — whole-surface drag on NON-scrollable sheets (bottom-sheet viewports)', () => {
  // A short sheet (edit account, confirm-style) has no scroll gesture to protect, so a swipe
  // ANYWHERE on it dismisses — the legacy app/Vaul's model. The starter is gated three ways: bottom-sheet
  // viewport only, never when the sheet's own scroller overflows (native scrolling owns those
  // pans; the grabber remains the dismiss handle), and never from inside a nested scroller or a
  // range input. jsdom reports scrollHeight = clientHeight = 0, i.e. "does not overflow", which
  // is exactly the short-sheet case; the scrollable case is simulated by defining the metrics.
  const pointer = { pointerType: 'mouse', isPrimary: true, button: 0, clientX: 200 }

  async function panDownFrom(target: Element) {
    fireEvent.pointerDown(target, { ...pointer, clientY: 300 })
    fireEvent.pointerMove(window, { ...pointer, clientY: 340 })
    await frame()
    await frame()
    fireEvent.pointerMove(window, { ...pointer, clientY: 520 })
    await frame()
    fireEvent.pointerUp(window, { ...pointer, clientY: 520 })
    await frame()
    await frame()
  }

  it('non-scrollable sheet: a downward pan from the sheet BODY starts a drag session and dismisses', async () => {
    const restore = stubMatchMedia(true)
    try {
      const onClose = vi.fn()
      render(
        <Sheet open onClose={onClose} title="Short">
          <p>short content</p>
        </Sheet>,
      )
      await panDownFrom(screen.getByText('short content'))
      expect(onClose).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })

  it('scrollable sheet: a body pointerdown does NOT start a drag — the same pan leaves the sheet open', async () => {
    const restore = stubMatchMedia(true)
    try {
      const onClose = vi.fn()
      render(
        <Sheet open onClose={onClose} title="Tall">
          <p>tall content</p>
        </Sheet>,
      )
      const dialog = screen.getByRole('dialog', { name: 'Tall' })
      // Simulate real overflow: the sheet's content is taller than its box.
      Object.defineProperty(dialog, 'scrollHeight', { value: 800, configurable: true })
      Object.defineProperty(dialog, 'clientHeight', { value: 400, configurable: true })

      await panDownFrom(screen.getByText('tall content'))
      expect(onClose).not.toHaveBeenCalled()
    } finally {
      restore()
    }
  })

  it('desktop viewport (centered dialog): body pans never drag', async () => {
    const restore = stubMatchMedia(false)
    try {
      const onClose = vi.fn()
      render(
        <Sheet open onClose={onClose} title="Desktop">
          <p>desktop content</p>
        </Sheet>,
      )
      await panDownFrom(screen.getByText('desktop content'))
      expect(onClose).not.toHaveBeenCalled()
    } finally {
      restore()
    }
  })

  it('plain taps on controls inside a short sheet still click (framer’s 3px pan threshold preserves them)', async () => {
    const restore = stubMatchMedia(true)
    try {
      const user = userEvent.setup()
      const onAction = vi.fn()
      render(
        <Sheet open onClose={vi.fn()} title="Short" footer={<button type="button" onClick={onAction}>Save</button>}>
          <p>short content</p>
        </Sheet>,
      )
      await user.click(screen.getByRole('button', { name: 'Save' }))
      expect(onAction).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })
})

describe('Sheet — nested-sheet portal bubbling must NEVER arm the parent whole-surface drag', () => {
  // React propagates portal events through the REACT tree, so a pointerdown in a nested child
  // sheet's portal (its body OR backdrop — DOM-wise a sibling portal under <body>) bubbles to
  // the parent's onSheetPointerDown too. Pre-guard, every parent gate passed (the parent's own
  // element is non-scrollable in this shape; the ancestor walk runs on the CHILD's DOM chain and
  // never meets the parent's node) → the PARENT armed as well: both sheets tracked the finger
  // and a dismissing release fired BOTH onCloses (discard dialog under the exiting picker). The
  // containment guard (`sheet.contains(e.target)` — the same ref containTab uses) kills it.
  const pointer = { pointerType: 'mouse', isPrimary: true, button: 0, clientX: 200 }

  async function panDownFrom(target: Element) {
    fireEvent.pointerDown(target, { ...pointer, clientY: 300 })
    fireEvent.pointerMove(window, { ...pointer, clientY: 340 })
    await frame()
    await frame()
    fireEvent.pointerMove(window, { ...pointer, clientY: 520 })
    await frame()
    fireEvent.pointerUp(window, { ...pointer, clientY: 520 }) // offset +220 > 120px threshold
    await frame()
    await frame() // onDragEnd is frame.postRender-deferred
  }

  function renderStack() {
    const onCloseOuter = vi.fn()
    const onCloseInner = vi.fn()
    render(
      <Sheet open onClose={onCloseOuter} title="Outer">
        <p>outer content</p>
        <Sheet open onClose={onCloseInner} title="Inner">
          <p>inner content</p>
        </Sheet>
      </Sheet>,
    )
    return { onCloseOuter, onCloseInner }
  }

  it("a dismissing pan on the child's BODY closes only the child — no parent drag session, and the parent's stacked pose survives", async () => {
    const restore = stubMatchMedia(true)
    try {
      const { onCloseOuter, onCloseInner } = renderStack()
      const outer = screen.getByRole('dialog', { name: 'Outer' })
      expect(outer).toHaveAttribute('data-stacked', 'true') // child above it on the stack

      await panDownFrom(screen.getByText('inner content'))

      expect(onCloseInner).toHaveBeenCalledTimes(1) // the child's own whole-surface drag dismissed
      expect(onCloseOuter).not.toHaveBeenCalled() // the parent never armed — no double-dismiss
      // The consumer here refuses (open stays true), so the child is still stacked above the
      // parent: the parent's pushed-back pose must have survived the child-body pan untouched.
      expect(outer).toHaveAttribute('data-stacked', 'true')
      expect(screen.getByRole('dialog', { name: 'Outer' })).toBeInTheDocument()
    } finally {
      restore()
    }
  })

  it("a pan starting on the child's BACKDROP is inert for the parent (its target bubbles through the parent's React tree but lives in the sibling portal)", async () => {
    const restore = stubMatchMedia(true)
    try {
      const { onCloseOuter, onCloseInner } = renderStack()
      const innerBackdrop = screen.getByRole('dialog', { name: 'Inner' }).parentElement as HTMLElement

      await panDownFrom(innerBackdrop)

      // The child's own starter sits on its .sheet element, which is not an ancestor of the
      // backdrop target — and the parent's starter must reject the out-of-DOM target. No drag
      // session anywhere: neither close fires (no click was dispatched either).
      expect(onCloseInner).not.toHaveBeenCalled()
      expect(onCloseOuter).not.toHaveBeenCalled()
      expect(screen.getByRole('dialog', { name: 'Outer' })).toHaveAttribute('data-stacked', 'true')
    } finally {
      restore()
    }
  })
})

describe('Sheet — REFUSED drag-dismiss (discard-guard consumers)', () => {
  // TransactionEditorSheet's dirty-draft flow: onDragEnd calls onClose(), the consumer REFUSES
  // (keeps `open` true and pops its ConfirmDialog instead). The sheet must stay mounted and
  // spring back — never unmount — and the spent throw's velocity must be re-zeroed on the
  // refusal render so a LATER consumer-driven close can't replay it.
  it('consumer keeps open=true: onClose fires once, the sheet stays mounted (spring-back, no unmount)', async () => {
    const onCloseAttempt = vi.fn()
    function RefusingHost() {
      const [, forceRender] = useState(0)
      return (
        <Sheet
          open
          onClose={() => {
            onCloseAttempt()
            forceRender((n) => n + 1) // the discard guard's setShowDiscard(true) re-render, minus the dialog
          }}
          title="Dirty draft"
        >
          <p>Unsaved edits</p>
        </Sheet>
      )
    }
    render(<RefusingHost />)
    const dialog = screen.getByRole('dialog', { name: 'Dirty draft' })
    const grabber = dialog.querySelector('span[aria-hidden="true"]') as HTMLElement

    const pointer = { pointerType: 'mouse', isPrimary: true, button: 0, clientX: 200 }
    fireEvent.pointerDown(grabber, { ...pointer, clientY: 300 })
    fireEvent.pointerMove(window, { ...pointer, clientY: 340 })
    await frame()
    await frame()
    fireEvent.pointerMove(window, { ...pointer, clientY: 520 })
    await frame()
    fireEvent.pointerUp(window, { ...pointer, clientY: 520 })
    await frame()
    await frame()

    expect(onCloseAttempt).toHaveBeenCalledTimes(1)
    // Refused: `open` never flipped, so the sheet must still be in the document — the constraint
    // spring is returning y to 0, not exiting.
    expect(screen.getByRole('dialog', { name: 'Dirty draft' })).toBeInTheDocument()
  })

  it('structural guard: the refusal render re-zeroes exitVelocityRef (dragCloseRequestedRef effect)', () => {
    // The zeroing itself isn't observable from the DOM (it only changes the TRAJECTORY of a later
    // exit), so pin the mechanism: onDragEnd arms the flag on a dismissing drag, and the no-deps
    // effect consumes it — zeroing ONLY when `open` survived the close request (a refusal).
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Sheet.tsx'), 'utf8')
    expect(source).toMatch(/dragCloseRequestedRef\.current = true[\s\S]{0,200}?onClose\(\)/)
    expect(source).toMatch(
      /if \(!dragCloseRequestedRef\.current\) return\s*\n\s*dragCloseRequestedRef\.current = false\s*\n\s*if \(open\) exitVelocityRef\.current = 0/,
    )
  })
})

describe('Sheet.module.css — scroll containment declarations', () => {
  // Belt-and-braces with the RemoveScroll lock: the sheet's own scroller must never CHAIN a
  // boundary scroll to the page behind it, and a pan that starts on the backdrop must be inert.
  it('.sheet declares overscroll-behavior: contain (base AND ≤640px block); .backdrop declares touch-action: none', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Sheet.module.css'), 'utf8')
    expect(css).toMatch(/\.backdrop\s*\{[^}]*touch-action:\s*none/)
    expect(css).toMatch(/\.sheet\s*\{[^}]*overscroll-behavior:\s*contain/)
    const mobileBlocks = [...css.matchAll(/@media \(max-width: 640px\) \{([\s\S]*?)\n\}/g)]
      .map((m) => m[1])
      .join('\n')
    expect(mobileBlocks).toMatch(/\.sheet\s*\{[^}]*overscroll-behavior:\s*contain/)
  })
})

describe('Sheet.module.css — mobile grabber drags must not paint text selections', () => {
  // framer used to stamp `user-select: none` from the pointerdown listener that
  // dragListener={false} disables — a mouse grabber drag now needs the CSS opt-out. It is
  // scoped to the ≤640px bottom-sheet block ONLY: desktop sheets have no drag, and selecting
  // text inside them (e.g. a note) must keep working.
  it('the ≤640px block disables user-select on .sheet; the desktop rules do not', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Sheet.module.css'), 'utf8')
    const mobileBlocks = [...css.matchAll(/@media \(max-width: 640px\) \{([\s\S]*?)\n\}/g)]
      .map((m) => m[1])
      .join('\n')
    expect(mobileBlocks).toMatch(/\.sheet\s*\{[^}]*[^-]user-select:\s*none/)
    expect(mobileBlocks).toMatch(/\.sheet\s*\{[^}]*-webkit-user-select:\s*none/)
    // Desktop keeps text selection inside sheets: no user-select outside the mobile blocks.
    const outsideMobile = css.replace(/@media \(max-width: 640px\) \{[\s\S]*?\n\}/g, '')
    expect(outsideMobile).not.toMatch(/user-select/)
  })
})
