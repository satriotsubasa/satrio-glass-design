export type BackdropPreset = 'minimal' | 'mesh' | 'aurora' | 'wallpaper'

/** The four backdrop options, in picker order — for an app's Appearance section. */
export const BACKDROP_PRESET_OPTIONS: { value: BackdropPreset; label: string }[] = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'mesh', label: 'Mesh' },
  { value: 'aurora', label: 'Aurora' },
  { value: 'wallpaper', label: 'Wallpaper' },
]

/** The presets that carry a rule in styles/backdrops.css. 'minimal' is deliberately absent: it
 *  stamps NO `data-backdrop` attribute, so a build that never leaves minimal is byte-identical to
 *  one that never imported the stylesheet at all. */
export const BACKDROP_PRESETS_WITH_RULES = ['mesh', 'aurora', 'wallpaper'] as const
