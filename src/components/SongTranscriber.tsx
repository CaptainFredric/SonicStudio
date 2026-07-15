import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  AudioWaveform,
  Check,
  Clock3,
  FileAudio,
  ListPlus,
  Loader,
  Mic,
  Minus,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Square,
  Trash2,
  Undo2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';

import type {
  SongTranscriptionRequest,
  SongTranscriptionResponse,
} from '../audio/songTranscription.worker';
import { useAudio } from '../context/AudioContext';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { MAX_PATTERN_COUNT } from '../project/schema';
import { captureNoteStringFromTranscription } from '../services/noteStringLibrary';
import {
  appendTranscriptionToSession,
  buildSessionFromTranscription,
  inferMelodyTrackType,
  midiToNoteName,
  mixToMono,
  transcribeSamples,
  type TranscriptionNote,
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

type TranscriberStatus = 'idle' | 'recording' | 'decoding' | 'analyzing' | 'ready' | 'error';

interface PendingWorker {
  reject: (reason?: unknown) => void;
  worker: Worker;
}

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_RECORDING_SECONDS = 90;
const MAX_EDIT_HISTORY = 24;

const formatDuration = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

const sourceName = (label: string) => label.replace(/\.[a-z0-9]+$/i, '').trim() || 'Transcribed take';

const analysisKey = (bpm: string, sensitivity: number, minNoteSteps: number) => {
  const parsedBpm = Number(bpm);
  const tempo = Number.isFinite(parsedBpm) && parsedBpm >= 40 && parsedBpm <= 220
    ? Math.round(parsedBpm)
    : 'auto';
  return `${tempo}:${sensitivity.toFixed(2)}:${minNoteSteps}`;
};

const buildAnalysisOptions = (
  bpm: string,
  sensitivity: number,
  minNoteSteps: number,
): TranscriptionOptions => {
  const parsedBpm = Number(bpm);
  return {
    bpm: Number.isFinite(parsedBpm) && parsedBpm >= 40 && parsedBpm <= 220 ? parsedBpm : undefined,
    minNoteSteps,
    sensitivity,
  };
};

const chooseRecorderMimeType = () => {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/webm',
    'audio/mp4',
  ];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported?.(candidate)) ?? '';
};

const transposeNote = (note: TranscriptionNote, semitones: number): TranscriptionNote => {
  const midi = Math.max(24, Math.min(108, note.midi + semitones));
  return { ...note, midi, note: midiToNoteName(midi) };
};

export const SongTranscriber = ({ open, onClose, onNotify }: SongTranscriberProps) => {
  const {
    auditionInstrumentNote,
    currentSession,
    loadTranscribedSession,
  } = useAudio();
  const [status, setStatus] = useState<TranscriberStatus>('idle');
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [editHistory, setEditHistory] = useState<TranscriptionResult[]>([]);
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<number | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [sensitivity, setSensitivity] = useState(0.5);
  const [minNoteSteps, setMinNoteSteps] = useState(1);
  const [sourceLabel, setSourceLabel] = useState('');
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [laneName, setLaneName] = useState('Transcribed melody');
  const [errorMessage, setErrorMessage] = useState('');
  const [bpmOverride, setBpmOverride] = useState('');
  const [appliedAnalysisKey, setAppliedAnalysisKey] = useState('');
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [inputLevel, setInputLevel] = useState(0);
  const [shelfSaved, setShelfSaved] = useState(false);

  const transcriberDialogRef = useRef<HTMLDivElement | null>(null);
  useDialogFocus(open, transcriberDialogRef, { trap: true });
  const decodedBufferRef = useRef<AudioBuffer | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const meterContextRef = useRef<AudioContext | null>(null);
  const meterSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const meterFrameRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef(0);
  const recordingRequestIdRef = useRef(0);
  const inputRequestIdRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const requestIdRef = useRef(0);
  const pendingWorkerRef = useRef<PendingWorker | null>(null);

  const replaceSourceUrl = useCallback((nextUrl: string | null) => {
    setSourceUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return nextUrl;
    });
  }, []);

  const stopMeter = useCallback(() => {
    if (meterFrameRef.current !== null) {
      window.cancelAnimationFrame(meterFrameRef.current);
      meterFrameRef.current = null;
    }
    meterSourceRef.current?.disconnect();
    meterSourceRef.current = null;
    if (meterContextRef.current) {
      void meterContextRef.current.close();
      meterContextRef.current = null;
    }
    setInputLevel(0);
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    stopMeter();
  }, [stopMeter]);

  const cancelAnalysis = useCallback(() => {
    requestIdRef.current += 1;
    const pending = pendingWorkerRef.current;
    if (pending) {
      pending.worker.terminate();
      pending.reject(new Error('Analysis cancelled.'));
      pendingWorkerRef.current = null;
    }
  }, []);

  const cancelRecording = useCallback(() => {
    recordingRequestIdRef.current += 1;
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state !== 'inactive') recorder.stop();
      mediaRecorderRef.current = null;
    }
    recordedChunksRef.current = [];
    stopStream();
  }, [stopStream]);

  const resetState = useCallback(() => {
    inputRequestIdRef.current += 1;
    cancelAnalysis();
    cancelRecording();
    setStatus('idle');
    setResult(null);
    setEditHistory([]);
    setSelectedNoteIndex(null);
    setPeaks([]);
    setSourceLabel('');
    setLaneName('Transcribed melody');
    setErrorMessage('');
    setBpmOverride('');
    setAppliedAnalysisKey('');
    setRecordingElapsed(0);
    setShelfSaved(false);
    decodedBufferRef.current = null;
    replaceSourceUrl(null);
  }, [cancelAnalysis, cancelRecording, replaceSourceUrl]);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  useEffect(() => {
    if (!open) {
      cancelAnalysis();
      cancelRecording();
    }
  }, [cancelAnalysis, cancelRecording, open]);

  useEffect(() => () => {
    cancelAnalysis();
    cancelRecording();
  }, [cancelAnalysis, cancelRecording]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleClose, open]);

  useEffect(() => {
    if (status !== 'recording') return undefined;
    const interval = window.setInterval(() => {
      const elapsed = (Date.now() - recordingStartedAtRef.current) / 1000;
      setRecordingElapsed(elapsed);
      if (elapsed >= MAX_RECORDING_SECONDS && mediaRecorderRef.current?.state === 'recording') {
        setStatus('decoding');
        mediaRecorderRef.current.stop();
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [status]);

  const runTranscription = useCallback(async (
    buffer: AudioBuffer,
    options: TranscriptionOptions,
  ) => {
    cancelAnalysis();
    const requestId = requestIdRef.current;
    setStatus('analyzing');
    setErrorMessage('');
    setShelfSaved(false);

    await new Promise((resolve) => window.setTimeout(resolve, 30));

    try {
      const mono = mixToMono(buffer);
      let transcription: TranscriptionResult;

      if (typeof Worker === 'undefined') {
        transcription = transcribeSamples(mono, buffer.sampleRate, options);
      } else {
        transcription = await new Promise<TranscriptionResult>((resolve, reject) => {
          const worker = new Worker(new URL('../audio/songTranscription.worker.ts', import.meta.url), { type: 'module' });
          pendingWorkerRef.current = { reject, worker };
          worker.onmessage = (event: MessageEvent<SongTranscriptionResponse>) => {
            if (event.data.id !== requestId) return;
            pendingWorkerRef.current = null;
            worker.terminate();
            if (event.data.result) resolve(event.data.result);
            else reject(new Error(event.data.error || 'Melody analysis failed.'));
          };
          worker.onerror = () => {
            pendingWorkerRef.current = null;
            worker.terminate();
            reject(new Error('The melody analyzer could not start.'));
          };
          const message: SongTranscriptionRequest = {
            id: requestId,
            options,
            sampleRate: buffer.sampleRate,
            samples: mono.buffer,
          };
          worker.postMessage(message, [mono.buffer]);
        });
      }

      if (requestId !== requestIdRef.current) return;
      setResult(transcription);
      setEditHistory([]);
      setSelectedNoteIndex(transcription.notes.length > 0 ? 0 : null);
      setBpmOverride(String(transcription.bpm));
      setAppliedAnalysisKey(analysisKey(
        String(transcription.bpm),
        options.sensitivity ?? 0.5,
        options.minNoteSteps ?? 1,
      ));
      setStatus('ready');
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : 'Transcription failed.');
      setStatus('error');
    }
  }, [cancelAnalysis]);

  const ingestAudio = useCallback(async (
    data: ArrayBuffer,
    label: string,
    previewUrl: string,
    requestedInputId?: number,
  ) => {
    const inputRequestId = requestedInputId ?? inputRequestIdRef.current + 1;
    inputRequestIdRef.current = inputRequestId;
    cancelAnalysis();
    setSourceLabel(label);
    setLaneName(`${sourceName(label)} melody`.slice(0, 48));
    setStatus('decoding');
    setErrorMessage('');
    setResult(null);
    setEditHistory([]);
    setSelectedNoteIndex(null);
    setShelfSaved(false);
    replaceSourceUrl(previewUrl);
    try {
      const AudioContextClass = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) throw new Error('This browser cannot decode audio.');
      const context = new AudioContextClass();
      let buffer: AudioBuffer;
      try {
        buffer = await context.decodeAudioData(data.slice(0));
      } finally {
        void context.close();
      }
      if (inputRequestId !== inputRequestIdRef.current) return;
      decodedBufferRef.current = buffer;
      try {
        setPeaks(extractPeaks(mixToMono(buffer), 160));
      } catch {
        setPeaks([]);
      }
      await runTranscription(buffer, { minNoteSteps, sensitivity });
    } catch (error) {
      if (inputRequestId !== inputRequestIdRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : 'Could not read that audio.');
      setStatus('error');
    }
  }, [cancelAnalysis, minNoteSteps, replaceSourceUrl, runTranscription, sensitivity]);

  const handleFileChosen = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const inputRequestId = inputRequestIdRef.current + 1;
    inputRequestIdRef.current = inputRequestId;
    if (file.size === 0) {
      setErrorMessage('That audio file is empty. Choose a different file.');
      setStatus('error');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setErrorMessage('That file is over 100 MB. Trim it or export a smaller audio file first.');
      setStatus('error');
      return;
    }
    if (file.type && !file.type.startsWith('audio/')) {
      setErrorMessage('Choose an audio file such as WAV, MP3, M4A, or WebM.');
      setStatus('error');
      return;
    }
    try {
      const data = await file.arrayBuffer();
      if (inputRequestId !== inputRequestIdRef.current) return;
      await ingestAudio(data, file.name, URL.createObjectURL(file), inputRequestId);
    } catch (error) {
      if (inputRequestId !== inputRequestIdRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : 'Could not open that file.');
      setStatus('error');
    }
  }, [ingestAudio]);

  const startMeter = useCallback((stream: MediaStream) => {
    const AudioContextClass = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    meterContextRef.current = context;
    meterSourceRef.current = source;
    const samples = new Float32Array(analyser.fftSize);
    const update = () => {
      analyser.getFloatTimeDomainData(samples);
      let energy = 0;
      for (const sample of samples) energy += sample * sample;
      const rms = Math.sqrt(energy / samples.length);
      setInputLevel(Math.min(1, rms * 8));
      meterFrameRef.current = window.requestAnimationFrame(update);
    };
    update();
  }, []);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorMessage('Microphone recording is not available here. Upload an audio file instead.');
      setStatus('error');
      return;
    }
    cancelAnalysis();
    cancelRecording();
    const recordingRequestId = recordingRequestIdRef.current + 1;
    recordingRequestIdRef.current = recordingRequestId;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
      });
      if (recordingRequestId !== recordingRequestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      recordedChunksRef.current = [];
      const mimeType = chooseRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        mediaRecorderRef.current = null;
        stopStream();
        const chunks = recordedChunksRef.current;
        recordedChunksRef.current = [];
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size === 0) {
          setErrorMessage('No audio was captured. Check the microphone and try again.');
          setStatus('error');
          return;
        }
        try {
          await ingestAudio(blob.arrayBuffer ? await blob.arrayBuffer() : new ArrayBuffer(0), 'Recorded take', URL.createObjectURL(blob));
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : 'Could not read the recorded take.');
          setStatus('error');
        }
      };
      recorder.start(250);
      recordingStartedAtRef.current = Date.now();
      setRecordingElapsed(0);
      setResult(null);
      setEditHistory([]);
      setSelectedNoteIndex(null);
      setErrorMessage('');
      setShelfSaved(false);
      setStatus('recording');
      startMeter(stream);
    } catch (error) {
      if (recordingRequestId !== recordingRequestIdRef.current) return;
      stopStream();
      setErrorMessage(error instanceof Error && error.name !== 'NotAllowedError'
        ? error.message
        : 'Microphone access was blocked. Allow it in the browser, or upload a file instead.');
      setStatus('error');
    }
  }, [cancelAnalysis, cancelRecording, ingestAudio, startMeter, stopStream]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    setStatus('decoding');
    recorder.requestData();
    recorder.stop();
  }, []);

  const applyAnalysis = useCallback(() => {
    const buffer = decodedBufferRef.current;
    if (!buffer) return;
    void runTranscription(buffer, buildAnalysisOptions(bpmOverride, sensitivity, minNoteSteps));
  }, [bpmOverride, minNoteSteps, runTranscription, sensitivity]);

  const commitEdit = useCallback((nextNotes: TranscriptionNote[], nextSelection = selectedNoteIndex) => {
    if (!result) return;
    setEditHistory((current) => [...current, result].slice(-MAX_EDIT_HISTORY));
    setResult({ ...result, notes: nextNotes });
    setSelectedNoteIndex(nextNotes.length === 0
      ? null
      : Math.max(0, Math.min(nextSelection ?? 0, nextNotes.length - 1)));
    setShelfSaved(false);
  }, [result, selectedNoteIndex]);

  const updateSelectedNote = useCallback((updater: (note: TranscriptionNote) => TranscriptionNote) => {
    if (!result || selectedNoteIndex === null || !result.notes[selectedNoteIndex]) return;
    commitEdit(
      result.notes.map((note, index) => (index === selectedNoteIndex ? updater(note) : note)),
      selectedNoteIndex,
    );
  }, [commitEdit, result, selectedNoteIndex]);

  const deleteSelectedNote = useCallback(() => {
    if (!result || selectedNoteIndex === null) return;
    commitEdit(result.notes.filter((_, index) => index !== selectedNoteIndex), selectedNoteIndex);
  }, [commitEdit, result, selectedNoteIndex]);

  const undoEdit = useCallback(() => {
    const previous = editHistory.at(-1);
    if (!previous) return;
    setResult(previous);
    setEditHistory((current) => current.slice(0, -1));
    setSelectedNoteIndex((current) => previous.notes.length === 0
      ? null
      : Math.min(current ?? 0, previous.notes.length - 1));
    setShelfSaved(false);
  }, [editHistory]);

  const transposeAll = useCallback((semitones: number) => {
    if (!result) return;
    commitEdit(result.notes.map((note) => transposeNote(note, semitones)));
  }, [commitEdit, result]);

  const auditionSelected = useCallback(() => {
    if (!result || selectedNoteIndex === null) return;
    const note = result.notes[selectedNoteIndex];
    if (!note) return;
    void auditionInstrumentNote(inferMelodyTrackType(result.notes), note.note, note.velocity);
  }, [auditionInstrumentNote, result, selectedNoteIndex]);

  const addLaneToSong = useCallback(() => {
    if (!result?.notes.length) return;
    const appended = appendTranscriptionToSession(currentSession, result, {
      laneName,
      startPattern: currentSession.project.transport.currentPattern,
    });
    if (!appended) {
      onNotify?.('error', 'Phrase does not fit', 'Start it as a new project, choose an earlier pattern, or shorten the source and analyze again.');
      return;
    }
    loadTranscribedSession(appended.session);
    onNotify?.(
      'success',
      'Melody lane added',
      `${appended.placedNoteCount} notes placed from Pattern ${appended.startPattern + 1}${appended.addedPatternCount ? ` · ${appended.addedPatternCount} pattern${appended.addedPatternCount === 1 ? '' : 's'} added` : ''}.`,
    );
    handleClose();
  }, [currentSession, handleClose, laneName, loadTranscribedSession, onNotify, result]);

  const startNewProject = useCallback(() => {
    if (!result?.notes.length) return;
    const session = buildSessionFromTranscription(result, sourceName(sourceLabel));
    session.project.tracks[0].name = laneName.trim() || 'Transcribed melody';
    loadTranscribedSession(session);
    onNotify?.('success', 'New transcription project', `${result.notes.length} editable notes loaded in a fresh project.`);
    handleClose();
  }, [handleClose, laneName, loadTranscribedSession, onNotify, result, sourceLabel]);

  const saveToShelf = useCallback(() => {
    if (!result?.notes.length) return;
    const updated = captureNoteStringFromTranscription(result.notes, {
      name: laneName.trim() || sourceName(sourceLabel),
    });
    if (!updated) {
      onNotify?.('error', 'Nothing to save', 'The transcription did not produce any notes for the shelf.');
      return;
    }
    const saved = updated[0];
    const noteCount = saved.tokens.filter((token) => token !== null).length;
    setShelfSaved(true);
    onNotify?.('success', 'Saved to capture shelf', `${noteCount} notes are ready in the Notes panel.`);
  }, [laneName, onNotify, result, sourceLabel]);

  const draftAnalysisKey = analysisKey(bpmOverride, sensitivity, minNoteSteps);
  const analysisDirty = status === 'ready' && draftAnalysisKey !== appliedAnalysisKey;
  const confidencePercent = result ? Math.round(result.confidence * 100) : 0;
  const selectedNote = result && selectedNoteIndex !== null ? result.notes[selectedNoteIndex] ?? null : null;
  const phraseStepCount = result?.notes.reduce(
    (max, note) => Math.max(max, note.startStep + note.durationSteps),
    1,
  ) ?? 1;
  const startPattern = currentSession.project.transport.currentPattern;
  const requiredPatternCount = Math.ceil(
    ((startPattern * currentSession.project.transport.stepsPerPattern) + phraseStepCount)
    / currentSession.project.transport.stepsPerPattern,
  );
  const canAppend = requiredPatternCount <= MAX_PATTERN_COUNT;
  const tempoMismatch = Boolean(result && result.bpm !== currentSession.project.transport.bpm);
  const working = status === 'decoding' || status === 'analyzing';

  if (!open) return null;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(4,7,11,0.78)] p-2 backdrop-blur-sm sm:p-4"
      onClick={handleClose}
      role="dialog"
    >
      <div
        ref={transcriberDialogRef}
        className="surface-panel-strong flex max-h-[94vh] w-[min(1100px,98vw)] flex-col overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.52)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="shrink-0 border-b border-[var(--border-soft)] px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[var(--accent)]">
                <AudioWaveform className="h-4 w-4" />
                <span className="section-label text-[var(--accent)]">Melody transcriber</span>
              </div>
              <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                Turn audio into an editable lane
              </h2>
              <p className="mt-1 max-w-[72ch] text-[12px] leading-5 text-[var(--text-secondary)]">
                Record or upload a phrase, review every detected note, then add it to this song without replacing your work. Analysis stays on this device.
              </p>
            </div>
            <button
              aria-label="Close transcriber"
              className="ghost-icon-button flex h-9 w-9 shrink-0 items-center justify-center"
              data-ui-sound="nav"
              onClick={handleClose}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <TranscriberProgress status={status} />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <button
              className="group flex min-h-[74px] items-center gap-3 rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] px-4 py-3 text-left transition-colors hover:border-[rgba(114,217,255,0.35)] hover:bg-[rgba(114,217,255,0.05)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={working || status === 'recording'}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] text-[var(--accent)]">
                <Upload className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-[12px] font-semibold text-[var(--text-primary)]">Upload audio</span>
                <span className="mt-1 block text-[11px] leading-4 text-[var(--text-tertiary)]">WAV, MP3, M4A, or WebM · up to 100 MB</span>
              </span>
            </button>
            {status === 'recording' ? (
              <button
                className="flex min-h-[74px] items-center gap-3 rounded-[3px] border border-[rgba(248,113,113,0.4)] bg-[rgba(248,113,113,0.08)] px-4 py-3 text-left"
                onClick={stopRecording}
                type="button"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] border border-[rgba(248,113,113,0.35)] text-[var(--danger)]">
                  <Square className="h-4 w-4 fill-current" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3 text-[12px] font-semibold text-[var(--text-primary)]">
                    <span>Stop recording</span>
                    <span className="font-mono text-[var(--danger)]">{formatDuration(recordingElapsed)} / 1:30</span>
                  </span>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-[2px] bg-[rgba(255,255,255,0.08)]">
                    <span
                      className="block h-full rounded-[2px] bg-[var(--danger)] transition-[width] duration-75"
                      style={{ width: `${Math.max(2, inputLevel * 100)}%` }}
                    />
                  </span>
                </span>
              </button>
            ) : (
              <button
                className="group flex min-h-[74px] items-center gap-3 rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] px-4 py-3 text-left transition-colors hover:border-[rgba(248,113,113,0.35)] hover:bg-[rgba(248,113,113,0.05)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={working}
                onClick={() => void startRecording()}
                type="button"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] text-[var(--danger)]">
                  <Mic className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-[12px] font-semibold text-[var(--text-primary)]">Record a phrase</span>
                  <span className="mt-1 block text-[11px] leading-4 text-[var(--text-tertiary)]">Live level meter · automatic stop at 90 seconds</span>
                </span>
              </button>
            )}
            <input
              accept="audio/*"
              className="hidden"
              onChange={handleFileChosen}
              ref={fileInputRef}
              type="file"
            />
          </section>

          {status === 'idle' ? (
            <section className="mt-4 grid gap-3 sm:grid-cols-3">
              <EmptyStep index="01" label="Capture one clear melody" />
              <EmptyStep index="02" label="Correct notes and timing" />
              <EmptyStep index="03" label="Add a lane or start fresh" />
            </section>
          ) : null}

          {status === 'recording' ? (
            <section className="mt-4 rounded-[3px] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.04)] px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text-primary)]">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--danger)]" />
                    Listening for one melody line
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                    Sing, hum, whistle, or play a single lead part. A steady room level and a small pause between notes give the cleanest result.
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                  <Clock3 className="h-3.5 w-3.5" />
                  {Math.max(0, Math.ceil(MAX_RECORDING_SECONDS - recordingElapsed))}s left
                </div>
              </div>
            </section>
          ) : null}

          {working ? (
            <section className="mt-4 rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] px-4 py-8 text-center">
              <Loader className="mx-auto h-5 w-5 animate-spin text-[var(--accent)]" />
              <div className="mt-3 text-[13px] font-medium text-[var(--text-primary)]">
                {status === 'decoding' ? 'Preparing the audio' : 'Mapping pitch onto the note grid'}
              </div>
              <p className="mt-2 text-[11px] leading-5 text-[var(--text-tertiary)]">
                {status === 'analyzing' ? 'The analyzer is running in the background, so the rest of the studio stays responsive.' : 'Reading the source and building a local waveform preview.'}
              </p>
            </section>
          ) : null}

          {status === 'error' ? (
            <section className="mt-4 flex items-start gap-3 rounded-[3px] border border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.07)] px-4 py-4 text-[12px] leading-5 text-[var(--danger)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">Could not finish that take</div>
                <div className="mt-1 text-[var(--text-secondary)]">{errorMessage}</div>
              </div>
            </section>
          ) : null}

          {status === 'ready' && result ? (
            <div className="mt-4 grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
              <div className="grid content-start gap-3">
                <section className="rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] p-4">
                  <div className="flex items-center gap-2">
                    <FileAudio className="h-4 w-4 text-[var(--accent)]" />
                    <div className="min-w-0">
                      <div className="section-label">Source</div>
                      <div className="mt-1 truncate text-[12px] font-medium text-[var(--text-primary)]">{sourceLabel}</div>
                    </div>
                  </div>
                  {peaks.length > 0 ? <div className="mt-3"><WaveformStrip peaks={peaks} /></div> : null}
                  {sourceUrl ? <audio className="mt-3 h-9 w-full" controls preload="metadata" src={sourceUrl} /> : null}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <ResultStat label="Notes" value={String(result.notes.length)} />
                    <ResultStat label="Tempo" value={`${result.bpm}`} />
                    <ResultStat label="Read" value={`${confidencePercent}%`} />
                  </div>
                  <p className="mt-3 text-[11px] leading-5 text-[var(--text-secondary)]">{result.summary}</p>
                  {result.polyphonic ? (
                    <div className="mt-3 flex items-start gap-2 rounded-[3px] border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.07)] px-3 py-2 text-[10px] leading-4 text-[var(--text-secondary)]">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning)]" />
                      <span>A layered mix was detected. This preview follows its strongest melody, so review the note row before placing it.</span>
                    </div>
                  ) : null}
                </section>

                <section className="rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
                      <span className="section-label">Analysis cleanup</span>
                    </div>
                    {analysisDirty ? <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--warning)]">Changes pending</span> : null}
                  </div>
                  <label className="mt-3 grid gap-1.5">
                    <span className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      <span>Tempo</span>
                      <button
                        className="text-[var(--accent)] hover:text-[var(--text-primary)]"
                        onClick={() => setBpmOverride(String(currentSession.project.transport.bpm))}
                        type="button"
                      >
                        Use song {currentSession.project.transport.bpm}
                      </button>
                    </span>
                    <div className="flex gap-2">
                      <input
                        aria-label="Transcription tempo"
                        className="control-field h-9 min-w-0 flex-1 px-3 text-xs"
                        inputMode="numeric"
                        max={220}
                        min={40}
                        onChange={(event) => setBpmOverride(event.target.value)}
                        value={bpmOverride}
                      />
                      <button className="control-chip px-3 text-[10px] uppercase tracking-[0.12em]" onClick={() => setBpmOverride('')} type="button">Auto</button>
                    </div>
                  </label>
                  <label className="mt-3 grid gap-1.5">
                    <span className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      <span>Sensitivity</span>
                      <span>{Math.round(sensitivity * 100)}%</span>
                    </span>
                    <input
                      aria-label="Transcription sensitivity"
                      max={1}
                      min={0}
                      onChange={(event) => setSensitivity(Number(event.target.value))}
                      step={0.05}
                      type="range"
                      value={sensitivity}
                    />
                  </label>
                  <div className="mt-3">
                    <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Shortest note</div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {[{ label: '1/16', steps: 1 }, { label: '1/8', steps: 2 }, { label: '1/4', steps: 4 }].map((option) => (
                        <button
                          aria-pressed={minNoteSteps === option.steps}
                          className="control-chip h-8 px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                          data-active={minNoteSteps === option.steps ? 'true' : 'false'}
                          key={option.steps}
                          onClick={() => setMinNoteSteps(option.steps)}
                          type="button"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    className="control-chip mt-3 flex h-9 w-full items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    data-active={analysisDirty ? 'true' : 'false'}
                    disabled={!analysisDirty}
                    onClick={applyAnalysis}
                    type="button"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reanalyze with changes
                  </button>
                </section>
              </div>

              <section className="min-w-0 rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="section-label">Detected melody</div>
                    <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">Select a block to hear it, shift its pitch or timing, or remove it before anything reaches the song.</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button className="control-chip px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em]" onClick={() => transposeAll(-12)} type="button">Oct -</button>
                    <button className="control-chip px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em]" onClick={() => transposeAll(12)} type="button">Oct +</button>
                    <button
                      className="control-chip flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em]"
                      disabled={editHistory.length === 0}
                      onClick={undoEdit}
                      type="button"
                    >
                      <Undo2 className="h-3 w-3" /> Undo edit
                    </button>
                  </div>
                </div>

                {result.notes.length > 0 ? (
                  <div className="mt-4">
                    <TranscriptionTimeline
                      notes={result.notes}
                      onSelect={(index) => {
                        setSelectedNoteIndex(index);
                        const note = result.notes[index];
                        if (note) void auditionInstrumentNote(inferMelodyTrackType(result.notes), note.note, note.velocity);
                      }}
                      selectedIndex={selectedNoteIndex}
                    />
                    {selectedNote ? (
                      <NoteInspector
                        note={selectedNote}
                        noteNumber={(selectedNoteIndex ?? 0) + 1}
                        onAudition={auditionSelected}
                        onDelete={deleteSelectedNote}
                        onDurationChange={(steps) => updateSelectedNote((note) => ({ ...note, durationSteps: Math.max(1, Math.min(32, note.durationSteps + steps)) }))}
                        onPitchChange={(semitones) => updateSelectedNote((note) => transposeNote(note, semitones))}
                        onStartChange={(steps) => updateSelectedNote((note) => ({ ...note, startStep: Math.max(0, note.startStep + steps) }))}
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[3px] border border-dashed border-[var(--border-soft)] px-4 py-8 text-center">
                    <div className="text-[12px] font-medium text-[var(--text-primary)]">No clear notes yet</div>
                    <p className="mt-2 text-[11px] leading-5 text-[var(--text-tertiary)]">Raise sensitivity for a quiet take, or record again with one melody closer to the microphone.</p>
                  </div>
                )}

                <label className="mt-4 grid gap-1.5 border-t border-[var(--border-soft)] pt-4">
                  <span className="section-label">Lane name</span>
                  <input
                    className="control-field h-10 px-3 text-sm"
                    maxLength={48}
                    onChange={(event) => setLaneName(event.target.value)}
                    value={laneName}
                  />
                </label>

                {tempoMismatch ? (
                  <div className="mt-3 flex items-start justify-between gap-3 rounded-[3px] border border-[rgba(114,217,255,0.22)] bg-[rgba(114,217,255,0.05)] px-3 py-3 text-[10px] leading-4 text-[var(--text-secondary)]">
                    <span>This phrase is mapped at {result.bpm} BPM; the song runs at {currentSession.project.transport.bpm} BPM.</span>
                    <button
                      className="shrink-0 font-mono uppercase tracking-[0.12em] text-[var(--accent)]"
                      onClick={() => setBpmOverride(String(currentSession.project.transport.bpm))}
                      type="button"
                    >
                      Match song
                    </button>
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-[var(--border-soft)] bg-[rgba(6,9,13,0.92)] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              {status === 'ready' ? (
                <button className="control-chip px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]" onClick={resetState} type="button">Start over</button>
              ) : null}
            </div>
            <div className="flex flex-1 flex-wrap justify-end gap-2">
              <button
                className="control-chip flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                disabled={status !== 'ready' || !result?.notes.length || shelfSaved || analysisDirty}
                onClick={saveToShelf}
                type="button"
              >
                {shelfSaved ? <Check className="h-3.5 w-3.5" /> : <ListPlus className="h-3.5 w-3.5" />}
                {shelfSaved ? 'Saved to shelf' : 'Save to shelf'}
              </button>
              <button
                className="control-chip flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                disabled={status !== 'ready' || !result?.notes.length || analysisDirty}
                onClick={startNewProject}
                type="button"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Start new project
              </button>
              <button
                className="control-chip flex items-center gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                data-active={status === 'ready' && Boolean(result?.notes.length) && canAppend && !analysisDirty ? 'true' : 'false'}
                disabled={status !== 'ready' || !result?.notes.length || !canAppend || analysisDirty}
                onClick={addLaneToSong}
                title={analysisDirty
                  ? 'Reanalyze the pending cleanup changes first'
                  : canAppend
                    ? `Add at Pattern ${startPattern + 1} without replacing the song`
                    : 'The phrase is too long to fit after this pattern'}
                type="button"
              >
                <Plus className="h-3.5 w-3.5" />
                Add lane at P{startPattern + 1}
              </button>
            </div>
          </div>
          {!canAppend && status === 'ready' && result?.notes.length ? (
            <div className="mt-2 text-right text-[10px] text-[var(--warning)]">This phrase extends past Pattern {MAX_PATTERN_COUNT}; start it as a new project or shorten the source.</div>
          ) : null}
        </footer>
      </div>
    </div>
  );
};

const TranscriberProgress = ({ status }: { status: TranscriberStatus }) => {
  const activeIndex = status === 'idle' || status === 'recording'
    ? 0
    : status === 'decoding' || status === 'analyzing'
      ? 1
      : status === 'ready'
        ? 2
        : 0;
  return (
    <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-[3px] border border-[var(--border-soft)]">
      {['Input', 'Analyze', 'Review + use'].map((label, index) => (
        <div
          className="flex items-center gap-2 border-r border-[var(--border-soft)] px-3 py-2 last:border-r-0"
          data-active={index === activeIndex ? 'true' : 'false'}
          key={label}
          style={{ background: index === activeIndex ? 'rgba(114,217,255,0.08)' : 'rgba(255,255,255,0.015)' }}
        >
          <span className="font-mono text-[9px] text-[var(--accent)]">0{index + 1}</span>
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">{label}</span>
        </div>
      ))}
    </div>
  );
};

const EmptyStep = ({ index, label }: { index: string; label: string }) => (
  <div className="rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.018)] px-4 py-4">
    <div className="font-mono text-[10px] text-[var(--accent)]">{index}</div>
    <div className="mt-2 text-[11px] font-medium text-[var(--text-secondary)]">{label}</div>
  </div>
);

const ResultStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-2.5 py-2">
    <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{label}</div>
    <div className="mt-1 font-mono text-xs font-semibold text-[var(--text-primary)]">{value}</div>
  </div>
);

const WaveformStrip = ({ peaks }: { peaks: number[] }) => (
  <div aria-hidden="true" className="flex h-14 items-center gap-[1px] overflow-hidden rounded-[3px] border border-[var(--border-soft)] bg-[rgba(6,9,13,0.4)] px-2">
    {peaks.map((peak, index) => (
      <span
        className="min-w-0 flex-1 rounded-[1px] bg-[var(--accent)]"
        key={index}
        style={{ height: `${Math.max(5, Math.round(peak * 100))}%`, opacity: 0.25 + peak * 0.65 }}
      />
    ))}
  </div>
);

const TranscriptionTimeline = ({
  notes,
  onSelect,
  selectedIndex,
}: {
  notes: TranscriptionNote[];
  onSelect: (index: number) => void;
  selectedIndex: number | null;
}) => {
  const totalSteps = Math.max(16, notes.reduce((max, note) => Math.max(max, note.startStep + note.durationSteps), 0));
  const minMidi = Math.min(...notes.map((note) => note.midi));
  const maxMidi = Math.max(...notes.map((note) => note.midi));
  const pitchSpan = Math.max(6, maxMidi - minMidi + 4);
  const timelineWidth = Math.max(620, totalSteps * 18);
  const gridSteps = Array.from({ length: Math.floor(totalSteps / 4) + 1 }, (_, index) => index * 4);

  return (
    <div className="overflow-x-auto rounded-[3px] border border-[var(--border-soft)] bg-[rgba(5,8,12,0.58)]">
      <div className="relative h-[210px]" style={{ width: `${timelineWidth}px` }}>
        {gridSteps.map((step) => (
          <span
            className="absolute inset-y-0 border-l border-[rgba(255,255,255,0.055)]"
            key={step}
            style={{ left: `${(step / totalSteps) * 100}%` }}
          >
            <span className="absolute left-1 top-1 font-mono text-[8px] text-[var(--text-tertiary)]">{step + 1}</span>
          </span>
        ))}
        {[0, 1, 2, 3].map((row) => (
          <span className="absolute inset-x-0 border-t border-[rgba(255,255,255,0.035)]" key={row} style={{ top: `${25 * (row + 1)}%` }} />
        ))}
        {notes.map((note, index) => {
          const top = 12 + ((maxMidi + 2 - note.midi) / pitchSpan) * 166;
          const left = (note.startStep / totalSteps) * timelineWidth;
          const width = Math.max(18, (note.durationSteps / totalSteps) * timelineWidth - 2);
          const selected = selectedIndex === index;
          return (
            <button
              aria-label={`${note.note}, step ${note.startStep + 1}, length ${note.durationSteps}`}
              aria-pressed={selected}
              className="absolute flex h-7 items-center overflow-hidden rounded-[2px] border px-2 text-left font-mono text-[9px] font-semibold transition-colors"
              key={`${index}-${note.startStep}-${note.midi}`}
              onClick={() => onSelect(index)}
              style={{
                background: selected ? 'rgba(114,217,255,0.3)' : 'rgba(114,217,255,0.13)',
                borderColor: selected ? 'rgba(181,238,255,0.95)' : 'rgba(114,217,255,0.35)',
                color: selected ? 'rgb(226,248,255)' : 'var(--text-secondary)',
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
              }}
              title={`${note.note} · step ${note.startStep + 1} · ${note.durationSteps} step${note.durationSteps === 1 ? '' : 's'}`}
              type="button"
            >
              {width >= 34 ? note.note : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const NoteInspector = ({
  note,
  noteNumber,
  onAudition,
  onDelete,
  onDurationChange,
  onPitchChange,
  onStartChange,
}: {
  note: TranscriptionNote;
  noteNumber: number;
  onAudition: () => void;
  onDelete: () => void;
  onDurationChange: (steps: number) => void;
  onPitchChange: (semitones: number) => void;
  onStartChange: (steps: number) => void;
}) => (
  <div className="mt-3 grid gap-3 rounded-[3px] border border-[rgba(114,217,255,0.2)] bg-[rgba(114,217,255,0.045)] p-3 lg:grid-cols-[150px_minmax(0,1fr)_auto] lg:items-center">
    <div className="flex items-center gap-3">
      <button aria-label={`Play ${note.note}`} className="ghost-icon-button flex h-9 w-9 shrink-0 items-center justify-center text-[var(--accent)]" onClick={onAudition} type="button">
        <Play className="h-3.5 w-3.5 fill-current" />
      </button>
      <div>
        <div className="section-label">Note {noteNumber}</div>
        <div className="mt-1 font-mono text-lg font-semibold text-[var(--text-primary)]">{note.note}</div>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2">
      <Stepper label="Pitch" onDecrease={() => onPitchChange(-1)} onIncrease={() => onPitchChange(1)} value="1 semi" />
      <Stepper label="Start" onDecrease={() => onStartChange(-1)} onIncrease={() => onStartChange(1)} value={`Step ${note.startStep + 1}`} />
      <Stepper label="Length" onDecrease={() => onDurationChange(-1)} onIncrease={() => onDurationChange(1)} value={`${note.durationSteps} step${note.durationSteps === 1 ? '' : 's'}`} />
    </div>
    <button className="control-chip flex h-9 items-center justify-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--danger)]" onClick={onDelete} type="button">
      <Trash2 className="h-3.5 w-3.5" /> Delete
    </button>
  </div>
);

const Stepper = ({
  label,
  onDecrease,
  onIncrease,
  value,
}: {
  label: string;
  onDecrease: () => void;
  onIncrease: () => void;
  value: string;
}) => (
  <div className="min-w-0 rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] p-2">
    <div className="truncate text-center font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{label}</div>
    <div className="mt-1 flex items-center justify-between gap-1">
      <button aria-label={`Decrease ${label.toLowerCase()}`} className="ghost-icon-button flex h-7 w-7 shrink-0 items-center justify-center" onClick={onDecrease} type="button"><Minus className="h-3 w-3" /></button>
      <span className="truncate text-center font-mono text-[9px] text-[var(--text-secondary)]">{value}</span>
      <button aria-label={`Increase ${label.toLowerCase()}`} className="ghost-icon-button flex h-7 w-7 shrink-0 items-center justify-center" onClick={onIncrease} type="button"><Plus className="h-3 w-3" /></button>
    </div>
  </div>
);
