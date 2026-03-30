use chrono::{Local, TimeDelta};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use crate::parsers::ical::{self, CalendarEvent};

// ── Calendar Feed CRUD ──

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct CalendarFeed {
    pub id: String,
    pub label: String,
    pub url: String,
    pub color: String,
    pub enabled: i32,
}

#[tauri::command]
pub async fn get_calendar_feeds(app: AppHandle) -> Result<Vec<CalendarFeed>, String> {
    let pool = app.state::<SqlitePool>();
    let feeds: Vec<CalendarFeed> =
        sqlx::query_as("SELECT id, label, url, color, enabled FROM calendar_feeds")
            .fetch_all(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    Ok(feeds)
}

#[tauri::command]
pub async fn add_calendar_feed(
    app: AppHandle,
    label: String,
    url: String,
    color: String,
) -> Result<CalendarFeed, String> {
    let pool = app.state::<SqlitePool>();
    let id = Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO calendar_feeds (id, label, url, color) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(&label)
        .bind(&url)
        .bind(&color)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(CalendarFeed {
        id,
        label,
        url,
        color,
        enabled: 1,
    })
}

#[tauri::command]
pub async fn remove_calendar_feed(app: AppHandle, feed_id: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    sqlx::query("DELETE FROM calendar_feeds WHERE id = ?")
        .bind(&feed_id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Fetch Calendar Events (multi-feed) ──

/// Extended calendar event with feed metadata
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CalendarEventWithFeed {
    #[serde(flatten)]
    pub event: CalendarEvent,
    pub date: Option<String>,
    pub feed_label: Option<String>,
    pub feed_color: Option<String>,
}

/// Get the iCal feed URL from settings (legacy fallback)
async fn get_ical_url(app: &AppHandle) -> Result<Option<String>, String> {
    let pool = app.state::<SqlitePool>();
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = 'ical_feed_url'")
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    Ok(row.map(|r| r.0))
}

/// Build the list of feed sources (url, label, color) from DB or legacy setting
async fn get_feed_sources(app: &AppHandle) -> Result<Vec<(String, String, String)>, String> {
    let pool = app.state::<SqlitePool>();
    let feeds: Vec<CalendarFeed> =
        sqlx::query_as("SELECT id, label, url, color, enabled FROM calendar_feeds WHERE enabled = 1")
            .fetch_all(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

    if feeds.is_empty() {
        match get_ical_url(app).await? {
            Some(url) => Ok(vec![(url, "Calendar".to_string(), "#6366f1".to_string())]),
            None => Err("No calendar feeds configured".to_string()),
        }
    } else {
        Ok(feeds
            .iter()
            .map(|f| (f.url.clone(), f.label.clone(), f.color.clone()))
            .collect())
    }
}

/// Fetch a single iCal feed for a 7-day window (3 days back, today, 3 days forward)
async fn fetch_single_feed_7day(
    client: &reqwest::Client,
    url: &str,
    feed_label: &str,
    feed_color: &str,
) -> Vec<CalendarEventWithFeed> {
    let response = match client.get(url).send().await {
        Ok(r) => r,
        Err(e) => {
            log::error!("Failed to fetch feed '{}': {}", feed_label, e);
            return Vec::new();
        }
    };

    let ical_content = match response.text().await {
        Ok(t) => t,
        Err(e) => {
            log::error!("Failed to read feed '{}': {}", feed_label, e);
            return Vec::new();
        }
    };

    let today = Local::now().date_naive();
    let mut all_events = Vec::new();

    for offset in -3..=3i64 {
        let target = today + TimeDelta::days(offset);
        let date_str = target.format("%Y-%m-%d").to_string();
        let events = ical::parse_ical_for_date(&ical_content, target);
        for event in events {
            all_events.push(CalendarEventWithFeed {
                event,
                date: Some(date_str.clone()),
                feed_label: Some(feed_label.to_string()),
                feed_color: Some(feed_color.to_string()),
            });
        }
    }

    all_events
}

/// Check if we have a fresh cache for the given date (fetched within last 15 minutes)
async fn has_fresh_cache(pool: &SqlitePool, date: &str) -> bool {
    let result: Option<(i32,)> = sqlx::query_as(
        "SELECT COUNT(*) FROM calendar_events WHERE date = ? AND fetched_at > datetime('now', '-15 minutes')"
    )
    .bind(date)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    matches!(result, Some((count,)) if count > 0)
}

/// Read cached events for a date from SQLite
async fn read_cached_events(pool: &SqlitePool, date: &str) -> Result<Vec<CalendarEventWithFeed>, String> {
    let rows: Vec<(String, String, Option<String>, Option<String>, String, String, bool, Option<String>, Option<String>, Option<String>, Option<String>)> =
        sqlx::query_as(
            "SELECT id, summary, description, location, start_time, end_time, all_day, meeting_url, date, feed_label, feed_color
             FROM calendar_events WHERE date = ? ORDER BY start_time ASC"
        )
        .bind(date)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|(id, summary, description, location, start_time, end_time, all_day, meeting_url, date, feed_label, feed_color)| {
            CalendarEventWithFeed {
                event: CalendarEvent {
                    id,
                    summary,
                    description,
                    location,
                    start_time,
                    end_time,
                    all_day,
                    meeting_url,
                },
                date,
                feed_label,
                feed_color,
            }
        })
        .collect())
}

/// Cache events to SQLite for a set of dates
async fn cache_events(pool: &SqlitePool, events: &[CalendarEventWithFeed]) -> Result<(), String> {
    // Collect unique dates from events to clear
    let mut dates_to_clear: Vec<String> = events
        .iter()
        .filter_map(|e| e.date.clone())
        .collect();
    dates_to_clear.sort();
    dates_to_clear.dedup();

    // Delete old cached events for these dates
    for date in &dates_to_clear {
        sqlx::query("DELETE FROM calendar_events WHERE date = ?")
            .bind(date)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    // Insert fresh events
    for item in events {
        sqlx::query(
            "INSERT OR REPLACE INTO calendar_events
             (id, summary, description, location, start_time, end_time, all_day, meeting_url, date, feed_label, feed_color, fetched_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
        )
        .bind(&item.event.id)
        .bind(&item.event.summary)
        .bind(&item.event.description)
        .bind(&item.event.location)
        .bind(&item.event.start_time)
        .bind(&item.event.end_time)
        .bind(item.event.all_day)
        .bind(&item.event.meeting_url)
        .bind(&item.date)
        .bind(&item.feed_label)
        .bind(&item.feed_color)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Fetch calendar events from all enabled feeds.
/// Accepts optional `date` parameter (YYYY-MM-DD). Defaults to today.
/// Fetches a 7-day window and caches all events, returns only the requested date.
/// Uses 15-minute cache to avoid redundant network calls.
#[tauri::command]
pub async fn fetch_calendar_events(
    app: AppHandle,
    date: Option<String>,
) -> Result<Vec<CalendarEventWithFeed>, String> {
    let pool = app.state::<SqlitePool>();
    let today = Local::now().date_naive();

    let target_date_str = date.unwrap_or_else(|| today.format("%Y-%m-%d").to_string());

    // Check if we have fresh cached data for this date
    if has_fresh_cache(pool.inner(), &target_date_str).await {
        return read_cached_events(pool.inner(), &target_date_str).await;
    }

    let client = reqwest::Client::new();
    let feed_sources = get_feed_sources(&app).await?;

    // Fetch all feeds concurrently for a 7-day window
    let futures: Vec<_> = feed_sources
        .iter()
        .map(|(url, label, color)| fetch_single_feed_7day(&client, url, label, color))
        .collect();

    let results = futures::future::join_all(futures).await;

    // Aggregate all events from all feeds
    let all_events: Vec<CalendarEventWithFeed> = results.into_iter().flatten().collect();

    // Cache everything
    cache_events(pool.inner(), &all_events).await?;

    // Return only events for the requested date
    read_cached_events(pool.inner(), &target_date_str).await
}

/// Get cached calendar events for a date (no network). Used for quick day navigation.
#[tauri::command]
pub async fn get_cached_calendar_events(
    app: AppHandle,
    date: String,
) -> Result<Vec<CalendarEventWithFeed>, String> {
    let pool = app.state::<SqlitePool>();
    read_cached_events(pool.inner(), &date).await
}
