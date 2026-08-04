import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowUpRight,
  BellSimple,
  Coffee,
  CreditCard,
  Gear,
  Globe,
  MagnifyingGlass,
  Palette,
  Plus,
  Tray,
  Wallet,
} from '@phosphor-icons/react'
import {
  BACKDROP_PRESET_OPTIONS,
  Button,
  Chip,
  ChipGroup,
  ConfirmDialog,
  EmptyState,
  Fab,
  Field,
  FilterChip,
  ICON_SHAPE_CLASSES,
  ICON_SHAPE_OPTIONS,
  KeyValue,
  ListRow,
  Modal,
  NumberStepper,
  PageHeader,
  Panel,
  PillRail,
  ProgressBar,
  RadioListRow,
  ReorderList,
  SaveButton,
  SearchField,
  SectionHeader,
  SegmentedControl,
  Select,
  SettingRow,
  SettingRowControl,
  SettingsGroup,
  Sheet,
  Skeleton,
  StatCard,
  Textarea,
  TextInput,
  Toggle,
  toast,
  type AppAnimations,
  type BackdropPreset,
  type ProgressBarStyle,
  type SelectOption,
} from '@satrio/glass-design'
import { ThemeControl } from './ThemeControl'
import styles from './Gallery.module.css'

const BUTTON_VARIANTS = ['primary', 'tonal', 'ghost', 'outline', 'danger'] as const
const BUTTON_SIZES = ['sm', 'md', 'lg'] as const
const CHIP_TONES = ['neutral', 'accent', 'income', 'expense', 'warning'] as const
const CHIP_SIZES = ['sm', 'md'] as const
const PROGRESS_TONES = ['accent', 'income', 'expense', 'warning'] as const

const PROGRESS_STYLE_OPTIONS: { value: ProgressBarStyle; label: string }[] = [
  { value: 'simple', label: 'Simple' },
  { value: 'wavy', label: 'Wavy' },
]

/** The material blur ladder (tokens.css) — tier per surface ROLE. */
const MATERIAL_TIERS = [
  { token: '--blur-chip', role: 'chip — smallest translucent elements' },
  { token: '--blur-card', role: 'card — dash-cards + content panels' },
  { token: '--blur-chrome', role: 'chrome — nav pill, sidebar, menus, toasts' },
  { token: '--blur-sheet', role: 'sheet — the modal sheet/dialog layer' },
] as const

type SegmentValue = 'day' | 'week' | 'month'
const SEGMENT_OPTIONS: { value: SegmentValue; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

const WALLET_OPTIONS: SelectOption[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Credit Card', icon: <CreditCard size={16} /> },
  { value: 'bank', label: 'Bank Account' },
]

// ---------------------------------------------------------------------------------------------
// Design-token catalogue fixtures — the motion + type tokens from src/styles/tokens.css are
// catalogue entries like any component: every easing/duration renders on a click-replay swatch,
// and the whole type ramp renders with live computed readouts.
// ---------------------------------------------------------------------------------------------
const EASE_TOKEN_SWATCHES = [
  { token: '--ease-glass', role: 'enter/exit — easeOutQuint' },
  { token: '--ease-move', role: 'on-screen movement/morph' },
  { token: '--ease-drawer', role: 'sheet/drawer travel' },
  { token: '--ease-hover', role: 'hover + colour only' },
] as const

const DUR_TOKEN_SWATCHES = [
  { token: '--dur-enter', role: 'entrances (≤300ms cap)' },
  { token: '--dur-exit', role: 'exits — faster than enter' },
  { token: '--dur-hover', role: 'hover/colour tints' },
  { token: '--dur-press', role: 'press feedback' },
] as const

/** The three appAnimations tiers (<html data-motion>, global.css): 'all' = authored motion (only
 *  the OS prefers-reduced-motion gate applies), 'reduced' = the 60ms gentle cap, 'none' = one
 *  instant 0.001ms frame with loops stopped. */
const MOTION_TIER_OPTIONS: { value: AppAnimations; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'reduced', label: 'Reduced' },
  { value: 'none', label: 'None' },
]

const TYPE_RAMP_STEPS = [
  { step: 'large-title', weight: 700 },
  { step: 'title', weight: 600 },
  { step: 'headline', weight: 600 },
  { step: 'body', weight: 400 },
  { step: 'callout', weight: 400 },
  { step: 'caption', weight: 400 },
] as const

// --- ReorderList demo fixture — each row has an `order` (sort key) and its own `enabled` flag,
// both persisted by the caller.
interface ReorderDemoItem {
  id: string
  label: string
  order: number
  enabled: boolean
}

const REORDER_DEMO_ITEMS: ReorderDemoItem[] = [
  { id: 'account', label: 'Account', order: 0, enabled: true },
  { id: 'category', label: 'Category', order: 1, enabled: true },
  { id: 'amount', label: 'Amount', order: 2, enabled: true },
  { id: 'note', label: 'Note', order: 3, enabled: false },
]

const DATE_FORMAT_OPTIONS = [
  { value: 'full', label: 'Full', example: 'Mon, 12 Jul 2026' },
  { value: 'dateOnly', label: 'Date only', example: '12 Jul 2026' },
  { value: 'numeric', label: 'Numeric', example: '12/07/2026' },
  { value: 'numericOnly', label: 'Numeric (short)', example: '12/7/26' },
]

const DATE_ORDER_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'mdy', label: 'MDY' },
  { value: 'dmy', label: 'DMY' },
  { value: 'ymd', label: 'YMD' },
  { value: 'ydm', label: 'YDM' },
  { value: 'system', label: 'System' },
]

// Enough pills to overflow a single row, so the PillRail demo actually scrolls/drags.
const PILL_RAIL_ITEMS = [
  'All', 'Food & Drink', 'Transport', 'Groceries', 'Rent', 'Utilities', 'Travel',
  'Health', 'Subscriptions', 'Entertainment', 'Gifts', 'Education', 'Insurance',
]

/** Resolves a root-level custom property to its computed string, for the token-value readouts.
 *  Read once on mount — token definitions are static per load (jsdom resolves these to ''). */
function useRootTokenValue(token: string): string {
  const [value, setValue] = useState('')
  useEffect(() => {
    setValue(getComputedStyle(document.documentElement).getPropertyValue(token).trim())
  }, [token])
  return value
}

/** One motion-token swatch: a dot crossing a track under the given transition, replayed on every
 *  click (the transition simply reverses on the second click — both directions demonstrate it). */
function MotionSwatch({ token, role, duration, easing }: {
  token: string
  role: string
  duration: string
  easing: string
}) {
  const [run, setRun] = useState(false)
  const value = useRootTokenValue(token)
  return (
    <button type="button" className={styles.motionSwatch} onClick={() => setRun((v) => !v)}>
      <span className={styles.motionTrack} aria-hidden>
        <span
          className={`${styles.motionDot} ${run ? styles.motionDotRun : ''}`}
          style={{ transitionDuration: duration, transitionTimingFunction: easing }}
        />
      </span>
      <code className={styles.motionToken}>{token}</code>
      <span className={styles.note}>{role}{value ? ` · ${value}` : ''}</span>
    </button>
  )
}

/** One type-ramp row: sample text on the step's size/leading/tracking tokens, with a LIVE
 *  computed readout (font-size / line-height / letter-spacing) that tracks --app-font-scale. */
function TypeRampRow({ step, weight, uppercase }: { step: string; weight: number; uppercase?: boolean }) {
  const sampleRef = useRef<HTMLSpanElement>(null)
  const [readout, setReadout] = useState('')
  useEffect(() => {
    const el = sampleRef.current
    if (!el) return
    const read = () => {
      const cs = getComputedStyle(el)
      if (!cs.fontSize) return // jsdom: CSS custom properties don't resolve — keep the tokens-only readout
      const tracking = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing
      setReadout(`${cs.fontSize} / ${cs.lineHeight} / ${tracking}`)
    }
    read()
    // Keep the readout live: --app-font-scale is an inline style on <html> and themes flip data-*
    // attributes there too — observe the root and re-read.
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [])
  return (
    <div className={styles.typeRampRow}>
      <span
        ref={sampleRef}
        className={styles.typeRampSample}
        style={{
          fontSize: `var(--fs-${step})`,
          lineHeight: `var(--lh-${step})`,
          letterSpacing: `var(--tracking-${uppercase ? 'eyebrow' : step})`,
          fontWeight: weight,
          textTransform: uppercase ? 'uppercase' : undefined,
        }}
      >
        {uppercase ? 'Eyebrow caption' : 'Money moves 0123456789'}
      </span>
      <span className={styles.note}>
        {uppercase
          ? `--fs-${step} · --lh-${step} · --tracking-eyebrow`
          : `--fs-${step} · --lh-${step} · --tracking-${step}`}
        {readout ? ` → ${readout}` : ''}
      </span>
    </div>
  )
}

interface SectionProps {
  eyebrow?: string
  title: string
  subheading?: string
  action?: ReactNode
  /** 'content' (default) wraps children in the translucent .panel-material surface. 'none' skips
   *  it — REQUIRED for the Backdrop section: .panel-material resets the legibility text-shadow to
   *  none, so a section built on the default would demonstrate nothing. */
  material?: 'content' | 'none'
  children: ReactNode
}

function Section({ eyebrow, title, subheading, action, material = 'content', children }: SectionProps) {
  return (
    <section className={styles.section}>
      <SectionHeader eyebrow={eyebrow} title={title} subheading={subheading} action={action} />
      <Panel material={material} padding="lg">
        {children}
      </Panel>
    </section>
  )
}

export interface GalleryProps {
  /** The current appAnimations tier — App.tsx owns it (it also feeds AppMotionConfig); the Motion
   *  section's data-motion switcher reads it. */
  animations: AppAnimations
  /** Switches the appAnimations tier from the Motion section — drives AppMotionConfig's framer
   *  side (via App); the handler stamps the CSS-side <html data-motion> itself. */
  onAnimationsChange: (next: AppAnimations) => void
}

export function Gallery({ animations, onAnimationsChange }: GalleryProps) {
  const [segment, setSegment] = useState<SegmentValue>('week')
  // FilterChip demo — a live multi-select so both states (and the colour-dot variant) show.
  const [filterChipIds, setFilterChipIds] = useState<string[]>(['income', 'ocbc'])
  const [walletValue, setWalletValue] = useState('cash')
  const [categoryValue, setCategoryValue] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  // Tall-content Sheet — body forced taller than the sheet's max-height so its own overflow-y
  // scroller engages: the permanent demonstration of the framer touch-action regression (an inline
  // `pan-x` stamp made exactly this sheet finger-unscrollable).
  const [tallSheetOpen, setTallSheetOpen] = useState(false)
  // Nested Sheets — inner opened from INSIDE the outer so SheetDepthContext nests and the explicit
  // sheet stack layers Escape correctly, plus the parent push-back cue.
  const [nestedOuterOpen, setNestedOuterOpen] = useState(false)
  const [nestedInnerOpen, setNestedInnerOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [pillRailValue, setPillRailValue] = useState(PILL_RAIL_ITEMS[0])

  // --- Settings-UI kit primitives ---
  const [toggleDemo, setToggleDemo] = useState(true)
  const [notifyToggleDemo, setNotifyToggleDemo] = useState(false)
  const [iconColorModeDemo, setIconColorModeDemo] = useState<'category' | 'mono'>('category')
  const [dateFormatDemo, setDateFormatDemo] = useState('full')
  const [dateOrderDemo, setDateOrderDemo] = useState('default')
  const [reorderItems, setReorderItems] = useState<ReorderDemoItem[]>(REORDER_DEMO_ITEMS)

  function handleReorderMove(key: string, direction: 'up' | 'down') {
    setReorderItems((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order)
      const index = sorted.findIndex((item) => item.id === key)
      const swapWith = direction === 'up' ? index - 1 : index + 1
      if (swapWith < 0 || swapWith >= sorted.length) return prev
      const a = sorted[index]
      const b = sorted[swapWith]
      return prev.map((item) => {
        if (item.id === a.id) return { ...item, order: b.order }
        if (item.id === b.id) return { ...item, order: a.order }
        return item
      })
    })
  }

  function handleReorderToggle(id: string) {
    setReorderItems((prev) => prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item)))
  }

  // --- SaveButton demo — the header save-state machine; the fake persist can succeed or fail, and
  // only clears its "dirty" flag on a successful save.
  const [saveDemoDirty, setSaveDemoDirty] = useState(true)
  const [saveDemoShouldFail, setSaveDemoShouldFail] = useState(false)

  // --- SearchField demo ---
  const [searchFieldValue, setSearchFieldValue] = useState('')

  // --- NumberStepper demo — a bounded integer (clamped 3–24). ---
  const [stepperValue, setStepperValue] = useState(20)

  // Progress Bar Style demo: ProgressBar takes a `barStyle` prop, so the demo drives it via local
  // state — this package ships no settings store, the consumer owns the value.
  const [progressStyleDemo, setProgressStyleDemo] = useState<ProgressBarStyle>('simple')

  // Motion-tier demo (Settings appAnimations): the switcher drives AppMotionConfig's `animations`
  // prop (lifted to App.tsx, the framer-motion side) AND stamps <html data-motion> DIRECTLY (the
  // CSS side). The mount-time data-motion attribute is restored on unmount so leaving the gallery
  // never leaves a trace on the document.
  useEffect(() => {
    const initial = document.documentElement.dataset.motion
    return () => {
      if (initial === undefined) delete document.documentElement.dataset.motion
      else document.documentElement.dataset.motion = initial
    }
  }, [])

  function handleMotionTierDemo(next: AppAnimations) {
    onAnimationsChange(next)
    document.documentElement.dataset.motion = next
  }

  // Backdrop-preset demo (Settings: the Appearance backdrop picker): stamps the REAL
  // <html data-backdrop> directly, exactly the motion-tier idiom above — 'minimal' REMOVES the
  // attribute rather than writing a value (attribute absence is the stock package backdrop). The
  // mount-time attribute is restored on unmount so leaving the gallery leaves no trace on the
  // document.
  const [backdropDemo, setBackdropDemo] = useState<BackdropPreset>('minimal')
  const [chromeToggleDemo, setChromeToggleDemo] = useState(false)

  useEffect(() => {
    const initial = document.documentElement.dataset.backdrop
    return () => {
      if (initial === undefined) delete document.documentElement.dataset.backdrop
      else document.documentElement.dataset.backdrop = initial
    }
  }, [])

  function handleBackdropDemo(next: BackdropPreset) {
    setBackdropDemo(next)
    if (next === 'minimal') delete document.documentElement.dataset.backdrop
    else document.documentElement.dataset.backdrop = next
  }

  return (
    <div className={`${styles.page} backdrop-scope`}>
      <header className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Component Gallery</h1>
        <p className={styles.intro}>
          Every component the package ships, in every variant and state, for visual QA. This page is the
          reference consumer — it imports only from <code>@satrio/glass-design</code>.
        </p>
        <div className={styles.themeSwitcher}>
          <span className={styles.tag}>theme</span>
          <ThemeControl />
        </div>
      </header>

      <Section
        eyebrow="Design tokens"
        title="Motion tokens"
        subheading="The purpose-split easing tree + duration ramp from tokens.css. Click a swatch to replay it (the dot simply crosses back on the next click — both directions demonstrate the curve). Easing swatches run slowed to 600ms so the curve shapes are legible; duration swatches run at the token's real speed on --ease-glass. The data-motion switcher demonstrates all three appAnimations tiers LIVE on this page (it also drives AppMotionConfig's framer side): 'reduced' caps every swatch to the 60ms gentle tier (the same tier the OS Reduce Motion preference now maps to), 'none' snaps them to a single instant frame."
      >
        <div className={styles.col}>
          <div className={styles.row}>
            <span className={styles.tag}>data-motion</span>
            <SegmentedControl
              options={MOTION_TIER_OPTIONS}
              value={animations}
              onChange={handleMotionTierDemo}
              ariaLabel="Motion tier (data-motion)"
            />
          </div>
          <div className={styles.row}>
            <span className={styles.tag}>easings</span>
          </div>
          <div className={styles.motionGrid}>
            {EASE_TOKEN_SWATCHES.map(({ token, role }) => (
              <MotionSwatch key={token} token={token} role={role} duration="600ms" easing={`var(${token})`} />
            ))}
          </div>
          <div className={styles.row}>
            <span className={styles.tag}>durations</span>
          </div>
          <div className={styles.motionGrid}>
            {DUR_TOKEN_SWATCHES.map(({ token, role }) => (
              <MotionSwatch key={token} token={token} role={role} duration={`var(${token})`} easing="var(--ease-glass)" />
            ))}
          </div>
          <div className={styles.row}>
            <span className={styles.tag}>press states</span>
            <Button variant="tonal" size="sm">Hold me — scale(0.97)</Button>
          </div>
          <p className={styles.note}>
            House press feedback: every tappable kit surface compresses on
            <code> :active</code> — <code>scale(0.97)</code> for compact controls (buttons, chips, segments,
            nav items), <code>scale(0.98)</code> for large full-width rows (ListRow, SettingRow, RadioListRow,
            Select triggers). Each transition list names <code>transform</code> at
            <code> --dur-press --ease-glass</code> so the release eases back instead of snapping.
          </p>
        </div>
      </Section>

      <Section
        eyebrow="Design tokens"
        title="Type ramp"
        subheading="All six steps from tokens.css — font-size × --app-font-scale, UNITLESS leading (a ratio over the already-scaled size), and the em tracking ramp — plus the uppercase eyebrow exception. Readouts are live computed values, so they track --app-font-scale."
      >
        <div className={styles.col}>
          {TYPE_RAMP_STEPS.map(({ step, weight }) => (
            <TypeRampRow key={step} step={step} weight={weight} />
          ))}
          <TypeRampRow step="caption" weight={600} uppercase />
        </div>
      </Section>

      <Section
        eyebrow="Design tokens"
        title="Materials"
        subheading="The four-tier blur ladder from tokens.css — material thickness scales with surface size (Apple §12: bigger surfaces read as thicker), so the heaviest blur is spent on the sheet layer floating over live content, not on cards sitting on the smooth backdrop gradient. Each pane backdrop-filters the same busy test pattern, so the tier differences are visible. Under OS Reduce Transparency or Increase Contrast every tier collapses to 0px and the surface fills go opaque."
      >
        <div className={styles.materialGrid}>
          {MATERIAL_TIERS.map(({ token, role }) => (
            <div key={token} className={styles.materialSwatch}>
              <div className={styles.materialBackdrop} aria-hidden />
              <div
                className={styles.materialPane}
                style={{
                  backdropFilter: `blur(var(${token})) saturate(150%)`,
                  WebkitBackdropFilter: `blur(var(${token})) saturate(150%)`,
                }}
              >
                <span className={styles.motionToken}>{token}</span>
                <span className={styles.materialRole}>{role}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Design tokens"
        title="Backdrops"
        material="none"
        subheading="The four-way backdrop system (<html data-backdrop>, styles/backdrops.css + styles/legibility.css). Mesh and aurora are TOKEN-DERIVED recipes — every layer is a color-mix over --accent/--accent-fill/--income/--expense/--bg, so they re-skin with your brand.css automatically and retune per theme. Wallpaper points --backdrop at your --backdrop-image (this docs app supplies two authored placeholder SVGs via docs-brand.css). Minimal stamps NO attribute: absence IS the stock accent-tinted --backdrop, so a build that never leaves minimal renders byte-identically to one that never imported the stylesheet. This section renders on material=&quot;none&quot; on purpose — the four global material classes reset the legibility shadow to none, so a content panel would hide the very thing being demonstrated."
      >
        <div className={styles.col}>
          <div className={styles.row}>
            <span className={styles.tag}>data-backdrop</span>
            <SegmentedControl
              options={BACKDROP_PRESET_OPTIONS}
              value={backdropDemo}
              onChange={handleBackdropDemo}
              ariaLabel="Backdrop preset (data-backdrop)"
            />
          </div>
          <div className={styles.grid}>
            <div className={styles.backdropBare}>
              <span className={styles.tag}>on backdrop</span>
              <p>
                Text painted straight on the backdrop inherits the layer&apos;s text-shadow — a light glow
                behind dark text, a dark shadow behind light text. One declaration on the region covers
                every heading, caption and empty state, including hashed-class components this
                stylesheet could never target directly.
              </p>
            </div>
            <div className="dash-card">
              <div className={styles.backdropCard}>
                <span className={styles.tag}>on material</span>
                <p>
                  The same text inside a .dash-card. The material classes reset text-shadow to none, so
                  card-borne text stays stock. That bounding is the whole trick: broad enough to cover
                  anything, narrow enough not to smear card text.
                </p>
              </div>
            </div>
          </div>
          <div className={styles.row}>
            <span className={styles.tag}>backdrop-chrome</span>
            <Button className="backdrop-chrome" iconOnly variant="ghost" aria-label="Search (on backdrop)">
              <MagnifyingGlass size={18} />
            </Button>
            <Button
              className="backdrop-chrome"
              iconOnly
              variant={chromeToggleDemo ? 'primary' : 'ghost'}
              aria-pressed={chromeToggleDemo}
              aria-label="Filters (pressed stands the chrome down)"
              onClick={() => setChromeToggleDemo((v) => !v)}
            >
              <Gear size={18} />
            </Button>
          </div>
          <p className={styles.note}>
            .backdrop-chrome gives a floating on-backdrop control the nav pill&apos;s material (--nav-bg +
            the chrome blur tier + the glass hairline) so a ghost button cannot dissolve into the image.
            It stands down for a pressed toggle — tap the second button: an opaque primary fill needs no
            chrome and must not have it clobbered. Under Increase Contrast the chrome goes opaque and the
            shadows STAY (the image still paints); under Reduce Transparency the backdrop flattens to
            --bg and the whole layer stands down with it; &quot;Colorful interface: off&quot; stands the
            layer down too, on top of whichever preset is selected.
          </p>
          <div className={styles.row}>
            <span className={styles.tag}>chips</span>
            {CHIP_TONES.map((tone) => (
              <Chip key={tone} tone={tone}>{tone}</Chip>
            ))}
            <FilterChip label="Active filter" active onClick={() => {}} />
            <FilterChip label="Inactive filter" active={false} onClick={() => {}} />
          </div>
          <p className={styles.note}>
            Chip and FilterChip tint with color-mix(..., transparent) — over a busy preset that
            dissolves into the image. Under [data-backdrop] each tone mixes into --surface instead,
            with a Reduce Transparency twin back to the stock transparent mix once the backdrop
            itself has flattened away.
          </p>
          <p className={styles.note}>
            Per app, not per package: the wallpaper image assets and their --backdrop-image declarations,
            the settings key and its picker UI (feed it BACKDROP_PRESET_OPTIONS), the pre-paint boot
            stamp in index.html, and any app-specific at-rest material exceptions. See the README&apos;s
            Backdrops section.
          </p>
        </div>
      </Section>

      <Section title="Button" subheading="Every variant × size, plus loading and icon-only states">
        <div className={styles.col}>
          {BUTTON_VARIANTS.map((variant) => (
            <div key={variant} className={styles.row}>
              <span className={styles.tag}>{variant}</span>
              {BUTTON_SIZES.map((size) => (
                <Button key={size} variant={variant} size={size}>
                  {size.toUpperCase()}
                </Button>
              ))}
            </div>
          ))}
          <div className={styles.row}>
            <span className={styles.tag}>loading</span>
            <Button loading>Saving…</Button>
            <Button variant="outline" loading>Loading</Button>
            <Button variant="danger" loading>Deleting…</Button>
          </div>
          <div className={styles.row}>
            <span className={styles.tag}>icon only</span>
            <Button iconOnly aria-label="Add"><Plus size={18} /></Button>
            <Button iconOnly variant="ghost" aria-label="Search"><MagnifyingGlass size={18} /></Button>
            <Button iconOnly variant="outline" aria-label="Settings"><Gear size={18} /></Button>
          </div>
        </div>
      </Section>

      <Section
        title="Fab"
        subheading="The shared floating action button (Fab) — a 56px accent rounded-rect tile (18px radius), scale(0.94) press, default bold Plus glyph with a children override. In real use it is position:fixed chrome: bottom-right above the mobile dock, mirrored to the bottom-left lane under left-handed mode. The catalogue overrides it static so the tile sits in flow instead of floating over this page."
      >
        <div className={styles.row}>
          <span className={styles.tag}>default</span>
          <span className={styles.fabDemo}>
            <Fab aria-label="New (demo)" onClick={() => {}} />
          </span>
          <span className={styles.tag}>custom child</span>
          <span className={styles.fabDemo}>
            <Fab aria-label="Search (demo)" onClick={() => {}}>
              <MagnifyingGlass size={24} weight="bold" />
            </Fab>
          </span>
        </div>
      </Section>

      <Section title="Panel" subheading="glass (chrome) vs. content (translucent) vs. solid (opaque) vs. card (dash-card) vs. none (layout only)">
        <div className={styles.grid}>
          <Panel material="glass" padding="lg" className={styles.panelSwatch}>
            <span className={styles.tag}>glass</span>
            <p>Chrome material — floats over content, used for nav/dock/sheets.</p>
          </Panel>
          <Panel material="content" padding="lg" className={styles.panelSwatch}>
            <span className={styles.tag}>content</span>
            <p>Translucent content panel — a legibility veil over the backdrop.</p>
          </Panel>
          <Panel material="solid" padding="lg" className={styles.panelSwatch}>
            <span className={styles.tag}>solid</span>
            <p>Solid surface — opaque background, no blur.</p>
          </Panel>
          <Panel material="card" padding="lg" className={styles.panelSwatch}>
            <span className={styles.tag}>card</span>
            <p>Unified dash-card material — the canonical dashboard widget surface.</p>
          </Panel>
          <Panel material="none" padding="lg" className={styles.panelSwatch}>
            <span className={styles.tag}>none</span>
            <p>No material — padding/layout only, for children that bring their own surface.</p>
          </Panel>
        </div>
      </Section>

      <Section
        title="PageHeader vs. SectionHeader"
        subheading="Same slot API (eyebrow/title/subheading/action) at two different levels of the hierarchy: PageHeader is the page title — one per page, an h1 at --fs-large-title. SectionHeader is an in-page section title — as many as a page needs, an h2 at --fs-title."
      >
        <div className={styles.col}>
          <PageHeader
            eyebrow="Health"
            title="Vaccines"
            subheading="A live PageHeader (h1) rendered inside the gallery"
            action={<Button size="sm" variant="tonal">Add record</Button>}
          />
          <SectionHeader
            eyebrow="This Month"
            title="Overview"
            subheading="A live SectionHeader (h2) rendered inside the gallery"
            action={<Button size="sm" variant="tonal">See all</Button>}
          />
        </div>
      </Section>

      <Section title="Chip" subheading="Every tone × size">
        <div className={styles.col}>
          {CHIP_TONES.map((tone) => (
            <div key={tone} className={styles.row}>
              <span className={styles.tag}>{tone}</span>
              {CHIP_SIZES.map((size) => (
                <Chip key={size} tone={tone} size={size}>{tone}</Chip>
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="FilterChip"
        subheading="multi-select filter pill (aria-pressed active state) with an optional identity colour dot for accounts/goals/loans. Tap to toggle."
      >
        <div className={styles.row}>
          {[
            { id: 'income', label: 'Income' },
            { id: 'subscription', label: 'Subscription' },
            { id: 'notPaid', label: 'Not paid' },
            { id: 'ocbc', label: 'OCBC SG', colour: '#4A90D9' },
            { id: 'goal', label: 'Japan Trip', colour: '#4AB08A' },
          ].map((item) => (
            <FilterChip
              key={item.id}
              label={item.label}
              colour={item.colour}
              active={filterChipIds.includes(item.id)}
              onClick={() =>
                setFilterChipIds((prev) =>
                  prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id],
                )
              }
            />
          ))}
        </div>
      </Section>

      <Section
        title="SegmentedControl"
        subheading="RECESSED track: an opaque surface-2 track pressed INTO the parent (inset shadow), with the accent-tinted active pill raised out of it. Shown standalone and on the two surfaces it actually ships on — the dash-card material and the sheet material. Controlled via useState; the disabled state dims the whole pill, active option stays visible."
      >
        <div className={styles.col}>
          <div className={styles.row}>
            <span className={styles.tag}>standalone</span>
            <SegmentedControl options={SEGMENT_OPTIONS} value={segment} onChange={setSegment} ariaLabel="Period" />
          </div>
          <div className="dash-card">
            <div className={styles.surfaceDemo}>
              <span className={styles.tag}>on dash-card</span>
              <SegmentedControl options={SEGMENT_OPTIONS} value={segment} onChange={setSegment} ariaLabel="Period (on dash-card)" />
            </div>
          </div>
          <div className={styles.sheetSurfaceDemo}>
            <div className={styles.surfaceDemo}>
              <span className={styles.tag}>on sheet</span>
              <SegmentedControl options={SEGMENT_OPTIONS} value={segment} onChange={setSegment} ariaLabel="Period (on sheet material)" />
            </div>
          </div>
          <p className={styles.tag}>selected: {segment}</p>
          <div className={styles.row}>
            <span className={styles.tag}>disabled</span>
            <SegmentedControl options={SEGMENT_OPTIONS} value={segment} onChange={() => {}} disabled ariaLabel="Period (disabled)" />
          </div>
        </div>
      </Section>

      <Section
        title="Field, TextInput, Textarea, Select"
        subheading={'Normal, hint, error, and hint+error together — the error is a role="alert" live region and each control points aria-describedby at Field\'s ${htmlFor}-hint / ${htmlFor}-error ids'}
      >
        <div className={styles.grid}>
          <Field label="Merchant" htmlFor="gallery-input-normal">
            <TextInput id="gallery-input-normal" placeholder="e.g. Blue Bottle Coffee" defaultValue="Blue Bottle Coffee" />
          </Field>
          <Field label="Amount" htmlFor="gallery-input-hint" hint="Shown with a hint below the field">
            <TextInput id="gallery-input-hint" mono placeholder="0.00" defaultValue="42.50" aria-describedby="gallery-input-hint-hint" />
          </Field>
          <Field label="Reference" htmlFor="gallery-input-error" hint="Hint and error render together — the format rule survives the failure" error="This field is required">
            <TextInput id="gallery-input-error" invalid placeholder="Required" aria-describedby="gallery-input-error-hint gallery-input-error-error" />
          </Field>
          <Field label="Notes" htmlFor="gallery-textarea" hint="Multi-line input">
            <Textarea id="gallery-textarea" placeholder="Add a note…" defaultValue="Lunch with the team." aria-describedby="gallery-textarea-hint" />
          </Field>
          <Field label="Wallet" htmlFor="gallery-select" hint="Radix Select — one option shows an icon">
            <Select
              id="gallery-select"
              options={WALLET_OPTIONS}
              value={walletValue}
              onValueChange={setWalletValue}
              placeholder="Choose a wallet"
              aria-describedby="gallery-select-hint"
            />
          </Field>
          <Field label="Category" htmlFor="gallery-select-error" error="Pick a category to continue">
            <Select
              id="gallery-select-error"
              options={WALLET_OPTIONS}
              value={categoryValue}
              onValueChange={setCategoryValue}
              placeholder="Choose a category"
              invalid
              aria-describedby="gallery-select-error-error"
            />
          </Field>
        </div>
      </Section>

      <Section title="StatCard" subheading="Grid layout with icon and delta tones, plus surface='bare' (layout-only, for when a parent Panel material='card' already supplies the single surface)">
        <div className={styles.grid}>
          <StatCard
            label="Net worth"
            value="S$128,450"
            delta="+4.2% this month"
            deltaTone="income"
            icon={<Wallet size={18} />}
          />
          <StatCard
            label="Spent this month"
            value="−S$2,380.40"
            delta="-8.1% vs last month"
            deltaTone="expense"
            icon={<ArrowUpRight size={18} />}
          />
          <StatCard
            label="Saved this month"
            value="S$640"
            delta="On track"
            deltaTone="neutral"
          />
        </div>
        <p className={styles.note}>surface="bare" — three transparent StatCards sharing one Panel material="card":</p>
        <Panel material="card" padding="md">
          <div className={styles.grid}>
            <StatCard surface="bare" label="Income" value="S$5,200" />
            <StatCard surface="bare" label="Expenses" value="−S$3,100.55" />
            <StatCard surface="bare" label="Net" value="S$2,099.45" />
          </div>
        </Panel>
      </Section>

      <Section title="KeyValue" subheading="A calm labelled fact — stacked label/value/detail, no grid logic (consumers own packing). Deliberately NOT the StatCard treatment: sans body-size value, no mono, no tabular-nums.">
        <div className={styles.grid}>
          <KeyValue label="Status" value="Active" />
          <KeyValue label="Dose" value="2 of 3" detail="Next due Sep 12" />
          <KeyValue label="Provider" value="Raffles Medical" detail="Last visit Jul 3" />
        </div>
      </Section>

      <Section
        title="ProgressBar"
        subheading="Every tone, plus edge fractions (1% is the end-cap worst case), an over-100 and a negative value to show clamping, and the `color` override (an exact CSS colour for the fill). The wavy/simple toggle drives each bar's `barStyle` prop via local state — this package ships no settings store, so the consumer owns the value. Progress animates compositor-only: the fill is an unscaled wrapper holding a scaleX(--bar-progress) body plus a fixed-radius cap layer that translates along the bar, all clipped by the pill track — so the 999px end cap never squashes and the wavy mask (on the wrapper) never stretches."
      >
        <div className={styles.col}>
          <div className={styles.row}>
            <span className={styles.tag}>bar style</span>
            <SegmentedControl
              options={PROGRESS_STYLE_OPTIONS}
              value={progressStyleDemo}
              onChange={setProgressStyleDemo}
              ariaLabel="Progress bar style"
            />
          </div>
          {PROGRESS_TONES.map((tone) => (
            <div key={tone} className={styles.row}>
              <span className={styles.tag}>{tone}</span>
              <div className={styles.progressTrack}><ProgressBar value={62} tone={tone} barStyle={progressStyleDemo} /></div>
            </div>
          ))}
          <div className={styles.row}>
            <span className={styles.tag}>value 1 / 100 (end-cap case)</span>
            <div className={styles.progressTrack}><ProgressBar value={1} max={100} tone="accent" barStyle={progressStyleDemo} /></div>
          </div>
          <div className={styles.row}>
            <span className={styles.tag}>value 100 / 100</span>
            <div className={styles.progressTrack}><ProgressBar value={100} max={100} tone="income" barStyle={progressStyleDemo} /></div>
          </div>
          <div className={styles.row}>
            <span className={styles.tag}>value 180 / 100</span>
            <div className={styles.progressTrack}><ProgressBar value={180} max={100} tone="expense" barStyle={progressStyleDemo} /></div>
          </div>
          <div className={styles.row}>
            <span className={styles.tag}>value -40 / 100</span>
            <div className={styles.progressTrack}><ProgressBar value={-40} max={100} tone="accent" barStyle={progressStyleDemo} /></div>
          </div>
          <div className={styles.row}>
            <span className={styles.tag}>color #9B59B6</span>
            <div className={styles.progressTrack}><ProgressBar value={62} color="#9B59B6" barStyle={progressStyleDemo} /></div>
          </div>
          <div className={styles.row}>
            <span className={styles.tag}>color #00BCD4 (beats tone="expense")</span>
            <div className={styles.progressTrack}><ProgressBar value={45} tone="expense" color="#00BCD4" barStyle={progressStyleDemo} /></div>
          </div>
          <p className={styles.note}>
            color writes an inline --bar-fill custom property that beats the tone class's value, plus a
            label-tinted contrast floor (85% colour mixed with 15% var(--label)) so an arbitrary colour
            can't vanish against the track in dark/black themes — the tone classes paint pure. Flip the
            style toggle above to Wavy to see the mask keep applying over the overridden colour.
          </p>
        </div>
      </Section>

      <Section title="ListRow" subheading="Static, interactive (onClick), and with leading + trailing content">
        <div className={styles.col}>
          <ListRow title="Static row" subtitle="No onClick or href — plain display" />
          <ListRow
            title="Interactive row"
            subtitle="Click me — logs to the console"
            onClick={() => console.log('ListRow clicked')}
          />
          <ListRow
            leading={<Coffee size={18} />}
            title="Blue Bottle Coffee"
            subtitle="Today, 8:41 AM"
            trailing="−$5.50"
            onClick={() => console.log('Transaction row clicked')}
          />
        </div>
      </Section>

      <Section
        title="ListRow — titleWrap"
        subheading="'truncate' (default) keeps a long title to one line with an ellipsis; 'clamp2' wraps it onto up to two lines instead of cutting it off."
      >
        <div className={styles.grid}>
          <div className={styles.col}>
            <span className={styles.tag}>titleWrap=&quot;truncate&quot; (default)</span>
            <ListRow
              title="Reimbursement for the team offsite venue deposit and catering"
              subtitle="Single line, ellipsized"
            />
          </div>
          <div className={styles.col}>
            <span className={styles.tag}>titleWrap=&quot;clamp2&quot;</span>
            <ListRow
              title="Reimbursement for the team offsite venue deposit and catering"
              subtitle="Wraps onto up to two lines"
              titleWrap="clamp2"
            />
          </div>
        </div>
      </Section>

      <Section
        title="EmptyState"
        subheading="Icon, title, description — with the optional action (a creation dead-end must offer a way forward; a search miss needs none, the user edits the query)"
      >
        <div className={styles.col}>
          <EmptyState
            icon={<Tray size={32} />}
            title="No transactions yet"
            description="Add your first transaction to see it here."
            action={<Button size="sm">Add transaction</Button>}
          />
          <EmptyState
            icon={<Tray size={32} />}
            title="No matching transactions"
            description="Try a different search term."
          />
        </div>
      </Section>

      <Section
        title="EmptyState — size"
        subheading="'md' (default) is the original block; 'sm' shrinks padding and both type sizes for a tighter host, like an inline card slot."
      >
        <div className={styles.grid}>
          <div className={styles.col}>
            <span className={styles.tag}>size=&quot;md&quot; (default)</span>
            <EmptyState
              icon={<Tray size={32} />}
              title="No matching transactions"
              description="Try a different search term."
            />
          </div>
          <div className={styles.col}>
            <span className={styles.tag}>size=&quot;sm&quot;</span>
            <EmptyState
              icon={<Tray size={32} />}
              title="No matching transactions"
              description="Try a different search term."
              size="sm"
            />
          </div>
        </div>
      </Section>

      <Section title="Skeleton" subheading="A few sizes — text line, avatar, and a content block">
        <div className={styles.col}>
          <div className={styles.row}><Skeleton width="60%" height="14px" /></div>
          <div className={styles.row}>
            <Skeleton width="40px" height="40px" radius="999px" />
            <Skeleton width="200px" height="14px" />
          </div>
          <div className={styles.row}><Skeleton width="100%" height="80px" radius="16px" /></div>
        </div>
      </Section>

      <Section title="Sheet, Modal, ConfirmDialog" subheading="Overlays — open state via useState. The page behind locks while any sheet is open (react-remove-scroll). Drag-to-dismiss: the grabber always works (every variant); a sheet whose content does NOT overflow also dismisses from a swipe anywhere on its surface, while scrollable sheet bodies keep native finger scrolling.">
        <div className={styles.row}>
          <Button onClick={() => setSheetOpen(true)}>Open Sheet</Button>
          <Button variant="tonal" onClick={() => setTallSheetOpen(true)}>Open tall Sheet</Button>
          <Button variant="tonal" onClick={() => setNestedOuterOpen(true)}>Open nested Sheets</Button>
          <Button variant="tonal" onClick={() => setModalOpen(true)}>Open Modal</Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>Open ConfirmDialog</Button>
        </div>

        <Sheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Sheet"
          footer={<Button onClick={() => setSheetOpen(false)}>Close</Button>}
        >
          <p>
            Traps focus while open and restores it to the opener on close — nested sheets restore
            along the opener chain, and Escape always dismisses only the top-most sheet. Drag the
            grabber down (or press Escape) to dismiss. On a mobile viewport a dismissing drag
            exits downward at the speed of the throw.
          </p>
        </Sheet>

        {/* Tall-content variant — the body is FORCED taller than the sheet's max-height so the
            sheet's own overflow-y scroller engages: the body must scroll on touch, and dismissal
            must still work from the grabber. */}
        <Sheet
          open={tallSheetOpen}
          onClose={() => setTallSheetOpen(false)}
          title="Tall Sheet"
          footer={<Button onClick={() => setTallSheetOpen(false)}>Close</Button>}
        >
          <p className={styles.note}>
            60 rows — taller than the sheet's max-height, so the sheet itself scrolls. On a touch
            device this list must scroll with a finger (the sheet element carries no inline
            touch-action); drag-to-dismiss lives on the grabber only.
          </p>
          {Array.from({ length: 60 }, (_, i) => (
            <p key={i} style={{ margin: '0 0 12px', color: 'var(--label-2)' }}>
              Scrollable row {i + 1} of 60
            </p>
          ))}
        </Sheet>

        {/* Nested variant — the inner Sheet renders INSIDE the outer's children, so
            SheetDepthContext ranks it above its ancestor in the explicit sheet stack: Escape and
            drag dismiss only the inner first. While the inner sheet is open the outer recedes to
            the `stacked` variant (scale 0.94, y −8) and springs back the moment the inner closes. */}
        <Sheet
          open={nestedOuterOpen}
          onClose={() => { setNestedInnerOpen(false); setNestedOuterOpen(false) }}
          title="Outer Sheet"
          footer={<Button variant="ghost" onClick={() => { setNestedInnerOpen(false); setNestedOuterOpen(false) }}>Close</Button>}
        >
          <p>
            A sheet that opens another sheet — the picker-inside-editor shape. Escape (or a
            grabber drag) dismisses only the top-most layer; closing the inner restores focus to
            its trigger below. While the inner sheet is open, this outer sheet pushes back
            (scale 0.94, −8px — the stacked-sheet depth cue) and springs forward again when the
            inner closes.
          </p>
          <Button onClick={() => setNestedInnerOpen(true)}>Open inner Sheet</Button>
          <Sheet
            open={nestedInnerOpen}
            onClose={() => setNestedInnerOpen(false)}
            title="Inner Sheet"
            footer={<Button onClick={() => setNestedInnerOpen(false)}>Close</Button>}
          >
            <p>
              The top of the stack — Escape and the grabber act on this sheet only, never the
              outer one underneath.
            </p>
          </Sheet>
        </Sheet>

        <Modal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title="Modal"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={() => setModalOpen(false)}>Save</Button>
            </>
          }
        >
          <p style={{ color: 'var(--label-2)', margin: 0 }}>
            Radix Dialog — traps focus and closes on Escape or an outside click.
          </p>
        </Modal>

        <ConfirmDialog
          open={confirmOpen}
          title="Delete this transaction?"
          message="This action can't be undone."
          confirmLabel="Delete"
          tone="danger"
          onConfirm={() => setConfirmOpen(false)}
          onCancel={() => setConfirmOpen(false)}
        />
      </Section>

      <Section
        title="toast"
        subheading="react-hot-toast fired through the package's re-exported toast() — the <Toaster/> is mounted once at the app root (App.tsx). Tap to fire; it lands bottom-center and auto-dismisses."
      >
        <div className={styles.row}>
          <Button onClick={() => toast('Saved to your library')}>Fire toast</Button>
          <Button variant="tonal" onClick={() => toast.success('Transaction added')}>Success toast</Button>
          <Button variant="danger" onClick={() => toast.error('Something went wrong')}>Error toast</Button>
        </div>
      </Section>

      {/* -----------------------------------------------------------------------------------
          Settings-UI kit primitives — Toggle, SettingRow, SettingRowControl,
          SectionLabel/SettingsGroup, ReorderList, RadioListRow, ChipGroup. Every demo is bound
          to local useState so this catalogue is fully interactive, not just a look.
      ----------------------------------------------------------------------------------- */}

      <Section
        eyebrow="Settings-UI kit"
        title="Toggle"
        subheading="An iOS-style glass switch — role=switch + aria-checked, keyboard (Space/Enter), ≥44px touch target, disabled state"
      >
        <div className={styles.col}>
          <div className={styles.row}>
            <span className={styles.tag}>interactive</span>
            <Toggle checked={toggleDemo} onChange={setToggleDemo} aria-label="Demo toggle" />
            <span className={styles.note}>{toggleDemo ? 'On' : 'Off'}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.tag}>disabled</span>
            <Toggle checked disabled onChange={() => {}} aria-label="Disabled toggle (on)" />
            <Toggle checked={false} disabled onChange={() => {}} aria-label="Disabled toggle (off)" />
          </div>
        </div>
      </Section>

      <Section
        title="SectionLabel + SettingsGroup"
        subheading="the grouped-card idiom (glass .dash-card + an uppercase eyebrow caption) every Settings section is built from"
      >
        <SettingsGroup label="Appearance">
          <SettingRow
            icon={<Palette size={18} />}
            label="Theme"
            description="Light, dark, black, or system"
            onClick={() => console.log('Theme row clicked')}
          />
          <SettingRow
            icon={<Globe size={18} />}
            label="Language"
            description="English (US)"
            onClick={() => console.log('Language row clicked')}
          />
        </SettingsGroup>
      </Section>

      <Section
        title="SettingRow"
        subheading="nav variant (onClick, no right slot → a <button> with a trailing chevron) vs. control variant (a right slot → a <div>), plus destructive tone and disabled"
      >
        <SettingsGroup>
          <SettingRow
            icon={<Globe size={18} />}
            label="Exchange rates"
            description="Manage currency conversion rates"
            onClick={() => console.log('Exchange rates row clicked')}
          />
          <SettingRow
            icon={<BellSimple size={18} />}
            label="Notifications"
            right={<Toggle checked={notifyToggleDemo} onChange={setNotifyToggleDemo} aria-label="Notifications" />}
          />
          <SettingRow tone="destructive" label="Sign out" onClick={() => console.log('Sign out row clicked')} />
          <SettingRow
            label="Auto-pay transactions"
            description="Coming soon"
            disabled
            right={<Toggle checked={false} disabled onChange={() => {}} aria-label="Auto-pay transactions" />}
          />
        </SettingsGroup>
      </Section>

      <Section
        title="Icon shapes"
        subheading="the six iconShape options (Settings → Appearance) — circle/rounded-square/pebble are pure border-radius; clover/blossom/flower clip through IconShapeDefs' objectBoundingBox Bézier clipPaths. App-wide icon tiles opt in via the global .icon-shape class and follow <html data-icon-shape>."
      >
        <div className={styles.row} style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          {ICON_SHAPE_OPTIONS.map((option) => (
            <div
              key={option.value}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
            >
              <span
                className={ICON_SHAPE_CLASSES[option.value]}
                style={{ width: 52, height: 52, background: 'var(--accent-fill)' }}
                aria-hidden
              />
              <span className={styles.note}>{option.label}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="SettingRowControl" subheading="label/description left, an arbitrary control right-aligned in children">
        <SettingsGroup>
          <SettingRowControl icon={<Palette size={18} />} label="Icon color mode" description="Category or monochrome">
            <SegmentedControl
              options={[
                { value: 'category', label: 'Category' },
                { value: 'mono', label: 'Mono' },
              ]}
              value={iconColorModeDemo}
              onChange={setIconColorModeDemo}
              ariaLabel="Icon color mode"
            />
          </SettingRowControl>
        </SettingsGroup>
      </Section>

      <Section
        title="ReorderList"
        subheading="sorts by order ascending; up/down chevrons swap order (disabled at the ends); renderRow supplies its own content — here, a SettingRow with an enable Toggle"
      >
        <SettingsGroup>
          <ReorderList
            items={reorderItems}
            getKey={(item) => item.id}
            getOrder={(item) => item.order}
            onMove={handleReorderMove}
            renderRow={(item) => (
              <SettingRow
                label={item.label}
                right={
                  <Toggle
                    checked={item.enabled}
                    onChange={() => handleReorderToggle(item.id)}
                    aria-label={`Enable ${item.label}`}
                  />
                }
              />
            )}
          />
        </SettingsGroup>
        <p className={styles.note}>
          Order: {[...reorderItems].sort((a, b) => a.order - b.order).map((item) => item.label).join(' › ')}
        </p>
      </Section>

      <Section
        title="RadioListRow"
        subheading="a vertical list of full-width radio rows — dot + label + right-aligned example — for dateFormatType"
      >
        <SettingsGroup>
          <RadioListRow value={dateFormatDemo} onChange={setDateFormatDemo} options={DATE_FORMAT_OPTIONS} aria-label="Date format" />
        </SettingsGroup>
        <p className={styles.note}>Selected: {dateFormatDemo}</p>
      </Section>

      <Section title="ChipGroup" subheading="a wrapping row of Chip pills, active = accent-filled — for dateOrder's 6 options">
        <div className={styles.col}>
          <ChipGroup value={dateOrderDemo} onChange={setDateOrderDemo} options={DATE_ORDER_OPTIONS} aria-label="Date order" />
          <p className={styles.note}>Selected: {dateOrderDemo}</p>
        </div>
      </Section>

      <Section
        title="PillRail"
        subheading="The shared horizontal pill strip — clip-safe overflow-x scroll with desktop wheel-to-horizontal, click-drag, and ArrowLeft/Right, plus click-suppression after a real drag."
      >
        <div className={styles.col}>
          <PillRail ariaLabel="Pill rail demo">
            {PILL_RAIL_ITEMS.map((item) => {
              const active = item === pillRailValue
              return (
                <button
                  key={item}
                  type="button"
                  className={styles.pillButton}
                  aria-pressed={active}
                  onClick={() => setPillRailValue(item)}
                >
                  <Chip tone={active ? 'accent' : 'neutral'}>{item}</Chip>
                </button>
              )
            })}
          </PillRail>
          <p className={styles.note}>Selected: {pillRailValue} — drag the strip or scroll a mouse wheel over it.</p>
        </div>
      </Section>

      <Section
        title="SaveButton"
        subheading="The shared header save-state machine. dirty → filled Save; in-flight → Saving (disabled); clean after a SUCCESSFUL persist → Saved + check. A failed persist never shows Saved — flip the toggle to simulate one."
      >
        <div className={styles.col}>
          <div className={styles.row}>
            <span className={styles.tag}>save</span>
            <SaveButton
              dirty={saveDemoDirty}
              onSave={async () => {
                await new Promise((resolve) => setTimeout(resolve, 400))
                if (saveDemoShouldFail) return false
                setSaveDemoDirty(false)
                return true
              }}
            />
          </div>
          <div className={styles.row}>
            <span className={styles.tag}>make dirty</span>
            <Button size="sm" variant="tonal" onClick={() => setSaveDemoDirty(true)}>Edit again</Button>
          </div>
          <div className={styles.row}>
            <span className={styles.tag}>next save {saveDemoShouldFail ? 'fails' : 'succeeds'}</span>
            <Toggle
              checked={saveDemoShouldFail}
              onChange={setSaveDemoShouldFail}
              aria-label="Simulate a failed save"
            />
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Search"
        title="SearchField"
        subheading="A leading MagnifyingGlass, a 16px input (opts out of the 15px type scale to dodge iOS focus-zoom), and an inline clear X that shows only while there's text. autoFocus is off here so the gallery doesn't grab focus."
      >
        <SearchField value={searchFieldValue} onChange={setSearchFieldValue} autoFocus={false} />
      </Section>

      <Section
        eyebrow="Insights"
        title="NumberStepper"
        subheading="A compact −/value/+ stepper for a bounded integer, clamped 3–24. Purely controlled: it only ever emits the next CLAMPED value, and each button disables at its bound."
      >
        <div className={styles.col}>
          <NumberStepper value={stepperValue} onChange={setStepperValue} min={3} max={24} label="Periods" />
          <p className={styles.note}>value: {stepperValue} (clamped to 3–24)</p>
        </div>
      </Section>
    </div>
  )
}
