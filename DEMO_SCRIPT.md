# VoxNote Demo Script (90-120 Sekunden)

## Setup vor Aufnahme
- App starten: `npm run dev`
- `.env.local` mit OpenAI API Key vorhanden
- History leeren (optional, fuer saubere Demo)
- Fenster auf linker Bildschirmhaelfte positionieren

---

## Teil 1: Context-Aware Bot (25s)

**[Szene: Desktop, App geschlossen]**

> "VoxNote ist ein kontextbewusster Sprach-Assistent."

**[Cmd+Shift+Space druecken - Overlay erscheint]**

> "Mit einem Hotkey bin ich sofort bereit."

**[Tippen: "hi"]**

> "Wenn ich 'hi' sage, stellt sich der Bot vor und erklaert was er kann."

**[Bot antwortet mit Vorstellung]**

> "Er versteht Kontext und fragt nach wenn Infos fehlen."

---

## Teil 2: Clarify Flow (25s)

**[Tippen: "Meeting morgen"]**

> "Wenn ich nur 'Meeting morgen' sage..."

**[Bot fragt: "Um welche Uhrzeit ist das Meeting morgen?"]**

> "...fragt der Bot nach der fehlenden Uhrzeit."

**[Tippen: "10 Uhr mit Anna"]**

> "Ich antworte - und er kombiniert den Kontext."

**[Meeting-Notiz wird erstellt]**

> "Automatisch entsteht eine strukturierte Meeting-Notiz."

---

## Teil 3: Voice Recording + Action (30s)

**[Space halten und sprechen]**

> "Ich muss ein neues Projekt starten fuer die Kundenapp. Tasks sind: API Design, Frontend Setup, und Testing."

**[Space loslassen - Transkription startet]**

> "Die Aufnahme wird transkribiert und analysiert..."

**[Aufgaben-Artefakt erscheint mit Action-Button]**

> "Der Bot erkennt: Das ist ein Projekt mit Tasks."

**[Auf "Projektordner erstellen" klicken]**

> "Ein Klick - und VoxNote erstellt einen kompletten Projektordner..."

**[Bestaetigen, Ordner oeffnet sich im Finder]**

> "...mit README, PLAN, TASKS und ARCHITECTURE. Direkt einsatzbereit!"

---

## Teil 4: History + Abschluss (20s)

**[H druecken fuer History]**

> "Alle Eintraege landen in der History - gefiltert nach Typ."

**[Filter-Tabs durchklicken: All, Meeting, Tasks, Reminder]**

> "Meetings, Tasks, Emails, Reminders - alles uebersichtlich organisiert."

**[Escape druecken - Overlay schliesst]**

> "VoxNote - vom Gedanken zur Struktur in Sekunden."

---

## Keyboard Shortcuts fuer Demo

| Aktion | Shortcut |
|--------|----------|
| Overlay oeffnen | `Cmd+Shift+Space` |
| Aufnehmen | `Space` halten |
| History | `H` |
| Settings | `S` |
| Kopieren | `Enter` |
| Kopieren + Schliessen | `Cmd+Enter` |
| Abbrechen | `Escape` |

---

## Alternative Sprechbeispiele

### Greeting (Context-Aware)
- "Hi" → Bot stellt sich vor
- "Was kannst du?" → Bot erklaert Faehigkeiten

### Clarify Flow
- "Meeting morgen" → Bot fragt nach Uhrzeit
- "Email an Max" → Bot fragt worum es geht
- "Erinner mich an..." → Bot fragt wann

### Complete Input (Auto-Detect)
- "Meeting mit dem Team morgen um 10 ueber das Release" → Meeting-Notiz direkt
- "Erinner mich um 15 Uhr an den Zahnarzt" → Reminder direkt
- "Schreib eine Email an Max wegen dem Projektupdate" → Email direkt

### Actions Demo
- Tasks mit Projekt-Kontext → "Projektordner erstellen" Button erscheint
- Reminder mit Datum → "Kalender-Event erstellen" Button erscheint

---

## Technische Highlights fuer Erklaerung

1. **Context-Aware Intent Router**: Analysiert Nachrichten, erkennt Modus, fragt nach bei fehlenden Infos
2. **Multi-Turn Memory**: Letzte 10 Nachrichten werden beruecksichtigt
3. **Proposed Actions**: Projektordner und Kalender-Events mit Bestaetigung
4. **Local-First**: Funktioniert offline, Cloud-Sync optional
5. **Zod Validation**: Alle LLM-Outputs werden validiert, graceful degradation bei Fehlern
