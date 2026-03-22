# Daily Triage

A personal daily triage and briefing macOS app built with Tauri 2.0.

## Tech Stack
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui
- **Backend:** Rust (Tauri 2.0)
- **Database:** SQLite via tauri-plugin-sql
- **State:** Zustand
- **Design:** Impeccable (pbakaus/impeccable) design language

## Commands
- `npm run dev` — Start Vite dev server only (frontend)
- `npm run tauri dev` — Start full Tauri app (frontend + Rust backend)
- `npm run build` — Build frontend for production
- `npm run tauri build` — Build distributable .app

## Project Structure
- `src/` — React frontend (components, hooks, stores, services)
- `src-tauri/` — Rust backend (commands, db, parsers)
- `src/components/ui/` — shadcn/ui primitives (auto-generated, don't edit manually)
- `src/components/layout/` — Dashboard layout components
- `src/components/{calendar,todoist,obsidian,priorities}/` — Feature components

## Architecture Rules
- All API calls happen in Rust, never in the React frontend (CORS + security)
- All file system access happens in Rust via tauri-plugin-fs
- Frontend communicates with backend via `invoke()` Tauri commands
- Zustand is the frontend's single source of truth
- Components read from Zustand, not from Tauri commands directly
- Hooks bridge between Tauri commands and Zustand

## Style Guide
- Use shadcn/ui components as base, customize with Tailwind
- Path alias: `@/` maps to `src/`
- Import shadcn components from `@/components/ui/`
- Import utils from `@/lib/utils`

## Anti-Patterns
- Don't make HTTP calls from the frontend — use Rust commands
- Don't access SQLite from the frontend — use Rust commands
- Don't use loading spinners — use skeleton placeholders
- Don't show "overdue" labels — use neutral "still open" framing
- Don't add guilt-inducing UI (streaks, "you've been away" messages)
