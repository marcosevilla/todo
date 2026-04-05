/** Dot/indicator background colors by priority level */
export const PRIORITY_COLORS: Record<number, string> = {
  4: 'bg-red-500',
  3: 'bg-orange-500',
  2: 'bg-accent-blue',
  1: 'bg-transparent',
}

/** Human-readable labels + dot colors for priority levels */
export const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Normal', color: 'bg-transparent' },
  2: { label: 'Medium', color: 'bg-accent-blue' },
  3: { label: 'High', color: 'bg-orange-500' },
  4: { label: 'Urgent', color: 'bg-red-500' },
}
