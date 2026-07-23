// @vitest-environment node
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Drift guard for public/_headers' script-src hash.
 *
 * index.html ships one inline <script> (the pre-paint theme stamp) with no bare attributes — the
 * regex below anchors on the literal `<script>` tag (no attributes) specifically to exclude the
 * second, attributed `<script type="module" src="…">` tag that loads the app itself. CSP's
 * script-src pins that inline script by an exact sha256 hash of its content (public/_headers
 * carries no server-side templating to mint a nonce) — if the script's text ever changes without
 * regenerating the hash, the deployed site silently drops the tag under CSP enforcement: no build
 * error, just a console CSP violation and the pre-paint theme stamp no longer running (a flash of
 * the wrong theme on load). This test pins the two together so an edit to one without the other
 * fails here instead of shipping.
 *
 * Pinned against the SOURCE index.html at the repo root (not a built dist/index.html) — verified
 * byte-identical to the built script's content for this build (Vite does not rewrite it), and a
 * source-only test needs no build step to run.
 */

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const indexHtml = readFileSync(repoRoot + 'index.html', 'utf8')
const headersFile = readFileSync(repoRoot + 'public/_headers', 'utf8')

describe('CSP script-src hash tracks index.html\'s inline pre-paint script', () => {
  it('finds the bare <script> pre-paint boot tag in index.html', () => {
    const match = indexHtml.match(/<script>([\s\S]*?)<\/script>/)
    expect(match, 'index.html must ship a bare <script> (no attributes) — the pre-paint boot tag').not.toBeNull()
  })

  it('finds a sha256 hash in public/_headers\' script-src directive', () => {
    const match = headersFile.match(/script-src[^;]*'sha256-([A-Za-z0-9+/=]+)'/)
    expect(match, 'public/_headers\' script-src must carry a sha256 hash for the inline boot script').not.toBeNull()
  })

  it('matches the hash to the boot script\'s exact content', () => {
    const scriptMatch = indexHtml.match(/<script>([\s\S]*?)<\/script>/)
    const headerMatch = headersFile.match(/script-src[^;]*'sha256-([A-Za-z0-9+/=]+)'/)
    expect(scriptMatch).not.toBeNull()
    expect(headerMatch).not.toBeNull()

    const computedHash = createHash('sha256').update(scriptMatch![1], 'utf8').digest('base64')
    const pinnedHash = headerMatch![1]

    expect(
      computedHash,
      `public/_headers' script-src hash ('sha256-${pinnedHash}') no longer matches index.html's ` +
        `inline boot script (computed 'sha256-${computedHash}') — editing that <script> requires ` +
        'regenerating the hash in public/_headers, or the deployed site silently loses pre-paint ' +
        'theming under CSP enforcement (console CSP violation, no build error).',
    ).toBe(pinnedHash)
  })
})
