import { useState, useCallback, useEffect, useRef } from 'react'
import { useDocsStore } from '@/stores/docsStore'
import { updateDocument, getDocNotes, createDocNote, deleteDocNote } from '@/services/tauri'
import { TiptapEditor } from './TiptapEditor'
import { DocNoteEntry } from './DocNoteEntry'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { DocNote } from '@/services/tauri'

export function DocEditor() {
  const currentDoc = useDocsStore((s) => s.currentDoc)
  const folders = useDocsStore((s) => s.folders)
  const refresh = useDocsStore((s) => s.refresh)

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState<DocNote[]>([])
  const [noteInput, setNoteInput] = useState('')
  const [noteInputVisible, setNoteInputVisible] = useState(false)

  // Sync title when doc changes
  useEffect(() => {
    setTitle(currentDoc?.title ?? '')
  }, [currentDoc?.id, currentDoc?.title])

  // Load notes
  useEffect(() => {
    if (currentDoc?.id) {
      getDocNotes(currentDoc.id).then(setNotes).catch(() => setNotes([]))
    } else {
      setNotes([])
    }
  }, [currentDoc?.id])

  const handleTitleBlur = useCallback(async () => {
    if (!currentDoc || title.trim() === currentDoc.title) return
    const newTitle = title.trim() || 'Untitled'
    try {
      await updateDocument(currentDoc.id, newTitle)
      refresh()
    } catch (e) {
      toast.error(`Failed to save title: ${e}`)
    }
  }, [currentDoc, title, refresh])

  const lastSavedContent = useRef(currentDoc?.content ?? '')
  const handleContentChange = useCallback(async (html: string) => {
    if (!currentDoc) return
    if (html === lastSavedContent.current) return
    lastSavedContent.current = html
    try {
      await updateDocument(currentDoc.id, undefined, html)
    } catch {
      // Silent — auto-save shouldn't show errors for every keystroke
    }
  }, [currentDoc])

  const handleAddNote = useCallback(async () => {
    if (!currentDoc || !noteInput.trim()) return
    try {
      const note = await createDocNote(currentDoc.id, noteInput.trim())
      setNotes((prev) => [...prev, note])
      setNoteInput('')
      setNoteInputVisible(false)
    } catch (e) {
      toast.error(`Failed to add note: ${e}`)
    }
  }, [currentDoc, noteInput])

  const handleDeleteNote = useCallback(async (id: string) => {
    try {
      await deleteDocNote(id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
    } catch (e) {
      toast.error(`Failed to delete note: ${e}`)
    }
  }, [])

  if (!currentDoc) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground/40">
        <p className="text-sm">Select a document to start editing</p>
      </div>
    )
  }

  const folder = folders.find((f) => f.id === currentDoc.folder_id)

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl p-6 space-y-4">
        {/* Folder badge */}
        {folder && (
          <span className="text-xs text-muted-foreground/50">{folder.name}</span>
        )}

        {/* Title */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          placeholder="Untitled"
          className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/30"
        />

        {/* Editor */}
        <TiptapEditor
          content={currentDoc.content}
          onChange={handleContentChange}
          placeholder="Start writing..."
        />

        {/* Separator */}
        <div className="border-t border-border/20 pt-4" />

        {/* Notes section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/50">
              Notes
            </h3>
            <button
              onClick={() => setNoteInputVisible(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              <Plus className="size-3" />
              Add
            </button>
          </div>

          {notes.length > 0 && (
            <div className="space-y-0.5">
              {notes.map((note) => (
                <DocNoteEntry key={note.id} note={note} onDelete={handleDeleteNote} />
              ))}
            </div>
          )}

          {noteInputVisible && (
            <div className="flex items-center gap-2">
              <input
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleAddNote() }
                  if (e.key === 'Escape') { setNoteInputVisible(false); setNoteInput('') }
                }}
                placeholder="Add a note..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40 border-b border-border/20 py-1"
                autoFocus
              />
            </div>
          )}

          {!noteInputVisible && notes.length === 0 && (
            <p
              onClick={() => setNoteInputVisible(true)}
              className="text-sm text-muted-foreground/30 cursor-text hover:text-muted-foreground/50 transition-colors"
            >
              Add a note...
            </p>
          )}
        </div>

        {/* Metadata */}
        <div className="text-[10px] text-muted-foreground/30 space-y-0.5 pt-4">
          <p>Created {new Date(currentDoc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          <p>Updated {new Date(currentDoc.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
        </div>
      </div>
    </div>
  )
}
