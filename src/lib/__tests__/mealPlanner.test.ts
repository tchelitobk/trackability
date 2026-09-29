import { DEFAULT_PROFILE } from '../defaults';
import { EVENT_ORDER, EVENT_PRESETS, makeEvent } from '../events';
import { FOODS, type FoodTag } from '../foods';
import { buildWeekFuel } from '../mealPlanner';
import { buildWeekPlan } from '../scheduler';
import { dayIndex } from '../time';
import type { Profile } from '../types';

const MONDAY = new Date(2026, 8, 28);

const fuelFor = (profile: Profile, kind: (typeof EVENT_ORDER)[number]) => {
  const plan = buildWeekPlan(profile, makeEvent(kind), MONDAY);
  return { plan, fuel: buildWeekFuel(profile, plan) };
};

const foodsIn = (fuel: ReturnType<typeof buildWeekFuel>) =>
  fuel.days.flatMap((d) => d.meals.flatMap((m) => m.items.map((i) => i.food)));

describe.each(EVENT_ORDER)('%s week fueling', (kind) => {
  const { plan, fuel } = fuelFor(DEFAULT_PROFILE, kind);

  it('lands each day close to its targets', () => {
    for (const day of fuel.days) {
      expect(Math.abs(day.actual.kcal - day.targets.kcal) / day.targets.kcal).toBeLessThan(0.08);
      expect(day.actual.p).toBeGreaterThanOrEqual(day.targets.p * 0.95);
      expect(day.actual.p).toBeLessThanOrEqual(day.targets.p * 1.3);
      expect(Math.abs(day.actual.c - day.targets.c) / day.targets.c).toBeLessThan(0.1);
    }
  });

  it('eats more carbohydrate on bigger days', () => {
    const rest = fuel.days.find((d) => d.load === 'rest');
    const biggest = fuel.days.reduce((a, b) => (b.targets.c > a.targets.c ? b : a));
    if (rest) expect(biggest.targets.c).toBeGreaterThan(rest.targets.c);
  });

  it('builds a shopping list that matches the meals exactly', () => {
    const totals = new Map<string, number>();
    for (const day of fuel.days) {
      for (const meal of day.meals) for (const item of meal.items) totals.set(item.food, (totals.get(item.food) ?? 0) + item.grams);
    }
    const listed = new Map(fuel.shopping.flatMap((g) => g.items.map((i) => [i.food, i.grams] as const)));
    expect(listed).toEqual(totals);
  });

  it('splits prep so nothing sits in the fridge more than 4 days', () => {
    const covered = fuel.blocks.flatMap((b) => b.covers);
    expect(covered).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    for (const block of fuel.blocks) expect(block.covers.length).toBeLessThanOrEqual(4);
    expect(fuel.blocks[1].prepDay).not.toBe(plan.event.day);
  });
});

describe('competition-day timing', () => {
  it.each(['midweek-match', 'weekend-match', '10k', 'hyrox'] as const)('%s: pre-event meal 2–4 h out, recovery soon after', (kind) => {
    const { plan, fuel } = fuelFor(DEFAULT_PROFILE, kind);
    const event = plan.event;
    const day = fuel.days[dayIndex(event.day!)];
    const pre = day.meals.find((m) => m.role === 'pre-event')!;
    expect(event.time! - pre.time).toBeGreaterThanOrEqual(120);
    expect(event.time! - pre.time).toBeLessThanOrEqual(240);
    const end = event.time! + EVENT_PRESETS[kind].minutes;
    const recovery = day.meals.find((m) => m.role === 'recovery')!;
    expect(recovery.time - end).toBeLessThanOrEqual(45);
  });

  it('eats the late-session dinner on the break, well before training', () => {
    const { plan, fuel } = fuelFor(DEFAULT_PROFILE, 'hypertrophy');
    const monday = plan.days[0];
    const session = monday.sessions[0];
    const dinner = fuel.days[0].meals.find((m) => m.title === 'Early dinner')!;
    expect(session.start - dinner.time).toBeGreaterThanOrEqual(90);
  });
});

describe('dietary filters', () => {
  const banned = (profile: Profile, tags: FoodTag[]) => {
    for (const kind of EVENT_ORDER) {
      const { fuel } = fuelFor(profile, kind);
      for (const food of foodsIn(fuel)) {
        for (const tag of tags) expect({ food, tag, has: FOODS[food].tags.includes(tag) }).toEqual({ food, tag, has: false });
      }
    }
  };

  it('keeps vegetarian weeks free of meat and fish', () => banned({ ...DEFAULT_PROFILE, diet: 'vegetarian' }, ['meat', 'fish']));
  it('keeps pescatarian weeks free of meat', () => banned({ ...DEFAULT_PROFILE, diet: 'pescatarian' }, ['meat']));
  it('respects dairy-free and nut-free', () => banned({ ...DEFAULT_PROFILE, exclusions: ['dairy', 'nuts'] }, ['dairy', 'nuts']));
  it('respects gluten-free', () => banned({ ...DEFAULT_PROFILE, exclusions: ['gluten'] }, ['gluten']));

  it('still hits protein on a vegetarian, dairy-free week', () => {
    const { fuel } = fuelFor({ ...DEFAULT_PROFILE, diet: 'vegetarian', exclusions: ['dairy'] }, 'hypertrophy');
    for (const day of fuel.days) expect(day.actual.p).toBeGreaterThanOrEqual(day.targets.p * 0.9);
  });
});
