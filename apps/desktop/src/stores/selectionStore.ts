import { create } from 'zustand'

export type SelectionType = 'task' | 'capture'

interface SelectionStore {
  selectedIds: Set<string>
  selectionType: SelectionType | null
  lastSelectedId: string | null // for shift-click range

  select: (id: string, type: SelectionType) => void
  deselect: (id: string) => void
  toggle: (id: string, type: SelectionType) => void
  rangeSelect: (id: string, type: SelectionType, allIds: string[]) => void
  selectAll: (ids: string[], type: SelectionType) => void
  clear: () => void
  isSelected: (id: string) => boolean
  hasSelection: boolean
  count: number
}

export const useSelectionStore = create<SelectionStore>((set, get) => ({
  selectedIds: new Set(),
  selectionType: null,
  lastSelectedId: null,
  hasSelection: false,
  count: 0,

  select: (id, type) => {
    const { selectedIds, selectionType } = get()
    // If switching type, clear first
    if (selectionType && selectionType !== type) {
      set({ selectedIds: new Set([id]), selectionType: type, lastSelectedId: id, hasSelection: true, count: 1 })
      return
    }
    const next = new Set(selectedIds)
    next.add(id)
    set({ selectedIds: next, selectionType: type, lastSelectedId: id, hasSelection: true, count: next.size })
  },

  deselect: (id) => {
    const { selectedIds } = get()
    const next = new Set(selectedIds)
    next.delete(id)
    set({
      selectedIds: next,
      lastSelectedId: null,
      hasSelection: next.size > 0,
      count: next.size,
      selectionType: next.size === 0 ? null : get().selectionType,
    })
  },

  toggle: (id, type) => {
    const { selectedIds } = get()
    if (selectedIds.has(id)) get().deselect(id)
    else get().select(id, type)
  },

  rangeSelect: (id, type, allIds) => {
    const { lastSelectedId, selectedIds, selectionType } = get()
    if (selectionType && selectionType !== type) {
      set({ selectedIds: new Set([id]), selectionType: type, lastSelectedId: id, hasSelection: true, count: 1 })
      return
    }
    if (!lastSelectedId) {
      get().select(id, type)
      return
    }
    const startIdx = allIds.indexOf(lastSelectedId)
    const endIdx = allIds.indexOf(id)
    if (startIdx === -1 || endIdx === -1) {
      get().select(id, type)
      return
    }
    const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
    const next = new Set(selectedIds)
    for (let i = from; i <= to; i++) next.add(allIds[i])
    set({ selectedIds: next, selectionType: type, lastSelectedId: id, hasSelection: true, count: next.size })
  },

  selectAll: (ids, type) => {
    set({ selectedIds: new Set(ids), selectionType: type, lastSelectedId: null, hasSelection: ids.length > 0, count: ids.length })
  },

  clear: () => {
    set({ selectedIds: new Set(), selectionType: null, lastSelectedId: null, hasSelection: false, count: 0 })
  },

  isSelected: (id) => get().selectedIds.has(id),
}))
