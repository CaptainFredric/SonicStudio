import React, { useState } from 'react';
import { Volume2, Settings } from 'lucide-react';
import { Knob } from './Knob';

export interface MasterControls {
  masterVolume: number;
  eqLow: number;
  eqMid: number;
  eqHigh: number;
  limiter: boolean;
}

interface MasterControlProps {
  onControlChange: (controls: MasterControls) => void;
  currentControls: MasterControls;
}

export const MasterControl: React.FC<MasterControlProps> = ({
  onControlChange,
  currentControls,
}) => {
  const [expanded, setExpanded] = useState(false);

  const updateControl = (key: keyof MasterControls, value: unknown) => {
    onControlChange({
      ...currentControls,
      [key]: value,
    });
  };

  return (
    <div className="surface-panel flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-[var(--accent)]" />
          <div className="section-label">Master</div>
        </div>
        <button
          className="ghost-icon-button flex h-8 w-8 items-center justify-center"
          onClick={() => setExpanded(!expanded)}
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <input
            className="w-full"
            max="0"
            min="-60"
            onChange={(e) => updateControl('masterVolume', Number(e.target.value))}
            step="1"
            type="range"
            value={currentControls.masterVolume}
          />
        </div>
        <div className="font-mono text-xs text-[var(--text-secondary)] w-12 text-right">
          {currentControls.masterVolume.toFixed(1)} dB
        </div>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-[var(--border-soft)] pt-4">
          <div>
            <div className="section-label mb-3">3-Band EQ</div>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center">
                <Knob
                  color="#d4b16a"
                  label="Low"
                  max={12}
                  min={-12}
                  onChange={(value) => updateControl('eqLow', value)}
                  step={0.1}
                  value={currentControls.eqLow}
                />
                <div className="mt-2 text-xs text-[var(--text-tertiary)]">100 Hz</div>
              </div>

              <div className="flex flex-col items-center">
                <Knob
                  color="#82c9bb"
                  label="Mid"
                  max={12}
                  min={-12}
                  onChange={(value) => updateControl('eqMid', value)}
                  step={0.1}
                  value={currentControls.eqMid}
                />
                <div className="mt-2 text-xs text-[var(--text-tertiary)]">1 kHz</div>
              </div>

              <div className="flex flex-col items-center">
                <Knob
                  color="#96b9f3"
                  label="High"
                  max={12}
                  min={-12}
                  onChange={(value) => updateControl('eqHigh', value)}
                  step={0.1}
                  value={currentControls.eqHigh}
                />
                <div className="mt-2 text-xs text-[var(--text-tertiary)]">10 kHz</div>
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--border-soft)] pt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                checked={currentControls.limiter}
                onChange={(e) => updateControl('limiter', e.target.checked)}
                type="checkbox"
                className="w-4 h-4"
              />
              <span className="text-sm text-[var(--text-secondary)]">Limiter (0dB)</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
