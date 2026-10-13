import { isMatch } from './events';
import type { Macros } from './foods';
import type { DayLoad, EventKind, Profile } from './types';

export const LB_TO_KG = 0.45359237;

export const bodyKg = (profile: Profile) => profile.bodyWeightLb * LB_TO_KG;

/**
 * Carbohydrate periodization ("fuel for the work required"): g/kg/day
 * scales with the day's training, and peaks the day before and the day of
 * a competition. Ranges follow sports-nutrition consensus guidance
 * (3–5 g/kg light days, 6–10 g/kg for high loads and fueling up).
 */
const CARBS_BY_LOAD: Record<Exclude<DayLoad, 'fuel-up' | 'event'>, number> = {
  rest: 4,
  light: 4.5,
  moderate: 5.5,
  high: 6.5,
};

function competitionCarbs(kind: EventKind, load: 'fuel-up' | 'event'): number {
  if (isMatch(kind)) return load === 'fuel-up' ? 7 : 7.5;
  if (kind === '10k') return load === 'fuel-up' ? 6.5 : 6;
  return load === 'fuel-up' ? 8 : 7.5; // HYROX: 60–90 min, carb-load 36 h out
}

export type DayTargets = Macros & {
  /** g/kg used, for display. */
  perKg: { p: number; c: number; f: number };
};

export function dailyTargets(
  profile: Profile,
  load: DayLoad,
  eventKind: EventKind,
  daysToEvent: number | null,
): DayTargets {
  const kg = bodyKg(profile);
  const training = load === 'light' || load === 'moderate' || load === 'high';

  let carbs = load === 'fuel-up' || load === 'event' ? competitionCarbs(eventKind, load) : CARBS_BY_LOAD[load];
  if (eventKind === 'hyrox' && daysToEvent === 2) carbs = Math.max(carbs, 6);
  if (eventKind === 'hypertrophy' && training) carbs += 0.5;
  if (eventKind === 'deload') carbs -= 0.5;
  if ((profile.sport === 'running' || profile.sport === 'hyrox') && load === 'high') carbs += 0.5;

  const protein = eventKind === 'hypertrophy' ? 2.2 : eventKind === 'deload' ? 1.8 : 2;
  const fat = load === 'fuel-up' || load === 'event' ? 0.8 : eventKind === 'hypertrophy' ? 1.1 : 1;

  const p = Math.round(protein * kg);
  const c = Math.round(carbs * kg);
  const f = Math.round(fat * kg);
  return { p, c, f, kcal: p * 4 + c * 4 + f * 9, perKg: { p: protein, c: carbs, f: fat } };
}

export const LOAD_LABELS: Record<DayLoad, string> = {
  rest: 'Rest day',
  light: 'Light day',
  moderate: 'Training day',
  high: 'Big day',
  'fuel-up': 'Fuel-up day',
  event: 'Game day',
};

export function weekEmphasis(kind: EventKind): { headline: string; detail: string } {
  switch (kind) {
    case 'hypertrophy':
      return {
        headline: 'Small surplus, protein at 2.2 g/kg',
        detail: 'Carbs rise on lifting days to fuel volume; protein spread across 4–5 feedings.',
      };
    case 'midweek-match':
    case 'weekend-match':
      return {
        headline: 'Carb up the day before, refuel after the whistle',
        detail: 'Carbs climb to ~7 g/kg the day before and the day of the match; low fat and fiber pre-game.',
      };
    case '10k':
      return {
        headline: 'Top up the day before, light race breakfast',
        detail: 'A 10K doesn\'t need a full carb-load: ~6.5 g/kg the day before, familiar carbs 2–3 h before the gun.',
      };
    case 'hyrox':
      return {
        headline: 'Carb-load 36 h out, fuel mid-race',
        detail: '~8 g/kg the day before; keep fiber low; gel or chews around stations 4 and 6.',
      };
    case 'deload':
      return {
        headline: 'Maintenance, protein steady',
        detail: 'Carbs dip with volume; keep protein high to hold onto adaptations while you recover.',
      };
  }
}
