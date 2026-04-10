# SonicStudio Developer Guide

## Code Style & Conventions

### TypeScript

#### File Structure
```typescript
// 1. Imports
import { useState, useCallback } from 'react';
import { useProject } from '@hooks/useProject';
import { API } from '@utils/api';

// 2. Types & Interfaces
interface ComponentProps {
  trackId: string;
  isSelected: boolean;
}

// 3. Component Definition
export const TrackRow: React.FC<ComponentProps> = ({ trackId, isSelected }) => {
  // Component implementation
};

// 4. Exports
export default TrackRow;
```

#### Naming Conventions
- Components: PascalCase (`TrackRow.tsx`)
- Utilities: camelCase (`formatTime.ts`)
- Constants: UPPER_SNAKE_CASE (`MAX_TRACKS`)
- Types/Interfaces: PascalCase with prefix (`ITrack`, `TrackState`)
- Hooks: camelCase with `use` prefix (`useProject`, `useAudio`)

### React Components

#### Functional Components
```typescript
interface Props {
  title: string;
  onClick: () => void;
}

export const Button: React.FC<Props> = ({ title, onClick }) => {
  return (
    <button onClick={onClick}>
      {title}
    </button>
  );
};
```

#### Hooks for Complex Logic
```typescript
export const useTrackAudio = (trackId: string) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);

  const play = useCallback(() => {
    setIsPlaying(true);
    // Audio logic here
  }, [trackId]);

  return { isPlaying, volume, play };
};
```

### Error Handling

```typescript
import { Result, Ok, Err } from '@utils/result';

async function saveProject(data: ProjectData): Promise<Result<string, Error>> {
  try {
    const response = await API.post('/projects/save', data);
    return Ok(response.id);
  } catch (error) {
    return Err(new Error('Failed to save project'));
  }
}

// Usage
const result = await saveProject(myProject);
if (result.ok) {
  console.log('Project saved:', result.value);
} else {
  console.error('Error:', result.error);
}
```

### State Management (Zustand)

```typescript
import create from 'zustand';

interface ProjectStore {
  projectName: string;
  tracks: Track[];
  updateProjectName: (name: string) => void;
  addTrack: (track: Track) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projectName: 'Untitled Project',
  tracks: [],
  updateProjectName: (name) => set({ projectName: name }),
  addTrack: (track) => set((state) => ({
    tracks: [...state.tracks, track],
  })),
}));
```

## File Organization

```
src/
├── components/           # Reusable React components
│   ├── common/          # Generic UI components (Button, Modal, etc.)
│   ├── layout/          # Layout components (Sidebar, Header, etc.)
│   └── features/        # Feature-specific components
│
├── hooks/               # Custom React hooks
│   ├── useProject.ts
│   ├── useAudio.ts
│   └── useAnimation.ts
│
├── utils/               # Utility functions
│   ├── api.ts           # API client
│   ├── audio.ts         # Audio utilities
│   ├── export.ts        # Export functions
│   └── formatters.ts    # Data formatting
│
├── types/               # TypeScript type definitions
│   └── index.ts
│
├── store/               # Zustand stores
│   ├── projectStore.ts
│   ├── playbackStore.ts
│   └── uiStore.ts
│
├── styles/              # Global styles and themes
│   ├── index.css
│   ├── variables.css
│   └── utilities.css
│
├── context/             # React Context providers
│   └── AudioContext.tsx
│
└── App.tsx              # Main app component
```

## Testing Guidelines

### Unit Tests
```typescript
// trackUtils.test.ts
import { describe, it, expect } from 'vitest';
import { formatTrackName } from './trackUtils';

describe('formatTrackName', () => {
  it('should format track name with number', () => {
    expect(formatTrackName('Synth', 1)).toBe('Synth 1');
  });

  it('should handle special characters', () => {
    expect(formatTrackName('My-Track', 1)).toBe('My-Track 1');
  });
});
```

### Component Tests
```typescript
// TrackRow.test.tsx
import { render, screen } from '@testing-library/react';
import { TrackRow } from './TrackRow';

describe('TrackRow', () => {
  it('should render track name', () => {
    render(<TrackRow trackId="1" name="Kick Drum" />);
    expect(screen.getByText('Kick Drum')).toBeInTheDocument();
  });
});
```

## Performance Tips

### Memoization
```typescript
import { memo, useMemo, useCallback } from 'react';

// Memoize component to prevent unnecessary re-renders
export const NoteGrid = memo(({ trackId, notes }) => {
  return (
    <div>
      {notes.map(note => (
        <Note key={note.id} data={note} />
      ))}
    </div>
  );
});

// Memoize expensive computations
const sortedNotes = useMemo(
  () => notes.sort((a, b) => a.time - b.time),
  [notes]
);

// Memoize callbacks
const handleNoteClick = useCallback((noteId) => {
  // Handle click
}, [trackId]); // Re-create only if trackId changes
```

### Virtualization for Large Lists
```typescript
import { FixedSizeList as List } from 'react-window';

<List
  height={600}
  itemCount={tracks.length}
  itemSize={35}
  width="100%"
>
  {({ index, style }) => (
    <TrackRow style={style} track={tracks[index]} />
  )}
</List>
```

## API Integration

### Request/Response Pattern
```typescript
// api/client.ts
import axios from 'axios';
import type { ProjectData } from '@types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Types
interface SaveProjectRequest {
  name: string;
  data: ProjectData;
  tags?: string[];
  isPublic?: boolean;
}

interface SaveProjectResponse {
  id: string;
  url: string;
  createdAt: string;
}

// Endpoints
export const projectAPI = {
  save: (data: SaveProjectRequest) =>
    apiClient.post<SaveProjectResponse>('/projects/save', data),

  load: (id: string) =>
    apiClient.get<ProjectData>(`/projects/${id}`),

  list: (limit = 20, offset = 0) =>
    apiClient.get(`/projects?limit=${limit}&offset=${offset}`),
};
```

## Git Workflow

### Branch Naming
- Feature: `feature/add-export-midi`
- Bug fix: `bugfix/audio-context-not-initializing`
- Release: `release/v0.2.0`
- Hotfix: `hotfix/critical-playback-bug`

### Commit Messages
```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

Examples:
```
feat(export): add FLAC export support

- Implement FLAC encoder
- Add quality presets
- Update UI for format selection

Closes #123
```

## Common Patterns

### Debouncing
```typescript
import { useCallback, useRef } from 'react';

export const useDebounce = <T extends any[]>(
  callback: (...args: T) => void,
  delay: number
) => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    (...args: T) => {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => callback(...args), delay);
    },
    [callback, delay]
  );
};

// Usage
const debouncedSave = useDebounce((projectData) => {
  saveProject(projectData);
}, 1000);
```

### Async State Management
```typescript
interface AsyncState<T> {
  status: 'idle' | 'pending' | 'success' | 'error';
  data?: T;
  error?: Error;
}

export const useAsync = <T,>(
  asyncFunction: () => Promise<T>,
  immediate = true
) => {
  const [state, setState] = useState<AsyncState<T>>({
    status: 'idle',
  });

  const execute = useCallback(async () => {
    setState({ status: 'pending' });
    try {
      const response = await asyncFunction();
      setState({ status: 'success', data: response });
    } catch (error) {
      setState({ status: 'error', error: error as Error });
    }
  }, [asyncFunction]);

  useEffect(() => {
    if (immediate) execute();
  }, [execute, immediate]);

  return { ...state, execute };
};
```

## Debugging

### Console Logging Levels
```typescript
// Development
if (import.meta.env.DEV) {
  console.log('[DEV]', message);
}

// Production warnings
console.warn('[WARNING]', message);

// Errors always log
console.error('[ERROR]', message);
```

### Performance Profiling
```typescript
// Measure component render time
import { useEffect, useRef } from 'react';

const startTime = performance.now();

useEffect(() => {
  const endTime = performance.now();
  console.log(`Component rendered in ${endTime - startTime}ms`);
}, []);
```

## Code Review Checklist

- [ ] Types are properly defined (no `any`)
- [ ] Error handling is present
- [ ] Component is memoized if necessary
- [ ] No console.log in production code
- [ ] Tests are included for new features
- [ ] Commit message is clear and descriptive
- [ ] No unused imports or variables
- [ ] Performance impact considered
- [ ] Accessibility considered (a11y)
- [ ] Documentation updated

## Resources

- [React Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Tone.js Documentation](https://tonejs.org/docs)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Zustand Documentation](https://github.com/pmndrs/zustand)

## IDE Setup

### VS Code Extensions
- ESLint
- Prettier
- TypeScript Vue Plugin
- Thunder Client (API testing)
- Web Audio API IntelliSense

### VS Code Settings (`.vscode/settings.json`)
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

---

**Last Updated**: 2024
**Maintained By**: SonicStudio Team
