# SonicStudio Architecture Guide

## System Overview

SonicStudio is a client-server web application for digital audio production. It consists of:

1. **Frontend**: React-based web UI
2. **Backend**: Express.js API server
3. **Audio Engine**: Tone.js for synthesis and audio processing

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser Environment                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    React Application                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐ │   │
│  │  │  Components  │  │    Hooks     │  │ Zustand Store  │ │   │
│  │  │              │  │              │  │                │ │   │
│  │  │ Sequencer    │  │ useProject   │  │ projectStore   │ │   │
│  │  │ Piano        │  │ useAudio     │  │ trackStore     │ │   │
│  │  │ Mixer        │  └──────────────┘  │ uiStore        │ │   │
│  │  │ Effects      │                    └────────────────┘ │   │
│  │  └──────────────┘                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│           │                                  │                   │
│           ▼                                  ▼                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               Web Audio API Context                      │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │              Tone.js Layer                         │  │   │
│  │  │  ┌──────────┐  ┌────────────┐  ┌──────────────┐   │  │   │
│  │  │  │ Synths   │  │ Samplers   │  │ Effects      │   │  │   │
│  │  │  │ Drum Kit │  │ Effects    │  │ Mixer        │   │  │   │
│  │  │  └──────────┘  └────────────┘  └──────────────┘   │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           Audio Output (Speaker/Headphones)             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
           │                          │
           │ HTTP/WebSocket           │ CORS
           ▼                          ▼
┌────────────────────────────────────────────┐
│          Express.js Backend Server         │
│  ┌──────────────────────────────────────┐  │
│  │         API Routes                   │  │
│  │  POST /api/projects/save             │  │
│  │  GET  /api/projects/:id              │  │
│  │  POST /api/projects/:id/render       │  │
│  │  POST /api/projects/:id/share        │  │
│  │  POST /api/analytics/track           │  │
│  └──────────────────────────────────────┘  │
│           │                                │
│           ▼                       ▼        │
│  ┌──────────────────┐  ┌─────────────────┐│
│  │  File System     │  │  Database       ││
│  │  Storage         │  │  (PostgreSQL/   ││
│  │  (projects/)     │  │   MongoDB)      ││
│  └──────────────────┘  └─────────────────┘│
└────────────────────────────────────────────┘
```

## Data Flow

### 1. Project Creation
```
User Input → State Update → Save to LocalStorage → Upload to Backend → Database
```

### 2. Audio Playback
```
Project State → Schedule Notes → Tone.js → Web Audio → Output
```

### 3. Export Process
```
Project Data → Audio Rendering → Format Encoding → File Download
```

## Component Structure

### Core Components

```
App.tsx
├── Header
│   ├── ProjectName
│   ├── BPM Controller
│   └── Controls (Play, Stop, Record)
├── Main Content
│   ├── Sequencer
│   │   ├── Track List
│   │   │   └── TrackRow (multiple)
│   │   │       ├── TrackHeader
│   │   │       └── PianoRoll
│   │   └── TimelineRuler
│   ├── Piano Roll
│   │   ├── Notes Grid
│   │   └── Note Editor
│   └── Mixer
│       ├── MasterChannel
│       ├── TrackChannels (multiple)
│       └── EffectsRack
└── Right Sidebar
    ├── InstrumentSelector
    ├── EffectsPanel
    └── ProjectSettings
```

## State Management (Zustand)

### Project Store
```typescript
{
  projectId: string
  projectName: string
  tracks: Track[]
  masterBus: MasterBus
  projectSettings: ProjectSettings
}
```

### Playback Store
```typescript
{
  isPlaying: boolean
  currentTime: number
  bpm: number
  timeSignature: TimeSignature
}
```

### UI Store
```typescript
{
  selectedTrack: string | null
  selectedNote: string | null
  zoomLevel: number
  viewMode: 'piano' | 'drum' | 'list'
}
```

## Audio Processing Pipeline

```
Input (MIDI / Automation)
    ↓
Note Scheduler (Schedule at precise time)
    ↓
Instrument (Synth / Sampler)
    ↓
Track Effects (EQ, Compression, etc.)
    ↓
Mixer (Pan, Volume)
    ↓
Master Effects (Reverb, Delay, Limiter)
    ↓
Compressor (Prevent clipping)
    ↓
Audio Output
```

## API Contract

### REST Endpoints

#### Projects
```
POST /api/projects/save
  Request: { name, data, tags?, isPublic? }
  Response: { id, url, createdAt }

GET /api/projects/:id
  Response: ProjectData

GET /api/projects?limit=20&offset=0
  Response: [ { id, name, createdAt, url } ]

POST /api/projects/:id/share
  Request: { expiresInDays? }
  Response: { shareLink, token, expiresAt }

POST /api/projects/:id/render
  Request: { format, quality? }
  Response: { downloadUrl, size, duration }
```

#### Analytics
```
POST /api/analytics/track
  Request: { type, data, timestamp }
  Response: { recorded: true }
```

## Export Format Support

### Audio Formats
- **MIDI**: Compatibility with all DAWs
- **WAV**: Full fidelity, configurable bit depth
- **MP3**: Compressed, streaming-friendly
- **FLAC**: Lossless compression
- **OGG**: Open-source format

### Metadata Formats
- **JSON**: Complete project data

## Performance Considerations

### Frontend Optimization
- Code splitting with route-based lazy loading
- Virtualized lists for large note sequences
- Memoized components to prevent unnecessary re-renders
- Web Workers for heavy computations

### Backend Optimization
- Connection pooling for database
- Caching layer for frequently accessed projects
- Background job queue for rendering and exports
- Gzip compression for API responses

### Audio Engine
- Efficient scheduling to minimize garbage collection
- Tone.js abstracts Web Audio complexity
- Sample rate matching to reduce interpolation
- Polyphony limits to prevent resource exhaustion

## Security Considerations

1. **Authentication**: JWT tokens for API access
2. **Authorization**: Role-based access control (RBAC)
3. **Input Validation**: Zod schemas for all API inputs
4. **CORS**: Configured for specific origins
5. **Rate Limiting**: Per-user API rate limits
6. **File Size Limits**: Max project and export sizes
7. **HTTPS**: All production connections encrypted

## Scalability Strategies

### Horizontal Scaling
- Load balancer for API servers
- Stateless backend design
- Separate render/export microservice

### Vertical Scaling
- Database indexing for faster queries
- Redis caching layer
- CDN for static assets

### Database Optimization
- Partitioning large project collections
- Archival strategy for old projects
- Read replicas for analytics

## Future Architecture Considerations

1. **WebSocket Support**: Real-time collaboration
2. **Service Workers**: Offline functionality
3. **Audio Workers**: Dedicated threads for audio processing
4. **Plugin System**: Third-party synths and effects
5. **Cloud Storage**: S3-compatible storage for renders
6. **Message Queue**: Redis/RabbitMQ for async tasks

## Technology Stack

### Frontend
- **Framework**: React 19
- **Audio**: Tone.js 15
- **State**: Zustand
- **Styling**: Tailwind CSS
- **Bundler**: Vite
- **Type Safety**: TypeScript 5.8

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL or MongoDB
- **Cache**: Redis
- **Process Manager**: PM2

### Infrastructure
- **Hosting**: Vercel/Netlify (Frontend), AWS/DigitalOcean (Backend)
- **CDN**: CloudFlare or AWS CloudFront
- **Monitoring**: Sentry, New Relic
- **CI/CD**: GitHub Actions

## Module Dependencies

```
src/
├── components/
│   └── Dependencies: React, Tone.js, Zustand
├── hooks/
│   └── Dependencies: Web Audio API, Context
├── utils/
│   ├── export.ts → Audio codecs
│   ├── midi.ts → MIDI parsing/generation
│   └── audio.ts → Tone.js wrappers
├── store/
│   └── Dependencies: Zustand
└── server/
    └── Dependencies: Express, Database drivers
```

## Debugging Guide

### Common Issues

1. **Audio not playing**: Check Web Audio API context state
2. **Export failures**: Verify file system permissions and codec support
3. **State sync**: Ensure Zustand actions are dispatched correctly
4. **Performance drops**: Profile with DevTools, check for memory leaks

### Tools
- Chrome DevTools for frontend debugging
- WaveForm for audio visualization
- Postman for API testing
- Advanced Profiler for performance analysis
