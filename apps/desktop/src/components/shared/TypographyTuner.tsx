import { useEffect, useMemo, useRef } from 'react'
import { useDialKit } from 'dialkit'
import { toast } from 'sonner'
import { TYPO_TOKENS, type TypoFamily, type TypoToken } from '@/lib/typography-tokens'

/* Live typography tuning panel. Renders a DialKit floating panel with one
 * folder per design-system type style. Inside each folder:
 *
 *   ● highlight       — outline every instance of this style on screen
 *   ● size            — font-size (px)
 *   ● weight          — font-weight (100–900)
 *   ● line height     — unitless multiplier
 *   ● tracking        — letter-spacing (em)
 *   ● case            — text-transform (none/uppercase/lowercase/capitalize)
 *   ● family          — font-family (sans/heading/mono)
 *
 * Every change is written to a `--typo-<name>-*` CSS variable on :root; the
 * text-<name> utilities in index.css consume those vars, so the entire app
 * re-renders live.  Only one style can be highlighted at a time — the tuner
 * sets `data-highlight-type` on <html> which trips the outline rules.
 *
 * Mount this component to show the panel; unmount to hide. Scope it to
 * DEV builds (or behind a keyboard shortcut) so it never ships to users. */

const FAMILY_MAP: Record<TypoFamily, string> = {
  sans: 'var(--font-sans)',
  heading: 'var(--font-heading)',
  mono: 'var(--font-mono)',
}

const FAMILY_OPTIONS = ['sans', 'heading', 'mono']
const CASE_OPTIONS = ['none', 'uppercase', 'lowercase', 'capitalize']

type TunedToken = {
  highlight: boolean
  size: number
  weight: number
  lineHeight: number
  tracking: number
  case: string
  family: string
}

type TunerParams = Record<string, TunedToken> & { Actions: Record<string, unknown> }

export function TypographyTuner() {
  /* DialKit config — one folder per token plus an Actions folder.
   * Folder keys use the token's human label ("Label", "Meta", ...) so the
   * panel UI reads like a type spec sheet. */
  const config = useMemo(() => {
    const byFolder: Record<string, unknown> = {}
    for (const t of TYPO_TOKENS) {
      byFolder[t.label] = {
        highlight: false,
        size: [t.size, 8, 48, 0.5] as [number, number, number, number],
        weight: [t.weight, 100, 900, 50] as [number, number, number, number],
        lineHeight: [t.lineHeight, 0.8, 2, 0.01] as [number, number, number, number],
        tracking: [t.tracking, -0.1, 0.2, 0.005] as [number, number, number, number],
        case: { type: 'select' as const, options: CASE_OPTIONS, default: t.case },
        family: { type: 'select' as const, options: FAMILY_OPTIONS, default: t.family },
      }
    }
    byFolder.Actions = {
      copyTheme: { type: 'action' as const, label: 'Copy @theme block' },
      copyCss: { type: 'action' as const, label: 'Copy CSS overrides' },
      reset: { type: 'action' as const, label: 'Reset all (reload)' },
    }
    return byFolder
  }, [])

  /* Keep a ref of latest params so onAction handlers read fresh values
   * without needing useDialKit to re-run on every tick. */
  const paramsRef = useRef<TunerParams | null>(null)

  const params = useDialKit('Typography Tuner', config as never, {
    onAction: (action) => {
      const current = paramsRef.current
      if (!current) return

      if (action === 'Actions.copyTheme') {
        const block = buildThemeBlock(current)
        void navigator.clipboard.writeText(block).then(() => {
          toast.success('@theme block copied to clipboard')
        })
      }
      if (action === 'Actions.copyCss') {
        const block = buildCssOverrides(current)
        void navigator.clipboard.writeText(block).then(() => {
          toast.success('CSS overrides copied — paste into index.css :root')
        })
      }
      if (action === 'Actions.reset') {
        /* DialKit has no imperative "reset to defaults" API — a full reload
         * is the simplest reliable path back to the baked-in defaults. */
        location.reload()
      }
    },
  }) as unknown as TunerParams

  paramsRef.current = params

  /* Sync every param to :root CSS vars + track which style is highlighted.
   * Picks the first highlighted token so the on-screen outline is never
   * ambiguous — toggling a second highlight replaces the first. */
  useEffect(() => {
    const root = document.documentElement
    let highlighted: string | null = null

    for (const t of TYPO_TOKENS) {
      const p = params[t.label] as TunedToken | undefined
      if (!p) continue

      root.style.setProperty(`--text-${t.name}`, `${(p.size / 16).toFixed(4)}rem`)
      root.style.setProperty(`--text-${t.name}--line-height`, String(p.lineHeight))
      root.style.setProperty(`--typo-${t.name}-weight`, String(p.weight))
      root.style.setProperty(`--typo-${t.name}-tracking`, `${p.tracking}em`)
      root.style.setProperty(`--typo-${t.name}-case`, p.case)
      root.style.setProperty(
        `--typo-${t.name}-family`,
        FAMILY_MAP[p.family as TypoFamily] ?? FAMILY_MAP.sans,
      )

      if (p.highlight && !highlighted) highlighted = t.name
    }

    if (highlighted) root.setAttribute('data-highlight-type', highlighted)
    else root.removeAttribute('data-highlight-type')
  }, [params])

  /* Clean up on unmount: drop the highlight attribute so nothing stays
   * outlined after the panel is dismissed. CSS vars remain so the user's
   * tuning session persists until they hit Reset or reload. */
  useEffect(() => {
    return () => {
      document.documentElement.removeAttribute('data-highlight-type')
    }
  }, [])

  return null
}

/* ──────── clipboard builders ──────── */

function buildThemeBlock(params: TunerParams): string {
  const lines: string[] = ['@theme {']
  for (const t of TYPO_TOKENS) {
    const p = params[t.label]
    if (!p) continue
    const rem = (p.size / 16).toFixed(4)
    lines.push(`    --text-${t.name}: ${rem}rem;`)
    lines.push(`    --text-${t.name}--line-height: ${p.lineHeight};`)
  }
  lines.push('}')
  return lines.join('\n')
}

function buildCssOverrides(params: TunerParams): string {
  const lines: string[] = ['/* Typography overrides — generated by TypographyTuner */']
  lines.push(':root {')
  for (const t of TYPO_TOKENS) {
    const p = params[t.label]
    if (!p) continue
    const defaults = getDefaults(t)
    if (p.weight !== defaults.weight) {
      lines.push(`    --typo-${t.name}-weight: ${p.weight};`)
    }
    if (p.tracking !== defaults.tracking) {
      lines.push(`    --typo-${t.name}-tracking: ${p.tracking}em;`)
    }
    if (p.case !== defaults.case) {
      lines.push(`    --typo-${t.name}-case: ${p.case};`)
    }
    if (p.family !== defaults.family) {
      lines.push(`    --typo-${t.name}-family: var(--font-${p.family});`)
    }
  }
  lines.push('}')
  return lines.join('\n')
}

function getDefaults(t: TypoToken) {
  return {
    weight: t.weight,
    tracking: t.tracking,
    case: t.case,
    family: t.family,
  }
}
