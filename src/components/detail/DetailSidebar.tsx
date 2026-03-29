import { useDetailStore } from '@/stores/detailStore'
import { TaskDetailPage } from './TaskDetailPage'
import { CaptureDetailPage } from './CaptureDetailPage'
import { Maximize2, X } from 'lucide-react'

export function DetailSidebar() {
  const switchMode = useDetailStore((s) => s.switchMode)
  const close = useDetailStore((s) => s.close)
  const target = useDetailStore((s) => s.target)

  if (!target) return null

  return (
    <aside className="flex w-80 flex-col border-l border-border/50 bg-muted/20 overflow-hidden">
      {/* Sidebar header */}
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {target.type === 'task' ? 'Task' : 'Capture'}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => switchMode('body')}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/20 transition-colors"
            title="Expand to full view"
          >
            <Maximize2 className="size-3.5" />
          </button>
          <button
            onClick={close}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/20 transition-colors"
            title="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4">
        {target.type === 'task' ? <TaskDetailPage /> : <CaptureDetailPage />}
      </div>
    </aside>
  )
}
