import { useState, useMemo, useCallback, type RefObject } from 'react'
import { cn } from '@/lib/utils'
import { Search } from 'lucide-react'
import { useLocalTasks, useProjects } from '@/hooks/useLocalTasks'
import { writeQuickCapture, logActivity, breakDownTask, createLocalTask, updateLocalTask } from '@/services/tauri'
import { emitTasksChanged } from '@/hooks/useLocalTasks'
import { CommandBarResults, type BarMode } from './CommandBarResults'
import { toast } from 'sonner'
import type { LocalTask } from '@/services/tauri'

const MAX_RESULTS = 8

const ACTION_VERBS = new Set([
  'buy', 'send', 'call', 'fix', 'do', 'make', 'write', 'schedule',
  'check', 'review', 'update', 'finish', 'create', 'build', 'clean',
  'read', 'watch', 'book', 'plan', 'prepare', 'set', 'get', 'move',
])

const CAPTURE_PREFIXES = ['note:', 'idea:', 'remember']

interface CommandBarProps {
  inputRef: RefObject<HTMLInputElement | null>
}

function parseMode(raw: string): { mode: BarMode; query: string } {
  const trimmed = raw.trimStart()
  if (trimmed.startsWith('/task ')) return { mode: 'task', query: trimmed.slice(6) }
  if (trimmed.startsWith('/capture ')) return { mode: 'capture', query: trimmed.slice(9) }
  if (trimmed.startsWith('/note ')) return { mode: 'capture', query: trimmed.slice(6) }
  if (trimmed.startsWith('/search ')) return { mode: 'search', query: trimmed.slice(8) }
  return { mode: 'search', query: trimmed }
}

function inferDefaultIndex(query: string, matchCount: number): number {
  const createIndex = matchCount
  const q = query.toLowerCase().trim()

  // Check capture prefixes
  for (const prefix of CAPTURE_PREFIXES) {
    if (q.startsWith(prefix)) return matchCount + 1 // capture index
  }

  // Check action verbs
  const firstWord = q.split(/\s+/)[0]
  if (firstWord && ACTION_VERBS.has(firstWord)) return createIndex

  // Has matches → first result, no matches → create
  return matchCount > 0 ? 0 : createIndex
}

export function CommandBar({ inputRef }: CommandBarProps) {
  const [rawQuery, setRawQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Breakdown state
  const [breakdownTask, setBreakdownTask] = useState<LocalTask | null>(null)
  const [breakdownLoading, setBreakdownLoading] = useState(false)
  const [breakdownItems, setBreakdownItems] = useState<string[]>([])

  const { tasks, addTask, complete, refresh } = useLocalTasks()
  const { projects } = useProjects()

  const { mode, query } = useMemo(() => parseMode(rawQuery), [rawQuery])

  const filteredTasks = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return tasks
      .filter((t) => !t.completed && t.content.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS)
  }, [query, tasks])

  const totalItems = filteredTasks.length + 2

  const clearAndBlur = useCallback(() => {
    setRawQuery('')
    setSelectedIndex(0)
    setBreakdownTask(null)
    setBreakdownItems([])
    setFocused(false)
    inputRef.current?.blur()
  }, [inputRef])

  const handleCreateTask = useCallback(async () => {
    const text = query.trim()
    if (!text) return
    const task = await addTask(text)
    if (task) {
      toast.success(`Task created: "${text}"`)
      clearAndBlur()
    }
  }, [query, addTask, clearAndBlur])

  const handleCapture = useCallback(async () => {
    const text = query.trim()
    if (!text) return
    try {
      await writeQuickCapture(text)
      logActivity('item_captured', undefined, { content: text, source: 'command_bar' }).catch(() => {})
      toast.success(`Captured: "${text}"`)
      clearAndBlur()
    } catch (e) {
      toast.error(`Failed to capture: ${e}`)
    }
  }, [query, clearAndBlur])

  const handleComplete = useCallback(async (id: string) => {
    const task = tasks.find((t) => t.id === id)
    await complete(id)
    if (task) toast.success(`Completed: "${task.content}"`)
    clearAndBlur()
  }, [tasks, complete, clearAndBlur])

  const handleMove = useCallback(async (id: string, projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    try {
      await updateLocalTask({ id, projectId })
      toast.success(`Moved to ${project?.name ?? 'project'}`)
      emitTasksChanged()
    } catch (e) {
      toast.error(`Failed to move: ${e}`)
    }
  }, [projects])

  const handleBreakDown = useCallback(async (task: LocalTask) => {
    setBreakdownTask(task)
    setBreakdownLoading(true)
    try {
      const subtasks = await breakDownTask(task.content, task.description ?? undefined)
      setBreakdownItems(subtasks)
    } catch (e) {
      toast.error(`Breakdown failed: ${e}`)
      setBreakdownTask(null)
    } finally {
      setBreakdownLoading(false)
    }
  }, [])

  const handleBreakdownConfirm = useCallback(async () => {
    if (!breakdownTask) return
    const items = breakdownItems.filter(Boolean)
    let created = 0
    for (const content of items) {
      try {
        await createLocalTask({ content, parentId: breakdownTask.id, projectId: breakdownTask.project_id })
        created++
      } catch { /* skip failed */ }
    }
    logActivity('task_breakdown_applied', breakdownTask.id, { subtask_count: created }).catch(() => {})
    toast.success(`Created ${created} subtasks`)
    emitTasksChanged()
    clearAndBlur()
  }, [breakdownTask, breakdownItems, clearAndBlur])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Breakdown mode shortcuts
      if (breakdownTask && !breakdownLoading) {
        if (e.key === 'Escape') { e.preventDefault(); setBreakdownTask(null); setBreakdownItems([]); return }
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleBreakdownConfirm(); return }
        return // Let inputs handle other keys
      }

      if (e.key === 'Escape') { e.preventDefault(); clearAndBlur(); return }

      if (!query.trim()) {
        if (e.key === 'Enter') e.preventDefault()
        return
      }

      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((prev) => (prev + 1) % totalItems); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems); return }

      // Action shortcuts on selected task result (Option/Alt + key)
      if (selectedIndex < filteredTasks.length && e.altKey) {
        const task = filteredTasks[selectedIndex]
        if (e.key === 'c') { e.preventDefault(); handleComplete(task.id); return }
        if (e.key === 'b') { e.preventDefault(); handleBreakDown(task); return }
        if (e.key === 'm') { e.preventDefault(); /* handled via mouse submenu */ return }
        if (e.key === 'f') { e.preventDefault(); /* handled via FocusPlayMenu click */ return }
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        const createIdx = filteredTasks.length
        const captureIdx = filteredTasks.length + 1

        // Respect forced mode from prefix
        if (mode === 'capture') { handleCapture(); return }
        if (mode === 'task') { handleCreateTask(); return }

        if (selectedIndex < filteredTasks.length) handleComplete(filteredTasks[selectedIndex].id)
        else if (selectedIndex === createIdx) handleCreateTask()
        else if (selectedIndex === captureIdx) handleCapture()
      }
    },
    [query, mode, totalItems, selectedIndex, filteredTasks, breakdownTask, breakdownLoading, projects, handleComplete, handleMove, handleBreakDown, handleBreakdownConfirm, handleCreateTask, handleCapture, clearAndBlur],
  )

  const handleFocus = useCallback(() => { setFocused(true); refresh() }, [refresh])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRawQuery(e.target.value)
    const { mode: m, query: q } = parseMode(e.target.value)
    const q2 = q.trim()
    if (q2) {
      const matches = tasks.filter((t) => !t.completed && t.content.toLowerCase().includes(q2.toLowerCase())).slice(0, MAX_RESULTS)
      // Force index for explicit prefix modes
      if (m === 'task') setSelectedIndex(matches.length) // create index
      else if (m === 'capture') setSelectedIndex(matches.length + 1) // capture index
      else setSelectedIndex(inferDefaultIndex(q2, matches.length))
    } else {
      setSelectedIndex(0)
    }
  }, [tasks])

  const showResults = focused && query.trim().length > 0

  // Placeholder changes based on prefix
  let placeholder = 'What do you need?'
  if (rawQuery.startsWith('/task ')) placeholder = 'Create a task...'
  else if (rawQuery.startsWith('/capture ') || rawQuery.startsWith('/note ')) placeholder = 'Capture a note...'
  else if (rawQuery.startsWith('/search ')) placeholder = 'Search tasks...'
  else if (rawQuery === '/') placeholder = 'task, capture, search...'

  // The input bar element (shared between default and focused states)
  const barElement = (
    <div
      className={cn(
        'flex h-11 items-center gap-2 px-4 rounded-xl border bg-popover',
        focused
          ? 'border-border/60 shadow-lg shadow-black/10'
          : 'border-transparent',
      )}
    >
      <Search className={cn(
        'size-3.5 shrink-0 transition-colors duration-200',
        focused ? 'text-muted-foreground/60' : 'text-muted-foreground/40',
      )} />
      <input
        ref={inputRef}
        type="text"
        value={rawQuery}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
      />
      <kbd className={cn(
        'rounded border px-1.5 py-0.5 text-[10px] font-mono transition-colors duration-200',
        focused ? 'border-border/40 text-muted-foreground/50' : 'border-border/30 text-muted-foreground/40',
      )}>
        {focused ? 'Esc' : '\u2318K'}
      </kbd>
    </div>
  )

  // Focused: centered overlay with backdrop blur
  if (focused) {
    return (
      <>
        {/* Unfocused placeholder to preserve layout */}
        <div className="h-11 border-t border-border/50 bg-muted/20" />

        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={clearAndBlur}
        />

        {/* Centered command bar */}
        <div className="fixed inset-x-0 top-[28%] z-50 mx-auto w-full max-w-lg px-4 animate-in fade-in slide-in-from-bottom-3 duration-200">
          {barElement}

          {/* Results below */}
          {showResults && (
            <div className="mt-1">
              <CommandBarResults
                query={query.trim()}
                mode={mode}
                tasks={filteredTasks}
                projects={projects}
                selectedIndex={selectedIndex}
                onComplete={handleComplete}
                onMove={handleMove}
                onBreakDown={handleBreakDown}
                onCreateTask={handleCreateTask}
                onCapture={handleCapture}
                onSelect={setSelectedIndex}
                breakdownTask={breakdownTask}
                breakdownLoading={breakdownLoading}
                breakdownItems={breakdownItems}
                onBreakdownEdit={(i, v) => setBreakdownItems((prev) => prev.map((item, idx) => idx === i ? v : item))}
                onBreakdownRemove={(i) => setBreakdownItems((prev) => prev.filter((_, idx) => idx !== i))}
                onBreakdownConfirm={handleBreakdownConfirm}
                onBreakdownCancel={() => { setBreakdownTask(null); setBreakdownItems([]) }}
              />
            </div>
          )}
        </div>
      </>
    )
  }

  // Default: bottom bar
  return (
    <div
      className="command-bar border-t border-border/50 bg-muted/20 cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {barElement}
    </div>
  )
}
