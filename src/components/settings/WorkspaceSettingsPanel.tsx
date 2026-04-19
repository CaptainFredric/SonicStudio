import React, { useEffect, useRef, useState } from 'react';

import { useAudio, type BounceNormalizationMode, type BounceTailMode } from '../../context/AudioContext';
import { type ExportScope } from '../../services/workflowTypes';
import { type RenderTargetProfileId } from '../../utils/export';
import { WorkspaceBouncePanel } from './WorkspaceBouncePanel';
import { WorkspaceOptionsPanel } from './WorkspaceOptionsPanel';
import { WorkspaceRecoveryPanel } from './WorkspaceRecoveryPanel';
import { WorkspaceSessionPanel } from './WorkspaceSessionPanel';
import { WorkspaceTransportPanel } from './WorkspaceTransportPanel';
import { WorkspaceUtilityPanel } from './WorkspaceUtilityPanel';

const formatSaveLabel = (saveStatus: 'idle' | 'saving' | 'saved' | 'error', lastSavedAt: string | null) => {
  if (saveStatus === 'error') {
    return 'Save failed';
  }

  if (saveStatus === 'saving') {
    return 'Saving…';
  }

  if (!lastSavedAt) {
    return 'Ready';
  }

  return `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

export const WorkspaceSettingsPanel = () => {
  const {
    arrangerClips,
    bpm,
    bounceHistory,
    exportAudioMix,
    exportMidi,
    exportTrackStems,
    exportSession,
    importMidiSession,
    importSession,
    lastSavedAt,
    loadSessionTemplate,
    loopRangeEndBeat,
    loopRangeStartBeat,
    newSession,
    patternCount,
    projectCheckpoints,
    renderState,
    rerunBounceHistory,
    restoreCheckpoint,
    saveProject,
    saveCheckpoint,
    saveStatus,
    selectedArrangerClipId,
    selectedTrackId,
    setSelectedTrackId,
    setBpm,
    setPatternCount,
    setMotionMode,
    setStepsPerPattern,
    setTransportMode,
    setUiSoundsEnabled,
    songLengthInBeats,
    songMarkers,
    stepsPerPattern,
    tracks,
    transportMode,
    motionMode,
    uiSoundsEnabled,
    deleteCheckpoint,
  } = useAudio();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const midiFileInputRef = useRef<HTMLInputElement>(null);
  const [bounceScope, setBounceScope] = useState<ExportScope>(transportMode === 'SONG' ? 'song' : 'pattern');
  const [bounceNormalization, setBounceNormalization] = useState<BounceNormalizationMode>('peak');
  const [bounceTailMode, setBounceTailMode] = useState<BounceTailMode>('standard');
  const [targetProfileId, setTargetProfileId] = useState<RenderTargetProfileId>('streaming');
  const [trackQuery, setTrackQuery] = useState('');
  const hasLoopWindow = loopRangeStartBeat !== null && loopRangeEndBeat !== null;
  const filteredTracks = tracks.filter((track) => {
    const normalizedQuery = trackQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return true;
    }

    return track.name.toLowerCase().includes(normalizedQuery) || track.type.toLowerCase().includes(normalizedQuery);
  }).slice(0, 8);

  useEffect(() => {
    setBounceScope((current) => (
      current === 'clip-window' || (current === 'loop-window' && hasLoopWindow)
        ? current
        : transportMode === 'SONG' ? 'song' : 'pattern'
    ));
  }, [hasLoopWindow, transportMode]);

  return (
    <>
      <input
        ref={fileInputRef}
        accept=".json,.sonicstudio.json,application/json"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }

          await importSession(file);
          event.target.value = '';
        }}
        type="file"
      />
      <input
        ref={midiFileInputRef}
        accept=".mid,.midi,audio/midi,audio/x-midi"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }

          await importMidiSession(file);
          event.target.value = '';
        }}
        type="file"
      />

      <WorkspaceSessionPanel
        arrangerClipCount={arrangerClips.length}
        fileInputRef={fileInputRef}
        importMidiInputRef={midiFileInputRef}
        isRendering={renderState.active}
        lastSavedStatus={renderState.active ? renderState.phase : formatSaveLabel(saveStatus, lastSavedAt)}
        loadSessionTemplate={loadSessionTemplate}
        newSession={newSession}
        onSaveCheckpoint={() => saveCheckpoint()}
        onSaveProject={saveProject}
        trackCount={tracks.length}
      />

      <WorkspaceBouncePanel
        bounceHistory={bounceHistory}
        bounceNormalization={bounceNormalization}
        bounceScope={bounceScope}
        bounceTailMode={bounceTailMode}
        canUseClipWindow={selectedArrangerClipId !== null}
        canUseLoopWindow={hasLoopWindow}
        exportAudioMix={() => void exportAudioMix(bounceScope, {
          normalization: bounceNormalization,
          tailMode: bounceTailMode,
          targetProfileId,
        })}
        exportMidi={() => void exportMidi(bounceScope)}
        exportSession={exportSession}
        exportTrackStems={() => void exportTrackStems(bounceScope, {
          normalization: bounceNormalization,
          tailMode: bounceTailMode,
          targetProfileId,
        })}
        hasLoopWindow={hasLoopWindow}
        onBounceNormalizationChange={setBounceNormalization}
        onBounceScopeChange={setBounceScope}
        onBounceTailModeChange={setBounceTailMode}
        onRepeatPrint={(entryId) => void rerunBounceHistory(entryId)}
        onTargetProfileChange={setTargetProfileId}
        renderMode={renderState.mode}
        renderPhase={renderState.phase}
        renderProgress={renderState.progress}
        renderTrackName={renderState.currentTrackName}
        targetProfileId={targetProfileId}
      />

      <WorkspaceRecoveryPanel
        checkpoints={projectCheckpoints}
        disabled={renderState.active}
        onDeleteCheckpoint={deleteCheckpoint}
        onRestoreCheckpoint={restoreCheckpoint}
      />

      <WorkspaceUtilityPanel
        onQueryChange={setTrackQuery}
        onSelectTrack={setSelectedTrackId}
        query={trackQuery}
        selectedTrackId={selectedTrackId}
        tracks={filteredTracks.map((track) => ({ color: track.color, id: track.id, name: track.name }))}
      />

      <WorkspaceOptionsPanel
        motionMode={motionMode}
        onMotionModeChange={setMotionMode}
        onUiSoundsEnabledChange={setUiSoundsEnabled}
        uiSoundsEnabled={uiSoundsEnabled}
      />

      <WorkspaceTransportPanel
        bpm={bpm}
        onBpmChange={setBpm}
        onPatternCountChange={setPatternCount}
        onStepsPerPatternChange={setStepsPerPattern}
        onTransportModeChange={setTransportMode}
        patternCount={patternCount}
        songLengthInBeats={songLengthInBeats}
        stepsPerPattern={stepsPerPattern}
        transportMode={transportMode}
      />
    </>
  );
};
