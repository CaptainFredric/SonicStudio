# SonicStudio Arranger Refactor Handoff

## Scope of the current arranger state

The arranger is now past the second refactor phase and into the first controller-cleanup pass that followed it.

Phase one split the hero surface into header, inspector, timeline, selectors, and shared types.

Phase two followed through on the critique that said the first split was real progress but not finished.

The next pass after that did two more important things:

1. moved clip duplicate, split, and make-unique mutations into a pure editor helper module
2. added deeper correctness coverage for clip mutation and session-hydration behavior

The phase two goals were:

1. extract volatile drag, trim, wheel, split, and keyboard logic into pure arranger utilities
2. split the inspector further so it does not become the next monolith
3. add interaction oriented arranger tests rather than stopping at selector derivation
4. update the docs so another AI sees the actual current boundary state

## Implemented changes

### 0. Clip mutation logic is no longer trapped inside `AudioContext.tsx`

New file:

1. `src/context/editor/projectMutations.ts`

Moved logic:

1. arranger clip sync
2. track update helper
3. unique clip pattern retargeting
4. duplicate clip mutation
5. split clip mutation
6. make-unique clip mutation

Why this matters:

1. the main controller lost more reducer weight
2. clip mutation logic now has a pure test seam
3. future arranger and reducer refactors no longer have to peel these rules out of a 2700-line controller first

### 1. The arranger is split into real view modules

New files:

1. `src/components/arranger/ArrangerHeader.tsx`
2. `src/components/arranger/ArrangerInspector.tsx`
3. `src/components/arranger/ArrangerTimeline.tsx`
4. `src/components/arranger/types.ts`

Still true:

1. song overview and view controls moved into `ArrangerHeader.tsx`
2. phrase desk, shape controls, marker tools, and section tools moved into `ArrangerInspector.tsx`
3. lane rendering, clip rendering, lane menus, and timeline scrub strip moved into `ArrangerTimeline.tsx`

### 2. Interaction logic is now extracted into pure arranger utilities

New files:

1. `src/components/arranger/interactionUtils.ts`
2. `src/components/arranger/interactionUtils.test.ts`
3. `src/components/arranger/noteUtils.ts`

Extracted behavior:

1. drag preview math
2. drag result diffing
3. rendered clip frame derivation during drag
4. split-beat resolution
5. viewport scroll stepping
6. wheel handling gating
7. arranger keyboard shortcut resolution
8. phrase row and note helper logic for the composer and step editor

What stayed in `src/components/Arranger.tsx` after phase two:

1. local UI state
2. drag state
3. paint state
4. selection wiring
5. high-level coordination between the extracted modules

That means `Arranger.tsx` is now more clearly a coordinator, though it still carries event orchestration and some state coupling.

### 3. Arranger selector logic is pure and tested

New file:

1. `src/components/arranger/arrangerSelectors.ts`

Moved logic:

1. drum-lane detection
2. lane grouping
3. section range derivation from markers and clip overlap
4. lane-data filtering by scope
5. lane-section construction with pinned behavior

Why this matters:

1. the hero surface now depends less on anonymous inline `useMemo` blocks
2. the grouping rules are easier to test
3. future arranger refactors have a stable pure-function layer to build on

### 4. Arranger coverage now includes interaction math

Test files:

1. `src/components/arranger/arrangerSelectors.test.ts`
2. `src/components/arranger/interactionUtils.test.ts`

Covered now:

1. section derivation from markers and clip overlap
2. pinned plus grouped lane-section construction
3. pinned-only scope behavior without duplicating the pinned section
4. drag snapping and clamping
5. trim-start invariants
6. trim-end invariants
7. split-beat fallback behavior
8. keyboard shortcut resolution
9. viewport scroll clamping
10. wheel handling eligibility

This is still not full arranger safety. Duplicate, make-unique, and clip split still need reducer-level or integration-level tests.

That gap is now partially closed by:

1. `src/context/editor/projectMutations.test.ts`
2. `src/project/storage.test.ts`

Covered now:

1. duplicate clip selection and placement invariants
2. split clip length and snap invariants
3. make-unique pattern retargeting and no-op cases
4. session JSON-style hydration round trip
5. invalid UI selection normalization during hydration

### 5. The inspector is no longer one big dumping ground

New files:

1. `src/components/arranger/inspector/SongToolsPanel.tsx`
2. `src/components/arranger/inspector/ShapePanel.tsx`
3. `src/components/arranger/inspector/AutomationPanel.tsx`
4. `src/components/arranger/inspector/ComposePanel.tsx`

Current state:

1. `ArrangerInspector.tsx` is now an orchestrator for tabs and shared props
2. song tools, shape, automation, and compose editing each have their own file
3. compose owns the phrase grid and step editor
4. the risk of a new sub-monolith is reduced, though prop volume is still high

### 6. Docs were updated again to match the real repo

Updated:

1. `README.md`
2. `AI_POST_REFACTOR_REEVALUATION.md`
3. `AI_ARRANGER_REFACTOR_HANDOFF.md`

## Verification completed

Code verification:

1. `npm run lint`
2. `npm test`
3. `npm run build`

Browser verification:

1. preview server launched with `npm run preview -- --host 127.0.0.1 --port 3001`
2. verified route: `http://127.0.0.1:3001/SonicStudio/`
3. page title resolved as `SonicStudio`
4. DOM snapshot showed the extracted arranger shell, phrase desk, timeline controls, and song tools rendered
5. screenshots captured:
   1. `/tmp/sonic-arranger-refactor-full.png`
   2. `/tmp/sonic-arranger-refactor-lower.png`
   3. `/tmp/sonic-arranger-phase-two.png`

## What improved structurally

1. the arranger is easier to read and reason about
2. the lane and section derivation rules are no longer trapped inside the main component
3. drag and trim math no longer live inline in the coordinator
4. keyboard resolution is now a pure function with tests
5. the inspector is split by job instead of growing as one file
6. clip mutation rules are no longer trapped in the application controller
7. the current docs no longer describe an older repo shape

## What is still unresolved

### 1. `src/components/Arranger.tsx` is still too central

It still owns:

1. drag lifecycle state
2. paint coordination
3. selection coupling
4. scroll-follow behavior
5. high-volume prop coordination between modules

That means the hardest math moved out, but the coordinator is still too involved in interaction orchestration.

### 2. `src/context/AudioContext.tsx` is still oversized

The earlier workflow extraction helped, but the main app controller still centralizes too much mutation and reducer wiring.

### 3. `src/components/DeviceRack.tsx` still wants the same treatment

It still reads like a broad control surface that should be broken into:

1. source
2. shape
3. space
4. sample slicing
5. recall and presets

### 4. Test coverage is still narrow for a state-heavy studio

Good next tests:

1. checkpoint restore into live editor state
2. render-scope integration behavior
3. clip selection and song-tool action invariants
4. reducer action-map behavior without importing the full audio runtime

## Recommended next sequence

### 1. Finish the arranger decomposition

Best next extractions:

1. reduce prop volume between `Arranger.tsx`, `ArrangerInspector.tsx`, and `ArrangerTimeline.tsx`
2. split `ComposePanel.tsx` further if it starts growing again
3. keep lane-menu rendering and lane actions from recombining
4. add interaction-level tests around selection plus song-tool workflows

### 2. Split `AudioContext.tsx`

Best boundaries:

1. transport controller
2. reducer action maps
3. track and pattern mutation helpers
4. bounce-history helpers
5. persistence-facing editor helpers

### 3. Split `DeviceRack.tsx`

Best boundaries:

1. source surface
2. shape surface
3. space surface
4. sample slicing surface
5. recall surface

## Bottom line

The arranger is now materially healthier than it was two refactor passes ago.

The next AI should treat this as an interaction-decomposition phase that is partly complete, not done. The highest leverage is still in finishing arranger orchestration cleanup, then attacking `AudioContext.tsx`, then giving `DeviceRack.tsx` the same disciplined treatment.
