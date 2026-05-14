import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Download, Mic, MicOff, Play, SlidersHorizontal, Sparkles, Square, Trash2, X } from 'lucide-react';

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
import {
  deleteVocalTake,
  getVocalTakeBlob,
  listVocalTakeSummaries,
  saveVocalTake,
  subscribeVocalTakeSummaries,
  type VocalTakeSummary,
} from '../services/vocalTakeLibrary';
import { getPitchCoachFeedback } from '../services/pitchCoach';
import { TrackIcon, getTrackPersonality } from '../utils/trackPersonality';
import { convertRecordingBlobToWav } from '../utils/export';
import {
  createTrack as createPreviewTrackModel,
  defaultNoteForTrack,
  getTrackVoicePresetDefinitions,
  type InstrumentType,
} from '../project/schema';
import type { CaptureAnalysisProfile, CapturePreferences } from '../project/preferences';

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
const PITCH_COACH_NOTE_OPTIONS = buildPitchCoachNoteOptions(6, 2);

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

const buildSuggestedVocalTakeName = (note: string | null) => (
  note ? `Vocal ${note} take` : 'Vocal take'
);

const buildCaptureFileName = (name: string, extension: 'wav' | 'webm') => {
  const stem = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || `capture-${new Date().toISOString().replace(/[:.]/g, '-')}`;

  return `${stem}.${extension}`;
};

const downloadBlobFile = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const CAPTURE_ANALYSIS_CONFIGS: Record<CaptureAnalysisProfile, {
  liveSuggestionClarity: [number, number];
  liveSuggestionDuration: [number, number];
  quietStable: { clarity: number; confidence: number; signal: number };
  stable: { clarity: number; confidence: number; signal: number };
}> = {
  quick: {
    liveSuggestionClarity: [0.18, 0.3],
    liveSuggestionDuration: [0.18, 0.42],
    quietStable: { clarity: 0.54, confidence: 0.66, signal: 0.042 },
    stable: { clarity: 0.4, confidence: 0.46, signal: 0.05 },
  },
  balanced: {
    liveSuggestionClarity: [0.22, 0.36],
    liveSuggestionDuration: [0.24, 0.56],
    quietStable: { clarity: 0.6, confidence: 0.72, signal: 0.045 },
    stable: { clarity: 0.44, confidence: 0.5, signal: 0.055 },
  },
  steady: {
    liveSuggestionClarity: [0.26, 0.44],
    liveSuggestionDuration: [0.3, 0.68],
    quietStable: { clarity: 0.68, confidence: 0.78, signal: 0.05 },
    stable: { clarity: 0.5, confidence: 0.56, signal: 0.065 },
  },
};

export const getStagedLiveSuggestions = (frame: LiveCaptureFrame | null, capturePreferences: CapturePreferences) => {
  if (!frame || frame.signalLevel < 0.04) {
    return [] as CaptureSuggestion[];
  }

  const profile = CAPTURE_ANALYSIS_CONFIGS[capturePreferences.analysisProfile];
  const suggestions = frame.suggestions
    .map(cloneCaptureSuggestion)
    .slice(0, capturePreferences.liveSuggestionCount);
  if (frame.durationSeconds < profile.liveSuggestionDuration[0] || frame.clarity < profile.liveSuggestionClarity[0]) {
    return suggestions.slice(0, 1);
  }

  if (frame.durationSeconds < profile.liveSuggestionDuration[1] || frame.clarity < profile.liveSuggestionClarity[1]) {
    return suggestions.slice(0, 2);
  }

  return suggestions;
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
    capturePreferences,
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
  const [pitchCoachTarget, setPitchCoachTarget] = useState('C4');
  const [vocalTakeLibrary, setVocalTakeLibrary] = useState<VocalTakeSummary[]>([]);
  const [vocalTakeNameDraft, setVocalTakeNameDraft] = useState('');
  const [vocalTakeMessage, setVocalTakeMessage] = useState<string | null>(null);
  const [isSavingVocalTake, setIsSavingVocalTake] = useState(false);
  const [isExportingVocalTake, setIsExportingVocalTake] = useState(false);
  const [activeVocalTakeId, setActiveVocalTakeId] = useState<string | null>(null);
  const autoPreviewKeyRef = useRef<string | null>(null);

  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? null;
  const activeNoteCandidate = result?.noteCandidates[activeNoteIndex] ?? result?.noteCandidates[0] ?? null;
  const selectedDetectedNote = activeNoteCandidate?.note ?? result?.detectedNote ?? null;
  const pitchCoachFeedback = getPitchCoachFeedback({
    detectedNote: liveFrame?.detectedNote ?? selectedDetectedNote ?? pendingRecordedNote?.note ?? null,
    detectedPitchHz: liveFrame?.detectedPitchHz ?? result?.detectedPitchHz ?? pendingRecordedNote?.pitchHz ?? null,
    targetNote: pitchCoachTarget,
  });

  useEffect(() => {
    if (!result) {
      setSuggestions([]);
      setActiveNoteIndex(0);
      setVocalTakeNameDraft('');
      return;
    }

    setSuggestions(result.suggestions.map(cloneCaptureSuggestion));
    setActiveNoteIndex(0);
    setVocalTakeNameDraft(buildSuggestedVocalTakeName(result.detectedNote));
    setVocalTakeMessage(null);
  }, [result]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setPitchCoachTarget(selectedTrack ? defaultNoteForTrack(selectedTrack) : 'C4');
  }, [open, selectedTrack?.id]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    setRecordedNoteLibrary(loadRecordedNotePresets());
    return subscribeRecordedNotePresets(setRecordedNoteLibrary);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let cancelled = false;
    const syncVocalTakes = async () => {
      try {
        const nextTakes = await listVocalTakeSummaries();
        if (!cancelled) {
          setVocalTakeLibrary(nextTakes);
          setVocalTakeMessage((current) => (
            current && current.startsWith('Vocal take storage is unavailable') ? null : current
          ));
        }
      } catch (err) {
        if (!cancelled) {
          setVocalTakeLibrary([]);
          setVocalTakeMessage(
            err instanceof Error
              ? `Vocal take storage is unavailable here: ${err.message}`
              : 'Vocal take storage is unavailable in this browser.',
          );
        }
      }
    };

    void syncVocalTakes();
    const unsubscribe = subscribeVocalTakeSummaries(() => {
      void syncVocalTakes();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
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
      setVocalTakeNameDraft('');
      setVocalTakeMessage(null);
      setIsSavingVocalTake(false);
      setIsExportingVocalTake(false);
      setActiveVocalTakeId(null);
      setPitchCoachTarget(selectedTrack ? defaultNoteForTrack(selectedTrack) : 'C4');
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
    setVocalTakeNameDraft('');
    setVocalTakeMessage(null);
    setSessionRecordedNotes((current) => (
      capturePreferences.keepShelfBetweenTakes ? current : []
    ));
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
  }, [capturePreferences.keepShelfBetweenTakes, previewUrl]);

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
    setVocalTakeNameDraft('');
    setVocalTakeMessage(null);
    setSessionRecordedNotes((current) => (
      capturePreferences.keepShelfBetweenTakes ? current : []
    ));
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setError(null);
  }, [capturePreferences.keepShelfBetweenTakes, previewUrl]);

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

  useEffect(() => {
    if (!capturePreferences.autoPreviewMatch || state !== 'ready' || suggestions.length === 0) {
      autoPreviewKeyRef.current = null;
      return;
    }

    const topSuggestion = suggestions[0];
    const previewKey = `${previewUrl ?? 'no-preview'}:${topSuggestion.trackType}:${selectedDetectedNote ?? topSuggestion.note ?? 'none'}`;
    if (autoPreviewKeyRef.current === previewKey) {
      return;
    }

    autoPreviewKeyRef.current = previewKey;
    void auditionSuggestion(topSuggestion);
  }, [auditionSuggestion, capturePreferences.autoPreviewMatch, previewUrl, selectedDetectedNote, state, suggestions]);

  const downloadRecording = useCallback(() => {
    if (!result) return;
    setVocalTakeMessage(null);
    downloadBlobFile(result.blob, buildCaptureFileName(vocalTakeNameDraft || buildSuggestedVocalTakeName(result.detectedNote), 'webm'));
  }, [result, vocalTakeNameDraft]);

  const exportRecordingAsWav = useCallback(async () => {
    if (!result) {
      return;
    }

    setVocalTakeMessage(null);
    setIsExportingVocalTake(true);
    try {
      const wavBlob = await convertRecordingBlobToWav(result.blob);
      downloadBlobFile(wavBlob, buildCaptureFileName(vocalTakeNameDraft || buildSuggestedVocalTakeName(result.detectedNote), 'wav'));
    } catch (err) {
      setVocalTakeMessage(err instanceof Error ? err.message : 'Could not export this take as WAV.');
    } finally {
      setIsExportingVocalTake(false);
    }
  }, [result, vocalTakeNameDraft]);

  const saveCurrentVocalTake = useCallback(async () => {
    if (!result) {
      return;
    }

    setVocalTakeMessage(null);
    setIsSavingVocalTake(true);
    try {
      const wavBlob = await convertRecordingBlobToWav(result.blob);
      const savedTake = await saveVocalTake({
        blob: wavBlob,
        clarity: result.clarity,
        durationSeconds: result.durationSeconds,
        name: vocalTakeNameDraft || buildSuggestedVocalTakeName(result.detectedNote),
        note: selectedDetectedNote,
      });
      setVocalTakeLibrary((current) => [savedTake, ...current.filter((entry) => entry.id !== savedTake.id)]);
      setVocalTakeMessage(`${savedTake.name} saved locally as a WAV take.`);
    } catch (err) {
      setVocalTakeMessage(err instanceof Error ? err.message : 'Could not save this vocal take.');
    } finally {
      setIsSavingVocalTake(false);
    }
  }, [result, selectedDetectedNote, vocalTakeNameDraft]);

  const downloadSavedVocalTake = useCallback(async (take: VocalTakeSummary) => {
    setVocalTakeMessage(null);
    setActiveVocalTakeId(take.id);
    try {
      const blob = await getVocalTakeBlob(take.id);
      if (!blob) {
        throw new Error('That saved vocal take is no longer available.');
      }
      downloadBlobFile(blob, buildCaptureFileName(take.name, 'wav'));
    } catch (err) {
      setVocalTakeMessage(err instanceof Error ? err.message : 'Could not download that vocal take.');
    } finally {
      setActiveVocalTakeId(null);
    }
  }, []);

  const removeSavedVocalTake = useCallback(async (takeId: string) => {
    setVocalTakeMessage(null);
    setActiveVocalTakeId(takeId);
    try {
      await deleteVocalTake(takeId);
      setVocalTakeLibrary((current) => current.filter((entry) => entry.id !== takeId));
      setVocalTakeMessage('Saved vocal take removed from this device.');
    } catch (err) {
      setVocalTakeMessage(err instanceof Error ? err.message : 'Could not remove that vocal take.');
    } finally {
      setActiveVocalTakeId(null);
    }
  }, []);

  if (!open) return null;

  const liveSuggestions = getStagedLiveSuggestions(liveFrame, capturePreferences);
  const visibleSuggestions = suggestions.slice(0, capturePreferences.liveSuggestionCount);
  const saveableDetectedNote = selectedDetectedNote ?? liveFrame?.noteCandidates[0]?.note ?? pendingRecordedNote?.note ?? null;
  const captureNamePlaceholder = buildSuggestedRecordedNoteName(
    saveableDetectedNote,
    visibleSuggestions[0] ?? liveSuggestions[0] ?? pendingRecordedNote?.suggestion ?? null,
  );
  const rankedSuggestionCount = visibleSuggestions.length;
  const liveCaptureHint = liveFrame
    ? describeCaptureHint(liveFrame.durationSeconds, liveFrame.transientDensity, liveFrame.clarity)
    : null;
  const resultCaptureHint = result
    ? describeCaptureHint(result.durationSeconds, result.transientDensity, result.clarity)
    : null;
  const captureProfileDescription = describeCaptureProfile(capturePreferences.analysisProfile);
  const shelfStateLabel = capturePreferences.keepShelfBetweenTakes
    ? 'Shelf keeps notes between takes'
    : 'Shelf resets each take';
  const captureWorkflowSteps = [
    {
      body: state === 'recording'
        ? 'Listening now. Hold one clear pitch or hit.'
        : state === 'ready'
          ? 'Take recorded. You can capture again anytime.'
          : 'Start with one short, clean take.',
      state: state === 'idle' || state === 'error' ? 'current' : 'done',
      title: 'Record',
    },
    {
      body: state === 'ready'
        ? `${rankedSuggestionCount} lane ${rankedSuggestionCount === 1 ? 'match is' : 'matches are'} ready below.`
        : liveSuggestions.length > 0
          ? `${liveSuggestions.length} live ${liveSuggestions.length === 1 ? 'match is' : 'matches are'} settling in.`
          : 'Watch the note, meter, and lane guesses lock in.',
      state: state === 'ready'
        ? 'done'
        : state === 'recording' || state === 'analyzing'
          ? 'current'
          : 'upcoming',
      title: 'Check match',
    },
    {
      body: pendingRecordedNote || sessionRecordedNotes.length > 0
        ? `Shelf has ${sessionRecordedNotes.length + (pendingRecordedNote ? 1 : 0)} note${sessionRecordedNotes.length + (pendingRecordedNote ? 1 : 0) === 1 ? '' : 's'} ready or saved this pass.`
        : result
          ? 'Save the note shelf, export the take as WAV, or apply a lane below.'
        : saveableDetectedNote
          ? 'Name the note once, then save it or apply a match to a track.'
          : 'Save the note shelf or create/apply a lane once a match appears.',
      state: pendingRecordedNote || sessionRecordedNotes.length > 0 || state === 'ready'
        ? 'current'
        : 'upcoming',
      title: 'Store or apply',
    },
  ] as const;
  const recentRecordedLibrary = recordedNoteLibrary.slice(0, 4);
  const recentVocalTakes = vocalTakeLibrary.slice(0, 4);

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
              Record a vocal take or sound and we'll suggest the closest notes and lanes.
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
              Hum, whistle, sing a phrase, tap, or record a short idea. SonicStudio listens for the main pitch, gives you nearby note guesses, suggests the closest lanes your current capture settings allow, and can keep the raw take locally as a WAV vocal sketch. Everything stays on your device.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                Profile {capturePreferences.analysisProfile}
              </span>
              <span className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                Live matches {capturePreferences.liveSuggestionCount}
              </span>
              <span className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                Auto preview {capturePreferences.autoPreviewMatch ? 'on' : 'off'}
              </span>
            </div>
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

        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_320px]">
          <section className="surface-panel-strong p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="section-label">Capture flow</div>
                <p className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">
                  {captureProfileDescription}
                </p>
              </div>
              <span className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                {shelfStateLabel}
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {captureWorkflowSteps.map((step) => (
                <div
                  className={`rounded-[3px] border px-3 py-3 ${step.state === 'done'
                    ? 'border-[rgba(114,217,255,0.24)] bg-[rgba(114,217,255,0.06)]'
                    : step.state === 'current'
                      ? 'border-[rgba(245,158,11,0.24)] bg-[rgba(245,158,11,0.08)]'
                      : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]'}`}
                  key={step.title}
                >
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{step.title}</div>
                  <div className="mt-2 text-[12px] font-medium text-[var(--text-primary)]">{step.body}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-panel-strong p-4">
            <div className="section-label">Capture storage</div>
            <p className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
              Saved notes stay local to this browser profile. The session shelf helps during the current pass, the note library keeps reusable note captures, and saved vocal takes are stored locally as WAV sketches.
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
              <CaptureSummaryStat label="Saved notes" value={`${recordedNoteLibrary.length}`} />
              <CaptureSummaryStat label="Saved vocals" value={`${vocalTakeLibrary.length}`} />
              <CaptureSummaryStat label="This pass" value={`${sessionRecordedNotes.length + (pendingRecordedNote ? 1 : 0)}`} />
              <CaptureSummaryStat label="Live matches" value={`${capturePreferences.liveSuggestionCount}`} />
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              <div className="rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
                <div className="section-label">Recent library</div>
                {recentRecordedLibrary.length > 0 ? (
                  <div className="mt-3 grid gap-2">
                    {recentRecordedLibrary.map((savedNote) => (
                      <div
                        className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2"
                        key={savedNote.id}
                      >
                        <div className="text-[12px] font-medium text-[var(--text-primary)]">{savedNote.name}</div>
                        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                          {savedNote.note} · {savedNote.trackType} · {Math.round(savedNote.clarity * 100)}% clarity
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                    No saved capture notes yet. Once you save a note from this modal it will appear here and in the Piano Roll menu.
                  </div>
                )}
              </div>

              <div className="rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
                <div className="section-label">Recent vocal takes</div>
                <p className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                  Save the raw take as a local WAV sketch if you want the vocal idea later, even if you do not apply a lane right away.
                </p>
                {vocalTakeMessage && (
                  <div className="mt-3 rounded-[2px] border border-[rgba(114,217,255,0.18)] bg-[rgba(114,217,255,0.06)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                    {vocalTakeMessage}
                  </div>
                )}
                {recentVocalTakes.length > 0 ? (
                  <div className="mt-3 grid gap-2">
                    {recentVocalTakes.map((take) => (
                      <div key={take.id}>
                        <SavedVocalTakeCard
                          isBusy={activeVocalTakeId === take.id}
                          onDelete={() => {
                            void removeSavedVocalTake(take.id);
                          }}
                          onDownload={() => {
                            void downloadSavedVocalTake(take);
                          }}
                          take={take}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                    No saved vocal takes yet. Record a phrase, then save the WAV take from the playback section below.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="mt-4 grid gap-3">
          <section className="surface-panel-strong p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="section-label">Record</div>
                <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                  {state === 'idle' && 'Tap record, make one clear sound for a second or two, then stop. Short hits work, but held notes produce the cleanest matches.'}
                  {state === 'recording' && 'Listening now. Hold a steady tone for the clearest match, or make one clean transient if you are capturing a hit.'}
                  {state === 'analyzing' && 'Analyzing...'}
                  {state === 'ready' && 'Got it. Check the preview, save the vocal take if you want the raw idea later, then store the note or apply a lane below.'}
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
              <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
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
                      {liveCaptureHint && (
                        <div className="mt-3 rounded-[2px] border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.08)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                          {liveCaptureHint}
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <div className="grid gap-3">
                  <PitchCoachCard
                    feedback={pitchCoachFeedback}
                    helperText={selectedTrack ? `Target defaults to ${selectedTrack.name}. Change it if you are practicing against a different note.` : 'Pick the note you want to match, then sing or play into the mic.'}
                    onTargetChange={setPitchCoachTarget}
                    targetNote={pitchCoachTarget}
                  />

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
                        Hold a pitch until the note and clarity settle. Small fluctuations can still land a capture now, and this shelf will {capturePreferences.keepShelfBetweenTakes ? 'stay in place between takes.' : 'reset when you start the next take.'}
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
                    {resultCaptureHint && (
                      <div className="mt-3 rounded-[2px] border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.08)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                        <div className="section-label text-[var(--warning)]">Capture hint</div>
                        <div className="mt-2">{resultCaptureHint}</div>
                      </div>
                    )}
                    <div className="mt-3">
                      <PitchCoachCard
                        feedback={pitchCoachFeedback}
                        helperText="Use the same target to compare your take after recording."
                        onTargetChange={setPitchCoachTarget}
                        targetNote={pitchCoachTarget}
                      />
                    </div>
                  </div>

                  <div className="border-t border-[var(--border-soft)] pt-4">
                    <div className="section-label">Playback + vocal take</div>
                    <audio
                      ref={audioElRef}
                      className="mt-2 w-full"
                      controls
                      src={previewUrl}
                    />
                    <label className="mt-3 grid gap-2">
                      <span className="section-label">Take name</span>
                      <input
                        className="control-field h-10 px-3 text-sm"
                        onChange={(event) => setVocalTakeNameDraft(event.target.value)}
                        placeholder={buildSuggestedVocalTakeName(selectedDetectedNote ?? result.detectedNote)}
                        value={vocalTakeNameDraft}
                      />
                    </label>
                    {vocalTakeMessage && (
                      <div className="mt-3 rounded-[2px] border border-[rgba(114,217,255,0.18)] bg-[rgba(114,217,255,0.06)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                        {vocalTakeMessage}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="control-chip flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                        onClick={downloadRecording}
                        type="button"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download .webm
                      </button>
                      <button
                        className="control-chip flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                        disabled={isExportingVocalTake}
                        onClick={() => {
                          void exportRecordingAsWav();
                        }}
                        type="button"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {isExportingVocalTake ? 'Exporting WAV...' : 'Download .wav'}
                      </button>
                      <button
                        className="control-chip flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                        data-active="true"
                        disabled={isSavingVocalTake}
                        onClick={() => {
                          void saveCurrentVocalTake();
                        }}
                        type="button"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {isSavingVocalTake ? 'Saving take...' : 'Save vocal take'}
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
                    Best guess first, then any nearby alternatives your live-match limit allows. You can tweak each one before creating a lane or applying it to an existing one.
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
                    {visibleSuggestions.map((suggestion, index) => {
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

const PitchCoachCard = ({
  feedback,
  helperText,
  onTargetChange,
  targetNote,
}: {
  feedback: ReturnType<typeof getPitchCoachFeedback>;
  helperText: string;
  onTargetChange: (value: string) => void;
  targetNote: string;
}) => {
  const toneStyles = feedback.tone === 'locked'
    ? {
        background: 'rgba(34,197,94,0.08)',
        borderColor: 'rgba(34,197,94,0.26)',
        color: 'rgb(187,247,208)',
      }
    : feedback.tone === 'close'
      ? {
          background: 'rgba(250,204,21,0.08)',
          borderColor: 'rgba(250,204,21,0.24)',
          color: 'rgb(253,224,71)',
        }
      : feedback.tone === 'miss'
        ? {
            background: 'rgba(248,113,113,0.08)',
            borderColor: 'rgba(248,113,113,0.22)',
            color: 'rgb(252,165,165)',
          }
        : {
            background: 'rgba(255,255,255,0.03)',
            borderColor: 'rgba(149,169,189,0.12)',
            color: 'var(--text-secondary)',
          };

  return (
    <section className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(6,9,13,0.34)] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="section-label">Pitch coach</div>
          <div className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">{helperText}</div>
        </div>
        <label className="grid gap-1 text-xs text-[var(--text-secondary)]">
          <span className="section-label">Target</span>
          <select
            className="control-field h-10 min-w-[112px] px-3 text-sm"
            onChange={(event) => onTargetChange(event.target.value)}
            value={targetNote}
          >
            {PITCH_COACH_NOTE_OPTIONS.map((note) => (
              <option key={note} value={note}>{note}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3 rounded-[3px] border px-3 py-3" style={toneStyles}>
        <div>
          <div className="text-lg font-semibold tracking-tight">{feedback.label}</div>
          <div className="mt-1 text-[11px] leading-5">{feedback.detail}</div>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em]">
          {feedback.centsOff === null ? '—' : `${Math.round(Math.abs(feedback.centsOff))} cents`}
        </div>
      </div>

      <div className="mt-3 h-2 rounded-[2px] bg-[rgba(255,255,255,0.06)]">
        <div className="relative h-full">
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/24" />
          <div
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-[3px] border border-[rgba(114,217,255,0.58)] bg-[linear-gradient(180deg,rgba(114,217,255,0.92),rgba(66,153,225,0.74))] shadow-[0_6px_14px_rgba(15,23,42,0.42)]"
            style={{ left: `${feedback.indicator * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        <span>Flat</span>
        <span>{Math.round(feedback.accuracy * 100)}% match</span>
        <span>Sharp</span>
      </div>
    </section>
  );
};

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

const describeCaptureHint = (durationSeconds: number, transientDensity: number, clarity: number) => {
  if (transientDensity > 0.82 && durationSeconds > 1.6) {
    return 'This sounds like a string of hits instead of one note. For cleaner note matching, record one snap or a very short cluster, then stop.';
  }

  if (transientDensity > 0.72 && clarity < 0.3) {
    return 'Short percussive sounds can land on approximate notes rather than one exact pitch. A single cleaner hit usually matches better than a longer run.';
  }

  if (clarity < 0.22 && durationSeconds > 0.6) {
    return 'Pitch is still loose in this take. Moving closer to the mic or making the sound a little cleaner will usually help.';
  }

  return null;
};

const describeCaptureProfile = (profile: CaptureAnalysisProfile) => {
  switch (profile) {
    case 'quick':
      return 'Quick mode commits faster and favors immediate ideas. It works best for short stabs, taps, and fast sketching where speed matters more than a perfectly settled read.';
    case 'steady':
      return 'Steady mode waits longer before committing, which is better for held notes, soft tones, and cleaner pitch matching when you want the shelf to be stricter.';
    case 'balanced':
    default:
      return 'Balanced mode is the general-purpose capture path: quick enough for sketches, but patient enough to settle the note, lane match, and saved shelf with less jitter.';
  }
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

const SavedVocalTakeCard = ({
  isBusy,
  onDelete,
  onDownload,
  take,
}: {
  isBusy: boolean;
  onDelete: () => void;
  onDownload: () => void;
  take: VocalTakeSummary;
}) => (
  <div className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-[var(--text-primary)]">{take.name}</div>
        <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
          {formatCaptureDuration(take.durationSeconds)} · {formatStorageSize(take.sizeBytes)} · {Math.round(take.clarity * 100)}% clarity{take.note ? ` · ${take.note}` : ''}
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          {formatSavedCaptureTime(take.updatedAt)}
        </div>
      </div>
      {take.note && (
        <span className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
          {take.note}
        </span>
      )}
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        className="control-chip flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
        disabled={isBusy}
        onClick={onDownload}
        type="button"
      >
        <Download className="h-3.5 w-3.5" />
        {isBusy ? 'Working...' : 'Download'}
      </button>
      <button
        className="control-chip flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
        disabled={isBusy}
        onClick={onDelete}
        type="button"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Remove
      </button>
    </div>
  </div>
);

const CaptureSummaryStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{label}</div>
    <div className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-primary)]">{value}</div>
  </div>
);

const formatCaptureDuration = (durationSeconds: number) => {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.max(0, Math.round(durationSeconds % 60));

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const formatStorageSize = (sizeBytes: number) => {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
};

const formatSavedCaptureTime = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Saved locally';
  }

  return date.toLocaleString([], {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });
};

export const isStableCaptureFrame = (frame: LiveCaptureFrame, analysisProfile: CaptureAnalysisProfile = 'balanced') => {
  const candidate = frame.noteCandidates[0] ?? null;
  const profile = CAPTURE_ANALYSIS_CONFIGS[analysisProfile];
  const primaryGate = (
    frame.signalLevel >= profile.stable.signal
    && frame.clarity >= profile.stable.clarity
    && (candidate?.confidence ?? 0) >= profile.stable.confidence
  );
  const quietReliableGate = (
    frame.signalLevel >= profile.quietStable.signal
    && frame.clarity >= profile.quietStable.clarity
    && (candidate?.confidence ?? 0) >= profile.quietStable.confidence
  );

  return Boolean(
    candidate
    && frame.detectedPitchHz
    && frame.suggestions[0]
    && (primaryGate || quietReliableGate)
  );
};

function buildPitchCoachNoteOptions(highOctave: number, lowOctave: number) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const notes: string[] = [];

  for (let octave = highOctave; octave >= lowOctave; octave -= 1) {
    for (let noteIndex = noteNames.length - 1; noteIndex >= 0; noteIndex -= 1) {
      notes.push(`${noteNames[noteIndex]}${octave}`);
    }
  }

  return notes;
}

export const scoreStableCaptureFrame = (frame: LiveCaptureFrame) => {
  const candidate = frame.noteCandidates[0] ?? null;

  return (frame.clarity * 0.56) + ((candidate?.confidence ?? 0) * 0.28) + (frame.signalLevel * 0.16);
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
