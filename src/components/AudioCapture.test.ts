import { describe, expect, it } from 'vitest';

import type { CaptureSuggestion, LiveCaptureFrame } from '../services/audioRecording';
import { isStableCaptureFrame, scoreStableCaptureFrame } from './AudioCapture';

const baseSuggestion: CaptureSuggestion = {
  confidence: 0.72,
  controls: {
    attack: 0.01,
    bitCrush: 0,
    cutoff: 2200,
    decay: 0.18,
    delaySend: 0.14,
    detune: 0,
    distortion: 0.08,
    filterMode: 'lowpass',
    octaveShift: 0,
    portamento: 0.02,
    release: 0.4,
    resonance: 1.2,
    reverbSend: 0.22,
    sustain: 0.38,
    waveform: 'triangle',
  },
  note: 'A3',
  presetId: null,
  presetLabel: 'Warm Body',
  reason: 'steady pitched note',
  trackType: 'lead',
};

const createLiveFrame = (overrides: Partial<LiveCaptureFrame> = {}): LiveCaptureFrame => ({
  brightness: 0.28,
  clarity: 0.56,
  detectedNote: 'A3',
  detectedPitchHz: 220,
  durationSeconds: 0.42,
  noteCandidates: [
    {
      centsOff: 3,
      confidence: 0.6,
      midi: 57,
      note: 'A3',
      pitchHz: 220,
    },
  ],
  rmsDb: -22,
  signalLevel: 0.14,
  suggestions: [baseSuggestion],
  transientDensity: 0.18,
  ...overrides,
});

describe('AudioCapture stable live capture gate', () => {
  it('accepts a strong pitched live frame', () => {
    expect(isStableCaptureFrame(createLiveFrame())).toBe(true);
  });

  it('rejects weak low-confidence frames near the noise floor', () => {
    expect(isStableCaptureFrame(createLiveFrame({
      clarity: 0.39,
      noteCandidates: [{
        centsOff: 8,
        confidence: 0.46,
        midi: 57,
        note: 'A3',
        pitchHz: 220,
      }],
      signalLevel: 0.045,
    }))).toBe(false);
  });

  it('still accepts quieter frames when pitch confidence is clearly reliable', () => {
    expect(isStableCaptureFrame(createLiveFrame({
      clarity: 0.64,
      noteCandidates: [{
        centsOff: 2,
        confidence: 0.78,
        midi: 57,
        note: 'A3',
        pitchHz: 220,
      }],
      signalLevel: 0.047,
    }))).toBe(true);
  });

  it('prefers stronger frames when scoring stable capture candidates', () => {
    const quietFrame = createLiveFrame({ signalLevel: 0.06 });
    const strongerFrame = createLiveFrame({ signalLevel: 0.18 });

    expect(scoreStableCaptureFrame(strongerFrame)).toBeGreaterThan(scoreStableCaptureFrame(quietFrame));
  });
});