use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

// ── Structs ──

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DocFolder {
    pub id: String,
    pub name: String,
    pub position: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Document {
    pub id: String,
    pub title: String,
    pub content: String,
    pub folder_id: Option<String>,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DocNote {
    pub id: String,
    pub doc_id: String,
    pub content: String,
    pub position: i64,
    pub created_at: String,
}

// ── Folder Commands ──

#[tauri::command]
pub async fn get_doc_folders(app: AppHandle) -> Result<Vec<DocFolder>, String> {
    let pool = app.state::<SqlitePool>();
    let rows: Vec<(String, String, i64, String)> = sqlx::query_as(
        "SELECT id, name, position, created_at FROM doc_folders ORDER BY position, created_at",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(id, name, position, created_at)| DocFolder { id, name, position, created_at }).collect())
}

#[tauri::command]
pub async fn create_doc_folder(app: AppHandle, name: String) -> Result<DocFolder, String> {
    let pool = app.state::<SqlitePool>();
    let id = Uuid::new_v4().to_string();
    let max_pos: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(position), -1) FROM doc_folders")
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("INSERT INTO doc_folders (id, name, position) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(&name)
        .bind(max_pos + 1)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    crate::db::activity::log_activity(pool.inner(), "folder_created", Some(&id), Some(serde_json::json!({ "name": &name }))).await;

    Ok(DocFolder { id, name, position: max_pos + 1, created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string() })
}

#[tauri::command]
pub async fn rename_doc_folder(app: AppHandle, id: String, name: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    sqlx::query("UPDATE doc_folders SET name = ? WHERE id = ?")
        .bind(&name)
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_doc_folder(app: AppHandle, id: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    // Unfiled docs in this folder
    sqlx::query("UPDATE documents SET folder_id = NULL WHERE folder_id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM doc_folders WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Document Commands ──

#[tauri::command]
pub async fn get_documents(app: AppHandle, folder_id: Option<String>) -> Result<Vec<Document>, String> {
    let pool = app.state::<SqlitePool>();
    let rows: Vec<(String, String, String, Option<String>, i64, String, String)> = if let Some(ref fid) = folder_id {
        sqlx::query_as(
            "SELECT id, title, content, folder_id, position, created_at, updated_at FROM documents WHERE folder_id = ? ORDER BY position, created_at DESC",
        )
        .bind(fid)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query_as(
            "SELECT id, title, content, folder_id, position, created_at, updated_at FROM documents ORDER BY updated_at DESC",
        )
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?
    };

    Ok(rows.into_iter().map(|(id, title, content, folder_id, position, created_at, updated_at)| Document {
        id, title, content, folder_id, position, created_at, updated_at,
    }).collect())
}

#[tauri::command]
pub async fn get_document(app: AppHandle, id: String) -> Result<Option<Document>, String> {
    let pool = app.state::<SqlitePool>();
    let row: Option<(String, String, String, Option<String>, i64, String, String)> = sqlx::query_as(
        "SELECT id, title, content, folder_id, position, created_at, updated_at FROM documents WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(row.map(|(id, title, content, folder_id, position, created_at, updated_at)| Document {
        id, title, content, folder_id, position, created_at, updated_at,
    }))
}

#[tauri::command]
pub async fn create_document(app: AppHandle, title: String, folder_id: Option<String>) -> Result<Document, String> {
    let pool = app.state::<SqlitePool>();
    let id = Uuid::new_v4().to_string();
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let max_pos: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(position), -1) FROM documents WHERE folder_id IS ?")
        .bind(&folder_id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO documents (id, title, content, folder_id, position, created_at, updated_at) VALUES (?, ?, '', ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&title)
    .bind(&folder_id)
    .bind(max_pos + 1)
    .bind(&now)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    crate::db::activity::log_activity(pool.inner(), "doc_created", Some(&id), Some(serde_json::json!({ "title": &title }))).await;

    Ok(Document { id, title, content: String::new(), folder_id, position: max_pos + 1, created_at: now.clone(), updated_at: now })
}

#[tauri::command]
pub async fn update_document(
    app: AppHandle,
    id: String,
    title: Option<String>,
    content: Option<String>,
    folder_id: Option<String>,
) -> Result<Document, String> {
    let pool = app.state::<SqlitePool>();

    if let Some(ref t) = title {
        sqlx::query("UPDATE documents SET title = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
            .bind(t)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(ref c) = content {
        sqlx::query("UPDATE documents SET content = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
            .bind(c)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(ref fid) = folder_id {
        sqlx::query("UPDATE documents SET folder_id = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
            .bind(fid)
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }

    crate::db::activity::log_activity(pool.inner(), "doc_updated", Some(&id), None).await;

    // Return updated doc
    get_document(app, id).await.and_then(|d| d.ok_or_else(|| "Document not found".to_string()))
}

#[tauri::command]
pub async fn delete_document(app: AppHandle, id: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    // doc_notes cascade delete via FK
    sqlx::query("DELETE FROM doc_notes WHERE doc_id = ?").bind(&id).execute(pool.inner()).await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM documents WHERE id = ?").bind(&id).execute(pool.inner()).await.map_err(|e| e.to_string())?;
    crate::db::activity::log_activity(pool.inner(), "doc_deleted", Some(&id), None).await;
    Ok(())
}

#[tauri::command]
pub async fn search_documents(app: AppHandle, query: String) -> Result<Vec<Document>, String> {
    let pool = app.state::<SqlitePool>();
    let pattern = format!("%{}%", query);
    let rows: Vec<(String, String, String, Option<String>, i64, String, String)> = sqlx::query_as(
        "SELECT id, title, content, folder_id, position, created_at, updated_at FROM documents WHERE title LIKE ? OR content LIKE ? ORDER BY updated_at DESC LIMIT 20",
    )
    .bind(&pattern)
    .bind(&pattern)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(id, title, content, folder_id, position, created_at, updated_at)| Document {
        id, title, content, folder_id, position, created_at, updated_at,
    }).collect())
}

// ── Doc Note Commands ──

#[tauri::command]
pub async fn get_doc_notes(app: AppHandle, doc_id: String) -> Result<Vec<DocNote>, String> {
    let pool = app.state::<SqlitePool>();
    let rows: Vec<(String, String, String, i64, String)> = sqlx::query_as(
        "SELECT id, doc_id, content, position, created_at FROM doc_notes WHERE doc_id = ? ORDER BY position, created_at",
    )
    .bind(&doc_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(id, doc_id, content, position, created_at)| DocNote { id, doc_id, content, position, created_at }).collect())
}

#[tauri::command]
pub async fn create_doc_note(app: AppHandle, doc_id: String, content: String) -> Result<DocNote, String> {
    let pool = app.state::<SqlitePool>();
    let id = Uuid::new_v4().to_string();
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let max_pos: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(position), -1) FROM doc_notes WHERE doc_id = ?")
        .bind(&doc_id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("INSERT INTO doc_notes (id, doc_id, content, position, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(&id)
        .bind(&doc_id)
        .bind(&content)
        .bind(max_pos + 1)
        .bind(&now)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(DocNote { id, doc_id, content, position: max_pos + 1, created_at: now })
}

#[tauri::command]
pub async fn delete_doc_note(app: AppHandle, id: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    sqlx::query("DELETE FROM doc_notes WHERE id = ?").bind(&id).execute(pool.inner()).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn reorder_doc_notes(app: AppHandle, note_ids: Vec<String>) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    for (i, id) in note_ids.iter().enumerate() {
        sqlx::query("UPDATE doc_notes SET position = ? WHERE id = ?")
            .bind(i as i64)
            .bind(id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
