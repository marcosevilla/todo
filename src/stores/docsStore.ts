import { create } from 'zustand'
import { getDocFolders, getDocuments, getDocument } from '@/services/tauri'
import type { DocFolder, Document } from '@/services/tauri'

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
      const folders = await getDocFolders()
      set({ folders })
    } catch { /* silently fail */ }
  },

  loadDocuments: async (folderId) => {
    try {
      const documents = await getDocuments(folderId)
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
      const doc = await getDocument(id)
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
        const doc = await getDocument(docId)
        set({ currentDoc: doc })
      } catch { /* skip */ }
    }
  },
}))
