use sqlx::SqlitePool;

pub struct Migration {
    pub version: i64,
    pub description: &'static str,
    pub sql: &'static str,
}

pub const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        description: "Initial schema",
        sql: r#"
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
CREATE INDEX IF NOT EXISTS idx_action_log_synced ON action_log(synced)
"#,
    },
    Migration {
        version: 2,
        description: "Multi-calendar feeds",
        sql: r#"
            CREATE TABLE IF NOT EXISTS calendar_feeds (
                id TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                url TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT '#6366f1',
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            INSERT OR IGNORE INTO calendar_feeds (id, label, url)
                SELECT 'default', 'Calendar', value FROM settings WHERE key = 'ical_feed_url'
        "#,
    },
    Migration {
        version: 3,
        description: "Native tasks and projects",
        sql: r#"
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT '#6366f1',
                position INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            INSERT OR IGNORE INTO projects (id, name, color, position)
                VALUES ('inbox', 'Inbox', '#6366f1', 0);

            CREATE TABLE IF NOT EXISTS local_tasks (
                id TEXT PRIMARY KEY,
                parent_id TEXT,
                content TEXT NOT NULL,
                description TEXT,
                project_id TEXT NOT NULL DEFAULT 'inbox',
                priority INTEGER NOT NULL DEFAULT 1,
                due_date TEXT,
                completed INTEGER NOT NULL DEFAULT 0,
                completed_at TEXT,
                position INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (parent_id) REFERENCES local_tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_local_tasks_project ON local_tasks(project_id);
            CREATE INDEX IF NOT EXISTS idx_local_tasks_parent ON local_tasks(parent_id);
            CREATE INDEX IF NOT EXISTS idx_local_tasks_due ON local_tasks(due_date);
            CREATE INDEX IF NOT EXISTS idx_local_tasks_completed ON local_tasks(completed)
        "#,
    },
];

pub async fn run_migrations(pool: &SqlitePool) -> Result<(), String> {
    // 1. Create schema_version table if not exists
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY,
            description TEXT,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // 2. Get current version
    let current: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(version), 0) FROM schema_version")
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;

    // 3. Run pending migrations
    for migration in MIGRATIONS {
        if migration.version > current {
            log::info!(
                "Running migration {}: {}",
                migration.version,
                migration.description
            );

            // Execute migration SQL (may contain multiple statements)
            for statement in migration.sql.split(';').filter(|s| !s.trim().is_empty()) {
                sqlx::query(statement.trim())
                    .execute(pool)
                    .await
                    .map_err(|e| {
                        format!("Migration {} failed: {}", migration.version, e)
                    })?;
            }

            // Record migration
            sqlx::query(
                "INSERT INTO schema_version (version, description) VALUES (?, ?)",
            )
            .bind(migration.version)
            .bind(migration.description)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;

            log::info!("Migration {} complete", migration.version);
        }
    }

    Ok(())
}
