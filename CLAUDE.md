# Daily Triage

A personal daily triage and briefing macOS app built with Tauri 2.0.

## Tech Stack
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui (base-nova style)
- **Backend:** Rust (Tauri 2.0)
- **Database:** SQLite via sqlx (not tauri-plugin-sql)
- **State:** Zustand (appStore, focusStore, detailStore)
- **AI:** Claude Haiku via Anthropic API (priorities generation, task breakdown)

## Commands
- `npm run dev` — Start Vite dev server only (frontend)
- `npm run tauri dev` — Start full Tauri app (frontend + Rust backend)
- `npm run build` — Build frontend for production
- `npm run tauri build` — Build distributable .app
- **No test suite yet** — no unit or integration tests

## Project Structure
- `src/` — React frontend (components, hooks, stores, services)
- `src-tauri/` — Rust backend (commands, db, parsers)
- `src/components/ui/` — shadcn/ui primitives (auto-generated, don't edit manually)
- `src/components/layout/` — Dashboard, NavSidebar, RightSidebar
- `src/components/pages/` — Top-level page components (Today, Tasks, Inbox, Activity, Settings)
- `src/components/tasks/` — TaskItem, LocalTaskRow, TaskEditor, QuickCreateDialog, StatusDropdown, InboxTaskItem
- `src/components/focus/` — FocusView, FocusBanner, FocusCelebration, FocusPlayMenu, FocusResumeDialog
- `src/components/detail/` — TaskDetailPage, CaptureDetailPage, DetailSidebar, DetailBreadcrumbs, InlineTitle, InlineDescription, TaskActionBar, TaskActivityLog
- `src/components/activity/` — ActivityTimeline
- `src/components/shared/` — CommandBar, CommandBarResults, HelpPanel, CollapsibleSection
- `src/components/priorities/` — PrioritiesSection (energy selector + display)
- `src/components/{calendar,todoist,obsidian}/` — Feature components
- `src/stores/` — appStore.ts, focusStore.ts, detailStore.ts
- `src/hooks/` — useLocalTasks, useFocusTimer, useFocusQueue, useTaskDetail, useCalendar, useObsidian, etc.
- `src/lib/` — utils.ts, sound.ts, taskToast.ts
- `docs/buildplan.md` — Feature prioritization and build plan

## Architecture Rules
- All API calls happen in Rust, never in the React frontend (CORS + security)
- All file system access happens in Rust via tauri-plugin-fs
- All URL opening happens via the custom `open_url` Rust command (not shell plugin)
- Frontend communicates with backend via `invoke()` Tauri commands
- Zustand stores for global state (app, focus, detail). Local state for ephemeral UI.
- `emitTasksChanged()` event bus to sync all `useLocalTasks` instances after mutations
- Activity logging via `crate::db::activity::log_activity()` — fire-and-forget, never fails user-facing commands

## Adding a Rust Command
1. Create or edit the file in `src-tauri/src/commands/` (one file per domain)
2. Export the module in `src-tauri/src/commands/mod.rs`
3. Import it in `src-tauri/src/lib.rs` (`use commands::{..., your_module}`)
4. Register each `#[tauri::command]` function in the `invoke_handler![]` macro in `lib.rs`
5. Add the TypeScript wrapper in `src/services/tauri.ts`

## Database Migrations
- SQLite managed via sqlx (raw queries, no ORM)
- Versioned migration system in `src-tauri/src/db/migrations.rs`
- Each migration has a version number, description, and SQL string
- Migrations run automatically on app startup — append new ones to the `MIGRATIONS` array
- Current version: **10** (initial schema → calendar feeds → tasks/projects → activity log → focus state → captures → task status → docs → capture routes)
- `schema_version` table tracks what's been applied

## Key Tables
- `settings` — key-value config store
- `projects` — native project labels (id, name, color, position). Default: Inbox
- `local_tasks` — native tasks with subtask support (parent_id), priority, due dates, descriptions, status workflow
- `captures` — native captures (migrated from Obsidian Quick Captures.md)
- `activity_log` — timestamped activity events (action_type, target_id, metadata JSON)
- `capture_routes` — user-configurable prefix routing for captures (prefix, target_type, doc_id, label, color, icon)
- `daily_state` — per-day energy level, cached AI priorities, focus session state
- `todoist_tasks` — cached Todoist tasks
- `calendar_events` / `calendar_feeds` — cached calendar data

## Task Status Workflow
- Statuses: `backlog` → `todo` → `in_progress` → `blocked` → `complete`
- Default for new tasks: `todo`
- Focus mode auto-sets `in_progress` on start, `complete` on finish
- Blocked status prompts for reason (logged to activity)
- Status changes logged as `status_changed` activity events

## Style Guide
- Use shadcn/ui components as base, customize with Tailwind
- Path alias: `@/` maps to `src/`
- Import shadcn components from `@/components/ui/`
- Import utils from `@/lib/utils`
- Use `cn()` for all conditional class merging (never template literals)
- Use `openUrl()` from `@/services/tauri` for all URL opening (never shell plugin `open()`)
- Use `taskToast()` from `@/lib/taskToast` for task-related toasts (includes "View" link)

## Anti-Patterns
- Don't make HTTP calls from the frontend — use Rust commands
- Don't access SQLite from the frontend — use Rust commands
- Don't use loading spinners — use skeleton placeholders matching content shape
- Don't show "overdue" labels — use neutral "still open" framing
- Don't add guilt-inducing UI (streaks, "you've been away" messages)
- Don't use `<button>` inside `<TooltipTrigger>` — causes nested button crash in Tauri webview

## Current State

- **Last session:** 2026-03-29 (14-hour marathon — 3 pillars, detail pages, status system, docs page, brief display)
- **Completed this session (part 3, 12:30 PM – 2:35 PM):**
  - A1: Daily Brief Display with date browsing (BriefDisplay + DateStrip components)
  - Phase F: Docs Page with Tiptap rich text editor, folder tree, doc notes
  - Command bar `/doc` search for documents
  - Inbox "Move to Doc" action with folder/doc picker
  - Task ↔ Doc linking (linked_doc_id field, picker on task detail, clickable link)
  - Tiptap `@` mentions in docs AND task descriptions (searches both tasks + docs)
  - Task descriptions upgraded to rich text (Tiptap replaces plain textarea)
  - Code + UI/UX audit agents ran (findings saved to memory/project_cleanup_backlog.md)
  - Brief v2 roadmap ideas saved (8 items: time-blocking, habit streaks, meeting prep, etc.)
  - Mood tracker added to roadmap (replaces energy tracker)
  - Nav sidebar icon quality + contrast fixes
  - Fixed auto-save loop bug (description saves causing activity log spam)
- **Known issues:** Dead code to clean up (see cleanup backlog). Tiptap duplicate link extension warning. `useSave` hook still dead code.
- **Next up:** Phase B (evening loop), Phase C (goals), code cleanup from audit, UI/UX fixes from audit. See HelpPanel roadmap tab + memory/project_cleanup_backlog.md.
