# SonicStudio Provider And Reducer Handoff

This handoff describes the codebase after the provider-thinning and reducer-ownership pass that followed the earlier controller-seam work.

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

### 2. Reducer ownership is now split into domain modules

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
4. `trackPatternActions.ts` handles note editing, pattern transforms, clip pattern edits, and automation edits
5. `trackStructureActions.ts` handles track create, duplicate, move, and remove behavior
6. `arrangerActions.ts` handles clip add, remove, update, duplicate, split, loop, make-unique, and song-range duplication
7. `historyActions.ts` handles undo and redo
8. `editorReducer.ts` now composes those handlers instead of holding one giant switch

This is a real seam, not just a file shuffle, because those action domains can now be tested without importing the provider or the audio runtime.

### 3. Dispatch-bound action wiring moved out of the provider

New file:
1. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/editorDispatchers.ts`

This file turns reducer dispatch into the public action surface used by the provider.
That means `AudioContext.tsx` no longer handwrites dozens of inline lambdas in the returned context object.

### 4. Keyboard handling moved out of the provider

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

## Tests added in this pass

New tests:
1. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/reducer/editorReducer.test.ts`
2. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/sessionController.test.ts`
3. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/renderController.test.ts`

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
1. `12` test files
2. `45` passing tests

## Verification completed

Verified in this pass:
1. `npm run lint`
2. `npm test`
3. `npm run build`
4. browser verification on `/SonicStudio/`
5. browser verification on `/SonicStudio/?launch=1`

Artifacts:
1. `/tmp/sonic-provider-seams-pass.png`
2. `/tmp/sonic-provider-seams-launchpad.png`

## Current file sizes that matter

1. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/AudioContext.tsx`: thin integration shell
2. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/context/editor/reducer/trackPatternActions.ts`: current reducer gravity well
3. `/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/components/device-rack/source/DeviceRackSampleCorePanel.tsx`: current rack-source gravity well

This makes the next priority clearer than before.

## What is better now

1. provider logic is thinner and more honest
2. reducer ownership is no longer trapped inside one file
3. controller seams now have controller-level tests
4. reducer behavior now has standalone tests
5. launchpad and studio routes still render correctly after the state-layer refactor

## What is still the main problem

### 1. `trackPatternActions.ts` is the new reducer gravity well

The reducer is no longer concentrated in one file, but `trackPatternActions.ts` is now the biggest remaining note-editing slab.

That is acceptable for this pass, but it is the next reducer target.

Likely next split:
1. note toggle and note-event editing
2. clip-pattern editing
3. automation editing
4. transform helpers that are still mixed into the same switch

### 2. Rack source editing still belongs to the older generation of the repo

`/Users/erendiracisneros/Documents/New project/repos/SonicStudio/src/components/device-rack/source/DeviceRackSampleCorePanel.tsx`

The outer rack shell is healthier now, but sample-core editing is still a dense mixed-responsibility surface.

It still wants a split into:
1. selected-track summary
2. sample import and source-window control
3. slice authoring
4. pitched response and voice-start control
5. recall and shared primitives

### 3. Controller seams still need deeper integration coverage

The new controller tests are useful, but the next layer should cover:
1. provider-facing transport behavior with mocked engine state
2. render replay invariants across more scopes
3. checkpoint restore behavior when live editor selection is stale
4. import and export flows against persisted UI state, not only project state

## Recommended next work

### 1. Split `trackPatternActions.ts`

This is the sharpest next reducer move.

### 2. Split the remaining rack source gravity well

Treat it the way the arranger was treated:
1. extract panels by job
2. move logic that can be pure into helpers
3. add targeted tests where state transforms are nontrivial

### 3. Add transport-controller tests

That is the controller seam with the most runtime sensitivity still left mostly untested.

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
