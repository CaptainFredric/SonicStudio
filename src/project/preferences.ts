export type MotionMode = 'fluid' | 'focus' | 'still';

export interface StudioPreferences {
  motionMode: MotionMode;
  uiSoundsEnabled: boolean;
}

const STUDIO_PREFERENCES_KEY = 'sonicstudio:preferences:v1';

export const DEFAULT_STUDIO_PREFERENCES: StudioPreferences = {
  motionMode: 'fluid',
  uiSoundsEnabled: true,
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

export const normalizeStudioPreferences = (value: unknown): StudioPreferences => {
  const candidate = isRecord(value) ? value : {};

  return {
    motionMode: candidate.motionMode === 'focus' || candidate.motionMode === 'still'
      ? candidate.motionMode
      : 'fluid',
    uiSoundsEnabled: typeof candidate.uiSoundsEnabled === 'boolean'
      ? candidate.uiSoundsEnabled
      : true,
  };
};

export const loadStudioPreferences = (): StudioPreferences => {
  if (typeof window === 'undefined') {
    return DEFAULT_STUDIO_PREFERENCES;
  }

  try {
    const raw = window.localStorage.getItem(STUDIO_PREFERENCES_KEY);
    if (!raw) {
      return DEFAULT_STUDIO_PREFERENCES;
    }

    return normalizeStudioPreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_STUDIO_PREFERENCES;
  }
};

export const persistStudioPreferences = (preferences: StudioPreferences): StudioPreferences => {
  const normalized = normalizeStudioPreferences(preferences);

  if (typeof window === 'undefined') {
    return normalized;
  }

  try {
    window.localStorage.setItem(STUDIO_PREFERENCES_KEY, JSON.stringify(normalized));
  } catch {
    return normalized;
  }

  return normalized;
};
