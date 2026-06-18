// Regenerate the README / Open Graph images from the real running app, so the
// project's visuals can't silently fall out of date again. Run with a dev or
// preview server up:
//
//   npm run dev                 # in one shell (serves http://127.0.0.1:4321 if --port 4321)
//   npm run capture:hero        # in another, points at CAPTURE_URL
//
// Override the target with CAPTURE_URL=http://127.0.0.1:3000 npm run capture:hero
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE = (process.env.CAPTURE_URL || 'http://127.0.0.1:4321').replace(/\/$/, '');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'share');

// Both images are 1200x630 (Open Graph aspect). The hero shows the workspace a
// returning user lives in; the thumbnail shows the starter library a new visitor
// meets first.
const shots = [
  { name: 'sonicstudio-hero.png', url: `${BASE}/?template=night-transit`, waitFor: 'button[aria-label="Play"]' },
  { name: 'sonicstudio-thumbnail.png', url: `${BASE}/?launch=1`, waitFor: 'text=/pick a starting point/i' },
];

const browser = await chromium.launch();
try {
  for (const shot of shots) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.goto(shot.url, { waitUntil: 'networkidle' });
    await page.waitForSelector(shot.waitFor, { timeout: 15000 }).catch(() => {});
    // Let the boot splash finish fading and the first paint settle.
    await page.waitForFunction(() => !document.getElementById('boot-splash'), { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, shot.name) });
    console.log(`captured ${shot.name} from ${shot.url}`);
    await page.close();
  }
} finally {
  await browser.close();
}
