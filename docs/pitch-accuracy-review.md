# Pitch accuracy review

## Scope and results

168 deterministic acoustic stress cases cover seven signal profiles, eight pitches (E1 through A6), and 22.05, 44.1, and 48 kHz input. Profiles include vibrato, breath noise, bowed and plucked harmonics, flute, and weak fundamentals. Each case requires at least 90% of transcribed note duration at the exact expected MIDI pitch. All pass after the changes. This metric does not measure omitted voiced time, onset accuracy, or real performer accuracy.

Recorded checks use 17 sustained clips from one singer in the [Human Voice Dataset](https://github.com/vocobox/human-voice-dataset), pinned to commit 77248fc69fd93c40a69d49c0cade4144c5d7a9f4, plus University of Iowa [flute](https://theremin.music.uiowa.edu/MISflute.html), [violin](https://theremin.music.uiowa.edu/MISviolin.html), and [piano](https://theremin.music.uiowa.edu/MISpiano.html) recordings. Recordings are fetched for evaluation and are excluded from the shipped application.

The dominant vocal pitch matches 13 of 17 filename labels. Four labels differ by an octave. Independent waveform correlation checks on A3, B3, and A4 favor the lower detected pitch: A3 has correlation 0.992 at 110 Hz versus negative correlation at 220 Hz; B3 favors 123.47 Hz over 246.94 Hz; A4 favors 220 Hz over 440 Hz. These label disagreements must not be presented as a measured vocal accuracy score. Short extra notes remain around some attacks and releases. The dataset contains one singer and does not establish coverage of diverse voices.

The quiet flute scale produces every chromatic pitch from B3 through B4. The quiet violin recording previously jumped to A4 and A#4; those octave jumps disappear, leaving G3, G#3, A3, and A#3. Its filename includes B3, but that pitch was not resolved, so this is not a perfect scale transcription. The quiet C4 piano recording resolves to C4. A B0 piano recording fails: it is below the configured 35 Hz floor and produces harmonics instead. Very low piano, chords, and full mixes remain limitations.

## Changes

The transcriber range now leaves room below bass E1 and above vibrato at A6. Its rumble filter sits below that lower boundary. Live metering and Capture support the lower range too.

YIN cumulative normalization includes all preceding lags. A strong second harmonic can be rejected in favor of a substantially better doubled period, comparing interpolated minima to avoid rounding artifacts. Opening octave errors are corrected only when four following frames agree on a stable pitch. Existing tests preserve sustained octave leaps.

## Reproduction

Run `npx vitest run src/services/transcriptionAccuracy.test.ts` for the generated cases. Start the local development server on port 3000 and run `node scripts/check-recorded-pitch.mjs` for the vocal clips. Optional WAV paths are evaluated after the vocals.

The Iowa files used are `Flute.vib.pp.B3B4.aiff`, `Violin.arco.pp.sulG.G3B3.aiff`, `Piano.pp.C4.aiff`, and the limitation probe `Piano.pp.B0.aiff`. Download them from the linked source pages and convert locally with macOS `afconvert -f WAVE -d LEI16 input.aiff output.wav` before passing the WAV paths. These are diagnostic checks against source labels, not frame annotated benchmark measurements.
