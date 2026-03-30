import { create } from 'zustand'
import { getSetting, setSetting } from '@/services/tauri'

// Nav sidebar defaults (from NavSidebar.tsx)
const NAV_DEFAULT_WIDTH = 48 // MIN_WIDTH — starts collapsed

// Right sidebar defaults (from RightSidebar.tsx)
const RIGHT_DEFAULT_WIDTH = 288 // w-72

// Default nav order — page IDs in display order
export const DEFAULT_NAV_ORDER = ['today', 'tasks', 'inbox', 'docs', 'goals', 'session'] as const
export type NavPageId = (typeof DEFAULT_NAV_ORDER)[number]

interface LayoutState {
  // Left nav sidebar
  navWidth: number
  navCollapsed: boolean
  setNavWidth: (w: number) => void
  setNavCollapsed: (v: boolean) => void

  // Nav icon ordering
  navOrder: string[]
  setNavOrder: (order: string[]) => void
  loadNavOrder: () => Promise<void>
  saveNavOrder: (order: string[]) => Promise<void>

  // Right sidebar (global, shared across pages)
  rightWidth: number
  rightCollapsed: boolean
  setRightWidth: (w: number) => void
  setRightCollapsed: (v: boolean) => void

  // Tasks project sidebar
  tasksProjectSidebarWidth: number
  tasksProjectSidebarCollapsed: boolean
  setTasksProjectSidebarWidth: (w: number) => void
  setTasksProjectSidebarCollapsed: (v: boolean) => void
}

export const useLayoutStore = create<LayoutState>((set) => ({
  navWidth: NAV_DEFAULT_WIDTH,
  navCollapsed: true,
  setNavWidth: (w) => set({ navWidth: w }),
  setNavCollapsed: (v) => set({ navCollapsed: v }),

  navOrder: [...DEFAULT_NAV_ORDER],
  setNavOrder: (order) => set({ navOrder: order }),
  loadNavOrder: async () => {
    try {
      const saved = await getSetting('nav_order')
      if (saved) {
        const parsed = JSON.parse(saved) as string[]
        // Validate: must contain all default IDs (handle new pages added later)
        const validIds = new Set<string>(DEFAULT_NAV_ORDER)
        const filtered = parsed.filter((id) => validIds.has(id))
        // Add any missing pages at the end
        for (const id of DEFAULT_NAV_ORDER) {
          if (!filtered.includes(id)) filtered.push(id)
        }
        set({ navOrder: filtered })
      }
    } catch {
      // Use default order on any error
    }
  },
  saveNavOrder: async (order) => {
    set({ navOrder: order })
    try {
      await setSetting('nav_order', JSON.stringify(order))
    } catch {
      // Silent fail — order is still in memory
    }
  },

  rightWidth: RIGHT_DEFAULT_WIDTH,
  rightCollapsed: false,
  setRightWidth: (w) => set({ rightWidth: w }),
  setRightCollapsed: (v) => set({ rightCollapsed: v }),

  tasksProjectSidebarWidth: 200,
  tasksProjectSidebarCollapsed: false,
  setTasksProjectSidebarWidth: (w) => set({ tasksProjectSidebarWidth: w }),
  setTasksProjectSidebarCollapsed: (v) => set({ tasksProjectSidebarCollapsed: v }),
}))
