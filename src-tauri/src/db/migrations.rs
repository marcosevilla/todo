/// SQL migrations for the Daily Triage database.
/// These run via the frontend SQL plugin on app startup.
pub const MIGRATION_001: &str = r#"
-- Settings (key-value store)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cached calendar events
CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    summary TEXT NOT NULL,
    description TEXT,
    location TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    all_day INTEGER NOT NULL DEFAULT 0,
    meeting_url TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cached Todoist tasks
CREATE TABLE IF NOT EXISTS todoist_tasks (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    description TEXT,
    project_id TEXT,
    project_name TEXT,
    priority INTEGER NOT NULL DEFAULT 1,
    due_date TEXT,
    due_is_recurring INTEGER NOT NULL DEFAULT 0,
    is_completed INTEGER NOT NULL DEFAULT 0,
    todoist_url TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Action log (optimistic actions + retry queue)
CREATE TABLE IF NOT EXISTS action_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    payload TEXT,
    synced INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Progress snapshots (save function)
CREATE TABLE IF NOT EXISTS progress_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    energy_level TEXT,
    tasks_completed TEXT,
    tasks_open TEXT,
    tasks_deferred TEXT,
    priorities TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Daily state (one row per day)
CREATE TABLE IF NOT EXISTS daily_state (
    date TEXT PRIMARY KEY,
    energy_level TEXT DEFAULT 'medium',
    top_priorities TEXT,
    first_opened_at TEXT,
    last_saved_at TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_todoist_tasks_due ON todoist_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_action_log_synced ON action_log(synced);
"#;
