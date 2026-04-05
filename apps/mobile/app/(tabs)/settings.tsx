/**
 * Settings page — app version, sync status, database info.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useDataProvider } from '../../services/provider-context';
import { getDatabase } from '../../services/database';
import { colors, spacing, fontSize } from '../../constants/theme';

interface TableCount {
  name: string;
  count: number;
}

export default function SettingsPage() {
  const dp = useDataProvider();
  const [syncStatus, setSyncStatus] = useState<{
    pending: number;
    lastSync: string | null;
  } | null>(null);
  const [tables, setTables] = useState<TableCount[]>([]);

  useEffect(() => {
    async function load() {
      try {
        // Sync status
        const status = await dp.sync.getStatus();
        setSyncStatus({
          pending: status.pending_changes,
          lastSync: status.last_sync,
        });

        // Table counts
        const db = getDatabase();
        const tableNames = [
          'local_tasks',
          'projects',
          'captures',
          'goals',
          'habits',
          'calendar_events',
          'documents',
        ];
        const counts: TableCount[] = [];
        for (const name of tableNames) {
          try {
            const row = await db.getFirstAsync<{ cnt: number }>(
              `SELECT COUNT(*) as cnt FROM ${name}`
            );
            counts.push({ name, count: row?.cnt ?? 0 });
          } catch {
            counts.push({ name, count: 0 });
          }
        }
        setTables(counts);
      } catch (e) {
        console.error('Failed to load settings data:', e);
      }
    }
    load();
  }, [dp]);

  return (
    <View style={styles.container}>
      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App</Text>
        <View style={styles.card}>
          <SettingsRow label="Version" value="0.1.0" />
          <SettingsRow label="Platform" value="Mobile (Expo)" />
          <SettingsRow label="Database" value="SQLite (expo-sqlite)" />
        </View>
      </View>

      {/* Sync Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync</Text>
        <View style={styles.card}>
          <SettingsRow
            label="Pending changes"
            value={String(syncStatus?.pending ?? '--')}
          />
          <SettingsRow
            label="Last sync"
            value={syncStatus?.lastSync ?? 'Never'}
          />
          <SettingsRow label="Status" value="Not configured" />
        </View>
      </View>

      {/* Database Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Database</Text>
        <View style={styles.card}>
          {tables.map((t) => (
            <SettingsRow
              key={t.name}
              label={t.name.replace(/_/g, ' ')}
              value={String(t.count)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    fontSize: fontSize.md,
    color: colors.text,
    textTransform: 'capitalize',
  },
  rowValue: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
});
