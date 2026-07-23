// @vitest-environment node
import { runInputZoomPolicy } from '../testing/inputZoomPolicy'

/** Package self-enforcement: the iOS focus-zoom floor policy the kit SHIPS is turned back on the
 *  kit's own text-entry CSS. `.control` is the shared chokepoint (TextInput, Textarea, and every kit
 *  consumer floor through it); SearchField's `.input` and `.clear` live in their own module. Every
 *  font-size in these files must be `max(16px, var(--fs-*))` — a sub-16px input zooms iOS Safari and
 *  will not zoom back out until it blurs. This is also the factory's end-to-end proof over real
 *  files. The allowlist stays empty: every font-size here IS a focus-zooming text input. */
runInputZoomPolicy({
  cssPaths: ['src/components/ui/control.module.css', 'src/components/ui/SearchField.module.css'],
})
