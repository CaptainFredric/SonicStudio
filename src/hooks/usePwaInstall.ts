import { useCallback, useEffect, useState } from 'react';

// The browser-fired install event is not in the standard DOM lib, so the small
// shape we use is declared here.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaInstallState {
  canInstall: boolean;
  promptInstall: () => Promise<void>;
}

// Surfaces the browser's deferred install prompt so the studio can offer its
// own "Install app" affordance. Returns canInstall only when the browser has
// said the app is installable and it is not already running standalone.
// Quietly does nothing on browsers that never fire the event (Safari, Firefox).
export const usePwaInstall = (): PwaInstallState => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      // Stop the browser's default mini-infobar so we can trigger it on demand.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);

    if (window.matchMedia?.('(display-mode: standalone)')?.matches) {
      setInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) {
      return;
    }
    void deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* the user dismissing the prompt is not an error */
    }
    // The prompt can only be used once; drop it either way.
    setDeferred(null);
  }, [deferred]);

  return { canInstall: Boolean(deferred) && !installed, promptInstall };
};
