import { create } from 'zustand'

// Nav sidebar defaults (from NavSidebar.tsx)
const NAV_DEFAULT_WIDTH = 48 // MIN_WIDTH — starts collapsed

// Right sidebar defaults (from RightSidebar.tsx)
const RIGHT_DEFAULT_WIDTH = 288 // w-72

interface LayoutState {
  // Left nav sidebar
  navWidth: number
  navCollapsed: boolean
  setNavWidth: (w: number) => void
  setNavCollapsed: (v: boolean) => void

  // Right sidebar (global, shared across pages)
  rightWidth: number
  rightCollapsed: boolean
  setRightWidth: (w: number) => void
  setRightCollapsed: (v: boolean) => void
}

export const useLayoutStore = create<LayoutState>((set) => ({
  navWidth: NAV_DEFAULT_WIDTH,
  navCollapsed: true,
  setNavWidth: (w) => set({ navWidth: w }),
  setNavCollapsed: (v) => set({ navCollapsed: v }),

  rightWidth: RIGHT_DEFAULT_WIDTH,
  rightCollapsed: false,
  setRightWidth: (w) => set({ rightWidth: w }),
  setRightCollapsed: (v) => set({ rightCollapsed: v }),
}))
