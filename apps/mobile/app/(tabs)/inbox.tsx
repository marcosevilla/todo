/**
 * Inbox page — list of captures, most recent first.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useDataProvider } from '../../services/provider-context';
import type { Capture } from '@daily-triage/types';
import { colors, spacing, fontSize } from '../../constants/theme';

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function InboxPage() {
  const dp = useDataProvider();
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const items = await dp.captures.list(50);
        setCaptures(items);
      } catch (e) {
        console.error('Failed to load captures:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dp]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading captures...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {captures.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Inbox is empty</Text>
          <Text style={styles.emptySubtext}>
            Captures will appear here once synced
          </Text>
        </View>
      ) : (
        <FlatList
          data={captures}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.captureCard}>
              <Text style={styles.captureContent}>{item.content}</Text>
              <View style={styles.captureMeta}>
                <Text style={styles.timestamp}>
                  {formatTimestamp(item.created_at)}
                </Text>
                {item.source !== 'manual' && (
                  <Text style={styles.source}>{item.source}</Text>
                )}
                {item.routed_to && (
                  <View style={styles.routeBadge}>
                    <Text style={styles.routeText}>{item.routed_to}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        />
      )}
    </View>
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
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  captureCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    padding: spacing.md,
  },
  captureContent: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 22,
  },
  captureMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  timestamp: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  source: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    opacity: 0.7,
  },
  routeBadge: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  routeText: {
    fontSize: fontSize.xs,
    color: colors.accent,
    fontWeight: '500',
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fontSize.lg,
    fontWeight: '500',
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
});
