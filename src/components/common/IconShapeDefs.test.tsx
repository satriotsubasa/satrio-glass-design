import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

import { IconShapeDefs } from './IconShapeDefs'
import { ICON_SHAPE_CLIP_PATHS, LOBED_ICON_SHAPES } from '../../lib/iconShapes'

describe('IconShapeDefs', () => {
  it('mounts one hidden svg with an objectBoundingBox clipPath per lobed shape', () => {
    const { container } = render(<IconShapeDefs />)

    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('aria-hidden')).toBe('true')

    for (const shape of LOBED_ICON_SHAPES) {
      const clip = container.querySelector(`clipPath#${ICON_SHAPE_CLIP_PATHS[shape].id}`)
      expect(clip, `missing clipPath for ${shape}`).not.toBeNull()
      expect(clip!.getAttribute('clipPathUnits')).toBe('objectBoundingBox')
      expect(clip!.querySelector('path')?.getAttribute('d')).toBe(ICON_SHAPE_CLIP_PATHS[shape].path)
    }
  })
})
