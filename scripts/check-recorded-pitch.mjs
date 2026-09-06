import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

// External recordings remain outside the app bundle. Filename pitches are
// dataset labels, not independently measured frame annotations.
const browser = await chromium.launch();
const page = await browser.newPage();
try {
  await page.goto('http://127.0.0.1:3000/');
  const inspect = async (data) => page.evaluate(async base64 => {
    const { transcribeSamples, mixToMono } = await import('/src/services/songTranscription.ts');
    const context = new AudioContext();
    try {
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const decoded = await context.decodeAudioData(bytes.buffer);
      const result = transcribeSamples(mixToMono(decoded), decoded.sampleRate, { bpm: 120 });
      const durations = {};
      for (const note of result.notes) durations[note.note] = (durations[note.note] || 0) + note.durationSteps;
      return { notes: durations, dominant: Object.keys(durations).sort((a, b) => durations[b] - durations[a])[0] ?? null };
    } finally { await context.close(); }
  }, data.toString('base64'));
  let matched = 0;
  const names = ['E2','F2','F#2','G#2','C3','C#3','D3','D#3','E3','F3','F#3','G3','G#3','A3','A#3','B3','A4'];
  let tested = 0;
  for (const name of names) {
    const url = `https://raw.githubusercontent.com/vocobox/human-voice-dataset/77248fc69fd93c40a69d49c0cade4144c5d7a9f4/data/voices/martin/notes/exports/mono/${encodeURIComponent(name)}.wav`;
    const response = await fetch(url);
    if (!response.ok) { console.log({ name, skipped: response.status }); continue; }
    const result = await inspect(Buffer.from(await response.arrayBuffer()));
    tested += 1;
    if (result.dominant === name) matched += 1;
    console.log({ label: name, ...result });
  }
  console.log({ vocalClips: tested, matchingDominantPitch: matched });
  for (const file of process.argv.slice(2)) console.log({ file, ...await inspect(await readFile(file)) });
} finally { await browser.close(); }
