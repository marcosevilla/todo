import { useCallback, useEffect, useState } from 'react'
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
} from '@/services/tauri'
import type { UpdateStatus, CalendarFeed } from '@/services/tauri'
import { openUrl } from '@/services/tauri'
import { useAppStore } from '@/stores/appStore'
import { useTheme } from '@/hooks/useTheme'

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

const ALL_FIELDS = [...INTEGRATIONS_FIELDS, ...OBSIDIAN_FIELDS]

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
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

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

// ── Main Page ──

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
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

      {/* Calendars */}
      <CalendarsSection />

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
