import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Mic, MicOff, Play, SlidersHorizontal, Sparkles, Square, X } from 'lucide-react';

import { engine } from '../audio/ToneEngine';
import { useAudio } from '../context/AudioContext';
import { Knob } from './Knob';
import {
  AudioRecorder,
  captureSuggestionControlsToTrackParams,
  captureSuggestionControlsToTrackSource,
  normalizeCaptureSuggestionControls,
  type CaptureSuggestion,
  type DetectedNoteCandidate,
  type LiveCaptureFrame,
  type RecordingResult,
} from '../services/audioRecording';
import {
  buildRecordedNotePreset,
  loadRecordedNotePresets,
  saveRecordedNotePreset,
  subscribeRecordedNotePresets,
  type RecordedNotePreset,
} from '../services/recordedNoteLibrary';
import { TrackIcon, getTrackPersonality } from '../utils/trackPersonality';
import {
  createTrack as createPreviewTrackModel,
  defaultNoteForTrack,
  getTrackVoicePresetDefinitions,
  type InstrumentType,
} from '../project/schema';

interface AudioCaptureProps {
  open: boolean;
  onClose: () => void;
}

interface PendingRecordedNote {
  clarity: number;
  confidence: number;
  name: string;
  note: string;
  noteCandidates: DetectedNoteCandidate[];
  pitchHz: number | null;
  suggestion: CaptureSuggestion;
}

interface StableCaptureTracker {
  bestFrame: LiveCaptureFrame;
  bestScore: number;
  committed: boolean;
  lastSeenAt: number;
  pitchHz: number;
  startedAt: number;
}

const WAVEFORM_OPTIONS = [
  { label: 'Sine', value: 'sine' },
  { label: 'Triangle', value: 'triangle' },
  { label: 'Saw', value: 'sawtooth' },
  { label: 'Square', value: 'square' },
] as const;

const FILTER_MODE_OPTIONS = [
  { label: 'Low', value: 'lowpass' },
  { label: 'Band', value: 'bandpass' },
  { label: 'High', value: 'highpass' },
] as const;

const cloneCaptureSuggestion = (suggestion: CaptureSuggestion): CaptureSuggestion => ({
  ...suggestion,
  controls: normalizeCaptureSuggestionControls(suggestion.controls),
});

const buildSuggestedRecordedNoteName = (note: string | null, suggestion: CaptureSuggestion | null) => {
  if (!note) {
    return 'Captured note';
  }

  return `${note} ${suggestion?.presetLabel ?? 'Captured note'}`.slice(0, 40);
};

const getStagedLiveSuggestions = (frame: LiveCaptureFrame | null) => {
  if (!frame || frame.signalLevel < 0.04) {
    return [] as CaptureSuggestion[];
  }

  const suggestions = frame.suggestions.map(cloneCaptureSuggestion);
  if (frame.durationSeconds < 0.24 || frame.clarity < 0.22) {
    return suggestions.slice(0, 1);
  }

  if (frame.durationSeconds < 0.56 || frame.clarity < 0.36) {
    return suggestions.slice(0, 2);
  }

  return suggestions.slice(0, 3);
};

const buildCapturePreviewTrack = (suggestion: CaptureSuggestion) => {
  const preset = suggestion.presetId
    ? getTrackVoicePresetDefinitions(suggestion.trackType).find((candidate) => candidate.id === suggestion.presetId) ?? null
    : null;

  return createPreviewTrackModel(suggestion.trackType, {
    id: `capture-preview-${suggestion.trackType}`,
    name: `Capture preview ${suggestion.trackType}`,
    params: {
      ...(preset?.params ?? {}),
      ...captureSuggestionControlsToTrackParams(suggestion.controls),
    },
    source: {
      ...(preset?.source ?? {}),
      ...captureSuggestionControlsToTrackSource(suggestion.controls),
    },
  });
};

export const AudioCapture = ({ open, onClose }: AudioCaptureProps) => {
  const {
    applyTrackVoicePreset,
    createTrack,
    initAudio,
    selectedTrackId,
    setSelectedTrackId,
    setTrackParams,
    setTrackSource,
    stampChord,
    tracks,
  } = useAudio();
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const pendingCreateRef = useRef<{ note: string | null; previousTrackCount: number; suggestion: CaptureSuggestion } | null>(null);
  const stableCaptureRef = useRef<StableCaptureTracker | null>(null);
  const [state, setState] = useState<'idle' | 'recording' | 'analyzing' | 'ready' | 'error'>('idle');
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeNoteIndex, setActiveNoteIndex] = useState(0);
  const [liveFrame, setLiveFrame] = useState<LiveCaptureFrame | null>(null);
  const [pendingRecordedNote, setPendingRecordedNote] = useState<PendingRecordedNote | null>(null);
  const [captureNameDraft, setCaptureNameDraft] = useState('');
  const [recordedNoteLibrary, setRecordedNoteLibrary] = useState<RecordedNotePreset[]>([]);
  const [sessionRecordedNotes, setSessionRecordedNotes] = useState<RecordedNotePreset[]>([]);
  const [suggestions, setSuggestions] = useState<CaptureSuggestion[]>([]);

  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? null;
  const activeNoteCandidate = result?.noteCandidates[activeNoteIndex] ?? result?.noteCandidates[0] ?? null;
  const selectedDetectedNote = activeNoteCandidate?.note ?? result?.detectedNote ?? null;

  useEffect(() => {
    if (!result) {
      setSuggestions([]);
      setActiveNoteIndex(0);
      return;
    }

    setSuggestions(result.suggestions.map(cloneCaptureSuggestion));
    setActiveNoteIndex(0);
  }, [result]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    setRecordedNoteLibrary(loadRecordedNotePresets());
    return subscribeRecordedNotePresets(setRecordedNoteLibrary);
  }, [open]);

  const applySuggestionToTrack = useCallback((trackId: string, suggestion: CaptureSuggestion, note: string | null) => {
    if (suggestion.presetId) {
      applyTrackVoicePreset(trackId, suggestion.presetId);
    }

    setTrackSource(trackId, captureSuggestionControlsToTrackSource(suggestion.controls));
    setTrackParams(trackId, captureSuggestionControlsToTrackParams(suggestion.controls));

    if (note) {
      stampChord(trackId, 0, [note], { gate: 1.5, velocity: 0.82 });
    }
    setSelectedTrackId(trackId);
  }, [applyTrackVoicePreset, setSelectedTrackId, setTrackParams, setTrackSource, stampChord]);

  useEffect(() => {
    const pending = pendingCreateRef.current;
    if (!pending || tracks.length <= pending.previousTrackCount || !selectedTrackId) {
      return;
    }

    const nextTrack = tracks.find((track) => track.id === selectedTrackId);
    if (!nextTrack || nextTrack.type !== pending.suggestion.trackType) {
      return;
    }

    applySuggestionToTrack(nextTrack.id, pending.suggestion, pending.note);
    pendingCreateRef.current = null;
    onClose();
  }, [applySuggestionToTrack, onClose, selectedTrackId, tracks]);

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

  useEffect(() => {
    if (!open) {
      recorderRef.current?.cancel();
      recorderRef.current = null;
      stableCaptureRef.current = null;
      setState('idle');
      setResult(null);
      setLiveFrame(null);
      setPendingRecordedNote(null);
      setCaptureNameDraft('');
      setSessionRecordedNotes([]);
      setSuggestions([]);
      setError(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    }
  }, [open, previewUrl]);

  useEffect(() => {
    if (state !== 'recording' || !liveFrame) {
      return;
    }

    const candidate = liveFrame.noteCandidates[0] ?? null;
    const tracker = stableCaptureRef.current;
    const now = Date.now();

    if (!isStableCaptureFrame(liveFrame)) {
      if (tracker && now - tracker.lastSeenAt > 260) {
        stableCaptureRef.current = null;
      }
      return;
    }

    if (tracker?.committed) {
      if (isPitchCompatible(tracker.pitchHz, liveFrame.detectedPitchHz ?? tracker.pitchHz)) {
        stableCaptureRef.current = {
          ...tracker,
          lastSeenAt: now,
          pitchHz: (tracker.pitchHz * 0.72) + ((liveFrame.detectedPitchHz ?? tracker.pitchHz) * 0.28),
        };
        return;
      }

      stableCaptureRef.current = {
        bestFrame: liveFrame,
        bestScore: scoreStableCaptureFrame(liveFrame),
        committed: false,
        lastSeenAt: now,
        pitchHz: liveFrame.detectedPitchHz ?? tracker.pitchHz,
        startedAt: now,
      };
      return;
    }

    if (!tracker || !isPitchCompatible(tracker.pitchHz, liveFrame.detectedPitchHz ?? tracker.pitchHz) || now - tracker.lastSeenAt > 260) {
      stableCaptureRef.current = {
        bestFrame: liveFrame,
        bestScore: scoreStableCaptureFrame(liveFrame),
        committed: false,
        lastSeenAt: now,
        pitchHz: liveFrame.detectedPitchHz ?? 0,
        startedAt: now,
      };
      return;
    }

    const nextTracker: StableCaptureTracker = {
      ...tracker,
      lastSeenAt: now,
      pitchHz: (tracker.pitchHz * 0.72) + ((liveFrame.detectedPitchHz ?? tracker.pitchHz) * 0.28),
    };
    const nextScore = scoreStableCaptureFrame(liveFrame);
    if (nextScore >= tracker.bestScore) {
      nextTracker.bestFrame = liveFrame;
      nextTracker.bestScore = nextScore;
    }

    if (!pendingRecordedNote && now - nextTracker.startedAt >= 340) {
      const nextDraft = buildPendingRecordedNote(nextTracker.bestFrame);
      if (nextDraft) {
        nextTracker.committed = true;
        setPendingRecordedNote(nextDraft);
        setCaptureNameDraft(nextDraft.name);
      }
    }

    stableCaptureRef.current = nextTracker;
    if (!candidate) {
      stableCaptureRef.current = null;
    }
  }, [liveFrame, pendingRecordedNote, state]);

  const startRecording = useCallback(async () => {
    setError(null);
    setResult(null);
    setLiveFrame(null);
    setPendingRecordedNote(null);
    setCaptureNameDraft('');
    setSessionRecordedNotes([]);
    stableCaptureRef.current = null;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    const recorder = new AudioRecorder();
    recorder.onLiveUpdate((frame) => {
      setLiveFrame({
        ...frame,
        noteCandidates: [...frame.noteCandidates],
        suggestions: frame.suggestions.map(cloneCaptureSuggestion),
      });
    });
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
      setLiveFrame(null);
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
    stableCaptureRef.current = null;
    setState('idle');
    setResult(null);
    setLiveFrame(null);
    setSuggestions([]);
    setPendingRecordedNote(null);
    setCaptureNameDraft('');
    setSessionRecordedNotes([]);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setError(null);
  }, [previewUrl]);

  const queueNextRecordedNote = useCallback(() => {
    stableCaptureRef.current = null;
    setPendingRecordedNote(null);
    setCaptureNameDraft('');
  }, []);

  const savePendingRecordedNote = useCallback(() => {
    if (!pendingRecordedNote) {
      return;
    }

    const nextPreset = buildRecordedNotePreset({
      clarity: pendingRecordedNote.clarity,
      confidence: pendingRecordedNote.confidence,
      name: captureNameDraft || pendingRecordedNote.name,
      note: pendingRecordedNote.note,
      pitchHz: pendingRecordedNote.pitchHz,
      suggestion: pendingRecordedNote.suggestion,
    });
    const nextLibrary = saveRecordedNotePreset(nextPreset);

    setRecordedNoteLibrary(nextLibrary);
    setSessionRecordedNotes((current) => [nextPreset, ...current.filter((entry) => entry.id !== nextPreset.id)]);
    setPendingRecordedNote(null);
    setCaptureNameDraft('');
  }, [captureNameDraft, pendingRecordedNote]);

  const saveSuggestedRecordedNote = useCallback((suggestion: CaptureSuggestion) => {
    const detectedNote = selectedDetectedNote ?? suggestion.note;
    if (!detectedNote) {
      return;
    }

    const nextPreset = buildRecordedNotePreset({
      clarity: result?.clarity ?? liveFrame?.clarity ?? pendingRecordedNote?.clarity ?? 0,
      confidence: activeNoteCandidate?.confidence ?? suggestion.confidence,
      name: captureNameDraft || buildSuggestedRecordedNoteName(detectedNote, suggestion),
      note: detectedNote,
      pitchHz: activeNoteCandidate?.pitchHz ?? result?.detectedPitchHz ?? liveFrame?.detectedPitchHz ?? pendingRecordedNote?.pitchHz ?? null,
      suggestion,
    });
    const nextLibrary = saveRecordedNotePreset(nextPreset);

    setRecordedNoteLibrary(nextLibrary);
    setSessionRecordedNotes((current) => [nextPreset, ...current.filter((entry) => entry.id !== nextPreset.id)]);
  }, [activeNoteCandidate, captureNameDraft, liveFrame, pendingRecordedNote, result, selectedDetectedNote]);

  const createSuggestedTrack = useCallback((suggestion: CaptureSuggestion) => {
    pendingCreateRef.current = {
      note: selectedDetectedNote,
      previousTrackCount: tracks.length,
      suggestion,
    };
    createTrack(suggestion.trackType);
  }, [createTrack, selectedDetectedNote, tracks.length]);

  const applyToMatchingTrack = useCallback((suggestion: CaptureSuggestion) => {
    const match = tracks.find((track) => track.type === suggestion.trackType);
    if (!match) {
      return;
    }

    applySuggestionToTrack(match.id, suggestion, selectedDetectedNote);
    onClose();
  }, [applySuggestionToTrack, onClose, selectedDetectedNote, tracks]);

  const auditionSuggestion = useCallback(async (suggestion: CaptureSuggestion) => {
    await initAudio();
    const previewTrack = buildCapturePreviewTrack(suggestion);
    const previewNote = selectedDetectedNote ?? suggestion.note ?? defaultNoteForTrack(previewTrack);
    engine.previewTrack(previewTrack, previewNote);
  }, [initAudio, selectedDetectedNote]);

  const downloadRecording = useCallback(() => {
    if (!result) return;
    const anchor = document.createElement('a');
    anchor.href = previewUrl ?? URL.createObjectURL(result.blob);
    anchor.download = `sonicstudio-capture-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
    anchor.click();
  }, [previewUrl, result]);

  if (!open) return null;

  const liveSuggestions = getStagedLiveSuggestions(liveFrame);
  const saveableDetectedNote = selectedDetectedNote ?? liveFrame?.noteCandidates[0]?.note ?? pendingRecordedNote?.note ?? null;
  const captureNamePlaceholder = buildSuggestedRecordedNoteName(
    saveableDetectedNote,
    suggestions[0] ?? liveSuggestions[0] ?? pendingRecordedNote?.suggestion ?? null,
  );
  const rankedSuggestionCount = suggestions.length;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(4,7,11,0.72)] p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="surface-panel-strong w-[min(980px,96vw)] max-h-[88vh] overflow-auto p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <Mic className="h-4 w-4" />
              <span className="section-label text-[var(--accent)]">Audio capture</span>
            </div>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Record something and we'll suggest the closest notes and lanes.
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
              Hum, whistle, tap, or record a short phrase. SonicStudio listens for the main pitch, gives you a few nearby note guesses, and suggests three lanes you can tweak. Everything stays on your device.
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
                  {state === 'idle' && 'Tap record, make a sound for a second or two, then stop.'}
                  {state === 'recording' && 'Listening now. Hold a steady tone for the clearest match.'}
                  {state === 'analyzing' && 'Analyzing...'}
                  {state === 'ready' && 'Got it. Check the preview and suggestions below.'}
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

            {state === 'recording' && (
              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
                <section className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(6,9,13,0.34)] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="section-label">Live meter</div>
                      <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                        While you record, SonicStudio is tracking the level, pitch, and likely lane matches.
                      </div>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
                      {liveFrame ? `${Math.round(liveFrame.signalLevel * 100)}%` : '0%'}
                    </span>
                  </div>

                  <div className="mt-4 h-3 w-full overflow-hidden rounded-[2px] bg-[rgba(255,255,255,0.06)]">
                    <div
                      className="h-full rounded-[2px] bg-[linear-gradient(90deg,rgba(114,217,255,0.28),rgba(114,217,255,0.95))] transition-[width] duration-100"
                      style={{ width: `${Math.max(4, (liveFrame?.signalLevel ?? 0) * 100)}%` }}
                    />
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Current note</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
                        {liveFrame?.detectedNote ?? 'Listening...'}
                      </div>
                      <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                        {liveFrame?.detectedPitchHz
                          ? `${liveFrame.detectedPitchHz.toFixed(1)} Hz · ${Math.round(liveFrame.clarity * 100)}% clarity`
                          : 'No steady pitch yet. Try holding the note a little longer.'}
                      </div>

                      {liveFrame && liveFrame.noteCandidates.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {liveFrame.noteCandidates.map((candidate) => (
                            <span
                              className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]"
                              key={`${candidate.note}-${candidate.midi}`}
                            >
                              {candidate.note} · {Math.round(candidate.confidence * 100)}%
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
                      <div className="section-label">Live read</div>
                      <div className="mt-3 grid gap-2 text-[12px] leading-5">
                        <Detail label="Level" value={liveFrame ? `${Math.round(liveFrame.signalLevel * 100)}%` : '0%'} />
                        <Detail label="Brightness" value={liveFrame ? `${Math.round(liveFrame.brightness * 100)}%` : '—'} />
                        <Detail label="Clarity" value={liveFrame ? `${Math.round(liveFrame.clarity * 100)}%` : '—'} />
                        <Detail label="Attack" value={liveFrame ? describeAttack(liveFrame.transientDensity) : '—'} />
                        <Detail label="Pitch" value={liveFrame?.detectedPitchHz ? `${liveFrame.detectedPitchHz.toFixed(1)} Hz` : '—'} />
                      </div>
                      <div className="mt-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                        {liveFrame
                          ? describeTimingFit(liveFrame.durationSeconds, liveFrame.transientDensity)
                          : 'Hold the sound for a moment and the attack readout will settle in.'}
                      </div>
                    </div>
                  </div>
                </section>

                <div className="grid gap-3">
                  <section className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(6,9,13,0.34)] px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                      <span className="section-label">Live lane matches</span>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {liveSuggestions.map((suggestion, index) => (
                        <div
                          className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3"
                          key={`${suggestion.trackType}-${index}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <SuggestionBadge type={suggestion.trackType} />
                            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent)]">
                              {Math.round(suggestion.confidence * 100)}%
                            </span>
                          </div>
                          <div className="mt-2 text-[12px] font-medium text-[var(--text-primary)]">{suggestion.presetLabel}</div>
                          <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">{suggestion.reason}</div>
                        </div>
                      ))}

                      {liveFrame && liveSuggestions.length > 0 && liveSuggestions.length < 3 && (
                        <div className="rounded-[2px] border border-[rgba(114,217,255,0.2)] bg-[rgba(114,217,255,0.06)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                          {liveSuggestions.length === 1
                            ? 'Closest immediate match is up. Keep the sound steady a little longer and the alternate options will appear.'
                            : 'The first alternatives are in. Hold the sound a touch longer if you want the third option to settle too.'}
                        </div>
                      )}

                      {!liveFrame && (
                        <div className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                          Start recording to watch the note and lane matches settle in.
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(6,9,13,0.34)] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="section-label">Captured note shelf</div>
                        <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                          Once a note is steady enough, it lands here so you can name it, save it, and keep listening for the next one.
                        </div>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                        Library {recordedNoteLibrary.length}
                      </span>
                    </div>

                    {pendingRecordedNote ? (
                      <PendingRecordedNoteCard
                        captureNameDraft={captureNameDraft}
                        isRecording={state === 'recording'}
                        onNameChange={setCaptureNameDraft}
                        onNextNote={queueNextRecordedNote}
                        onSave={savePendingRecordedNote}
                        pendingRecordedNote={pendingRecordedNote}
                      />
                    ) : (
                      <div className="mt-3 rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                        Hold a pitch until the note and clarity settle. Small fluctuations can still land a capture now; it does not need one perfectly frozen tone for ages.
                      </div>
                    )}

                    {sessionRecordedNotes.length > 0 && (
                      <div className="mt-3 grid gap-2">
                        {sessionRecordedNotes.map((savedNote) => (
                          <div key={savedNote.id}>
                            <SavedRecordedNoteCard savedNote={savedNote} />
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            )}
          </section>

          {result && previewUrl && (
            <section className="surface-panel-strong p-4">
              <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
                <div className="grid gap-4">
                  <div>
                    <div className="section-label">What we heard</div>
                    <div className="mt-3 grid gap-2 text-[12px] leading-5">
                      <Detail label="Duration" value={`${result.durationSeconds.toFixed(2)}s`} />
                      <Detail label="Loudness" value={Number.isFinite(result.rmsDb) ? `${result.rmsDb.toFixed(1)} dB` : '—'} />
                      <Detail label="Pitch" value={result.detectedPitchHz ? `${result.detectedPitchHz.toFixed(1)} Hz` : 'Not pitched'} />
                      <Detail label="Clarity" value={`${Math.round(result.clarity * 100)}%`} />
                      <Detail label="Brightness" value={`${Math.round(result.brightness * 100)}%`} />
                      <Detail label="Attack" value={describeAttack(result.transientDensity)} />
                    </div>
                    <div className="mt-3 rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                      <div className="section-label">Timing fit</div>
                      <div className="mt-2">{describeTimingFit(result.durationSeconds, result.transientDensity)}</div>
                    </div>
                  </div>

                  <div className="border-t border-[var(--border-soft)] pt-4">
                    <div className="section-label">Playback</div>
                    <audio
                      ref={audioElRef}
                      className="mt-2 w-full"
                      controls
                      src={previewUrl}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="control-chip flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                        onClick={downloadRecording}
                        type="button"
                      >
                        Download .webm
                      </button>
                      <button
                        className="control-chip flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                        onClick={cancel}
                        type="button"
                      >
                        <MicOff className="h-3.5 w-3.5" />
                        Record again
                      </button>
                    </div>
                  </div>

                  {result.noteCandidates.length > 0 && (
                    <div className="border-t border-[var(--border-soft)] pt-4">
                      <div className="section-label">Closest notes</div>
                      <div className="mt-3 grid gap-2">
                        {result.noteCandidates.map((candidate, index) => (
                          <button
                            className="flex items-center justify-between border px-3 py-2 text-left transition-colors"
                            data-active={activeNoteCandidate?.note === candidate.note}
                            key={`${candidate.note}-${candidate.midi}`}
                            onClick={() => setActiveNoteIndex(index)}
                            style={{
                              background: activeNoteIndex === index ? 'rgba(114, 217, 255, 0.08)' : 'rgba(255,255,255,0.02)',
                              borderColor: activeNoteIndex === index ? 'rgba(114, 217, 255, 0.28)' : 'var(--border-soft)',
                              borderRadius: '2px',
                            }}
                            type="button"
                          >
                            <div>
                              <div className="font-mono text-[12px] text-[var(--text-primary)]">{candidate.note}</div>
                              <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                                {candidate.centsOff > 0 ? '+' : ''}{candidate.centsOff.toFixed(1)} ct · {candidate.pitchHz.toFixed(1)} Hz
                              </div>
                            </div>
                            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent)]">
                              {Math.round(candidate.confidence * 100)}%
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(sessionRecordedNotes.length > 0 || pendingRecordedNote) && (
                    <div className="border-t border-[var(--border-soft)] pt-4">
                      <div className="section-label">Recorded note shelf</div>
                      <p className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                        Notes saved during this pass stay here after you stop. They also land in your saved note library for quick recall from the Piano Roll menu.
                      </p>
                      {pendingRecordedNote && (
                        <PendingRecordedNoteCard
                          captureNameDraft={captureNameDraft}
                          isRecording={false}
                          onNameChange={setCaptureNameDraft}
                          onNextNote={undefined}
                          onSave={savePendingRecordedNote}
                          pendingRecordedNote={pendingRecordedNote}
                        />
                      )}
                      {sessionRecordedNotes.length > 0 && (
                        <div className="mt-3 grid gap-2">
                          {sessionRecordedNotes.map((savedNote) => (
                            <div key={savedNote.id}>
                              <SavedRecordedNoteCard savedNote={savedNote} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="min-w-0 border-t border-[var(--border-soft)] pt-4 xl:border-t-0 xl:border-l xl:pl-4 xl:pt-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                    <span className="section-label">Lane matches</span>
                  </div>
                  <p className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">
                    Best guess first, then two nearby alternatives. You can tweak each one before creating a lane or applying it to an existing one.
                  </p>

                  <div className="mt-3 rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                    <div className="section-label">Why the top match won</div>
                    <div className="mt-2">{result.reason}</div>
                  </div>

                  {saveableDetectedNote && (
                    <div className="mt-3 rounded-[2px] border border-[rgba(114,217,255,0.2)] bg-[rgba(114,217,255,0.05)] px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="section-label">Store this capture</div>
                          <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                            Name the detected note once, then save any option below with its own voice settings. Saved notes show up later in the Piano Roll menu.
                          </div>
                        </div>
                        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                          {saveableDetectedNote}
                        </span>
                      </div>
                      <label className="mt-3 grid gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Saved name</span>
                        <input
                          className="control-field h-10 px-3 text-sm"
                          onChange={(event) => setCaptureNameDraft(event.target.value)}
                          placeholder={captureNamePlaceholder}
                          value={captureNameDraft}
                        />
                      </label>
                    </div>
                  )}

                  <div className="mt-4 grid gap-3">
                    {suggestions.map((suggestion, index) => {
                      const existingTrack = tracks.find((track) => track.type === suggestion.trackType) ?? null;
                      const rankLabel = index === 0 ? 'Best match' : index === 1 ? 'Also try' : 'Another option';

                      return (
                        <div key={`${suggestion.trackType}-${index}`}>
                          <SuggestionCard
                            activeNote={selectedDetectedNote}
                            existingTrackName={existingTrack?.name ?? null}
                            isSelectedTrackFamily={selectedTrack?.type === suggestion.trackType}
                            onApplyToExisting={existingTrack ? () => applyToMatchingTrack(suggestion) : undefined}
                            onAudition={() => void auditionSuggestion(suggestion)}
                            onCreateTrack={() => createSuggestedTrack(suggestion)}
                            onSaveNote={saveableDetectedNote ? () => saveSuggestedRecordedNote(suggestion) : undefined}
                            onUpdateControls={(updates) => {
                              setSuggestions((current) => current.map((entry, suggestionIndex) => (
                                suggestionIndex === index
                                  ? { ...entry, controls: { ...entry.controls, ...updates } }
                                  : entry
                              )));
                            }}
                            rankLabel={rankLabel}
                            suggestion={suggestion}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {rankedSuggestionCount === 0 && (
                    <div className="mt-4 rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-4 py-4 text-[12px] leading-5 text-[var(--text-secondary)]">
                      No good matches yet. Try a cleaner, longer sound or hold one note steady.
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          <p className="text-[11px] leading-5 text-[var(--text-tertiary)]">
            How matching works: we compare pitch across a few analysis windows, read the brightness and attack shape, then use that combined profile to suggest nearby notes and lanes. It is still an estimate, but it is far better than a single nearest-note guess. Everything stays on your device.
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

const describeAttack = (transientDensity: number) => {
  if (transientDensity > 0.72) {
    return 'Sharp attack';
  }

  if (transientDensity < 0.18) {
    return 'Soft swell';
  }

  return 'Steady pulse';
};

const describeTimingFit = (durationSeconds: number, transientDensity: number) => {
  if (transientDensity > 0.7) {
    return 'Best for short hits, hats, and clipped rhythmic parts.';
  }

  if (durationSeconds > 1.35 && transientDensity < 0.24) {
    return 'Best for held notes, pads, and longer glassy layers.';
  }

  if (durationSeconds < 0.45) {
    return 'Best for stabs, plucks, and tight chopped phrases.';
  }

  return 'Best for short melodic phrases and mid-length sustained parts.';
};

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

const PendingRecordedNoteCard = ({
  captureNameDraft,
  isRecording,
  onNameChange,
  onNextNote,
  onSave,
  pendingRecordedNote,
}: {
  captureNameDraft: string;
  isRecording: boolean;
  onNameChange: (value: string) => void;
  onNextNote?: () => void;
  onSave: () => void;
  pendingRecordedNote: PendingRecordedNote;
}) => (
  <div className="mt-3 rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Ready to save</div>
        <div className="mt-2 flex items-center gap-2">
          <div className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{pendingRecordedNote.note}</div>
          <SuggestionBadge type={pendingRecordedNote.suggestion.trackType} />
        </div>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent)]">
        {Math.round(pendingRecordedNote.confidence * 100)}%
      </span>
    </div>

    <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
      {pendingRecordedNote.pitchHz ? `${pendingRecordedNote.pitchHz.toFixed(1)} Hz` : 'Pitched capture'} · {Math.round(pendingRecordedNote.clarity * 100)}% clarity · {pendingRecordedNote.suggestion.presetLabel}
    </div>

    <div className="mt-3 flex flex-wrap gap-2">
      {pendingRecordedNote.noteCandidates.slice(0, 3).map((candidate) => (
        <span
          className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]"
          key={`${pendingRecordedNote.note}-${candidate.note}-${candidate.midi}`}
        >
          {candidate.note} · {Math.round(candidate.confidence * 100)}%
        </span>
      ))}
    </div>

    <label className="mt-3 grid gap-2">
      <span className="section-label">Saved name</span>
      <input
        className="control-field h-10 px-3 text-sm"
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="Name this captured note"
        value={captureNameDraft}
      />
    </label>

    <div className="mt-3 flex flex-wrap gap-2">
      <button
        className="control-chip flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
        data-active="true"
        onClick={onSave}
        type="button"
      >
        <Check className="h-3.5 w-3.5" />
        Save note
      </button>
      {isRecording && onNextNote && (
        <button
          className="control-chip flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
          onClick={onNextNote}
          type="button"
        >
          Next note
        </button>
      )}
    </div>
  </div>
);

const SavedRecordedNoteCard = ({ savedNote }: { savedNote: RecordedNotePreset }) => (
  <div className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-[var(--text-primary)]">{savedNote.name}</div>
        <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
          {savedNote.note} · {savedNote.presetLabel} · {Math.round(savedNote.clarity * 100)}% clarity
        </div>
      </div>
      <SuggestionBadge type={savedNote.trackType} />
    </div>
  </div>
);

const isStableCaptureFrame = (frame: LiveCaptureFrame) => {
  const candidate = frame.noteCandidates[0] ?? null;

  return Boolean(
    candidate
    && frame.detectedPitchHz
    && frame.signalLevel >= 0.04
    && frame.clarity >= 0.36
    && candidate.confidence >= 0.42
    && frame.suggestions[0],
  );
};

const scoreStableCaptureFrame = (frame: LiveCaptureFrame) => {
  const candidate = frame.noteCandidates[0] ?? null;

  return (frame.clarity * 0.68) + ((candidate?.confidence ?? 0) * 0.32);
};

const isPitchCompatible = (leftHz: number, rightHz: number) => {
  if (!Number.isFinite(leftHz) || !Number.isFinite(rightHz) || leftHz <= 0 || rightHz <= 0) {
    return false;
  }

  return Math.abs(12 * Math.log2(leftHz / rightHz)) <= 0.9;
};

const buildPendingRecordedNote = (frame: LiveCaptureFrame): PendingRecordedNote | null => {
  const candidate = frame.noteCandidates[0] ?? null;
  const suggestion = frame.suggestions[0] ?? null;

  if (!candidate || !suggestion) {
    return null;
  }

  return {
    clarity: frame.clarity,
    confidence: candidate.confidence,
    name: `${candidate.note} ${suggestion.presetLabel}`.slice(0, 40),
    note: candidate.note,
    noteCandidates: [...frame.noteCandidates],
    pitchHz: frame.detectedPitchHz,
    suggestion: {
      ...suggestion,
      controls: { ...suggestion.controls },
    },
  };
};

const SuggestionCard = ({
  activeNote,
  existingTrackName,
  isSelectedTrackFamily,
  onApplyToExisting,
  onAudition,
  onCreateTrack,
  onSaveNote,
  onUpdateControls,
  rankLabel,
  suggestion,
}: {
  activeNote: string | null;
  existingTrackName: string | null;
  isSelectedTrackFamily: boolean;
  onApplyToExisting?: () => void;
  onAudition?: () => void;
  onCreateTrack: () => void;
  onSaveNote?: () => void;
  onUpdateControls: (updates: Partial<CaptureSuggestion['controls']>) => void;
  rankLabel: string;
  suggestion: CaptureSuggestion;
}) => (
  <section className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-4 py-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{rankLabel}</div>
        <div className="mt-2 flex items-center gap-2">
          <SuggestionBadge type={suggestion.trackType} />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">{Math.round(suggestion.confidence * 100)}%</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold text-[var(--text-primary)]">{suggestion.presetLabel}</div>
        <div className="mt-1 text-[11px] text-[var(--text-secondary)]">{activeNote ?? suggestion.note ?? 'No note'}</div>
      </div>
    </div>

    <div className="mt-3 h-[3px] w-full overflow-hidden rounded-[2px] bg-[rgba(255,255,255,0.06)]">
      <div
        className="h-full rounded-[2px] bg-[linear-gradient(90deg,var(--accent),rgba(114,217,255,0.34))]"
        style={{ width: `${Math.max(12, suggestion.confidence * 100)}%` }}
      />
    </div>

    <p className="mt-3 text-[12px] leading-5 text-[var(--text-secondary)]">{suggestion.reason}</p>

    <div className="mt-4 rounded-[2px] border border-[var(--border-soft)] bg-[rgba(6,9,13,0.36)] px-3 py-3">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
        <span className="section-label">Capture controls</span>
      </div>
      <div className="mt-4 grid gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Pitch response</div>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Knob
              color="#7dd3fc"
              label="Octave"
              max={3}
              min={-3}
              onChange={(value) => onUpdateControls({ octaveShift: Math.round(value) })}
              step={1}
              value={suggestion.controls.octaveShift}
            />
            <Knob
              color="#7dd3fc"
              label="Detune"
              max={1200}
              min={-1200}
              onChange={(value) => onUpdateControls({ detune: value })}
              unit="ct"
              value={suggestion.controls.detune}
            />
            <Knob
              color="#7dd3fc"
              label="Glide"
              max={0.2}
              min={0}
              onChange={(value) => onUpdateControls({ portamento: value })}
              unit="s"
              value={suggestion.controls.portamento}
            />
          </div>
        </div>

        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Envelope</div>
          <div className="mt-3 grid gap-4 sm:grid-cols-4">
            <Knob
              color="#f2c47b"
              label="Attack"
              max={1}
              min={0.001}
              onChange={(value) => onUpdateControls({ attack: value })}
              unit="s"
              value={suggestion.controls.attack}
            />
            <Knob
              color="#f2c47b"
              label="Decay"
              max={2}
              min={0.01}
              onChange={(value) => onUpdateControls({ decay: value })}
              unit="s"
              value={suggestion.controls.decay}
            />
            <Knob
              color="#f2c47b"
              label="Sustain"
              max={1}
              min={0}
              onChange={(value) => onUpdateControls({ sustain: value })}
              value={suggestion.controls.sustain}
            />
            <Knob
              color="#f2c47b"
              label="Release"
              max={4}
              min={0.01}
              onChange={(value) => onUpdateControls({ release: value })}
              unit="s"
              value={suggestion.controls.release}
            />
          </div>
        </div>

        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Tone and tail</div>
          <div className="mt-3 grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
            <Knob
              color="#e7a65f"
              label="Cutoff"
              max={15000}
              min={20}
              onChange={(value) => onUpdateControls({ cutoff: value })}
              unit="Hz"
              value={suggestion.controls.cutoff}
            />
            <Knob
              color="#e7a65f"
              label="Res"
              max={20}
              min={0.1}
              onChange={(value) => onUpdateControls({ resonance: value })}
              value={suggestion.controls.resonance}
            />
            <Knob
              color="#f08f86"
              label="Drive"
              max={1}
              min={0}
              onChange={(value) => onUpdateControls({ distortion: value })}
              value={suggestion.controls.distortion}
            />
            <Knob
              color="#d79cff"
              label="Crush"
              max={1}
              min={0}
              onChange={(value) => onUpdateControls({ bitCrush: value })}
              value={suggestion.controls.bitCrush}
            />
            <Knob
              color="#96b9f3"
              label="Delay"
              max={1}
              min={0}
              onChange={(value) => onUpdateControls({ delaySend: value })}
              value={suggestion.controls.delaySend}
            />
            <Knob
              color="#96b9f3"
              label="Reverb"
              max={1}
              min={0}
              onChange={(value) => onUpdateControls({ reverbSend: value })}
              value={suggestion.controls.reverbSend}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Waveform</span>
            <select
              className="control-field h-10 px-3 text-sm"
              onChange={(event) => onUpdateControls({ waveform: event.target.value as CaptureSuggestion['controls']['waveform'] })}
              value={suggestion.controls.waveform}
            >
              {WAVEFORM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Filter</span>
            <select
              className="control-field h-10 px-3 text-sm"
              onChange={(event) => onUpdateControls({ filterMode: event.target.value as CaptureSuggestion['controls']['filterMode'] })}
              value={suggestion.controls.filterMode}
            >
              {FILTER_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      {onAudition && (
        <button
          className="control-chip flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
          onClick={onAudition}
          type="button"
        >
          <Play className="h-3.5 w-3.5" />
          Play match
        </button>
      )}
      <button
        className="control-chip flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
        data-active="true"
        onClick={onCreateTrack}
        type="button"
      >
        <Check className="h-3.5 w-3.5" />
        Create {suggestion.trackType} lane
      </button>
      {onApplyToExisting && (
        <button
          className="control-chip flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
          onClick={onApplyToExisting}
          type="button"
        >
          {isSelectedTrackFamily ? 'Tune selected lane' : `Use ${existingTrackName}`}
        </button>
      )}
      {onSaveNote && (
        <button
          className="control-chip flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
          onClick={onSaveNote}
          type="button"
        >
          <Check className="h-3.5 w-3.5" />
          Save note
        </button>
      )}
    </div>

    <div className="mt-3 text-[11px] leading-5 text-[var(--text-tertiary)]">
      {activeNote ? `Step 1 will be filled with ${activeNote} so you can hear the match right away.` : 'No steady note was found, so the lane will only get the tuned voice settings.'}
    </div>
  </section>
);
