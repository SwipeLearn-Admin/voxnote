# VoxNote

**Voice-to-structured-notes desktop application with AI enrichment.**

Speak naturally, get structured notes. VoxNote is a context-aware voice assistant that transforms your spoken thoughts into meeting notes, tasks, emails, reminders, and more.

## Problem

Knowledge workers spend significant time converting spoken information into structured documents. Whether it's meeting notes, task lists, or email drafts - the manual process is time-consuming and error-prone.

**VoxNote solves this** by providing an always-ready voice assistant that:
- Understands context and asks clarifying questions when needed
- Auto-detects the best output format (meeting, tasks, email, reminder, etc.)
- Proposes actionable follow-ups (create project folders, add calendar events)
- Works offline-first with optional cloud sync

## Quick Start

```bash
# Install dependencies
npm install

# Create .env.local with your OpenAI API key
echo "OPENAI_API_KEY=sk-your-key" > .env.local

# Run in development
npm run dev

# Build for distribution (creates DMG/installer)
npm run dist
```

> **Note:** The API key is configured via environment variable, not in-app settings. This is by design for security (48h challenge constraint).

## User Flow

VoxNote works like a ChatGPT-style popup:

```
1. Activate     ->  Press Cmd+Shift+Space (global hotkey)
2. Record       ->  Hold Space to speak (push-to-talk)
3. Transcribe   ->  Release Space - speech is transcribed
4. Choose       ->  Click a format chip or type instruction
5. Get Result   ->  Structured markdown appears
6. Use          ->  Copy (Enter) or Copy+Close (Cmd+Enter)
```

## Architecture

```
+---------------------+     IPC      +------------------------+
|   Electron Main     | <----------> |   Renderer (Next.js)   |
|   (Node.js)         |              |   (React + Zustand)    |
|                     |              |                        |
|  - Global Hotkey    |              |  - ChatThread          |
|  - OpenAI API       |              |  - Composer            |
|  - History (JSONL)  |              |  - SuggestedActions    |
|  - Settings Store   |              |  - HistoryDrawer       |
|  - Window Mgmt      |              |  - SettingsModal       |
|  - Supabase Client  |              |  - AuthButton          |
+---------------------+              +------------------------+
          |
          v
   +-------------+       +-------------+
   | OpenAI API  |       | Supabase    |
   | Whisper/GPT |       | Auth + DB   |
   +-------------+       +-------------+
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+Space` | Toggle overlay (global) |
| `Space` (hold) | Push-to-talk recording |
| `Escape` | Cancel operation / Close overlay |
| `Enter` | Copy result to clipboard |
| `Cmd+Enter` | Copy result + close overlay |
| `H` | Toggle history drawer |
| `S` | Open settings |
| `R` | Rerun enrichment (after result) |

## Output Formats

| Format | Description |
|--------|-------------|
| Meeting-Notiz | Summary, decisions, action items, open questions |
| Aufgaben | Checkbox task list with owners and dates |
| E-Mail | Professional email draft |
| Ticket | Jira-style with title, description, acceptance criteria |
| Dev Note | What changed, why, how to verify |
| Bereinigen | Clean transcript without filler words |
| Erinnerung | Time-based reminder with parsed date/time |

### Context-Aware Bot

VoxNote features an intelligent intent router that understands context:

**Greetings & Help:**
- "Hi" / "Hallo" → Bot introduces itself and offers help
- "Was kannst du?" → Explains all capabilities

**Auto-Detection:**
- "Meeting mit Anna morgen um 10 über das Projekt" → Creates meeting note immediately
- "Erinner mich an Zahnarzt um 15 Uhr" → Creates reminder with parsed time

**Clarifying Questions:**
- "Meeting morgen" → Asks "Um welche Uhrzeit ist das Meeting?"
- "Email an Max" → Asks "Worum geht es in der E-Mail?"
- User answers → Bot combines context and creates artifact

**Multi-Turn Memory:**
The bot remembers the last 10 messages, so you can have natural follow-up conversations.

### Proposed Actions

After creating an artifact, VoxNote may suggest follow-up actions:

| Action | Description |
|--------|-------------|
| **Create Project Scaffold** | Creates a project folder with README, PLAN, TASKS, and ARCHITECTURE files |
| **Create Calendar Event** | Generates an .ics file and opens your calendar app |

All actions require explicit user confirmation before execution.

## Cloud Sync (Optional)

VoxNote supports optional cloud sync via Supabase:

1. **Sign Up**: Click the user icon in the header
2. **Auto-Sync**: History syncs automatically on login
3. **Manual Sync**: Click "Jetzt synchronisieren" in the user dropdown
4. **Local-First**: Works fully offline, syncs when online

### Sync Strategy
- **Pull on login**: Fetch cloud artifacts, merge with local
- **Push on create**: New local entries upload to cloud
- **Conflict resolution**: Cloud wins for same-ID conflicts

## Privacy & Security

- **Local-First Storage**: All data stored locally, cloud sync optional
- **No Audio Persistence**: Audio is deleted immediately after transcription
- **API Keys**: Stored only in the main process, never exposed to renderer
- **Context Isolation**: Renderer has no direct Node.js access
- **No Telemetry**: Zero data sent anywhere except OpenAI API calls
- **RLS Protected**: Cloud data protected by Row Level Security (users see only their own data)

### Data Locations

| Data | Location | Format |
|------|----------|--------|
| Settings | electron-store | Encrypted JSON |
| History | userData/history.jsonl | JSONL (one entry per line) |
| Audio | Temp directory | Deleted after transcription |
| Cloud Sync | Supabase (optional) | PostgreSQL with RLS |

## Troubleshooting

### "Aufnahme zu kurz"
Recording was too short (< 0.7 seconds). Hold Space longer while speaking.

### "Invalid file format" (should not occur)
The audio format was rejected. Minimum recording is ~1 second. If this persists, check that your microphone is working correctly.

### "API Key fehlt"
OpenAI API key is not configured. Press `S` to open Settings and enter your key.

### "Rate Limit erreicht"
OpenAI rate limit hit. Wait a moment and click "Retry".

### "Netzwerkfehler"
Network connection issue. Check your internet connection and try again.

## Design Decisions

### 1. Local-First Architecture
- All data stored locally (history.jsonl, electron-store)
- Works fully offline (except API calls)
- Cloud sync is opt-in, not required

### 2. Global API Key (48h Challenge)
- OpenAI key is set via environment variable, not user input
- Key is only accessible in Main process (never exposed to Renderer)
- **Production roadmap:** Move to server-side proxy (Supabase Edge Functions) to protect API keys

### 3. Confirm-First Actions
- Proposed actions (create files, calendar events) are never auto-executed
- User must explicitly confirm each action
- Actions show a preview of what will be created

### 4. Context-Aware Conversations
- Intent router analyzes user messages and determines appropriate action
- Bot asks clarifying questions when information is missing
- Multi-turn context memory (last 10 messages)
- Graceful degradation: if intent unclear, shows mode selector

### 5. Recording in Renderer
- Browser APIs (`getUserMedia`, `MediaRecorder`) only work in Renderer
- Audio sent via IPC to Main as ArrayBuffer
- Main writes temp file → calls Whisper API → deletes temp file

### 6. Graceful Error Handling
- All errors show user-friendly messages with retry options
- Parse failures degrade to raw markdown (never crash)
- Network errors show clear recovery path

## Code Quality

### Linting

ESLint is configured with strict TypeScript and React rules:

```bash
npm run lint
```

### Constants

Magic numbers and configuration values are centralized in `src/lib/constants.ts`:

- Recording constraints (min duration, min bytes)
- UI configuration (textarea height, toast duration)
- Conversation limits (history depth)
- Project matching thresholds

### TypeScript

- Strict typing throughout with shared types between Electron and renderer
- Discriminated unions for pipeline events
- Type-safe IPC handlers

## Development

### Prerequisites

- Node.js 18+
- npm
- OpenAI API key

### Project Structure

```
voxnote/
├── electron/
│   ├── main.ts              # Entry point, IPC handlers
│   ├── preload.ts           # Context bridge (secure API)
│   ├── shared/
│   │   ├── types.ts         # TypeScript interfaces
│   │   ├── modes.ts         # Output mode definitions
│   │   └── prompts.ts       # LLM system prompts
│   └── services/
│       ├── window.ts        # Overlay window management
│       ├── hotkeys.ts       # Global shortcuts
│       ├── tray.ts          # System tray
│       ├── settings.ts      # electron-store persistence
│       ├── history.ts       # JSONL history storage
│       ├── openai.ts        # OpenAI API client
│       ├── pipeline.ts      # Transcription + enrichment
│       ├── supabase.ts      # Supabase client + auth
│       └── sync.ts          # Cloud sync service
├── src/
│   ├── app/
│   │   ├── page.tsx         # Main chat orchestrator
│   │   ├── layout.tsx       # Root layout
│   │   └── globals.css      # Tailwind styles
│   ├── components/
│   │   ├── ChatThread.tsx   # Message list
│   │   ├── MessageBubble.tsx # Single message
│   │   ├── ArtifactCard.tsx # Result display with actions
│   │   ├── Composer.tsx     # Input area
│   │   ├── SuggestedActions.tsx # Action chips
│   │   ├── HistoryDrawer.tsx # Side panel with filter tabs
│   │   ├── SettingsModal.tsx # Settings dialog
│   │   └── AuthButton.tsx   # Login/signup + sync
│   └── lib/
│       ├── store.ts         # Zustand state management
│       ├── ipc.ts           # IPC wrappers for Electron
│       ├── constants.ts     # App-wide constants and configuration
│       └── markdown.ts      # Utilities
├── package.json
└── README.md
```

### Debug Mode

Enable audio debug logging:

```bash
VOXNOTE_DEBUG_AUDIO=1 npm run dev
```

This logs audio buffer size, MIME type, and file header bytes for troubleshooting.

## 60-Second Demo Script

1. **Start**: `npm run dev`
2. **Activate**: Press `Cmd+Shift+Space`
3. **Record**: Hold `Space`, say: "Erinner mich morgen um 9 Uhr an den Kundenanruf"
4. **Release**: Let go of Space → Intent Router suggests "Erinnerung"
5. **Choose**: Click the suggested chip
6. **View**: See structured reminder with parsed date/time
7. **Copy**: Press `Enter` to copy
8. **History**: Press `H` to see past entries, use filter tabs
9. **Login**: Click user icon to enable cloud sync
10. **Close**: Press `Escape`

## Window Behavior

| State | Size | Description |
|-------|------|-------------|
| Compact | 560×720 px | Default chat view |
| Expanded | 920×720 px | When history drawer is open |

The window is always-on-top and frameless for quick access.

## App ID

`com.example.voxnote`

## License

MIT
