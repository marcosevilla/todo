import { useEffect } from 'react'
import { useDocsStore } from '@/stores/docsStore'
import { FolderTree } from '@/components/docs/FolderTree'
import { DocEditor } from '@/components/docs/DocEditor'
import { PanelLeftOpen } from 'lucide-react'

export function DocsPage() {
  const folderTreeCollapsed = useDocsStore((s) => s.folderTreeCollapsed)
  const setFolderTreeCollapsed = useDocsStore((s) => s.setFolderTreeCollapsed)
  const selectedDocId = useDocsStore((s) => s.selectedDocId)
  const refresh = useDocsStore((s) => s.refresh)

  // Load data on mount
  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Folder tree */}
      {folderTreeCollapsed ? (
        <div className="flex flex-col items-center border-r border-border/20 bg-muted/10 py-2 px-1">
          <button
            onClick={() => setFolderTreeCollapsed(false)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/20 transition-colors"
            title="Expand folder tree"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        </div>
      ) : (
        <FolderTree />
      )}

      {/* Editor */}
      <DocEditor />
    </div>
  )
}
