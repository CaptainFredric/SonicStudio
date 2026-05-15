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

const loadState = (): UiRemindersState => {
  if (typeof window === 'undefined') {
    return {
      seen: {},
      updatedAt: new Date(0).toISOString(),
      version: 1,
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        seen: {},
        updatedAt: new Date(0).toISOString(),
        version: 1,
      };
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.seen)) {
      return {
        seen: {},
        updatedAt: new Date(0).toISOString(),
        version: 1,
      };
    }

    return {
      seen: parsed.seen as Partial<Record<UiReminderKey, boolean>>,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      version: 1,
    };
  } catch {
    return {
      seen: {},
      updatedAt: new Date(0).toISOString(),
      version: 1,
    };
  }
};

const saveState = (state: UiRemindersState) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore browser storage errors for non-critical reminder hints.
  }
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
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore browser storage errors for non-critical reminder hints.
  }
};
