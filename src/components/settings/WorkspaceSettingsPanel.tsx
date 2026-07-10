import React, { useEffect, useRef, useState } from 'react';

import { useAudio, type BounceNormalizationMode, type BounceTailMode } from '../../context/AudioContext';
import { type ExportScope } from '../../services/workflowTypes';
import { type RenderTargetProfileId } from '../../utils/export';
import { getEffectiveKey } from '../../services/keyDetector';
import { inKeyPitchClasses, pitchClassFromNote } from '../../utils/pitch';
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

type WorkspaceSection = 'PROJECT' | 'CREATE' | 'EXPORT' | 'STUDIO';

const WORKSPACE_SECTIONS: Array<{ id: WorkspaceSection; label: string; description: string }> = [
  { id: 'PROJECT', label: 'Project', description: 'Save, restore, and move around the current session.' },
  { id: 'CREATE', label: 'Create', description: 'Get suggestions and work with captured note material.' },
  { id: 'EXPORT', label: 'Export', description: 'Bounce audio, stems, MIDI, and portable session files.' },
  { id: 'STUDIO', label: 'Studio', description: 'Configure transport, capture behavior, and interface guidance.' },
];

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
    setSharedReverb,
    setTransportMode,
    setUiSoundsEnabled,
    stickyMobileTransport,
    audioStabilityMode,
    sharedReverb,
    songLengthInBeats,
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
  const [workspaceSection, setWorkspaceSection] = useState<WorkspaceSection>('PROJECT');
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

      <div className="surface-panel-strong mb-4 p-3">
        <div className="section-label">Workspace task</div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WORKSPACE_SECTIONS.map((section) => (
            <button
              className="control-chip min-h-10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
              data-active={workspaceSection === section.id}
              key={section.id}
              onClick={() => setWorkspaceSection(section.id)}
              type="button"
            >
              {section.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-5 text-[var(--text-secondary)]">
          {WORKSPACE_SECTIONS.find((section) => section.id === workspaceSection)?.description}
        </p>
      </div>

      {workspaceSection === 'PROJECT' ? <><WorkspaceSessionPanel
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
      /></> : null}

      {workspaceSection === 'CREATE' ? <><WorkspaceSuggestionsPanel
        fullTracks={tracks}
        previewTrackByType={(fallbackType, note, velocity) => {
          const targetType = tracks.find((track) => track.id === selectedTrackId)?.type ?? fallbackType;
          return auditionInstrumentNote(targetType, note, velocity);
        }}
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
            return;
          }
          if (action.kind === 'trim-drift') {
            const key = getEffectiveKey(tracks);
            if (key.uncertain) return;
            const inKeyPcs = inKeyPitchClasses(key.root, key.mode);
            tracks.forEach((track) => {
              if (['kick', 'snare', 'hihat'].includes(track.type)) return;
              const original = track.patterns[action.patternIndex] ?? [];
              const filtered = original.map((step) => step.filter((event) => {
                const pc = pitchClassFromNote(event.note);
                return pc !== null && inKeyPcs.has(pc);
              }));
              const changed = filtered.some((step, index) => step.length !== (original[index]?.length ?? 0));
              if (changed) {
                applyPatternSegment(track.id, action.patternIndex, filtered);
              }
            });
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
      /></> : null}

      {workspaceSection === 'EXPORT' ? <WorkspaceBouncePanel
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
      /> : null}

      {workspaceSection === 'STUDIO' ? <><WorkspaceOptionsPanel
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
        onSharedReverbChange={setSharedReverb}
        onUiSoundsEnabledChange={setUiSoundsEnabled}
        onExportTrainingCorpus={exportTrainingCorpus}
        trainingCorpusSummary={trainingCorpusSummary}
        stickyMobileTransport={stickyMobileTransport}
        audioStabilityMode={audioStabilityMode}
        sharedReverb={sharedReverb}
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
      /></> : null}
    </>
  );
};
