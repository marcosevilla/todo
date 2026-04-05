/**
 * Theme constants matching the desktop app's warm dark theme.
 */

export const colors = {
  // Backgrounds
  bg: '#1a1a1a',
  bgCard: '#262626',
  bgHover: '#333333',
  bgSurface: '#2a2a2a',

  // Text
  text: '#ffffff',
  textSecondary: '#a3a3a3',
  textMuted: '#737373',

  // Accent (amber/warm)
  accent: '#f59e0b',
  accentLight: '#fbbf24',
  accentMuted: '#92400e',

  // Status
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',

  // Priority colors
  priority1: '#737373', // none
  priority2: '#3b82f6', // low
  priority3: '#f59e0b', // medium
  priority4: '#ef4444', // high

  // Borders
  border: '#333333',
  borderLight: '#404040',

  // Tab bar
  tabBar: '#1a1a1a',
  tabActive: '#f59e0b',
  tabInactive: '#737373',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  title: 28,
} as const;
