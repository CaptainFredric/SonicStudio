import { describe, expect, it } from 'vitest';

import {
  analyzePcm,
  encodePcmToWavBytes,
  normalizePcm,
  processPcmToWav,
  type PcmAudio,
} from './wavCodec';

const readAscii = (view: DataView, offset: number, length: number) => {
  let out = '';
  for (let index = 0; index < length; index += 1) {
    out += String.fromCharCode(view.getUint8(offset + index));
  }
  return out;
};

const makeTone = (frequency: number, sampleRate: number, length: number, amplitude = 0.5): Float32Array => {
  const data = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    data[index] = amplitude * Math.sin((2 * Math.PI * frequency * index) / sampleRate);
  }
  return data;
};

describe('wavCodec', () => {
  it('writes a valid 16-bit PCM WAV header for stereo audio', () => {
    const sampleRate = 48_000;
    const length = 1_000;
    const pcm: PcmAudio = {
      channels: [makeTone(440, sampleRate, length), makeTone(440, sampleRate, length)],
      sampleRate,
      length,
    };

    const bytes = encodePcmToWavBytes(pcm);
    const view = new DataView(bytes);

    expect(readAscii(view, 0, 4)).toBe('RIFF');
    expect(readAscii(view, 8, 4)).toBe('WAVE');
    expect(readAscii(view, 12, 4)).toBe('fmt ');
    expect(readAscii(view, 36, 4)).toBe('data');
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(2); // channels
    expect(view.getUint32(24, true)).toBe(sampleRate);
    expect(view.getUint16(34, true)).toBe(16); // bit depth
    // 44-byte header + interleaved 16-bit stereo data.
    expect(bytes.byteLength).toBe(44 + length * 2 * 2);
    expect(view.getUint32(40, true)).toBe(length * 2 * 2);
  });

  it('round-trips sample values through the encoder within quantization error', () => {
    const sampleRate = 44_100;
    const length = 256;
    const source = makeTone(220, sampleRate, length, 0.8);
    const bytes = encodePcmToWavBytes({ channels: [source], sampleRate, length });
    const view = new DataView(bytes);

    let maxError = 0;
    for (let index = 0; index < length; index += 1) {
      const decoded = view.getInt16(44 + index * 2, true) / 0x7fff;
      maxError = Math.max(maxError, Math.abs(decoded - source[index]));
    }
    // 16-bit quantization step is ~3e-5; allow a small multiple.
    expect(maxError).toBeLessThan(1e-3);
  });

  it('flags an effectively silent buffer as silent', () => {
    const sampleRate = 48_000;
    const length = 4_800;
    const analysis = analyzePcm({
      channels: [new Float32Array(length), new Float32Array(length)],
      sampleRate,
      length,
    });

    expect(analysis.quality).toBe('silent');
    expect(analysis.peakDb).toBeLessThanOrEqual(-90);
    expect(analysis.durationSeconds).toBeCloseTo(length / sampleRate, 5);
  });

  it('peak-normalizes a hot signal down to the requested ceiling', () => {
    const sampleRate = 48_000;
    const length = 2_048;
    const hot = makeTone(440, sampleRate, length, 1.0); // peaks at 0 dBFS
    const normalized = normalizePcm({ channels: [hot], sampleRate, length }, {
      normalization: 'peak',
      peakTargetDb: -3,
    });

    const analysis = analyzePcm(normalized, { normalization: 'peak', peakTargetDb: -3 });
    expect(analysis.peakDb).toBeLessThanOrEqual(-2.5);
    expect(analysis.peakDb).toBeGreaterThan(-3.6);
  });

  it('leaves samples untouched (zero-copy) when normalization is none', () => {
    const sampleRate = 48_000;
    const length = 512;
    const pcm: PcmAudio = { channels: [makeTone(330, sampleRate, length)], sampleRate, length };
    const result = normalizePcm(pcm, { normalization: 'none' });
    expect(result.channels[0]).toBe(pcm.channels[0]);
  });

  it('processPcmToWav returns matching analysis and decodable bytes', () => {
    const sampleRate = 48_000;
    const length = 1_024;
    const pcm: PcmAudio = { channels: [makeTone(440, sampleRate, length, 0.5)], sampleRate, length };
    const { analysis, wav } = processPcmToWav(pcm, { normalization: 'none' });

    expect(analysis.sampleRate).toBe(sampleRate);
    expect(analysis.peakDb).toBeGreaterThan(-12);
    expect(analysis.quality).not.toBe('silent');
    expect(new DataView(wav).byteLength).toBe(44 + length * 2);
  });
});
