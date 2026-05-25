import { useEffect, useState } from 'react';
import { Brain, Coffee, Mic, Pin, RotateCcw, Settings2, Volume2, Waves, Zap } from 'lucide-react';

import type { AudioStabilityMode, CaptureAnalysisProfile, CaptureSuggestionCount, MotionMode, SuperSonicWaveIntensity } from '../../project/preferences';
import type { TrainingCorpusSummary } from '../../services/aiTrainingCorpus';
import { hasSeenUiReminder, markUiReminderSeen } from '../../services/uiReminders';
import { SegmentButton, StateButton } from './SettingsPrimitives';

const SUPPORT_URL = 'https://buymeacoffee.com/captainarm1';

interface WorkspaceOptionsPanelProps {
  captureAnalysisProfile: CaptureAnalysisProfile;
  captureAutoPreviewMatch: boolean;
  captureKeepShelfBetweenTakes: boolean;
  captureLiveSuggestionCount: CaptureSuggestionCount;
  motionMode: MotionMode;
  onCaptureAnalysisProfileChange: (profile: CaptureAnalysisProfile) => void;
  onCaptureAutoPreviewMatchChange: (enabled: boolean) => void;
  onCaptureKeepShelfBetweenTakesChange: (enabled: boolean) => void;
  onCaptureLiveSuggestionCountChange: (count: CaptureSuggestionCount) => void;
  onMotionModeChange: (mode: MotionMode) => void;
  onResetGuidance: () => void;
  onResetStudioPreferences: () => void;
  onSuperSonicModeChange: (enabled: boolean) => void;
  onSuperSonicGuidanceBadgesChange: (enabled: boolean) => void;
  onSuperSonicWaveIntensityChange: (intensity: SuperSonicWaveIntensity) => void;
  onStickyMobileTransportChange: (enabled: boolean) => void;
  onAudioStabilityModeChange: (mode: AudioStabilityMode) => void;
  onExportTrainingCorpus: () => void;
  trainingCorpusSummary: TrainingCorpusSummary;
  onUiSoundsEnabledChange: (enabled: boolean) => void;
  stickyMobileTransport: boolean;
  audioStabilityMode: AudioStabilityMode;
  superSonicGuidanceBadges: boolean;
  superSonicMode: boolean;
  superSonicWaveIntensity: SuperSonicWaveIntensity;
  uiSoundsEnabled: boolean;
}

export const WorkspaceOptionsPanel = ({
  captureAnalysisProfile,
  captureAutoPreviewMatch,
  captureKeepShelfBetweenTakes,
  captureLiveSuggestionCount,
  motionMode,
  onCaptureAnalysisProfileChange,
  onCaptureAutoPreviewMatchChange,
  onCaptureKeepShelfBetweenTakesChange,
  onCaptureLiveSuggestionCountChange,
  onMotionModeChange,
  onResetGuidance,
  onResetStudioPreferences,
  onSuperSonicModeChange,
  onSuperSonicGuidanceBadgesChange,
  onSuperSonicWaveIntensityChange,
  onStickyMobileTransportChange,
  onAudioStabilityModeChange,
  onExportTrainingCorpus,
  trainingCorpusSummary,
  onUiSoundsEnabledChange,
  stickyMobileTransport,
  audioStabilityMode,
  superSonicGuidanceBadges,
  superSonicMode,
  superSonicWaveIntensity,
  uiSoundsEnabled,
}: WorkspaceOptionsPanelProps) => {
  const [compactCopy, setCompactCopy] = useState(() => hasSeenUiReminder('workspace-options-copy'));

  useEffect(() => {
    const seen = hasSeenUiReminder('workspace-options-copy');
    setCompactCopy(seen);
    if (!seen) {
      markUiReminderSeen('workspace-options-copy');
    }
  }, []);

  return (
    <section className="surface-panel-strong p-4">
    <div className="flex items-center gap-2 text-[var(--text-primary)]">
      <Settings2 className="h-4 w-4 text-[var(--accent)]" />
      <span className="section-label">Studio options</span>
    </div>
    <p className="mt-1.5 text-[11px] leading-5 text-[var(--text-secondary)]">
      How the studio behaves while you work. Theme color and density live under Preferences.
    </p>

    <div className="mt-4 space-y-4">
      <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-[var(--danger)]" />
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">SuperSonic tools</div>
            <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
              {compactCopy
                ? 'Precision ladders, stronger track-map guidance, and the faster alternate studio skin.'
                : 'Precision ladders, stronger track-map guidance, brighter desk contrast, and the faster alternate studio skin.'}
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <StateButton active={superSonicMode} label="On" onClick={() => onSuperSonicModeChange(true)} />
          <StateButton active={!superSonicMode} label="Off" onClick={() => onSuperSonicModeChange(false)} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Wave veil</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <SegmentButton active={superSonicWaveIntensity === 'off'} label="Off" onClick={() => onSuperSonicWaveIntensityChange('off')} />
              <SegmentButton active={superSonicWaveIntensity === 'faint'} label="Faint" onClick={() => onSuperSonicWaveIntensityChange('faint')} />
              <SegmentButton active={superSonicWaveIntensity === 'flow'} label="Flow" onClick={() => onSuperSonicWaveIntensityChange('flow')} />
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Guidance badges</div>
            <div className="mt-2 flex gap-2">
              <StateButton active={superSonicGuidanceBadges} label="On" onClick={() => onSuperSonicGuidanceBadgesChange(true)} />
              <StateButton active={!superSonicGuidanceBadges} label="Off" onClick={() => onSuperSonicGuidanceBadgesChange(false)} />
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-[4px] border border-[rgba(176,31,55,0.2)] bg-[rgba(176,31,55,0.05)] px-3 py-2 text-[11px] leading-5 text-[var(--text-secondary)]">
          {compactCopy
            ? 'Use the SuperSonic button in the top bar for quick precision mode.'
            : 'Use the SuperSonic button in the top bar when you want the precision layout quickly. The mode now also supports a faint moving wave veil across the studio and optional guidance badges for the advanced lane tools.'}
        </div>
      </div>

      <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-[var(--danger)]" />
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">Capture sound</div>
            <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
              {compactCopy
                ? 'Record a phrase, review note guesses, and apply a lane match.'
                : 'Record a short phrase, get nearby note guesses, and drop the result into a matching lane without leaving the session.'}
            </div>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-[3px] border border-[var(--border-soft)] px-3 py-2 text-[11px] leading-5 text-[var(--text-secondary)]">Open it from the red Capture button in the rail or the top bar.</div>
          <div className="rounded-[3px] border border-[var(--border-soft)] px-3 py-2 text-[11px] leading-5 text-[var(--text-secondary)]">Pitch matching, note suggestions, and source shaping stay local in the browser.</div>
          <div className="rounded-[3px] border border-[var(--border-soft)] px-3 py-2 text-[11px] leading-5 text-[var(--text-secondary)]">Use it when you want custom notes, fast sample starts, or a new lane idea from live input.</div>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Detection profile</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <SegmentButton active={captureAnalysisProfile === 'quick'} label="Quick" onClick={() => onCaptureAnalysisProfileChange('quick')} />
              <SegmentButton active={captureAnalysisProfile === 'balanced'} label="Balanced" onClick={() => onCaptureAnalysisProfileChange('balanced')} />
              <SegmentButton active={captureAnalysisProfile === 'steady'} label="Steady" onClick={() => onCaptureAnalysisProfileChange('steady')} />
            </div>
            <div className="mt-3 text-[11px] leading-5 text-[var(--text-secondary)]">
              {compactCopy
                ? 'Quick commits fastest, Balanced is default, and Steady waits for cleaner held tones.'
                : 'Quick commits faster, Balanced keeps the current behavior, and Steady waits for a cleaner held tone before shelving a capture.'}
            </div>
          </div>
          <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Live matches shown</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <SegmentButton active={captureLiveSuggestionCount === 1} label="1" onClick={() => onCaptureLiveSuggestionCountChange(1)} />
              <SegmentButton active={captureLiveSuggestionCount === 2} label="2" onClick={() => onCaptureLiveSuggestionCountChange(2)} />
              <SegmentButton active={captureLiveSuggestionCount === 3} label="3" onClick={() => onCaptureLiveSuggestionCountChange(3)} />
            </div>
            <div className="mt-3 text-[11px] leading-5 text-[var(--text-secondary)]">
              {compactCopy
                ? 'Limit how many lane matches show up live and after recording.'
                : 'Limit how many lane matches appear live and after recording. Lower counts keep mobile capture calmer.'}
            </div>
          </div>
          <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Auto-preview top match</div>
            <div className="mt-2 flex gap-2">
              <StateButton active={captureAutoPreviewMatch} label="On" onClick={() => onCaptureAutoPreviewMatchChange(true)} />
              <StateButton active={!captureAutoPreviewMatch} label="Off" onClick={() => onCaptureAutoPreviewMatchChange(false)} />
            </div>
            <div className="mt-3 text-[11px] leading-5 text-[var(--text-secondary)]">
              {compactCopy
                ? 'Auto-plays the strongest lane suggestion right after analysis.'
                : 'Auditions the strongest lane suggestion right after analysis finishes so you can judge the match faster.'}
            </div>
          </div>
          <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Keep note shelf between takes</div>
            <div className="mt-2 flex gap-2">
              <StateButton active={captureKeepShelfBetweenTakes} label="On" onClick={() => onCaptureKeepShelfBetweenTakesChange(true)} />
              <StateButton active={!captureKeepShelfBetweenTakes} label="Off" onClick={() => onCaptureKeepShelfBetweenTakesChange(false)} />
            </div>
            <div className="mt-3 text-[11px] leading-5 text-[var(--text-secondary)]">
              {compactCopy
                ? 'Keeps saved notes visible while you keep recording in the same pass.'
                : 'Keeps saved notes visible while you keep recording inside the same capture pass instead of clearing the shelf on every retry.'}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-[var(--accent)]" />
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">Reset helpers</div>
            <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
              Restart the tutorial/reminder guidance or restore all default app settings.
            </div>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            className="control-chip px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            onClick={() => {
              onResetGuidance();
            }}
            type="button"
          >
            Reset tutorial + reminders
          </button>
          <button
            className="control-chip px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            onClick={() => {
              if (typeof window !== 'undefined') {
                const confirmed = window.confirm('Restore default SonicStudio settings? This keeps your sessions and scoresheets, but resets visual/workflow preferences.');
                if (!confirmed) {
                  return;
                }
              }
              onResetStudioPreferences();
            }}
            type="button"
          >
            Reset default settings
          </button>
        </div>
      </div>

      <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-[var(--accent)]" />
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">UI sounds</div>
            <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
              Button presses use varied studio clicks for navigation, transport, and edit actions.
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <StateButton active={uiSoundsEnabled} label="On" onClick={() => onUiSoundsEnabledChange(true)} />
          <StateButton active={!uiSoundsEnabled} label="Off" onClick={() => onUiSoundsEnabledChange(false)} />
        </div>
      </div>

      <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
        <div className="flex items-center gap-2">
          <Pin className="h-4 w-4 text-[var(--accent)]" />
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">Transport bar on phones</div>
            <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
              Keep Play, Stop, Record, and SuperSonic pinned to the top while you scroll, or let the bar scroll away for a little more grid room.
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <StateButton active={stickyMobileTransport} label="Pinned" onClick={() => onStickyMobileTransportChange(true)} />
          <StateButton active={!stickyMobileTransport} label="Scrolls away" onClick={() => onStickyMobileTransportChange(false)} />
        </div>
      </div>

      <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-[var(--accent)]" />
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">Audio scheduling</div>
            <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
              How far ahead the engine schedules notes. Auto picks for your device. Tight has the lowest latency but can glitch on slow phones; Resilient adds headroom if audio drops mid-pattern.
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SegmentButton active={audioStabilityMode === 'auto'} label="Auto" onClick={() => onAudioStabilityModeChange('auto')} />
          <SegmentButton active={audioStabilityMode === 'tight'} label="Tight" onClick={() => onAudioStabilityModeChange('tight')} />
          <SegmentButton active={audioStabilityMode === 'stable'} label="Stable" onClick={() => onAudioStabilityModeChange('stable')} />
          <SegmentButton active={audioStabilityMode === 'resilient'} label="Resilient" onClick={() => onAudioStabilityModeChange('resilient')} />
        </div>
      </div>

      <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-[var(--accent)]" />
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">AI training corpus</div>
            <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
              Export this session as a normalized JSON. Covers tempo, tracks, notes, song structure, markers, and pre-rolled per-track and per-pattern stats so a downstream music model can train against it without re-walking the raw notes.
            </div>
          </div>
        </div>
        <div
          className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[3px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-secondary)]"
          aria-label="What this corpus contains right now"
        >
          <span>Now: {trainingCorpusSummary.trackCount} {trainingCorpusSummary.trackCount === 1 ? 'track' : 'tracks'}</span>
          <span aria-hidden="true" className="text-[var(--border-soft)]">·</span>
          <span>{trainingCorpusSummary.noteCount} {trainingCorpusSummary.noteCount === 1 ? 'note' : 'notes'}</span>
          <span aria-hidden="true" className="text-[var(--border-soft)]">·</span>
          <span>{trainingCorpusSummary.patternCount} {trainingCorpusSummary.patternCount === 1 ? 'pattern' : 'patterns'}</span>
          <span aria-hidden="true" className="text-[var(--border-soft)]">·</span>
          <span>{trainingCorpusSummary.bars} {trainingCorpusSummary.bars === 1 ? 'bar' : 'bars'}</span>
          {trainingCorpusSummary.markerCount > 0 && (
            <>
              <span aria-hidden="true" className="text-[var(--border-soft)]">·</span>
              <span>{trainingCorpusSummary.markerCount} {trainingCorpusSummary.markerCount === 1 ? 'marker' : 'markers'}</span>
            </>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="control-chip inline-flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            onClick={onExportTrainingCorpus}
            type="button"
          >
            <Brain className="h-3.5 w-3.5" />
            Export session JSON
          </button>
          <div className="rounded-[3px] border border-[var(--border-soft)] px-3 py-2 text-[11px] leading-5 text-[var(--text-secondary)]">
            Downloads a *.json file. Read-only on the studio — does not change your session.
          </div>
        </div>
      </div>

      <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
        <div className="flex items-center gap-2">
          <Waves className="h-4 w-4 text-[var(--accent)]" />
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">Motion</div>
            <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
              Choose the movement pace for panels, controls, and studio feedback.
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <SegmentButton active={motionMode === 'fluid'} label="Fluid" onClick={() => onMotionModeChange('fluid')} />
          <SegmentButton active={motionMode === 'focus'} label="Focus" onClick={() => onMotionModeChange('focus')} />
          <SegmentButton active={motionMode === 'still'} label="Still" onClick={() => onMotionModeChange('still')} />
        </div>
      </div>

      <div className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-3">
        <div className="flex items-center gap-2">
          <Coffee className="h-4 w-4 text-[var(--accent)]" />
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">Support SonicStudio</div>
            <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
              SonicStudio is staying free-first. If it is helping, this support link is the main way to keep it going.
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            className="control-chip inline-flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            href={SUPPORT_URL}
            rel="noreferrer noopener"
            target="_blank"
          >
            <Coffee className="h-3.5 w-3.5" />
            Buy me a coffee
          </a>
          <div className="rounded-[3px] border border-[var(--border-soft)] px-3 py-2 text-[11px] leading-5 text-[var(--text-secondary)]">
            Opens buymeacoffee.com/captainarm1 in a new tab.
          </div>
        </div>
      </div>
    </div>
  </section>
  );
};
