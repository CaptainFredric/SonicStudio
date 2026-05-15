export type UiSoundVariant =
  | 'action'
  | 'danger'
  | 'nav'
  | 'record'
  | 'settings'
  | 'tab'
  | 'transport';

export type UiSoundMode = 'classic' | 'supersonic';

interface UiSoundRecipe {
  decay: number;
  detuneSpread: number;
  frequency: number;
  gain: number;
  harmonicRatio: number;
  wave: OscillatorType;
}

const RECIPES: Record<UiSoundVariant, UiSoundRecipe> = {
  action: { decay: 0.06, detuneSpread: 6, frequency: 560, gain: 0.018, harmonicRatio: 1.9, wave: 'triangle' },
  danger: { decay: 0.085, detuneSpread: 4, frequency: 220, gain: 0.02, harmonicRatio: 1.35, wave: 'sawtooth' },
  nav: { decay: 0.05, detuneSpread: 7, frequency: 410, gain: 0.016, harmonicRatio: 2.1, wave: 'square' },
  record: { decay: 0.095, detuneSpread: 3, frequency: 180, gain: 0.024, harmonicRatio: 1.5, wave: 'sawtooth' },
  settings: { decay: 0.07, detuneSpread: 5, frequency: 320, gain: 0.017, harmonicRatio: 2.4, wave: 'triangle' },
  tab: { decay: 0.055, detuneSpread: 5, frequency: 485, gain: 0.017, harmonicRatio: 2.2, wave: 'triangle' },
  transport: { decay: 0.075, detuneSpread: 6, frequency: 260, gain: 0.021, harmonicRatio: 1.8, wave: 'square' },
};

const UI_SOUND_VARIANTS: UiSoundVariant[] = ['action', 'danger', 'nav', 'record', 'settings', 'tab', 'transport'];

export const isUiSoundVariant = (value: string): value is UiSoundVariant => (
  UI_SOUND_VARIANTS.includes(value as UiSoundVariant)
);

const resolveRecipe = (variant: UiSoundVariant, mode: UiSoundMode): UiSoundRecipe => {
  const recipe = RECIPES[variant];
  if (mode === 'classic') {
    return recipe;
  }

  return {
    decay: recipe.decay * 0.92,
    detuneSpread: recipe.detuneSpread + 4,
    frequency: recipe.frequency * 1.05,
    gain: recipe.gain * 1.24,
    harmonicRatio: recipe.harmonicRatio + 0.58,
    wave: recipe.wave === 'triangle'
      ? 'square'
      : recipe.wave === 'square'
        ? 'sawtooth'
        : recipe.wave,
  };
};

class UiSoundEngine {
  private context: AudioContext | null = null;
  private lastPlaybackAt = 0;
  private noiseBuffer: AudioBuffer | null = null;

  private ensureContext() {
    if (typeof window === 'undefined') {
      return null;
    }

    const AudioContextCtor = window.AudioContext ?? (window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;

    if (!AudioContextCtor) {
      return null;
    }

    if (!this.context) {
      this.context = new AudioContextCtor();
    }

    if (this.context.state === 'suspended') {
      void this.context.resume();
    }

    return this.context;
  }

  private getNoiseBuffer(context: AudioContext) {
    if (this.noiseBuffer) {
      return this.noiseBuffer;
    }

    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.45), context.sampleRate);
    const channelData = buffer.getChannelData(0);

    for (let index = 0; index < channelData.length; index += 1) {
      const fade = 1 - (index / channelData.length);
      channelData[index] = (Math.random() * 2 - 1) * fade;
    }

    this.noiseBuffer = buffer;
    return buffer;
  }

  play(variant: UiSoundVariant, mode: UiSoundMode = 'classic') {
    const context = this.ensureContext();
    if (!context) {
      return;
    }

    const now = context.currentTime;
    if (now - this.lastPlaybackAt < 0.02) {
      return;
    }
    this.lastPlaybackAt = now;

    const recipe = resolveRecipe(variant, mode);
    const jitter = 1 + ((Math.random() * 2 - 1) * recipe.detuneSpread * 0.01);
    const primary = context.createOscillator();
    const harmonic = context.createOscillator();
    const envelope = context.createGain();
    const filter = context.createBiquadFilter();
    const shimmer = mode === 'supersonic' ? context.createOscillator() : null;
    const shimmerEnvelope = mode === 'supersonic' ? context.createGain() : null;

    filter.type = mode === 'supersonic' ? 'bandpass' : 'lowpass';
    filter.frequency.value = mode === 'supersonic'
      ? Math.min(5600, recipe.frequency * 5.2)
      : Math.min(4200, recipe.frequency * 7);
    filter.Q.value = mode === 'supersonic' ? 1.2 : 0.7;
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(recipe.gain, now + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + recipe.decay);

    primary.type = recipe.wave;
    primary.frequency.value = recipe.frequency * jitter;
    harmonic.type = recipe.wave;
    harmonic.frequency.value = recipe.frequency * recipe.harmonicRatio * jitter;
    harmonic.detune.value = recipe.detuneSpread * 4;

    primary.connect(filter);
    harmonic.connect(filter);
    if (shimmer && shimmerEnvelope) {
      shimmer.type = 'triangle';
      shimmer.frequency.value = recipe.frequency * (recipe.harmonicRatio + 1.8) * jitter;
      shimmer.detune.value = recipe.detuneSpread * 7;
      shimmerEnvelope.gain.setValueAtTime(0.0001, now);
      shimmerEnvelope.gain.exponentialRampToValueAtTime(recipe.gain * 0.32, now + 0.003);
      shimmerEnvelope.gain.exponentialRampToValueAtTime(0.0001, now + Math.min(0.12, recipe.decay * 0.95));
      shimmer.connect(shimmerEnvelope);
      shimmerEnvelope.connect(filter);
    }
    filter.connect(envelope);
    envelope.connect(context.destination);

    primary.start(now);
    harmonic.start(now);
    shimmer?.start(now);
    primary.stop(now + recipe.decay + 0.02);
    harmonic.stop(now + recipe.decay + 0.02);
    shimmer?.stop(now + Math.min(0.14, recipe.decay + 0.04));
  }

  playSupersonicTransition(enabled: boolean) {
    const context = this.ensureContext();
    if (!context) {
      return;
    }

    const now = context.currentTime;
    if (now - this.lastPlaybackAt < 0.05) {
      return;
    }
    this.lastPlaybackAt = now;

    const carrier = context.createOscillator();
    const body = context.createOscillator();
    const shimmer = context.createOscillator();
    const envelope = context.createGain();
    const shimmerEnvelope = context.createGain();
    const filter = context.createBiquadFilter();
    const air = context.createBufferSource();
    const airEnvelope = context.createGain();
    const airFilter = context.createBiquadFilter();
    const swapEnabled = !enabled;

    filter.type = 'bandpass';
    filter.Q.value = swapEnabled ? 1.15 : 1.35;
    filter.frequency.setValueAtTime(swapEnabled ? 180 : 2200, now);
    filter.frequency.exponentialRampToValueAtTime(swapEnabled ? 4200 : 220, now + 0.29);

    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(swapEnabled ? 0.056 : 0.041, now + 0.016);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    shimmerEnvelope.gain.setValueAtTime(0.0001, now);
    shimmerEnvelope.gain.exponentialRampToValueAtTime(swapEnabled ? 0.022 : 0.014, now + 0.014);
    shimmerEnvelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.21);

    air.buffer = this.getNoiseBuffer(context);
    airFilter.type = swapEnabled ? 'bandpass' : 'highpass';
    airFilter.Q.value = swapEnabled ? 0.92 : 0.74;
    airFilter.frequency.setValueAtTime(swapEnabled ? 420 : 2200, now);
    airFilter.frequency.exponentialRampToValueAtTime(swapEnabled ? 5200 : 300, now + 0.27);
    airEnvelope.gain.setValueAtTime(0.0001, now);
    airEnvelope.gain.exponentialRampToValueAtTime(swapEnabled ? 0.025 : 0.018, now + 0.02);
    airEnvelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    carrier.type = swapEnabled ? 'sawtooth' : 'triangle';
    body.type = swapEnabled ? 'triangle' : 'sine';
    shimmer.type = swapEnabled ? 'triangle' : 'sine';

    carrier.frequency.setValueAtTime(swapEnabled ? 96 : 840, now);
    carrier.frequency.exponentialRampToValueAtTime(swapEnabled ? 720 : 118, now + 0.26);
    body.frequency.setValueAtTime(swapEnabled ? 210 : 620, now);
    body.frequency.exponentialRampToValueAtTime(swapEnabled ? 1320 : 150, now + 0.3);
    shimmer.frequency.setValueAtTime(swapEnabled ? 780 : 2100, now);
    shimmer.frequency.exponentialRampToValueAtTime(swapEnabled ? 2600 : 240, now + 0.18);

    body.detune.value = swapEnabled ? 11 : -8;
    shimmer.detune.value = swapEnabled ? 22 : -20;

    carrier.connect(filter);
    body.connect(filter);
    filter.connect(envelope);
    envelope.connect(context.destination);

    shimmer.connect(shimmerEnvelope);
    shimmerEnvelope.connect(context.destination);
    air.connect(airFilter);
    airFilter.connect(airEnvelope);
    airEnvelope.connect(context.destination);

    carrier.start(now);
    body.start(now);
    shimmer.start(now);
    air.start(now);
    carrier.stop(now + 0.37);
    body.stop(now + 0.37);
    shimmer.stop(now + 0.21);
    air.stop(now + 0.31);
  }
}

const uiSoundEngine = new UiSoundEngine();

export const playUiSound = (variant: UiSoundVariant, mode: UiSoundMode = 'classic') => {
  uiSoundEngine.play(variant, mode);
};

export const playSupersonicToggleSound = (enabled: boolean) => {
  uiSoundEngine.playSupersonicTransition(enabled);
};
