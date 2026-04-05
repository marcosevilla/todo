import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getSetting,
  setSetting,
  clearAllSettings,
  checkForUpdates,
  getCalendarFeeds,
  addCalendarFeed,
  removeCalendarFeed,
  getCaptureRoutes,
  createCaptureRoute,
  updateCaptureRoute,
  deleteCaptureRoute,
  getDocuments,
  syncPush,
  syncPull,
  syncGetStatus,
  syncConfigure,
  syncTestConnection,
  syncInitializeRemote,
} from '@/services/tauri'
import type { UpdateStatus, CalendarFeed, CaptureRoute, Document, SyncStatus } from '@/services/tauri'
import { openUrl } from '@/services/tauri'
import { useAppStore } from '@/stores/appStore'
import { useTheme } from '@/hooks/useTheme'
import type { AccentTheme } from '@/hooks/useTheme'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Lightbulb, Quote, CheckSquare, FileText, Pencil, Trash2, ChevronDown } from 'lucide-react'

// ── Types ──

interface SettingField {
  key: string
  label: string
  placeholder: string
  help: string
  type: 'text' | 'password'
}

interface FieldState {
  value: string
  saving: boolean
  saved: boolean
  error: string | null
}

// ── Field definitions by section ──

const INTEGRATIONS_FIELDS: SettingField[] = [
  {
    key: 'todoist_api_token',
    label: 'Todoist API Token',
    placeholder: 'Paste your token here',
    help: 'Settings \u2192 Integrations \u2192 Developer \u2192 API token',
    type: 'password',
  },
  {
    key: 'anthropic_api_key',
    label: 'Anthropic API Key',
    placeholder: 'sk-ant-...',
    help: 'console.anthropic.com \u2192 API Keys',
    type: 'password',
  },
]

const OBSIDIAN_FIELDS: SettingField[] = [
  {
    key: 'obsidian_vault_path',
    label: 'Vault Path',
    placeholder: '~/Obsidian/marcowits',
    help: 'Absolute path to your Obsidian vault folder',
    type: 'text',
  },
]

const FOCUS_FIELDS: SettingField[] = [
  {
    key: 'focus_break_minutes',
    label: 'Break Duration (minutes)',
    placeholder: '5',
    help: 'Default break length between Pomodoro rounds (e.g., 5, 10, 15)',
    type: 'text',
  },
  {
    key: 'focus_abandon_status',
    label: 'Status on Abandon',
    placeholder: 'todo',
    help: 'What status a task gets when you stop a focus session (todo or in_progress)',
    type: 'text',
  },
]

const ALL_FIELDS = [...INTEGRATIONS_FIELDS, ...OBSIDIAN_FIELDS, ...FOCUS_FIELDS]

// ── Components ──

function SettingFieldRow({
  field,
  state,
  onChange,
  onSave,
}: {
  field: SettingField
  state: FieldState
  onChange: (value: string) => void
  onSave: () => void
}) {
  const [visible, setVisible] = useState(false)
  const isPassword = field.type === 'password'

  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.key} className="text-sm font-medium">
        {field.label}
      </Label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            id={field.key}
            type={isPassword && !visible ? 'password' : 'text'}
            placeholder={field.placeholder}
            value={state.value}
            onChange={(e) => onChange(e.target.value)}
            className="pr-10"
          />
          {isPassword && state.value && (
            <button
              type="button"
              onClick={() => setVisible(!visible)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {visible ? 'Hide' : 'Show'}
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onSave}
          disabled={state.saving}
        >
          {state.saving ? 'Saving...' : state.saved ? 'Saved' : 'Save'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{field.help}</p>
      {state.error && (
        <p className="text-xs text-destructive">{state.error}</p>
      )}
    </div>
  )
}

function SectionHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="space-y-1">
      <h2 className="font-heading text-base font-semibold tracking-tight">{title}</h2>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

// ── Accent theme definitions ──

const ACCENT_THEMES: { value: AccentTheme; label: string; swatch: string }[] = [
  { value: 'warm', label: 'Warm', swatch: 'oklch(0.65 0.15 75)' },
  { value: 'ocean', label: 'Ocean', swatch: 'oklch(0.55 0.18 230)' },
  { value: 'rose', label: 'Rose', swatch: 'oklch(0.58 0.18 350)' },
  { value: 'mono', label: 'Mono', swatch: 'oklch(0.45 0 0)' },
  { value: 'forest', label: 'Forest', swatch: 'oklch(0.50 0.15 155)' },
]

// ── Color presets for calendar feeds ──

const FEED_COLORS = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#22c55e', // green
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#f43f5e', // rose
]

// ── Calendar Feeds Section ──

function CalendarsSection() {
  const [feeds, setFeeds] = useState<CalendarFeed[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newColor, setNewColor] = useState(FEED_COLORS[0])
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await getCalendarFeeds()
        setFeeds(data)
      } catch {
        // Table might not exist yet on first run
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleAdd = async () => {
    if (!newLabel.trim() || !newUrl.trim()) {
      setError('Label and URL are required')
      return
    }
    setAdding(true)
    setError(null)
    try {
      const feed = await addCalendarFeed(newLabel.trim(), newUrl.trim(), newColor)
      setFeeds((prev) => [...prev, feed])
      setNewLabel('')
      setNewUrl('')
      setNewColor(FEED_COLORS[0])
      setShowForm(false)
    } catch (e) {
      setError(String(e))
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (feedId: string) => {
    if (deleteConfirm !== feedId) {
      setDeleteConfirm(feedId)
      return
    }
    try {
      await removeCalendarFeed(feedId)
      setFeeds((prev) => prev.filter((f) => f.id !== feedId))
      setDeleteConfirm(null)
    } catch (e) {
      setError(String(e))
    }
  }

  if (loading) {
    return (
      <section className="space-y-4">
        <SectionHeader
          title="Calendars"
          description="Add iCal feeds from Google Calendar, Outlook, etc."
        />
        <Skeleton className="h-8" />
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Calendars"
        description="Add iCal feeds from Google Calendar, Outlook, etc."
      />

      {/* Feed list */}
      <div className="space-y-2">
        {feeds.map((feed) => (
          <div
            key={feed.id}
            className="flex items-center gap-3 rounded-md border px-3 py-2"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: feed.color }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{feed.label}</p>
              <p className="text-xs text-muted-foreground truncate">
                {feed.url}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => handleRemove(feed.id)}
            >
              {deleteConfirm === feed.id ? 'Confirm?' : 'Remove'}
            </Button>
          </div>
        ))}
        {feeds.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No calendars configured yet.
          </p>
        )}
      </div>

      {/* Add form */}
      {showForm ? (
        <div className="space-y-3 rounded-md border p-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Label</Label>
            <Input
              placeholder="Work Calendar"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">iCal URL</Label>
            <Input
              placeholder="https://calendar.google.com/calendar/ical/..."
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Google Calendar: Settings &rarr; Calendar &rarr; "Secret address in iCal format"
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Color</Label>
            <div className="flex items-center gap-2">
              {FEED_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`h-6 w-6 rounded-full border-2 transition-all ${
                    newColor === color
                      ? 'border-foreground scale-110'
                      : 'border-transparent hover:border-muted-foreground/50'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setNewColor(color)}
                />
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleAdd} disabled={adding}>
              {adding ? 'Adding...' : 'Add Calendar'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false)
                setError(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          + Add Calendar
        </Button>
      )}
    </section>
  )
}

// ── Status Colors Section ──

const COLOR_OPTIONS = [
  { label: 'Gray', value: 'text-muted-foreground/50', preview: 'bg-gray-400' },
  { label: 'Blue', value: 'text-blue-500', preview: 'bg-blue-500' },
  { label: 'Amber', value: 'text-amber-500', preview: 'bg-amber-500' },
  { label: 'Red', value: 'text-red-500', preview: 'bg-red-500' },
  { label: 'Green', value: 'text-green-500', preview: 'bg-green-500' },
  { label: 'Purple', value: 'text-purple-500', preview: 'bg-purple-500' },
  { label: 'Cyan', value: 'text-cyan-500', preview: 'bg-cyan-500' },
  { label: 'Pink', value: 'text-pink-500', preview: 'bg-pink-500' },
  { label: 'Orange', value: 'text-orange-500', preview: 'bg-orange-500' },
]

const STATUS_DEFAULTS: Record<string, { label: string; defaultColor: string }> = {
  backlog: { label: 'Backlog', defaultColor: 'Gray' },
  todo: { label: 'Todo', defaultColor: 'Blue' },
  in_progress: { label: 'In Progress', defaultColor: 'Amber' },
  blocked: { label: 'Blocked', defaultColor: 'Red' },
  complete: { label: 'Complete', defaultColor: 'Green' },
}

function StatusColorsSection() {
  return (
    <section className="space-y-4">
      <SectionHeader
        title="Status Colors"
        description="Current color assignments for task statuses."
      />
      <div className="space-y-2">
        {Object.entries(STATUS_DEFAULTS).map(([status, config]) => (
          <div key={status} className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <span className={cn('size-3 rounded-full', COLOR_OPTIONS.find((c) => c.label === config.defaultColor)?.preview)} />
              <span className="text-sm">{config.label}</span>
            </div>
            <span className="text-xs text-muted-foreground">{config.defaultColor}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground/50">
        Color customization coming soon. These are the current defaults.
      </p>
    </section>
  )
}

// ── Route icon map for settings ──

const ROUTE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Lightbulb,
  Quote,
  CheckSquare,
  FileText,
}

const ROUTE_ICON_OPTIONS = ['FileText', 'Lightbulb', 'Quote', 'CheckSquare']

const ROUTE_COLORS = [
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#22c55e', // green
  '#ec4899', // pink
  '#6366f1', // indigo
  '#ef4444', // red
  '#06b6d4', // cyan
]

// ── Capture Routes Section ──

function CaptureRoutesSection() {
  const [routes, setRoutes] = useState<CaptureRoute[]>([])
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Form state
  const [formPrefix, setFormPrefix] = useState('')
  const [formLabel, setFormLabel] = useState('')
  const [formTargetType, setFormTargetType] = useState<'doc' | 'task'>('doc')
  const [formColor, setFormColor] = useState(ROUTE_COLORS[0])
  const [formIcon, setFormIcon] = useState('FileText')
  const [formDocId, setFormDocId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      getCaptureRoutes(),
      getDocuments(),
    ]).then(([r, d]) => {
      setRoutes(r)
      setDocs(d)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const resetForm = () => {
    setFormPrefix('')
    setFormLabel('')
    setFormTargetType('doc')
    setFormColor(ROUTE_COLORS[0])
    setFormIcon('FileText')
    setFormDocId(null)
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (route: CaptureRoute) => {
    setEditingId(route.id)
    setFormPrefix(route.prefix)
    setFormLabel(route.label)
    setFormTargetType(route.target_type as 'doc' | 'task')
    setFormColor(route.color)
    setFormIcon(route.icon)
    setFormDocId(route.doc_id)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formPrefix.trim() || !formLabel.trim()) {
      toast.error('Prefix and label are required')
      return
    }
    if (!formPrefix.startsWith('/')) {
      toast.error('Prefix must start with /')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await updateCaptureRoute({
          id: editingId,
          prefix: formPrefix.trim(),
          targetType: formTargetType,
          docId: formDocId ?? '',
          label: formLabel.trim(),
          color: formColor,
          icon: formIcon,
        })
        setRoutes((prev) =>
          prev.map((r) =>
            r.id === editingId
              ? { ...r, prefix: formPrefix.trim(), target_type: formTargetType, doc_id: formDocId, label: formLabel.trim(), color: formColor, icon: formIcon }
              : r
          )
        )
        toast.success('Route updated')
      } else {
        const route = await createCaptureRoute({
          prefix: formPrefix.trim(),
          targetType: formTargetType,
          docId: formDocId ?? undefined,
          label: formLabel.trim(),
          color: formColor,
          icon: formIcon,
        })
        setRoutes((prev) => [...prev, route])
        toast.success('Route created')
      }
      resetForm()
    } catch (e) {
      toast.error(`Failed: ${e}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id)
      return
    }
    try {
      await deleteCaptureRoute(id)
      setRoutes((prev) => prev.filter((r) => r.id !== id))
      setDeleteConfirm(null)
      toast.success('Route deleted')
    } catch (e) {
      toast.error(`Failed: ${e}`)
    }
  }

  if (loading) {
    return (
      <section className="space-y-4">
        <SectionHeader title="Capture Routes" description="Prefix routing for quick capture to Docs or Tasks." />
        <Skeleton className="h-8" />
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Capture Routes"
        description="Type a prefix in the Inbox input to route captures to a Doc or create a Task."
      />

      {/* Route list */}
      <div className="space-y-2">
        {routes.map((route) => {
          const IconComponent = ROUTE_ICON_MAP[route.icon] ?? FileText
          const linkedDoc = docs.find((d) => d.id === route.doc_id)
          return (
            <div
              key={route.id}
              className="flex items-center gap-3 rounded-md border px-3 py-2"
            >
              <span
                className="flex size-6 items-center justify-center rounded-md"
                style={{ backgroundColor: route.color + '20', color: route.color }}
              >
                <IconComponent className="size-3.5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{route.label}</span>
                  <code className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono text-muted-foreground">
                    {route.prefix}
                  </code>
                  <span className="text-[10px] text-muted-foreground">
                    {route.target_type === 'task' ? 'Creates task' : linkedDoc ? `Doc: ${linkedDoc.title}` : 'Auto-creates doc'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => startEdit(route)}
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/20 transition-colors"
                  aria-label="Edit route"
                >
                  <Pencil className="size-3" />
                </button>
                <button
                  onClick={() => handleDelete(route.id)}
                  className="flex size-6 items-center justify-center rounded-md text-destructive/40 hover:text-destructive hover:bg-accent/20 transition-colors"
                  aria-label="Delete route"
                >
                  <Trash2 className="size-3" />
                </button>
                {deleteConfirm === route.id && (
                  <span className="text-[10px] text-destructive">Click again</span>
                )}
              </div>
            </div>
          )
        })}
        {routes.length === 0 && (
          <p className="text-sm text-muted-foreground">No capture routes configured yet.</p>
        )}
      </div>

      {/* Add/Edit form */}
      {showForm ? (
        <div className="space-y-3 rounded-md border p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Prefix</Label>
              <Input
                placeholder="/i"
                value={formPrefix}
                onChange={(e) => setFormPrefix(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Label</Label>
              <Input
                placeholder="Ideas"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Type</Label>
            <div className="flex items-center gap-1 rounded-lg border p-1">
              {(['doc', 'task'] as const).map((value) => (
                <Button
                  key={value}
                  variant={formTargetType === value ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 capitalize"
                  onClick={() => setFormTargetType(value)}
                >
                  {value === 'doc' ? 'Doc Note' : 'Task'}
                </Button>
              ))}
            </div>
          </div>

          {formTargetType === 'doc' && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Linked Doc</Label>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-accent/10 transition-colors">
                  <span className={cn(formDocId ? 'text-foreground' : 'text-muted-foreground/50')}>
                    {formDocId ? docs.find((d) => d.id === formDocId)?.title ?? 'Unknown' : 'Auto-create on first use'}
                  </span>
                  <ChevronDown className="size-3 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuItem onClick={() => setFormDocId(null)}>
                    <span className="text-muted-foreground">Auto-create on first use</span>
                  </DropdownMenuItem>
                  {docs.map((doc) => (
                    <DropdownMenuItem key={doc.id} onClick={() => setFormDocId(doc.id)}>
                      <FileText className="size-3 mr-2 text-muted-foreground/40" />
                      {doc.title || 'Untitled'}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Color</Label>
            <div className="flex items-center gap-2">
              {ROUTE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={cn(
                    'h-6 w-6 rounded-full border-2 transition-all',
                    formColor === color ? 'border-foreground scale-110' : 'border-transparent hover:border-muted-foreground/50',
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormColor(color)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Icon</Label>
            <div className="flex items-center gap-2">
              {ROUTE_ICON_OPTIONS.map((iconName) => {
                const Icon = ROUTE_ICON_MAP[iconName] ?? FileText
                return (
                  <button
                    key={iconName}
                    type="button"
                    className={cn(
                      'flex size-8 items-center justify-center rounded-md border transition-all',
                      formIcon === iconName ? 'border-foreground bg-accent' : 'border-border/30 hover:border-muted-foreground/50',
                    )}
                    onClick={() => setFormIcon(iconName)}
                  >
                    <Icon className="size-4" />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update Route' : 'Add Route'}
            </Button>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          + Add Route
        </Button>
      )}
    </section>
  )
}

// ── Sync Section ──

function SyncSection() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [tursoUrl, setTursoUrl] = useState('')
  const [tursoToken, setTursoToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  const refreshStatus = async () => {
    try {
      const newStatus = await syncGetStatus()
      setStatus(newStatus)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const [url, token, syncStatus] = await Promise.all([
          getSetting('turso_url'),
          getSetting('turso_token'),
          syncGetStatus(),
        ])
        if (url) setTursoUrl(url)
        if (token) setTursoToken(token)
        setStatus(syncStatus)
      } catch {
        // Sync table might not exist on first run before migration
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Auto-refresh pending changes every 30s
  useEffect(() => {
    const interval = setInterval(refreshStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleSaveConfig = async () => {
    if (!tursoUrl.trim() || !tursoToken.trim()) {
      setError('Both URL and token are required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await syncConfigure(tursoUrl.trim(), tursoToken.trim())
      setSaved(true)
      await refreshStatus()
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleSyncNow = async () => {
    setSyncing(true)
    setError(null)
    setSyncResult(null)
    try {
      const pushed = await syncPush()
      const pulled = await syncPull()
      await refreshStatus()
      const msg = `Pushed ${pushed}, pulled ${pulled}`
      setSyncResult(msg)
      toast.success(`Synced: ${msg}`)
      setTimeout(() => setSyncResult(null), 5000)
    } catch (e) {
      setError(String(e))
      toast.error(`Sync failed: ${e}`)
    } finally {
      setSyncing(false)
    }
  }

  const handleTestConnection = async () => {
    if (!tursoUrl.trim() || !tursoToken.trim()) {
      setError('Save Turso URL and token first')
      return
    }
    setTesting(true)
    setError(null)
    try {
      await syncTestConnection(tursoUrl.trim(), tursoToken.trim())
      toast.success('Connection successful')
    } catch (e) {
      setError(`Connection failed: ${e}`)
      toast.error(`Connection failed: ${e}`)
    } finally {
      setTesting(false)
    }
  }

  const handleInitializeRemote = async () => {
    setInitializing(true)
    setError(null)
    try {
      await syncInitializeRemote()
      await refreshStatus()
      toast.success('Remote database initialized')
    } catch (e) {
      setError(`Initialization failed: ${e}`)
      toast.error(`Initialization failed: ${e}`)
    } finally {
      setInitializing(false)
    }
  }

  if (loading) {
    return (
      <section className="space-y-4">
        <SectionHeader title="Sync" description="Multi-device sync via Turso." />
        <Skeleton className="h-8" />
      </section>
    )
  }

  const isConfigured = status?.turso_configured ?? false
  const isInitialized = status?.remote_initialized ?? false

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Sync"
        description="Sync data across devices using Turso (hosted SQLite). Single-user, last-write-wins."
      />

      {/* Connection status badge */}
      <div className="flex items-center gap-2">
        <span className={cn(
          'size-2 rounded-full',
          isConfigured && isInitialized ? 'bg-green-500' : isConfigured ? 'bg-amber-500' : 'bg-muted-foreground/30',
        )} />
        <span className="text-sm text-muted-foreground">
          {isConfigured && isInitialized ? 'Connected' : isConfigured ? 'Configured — needs initialization' : 'Not configured'}
        </span>
      </div>

      {/* Device ID + stats */}
      {status && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Device ID</span>
            <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
              {status.device_id.slice(0, 8)}...
            </code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Pending changes</span>
            <span className={cn('text-sm font-mono', status.pending_changes > 0 && 'text-amber-500')}>
              {status.pending_changes}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Last synced</span>
            <span className="text-sm font-mono">
              {status.last_sync ?? 'Never'}
            </span>
          </div>
        </div>
      )}

      {/* Turso config */}
      <div className="space-y-3 rounded-md border p-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Turso URL</Label>
          <Input
            placeholder="libsql://your-db-name.turso.io"
            value={tursoUrl}
            onChange={(e) => { setTursoUrl(e.target.value); setSaved(false) }}
          />
          <p className="text-xs text-muted-foreground">
            Your Turso database HTTP URL (starts with libsql:// or https://)
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Auth Token</Label>
          <Input
            type="password"
            placeholder="eyJ..."
            value={tursoToken}
            onChange={(e) => { setTursoToken(e.target.value); setSaved(false) }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveConfig}
            disabled={saving}
          >
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing || !tursoUrl.trim() || !tursoToken.trim()}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
        </div>
      </div>

      {/* Initialize Remote Database — only shown when configured but not initialized */}
      {isConfigured && !isInitialized && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            Remote database needs to be initialized with the app schema before syncing.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleInitializeRemote}
            disabled={initializing}
          >
            {initializing ? 'Initializing...' : 'Initialize Remote Database'}
          </Button>
        </div>
      )}

      {/* Sync actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSyncNow}
          disabled={syncing || !isConfigured || !isInitialized}
        >
          {syncing ? 'Syncing...' : 'Sync Now'}
        </Button>
        {syncResult && (
          <span className="text-xs text-muted-foreground">{syncResult}</span>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </section>
  )
}

// ── Main Page ──

export function SettingsPage() {
  const { theme, setTheme, accent, setAccent } = useTheme()
  const setSetupComplete = useAppStore((s) => s.setSetupComplete)
  const [fields, setFields] = useState<Record<string, FieldState>>(() => {
    const initial: Record<string, FieldState> = {}
    for (const f of ALL_FIELDS) {
      initial[f.key] = { value: '', saving: false, saved: false, error: null }
    }
    return initial
  })
  const [resetting, setResetting] = useState(false)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const [checking, setChecking] = useState(false)

  // Load current values on mount
  useEffect(() => {
    async function load() {
      for (const field of ALL_FIELDS) {
        try {
          const val = await getSetting(field.key)
          if (val !== null) {
            setFields((prev) => ({
              ...prev,
              [field.key]: { ...prev[field.key], value: val },
            }))
          }
        } catch {
          // Setting not found — leave empty
        }
      }
    }
    load()
  }, [])

  const updateFieldValue = useCallback((key: string, value: string) => {
    setFields((prev) => ({
      ...prev,
      [key]: { ...prev[key], value, saved: false, error: null },
    }))
  }, [])

  const saveField = useCallback(async (key: string) => {
    setFields((prev) => ({
      ...prev,
      [key]: { ...prev[key], saving: true, error: null },
    }))

    try {
      const value = fields[key]?.value?.trim()
      if (!value) {
        setFields((prev) => ({
          ...prev,
          [key]: { ...prev[key], saving: false, error: 'Value cannot be empty' },
        }))
        return
      }
      await setSetting(key, value)
      setFields((prev) => ({
        ...prev,
        [key]: { ...prev[key], saving: false, saved: true },
      }))
      // Clear the "Saved" after 2 seconds
      setTimeout(() => {
        setFields((prev) => ({
          ...prev,
          [key]: { ...prev[key], saved: false },
        }))
      }, 2000)
    } catch (e) {
      setFields((prev) => ({
        ...prev,
        [key]: { ...prev[key], saving: false, error: String(e) },
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields])

  const handleReset = useCallback(async () => {
    if (!resetConfirm) {
      setResetConfirm(true)
      return
    }

    setResetting(true)
    try {
      await clearAllSettings()
      setSetupComplete(false)
    } catch (e) {
      console.error('Failed to reset settings:', e)
    } finally {
      setResetting(false)
      setResetConfirm(false)
    }
  }, [resetConfirm, setSetupComplete])

  const handleCheckForUpdates = useCallback(async () => {
    setChecking(true)
    setUpdateStatus(null)
    try {
      const status = await checkForUpdates()
      setUpdateStatus(status)
    } catch (e) {
      setUpdateStatus({
        current_version: '0.1.0',
        latest_version: null,
        update_available: false,
        release_url: null,
        error: String(e),
      })
    } finally {
      setChecking(false)
    }
  }, [])

  return (
    <div className="mx-auto max-w-xl space-y-8">
      {/* Appearance */}
      <section className="space-y-4">
        <SectionHeader
          title="Appearance"
          description="Choose how Daily Triage looks on your machine."
        />

        {/* Mode selector */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Mode</Label>
          <div className="flex items-center gap-1 rounded-lg border p-1">
            {(['light', 'dark', 'system'] as const).map((value) => (
              <Button
                key={value}
                variant={theme === value ? 'default' : 'outline'}
                size="sm"
                className="flex-1 capitalize"
                onClick={() => setTheme(value)}
              >
                {value}
              </Button>
            ))}
          </div>
        </div>

        {/* Accent theme selector */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Accent</Label>
          <div className="flex items-center gap-2">
            {ACCENT_THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={cn(
                  'group relative flex size-8 items-center justify-center rounded-full border-2 transition-all',
                  accent === t.value
                    ? 'border-foreground scale-110'
                    : 'border-transparent hover:border-muted-foreground/50',
                )}
                style={{ backgroundColor: t.swatch }}
                onClick={() => setAccent(t.value)}
                title={t.label}
              >
                {accent === t.value && (
                  <svg className="size-3.5 text-white drop-shadow-sm" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/50">
            {ACCENT_THEMES.find((t) => t.value === accent)?.label ?? 'Warm'} theme
          </p>
        </div>

        {/* Font preview */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Typography</Label>
          <div className="rounded-lg border p-3 space-y-1">
            <p className="font-heading text-base font-semibold tracking-tight">Plus Jakarta Sans for headings</p>
            <p className="text-sm">Inter for body text and UI labels</p>
            <p className="text-xs font-mono text-muted-foreground">Geist Mono for code</p>
          </div>
        </div>
      </section>

      <Separator />

      {/* Integrations */}
      <section className="space-y-4">
        <SectionHeader
          title="Integrations"
          description="API tokens and URLs for connected services. Stored locally on your machine."
        />
        <div className="space-y-5">
          {INTEGRATIONS_FIELDS.map((field) => (
            <SettingFieldRow
              key={field.key}
              field={field}
              state={fields[field.key]}
              onChange={(v) => updateFieldValue(field.key, v)}
              onSave={() => saveField(field.key)}
            />
          ))}
        </div>
      </section>

      <Separator />

      {/* Focus Mode */}
      <section className="space-y-4">
        <SectionHeader
          title="Focus Mode"
          description="Configure Pomodoro and focus session behavior."
        />
        <div className="space-y-5">
          {FOCUS_FIELDS.map((field) => (
            <SettingFieldRow
              key={field.key}
              field={field}
              state={fields[field.key]}
              onChange={(v) => updateFieldValue(field.key, v)}
              onSave={() => saveField(field.key)}
            />
          ))}
        </div>
      </section>

      <Separator />

      {/* Status Colors */}
      <StatusColorsSection />

      <Separator />

      {/* Capture Routes */}
      <CaptureRoutesSection />

      <Separator />

      {/* Calendars */}
      <CalendarsSection />

      <Separator />

      {/* Sync */}
      <SyncSection />

      <Separator />

      {/* Obsidian */}
      <section className="space-y-4">
        <SectionHeader
          title="Obsidian"
          description="Path to your Obsidian vault for Today.md and session logs."
        />
        <div className="space-y-5">
          {OBSIDIAN_FIELDS.map((field) => (
            <SettingFieldRow
              key={field.key}
              field={field}
              state={fields[field.key]}
              onChange={(v) => updateFieldValue(field.key, v)}
              onSave={() => saveField(field.key)}
            />
          ))}
        </div>
      </section>

      <Separator />

      {/* About */}
      <section className="space-y-4">
        <SectionHeader title="About" />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Version</span>
            <span className="text-sm font-mono">
              {updateStatus?.current_version ?? '0.1.0'}
            </span>
          </div>

          {/* Update check */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckForUpdates}
              disabled={checking}
            >
              {checking ? 'Checking...' : 'Check for Updates'}
            </Button>
            {updateStatus && !updateStatus.error && !updateStatus.update_available && (
              <p className="text-xs text-muted-foreground">
                You're up to date (v{updateStatus.current_version})
              </p>
            )}
            {updateStatus?.update_available && (
              <p className="text-xs text-foreground">
                Update available: v{updateStatus.latest_version}
                {updateStatus.release_url && (
                  <>
                    {' — '}
                    <button
                      type="button"
                      className="underline text-primary hover:text-primary/80 transition-colors"
                      onClick={() => openUrl(updateStatus.release_url!)}
                    >
                      Download
                    </button>
                  </>
                )}
              </p>
            )}
            {updateStatus?.error && (
              <p className="text-xs text-destructive">{updateStatus.error}</p>
            )}
          </div>

          <Separator />
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Clear all saved settings and return to the setup screen.
            </p>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={resetting}
            >
              {resetting
                ? 'Resetting...'
                : resetConfirm
                  ? 'Are you sure? Click again to confirm'
                  : 'Reset all settings'}
            </Button>
            {resetConfirm && !resetting && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setResetConfirm(false)}
                className="ml-2"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
