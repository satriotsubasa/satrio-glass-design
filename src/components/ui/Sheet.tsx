import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useDragControls, useReducedMotion, type PanInfo, type Variants } from 'framer-motion'
import { RemoveScroll } from 'react-remove-scroll'
import styles from './Sheet.module.css'

/**
 * Dismiss decision as a PROJECTION (Apple's deceleration form): where would the sheet LAND if
 * the finger lifted right now? Release dismisses when the projected resting point — current
 * offset plus the distance the release velocity would coast — crosses ONE 120px threshold:
 *
 *   project(v) = (v / 1000) · k / (1 − k),  k = 0.998 (UIScrollView's normal decelerationRate)
 *              ≈ v · 0.499  (px, for v in px/s)
 *
 * One rule replaces the old independent thresholds (`offset > 90 || velocity > 600`), which had
 * a DEAD ZONE between them: an 80px drag released at 500px/s read as neither (80 < 90, 500 < 600)
 * and sprang back, though the throw was landing at 80 + ~249 ≈ 329px. Under the projection a
 * flick counts its future travel (601px/s from rest projects to ~300px → dismiss), a slow 130px
 * drag still dismisses — and a 91px drag released AT REST no longer does (91 < 120): deliberate;
 * velocity ≈ 0 means the user stopped and is hesitating, so springing back is the correct read.
 * (If feedback disagrees, tune DISMISS_DISTANCE_PX — never the projection form.)
 */
const DISMISS_DISTANCE_PX = 120
const DECELERATION_RATE = 0.998

export function shouldDismiss(offsetY: number, velocityY: number): boolean {
  const projected = (velocityY / 1000) * (DECELERATION_RATE / (1 - DECELERATION_RATE))
  return offsetY + projected > DISMISS_DISTANCE_PX
}

const EASE_GLASS = [0.22, 1, 0.36, 1] as const

/** ≤640px is the bottom-sheet presentation (Sheet.module.css's breakpoint: docked to the bottom
 *  edge, grabber visible). Above it the sheet is a CENTERED dialog — a modal, which exits in
 *  place (emil's modal exception) rather than sliding off the bottom of the viewport. Read live
 *  (not at mount) so the exit matches the presentation at dismiss time. */
function isBottomSheetViewport(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 640px)').matches
  )
}

/**
 * How many kit Sheets this Sheet is nested inside, via the REACT tree (context flows through
 * `createPortal`, so a picker Sheet rendered from a component inside the editor Sheet's children
 * reads the editor's depth even though its DOM portals to a sibling of the editor's under
 * `<body>`). This is what orders the module-level sheet stack below.
 */
const SheetDepthContext = createContext(0)

/**
 * Enter/exit variants, extracted to module level so the EXIT transition's shape is directly
 * testable. `exit` is DYNAMIC — a function of the dismissing drag's velocity, fed through
 * AnimatePresence's `custom` — so a flicked dismissal leaves at the speed of the throw instead
 * of reversing it (the old fixed exit tweened `y` back UP to 10 from wherever the drag released
 * — ~200px of travel AGAINST the gesture, then a fade). Bottom-sheet viewports exit downward
 * (`y: '100%'`); the desktop centered dialog keeps its in-place fade/scale exit.
 */
export function makeSheetVariants(reduce: boolean | null): Variants {
  return {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 10 },
    visible: reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 },
    /* Parent push-back (Apple §12: for stacked sheets, progressively push back each parent
       layer): a sheet that is open but no longer TOP-most — a picker opened over the editor —
       recedes slightly, so the stack reads as layered depth instead of two flat sheets on one
       plane. Under reduced motion the variant equals `visible` (no movement, ever): the
       push-back is a purely decorative sweep, exactly what Apple §14 says to drop. */
    stacked: reduce ? { opacity: 1 } : { opacity: 1, scale: 0.94, y: -8 },
    exit: (exitVelocity: number) => {
      /* reduce: a 0.2s cross-fade, not a hard cut and not a slide — Apple §14 (mirrors the
         backdrop's 0.2s, keeping scrim and sheet in sync). */
      if (reduce) return { opacity: 0, transition: { duration: 0.2 } }
      if (isBottomSheetViewport()) {
        return {
          opacity: 0,
          y: '100%',
          /* The y spring is PHYSICS-KEYED (stiffness/damping) on purpose: motion-dom's
             getSpringOptions() executes `springOptions.velocity = 0` whenever duration/bounce
             keys are present without physics keys, so the previous
             `{ type: 'spring', bounce: 0, duration: 0.3, velocity }` shape silently DISCARDED
             the throw — a flick stalled at the release point, then re-accelerated on a fixed
             spring. 305/35 is framer's own solved spring for visualDuration 0.3 / bounce 0,
             so the zero-velocity feel is unchanged; the release velocity now actually seeds
             the spring. Opacity keeps its own 0.2s tween (a fade has no use for the throw),
             scoped per-value so it never routes through the spring. */
          transition: {
            opacity: { duration: 0.2, ease: EASE_GLASS },
            y: { type: 'spring' as const, stiffness: 305, damping: 35, velocity: exitVelocity },
          },
        }
      }
      return { opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.32, ease: EASE_GLASS } }
    },
  }
}

type SheetStackEntry = { depth: number }

/**
 * Module-level EXPLICIT stack of every open Sheet — pushed on open, removed on close/unmount —
 * so Escape can act on the top-most sheet only.
 *
 * Escape layering used to be inferred from window-keydown REGISTRATION order (the nested sheet's
 * listener was assumed to run first and preventDefault). That inverts in the real flow: a picker
 * sheet whose `open` flips in a LATER commit re-registers its listener (its effect deps include
 * `open`), moving it to the END of the window listener list, while the ancestor editor sheet —
 * which doesn't re-render on the picker's descendant-local state — keeps its earlier slot, so
 * the ANCESTOR handled Escape first and closed the whole editor out from under the picker.
 *
 * Note the stack's ORDER is not simply push order either: React runs a child's effects BEFORE
 * its parent's on a same-commit mount, so an inner sheet mounted open alongside its ancestor
 * pushes FIRST and plain LIFO would call the OUTER sheet the top. `isTopSheet` therefore ranks
 * by React-tree DEPTH (a nested sheet always outranks its ancestor, whichever pushed first),
 * with push recency only as the tie-break between unrelated same-depth sheets.
 */
const sheetStack: SheetStackEntry[] = []

/**
 * Subscription channel over the module stack, so OPEN sheets can REACT to membership changes
 * (the parent push-back consumer below): pushing/removing any entry bumps a version and
 * notifies every mounted Sheet via `useSyncExternalStore`. A parent sheet re-renders when a
 * child opens above it (it stops being top-most → animates to the `stacked` variant) and again
 * when the child closes (top-most again → restores to `visible`).
 */
let sheetStackVersion = 0
const sheetStackListeners = new Set<() => void>()
function subscribeToSheetStack(listener: () => void): () => void {
  sheetStackListeners.add(listener)
  return () => { sheetStackListeners.delete(listener) }
}
function getSheetStackVersion(): number {
  return sheetStackVersion
}
function bumpSheetStack(): void {
  sheetStackVersion += 1
  for (const listener of [...sheetStackListeners]) listener()
}

function isTopSheet(entry: SheetStackEntry): boolean {
  let top: SheetStackEntry | undefined
  for (const candidate of sheetStack) {
    if (!top || candidate.depth >= top.depth) top = candidate
  }
  return top === entry
}

/** What the hand-rolled Tab trap treats as focusable — the standard tabbable-element selector
 *  (the dialog container itself carries `tabindex="-1"`, so it never matches its own trap). */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  /** Names the dialog from an element INSIDE the sheet's children (e.g. a chrome-owned `<h2>`
   *  whose id the caller controls) — rendered as `aria-labelledby` on the dialog, which then
   *  suppresses the `aria-label`-from-`title` path. Omit to keep naming via `title` (the
   *  backward-compatible default for every existing caller). */
  ariaLabelledby?: string
  children: React.ReactNode
  footer?: React.ReactNode
  /** 'default' (default) — the capped-height (≤82/88vh) sheet that scrolls its own `.body`.
   *  'full' — a near-fullscreen flex-column sheet with no outer scroll/padding chrome, for a
   *  host that manages its own internal scroll region + fixed dock (e.g. the transaction
   *  editor's single-scroll layout, which needs `height: 100%` from its container to work). */
  variant?: 'default' | 'full'
}
export function Sheet({ open, onClose, title, ariaLabelledby, children, footer, variant = 'default' }: SheetProps) {
  const reduce = useReducedMotion()
  const contentRef = useRef<HTMLDivElement>(null)
  const dragControls = useDragControls()
  /** y-velocity (px/s) of the drag that dismissed the sheet. Fed to the exit spring via
   *  AnimatePresence's `custom` prop: exit props are frozen at the last open render, but
   *  `custom` is framer's channel that stays LIVE for exiting children (for exits, variant
   *  resolution prefers `presenceContext.custom` over the stale prop). Every NON-drag close
   *  path zeroes it EXPLICITLY (open effect, Escape, backdrop, spring-back release): onClose is
   *  a request, not a command — a discard-guard consumer may refuse a drag-dismiss and close
   *  later via Escape/backdrop, and that later exit must not replay the stale throw. */
  const exitVelocityRef = useRef(0)
  /** True while a grabber drag session is live; cleared one frame AFTER it ends. Guards the
   *  backdrop's onClick: per UI Events, a mouse/pen drag that starts on the grabber and
   *  RELEASES over the backdrop dispatches a synthesized `click` on their common ancestor —
   *  the backdrop itself — so without this guard an UPWARD (rubber-banded, non-dismissing)
   *  drag still force-closed the sheet. `e.target === e.currentTarget` cannot help: the
   *  synthesized click TARGETS the backdrop. The clear is rAF-deferred because the click
   *  lands right after pointerup — before framer's frame-deferred onDragEnd — and the flag
   *  must still be up when it does. Touch never synthesizes this click path onto the
   *  backdrop; mouse/pen on ≤640px windows hit it every time. */
  const dragSessionRef = useRef(false)
  const dragClearRafRef = useRef(0)
  /** Set when a DRAG dismissal calls onClose; consumed on the next committed render. onClose is
   *  a REQUEST — a discard-guard consumer (TransactionEditorSheet's dirty draft) may refuse it
   *  and keep `open` true, popping its ConfirmDialog instead (that setState re-renders this
   *  Sheet, so the refusal is observable as "next commit still has open=true"). On that commit
   *  the throw is SPENT: the sheet is springing back, and the eventual close (the dialog's own
   *  "Discard" button flipping `open` false, with no Sheet handler in between to zero the ref)
   *  must exit on its own terms, not replay the stale throw — see the refusal effect below. */
  const dragCloseRequestedRef = useRef(false)
  const depth = useContext(SheetDepthContext)
  const stackEntryRef = useRef<SheetStackEntry | null>(null)
  // Re-render whenever ANY sheet joins/leaves the module stack — the return value itself is not
  // needed; the subscription is what keeps `pushedBack` below fresh. The entry ref is written by
  // the open effect one commit after `open` flips true, but that same effect bumps the version,
  // so the first render that can observe "a child is above me" always has the entry populated.
  useSyncExternalStore(subscribeToSheetStack, getSheetStackVersion)

  // Open lifecycle — sheet-stack membership + focus management (the aria-modal contract: move
  // focus in on open, restore it on close). On open: push a stack entry, save the opener, and
  // focus the dialog CONTAINER (`tabIndex={-1}` below) — container focus is the safe default
  // (focusing a first field would surprise-open the keyboard on mobile). A sheet that is NOT the
  // stack top at effect time (same-commit nested mount: the inner sheet's effect already ran and
  // took focus) leaves focus alone — and then owes no restore either. On close: this cleanup
  // runs in the same commit `open` flips false — i.e. at the START of the AnimatePresence exit
  // animation, not after it — so the opener regains focus immediately while the sheet fades out.
  // Consumers that unmount the whole Sheet while open (AmountKeypad renders `<Sheet open …>` and
  // is conditionally mounted) hit the same cleanup via unmount. Nested sheets restore along the
  // opener chain: each sheet saves ITS opener (a picker opened from inside the editor saves the
  // editor's trigger button, still connected when the picker closes), so closing the picker
  // restores to the trigger, and closing the editor later restores to the FAB. The `isConnected`
  // guard covers openers that unmounted in the meantime — focus is then deliberately left alone.
  useEffect(() => {
    if (!open) return
    exitVelocityRef.current = 0 // a fresh session owes no velocity to a PREVIOUS drag's exit
    const entry: SheetStackEntry = { depth }
    sheetStack.push(entry)
    stackEntryRef.current = entry
    bumpSheetStack() // an ANCESTOR sheet below may have just stopped being top-most → push-back
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const tookFocus = isTopSheet(entry)
    if (tookFocus) contentRef.current?.focus()
    return () => {
      const index = sheetStack.indexOf(entry)
      if (index !== -1) sheetStack.splice(index, 1)
      if (stackEntryRef.current === entry) stackEntryRef.current = null
      bumpSheetStack() // the sheet below (if any) is top-most again → restore from push-back
      if (tookFocus && opener?.isConnected) opener.focus()
    }
  }, [open, depth])

  useEffect(() => {
    // `!e.defaultPrevented` guards against a stacked Radix layer (e.g. a ConfirmDialog opened
    // from this sheet) that already handled the Escape itself — Radix's DismissableLayer calls
    // `preventDefault()` on the keydown it consumes (via a document-level CAPTURE listener, so
    // it always runs before this window bubble listener), so without this check, pressing Escape
    // to cancel a nested dialog would ALSO close this sheet underneath it.
    //
    // Between two STACKED kit Sheets the explicit `sheetStack` decides instead: only the sheet
    // `isTopSheet` reports as top-most acts, regardless of which listener happens to run first —
    // and it still `preventDefault()`s afterwards so it keeps acting as a DismissableLayer-alike
    // toward any Radix layer stacked BELOW it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !open || e.defaultPrevented) return
      const entry = stackEntryRef.current
      if (!entry || !isTopSheet(entry)) return
      exitVelocityRef.current = 0 // keyboard close — owes nothing to an earlier REFUSED drag-dismiss
      onClose()
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [onClose, open])

  // REFUSED drag-dismiss staleness fix (no deps — it must see the very next commit, whatever
  // caused it): if a drag-dismissal's onClose left `open` true, the consumer refused it, so the
  // throw's velocity is spent and gets zeroed here. If `open` is false the dismissal was
  // ACCEPTED — the exiting render already delivered the velocity through AnimatePresence's
  // `custom` (render runs before effects), so only the flag is cleared and the exit keeps its
  // throw. A consumer that refuses WITHOUT re-rendering leaves the ref dirty until the next
  // commit, but every Sheet-owned close path (Escape/backdrop/open-effect) zeroes explicitly.
  useEffect(() => {
    if (!dragCloseRequestedRef.current) return
    dragCloseRequestedRef.current = false
    if (open) exitVelocityRef.current = 0
  })

  const onDragStart = () => {
    // A pending clear from the PREVIOUS session must not fire mid-drag (back-to-back sessions
    // within a frame) — cancel it before re-arming the flag.
    if (dragClearRafRef.current) cancelAnimationFrame(dragClearRafRef.current)
    dragSessionRef.current = true
  }
  const onDragEnd = (_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const dismiss = shouldDismiss(info.offset.y, info.velocity.y)
    // Dismissing: the exit spring continues the throw, not reverses it. Spring-back: zero the
    // ref so a LATER close (Escape/backdrop after a refused dismissal) can't replay this throw.
    exitVelocityRef.current = dismiss ? info.velocity.y : 0
    // One frame's grace before the backdrop is clickable again — see dragSessionRef above.
    dragClearRafRef.current = requestAnimationFrame(() => { dragSessionRef.current = false })
    if (dismiss) {
      dragCloseRequestedRef.current = true // armed for the refusal effect above
      onClose()
    }
  }

  // Tab containment: wrap first↔last within this dialog's focusable descendants so keyboard
  // focus can't escape into the background page that `aria-modal` tells AT doesn't exist. Only
  // the BOUNDARIES are intercepted — Tab between middle elements keeps native behavior (the
  // portal sits at the end of `<body>`, so document order within the dialog is already correct).
  const containTab = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || e.defaultPrevented) return
    const el = contentRef.current
    if (!el) return
    // React portals propagate synthetic events through the REACT tree, so a NESTED sheet's (or
    // a Radix layer's) Tab bubbles here even though its DOM is a sibling portal — if the
    // keydown's target isn't inside THIS sheet's DOM, it's that layer's to contain, not ours.
    if (!(e.target instanceof Node) || !el.contains(e.target)) return
    const focusables = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    if (focusables.length === 0) {
      e.preventDefault() // nothing to move to — keep focus parked on the container
      return
    }
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement
    if (e.shiftKey) {
      if (active === first || active === el) { e.preventDefault(); last.focus() }
    } else if (active === last || active === el) {
      e.preventDefault(); first.focus()
    }
  }

  // Drag-to-dismiss is CONTROLS-DRIVEN: `dragListener={false}` keeps framer from arming its own
  // pointerdown listener on the sheet — which ALSO stops it stamping `touch-action: pan-x`
  // inline (use-props.mjs stamps that whenever `drag` is set with `dragListener !== false`).
  // The sheet is itself the `overflow-y: auto` scroller, so that stamp blocked vertical FINGER
  // scrolling on any sheet taller than its max-height (IconPickerSheet, CurrencyPicker, long
  // category lists) — unrecoverably, because the old `atTop` re-enable flag could only flip via
  // `onScroll`, which a blocked touch can never fire. The gesture starts ONLY via
  // `dragControls.start`, from exactly two hands:
  //
  //  - the GRABBER (`touch-action: none` in its CSS) — always, every variant. `full` sheets
  //    included: their old drag ban was a workaround for the pre-controls touch-action bug, and
  //    a grabber-driven drag never touches the host's internal scroll region. A drag-dismiss on
  //    a dirty editor is safe: onClose is a REQUEST, the discard guard refuses it, the
  //    constraint spring returns y to 0 (see dragCloseRequestedRef).
  //  - the SHEET BODY, but only while the sheet does not overflow (`onSheetPointerDown` below):
  //    a short sheet (edit-account, confirm-style) has no scroll gesture to protect, so a swipe
  //    anywhere dismisses — the legacy app/Vaul's model. The moment content overflows, body touches
  //    belong to native scrolling again and the grabber remains the sole dismiss handle.
  //
  // Reduced motion does NOT disable the drag: a 1:1 gesture the user authors frame-by-frame is
  // direct manipulation, not a vestibular trigger (AppMotionConfig.tsx documents this contract —
  // it gates ANIMATIONS only, never gestures); the reduced variants below keep the exit a
  // cross-fade. Desktop (>640px) has neither hand: the grabber is display:none and the body
  // starter checks the viewport live, so the centered dialog never drags.

  /** Whole-surface swipe-dismiss for sheets whose content does NOT overflow. Gated hard:
   *  bottom-sheet viewports only, never when the sheet scrolls, never from inside a nested
   *  scroller (icon grids mid-search, horizontal wallet/category rails — anything that owns its
   *  own pan) and never from a range input (its thumb drag is horizontal but imprecise fingers
   *  wobble on y). framer's 3px pan threshold keeps plain taps intact: buttons inside a short
   *  sheet still press and click; only a real pan becomes a drag session. */
  const onSheetPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const sheet = contentRef.current
    if (!sheet || !isBottomSheetViewport()) return
    if (sheet.scrollHeight - sheet.clientHeight >= 1) return // scrollable: native scroll owns body pans
    if (!(e.target instanceof HTMLElement)) return
    // React propagates PORTAL events through the REACT tree, so a pointerdown in a NESTED child
    // sheet's portal (its body OR backdrop — DOM-wise a sibling portal under <body>) bubbles to
    // this handler too. Without containment every other guard passes for the parent (its own
    // element is non-scrollable; the ancestor walk below runs on the CHILD's DOM chain and never
    // meets this sheet's node) → dragControls.start armed the PARENT: both sheets tracked the
    // finger and a dismissing release fired BOTH onCloses (discard dialog under the exiting
    // picker). Same hazard `containTab` above already guards, with the same ref: a pointerdown
    // whose target is not inside THIS sheet's real DOM is that layer's gesture, never ours.
    // (This also keeps the parent's onClickCapture suppressor from swallowing the child's click
    // tails — no parent session ever arms, so the flag stays down. The grabber path needs no
    // twin: its span has no children, and nested sheets render under `.body` in the React tree,
    // so no portal event can ever route through the grabber's own onPointerDown.)
    if (!sheet.contains(e.target)) return
    if (e.target.closest('input[type="range"]')) return
    for (let node: HTMLElement | null = e.target; node && node !== sheet; node = node.parentElement) {
      const scrollsY = node.scrollHeight - node.clientHeight >= 1
      const scrollsX = node.scrollWidth - node.clientWidth >= 1
      if (!scrollsY && !scrollsX) continue
      const { overflowX, overflowY } = getComputedStyle(node)
      if (scrollsY && /(auto|scroll)/.test(overflowY)) return
      if (scrollsX && /(auto|scroll)/.test(overflowX)) return
    }
    dragControls.start(e)
  }

  // Enter/exit variants — see makeSheetVariants above (module-level for testability).
  const sheetVariants = makeSheetVariants(reduce)

  // Parent push-back: this sheet is open but a child sheet sits ABOVE it on the stack (the
  // picker-over-editor shape), so it animates to the receded `stacked` variant and restores to
  // `visible` when it becomes top-most again. Ranking reuses the same depth-first `isTopSheet`
  // that layers Escape, so push-back and Escape can never disagree about who is on top.
  const stackEntry = stackEntryRef.current
  const pushedBack = open && stackEntry !== null && !isTopSheet(stackEntry)

  return createPortal(
    <SheetDepthContext.Provider value={depth + 1}>
      <AnimatePresence custom={exitVelocityRef.current}>
        {open && (
          /* Body scroll lock — the page BEHIND a sheet must not pan/wheel while one is open
             (the Radix Modal already gets this via the same react-remove-scroll that Radix
             Dialog composes into its overlay). RemoveScroll ref-counts across instances
             (`data-scroll-locked` on <body> is the counter), so NESTED sheets stack safely:
             two open → locked, inner closes → still locked, all closed → released. Scrolling
             WITHIN its subtree stays allowed by default — the sheet's own `overflow-y: auto`
             scroller (IconPickerSheet's grid et al) keeps working; no noIsolation/shards
             needed since backdrop + sheet both live inside. Mounted INSIDE AnimatePresence's
             conditional so the lock holds through the exit animation and releases on unmount. */
          <RemoveScroll>
            <motion.div className={styles.backdrop}
            onClick={() => {
              // A grabber drag that RELEASES over the backdrop synthesizes a click that targets
              // the backdrop itself (see dragSessionRef) — that click is the drag's tail, never
              // a dismissal. A real backdrop click owes no velocity to any earlier drag.
              if (dragSessionRef.current) return
              exitVelocityRef.current = 0
              onClose()
            }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0.2 : 0.25 }}>
            <motion.div ref={contentRef} className={`${styles.sheet} ${variant === 'full' ? styles.sheetFull : ''}`} role="dialog" aria-modal="true" aria-label={ariaLabelledby ? undefined : title} aria-labelledby={ariaLabelledby}
              tabIndex={-1} onKeyDown={containTab}
              onClick={(e) => e.stopPropagation()}
              /* Capture-phase click suppressor for the drag's tail: a MOUSE drag that started on
                 a button/row inside a short (whole-surface-draggable) sheet releases with down
                 and up on the SAME element — the element travelled with the sheet — so the
                 browser still dispatches a click there, and a dismissing 150px pull would
                 otherwise also press "Save". Touch never does this (pan distance kills the tap);
                 the flag is only up from real drag start until one frame after release, so plain
                 taps are untouched. Same timing contract as the backdrop's dragSessionRef guard. */
              onClickCapture={(e) => { if (dragSessionRef.current) { e.preventDefault(); e.stopPropagation() } }}
              onPointerDown={onSheetPointerDown}
              /* Rubber-band asymmetry: `top: 0.05` resists upward (a soft boundary, never a hard
                 clamp); `bottom: 1` glues the sheet to the finger 1:1 on the dismiss path.
                 `dragMomentum={false}` + the 440/34 dragTransition give the non-dismissing
                 release a critically-damped-feel snap-back (Apple's drawer spring: damping 0.8 /
                 response 0.3 → stiffness ωn² = 440, damping 2·0.8·ωn = 34). */
              drag={'y'} dragListener={false} dragControls={dragControls}
              dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.05, bottom: 1 }}
              dragMomentum={false} dragTransition={{ bounceStiffness: 440, bounceDamping: 34 }}
              onDragStart={onDragStart} onDragEnd={onDragEnd}
              /* data-stacked mirrors the push-back state for styling/tests (the animate variant
                 itself is not observable from the DOM until the spring settles). */
              data-stacked={pushedBack || undefined}
              variants={sheetVariants} initial="hidden" animate={pushedBack ? 'stacked' : 'visible'} exit="exit"
              /* reduce: 0.2s, not 0 — a duration of 0 hard-cuts, turning the reduced-motion
                 opacity variants above into dead code. Apple §14 prescribes a short CROSS-FADE
                 (and the 0.25→0.2 backdrop keeps the scrim in sync with it). Full-motion enter
                 is a settle spring; opacity takes a faster 0.2s tween so the fade lands before
                 the transform finishes settling. */
              transition={reduce
                ? { duration: 0.2 }
                : { type: 'spring', bounce: 0.15, duration: 0.35, opacity: { duration: 0.2, ease: EASE_GLASS } }}>
              <span
                className={styles.grabber} aria-hidden
                /* The dismiss handle, on EVERY variant (see the drag-model comment above).
                   stopPropagation so the whole-surface starter can't arm a SECOND session for
                   the same pointerdown on a non-scrollable sheet. */
                onPointerDown={(e) => { e.stopPropagation(); dragControls.start(e) }}
              />
              {title && <h2 className={styles.title}>{title}</h2>}
              <div className={`${styles.body} ${variant === 'full' ? styles.bodyFull : ''}`}>{children}</div>
              {footer && <div className={styles.footer}>{footer}</div>}
            </motion.div>
            </motion.div>
          </RemoveScroll>
        )}
      </AnimatePresence>
    </SheetDepthContext.Provider>,
    document.body,
  )
}
