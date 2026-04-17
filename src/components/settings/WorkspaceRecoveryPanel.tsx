import { Save, Trash2 } from 'lucide-react';

import { ActionButton } from './SettingsPrimitives';

interface CheckpointView {
  id: string;
  label: string;
  projectName: string;
  savedAt: string;
}

interface WorkspaceRecoveryPanelProps {
  checkpoints: CheckpointView[];
  disabled: boolean;
  onDeleteCheckpoint: (checkpointId: string) => void;
  onRestoreCheckpoint: (checkpointId: string) => void;
}

export const WorkspaceRecoveryPanel = ({
  checkpoints,
  disabled,
  onDeleteCheckpoint,
  onRestoreCheckpoint,
}: WorkspaceRecoveryPanelProps) => (
  <section className="surface-panel-strong p-4">
    <div className="flex items-center justify-between gap-3">
      <span className="section-label">Recovery</span>
      <span className="font-mono text-xs text-[var(--accent-strong)]">{checkpoints.length}</span>
    </div>
    <div className="mt-3 grid gap-2">
      {checkpoints.length > 0 ? checkpoints.map((checkpoint) => (
        <div key={checkpoint.id} className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">{checkpoint.label}</div>
              <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
                {checkpoint.projectName} · {new Date(checkpoint.savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </div>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">
              {new Date(checkpoint.savedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ActionButton disabled={disabled} icon={<Save className="h-3.5 w-3.5" />} label="Restore" onClick={() => onRestoreCheckpoint(checkpoint.id)} />
            <ActionButton disabled={disabled} icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete" onClick={() => onDeleteCheckpoint(checkpoint.id)} />
          </div>
        </div>
      )) : (
        <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-4 py-4 text-[11px] leading-5 text-[var(--text-secondary)]">
          Save a checkpoint before big edits, imports, or arrangement surgery.
        </div>
      )}
    </div>
  </section>
);
