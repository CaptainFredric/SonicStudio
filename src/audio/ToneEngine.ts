import * as Tone from 'tone';

import { getSamplePresetMeta, getSampleUrl } from './sampleLibrary';
import { findFirstPlayableStepInLoop, hasPlayableStepAt, isTrackAudible, resolvePatternStepForPlayback } from './playbackResolver';
import type { AudioStabilityMode } from '../project/preferences';
import type {
  ArrangementClip,
  MasterSettings,
  NoteEvent,
  PatternAutomation,
  Project,
  SampleSliceMemory,
  StepValue,
  Track,
  TransportMode,
} from '../project/schema';

type TrackInstrument =
  | Tone.MembraneSynth
  | Tone.NoiseSynth
  | Tone.MetalSynth
  | Tone.MonoSynth
  | Tone.PolySynth
  | Tone.Gain;

interface TrackGraph {
  ambienceActive: boolean;
  channel: Tone.Channel;
  chorus: Tone.Chorus;
  crusher: Tone.BitCrusher;
  delay: Tone.FeedbackDelay;
  dist: Tone.Distortion;
  filter: Tone.Filter;
  insertFxActive: boolean;
  instrument: TrackInstrument;
  lastAutomationCutoff: number | null;
  lastAutomationVolume: number | null;
  meter: Tone.Meter;
  postFilter: Tone.Gain;
  reverb: Tone.Freeverb;
  sampleBuffer: Tone.ToneAudioBuffer | null;
  samplePlayerAvailableAt: number[];
  samplePlayerCursor: number;
  samplePlayers: Tone.Player[];
  sampleRootNote: string | null;
  sourceInput: Tone.Gain;
  trackStateSignature: string;
  type: Track['type'];
  vibrato: Tone.Vibrato;
  voiceSignature: string;
}

const SAMPLE_VOICE_POOL_SIZE = 8;
const MAX_SAMPLE_VOICE_POOL_SIZE = 20;
// Phones and tablets need more scheduling headroom to stay glitch-free
// under their stricter audio thread; desktops can afford a tighter
// lookahead for lower latency. iOS Safari is especially prone to dropouts
// when the lookahead is too small.
const isLikelyMobile = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS Safari now reports a "Macintosh" UA by default, so the UA
  // check alone misses tablets. A touch device with more than one touch
  // point is a strong phone/tablet signal beyond a precision pointer.
  if (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1) return true;
  return false;
};

const STABILITY_LOOKAHEAD_SECONDS: Record<Exclude<AudioStabilityMode, 'auto'>, number> = {
  tight: 0.18,
  stable: 0.35,
  resilient: 0.6,
};

const lookaheadForMode = (mode: AudioStabilityMode): number => {
  if (mode === 'auto') {
    return isLikelyMobile() ? STABILITY_LOOKAHEAD_SECONDS.stable : STABILITY_LOOKAHEAD_SECONDS.tight;
  }
  return STABILITY_LOOKAHEAD_SECONDS[mode];
};
const DEFAULT_SYNTH_MAX_POLYPHONY = 16;
const FX_MAX_POLYPHONY = 8;
const PAD_MAX_POLYPHONY = 10;

export class ToneEngine {
  private arrangerClips: ArrangementClip[] = [];
  private arrangerClipsByTrack: Record<string, ArrangementClip[]> = {};
  private audioStabilityMode: AudioStabilityMode = 'auto';
  private initPromise: Promise<void> | null = null;
  private isInitialized = false;
  private loopRange: { endBeat: number; startBeat: number } | null = null;
  private masterCompressor: Tone.Compressor | null = null;
  private masterEq: Tone.EQ3 | null = null;
  private masterGain: Tone.Gain | null = null;
  private masterHighpass: Tone.Filter | null = null;
  private masterLimiter: Tone.Limiter | null = null;
  private masterLowpass: Tone.Filter | null = null;
  private masterMeter: Tone.Meter | null = null;
  private metronomeEnabled = false;
  private metronomeSynth: Tone.Synth | null = null;
  private masterSettings: MasterSettings = {
    glueCompression: 0.42,
    highCutHz: 18000,
    limiterCeiling: -0.2,
    lowCutHz: 28,
    outputGain: 0,
    stereoWidth: 0.5,
    tone: 0.55,
  };
  private masterWidener: Tone.StereoWidener | null = null;
  private offlineMode = false;
  private stepCallbacks: ((step: number, pattern: number) => void)[] = [];
  private stepsPerPattern = 16;
  private trackGraphs: Record<string, TrackGraph> = {};
  private tracksState: Track[] = [];
  private transportEventId: number | null = null;
  private transportLoopEnabled = true;
  private transportMode: TransportMode = 'PATTERN';

  public analyzer: Tone.Analyser | null = null;
  public currentPattern = 0;
  public currentStep = 0;
  public recorder: Tone.Recorder | null = null;

  async init(options: { offline?: boolean } = {}) {
    const offlineMode = Boolean(options.offline);
    this.offlineMode = offlineMode;

    if (this.isInitialized) {
      if (!offlineMode) {
        await Tone.start();
        Tone.getContext().lookAhead = lookaheadForMode(this.audioStabilityMode);
      }
      return;
    }

    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      if (!offlineMode) {
        await Tone.start();
        Tone.getContext().lookAhead = lookaheadForMode(this.audioStabilityMode);
        // Safety net: make sure the final destination isn't sitting muted
        // or at a near-silent volume from a stray earlier state. The
        // master chain has its own gain stage; this only guards against
        // the global output being silenced by something outside the app.
        try {
          const destination = Tone.getDestination();
          if (destination.mute) {
            destination.mute = false;
          }
          if (destination.volume.value < -20) {
            destination.volume.value = 0;
          }
        } catch {
          // Tone may throw if the destination isn't reachable yet; if so,
          // master chain settings on the next sync still take care of it.
        }
      }

      if (this.isInitialized) {
        return;
      }

      this.masterCompressor = new Tone.Compressor({ ratio: 4, threshold: -24 }).toDestination();
      this.masterLimiter = new Tone.Limiter(-0.1);
      this.masterHighpass = new Tone.Filter({ frequency: 28, rolloff: -24, type: 'highpass' });
      this.masterLowpass = new Tone.Filter({ frequency: 18000, rolloff: -24, type: 'lowpass' });
      this.masterEq = new Tone.EQ3({ high: 0, low: 0, mid: 0 });
      this.masterWidener = new Tone.StereoWidener(0.5);
      this.masterGain = new Tone.Gain(1);
      this.masterMeter = new Tone.Meter();
      this.metronomeSynth = new Tone.Synth({
        envelope: { attack: 0.001, decay: 0.06, release: 0.03, sustain: 0 },
        oscillator: { type: 'square' },
        volume: -12,
      });
      this.analyzer = this.offlineMode ? null : new Tone.Analyser('fft', 256);
      this.recorder = this.offlineMode ? null : new Tone.Recorder();
      this.masterLimiter.connect(this.masterHighpass);
      this.masterHighpass.connect(this.masterLowpass);
      this.masterLowpass.connect(this.masterEq);
      this.masterEq.connect(this.masterWidener);
      this.masterWidener.connect(this.masterGain);
      this.masterGain.connect(this.masterCompressor);
      this.masterGain.connect(this.masterMeter);
      this.metronomeSynth.connect(this.masterLimiter);
      if (this.analyzer) {
        this.masterCompressor.connect(this.analyzer);
      }
      if (this.recorder) {
        this.masterCompressor.connect(this.recorder);
      }

      if (this.transportEventId === null) {
        this.transportEventId = Tone.getTransport().scheduleRepeat((time) => {
          this.playStep(time);
        }, '16n');
      }

      this.isInitialized = true;
      this.syncTrackGraphs();
    })();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  public getMeterValue(id: string): number {
    return this.trackGraphs[id] ? (this.trackGraphs[id].meter.getValue() as number) : -100;
  }

  public getMasterMeterValue(): number {
    return this.masterMeter ? (this.masterMeter.getValue() as number) : -100;
  }

  public getAudioContextState(): AudioContextState {
    if (this.offlineMode) {
      return 'running';
    }

    try {
      return Tone.getContext().rawContext.state;
    } catch {
      return 'suspended';
    }
  }

  // Override how far ahead Tone schedules events. 'auto' picks based on
  // device, 'tight' minimises latency, 'resilient' adds headroom for
  // slow audio threads. Applied immediately if the context is up.
  public setAudioStabilityMode(mode: AudioStabilityMode): void {
    this.audioStabilityMode = mode;
    if (this.offlineMode) return;
    try {
      Tone.getContext().lookAhead = lookaheadForMode(mode);
    } catch {
      // Context may not exist yet; init() will use the stored mode.
    }
  }

  // Synchronous, idempotent resume — call from inside a user gesture to
  // ensure Tone's audio context wakes alongside the uiSounds context.
  // Some browsers leave Tone's context suspended even though uiSounds
  // resumes itself on every click; the result is "buttons make sound but
  // music doesn't." This kick fixes that path.
  public wakeContext(): void {
    try {
      const raw = Tone.getContext().rawContext as AudioContext;
      if (raw && typeof raw.resume === 'function' && raw.state !== 'running') {
        void raw.resume();
      }
    } catch {
      // ignore — if Tone hasn't created a context yet, init() will.
    }
  }

  public getBaseLatencySeconds(): number | null {
    if (this.offlineMode) {
      return null;
    }

    try {
      const rawContext = Tone.getContext().rawContext as AudioContext | OfflineAudioContext;
      const latency = 'baseLatency' in rawContext ? rawContext.baseLatency : null;
      return Number.isFinite(latency) ? latency : null;
    } catch {
      return null;
    }
  }

  public syncProject(project: Project) {
    this.arrangerClips = project.arrangerClips;
    this.arrangerClipsByTrack = project.arrangerClips.reduce<Record<string, ArrangementClip[]>>((lookup, clip) => {
      if (!lookup[clip.trackId]) {
        lookup[clip.trackId] = [];
      }
      lookup[clip.trackId].push(clip);
      return lookup;
    }, {});
    Object.values(this.arrangerClipsByTrack).forEach((clips) => {
      clips.sort((left, right) => left.startBeat - right.startBeat);
    });
    this.currentPattern = project.transport.currentPattern;
    this.masterSettings = project.master;
    this.metronomeEnabled = project.transport.metronomeEnabled;
    this.stepsPerPattern = project.transport.stepsPerPattern;
    this.tracksState = project.tracks;
    this.transportMode = project.transport.mode;
    this.setBpm(project.transport.bpm);
    this.updateTransportLoop();

    const loopBounds = this.getLoopBounds();
    if (this.currentStep < loopBounds.startBeat || this.currentStep >= loopBounds.endBeat) {
      this.currentStep = loopBounds.startBeat;
    }

    this.syncTrackGraphs();
    this.applyMasterSettings();
  }

  public setLoopRange(range: { endBeat: number; startBeat: number } | null) {
    this.loopRange = range && range.endBeat > range.startBeat ? range : null;
    this.updateTransportLoop();

    const loopBounds = this.getLoopBounds();
    if (this.currentStep < loopBounds.startBeat || this.currentStep >= loopBounds.endBeat) {
      this.currentStep = loopBounds.startBeat;
    }
  }

  public setTransportLoopEnabled(enabled: boolean) {
    this.transportLoopEnabled = enabled;
    this.updateTransportLoop();
  }

  public async awaitAssetLoad() {
    await Tone.ToneAudioBuffer.loaded();
  }

  private applyMasterSettings() {
    if (!this.masterCompressor || !this.masterLimiter || !this.masterEq || !this.masterGain || !this.masterHighpass || !this.masterLowpass || !this.masterWidener) {
      return;
    }

    const glue = this.masterSettings.glueCompression;
    this.masterCompressor.ratio.value = 1 + (glue * 7);
    this.masterCompressor.threshold.value = -12 - (glue * 18);
    this.masterHighpass.frequency.value = this.masterSettings.lowCutHz;
    this.masterLowpass.frequency.value = this.masterSettings.highCutHz;
    this.masterLimiter.threshold.value = this.masterSettings.limiterCeiling;
    this.masterGain.gain.value = Tone.dbToGain(this.masterSettings.outputGain);
    this.masterWidener.width.value = this.masterSettings.stereoWidth;
    this.masterEq.low.value = (0.5 - this.masterSettings.tone) * 10;
    this.masterEq.high.value = (this.masterSettings.tone - 0.5) * 10;
    this.masterEq.mid.value = (this.masterSettings.tone - 0.5) * 2;
  }

  private getLoopBounds() {
    if (this.loopRange) {
      return this.loopRange;
    }

    if (this.transportMode === 'PATTERN') {
      return {
        endBeat: this.stepsPerPattern,
        startBeat: 0,
      };
    }

    const clipTail = this.arrangerClips.reduce(
      (maxBeat, clip) => Math.max(maxBeat, clip.startBeat + clip.beatLength),
      0,
    );

    return {
      endBeat: Math.max(clipTail, this.stepsPerPattern),
      startBeat: 0,
    };
  }

  private updateTransportLoop() {
    const loopBounds = this.getLoopBounds();
    const sixteenthDuration = Tone.Time('16n').toSeconds();

    Tone.getTransport().loop = this.transportLoopEnabled;
    Tone.getTransport().loopStart = loopBounds.startBeat * sixteenthDuration;
    Tone.getTransport().loopEnd = loopBounds.endBeat * sixteenthDuration;
  }

  private hasPlayableStepAt(songStep: number) {
    return hasPlayableStepAt({
      arrangerClipsByTrack: this.arrangerClipsByTrack,
      currentPattern: this.currentPattern,
      songStep,
      stepsPerPattern: this.stepsPerPattern,
      tracks: this.tracksState,
      transportMode: this.transportMode,
    });
  }

  private findFirstPlayableStepInLoop(loopBounds: { startBeat: number; endBeat: number }) {
    return findFirstPlayableStepInLoop({
      arrangerClipsByTrack: this.arrangerClipsByTrack,
      currentPattern: this.currentPattern,
      loopBounds,
      stepsPerPattern: this.stepsPerPattern,
      tracks: this.tracksState,
      transportMode: this.transportMode,
    });
  }

  private resolvePatternStep(track: Track, songStep: number): { note: StepValue; patternIndex: number; stepIndex: number } | null {
    return resolvePatternStepForPlayback({
      arrangerClipsByTrack: this.arrangerClipsByTrack,
      currentPattern: this.currentPattern,
      songStep,
      stepsPerPattern: this.stepsPerPattern,
      track,
      transportMode: this.transportMode,
    });
  }

  private getAutomationStep(track: Track, patternIndex: number, stepIndex: number): { level: number; tone: number } {
    const patternAutomation = track.automation?.[patternIndex];

    return {
      level: patternAutomation?.level[stepIndex] ?? 0.5,
      tone: patternAutomation?.tone[stepIndex] ?? 0.5,
    };
  }

  private applyAutomationStep(graph: TrackGraph, track: Track, patternIndex: number, stepIndex: number, time: number) {
    const automation = this.getAutomationStep(track, patternIndex, stepIndex);
    const volumeOffset = (automation.level - 0.5) * 18;
    const toneFactor = 0.35 + automation.tone * 1.3;
    const automatedVolume = track.volume + volumeOffset;
    const automatedCutoff = Math.max(80, Math.min(18_000, track.params.cutoff * toneFactor));

    if (graph.lastAutomationVolume === null || Math.abs(graph.lastAutomationVolume - automatedVolume) > 0.02) {
      graph.channel.volume.rampTo(automatedVolume, 0.02, time);
      graph.lastAutomationVolume = automatedVolume;
    }

    if (graph.lastAutomationCutoff === null || Math.abs(graph.lastAutomationCutoff - automatedCutoff) > 12) {
      graph.filter.frequency.rampTo(automatedCutoff, 0.02, time);
      graph.lastAutomationCutoff = automatedCutoff;
    }
  }

  private triggerTrack(graph: TrackGraph, track: Track, step: NoteEvent, time: number) {
    const duration = Tone.Time('16n').toSeconds() * step.gate;

    if (track.source.engine === 'sample') {
      this.triggerSampleTrack(graph, track, step, time, duration);
      return;
    }

    switch (track.type) {
      case 'kick':
        (graph.instrument as Tone.MembraneSynth).triggerAttackRelease(step.note || 'C1', duration, time, step.velocity);
        break;
      case 'snare':
        (graph.instrument as Tone.NoiseSynth).triggerAttackRelease(duration, time, step.velocity);
        break;
      case 'hihat':
        (graph.instrument as Tone.MetalSynth).triggerAttackRelease(duration * 0.5, time, step.velocity);
        break;
      case 'bass':
        (graph.instrument as Tone.MonoSynth).triggerAttackRelease(step.note || 'C2', duration, time, step.velocity);
        break;
      default:
        (graph.instrument as Tone.PolySynth).triggerAttackRelease(
          step.note || 'C4',
          track.type === 'pad' || track.type === 'violin' || track.type === 'bell' ? duration * 1.5 : duration,
          time,
          step.velocity,
        );
        break;
    }
  }

  private playStep(time: number) {
    const loopBounds = this.getLoopBounds();
    const songStep = this.currentStep;
    let displayedPattern = this.currentPattern;

    if (this.metronomeEnabled && songStep % 4 === 0) {
      this.triggerMetronomeTick(songStep % 16 === 0, time);
    }

    // While any track is soloed, Tone's channel solo mutes the rest at the
    // output. Skip scheduling their voices entirely so a weak device is not
    // synthesizing sound that will never be heard.
    const anySolo = this.tracksState.some((candidate) => candidate.solo);

    this.tracksState.forEach((track) => {
      if (!isTrackAudible(track, anySolo)) {
        return;
      }

      const resolved = this.resolvePatternStep(track, songStep);
      if (!resolved || resolved.note.length === 0) {
        if (resolved) {
          const graph = this.trackGraphs[track.id];
          if (graph) {
            this.applyAutomationStep(graph, track, resolved.patternIndex, resolved.stepIndex, time);
          }
        }
        return;
      }

      displayedPattern = resolved.patternIndex;
      const graph = this.trackGraphs[track.id];
      if (!graph) {
        return;
      }

      this.applyAutomationStep(graph, track, resolved.patternIndex, resolved.stepIndex, time);

      resolved.note.forEach((event) => {
        this.triggerTrack(graph, track, event, time);
      });
    });

    if (!this.offlineMode) {
      Tone.Draw.schedule(() => {
        const visualStep = this.transportMode === 'SONG'
          ? songStep % this.stepsPerPattern
          : songStep;

        this.stepCallbacks.forEach((callback) => callback(visualStep, displayedPattern));
      }, time);
    }

    const isLooping = songStep + 1 >= loopBounds.endBeat && this.transportLoopEnabled;
    this.currentStep = songStep + 1 >= loopBounds.endBeat
      ? this.transportLoopEnabled ? loopBounds.startBeat : loopBounds.endBeat
      : songStep + 1;

    // On loop restart, silence any voices still ringing from the previous
    // iteration so they don't bleed into the next cycle.
    if (isLooping) {
      Object.values(this.trackGraphs).forEach((graph) => {
        if (graph.instrument instanceof Tone.PolySynth) {
          graph.instrument.releaseAll(time);
        }
      });
    }
  }

  public togglePlayback() {
    if (Tone.getTransport().state === 'started') {
      this.stopActiveVoices();
      Tone.getTransport().pause();
      return false;
    }

    this.updateTransportLoop();

    if (Tone.getTransport().state !== 'paused') {
      // If start lands on a silent spot, seek to the first playable step so
      // users hear music immediately when pressing Play.
      const loopBounds = this.getLoopBounds();
      if (!this.hasPlayableStepAt(this.currentStep)) {
        const firstPlayableStep = this.findFirstPlayableStepInLoop(loopBounds);
        if (firstPlayableStep !== null) {
          this.currentStep = firstPlayableStep;
        }
      }

      Tone.getTransport().position = this.currentStep * Tone.Time('16n').toSeconds();
    }

    Tone.getTransport().start();
    return true;
  }

  public stop() {
    const loopBounds = this.getLoopBounds();
    this.stopActiveVoices();
    // Release WebAudio nodes accumulated by TapToPlay preview calls.
    Object.keys(this.trackGraphs).forEach((trackId) => {
      if (trackId.startsWith('preview-')) {
        this.disposeTrackGraph(trackId);
      }
    });
    Tone.getTransport().stop();
    Tone.getTransport().position = loopBounds.startBeat * Tone.Time('16n').toSeconds();
    this.currentStep = loopBounds.startBeat;
    this.stepCallbacks.forEach((callback) => callback(loopBounds.startBeat % this.stepsPerPattern, this.currentPattern));
  }

  // Jump the playhead (and the running transport) to an absolute song beat.
  // Used by the minimap scrubber so the user can drag to any spot in the track.
  public seekToBeat(beat: number): void {
    const loopBounds = this.getLoopBounds();
    const maxBeat = Math.max(loopBounds.startBeat, loopBounds.endBeat - 1);
    const clamped = Math.min(maxBeat, Math.max(loopBounds.startBeat, Math.round(beat)));
    this.currentStep = clamped;
    try {
      Tone.getTransport().position = clamped * Tone.Time('16n').toSeconds();
    } catch {
      // Transport may not be running yet; currentStep still applies on play.
    }
    const visualStep = this.transportMode === 'SONG' ? clamped % this.stepsPerPattern : clamped;
    this.stepCallbacks.forEach((callback) => callback(visualStep, this.currentPattern));
  }

  public setBpm(bpm: number) {
    Tone.getTransport().bpm.rampTo(bpm, 0.1);
  }

  public async startRecording() {
    if (this.recorder?.state !== 'started') {
      await this.recorder?.start();
    }
  }

  public async stopRecording(download = true) {
    if (this.recorder?.state === 'started') {
      const recording = await this.recorder.stop();

      if (download) {
        const url = URL.createObjectURL(recording);
        const anchor = document.createElement('a');
        anchor.download = 'sonic_studio_obsidian.webm';
        anchor.href = url;
        anchor.click();
      }

      return recording;
    }

    return null;
  }

  public onStep(callback: (step: number, pattern: number) => void) {
    this.stepCallbacks.push(callback);
    return () => {
      this.stepCallbacks = this.stepCallbacks.filter((candidate) => candidate !== callback);
    };
  }

  public previewTrack(track: Track, note: string, sampleSliceIndex?: number, velocity: number = 0.88) {
    if (!this.isInitialized) {
      return;
    }

    // Use a dedicated preview graph keyed by 'preview-{id}' so preview notes
    // do not share the PolySynth voice pool with the running transport.
    const previewTrackClone = { ...track, id: `preview-${track.id}` };
    const graph = this.ensureTrackGraph(previewTrackClone);
    this.applyTrackGraphState(graph, previewTrackClone);
    const previewNote: NoteEvent = {
      gate: track.source.engine === 'sample' ? 2 : track.type === 'pad' ? 2.5 : 1.25,
      note,
      sampleSliceIndex,
      velocity,
    };

    this.triggerTrack(graph, previewTrackClone, previewNote, Tone.now() + 0.02);
  }

  public previewMetronomeTick(accent: boolean = false) {
    if (!this.isInitialized) {
      return;
    }

    this.triggerMetronomeTick(accent, Tone.now() + 0.02);
  }

  private triggerMetronomeTick(accent: boolean, time: number) {
    if (!this.metronomeSynth) {
      return;
    }

    this.metronomeSynth.triggerAttackRelease(accent ? 'C6' : 'G5', accent ? '32n' : '64n', time, accent ? 0.95 : 0.58);
  }

  private resolvePlayableNote(track: Track, note: string) {
    const semitoneShift = track.source.octaveShift * 12;
    if (semitoneShift === 0) {
      return note;
    }

    const match = note.match(/^([A-G]#?)(-?\d+)$/);
    if (!match) {
      return note;
    }

    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const pitchClass = noteNames.indexOf(match[1]);
    if (pitchClass === -1) {
      return note;
    }

    const midi = (Number(match[2]) + 1) * 12 + pitchClass + semitoneShift;
    const clampedMidi = Math.max(24, Math.min(96, midi));
    const nextPitch = noteNames[clampedMidi % 12];
    const octave = Math.floor(clampedMidi / 12) - 1;
    return `${nextPitch}${octave}`;
  }

  private buildVoiceSignature(track: Track) {
    return track.source.engine === 'sample'
      ? `${track.type}:sample:${track.source.customSampleName ?? track.source.samplePreset}:${track.source.customSampleDataUrl?.length ?? 0}`
      : `${track.type}:synth`;
  }

  private noteToMidi(note: string) {
    const match = note.match(/^([A-G]#?)(-?\d+)$/);
    if (!match) {
      return null;
    }

    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const pitchClass = noteNames.indexOf(match[1]);
    if (pitchClass === -1) {
      return null;
    }

    return (Number(match[2]) + 1) * 12 + pitchClass;
  }

  private getSamplePlaybackRate(track: Track, note: string, rootNote: string) {
    if (track.source.samplePlayback === 'oneshot') {
      return 1;
    }

    const targetMidi = this.noteToMidi(this.resolvePlayableNote(track, note));
    const rootMidi = this.noteToMidi(rootNote);

    if (targetMidi === null || rootMidi === null) {
      return 1;
    }

    return Math.pow(2, (targetMidi - rootMidi) / 12);
  }

  private resolveSampleSlice(track: Track, step: NoteEvent): SampleSliceMemory | null {
    const source = track.source;

    if (source.sampleTriggerMode === 'step-mapped' && typeof step.sampleSliceIndex === 'number') {
      return source.sampleSlices[step.sampleSliceIndex] ?? null;
    }

    if (source.sampleTriggerMode === 'active-slice' && typeof source.activeSampleSlice === 'number') {
      return source.sampleSlices[source.activeSampleSlice] ?? null;
    }

    return null;
  }

  private getSampleSliceWindow(track: Track, step: NoteEvent) {
    const activeSlice = this.resolveSampleSlice(track, step);

    return {
      end: activeSlice?.end ?? track.source.sampleEnd,
      gain: activeSlice?.gain ?? track.source.sampleGain,
      reverse: activeSlice?.reverse ?? track.source.sampleReverse,
      start: activeSlice?.start ?? track.source.sampleStart,
    };
  }

  private buildTrackStateSignature(track: Track) {
    const params = track.params;
    const source = track.source;

    return [
      track.muted ? '1' : '0',
      track.solo ? '1' : '0',
      track.pan.toFixed(3),
      track.volume.toFixed(3),
      params.attack.toFixed(3),
      params.decay.toFixed(3),
      params.sustain.toFixed(3),
      params.release.toFixed(3),
      params.chorusSend.toFixed(3),
      params.delaySend.toFixed(3),
      params.reverbSend.toFixed(3),
      params.bitCrush.toFixed(3),
      params.distortion.toFixed(3),
      params.cutoff.toFixed(1),
      params.resonance.toFixed(3),
      params.filterMode,
      params.vibratoRate.toFixed(3),
      params.vibratoDepth.toFixed(3),
      source.engine,
      source.waveform,
      source.detune.toFixed(3),
      source.octaveShift,
      source.portamento.toFixed(4),
      source.samplePreset,
      source.samplePlayback,
      source.sampleStart.toFixed(4),
      source.sampleEnd.toFixed(4),
      source.sampleGain.toFixed(4),
      source.sampleReverse ? '1' : '0',
      source.sampleTriggerMode,
      source.activeSampleSlice ?? 'none',
      source.sampleSlices.length,
      source.customSampleName ?? '',
      source.customSampleDataUrl?.length ?? 0,
    ].join('|');
  }

  private getInitialSampleVoicePoolSize(track: Track) {
    return track.source.samplePlayback === 'oneshot'
      ? SAMPLE_VOICE_POOL_SIZE + 2
      : SAMPLE_VOICE_POOL_SIZE;
  }

  private createSamplePlayer(sampleBuffer: Tone.ToneAudioBuffer, sourceInput: Tone.Gain) {
    const player = new Tone.Player({
      fadeOut: 0.05,
      loop: false,
      reverse: false,
      url: sampleBuffer,
    });
    player.connect(sourceInput);
    return player;
  }

  private triggerSampleTrack(
    graph: TrackGraph,
    track: Track,
    step: NoteEvent,
    time: number,
    duration: number,
  ) {
    if (!graph.sampleBuffer?.loaded || !graph.sampleRootNote) {
      return;
    }

    const sliceWindow = this.getSampleSliceWindow(track, step);
    const sampleDuration = graph.sampleBuffer.duration;
    const windowStart = sampleDuration * sliceWindow.start;
    const windowEnd = sampleDuration * sliceWindow.end;
    const playbackRate = this.getSamplePlaybackRate(track, step.note, graph.sampleRootNote);
    const trimmedDuration = Math.max(0.02, windowEnd - windowStart);
    const scheduledDuration = track.source.samplePlayback === 'oneshot'
      ? trimmedDuration
      : Math.min(trimmedDuration, Math.max(0.02, duration * playbackRate));

    // Offline bounce path. Tone.Offline schedules every hit in the future and
    // has restored the original audio context by the time these callbacks run,
    // so reusing or mutating the live pooled players throws (cross-context
    // connect, and "source not started" from the playbackRate setter touching
    // a not-yet-started source). Render each hit instead with a throwaway
    // Player pinned to the graph's offline context, with every parameter set at
    // construction so no setter ever touches a pending source. The offline
    // context is discarded after the render, so these are never disposed.
    if (this.offlineMode && graph.sampleBuffer) {
      const oneShot = new Tone.Player({
        context: graph.sourceInput.context,
        fadeOut: Math.min(0.05, scheduledDuration * 0.25),
        loop: false,
        playbackRate,
        reverse: sliceWindow.reverse,
        url: graph.sampleBuffer,
      });
      oneShot.volume.value = Tone.gainToDb(Math.max(0.0001, step.velocity * sliceWindow.gain));
      oneShot.connect(graph.sourceInput);
      try {
        oneShot.start(time, windowStart, scheduledDuration);
        oneShot.stop(time + scheduledDuration + 0.06);
      } catch {
        // Ignore scheduling errors near the render tail.
      }
      return;
    }

    if (graph.samplePlayers.length === 0) {
      return;
    }

    let playerIndex = graph.samplePlayerAvailableAt.findIndex((availableAt, index) => {
      const player = graph.samplePlayers[index];
      return availableAt <= time + 0.001 && Boolean(player?.loaded);
    });

    if (playerIndex === -1 && graph.sampleBuffer && graph.samplePlayers.length < MAX_SAMPLE_VOICE_POOL_SIZE) {
      const extraPlayer = this.createSamplePlayer(graph.sampleBuffer, graph.sourceInput);
      graph.samplePlayers.push(extraPlayer);
      graph.samplePlayerAvailableAt.push(0);
      playerIndex = graph.samplePlayers.length - 1;
    }

    if (playerIndex === -1) {
      // Fallback: if no voices available, reuse the oldest voice (round-robin)
      playerIndex = graph.samplePlayerCursor;
      graph.samplePlayerCursor = (playerIndex + 1) % graph.samplePlayers.length;
    }

    const player = graph.samplePlayers[playerIndex];
    if (!player) return;

    player.fadeOut = Math.min(0.05, scheduledDuration * 0.25);
    player.loop = false;
    player.playbackRate = playbackRate;
    player.reverse = sliceWindow.reverse;
    player.volume.value = Tone.gainToDb(Math.max(0.0001, step.velocity * sliceWindow.gain));

    try {
      player.start(time, windowStart, scheduledDuration);
      player.stop(time + scheduledDuration + 0.06);
      graph.samplePlayerAvailableAt[playerIndex] = time + scheduledDuration + 0.06;
    } catch (err) {
      // Silently handle play errors (e.g., note already playing)
      graph.samplePlayerAvailableAt[playerIndex] = time;
    }
  }

  private stopActiveVoices() {
    Object.values(this.trackGraphs).forEach((graph) => {
      graph.samplePlayers.forEach((player) => {
        try {
          player.stop();
        } catch {
          // Ignore idle pooled voices.
        }
      });
      graph.samplePlayerAvailableAt = graph.samplePlayerAvailableAt.map(() => 0);
    });

    Object.values(this.trackGraphs).forEach((graph) => {
      const instrument = graph.instrument;
      if (instrument instanceof Tone.PolySynth) {
        instrument.releaseAll();
        return;
      }

      if (instrument instanceof Tone.MonoSynth || instrument instanceof Tone.MembraneSynth) {
        instrument.triggerRelease();
      }
    });
  }

  private createInstrument(track: Track): TrackInstrument {
    if (track.source.engine === 'sample') {
      return new Tone.Gain();
    }

    const type = track.type;
    switch (type) {
      case 'kick':
        return new Tone.MembraneSynth();
      case 'snare':
        return new Tone.NoiseSynth({
          envelope: { attack: 0.001, decay: 0.14, sustain: 0 },
          noise: { type: 'pink' },
        });
      case 'hihat':
        return new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.08, release: 0.01, sustain: 0 },
          harmonicity: 4.1,
          modulationIndex: 12,
          octaves: 1.45,
          resonance: 210,
        });
      case 'bass':
        return new Tone.MonoSynth();
      case 'pad':
        {
          const instrument = new Tone.PolySynth(Tone.AMSynth);
          instrument.maxPolyphony = PAD_MAX_POLYPHONY;
          return instrument;
        }
      case 'fx':
        {
          const instrument = new Tone.PolySynth(Tone.FMSynth);
          instrument.maxPolyphony = FX_MAX_POLYPHONY;
          return instrument;
        }
      case 'piano':
        {
          // Warm FM electric piano: a low harmonic ratio with a quick
          // modulation decay gives the struck-tine attack and mellow body.
          const instrument = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 2,
            modulationIndex: 5.5,
            modulationEnvelope: { attack: 0.002, decay: 0.32, sustain: 0, release: 0.4 },
          });
          instrument.maxPolyphony = DEFAULT_SYNTH_MAX_POLYPHONY;
          return instrument;
        }
      case 'bell':
        {
          // Bright FM bell: an inharmonic ratio and deep modulation give
          // the metallic clang; the long modulation tail lets it ring.
          const instrument = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 3.01,
            modulationIndex: 16,
            modulationEnvelope: { attack: 0.001, decay: 0.7, sustain: 0.08, release: 1.4 },
          });
          instrument.maxPolyphony = DEFAULT_SYNTH_MAX_POLYPHONY;
          return instrument;
        }
      default:
        {
          const instrument = new Tone.PolySynth(Tone.Synth);
          instrument.maxPolyphony = DEFAULT_SYNTH_MAX_POLYPHONY;
          return instrument;
        }
    }
  }

  private createTrackGraph(track: Track): TrackGraph {
    const meter = new Tone.Meter();
    const channel = new Tone.Channel(0, 0);
    const chorus = new Tone.Chorus(2.5, 1.8, 0.2).start();
    const crusher = new Tone.BitCrusher(16);
    const reverb = new Tone.Freeverb({ roomSize: 0.7 });
    const delay = new Tone.FeedbackDelay('8n', 0.4);
    const filter = new Tone.Filter(2000, 'lowpass');
    const dist = new Tone.Distortion(0);
    const postFilter = new Tone.Gain();
    const sourceInput = new Tone.Gain();
    const vibrato = new Tone.Vibrato(4, 0);
    const instrument = this.createInstrument(track);
    const sampleMeta = track.source.engine === 'sample' ? getSamplePresetMeta(track.source.samplePreset) : null;
    const sampleBuffer = track.source.engine === 'sample'
      ? new Tone.ToneAudioBuffer(track.source.customSampleDataUrl ?? getSampleUrl(track.source.samplePreset))
      : null;
    const samplePlayers = track.source.engine === 'sample' && sampleBuffer
      ? Array.from({ length: this.getInitialSampleVoicePoolSize(track) }, () => this.createSamplePlayer(sampleBuffer, sourceInput))
      : [];

    channel.connect(this.masterLimiter!);
    channel.connect(meter);
    reverb.connect(channel);
    delay.connect(reverb);
    chorus.connect(delay);
    postFilter.connect(channel);
    filter.connect(postFilter);
    dist.connect(filter);
    crusher.connect(dist);
    vibrato.connect(crusher);
    sourceInput.connect(filter);
    instrument.connect(sourceInput);

    chorus.wet.value = 0;
    crusher.bits.value = 16;
    reverb.wet.value = 0;
    delay.wet.value = 0;
    vibrato.wet.value = 1;

    return {
      ambienceActive: false,
      channel,
      chorus,
      crusher,
      delay,
      dist,
      filter,
      insertFxActive: false,
      instrument,
      lastAutomationCutoff: null,
      lastAutomationVolume: null,
      meter,
      postFilter,
      reverb,
      sampleBuffer,
      samplePlayerAvailableAt: samplePlayers.map(() => 0),
      samplePlayerCursor: 0,
      samplePlayers,
      sampleRootNote: sampleMeta?.rootNote ?? null,
      sourceInput,
      trackStateSignature: '',
      type: track.type,
      vibrato,
      voiceSignature: this.buildVoiceSignature(track),
    };
  }

  private ensureTrackGraph(track: Track): TrackGraph {
    const existing = this.trackGraphs[track.id];

    if (existing && existing.type === track.type && existing.voiceSignature === this.buildVoiceSignature(track)) {
      return existing;
    }

    if (existing) {
      this.disposeTrackGraph(track.id);
    }

    const graph = this.createTrackGraph(track);
    this.trackGraphs[track.id] = graph;
    return graph;
  }

  private disposeTrackGraph(trackId: string) {
    const graph = this.trackGraphs[trackId];
    if (!graph) {
      return;
    }

    graph.samplePlayers.forEach((player) => player.dispose());
    graph.instrument.dispose();
    graph.sourceInput.dispose();
    graph.vibrato.dispose();
    graph.crusher.dispose();
    graph.dist.dispose();
    graph.filter.dispose();
    graph.postFilter.dispose();
    graph.chorus.dispose();
    graph.delay.dispose();
    graph.reverb.dispose();
    graph.channel.dispose();
    graph.meter.dispose();

    delete this.trackGraphs[trackId];
  }

  private applySourceShape(graph: TrackGraph, track: Track) {
    if (track.source.engine === 'sample') {
      return;
    }

    const noteDetune = track.source.detune + track.source.octaveShift * 1200;

    if (track.type === 'bass') {
      const instrument = graph.instrument as Tone.MonoSynth;
      instrument.set({
        detune: noteDetune,
        oscillator: {
          type: track.source.waveform,
        },
        portamento: track.source.portamento,
      });
      return;
    }

    if (track.type === 'lead' || track.type === 'pad' || track.type === 'pluck' || track.type === 'fx' || track.type === 'violin' || track.type === 'piano' || track.type === 'bell') {
      const instrument = graph.instrument as Tone.PolySynth;
      instrument.set({
        detune: noteDetune,
        oscillator: {
          type: track.source.waveform,
        },
        portamento: track.source.portamento,
      });
    }
  }

  private applyTrackGraphState(graph: TrackGraph, track: Track) {
    const trackStateSignature = this.buildTrackStateSignature(track);
    if (graph.trackStateSignature === trackStateSignature) {
      return;
    }

    graph.trackStateSignature = trackStateSignature;

    const ambienceActive = track.params.chorusSend > 0.001
      || track.params.delaySend > 0.001
      || track.params.reverbSend > 0.001;
    const insertFxActive = track.params.vibratoDepth > 0.001
      || track.params.bitCrush > 0.001
      || track.params.distortion > 0.001;

    if (graph.insertFxActive !== insertFxActive) {
      graph.sourceInput.disconnect();
      graph.sourceInput.connect(insertFxActive ? graph.vibrato : graph.filter);
      graph.insertFxActive = insertFxActive;
    }

    if (graph.ambienceActive !== ambienceActive) {
      if (ambienceActive) {
        graph.postFilter.disconnect(graph.channel);
        graph.postFilter.connect(graph.chorus);
      } else {
        graph.postFilter.disconnect(graph.chorus);
        graph.postFilter.connect(graph.channel);
      }

      graph.ambienceActive = ambienceActive;
    }

    graph.channel.mute = track.muted;
    graph.channel.pan.rampTo(track.pan, 0.05);
    graph.channel.solo = track.solo;
    graph.channel.volume.rampTo(track.volume, 0.05);

    graph.chorus.wet.rampTo(track.params.chorusSend, 0.1);
    graph.delay.wet.rampTo(track.params.delaySend, 0.1);
    graph.crusher.bits.value = Math.max(2, Math.round(16 - track.params.bitCrush * 14));
    graph.dist.distortion = track.params.distortion;
    graph.filter.frequency.rampTo(track.params.cutoff, 0.1);
    graph.filter.Q.rampTo(track.params.resonance, 0.1);
    graph.filter.type = track.params.filterMode;
    graph.reverb.wet.rampTo(track.params.reverbSend, 0.1);
    graph.vibrato.frequency.value = track.params.vibratoRate;
    graph.vibrato.depth.value = track.params.vibratoDepth;

    this.applySourceShape(graph, track);

    if (track.source.engine !== 'sample') {
      graph.instrument.set({
        envelope: {
          attack: track.params.attack,
          decay: track.params.decay,
          release: track.params.release,
          sustain: track.params.sustain,
        },
      });
    }
  }

  private syncTrackGraphs() {
    if (!this.isInitialized) {
      return;
    }

    const activeTrackIds = new Set(this.tracksState.map((track) => track.id));

    this.tracksState.forEach((track) => {
      // Isolate each lane: if one instrument fails to build, the rest of
      // the mix still plays rather than the whole engine going silent.
      try {
        const graph = this.ensureTrackGraph(track);
        this.applyTrackGraphState(graph, track);
      } catch (error) {
        console.warn(`SonicStudio: could not build the audio graph for "${track.name}". Other lanes keep playing.`, error);
      }
    });

    Object.keys(this.trackGraphs).forEach((trackId) => {
      // Preserve preview graphs as long as their base transport track is still active.
      const baseId = trackId.startsWith('preview-') ? trackId.slice('preview-'.length) : trackId;
      if (!activeTrackIds.has(baseId)) {
        this.disposeTrackGraph(trackId);
      }
    });
  }
}

export const engine = new ToneEngine();
