import { DEFAULT_PROFILE } from '../defaults';
import { makeEvent } from '../events';
import {
  dayTasks,
  eatenMacros,
  emptyWeek,
  migrateLogs,
  progress,
  readiness,
  removeCustomMeal,
  saveCheckIn,
  saveCustomMeal,
  setEffort,
  setSessionDone,
  toggleItem,
  toggleMeal,
} from '../logbook';
import { buildWeekFuel } from '../mealPlanner';
import { buildWeekPlan } from '../scheduler';

const plan = buildWeekPlan(DEFAULT_PROFILE, makeEvent('hypertrophy'), new Date(2026, 8, 28));
const fuel = buildWeekFuel(DEFAULT_PROFILE, plan);
const monday = plan.days[0];

describe('logbook', () => {
  it('lists sessions, habits and meals for a day in time order', () => {
    const tasks = dayTasks(monday, fuel.days[0], emptyWeek());
    expect(tasks.some((t) => t.kind === 'session')).toBe(true);
    expect(tasks.some((t) => t.kind === 'meal')).toBe(true);
    expect(tasks.some((t) => t.kind === 'habit')).toBe(true);
    for (let i = 1; i < tasks.length; i += 1) expect(tasks[i].start).toBeGreaterThanOrEqual(tasks[i - 1].start);
    expect(progress(tasks)).toMatchObject({ done: 0, ratio: 0 });
  });

  it('logs a session with effort and can undo it', () => {
    const id = monday.sessions[0].id;
    let week = setEffort(emptyWeek(), id, 8);
    let session = dayTasks(monday, fuel.days[0], week).find((t) => t.sessionId === id)!;
    expect(session).toMatchObject({ done: true, effort: 8 });
    week = setSessionDone(week, id, false);
    session = dayTasks(monday, fuel.days[0], week).find((t) => t.sessionId === id)!;
    expect(session.done).toBe(false);
  });

  it('counts eaten meals toward the day', () => {
    const meal = fuel.days[0].meals[0];
    const week = toggleMeal(emptyWeek(), meal.id);
    expect(eatenMacros(fuel.days[0], week).kcal).toBeCloseTo(meal.totals.kcal);
    expect(toggleMeal(week, meal.id).meals).toEqual([]);
  });

  it('toggles habits', () => {
    const key = monday.micro[0].key;
    expect(toggleItem(emptyWeek(), key).items).toEqual([key]);
  });

  it('turns a check-in into plain advice', () => {
    expect(readiness(undefined)).toBeNull();
    const rough = saveCheckIn(emptyWeek(), '2026-09-28', { sleepHours: 5, feel: 2 });
    expect(readiness(rough.checkIns['2026-09-28'])?.tone).toBe('easy');
    const fresh = saveCheckIn(emptyWeek(), '2026-09-28', { sleepHours: 8, feel: 5 });
    expect(readiness(fresh.checkIns['2026-09-28'])?.tone).toBe('go');
  });

  it('counts your own meals and drops the planned meal they replace', () => {
    const fuelDay = fuel.days[0];
    const lunch = fuelDay.meals.find((m) => m.title.startsWith('Lunch'))!;
    let week = toggleMeal(emptyWeek(), lunch.id);
    week = saveCustomMeal(week, fuelDay.date, {
      id: 'custom-1',
      name: 'Chipotle bowl',
      time: lunch.time,
      kcal: 850,
      p: 45,
      c: 95,
      f: 28,
      replaces: lunch.id,
    });
    // Swapping un-ticks the planned lunch and counts only the real one.
    expect(week.meals).not.toContain(lunch.id);
    expect(eatenMacros(fuelDay, week)).toMatchObject({ kcal: 850, p: 45 });

    const tasks = dayTasks(monday, fuelDay, week);
    expect(tasks.find((t) => t.key === lunch.id)).toBeUndefined();
    expect(tasks.find((t) => t.key === 'custom-1')).toMatchObject({ done: true, custom: true, title: 'Chipotle bowl' });

    week = removeCustomMeal(week, fuelDay.date, 'custom-1');
    expect(eatenMacros(fuelDay, week).kcal).toBe(0);
    expect(dayTasks(monday, fuelDay, week).find((t) => t.key === lunch.id)).toBeDefined();
  });

  it('edits a saved custom meal in place', () => {
    const date = fuel.days[0].date;
    const meal = { id: 'c1', name: 'Wings', time: 1200, kcal: 900, p: 60, c: 10, f: 65 };
    let week = saveCustomMeal(emptyWeek(), date, meal);
    week = saveCustomMeal(week, date, { ...meal, kcal: 700 });
    expect(week.custom[date]).toHaveLength(1);
    expect(week.custom[date][0].kcal).toBe(700);
  });

  it('migrates the original storage format', () => {
    const logs = migrateLogs({
      completed: { '2026-W40': ['2026-W40:upper-a'] },
      done: { '2026-W40': ['Mon:mobility'] },
      shopping: { '2026-W39': ['rice'] },
    });
    expect(Object.keys(logs['2026-W40'].sessions)).toEqual(['2026-W40:upper-a']);
    expect(logs['2026-W40'].items).toEqual(['Mon:mobility']);
    expect(logs['2026-W39'].shopping).toEqual(['rice']);
  });
});
