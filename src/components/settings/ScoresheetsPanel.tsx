import { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, FolderOpen, Pencil, Play, Plus, Square, Trash2 } from 'lucide-react';

import { schedulePreview, type PreviewSchedule } from '../../audio/captureStringPreview';
import { useAudio } from '../../context/AudioContext';
import { getScoresheetThumbnail, summarizeScoresheet } from '../../services/scoresheets';
import { buildSessionAudition } from '../../services/templatePreview';

const formatRelative = (iso: string): string => {
  try {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return iso;
    const diff = Date.now() - then;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
};

export const ScoresheetsPanel = () => {
  const {
    auditionInstrumentNote,
    deleteScoresheet,
    loadScoresheet,
    projectName,
    renameScoresheet,
    saveScoresheet,
    scoresheets,
  } = useAudio();
  const previewRef = useRef<PreviewSchedule | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  useEffect(() => () => {
    previewRef.current?.cancel();
    previewRef.current = null;
  }, []);

  const stopPreview = () => {
    previewRef.current?.cancel();
    previewRef.current = null;
    setPreviewingId(null);
  };

  const startPreview = (sheetId: string, sheet: typeof scoresheets[number]) => {
    if (!auditionInstrumentNote) return;
    const audition = buildSessionAudition(
      sheet.session.project.tracks,
      sheet.session.project.transport.stepsPerPattern,
    );
    if (!audition.type || audition.tokens.length === 0) return;
    stopPreview();
    const type = audition.type;
    setPreviewingId(sheetId);
    previewRef.current = schedulePreview(
      audition.tokens,
      (note, velocity) => { void auditionInstrumentNote(type, note, velocity); },
      {
        stepMs: 160,
        onComplete: () => {
          previewRef.current = null;
          setPreviewingId((current) => (current === sheetId ? null : current));
        },
      },
    );
  };

  const togglePreview = (sheetId: string, sheet: typeof scoresheets[number]) => {
    if (previewingId === sheetId) {
      stopPreview();
      return;
    }
    startPreview(sheetId, sheet);
  };
  const [draftName, setDraftName] = useState(projectName);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => { setDraftName(projectName); }, [projectName]);
  useEffect(() => {
    if (!flash) return undefined;
    const id = window.setTimeout(() => setFlash(null), 1600);
    return () => window.clearTimeout(id);
  }, [flash]);

  const handleSave = () => {
    const name = draftName.trim();
    if (!name) return;
    saveScoresheet(name);
    setFlash('saved');
  };

  return (
    <section className="surface-panel-strong p-4">
      <div className="flex items-center gap-2 text-[var(--text-primary)]">
        <BookOpen className="h-4 w-4 text-[var(--accent)]" />
        <span className="section-label">Scoresheets</span>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
        Save many named sessions and switch between them. Each scoresheet is a full snapshot of tracks, arrangement, sounds, and tempo.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <input
          aria-label="Scoresheet name"
          className="control-field h-9 flex-1 px-3 text-sm"
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSave();
          }}
          placeholder="Name for this snapshot"
          value={draftName}
        />
        <button
          className="control-chip flex items-center justify-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
          data-active={flash === 'saved' ? 'true' : undefined}
          disabled={!draftName.trim()}
          onClick={handleSave}
          type="button"
        >
          {flash === 'saved' ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {flash === 'saved' ? 'Saved' : 'Save current'}
        </button>
      </div>

      {scoresheets.length === 0 ? (
        <p className="mt-4 text-[12px] text-[var(--text-tertiary)]">
          No scoresheets yet. Save the current session to build a library you can return to.
        </p>
      ) : (
        <div className="mt-4 grid gap-1.5">
          {scoresheets.map((sheet) => (
            <div
              key={sheet.id}
              className="grid cursor-grab grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2 transition-colors hover:bg-[rgba(255,255,255,0.04)] active:cursor-grabbing"
              draggable={renamingId !== sheet.id}
              onDragStart={(event) => {
                if (renamingId === sheet.id) {
                  event.preventDefault();
                  return;
                }
                event.dataTransfer.setData('application/x-sonicstudio-scoresheet', sheet.id);
                event.dataTransfer.setData('text/plain', sheet.name);
                event.dataTransfer.effectAllowed = 'copy';
              }}
              title="Drag onto a lane to apply this scoresheet's most active melody to that lane."
            >
              <div className="min-w-0">
                {renamingId === sheet.id ? (
                  <input
                    aria-label={`Rename ${sheet.name}`}
                    autoFocus
                    className="control-field h-7 w-full px-2 text-sm"
                    onBlur={() => {
                      renameScoresheet(sheet.id, renameDraft);
                      setRenamingId(null);
                    }}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        renameScoresheet(sheet.id, renameDraft);
                        setRenamingId(null);
                      } else if (event.key === 'Escape') {
                        setRenamingId(null);
                      }
                    }}
                    value={renameDraft}
                  />
                ) : (
                  <button
                    className="block w-full truncate text-left text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent-strong)]"
                    onClick={() => loadScoresheet(sheet.id)}
                    title={`Open ${sheet.name}`}
                    type="button"
                  >
                    {sheet.name}
                  </button>
                )}
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                  <span>Saved {formatRelative(sheet.savedAt)}</span>
                  {sheet.detectedKey && !sheet.detectedKey.uncertain && (
                    <>
                      <span aria-hidden="true" className="text-[var(--border-soft)]">·</span>
                      <span className="text-[var(--accent-strong)]">{sheet.detectedKey.label}</span>
                    </>
                  )}
                </div>
                {(() => {
                  const glance = summarizeScoresheet(sheet);
                  return (
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      <span>{glance.bpm} BPM</span>
                      <span aria-hidden="true" className="text-[var(--border-soft)]">·</span>
                      <span>{glance.trackCount} {glance.trackCount === 1 ? 'lane' : 'lanes'}</span>
                      <span aria-hidden="true" className="text-[var(--border-soft)]">·</span>
                      <span>{glance.noteCount} {glance.noteCount === 1 ? 'note' : 'notes'}</span>
                      <span aria-hidden="true" className="text-[var(--border-soft)]">·</span>
                      <span>{glance.bars} {glance.bars === 1 ? 'bar' : 'bars'}</span>
                    </div>
                  );
                })()}
                {(() => {
                  const thumb = getScoresheetThumbnail(sheet);
                  if (!thumb) return null;
                  return (
                    <div
                      aria-label="Most active lane's pattern thumbnail"
                      className="mt-2 flex h-2 w-full max-w-[180px] items-stretch gap-[1px]"
                      role="img"
                    >
                      {thumb.steps.map((on, index) => (
                        <span
                          key={index}
                          className="flex-1 rounded-[1px]"
                          style={{
                            background: on
                              ? thumb.color
                              : 'rgba(255,255,255,0.06)',
                          }}
                        />
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div className="flex items-center gap-1">
                <button
                  aria-label={previewingId === sheet.id ? `Stop preview of ${sheet.name}` : `Preview ${sheet.name}`}
                  aria-pressed={previewingId === sheet.id}
                  className="ghost-icon-button flex h-7 w-7 items-center justify-center"
                  data-active={previewingId === sheet.id ? 'true' : 'false'}
                  onClick={() => togglePreview(sheet.id, sheet)}
                  title={previewingId === sheet.id ? 'Stop preview' : 'Hear a quick reference loop without loading the session'}
                  type="button"
                >
                  {previewingId === sheet.id
                    ? <Square className="h-3 w-3 fill-current" />
                    : <Play className="h-3 w-3 fill-current" />}
                </button>
                <button
                  aria-label={`Open scoresheet ${sheet.name}`}
                  className="ghost-icon-button flex h-7 w-7 items-center justify-center"
                  onClick={() => loadScoresheet(sheet.id)}
                  title="Open this scoresheet"
                  type="button"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                </button>
                <button
                  aria-label={`Rename ${sheet.name}`}
                  className="ghost-icon-button flex h-7 w-7 items-center justify-center"
                  onClick={() => { setRenamingId(sheet.id); setRenameDraft(sheet.name); }}
                  title="Rename"
                  type="button"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  aria-label={`Delete ${sheet.name}`}
                  className="ghost-icon-button flex h-7 w-7 items-center justify-center text-[var(--danger)]"
                  onClick={() => {
                    if (typeof window === 'undefined' || window.confirm(`Delete "${sheet.name}"? This cannot be undone.`)) {
                      deleteScoresheet(sheet.id);
                    }
                  }}
                  title="Delete"
                  type="button"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
