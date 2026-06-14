import { describe, expect, it } from 'vitest';

import { decodeSharePayload, encodeSharePayload } from './shareCodec';

// The original scheme, reproduced here so the back-compat test pins the exact
// shape of links shared before gzip.
const legacyEncode = (text: string): string => btoa(unescape(encodeURIComponent(text)));

const sampleSession = JSON.stringify({
  v: 1,
  session: {
    name: 'Pirate Radio',
    bpm: 133,
    tracks: Array.from({ length: 6 }, (_, lane) => ({
      id: `track-${lane}`,
      type: 'pluck',
      name: `Lane ${lane}`,
      patterns: { 0: Array.from({ length: 16 }, (_, step) => (step % 4 === 0 ? [{ note: 'A3', velocity: 0.8, gate: 1 }] : [])) },
    })),
  },
  manualKeyOverride: { rootName: 'A', mode: 'minor' },
});

describe('shareCodec', () => {
  it('round-trips a session through encode/decode', async () => {
    const encoded = await encodeSharePayload(sampleSession);
    expect(await decodeSharePayload(encoded)).toBe(sampleSession);
  });

  it('produces a gzip-prefixed link that is much shorter than raw base64', async () => {
    const encoded = await encodeSharePayload(sampleSession);
    expect(encoded.startsWith('g:')).toBe(true);
    // Compression should beat the old raw-base64 length by a wide margin on a
    // repetitive session.
    expect(encoded.length).toBeLessThan(legacyEncode(sampleSession).length * 0.7);
  });

  it('uses only URL-safe characters in the gzip payload', async () => {
    const encoded = await encodeSharePayload(sampleSession);
    const body = encoded.slice(2); // drop the "g:" marker
    expect(body).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('still decodes legacy (uncompressed) links', async () => {
    const legacy = legacyEncode(sampleSession);
    expect(legacy.startsWith('g:')).toBe(false);
    expect(await decodeSharePayload(legacy)).toBe(sampleSession);
  });

  it('round-trips unicode content', async () => {
    const unicode = JSON.stringify({ name: 'Résumé · 夜 · 🎹', note: 'C♯' });
    expect(await decodeSharePayload(await encodeSharePayload(unicode))).toBe(unicode);
  });
});
