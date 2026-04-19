# SonicStudio Provider, Reducer, Route, And Rack Handoff

This handoff describes the codebase after the provider-thinning pass, the reducer-ownership split, the explicit route-controller pass, and the follow-up split of note, clip-pattern, and rack-source ownership.

## What changed in this pass

### 1. `AudioContext.tsx` is now a thin integration shell

`/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/AudioContext.tsx`

The provider dropped from `2256` lines to `396`.

It now does these jobs:
1. create reducer state
2. keep the engine synced to the current project
3. persist the current session
4. construct transport, session, and render controllers
5. construct dispatch-bound action methods
6. expose the context value

It no longer owns:
1. the reducer action switch
2. reducer helper logic
3. keyboard shortcut logic
4. inline dispatch method wiring

That is the real architectural gain in this pass.

### 2. Reducer ownership is now split into sharper domain modules

New files:
1. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/editorTypes.ts`
2. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/reducer/editorReducer.ts`
3. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/reducer/reducerUtils.ts`
4. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/reducer/uiActions.ts`
5. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/reducer/projectActions.ts`
6. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/reducer/trackActions.ts`
7. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/reducer/arrangerActions.ts`
8. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/reducer/historyActions.ts`

Current ownership model:
1. `uiActions.ts` handles view selection, settings visibility, pinned tracks, selected track, selected clip, and loop-range UI state
2. `projectActions.ts` handles project name, markers, transport settings, snapshots, master state, bounce history, and transport resizing
3. `trackSourceActions.ts` handles track params, source changes, slices, and mix state
4. `trackNoteEventActions.ts` handles note toggle, note detail edits, note movement, and sample-step event ownership
5. `trackNotePatternActions.ts` handles shift, transpose, and clear behavior for whole patterns
6. `trackNoteActions.ts` is now only a thin coordinator across those note ownership zones
7. `trackClipPatternStepActions.ts` handles clip-pattern note toggles and slice assignment
8. `trackClipPatternEventActions.ts` handles clip-pattern note-event updates
9. `trackClipPatternActions.ts` is now only a thin coordinator across those clip-pattern zones
6. `trackAutomationActions.ts` handles automation lane edits
7. `trackTransformActions.ts` handles phrase transforms and pattern-level bulk changes
8. `trackStructureActions.ts` handles track create, duplicate, move, and remove behavior
9. `trackPatternActions.ts` is now only a thin coordinator across those six ownership zones
10. `arrangerActions.ts` handles clip add, remove, update, duplicate, split, loop, make-unique, and song-range duplication
11. `historyActions.ts` handles undo and redo
12. `editorReducer.ts` now composes those handlers instead of holding one giant switch

This is a real seam, not just a file shuffle, because those action domains can now be tested without importing the provider or the audio runtime.

### 3. Launch and deep-link behavior now goes through one explicit route controller

New file:
1. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/app/routeController.ts`

This owns:
1. first-run launchpad decisions
2. query-driven view resolution
3. settings-tab deep links
4. persisted-session versus fresh-session route precedence

Current route behavior:
1. `?launch=1` forces the launch surface
2. `?view=notes`, `?view=song`, and other aliases map into one canonical active view
3. `?setup=workspace|track|output` opens Studio Controls on the requested tab
4. explicit deep links bypass the default first-run launchpad

This matters because route logic was previously split across boot logic and shell state. It now has one source of truth.

### 4. Dispatch-bound action wiring moved out of the provider

New file:
1. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/editorDispatchers.ts`

This file turns reducer dispatch into the public action surface used by the provider.
That means `AudioContext.tsx` no longer handwrites dozens of inline lambdas in the returned context object.

### 5. Keyboard handling moved out of the provider

New file:
1. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/keyboardShortcuts.ts`

This owns:
1. save shortcut
2. undo and redo shortcuts
3. spacebar transport toggle
4. metronome toggle
5. settings close
6. pattern quick-select

This matters because runtime transport-state glue should not live inline in the provider once the rest of the architecture has started decomposing.

### 6. Rack-source ownership is now split further

Updated files:
1. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/components/device-rack/source/DeviceRackSampleCorePanel.tsx`
2. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/components/device-rack/source/DeviceRackEnginePanel.tsx`
3. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/components/device-rack/source/DeviceRackSampleModePanel.tsx`
4. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/components/device-rack/source/DeviceRackCustomSamplePanel.tsx`
5. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/components/device-rack/source/DeviceRackSynthCorePanel.tsx`

`DeviceRackSampleCorePanel.tsx` is now a coordinator instead of a mixed engine, preset, custom import, and synth-source slab.

The source surface now breaks across:
1. engine selection
2. sample mode and trigger behavior
3. custom sample import
4. synth waveform source

That is both a codebase improvement and a real sound-desk readability improvement.

## Tests added in this pass

New tests:
1. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/reducer/editorReducer.test.ts`
2. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/sessionController.test.ts`
3. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/renderController.test.ts`
4. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/transportController.test.ts`
5. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/reducer/reducerUtils.routeEntry.test.ts`

These cover:
1. hydrate-session UI normalization
2. selected-track and pinned-track invariants after track removal
3. selected-clip fallback after clip removal
4. marker ordering after song-tool updates
5. edited note gate and velocity surviving session hydration
6. checkpoint restore into live editor state through the session controller seam
7. JSON import failure behavior through the session controller seam
8. render-scope behavior through the render controller seam
9. bounce-history stem replay through the render controller seam
10. MIDI byte round trips preserving note gate and velocity

Current total:
1. `15` test files
2. `57` passing tests

## Verification completed

Verified in this pass:
1. `npm run lint`
2. `npm test`
3. `npm run build`
4. browser verification on `/SonicStudio/`
5. browser verification on `/SonicStudio/?launch=1`
6. browser verification on `/SonicStudio/?setup=output&view=notes`
7. browser verification after switching the rack engine to `Sample`

Artifacts:
1. `/tmp/sonic-provider-seams-pass.png`
2. `/tmp/sonic-provider-seams-launchpad.png`
3. `/tmp/sonic-route-deeplink-fixed.png`
4. `/tmp/sonic-rack-sample-core-pass.png`

## Current file sizes that matter

1. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/AudioContext.tsx`: thin integration shell
2. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/reducer/trackNotePatternActions.ts`: current note-pattern reducer gravity well
3. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/reducer/trackClipPatternStepActions.ts`: current clip-pattern step reducer gravity well
4. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/components/device-rack/source/DeviceRackSampleSlicesPanel.tsx`: current rack-source gravity well
5. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/components/device-rack/source/DeviceRackSampleWindowPanel.tsx`: current source-window gravity well

This makes the next priority clearer than before.

## What is better now

1. provider logic is thinner and more honest
2. reducer ownership is no longer trapped inside one file
3. controller seams now have controller-level tests
4. reducer behavior now has standalone tests
5. launchpad and studio routes still render correctly after the state-layer refactor

## What is still the main problem

### 1. Note-pattern and clip-pattern step ownership are the new reducer gravity wells

The reducer is no longer concentrated in one file, but note-pattern transforms and clip-pattern step ownership still hold the densest remaining ownership.

That is acceptable for this pass, but it is the next reducer target.

Likely next split:
1. note-pattern bulk editing versus clear and transpose ownership
2. sample-step mapping versus note toggle ownership in clip-pattern steps
3. any shared helpers that still blur those boundaries

### 2. Rack source editing still has two dense authoring surfaces

`/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/components/device-rack/source/DeviceRackSampleSlicesPanel.tsx`
`/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/components/device-rack/source/DeviceRackSampleWindowPanel.tsx`

The rack shell is healthier, and sample-core is no longer the main problem. The densest remaining source ownership is now in slice authoring and source-window editing.

Those now want:
1. slice list rendering versus selected-slice editing
2. slice action helpers for split and region-template behavior
3. source-window strip rendering versus window control actions

### 3. Controller seams still need deeper integration coverage

The new controller tests are useful, but the next layer should cover:
1. provider-facing transport behavior with mocked engine state
2. render replay invariants across more scopes
3. checkpoint restore behavior when live editor selection is stale
4. import and export flows against persisted UI state, not only project state
5. route-driven boot behavior with persisted sessions and explicit deep links together
6. reducer action-map behavior that uses the new note and clip-pattern seams directly

## Recommended next work

### 1. Keep reducing reducer concentration in note and clip-pattern ownership

This is still the sharpest next reducer move.

### 2. Split the remaining rack source gravity wells

Treat it the way the arranger was treated:
1. extract panels by job
2. move logic that can be pure into helpers
3. add targeted tests where state transforms are nontrivial

### 3. Expand transport and route-entry integration coverage

Those seams exist now. The next job is to deepen them, not just claim them.

### 4. Keep the repo truthful

The shipped reviewer chrome is already gone.
Keep it that way.
Avoid any drift back toward demo framing, showcase language, or presentation-only routes.

## Product guidance

SonicStudio is strongest as a browser-native composition studio with:
1. strong arrangement fluency
2. coherent session state
3. reliable workflow exits

The architecture is now closer to supporting that product identity honestly.
The next job is to keep reducing control concentration without scattering responsibility into meaningless wrapper files.
