import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Fade out and remove the boot splash once React has mounted. requestAnimationFrame
// guarantees the first paint of the studio shell happens before the splash starts
// fading, so the user never sees a flash of unstyled background.
const splash = document.getElementById('boot-splash');
if (splash) {
  requestAnimationFrame(() => {
    splash.style.opacity = '0';
    splash.style.pointerEvents = 'none';
    window.setTimeout(() => splash.remove(), 220);
  });
}

// Register the service worker in production only, so the studio is installable
// and runs offline after the first visit. Dev is left alone to keep HMR fast.
// Registration is best-effort: a failure here never blocks the app.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(() => {
        /* offline support is optional; ignore registration failures */
      });
  });
}
