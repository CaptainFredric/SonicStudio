# SonicStudio Quick Reference

## Common Commands

### Development
```bash
# Start dev server
npm run dev

# Type check
npm run lint

# Build for production
npm run build

# Run tests
npm run test
```

### Backend
```bash
# Build backend
npm run build:server

# Start backend server
npm run start

# Development with watch mode
npm run dev:server
```

### Database
```bash
# Create migration
npm run migrate:create

# Run migrations
npm run migrate:up

# Revert migrations
npm run migrate:down
```

## Project Structure Quick Guide

| Path | Purpose |
|------|---------|
| `src/components/` | React UI components |
| `src/hooks/` | Custom React hooks |
| `src/utils/export.ts` | Audio export functions |
| `src/utils/api.ts` | API client |
| `src/store/` | Zustand state stores |
| `src/server/` | Backend Express server |
| `dist/` | Production build output |

## Key Files

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite bundler config |
| `tsconfig.json` | TypeScript config |
| `package.json` | Dependencies & scripts |
| `.env.example` | Environment variables template |

## Keyboard Shortcuts (Frontend)

| Shortcut | Action |
|----------|--------|
| `Space` | Play/Pause |
| `Ctrl+S` | Save Project |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Delete` | Delete selected note(s) |
| `D` | Draw mode |
| `S` | Select mode |

## State Variables

### Project Store
```typescript
useProjectStore((state) => ({
  projectName: state.projectName,
  tracks: state.tracks,
  bpm: state.bpm,
}))
```

### Playback Store
```typescript
usePlaybackStore((state) => ({
  isPlaying: state.isPlaying,
  currentTime: state.currentTime,
  duration: state.duration,
}))
```

### UI Store
```typescript
useUIStore((state) => ({
  selectedTrack: state.selectedTrack,
  zoomLevel: state.zoomLevel,
  sidebarOpen: state.sidebarOpen,
}))
```

## API Endpoints Quick Reference

### Save Project
```
POST /api/projects/save
Body: { name, data, tags?, isPublic? }
Response: { id, url, createdAt }
```

### Export Audio
```
POST /api/projects/:id/render
Body: { format, quality? }
Response: { downloadUrl, size, duration }
```

### Track Analytics
```
POST /api/analytics/track
Body: { type, data, timestamp }
```

## Common Debugging

### Audio not playing?
1. Check `useAudioContext()` initialization
2. Verify `audioContext.state === 'running'`
3. Check browser console for Web Audio errors

### Export failing?
1. Ensure file size < `VITE_MAX_PROJECT_SIZE`
2. Check format support in browser
3. Review API error response

### Store not updating?
1. Verify action is dispatched correctly
2. Check component is subscribed to store
3. Use Redux DevTools for state inspection

## Environment Variables

```env
# API URL
VITE_API_URL=http://localhost:3001

# Audio settings
VITE_SAMPLE_RATE=44100
VITE_MAX_TRACKS=16

# File limits
VITE_MAX_PROJECT_SIZE=104857600

# Feature flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_SHARING=true
```

## Type Patterns

### Track Type
```typescript
interface Track {
  id: string;
  name: string;
  instrument: string;
  volume: number; // 0-1
  pan: number; // -1 to 1
  muted: boolean;
  notes: Note[];
  effects: Effect[];
}
```

### Note Type
```typescript
interface Note {
  id: string;
  pitch: number; // MIDI note number
  time: number; // seconds
  duration: number; // seconds
  velocity: number; // 0-1
}
```

### Project Type
```typescript
interface Project {
  id: string;
  name: string;
  bpm: number;
  timeSignature: [number, number];
  tracks: Track[];
  masterBus: MasterBus;
  createdAt: string;
  updatedAt: string;
  duration: number;
}
```

## Performance Budgets

- Initial bundle: < 500KB (gzipped)
- Component render: < 16ms (60fps)
- Audio playback latency: < 20ms
- Export time: < 2s per minute of audio

## Testing Template

```typescript
import { describe, it, expect } from 'vitest';

describe('Feature Name', () => {
  it('should do X when Y', () => {
    // Arrange
    const input = {};
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toBe(expected);
  });
});
```

## Common Errors & Solutions

| Error | Solution |
|-------|----------|
| `Cannot read property 'audioContext'` | Initialize AudioContext first |
| `Export size too large` | Limit project duration or track count |
| `404 API error` | Verify backend server is running |
| `CORS error` | Check backend CORS config |
| `Module not found` | Run `npm install` |

## Git Commands

```bash
# Create new branch
git checkout -b feature/my-feature

# Commit changes
git commit -am "feat: add new feature"

# Push to remote
git push origin feature/my-feature

# Create pull request
gh pr create --title "Feature" --body "Description"
```

## Resources

- **Docs**: See `/docs` folder
- **Changelog**: See `CHANGELOG.md`
- **Architecture**: See `ARCHITECTURE.md`
- **Deployment**: See `DEPLOYMENT.md`
- **Contributing**: See `CONTRIBUTING.md`

## Quick Checklist for New Features

- [ ] Create TypeScript types
- [ ] Write unit tests
- [ ] Add to appropriate component
- [ ] Update Zustand store if needed
- [ ] Add to documentation
- [ ] Create Git commit
- [ ] Submit PR for review

## Performance Monitoring

```bash
# Analyze bundle size
npm run build && npm run analyze

# Check for unused dependencies
npm audit

# Run lighthouse
npm run lighthouse
```

---

**Version**: 0.1.0  
**Last Updated**: 2024
