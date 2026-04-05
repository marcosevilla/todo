/**
 * SqliteProvider — Mobile implementation of DataProvider using expo-sqlite.
 *
 * Phase 1b: Read methods implemented, mutations are stubs.
 * Phase 1c: Will add full mutation support.
 */

import type { DataProvider } from './data-provider';
import type {
  Setting,
  LocalTask,
  Project,
  Capture,
  Habit,
  HabitWithStats,
  GoalWithProgress,
} from '@daily-triage/types';
import { getDatabase } from './database';

const stub = (name: string) => {
  console.warn(`[SqliteProvider] ${name} is not yet implemented (stub)`);
  return Promise.resolve(undefined as never);
};

export function createSqliteProvider(): DataProvider {
  return {
    settings: {
      async checkSetupComplete() {
        const db = getDatabase();
        const row = await db.getFirstAsync<{ value: string }>(
          "SELECT value FROM settings WHERE key = 'setup_complete'"
        );
        return row?.value === 'true';
      },
      async get(key: string) {
        const db = getDatabase();
        const row = await db.getFirstAsync<{ value: string }>(
          'SELECT value FROM settings WHERE key = ?',
          key
        );
        return row?.value ?? null;
      },
      set: (key, value) => stub(`settings.set(${key})`),
      async getAll() {
        const db = getDatabase();
        return db.getAllAsync<Setting>('SELECT key, value FROM settings');
      },
      clearAll: () => stub('settings.clearAll'),
    },

    obsidian: {
      readTodayMd: () => stub('obsidian.readTodayMd'),
      toggleCheckbox: () => stub('obsidian.toggleCheckbox'),
      importCaptures: () => stub('obsidian.importCaptures'),
    },

    todoist: {
      fetchTasks: () => stub('todoist.fetchTasks'),
      refreshTasks: () => stub('todoist.refreshTasks'),
      completeTask: () => stub('todoist.completeTask'),
      snoozeTask: () => stub('todoist.snoozeTask'),
    },

    calendar: {
      fetchEvents: () => stub('calendar.fetchEvents'),
      getCachedEvents: () => stub('calendar.getCachedEvents'),
      getFeeds: () => stub('calendar.getFeeds'),
      addFeed: () => stub('calendar.addFeed'),
      removeFeed: () => stub('calendar.removeFeed'),
    },

    captures: {
      async list(limit?: number, _includeConverted?: boolean) {
        const db = getDatabase();
        const sql = limit
          ? 'SELECT * FROM captures ORDER BY created_at DESC LIMIT ?'
          : 'SELECT * FROM captures ORDER BY created_at DESC';
        return limit
          ? db.getAllAsync<Capture>(sql, limit)
          : db.getAllAsync<Capture>(sql);
      },
      create: () => stub('captures.create'),
      convertToTask: () => stub('captures.convertToTask'),
      delete: () => stub('captures.delete'),
      readQuickCaptures: () => stub('captures.readQuickCaptures'),
      writeQuickCapture: () => stub('captures.writeQuickCapture'),
    },

    captureRoutes: {
      list: () => stub('captureRoutes.list'),
      create: () => stub('captureRoutes.create'),
      update: () => stub('captureRoutes.update'),
      delete: () => stub('captureRoutes.delete'),
      route: () => stub('captureRoutes.route'),
    },

    projects: {
      async list() {
        const db = getDatabase();
        return db.getAllAsync<Project>(
          'SELECT id, name, color, position FROM projects ORDER BY position'
        );
      },
      create: () => stub('projects.create'),
      update: () => stub('projects.update'),
      delete: () => stub('projects.delete'),
    },

    tasks: {
      async list(opts) {
        const db = getDatabase();
        let sql = 'SELECT * FROM local_tasks WHERE 1=1';
        const params: (string | number)[] = [];

        if (opts?.projectId) {
          sql += ' AND project_id = ?';
          params.push(opts.projectId);
        }
        if (opts?.dueDate) {
          sql += ' AND due_date = ?';
          params.push(opts.dueDate);
        }
        if (!opts?.includeCompleted) {
          sql += " AND status != 'complete'";
        }

        sql += ' ORDER BY position';

        const rows = await db.getAllAsync<Omit<LocalTask, 'completed'> & { completed: number }>(sql, ...params);
        return rows.map((r) => ({
          ...r,
          completed: Boolean(r.completed),
        }));
      },
      create: () => stub('tasks.create'),
      update: () => stub('tasks.update'),
      updateStatus: () => stub('tasks.updateStatus'),
      complete: () => stub('tasks.complete'),
      uncomplete: () => stub('tasks.uncomplete'),
      delete: () => stub('tasks.delete'),
      reorder: () => stub('tasks.reorder'),
    },

    docs: {
      getFolders: () => stub('docs.getFolders'),
      createFolder: () => stub('docs.createFolder'),
      renameFolder: () => stub('docs.renameFolder'),
      deleteFolder: () => stub('docs.deleteFolder'),
      getDocuments: () => stub('docs.getDocuments'),
      getDocument: () => stub('docs.getDocument'),
      createDocument: () => stub('docs.createDocument'),
      updateDocument: () => stub('docs.updateDocument'),
      deleteDocument: () => stub('docs.deleteDocument'),
      searchDocuments: () => stub('docs.searchDocuments'),
      getNotes: () => stub('docs.getNotes'),
      createNote: () => stub('docs.createNote'),
      deleteNote: () => stub('docs.deleteNote'),
      reorderNotes: () => stub('docs.reorderNotes'),
    },

    activity: {
      log: () => stub('activity.log'),
      getLog: () => stub('activity.getLog'),
      getSummary: () => stub('activity.getSummary'),
    },

    focus: {
      startSession: () => stub('focus.startSession'),
      endSession: () => stub('focus.endSession'),
      getActive: async () => ({
        task_id: null,
        started_at: null,
        paused_at: null,
      }),
    },

    dailyState: {
      async get() {
        const db = getDatabase();
        const today = new Date().toISOString().split('T')[0];
        const row = await db.getFirstAsync<{
          date: string;
          energy_level: string | null;
          top_priorities: string | null;
        }>('SELECT * FROM daily_state WHERE date = ?', today);

        return {
          date: today,
          energy_level: row?.energy_level ?? null,
          priorities: row?.top_priorities
            ? JSON.parse(row.top_priorities)
            : null,
          review_complete: false,
        };
      },
      generatePriorities: () => stub('dailyState.generatePriorities'),
      readSessionLog: async () => null,
      readDailyBrief: async () => null,
      listBriefDates: async () => [],
      saveProgress: () => stub('dailyState.saveProgress'),
    },

    goals: {
      async list() {
        const db = getDatabase();
        const goals = await db.getAllAsync<GoalWithProgress>(
          `SELECT g.*,
            COALESCE(
              (SELECT COUNT(*) FROM milestones WHERE goal_id = g.id), 0
            ) as milestone_count,
            COALESCE(
              (SELECT COUNT(*) FROM milestones WHERE goal_id = g.id AND completed = 1), 0
            ) as milestone_completed,
            0 as task_count,
            0 as task_completed,
            0 as progress
          FROM goals g ORDER BY g.position`
        );
        return goals;
      },
      get: () => stub('goals.get'),
      create: () => stub('goals.create'),
      update: () => stub('goals.update'),
      delete: () => stub('goals.delete'),
      getMilestones: () => stub('goals.getMilestones'),
      createMilestone: () => stub('goals.createMilestone'),
      updateMilestone: () => stub('goals.updateMilestone'),
      deleteMilestone: () => stub('goals.deleteMilestone'),
      getLifeAreas: () => stub('goals.getLifeAreas'),
      createLifeArea: () => stub('goals.createLifeArea'),
      updateLifeArea: () => stub('goals.updateLifeArea'),
      deleteLifeArea: () => stub('goals.deleteLifeArea'),
      importFromVault: () => stub('goals.importFromVault'),
    },

    habits: {
      async list() {
        const db = getDatabase();
        const today = new Date().toISOString().split('T')[0];
        const habits = await db.getAllAsync<Omit<Habit, 'active'> & { active: number }>(
          'SELECT * FROM habits WHERE active = 1 ORDER BY position'
        );
        const result: HabitWithStats[] = [];
        for (const h of habits) {
          const log = await db.getFirstAsync<{ intensity: number }>(
            'SELECT intensity FROM habit_logs WHERE habit_id = ? AND date = ?',
            h.id,
            today
          );
          result.push({
            ...h,
            active: Boolean(h.active),
            current_momentum: 0,
            today_completed: !!log,
            today_intensity: log?.intensity ?? 0,
          });
        }
        return result;
      },
      create: () => stub('habits.create'),
      update: () => stub('habits.update'),
      delete: () => stub('habits.delete'),
      log: () => stub('habits.log'),
      unlog: () => stub('habits.unlog'),
      getLogs: () => stub('habits.getLogs'),
      getHeatmap: () => stub('habits.getHeatmap'),
    },

    ai: {
      breakDownTask: () => stub('ai.breakDownTask'),
    },

    system: {
      openUrl: () => stub('system.openUrl'),
      checkForUpdates: async () => ({
        current_version: '0.1.0',
        latest_version: null,
        update_available: false,
        release_url: null,
        error: null,
      }),
    },

    sync: {
      push: () => stub('sync.push'),
      pull: () => stub('sync.pull'),
      async getStatus() {
        const db = getDatabase();
        const row = await db.getFirstAsync<{ cnt: number }>(
          'SELECT COUNT(*) as cnt FROM sync_log WHERE synced = 0'
        );
        return {
          pending_changes: row?.cnt ?? 0,
          last_sync: null,
          device_id: 'mobile',
        };
      },
      configure: () => stub('sync.configure'),
    },
  };
}
