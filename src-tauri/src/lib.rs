mod commands;
mod db;

use sqlx::sqlite::SqlitePoolOptions;
use tauri::Manager;

use commands::settings;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize SQLite database
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                let app_dir = app_handle
                    .path()
                    .app_data_dir()
                    .expect("failed to get app data dir");
                std::fs::create_dir_all(&app_dir).expect("failed to create app data dir");

                let db_path = app_dir.join("daily-triage.db");
                let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

                let pool = SqlitePoolOptions::new()
                    .max_connections(5)
                    .connect(&db_url)
                    .await
                    .expect("failed to connect to database");

                // Run migrations
                sqlx::query(db::migrations::MIGRATION_001)
                    .execute(&pool)
                    .await
                    .expect("failed to run migrations");

                log::info!("Database initialized at {:?}", db_path);

                // Store pool in app state
                app_handle.manage(pool);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            settings::check_setup_complete,
            settings::get_setting,
            settings::set_setting,
            settings::get_all_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
