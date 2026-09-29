import { DEFAULT_PROFILE } from '../defaults';
import { EVENT_ORDER, makeEvent } from '../events';
import { buildWeekPlan, sleepWindowFor } from '../scheduler';
import { dayIndex, hm, overlaps } from '../time';
import type { PlanSession, Profile } from '../types';

const MONDAY = new Date(2026, 8, 28);

const training = (sessions: PlanSession[]) => sessions.filter((s) => !s.isEvent);
const allTraining = (plan: ReturnType<typeof buildWeekPlan>) => plan.days.flatMap((d) => training(d.sessions));
const find = (plan: ReturnType<typeof buildWeekPlan>, key: string) =>
  allTraining(plan).find((s) => s.id.endsWith(`:${key}`));

describe('sleep window', () => {
  it('derives lights-out and wind-down from wake time and sleep need', () => {
    const sleep = sleepWindowFor(DEFAULT_PROFILE);
    expect(sleep.lightsOut).toBe(hm(23));
    expect(sleep.windDown).toBe(hm(22, 30));
    expect(sleep.hardCutoff).toBe(hm(21));
  });
});

describe.each(EVENT_ORDER)('%s week with the default profile', (kind) => {
  const plan = buildWeekPlan(DEFAULT_PROFILE, makeEvent(kind), MONDAY);

  it('only trains on open days and never on the event day', () => {
    for (const day of plan.days) {
      const sessions = training(day.sessions);
      if (sessions.length === 0) continue;
      expect(DEFAULT_PROFILE.availableDays).toContain(day.day);
      expect(day.day).not.toBe(plan.event.day);
      expect(sessions).toHaveLength(1);
    }
  });

  it('keeps every session clear of work, commute and commitments', () => {
    for (const day of plan.days) {
      const work = DEFAULT_PROFILE.work[day.day];
      for (const s of training(day.sessions)) {
        const block = { start: s.start, end: s.end };
        if (work) {
          expect(
            overlaps(block, {
              start: work.start - DEFAULT_PROFILE.commuteMinutes,
              end: work.end + DEFAULT_PROFILE.commuteMinutes,
            }),
          ).toBe(false);
        }
        for (const c of DEFAULT_PROFILE.commitments.filter((c) => c.day === day.day)) {
          expect(overlaps(block, c)).toBe(false);
        }
      }
    }
  });

  it('finishes hard sessions at least 2 h before lights out', () => {
    for (const day of plan.days) {
      for (const s of training(day.sessions).filter((s) => s.intensity >= 6)) {
        expect(day.lightsOut - s.end).toBeGreaterThanOrEqual(120);
      }
    }
  });

  it('explains every placement', () => {
    for (const s of allTraining(plan)) expect(s.why.length).toBeGreaterThan(0);
  });
});

describe('match week', () => {
  const plan = buildWeekPlan(DEFAULT_PROFILE, makeEvent('midweek-match', 'Wed'), MONDAY);
  const matchDay = dayIndex('Wed');

  it('keeps heavy legs 72 h+ away from kick-off', () => {
    const lower = find(plan, 'lower-strength');
    expect(lower).toBeDefined();
    const offset = dayIndex(lower!.day) - matchDay;
    expect(offset <= -3 || offset >= 2).toBe(true);
  });

  it('primes the day before and flushes the day after', () => {
    expect(find(plan, 'primer')?.day).toBe('Tue');
    expect(find(plan, 'recovery')?.day).toBe('Thu');
  });

  it('marks the fuel-up and game days for nutrition', () => {
    expect(plan.days[dayIndex('Tue')].load).toBe('fuel-up');
    expect(plan.days[dayIndex('Wed')].load).toBe('event');
    expect(plan.days[dayIndex('Wed')].sessions[0].isEvent).toBe(true);
  });
});

describe('hypertrophy week', () => {
  const plan = buildWeekPlan(DEFAULT_PROFILE, makeEvent('hypertrophy'), MONDAY);
  const lifts = allTraining(plan);

  it('never puts the same muscle group on back-to-back days', () => {
    for (const a of lifts) {
      for (const b of lifts) {
        if (a === b) continue;
        const pattern = (s: PlanSession) => (s.title.startsWith('Upper') ? 'upper' : s.title.startsWith('Lower') ? 'lower' : s.title);
        if (pattern(a) === pattern(b)) {
          expect(Math.abs(dayIndex(a.day) - dayIndex(b.day))).toBeGreaterThan(1);
        }
      }
    }
  });

  it('runs A sessions before B sessions', () => {
    expect(dayIndex(find(plan, 'upper-a')!.day)).toBeLessThan(dayIndex(find(plan, 'upper-b')!.day));
    expect(dayIndex(find(plan, 'lower-a')!.day)).toBeLessThan(dayIndex(find(plan, 'lower-b')!.day));
  });
});

describe('10K week', () => {
  const plan = buildWeekPlan(DEFAULT_PROFILE, makeEvent('10k', 'Sun'), MONDAY);

  it('puts the last hard run 4+ days out and a shakeout just before', () => {
    const intervals = find(plan, 'race-pace')!;
    expect(dayIndex('Sun') - dayIndex(intervals.day)).toBeGreaterThanOrEqual(4);
    const shakeout = find(plan, 'shakeout')!;
    expect(dayIndex('Sun') - dayIndex(shakeout.day)).toBeLessThanOrEqual(2);
  });

  it('pulls lights-out earlier the night before an early start', () => {
    const saturday = plan.days[dayIndex('Sat')];
    expect(saturday.lightsOut).toBeLessThan(plan.sleep.lightsOut);
    expect(plan.insights.some((line) => line.includes('early start'))).toBe(true);
  });
});

describe('late shifts', () => {
  const lateShift: Profile = {
    ...DEFAULT_PROFILE,
    chronotype: 'neutral',
    availableDays: ['Mon', 'Tue', 'Thu', 'Fri'],
    work: {
      ...DEFAULT_PROFILE.work,
      Mon: { start: hm(10), end: hm(20) },
      Tue: { start: hm(10), end: hm(20) },
      Thu: { start: hm(10), end: hm(20) },
      Fri: { start: hm(10), end: hm(20) },
    },
  };

  it('moves training before work when the evening would cut into sleep', () => {
    const plan = buildWeekPlan(lateShift, makeEvent('hypertrophy'), MONDAY);
    const lifts = allTraining(plan);
    expect(lifts).toHaveLength(4);
    for (const s of lifts) expect(s.end).toBeLessThanOrEqual(hm(10) - lateShift.commuteMinutes);
    expect(plan.insights.some((line) => line.includes('before work'))).toBe(true);
  });
});

describe('constraints and state', () => {
  it('warns when there are more sessions than open days', () => {
    const plan = buildWeekPlan({ ...DEFAULT_PROFILE, availableDays: ['Mon', 'Thu'] }, makeEvent('hypertrophy'), MONDAY);
    expect(allTraining(plan)).toHaveLength(2);
    expect(plan.warnings.length).toBeGreaterThan(0);
  });

  it('carries completion through by session id', () => {
    const first = buildWeekPlan(DEFAULT_PROFILE, makeEvent('hypertrophy'), MONDAY);
    const id = allTraining(first)[0].id;
    const second = buildWeekPlan(DEFAULT_PROFILE, makeEvent('hypertrophy'), MONDAY, new Set([id]));
    expect(allTraining(second).find((s) => s.id === id)?.completed).toBe(true);
  });
});
