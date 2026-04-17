import type { RefObject } from 'react';
import { FolderOpen, Layers3, Save, Sparkles } from 'lucide-react';

import { SESSION_TEMPLATE_DEFINITIONS } from '../../project/schema';
import { ActionButton, MetricCell } from './SettingsPrimitives';

interface WorkspaceSessionPanelProps {
  arrangerClipCount: number;
  fileInputRef: RefObject<HTMLInputElement | null>;
  importMidiInputRef: RefObject<HTMLInputElement | null>;
  isRendering: boolean;
  lastSavedStatus: string;
  loadSessionTemplate: (templateId: (typeof SESSION_TEMPLATE_DEFINITIONS)[number]['id']) => void;
  newSession: () => void;
  onSaveCheckpoint: () => void;
  onSaveProject: () => void;
  trackCount: number;
}

export const WorkspaceSessionPanel = ({
  arrangerClipCount,
  fileInputRef,
  importMidiInputRef,
  isRendering,
  lastSavedStatus,
  loadSessionTemplate,
  newSession,
  onSaveCheckpoint,
  onSaveProject,
  trackCount,
}: WorkspaceSessionPanelProps) => (
  <section className="surface-panel-strong p-4">
    <div className="flex items-center gap-2 text-[var(--text-primary)]">
      <Sparkles className="h-4 w-4 text-[var(--accent)]" />
      <span className="section-label">Session</span>
    </div>
    <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-[var(--text-secondary)] sm:grid-cols-3">
      <MetricCell label="Tracks" value={String(trackCount)} />
      <MetricCell label="Clips" value={String(arrangerClipCount)} />
      <MetricCell label="Status" value={lastSavedStatus} />
    </div>
    <div className="mt-4">
      <div className="section-label">Starter scenes</div>
      <div className="mt-3 grid gap-3">
        {SESSION_TEMPLATE_DEFINITIONS.map((template) => (
          <button
            key={template.id}
            className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-left transition-colors hover:border-[rgba(114,217,255,0.28)] hover:bg-[rgba(114,217,255,0.05)]"
            disabled={isRendering}
            onClick={() => loadSessionTemplate(template.id)}
            type="button"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[var(--text-primary)]">{template.label}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent-strong)]">{template.focus}</span>
            </div>
            <div className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">{template.description}</div>
          </button>
        ))}
      </div>
      <div className="mt-3 text-[11px] leading-5 text-[var(--text-secondary)]">
        These scenes replace the current session immediately. Save a checkpoint first if you want a way back.
      </div>
    </div>
    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <ActionButton disabled={isRendering} icon={<Sparkles className="h-3.5 w-3.5" />} label="New session" onClick={newSession} />
      <ActionButton disabled={isRendering} icon={<Layers3 className="h-3.5 w-3.5" />} label="Save now" onClick={onSaveProject} />
      <ActionButton disabled={isRendering} icon={<Save className="h-3.5 w-3.5" />} label="Checkpoint" onClick={onSaveCheckpoint} />
      <ActionButton disabled={isRendering} icon={<FolderOpen className="h-3.5 w-3.5" />} label="Load JSON" onClick={() => fileInputRef.current?.click()} />
      <ActionButton disabled={isRendering} icon={<FolderOpen className="h-3.5 w-3.5" />} label="Import MIDI" onClick={() => importMidiInputRef.current?.click()} />
    </div>
  </section>
);
