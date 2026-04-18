import React from 'react';
import { ArrowDown, ArrowUp, Focus, MoreHorizontal, Pin, VolumeX } from 'lucide-react';

import type { Track } from '../../project/schema';

interface ArrangerLaneMenuProps {
  isOpen: boolean;
  onMoveTrack: (trackId: string, direction: 'up' | 'down') => void;
  onSetOpen: (trackId: string | null) => void;
  onToggleMute: (trackId: string) => void;
  onTogglePinnedTrack: (trackId: string) => void;
  onToggleSolo: (trackId: string) => void;
  pinned: boolean;
  track: Track;
}

export const ArrangerLaneMenu = ({
  isOpen,
  onMoveTrack,
  onSetOpen,
  onToggleMute,
  onTogglePinnedTrack,
  onToggleSolo,
  pinned,
  track,
}: ArrangerLaneMenuProps) => (
  <div
    className="relative ml-auto opacity-0 transition-opacity group-hover/lane:opacity-100 group-focus-within/lane:opacity-100"
    data-lane-menu-root="true"
  >
    <LaneStateButton
      active={isOpen}
      label="Lane actions"
      onClick={(event) => {
        event.stopPropagation();
        onSetOpen(isOpen ? null : track.id);
      }}
    >
      <MoreHorizontal className="h-3.5 w-3.5" />
    </LaneStateButton>
    {isOpen && (
      <div className="absolute right-0 top-[calc(100%+0.4rem)] z-30 min-w-[176px] rounded-[10px] border border-[var(--border-soft)] bg-[rgba(9,12,17,0.98)] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
        <LaneMenuAction
          icon={<VolumeX className="h-3.5 w-3.5" />}
          label={track.muted ? 'Unmute lane' : 'Mute lane'}
          onClick={() => {
            onToggleMute(track.id);
            onSetOpen(null);
          }}
        />
        <LaneMenuAction
          icon={<Focus className="h-3.5 w-3.5" />}
          label={track.solo ? 'Release solo' : 'Solo lane'}
          onClick={() => {
            onToggleSolo(track.id);
            onSetOpen(null);
          }}
        />
        <LaneMenuAction
          icon={<Pin className="h-3.5 w-3.5" />}
          label={pinned ? 'Unpin lane' : 'Pin lane'}
          onClick={() => {
            onTogglePinnedTrack(track.id);
            onSetOpen(null);
          }}
        />
        <div className="my-2 h-px bg-[var(--border-soft)]" />
        <LaneMenuAction
          icon={<ArrowUp className="h-3.5 w-3.5" />}
          label="Move up"
          onClick={() => {
            onMoveTrack(track.id, 'up');
            onSetOpen(null);
          }}
        />
        <LaneMenuAction
          icon={<ArrowDown className="h-3.5 w-3.5" />}
          label="Move down"
          onClick={() => {
            onMoveTrack(track.id, 'down');
            onSetOpen(null);
          }}
        />
      </div>
    )}
  </div>
);

const LaneStateButton = ({
  active,
  children,
  label,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) => (
  <button
    aria-label={label}
    className={`ghost-icon-button flex h-8 w-8 items-center justify-center ${active ? 'border-[rgba(124,211,252,0.3)] bg-[rgba(124,211,252,0.1)] text-[var(--accent-strong)]' : ''}`}
    onClick={onClick}
  >
    {children}
  </button>
);

const LaneMenuAction = ({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)]"
    onClick={onClick}
    type="button"
  >
    <span className="text-[var(--text-tertiary)]">{icon}</span>
    <span>{label}</span>
  </button>
);
