import { readJson, removeKey, writeJson } from '../utils/safeStorage';

const STORAGE_KEY = 'sonicstudio:onboarding:v1';

export type OnboardingStatus = 'new' | 'skipped' | 'completed';

interface PersistedOnboardingState {
  status: OnboardingStatus;
  updatedAt: string;
  version: 1;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const persistStatus = (status: OnboardingStatus) => {
  const payload: PersistedOnboardingState = {
    status,
    updatedAt: new Date().toISOString(),
    version: 1,
  };
  const result = writeJson(STORAGE_KEY, payload);
  if (!result.ok && typeof console !== 'undefined') {
    console.warn(`SonicStudio: failed to persist onboarding status (${result.reason})`);
  }
};

export const loadOnboardingStatus = (): OnboardingStatus => (
  readJson<OnboardingStatus>(STORAGE_KEY, 'new', (parsed) => (
    isRecord(parsed) && (parsed.status === 'completed' || parsed.status === 'skipped')
      ? parsed.status
      : 'new'
  ))
);

export const shouldAutoOpenOnboarding = () => loadOnboardingStatus() === 'new';

export const markOnboardingCompleted = () => {
  persistStatus('completed');
};

export const markOnboardingSkipped = () => {
  if (loadOnboardingStatus() === 'completed') {
    return;
  }

  persistStatus('skipped');
};

export const resetOnboardingStatus = () => {
  removeKey(STORAGE_KEY);
};