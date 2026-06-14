import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  AudioWaveform,
  ListPlus,
  Loader,
  Mic,
  Square,
  Upload,
  Wand2,
  X,
} from 'lucide-react';

import { useAudioActions } from '../context/AudioContext';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { captureNoteStringFromTranscription } from '../services/noteStringLibrary';
import {
  buildSessionFromTranscription,
  mixToMono,
  transcribeAudioBuffer,
  type TranscriptionOptions,
  type TranscriptionResult,
} from '../services/songTranscription';
import { extractPeaks } from '../utils/waveformPeaks';

type NoticeTone = 'info' | 'success' | 'error';

interface SongTranscriberProps {
  open: boolean;
  onClose: () => void;
  onNotify?: (tone: NoticeTone, title: string, detail?: string) => void;
}

type TranscriberStatus = 'idle' | 'recording' | 'working' | 'ready' | 'error';

// A short note to set expectations honestly. Humming and singing transcribe
// cleanly; a finished, layered song is followed best-effort.
const INTRO_COPY = 'Record or upload a take. Hum a tune, sing, or drop in a song file. '
  + 'The studio listens for the melody and lays it onto the note grid so you can edit it like any pattern.';

/** Decode an ArrayBuffer of audio into an AudioBuffer using a temporary context. */
const decodeAudio = async (data: ArrayBuffer): Promise<AudioBuffer> => {
  const AudioContextClass = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('This browser cannot decode audio.');
  }
  const context = new AudioContextClass();
  try {
    return await context.decodeAudioData(data.slice(0));
  } finally {
    void context.close();
  }
};

export const SongTranscriber = ({ open, onClose, onNotify }: SongTranscriberProps) => {
  const { loadTranscribedSession } = useAudioActions();
  const [status, setStatus] = useState<TranscriberStatus>('idle');
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [sensitivity, setSensitivity] = useState(0.5);
  const [minNoteSteps, setMinNoteSteps] = useState(1);
  const [sourceLabel, setSourceLabel] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [bpmOverride, setBpmOverride] = useState('');

  const transcriberDialogRef = useRef<HTMLDivElement | null>(null);
  useDialogFocus(open, transcriberDialogRef, { trap: true });

  const decodedBufferRef = useRef<AudioBuffer | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const resetState = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setPeaks([]);
    setSourceLabel('');
    setErrorMessage('');
    setBpmOverride('');
    decodedBufferRef.current = null;
  }, []);

  // Clean up the microphone whenever the dialog closes.
  useEffect(() => {
    if (!open) {
      stopStream();
      mediaRecorderRef.current = null;
    }
  }, [open, stopStream]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  /** Run the transcription pass over a decoded buffer. */
  const runTranscription = useCallback(async (buffer: AudioBuffer, options: TranscriptionOptions = {}) => {
    setStatus('working');
    setErrorMessage('');
    // Yield once so the "Analyzing" state paints before the synchronous pass.
    await new Promise((resolve) => window.setTimeout(resolve, 30));
    try {
      const transcription = transcribeAudioBuffer(buffer, options);
      setResult(transcription);
      if (options.bpm === undefined) {
        setBpmOverride(String(transcription.bpm));
      }
      setStatus('ready');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Transcription failed.');
      setStatus('error');
    }
  }, []);

  /** Decode raw audio bytes, then transcribe. */
  const ingestAudio = useCallback(async (data: ArrayBuffer, label: string) => {
    setSourceLabel(label);
    setStatus('working');
    setErrorMessage('');
    try {
      const buffer = await decodeAudio(data);
      decodedBufferRef.current = buffer;
      // Pull a waveform strip from the decoded take so the user can see
      // what they recorded / uploaded before and after transcribing.
      try {
        setPeaks(extractPeaks(mixToMono(buffer), 120));
      } catch {
        setPeaks([]);
      }
      await runTranscription(buffer);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not read that audio.');
      setStatus('error');
    }
  }, [runTranscription]);

  const handleFileChosen = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const data = await file.arrayBuffer();
    await ingestAudio(data, file.name);
  }, [ingestAudio]);

  const startRecording = useCallback(async () => {
    try {
      // Raw signal — the browser's speech DSP (noise suppression, auto gain)
      // distorts sustained tones and hurts transcription accuracy.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
      });
      streamRef.current = stream;
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        stopStream();
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const data = await blob.arrayBuffer();
        await ingestAudio(data, 'Recorded take');
      };
      recorder.start();
      setStatus('recording');
      setResult(null);
      setErrorMessage('');
    } catch {
      setErrorMessage('Microphone access was blocked. Allow it in the browser, or upload a file instead.');
      setStatus('error');
    }
  }, [ingestAudio, stopStream]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }, []);

  // Re-run the pass over the already-decoded take with whatever the
  // current option controls say, merging in any just-changed value.
  const reanalyze = (overrides: TranscriptionOptions = {}) => {
    const buffer = decodedBufferRef.current;
    if (!buffer) return;
    const bpm = Number(bpmOverride);
    void runTranscription(buffer, {
      bpm: Number.isFinite(bpm) && bpm >= 40 && bpm <= 220 ? bpm : undefined,
      sensitivity,
      minNoteSteps,
      ...overrides,
    });
  };

  const handleBpmCommit = useCallback(() => {
    const buffer = decodedBufferRef.current;
    const bpm = Number(bpmOverride);
    if (!buffer || !Number.isFinite(bpm) || bpm < 40 || bpm > 220) {
      return;
    }
    if (result && bpm === result.bpm) {
      return;
    }
    void runTranscription(buffer, { bpm, sensitivity, minNoteSteps });
  }, [bpmOverride, minNoteSteps, result, runTranscription, sensitivity]);

  const applyToStudio = useCallback(() => {
    if (!result || result.notes.length === 0) {
      return;
    }
    const name = sourceLabel.replace(/\.[a-z0-9]+$/i, '').trim() || 'Transcribed take';
    const session = buildSessionFromTranscription(result, name);
    loadTranscribedSession(session);
    onNotify?.('success', 'Transcription added', `${result.notes.length} notes placed on a new lane.`);
    resetState();
    onClose();
  }, [result, sourceLabel, loadTranscribedSession, onNotify, resetState, onClose]);

  // Send the transcription to the capture shelf instead of replacing the
  // session. Useful when the user wants to keep the current arrangement
  // and just have the hummed phrase parked for a drag-onto-lane later.
  const saveToShelf = useCallback(() => {
    if (!result || result.notes.length === 0) {
      return;
    }
    const name = sourceLabel.replace(/\.[a-z0-9]+$/i, '').trim() || 'Transcribed take';
    const updated = captureNoteStringFromTranscription(result.notes, { name });
    if (!updated) {
      onNotify?.('error', 'Nothing to save', 'The transcription didn\'t produce any notes for the shelf.');
      return;
    }
    const saved = updated[0];
    const noteCount = saved.tokens.filter((token) => token !== null).length;
    onNotify?.(
      'success',
      'Saved to capture shelf',
      `${noteCount} ${noteCount === 1 ? 'note' : 'notes'} ready to drag onto any lane.`,
    );
  }, [result, sourceLabel, onNotify]);

  if (!open) {
    return null;
  }

  const confidencePercent = result ? Math.round(result.confidence * 100) : 0;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(4,7,11,0.72)] p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
    >
      <div
        ref={transcriberDialogRef}
        className="surface-panel-strong w-[min(720px,96vw)] max-h-[88vh] overflow-auto p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <AudioWaveform className="h-4 w-4" />
              <span className="section-label text-[var(--accent)]">Transcribe a song</span>
            </div>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Turn a recording into editable notes
            </h2>
            <p className="mt-1 max-w-[58ch] text-[12px] leading-5 text-[var(--text-secondary)]">
              {INTRO_COPY}
            </p>
          </div>
          <button
            aria-label="Close transcriber"
            className="ghost-icon-button flex h-9 w-9 shrink-0 items-center justify-center"
            data-ui-sound="nav"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Input controls */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            className="control-chip flex items-center justify-center gap-2 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em]"
            data-ui-sound="action"
            disabled={status === 'working'}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <Upload className="h-4 w-4" />
            Upload an audio file
          </button>
          {status === 'recording' ? (
            <button
              className="control-chip flex items-center justify-center gap-2 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em]"
              data-active="true"
              data-ui-sound="record"
              onClick={stopRecording}
              type="button"
            >
              <Square className="h-4 w-4" />
              Stop recording
            </button>
          ) : (
            <button
              className="control-chip flex items-center justify-center gap-2 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em]"
              data-ui-sound="record"
              disabled={status === 'working'}
              onClick={startRecording}
              type="button"
            >
              <Mic className="h-4 w-4" />
              Record from mic
            </button>
          )}
          <input
            accept="audio/*"
            className="hidden"
            onChange={handleFileChosen}
            ref={fileInputRef}
            type="file"
          />
        </div>

        {/* Status + result */}
        <div className="mt-4 rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] px-4 py-4">
          {status === 'idle' ? (
            <p className="text-[12px] leading-5 text-[var(--text-secondary)]">
              Nothing loaded yet. Upload a file or record a take to begin. Audio stays on your device.
            </p>
          ) : null}

          {status === 'recording' ? (
            <div className="flex items-center gap-2 text-[12px] text-[var(--text-primary)]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--danger)]" />
              Recording… stop when you have finished the phrase.
            </div>
          ) : null}

          {status === 'working' ? (
            <div className="flex items-center gap-2 text-[12px] text-[var(--text-primary)]">
              <Loader className="h-4 w-4 animate-spin text-[var(--accent)]" />
              Listening for the melody{sourceLabel ? ` in ${sourceLabel}` : ''}…
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="flex items-start gap-2 text-[12px] leading-5 text-[var(--danger)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          {status === 'ready' && result ? (
            <div className="grid gap-3">
              {peaks.length > 0 && <WaveformStrip peaks={peaks} />}
              <div className="grid grid-cols-3 gap-2">
                <ResultStat label="Notes" value={String(result.notes.length)} />
                <ResultStat label="Tempo" value={`${result.bpm} BPM`} />
                <ResultStat label="Confidence" value={`${confidencePercent}%`} />
              </div>
              <p className="text-[12px] leading-5 text-[var(--text-secondary)]">{result.summary}</p>

              {result.polyphonic ? (
                <div className="flex items-start gap-2 rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                  <span>
                    This sounds like a full mix. The studio followed the most prominent
                    melody line. Expect to clean up a few notes by hand.
                  </span>
                </div>
              ) : null}

              <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                <span>Tempo</span>
                <input
                  className="control-field h-8 w-20 px-2 text-xs"
                  inputMode="numeric"
                  onBlur={handleBpmCommit}
                  onChange={(event) => setBpmOverride(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleBpmCommit();
                    }
                  }}
                  value={bpmOverride}
                />
                <span className="normal-case tracking-normal text-[var(--text-tertiary)]">
                  Adjust if the timing reads wrong, then notes re-snap to the grid.
                </span>
              </label>

              <div className="grid gap-3 rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    <span>Sensitivity</span>
                    <span className="text-[var(--text-secondary)]">{Math.round(sensitivity * 100)}%</span>
                  </span>
                  <input
                    aria-label="Transcription sensitivity"
                    className="w-full"
                    max={1}
                    min={0}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      setSensitivity(next);
                    }}
                    onPointerUp={() => reanalyze({ sensitivity })}
                    onKeyUp={() => reanalyze({ sensitivity })}
                    step={0.05}
                    type="range"
                    value={sensitivity}
                  />
                  <span className="text-[10px] leading-4 text-[var(--text-tertiary)]">
                    Higher catches quiet or breathy notes; lower ignores more as noise.
                  </span>
                </label>

                <label className="grid gap-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Shortest note</span>
                  <div className="flex gap-1.5">
                    {[
                      { label: '1/16', steps: 1 },
                      { label: '1/8', steps: 2 },
                      { label: '1/4', steps: 4 },
                    ].map((option) => (
                      <button
                        aria-label={`Shortest note ${option.label}`}
                        aria-pressed={minNoteSteps === option.steps}
                        className="control-chip h-8 flex-1 min-h-[2rem] px-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                        data-active={minNoteSteps === option.steps ? 'true' : 'false'}
                        key={option.steps}
                        onClick={() => {
                          setMinNoteSteps(option.steps);
                          reanalyze({ minNoteSteps: option.steps });
                        }}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] leading-4 text-[var(--text-tertiary)]">
                    Drops blips shorter than this so fast wobbles don't become notes.
                  </span>
                </label>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer actions */}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {status === 'ready' && result ? (
            <button
              className="control-chip px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
              data-ui-sound="tab"
              onClick={resetState}
              type="button"
            >
              Start over
            </button>
          ) : null}
          <button
            className="control-chip flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            data-ui-sound="action"
            disabled={status !== 'ready' || !result || result.notes.length === 0}
            onClick={saveToShelf}
            type="button"
            title="Park the melody on the capture shelf without replacing the current session"
          >
            <ListPlus className="h-3.5 w-3.5" />
            Save to shelf
          </button>
          <button
            className="control-chip flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            data-active={status === 'ready' && result && result.notes.length > 0 ? 'true' : 'false'}
            data-ui-sound="action"
            disabled={status !== 'ready' || !result || result.notes.length === 0}
            onClick={applyToStudio}
            type="button"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Add to studio
          </button>
        </div>
      </div>
    </div>
  );
};

const ResultStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
    <div className="section-label">{label}</div>
    <div className="mt-1 font-mono text-sm font-semibold tracking-[0.04em] text-[var(--text-primary)]">
      {value}
    </div>
  </div>
);

// A compact symmetric waveform of the decoded take, drawn as mirrored
// bars from a normalized peaks array.
const WaveformStrip = ({ peaks }: { peaks: number[] }) => (
  <div
    aria-hidden="true"
    className="flex h-12 items-center gap-[1px] overflow-hidden rounded-[3px] border border-[var(--border-soft)] bg-[rgba(6,9,13,0.4)] px-2"
  >
    {peaks.map((peak, index) => (
      <span
        key={index}
        className="min-w-0 flex-1 rounded-[1px] bg-[var(--accent)]"
        style={{ height: `${Math.max(6, Math.round(peak * 100))}%`, opacity: 0.35 + peak * 0.5 }}
      />
    ))}
  </div>
);
