export type UiSoundVariant =
  | 'action'
  | 'danger'
  | 'nav'
  | 'record'
  | 'settings'
  | 'tab'
  | 'transport';

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

  play(variant: UiSoundVariant) {
    const context = this.ensureContext();
    if (!context) {
      return;
    }

    const now = context.currentTime;
    if (now - this.lastPlaybackAt < 0.02) {
      return;
    }
    this.lastPlaybackAt = now;

    const recipe = RECIPES[variant];
    const jitter = 1 + ((Math.random() * 2 - 1) * recipe.detuneSpread * 0.01);
    const primary = context.createOscillator();
    const harmonic = context.createOscillator();
    const envelope = context.createGain();
    const filter = context.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.value = Math.min(4200, recipe.frequency * 7);
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
    filter.connect(envelope);
    envelope.connect(context.destination);

    primary.start(now);
    harmonic.start(now);
    primary.stop(now + recipe.decay + 0.02);
    harmonic.stop(now + recipe.decay + 0.02);
  }
}

const uiSoundEngine = new UiSoundEngine();

export const playUiSound = (variant: UiSoundVariant) => {
  uiSoundEngine.play(variant);
};
