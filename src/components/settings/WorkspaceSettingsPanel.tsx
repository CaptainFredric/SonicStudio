import React, { useEffect, useRef, useState } from 'react';

import { useAudio, type BounceNormalizationMode, type BounceTailMode } from '../../context/AudioContext';
import { type ExportScope } from '../../services/workflowTypes';
import { type RenderTargetProfileId } from '../../utils/export';
import { saveCapturedNoteStringFromTokens } from '../../services/noteStringLibrary';
import { useQueuedNoteStringId } from '../../services/noteStringQueue';
import { WorkspaceBouncePanel } from './WorkspaceBouncePanel';
import { WorkspaceCapturePanel } from './WorkspaceCapturePanel';
import { WorkspaceSuggestionsPanel } from './WorkspaceSuggestionsPanel';
import { WorkspaceOptionsPanel } from './WorkspaceOptionsPanel';
import { WorkspaceRecoveryPanel } from './WorkspaceRecoveryPanel';
import { WorkspaceSessionPanel } from './WorkspaceSessionPanel';
import { WorkspaceTransportPanel } from './WorkspaceTransportPanel';
import { WorkspaceUtilityPanel } from './WorkspaceUtilityPanel';
import { resetOnboardingStatus } from '../../services/onboardingState';
import { resetUiReminders } from '../../services/uiReminders';

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
    applyPatternSegment,
    applyTrackVoicePreset,
    arrangerClips,
    auditionInstrumentNote,
    bpm,
    bounceHistory,
    capturePreferences,
    currentPattern,
    exportAudioMix,
    previewTrack,
    exportMidi,
    exportTrackStems,
    exportSession,
    exportTrainingCorpus,
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
    setCaptureAnalysisProfile,
    setCaptureAutoPreviewMatch,
    setCaptureKeepShelfBetweenTakes,
    setCaptureLiveSuggestionCount,
    setMotionMode,
    resetStudioPreferences,
    setSuperSonicMode,
    setSuperSonicGuidanceBadges,
    setSuperSonicWaveIntensity,
    setStepsPerPattern,
    setStickyMobileTransport,
    setAudioStabilityMode,
    setTransportMode,
    setUiSoundsEnabled,
    stickyMobileTransport,
    audioStabilityMode,
    songLengthInBeats,
    songMarkers,
    stepsPerPattern,
    toggleStep,
    trainingCorpusSummary,
    tracks,
    transportMode,
    motionMode,
    superSonicMode,
    superSonicPreferences,
    uiSoundsEnabled,
    deleteCheckpoint,
  } = useAudio();

  const [queuedNoteStringId, setQueuedNoteStringId] = useQueuedNoteStringId();
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
        auditionInstrumentNote={auditionInstrumentNote}
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

      <WorkspaceSuggestionsPanel
        fullTracks={tracks}
        onApplyAction={(action) => {
          if (action.kind === 'place-steps') {
            for (const step of action.steps) {
              toggleStep(action.trackId, step.stepIndex, step.note);
            }
            setSelectedTrackId(action.trackId);
            return;
          }
          if (action.kind === 'apply-preset') {
            applyTrackVoicePreset(action.trackId, action.presetId);
            setSelectedTrackId(action.trackId);
            return;
          }
          if (action.kind === 'save-and-queue-string') {
            const updated = saveCapturedNoteStringFromTokens({
              name: action.name,
              tokens: action.tokens,
              source: 'typed',
            });
            if (updated && updated[0]) {
              setQueuedNoteStringId(updated[0].id);
            }
          }
        }}
        onSelectTrack={setSelectedTrackId}
      />

      <WorkspaceCapturePanel
        applyPatternSegment={applyPatternSegment}
        currentPattern={currentPattern}
        disabled={renderState.active}
        fullTracks={tracks}
        onQueueNoteString={setQueuedNoteStringId}
        previewTrack={previewTrack}
        queuedNoteStringId={queuedNoteStringId}
        selectedTrackId={selectedTrackId}
        setSelectedTrackId={setSelectedTrackId}
        tracks={tracks.map((track) => ({ id: track.id, name: track.name, type: track.type }))}
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
        captureAnalysisProfile={capturePreferences.analysisProfile}
        captureAutoPreviewMatch={capturePreferences.autoPreviewMatch}
        captureKeepShelfBetweenTakes={capturePreferences.keepShelfBetweenTakes}
        captureLiveSuggestionCount={capturePreferences.liveSuggestionCount}
        motionMode={motionMode}
        onCaptureAnalysisProfileChange={setCaptureAnalysisProfile}
        onCaptureAutoPreviewMatchChange={setCaptureAutoPreviewMatch}
        onCaptureKeepShelfBetweenTakesChange={setCaptureKeepShelfBetweenTakes}
        onCaptureLiveSuggestionCountChange={setCaptureLiveSuggestionCount}
        onMotionModeChange={setMotionMode}
        onResetGuidance={() => {
          resetOnboardingStatus();
          resetUiReminders();
        }}
        onResetStudioPreferences={resetStudioPreferences}
        onSuperSonicModeChange={setSuperSonicMode}
        onSuperSonicGuidanceBadgesChange={setSuperSonicGuidanceBadges}
        onSuperSonicWaveIntensityChange={setSuperSonicWaveIntensity}
        onStickyMobileTransportChange={setStickyMobileTransport}
        onAudioStabilityModeChange={setAudioStabilityMode}
        onUiSoundsEnabledChange={setUiSoundsEnabled}
        onExportTrainingCorpus={exportTrainingCorpus}
        trainingCorpusSummary={trainingCorpusSummary}
        stickyMobileTransport={stickyMobileTransport}
        audioStabilityMode={audioStabilityMode}
        superSonicGuidanceBadges={superSonicPreferences.guidanceBadges}
        superSonicMode={superSonicMode}
        superSonicWaveIntensity={superSonicPreferences.waveIntensity}
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
