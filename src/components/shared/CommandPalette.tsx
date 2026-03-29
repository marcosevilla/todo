import { useState, useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import { writeQuickCapture } from '@/services/tauri'
import { toast } from 'sonner'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import { PenLine } from 'lucide-react'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onRefresh: () => void
  onSave: () => void
  onSetTheme?: (theme: 'light' | 'dark' | 'system') => void
}

export function CommandPalette({
  open,
  onClose,
  onRefresh,
  onSave,
  onSetTheme,
}: CommandPaletteProps) {
  const setCurrentPage = useAppStore((s) => s.setCurrentPage)
  const [search, setSearch] = useState('')

  const runAndClose = (fn: () => void) => {
    fn()
    setSearch('')
    onClose()
  }

  const handleCapture = useCallback(async () => {
    const text = search.trim()
    if (!text) return
    try {
      await writeQuickCapture(text)
      toast.success(`Captured: "${text}"`)
    } catch (e) {
      toast.error(`Capture failed: ${e}`)
    }
    setSearch('')
    onClose()
  }, [search, onClose])

  return (
    <CommandDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setSearch('')
          onClose()
        }
      }}
    >
      <Command>
      <CommandInput
        placeholder="Type a command or capture a thought\u2026"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>
          {search.trim()
            ? `Press Enter to capture "${search.trim()}"`
            : 'No commands found'}
        </CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runAndClose(() => setCurrentPage('today'))}>
            Go to Today
            <CommandShortcut>1</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(() => setCurrentPage('tasks'))}>
            Go to Tasks
            <CommandShortcut>2</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(() => setCurrentPage('inbox'))}>
            Go to Inbox
            <CommandShortcut>3</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(() => setCurrentPage('session'))}>
            Go to Session
            <CommandShortcut>4</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(() => setCurrentPage('settings'))}>
            Go to Settings
            <CommandShortcut>{'\u2318'},</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runAndClose(onRefresh)}>
            Refresh all
            <CommandShortcut>{'\u2318'}R</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(onSave)}>
            Save progress
            <CommandShortcut>{'\u2318'}S</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => runAndClose(() => onSetTheme?.('light'))}>
            Switch to light mode
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(() => onSetTheme?.('dark'))}>
            Switch to dark mode
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(() => onSetTheme?.('system'))}>
            Use system theme
          </CommandItem>
        </CommandGroup>

        {/* Dynamic capture option — shows when user has typed something */}
        {search.trim() && (
          <CommandGroup heading="Capture">
            <CommandItem
              value={`capture ${search}`}
              onSelect={handleCapture}
            >
              <PenLine className="size-4 text-muted-foreground" />
              Capture: &ldquo;{search.trim()}&rdquo;
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
      </Command>
    </CommandDialog>
  )
}
