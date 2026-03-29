import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface ShortcutRow {
  key: string
  action: string
}

interface ShortcutSection {
  title: string
  shortcuts: ShortcutRow[]
}

const SECTIONS: ShortcutSection[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { key: '1-4', action: 'Jump to page' },
      { key: '\u2318K', action: 'Focus command bar' },
      { key: '\u2318,', action: 'Settings' },
    ],
  },
  {
    title: 'Tasks',
    shortcuts: [
      { key: 'j / \u2193', action: 'Next task' },
      { key: 'k / \u2191', action: 'Previous task' },
      { key: 'x / Space', action: 'Complete task' },
      { key: 's', action: 'Snooze task' },
      { key: 'Enter', action: 'Open in Todoist' },
    ],
  },
  {
    title: 'Focus',
    shortcuts: [
      { key: 'Enter', action: 'Start focus / confirm' },
      { key: '1-5', action: 'Set timer duration' },
      { key: 'Escape', action: 'Minimize / cancel' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { key: 'Q', action: 'Quick create task' },
      { key: '\u2318R', action: 'Refresh all' },
      { key: '\u2318S', action: 'Save progress' },
      { key: '\u2318\u21E7T', action: 'Toggle window' },
      { key: 'Escape', action: 'Close overlay' },
    ],
  },
]

interface ShortcutOverlayProps {
  open: boolean
  onClose: () => void
}

export function ShortcutOverlay({ open, onClose }: ShortcutOverlayProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription className="sr-only">
            Available keyboard shortcuts for navigation, tasks, and actions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
              <div className="space-y-1.5">
                {section.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-muted-foreground">
                      {shortcut.action}
                    </span>
                    <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
