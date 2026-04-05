/**
 * Sync log utility — appends a record to sync_log after every mutation.
 * Fire-and-forget: errors are logged but never thrown to callers.
 */

import type { Database } from './database';
import { getDatabase } from './database';

/**
 * Generate a UUID v4 string.
 * Uses crypto.randomUUID if available, otherwise manual generation.
 */
export function generateUUID(): string {
  // crypto.randomUUID is available in newer RN/Hermes
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: manual UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create a stable device ID for this installation.
 * Stored in the settings table.
 */
export async function getOrCreateDeviceId(db: Database): Promise<string> {
  try {
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'device_id'"
    );
    if (row?.value) return row.value;

    const deviceId = `mobile-${generateUUID().slice(0, 8)}`;
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('device_id', ?, datetime('now'))",
      [deviceId]
    );
    return deviceId;
  } catch (e) {
    console.warn('[sync-utils] Failed to get/create device_id:', e);
    return 'mobile-unknown';
  }
}

/**
 * Append a sync_log entry. Fire-and-forget — never throws.
 */
export async function appendSyncLog(
  tableName: string,
  rowId: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  changedColumns: string[] | null,
  snapshot: Record<string, unknown> | null
): Promise<void> {
  try {
    const db = getDatabase();
    const deviceId = await getOrCreateDeviceId(db);
    const id = generateUUID();
    const timestamp = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO sync_log (id, table_name, row_id, operation, changed_columns, snapshot, device_id, timestamp, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        id,
        tableName,
        rowId,
        operation,
        changedColumns ? JSON.stringify(changedColumns) : null,
        snapshot ? JSON.stringify(snapshot) : null,
        deviceId,
        timestamp,
      ]
    );
  } catch (e) {
    console.warn('[sync-utils] Failed to append sync_log:', e);
  }
}
