import * as Tone from 'tone';

import type { Project, Track } from '../project/schema';

type TrackInstrument = Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth | Tone.FMSynth | Tone.PolySynth;

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
  private isInitialized = false;
  private trackGraphs: Record<string, TrackGraph> = {};

  private masterCompressor: Tone.Compressor | null = null;
  private masterLimiter: Tone.Limiter | null = null;
  public analyzer: Tone.Analyser | null = null;
  public recorder: Tone.Recorder | null = null;

  public currentStep = 0;
  public currentPattern = 0;
  private stepsPerPattern = 16;
  private stepCallbacks: ((step: number, pattern: number) => void)[] = [];
  private tracksState: Track[] = [];

  async init() {
    if (this.isInitialized) return;
    await Tone.start();

    this.masterCompressor = new Tone.Compressor({ threshold: -24, ratio: 4 }).toDestination();
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
    this.tracksState = project.tracks;
    this.currentPattern = project.transport.currentPattern;
    this.stepsPerPattern = project.transport.stepsPerPattern;
    this.setBpm(project.transport.bpm);

    if (this.currentStep >= this.stepsPerPattern) {
      this.currentStep = 0;
    }

    this.syncTrackGraphs();
  }

  private playStep(time: number) {
    const step = this.currentStep;
    const pattern = this.currentPattern;

    this.tracksState.forEach(track => {
      const patternSteps = track.patterns[pattern] || Array(this.stepsPerPattern).fill(null);
      const note = patternSteps[step];
      if (note !== null && !track.muted) {
        const inst = this.trackGraphs[track.id]?.instrument;
        if (!inst) {
          return;
        }

        if (track.type === 'kick') inst.triggerAttackRelease(note || 'C1', '8n', time);
        else if (track.type === 'snare') inst.triggerAttackRelease('16n', time);
        else if (track.type === 'hihat') inst.triggerAttackRelease('32n', time, 0.3);
        else inst.triggerAttackRelease(note || 'C3', '16n', time);
      }
    });

    Tone.Draw.schedule(() => {
      this.stepCallbacks.forEach(cb => cb(step, pattern));
    }, time);

    this.currentStep = (step + 1) % this.stepsPerPattern;
  }

  public togglePlayback() {
    if (Tone.Transport.state === 'started') {
      Tone.Transport.pause();
      return false;
    } else {
      Tone.Transport.start();
      return true;
    }
  }

  public stop() {
    Tone.Transport.stop();
    this.currentStep = 0;
    this.stepCallbacks.forEach(cb => cb(0, this.currentPattern));
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
      const anchor = document.createElement("a");
      anchor.download = "sonic_studio_obsidian.webm";
      anchor.href = url;
      anchor.click();
    }
  }

  public onStep(callback: (step: number, pattern: number) => void) {
    this.stepCallbacks.push(callback);
    return () => { this.stepCallbacks = this.stepCallbacks.filter(cb => cb !== callback); };
  }

  private createInstrument(type: Track['type']): TrackInstrument {
    switch (type) {
      case 'kick':
        return new Tone.MembraneSynth();
      case 'snare':
        return new Tone.NoiseSynth({ envelope: { sustain: 0 } });
      case 'hihat':
        return new Tone.MetalSynth();
      case 'bass':
        return new Tone.FMSynth();
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

  private syncTrackGraphs() {
    if (!this.isInitialized) {
      return;
    }

    const activeTrackIds = new Set(this.tracksState.map((track) => track.id));

    this.tracksState.forEach((track) => {
      const graph = this.ensureTrackGraph(track);

      graph.channel.volume.rampTo(track.volume, 0.05);
      graph.channel.pan.rampTo(track.pan, 0.05);
      graph.channel.mute = track.muted;
      graph.channel.solo = track.solo;

      graph.filter.frequency.rampTo(track.params.cutoff, 0.1);
      graph.filter.Q.rampTo(track.params.resonance, 0.1);
      graph.delay.wet.rampTo(track.params.delaySend, 0.1);
      graph.reverb.wet.rampTo(track.params.reverbSend, 0.1);
      graph.dist.distortion = track.params.distortion;

      if (track.type === 'lead') {
        graph.instrument.set({
          envelope: {
            attack: track.params.attack,
            decay: track.params.decay,
            sustain: track.params.sustain,
            release: track.params.release,
          },
        });
      } else {
        const monophonicInstrument = graph.instrument as TrackInstrument & {
          envelope?: {
            attack: number;
            decay: number;
            sustain: number;
            release: number;
          };
        };

        if (monophonicInstrument.envelope) {
          monophonicInstrument.envelope.attack = track.params.attack;
          monophonicInstrument.envelope.decay = track.params.decay;
          monophonicInstrument.envelope.sustain = track.params.sustain;
          monophonicInstrument.envelope.release = track.params.release;
        }
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
