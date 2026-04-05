/**
 * Settings page — Turso sync config, sync status, database info.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useDataProvider } from '../../services/provider-context';
import { getDatabase } from '../../services/database';
import { colors, spacing, fontSize } from '../../constants/theme';
import * as sync from '../../services/sync';

interface TableCount {
  name: string;
  count: number;
}

export default function SettingsPage() {
  const dp = useDataProvider();
  const [syncStatus, setSyncStatus] = useState<{
    pending: number;
    lastSync: string | null;
    deviceId: string;
    configured: boolean;
    initialized: boolean;
  } | null>(null);
  const [tables, setTables] = useState<TableCount[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Turso config inputs
  const [tursoUrl, setTursoUrl] = useState('');
  const [tursoToken, setTursoToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // Sync status
      const status = await sync.getSyncStatus();
      setSyncStatus({
        pending: status.pending_changes,
        lastSync: status.last_sync,
        deviceId: status.device_id,
        configured: status.turso_configured,
        initialized: status.remote_initialized,
      });

      // Load saved Turso credentials into inputs
      const db = getDatabase();
      const urlRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'turso_url'"
      );
      const tokenRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'turso_token'"
      );
      if (urlRow?.value) setTursoUrl(urlRow.value);
      if (tokenRow?.value) setTursoToken(tokenRow.value);

      // Table counts
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
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleSave = useCallback(async () => {
    const url = tursoUrl.trim();
    const token = tursoToken.trim();
    if (!url || !token) {
      Alert.alert('Missing fields', 'Both Turso URL and token are required.');
      return;
    }
    setSaving(true);
    try {
      await dp.sync.configure(url, token);
      Alert.alert('Saved', 'Turso credentials saved.');
      loadData();
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setSaving(false);
    }
  }, [tursoUrl, tursoToken, dp, loadData]);

  const handleTest = useCallback(async () => {
    const url = tursoUrl.trim();
    const token = tursoToken.trim();
    if (!url || !token) {
      Alert.alert('Missing fields', 'Save your Turso credentials first.');
      return;
    }
    setTesting(true);
    try {
      await sync.testConnection(url, token);
      Alert.alert('Success', 'Connected to Turso successfully.');
    } catch (e) {
      Alert.alert('Connection failed', String(e));
    } finally {
      setTesting(false);
    }
  }, [tursoUrl, tursoToken]);

  const handleInitialize = useCallback(async () => {
    const url = tursoUrl.trim();
    const token = tursoToken.trim();
    if (!url || !token) {
      Alert.alert('Missing fields', 'Save your Turso credentials first.');
      return;
    }
    setInitializing(true);
    try {
      await sync.initializeRemote(url, token);
      Alert.alert('Done', 'Remote database initialized.');
      loadData();
    } catch (e) {
      Alert.alert('Initialization failed', String(e));
    } finally {
      setInitializing(false);
    }
  }, [tursoUrl, tursoToken, loadData]);

  const handleSyncNow = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await sync.fullSync();
      Alert.alert(
        'Sync complete',
        `Pushed ${result.pushed} change${result.pushed !== 1 ? 's' : ''}, pulled ${result.pulled} change${result.pulled !== 1 ? 's' : ''}.`
      );
      loadData();
    } catch (e) {
      Alert.alert('Sync failed', String(e));
    } finally {
      setSyncing(false);
    }
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
          <SettingsRow label="Database" value="SQLite (expo-sqlite)" isLast />
        </View>
      </View>

      {/* Turso Configuration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Turso Sync</Text>
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Turso URL</Text>
            <TextInput
              style={styles.input}
              value={tursoUrl}
              onChangeText={setTursoUrl}
              placeholder="libsql://your-db.turso.io"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Auth Token</Text>
            <TextInput
              style={styles.input}
              value={tursoToken}
              onChangeText={setTursoToken}
              placeholder="eyJhbGciOi..."
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.button}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.buttonText}>Save</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.buttonSecondary}
              onPress={handleTest}
              disabled={testing}
              activeOpacity={0.7}
            >
              {testing ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <Text style={styles.buttonSecondaryText}>Test</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Sync Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync Status</Text>
        <View style={styles.card}>
          <SettingsRow
            label="Device ID"
            value={syncStatus?.deviceId ?? '--'}
          />
          <SettingsRow
            label="Configured"
            value={syncStatus?.configured ? 'Yes' : 'No'}
          />
          <SettingsRow
            label="Remote initialized"
            value={syncStatus?.initialized ? 'Yes' : 'No'}
          />
          <SettingsRow
            label="Pending changes"
            value={String(syncStatus?.pending ?? '--')}
            highlight={syncStatus != null && syncStatus.pending > 0}
          />
          <SettingsRow
            label="Last sync"
            value={
              syncStatus?.lastSync
                ? new Date(syncStatus.lastSync).toLocaleString()
                : 'Never'
            }
            isLast
          />
        </View>
        <View style={styles.actionRow}>
          {syncStatus?.configured && !syncStatus?.initialized && (
            <TouchableOpacity
              style={styles.button}
              onPress={handleInitialize}
              disabled={initializing}
              activeOpacity={0.7}
            >
              {initializing ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.buttonText}>Initialize Remote DB</Text>
              )}
            </TouchableOpacity>
          )}
          {syncStatus?.configured && (
            <TouchableOpacity
              style={styles.button}
              onPress={handleSyncNow}
              disabled={syncing}
              activeOpacity={0.7}
            >
              {syncing ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.buttonText}>Sync Now</Text>
              )}
            </TouchableOpacity>
          )}
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
    flex: 1,
  },
  rowValue: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    flexShrink: 1,
    textAlign: 'right',
    maxWidth: '60%',
  },
  rowValueHighlight: {
    color: colors.accent,
    fontWeight: '600',
  },
  // Input fields
  inputGroup: {
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 8,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.bgSurface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: fontSize.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Buttons
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    paddingTop: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  button: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  buttonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: fontSize.sm,
  },
  buttonSecondary: {
    backgroundColor: colors.bgSurface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  buttonSecondaryText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: fontSize.sm,
  },
});
