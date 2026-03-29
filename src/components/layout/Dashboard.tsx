import { useCallback, useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useAppStore } from '@/stores/appStore'
import { NavSidebar } from './NavSidebar'
import { RightSidebar } from './RightSidebar'
import { RefreshButton } from '@/components/shared/RefreshButton'
import { SaveButton } from '@/components/shared/SaveButton'
import { CommandPalette } from '@/components/shared/CommandPalette'
import { ShortcutOverlay } from '@/components/shared/ShortcutOverlay'
import { QuickCreateDialog } from '@/components/tasks/QuickCreateDialog'
import { TodayPage } from '@/components/pages/TodayPage'
import { TasksPage } from '@/components/pages/TasksPage'
import { InboxPage } from '@/components/pages/InboxPage'
import { SessionPage } from '@/components/pages/SessionPage'
import { SettingsPage } from '@/components/pages/SettingsPage'
import { useRefresh } from '@/hooks/useRefresh'
import { useSave } from '@/hooks/useSave'
import { useTheme } from '@/hooks/useTheme'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'

const PAGE_TITLES: Record<string, string> = {
  today: 'Today',
  tasks: 'Tasks',
  inbox: 'Inbox',
  session: 'Session',
  settings: 'Settings',
}

const PAGES = ['today', 'tasks', 'inbox', 'session'] as const

function PageContent({ page }: { page: string }) {
  switch (page) {
    case 'today':
      return <TodayPage />
    case 'tasks':
      return <TasksPage />
    case 'inbox':
      return <InboxPage />
    case 'session':
      return <SessionPage />
    case 'settings':
      return <SettingsPage />
    default:
      return <TodayPage />
  }
}

export function Dashboard() {
  const currentPage = useAppStore((s) => s.currentPage)
  const setCurrentPage = useAppStore((s) => s.setCurrentPage)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)

  const refreshAll = useCallback(async () => {
    // Individual panels manage their own data fetching via hooks.
  }, [])

  const { triggerRefresh } = useRefresh(refreshAll)
  const { save } = useSave()
  const { setTheme } = useTheme()

  const setCaptureRequested = useAppStore((s) => s.setCaptureRequested)

  // Listen for tray "Quick Capture" event
  useEffect(() => {
    const unlisten = listen('open-quick-capture', () => {
      setCurrentPage('inbox')
      setCaptureRequested(true)
    })
    return () => { unlisten.then(fn => fn()) }
  }, [setCurrentPage, setCaptureRequested])

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      // Cmd+K — toggle command palette (always works)
      if (meta && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((prev) => !prev)
        return
      }

      // Cmd+, — open settings
      if (meta && e.key === ',') {
        e.preventDefault()
        setCurrentPage('settings')
        return
      }

      // Cmd+R — refresh all
      if (meta && e.key === 'r') {
        e.preventDefault()
        triggerRefresh()
        return
      }

      // Escape — close palette (dialog components handle their own Escape)
      if (e.key === 'Escape') {
        if (paletteOpen) {
          e.preventDefault()
          setPaletteOpen(false)
          return
        }
      }

      // Q — open quick create dialog (only when not typing in an input)
      if (e.key === 'q' && !isInput && !meta) {
        e.preventDefault()
        setQuickCreateOpen(true)
        return
      }

      // ? — toggle shortcuts overlay (only when not typing in an input)
      if (e.key === '?' && !isInput && !meta) {
        e.preventDefault()
        setShortcutsOpen((prev) => !prev)
        return
      }

      // Number keys for navigation (only when not typing in an input)
      if (!isInput && !paletteOpen) {
        const num = parseInt(e.key, 10)
        if (num >= 1 && num <= 4) {
          e.preventDefault()
          setCurrentPage(PAGES[num - 1])
          return
        }
      }

      // Cmd+1-4 for navigation (works even in inputs)
      if (meta && e.key >= '1' && e.key <= '4') {
        e.preventDefault()
        const idx = parseInt(e.key, 10) - 1
        setCurrentPage(PAGES[idx])
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [paletteOpen, shortcutsOpen, setCurrentPage, triggerRefresh])

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Left: Nav sidebar */}
      <NavSidebar />

      {/* Center: Main content area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border/50 px-5 py-2" data-tauri-drag-region>
          <div className="flex items-center gap-4">
            <h1 className="text-base font-semibold tracking-tight">
              {PAGE_TITLES[currentPage] ?? 'Daily Triage'}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:inline-flex gap-1.5 text-muted-foreground/50"
            >
              <kbd className="text-[10px] font-mono">{'\u2318'}K</kbd>
            </Button>
            <RefreshButton onRefresh={triggerRefresh} />
            <SaveButton />
          </div>
        </header>

        {/* Page content */}
        <ScrollArea className="flex-1">
          <main key={currentPage} className="p-6 animate-page-enter">
            <PageContent page={currentPage} />
          </main>
        </ScrollArea>
      </div>

      {/* Right: Sidebar (Schedule + Habits) — hidden on Settings/Session */}
      {currentPage !== 'settings' && currentPage !== 'session' && (
        <RightSidebar />
      )}

      {/* Command Palette overlay */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onRefresh={triggerRefresh}
        onSave={save}
        onSetTheme={setTheme}
      />

      {/* Quick create task dialog */}
      <QuickCreateDialog
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
      />

      {/* Shortcuts overlay */}
      <ShortcutOverlay
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {/* Shortcut hint button */}
      <button
        onClick={() => setShortcutsOpen(true)}
        className="fixed bottom-3 right-3 flex h-6 w-6 items-center justify-center rounded-full border border-border/30 text-xs text-muted-foreground/30 transition-colors hover:text-muted-foreground/60"
      >
        ?
      </button>
    </div>
  )
}
