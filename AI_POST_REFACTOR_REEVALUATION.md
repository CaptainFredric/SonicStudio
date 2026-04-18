# SonicStudio Current Reevaluation

## Purpose

This is the current technical and product reevaluation of SonicStudio after the arranger decomposition pass that followed the second critique cleanup.

The first critique pass removed reviewer-facing studio chrome and created the first real service boundaries.

This pass followed through on the clearest next layer of the critique:

1. break down the arranger hero surface
2. add correctness coverage around extracted arranger selectors
3. update the docs so the codebase description matches the actual structure

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

### 1. The arranger is no longer one giant render tree

The biggest structural change in this pass is the arranger split.

New files:

1. `src/components/arranger/ArrangerHeader.tsx`
2. `src/components/arranger/ArrangerInspector.tsx`
3. `src/components/arranger/ArrangerTimeline.tsx`
4. `src/components/arranger/arrangerSelectors.ts`
5. `src/components/arranger/types.ts`

`src/components/Arranger.tsx` still owns coordination, local state, drag state, and keyboard wiring, but it no longer directly renders the entire hero surface inline.

The split is now shaped around actual product responsibilities:

1. header and song overview
2. phrase desk and song tools
3. timeline and lane rendering
4. pure selectors for lane and section derivation

This matters because the arranger is the hero surface. Complexity there hurts both the product and the codebase more than a comparable issue in a secondary panel.

### 2. Arranger derivation now has its own correctness layer

The critique was correct that a state-heavy music tool needs more correctness coverage around pure state shaping.

That is now improved through:

1. `src/components/arranger/arrangerSelectors.test.ts`

Current coverage added:

1. section-range derivation from markers and clip overlap
2. pinned and grouped lane-section derivation
3. pinned-scope behavior without duplicate pinned sections

This is still only a start, but it moves arranger refactoring away from pure faith.

### 3. Docs now match the current structure better

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

## Current file-boundary state

### Better than before

1. `src/components/SettingsSidebar.tsx` is small and focused
2. `src/components/settings/WorkspaceSettingsPanel.tsx` is smaller and delegates further
3. render behavior is separated in `src/services/renderWorkflow.ts`
4. session and checkpoint behavior is separated in `src/services/sessionWorkflow.ts`
5. arranger rendering is separated into header, inspector, and timeline modules
6. arranger selector logic is separated into pure functions with tests

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
2. `Arranger.tsx` still centralizes too much coordination and event handling
3. `DeviceRack.tsx` still holds too many concerns in one file
4. correctness coverage is still modest relative to product complexity

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

## What another AI should cut or demote further

Cut or demote:

1. any remaining explanatory copy that narrates the tool instead of helping use it
2. any route or UI behavior that still assumes the app needs to stage itself like a presentation
3. any control-surface wording that implies a separate mini application instead of one studio

## What another AI should refactor next

### 1. Split `AudioContext.tsx` further

Best next boundaries:

1. transport controller
2. arranger mutation helpers
3. track and pattern mutation helpers
4. bounce history helpers
5. reducer action maps

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

1. extract drag and trim helpers out of `Arranger.tsx`
2. extract keyboard shortcut handling out of `Arranger.tsx`
3. move phrase-composer editing logic into a focused arranger editor module
4. isolate lane-menu action wiring from lane rendering

## What another AI should test next

1. reducer tests
2. clip duplication tests
3. make unique tests
4. split clip tests
5. JSON import-export round trip
6. MIDI import into session shape
7. checkpoint restore into live editor state
8. render scope handling at integration level
9. arranger keyboard shortcut behavior
10. clip drag and trim invariant behavior

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
