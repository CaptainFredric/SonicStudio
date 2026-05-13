import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Mic, MicOff, Play, SlidersHorizontal, Sparkles, Square, X } from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import { Knob } from './Knob';
import { AudioRecorder, type CaptureSuggestion, type LiveCaptureFrame, type RecordingResult } from '../services/audioRecording';
import { TrackIcon, getTrackPersonality } from '../utils/trackPersonality';
import type { InstrumentType } from '../project/schema';

interface AudioCaptureProps {
  open: boolean;
  onClose: () => void;
}

export const AudioCapture = ({ open, onClose }: AudioCaptureProps) => {
  const {
    applyTrackVoicePreset,
    createTrack,
    previewTrack,
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
  const [state, setState] = useState<'idle' | 'recording' | 'analyzing' | 'ready' | 'error'>('idle');
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeNoteIndex, setActiveNoteIndex] = useState(0);
  const [liveFrame, setLiveFrame] = useState<LiveCaptureFrame | null>(null);
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

    setSuggestions(result.suggestions.map((suggestion) => ({
      ...suggestion,
      controls: { ...suggestion.controls },
    })));
    setActiveNoteIndex(0);
  }, [result]);

  const applySuggestionToTrack = useCallback((trackId: string, suggestion: CaptureSuggestion, note: string | null) => {
    if (suggestion.presetId) {
      applyTrackVoicePreset(trackId, suggestion.presetId);
    }

    setTrackSource(trackId, {
      detune: suggestion.controls.detune,
      octaveShift: suggestion.controls.octaveShift,
      portamento: suggestion.controls.portamento,
    });
    setTrackParams(trackId, {
      cutoff: suggestion.controls.cutoff,
      resonance: suggestion.controls.resonance,
      reverbSend: suggestion.controls.reverbSend,
    });

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

  const startRecording = useCallback(async () => {
    setError(null);
    setResult(null);
    setLiveFrame(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    const recorder = new AudioRecorder();
    recorder.onLiveUpdate((frame) => {
      setLiveFrame({
        ...frame,
        noteCandidates: [...frame.noteCandidates],
        suggestions: frame.suggestions.map((suggestion) => ({
          ...suggestion,
          controls: { ...suggestion.controls },
        })),
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
    setState('idle');
    setResult(null);
    setLiveFrame(null);
    setSuggestions([]);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setError(null);
  }, [previewUrl]);

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
    const match = tracks.find((track) => track.type === suggestion.trackType);
    if (!match) {
      return;
    }

    applySuggestionToTrack(match.id, suggestion, null);
    await previewTrack(match.id, selectedDetectedNote ?? undefined);
  }, [applySuggestionToTrack, previewTrack, selectedDetectedNote, tracks]);

  const downloadRecording = useCallback(() => {
    if (!result) return;
    const anchor = document.createElement('a');
    anchor.href = previewUrl ?? URL.createObjectURL(result.blob);
    anchor.download = `sonicstudio-capture-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
    anchor.click();
  }, [previewUrl, result]);

  if (!open) return null;

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

                <section className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(6,9,13,0.34)] px-4 py-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                    <span className="section-label">Live lane matches</span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {(liveFrame?.suggestions ?? []).slice(0, 3).map((suggestion, index) => (
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

                    {!liveFrame && (
                      <div className="rounded-[2px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-[11px] leading-5 text-[var(--text-secondary)]">
                        Start recording to watch the note and lane matches settle in.
                      </div>
                    )}
                  </div>
                </section>
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
                            onAudition={existingTrack && selectedDetectedNote ? () => void auditionSuggestion(suggestion) : undefined}
                            onCreateTrack={() => createSuggestedTrack(suggestion)}
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

const SuggestionCard = ({
  activeNote,
  existingTrackName,
  isSelectedTrackFamily,
  onApplyToExisting,
  onAudition,
  onCreateTrack,
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
      <div className="mt-4 grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
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
          color="#96b9f3"
          label="Reverb"
          max={1}
          min={0}
          onChange={(value) => onUpdateControls({ reverbSend: value })}
          value={suggestion.controls.reverbSend}
        />
      </div>
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
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
      {onAudition && (
        <button
          className="control-chip flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
          onClick={onAudition}
          type="button"
        >
          <Play className="h-3.5 w-3.5" />
          Audition
        </button>
      )}
    </div>

    <div className="mt-3 text-[11px] leading-5 text-[var(--text-tertiary)]">
      {activeNote ? `Step 1 will be filled with ${activeNote} so you can hear the match right away.` : 'No steady note was found, so the lane will only get the tuned voice settings.'}
    </div>
  </section>
);
