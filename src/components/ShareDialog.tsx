import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, Copy, Download, Link2, Share2, X } from 'lucide-react';

import { useAudio } from '../context/AudioContext';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'link' | 'clipboard' | 'file';

const encodeForLink = (text: string): string => {
  if (typeof window === 'undefined') return '';
  try {
    return window.btoa(unescape(encodeURIComponent(text)));
  } catch {
    return '';
  }
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const ShareDialog = ({ open, onClose }: ShareDialogProps) => {
  const { exportSession } = useAudio();
  // Access raw project + UI via the audio context indirectly through exportSession isn't enough.
  // We piggy-back on exportSession for the file flow, and build a payload for the other modes here.
  const audio = useAudio();
  const [tab, setTab] = useState<Tab>('link');
  const [copied, setCopied] = useState<Tab | null>(null);

  const payload = useMemo(() => {
    if (!open) return '';
    try {
      return JSON.stringify({
        project: {
          // We only need the project and ui state pulled from audio context.
          // The full project lives under audio.tracks etc. but we don't have a direct getter, so build minimal info
        },
      });
    } catch {
      return '';
    }
  }, [open]);

  // Build the full session payload manually from the audio context
  const sessionJson = useMemo(() => {
    if (!open) return '';
    try {
      // Build a minimal export that maps to the same shape exportSession uses
      const exportable = {
        project: {
          arrangerClips: audio.arrangerClips,
          tracks: audio.tracks,
          transport: {
            bpm: audio.bpm,
            patternCount: audio.patternCount,
            stepsPerPattern: audio.stepsPerPattern,
            mode: audio.transportMode,
            metronomeEnabled: audio.metronomeEnabled,
            currentPattern: audio.currentPattern,
            countInBars: audio.countInBars,
          },
          markers: audio.songMarkers,
          master: audio.master,
          masterSnapshots: audio.masterSnapshots,
          trackSnapshots: audio.trackSnapshots,
          bounceHistory: audio.bounceHistory,
          metadata: {
            name: audio.projectName,
            id: 'project',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
          },
        },
      };
      return JSON.stringify(exportable, null, 2);
    } catch {
      return '';
    }
  }, [open, audio]);

  const shareLink = useMemo(() => {
    if (!sessionJson || typeof window === 'undefined') return '';
    const encoded = encodeForLink(sessionJson);
    if (!encoded) return '';
    return `${window.location.origin}${window.location.pathname}#share=${encoded}`;
  }, [sessionJson]);

  const payloadBytes = sessionJson ? new Blob([sessionJson]).size : 0;
  const linkLength = shareLink.length;

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!copied) return undefined;
    const id = window.setTimeout(() => setCopied(null), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  if (!open) return null;

  const copyText = async (text: string, source: Tab) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(source);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(source);
      } catch {
        /* ignore */
      }
      document.body.removeChild(textarea);
    }
  };

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(4,7,11,0.72)] p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="surface-panel-strong w-[min(640px,96vw)] max-h-[88vh] overflow-auto p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <Share2 className="h-4 w-4" />
              <span className="section-label text-[var(--accent)]">Share</span>
            </div>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Send this session to anyone.
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
              Three ways to hand off the current state. Everything runs in your browser. Nothing is uploaded.
            </p>
          </div>
          <button
            aria-label="Close share dialog"
            className="ghost-icon-button flex h-9 w-9 items-center justify-center"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="mt-4 flex flex-wrap gap-1.5" aria-label="Share modes">
          <TabButton active={tab === 'link'} onClick={() => setTab('link')}>
            <Link2 className="h-3.5 w-3.5" /> Link
          </TabButton>
          <TabButton active={tab === 'clipboard'} onClick={() => setTab('clipboard')}>
            <Copy className="h-3.5 w-3.5" /> Copy JSON
          </TabButton>
          <TabButton active={tab === 'file'} onClick={() => setTab('file')}>
            <Download className="h-3.5 w-3.5" /> Save file
          </TabButton>
        </nav>

        <div className="mt-4">
          {tab === 'link' && (
            <ModeCard
              title="Self-contained share link"
              description="The whole session is encoded into the URL. Anyone who opens it lands in SonicStudio with this exact state."
              meta={shareLink ? `${(linkLength / 1024).toFixed(1)} KB link` : null}
              footnote="Long-state links can exceed browser address bar limits. If the link looks truncated, fall back to Save file."
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="control-field w-full px-3 py-2 font-mono text-[11px] text-[var(--text-secondary)]"
                  onFocus={(event) => event.target.select()}
                  readOnly
                  value={shareLink || 'Building link...'}
                />
                <button
                  className="control-chip flex items-center justify-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                  data-active={copied === 'link' ? 'true' : undefined}
                  onClick={() => copyText(shareLink, 'link')}
                  type="button"
                >
                  {copied === 'link' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === 'link' ? 'Copied' : 'Copy link'}
                </button>
              </div>
            </ModeCard>
          )}

          {tab === 'clipboard' && (
            <ModeCard
              title="Copy the session JSON"
              description="Drop the JSON into a message, gist, or note. Recipient can open SonicStudio, hit Options → Workspace → Load JSON, and paste a file made from it."
              meta={`${formatBytes(payloadBytes)} payload`}
            >
              <textarea
                className="control-field h-40 w-full resize-y px-3 py-2 font-mono text-[10px] text-[var(--text-secondary)]"
                readOnly
                value={sessionJson}
              />
              <div className="mt-2 flex justify-end">
                <button
                  className="control-chip flex items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                  data-active={copied === 'clipboard' ? 'true' : undefined}
                  onClick={() => copyText(sessionJson, 'clipboard')}
                  type="button"
                >
                  {copied === 'clipboard' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === 'clipboard' ? 'Copied' : 'Copy JSON'}
                </button>
              </div>
            </ModeCard>
          )}

          {tab === 'file' && (
            <ModeCard
              title="Download the session file"
              description="Saves a .sonicstudio.json file you can email, drop in cloud storage, or commit to a project repo. Recipient opens it via Options → Workspace → Load JSON."
              meta={`${formatBytes(payloadBytes)} .sonicstudio.json`}
            >
              <button
                className="control-chip flex w-full items-center justify-center gap-2 px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.14em]"
                data-active
                onClick={() => {
                  exportSession();
                  setCopied('file');
                }}
                type="button"
              >
                {copied === 'file' ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                {copied === 'file' ? 'Download started' : 'Save session file'}
              </button>
            </ModeCard>
          )}
        </div>
      </div>
    </div>
  );
};

const TabButton = ({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) => (
  <button
    className="control-chip flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors"
    data-active={active ? 'true' : undefined}
    onClick={onClick}
    type="button"
  >
    {children}
  </button>
);

const ModeCard = ({
  title,
  description,
  meta,
  footnote,
  children,
}: {
  title: string;
  description: string;
  meta?: string | null;
  footnote?: string;
  children: ReactNode;
}) => (
  <section className="surface-panel-strong p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{description}</p>
      </div>
      {meta && (
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          {meta}
        </span>
      )}
    </div>
    <div className="mt-3">{children}</div>
    {footnote && (
      <p className="mt-3 border-t border-[var(--border-soft)] pt-3 text-[11px] leading-5 text-[var(--text-tertiary)]">
        {footnote}
      </p>
    )}
  </section>
);
