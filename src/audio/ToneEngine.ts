import * as Tone from 'tone';

import type {
  ArrangementClip,
  NoteEvent,
  Project,
  StepValue,
  Track,
  TransportMode,
} from '../project/schema';

type TrackInstrument =
  | Tone.MembraneSynth
  | Tone.NoiseSynth
  | Tone.MetalSynth
  | Tone.MonoSynth
  | Tone.PolySynth;

interface TrackGraph {
  channel: Tone.Channel;
  delay: Tone.FeedbackDelay;
  dist: Tone.Distortion;
  filter: Tone.Filter;
  instrument: TrackInstrument;
  meter: Tone.Meter;
  reverb: Tone.Freeverb;
  type: Track['type'];
}

class ToneEngine {
  private arrangerClips: ArrangementClip[] = [];
  private isInitialized = false;
  private masterCompressor: Tone.Compressor | null = null;
  private masterLimiter: Tone.Limiter | null = null;
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
    if (this.isInitialized) {
      return;
    }

    await Tone.start();

    this.masterCompressor = new Tone.Compressor({ ratio: 4, threshold: -24 }).toDestination();
    this.masterLimiter = new Tone.Limiter(-0.1).connect(this.masterCompressor);
    this.analyzer = new Tone.Analyser('fft', 256);
    this.recorder = new Tone.Recorder();
    this.masterLimiter.connect(this.analyzer);
    this.masterLimiter.connect(this.recorder);

    Tone.Transport.scheduleRepeat((time) => {
      this.playStep(time);
    }, '16n');

    this.isInitialized = true;
    this.syncTrackGraphs();
  }

  public getMeterValue(id: string): number {
    return this.trackGraphs[id] ? (this.trackGraphs[id].meter.getValue() as number) : -100;
  }

  public syncProject(project: Project) {
    this.arrangerClips = project.arrangerClips;
    this.currentPattern = project.transport.currentPattern;
    this.stepsPerPattern = project.transport.stepsPerPattern;
    this.tracksState = project.tracks;
    this.transportMode = project.transport.mode;
    this.setBpm(project.transport.bpm);

    const loopLength = this.getLoopLength();
    if (this.currentStep >= loopLength) {
      this.currentStep = 0;
    }

    this.syncTrackGraphs();
  }

  private getLoopLength() {
    if (this.transportMode === 'PATTERN') {
      return this.stepsPerPattern;
    }

    const clipTail = this.arrangerClips.reduce(
      (maxBeat, clip) => Math.max(maxBeat, clip.startBeat + clip.beatLength),
      0,
    );

    return Math.max(clipTail, this.stepsPerPattern);
  }

  private resolvePatternStep(track: Track, songStep: number): { note: StepValue; patternIndex: number } | null {
    if (this.transportMode === 'PATTERN') {
      const patternSteps = track.patterns[this.currentPattern] ?? Array(this.stepsPerPattern).fill(null);
      return {
        note: patternSteps[songStep % this.stepsPerPattern] ?? null,
        patternIndex: this.currentPattern,
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
    const patternSteps = track.patterns[activeClip.patternIndex] ?? Array(this.stepsPerPattern).fill(null);

    return {
      note: patternSteps[localStep] ?? null,
      patternIndex: activeClip.patternIndex,
    };
  }

  private triggerTrack(graph: TrackGraph, track: Track, step: NoteEvent, time: number) {
    const duration = Tone.Time('16n').toSeconds() * step.gate;

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
    const songStep = this.currentStep;
    let displayedPattern = this.currentPattern;

    this.tracksState.forEach((track) => {
      if (track.muted) {
        return;
      }

      const resolved = this.resolvePatternStep(track, songStep);
      if (!resolved?.note) {
        return;
      }

      displayedPattern = resolved.patternIndex;
      const graph = this.trackGraphs[track.id];
      if (!graph) {
        return;
      }

      this.triggerTrack(graph, track, resolved.note, time);
    });

    Tone.Draw.schedule(() => {
      const visualStep = this.transportMode === 'SONG'
        ? songStep % this.stepsPerPattern
        : songStep;

      this.stepCallbacks.forEach((callback) => callback(visualStep, displayedPattern));
    }, time);

    this.currentStep = (songStep + 1) % this.getLoopLength();
  }

  public togglePlayback() {
    if (Tone.Transport.state === 'started') {
      Tone.Transport.pause();
      return false;
    }

    Tone.Transport.start();
    return true;
  }

  public stop() {
    Tone.Transport.stop();
    this.currentStep = 0;
    this.stepCallbacks.forEach((callback) => callback(0, this.currentPattern));
  }

  public setBpm(bpm: number) {
    Tone.Transport.bpm.rampTo(bpm, 0.1);
  }

  public async startRecording() {
    if (this.recorder?.state !== 'started') {
      await this.recorder?.start();
    }
  }

  public async stopRecording() {
    if (this.recorder?.state === 'started') {
      const recording = await this.recorder.stop();
      const url = URL.createObjectURL(recording);
      const anchor = document.createElement('a');
      anchor.download = 'sonic_studio_obsidian.webm';
      anchor.href = url;
      anchor.click();
    }
  }

  public onStep(callback: (step: number, pattern: number) => void) {
    this.stepCallbacks.push(callback);
    return () => {
      this.stepCallbacks = this.stepCallbacks.filter((candidate) => candidate !== callback);
    };
  }

  private createInstrument(type: Track['type']): TrackInstrument {
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
    const reverb = new Tone.Freeverb({ roomSize: 0.7 });
    const delay = new Tone.FeedbackDelay('8n', 0.4);
    const filter = new Tone.Filter(2000, 'lowpass');
    const dist = new Tone.Distortion(0);
    const instrument = this.createInstrument(track.type);

    channel.connect(this.masterLimiter!);
    channel.connect(meter);
    reverb.connect(channel);
    delay.connect(reverb);
    filter.connect(delay);
    dist.connect(filter);
    instrument.connect(dist);

    reverb.wet.value = 0;
    delay.wet.value = 0;

    return {
      channel,
      delay,
      dist,
      filter,
      instrument,
      meter,
      reverb,
      type: track.type,
    };
  }

  private ensureTrackGraph(track: Track): TrackGraph {
    const existing = this.trackGraphs[track.id];

    if (existing && existing.type === track.type) {
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
    graph.dist.dispose();
    graph.filter.dispose();
    graph.delay.dispose();
    graph.reverb.dispose();
    graph.channel.dispose();
    graph.meter.dispose();

    delete this.trackGraphs[trackId];
  }

  private applySourceShape(graph: TrackGraph, track: Track) {
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

      graph.delay.wet.rampTo(track.params.delaySend, 0.1);
      graph.dist.distortion = track.params.distortion;
      graph.filter.frequency.rampTo(track.params.cutoff, 0.1);
      graph.filter.Q.rampTo(track.params.resonance, 0.1);
      graph.reverb.wet.rampTo(track.params.reverbSend, 0.1);

      this.applySourceShape(graph, track);

      graph.instrument.set({
        envelope: {
          attack: track.params.attack,
          decay: track.params.decay,
          release: track.params.release,
          sustain: track.params.sustain,
        },
      });
    });

    Object.keys(this.trackGraphs).forEach((trackId) => {
      if (!activeTrackIds.has(trackId)) {
        this.disposeTrackGraph(trackId);
      }
    });
  }
}

export const engine = new ToneEngine();
