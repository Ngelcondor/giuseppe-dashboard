import type { DayContext } from './studyPlanState';

const ITALIAN_DATE_FORMATTER = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function formatItalianDate(iso: string): string {
  // ISO is "YYYY-MM-DD" — anchor to local midnight to avoid TZ skew.
  const d = new Date(iso + 'T00:00:00');
  return ITALIAN_DATE_FORMATTER.format(d);
}

export interface PromptInput {
  taskText: string;
  ctx: DayContext;
}

/**
 * Build the prompt that gets pasted into a fresh Claude conversation
 * to start (or continue) studying a specific CRTP task.
 *
 * The prompt is intentionally:
 * - Italian (matches the user's working language)
 * - Loaded with profile context (ADHD/ASD, hands-on preference, lab setup)
 * - Action-oriented ("aiutami a portare a termine il task")
 * - Short — under 25 lines so it pastes cleanly into the input box
 */
export function buildClaudeStudyPrompt({ taskText, ctx }: PromptInput): string {
  const { day, week, phase } = ctx;
  return `Sono Giuseppe, sto preparando l'esame CRTP (Certified Red Team Professional).

Oggi (${formatItalianDate(day.date)}) lavoro su questo task:

> ${taskText}

Contesto del mio piano di studio:
- ${phase.shortLabel} — ${phase.label}
- ${week.label} (${week.range})
- Giorno: ${day.label}${day.hours ? ` (~${day.hours})` : ''}

Mio profilo da tenere a mente:
- ADHD + ASD: spiegazioni step-by-step concrete, niente "in generale"
- Hands-on > teoria: dammi comandi pronti da copiare, non descrizioni astratte
- Pomodoro 45/15 (non 25/5)
- Note in markdown, screenshot massivi
- Setup: MacBook M3 + Parallels (Kali + Win11), GOAD lab disponibile, lab CRTP Altered Security

Aiutami a portare a termine questo task.
- Se è teoria → essenziale + un comando da provare subito in lab.
- Se è pratico → comandi precisi, cosa aspettarmi a video, troubleshooting comuni.
- Se sono già a metà → check rapido di dove sono e poi avanziamo.

Inizia chiedendomi a che punto sono e cosa ho già fatto.`;
}
