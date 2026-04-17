# Daily Triage

A personal daily triage and briefing macOS app built with Tauri 2.0.

## Tech Stack
- **Frontend (desktop):** React 19 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui (base-nova style)
- **Frontend (mobile):** React Native (Expo) + TypeScript + StyleSheet
- **Backend:** Rust (Tauri 2.0) + `daily-triage-core` library crate
- **Database:** SQLite via sqlx (desktop) / expo-sqlite (mobile)
- **Sync:** Custom sync protocol via Turso (hosted libSQL) — last-write-wins, single-user
- **State:** Zustand (appStore, focusStore, detailStore) via DataProvider abstraction
- **AI:** Claude Haiku via Anthropic API (priorities generation, task breakdown)

## Commands
- `cd apps/desktop && npm run tauri dev` — Start full Tauri desktop app
- `cd apps/mobile && npx expo start` — Start Expo mobile dev server
- `cd apps/desktop && npm run build` — Build desktop frontend for production
- `cd apps/desktop && npm run tauri build` — Build distributable .app
- **No test suite yet** — no unit or integration tests

## Project Structure (Monorepo)
```
daily-triage/
├── apps/
│   ├── desktop/              (Tauri desktop app)
│   │   ├── src/              (React frontend)
│   │   ├── src-tauri/        (Rust backend — thin command wrappers)
│   │   ├── package.json
│   │   └── vite.config.ts
│   └── mobile/               (Expo React Native app)
│       ├── app/              (expo-router file-based pages)
│       ├── services/         (database, sync, providers)
│       ├── constants/        (theme)
│       └── package.json
├── packages/
│   └── types/                (shared TypeScript types — @daily-triage/types)
├── daily-triage-core/        (Rust library crate — all business logic)
│   ├── src/db/               (tasks, projects, captures, goals, habits, docs, sync, etc.)
│   ├── src/api/              (todoist, anthropic, calendar, updater)
│   ├── src/parsers/          (ical, markdown)
│   └── src/types.rs          (all domain types)
├── docs/                     (architecture docs, research)
├── Cargo.toml                (Rust workspace root)
└── package.json              (npm workspace root)
```

## Architecture Rules
- All API calls happen in Rust, never in the React frontend (CORS + security)
- All file system access happens in Rust via tauri-plugin-fs
- All URL opening happens via the custom `open_url` Rust command (not shell plugin)
- Frontend communicates with backend via `invoke()` Tauri commands
- Zustand stores for global state (app, focus, detail). Local state for ephemeral UI.
- `emitTasksChanged()` event bus to sync all `useLocalTasks` instances after mutations
- Activity logging via `crate::db::activity::log_activity()` — fire-and-forget, never fails user-facing commands

## Adding a Rust Command
1. Add the business logic function in `daily-triage-core/src/db/<domain>.rs`
2. Create a thin Tauri wrapper in `apps/desktop/src-tauri/src/commands/<domain>.rs`
3. Export the module in `apps/desktop/src-tauri/src/commands/mod.rs`
4. Import it in `apps/desktop/src-tauri/src/lib.rs`
5. Register in the `invoke_handler![]` macro in `lib.rs`
6. Add TypeScript wrapper in `apps/desktop/src/services/tauri.ts`

## Database Migrations
- SQLite managed via sqlx (desktop Rust) and expo-sqlite (mobile TypeScript)
- Versioned migration system in `daily-triage-core/src/db/migrations.rs` (Rust) and `apps/mobile/services/database.ts` (TypeScript mirror)
- Both platforms share the same schema — keep migrations in sync
- Current version: **14** (v1-13: core schema + v14: sync_log table + device_id)
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
- `sync_log` — change tracking for cross-device sync (table_name, row_id, operation, snapshot, device_id, timestamp)

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

## Architecture: DataProvider Abstraction
- `DataProvider` interface (`services/data-provider.ts`) decouples frontend from Tauri invoke
- Desktop: `TauriProvider` delegates to `services/tauri.ts` invoke wrappers
- Mobile: `SqliteProvider` talks directly to expo-sqlite
- Stores access provider via `getDataProvider()` (module-level, not React context)
- ~24 desktop components still import from tauri.ts directly (works fine, just not abstracted yet)

## Sync Protocol
- Every mutation appends to `sync_log` (fire-and-forget, never blocks the mutation)
- Push: send unsynced entries + data mutations to Turso via HTTP pipeline API
- Pull: fetch remote entries, apply with LWW conflict resolution (skip if local is newer)
- "Seed Existing Data" command backfills sync_log for pre-existing data
- Turso URL format: `libsql://<db>-<org>.turso.io` (auto-normalized to https)
- Remote schema initialization runs once (creates all 16 tables on Turso)

## Current State

- **Last session:** 2026-04-04 (massive build session — full cross-platform infrastructure + mobile app)
- **Completed this session:**
  - Phase 0a: Extracted Rust core into `daily-triage-core/` library crate (25+ types, 11 DB modules, 4 API modules)
  - Phase 0b: Created DataProvider abstraction, decoupled 4 stores + 7 hooks from Tauri
  - Phase 0c: Added sync foundation — sync_log table (migration v14), mutation tracking across all 12 domain modules, Turso HTTP client
  - Phase 0d+1a: Monorepo restructure (`apps/desktop/`, `apps/mobile/`, `packages/types/`) + Expo mobile scaffold with 4 tab pages
  - Phase 1c: Mobile mutations (task CRUD, captures, habit logging) + blank screen fix + sync_log appends
  - Phase 2: Desktop Turso sync (push/pull with data mutations, remote init, test connection, auto-sync on launch)
  - Phase 2b: Mobile Turso sync (full port of push/pull to TypeScript, Settings UI, background sync)
  - Seed existing data command for backfilling pre-sync data into sync_log
  - Metro + Babel config fixes for Expo monorepo support
- **Known issues:** Tiptap duplicate link extension warning. HelpPanel roadmap data is stale. First sync push is slow with large datasets (all entries in one pipeline). ~24 desktop components still import directly from tauri.ts.
- **Next up:** Phase 3 polish (notifications, focus timer on mobile, swipe actions, haptics). Evening review flow. Goals detail page.
