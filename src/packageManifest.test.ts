// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The package MANIFEST is public API, and its `sideEffects` field is load-bearing for consumers'
 * bundle sizes: the package ships raw modules, so without this field a bundler must assume every
 * module reachable from the barrel has import-time side effects and must therefore be EVALUATED
 * wherever the barrel is first imported. That pins every barrel member — and its CSS, and its
 * third-party deps — into the eagerly-loaded entry chunk, even when the component is only reached
 * through a dynamic import.
 *
 * The list must stay exactly: the CSS glob (module CSS and the global stylesheets are real side
 * effects and must never be dropped) plus every JS module whose import exists ONLY for effect.
 * src/fonts.ts is the package's only such module: it imports webfont stylesheets purely to
 * register their @font-face rules, binding nothing. Omitting it lets a bundler tree-shake it away
 * entirely — the build still emits the woff2 assets, but the stylesheet ends up with zero
 * @font-face rules, with no build error to flag it.
 */

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '')
const manifest = JSON.parse(readFileSync(`${root}/package.json`, 'utf8')) as {
  files: string[]
  sideEffects: string[]
  exports: Record<string, string>
}

/** Every shipped (non-test, non-docs) JS module in src. */
function shippedModules(dir = 'src'): string[] {
  const out: string[] = []
  for (const name of readdirSync(`${root}/${dir}`)) {
    const rel = `${dir}/${name}`
    if (statSync(`${root}/${rel}`).isDirectory()) {
      if (name === 'docs' || name === 'test') continue
      out.push(...shippedModules(rel))
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && name !== 'vite-env.d.ts') {
      out.push(rel)
    }
  }
  return out
}

/** A bare `import 'x'` — no bindings — is an import kept purely for its effect. */
const BARE_IMPORT = /^\s*import\s+['"][^'"]+['"]/m

describe('package.json sideEffects', () => {
  it('declares the CSS glob so no stylesheet is ever tree-shaken away', () => {
    expect(manifest.sideEffects).toContain('**/*.css')
  })

  it.each(shippedModules().filter((f) => BARE_IMPORT.test(readFileSync(`${root}/${f}`, 'utf8'))))(
    'lists %s, which is imported only for effect',
    (file) => {
      expect(
        manifest.sideEffects,
        `${file} has a bare side-effect import; a bundler will DROP it unless package.json "sideEffects" lists it`,
      ).toContain(`./${file}`)
    },
  )

  it('lists nothing that is not actually side-effectful', () => {
    const effectful = new Set(
      shippedModules()
        .filter((f) => BARE_IMPORT.test(readFileSync(`${root}/${f}`, 'utf8')))
        .map((f) => `./${f}`),
    )
    for (const entry of manifest.sideEffects) {
      if (entry === '**/*.css') continue
      expect(effectful, `"${entry}" is listed in sideEffects but has no import-time side effect`).toContain(entry)
    }
  })
})

describe('package.json exports', () => {
  it.each(Object.entries(manifest.exports))('%s resolves to a file that exists on disk', (_key, target) => {
    expect(
      statSync(`${root}/${target}`).isFile(),
      `"${target}" is listed in exports but does not exist on disk`,
    ).toBe(true)
  })
})

describe('package.json files', () => {
  it('still excludes src/docs, tests, and src/test from the pack', () => {
    expect(manifest.files).toEqual(
      expect.arrayContaining(['!src/docs', '!src/**/*.test.ts', '!src/**/*.test.tsx', '!src/test']),
    )
  })
})
