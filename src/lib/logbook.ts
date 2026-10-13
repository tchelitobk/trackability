import { addMacros, ZERO, type Macros } from './foods';
import type { DayFuel } from './mealPlanner';
import { formatClock } from './time';
import type { PlanDay } from './types';

export type Feel = 1 | 2 | 3 | 4 | 5;

export type SessionLog = { effort?: number; at: string };

export type CheckIn = { sleepHours?: number; feel?: Feel; at: string };

/** Everything the athlete ticks off in one week. */
export type WeekLog = {
  sessions: Record<string, SessionLog>;
  /** Mobility, walks, wind-down... keyed by micro item key. */
  items: string[];
  meals: string[];
  shopping: string[];
  /** Morning check-ins keyed by ISO date. */
  checkIns: Record<string, CheckIn>;
};

export const emptyWeek = (): WeekLog => ({ sessions: {}, items: [], meals: [], shopping: [], checkIns: {} });

export const FEELS: { value: Feel; label: string }[] = [
  { value: 1, label: 'Drained' },
  { value: 2, label: 'Flat' },
  { value: 3, label: 'OK' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Great' },
];

export const SLEEP_OPTIONS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5];

const toggleIn = (list: string[], value: string) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

const now = () => new Date().toISOString();

export function setSessionDone(week: WeekLog, id: string, done: boolean): WeekLog {
  const sessions = { ...week.sessions };
  if (done) sessions[id] = sessions[id] ?? { at: now() };
  else delete sessions[id];
  return { ...week, sessions };
}

/** Rating effort also marks the session done. */
export function setEffort(week: WeekLog, id: string, effort: number): WeekLog {
  return { ...week, sessions: { ...week.sessions, [id]: { ...week.sessions[id], effort, at: week.sessions[id]?.at ?? now() } } };
}

export const toggleItem = (week: WeekLog, key: string): WeekLog => ({ ...week, items: toggleIn(week.items, key) });
export const toggleMeal = (week: WeekLog, id: string): WeekLog => ({ ...week, meals: toggleIn(week.meals, id) });
export const toggleShopping = (week: WeekLog, food: string): WeekLog => ({ ...week, shopping: toggleIn(week.shopping, food) });

export function saveCheckIn(week: WeekLog, date: string, patch: Omit<CheckIn, 'at'>): WeekLog {
  return { ...week, checkIns: { ...week.checkIns, [date]: { ...week.checkIns[date], ...patch, at: now() } } };
}

export type Readiness = { tone: 'go' | 'steady' | 'easy'; label: string; advice: string };

/** Plain-language call on how to approach today, from the morning check-in. */
export function readiness(checkIn: CheckIn | undefined): Readiness | null {
  if (!checkIn || (checkIn.sleepHours === undefined && checkIn.feel === undefined)) return null;
  const sleep = checkIn.sleepHours ?? 7;
  const feel = checkIn.feel ?? 3;
  if (sleep < 6 || feel <= 2) {
    return {
      tone: 'easy',
      label: 'Ease off today',
      advice: 'Keep the session, but cap effort around 6/10 and drop the last set of each lift. Get to bed on time tonight.',
    };
  }
  if (sleep >= 7 && feel >= 4) {
    return { tone: 'go', label: 'Green light', advice: 'You are recovered. Train as planned.' };
  }
  return { tone: 'steady', label: 'Steady', advice: 'Train as planned with an extra 5 minutes of warm-up.' };
}

export type TaskKind = 'session' | 'event' | 'meal' | 'habit';

export type DayTask = {
  key: string;
  kind: TaskKind;
  start: number;
  time: string;
  title: string;
  detail: string;
  minutes: number;
  done: boolean;
  /** Session id (sessions/events only). */
  sessionId?: string;
  effort?: number;
};

/** One ordered list of everything loggable on a day. */
export function dayTasks(day: PlanDay, fuel: DayFuel | undefined, week: WeekLog): DayTask[] {
  const tasks: DayTask[] = [];
  for (const s of day.sessions) {
    tasks.push({
      key: s.id,
      kind: s.isEvent ? 'event' : 'session',
      start: s.start,
      time: s.time,
      title: s.title,
      detail: s.focus,
      minutes: s.minutes,
      done: Boolean(week.sessions[s.id]),
      sessionId: s.id,
      effort: week.sessions[s.id]?.effort,
    });
  }
  for (const m of day.micro) {
    // Pre-session fuel and pre-match meals are covered by the meal list.
    if (m.kind === 'fuel') continue;
    tasks.push({
      key: m.key,
      kind: 'habit',
      start: m.start,
      time: formatClock(m.start),
      title: m.title,
      detail: m.detail,
      minutes: m.minutes,
      done: week.items.includes(m.key),
    });
  }
  for (const meal of fuel?.meals ?? []) {
    tasks.push({
      key: meal.id,
      kind: 'meal',
      start: meal.time,
      time: formatClock(meal.time),
      title: meal.title,
      detail: meal.items.map((i) => i.name).slice(0, 3).join(', '),
      minutes: 0,
      done: week.meals.includes(meal.id),
    });
  }
  return tasks.sort((a, b) => a.start - b.start);
}

export function eatenMacros(fuel: DayFuel, week: WeekLog): Macros {
  return fuel.meals.filter((m) => week.meals.includes(m.id)).reduce((acc, m) => addMacros(acc, m.totals), ZERO);
}

export function progress(tasks: DayTask[]) {
  const done = tasks.filter((t) => t.done).length;
  return { done, total: tasks.length, ratio: tasks.length ? done / tasks.length : 0 };
}

/** Upgrade v1 storage (separate per-week lists) to per-week logs. */
export function migrateLogs(saved: {
  logs?: Record<string, WeekLog>;
  completed?: Record<string, string[]>;
  done?: Record<string, string[]>;
  shopping?: Record<string, string[]>;
}): Record<string, WeekLog> {
  const logs: Record<string, WeekLog> = {};
  for (const [weekId, log] of Object.entries(saved.logs ?? {})) logs[weekId] = { ...emptyWeek(), ...log };
  const weeks = new Set([
    ...Object.keys(saved.completed ?? {}),
    ...Object.keys(saved.done ?? {}),
    ...Object.keys(saved.shopping ?? {}),
  ]);
  for (const weekId of weeks) {
    const log = logs[weekId] ?? emptyWeek();
    for (const id of saved.completed?.[weekId] ?? []) log.sessions[id] = log.sessions[id] ?? { at: '' };
    log.items = [...new Set([...log.items, ...(saved.done?.[weekId] ?? [])])];
    log.shopping = [...new Set([...log.shopping, ...(saved.shopping?.[weekId] ?? [])])];
    logs[weekId] = log;
  }
  return logs;
}
