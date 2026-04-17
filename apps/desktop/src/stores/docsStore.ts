import { create } from 'zustand'
import { getDataProvider } from '@/services/provider-context'
import type { DocFolder, Document } from '@daily-triage/types'

interface DocsStore {
  folders: DocFolder[]
  documents: Document[]
  selectedFolderId: string | null
  selectedDocId: string | null
  currentDoc: Document | null
  folderTreeCollapsed: boolean
  folderTreeWidth: number

  loadFolders: () => Promise<void>
  loadDocuments: (folderId?: string) => Promise<void>
  selectFolder: (id: string | null) => void
  selectDoc: (id: string | null) => Promise<void>
  setFolderTreeCollapsed: (v: boolean) => void
  setFolderTreeWidth: (w: number) => void
  refresh: () => Promise<void>
}

export const useDocsStore = create<DocsStore>((set, get) => ({
  folders: [],
  documents: [],
  selectedFolderId: null,
  selectedDocId: null,
  currentDoc: null,
  folderTreeCollapsed: false,
  folderTreeWidth: 220,

  loadFolders: async () => {
    try {
      const dp = getDataProvider()
      const folders = await dp.docs.getFolders()
      set({ folders })
    } catch { /* silently fail */ }
  },

  loadDocuments: async (folderId) => {
    try {
      const dp = getDataProvider()
      const documents = await dp.docs.getDocuments(folderId)
      set({ documents })
    } catch { /* silently fail */ }
  },

  selectFolder: (id) => {
    set({ selectedFolderId: id })
    get().loadDocuments(id ?? undefined)
  },

  selectDoc: async (id) => {
    if (!id) {
      set({ selectedDocId: null, currentDoc: null })
      return
    }
    set({ selectedDocId: id })
    try {
      const dp = getDataProvider()
      const doc = await dp.docs.getDocument(id)
      set({ currentDoc: doc })
    } catch {
      set({ currentDoc: null })
    }
  },

  setFolderTreeCollapsed: (v) => set({ folderTreeCollapsed: v }),
  setFolderTreeWidth: (w) => set({ folderTreeWidth: w }),

  refresh: async () => {
    await get().loadFolders()
    await get().loadDocuments(get().selectedFolderId ?? undefined)
    const docId = get().selectedDocId
    if (docId) {
      try {
        const dp = getDataProvider()
        const doc = await dp.docs.getDocument(docId)
        set({ currentDoc: doc })
      } catch { /* skip */ }
    }
  },
}))
