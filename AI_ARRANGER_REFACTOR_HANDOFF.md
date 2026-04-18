# SonicStudio Arranger Refactor Handoff

## Scope of this pass

This pass followed the critique target that named `Arranger.tsx` as the clearest next refactor boundary.

The goal was not new product framing or more shell polish.

The goal was:

1. split the arranger hero surface into real modules
2. move arranger derivation into pure functions
3. add correctness coverage for the extracted arranger logic
4. update the docs so another AI sees the current structure

## Implemented changes

### 1. The arranger is split into view modules

New files:

1. `src/components/arranger/ArrangerHeader.tsx`
2. `src/components/arranger/ArrangerInspector.tsx`
3. `src/components/arranger/ArrangerTimeline.tsx`
4. `src/components/arranger/types.ts`

What moved:

1. song overview and view controls moved into `ArrangerHeader.tsx`
2. phrase desk, shape controls, marker tools, and section tools moved into `ArrangerInspector.tsx`
3. lane rendering, clip rendering, lane menus, and timeline scrub strip moved into `ArrangerTimeline.tsx`

What stayed in `src/components/Arranger.tsx`:

1. local UI state
2. drag state
3. paint state
4. keyboard shortcut wiring
5. selection wiring
6. timeline scroll logic
7. high-level coordination between the extracted modules

That means `Arranger.tsx` is still a coordinator-heavy file, but it is no longer one giant inline render tree.

### 2. Arranger selector logic is now pure and testable

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

### 3. Arranger selector coverage was added

New test file:

1. `src/components/arranger/arrangerSelectors.test.ts`

Covered now:

1. section derivation from markers and clip overlap
2. pinned plus grouped lane-section construction
3. pinned-only scope behavior without duplicating the pinned section

This is still not broad enough for full arranger safety, but it is the first meaningful arranger-specific correctness layer.

### 4. Docs were updated to match the real repo

Updated:

1. `README.md`
2. `AI_POST_REFACTOR_REEVALUATION.md`

Added:

1. `AI_ARRANGER_REFACTOR_HANDOFF.md`

These updates now describe:

1. the current service boundaries
2. the arranger split
3. the current test harness
4. the next actual refactor targets

## Verification completed

Code verification:

1. `npm run lint`
2. `npm test`
3. `npm run build`

Browser verification:

1. preview server launched with `npm run preview -- --host 127.0.0.1 --port 3001`
2. verified route: `http://127.0.0.1:3001/SonicStudio/`
3. page title resolved as `SonicStudio`
4. DOM snapshot showed the extracted arranger shell, phrase desk, and timeline controls rendered
5. screenshots captured:
   1. `/tmp/sonic-arranger-refactor-full.png`
   2. `/tmp/sonic-arranger-refactor-lower.png`

## What improved structurally

1. the arranger is easier to read and reason about
2. the lane and section derivation rules are no longer trapped inside the main component
3. the current docs no longer describe an older repo shape
4. there is now at least one arranger-specific test layer

## What is still unresolved

### 1. `src/components/Arranger.tsx` is still too central

It still owns:

1. drag math
2. trim math
3. keyboard shortcuts
4. paint coordination
5. selection coupling
6. timeline scroll behavior

That means the file is healthier, but not finished.

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

1. clip duplicate
2. clip split
3. clip make-unique
4. checkpoint restore into live editor state
5. JSON import-export round trip
6. render-scope integration behavior
7. arranger keyboard shortcuts
8. clip drag and trim invariants

## Recommended next sequence

### 1. Finish the arranger decomposition

Best next extractions:

1. drag and trim helpers
2. keyboard shortcut controller
3. phrase-composer editor logic
4. lane-menu action wiring

### 2. Split `AudioContext.tsx`

Best boundaries:

1. transport controller
2. arranger mutation helpers
3. track and pattern mutation helpers
4. reducer action maps
5. bounce-history helpers

### 3. Split `DeviceRack.tsx`

Best boundaries:

1. source surface
2. shape surface
3. space surface
4. sample slicing surface
5. recall surface

## Bottom line

This pass delivered real structural value.

The arranger is still coordinated by one main file, but the product no longer depends on a single giant inline arranger render tree. The next AI should continue decomposition and correctness work, not backslide into framing or cosmetic churn.
