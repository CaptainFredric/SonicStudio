import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Exercise the actual browser workflow with a deterministic three-note WAV.
const rate = 22050;
const samples = rate * 3;
const wav = Buffer.alloc(44 + samples * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
for (let i = 0; i < samples; i += 1) {
  const phase = (i % rate) / rate;
  const envelope = Math.min(1, phase * 40, (1 - phase) * 40);
  const hz = [440, 523.25, 659.25][Math.floor(i / rate)];
  wav.writeInt16LE(Math.round(10000 * envelope * Math.sin(2 * Math.PI * hz * i / rate)), 44 + i * 2);
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(15000);
const url = process.env.SONIC_TEST_URL || 'http://127.0.0.1:3000/';
try {
  await page.goto(`${url}?demo=night-transit&view=song`);
  await page.getByRole('button', { name: /transcribe/i }).first().click();
  await page.locator('input[type=file][accept="audio/*"]').setInputFiles({ name: 'phrase.wav', mimeType: 'audio/wav', buffer: wav });
  const notes = page.getByRole('button', { name: /^[A-G]#?\d, step \d+, length \d+$/ });
  await notes.first().waitFor();
  assert.ok(await notes.count() >= 3, 'detect the three pitches');
  const note = notes.first();
  const original = await note.getAttribute('aria-label');
  await note.scrollIntoViewIfNeeded();
  const box = await note.boundingBox();
  await page.mouse.move(box.x + 8, box.y + 14);
  await page.mouse.down();
  await page.mouse.move(box.x + 50, box.y + 4, { steps: 5 });
  await page.mouse.up();
  assert.notEqual(await note.getAttribute('aria-label'), original, 'drag edits note');
  await page.getByRole('button', { name: 'Undo edit', exact: true }).click();
  assert.equal(await note.getAttribute('aria-label'), original, 'undo restores drag');
  await note.focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Control+z');
  assert.equal(await note.getAttribute('aria-label'), original, 'keyboard undo restores pitch');
  const count = await notes.count();
  await page.keyboard.press('Delete');
  assert.equal(await notes.count(), count - 1, 'keyboard delete removes one note');
  await page.getByRole('button', { name: 'Undo edit', exact: true }).click();
  assert.equal(await notes.count(), count, 'undo restores deleted note');
  const resize = await note.boundingBox();
  await page.mouse.move(resize.x + resize.width - 3, resize.y + 14);
  await page.mouse.down();
  await page.mouse.move(resize.x + resize.width + 40, resize.y + 14, { steps: 5 });
  await page.mouse.up();
  assert.notEqual(await note.getAttribute('aria-label'), original, 'resize edits duration');
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.getByRole('dialog').evaluate(e => e.scrollWidth > e.clientWidth), false);
  }
  await page.getByRole('button', { name: /Add lane at P/ }).click();
  await page.waitForFunction(() => {
    const saved = JSON.parse(localStorage.getItem('sonicstudio:session:v1') || 'null');
    return saved?.session?.project?.tracks?.some(t => t.name === 'phrase melody');
  });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('sonicstudio:session:v1')).session);
  assert.equal(stored.project.tracks.length, 7, 'keep existing six tracks and append melody');
  await page.goto(url);
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await page.getByRole('button', { name: 'Save file', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save session file', exact: true }).click();
  const download = await downloading;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.deepEqual(exported.project.tracks, stored.project.tracks, 'reload and file export retain all notes');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const bouncing = page.waitForEvent('download', { timeout: 60000 });
  await page.getByRole('button', { name: 'Bounce WAV', exact: true }).click();
  const audio = await bouncing;
  const bytes = await readFile(await audio.path());
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  assert.ok(bytes.length > 1000, 'audio export contains samples');
  assert.ok(bytes.subarray(128).some(value => value !== 0), 'audio export contains sound');
  console.log('PASS: import, detect, drag, undo, resize, responsive layout, append, autosave, reload, JSON export, WAV bounce');
} finally {
  await browser.close();
}
