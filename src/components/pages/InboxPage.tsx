import { useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { CapturesPanel } from '@/components/obsidian/CapturesPanel'
import { CollapsibleSection } from '@/components/shared/CollapsibleSection'
import { Lightbulb } from 'lucide-react'

export function InboxPage() {
  const captureRequested = useAppStore((s) => s.captureRequested)
  const setCaptureRequested = useAppStore((s) => s.setCaptureRequested)

  // Clear the flag after consuming it
  useEffect(() => {
    if (captureRequested) {
      // Small delay to let CapturesPanel mount and read the prop
      const timer = setTimeout(() => setCaptureRequested(false), 100)
      return () => clearTimeout(timer)
    }
  }, [captureRequested, setCaptureRequested])

  return (
    <div className="space-y-4">
      <CollapsibleSection
        title="Quick Captures"
        icon={<Lightbulb size={14} className="text-muted-foreground" />}
        defaultOpen={true}
      >
        <CapturesPanel autoFocus={captureRequested} />
      </CollapsibleSection>
    </div>
  )
}
