/**
 * Settings page — app version, sync status, database info, sync_log count.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
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
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
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
        'habit_logs',
        'sync_log',
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
    } finally {
      setRefreshing(false);
    }
  }, [dp]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
        />
      }
    >
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
            highlight={syncStatus != null && syncStatus.pending > 0}
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
          {tables.map((t, i) => (
            <SettingsRow
              key={t.name}
              label={t.name.replace(/_/g, ' ')}
              value={String(t.count)}
              isLast={i === tables.length - 1}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function SettingsRow({
  label,
  value,
  highlight,
  isLast,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight && styles.rowValueHighlight]}>
        {value}
      </Text>
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
  rowLast: {
    borderBottomWidth: 0,
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
  rowValueHighlight: {
    color: colors.accent,
    fontWeight: '600',
  },
});
