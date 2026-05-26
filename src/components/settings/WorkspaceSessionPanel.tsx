import { useEffect, useRef, type RefObject } from 'react';
import { FolderOpen, Layers3, Save, Sparkles } from 'lucide-react';

import { schedulePreview, type PreviewSchedule } from '../../audio/captureStringPreview';
import { SESSION_TEMPLATE_DEFINITIONS, type InstrumentType } from '../../project/schema';
import { getTemplatePreview } from '../../services/templatePreview';
import { ActionButton, MetricCell } from './SettingsPrimitives';

const TOUCH_AUDITION_DELAY_MS = 320;

interface WorkspaceSessionPanelProps {
  arrangerClipCount: number;
  auditionInstrumentNote?: (type: InstrumentType, note: string, velocity?: number) => Promise<void>;
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
  auditionInstrumentNote,
  fileInputRef,
  importMidiInputRef,
  isRendering,
  lastSavedStatus,
  loadSessionTemplate,
  newSession,
  onSaveCheckpoint,
  onSaveProject,
  trackCount,
}: WorkspaceSessionPanelProps) => {
  const previewRef = useRef<PreviewSchedule | null>(null);
  const touchTimerRef = useRef<number | null>(null);
  const activeAuditionIdRef = useRef<string | null>(null);

  const stopAudition = () => {
    previewRef.current?.cancel();
    previewRef.current = null;
    activeAuditionIdRef.current = null;
  };

  useEffect(() => () => {
    stopAudition();
    if (touchTimerRef.current !== null) {
      window.clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  }, []);

  const auditionTemplate = (templateId: (typeof SESSION_TEMPLATE_DEFINITIONS)[number]['id']) => {
    if (!auditionInstrumentNote) return;
    const preview = getTemplatePreview(templateId);
    if (!preview.auditionType || preview.auditionTokens.length === 0) return;
    if (activeAuditionIdRef.current === templateId && previewRef.current) return;
    stopAudition();
    const type = preview.auditionType;
    activeAuditionIdRef.current = templateId;
    const schedule = schedulePreview(
      preview.auditionTokens,
      (note, velocity) => { void auditionInstrumentNote(type, note, velocity); },
      {
        stepMs: 160,
        onComplete: () => {
          previewRef.current = null;
          if (activeAuditionIdRef.current === templateId) {
            activeAuditionIdRef.current = null;
          }
        },
      },
    );
    previewRef.current = schedule;
  };

  const clearTouchTimer = () => {
    if (touchTimerRef.current !== null) {
      window.clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  return (
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
          {SESSION_TEMPLATE_DEFINITIONS.map((template) => {
            const preview = getTemplatePreview(template.id);
            const canAudition = Boolean(auditionInstrumentNote) && preview.auditionTokens.length > 0;
            return (
              <button
                key={template.id}
                className="rounded-[4px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-left transition-colors hover:border-[rgba(114,217,255,0.28)] hover:bg-[rgba(114,217,255,0.05)]"
                disabled={isRendering}
                onClick={() => loadSessionTemplate(template.id)}
                onPointerEnter={(event) => {
                  if (!canAudition || isRendering) return;
                  if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
                  auditionTemplate(template.id);
                }}
                onPointerLeave={() => {
                  clearTouchTimer();
                  stopAudition();
                }}
                onPointerDown={(event) => {
                  if (!canAudition || isRendering) return;
                  if (event.pointerType === 'mouse' || event.pointerType === 'pen') return;
                  clearTouchTimer();
                  touchTimerRef.current = window.setTimeout(() => {
                    auditionTemplate(template.id);
                  }, TOUCH_AUDITION_DELAY_MS);
                }}
                onPointerUp={clearTouchTimer}
                onPointerCancel={() => {
                  clearTouchTimer();
                  stopAudition();
                }}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{template.label}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent-strong)]">{template.focus}</span>
                </div>
                <div className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">{template.description}</div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                  <span>{preview.bpm} BPM</span>
                  <span aria-hidden="true" className="text-[var(--border-soft)]">·</span>
                  <span>{preview.bars} {preview.bars === 1 ? 'bar' : 'bars'}</span>
                  <span aria-hidden="true" className="text-[var(--border-soft)]">·</span>
                  <span>{preview.trackCount} {preview.trackCount === 1 ? 'lane' : 'lanes'}</span>
                  {preview.instruments.length > 0 && (
                    <span className="flex items-center gap-1.5" aria-label={`Lane lineup: ${preview.instruments.map((entry) => entry.name).join(', ')}`}>
                      {preview.instruments.map((entry, index) => (
                        <span
                          key={`${template.id}-instrument-${index}`}
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: entry.color }}
                          title={`${entry.name} (${entry.type})`}
                        />
                      ))}
                    </span>
                  )}
                </div>
                {canAudition && (
                  <div className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Hover or long-press to audition · click to load
                  </div>
                )}
              </button>
            );
          })}
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
};
