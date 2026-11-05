// Self-assessment scoring (Story 7.1): one source of rules (src/content/self-assessment.json), used by the page,
// the island and the tests. Every number in the result comes from the visitor's own answers.
import data from '../../content/self-assessment.json' with { type: 'json' };

export const assessment = data;
export type Answers = { reports?: string; hours?: number; agree?: string; systems?: string; goal?: string };
export type Level = (typeof data.levels)[number];
export type Result = {
  points: number;
  hours: number;
  /** hours × weeksPerYear; absent when hours is 0. */
  yearlyHours?: number;
  level: Level;
  /** The trimmed Q5 answer; absent when skipped or blank. */
  goal?: string;
  /** 1-3 lines, in the documented order; the fallback is added when fewer than 2 rules match. */
  recommendations: string[];
};

type Choice = Extract<(typeof data.questions)[number], { type: 'choice' }>;
const question = (id: string) => data.questions.find((q) => q.id === id)!;
const hoursQ = question('hours') as Extract<(typeof data.questions)[number], { type: 'range' }>;

/** Clamp to the slider range and round to whole hours; anything not a number counts as 0. */
export const cleanHours = (h: unknown) => {
  const n = typeof h === 'number' && Number.isFinite(h) ? Math.round(h) : 0;
  return Math.min(hoursQ.max, Math.max(hoursQ.min, n));
};

const choicePoints = (id: string, value?: string) =>
  (question(id) as Choice).options.find((o) => o.value === value)?.points ?? 0;

export function score(answers: Answers): Result {
  const hours = cleanHours(answers.hours);
  const points =
    choicePoints('reports', answers.reports) +
    hoursQ.bands.find((b) => hours <= b.max)!.points +
    choicePoints('agree', answers.agree) +
    choicePoints('systems', answers.systems);
  const level = data.levels.find((l) => points <= l.max)!;
  const matches = data.recommendations
    .filter(({ when }) => {
      if ('level' in when) return when.level === level.id;
      if ('min' in when) return hours >= when.min;
      return when.in.includes(answers[when.question as 'reports' | 'agree' | 'systems'] ?? '');
    })
    .map((r) => r.text)
    .slice(0, 3);
  if (matches.length < 2) matches.push(data.fallback);
  const goal = answers.goal?.trim() || undefined;
  return { points, hours, yearlyHours: hours > 0 ? hours * data.weeksPerYear : undefined, level, goal, recommendations: matches };
}

/** Accessible value for the hours slider ("40 or more" at the top). */
export const hoursText = (h: number) => `${h >= hoursQ.max ? `${hoursQ.max} or more` : h} ${h === 1 ? 'hour' : 'hours'} a week`;
