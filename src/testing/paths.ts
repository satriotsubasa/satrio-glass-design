import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Absolute path to this package's own `tokens.css`, resolved from THIS module's location — so it is
 * correct both when the package is run from its own checkout and when it sits in a consumer's
 * `node_modules`. Pass it as a `tokenCssPaths` entry to `runTokenUsagePolicy` instead of
 * hand-writing a `../../node_modules/@satrio/glass-design/...` relative path.
 *
 * CONSTRAINT: resolved with `dirname(fileURLToPath(import.meta.url))` + `join()`, never
 * `new URL(<string literal>, import.meta.url)`. Vite's `vite:asset-import-meta-url` and Vitest's
 * `vitest:normalize-url` both pattern-match that literal expression and rewrite it (the literal
 * becomes a dev-server URL path, `import.meta.url` becomes `self.location`) whenever the module is
 * transformed for the CLIENT environment — which is what a `jsdom`/`happy-dom` test environment
 * uses. The result is an `http://` URL and `fileURLToPath` throws "The URL must be of scheme file".
 * Bare `import.meta.url` is matched by neither transform.
 */
export const TOKENS_CSS_PATH: string = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'styles',
  'tokens.css',
)
