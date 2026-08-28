import { useEffect, useRef, useState } from 'react';
import { AudioWaveform, ChevronDown, Coffee, Maximize2, Menu, Settings, Share2, Sparkles, Volume2, X } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useDialogFocus } from '../hooks/useDialogFocus';

const SUPPORT_URL = 'https://buymeacoffee.com/captainarm1';

interface MobileStudioNavigationProps {
  onEnterEditingMode: () => void;
  onOpenLaunchpad: () => void;
  onOpenRecord: () => void;
  onOpenShare: () => void;
  onOpenTranscribe: () => void;
}

const SequencerIcon = () => (
  <span className="studio-icon-shell">
    <svg aria-hidden="true" className="h-5 w-5 studio-seq-icon" viewBox="0 0 20 20">
      <circle className="studio-seq-head-fill" cx="5.25" cy="14.25" r="2.5" />
      <circle className="studio-seq-head-fill" cx="13.25" cy="12.25" r="2.5" />
      <path className="studio-seq-outline" d="M7.5 14.25V5.5L15.5 3.75V12.25" />
      <circle className="studio-seq-outline" cx="5.25" cy="14.25" r="2.5" />
      <circle className="studio-seq-outline" cx="13.25" cy="12.25" r="2.5" />
    </svg>
  </span>
);

const CaptureIcon = () => (
  <span className="studio-icon-shell text-[var(--danger)]">
    <svg aria-hidden="true" className="h-5 w-5 studio-mic-icon" viewBox="0 0 20 20">
      <rect className="studio-mic-capsule-fill" height="10" rx="3" width="6" x="7" y="2.5" />
      <rect className="studio-mic-outline" height="10" rx="3" width="6" x="7" y="2.5" />
      <path className="studio-mic-outline" d="M5.5 8.5a4.5 4.5 0 0 0 9 0" />
      <line className="studio-mic-outline" x1="10" x2="10" y1="13.5" y2="16.8" />
      <line className="studio-mic-outline" x1="7.4" x2="12.6" y1="16.8" y2="16.8" />
    </svg>
  </span>
);

export const MobileStudioNavigation = ({
  onEnterEditingMode,
  onOpenLaunchpad,
  onOpenRecord,
  onOpenShare,
  onOpenTranscribe,
}: MobileStudioNavigationProps) => {
  const { activeView, isSettingsOpen, setActiveView, toggleSettings } = useAudio();
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLElement>(null);
  useDialogFocus(actionsOpen, actionsRef, { trap: true });

  useEffect(() => {
    if (!actionsOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActionsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [actionsOpen]);

  const runAndClose = (action: () => void) => {
    setActionsOpen(false);
    action();
  };
  const primaryClass = 'mobile-studio-nav-button';

  return (
    <>
      {actionsOpen ? <button aria-hidden="true" className="mobile-command-backdrop md:hidden" onClick={() => setActionsOpen(false)} tabIndex={-1} type="button" /> : null}
      {actionsOpen ? (
        <section aria-label="More studio actions" aria-modal="true" className="mobile-command-sheet md:hidden" id="mobile-studio-actions" ref={actionsRef} role="dialog" tabIndex={-1}>
          <div className="flex items-start justify-between gap-3 border-b border-[var(--border-soft)] px-4 py-3">
            <div><div className="section-label">Studio actions</div><p className="mt-1 text-[11px] text-[var(--text-secondary)]">Bring material in, configure the studio, or focus the canvas.</p></div>
            <button aria-label="Close studio actions" className="ghost-icon-button flex h-9 w-9 items-center justify-center" onClick={() => setActionsOpen(false)} type="button"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            <button className="mobile-command-action" data-tour-target="sessions" onClick={() => runAndClose(onOpenLaunchpad)} type="button"><Sparkles className="h-4 w-4" /><span>Library</span></button>
            <button className="mobile-command-action" onClick={() => runAndClose(onOpenTranscribe)} type="button"><AudioWaveform className="h-4 w-4" /><span>Transcribe</span></button>
            <button className="mobile-command-action" data-active={isSettingsOpen} data-tour-target="options" onClick={() => runAndClose(toggleSettings)} type="button"><Settings className="h-4 w-4" /><span>Options</span></button>
            <button className="mobile-command-action" onClick={() => runAndClose(() => { setActiveView('SEQUENCER'); onEnterEditingMode(); })} type="button"><Maximize2 className="h-4 w-4" /><span>Focus editor</span></button>
            <a className="mobile-command-action col-span-2" href={SUPPORT_URL} rel="noreferrer noopener" target="_blank"><Coffee className="h-4 w-4" /><span>Support SonicStudio</span></a>
          </div>
        </section>
      ) : null}

      <nav aria-label="Mobile studio navigation" className="mobile-studio-dock md:hidden" data-tour-target="views">
        <button aria-label="Create" className={primaryClass} data-active={activeView === 'SEQUENCER'} onClick={() => setActiveView('SEQUENCER')} type="button"><SequencerIcon /><span>Create</span></button>
        <button aria-label="Mixer" className={primaryClass} data-active={activeView === 'MIXER'} onClick={() => setActiveView('MIXER')} type="button"><Volume2 className="h-5 w-5" /><span>Mix</span></button>
        <button aria-label="Capture sound" className={`${primaryClass} mobile-studio-capture`} data-tour-target="record" onClick={onOpenRecord} type="button"><CaptureIcon /><span>Capture</span></button>
        <button aria-label="Share this session" className={primaryClass} data-tour-target="share" onClick={onOpenShare} type="button"><Share2 className="h-5 w-5" /><span>Share</span></button>
        <button aria-controls="mobile-studio-actions" aria-expanded={actionsOpen} aria-label="More studio actions" className={primaryClass} onClick={() => setActionsOpen((current) => !current)} type="button">{actionsOpen ? <ChevronDown className="h-5 w-5" /> : <Menu className="h-5 w-5" />}<span>More</span></button>
      </nav>
    </>
  );
};
