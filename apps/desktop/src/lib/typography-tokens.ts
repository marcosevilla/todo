/* Canonical typography tokens for the app. Single source of truth for
   what each named style "is" — size, weight, leading, tracking, case,
   family — so the TypographyTuner can render controls per style and
   restore defaults without hardcoding values in two places. These values
   mirror the defaults declared in index.css (the `--typo-*` CSS vars).
   Update both together if the design changes. */

export type TypoCase = 'none' | 'uppercase' | 'lowercase' | 'capitalize'
export type TypoFamily = 'sans' | 'heading' | 'mono'

export interface TypoToken {
  /** Kebab-case identifier matching the Tailwind class (text-<name>) and the
   *  CSS variable suffix (--typo-<name>-*). */
  name: string
  /** Human-readable title shown in the tuner panel. */
  label: string
  /** Where this style is used in the app — surfaced as helper text. */
  description: string
  family: TypoFamily
  /** Font size in px (converted to rem when written to the CSS var). */
  size: number
  /** Font weight, 100-900. */
  weight: number
  /** Line-height as a unitless multiplier. */
  lineHeight: number
  /** Letter-spacing in em. */
  tracking: number
  case: TypoCase
  /** Representative preview string — usually a real phrase from the app. */
  preview: string
}

export const TYPO_TOKENS: TypoToken[] = [
  {
    name: 'caption',
    label: 'Caption',
    description: 'Micro-badges, overflow counts, tiny pills',
    family: 'sans',
    size: 10,
    weight: 500,
    lineHeight: 1.2,
    tracking: 0,
    case: 'none',
    preview: '+12 overflow',
  },
  {
    name: 'label',
    label: 'Label',
    description: 'Section labels, chips, sidebar groups',
    family: 'sans',
    size: 11,
    weight: 500,
    lineHeight: 1.15,
    tracking: 0,
    case: 'none',
    preview: 'Tasks · 3',
  },
  {
    name: 'meta',
    label: 'Meta',
    description: 'Timestamps, due dates, secondary text, metadata',
    family: 'sans',
    size: 12,
    weight: 400,
    lineHeight: 1.35,
    tracking: 0,
    case: 'none',
    preview: 'Due Apr 18 · 2 min ago',
  },
  {
    name: 'body',
    label: 'Body',
    description: 'Primary body text, task titles, list rows, form values',
    family: 'sans',
    size: 14,
    weight: 400,
    lineHeight: 1.4286,
    tracking: -0.006,
    case: 'none',
    preview: 'Write the design critique draft',
  },
  {
    name: 'body-strong',
    label: 'Body Strong',
    description: 'Emphasis variant — form labels, panel titles, selected rows',
    family: 'sans',
    size: 14,
    weight: 500,
    lineHeight: 1.4286,
    tracking: -0.006,
    case: 'none',
    preview: "Today's priorities",
  },
  {
    name: 'heading-sm',
    label: 'Heading Small',
    description: 'Page titles, dialog titles, section titles, editor H3',
    family: 'heading',
    size: 15,
    weight: 550,
    lineHeight: 1.3,
    tracking: -0.015,
    case: 'none',
    preview: 'Inbox',
  },
  {
    name: 'heading',
    label: 'Heading',
    description: 'Greeting, section emphasis, editor H2',
    family: 'heading',
    size: 16,
    weight: 550,
    lineHeight: 1.25,
    tracking: -0.018,
    case: 'none',
    preview: 'Good morning',
  },
  {
    name: 'display',
    label: 'Display',
    description: 'Editor H1, moderate celebration moments',
    family: 'heading',
    size: 20,
    weight: 550,
    lineHeight: 1.15,
    tracking: -0.022,
    case: 'none',
    preview: 'Weekly goals',
  },
  {
    name: 'display-xl',
    label: 'Display XL',
    description: 'Focus-session celebration, once-in-a-session moments',
    family: 'heading',
    size: 26,
    weight: 550,
    lineHeight: 1.05,
    tracking: -0.028,
    case: 'none',
    preview: 'Nice work.',
  },
  {
    name: 'timer',
    label: 'Timer',
    description: 'FocusView timer — mono, tabular-nums',
    family: 'mono',
    size: 48,
    weight: 500,
    lineHeight: 1,
    tracking: -0.02,
    case: 'none',
    preview: '24:32',
  },
]
