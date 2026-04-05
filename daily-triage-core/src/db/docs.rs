use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db::activity;
use crate::types::{DocFolder, DocNote, Document};

// ── Folder operations ──

pub async fn get_doc_folders(pool: &SqlitePool) -> crate::Result<Vec<DocFolder>> {
    let rows: Vec<(String, String, i64, String)> = sqlx::query_as(
        "SELECT id, name, position, created_at FROM doc_folders ORDER BY position, created_at",
    )
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(id, name, position, created_at)| DocFolder { id, name, position, created_at }).collect())
}

pub async fn create_doc_folder(pool: &SqlitePool, name: &str) -> crate::Result<DocFolder> {
    let id = Uuid::new_v4().to_string();
    let max_pos: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(position), -1) FROM doc_folders")
        .fetch_one(pool)
        .await?;

    sqlx::query("INSERT INTO doc_folders (id, name, position) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(name)
        .bind(max_pos + 1)
        .execute(pool)
        .await?;

    activity::log_activity(pool, "folder_created", Some(&id), Some(serde_json::json!({ "name": name }))).await;

    Ok(DocFolder { id, name: name.to_string(), position: max_pos + 1, created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string() })
}

pub async fn rename_doc_folder(pool: &SqlitePool, id: &str, name: &str) -> crate::Result<()> {
    sqlx::query("UPDATE doc_folders SET name = ? WHERE id = ?")
        .bind(name)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_doc_folder(pool: &SqlitePool, id: &str) -> crate::Result<()> {
    sqlx::query("UPDATE documents SET folder_id = NULL WHERE folder_id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    sqlx::query("DELETE FROM doc_folders WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

// ── Document operations ──

pub async fn get_documents(pool: &SqlitePool, folder_id: Option<&str>) -> crate::Result<Vec<Document>> {
    let rows: Vec<(String, String, String, Option<String>, i64, String, String)> = if let Some(fid) = folder_id {
        sqlx::query_as(
            "SELECT id, title, content, folder_id, position, created_at, updated_at FROM documents WHERE folder_id = ? ORDER BY position, created_at DESC",
        )
        .bind(fid)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as(
            "SELECT id, title, content, folder_id, position, created_at, updated_at FROM documents ORDER BY updated_at DESC",
        )
        .fetch_all(pool)
        .await?
    };

    Ok(rows.into_iter().map(|(id, title, content, folder_id, position, created_at, updated_at)| Document {
        id, title, content, folder_id, position, created_at, updated_at,
    }).collect())
}

pub async fn get_document(pool: &SqlitePool, id: &str) -> crate::Result<Option<Document>> {
    let row: Option<(String, String, String, Option<String>, i64, String, String)> = sqlx::query_as(
        "SELECT id, title, content, folder_id, position, created_at, updated_at FROM documents WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|(id, title, content, folder_id, position, created_at, updated_at)| Document {
        id, title, content, folder_id, position, created_at, updated_at,
    }))
}

pub async fn create_document(pool: &SqlitePool, title: &str, folder_id: Option<&str>) -> crate::Result<Document> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let max_pos: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(position), -1) FROM documents WHERE folder_id IS ?")
        .bind(folder_id)
        .fetch_one(pool)
        .await?;

    sqlx::query(
        "INSERT INTO documents (id, title, content, folder_id, position, created_at, updated_at) VALUES (?, ?, '', ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(title)
    .bind(folder_id)
    .bind(max_pos + 1)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await?;

    activity::log_activity(pool, "doc_created", Some(&id), Some(serde_json::json!({ "title": title }))).await;

    Ok(Document { id, title: title.to_string(), content: String::new(), folder_id: folder_id.map(|s| s.to_string()), position: max_pos + 1, created_at: now.clone(), updated_at: now })
}

pub async fn update_document(
    pool: &SqlitePool,
    id: &str,
    title: Option<&str>,
    content: Option<&str>,
    folder_id: Option<&str>,
) -> crate::Result<Document> {
    if let Some(t) = title {
        sqlx::query("UPDATE documents SET title = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
            .bind(t)
            .bind(id)
            .execute(pool)
            .await?;
    }
    if let Some(c) = content {
        sqlx::query("UPDATE documents SET content = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
            .bind(c)
            .bind(id)
            .execute(pool)
            .await?;
    }
    if let Some(fid) = folder_id {
        sqlx::query("UPDATE documents SET folder_id = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
            .bind(fid)
            .bind(id)
            .execute(pool)
            .await?;
    }

    activity::log_activity(pool, "doc_updated", Some(id), None).await;

    get_document(pool, id).await.and_then(|d| d.ok_or_else(|| crate::Error::Other("Document not found".to_string())))
}

pub async fn delete_document(pool: &SqlitePool, id: &str) -> crate::Result<()> {
    sqlx::query("DELETE FROM doc_notes WHERE doc_id = ?").bind(id).execute(pool).await?;
    sqlx::query("DELETE FROM documents WHERE id = ?").bind(id).execute(pool).await?;
    activity::log_activity(pool, "doc_deleted", Some(id), None).await;
    Ok(())
}

pub async fn search_documents(pool: &SqlitePool, query: &str) -> crate::Result<Vec<Document>> {
    let pattern = format!("%{}%", query);
    let rows: Vec<(String, String, String, Option<String>, i64, String, String)> = sqlx::query_as(
        "SELECT id, title, content, folder_id, position, created_at, updated_at FROM documents WHERE title LIKE ? OR content LIKE ? ORDER BY updated_at DESC LIMIT 20",
    )
    .bind(&pattern)
    .bind(&pattern)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(id, title, content, folder_id, position, created_at, updated_at)| Document {
        id, title, content, folder_id, position, created_at, updated_at,
    }).collect())
}

// ── Doc Note operations ──

pub async fn get_doc_notes(pool: &SqlitePool, doc_id: &str) -> crate::Result<Vec<DocNote>> {
    let rows: Vec<(String, String, String, i64, String)> = sqlx::query_as(
        "SELECT id, doc_id, content, position, created_at FROM doc_notes WHERE doc_id = ? ORDER BY position, created_at",
    )
    .bind(doc_id)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(id, doc_id, content, position, created_at)| DocNote { id, doc_id, content, position, created_at }).collect())
}

pub async fn create_doc_note(pool: &SqlitePool, doc_id: &str, content: &str) -> crate::Result<DocNote> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let max_pos: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(position), -1) FROM doc_notes WHERE doc_id = ?")
        .bind(doc_id)
        .fetch_one(pool)
        .await?;

    sqlx::query("INSERT INTO doc_notes (id, doc_id, content, position, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(&id)
        .bind(doc_id)
        .bind(content)
        .bind(max_pos + 1)
        .bind(&now)
        .execute(pool)
        .await?;

    Ok(DocNote { id, doc_id: doc_id.to_string(), content: content.to_string(), position: max_pos + 1, created_at: now })
}

pub async fn delete_doc_note(pool: &SqlitePool, id: &str) -> crate::Result<()> {
    sqlx::query("DELETE FROM doc_notes WHERE id = ?").bind(id).execute(pool).await?;
    Ok(())
}

pub async fn reorder_doc_notes(pool: &SqlitePool, note_ids: &[String]) -> crate::Result<()> {
    for (i, id) in note_ids.iter().enumerate() {
        sqlx::query("UPDATE doc_notes SET position = ? WHERE id = ?")
            .bind(i as i64)
            .bind(id)
            .execute(pool)
            .await?;
    }
    Ok(())
}
