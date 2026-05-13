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
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const payload: PersistedOnboardingState = {
      status,
      updatedAt: new Date().toISOString(),
      version: 1,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn('SonicStudio: failed to persist onboarding status', error);
    }
  }
};

export const loadOnboardingStatus = (): OnboardingStatus => {
  if (typeof window === 'undefined') {
    return 'new';
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return 'new';
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return 'new';
    }

    return parsed.status === 'completed' || parsed.status === 'skipped'
      ? parsed.status
      : 'new';
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn('SonicStudio: failed to load onboarding status', error);
    }
    return 'new';
  }
};

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