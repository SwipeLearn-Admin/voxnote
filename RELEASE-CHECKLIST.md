# VoxNote Release Checklist

Use this checklist before releasing a new version of VoxNote.

## Pre-Release: Development Testing

### 1. Clean Install

```bash
rm -rf node_modules .next .electron
npm install
```

**Expected**: No errors, all dependencies installed.

### 2. Development Build

```bash
npm run dev
```

**Expected**:
- Next.js compiles successfully
- Electron builds without errors
- Console shows: `Hotkey registered: CommandOrControl+Shift+Space`
- Overlay window appears on hotkey press

### 3. Happy Path Test (Run 5x)

Perform this sequence 5 times in a row:

1. Press `Cmd+Shift+Space` to open overlay
2. Hold `Space` and speak for 2-3 seconds
3. Release `Space`
4. Wait for transcript to appear
5. Click "Meeting-Notiz" chip
6. Wait for result
7. Press `Enter` to copy
8. Press `H` to verify history entry
9. Press `Cmd+Shift+Space` to close

**Expected**: All 5 runs complete successfully without errors.

### 4. Cancel Test

1. Start recording (hold Space)
2. Release Space
3. While "Transkribiere..." is shown, press `Escape`

**Expected**:
- Status message disappears
- Returns to idle state
- No error shown
- Temp audio file deleted

### 5. Error Handling Test

#### Missing API Key

1. Remove API key from Settings
2. Try to transcribe

**Expected**: Error message with "Einstellungen" button appears.

#### Too Short Recording

1. Tap Space very briefly (< 0.5s)
2. Release immediately

**Expected**: "Aufnahme zu kurz" message appears (not API error).

### 6. History Test

1. Complete 3 different transcription+enrichment flows
2. Press `H` to open history
3. Click an old entry
4. Verify transcript and result load correctly
5. Press `R` to rerun enrichment
6. Delete an entry
7. Clear all history

**Expected**: All operations work, no stale data.

### 7. Settings Persistence

1. Press `S` to open Settings
2. Change language to "Deutsch"
3. Change default mode to "Aufgaben"
4. Save and close overlay
5. Reopen overlay
6. Press `S` again

**Expected**: Settings are preserved.

## Pre-Release: Distribution Build

### 8. Build Distribution

```bash
npm run dist
```

**Expected**:
- Build completes without errors
- Artifact created in `dist/` folder
- For macOS: `.dmg` file generated
- For Windows: `.exe` installer generated

### 9. Install from Artifact

1. Quit development app
2. Install the distribution build
3. Launch installed app

**Expected**:
- App launches without security warnings (if signed)
- Hotkey works immediately
- No "developer mode" messages

### 10. Installed App Test

Repeat the happy path test (step 3) with the installed app:

1. Press `Cmd+Shift+Space`
2. Record -> Transcribe -> Enrich -> Copy
3. Verify history works
4. Verify settings persist after app restart

**Expected**: All functionality works in installed build.

## Regression Checklist

- [ ] Global hotkey registers on startup
- [ ] Push-to-talk recording works
- [ ] Transcription returns text
- [ ] All 6 modes produce valid output
- [ ] Copy to clipboard works
- [ ] History entries are saved
- [ ] Settings persist across restarts
- [ ] Cancel (Escape) cleans up properly
- [ ] Error messages are user-friendly
- [ ] Window resizes when history opens
- [ ] Rerun (R key) works after result

## Security Checklist

- [ ] API key NOT visible in renderer console
- [ ] No API key in history.jsonl
- [ ] Context isolation enabled (check main.ts)
- [ ] Node integration disabled (check main.ts)
- [ ] Audio files deleted after transcription

## Version Bump

Before release:

1. Update version in `package.json`
2. Update any version references in code
3. Create git tag: `git tag v1.x.x`

## Post-Release

- [ ] Test download link
- [ ] Verify auto-update (if implemented)
- [ ] Monitor for crash reports
