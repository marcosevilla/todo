import { useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'
import { NavSidebar } from './NavSidebar'
import { RightSidebar } from './RightSidebar'
import { CommandBar } from '@/components/shared/CommandBar'
import { HelpPanel } from '@/components/shared/HelpPanel'
import { BulkActionBar } from '@/components/shared/BulkActionBar'
import { useSelectionStore } from '@/stores/selectionStore'
import { QuickCreateDialog } from '@/components/tasks/QuickCreateDialog'
import { TodayPage } from '@/components/pages/TodayPage'
import { TasksPage } from '@/components/pages/TasksPage'
import { InboxPage } from '@/components/pages/InboxPage'
import { SessionPage } from '@/components/pages/SessionPage'
import { SettingsPage } from '@/components/pages/SettingsPage'
import { DocsPage } from '@/components/pages/DocsPage'
import { emitTasksChanged } from '@/hooks/useLocalTasks'
import { useFocusTimer } from '@/hooks/useFocusTimer'
import { useFocusStore } from '@/stores/focusStore'
import { FocusView } from '@/components/focus/FocusView'
import { FocusBanner } from '@/components/focus/FocusBanner'
import { FocusCelebration } from '@/components/focus/FocusCelebration'
import { FocusResumeDialog } from '@/components/focus/FocusResumeDialog'
import { useDetailStore } from '@/stores/detailStore'
import { TaskDetailPage } from '@/components/detail/TaskDetailPage'
import { CaptureDetailPage } from '@/components/detail/CaptureDetailPage'
import { DetailSidebar } from '@/components/detail/DetailSidebar'

const PAGE_TITLES: Record<string, string> = {
  today: 'Today',
  tasks: 'Tasks',
  inbox: 'Inbox',
  docs: 'Docs',
  session: 'Activity',
  settings: 'Settings',
}

const PAGES = ['today', 'tasks', 'inbox', 'docs', 'session'] as const

function PageContent({ page }: { page: string }) {
  switch (page) {
    case 'today':
      return <TodayPage />
    case 'tasks':
      return <TasksPage />
    case 'inbox':
      return <InboxPage />
    case 'docs':
      return <DocsPage />
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
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)


  // Focus mode
  useFocusTimer()
  const focusActive = useFocusStore((s) => s.isActive)
  const focusCompact = useFocusStore((s) => s.isCompact)
  const showCelebration = useFocusStore((s) => s.showCelebration)

  // Detail view
  const detailTarget = useDetailStore((s) => s.target)
  const detailMode = useDetailStore((s) => s.mode)
  const closeDetail = useDetailStore((s) => s.close)

  const setCaptureRequested = useAppStore((s) => s.setCaptureRequested)

  // Clear selection on page change
  useEffect(() => {
    useSelectionStore.getState().clear()
  }, [currentPage])

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

      // Cmd+, — open settings
      if (meta && e.key === ',') {
        e.preventDefault()
        setCurrentPage('settings')
        return
      }

      // Cmd+R — refresh all data
      if (meta && e.key === 'r') {
        e.preventDefault()
        emitTasksChanged()
        return
      }

      // Cmd+A — select all (handled by individual pages, but prevent default browser behavior)
      // Escape — clear selection (if any selected, before closing detail)
      if (e.key === 'Escape' && !isInput && useSelectionStore.getState().hasSelection) {
        e.preventDefault()
        useSelectionStore.getState().clear()
        return
      }


      // Escape — close detail view (when not in input)
      if (e.key === 'Escape' && !isInput && detailTarget) {
        e.preventDefault()
        closeDetail()
        return
      }

      // Space — pause/resume focus (only when focus active and not in input)
      if (e.key === ' ' && !isInput && !meta && focusActive) {
        e.preventDefault()
        const store = useFocusStore.getState()
        if (store.pausedAt) store.resumeFocus()
        else store.pauseFocus()
        return
      }

      // Q — open quick create dialog (only when not typing in an input)
      if (e.key === 'q' && !isInput && !meta) {
        e.preventDefault()
        setQuickCreateOpen(true)
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
  }, [setCurrentPage, detailTarget, closeDetail, focusActive])

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Left: Nav sidebar */}
      <NavSidebar />

      {/* Center: Main content area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center border-b border-border/20 px-5 py-2" data-tauri-drag-region>
          <h1 className="text-base font-semibold tracking-tight">
            {PAGE_TITLES[currentPage] ?? 'Daily Triage'}
          </h1>
        </header>

        {/* Focus banner (compact mode) */}
        {focusActive && focusCompact && <FocusBanner />}

        {/* Page content / Focus view / Detail view */}
        <div className="flex flex-1 overflow-y-auto">
          {focusActive && !focusCompact ? (
            <FocusView />
          ) : detailTarget && detailMode === 'body' ? (
            <main key={`detail-${detailTarget.id}`} className="flex-1 p-6 animate-page-enter">
              <div className="mx-auto w-full max-w-2xl">
                {detailTarget.type === 'task' ? <TaskDetailPage /> : <CaptureDetailPage />}
              </div>
            </main>
          ) : (
            <main key={currentPage} className={cn('flex-1 animate-page-enter', currentPage === 'docs' ? 'flex' : 'p-6')}>
              {currentPage === 'docs' ? (
                <PageContent page={currentPage} />
              ) : (
                <div className="mx-auto w-full max-w-2xl">
                  <PageContent page={currentPage} />
                </div>
              )}
            </main>
          )}
        </div>
      </div>

      {/* Right: Sidebar — detail view replaces Schedule/Habits when in sidebar mode */}
      {currentPage !== 'settings' && currentPage !== 'session' && (
        detailTarget && detailMode === 'sidebar' ? (
          <DetailSidebar />
        ) : (
          <RightSidebar />
        )
      )}

      {/* Quick create task dialog */}
      <QuickCreateDialog
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
      />

      {/* Bulk action bar */}
      <BulkActionBar />

      {/* Help panel (shortcuts + roadmap) */}
      <HelpPanel />

      {/* Command bar overlay */}
      <CommandBar />

      {/* Focus mode overlays */}
      {showCelebration && <FocusCelebration />}
      <FocusResumeDialog />
    </div>
  )
}
