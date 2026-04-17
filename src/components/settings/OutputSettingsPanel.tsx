import { Gauge, Layers3, Save, SlidersHorizontal, Trash2 } from 'lucide-react';

import { useAudio } from '../../context/AudioContext';
import { MASTER_PRESET_DEFINITIONS, type MasterSettings } from '../../project/schema';
import { ActionButton, MetricCell } from './SettingsPrimitives';

const MASTER_MATCH_EPSILON = 0.015;

const isMasterPresetMatch = (current: MasterSettings, target: MasterSettings) => (
  Math.abs(current.glueCompression - target.glueCompression) <= MASTER_MATCH_EPSILON
  && Math.abs(current.highCutHz - target.highCutHz) <= 120
  && Math.abs(current.tone - target.tone) <= MASTER_MATCH_EPSILON
  && Math.abs(current.lowCutHz - target.lowCutHz) <= 4
  && Math.abs(current.outputGain - target.outputGain) <= 0.11
  && Math.abs(current.stereoWidth - target.stereoWidth) <= MASTER_MATCH_EPSILON
  && Math.abs(current.limiterCeiling - target.limiterCeiling) <= 0.06
);

export const OutputSettingsPanel = () => {
  const {
    applyMasterSnapshot,
    deleteMasterSnapshot,
    master,
    masterSnapshots,
    renderState,
    saveMasterSnapshot,
    setMasterSettings,
  } = useAudio();

  const activeMasterPreset = MASTER_PRESET_DEFINITIONS.find((preset) => (
    isMasterPresetMatch(master, preset.settings)
  )) ?? null;
  const activeMasterSnapshot = masterSnapshots.find((snapshot) => (
    isMasterPresetMatch(master, snapshot.settings)
  )) ?? null;

  return (
    <section className="surface-panel-strong p-4">
      <div className="flex items-center gap-2 text-[var(--text-primary)]">
        <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
        <span className="section-label">Master Output</span>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="section-label">Mix recall</span>
          <span className="font-mono text-xs text-[var(--accent-strong)]">
            {activeMasterSnapshot ? activeMasterSnapshot.name : 'Unsaved'}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ActionButton
            disabled={renderState.active}
            icon={<Save className="h-3.5 w-3.5" />}
            label={activeMasterSnapshot ? 'Update current' : 'Save current'}
            onClick={() => saveMasterSnapshot(activeMasterSnapshot?.id ?? null)}
          />
          <ActionButton
            disabled={renderState.active || masterSnapshots.length === 0}
            icon={<Layers3 className="h-3.5 w-3.5" />}
            label="Store new"
            onClick={() => saveMasterSnapshot()}
          />
        </div>
        <div className="mt-3 grid gap-2">
          {masterSnapshots.length > 0 ? masterSnapshots.map((snapshot) => (
            <div key={snapshot.id} className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{snapshot.name}</div>
                  <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
                    Glue {Math.round(snapshot.settings.glueCompression * 100)} · Tone {Math.round(snapshot.settings.tone * 100)} · Gain {snapshot.settings.outputGain.toFixed(1)} dB
                  </div>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                  {activeMasterSnapshot?.id === snapshot.id ? 'Live' : 'Stored'}
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <ActionButton disabled={renderState.active} icon={<Gauge className="h-3.5 w-3.5" />} label="Apply" onClick={() => applyMasterSnapshot(snapshot.id)} />
                <ActionButton disabled={renderState.active} icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete" onClick={() => deleteMasterSnapshot(snapshot.id)} />
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-4 py-4 text-[11px] leading-5 text-[var(--text-secondary)]">
              Save master states and recall them while checking a section print.
            </div>
          )}
        </div>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="section-label">Master profile</span>
          <span className="font-mono text-xs text-[var(--accent-strong)]">
            {activeMasterPreset ? activeMasterPreset.label : 'Custom'}
          </span>
        </div>
        <div className="mt-3 grid gap-3">
          {MASTER_PRESET_DEFINITIONS.map((preset) => (
            <button
              key={preset.id}
              className="rounded-2xl border px-4 py-3 text-left transition-colors"
              data-active={activeMasterPreset?.id === preset.id}
              onClick={() => setMasterSettings(preset.settings)}
              style={{
                background: activeMasterPreset?.id === preset.id ? 'rgba(114,217,255,0.08)' : 'rgba(255,255,255,0.02)',
                borderColor: activeMasterPreset?.id === preset.id ? 'rgba(114,217,255,0.22)' : 'var(--border-soft)',
              }}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[var(--text-primary)]">{preset.label}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                  {Math.round(preset.settings.glueCompression * 100)} glue
                </span>
              </div>
              <div className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetricCell label="Output" value={`${master.outputGain.toFixed(1)} dB`} />
        <MetricCell label="Ceiling" value={`${master.limiterCeiling.toFixed(1)} dB`} />
        <MetricCell label="Width" value={`${Math.round(master.stereoWidth * 100)}%`} />
        <MetricCell label="Band" value={`${Math.round(master.lowCutHz)} Hz to ${Math.round(master.highCutHz / 100) / 10} kHz`} />
      </div>
      <div className="mt-4 space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <span className="section-label">Glue compression</span>
            <span className="font-mono text-xs text-[var(--text-secondary)]">{Math.round(master.glueCompression * 100)}</span>
          </div>
          <input
            className="mt-3"
            max="1"
            min="0"
            onChange={(event) => setMasterSettings({ glueCompression: Number(event.target.value) })}
            step="0.01"
            type="range"
            value={master.glueCompression}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="section-label">Tone</span>
            <span className="font-mono text-xs text-[var(--text-secondary)]">{Math.round(master.tone * 100)}</span>
          </div>
          <input
            className="mt-3"
            max="1"
            min="0"
            onChange={(event) => setMasterSettings({ tone: Number(event.target.value) })}
            step="0.01"
            type="range"
            value={master.tone}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="section-label">Stereo width</span>
            <span className="font-mono text-xs text-[var(--text-secondary)]">{Math.round(master.stereoWidth * 100)}</span>
          </div>
          <input
            className="mt-3"
            max="1"
            min="0"
            onChange={(event) => setMasterSettings({ stereoWidth: Number(event.target.value) })}
            step="0.01"
            type="range"
            value={master.stereoWidth}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between">
              <span className="section-label">Low cut</span>
              <span className="font-mono text-xs text-[var(--text-secondary)]">{Math.round(master.lowCutHz)} Hz</span>
            </div>
            <input
              className="mt-3"
              max="240"
              min="20"
              onChange={(event) => setMasterSettings({ lowCutHz: Number(event.target.value) })}
              step="1"
              type="range"
              value={master.lowCutHz}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="section-label">High cut</span>
              <span className="font-mono text-xs text-[var(--text-secondary)]">{Math.round(master.highCutHz / 100) / 10} kHz</span>
            </div>
            <input
              className="mt-3"
              max="20000"
              min="6000"
              onChange={(event) => setMasterSettings({ highCutHz: Number(event.target.value) })}
              step="100"
              type="range"
              value={master.highCutHz}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="section-label">Output gain</span>
            <span className="font-mono text-xs text-[var(--text-secondary)]">{master.outputGain.toFixed(1)} dB</span>
          </div>
          <input
            className="mt-3"
            max="12"
            min="-12"
            onChange={(event) => setMasterSettings({ outputGain: Number(event.target.value) })}
            step="0.5"
            type="range"
            value={master.outputGain}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="section-label">Limiter ceiling</span>
            <span className="font-mono text-xs text-[var(--text-secondary)]">{master.limiterCeiling.toFixed(1)} dB</span>
          </div>
          <input
            className="mt-3"
            max="0"
            min="-1.2"
            onChange={(event) => setMasterSettings({ limiterCeiling: Number(event.target.value) })}
            step="0.05"
            type="range"
            value={master.limiterCeiling}
          />
        </div>
      </div>
      <div className="mt-4 text-[11px] leading-5 text-[var(--text-secondary)]">
        Bounce uses these master settings, so the output path is visible before you print a mix or stems.
      </div>
    </section>
  );
};
