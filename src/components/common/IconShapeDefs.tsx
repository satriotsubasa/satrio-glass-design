import { ICON_SHAPE_CLIP_PATHS, LOBED_ICON_SHAPES } from '../../lib/iconShapes'

/**
 * A single hidden `<svg>` mounted at the app root that defines the `objectBoundingBox`
 * clipPaths for the lobed icon shapes (clover / blossom / flower). `global.css` references
 * them by id (`clip-path: url(#icon-shape-*)`) — both for the root-driven `.icon-shape`
 * containers and the standalone `.icon-shape--*` preview classes.
 */
export function IconShapeDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        {LOBED_ICON_SHAPES.map((shape) => {
          const { id, path } = ICON_SHAPE_CLIP_PATHS[shape]
          return (
            <clipPath key={id} id={id} clipPathUnits="objectBoundingBox">
              <path d={path} />
            </clipPath>
          )
        })}
      </defs>
    </svg>
  )
}
