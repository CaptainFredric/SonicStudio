import { readJson, removeKey, writeJson } from '../utils/safeStorage';

const STORAGE_KEY = 'sonicstudio:ui-reminders:v1';

export type UiReminderKey = 'capture-copy' | 'workspace-options-copy';

interface UiRemindersState {
  seen: Partial<Record<UiReminderKey, boolean>>;
  updatedAt: string;
  version: 1;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const emptyState = (): UiRemindersState => ({
  seen: {},
  updatedAt: new Date(0).toISOString(),
  version: 1,
});

const loadState = (): UiRemindersState => (
  readJson<UiRemindersState>(STORAGE_KEY, emptyState(), (parsed) => {
    if (!isRecord(parsed) || !isRecord(parsed.seen)) {
      return emptyState();
    }
    return {
      seen: parsed.seen as Partial<Record<UiReminderKey, boolean>>,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      version: 1,
    };
  })
);

const saveState = (state: UiRemindersState) => {
  writeJson(STORAGE_KEY, state);
};

export const hasSeenUiReminder = (key: UiReminderKey): boolean => (
  loadState().seen[key] === true
);

export const markUiReminderSeen = (key: UiReminderKey) => {
  const current = loadState();
  if (current.seen[key]) {
    return;
  }

  saveState({
    ...current,
    seen: {
      ...current.seen,
      [key]: true,
    },
    updatedAt: new Date().toISOString(),
  });
};

export const resetUiReminders = () => {
  removeKey(STORAGE_KEY);
};
