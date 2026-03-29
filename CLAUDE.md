# Daily Triage

A personal daily triage and briefing macOS app built with Tauri 2.0.

## Tech Stack
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui (base-nova style)
- **Backend:** Rust (Tauri 2.0)
- **Database:** SQLite via sqlx (not tauri-plugin-sql)
- **State:** Zustand
- **AI:** Claude Haiku via Anthropic API (priorities generation)

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
- `src/components/pages/` — Top-level page components (Today, Tasks, Inbox, Session, Settings)
- `src/components/tasks/` — TaskItem, LocalTaskRow, TaskEditor, QuickCreateDialog
- `src/components/priorities/` — PrioritiesSection (energy selector + display)
- `src/components/{calendar,todoist,obsidian}/` — Feature components
- `src/components/shared/` — CollapsibleSection, CommandPalette, ShortcutOverlay, etc.
- `docs/buildplan.md` — Feature prioritization and build plan
- `docs/roadmap.md` — Original roadmap (partially superseded by buildplan)

## Architecture Rules
- All API calls happen in Rust, never in the React frontend (CORS + security)
- All file system access happens in Rust via tauri-plugin-fs
- All URL opening happens via the custom `open_url` Rust command (not shell plugin)
- Frontend communicates with backend via `invoke()` Tauri commands
- Zustand is the frontend's single source of truth
- Components read from Zustand, not from Tauri commands directly
- Hooks bridge between Tauri commands and Zustand

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
- Current version: **3** (initial schema + multi-calendar feeds + native tasks/projects)
- `schema_version` table tracks what's been applied

## Key Tables
- `settings` — key-value config store
- `projects` — native project labels (id, name, color, position). Default: Inbox
- `local_tasks` — native tasks with subtask support (parent_id), priority, due dates, descriptions
- `todoist_tasks` — cached Todoist tasks
- `calendar_events` / `calendar_feeds` — cached calendar data
- `daily_state` — per-day energy level + cached AI priorities
- `progress_snapshots` — save progress snapshots
- `action_log` — offline action queue

## Style Guide
- Use shadcn/ui components as base, customize with Tailwind
- Path alias: `@/` maps to `src/`
- Import shadcn components from `@/components/ui/`
- Import utils from `@/lib/utils`
- Use `cn()` for all conditional class merging (never template literals)
- Use `openUrl()` from `@/services/tauri` for all URL opening (never shell plugin `open()`)

## Anti-Patterns
- Don't make HTTP calls from the frontend — use Rust commands
- Don't access SQLite from the frontend — use Rust commands
- Don't use loading spinners — use skeleton placeholders matching content shape
- Don't show "overdue" labels — use neutral "still open" framing
- Don't add guilt-inducing UI (streaks, "you've been away" messages)

## Current State

- **Last session:** 2026-03-29 (massive build + refactor session)
- **What exists:**
  - Guided Today page: first-open-of-day review flow (calendar glance → energy selector → AI priorities → triage) that transitions to dashboard mode after completion
  - Native task system: projects (create/delete), tasks with subtasks, priority, due dates, descriptions, inline editing
  - Quick Capture from 3 entry points: Inbox page input, Cmd+K, tray menu
  - AI Priorities via Claude Haiku: energy-based top 3 with reasoning, cached per day in daily_state
  - Linear-style unified TaskItem component for both native and Todoist tasks
  - Q shortcut → quick-create task dialog (title, description, project, priority, due date)
  - Todoist integration (fetch, complete, snooze, 7-day filter, cache-first) in its own collapsed section
  - Google Calendar multi-feed with color coding
  - Obsidian integration (today.md, habits, quick captures, session logs)
  - shadcn/ui components: command (cmdk), collapsible, sonner (toasts), tooltip, skeleton, dialog, etc.
  - System tray, Cmd+Shift+T global hotkey, auto-launch, dark/light/system theme
  - Cmd+K command palette with capture integration
  - Keyboard shortcuts (j/k/x/s task nav, 1-4 page nav, Q quick create, ? shortcut overlay)
  - Page transition animations, completion micro-celebrations
  - Context-aware right sidebar (hidden on Settings/Session)
- **Known gaps:** Project rename UI not surfaced. No native notifications. No .dmg distribution. No drag-to-reorder.
- **Next up:** See `docs/buildplan.md` for remaining features (notifications, .dmg, daily review polish)
