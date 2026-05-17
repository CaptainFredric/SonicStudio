import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  AudioWaveform,
  Loader,
  Mic,
  Square,
  Upload,
  Wand2,
  X,
} from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import {
  buildSessionFromTranscription,
  transcribeAudioBuffer,
  type TranscriptionResult,
} from '../services/songTranscription';

type NoticeTone = 'info' | 'success' | 'error';

interface SongTranscriberProps {
  open: boolean;
  onClose: () => void;
  onNotify?: (tone: NoticeTone, title: string, detail?: string) => void;
}

type TranscriberStatus = 'idle' | 'recording' | 'working' | 'ready' | 'error';

// A short note to set expectations honestly. Humming and singing transcribe
// cleanly; a finished, layered song is followed best-effort.
const INTRO_COPY = 'Record or upload a take — hum a tune, sing, or drop in a song file. '
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
  const { loadTranscribedSession } = useAudio();
  const [status, setStatus] = useState<TranscriberStatus>('idle');
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [bpmOverride, setBpmOverride] = useState('');

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
  const runTranscription = useCallback(async (buffer: AudioBuffer, bpm?: number) => {
    setStatus('working');
    setErrorMessage('');
    // Yield once so the "Analyzing" state paints before the synchronous pass.
    await new Promise((resolve) => window.setTimeout(resolve, 30));
    try {
      const transcription = transcribeAudioBuffer(buffer, bpm ? { bpm } : {});
      setResult(transcription);
      setBpmOverride(String(transcription.bpm));
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

  const handleBpmCommit = useCallback(() => {
    const buffer = decodedBufferRef.current;
    const bpm = Number(bpmOverride);
    if (!buffer || !Number.isFinite(bpm) || bpm < 40 || bpm > 220) {
      return;
    }
    if (result && bpm === result.bpm) {
      return;
    }
    void runTranscription(buffer, bpm);
  }, [bpmOverride, result, runTranscription]);

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
                    melody line — expect to clean up a few notes by hand.
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
