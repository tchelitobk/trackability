import { DAY_NAMES, formatClock, hm } from './time';
import type { DayKey, EventKind, Minutes, WeekEvent } from './types';

type EventPreset = {
  kind: EventKind;
  label: string;
  short: string;
  /** What the week is built around, shown in pickers. */
  blurb: string;
  day: DayKey | null;
  time: Minutes | null;
  /** How long the event itself takes, in minutes. */
  minutes: number;
  intensity: number;
  /** Arrive this long before the start (travel + warm-up). */
  arriveBefore: number;
};

export const EVENT_PRESETS: Record<EventKind, EventPreset> = {
  hypertrophy: {
    kind: 'hypertrophy',
    label: 'Build muscle',
    short: 'Hypertrophy',
    blurb: 'Upper/lower volume, small surplus, protein high',
    day: null,
    time: null,
    minutes: 0,
    intensity: 0,
    arriveBefore: 0,
  },
  'midweek-match': {
    kind: 'midweek-match',
    label: 'Mid-week match',
    short: 'League match',
    blurb: 'Legs fresh by kick-off, carbs up the day before',
    day: 'Wed',
    time: hm(20, 45),
    minutes: 105,
    intensity: 9,
    arriveBefore: 45,
  },
  'weekend-match': {
    kind: 'weekend-match',
    label: 'Weekend match',
    short: 'League match',
    blurb: 'Strength early in the week, speed work the day before',
    day: 'Sat',
    time: hm(15, 0),
    minutes: 105,
    intensity: 9,
    arriveBefore: 60,
  },
  '10k': {
    kind: '10k',
    label: '10K race',
    short: '10K race',
    blurb: 'Sharpen, taper the legs, race-morning fueling',
    day: 'Sun',
    time: hm(8, 0),
    minutes: 50,
    intensity: 9,
    arriveBefore: 60,
  },
  hyrox: {
    kind: 'hyrox',
    label: 'HYROX race',
    short: 'HYROX',
    blurb: 'Compromised running early, carb-load 36 h out',
    day: 'Sat',
    time: hm(10, 0),
    minutes: 85,
    intensity: 9,
    arriveBefore: 75,
  },
  deload: {
    kind: 'deload',
    label: 'Deload week',
    short: 'Deload',
    blurb: 'Same habits, ~50% volume, sleep debt paid back',
    day: null,
    time: null,
    minutes: 0,
    intensity: 0,
    arriveBefore: 0,
  },
};

export const EVENT_ORDER: EventKind[] = [
  'hypertrophy',
  'midweek-match',
  'weekend-match',
  '10k',
  'hyrox',
  'deload',
];

export const isCompetition = (kind: EventKind) =>
  kind === 'midweek-match' || kind === 'weekend-match' || kind === '10k' || kind === 'hyrox';

export const isMatch = (kind: EventKind) =>
  kind === 'midweek-match' || kind === 'weekend-match';

export function eventTitle(kind: EventKind, day: DayKey | null, time: Minutes | null): string {
  const preset = EVENT_PRESETS[kind];
  if (!day || time === null) {
    return kind === 'hypertrophy' ? 'Hypertrophy block · 4-day build' : 'Deload · recover and reload';
  }
  return `${preset.short} · ${DAY_NAMES[day].slice(0, 3)} ${formatClock(time)}`;
}

export function makeEvent(
  kind: EventKind,
  day: DayKey | null = EVENT_PRESETS[kind].day,
  time: Minutes | null = EVENT_PRESETS[kind].time,
): WeekEvent {
  const usesDay = isCompetition(kind);
  const eventDay = usesDay ? (day ?? EVENT_PRESETS[kind].day) : null;
  const eventTime = usesDay ? (time ?? EVENT_PRESETS[kind].time) : null;
  return { kind, day: eventDay, time: eventTime, title: eventTitle(kind, eventDay, eventTime) };
}

export function nextEventKind(kind: EventKind): EventKind {
  const index = EVENT_ORDER.indexOf(kind);
  return EVENT_ORDER[(index + 1) % EVENT_ORDER.length];
}
