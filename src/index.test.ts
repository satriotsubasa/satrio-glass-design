import { describe, expect, it } from 'vitest'
import * as pkg from './index'
import type {
  AppAnimations,
  ChipGroupOption,
  IconShape,
  ProgressBarStyle,
  RadioListOption,
  SelectOption,
  SheetProps,
} from './index'

/** The package's API contract, asserted literally. Every public component/helper is exported from
 *  the root (the export-completeness sweep — a component that lands without a root export fails
 *  here), and every public type is re-exported (types are erased at runtime, so tsc is their guard
 *  via the union below — including ChipGroupOption and RadioListOption, added alongside SelectOption
 *  / SheetProps so the option-type surface is consistent). */

const VALUE_EXPORTS = [
  // form + control primitives
  'Field', 'TextInput', 'Textarea', 'Select', 'SearchField', 'NumberStepper', 'Toggle', 'SegmentedControl',
  // buttons + surfaces
  'Button', 'Fab', 'Panel', 'Modal', 'ConfirmDialog', 'SaveButton',
  // settings furniture
  'SectionLabel', 'SectionHeader', 'SettingsGroup', 'SettingRow', 'SettingRowControl',
  // chips + lists + indicators
  'Chip', 'ChipGroup', 'FilterChip', 'ListRow', 'RadioListRow', 'ReorderList', 'StatCard', 'Skeleton',
  'EmptyState', 'PillRail', 'ProgressBar',
  // sheet + its helpers
  'Sheet', 'makeSheetVariants', 'shouldDismiss',
  // common / providers
  'toast', 'ErrorBoundary', 'AppMotionConfig', 'motionConfigReducedMotion', 'IconProvider', 'IconShapeDefs',
  // icon-shape system + hook
  'ICON_SHAPE_OPTIONS', 'ICON_SHAPE_CLASSES', 'ICON_SHAPE_CLIP_PATHS', 'LOBED_ICON_SHAPES', 'useHorizontalRail',
] as const

/** Compile-time proof each public type is exported from the root (referenced, so noUnusedLocals is
 *  satisfied and tsc fails to build if any is missing). */
export type RootTypeContract =
  | SelectOption | ChipGroupOption | RadioListOption | ProgressBarStyle | SheetProps | AppAnimations | IconShape

describe('package root export contract', () => {
  it.each(VALUE_EXPORTS)('exports %s', (name) => {
    expect((pkg as Record<string, unknown>)[name], `@satrio/glass-design must export "${name}" from its root`).toBeDefined()
  })
})
