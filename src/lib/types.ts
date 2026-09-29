export const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type DayKey = (typeof DAY_KEYS)[number];

/** Minutes since midnight, e.g. 17:45 -> 1065. */
export type Minutes = number;

export type TimeBlock = { start: Minutes; end: Minutes };

export type Sport = 'soccer' | 'running' | 'hyrox' | 'strength';
export type Chronotype = 'early' | 'neutral' | 'late';
export type DietStyle = 'omnivore' | 'pescatarian' | 'vegetarian';
export type Exclusion = 'dairy' | 'gluten' | 'nuts';

export type CommitmentKind = 'clients' | 'team' | 'family' | 'other';

export type Commitment = TimeBlock & {
  id: string;
  day: DayKey;
  label: string;
  kind: CommitmentKind;
};

export type Profile = {
  name: string;
  sport: Sport;
  bodyWeightLb: number;
  /** How many training sessions to schedule (the week's event is extra). */
  trainingDays: number;
  /** Days the athlete can actually get to the gym / track. */
  availableDays: DayKey[];
  sessionMinutes: number;
  wakeTime: Minutes;
  sleepHours: number;
  chronotype: Chronotype;
  commuteMinutes: number;
  work: Record<DayKey, TimeBlock | null>;
  /** Protected daily block (kid's bedtime, dinner) that training never touches. */
  familyBlock: TimeBlock | null;
  commitments: Commitment[];
  diet: DietStyle;
  exclusions: Exclusion[];
};

export type EventKind =
  | 'hypertrophy'
  | 'midweek-match'
  | 'weekend-match'
  | '10k'
  | 'hyrox'
  | 'deload';

export type WeekEvent = {
  kind: EventKind;
  /** Day of the match / race. Null for block-style weeks (hypertrophy, deload). */
  day: DayKey | null;
  /** Kick-off / gun time. */
  time: Minutes | null;
  title: string;
};

export type SessionColor = 'lime' | 'orange' | 'blue';

export type SessionType =
  | 'Lift'
  | 'Run'
  | 'Hybrid'
  | 'Speed'
  | 'Reset'
  | 'Match'
  | 'Race';

export type PlanSession = {
  id: string;
  day: DayKey;
  date: string;
  /** Display start time, e.g. "5:45 PM". */
  time: string;
  start: Minutes;
  end: Minutes;
  type: SessionType;
  title: string;
  focus: string;
  /** Display duration, e.g. "60 min". */
  duration: string;
  minutes: number;
  color: SessionColor;
  /** Session RPE, 1-10. */
  intensity: number;
  isEvent: boolean;
  blocks: string[];
  why: string[];
  completed: boolean;
};

export type MicroKind = 'mobility' | 'downshift' | 'fuel' | 'winddown';

export type MicroItem = {
  key: string;
  kind: MicroKind;
  start: Minutes;
  minutes: number;
  title: string;
  detail: string;
};

export type DayLoad = 'rest' | 'light' | 'moderate' | 'high' | 'fuel-up' | 'event';

export type PlanDay = {
  day: DayKey;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  sessions: PlanSession[];
  micro: MicroItem[];
  load: DayLoad;
  label: string;
  color: SessionColor;
  free: TimeBlock[];
  /** Tonight's lights-out (earlier before an early race or match). */
  lightsOut: Minutes;
};

export type SleepWindow = {
  wake: Minutes;
  windDown: Minutes;
  lightsOut: Minutes;
  /** Latest finish for hard training that still leaves room to fall asleep. */
  hardCutoff: Minutes;
};

export type WeekPlan = {
  weekStart: string;
  weekId: string;
  event: WeekEvent;
  days: PlanDay[];
  sleep: SleepWindow;
  insights: string[];
  warnings: string[];
  load: {
    score: number;
    label: string;
    strength: number;
    conditioning: number;
    recovery: number;
  };
};
