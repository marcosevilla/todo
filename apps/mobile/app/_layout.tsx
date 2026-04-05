/**
 * Root layout — initializes database and wraps with DataProvider.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from '../services/database';
import { createSqliteProvider } from '../services/sqlite-provider';
import { DataProviderRoot } from '../services/provider-context';
import type { DataProvider } from '../services/data-provider';
import { colors } from '../constants/theme';

export default function RootLayout() {
  const [provider, setProvider] = useState<DataProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        await initDatabase();
        setProvider(createSqliteProvider());
      } catch (e) {
        console.error('Failed to initialize database:', e);
        setError(String(e));
      }
    }
    init();
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Database error: {error}</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!provider) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading...</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <DataProviderRoot provider={provider}>
      <View style={styles.container}>
        <Slot />
        <StatusBar style="light" />
      </View>
    </DataProviderRoot>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
});
