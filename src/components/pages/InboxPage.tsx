import { useEffect, useCallback, useMemo, useState, useRef } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useLocalTasks, useProjects } from '@/hooks/useLocalTasks'
import { emitTasksChanged } from '@/hooks/useLocalTasks'
import { useDetailStore } from '@/stores/detailStore'
import { useSelectionStore } from '@/stores/selectionStore'
import {
  updateLocalTask,
  getCaptures,
  createCapture,
  convertCaptureToTask,
  importObsidianCaptures,
  getDocFolders,
  getDocuments,
  createDocNote,
  deleteCapture,
  getCaptureRoutes,
  routeCapture,
} from '@/services/tauri'
import type { CaptureRoute } from '@/services/tauri'
import { parseRoutePrefix } from '@/lib/captureRoutes'
import { cn } from '@/lib/utils'
import { StatusDropdown } from '@/components/tasks/StatusDropdown'
import { FocusPlayMenu } from '@/components/focus/FocusPlayMenu'
import { useFocusStore } from '@/stores/focusStore'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { taskToast } from '@/lib/taskToast'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Check, PenLine, ArrowRight, FileText, FolderInput, Trash2, Download, Search, Lightbulb, Quote, CheckSquare } from 'lucide-react'
import type { LocalTask, Capture, Project, DocFolder, Document } from '@/services/tauri'

// ── Route icon map ──

const ROUTE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Lightbulb,
  Quote,
  CheckSquare,
  FileText,
}

function RouteIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ROUTE_ICONS[name] ?? FileText
  return <Icon className={className} />
}

// ── Unified inbox item type ──

type InboxItem =
  | { kind: 'task'; data: LocalTask; sortDate: string }
  | { kind: 'note'; data: Capture; sortDate: string }

// ── Main page ──

export function InboxPage() {
  const captureRequested = useAppStore((s) => s.captureRequested)
  const setCaptureRequested = useAppStore((s) => s.setCaptureRequested)

  const { tasks, loading: tasksLoading, remove } = useLocalTasks({ projectId: 'inbox' })
  const { projects } = useProjects()
  const [moveToDocCapture, setMoveToDocCapture] = useState<Capture | null>(null)

  const [captures, setCaptures] = useState<Capture[]>([])
  const [capturesLoading, setCapturesLoading] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [importing, setImporting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [routes, setRoutes] = useState<CaptureRoute[]>([])

  // Fetch capture routes
  useEffect(() => {
    getCaptureRoutes().then(setRoutes).catch(() => {})
  }, [])

  // Real-time route detection
  const parsedRoute = useMemo(
    () => parseRoutePrefix(inputValue, routes),
    [inputValue, routes],
  )

  const loading = tasksLoading || capturesLoading

  // Fetch captures
  const refreshCaptures = useCallback(async () => {
    try {
      const data = await getCaptures(50)
      setCaptures(data)
    } catch { /* silently fail */ }
    finally { setCapturesLoading(false) }
  }, [])

  useEffect(() => { refreshCaptures() }, [refreshCaptures])

  // Listen for task changes to also refresh captures
  useEffect(() => {
    const handler = () => refreshCaptures()
    window.addEventListener('tasks-changed', handler)
    return () => window.removeEventListener('tasks-changed', handler)
  }, [refreshCaptures])

  // Auto-focus
  useEffect(() => {
    if (captureRequested) {
      requestAnimationFrame(() => inputRef.current?.focus())
      const timer = setTimeout(() => setCaptureRequested(false), 100)
      return () => clearTimeout(timer)
    }
  }, [captureRequested, setCaptureRequested])

  // Merge + sort chronologically
  const items = useMemo<InboxItem[]>(() => {
    const taskItems: InboxItem[] = tasks
      .filter((t) => t.status !== 'complete' && !t.parent_id)
      .map((t) => ({ kind: 'task', data: t, sortDate: t.created_at }))
    const noteItems: InboxItem[] = captures
      .filter((c) => !c.converted_to_task_id)
      .map((c) => ({ kind: 'note', data: c, sortDate: c.created_at }))
    return [...taskItems, ...noteItems].sort((a, b) => b.sortDate.localeCompare(a.sortDate))
  }, [tasks, captures])

  // Handlers
  const handleSubmit = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || submitting) return
    setSubmitting(true)
    try {
      const { route, content } = parseRoutePrefix(text, routes)
      if (route && content) {
        // Route to target (doc or task)
        const result = await routeCapture(route.prefix, content)
        if (result.target_type === 'task') {
          emitTasksChanged()
        }
        setInputValue('')
        toast.success(`Saved to ${result.label}`)
        refreshCaptures()
      } else {
        // Default: create a plain capture
        const capture = await createCapture(text, 'inbox')
        setCaptures((prev) => [capture, ...prev])
        setInputValue('')
        toast.success('Note saved')
      }
    } catch (e) {
      toast.error(`Failed: ${e}`)
    } finally {
      setSubmitting(false)
      inputRef.current?.focus()
    }
  }, [inputValue, submitting, routes, refreshCaptures])

  const handleConvert = useCallback(async (capture: Capture) => {
    try {
      const task = await convertCaptureToTask(capture.id)
      taskToast(`Converted to task: "${capture.content}"`, task.id)
      emitTasksChanged()
      refreshCaptures()
    } catch (e) {
      toast.error(`Failed to convert: ${e}`)
    }
  }, [refreshCaptures])

  const handleMove = useCallback(async (id: string, projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    try {
      await updateLocalTask({ id, projectId })
      taskToast(`Moved to ${project?.name ?? 'project'}`, id)
      emitTasksChanged()
    } catch (e) {
      toast.error(`Failed to move: ${e}`)
    }
  }, [projects])

  const handleImport = useCallback(async () => {
    setImporting(true)
    try {
      const count = await importObsidianCaptures()
      if (count > 0) {
        toast.success(`Imported ${count} notes from Obsidian`)
        refreshCaptures()
      } else {
        toast.success('No new notes to import')
      }
    } catch (e) {
      toast.error(`Import failed: ${e}`)
    } finally {
      setImporting(false)
    }
  }, [refreshCaptures])

  return (
    <div className="space-y-4">
      {/* Note input — command bar style */}
      <div className="flex h-10 items-center gap-2 rounded-xl border border-border/30 bg-muted/30 px-3">
        <Search className="size-3.5 shrink-0 text-muted-foreground/30" />
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
          placeholder="Write a note... (/i idea, /q quote, /t task)"
          disabled={submitting}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
        />
        {parsedRoute.route && parsedRoute.content && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
            style={{ backgroundColor: parsedRoute.route.color }}
          >
            <RouteIcon name={parsedRoute.route.icon} className="size-3" />
            {parsedRoute.route.label}
          </span>
        )}
        {inputValue.trim() && (
          <button
            onClick={handleSubmit}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {submitting ? '...' : 'Save'}
          </button>
        )}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-md" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="space-y-3 py-4">
          <p className="text-sm text-muted-foreground text-center">
            Inbox is empty — nothing to process.
          </p>
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={handleImport} disabled={importing} className="gap-1.5 text-xs">
              <Download className="size-3" />
              {importing ? 'Importing...' : 'Import from Obsidian'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-0.5">
          {items.map((item) =>
            item.kind === 'task' ? (
              <InboxTaskRow
                key={`task-${item.data.id}`}
                task={item.data as LocalTask}
                projects={projects}
                onDelete={remove}
                onMove={handleMove}
              />
            ) : (
              <InboxNoteRow
                key={`note-${item.data.id}`}
                capture={item.data as Capture}
                onConvert={() => handleConvert(item.data as Capture)}
                onMoveToDoc={(c) => setMoveToDocCapture(c)}
              />
            ),
          )}

          {/* Import button at bottom */}
          <div className="pt-3">
            <Button variant="ghost" size="sm" onClick={handleImport} disabled={importing} className="gap-1.5 text-xs">
              <Download className="size-3" />
              {importing ? 'Importing...' : 'Import from Obsidian'}
            </Button>
          </div>
        </div>
      )}

      {/* Move to doc picker */}
      {moveToDocCapture && (
        <MoveToDocPicker
          capture={moveToDocCapture}
          onClose={() => setMoveToDocCapture(null)}
          onDone={refreshCaptures}
        />
      )}
    </div>
  )
}

// ── Task row ──

function InboxTaskRow({
  task,
  projects,
  onDelete,
  onMove,
}: {
  task: LocalTask
  projects: Project[]
  onDelete: (id: string) => void
  onMove: (id: string, projectId: string) => void
}) {
  const isSelected = useSelectionStore((s) => s.selectedIds.has(task.id))
  const hasSelection = useSelectionStore((s) => s.hasSelection)
  const focusActive = useFocusStore((s) => s.isActive)

  return (
    <div className={cn(
      'group flex items-center gap-2 h-9 px-2 rounded-md transition-all duration-150 hover:bg-accent/30',
      isSelected && 'bg-accent-blue/10',
    )}>
      {/* Selection checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          const store = useSelectionStore.getState()
          if (e.shiftKey) store.rangeSelect(task.id, 'task', [])
          else store.toggle(task.id, 'task')
        }}
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded border transition-all',
          isSelected ? 'border-accent-blue bg-accent-blue text-white' : 'border-muted-foreground/30 hover:border-muted-foreground/50',
          hasSelection || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        {isSelected && <Check className="size-3" />}
      </button>

      {/* Status */}
      <StatusDropdown taskId={task.id} status={task.status ?? 'todo'} />

      {/* Content */}
      <button
        onClick={() => useDetailStore.getState().openTask(task.id)}
        className="flex-1 min-w-0 truncate text-sm text-left bg-transparent border-none cursor-pointer hover:text-foreground"
      >
        {task.content}
      </button>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {!task.completed && !focusActive && (
          <FocusPlayMenu task={task} />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/20 transition-colors"
            aria-label="Move to project"
          >
            <FolderInput className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" sideOffset={4} align="end" className="w-36">
            {projects
              .filter((p) => p.id !== task.project_id)
              .map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  className="gap-2"
                  onClick={() => onMove(task.id, p.id)}
                >
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="truncate">{p.name}</span>
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          onClick={() => onDelete(task.id)}
          className="flex size-6 items-center justify-center rounded-md text-destructive/40 hover:text-destructive hover:bg-accent/20 transition-colors"
          aria-label="Delete task"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  )
}

// ── Note row ──

function InboxNoteRow({
  capture,
  onConvert,
  onMoveToDoc,
}: {
  capture: Capture
  onConvert: () => void
  onMoveToDoc: (capture: Capture) => void
}) {
  const isSelected = useSelectionStore((s) => s.selectedIds.has(capture.id))
  const hasSelection = useSelectionStore((s) => s.hasSelection)

  return (
    <div className={cn(
      'group flex items-center gap-2 h-9 px-2 rounded-md transition-all duration-150 hover:bg-accent/30',
      isSelected && 'bg-accent-blue/10',
    )}>
      {/* Selection checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          const store = useSelectionStore.getState()
          if (e.shiftKey) store.rangeSelect(capture.id, 'capture', [])
          else store.toggle(capture.id, 'capture')
        }}
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded border transition-all',
          isSelected ? 'border-accent-blue bg-accent-blue text-white' : 'border-muted-foreground/30 hover:border-muted-foreground/50',
          hasSelection || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        {isSelected && <Check className="size-3" />}
      </button>

      {/* Note icon */}
      <PenLine className="size-4 shrink-0 text-amber-500/60" />

      {/* Content */}
      <button
        onClick={() => useDetailStore.getState().openCapture(capture.id)}
        className="flex-1 min-w-0 truncate text-sm text-left bg-transparent border-none cursor-pointer hover:text-foreground"
      >
        {capture.content}
      </button>

      {/* Routed badge */}
      {capture.routed_to && (
        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
          {capture.routed_to}
        </span>
      )}

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => onMoveToDoc(capture)}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/20"
        >
          <FileText className="size-3" />
          Move to doc
        </button>
        <button
          onClick={onConvert}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/20"
        >
          <ArrowRight className="size-3" />
          Convert to task
        </button>
      </div>
    </div>
  )
}

// ── Move to Doc Picker ──

function MoveToDocPicker({
  capture,
  onClose,
  onDone,
}: {
  capture: Capture
  onClose: () => void
  onDone: () => void
}) {
  const [folders, setFolders] = useState<DocFolder[]>([])
  const [docs, setDocs] = useState<Document[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDocFolders().then(setFolders).catch(() => {})
    getDocuments().then((d) => { setDocs(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const filteredDocs = selectedFolderId
    ? docs.filter((d) => d.folder_id === selectedFolderId)
    : docs

  const handleSelect = async (docId: string) => {
    try {
      await createDocNote(docId, capture.content)
      await deleteCapture(capture.id)
      const doc = docs.find((d) => d.id === docId)
      toast.success(`Moved to "${doc?.title || 'doc'}"`)
      onDone()
      onClose()
    } catch (e) {
      toast.error(`Failed to move: ${e}`)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="w-72 rounded-xl border border-border/30 bg-popover p-3 shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Move to doc</span>
          <button onClick={onClose} className="text-muted-foreground/40 hover:text-muted-foreground text-xs">Esc</button>
        </div>

        {/* Folder filter */}
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          <button
            onClick={() => setSelectedFolderId(null)}
            className={cn('rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors', !selectedFolderId ? 'bg-foreground text-background' : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/20')}
          >
            All
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFolderId(f.id)}
              className={cn('rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors', selectedFolderId === f.id ? 'bg-foreground text-background' : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/20')}
            >
              {f.name}
            </button>
          ))}
        </div>

        {/* Doc list */}
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {loading ? (
            <p className="text-xs text-muted-foreground/40 py-2 text-center">Loading...</p>
          ) : filteredDocs.length === 0 ? (
            <p className="text-xs text-muted-foreground/40 py-2 text-center">No docs yet</p>
          ) : (
            filteredDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => handleSelect(doc.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/20 transition-colors"
              >
                <FileText className="size-3 shrink-0 text-muted-foreground/40" />
                <span className="truncate">{doc.title || 'Untitled'}</span>
              </button>
            ))
          )}
        </div>

        {/* Note preview */}
        <div className="mt-2 pt-2 border-t border-border/20">
          <p className="text-[10px] text-muted-foreground/40 truncate">"{capture.content}"</p>
        </div>
      </div>
    </div>
  )
}
