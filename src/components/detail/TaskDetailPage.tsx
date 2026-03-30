import { useState, useCallback, useEffect, useRef } from 'react'
import { useDetailStore } from '@/stores/detailStore'
import { useTaskDetail } from '@/hooks/useTaskDetail'
import { useProjects } from '@/hooks/useLocalTasks'
import { updateLocalTask, createLocalTask, breakDownTask, logActivity, searchDocuments, getDocument, getDocuments } from '@/services/tauri'
import type { LocalTask as LocalTaskType, Document } from '@/services/tauri'
import { useDocsStore } from '@/stores/docsStore'
import { useAppStore } from '@/stores/appStore'
import { emitTasksChanged } from '@/hooks/useLocalTasks'
import { cn } from '@/lib/utils'
import { StatusDropdown } from '@/components/tasks/StatusDropdown'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkles, FileText, X as XIcon } from 'lucide-react'
import { InlineTitle } from './InlineTitle'
import { TiptapEditor } from '@/components/docs/TiptapEditor'
import { DetailBreadcrumbs } from './DetailBreadcrumbs'
import { TaskActionBar } from './TaskActionBar'
import { TaskActivityLog } from './TaskActivityLog'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { PanelRight, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Normal', color: 'bg-transparent' },
  2: { label: 'Medium', color: 'bg-accent-blue' },
  3: { label: 'High', color: 'bg-orange-500' },
  4: { label: 'Urgent', color: 'bg-red-500' },
}

export function TaskDetailPage() {
  const target = useDetailStore((s) => s.target)
  const switchMode = useDetailStore((s) => s.switchMode)
  const close = useDetailStore((s) => s.close)
  const drillDown = useDetailStore((s) => s.drillDown)

  const { task, subtasks, project, loading } = useTaskDetail(target?.id ?? null)
  const { projects } = useProjects()

  const [subInput, setSubInput] = useState('')
  const [subInputFocused, setSubInputFocused] = useState(false)
  const [breakingDown, setBreakingDown] = useState(false)
  const [linkedDocTitle, setLinkedDocTitle] = useState<string | null>(null)

  // Load linked doc title
  useEffect(() => {
    if (task?.linked_doc_id) {
      getDocument(task.linked_doc_id).then((doc) => setLinkedDocTitle(doc?.title ?? null)).catch(() => setLinkedDocTitle(null))
    } else {
      setLinkedDocTitle(null)
    }
  }, [task?.linked_doc_id])

  const handleSaveTitle = useCallback(async (content: string) => {
    if (!task) return
    await updateLocalTask({ id: task.id, content })
    emitTasksChanged()
  }, [task])

  const lastSavedDesc = useRef(task?.description ?? '')
  const handleSaveDescription = useCallback(async (description: string) => {
    if (!task) return
    // Skip if content hasn't actually changed (prevents save loops)
    if (description === lastSavedDesc.current) return
    lastSavedDesc.current = description
    await updateLocalTask({ id: task.id, description })
    // Don't emit tasksChanged here — avoids refresh loop with Tiptap
  }, [task])

  const handleAIBreakdown = useCallback(async () => {
    if (!task) return
    setBreakingDown(true)
    try {
      const subtaskTitles = await breakDownTask(task.content, task.description ?? undefined)
      let created = 0
      for (const content of subtaskTitles) {
        try {
          await createLocalTask({ content, parentId: task.id, projectId: task.project_id })
          created++
        } catch { /* skip */ }
      }
      logActivity('task_breakdown_applied', task.id, { subtask_count: created }).catch(() => {})
      toast.success(`Created ${created} subtasks`)
      emitTasksChanged()
      setSubInputFocused(false)
    } catch (e) {
      toast.error(`Breakdown failed: ${e}`)
    } finally {
      setBreakingDown(false)
    }
  }, [task])

  const handleAddSubtask = useCallback(async () => {
    if (!task || !subInput.trim()) return
    try {
      await createLocalTask({ content: subInput.trim(), parentId: task.id, projectId: task.project_id })
      emitTasksChanged()
      setSubInput('')
    } catch (e) {
      toast.error(`Failed to add subtask: ${e}`)
    }
  }, [task, subInput])

  const handlePriorityChange = useCallback(async (priority: number) => {
    if (!task) return
    await updateLocalTask({ id: task.id, priority })
    emitTasksChanged()
  }, [task])

  if (loading) {
    return (
      <div className="space-y-4">
        <DetailBreadcrumbs />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    )
  }

  if (!task) {
    return (
      <div className="space-y-4">
        <DetailBreadcrumbs />
        <p className="text-sm text-muted-foreground">Task not found.</p>
      </div>
    )
  }

  const completedSubs = subtasks.filter((s) => s.completed).length

  return (
    <div className="space-y-6">
      {/* Header: breadcrumbs + actions */}
      <div className="flex items-start justify-between">
        <DetailBreadcrumbs />
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => switchMode('sidebar')}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground/30 hover:text-muted-foreground hover:bg-accent/20 transition-colors"
            title="Pin to sidebar"
          >
            <PanelRight className="size-4" />
          </button>
          <Popover>
            <PopoverTrigger className="flex size-7 items-center justify-center rounded-md text-muted-foreground/30 hover:text-muted-foreground hover:bg-accent/20 transition-colors">
              <MoreHorizontal className="size-4" />
            </PopoverTrigger>
            <PopoverContent side="bottom" align="end" sideOffset={4} className="w-44 gap-0 p-1">
              <TaskActionBar task={task} projects={projects} onDeleted={close} variant="menu" />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Project + metadata row */}
      <div className="flex items-center gap-3 flex-wrap text-sm">
        {project && (
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: project.color }} />
            <span className="text-xs text-muted-foreground">{project.name}</span>
          </div>
        )}
        <Popover>
          <PopoverTrigger className="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors">
            {task.priority > 1 && <span className={cn('size-1.5 rounded-full', PRIORITY_LABELS[task.priority].color)} />}
            {PRIORITY_LABELS[task.priority].label}
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" sideOffset={4} className="w-32 gap-0 p-1">
            {[1, 2, 3, 4].map((p) => (
              <button
                key={p}
                onClick={() => handlePriorityChange(p)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                  task.priority === p ? 'bg-accent/40' : 'hover:bg-accent/20',
                )}
              >
                {p > 1 ? <span className={cn('size-2 rounded-full', PRIORITY_LABELS[p].color)} /> : <span className="w-2" />}
                {PRIORITY_LABELS[p].label}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        {task.due_date && (
          <span className="text-xs text-muted-foreground">
            Due {format(parseISO(task.due_date), 'MMM d')}
          </span>
        )}
      </div>

      {/* Status + Title */}
      <div className="flex items-start gap-3">
        <div className="mt-1">
          <StatusDropdown taskId={task.id} status={task.status ?? 'todo'} size="md" />
        </div>
        <div className="flex-1 min-w-0">
          <InlineTitle value={task.content} completed={task.completed} onSave={handleSaveTitle} />
        </div>
      </div>

      {/* Description */}
      {/* Description — rich text with @mentions */}
      <TiptapEditor
        content={task.description ?? ''}
        onChange={handleSaveDescription}
        placeholder="Add a description..."
      />

      {/* Subtasks */}
      <div className="space-y-2">
        {subtasks.length > 0 && (
          <div className="space-y-0.5">
            {subtasks.map((sub) => (
              <div
                key={sub.id}
                className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/10 transition-colors"
              >
                <StatusDropdown taskId={sub.id} status={sub.status ?? 'todo'} />
                <button
                  onClick={() => drillDown({ type: 'task', id: sub.id })}
                  className={cn(
                    'flex-1 min-w-0 truncate text-left text-sm hover:text-foreground transition-colors',
                    sub.completed && 'text-muted-foreground line-through',
                  )}
                >
                  {sub.content}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* AI breakdown loading state */}
        {breakingDown && (
          <div className="space-y-2 py-2 animate-in fade-in duration-300">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                <Sparkles className="size-3.5 text-purple-500 ai-star-1" />
                <Sparkles className="size-3 text-purple-400 ai-star-2" />
                <Sparkles className="size-2.5 text-purple-300 ai-star-3" />
              </div>
              <span className="text-xs text-muted-foreground">Breaking down with AI...</span>
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-7 w-full rounded-md" />
              <Skeleton className="h-7 w-5/6 rounded-md" />
              <Skeleton className="h-7 w-4/6 rounded-md" />
              <Skeleton className="h-7 w-5/6 rounded-md" />
            </div>
          </div>
        )}

        {/* Add subtask */}
        {!breakingDown && <div>
          {subInputFocused || subInput ? (
            <div className="space-y-1">
              <input
                value={subInput}
                onChange={(e) => setSubInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask() }
                  if (e.key === 'Escape') { setSubInput(''); setSubInputFocused(false) }
                  if (e.key === 'b' && e.metaKey) { e.preventDefault(); handleAIBreakdown() }
                }}
                onBlur={() => { if (!subInput) setSubInputFocused(false) }}
                placeholder="Add a subtask..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/40 py-1"
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground/30">
                or break down with AI <kbd className="rounded bg-muted/40 px-1 py-0.5 font-mono text-[9px]">{'\u2318'}B</kbd>
              </p>
            </div>
          ) : (
            <p
              onClick={() => setSubInputFocused(true)}
              className="text-sm text-muted-foreground/40 cursor-text hover:text-muted-foreground/60 transition-colors py-1"
            >
              Add a subtask...
            </p>
          )}
        </div>}
      </div>

      {/* Linked doc */}
      <LinkedDocSection task={task} linkedDocTitle={linkedDocTitle} />

      {/* Separator */}
      <div className="border-t border-border/30" />

      {/* Activity log */}
      <TaskActivityLog taskId={task.id} />
    </div>
  )
}

// ── Linked Doc Section ──

function LinkedDocSection({ task, linkedDocTitle }: { task: LocalTaskType; linkedDocTitle: string | null }) {
  const [showPicker, setShowPicker] = useState(false)
  const [docs, setDocs] = useState<Document[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const loadDocs = useCallback(async () => {
    try {
      const allDocs = await getDocuments()
      setDocs(allDocs)
    } catch { /* skip */ }
  }, [])

  useEffect(() => {
    if (showPicker) loadDocs()
  }, [showPicker, loadDocs])

  const filtered = searchQuery.trim()
    ? docs.filter((d) => d.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : docs

  const handleLink = useCallback(async (docId: string) => {
    try {
      await updateLocalTask({ id: task.id, content: task.content }) // need a proper linkedDocId update
      // For now, use a raw invoke since updateLocalTask doesn't have linkedDocId param yet
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('update_document', { id: docId }) // no-op, just to test
      // Actually we need to update the task's linked_doc_id directly
      await import('@tauri-apps/api/core').then(({ invoke }) =>
        invoke('update_local_task', { id: task.id, linkedDocId: docId })
      )
      emitTasksChanged()
      setShowPicker(false)
      setSearchQuery('')
    } catch (e) {
      // Fallback: use the existing updateLocalTask but we need to add linkedDocId support
      toast.error(`Failed to link doc: ${e}`)
    }
  }, [task.id, task.content])

  const handleUnlink = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('update_local_task', { id: task.id, linkedDocId: null })
      emitTasksChanged()
    } catch { /* skip */ }
  }, [task.id])

  if (task.linked_doc_id && linkedDocTitle) {
    return (
      <div className="flex items-center gap-2">
        <FileText className="size-3 shrink-0 text-muted-foreground/40" />
        <button
          onClick={() => {
            useDocsStore.getState().selectDoc(task.linked_doc_id!)
            useAppStore.getState().setCurrentPage('docs')
          }}
          className="text-xs text-accent-blue hover:underline"
        >
          {linkedDocTitle}
        </button>
        <button onClick={handleUnlink} className="text-muted-foreground/30 hover:text-muted-foreground">
          <XIcon className="size-3" />
        </button>
      </div>
    )
  }

  if (showPicker) {
    return (
      <div className="space-y-2">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setShowPicker(false); setSearchQuery('') } }}
          placeholder="Search docs..."
          className="w-full bg-transparent text-sm outline-none border-b border-border/20 py-1 placeholder:text-muted-foreground/40"
          autoFocus
        />
        <div className="max-h-32 overflow-y-auto space-y-0.5">
          {filtered.slice(0, 8).map((doc) => (
            <button
              key={doc.id}
              onClick={() => handleLink(doc.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent/20 transition-colors"
            >
              <FileText className="size-3 shrink-0 text-muted-foreground/40" />
              <span className="truncate">{doc.title || 'Untitled'}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground/40 py-1">No docs found</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <p
      onClick={() => setShowPicker(true)}
      className="text-xs text-muted-foreground/30 cursor-pointer hover:text-muted-foreground/50 transition-colors"
    >
      Link a doc...
    </p>
  )
}
