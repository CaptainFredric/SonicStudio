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

    if (enabled) {
      this.playPowerUp(context, now);
    } else {
      this.playPowerDown(context, now);
    }
  }

  // Power on: a rising charge that brightens as it climbs, capped with a quick
  // laser zap. Reads as energising and a little sci-fi.
  private playPowerUp(context: AudioContext, now: number) {
    const carrier = context.createOscillator();
    const sub = context.createOscillator();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();

    filter.type = 'lowpass';
    filter.Q.value = 1.1;
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(3800, now + 0.22);

    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(200, now);
    carrier.frequency.exponentialRampToValueAtTime(1400, now + 0.22);
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(100, now);
    sub.frequency.exponentialRampToValueAtTime(700, now + 0.22);

    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(0.05, now + 0.015);
    envelope.gain.setValueAtTime(0.05, now + 0.18);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);

    carrier.connect(filter);
    sub.connect(filter);
    filter.connect(envelope);
    envelope.connect(context.destination);

    carrier.start(now);
    sub.start(now);
    carrier.stop(now + 0.36);
    sub.stop(now + 0.36);

    // The laser zap at the top of the charge: a fast bright downward pew.
    const zap = context.createOscillator();
    const zapEnvelope = context.createGain();
    zap.type = 'square';
    zap.frequency.setValueAtTime(2000, now + 0.19);
    zap.frequency.exponentialRampToValueAtTime(700, now + 0.31);
    zapEnvelope.gain.setValueAtTime(0.0001, now + 0.19);
    zapEnvelope.gain.exponentialRampToValueAtTime(0.04, now + 0.205);
    zapEnvelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.33);
    zap.connect(zapEnvelope);
    zapEnvelope.connect(context.destination);
    zap.start(now + 0.19);
    zap.stop(now + 0.35);
  }

  // Power off: a darkening descent that winds down, like a system spinning back
  // to rest.
  private playPowerDown(context: AudioContext, now: number) {
    const carrier = context.createOscillator();
    const sub = context.createOscillator();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();

    filter.type = 'lowpass';
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(2600, now);
    filter.frequency.exponentialRampToValueAtTime(150, now + 0.3);

    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(820, now);
    carrier.frequency.exponentialRampToValueAtTime(70, now + 0.3);
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(540, now);
    sub.frequency.exponentialRampToValueAtTime(60, now + 0.3);

    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(0.052, now + 0.014);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

    carrier.connect(filter);
    sub.connect(filter);
    filter.connect(envelope);
    envelope.connect(context.destination);

    carrier.start(now);
    sub.start(now);
    carrier.stop(now + 0.4);
    sub.stop(now + 0.4);
  }
}

const uiSoundEngine = new UiSoundEngine();

export const playUiSound = (variant: UiSoundVariant, mode: UiSoundMode = 'classic') => {
  uiSoundEngine.play(variant, mode);
};

export const playSupersonicToggleSound = (enabled: boolean) => {
  uiSoundEngine.playSupersonicTransition(enabled);
};
