/**
 * Today page — greeting + today's tasks.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useDataProvider } from '../../services/provider-context';
import type { LocalTask } from '@daily-triage/types';
import { colors, spacing, fontSize } from '../../constants/theme';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const priorityColors: Record<number, string> = {
  1: colors.priority1,
  2: colors.priority2,
  3: colors.priority3,
  4: colors.priority4,
};

export default function TodayPage() {
  const dp = useDataProvider();
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const all = await dp.tasks.list({ includeCompleted: false });
        setTasks(all);
      } catch (e) {
        console.error('Failed to load tasks:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dp]);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.date}>{today}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Open tasks{' '}
          <Text style={styles.count}>({tasks.length})</Text>
        </Text>

        {loading ? (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Loading tasks...</Text>
          </View>
        ) : tasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nothing here yet</Text>
            <Text style={styles.emptySubtext}>
              Tasks will appear once synced from desktop
            </Text>
          </View>
        ) : (
          <FlatList
            data={tasks}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.taskRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: priorityColors[item.priority] || colors.priority1 },
                  ]}
                />
                <View style={styles.taskContent}>
                  <Text style={styles.taskText} numberOfLines={1}>
                    {item.content}
                  </Text>
                  {item.due_date && (
                    <Text style={styles.taskMeta}>{item.due_date}</Text>
                  )}
                </View>
              </View>
            )}
            contentContainerStyle={styles.list}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  greeting: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.text,
  },
  date: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  section: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  count: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  list: {
    gap: 2,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    marginBottom: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  taskContent: {
    flex: 1,
  },
  taskText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  taskMeta: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  placeholder: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  placeholderText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
  },
  emptyState: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
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
