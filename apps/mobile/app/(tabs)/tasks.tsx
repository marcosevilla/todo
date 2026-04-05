/**
 * Tasks page — project list with task counts, expandable to show tasks.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useDataProvider } from '../../services/provider-context';
import type { Project, LocalTask } from '@daily-triage/types';
import { colors, spacing, fontSize } from '../../constants/theme';

const priorityColors: Record<number, string> = {
  1: colors.priority1,
  2: colors.priority2,
  3: colors.priority3,
  4: colors.priority4,
};

const statusIcons: Record<string, string> = {
  backlog: '○',
  todo: '◎',
  in_progress: '◉',
  blocked: '⊘',
  complete: '●',
};

interface ProjectWithTasks extends Project {
  tasks: LocalTask[];
}

export default function TasksPage() {
  const dp = useDataProvider();
  const [projects, setProjects] = useState<ProjectWithTasks[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const projectList = await dp.projects.list();
        const withTasks: ProjectWithTasks[] = [];

        for (const p of projectList) {
          const tasks = await dp.tasks.list({
            projectId: p.id,
            includeCompleted: false,
          });
          withTasks.push({ ...p, tasks });
        }

        setProjects(withTasks);
      } catch (e) {
        console.error('Failed to load projects:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dp]);

  const toggleProject = useCallback(
    (id: string) => {
      setExpandedId((prev) => (prev === id ? null : id));
    },
    []
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading projects...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: project }) => (
          <View style={styles.projectCard}>
            <TouchableOpacity
              style={styles.projectHeader}
              onPress={() => toggleProject(project.id)}
              activeOpacity={0.7}
            >
              <View style={styles.projectLeft}>
                <View
                  style={[styles.colorDot, { backgroundColor: project.color }]}
                />
                <Text style={styles.projectName}>{project.name}</Text>
              </View>
              <Text style={styles.taskCount}>
                {project.tasks.length}{' '}
                {project.tasks.length === 1 ? 'task' : 'tasks'}
              </Text>
            </TouchableOpacity>

            {expandedId === project.id && project.tasks.length > 0 && (
              <View style={styles.taskList}>
                {project.tasks.map((task) => (
                  <View key={task.id} style={styles.taskRow}>
                    <Text
                      style={[
                        styles.statusIcon,
                        {
                          color:
                            priorityColors[task.priority] || colors.priority1,
                        },
                      ]}
                    >
                      {statusIcons[task.status] || '○'}
                    </Text>
                    <View style={styles.taskContent}>
                      <Text style={styles.taskText} numberOfLines={2}>
                        {task.content}
                      </Text>
                      {task.due_date && (
                        <Text style={styles.taskMeta}>{task.due_date}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {expandedId === project.id && project.tasks.length === 0 && (
              <View style={styles.emptyProject}>
                <Text style={styles.emptyText}>No open tasks</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No projects yet</Text>
          </View>
        }
      />
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
    paddingVertical: spacing.xl * 2,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  projectCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    overflow: 'hidden',
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  projectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  projectName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  taskCount: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  taskList: {
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingBottom: spacing.xs,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  statusIcon: {
    fontSize: 14,
    marginRight: 10,
    marginTop: 2,
  },
  taskContent: {
    flex: 1,
  },
  taskText: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 20,
  },
  taskMeta: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  emptyProject: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
