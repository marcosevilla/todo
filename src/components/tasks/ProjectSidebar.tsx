import { useState, useCallback, useEffect, useRef } from 'react'
import { useLayoutStore } from '@/stores/layoutStore'
import { cn } from '@/lib/utils'
import { Plus, PanelLeftClose, List, Pencil, Trash2, Check, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { Project, LocalTask } from '@/services/tauri'

const PROJECT_COLORS = [
  '#6366f1', '#ec4899', '#22c55e', '#f59e0b', '#06b6d4', '#f43f5e', '#8b5cf6', '#14b8a6',
]

interface ProjectSidebarProps {
  projects: Project[]
  tasks: LocalTask[]
  selectedProjectId: string | null
  onSelectProject: (id: string | null) => void
  onAddProject: (name: string, color: string) => void
  onRenameProject: (id: string, name: string) => void
  onUpdateProjectColor: (id: string, color: string) => void
  onDeleteProject: (id: string) => void
}

export function ProjectSidebar({
  projects,
  tasks,
  selectedProjectId,
  onSelectProject,
  onAddProject,
  onRenameProject,
  onUpdateProjectColor,
  onDeleteProject,
}: ProjectSidebarProps) {
  const sidebarWidth = useLayoutStore((s) => s.tasksProjectSidebarWidth)
  const setSidebarWidth = useLayoutStore((s) => s.setTasksProjectSidebarWidth)
  const setCollapsed = useLayoutStore((s) => s.setTasksProjectSidebarCollapsed)

  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)
  const startWidth = useRef(200)

  // New project input
  const [newProjectInput, setNewProjectInput] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0])

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [showColorsId, setShowColorsId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Count non-completed tasks per project
  const taskCountByProject: Record<string, number> = {}
  let totalActive = 0
  for (const t of tasks) {
    if (!t.completed) {
      taskCountByProject[t.project_id] = (taskCountByProject[t.project_id] || 0) + 1
      totalActive++
    }
  }

  const handleCreateProject = useCallback(() => {
    const name = newProjectName.trim()
    if (!name) return
    onAddProject(name, newProjectColor)
    setNewProjectName('')
    setNewProjectColor(PROJECT_COLORS[0])
    setNewProjectInput(false)
  }, [newProjectName, newProjectColor, onAddProject])

  // Resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    startX.current = e.clientX
    startWidth.current = sidebarWidth
  }, [sidebarWidth])

  useEffect(() => {
    if (!dragging) return
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    function handleMouseMove(e: MouseEvent) {
      const delta = e.clientX - startX.current
      setSidebarWidth(Math.min(400, Math.max(140, startWidth.current + delta)))
    }
    function handleMouseUp() {
      setDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [dragging, setSidebarWidth])

  return (
    <div
      className="relative flex flex-col border-r border-border/20 bg-muted/10 overflow-hidden"
      style={{ width: sidebarWidth }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
        <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">Projects</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setNewProjectInput(true)}
            className="flex size-5 items-center justify-center rounded-md text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/20 transition-colors"
            title="New project"
          >
            <Plus className="size-3" />
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="flex size-5 items-center justify-center rounded-md text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/20 transition-colors"
            title="Collapse"
          >
            <PanelLeftClose className="size-3" />
          </button>
        </div>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {/* All Tasks */}
        <button
          onClick={() => onSelectProject(null)}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
            selectedProjectId === null
              ? 'bg-accent/40 text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/10',
          )}
        >
          <List className="size-3.5 shrink-0 text-muted-foreground/50" />
          <span className="flex-1 text-xs font-medium truncate">All Tasks</span>
          <span className="text-[10px] text-muted-foreground/50">{totalActive}</span>
        </button>

        {/* Divider */}
        <div className="h-px bg-border/10 my-1" />

        {/* Projects */}
        {projects.map((project) => {
          const count = taskCountByProject[project.id] || 0
          const isSelected = selectedProjectId === project.id
          const isInbox = project.id === 'inbox'

          // Inline editing
          if (editingId === project.id) {
            return (
              <div key={project.id} className="flex items-center gap-1 px-2 py-1">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editName.trim()) {
                      onRenameProject(project.id, editName.trim())
                      setEditingId(null)
                    }
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="h-6 text-xs flex-1"
                  autoFocus
                />
                <Button variant="ghost" size="icon-xs" onClick={() => { if (editName.trim()) { onRenameProject(project.id, editName.trim()); setEditingId(null) } }}>
                  <Check className="size-3" />
                </Button>
                <Button variant="ghost" size="icon-xs" onClick={() => setEditingId(null)}>
                  <X className="size-3" />
                </Button>
              </div>
            )
          }

          // Color picker
          if (showColorsId === project.id) {
            return (
              <div key={project.id} className="flex items-center gap-1 px-2 py-1 flex-wrap">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    className={cn(
                      'size-4 rounded-full border-2 transition-all',
                      project.color === c ? 'border-foreground scale-110' : 'border-transparent hover:border-muted-foreground/50',
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => { onUpdateProjectColor(project.id, c); setShowColorsId(null) }}
                  />
                ))}
                <Button variant="ghost" size="icon-xs" onClick={() => setShowColorsId(null)}>
                  <X className="size-3" />
                </Button>
              </div>
            )
          }

          // Delete confirm
          if (confirmDeleteId === project.id) {
            return (
              <div key={project.id} className="flex items-center gap-1 px-2 py-1">
                <span className="text-[10px] text-destructive flex-1">Delete {project.name}?</span>
                <Button variant="ghost" size="icon-xs" className="text-destructive" onClick={() => { onDeleteProject(project.id); setConfirmDeleteId(null); if (selectedProjectId === project.id) onSelectProject(null) }}>
                  <Check className="size-3" />
                </Button>
                <Button variant="ghost" size="icon-xs" onClick={() => setConfirmDeleteId(null)}>
                  <X className="size-3" />
                </Button>
              </div>
            )
          }

          return (
            <div
              key={project.id}
              className={cn(
                'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition-colors cursor-pointer',
                isSelected
                  ? 'bg-accent/40 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/10',
              )}
              onClick={() => onSelectProject(project.id)}
            >
              <span
                className="size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <span className="flex-1 text-xs font-medium truncate">{project.name}</span>
              <span className="text-[10px] text-muted-foreground/50 group-hover:hidden">{count}</span>

              {/* Hover actions */}
              <div className="hidden items-center gap-0.5 group-hover:flex" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => { setEditName(project.name); setEditingId(project.id) }}
                  className="flex size-4 items-center justify-center rounded text-muted-foreground/30 hover:text-muted-foreground"
                  title="Rename"
                >
                  <Pencil className="size-2.5" />
                </button>
                <button
                  className="size-4 rounded-full border border-muted-foreground/20 hover:border-muted-foreground/50 transition-colors"
                  style={{ backgroundColor: project.color }}
                  onClick={() => setShowColorsId(project.id)}
                  title="Change color"
                />
                {!isInbox && (
                  <button
                    onClick={() => setConfirmDeleteId(project.id)}
                    className="flex size-4 items-center justify-center rounded text-destructive/30 hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="size-2.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* New project input */}
        {newProjectInput && (
          <div className="space-y-1.5 px-1.5 py-1">
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateProject()
                if (e.key === 'Escape') { setNewProjectInput(false); setNewProjectName('') }
              }}
              onBlur={() => { if (!newProjectName.trim()) setNewProjectInput(false) }}
              placeholder="Project name..."
              className="h-6 text-xs"
              autoFocus
            />
            <div className="flex items-center gap-1">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  className={cn(
                    'size-4 rounded-full border-2 transition-all',
                    newProjectColor === c ? 'border-foreground scale-110' : 'border-transparent hover:border-muted-foreground/50',
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewProjectColor(c)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom: New project button (shown when input not open) */}
      {!newProjectInput && (
        <div className="border-t border-border/20 p-1.5">
          <button
            onClick={() => setNewProjectInput(true)}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground/30 hover:text-muted-foreground hover:bg-accent/10 transition-colors"
          >
            <Plus className="size-3" />
            New project
          </button>
        </div>
      )}

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          'absolute right-0 top-0 bottom-0 z-10 w-px cursor-col-resize transition-colors bg-border/20',
          dragging ? 'bg-accent-blue/50 w-1' : 'hover:bg-accent-blue/30 hover:w-1',
        )}
      />
    </div>
  )
}
