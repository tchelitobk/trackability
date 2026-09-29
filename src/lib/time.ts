import { DAY_KEYS, type DayKey, type Minutes, type TimeBlock } from './types';

export const DAY_NAMES: Record<DayKey, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const hm = (hours: number, minutes = 0): Minutes => hours * 60 + minutes;

/** 1065 -> "5:45 PM" */
export function formatClock(value: Minutes): string {
  const wrapped = ((Math.round(value) % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/** 8 -> "08 min" (matches the Today timeline style). */
export const formatMinutesPadded = (minutes: number) =>
  `${String(Math.round(minutes)).padStart(2, '0')} min`;

export const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};

export const roundTo = (value: number, step: number) =>
  Math.round(value / step) * step;

export const ceilTo = (value: number, step: number) =>
  Math.ceil(value / step) * step;

export const dayIndex = (day: DayKey) => DAY_KEYS.indexOf(day);

export const dayOffset = (from: DayKey, to: DayKey) =>
  dayIndex(to) - dayIndex(from);

/** Monday-based index for a JS Date (Mon = 0 ... Sun = 6). */
export const mondayIndex = (date: Date) => (date.getDay() + 6) % 7;

export const dayKeyOf = (date: Date): DayKey => DAY_KEYS[mondayIndex(date)];

export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - mondayIndex(start));
  return start;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** ISO-8601 week number. */
export function isoWeek(date: Date): { year: number; week: number } {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: target.getUTCFullYear(), week };
}

export const weekIdOf = (date: Date) => {
  const { year, week } = isoWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
};

export const monthShort = (date: Date) => MONTHS[date.getMonth()];

/** "Saturday, Sep 26" */
export const formatLongDate = (date: Date) =>
  `${DAY_NAMES[dayKeyOf(date)]}, ${monthShort(date)} ${date.getDate()}`;

/** Subtract busy blocks from a window and return what is left, sorted. */
export function subtractBlocks(window: TimeBlock, busy: TimeBlock[]): TimeBlock[] {
  let free: TimeBlock[] = [{ ...window }];
  for (const block of busy) {
    const next: TimeBlock[] = [];
    for (const slot of free) {
      if (block.end <= slot.start || block.start >= slot.end) {
        next.push(slot);
        continue;
      }
      if (block.start > slot.start) next.push({ start: slot.start, end: block.start });
      if (block.end < slot.end) next.push({ start: block.end, end: slot.end });
    }
    free = next;
  }
  return free.filter((slot) => slot.end - slot.start > 0).sort((a, b) => a.start - b.start);
}

export const overlaps = (a: TimeBlock, b: TimeBlock) =>
  a.start < b.end && b.start < a.end;
