use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportSummary {
    pub goals_created: i32,
    pub habits_created: i32,
}

/// Resolve the vault path from settings, expanding ~
async fn get_vault_path(app: &AppHandle) -> Result<String, String> {
    let pool = app.state::<SqlitePool>();

    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = 'obsidian_vault_path'")
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

    let path = row
        .map(|r| r.0)
        .ok_or_else(|| "Obsidian vault path not configured".to_string())?;

    if path.starts_with('~') {
        let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
        Ok(path.replacen('~', &home.to_string_lossy(), 1))
    } else {
        Ok(path)
    }
}

/// Import goals, habits, and bingo items from the Obsidian vault.
/// This is a one-time seeding action.
#[tauri::command]
pub async fn import_goals_from_vault(app: AppHandle) -> Result<ImportSummary, String> {
    let pool = app.state::<SqlitePool>();
    let vault_path = get_vault_path(&app).await?;

    let mut goals_created: i32 = 0;
    let mut habits_created: i32 = 0;

    // --- Parse 2026 Resolutions & Goals ---
    let resolutions_path = format!(
        "{}/goals/\u{1FAA9} 2026 Resolutions & Goals.md",
        vault_path
    );
    if let Ok(content) = tokio::fs::read_to_string(&resolutions_path).await {
        let (goals, habits) = parse_resolutions(&content);

        for goal_name in &goals {
            let id = Uuid::new_v4().to_string();
            let max_pos: i64 =
                sqlx::query_scalar("SELECT COALESCE(MAX(position), -1) FROM goals")
                    .fetch_one(pool.inner())
                    .await
                    .map_err(|e| e.to_string())?;

            sqlx::query(
                "INSERT INTO goals (id, name, status, position) VALUES (?, ?, 'active', ?)",
            )
            .bind(&id)
            .bind(goal_name)
            .bind(max_pos + 1)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

            goals_created += 1;
        }

        for (habit_name, category) in &habits {
            let id = Uuid::new_v4().to_string();
            let max_pos: i64 =
                sqlx::query_scalar("SELECT COALESCE(MAX(position), -1) FROM habits")
                    .fetch_one(pool.inner())
                    .await
                    .map_err(|e| e.to_string())?;

            sqlx::query(
                "INSERT INTO habits (id, name, category, position) VALUES (?, ?, ?, ?)",
            )
            .bind(&id)
            .bind(habit_name)
            .bind(category)
            .bind(max_pos + 1)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

            habits_created += 1;
        }
    }

    // --- Parse Bingo Card ---
    let bingo_path = format!("{}/goals/2026-bingo-card.md", vault_path);
    if let Ok(content) = tokio::fs::read_to_string(&bingo_path).await {
        let bingo_items = parse_bingo_card(&content);

        for item_name in &bingo_items {
            let id = Uuid::new_v4().to_string();
            let max_pos: i64 =
                sqlx::query_scalar("SELECT COALESCE(MAX(position), -1) FROM goals")
                    .fetch_one(pool.inner())
                    .await
                    .map_err(|e| e.to_string())?;

            sqlx::query(
                "INSERT INTO goals (id, name, status, position) VALUES (?, ?, 'not_started', ?)",
            )
            .bind(&id)
            .bind(item_name)
            .bind(max_pos + 1)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

            goals_created += 1;
        }
    }

    crate::db::activity::log_activity(
        pool.inner(),
        "vault_import",
        None,
        Some(serde_json::json!({
            "goals_created": goals_created,
            "habits_created": habits_created,
        })),
    )
    .await;

    Ok(ImportSummary {
        goals_created,
        habits_created,
    })
}

/// Parse annual goals and daily habits from the resolutions file.
/// Annual goals: lines starting with a number followed by a dot under an "Annual goals" section.
/// Habits: checkbox lines under "Social", "Physical", "Digital" headers.
fn parse_resolutions(content: &str) -> (Vec<String>, Vec<(String, String)>) {
    let mut goals = Vec::new();
    let mut habits = Vec::new();

    let mut in_annual_goals = false;
    let mut current_habit_category: Option<String> = None;

    let mut in_daily_habits = false;

    for line in content.lines() {
        let trimmed = line.trim();

        // Detect markdown headers (### ==Annual==, ### ==Daily Habits==)
        if trimmed.starts_with('#') {
            let header = trimmed.trim_start_matches('#').trim().to_lowercase()
                .replace("==", "").replace("*", "");

            if header.contains("annual") {
                in_annual_goals = true;
                in_daily_habits = false;
                current_habit_category = None;
                continue;
            }
            if header.contains("daily habits") || header.contains("daily") {
                in_annual_goals = false;
                in_daily_habits = true;
                current_habit_category = None;
                continue;
            }
            if header.contains("intentions") || header.contains("rules") || header.contains("monthly") {
                in_annual_goals = false;
                in_daily_habits = false;
                current_habit_category = None;
                continue;
            }
            continue;
        }

        // Detect habit category lines like ***Social*** or **Social** or *Social*
        if in_daily_habits {
            let stripped = trimmed.replace('*', "").to_lowercase();
            if stripped == "social" || stripped == "physical" || stripped == "digital" {
                current_habit_category = Some(
                    stripped.chars().next().unwrap().to_uppercase().to_string() + &stripped[1..],
                );
                continue;
            }
        }

        // Parse annual goals: checkbox lines like "- [ ] Goal name"
        if in_annual_goals && trimmed.starts_with("- [") {
            if let Some(bracket_end) = trimmed.find(']') {
                let name = trimmed[bracket_end + 1..].trim();
                if !name.is_empty() {
                    goals.push(name.to_string());
                }
            }
        }

        // Parse habits: checkbox lines under a category
        if let Some(ref category) = current_habit_category {
            if trimmed.starts_with("- [") {
                if let Some(bracket_end) = trimmed.find(']') {
                    let name = trimmed[bracket_end + 1..].trim();
                    if !name.is_empty() {
                        habits.push((name.to_string(), category.clone()));
                    }
                }
            }
        }
    }

    (goals, habits)
}

/// Parse bingo card items from the bingo card file.
/// Items are checkbox lines under a "Progress" section.
fn parse_bingo_card(content: &str) -> Vec<String> {
    let mut items = Vec::new();
    let mut in_progress = false;

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with('#') {
            let header = trimmed.trim_start_matches('#').trim().to_lowercase();
            if header.contains("progress") {
                in_progress = true;
                continue;
            }
            // Any other header after Progress ends the section
            if in_progress && !header.is_empty() {
                break;
            }
        }

        if in_progress && trimmed.starts_with("- [") {
            if let Some(bracket_end) = trimmed.find(']') {
                let name = trimmed[bracket_end + 1..].trim();
                if !name.is_empty() {
                    items.push(name.to_string());
                }
            }
        }
    }

    items
}
