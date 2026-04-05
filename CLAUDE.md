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
- Current version: **13** (initial schema → calendar feeds → tasks/projects → activity log → focus state → captures → task status → docs → capture routes → goals/milestones/life_areas → habits/habit_logs + project goal linking → calendar date caching)
- `schema_version` table tracks what's been applied

## Key Tables
- `settings` — key-value config store
- `projects` — native project labels (id, name, color, position). Default: Inbox
- `local_tasks` — native tasks with subtask support (parent_id), priority, due dates, descriptions, status workflow
- `captures` — native captures (migrated from Obsidian Quick Captures.md)
- `activity_log` — timestamped activity events (action_type, target_id, metadata JSON)
- `capture_routes` — user-configurable prefix routing for captures (prefix, target_type, doc_id, label, color, icon)
- `goals` — annual/life goals with status, life area, start/target dates, auto-calculated progress
- `milestones` — binary checkpoints under goals with optional target dates
- `life_areas` — categories for goals (Career, Health, Creative, Financial, Personal, Learning)
- `habits` — daily repeatable actions (name, category, icon, color)
- `habit_logs` — daily check-off records (habit_id, date, intensity 1-5)
- `daily_state` — per-day energy level, cached AI priorities, focus session state
- `todoist_tasks` — cached Todoist tasks
- `calendar_events` / `calendar_feeds` — cached calendar data with 7-day window caching

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

- **Last session:** 2026-04-04 (mobile architecture planning — no code changes)
- **Completed this session:**
  - Comprehensive codebase audit: full inventory of 65 Rust commands, 18 tables, 7 Zustand stores, 10+ hooks, all coupling points
  - Cross-platform architecture plan written to `docs/MOBILE-ARCHITECTURE.md`
  - Platform decision: React Native (Expo) for mobile, not Tauri mobile (too immature)
  - Data sync strategy: custom sync protocol with Turso (hosted SQLite) as cloud rendezvous, last-write-wins for single-user
  - Desktop structural prep plan: 4 sessions (extract Rust core crate, DataProvider abstraction, sync_log table, monorepo + shared types)
  - Mobile build plan: 3-5 sessions after desktop prep (scaffold, core pages, sync integration)
- **Known issues:** Tiptap duplicate link extension warning. Nested button warning in some dropdown triggers. HelpPanel roadmap data is stale. Uncommitted CLAUDE.md change from previous session (migration version update).
- **Next up:** Session 0a — Extract Rust core into a library crate (`daily-triage-core/`). See `docs/MOBILE-ARCHITECTURE.md` Phase 0 for full plan.
