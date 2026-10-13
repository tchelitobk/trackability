import { EVENT_PRESETS, isCompetition, isMatch } from './events';
import { sessionCountFor, sessionSpecsFor, type SessionSpec } from './sessions';
import {
  addDays,
  ceilTo,
  DAY_NAMES,
  dayIndex,
  formatClock,
  formatDuration,
  hm,
  overlaps,
  roundTo,
  subtractBlocks,
  toISODate,
  weekIdOf,
} from './time';
import {
  DAY_KEYS,
  type Chronotype,
  type DayKey,
  type DayLoad,
  type MicroItem,
  type Minutes,
  type PlanDay,
  type PlanSession,
  type Profile,
  type SessionColor,
  type SleepWindow,
  type TimeBlock,
  type WeekEvent,
  type WeekPlan,
} from './types';

/** Change + shower time after a session before the next commitment. */
export const CHANGEOVER = 15;
const SLOT_STEP = 15;

// ─── Sleep ──────────────────────────────────────────────────────────────────

export function sleepWindowFor(profile: Profile): SleepWindow {
  const wake = profile.wakeTime;
  let lightsOut = wake - Math.round(profile.sleepHours * 60);
  while (lightsOut <= wake) lightsOut += 1440;
  return {
    wake,
    lightsOut,
    windDown: lightsOut - 30,
    // Vigorous training that ends 2 h+ before bed doesn't hurt sleep onset;
    // closer than that it starts to.
    hardCutoff: lightsOut - 120,
  };
}

// ─── Time-of-day performance ────────────────────────────────────────────────

/**
 * Relative strength/power output across the day for a neutral chronotype.
 * Peaks in the late afternoon / early evening when core temperature is highest.
 */
const PERFORMANCE_CURVE: [Minutes, number][] = [
  [hm(5), 0.45],
  [hm(6), 0.55],
  [hm(7), 0.62],
  [hm(8), 0.68],
  [hm(9), 0.74],
  [hm(10), 0.8],
  [hm(11), 0.84],
  [hm(12), 0.86],
  [hm(13), 0.86],
  [hm(14), 0.88],
  [hm(15), 0.93],
  [hm(16), 0.98],
  [hm(17), 1],
  [hm(18), 1],
  [hm(19), 0.97],
  [hm(20), 0.9],
  [hm(21), 0.8],
  [hm(22), 0.65],
  [hm(23), 0.5],
  [hm(24), 0.4],
];

const CHRONOTYPE_SHIFT: Record<Chronotype, number> = { early: -60, neutral: 0, late: 60 };

export function performanceAt(time: Minutes, chronotype: Chronotype): number {
  const t = time - CHRONOTYPE_SHIFT[chronotype];
  const first = PERFORMANCE_CURVE[0];
  const last = PERFORMANCE_CURVE[PERFORMANCE_CURVE.length - 1];
  if (t <= first[0]) return first[1];
  if (t >= last[0]) return last[1];
  for (let i = 1; i < PERFORMANCE_CURVE.length; i += 1) {
    const [t1, v1] = PERFORMANCE_CURVE[i];
    if (t <= t1) {
      const [t0, v0] = PERFORMANCE_CURVE[i - 1];
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return last[1];
}

export function peakWindowLabel(chronotype: Chronotype) {
  const shift = CHRONOTYPE_SHIFT[chronotype];
  return `${formatClock(hm(16) + shift).replace(':00', '').replace(' PM', '')}–${formatClock(hm(19) + shift).replace(':00', '')}`;
}

// ─── Day availability ───────────────────────────────────────────────────────

type DayContext = {
  day: DayKey;
  index: number;
  work: TimeBlock | null;
  busy: TimeBlock[];
  free: TimeBlock[];
  /** Sleep window for this night (earlier the night before an early start). */
  sleep: SleepWindow;
};

function eventBlock(event: WeekEvent): TimeBlock | null {
  if (!event.day || event.time === null) return null;
  const preset = EVENT_PRESETS[event.kind];
  return { start: event.time - preset.arriveBefore, end: event.time + preset.minutes + 30 };
}

function dayContext(profile: Profile, day: DayKey, event: WeekEvent, sleep: SleepWindow): DayContext {
  const work = profile.work[day];
  const busy: TimeBlock[] = [];
  if (work) {
    busy.push({ start: work.start - profile.commuteMinutes, end: work.end + profile.commuteMinutes });
  }
  for (const c of profile.commitments) {
    if (c.day === day) busy.push({ start: c.start, end: c.end });
  }
  if (profile.familyBlock) busy.push({ ...profile.familyBlock });
  if (event.day === day) {
    const block = eventBlock(event);
    if (block) busy.push(block);
  }
  const night = nightBefore(event, day, sleep);
  const free = subtractBlocks({ start: sleep.wake + 30, end: night.lightsOut - 30 }, busy);
  return { day, index: dayIndex(day), work, busy, free, sleep: night };
}

/** An early race or match pulls the previous night's lights-out forward. */
function nightBefore(event: WeekEvent, day: DayKey, sleep: SleepWindow): SleepWindow {
  if (!event.day || event.time === null || dayIndex(event.day) - 1 !== dayIndex(day)) return sleep;
  const alarm = preEventMealTime(event.time) - 15;
  if (alarm >= sleep.wake) return sleep;
  const lightsOut = sleep.lightsOut - (sleep.wake - alarm);
  return { ...sleep, lightsOut, windDown: lightsOut - 30, hardCutoff: lightsOut - 120 };
}

// ─── Slot scoring ───────────────────────────────────────────────────────────

export type Slot = { start: Minutes; end: Minutes; score: number; perf: number };

export function scoreSlot(
  spec: Pick<SessionSpec, 'minutes' | 'intensity'>,
  start: Minutes,
  profile: Profile,
  sleep: SleepWindow,
  work: TimeBlock | null,
): Slot | null {
  const end = start + spec.minutes;
  const perf = performanceAt(start + spec.minutes / 2, profile.chronotype);
  // Easy sessions care less about hitting peak output.
  const weight = 0.35 + (0.65 * spec.intensity) / 10;
  let score = perf * weight + (1 - weight) * 0.8;

  const gap = sleep.lightsOut - end;
  if (spec.intensity >= 6) {
    if (gap < 60) return null;
    if (gap < 120) score -= 0.12 + ((120 - gap) / 60) * 0.48;
    else if (gap < 180) score -= ((180 - gap) / 60) * 0.12;
  } else if (spec.intensity >= 4) {
    if (gap < 45) return null;
    if (gap < 90) score -= ((90 - gap) / 45) * 0.15;
  } else if (gap < 30) {
    return null;
  }

  // Sleep inertia: the first hour after waking is a poor time to load a bar.
  if (start - sleep.wake < 60) score -= 0.08;

  // After a long shift, hard sessions start a little flat.
  if (work && start >= work.end && work.end - work.start >= 9 * 60 && spec.intensity >= 6) {
    score -= 0.04;
  }

  return { start, end, score, perf };
}

function slotsFor(
  spec: SessionSpec,
  ctx: DayContext,
  profile: Profile,
  eventTime: Minutes | null,
): Slot[] {
  const { sleep } = ctx;
  const slots: Slot[] = [];
  for (const window of ctx.free) {
    for (
      let start = ceilTo(window.start, SLOT_STEP);
      start + spec.minutes + CHANGEOVER <= window.end;
      start += SLOT_STEP
    ) {
      const slot = scoreSlot(spec, start, profile, sleep, ctx.work);
      if (!slot) continue;
      if (spec.rehearse && eventTime !== null) {
        // Priming near the event's clock time rehearses the routine.
        slot.score += 0.3 * Math.max(0, 1 - Math.abs(start - eventTime) / 360);
      }
      slots.push(slot);
    }
  }
  return slots.sort((a, b) => b.score - a.score || a.start - b.start);
}

// ─── Day assignment ─────────────────────────────────────────────────────────

type Placement = { spec: SessionSpec; ctx: DayContext; slots: Slot[] };

function dayPreference(spec: SessionSpec, offset: number | null): number {
  if (offset === null) return 0;
  let value = 0;
  if (spec.allowed && !spec.allowed(offset)) value -= 3 * spec.priority;
  if (spec.preferred?.includes(offset)) value += 0.4;
  if (spec.discouraged?.includes(offset)) value -= 0.5;
  return value;
}

const LIFT_PATTERNS = new Set(['upper', 'lower']);

function spacingPenalty(
  items: { pattern: string; legLoad: number; index: number }[],
): number {
  let penalty = 0;
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i];
      const b = items[j];
      const gap = Math.abs(a.index - b.index);
      const samePattern = a.pattern === b.pattern && LIFT_PATTERNS.has(a.pattern);
      if (gap === 1) {
        if (samePattern) penalty += 1.5;
        if (a.legLoad >= 0.6 && b.legLoad >= 0.6) penalty += 1;
      } else if (gap === 2 && samePattern) {
        penalty += 0.15;
      }
    }
  }
  // Long streaks of consecutive training days.
  const trainingDays = new Set(items.map((item) => item.index));
  let streak = 0;
  for (let d = 0; d < 7; d += 1) {
    if (trainingDays.has(d)) {
      streak += 1;
      if (streak >= 3) penalty += 0.4;
    } else {
      streak = 0;
    }
  }
  return penalty;
}

type Assignment = { placements: (Placement | null)[]; score: number };

function assignDays(
  specs: SessionSpec[],
  contexts: DayContext[],
  event: WeekEvent,
  eventIndex: number | null,
  profile: Profile,
): Assignment {
  const candidates = specs.map((spec) =>
    contexts
      .map((ctx) => {
        const slots = slotsFor(spec, ctx, profile, event.time);
        if (slots.length === 0) return null;
        const offset = eventIndex === null ? null : ctx.index - eventIndex;
        const value = spec.priority * (0.6 + slots[0].score) + dayPreference(spec, offset);
        return { ctx, slots, value };
      })
      .filter((option): option is { ctx: DayContext; slots: Slot[]; value: number } => option !== null),
  );

  const eventItem = eventIndex === null ? [] : [{ pattern: 'event', legLoad: 1, index: eventIndex }];
  let best: Assignment = { placements: specs.map(() => null), score: -Infinity };
  const current: (Placement | null)[] = [];
  const used = new Set<number>();

  const visit = (i: number, running: number) => {
    if (i === specs.length) {
      const items = [
        ...eventItem,
        ...current
          .filter((p): p is Placement => p !== null)
          .map((p) => ({ pattern: p.spec.pattern, legLoad: p.spec.legLoad, index: p.ctx.index })),
      ];
      const total = running - spacingPenalty(items);
      if (total > best.score + 1e-9) best = { placements: [...current], score: total };
      return;
    }
    for (const option of candidates[i]) {
      if (used.has(option.ctx.index)) continue;
      used.add(option.ctx.index);
      current.push({ spec: specs[i], ctx: option.ctx, slots: option.slots });
      visit(i + 1, running + option.value);
      current.pop();
      used.delete(option.ctx.index);
    }
    current.push(null);
    visit(i + 1, running - specs[i].priority);
    current.pop();
  };

  visit(0, 0);
  return best;
}

/** Keep A/B sessions of the same series in order through the week. */
function orderSeries(placements: Placement[]): Placement[] {
  const result = [...placements];
  const series = new Set(placements.map((p) => p.spec.series).filter(Boolean));
  for (const name of series) {
    const members = result
      .map((placement, position) => ({ placement, position }))
      .filter(({ placement }) => placement.spec.series === name);
    const specsInOrder = members
      .map(({ placement }) => placement.spec)
      .sort((a, b) => b.priority - a.priority);
    const byDay = [...members].sort((a, b) => a.placement.ctx.index - b.placement.ctx.index);
    byDay.forEach(({ placement, position }, i) => {
      result[position] = { ...placement, spec: specsInOrder[i] };
    });
  }
  return result;
}

/** Nudge the main sessions toward a shared start time, so the week has a rhythm. */
function pickSlots(placements: Placement[]): Map<Placement, Slot> {
  const isMain = (p: Placement) => p.spec.intensity >= 6 && !p.spec.rehearse;
  const anchors = placements.map((p) => (isMain(p) ? p.slots[0].start : null));
  const chosen = new Map<Placement, Slot>();
  placements.forEach((placement, i) => {
    let pick = placement.slots[0];
    let pickValue = -Infinity;
    for (const slot of placement.slots) {
      const neighbours = isMain(placement)
        ? anchors.filter((a, j) => j !== i && a !== null && Math.abs(a - slot.start) <= 30).length
        : 0;
      const value = slot.score + Math.min(0.1, 0.04 * neighbours);
      if (value > pickValue + 1e-9) {
        pick = slot;
        pickValue = value;
      }
    }
    chosen.set(placement, pick);
  });
  return chosen;
}

// ─── Explanations ───────────────────────────────────────────────────────────

const gapLabel = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};

function explainSession(
  placement: Placement,
  slot: Slot,
  all: { placement: Placement; slot: Slot }[],
  profile: Profile,
  eventIndex: number | null,
  eventTime: Minutes | null,
): string[] {
  const reasons: string[] = [];
  const { spec, ctx } = placement;
  const { sleep } = ctx;

  if (eventIndex !== null) {
    const reason = spec.dayReason?.(ctx.index - eventIndex);
    if (reason) reasons.push(reason);
  }
  if (reasons.length === 0 && LIFT_PATTERNS.has(spec.pattern)) {
    const samePattern = all
      .filter((other) => other.placement !== placement && other.placement.spec.pattern === spec.pattern)
      .map((other) => other.placement);
    const previous = samePattern
      .filter((other) => other.ctx.index < ctx.index)
      .sort((a, b) => b.ctx.index - a.ctx.index)[0];
    const next = samePattern
      .filter((other) => other.ctx.index > ctx.index)
      .sort((a, b) => a.ctx.index - b.ctx.index)[0];
    const name = (p: Placement) => p.spec.title.split(' · ')[0];
    if (previous) {
      const hours = (ctx.index - previous.ctx.index) * 24;
      reasons.push(`${hours} h after ${name(previous)} — the same muscles are fully recovered`);
    } else if (next) {
      const hours = (next.ctx.index - ctx.index) * 24;
      reasons.push(`${name(next)} follows ${hours} h later — enough to recover and hit it again`);
    }
  }

  const work = ctx.work;
  if (work && slot.start >= work.end) {
    const home = work.end + profile.commuteMinutes;
    const wait = slot.start - home;
    reasons.push(
      wait <= 30
        ? `Straight off your ${formatClock(work.end)} shift — no couch, no dead time`
        : `After your ${formatClock(work.end)} shift and the drive home`,
    );
  } else if (work && slot.end <= work.start) {
    const eveningSlots = placement.slots.filter((s) => s.start >= work.end);
    const eveningBest = eveningSlots[0];
    reasons.push(
      !eveningBest || eveningBest.score < slot.score - 0.02
        ? `Before your ${formatClock(work.start)} shift — tonight's window would cut into sleep`
        : `Before work: trained and showered by ${formatClock(slot.end + CHANGEOVER)}`,
    );
  } else if (spec.rehearse && eventTime !== null && Math.abs(slot.start - eventTime) <= 90) {
    reasons.push('Same time of day as the event — rehearses the routine');
  } else if (spec.rehearse && eventTime !== null && Math.abs(slot.start - eventTime) <= 240) {
    reasons.push('Early in the day, like the event — then an early night');
  } else if (slot.perf >= 0.95 && spec.intensity >= 6) {
    reasons.push(`Inside your ${peakWindowLabel(profile.chronotype)} strength and power peak`);
  } else {
    reasons.push(`Best open window around your commitments on ${DAY_NAMES[ctx.day]}`);
  }

  if (spec.intensity >= 6) {
    const gap = sleep.lightsOut - slot.end;
    reasons.push(`Done by ${formatClock(slot.end)} — ${gapLabel(gap)} before lights out at ${formatClock(sleep.lightsOut)}`);
  }
  return reasons;
}

// ─── Micro items (mobility, fuel, downshift) ────────────────────────────────

/** Morning starts get a smaller meal 2.5 h out; later starts a full meal ~3.5 h out. */
export const preEventMealTime = (eventTime: Minutes) =>
  eventTime < hm(11) ? eventTime - 150 : eventTime - 210;

function microFor(ctx: DayContext, sessions: PlanSession[], event: WeekEvent): MicroItem[] {
  const { sleep } = ctx;
  const items: MicroItem[] = [];
  const work = ctx.work;
  const busyWith = (block: TimeBlock) =>
    sessions.some((s) => overlaps(block, { start: s.start, end: s.end }));

  if (work && work.end - work.start >= 4 * 60) {
    const noon = hm(12, 10);
    const start = noon > work.start + 60 && noon < work.end - 60 ? noon : roundTo((work.start + work.end) / 2, 10);
    items.push({
      key: `${ctx.day}:mobility`,
      kind: 'mobility',
      start,
      minutes: 8,
      title: 'Midday mobility',
      detail: 'Shift reset · hips and t-spine',
    });
  }

  const eventHere = event.day === ctx.day && event.time !== null;
  let lightsOut = sleep.lightsOut;
  if (eventHere && event.time !== null) {
    const early = event.time < hm(11);
    const end = event.time + EVENT_PRESETS[event.kind].minutes;
    items.push({
      key: `${ctx.day}:pre-event-meal`,
      kind: 'fuel',
      start: preEventMealTime(event.time),
      minutes: 20,
      title: isMatch(event.kind) ? 'Pre-match meal' : 'Pre-race meal',
      detail: early
        ? 'Familiar carbs, low fat and fiber · 2–3 h out'
        : 'Carb-rich, low fat and fiber · 3–4 h out',
    });
    items.push({
      key: `${ctx.day}:post-event`,
      kind: 'fuel',
      start: end + 15,
      minutes: 10,
      title: 'Recovery refuel',
      detail: 'Carbs + 30–40 g protein within 45 min',
    });
    if (end > sleep.windDown - 60) lightsOut = end + 90;
  } else {
    const main = sessions.find((s) => !s.isEvent && s.intensity >= 6);
    if (main) {
      const start = Math.max(sleep.wake + 10, main.start - 75);
      items.push({
        key: `${ctx.day}:pre-fuel`,
        kind: 'fuel',
        start,
        minutes: 10,
        title: 'Pre-session fuel',
        detail: '30–60 g carbs, light on fat · 60–90 min out',
      });
    }
  }

  // An easy walk after dinner lowers arousal and helps sleep come on time.
  // Days with an afternoon/evening session already have their movement.
  const eveningSession = sessions.some((s) => s.end > hm(17));
  if (!eveningSession) {
    const candidates = [hm(19), hm(19, 30), hm(20), hm(20, 30), hm(18, 30), hm(21)];
    const walk = candidates
      .map((start) => ({ start, end: start + 24 }))
      .find(
        (block) =>
          block.end <= sleep.windDown - 45 &&
          !busyWith(block) &&
          ctx.free.some((free) => block.start >= free.start && block.end <= free.end),
      );
    if (walk) {
      items.push({
        key: `${ctx.day}:downshift`,
        kind: 'downshift',
        start: walk.start,
        minutes: 24,
        title: 'Downshift walk',
        detail: `Easy pace · protect ${formatClock(sleep.windDown)} wind-down`,
      });
    }
  }

  if (!items.some((item) => item.kind === 'downshift')) {
    items.push({
      key: `${ctx.day}:winddown`,
      kind: 'winddown',
      start: lightsOut - 30,
      minutes: 30,
      title: 'Wind-down',
      detail:
        lightsOut === sleep.lightsOut
          ? `Screens off, lights low · asleep by ${formatClock(lightsOut)}`
          : `Late one · asleep by ${formatClock(lightsOut)}, same alarm tomorrow`,
    });
  }

  return items.sort((a, b) => a.start - b.start);
}

// ─── Plan assembly ──────────────────────────────────────────────────────────

const LABELS: Record<PlanSession['type'], string> = {
  Lift: 'Lift',
  Run: 'Run',
  Hybrid: 'Hybrid',
  Speed: 'Speed',
  Reset: 'Reset',
  Match: 'Match',
  Race: 'Race',
};

function dayLoadFor(index: number, sessions: PlanSession[], eventIndex: number | null): DayLoad {
  if (eventIndex !== null && index === eventIndex) return 'event';
  if (eventIndex !== null && index === eventIndex - 1) return 'fuel-up';
  const peak = Math.max(0, ...sessions.map((s) => s.intensity));
  if (peak >= 8) return 'high';
  if (peak >= 6) return 'moderate';
  if (peak > 0) return 'light';
  return 'rest';
}

function eventSession(event: WeekEvent, weekId: string, date: string, completed: Set<string>): PlanSession | null {
  if (!event.day || event.time === null) return null;
  const preset = EVENT_PRESETS[event.kind];
  const match = isMatch(event.kind);
  const id = `${weekId}:event`;
  const blocks = match
    ? [
        `Arrive ${formatClock(event.time - preset.arriveBefore)}: RAMP warm-up + 3 × 20 m sprints`,
        'Half-time: 30–40 g carbs + 500 ml fluid',
        'Full-time: recovery shake within 30 min, then a real meal',
      ]
    : event.kind === 'hyrox'
      ? [
          `Arrive ${formatClock(event.time - preset.arriveBefore)}: check-in, warm-up 15 min`,
          'Pace the first 1 km run 10 s/km slower than you want to',
          'Gel or chews at stations 4 and 6',
        ]
      : [
          `Arrive ${formatClock(event.time - preset.arriveBefore)}: 10 min jog + drills + 4 strides`,
          'First km at goal pace, not faster',
          'Post-race: carbs + protein within 45 min',
        ];
  return {
    id,
    day: event.day,
    date,
    time: formatClock(event.time),
    start: event.time,
    end: event.time + preset.minutes,
    type: match ? 'Match' : 'Race',
    title: match ? 'League match' : event.kind === 'hyrox' ? 'HYROX race' : '10K race',
    focus: `${match ? 'Kick-off' : 'Start'} ${formatClock(event.time)} · arrive ${formatClock(event.time - preset.arriveBefore)}`,
    duration: formatDuration(preset.minutes),
    minutes: preset.minutes,
    color: 'orange',
    intensity: preset.intensity,
    isEvent: true,
    blocks,
    why: ['The week is built backwards from this'],
    completed: completed.has(id),
  };
}

export function buildWeekPlan(
  profile: Profile,
  event: WeekEvent,
  weekStartDate: Date,
  completed: Set<string> = new Set(),
): WeekPlan {
  const sleep = sleepWindowFor(profile);
  const weekId = weekIdOf(weekStartDate);
  const dates = DAY_KEYS.map((_, i) => toISODate(addDays(weekStartDate, i)));
  const eventIndex = isCompetition(event.kind) && event.day ? dayIndex(event.day) : null;

  const contexts = DAY_KEYS.map((day) => dayContext(profile, day, event, sleep));
  const trainable = contexts.filter(
    (ctx) => profile.availableDays.includes(ctx.day) && ctx.index !== eventIndex,
  );

  const specs = sessionSpecsFor(event.kind, profile).slice(0, sessionCountFor(event.kind, profile));
  const assignment = assignDays(specs, trainable, event, eventIndex, profile);
  const placed = orderSeries(assignment.placements.filter((p): p is Placement => p !== null));
  const slots = pickSlots(placed);
  const withSlots = placed.map((placement) => ({ placement, slot: slots.get(placement)! }));

  const sessionsByDay = new Map<DayKey, PlanSession[]>();
  for (const { placement, slot } of withSlots) {
    const { spec, ctx } = placement;
    const id = `${weekId}:${spec.key}`;
    const session: PlanSession = {
      id,
      day: ctx.day,
      date: dates[ctx.index],
      time: formatClock(slot.start),
      start: slot.start,
      end: slot.end,
      type: spec.type,
      title: spec.title,
      focus: spec.focus,
      duration: formatDuration(spec.minutes),
      minutes: spec.minutes,
      color: spec.color,
      intensity: spec.intensity,
      isEvent: false,
      blocks: spec.blocks,
      why: explainSession(placement, slot, withSlots, profile, eventIndex, event.time),
      completed: completed.has(id),
    };
    sessionsByDay.set(ctx.day, [...(sessionsByDay.get(ctx.day) ?? []), session]);
  }

  const eventDayIndex = eventIndex;
  const eventEntry =
    eventDayIndex === null ? null : eventSession(event, weekId, dates[eventDayIndex], completed);
  if (eventEntry) {
    sessionsByDay.set(eventEntry.day, [...(sessionsByDay.get(eventEntry.day) ?? []), eventEntry]);
  }

  const days: PlanDay[] = contexts.map((ctx) => {
    const sessions = (sessionsByDay.get(ctx.day) ?? []).sort((a, b) => a.start - b.start);
    const primary = sessions.find((s) => s.isEvent) ?? sessions[0];
    const color: SessionColor = primary?.color ?? 'blue';
    return {
      day: ctx.day,
      date: dates[ctx.index],
      sessions,
      micro: microFor(ctx, sessions, event),
      load: dayLoadFor(ctx.index, sessions, eventIndex),
      label: primary ? LABELS[primary.type] : 'Rest',
      color,
      free: ctx.free,
      lightsOut: ctx.sleep.lightsOut,
    };
  });

  return {
    weekStart: dates[0],
    weekId,
    event,
    days,
    sleep,
    insights: buildInsights(profile, event, days, sleep, contexts),
    warnings: buildWarnings(profile, event, specs, assignment, trainable, contexts),
    load: weekLoad(days),
  };
}

// ─── Week-level summaries ───────────────────────────────────────────────────

function weekLoad(days: PlanDay[]): WeekPlan['load'] {
  let strength = 0;
  let conditioning = 0;
  let recovery = 0;
  for (const day of days) {
    for (const s of day.sessions) {
      const units = s.intensity * s.minutes;
      if (s.type === 'Lift') strength += units;
      else if (s.type === 'Reset') recovery += units;
      else conditioning += units;
    }
  }
  let recoveryMinutes = 0;
  for (const day of days) {
    for (const m of day.micro) {
      if (m.kind === 'mobility' || m.kind === 'downshift') recoveryMinutes += m.minutes;
    }
  }
  const score = Math.min(10, Math.round(((strength + conditioning + recovery) / 250) * 10) / 10);
  recovery += recoveryMinutes * 2;
  const label =
    score < 4 ? 'low / recover' : score < 6.5 ? 'moderate / build' : score < 8.5 ? 'high / ready' : 'very high / watch sleep';
  return { score, label, strength, conditioning, recovery };
}

function buildInsights(
  profile: Profile,
  event: WeekEvent,
  days: PlanDay[],
  sleep: SleepWindow,
  contexts: DayContext[],
): string[] {
  const insights: string[] = [];
  const training = days.flatMap((d) => d.sessions.filter((s) => !s.isEvent));
  const latest = training
    .filter((s) => s.intensity >= 6)
    .reduce<PlanSession | null>((acc, s) => (!acc || s.end > acc.end ? s : acc), null);

  insights.push(
    `Up at ${formatClock(sleep.wake)} every day, weekends included — a fixed wake time is what makes early alarms stop feeling brutal.`,
  );
  if (latest) {
    insights.push(
      latest.end <= sleep.hardCutoff
        ? `Latest hard finish this week is ${formatClock(latest.end)} (${latest.day}) — inside the ${formatClock(sleep.hardCutoff)} cutoff that gets you asleep by ${formatClock(sleep.lightsOut)}.`
        : `${latest.day} runs past the ${formatClock(sleep.hardCutoff)} cutoff (done ${formatClock(latest.end)}) — no earlier window fits that day, so keep the cool-down short and lights out by ${formatClock(sleep.lightsOut)}.`,
    );
  }

  const morning = training.filter((s) => {
    const work = contexts[dayIndex(s.day)].work;
    return work && s.end <= work.start;
  });
  if (morning.length > 0) {
    insights.push(
      `${morning.length === 1 ? 'One session is' : `${morning.length} sessions are`} before work: evening windows after your shift ran too close to bedtime.`,
    );
  }

  const afterWork = training.filter((s) => {
    const work = contexts[dayIndex(s.day)].work;
    return work && s.start >= work.end && s.start - (work.end + profile.commuteMinutes) <= 30;
  });
  if (afterWork.length > 0) {
    insights.push(
      `${afterWork.length} session${afterWork.length > 1 ? 's start' : ' starts'} within 30 min of getting off — sitting down first is how 8 PM turns into a midnight finish.`,
    );
  }

  if (event.day && event.time !== null) {
    const preset = EVENT_PRESETS[event.kind];
    const end = event.time + preset.minutes;
    const alarm = preEventMealTime(event.time) - 15;
    if (alarm < sleep.wake) {
      insights.push(
        `${DAY_NAMES[event.day]} is an early start: alarm ${formatClock(alarm)} for the pre-${isMatch(event.kind) ? 'match' : 'race'} meal, so lights out ${formatClock(sleep.lightsOut - (sleep.wake - alarm))} the night before.`,
      );
    }
    if (end > sleep.windDown - 60) {
      insights.push(
        `${DAY_NAMES[event.day]} finishes late (${formatClock(end)}): shake on the drive home, lights out by ${formatClock(end + 90)}, keep the ${formatClock(sleep.wake)} alarm and take a 20-min nap next day if you can.`,
      );
    }
  }
  return insights;
}

function buildWarnings(
  profile: Profile,
  event: WeekEvent,
  specs: SessionSpec[],
  assignment: Assignment,
  trainable: DayContext[],
  contexts: DayContext[],
): string[] {
  const warnings: string[] = [];
  if (trainable.length < specs.length) {
    const eventNote =
      event.day && profile.availableDays.includes(event.day)
        ? ` (${DAY_NAMES[event.day]} is taken by the ${isMatch(event.kind) ? 'match' : 'race'})`
        : '';
    warnings.push(
      `${specs.length} sessions wanted but only ${trainable.length} training days are open${eventNote} — lowest-priority work drops first.`,
    );
  }

  const eventIndex = event.day ? dayIndex(event.day) : null;
  assignment.placements.forEach((placement, i) => {
    if (placement) return;
    const spec = specs[i];
    const withWindow = trainable.filter((ctx) => slotsFor(spec, ctx, profile, event.time).length > 0);
    const rightDistance = withWindow.filter(
      (ctx) => eventIndex === null || !spec.allowed || spec.allowed(ctx.index - eventIndex),
    );
    const reason =
      withWindow.length === 0
        ? `no ${spec.minutes}-min window fits around work and sleep on your open days`
        : rightDistance.length === 0
          ? (spec.needs ?? 'none of your open days sit in the right place around the event')
          : 'your open days went to higher-priority sessions';
    warnings.push(`${spec.title} skipped — ${reason}.`);
  });

  if (event.day && event.time !== null) {
    const block = eventBlock(event);
    const work = contexts[dayIndex(event.day)].work;
    if (block && work && overlaps(block, { start: work.start, end: work.end + profile.commuteMinutes })) {
      warnings.push(
        `${DAY_NAMES[event.day]}: your shift runs into the ${formatClock(block.start)} arrival time — plan to leave early.`,
      );
    }
  }
  return warnings;
}
