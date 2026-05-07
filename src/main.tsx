import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
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
