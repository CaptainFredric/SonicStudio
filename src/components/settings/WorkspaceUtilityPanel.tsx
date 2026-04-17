import { Search } from 'lucide-react';

interface TrackJumpItem {
  color: string;
  id: string;
  name: string;
}

interface WorkspaceUtilityPanelProps {
  onQueryChange: (value: string) => void;
  onSelectTrack: (trackId: string) => void;
  query: string;
  selectedTrackId: string | null;
  tracks: TrackJumpItem[];
}

export const WorkspaceUtilityPanel = ({
  onQueryChange,
  onSelectTrack,
  query,
  selectedTrackId,
  tracks,
}: WorkspaceUtilityPanelProps) => (
  <section className="surface-panel-strong p-4">
    <div className="flex items-center gap-2 text-[var(--text-primary)]">
      <Search className="h-4 w-4 text-[var(--accent)]" />
      <span className="section-label">Track jump</span>
    </div>
    <input
      aria-label="Track jump"
      className="control-field mt-4 h-11 w-full px-3 text-sm"
      onChange={(event) => onQueryChange(event.target.value)}
      placeholder="Find a track by name or type"
      value={query}
    />
    <div className="mt-3 flex flex-wrap gap-2">
      {tracks.length > 0 ? tracks.map((track) => (
        <button
          className="control-chip flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
          data-active={selectedTrackId === track.id}
          key={track.id}
          onClick={() => onSelectTrack(track.id)}
          type="button"
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: track.color }} />
          {track.name}
        </button>
      )) : (
        <div className="text-[11px] leading-5 text-[var(--text-secondary)]">
          No tracks match the current query.
        </div>
      )}
    </div>
  </section>
);
