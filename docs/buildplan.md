# Daily Triage — Build Plan

## Current State Assessment

### What's working well
- **Solid architecture.** Clean separation: Rust handles all API/FS calls, frontend is purely presentational via `invoke()`, Zustand as single source of truth. This pattern is consistent and easy to extend.
- **Read + triage loop.** Todoist tasks (fetch, complete, snooze, urgency grouping), Google Calendar (multi-feed, color-coded), Obsidian (today.md checkboxes, habits, captures, session logs) all work reliably with cache-first loading.
- **Keyboard-first UX.** j/k/x/s task navigation, Cmd+K command palette (now shadcn cmdk), 1-4 page switching, Shift+? overlay. Feels intentional.
- **System-level integration.** Tray icon, global hotkey (Cmd+Shift+T), auto-launch, window state persistence. It behaves like a real macOS app.
- **Design foundation.** OKLCH tokens, Geist font, warm palette, dark/light/system themes, shadcn base-nova components. The vocabulary is there.

### What's rough
- **Read-only.** You can triage and check off, but you can't create anything from within the app. No quick capture input, no Todoist task creation. This is the single biggest gap — without write capability, you always need another app open.
- **AI Priorities is phantom.** `priorities.rs` is fully implemented (prompt, Anthropic API call, caching to daily_state) but not exported, not registered, and has no UI. The hero feature doesn't exist yet.
- **Today page lacks a focal point.** The greeting hero we added helps, but there's no energy selector or AI priorities display to make it the "start here" moment.
- **Tray Quick Capture is a lie.** Clicking "Quick Capture..." in the tray just navigates to the Inbox page. There's no input field anywhere.
- **Session page is display-only.** Shows past session logs but has no connection to a "daily review" flow.
- **Progress snapshots are write-only.** `save_progress` writes to SQLite + Obsidian but the data is never surfaced back to the user.

### What's missing entirely
- Task/note creation from within the app
- AI-powered priorities display
- Daily review guided flow
- Native notifications
- Distributable .dmg build

---

## Prioritized Feature Chunks

### Chunk 1: Quick Capture (highest leverage)
**Why first:** Without write capability, the app is a dashboard you glance at. With quick capture, it becomes the thing you reach for all day. This is the lowest-friction entry point.

**What to build:**
1. **Rust backend:** New command `write_quick_capture(content: String)` in `obsidian.rs` — appends a timestamped entry to `{vault}/inbox/Quick Captures.md` using the existing format (timestamp + content + `---` separator)
2. **Inbox page input:** Add a text input at the top of CapturesPanel. On Enter, calls the new command and prepends the capture to the displayed list. Auto-focus on page load. Clear after submit.
3. **Command palette capture:** In Cmd+K, if the query doesn't match a command and user presses Enter, treat it as a quick capture. Show a "Captured: {text}" toast via sonner.
4. **Tray capture:** Emit the `open-quick-capture` event to navigate to Inbox AND auto-focus the input field.

**Done looks like:** You can type a note from 3 entry points (Inbox input, Cmd+K, tray menu) and it appears in Obsidian's Quick Captures.md within 200ms. The capture list updates immediately without a refresh.

---

### Chunk 2: AI Priorities
**Why second:** This is the hero feature — the reason to open the app every morning. The backend is done; this is purely wiring + UI.

**What to build:**
1. **Wire the backend:** Export `priorities` in `commands/mod.rs`, import in `lib.rs`, register `generate_priorities` in `invoke_handler![]`
2. **Frontend invoke wrapper:** Add `generatePriorities(energyLevel, calendarSummary, tasksSummary, obsidianSummary)` to `tauri.ts`
3. **Energy selector:** Three-button toggle on the Today page hero section (Low / Medium / High). Selecting one triggers priority generation. Persist selection to `daily_state.energy_level` via settings.
4. **Priorities display:** A `PrioritiesCard` component below the hero — shows 3 priorities with title, source badge, and reasoning. Subtle entrance animation. Loading state while Claude responds.
5. **Auto-trigger:** On first open of Today page each day, if no priorities cached in `daily_state`, prompt user to select energy level. If already cached, display immediately.
6. **Summary builders:** Build the `calendarSummary`, `tasksSummary`, and `obsidianSummary` strings from Zustand state on the frontend before invoking.

**Done looks like:** User opens app → sees greeting + date → taps energy level → 2-3 second loading → 3 clear priorities appear with reasoning. Cached for the day. Regenerate button available.

---

### Chunk 3: Todoist Task Creation
**Why third:** Completes the write loop. With quick capture + task creation, the app is self-sufficient.

**What to build:**
1. **Rust backend:** New command `create_todoist_task(content: String)` in `todoist.rs` — POST to Todoist API, creates task in Inbox project, returns the created task.
2. **Frontend invoke wrapper:** Add `createTodoistTask(content)` to `tauri.ts`
3. **Command palette integration:** Add a "Create task: {query}" command item that appears when typing in Cmd+K. On select, creates the task and shows a success toast.
4. **Quick capture integration:** If the capture input text starts with `/task ` or similar prefix, create a Todoist task instead of an Obsidian capture.

**Done looks like:** Cmd+K → type "Buy groceries" → see "Create task: Buy groceries" option → Enter → task created in Todoist Inbox → success toast. Also works from the capture input with `/task` prefix.

---

### Chunk 4: Daily Review Mode
**Why here:** With capture + priorities + task creation working, this ties the whole experience together into a guided morning flow.

**What to build:**
1. **Review flow component:** A multi-step overlay/dialog triggered from command palette ("Start daily review") or a button on Today page.
2. **Steps:**
   - Step 1: "Here's your day" — show calendar summary + task count
   - Step 2: "How's your energy?" — energy selector (reuses the one from priorities)
   - Step 3: AI generates priorities (reuses Chunk 2)
   - Step 4: "Quick triage" — show overdue/high-priority items, swipe to complete/snooze/defer
   - Step 5: "Ready to go" — summary of what was triaged + priorities set
3. **Auto-trigger option:** Setting to show daily review on first open each day.

**Done looks like:** A smooth 30-second guided flow that walks you from "just woke up" to "I know what to do today." Each step has clear progress and a single action.

---

### Chunk 5: Polish & Small Wins
**Ongoing — tackle between features or as a final pass.**

- **Dead code cleanup:** Remove unused `Panel` component (`src/components/layout/Panel.tsx`), old Toast.tsx is already deleted. Check for unused Rust structs (5 warnings in models.rs).
- **Transition polish:** Add entrance animations to page content on navigation. Smooth the collapsible section open/close.
- **Loading states:** The skeleton placeholders are in but could be more specific (match actual content shapes instead of generic rectangles).
- **Error handling:** CapturesPanel and CalendarPanel could show retry buttons on error, not just error text.
- **Progress display:** Surface saved progress snapshots somewhere (Session page? Today page summary?).

---

## Execution Order

| Order | Chunk | Est. Effort | Key Files |
|-------|-------|------------|-----------|
| 1 | Quick Capture | ~1.5h | obsidian.rs, CapturesPanel.tsx, CommandPalette.tsx, tauri.ts |
| 2 | AI Priorities | ~2h | priorities.rs, mod.rs, lib.rs, TodayPage.tsx, tauri.ts |
| 3 | Todoist Creation | ~1h | todoist.rs, CommandPalette.tsx, tauri.ts |
| 4 | Daily Review | ~2-3h | New ReviewFlow component, Dashboard.tsx |
| 5 | Polish | Ongoing | Various |

Each chunk gets a commit on completion. Test every interaction before moving on.
