use chrono::Local;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

// --- Structs ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Habit {
    pub id: String,
    pub name: String,
    pub category: Option<String>,
    pub icon: String,
    pub color: String,
    pub active: bool,
    pub position: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HabitLog {
    pub id: String,
    pub habit_id: String,
    pub date: String,
    pub intensity: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HabitWithStats {
    pub id: String,
    pub name: String,
    pub category: Option<String>,
    pub icon: String,
    pub color: String,
    pub active: bool,
    pub position: i64,
    pub created_at: String,
    pub current_momentum: f64,
    pub today_completed: bool,
    pub today_intensity: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HabitHeatmapEntry {
    pub date: String,
    pub intensity: i64,
}

// --- Helpers ---

fn row_to_habit(
    row: (String, String, Option<String>, String, String, i64, i64, String),
) -> Habit {
    Habit {
        id: row.0,
        name: row.1,
        category: row.2,
        icon: row.3,
        color: row.4,
        active: row.5 != 0,
        position: row.6,
        created_at: row.7,
    }
}

/// Calculate momentum: weighted score over last 30 days.
/// Each logged day adds intensity * decay_factor. decay_factor = 0.95^days_ago.
/// Result is (sum / max_possible) * 100 => 0-100%.
async fn compute_momentum(pool: &SqlitePool, habit_id: &str) -> f64 {
    let today = Local::now().format("%Y-%m-%d").to_string();

    let rows: Vec<(String, i64)> = sqlx::query_as(
        "SELECT date, intensity FROM habit_logs WHERE habit_id = ? AND date >= date(?, '-30 days') AND date <= ?",
    )
    .bind(habit_id)
    .bind(&today)
    .bind(&today)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    if rows.is_empty() {
        return 0.0;
    }

    let today_date = chrono::NaiveDate::parse_from_str(&today, "%Y-%m-%d").unwrap();
    let max_intensity: f64 = 5.0; // Max possible intensity per day

    let mut weighted_sum: f64 = 0.0;
    let mut max_possible: f64 = 0.0;

    // Max possible = sum of max_intensity * decay for each of 30 days
    for days_ago in 0..30 {
        let decay: f64 = 0.95_f64.powi(days_ago);
        max_possible += max_intensity * decay;
    }

    for (date_str, intensity) in &rows {
        if let Ok(log_date) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
            let days_ago = (today_date - log_date).num_days();
            if days_ago >= 0 && days_ago < 30 {
                let decay: f64 = 0.95_f64.powi(days_ago as i32);
                weighted_sum += *intensity as f64 * decay;
            }
        }
    }

    if max_possible > 0.0 {
        (weighted_sum / max_possible * 100.0).min(100.0)
    } else {
        0.0
    }
}

// --- Commands ---

#[tauri::command]
pub async fn get_habits(app: AppHandle) -> Result<Vec<HabitWithStats>, String> {
    let pool = app.state::<SqlitePool>();
    let today = Local::now().format("%Y-%m-%d").to_string();

    let rows: Vec<(String, String, Option<String>, String, String, i64, i64, String)> =
        sqlx::query_as(
            "SELECT id, name, category, icon, color, active, position, created_at FROM habits ORDER BY position, created_at",
        )
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        let habit = row_to_habit(row);

        // Check today's log
        let today_log: Option<(i64,)> = sqlx::query_as(
            "SELECT intensity FROM habit_logs WHERE habit_id = ? AND date = ?",
        )
        .bind(&habit.id)
        .bind(&today)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

        let today_completed = today_log.is_some();
        let today_intensity = today_log.map(|r| r.0).unwrap_or(0);

        let momentum = compute_momentum(pool.inner(), &habit.id).await;

        results.push(HabitWithStats {
            id: habit.id,
            name: habit.name,
            category: habit.category,
            icon: habit.icon,
            color: habit.color,
            active: habit.active,
            position: habit.position,
            created_at: habit.created_at,
            current_momentum: momentum,
            today_completed,
            today_intensity,
        });
    }

    Ok(results)
}

#[tauri::command]
pub async fn create_habit(
    app: AppHandle,
    name: String,
    category: Option<String>,
    icon: Option<String>,
    color: Option<String>,
) -> Result<Habit, String> {
    let pool = app.state::<SqlitePool>();
    let id = Uuid::new_v4().to_string();
    let icon = icon.unwrap_or_else(|| "Circle".to_string());
    let color = color.unwrap_or_else(|| "#f59e0b".to_string());

    let max_pos: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(position), -1) FROM habits")
            .fetch_one(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO habits (id, name, category, icon, color, position) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&name)
    .bind(&category)
    .bind(&icon)
    .bind(&color)
    .bind(max_pos + 1)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    crate::db::activity::log_activity(
        pool.inner(),
        "habit_created",
        Some(&id),
        Some(serde_json::json!({ "name": &name })),
    )
    .await;

    Ok(Habit {
        id,
        name,
        category,
        icon,
        color,
        active: true,
        position: max_pos + 1,
        created_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

#[tauri::command]
pub async fn update_habit(
    app: AppHandle,
    id: String,
    name: Option<String>,
    category: Option<String>,
    icon: Option<String>,
    color: Option<String>,
    active: Option<bool>,
) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();

    if let Some(ref val) = name {
        sqlx::query("UPDATE habits SET name = ? WHERE id = ?")
            .bind(val)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(ref val) = category {
        sqlx::query("UPDATE habits SET category = ? WHERE id = ?")
            .bind(val)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(ref val) = icon {
        sqlx::query("UPDATE habits SET icon = ? WHERE id = ?")
            .bind(val)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(ref val) = color {
        sqlx::query("UPDATE habits SET color = ? WHERE id = ?")
            .bind(val)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(val) = active {
        sqlx::query("UPDATE habits SET active = ? WHERE id = ?")
            .bind(val as i64)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_habit(app: AppHandle, id: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();

    // Delete logs first (CASCADE should handle but be explicit)
    sqlx::query("DELETE FROM habit_logs WHERE habit_id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM habits WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    crate::db::activity::log_activity(
        pool.inner(),
        "habit_deleted",
        Some(&id),
        None,
    )
    .await;

    Ok(())
}

#[tauri::command]
pub async fn log_habit(
    app: AppHandle,
    habit_id: String,
    date: Option<String>,
    intensity: Option<i64>,
) -> Result<HabitLog, String> {
    let pool = app.state::<SqlitePool>();
    let date = date.unwrap_or_else(|| Local::now().format("%Y-%m-%d").to_string());
    let intensity = intensity.unwrap_or(5);
    let id = Uuid::new_v4().to_string();

    // INSERT OR REPLACE: if (habit_id, date) already exists, replace it.
    // We need to delete first then insert because the primary key (id) differs.
    sqlx::query("DELETE FROM habit_logs WHERE habit_id = ? AND date = ?")
        .bind(&habit_id)
        .bind(&date)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO habit_logs (id, habit_id, date, intensity) VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&habit_id)
    .bind(&date)
    .bind(intensity)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    crate::db::activity::log_activity(
        pool.inner(),
        "habit_logged",
        Some(&habit_id),
        Some(serde_json::json!({ "date": &date, "intensity": intensity })),
    )
    .await;

    Ok(HabitLog {
        id,
        habit_id,
        date,
        intensity,
        created_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

#[tauri::command]
pub async fn unlog_habit(
    app: AppHandle,
    habit_id: String,
    date: Option<String>,
) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    let date = date.unwrap_or_else(|| Local::now().format("%Y-%m-%d").to_string());

    sqlx::query("DELETE FROM habit_logs WHERE habit_id = ? AND date = ?")
        .bind(&habit_id)
        .bind(&date)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_habit_logs(
    app: AppHandle,
    habit_id: Option<String>,
    days: Option<i64>,
) -> Result<Vec<HabitLog>, String> {
    let pool = app.state::<SqlitePool>();
    let days = days.unwrap_or(365);
    let from_date = (Local::now() - chrono::Duration::days(days))
        .format("%Y-%m-%d")
        .to_string();

    let rows: Vec<(String, String, String, i64, String)> = if let Some(ref hid) = habit_id {
        sqlx::query_as(
            "SELECT id, habit_id, date, intensity, created_at FROM habit_logs WHERE habit_id = ? AND date >= ? ORDER BY date DESC",
        )
        .bind(hid)
        .bind(&from_date)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query_as(
            "SELECT id, habit_id, date, intensity, created_at FROM habit_logs WHERE date >= ? ORDER BY date DESC",
        )
        .bind(&from_date)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?
    };

    Ok(rows
        .into_iter()
        .map(|(id, habit_id, date, intensity, created_at)| HabitLog {
            id,
            habit_id,
            date,
            intensity,
            created_at,
        })
        .collect())
}

#[tauri::command]
pub async fn get_habit_heatmap(
    app: AppHandle,
    habit_id: Option<String>,
    days: Option<i64>,
) -> Result<Vec<HabitHeatmapEntry>, String> {
    let pool = app.state::<SqlitePool>();
    let days = days.unwrap_or(365);
    let from_date = (Local::now() - chrono::Duration::days(days))
        .format("%Y-%m-%d")
        .to_string();

    let rows: Vec<(String, i64)> = if let Some(ref hid) = habit_id {
        sqlx::query_as(
            "SELECT date, MAX(intensity) as intensity FROM habit_logs WHERE habit_id = ? AND date >= ? GROUP BY date ORDER BY date",
        )
        .bind(hid)
        .bind(&from_date)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query_as(
            "SELECT date, MAX(intensity) as intensity FROM habit_logs WHERE date >= ? GROUP BY date ORDER BY date",
        )
        .bind(&from_date)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?
    };

    Ok(rows
        .into_iter()
        .map(|(date, intensity)| HabitHeatmapEntry { date, intensity })
        .collect())
}
