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
    Migration {
        version: 4,
        description: "Activity log",
        sql: r#"
            CREATE TABLE IF NOT EXISTS activity_log (
                id TEXT PRIMARY KEY,
                action_type TEXT NOT NULL,
                target_id TEXT,
                metadata TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
            );

            CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);
            CREATE INDEX IF NOT EXISTS idx_activity_log_action_type ON activity_log(action_type);
            CREATE INDEX IF NOT EXISTS idx_activity_log_target ON activity_log(target_id)
        "#,
    },
    Migration {
        version: 5,
        description: "Focus mode state",
        sql: r#"
            ALTER TABLE daily_state ADD COLUMN focus_task_id TEXT;
            ALTER TABLE daily_state ADD COLUMN focus_started_at TEXT;
            ALTER TABLE daily_state ADD COLUMN focus_paused_at TEXT
        "#,
    },
    Migration {
        version: 7,
        description: "Task status workflow",
        sql: r#"
            ALTER TABLE local_tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'todo';
            UPDATE local_tasks SET status = 'complete' WHERE completed = 1;
            CREATE INDEX IF NOT EXISTS idx_local_tasks_status ON local_tasks(status)
        "#,
    },
    Migration {
        version: 8,
        description: "Captures table",
        sql: r#"
            CREATE TABLE IF NOT EXISTS captures (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'manual',
                converted_to_task_id TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
            );

            CREATE INDEX IF NOT EXISTS idx_captures_created ON captures(created_at);
            CREATE INDEX IF NOT EXISTS idx_captures_converted ON captures(converted_to_task_id)
        "#,
    },
    Migration {
        version: 9,
        description: "Docs: folders, documents, doc_notes",
        sql: r#"
            CREATE TABLE IF NOT EXISTS doc_folders (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                position INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
            );

            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                folder_id TEXT,
                position INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (folder_id) REFERENCES doc_folders(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder_id);
            CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents(updated_at);

            CREATE TABLE IF NOT EXISTS doc_notes (
                id TEXT PRIMARY KEY,
                doc_id TEXT NOT NULL,
                content TEXT NOT NULL,
                position INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_doc_notes_doc ON doc_notes(doc_id);

            INSERT OR IGNORE INTO doc_folders (id, name, position) VALUES ('ideas', 'Ideas', 0);
            INSERT OR IGNORE INTO doc_folders (id, name, position) VALUES ('work', 'Work', 1);
            INSERT OR IGNORE INTO doc_folders (id, name, position) VALUES ('personal', 'Personal', 2);

            ALTER TABLE local_tasks ADD COLUMN linked_doc_id TEXT
        "#,
    },
    Migration {
        version: 10,
        description: "Capture routes + routed_to on captures",
        sql: r#"
            CREATE TABLE IF NOT EXISTS capture_routes (
                id TEXT PRIMARY KEY,
                prefix TEXT NOT NULL UNIQUE,
                target_type TEXT NOT NULL DEFAULT 'doc',
                doc_id TEXT,
                label TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT '#f59e0b',
                icon TEXT NOT NULL DEFAULT 'FileText',
                position INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
            );

            INSERT OR IGNORE INTO capture_routes (id, prefix, target_type, doc_id, label, color, icon, position) VALUES
                ('route-ideas', '/i', 'doc', NULL, 'Ideas', '#f59e0b', 'Lightbulb', 0);
            INSERT OR IGNORE INTO capture_routes (id, prefix, target_type, doc_id, label, color, icon, position) VALUES
                ('route-quotes', '/q', 'doc', NULL, 'Quotes', '#3b82f6', 'Quote', 1);
            INSERT OR IGNORE INTO capture_routes (id, prefix, target_type, doc_id, label, color, icon, position) VALUES
                ('route-task', '/t', 'task', NULL, 'Task', '#22c55e', 'CheckSquare', 2);

            ALTER TABLE captures ADD COLUMN routed_to TEXT
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
