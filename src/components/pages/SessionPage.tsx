import { useCallback, useEffect, useState } from 'react'
import { readSessionLog } from '@/services/tauri'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface SessionEntry {
  timeRange: string
  title: string
  tags: string[]
  bullets: string[]
  energy: string | null
  refs: string | null
}

/** Parse the session log markdown into structured entries */
function parseSessionLog(content: string): SessionEntry[] {
  const entries: SessionEntry[] = []
  const blocks = content.split(/\n---\n/).filter((b) => b.trim())

  for (const block of blocks) {
    const lines = block.trim().split('\n')

    // Find the ## heading line
    const headingIdx = lines.findIndex((l) => l.startsWith('## '))
    if (headingIdx === -1) continue

    const heading = lines[headingIdx].replace('## ', '')
    // Parse "3:00 PM – 1:02 AM — Title"
    const dashMatch = heading.match(/^(.+?)\s*[—–-]\s*(.+)$/)
    const timeRange = dashMatch ? dashMatch[1].trim() : ''
    const title = dashMatch ? dashMatch[2].trim() : heading.trim()

    // Parse tags (lines with backtick-wrapped tags)
    const tagLine = lines.find((l) => l.includes('`#'))
    const tags = tagLine
      ? [...tagLine.matchAll(/`#([^`]+)`/g)].map((m) => m[1])
      : []

    // Parse bullet points
    const bullets = lines
      .filter((l) => l.startsWith('- '))
      .map((l) => l.replace(/^- /, ''))

    // Parse energy callout
    const energyLine = lines.find((l) => l.includes('[!energy]'))
    const energy = energyLine
      ? energyLine.replace(/.*\[!energy\]\s*/, '').replace('Energy: ', '')
      : null

    // Parse refs line
    const refsLine = lines.find((l) => l.startsWith('Refs:'))
    const refs = refsLine || null

    if (title || bullets.length > 0) {
      entries.push({ timeRange, title, tags, bullets, energy, refs })
    }
  }

  return entries
}

function SessionCard({ entry }: { entry: SessionEntry }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="rounded-lg border bg-card p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 text-left"
      >
        <span
          className={cn(
            'mt-1 text-[10px] text-muted-foreground transition-transform',
            expanded && 'rotate-90',
          )}
        >
          ▶
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium leading-snug">{entry.title}</h3>
          {entry.timeRange && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {entry.timeRange}
            </p>
          )}
        </div>
        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 shrink-0">
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-accent/50 px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </button>

      {expanded && entry.bullets.length > 0 && (
        <div className="ml-6 mt-3 space-y-1.5">
          {entry.bullets.map((bullet, i) => (
            <p key={i} className="text-xs text-foreground/80 leading-relaxed">
              • {bullet}
            </p>
          ))}
          {entry.energy && (
            <p className="mt-2 text-[11px] text-muted-foreground italic">
              ⚡ {entry.energy}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function SessionPage() {
  const [entries, setEntries] = useState<SessionEntry[]>([])
  const [raw, setRaw] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const content = await readSessionLog()
      setRaw(content)
      if (content) {
        setEntries(parseSessionLog(content))
      } else {
        setEntries([])
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Could not load session log: {error}
      </p>
    )
  }

  if (!raw) {
    return (
      <p className="text-sm text-muted-foreground">
        No sessions yet today. They'll appear here as you work.
      </p>
    )
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Session log exists but no entries parsed yet.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2 pb-1">
        <h2 className="text-sm font-medium">Today's Sessions</h2>
        <span className="text-xs text-muted-foreground">
          {entries.length} session{entries.length !== 1 ? 's' : ''}
        </span>
      </div>
      {entries.map((entry, i) => (
        <SessionCard key={i} entry={entry} />
      ))}
    </div>
  )
}
