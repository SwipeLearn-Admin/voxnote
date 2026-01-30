/**
 * VoxNote Eval System - Test Cases
 * Comprehensive test suite for all modes
 */

import type { TestCase } from './types';

export const TEST_CASES: TestCase[] = [
  // ============================================
  // MEETING MODE
  // ============================================
  {
    id: 'meeting-001',
    mode: 'meeting',
    input: `Heute haben wir besprochen dass das neue Feature bis Freitag fertig sein muss.
Max übernimmt das Frontend und Lisa kümmert sich um die API.
Nächstes Meeting ist Donnerstag um 14 Uhr.
Das Budget wurde auf 50.000 Euro erhöht.`,
    expectations: {
      mustInclude: ['Max', 'Lisa', 'Frontend', 'API', 'Freitag', 'Donnerstag', '14 Uhr', '50.000'],
      structure: ['Zusammenfassung', 'Teilnehmer', 'Entscheidungen', 'Action Items', 'Nächste Schritte'],
      tone: 'formal',
      language: 'de',
    },
    weight: 10,
  },
  {
    id: 'meeting-002',
    mode: 'meeting',
    input: `Quick sync about the product launch.
Sarah confirmed the design is ready.
Tom needs two more days for testing.
We'll launch on Monday if QA passes.
Marketing budget is approved.`,
    expectations: {
      mustInclude: ['Sarah', 'Tom', 'design', 'testing', 'Monday', 'QA', 'Marketing'],
      structure: ['Summary', 'Decisions', 'Action Items'],
      tone: 'formal',
      language: 'en',
    },
    weight: 8,
  },
  {
    id: 'meeting-003',
    mode: 'meeting',
    input: `Äh also wir haben halt besprochen dass der Server irgendwie langsam ist.
Peter meinte das liegt am Caching.
Müssen wir fixen. Deadline ist nächste Woche glaub ich.`,
    expectations: {
      mustInclude: ['Server', 'Peter', 'Caching'],
      mustNotInclude: ['äh', 'halt', 'irgendwie', 'glaub ich'],
      structure: ['Zusammenfassung', 'Problem', 'Lösung'],
      tone: 'formal',
    },
    weight: 9,
  },

  // ============================================
  // TASKS MODE
  // ============================================
  {
    id: 'tasks-001',
    mode: 'tasks',
    input: `Ich muss morgen unbedingt den Bericht fertigstellen, dann die E-Mails
beantworten und nicht vergessen den Termin mit dem Kunden zu bestätigen.
Außerdem sollte ich die Präsentation für nächste Woche vorbereiten.`,
    expectations: {
      mustInclude: ['Bericht', 'E-Mails', 'Termin', 'Kunde', 'Präsentation'],
      structure: ['- [ ]', 'checkbox'],
      tone: 'casual',
    },
    weight: 10,
  },
  {
    id: 'tasks-002',
    mode: 'tasks',
    input: `Need to review the PR from John, then update the documentation.
Also deploy to staging and run the integration tests.
Don't forget to update the changelog.`,
    expectations: {
      mustInclude: ['PR', 'John', 'documentation', 'staging', 'tests', 'changelog'],
      structure: ['- [ ]'],
    },
    weight: 8,
  },
  {
    id: 'tasks-003',
    mode: 'tasks',
    input: `Einkaufen gehen - Milch, Brot und Käse.
Danach zur Post das Paket abholen.
Abends noch Sport machen.`,
    expectations: {
      mustInclude: ['Milch', 'Brot', 'Käse', 'Post', 'Paket', 'Sport'],
      structure: ['- [ ]'],
    },
    weight: 6,
  },

  // ============================================
  // EMAIL MODE
  // ============================================
  {
    id: 'email-001',
    mode: 'email',
    input: `Schreib eine Mail an Herrn Müller, bedank dich für das gestrige Gespräch
und bestätige den Termin am 15. Februar um 10 Uhr in unserem Büro.
Bitte ihn die Unterlagen mitzubringen.`,
    instruction: 'An: Herr Müller',
    expectations: {
      mustInclude: ['Herr Müller', 'Gespräch', '15. Februar', '10 Uhr', 'Unterlagen'],
      structure: ['Betreff:', 'Sehr geehrter', 'Mit freundlichen Grüßen'],
      tone: 'formal',
      language: 'de',
    },
    weight: 10,
  },
  {
    id: 'email-002',
    mode: 'email',
    input: `Write an email to the team announcing the new feature release next week.
Mention that everyone should test it on staging first.
Thank them for their hard work.`,
    instruction: 'To: Team',
    expectations: {
      mustInclude: ['feature', 'release', 'staging', 'test'],
      structure: ['Subject:', 'Hi', 'Best'],
      tone: 'casual',
      language: 'en',
    },
    weight: 8,
  },
  {
    id: 'email-003',
    mode: 'email',
    input: `Absage für das Meeting morgen weil ich krank bin.
Frag ob wir es auf nächste Woche verschieben können.`,
    expectations: {
      mustInclude: ['Meeting', 'krank', 'verschieben'],
      mustNotInclude: ['weil ich krank bin'],
      structure: ['Betreff:', 'Sehr geehrte'],
      tone: 'formal',
    },
    weight: 7,
  },

  // ============================================
  // TICKET MODE
  // ============================================
  {
    id: 'ticket-001',
    mode: 'ticket',
    input: `Der Login funktioniert nicht mehr seit dem letzten Update.
Nutzer bekommen einen 500 Error wenn sie sich einloggen wollen.
Betrifft nur Chrome auf Windows. Priorität hoch.`,
    instruction: 'Projekt: Auth-Service',
    expectations: {
      mustInclude: ['Login', '500', 'Chrome', 'Windows'],
      structure: ['Titel', 'Beschreibung', 'Schritte', 'Erwartetes Verhalten', 'Priorität'],
      tone: 'technical',
    },
    weight: 10,
  },
  {
    id: 'ticket-002',
    mode: 'ticket',
    input: `The dashboard is loading slowly, takes about 10 seconds.
Happens after the last deployment.
Users are complaining.`,
    expectations: {
      mustInclude: ['dashboard', 'loading', '10 seconds', 'deployment'],
      structure: ['Title', 'Description', 'Steps', 'Priority'],
      tone: 'technical',
    },
    weight: 8,
  },

  // ============================================
  // DEVNOTE MODE
  // ============================================
  {
    id: 'devnote-001',
    mode: 'devnote',
    input: `Ich habe gerade den Authentication Service refactored.
JWT Tokens werden jetzt im HttpOnly Cookie gespeichert statt LocalStorage.
Außerdem Refresh Token Rotation implementiert.
TODO: Rate Limiting noch hinzufügen.`,
    expectations: {
      mustInclude: ['Authentication', 'JWT', 'HttpOnly', 'Cookie', 'LocalStorage', 'Refresh Token', 'Rate Limiting'],
      structure: ['Änderungen', 'TODO', 'Breaking Changes'],
      tone: 'technical',
    },
    weight: 10,
  },
  {
    id: 'devnote-002',
    mode: 'devnote',
    input: `Fixed the memory leak in the WebSocket handler.
The issue was that event listeners weren't being removed on disconnect.
Added cleanup function in useEffect return.`,
    expectations: {
      mustInclude: ['memory leak', 'WebSocket', 'event listeners', 'cleanup', 'useEffect'],
      structure: ['Problem', 'Solution', 'Changes'],
      tone: 'technical',
    },
    weight: 9,
  },

  // ============================================
  // CLEAN MODE
  // ============================================
  {
    id: 'clean-001',
    mode: 'clean',
    input: `Ähm also ich wollte sagen dass wir quasi die neue Version äh
sozusagen nächste Woche releasen und ähm ja das wäre dann
halt irgendwie der Plan gewesen.`,
    expectations: {
      mustInclude: ['Version', 'Woche', 'release'],
      mustNotInclude: ['ähm', 'äh', 'quasi', 'sozusagen', 'halt', 'irgendwie'],
      tone: 'formal',
    },
    weight: 10,
  },
  {
    id: 'clean-002',
    mode: 'clean',
    input: `So like, we're gonna, um, ship the thing next week, you know?
And uh, the team is like, super excited about it and stuff.`,
    expectations: {
      mustInclude: ['ship', 'week', 'team', 'excited'],
      mustNotInclude: ['like', 'um', 'uh', 'gonna', 'you know', 'and stuff'],
    },
    weight: 9,
  },

  // ============================================
  // REMINDER MODE
  // ============================================
  {
    id: 'reminder-001',
    mode: 'reminder',
    input: `Erinner mich morgen um 9 Uhr an den Zahnarzttermin.
Und am Freitag muss ich das Paket abholen.`,
    expectations: {
      mustInclude: ['morgen', '9 Uhr', 'Zahnarzt', 'Freitag', 'Paket'],
      structure: ['Datum', 'Zeit', 'Erinnerung'],
    },
    weight: 8,
  },
  {
    id: 'reminder-002',
    mode: 'reminder',
    input: `Remind me to call mom on Sunday afternoon.
Also need to renew the gym membership before the end of the month.`,
    expectations: {
      mustInclude: ['call', 'mom', 'Sunday', 'gym', 'membership', 'month'],
      structure: ['Date', 'Time', 'Reminder'],
    },
    weight: 7,
  },

  // ============================================
  // EDGE CASES
  // ============================================
  {
    id: 'edge-001',
    mode: 'meeting',
    input: `...`, // Very short input
    expectations: {
      mustNotInclude: ['undefined', 'null', 'error'],
    },
    weight: 5,
  },
  {
    id: 'edge-002',
    mode: 'tasks',
    input: `Nichts zu tun heute.`, // No actual tasks
    expectations: {
      mustNotInclude: ['- [ ]'], // Should not hallucinate tasks
    },
    weight: 5,
  },
  {
    id: 'edge-003',
    mode: 'email',
    input: `Schreib eine böse Mail an den Kunden weil er nervt.`,
    expectations: {
      mustNotInclude: ['nervt', 'böse', 'idiot'], // Should stay professional
      tone: 'formal',
    },
    weight: 10,
  },
];

export default TEST_CASES;
