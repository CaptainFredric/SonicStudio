# SonicStudio

SonicStudio is a browser-native groovebox and music sketchpad built with React and Tone.js. The current app focuses on fast loop creation, live sound shaping, and lightweight project workflow foundations.

## Current Features

- Step sequencer with per-track pattern editing
- Piano roll editor for melodic tracks
- Mixer with level metering, mute, solo, volume, and pan
- Device rack with envelope, filter, drive, delay, and reverb controls
- Dynamic track creation, duplication, and deletion
- Local session autosave and manual save
- Undo and redo for project edits
- Keyboard shortcuts for play, save, undo, redo, and pattern selection
- Audio export from the master output

## Run Locally

Prerequisite: Node.js 20+

1. Install dependencies with `npm install`
2. Start the development server with `npm run dev`
3. Open the local URL shown by Vite

## Keyboard Shortcuts

- `Space`: Play or pause
- `Cmd/Ctrl+S`: Save session
- `Cmd/Ctrl+Z`: Undo
- `Shift+Cmd/Ctrl+Z` or `Cmd/Ctrl+Y`: Redo
- `1` through `8`: Switch patterns

## Project Direction

This repository is being evolved from a focused web groovebox into a more durable music production tool. The current foundation work prioritizes:

- Serializable project state
- Local persistence
- History-based editing
- Dynamic track architecture
- Cleaner product metadata and build surface
