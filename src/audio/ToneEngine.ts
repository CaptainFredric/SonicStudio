import * as Tone from 'tone';

import { getSamplePresetMeta, getSampleUrl } from './sampleLibrary';
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
  channel: Tone.Channel;
  chorus: Tone.Chorus;
  crusher: Tone.BitCrusher;
  delay: Tone.FeedbackDelay;
  dist: Tone.Distortion;
  filter: Tone.Filter;
  instrument: TrackInstrument;
  meter: Tone.Meter;
  reverb: Tone.Freeverb;
  sampleBuffer: Tone.ToneAudioBuffer | null;
  sampleRootNote: string | null;
  type: Track['type'];
  vibrato: Tone.Vibrato;
  voiceSignature: string;
}

class ToneEngine {
  private arrangerClips: ArrangementClip[] = [];
  private isInitialized = false;
  private loopRange: { endBeat: number; startBeat: number } | null = null;
  private masterCompressor: Tone.Compressor | null = null;
  private masterEq: Tone.EQ3 | null = null;
  private masterGain: Tone.Gain | null = null;
  private masterHighpass: Tone.Filter | null = null;
  private masterLimiter: Tone.Limiter | null = null;
  private masterLowpass: Tone.Filter | null = null;
  private masterMeter: Tone.Meter | null = null;
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
  private stepCallbacks: ((step: number, pattern: number) => void)[] = [];
  private stepsPerPattern = 16;
  private trackGraphs: Record<string, TrackGraph> = {};
  private tracksState: Track[] = [];
  private transportMode: TransportMode = 'PATTERN';

  public analyzer: Tone.Analyser | null = null;
  public currentPattern = 0;
  public currentStep = 0;
  public recorder: Tone.Recorder | null = null;

  async init() {
    await Tone.start();

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
    this.analyzer = new Tone.Analyser('fft', 256);
    this.recorder = new Tone.Recorder();
    this.masterLimiter.connect(this.masterHighpass);
    this.masterHighpass.connect(this.masterLowpass);
    this.masterLowpass.connect(this.masterEq);
    this.masterEq.connect(this.masterWidener);
    this.masterWidener.connect(this.masterGain);
    this.masterGain.connect(this.masterCompressor);
    this.masterGain.connect(this.masterMeter);
    this.masterCompressor.connect(this.analyzer);
    this.masterCompressor.connect(this.recorder);

    Tone.Transport.scheduleRepeat((time) => {
      this.playStep(time);
    }, '16n');

    this.isInitialized = true;
    this.syncTrackGraphs();
  }

  public getMeterValue(id: string): number {
    return this.trackGraphs[id] ? (this.trackGraphs[id].meter.getValue() as number) : -100;
  }

  public getMasterMeterValue(): number {
    return this.masterMeter ? (this.masterMeter.getValue() as number) : -100;
  }

  public syncProject(project: Project) {
    this.arrangerClips = project.arrangerClips;
    this.currentPattern = project.transport.currentPattern;
    this.masterSettings = project.master;
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
    if (this.transportMode === 'PATTERN') {
      return {
        endBeat: this.stepsPerPattern,
        startBeat: 0,
      };
    }

    if (this.loopRange) {
      return this.loopRange;
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

    Tone.Transport.loop = true;
    Tone.Transport.loopStart = loopBounds.startBeat * sixteenthDuration;
    Tone.Transport.loopEnd = loopBounds.endBeat * sixteenthDuration;
  }

  private resolvePatternStep(track: Track, songStep: number): { note: StepValue; patternIndex: number; stepIndex: number } | null {
    if (this.transportMode === 'PATTERN') {
      const patternSteps = track.patterns[this.currentPattern] ?? Array.from({ length: this.stepsPerPattern }, () => []);
      return {
        note: patternSteps[songStep % this.stepsPerPattern] ?? [],
        patternIndex: this.currentPattern,
        stepIndex: songStep % this.stepsPerPattern,
      };
    }

    const activeClip = this.arrangerClips.find((clip) => (
      clip.trackId === track.id
      && songStep >= clip.startBeat
      && songStep < clip.startBeat + clip.beatLength
    ));

    if (!activeClip) {
      return null;
    }

    const localStep = (songStep - activeClip.startBeat) % this.stepsPerPattern;
    const patternSteps = track.patterns[activeClip.patternIndex] ?? Array.from({ length: this.stepsPerPattern }, () => []);

    return {
      note: patternSteps[localStep] ?? [],
      patternIndex: activeClip.patternIndex,
      stepIndex: localStep,
    };
  }

  private getAutomationStep(track: Track, patternIndex: number, stepIndex: number): { level: number; tone: number } {
    const patternAutomation = track.automation?.[patternIndex];

    return {
      level: patternAutomation?.level[stepIndex] ?? 0.5,
      tone: patternAutomation?.tone[stepIndex] ?? 0.5,
    };
  }

  private applyAutomationStep(graph: TrackGraph, track: Track, patternIndex: number, stepIndex: number) {
    const automation = this.getAutomationStep(track, patternIndex, stepIndex);
    const volumeOffset = (automation.level - 0.5) * 18;
    const toneFactor = 0.35 + automation.tone * 1.3;
    const automatedCutoff = Math.max(80, Math.min(18_000, track.params.cutoff * toneFactor));

    graph.channel.volume.rampTo(track.volume + volumeOffset, 0.02);
    graph.filter.frequency.rampTo(automatedCutoff, 0.02);
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
          track.type === 'pad' ? duration * 1.5 : duration,
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

    this.tracksState.forEach((track) => {
      if (track.muted) {
        return;
      }

      const resolved = this.resolvePatternStep(track, songStep);
      if (!resolved || resolved.note.length === 0) {
        if (resolved) {
          const graph = this.trackGraphs[track.id];
          if (graph) {
            this.applyAutomationStep(graph, track, resolved.patternIndex, resolved.stepIndex);
          }
        }
        return;
      }

      displayedPattern = resolved.patternIndex;
      const graph = this.trackGraphs[track.id];
      if (!graph) {
        return;
      }

      this.applyAutomationStep(graph, track, resolved.patternIndex, resolved.stepIndex);

      resolved.note.forEach((event) => {
        this.triggerTrack(graph, track, event, time);
      });
    });

    Tone.Draw.schedule(() => {
      const visualStep = this.transportMode === 'SONG'
        ? songStep % this.stepsPerPattern
        : songStep;

      this.stepCallbacks.forEach((callback) => callback(visualStep, displayedPattern));
    }, time);

    this.currentStep = songStep + 1 >= loopBounds.endBeat
      ? loopBounds.startBeat
      : songStep + 1;
  }

  public togglePlayback() {
    if (Tone.Transport.state === 'started') {
      Tone.Transport.pause();
      return false;
    }

    this.updateTransportLoop();

    if (Tone.Transport.state !== 'paused') {
      Tone.Transport.position = this.currentStep * Tone.Time('16n').toSeconds();
    }

    Tone.Transport.start();
    return true;
  }

  public stop() {
    const loopBounds = this.getLoopBounds();
    Tone.Transport.stop();
    Tone.Transport.position = loopBounds.startBeat * Tone.Time('16n').toSeconds();
    this.currentStep = loopBounds.startBeat;
    this.stepCallbacks.forEach((callback) => callback(loopBounds.startBeat % this.stepsPerPattern, this.currentPattern));
  }

  public setBpm(bpm: number) {
    Tone.Transport.bpm.rampTo(bpm, 0.1);
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

  public previewTrack(track: Track, note: string, sampleSliceIndex?: number) {
    if (!this.isInitialized) {
      return;
    }

    const graph = this.ensureTrackGraph(track);
    const previewNote: NoteEvent = {
      gate: track.source.engine === 'sample' ? 2 : track.type === 'pad' ? 2.5 : 1.25,
      note,
      sampleSliceIndex,
      velocity: 0.88,
    };

    this.triggerTrack(graph, track, previewNote, Tone.now() + 0.02);
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
    const player = new Tone.Player({
      fadeOut: Math.min(0.05, scheduledDuration * 0.25),
      loop: false,
      playbackRate,
      reverse: sliceWindow.reverse,
      url: graph.sampleBuffer,
    });

    player.volume.value = Tone.gainToDb(Math.max(0.0001, step.velocity * sliceWindow.gain));
    player.connect(graph.vibrato);
    player.start(time, windowStart, scheduledDuration);
    player.stop(time + scheduledDuration + 0.06);
    player.onstop = () => {
      player.dispose();
    };
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
        return new Tone.NoiseSynth({ envelope: { decay: 0.18, sustain: 0 } });
      case 'hihat':
        return new Tone.MetalSynth();
      case 'bass':
        return new Tone.MonoSynth();
      case 'pad':
        return new Tone.PolySynth(Tone.AMSynth);
      case 'fx':
        return new Tone.PolySynth(Tone.FMSynth);
      default:
        return new Tone.PolySynth(Tone.Synth);
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
    const vibrato = new Tone.Vibrato(4, 0);
    const instrument = this.createInstrument(track);
    const sampleMeta = track.source.engine === 'sample' ? getSamplePresetMeta(track.source.samplePreset) : null;
    const sampleBuffer = track.source.engine === 'sample'
      ? new Tone.ToneAudioBuffer(track.source.customSampleDataUrl ?? getSampleUrl(track.source.samplePreset))
      : null;

    channel.connect(this.masterLimiter!);
    channel.connect(meter);
    reverb.connect(channel);
    delay.connect(reverb);
    chorus.connect(delay);
    filter.connect(chorus);
    dist.connect(filter);
    crusher.connect(dist);
    vibrato.connect(crusher);
    instrument.connect(vibrato);

    chorus.wet.value = 0;
    crusher.bits.value = 16;
    reverb.wet.value = 0;
    delay.wet.value = 0;
    vibrato.wet.value = 1;

    return {
      channel,
      chorus,
      crusher,
      delay,
      dist,
      filter,
      instrument,
      meter,
      reverb,
      sampleBuffer,
      sampleRootNote: sampleMeta?.rootNote ?? null,
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

    graph.instrument.dispose();
    graph.vibrato.dispose();
    graph.crusher.dispose();
    graph.dist.dispose();
    graph.filter.dispose();
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

    if (track.type === 'lead' || track.type === 'pad' || track.type === 'pluck' || track.type === 'fx') {
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

  private syncTrackGraphs() {
    if (!this.isInitialized) {
      return;
    }

    const activeTrackIds = new Set(this.tracksState.map((track) => track.id));

    this.tracksState.forEach((track) => {
      const graph = this.ensureTrackGraph(track);

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
    });

    Object.keys(this.trackGraphs).forEach((trackId) => {
      if (!activeTrackIds.has(trackId)) {
        this.disposeTrackGraph(trackId);
      }
    });
  }
}

export const engine = new ToneEngine();
