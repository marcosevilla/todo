import { useCallback, useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useAppStore } from '@/stores/appStore'
import { NavSidebar } from './NavSidebar'
import { RightSidebar } from './RightSidebar'
import { RefreshButton } from '@/components/shared/RefreshButton'
import { SaveButton } from '@/components/shared/SaveButton'
import { CommandBar } from '@/components/shared/CommandBar'
import { ShortcutOverlay } from '@/components/shared/ShortcutOverlay'
import { QuickCreateDialog } from '@/components/tasks/QuickCreateDialog'
import { TodayPage } from '@/components/pages/TodayPage'
import { TasksPage } from '@/components/pages/TasksPage'
import { InboxPage } from '@/components/pages/InboxPage'
import { SessionPage } from '@/components/pages/SessionPage'
import { SettingsPage } from '@/components/pages/SettingsPage'
import { useRefresh } from '@/hooks/useRefresh'
import { useFocusTimer } from '@/hooks/useFocusTimer'
import { useFocusStore } from '@/stores/focusStore'
import { FocusView } from '@/components/focus/FocusView'
import { FocusBanner } from '@/components/focus/FocusBanner'
import { FocusCelebration } from '@/components/focus/FocusCelebration'
import { FocusResumeDialog } from '@/components/focus/FocusResumeDialog'

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
  const commandBarRef = useRef<HTMLInputElement>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)

  const refreshAll = useCallback(async () => {
    // Individual panels manage their own data fetching via hooks.
  }, [])

  const { triggerRefresh } = useRefresh(refreshAll)

  // Focus mode
  useFocusTimer()
  const focusActive = useFocusStore((s) => s.isActive)
  const focusCompact = useFocusStore((s) => s.isCompact)
  const showCelebration = useFocusStore((s) => s.showCelebration)

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

      // Cmd+K — focus command bar (always works)
      if (meta && e.key === 'k') {
        e.preventDefault()
        if (document.activeElement === commandBarRef.current) {
          commandBarRef.current?.blur()
        } else {
          commandBarRef.current?.focus()
        }
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
      if (!isInput) {
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
  }, [shortcutsOpen, setCurrentPage, triggerRefresh])

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Left: Nav sidebar */}
      <NavSidebar />

      {/* Center: Main content area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border/50 px-5 py-2" data-tauri-drag-region>
          <div className="flex items-center gap-4">
            <h1 className="text-base font-semibold tracking-tight">
              {PAGE_TITLES[currentPage] ?? 'Daily Triage'}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <RefreshButton onRefresh={triggerRefresh} />
            <SaveButton />
          </div>
        </header>

        {/* Focus banner (compact mode) */}
        {focusActive && focusCompact && <FocusBanner />}

        {/* Page content / Focus view */}
        <div className="flex flex-1 overflow-y-auto">
          {focusActive && !focusCompact ? (
            <FocusView />
          ) : (
            <main key={currentPage} className="flex-1 p-6 animate-page-enter">
              <div className="mx-auto w-full max-w-2xl">
                <PageContent page={currentPage} />
              </div>
            </main>
          )}
        </div>
        <CommandBar inputRef={commandBarRef} />
      </div>

      {/* Right: Sidebar (Schedule + Habits) — hidden on Settings/Session */}
      {currentPage !== 'settings' && currentPage !== 'session' && (
        <RightSidebar />
      )}

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

      {/* Focus mode overlays */}
      {showCelebration && <FocusCelebration />}
      <FocusResumeDialog />
    </div>
  )
}
