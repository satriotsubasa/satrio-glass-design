// @vitest-environment node
import { runPressStatePolicy } from '../testing/pressStatePolicy'

/** Package self-enforcement: the press-state + hover-gating policy the kit SHIPS is turned back on
 *  the kit's own components. Every kit `:hover` must be pointer-gated and paired with an `:active`
 *  press; the house press is `scale()`, never `translateY(1px)`; exactly one module defines `.fab`.
 *
 *  This is also the factory's end-to-end proof: `runPressStatePolicy` registers its whole suite here
 *  over real files. `composedModifiers` maps Button's `.ghost` variant — only ever composed onto the
 *  base `.btn` in the markup — to `.btn`, whose `:active` it inherits. Floors are pinned below this
 *  repo's real corpus (≈29 modules, ≈12 press subjects); raise the pins if the kit grows. */
runPressStatePolicy({
  cssRoots: ['src/components'],
  fabModules: ['src/components/ui/Fab.module.css'],
  composedModifiers: {
    // <button className={`${styles.btn} ${styles.ghost} …`}> (Button.tsx) — the ghost variant is
    // always composed onto .btn, which declares the shared compact-control :active scale.
    'src/components/ui/Button.module.css': { ghost: 'btn' },
  },
  minModules: 20,
  minPressSubjects: 8,
})
