import { isCompetition } from './events';
import type { EventKind, Profile, SessionColor, SessionType, Sport } from './types';

export type Pattern = 'upper' | 'lower' | 'full' | 'run' | 'hybrid' | 'speed' | 'recovery';

/**
 * A session the week wants, before it has a day and time.
 * Offsets are relative to the event day: -1 = the day before, +1 = the day after.
 */
export type SessionSpec = {
  key: string;
  type: SessionType;
  title: string;
  focus: string;
  minutes: number;
  intensity: number;
  pattern: Pattern;
  /** 0-1: how much the session taxes the legs (used for spacing). */
  legLoad: number;
  color: SessionColor;
  /** Value of fitting this session in at all. Higher = scheduled first, dropped last. */
  priority: number;
  blocks: string[];
  allowed?: (offset: number) => boolean;
  preferred?: number[];
  discouraged?: number[];
  /** Why this day, given the offset from the event. */
  dayReason?: (offset: number) => string | null;
  /** Where this session has to sit relative to the event, for skip warnings. */
  needs?: string;
  /** Sessions in the same series run in spec order through the week (A before B). */
  series?: string;
  /** Prefer the event's clock time, to rehearse the race/match-day routine. */
  rehearse?: boolean;
};

const hoursOut = (offset: number) => `${Math.abs(offset) * 24} h`;

const colorFor = (type: SessionType): SessionColor => {
  if (type === 'Lift' || type === 'Speed') return 'lime';
  if (type === 'Hybrid' || type === 'Match' || type === 'Race') return 'orange';
  return 'blue';
};

type SpecInput = Omit<SessionSpec, 'color'> & { color?: SessionColor };
const spec = (input: SpecInput): SessionSpec => ({ color: colorFor(input.type), ...input });

// ─── Hypertrophy ────────────────────────────────────────────────────────────

function hypertrophyWeek(profile: Profile): SessionSpec[] {
  const full = profile.sessionMinutes;
  const specs: SessionSpec[] = [
    spec({
      key: 'upper-a',
      series: 'upper',
      type: 'Lift',
      title: 'Upper A · push emphasis',
      focus: 'Bench · weighted pull-ups · rows',
      minutes: full,
      intensity: 7,
      pattern: 'upper',
      legLoad: 0,
      priority: 3,
      blocks: [
        'A1 Bench press 4×6–8 @ effort 8/10',
        'A2 Weighted pull-up 4×6–8',
        'B1 Incline DB press 3×10–12',
        'B2 Chest-supported row 3×10–12',
        'C Lateral raise + cable curl 3×12–15',
      ],
    }),
    spec({
      key: 'lower-a',
      series: 'lower',
      type: 'Lift',
      title: 'Lower A · squat emphasis',
      focus: 'Back squat · RDL · split squat',
      minutes: full,
      intensity: 8,
      pattern: 'lower',
      legLoad: 1,
      priority: 3,
      blocks: [
        'A Back squat 4×5–6 @ effort 8/10',
        'B Romanian deadlift 3×8',
        'C Rear-foot split squat 3×10/leg',
        'D Nordic curl 3×5',
        'E Standing calf raise 4×12',
      ],
    }),
    spec({
      key: 'upper-b',
      series: 'upper',
      type: 'Lift',
      title: 'Upper B · pull emphasis',
      focus: 'Overhead press · chin-ups · incline',
      minutes: full,
      intensity: 7,
      pattern: 'upper',
      legLoad: 0,
      priority: 2.8,
      blocks: [
        'A1 Standing overhead press 4×6–8',
        'A2 Chin-up 4×AMRAP (leave 2 in tank)',
        'B1 Incline bench 3×8–10',
        'B2 Single-arm cable row 3×12/side',
        'C Rear delt fly + triceps pressdown 3×15',
      ],
    }),
    spec({
      key: 'lower-b',
      series: 'lower',
      type: 'Lift',
      title: 'Lower B · hinge emphasis',
      focus: 'Trap-bar deadlift · hip thrust · lunges',
      minutes: full,
      intensity: 8,
      pattern: 'lower',
      legLoad: 1,
      priority: 2.8,
      blocks: [
        'A Trap-bar deadlift 4×5 @ effort 8/10',
        'B Barbell hip thrust 3×8–10',
        'C Walking lunge 3×12/leg',
        'D Leg curl 3×12',
        'E Copenhagen plank 3×20 s/side',
      ],
    }),
  ];

  const extras: Record<Sport, SessionSpec> = {
    soccer: spec({
      key: 'tempo',
      type: 'Run',
      title: 'Tempo conditioning',
      focus: 'Keep the engine while you build',
      minutes: 35,
      intensity: 6,
      pattern: 'run',
      legLoad: 0.5,
      priority: 1.4,
      blocks: ['Warm-up 8 min', '2 × 8 × 100 m tempo @ 70% (walk 60 s)', 'Cool-down + calf/hip mobility'],
    }),
    running: spec({
      key: 'easy-run',
      type: 'Run',
      title: 'Easy aerobic run',
      focus: 'Zone 2 · conversational pace',
      minutes: 40,
      intensity: 4,
      pattern: 'run',
      legLoad: 0.4,
      priority: 1.4,
      blocks: ['40 min Zone 2 (nose-breathing pace)', '4 × 20 s relaxed strides'],
    }),
    hyrox: spec({
      key: 'engine',
      type: 'Hybrid',
      title: 'Engine · row + ski',
      focus: 'Aerobic power without leg damage',
      minutes: 40,
      intensity: 6,
      pattern: 'hybrid',
      legLoad: 0.3,
      priority: 1.4,
      blocks: ['5 × (500 m row + 500 m SkiErg) @ threshold', '90 s rest between rounds'],
    }),
    strength: spec({
      key: 'pump',
      type: 'Lift',
      title: 'Arms + delts pump',
      focus: 'Low-fatigue volume',
      minutes: 40,
      intensity: 5,
      pattern: 'upper',
      legLoad: 0,
      priority: 1.2,
      blocks: ['Giant set × 4: curl, pressdown, lateral raise, face pull (12–15 each)'],
    }),
  };

  specs.push(extras[profile.sport]);
  specs.push(
    spec({
      key: 'zone2',
      type: 'Reset',
      title: 'Zone 2 flush',
      focus: 'Bike or incline walk · mobility',
      minutes: 30,
      intensity: 3,
      pattern: 'recovery',
      legLoad: 0.1,
      priority: 1,
      blocks: ['20 min bike / incline walk, easy', '10 min hips, t-spine, ankles'],
    }),
  );
  return specs;
}

// ─── Match week (mid-week or weekend) ───────────────────────────────────────

function matchWeek(profile: Profile): SessionSpec[] {
  const full = profile.sessionMinutes;
  return [
    spec({
      key: 'lower-strength',
      type: 'Lift',
      title: 'Lower strength · in-season',
      focus: 'Trap-bar · split squat · Nordics',
      minutes: full,
      intensity: 8,
      pattern: 'lower',
      legLoad: 1,
      priority: 3,
      blocks: [
        'Prime: 3×3 box jumps',
        'A Trap-bar deadlift 3×4 @ effort 7–8/10, fast concentric',
        'B Rear-foot split squat 3×6/leg',
        'C Nordic curl 3×4',
        'D Copenhagen plank 2×20 s/side',
      ],
      allowed: (o) => o <= -3 || o >= 2,
      preferred: [-4, -3, 2, 3],
      needs: 'needs an open day 72 h+ before kick-off or 2+ days after',
      dayReason: (o) =>
        o < 0
          ? `${hoursOut(o)} before kick-off — heavy legs are recovered by game time`
          : `${o} days after the match: legs have recovered, so heavy work won't dent the next one`,
    }),
    spec({
      key: 'upper-strength',
      type: 'Lift',
      title: 'Upper strength',
      focus: 'Bench · pull-ups · landmine press',
      minutes: full,
      intensity: 7,
      pattern: 'upper',
      legLoad: 0.1,
      priority: 2.6,
      blocks: [
        'A1 Bench press 4×5 @ effort 8/10',
        'A2 Weighted pull-up 4×5',
        'B1 Half-kneeling landmine press 3×8/side',
        'B2 Chest-supported row 3×10',
        'C Pallof press 3×10/side',
      ],
      allowed: (o) => o !== 0,
      discouraged: [-1, 1],
      dayReason: (o) =>
        o <= -2
          ? `${-o} days before the match: upper-body work leaves your legs fresh`
          : o >= 2
            ? `${o} days after the match: upper-body work while your legs finish recovering`
            : null,
    }),
    spec({
      key: 'primer',
      type: 'Speed',
      title: 'Speed + activation',
      focus: 'Short, sharp, low volume',
      minutes: 30,
      intensity: 4,
      pattern: 'speed',
      legLoad: 0.3,
      priority: 2.2,
      color: 'lime',
      blocks: [
        'Dynamic warm-up 8 min',
        'A-skips + wicket runs 4×20 m',
        'Accelerations 5×10 m @ 90%',
        'Pogo hops 3×10',
        'Ball work / set-piece walkthrough 8 min',
      ],
      allowed: (o) => o === -1 || o === -2,
      preferred: [-1],
      needs: 'needs an open day 1–2 days before kick-off',
      rehearse: true,
      dayReason: (o) =>
        o === -1
          ? 'The day before the match: short and sharp, so you feel quick without getting tired'
          : 'Two days before the match: sharpens speed with two full nights of sleep to recover',
    }),
    spec({
      key: 'recovery',
      type: 'Reset',
      title: 'Recovery flush',
      focus: 'Bike · foam roll · hips',
      minutes: 25,
      intensity: 2,
      pattern: 'recovery',
      legLoad: 0,
      priority: 1.6,
      blocks: [
        'Easy bike or pool 12 min',
        'Foam roll quads, adductors, calves 6 min',
        '90/90 hips + couch stretch 5 min',
        'Legs up the wall, slow breathing 2 min',
      ],
      allowed: (o) => o === 1 || o === 2,
      preferred: [1],
      needs: 'needs an open day 1–2 days after the match',
      dayReason: (o) => (o === 1 ? 'The day after the match: get the blood moving, no load' : 'Two days after the match: flush the legs before loading again'),
    }),
    spec({
      key: 'conditioning',
      type: 'Run',
      title: 'Tempo conditioning',
      focus: 'Top up minutes the bench missed',
      minutes: 35,
      intensity: 6,
      pattern: 'run',
      legLoad: 0.6,
      priority: 1.2,
      blocks: ['Warm-up 8 min', '2 × 8 × 100 m tempo @ 70%', 'Cool-down + mobility'],
      allowed: (o) => o <= -3 || o >= 2,
    }),
    spec({
      key: 'upper-volume',
      type: 'Lift',
      title: 'Upper hypertrophy',
      focus: 'Pump work · shoulders · arms',
      minutes: 45,
      intensity: 6,
      pattern: 'upper',
      legLoad: 0,
      priority: 1,
      blocks: ['Incline DB press 3×10', 'Lat pulldown 3×12', 'Lateral raise 3×15', 'Curl + pressdown superset 3×12'],
      allowed: (o) => o !== 0 && o !== -1,
    }),
  ];
}

// ─── 10K ────────────────────────────────────────────────────────────────────

function tenKWeek(profile: Profile): SessionSpec[] {
  const full = profile.sessionMinutes;
  return [
    spec({
      key: 'race-pace',
      type: 'Run',
      title: 'Race-pace intervals',
      focus: '5 × 1 km @ goal 10K pace',
      minutes: 50,
      intensity: 8,
      pattern: 'run',
      legLoad: 0.7,
      priority: 3,
      blocks: ['Warm-up 15 min + 4 strides', '5 × 1 km @ goal pace, 2 min jog', 'Cool-down 10 min'],
      allowed: (o) => o <= -4,
      preferred: [-5, -4],
      needs: 'needs an open day 4+ days before the race',
      dayReason: (o) => `${hoursOut(o)} out: last hard running stimulus, fully absorbed by race day`,
    }),
    spec({
      key: 'lower-maintain',
      type: 'Lift',
      title: 'Lower strength · maintain',
      focus: 'Low volume, heavy-ish, no soreness',
      minutes: full,
      intensity: 6,
      pattern: 'lower',
      legLoad: 0.7,
      priority: 2.4,
      blocks: ['A Trap-bar deadlift 3×3 @ effort 6–7/10', 'B Step-up 3×6/leg', 'C Soleus raise 3×12', 'D Copenhagen 2×20 s/side'],
      allowed: (o) => o <= -4,
      preferred: [-6, -5],
      needs: 'needs an open day 4+ days before the race',
      dayReason: (o) => `${hoursOut(o)} before the gun — strength kept, legs fresh`,
    }),
    spec({
      key: 'upper',
      type: 'Lift',
      title: 'Upper strength',
      focus: 'Press · pull · trunk',
      minutes: full,
      intensity: 6,
      pattern: 'upper',
      legLoad: 0.1,
      priority: 2.2,
      blocks: ['A1 Bench 4×5', 'A2 Pull-up 4×5', 'B Landmine press 3×8/side', 'C Suitcase carry 3×30 m/side'],
      allowed: (o) => o <= -2 || o >= 1,
    }),
    spec({
      key: 'shakeout',
      type: 'Run',
      title: 'Shakeout + strides',
      focus: 'Loosen up · rehearse race pace',
      minutes: 25,
      intensity: 3,
      pattern: 'run',
      legLoad: 0.2,
      priority: 2,
      blocks: ['15 min easy', '4 × 20 s strides at race pace', 'Lay out kit, pin bib, plan race-morning meal'],
      allowed: (o) => o === -1 || o === -2,
      preferred: [-1],
      needs: 'needs an open day 1–2 days before the race',
      rehearse: true,
      dayReason: (o) =>
        o === -1
          ? 'Day before: short and easy keeps legs springy for the start'
          : 'Two days out: loosen up with a full night of sleep to spare',
    }),
    spec({
      key: 'tempo',
      type: 'Run',
      title: 'Tempo run',
      focus: '20 min comfortably hard',
      minutes: 40,
      intensity: 7,
      pattern: 'run',
      legLoad: 0.6,
      priority: 1.2,
      blocks: ['10 min easy', '20 min @ threshold (≈ 15 s/km slower than 10K pace)', '10 min easy'],
      allowed: (o) => o <= -3,
    }),
    spec({
      key: 'easy',
      type: 'Run',
      title: 'Easy aerobic run',
      focus: 'Zone 2 · conversational',
      minutes: 40,
      intensity: 4,
      pattern: 'run',
      legLoad: 0.4,
      priority: 1,
      blocks: ['40 min Zone 2'],
      allowed: (o) => o <= -2 || o >= 1,
    }),
  ];
}

// ─── HYROX ──────────────────────────────────────────────────────────────────

function hyroxWeek(profile: Profile): SessionSpec[] {
  const full = profile.sessionMinutes;
  return [
    spec({
      key: 'compromised',
      type: 'Hybrid',
      title: 'Compromised running',
      focus: 'Run off every station at race pace',
      minutes: 60,
      intensity: 8,
      pattern: 'hybrid',
      legLoad: 0.8,
      priority: 3,
      blocks: [
        '4 × (1 km @ race pace + 1 station)',
        'Stations: sled push, burpee broad jumps, sandbag lunges, wall balls ×25',
        'Log each 1 km split — pace off the station is the metric',
      ],
      allowed: (o) => o <= -4,
      preferred: [-5, -4],
      needs: 'needs an open day 4+ days before the race',
      dayReason: (o) => `${hoursOut(o)} out: last big race-specific hit`,
    }),
    spec({
      key: 'lower-sled',
      type: 'Lift',
      title: 'Lower strength · sled-focused',
      focus: 'Heavy sled · split squat · wall balls',
      minutes: full,
      intensity: 7,
      pattern: 'lower',
      legLoad: 0.9,
      priority: 2.5,
      blocks: ['A Heavy sled push 5 × 15 m', 'B Front-rack split squat 3×6/leg', 'C Wall ball 3×20 unbroken', 'D Sled pull 4 × 15 m'],
      allowed: (o) => o <= -3,
      preferred: [-5, -4],
      needs: 'needs an open day 3+ days before the race',
      dayReason: (o) => `${hoursOut(o)} before the start — strong legs without race-day soreness`,
    }),
    spec({
      key: 'upper-grip',
      type: 'Lift',
      title: 'Upper + grip',
      focus: 'Pull · carry · SkiErg',
      minutes: full,
      intensity: 6,
      pattern: 'upper',
      legLoad: 0.1,
      priority: 2,
      blocks: ['A1 Weighted pull-up 4×5', 'A2 DB bench 4×8', 'B Farmers carry 4 × 40 m', 'C SkiErg 4 × 250 m hard'],
      allowed: (o) => o <= -2 || o >= 1,
    }),
    spec({
      key: 'station-primer',
      type: 'Speed',
      title: 'Shakeout + station primer',
      focus: 'Easy run · light touches on each station',
      minutes: 25,
      intensity: 3,
      pattern: 'speed',
      legLoad: 0.2,
      priority: 2,
      color: 'lime',
      blocks: ['12 min easy run', '1 light round: ski, row, 10 wall balls, 10 m sled', 'Pack kit + race fuel'],
      allowed: (o) => o === -1 || o === -2,
      preferred: [-1],
      needs: 'needs an open day 1–2 days before the race',
      rehearse: true,
      dayReason: (o) =>
        o === -1
          ? 'Day before: rehearse transitions without fatigue'
          : 'Two days out: touch every station, then rest',
    }),
    spec({
      key: 'threshold',
      type: 'Run',
      title: 'Threshold run',
      focus: '3 × 8 min @ threshold',
      minutes: 40,
      intensity: 7,
      pattern: 'run',
      legLoad: 0.6,
      priority: 1.2,
      blocks: ['10 min easy', '3 × 8 min @ threshold, 2 min jog', '5 min easy'],
      allowed: (o) => o <= -3,
    }),
    spec({
      key: 'recovery',
      type: 'Reset',
      title: 'Recovery flush',
      focus: 'Bike · foam roll · hips',
      minutes: 25,
      intensity: 2,
      pattern: 'recovery',
      legLoad: 0,
      priority: 1,
      blocks: ['Easy bike 12 min', 'Foam roll 6 min', 'Hips + t-spine 7 min'],
      allowed: (o) => o >= 1,
    }),
  ];
}

// ─── Deload ─────────────────────────────────────────────────────────────────

function deloadWeek(profile: Profile): SessionSpec[] {
  const short = Math.max(30, Math.round((profile.sessionMinutes * 0.75) / 5) * 5);
  return [
    spec({
      key: 'upper-deload',
      type: 'Lift',
      title: 'Upper · deload',
      focus: 'Same lifts, half the sets, effort 6/10',
      minutes: short,
      intensity: 5,
      pattern: 'upper',
      legLoad: 0,
      priority: 3,
      blocks: ['Main press + pull: 2×5 @ effort 6/10', 'One accessory pair 2×10', 'Mobility 8 min'],
    }),
    spec({
      key: 'lower-deload',
      type: 'Lift',
      title: 'Lower · deload',
      focus: 'Groove the patterns, no grinders',
      minutes: short,
      intensity: 5,
      pattern: 'lower',
      legLoad: 0.5,
      priority: 3,
      blocks: ['Squat or trap-bar 2×5 @ effort 6/10', 'Split squat 2×8/leg', 'Nordic 2×3', 'Hips + ankles 8 min'],
    }),
    spec({
      key: 'zone2',
      type: 'Reset',
      title: 'Zone 2 + mobility',
      focus: 'Aerobic base, joints happy',
      minutes: 35,
      intensity: 3,
      pattern: 'recovery',
      legLoad: 0.2,
      priority: 2,
      blocks: ['25 min bike / incline walk', '10 min full-body mobility flow'],
    }),
  ];
}

export function sessionSpecsFor(kind: EventKind, profile: Profile): SessionSpec[] {
  switch (kind) {
    case 'hypertrophy':
      return hypertrophyWeek(profile);
    case 'midweek-match':
    case 'weekend-match':
      return matchWeek(profile);
    case '10k':
      return tenKWeek(profile);
    case 'hyrox':
      return hyroxWeek(profile);
    case 'deload':
      return deloadWeek(profile);
  }
}

/** Target number of sessions. Deload weeks cap volume at three. */
export function sessionCountFor(kind: EventKind, profile: Profile) {
  const wanted = Math.max(1, Math.min(6, profile.trainingDays));
  return kind === 'deload' ? Math.min(3, wanted) : wanted;
}

export const hasEventDay = isCompetition;
