# SonicStudio Current Reevaluation

## Purpose

This is the current technical and product reevaluation of SonicStudio after the arranger second-phase decomposition pass, the first controller-cleanup pass that followed it, and the provider-controller split after that.

The first critique pass removed reviewer-facing studio chrome and created the first real service boundaries.

This pass followed through on the clearest next layer of the critique:

1. break down the arranger hero surface
2. move volatile interaction math out of the arranger coordinator
3. split the inspector by job before it hardened into a new monolith
4. add interaction-oriented correctness coverage
5. update the docs so the codebase description matches the actual structure
6. move clip mutation rules into a pure editor helper module
7. add deeper clip-mutation and session-hydration coverage
8. move provider-level transport, render, and session orchestration into editor controller modules
9. remove stale demo identity residue and make the launch surface the real first-view route

The goal of this document is to give another AI or engineer a clean, current, technically grounded picture of what SonicStudio is now.

## Short product description

SonicStudio is a browser-native music creation studio built around one canonical session model. It combines:

1. pattern sequencing
2. clip-based song arrangement
3. piano-roll note editing
4. hybrid synth and sample tracks
5. MIDI import and export
6. offline mix and stem rendering
7. bounce analysis
8. local checkpoints and persistence

The product is trying to be a credible lightweight browser studio for a solo creator, not a guided showcase artifact.

## What improved in this pass

### 1. The arranger is no longer one giant render tree or one giant interaction blob

The biggest structural change in this pass is the arranger split.

New files:

1. `src/components/arranger/ArrangerHeader.tsx`
2. `src/components/arranger/ArrangerInspector.tsx`
3. `src/components/arranger/ArrangerTimeline.tsx`
4. `src/components/arranger/arrangerSelectors.ts`
5. `src/components/arranger/types.ts`
6. `src/components/arranger/interactionUtils.ts`
7. `src/components/arranger/noteUtils.ts`
8. `src/components/arranger/inspector/SongToolsPanel.tsx`
9. `src/components/arranger/inspector/ShapePanel.tsx`
10. `src/components/arranger/inspector/AutomationPanel.tsx`
11. `src/components/arranger/inspector/ComposePanel.tsx`
12. `src/context/editor/projectMutations.ts`
13. `src/context/editor/transportController.ts`
14. `src/context/editor/renderController.ts`
15. `src/context/editor/sessionController.ts`

`src/components/Arranger.tsx` still owns coordination, local state, drag state, and selection wiring, but it no longer directly owns the full hero render tree or the volatile drag and keyboard math.
`src/context/AudioContext.tsx` also no longer owns the concrete clip duplicate, split, and make-unique implementations.
It also no longer owns the provider-level export, import, checkpoint, preview, and playback orchestration that used to sit inline near the bottom of the file.

The current arranger structure is now shaped around actual product responsibilities:

1. header and song overview
2. phrase desk and song tools
3. timeline and lane rendering
4. pure selectors for lane and section derivation
5. pure utilities for drag, trim, split, scroll, and shortcut resolution
6. dedicated inspector panels for compose, shape, automation, and sections

This matters because the arranger is the hero surface. Complexity there hurts both the product and the codebase more than a comparable issue in a secondary panel.

### 2. Arranger derivation and interaction logic now have a correctness layer

The critique was correct that a state-heavy music tool needs more correctness coverage around pure state shaping.

That is now improved through:

1. `src/components/arranger/arrangerSelectors.test.ts`
2. `src/components/arranger/interactionUtils.test.ts`

Current coverage added:

1. section-range derivation from markers and clip overlap
2. pinned and grouped lane-section derivation
3. pinned-scope behavior without duplicate pinned sections
4. drag snapping behavior
5. trim minimum-length invariants
6. split fallback behavior
7. shortcut resolution
8. viewport-scroll clamping
9. wheel handling gating

This is still only a start, but it moves arranger refactoring away from pure faith and into testable interaction rules.

That coverage is now complemented by:

1. `src/context/editor/projectMutations.test.ts`
2. `src/project/storage.test.ts`

Current extra coverage:

1. duplicate clip selection and placement invariants
2. split clip snap and minimum-length invariants
3. make-unique success and no-op behavior
4. serialized session hydration round trip
5. invalid UI-selection normalization during hydration

### 3. Provider-level orchestration is split into controller seams

New files:

1. `src/context/editor/transportController.ts`
2. `src/context/editor/renderController.ts`
3. `src/context/editor/sessionController.ts`

Current responsibilities moved out of `AudioContext.tsx`:

1. playback and recording control
2. track preview control
3. transport reset behavior used by session hydration
4. mix, stem, and MIDI export orchestration
5. bounce-history rerun orchestration
6. session export, import, restore, checkpoint, and template-load orchestration

This is a real architecture win because the provider now describes dependencies more clearly instead of carrying every operational routine inline.

### 4. The inspector is structurally healthier

The critique that warned against `ArrangerInspector.tsx` becoming the next dumping ground was correct.

That risk is now reduced because:

1. compose and step editing moved into `ComposePanel.tsx`
2. automation moved into `AutomationPanel.tsx`
3. shape controls moved into `ShapePanel.tsx`
4. section and marker tooling moved into `SongToolsPanel.tsx`
5. `ArrangerInspector.tsx` is now mostly tab selection and shared prop routing

It still has high prop volume, so this is healthier, not finished.

### 5. Identity residue and first-view behavior are cleaner

Updated:

1. `package.json`
2. `metadata.json`
3. `src/App.tsx`
4. `src/project/schema.ts`
5. `src/index.css`
6. `src/components/Launchpad.tsx`

Concrete cleanup:

1. `createDemoProject` was renamed to `createNightTransitProject`
2. `hasAppliedDemoParams` was removed
3. `.showcase-gradient-panel` was renamed to `.launchpad-panel`
4. product descriptions no longer describe SonicStudio as a groovebox or sketchpad
5. the launch surface now replaces the studio on first load instead of stacking over it

### 6. Docs now match the current structure better

`README.md` was updated so the repo no longer describes SonicStudio like an older submission build.

It now calls out:

1. current architecture boundaries
2. current verification path
3. the actual next refactor targets

This reduces stale truth around the repo and makes the project easier to hand off.

## What remains genuinely improved from the earlier pass

These improvements are still in place and still matter:

1. reviewer-facing studio chrome was removed from the shipped app
2. `SubmissionGuide` is gone
3. readiness-style internal metrics are gone
4. `AudioContext.tsx` no longer owns all render and session workflow orchestration
5. service boundaries now exist for render and session workflows
6. `SettingsSidebar.tsx` is a shallow shell
7. setup open state is no longer restored on boot
8. the repo now has a growing test harness
9. workspace settings are split into clearer panels
10. clip mutation rules now live behind a pure editor helper seam
11. provider-level transport, render, and session logic now live behind editor controller modules
12. track reducer ownership is now split into source, note, clip-pattern, automation, transform, and structure modules
13. note-editing persistence and MIDI round trips now have direct test coverage
14. launch and deep-link behavior now goes through an explicit route controller
15. transport-controller runtime behavior now has direct tests
16. sample-core rack ownership is split into engine, sample mode, custom import, and synth-source panels

## Current file-boundary state

### Better than before

1. `src/components/SettingsSidebar.tsx` is small and focused
2. `src/components/settings/WorkspaceSettingsPanel.tsx` is smaller and delegates further
3. render behavior is separated in `src/services/renderWorkflow.ts`
4. session and checkpoint behavior is separated in `src/services/sessionWorkflow.ts`
5. arranger rendering is separated into header, inspector, and timeline modules
6. arranger selector logic is separated into pure functions with tests
7. arranger interaction rules are separated into pure functions with tests
8. arranger inspector panels are separated by job
9. clip mutation rules are separated into `src/context/editor/projectMutations.ts`
10. provider-level orchestration is separated into transport, render, and session controller modules
11. route entry is separated into `src/app/routeController.ts`
12. sample-core rack rendering is separated into focused source panels

### Still too large

1. `src/context/AudioContext.tsx`
2. `src/components/Arranger.tsx`
3. `src/components/DeviceRack.tsx`

`Arranger.tsx` is smaller and much healthier now, but it still owns too much coordination and local state to be considered finished.

## Current product assessment

### Stronger now

The product shell is cleaner and more disciplined than it was before:

1. fewer reviewer-era assumptions
2. less repo-level showcase framing
3. more honest product terminology
4. better separation inside the control surface
5. a much cleaner hero-surface file boundary story

### Still weak

The architectural center of gravity is still too concentrated:

1. `AudioContext.tsx` still does too much
2. `Arranger.tsx` still centralizes too much coordination and event orchestration
3. `DeviceRack.tsx` still holds too many concerns in one file
4. correctness coverage is still modest relative to product complexity
5. reducer behavior is still concentrated in `src/context/editor/reducer/trackNotePatternActions.ts` and `src/context/editor/reducer/trackClipPatternStepActions.ts`
6. route and first-run entry control are explicit, but still need coverage against more persisted-session combinations

## What improved after the route-controller and pattern-ownership pass

### 1. Route entry is now explicit instead of scattered

New file:

1. `src/app/routeController.ts`

This now owns:

1. first-run launch behavior
2. deep-link view aliases
3. settings-tab route targeting
4. precedence between persisted sessions and explicit query routes

The important behavioral improvement is that query-driven entry now follows one path:

1. `?launch=1` forces the launch surface
2. `?view=notes` or `?view=song` deep-links into the requested studio view
3. `?setup=output` opens Studio Controls on Output
4. explicit deep links bypass the default first-run launchpad

That fixes a real boot inconsistency instead of just moving code.

### 2. Pattern reducer ownership is now split by job

New files:

1. `src/context/editor/reducer/trackNoteActions.ts`
2. `src/context/editor/reducer/trackClipPatternActions.ts`
3. `src/context/editor/reducer/trackAutomationActions.ts`
4. `src/context/editor/reducer/trackTransformActions.ts`
5. `src/context/editor/reducer/trackNoteEventActions.ts`
6. `src/context/editor/reducer/trackNotePatternActions.ts`
7. `src/context/editor/reducer/trackClipPatternStepActions.ts`
8. `src/context/editor/reducer/trackClipPatternEventActions.ts`

`src/context/editor/reducer/trackPatternActions.ts` is now only a thin coordinator, and the note and clip-pattern coordinators are thin too.

This matters because note editing, phrase identity, automation, and transforms are now testable and discussable as separate ownership zones. The reducer is still concentrated, but it is more honest now.

### 3. Controller-level integration coverage is more real

Additional test coverage now includes:

1. render-scope replay using stored loop-window history
2. checkpoint restore with stale live selection and stale checkpoint selection
3. explicit route resolution for launch, settings, and view deep links
4. transport-controller count-in, record-start, and preview behavior
5. persisted-session route entry through `createInitialEditorState`

Current total:

1. `15` test files
2. `57` passing tests

### 4. Rack-source ownership is more honest

`src/components/device-rack/source/DeviceRackSampleCorePanel.tsx` is now a coordinator instead of a mixed engine, preset, import, and waveform slab.

New source panels:

1. `src/components/device-rack/source/DeviceRackEnginePanel.tsx`
2. `src/components/device-rack/source/DeviceRackSampleModePanel.tsx`
3. `src/components/device-rack/source/DeviceRackCustomSamplePanel.tsx`
4. `src/components/device-rack/source/DeviceRackSynthCorePanel.tsx`

That lowers local complexity and makes the rack easier to read in the live UI. The remaining dense source surfaces are now slice authoring and source-window editing.

## Current verdict

These numbers are intentionally blunt:

1. as a browser-native music product: `8.2/10`
2. as a serious lightweight DAW today: `6.7/10`
3. as a GarageBand replacement today: `4.7/10`
4. as a codebase moving in the right direction: `8.8/10`

The increase is real, but still bounded by the same core issues:

1. oversized central files
2. limited correctness coverage
3. still too much interaction density in major surfaces

## What another AI should keep

Keep:

1. shared canonical session model
2. arranger-centered workflow
3. clip-to-pattern relationship
4. hybrid synth and sample lane model
5. offline rendering
6. MIDI import and export
7. checkpoints and persistence
8. cleaner non-reviewer shell
9. extracted render and session workflow boundaries
10. finer-grained workspace control sections
11. the test harness
12. the arranger header, inspector, and timeline split
13. pure arranger selector functions with tests
14. pure clip mutation helpers with tests
15. the launch surface as a clean first-view route instead of a stacked showcase layer

## What another AI should cut or demote further

Cut or demote:

1. any remaining explanatory copy that narrates the tool instead of helping use it
2. any route or UI behavior that still assumes the app needs to stage itself like a presentation
3. any control-surface wording that implies a separate mini application instead of one studio

## What another AI should refactor next

### 1. Split `AudioContext.tsx` further

Best next boundaries:

1. transport controller
2. reducer action maps
3. track and pattern mutation helpers
4. bounce history helpers
5. persistence-facing editor helpers

### 2. Attack `DeviceRack.tsx`

Best next split:

1. source surface
2. shape surface
3. space surface
4. sample slicing surface
5. recall and preset surface

### 3. Finish the arranger split

The current arranger split is useful, but not complete.

Best next decomposition:

1. reduce prop-volume between the coordinator and the submodules
2. keep `ComposePanel.tsx` from growing back into a local monolith
3. extract any remaining selection-coupling helpers that still belong in a pure seam
4. add interaction-level tests around selection plus song-tool behavior

### 4. Keep the product identity honest

1. keep the launch surface as a real entry route
2. keep naming aligned with a browser-native composition studio
3. keep removing any residue that describes an older showcase-era product

## What another AI should test next

1. reducer action-map tests
2. MIDI import into session shape
3. checkpoint restore into live editor state
4. render scope handling at integration level
5. selection and song-tool invariants
6. clip drag and trim invariant behavior

## Bottom line

SonicStudio is cleaner, more credible, and more internally disciplined than it was before this arranger pass.

The product-smell problem is now substantially improved.
The architecture problem is still only partially improved.

The next phase should stay focused on:

1. deeper decomposition
2. correctness coverage
3. reducing oversized central files
4. keeping the arranger first-class without hiding logic in a new monolith

That is where the real leverage is now.
