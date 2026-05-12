import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Mic, MicOff, Play, Square, X } from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import { AudioRecorder, type RecordingResult } from '../services/audioRecording';
import { TrackIcon, getTrackPersonality } from '../utils/trackPersonality';
import type { InstrumentType } from '../project/schema';

interface AudioCaptureProps {
  open: boolean;
  onClose: () => void;
}

export const AudioCapture = ({ open, onClose }: AudioCaptureProps) => {
  const { createTrack, setSelectedTrackId, tracks, toggleStep } = useAudio();
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<'idle' | 'recording' | 'analyzing' | 'ready' | 'error'>('idle');
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const startRecording = useCallback(async () => {
    setError(null);
    setResult(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    const recorder = new AudioRecorder();
    if (!recorder.isSupported()) {
      setError('Recording is not available in this browser. Try Chrome, Firefox, or Safari on macOS.');
      setState('error');
      return;
    }
    try {
      await recorder.start();
      recorderRef.current = recorder;
      setState('recording');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not access the microphone.');
      setState('error');
    }
  }, [previewUrl]);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    setState('analyzing');
    try {
      const next = await recorder.stop();
      const url = URL.createObjectURL(next.blob);
      setPreviewUrl(url);
      setResult(next);
      setState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recording failed.');
      setState('error');
    } finally {
      recorderRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setState('idle');
    setResult(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setError(null);
  }, [previewUrl]);

  const addMatchingTrack = useCallback(() => {
    if (!result) return;
    createTrack(result.suggestedTrackType);
    onClose();
  }, [createTrack, onClose, result]);

  const placeOnExisting = useCallback(() => {
    if (!result) return;
    // Find first existing track of the suggested type, fall back to first available
    const match = tracks.find((t) => t.type === result.suggestedTrackType) ?? tracks[0];
    if (!match) return;
    setSelectedTrackId(match.id);
    // Drop a single note on step 0 as a hint of what was detected
    toggleStep(match.id, 0, result.detectedNote ?? undefined);
    onClose();
  }, [onClose, result, setSelectedTrackId, toggleStep, tracks]);

  const downloadRecording = useCallback(() => {
    if (!result) return;
    const anchor = document.createElement('a');
    anchor.href = previewUrl ?? URL.createObjectURL(result.blob);
    anchor.download = `sonicstudio-capture-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
    anchor.click();
  }, [previewUrl, result]);

  if (!open) return null;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(4,7,11,0.72)] p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="surface-panel-strong w-[min(560px,96vw)] max-h-[88vh] overflow-auto p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <Mic className="h-4 w-4" />
              <span className="section-label text-[var(--accent)]">Audio capture</span>
            </div>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Record a sound, match it to a track.
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
              Hum, beatbox, tap a mic — SonicStudio listens for the strongest pitch and suggests which track type fits best. Stays in your browser.
            </p>
          </div>
          <button
            aria-label="Close audio capture"
            className="ghost-icon-button flex h-9 w-9 items-center justify-center"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <section className="surface-panel-strong p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="section-label">Record</div>
                <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                  {state === 'idle' && 'Click record, make a sound for 1–6 seconds, then stop.'}
                  {state === 'recording' && 'Listening...'}
                  {state === 'analyzing' && 'Analyzing...'}
                  {state === 'ready' && 'Got it. Preview below.'}
                  {state === 'error' && (error ?? 'Something went wrong.')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {state === 'idle' || state === 'error' ? (
                  <button
                    className="control-chip flex items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)]"
                    onClick={startRecording}
                    type="button"
                  >
                    <Mic className="h-3.5 w-3.5" />
                    Record
                  </button>
                ) : null}
                {state === 'recording' ? (
                  <button
                    className="control-chip flex items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                    data-active="true"
                    onClick={stopRecording}
                    type="button"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                    Stop
                  </button>
                ) : null}
                {state === 'analyzing' ? (
                  <button
                    className="control-chip flex items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] opacity-60"
                    disabled
                    type="button"
                  >
                    Analyzing...
                  </button>
                ) : null}
                {state === 'ready' ? (
                  <button
                    className="control-chip flex items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                    onClick={cancel}
                    type="button"
                  >
                    <MicOff className="h-3.5 w-3.5" />
                    Try again
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          {result && previewUrl && (
            <section className="surface-panel-strong p-4">
              <div className="section-label">Detected</div>
              <div className="mt-2 grid gap-2 text-[12px] leading-5">
                <Detail label="Duration" value={`${result.durationSeconds.toFixed(2)}s`} />
                <Detail label="Loudness" value={Number.isFinite(result.rmsDb) ? `${result.rmsDb.toFixed(1)} dB` : '—'} />
                <Detail label="Pitch" value={result.detectedPitchHz ? `${result.detectedPitchHz.toFixed(1)} Hz` : 'Not pitched'} />
                <Detail label="Closest note" value={result.detectedNote ?? '—'} />
              </div>

              <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
                <div className="flex items-center gap-2">
                  <SuggestionBadge type={result.suggestedTrackType} />
                  <span className="text-[12px] leading-5 text-[var(--text-secondary)]">{result.reason}</span>
                </div>
              </div>

              <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
                <div className="section-label">Playback</div>
                <audio
                  ref={audioElRef}
                  className="mt-2 w-full"
                  controls
                  src={previewUrl}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="control-chip flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                  data-active="true"
                  onClick={addMatchingTrack}
                  type="button"
                >
                  <Check className="h-3.5 w-3.5" />
                  Create {result.suggestedTrackType} track
                </button>
                {result.detectedNote && (
                  <button
                    className="control-chip flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                    onClick={placeOnExisting}
                    type="button"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Drop {result.detectedNote} on first {result.suggestedTrackType}
                  </button>
                )}
                <button
                  className="control-chip flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                  onClick={downloadRecording}
                  type="button"
                >
                  Download .webm
                </button>
              </div>
            </section>
          )}

          <p className="text-[11px] leading-5 text-[var(--text-tertiary)]">
            How matching works: we run autocorrelation on the recording to find the strongest periodic pitch, then map that frequency to the closest track type by range (kick &lt; 90 Hz, bass 90–200, pad 200–500, lead 500–1200, pluck 1200–3000, hi-hat above). No data leaves your device.
          </p>
        </div>
      </div>
    </div>
  );
};

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{label}</span>
    <span className="text-[var(--text-primary)]">{value}</span>
  </div>
);

const SuggestionBadge = ({ type }: { type: InstrumentType }) => {
  const personality = getTrackPersonality(type);
  return (
    <span
      className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
      style={{ border: '1px solid var(--accent)', borderRadius: '2px', color: 'var(--accent-strong)' }}
      title={personality.blurb}
    >
      <TrackIcon type={type} className="h-3.5 w-3.5" />
      {type}
    </span>
  );
};
