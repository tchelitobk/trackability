import { EVENT_PRESETS, isMatch } from './events';
import {
  addMacros,
  allowedFood,
  FOODS,
  macrosFor,
  portionParts,
  purchaseLabel,
  ZERO,
  type Aisle,
  type FoodId,
  type Macros,
} from './foods';
import { dailyTargets, LOAD_LABELS, weekEmphasis, type DayTargets } from './nutrition';
import {
  carbOptions,
  proteinOptions,
  rotate,
  vegOptions,
  type CarbRecipe,
  type ProteinRecipe,
  type VegRecipe,
} from './recipes';
import { preEventMealTime } from './scheduler';
import { dayIndex, DAY_NAMES, formatClock, hm, overlaps, roundTo } from './time';
import {
  type DayKey,
  type DayLoad,
  type Minutes,
  type PlanDay,
  type Profile,
  type WeekPlan,
} from './types';

export type MealRole =
  | 'breakfast'
  | 'pre'
  | 'lunch'
  | 'snack'
  | 'carb-top-up'
  | 'dinner'
  | 'recovery'
  | 'evening'
  | 'pre-event'
  | 'top-up';

export type MealItem = {
  food: FoodId;
  name: string;
  amount: string;
  grams: number;
  macros: Macros;
};

export type Meal = {
  id: string;
  role: MealRole;
  time: Minutes;
  title: string;
  note?: string;
  /** Comes out of a batch-prep container. */
  prepped: boolean;
  items: MealItem[];
  totals: Macros;
};

export type DayFuel = {
  day: DayKey;
  date: string;
  load: DayLoad;
  loadLabel: string;
  targets: DayTargets;
  actual: Macros;
  meals: Meal[];
  notes: string[];
  block: 'A' | 'B';
};

export type PrepBatch = { name: string; amount: string; detail: string; method: string };

export type PrepBlock = {
  id: 'A' | 'B';
  prepDay: DayKey;
  when: string;
  covers: DayKey[];
  minutes: number;
  containers: number;
  batches: PrepBatch[];
  steps: string[];
};

export type ShoppingItem = { food: FoodId; name: string; amount: string; grams: number };

export type WeekFuel = {
  weekId: string;
  headline: string;
  detail: string;
  days: DayFuel[];
  blocks: PrepBlock[];
  shopping: { aisle: Aisle; items: ShoppingItem[] }[];
  averages: Macros;
};

// ─── Meal building blocks ───────────────────────────────────────────────────

type Portion = { food: FoodId; grams: number };

type Filter = Pick<Profile, 'diet' | 'exclusions'>;

const can = (food: FoodId, filter: Filter) => allowedFood(FOODS[food], filter.diet, filter.exclusions);

/** First food in the list the athlete can eat. */
const pick = (filter: Filter, ...options: FoodId[]): FoodId | null =>
  options.find((food) => can(food, filter)) ?? null;

const portions = (...items: (Portion | null | false)[]) => items.filter((p): p is Portion => Boolean(p));

const unit = (food: FoodId, count = 1): Portion => ({ food, grams: (FOODS[food].unit?.grams ?? 100) * count });

type BreakfastStyle = 'oats' | 'egg-bites';

function breakfastItems(style: BreakfastStyle, filter: Filter, big: boolean): { title: string; items: Portion[] } {
  if (style === 'egg-bites' && can('eggs', filter)) {
    const carb = pick(filter, 'bagel') ? unit('bagel') : unit('riceCakes', 3);
    return {
      title: 'Egg bites + carbs',
      items: portions(
        unit('eggs', 3),
        { food: 'eggWhites', grams: 100 },
        { food: 'spinach', grams: 30 },
        { food: 'peppers', grams: 50 },
        carb,
        big && unit('banana'),
      ),
    };
  }
  const dairy = can('greekYogurt', filter);
  return {
    title: 'Overnight oats',
    items: portions(
      { food: 'oats', grams: big ? 100 : 80 },
      dairy ? { food: 'greekYogurt', grams: 170 } : { food: 'soyMilk', grams: 240 },
      !dairy && unit('plantProtein'),
      { food: 'berries', grams: 75 },
      { food: 'chia', grams: 12 },
      { food: 'honey', grams: 14 },
      big && unit('banana'),
    ),
  };
}

function snackItems(filter: Filter, big = false): Portion[] {
  const fat = pick(filter, 'almonds', 'pumpkinSeeds')!;
  if (can('greekYogurt', filter)) {
    return portions(
      { food: 'greekYogurt', grams: 170 },
      { food: 'berries', grams: 75 },
      { food: fat, grams: 20 },
      big && unit('banana'),
      big && { food: 'honey', grams: 14 },
    );
  }
  return portions(
    unit('banana'),
    unit('riceCakes', big ? 4 : 2),
    { food: pick(filter, 'peanutButter', 'pumpkinSeeds')!, grams: 24 },
    big && { food: 'honey', grams: 14 },
  );
}

const preSessionItems = (hard: boolean): Portion[] =>
  hard ? [unit('banana'), unit('riceCakes', 2), { food: 'honey', grams: 14 }] : [unit('banana')];

function recoveryItems(filter: Filter, big: boolean): Portion[] {
  const dairy = can('chocolateMilk', filter);
  const extraCarb = big ? (can('bagel', filter) ? unit('bagel') : unit('riceCakes', 3)) : null;
  return portions(
    dairy ? { food: 'chocolateMilk', grams: 355 } : { food: 'soyMilk', grams: 355 },
    dairy ? unit('whey') : unit('plantProtein'),
    !dairy && unit('banana'),
    extraCarb,
    big && !can('bagel', filter) && { food: 'honey', grams: 14 },
  );
}

function eveningItems(filter: Filter): Portion[] {
  if (can('cottageCheese', filter)) {
    return [{ food: 'cottageCheese', grams: 200 }, { food: 'berries', grams: 75 }];
  }
  return [unit('plantProtein'), { food: 'soyMilk', grams: 240 }, { food: 'chia', grams: 12 }];
}

function carbTopUpItems(filter: Filter, drink: boolean): Portion[] {
  const base = can('bagel', filter) ? [unit('bagel')] : [unit('riceCakes', 4)];
  return portions(...base, { food: 'honey', grams: 21 }, drink && { food: 'sportsDrink', grams: 591 });
}

function raceBreakfastItems(filter: Filter): Portion[] {
  const base = can('bagel', filter) ? [unit('bagel')] : [unit('riceCakes', 4)];
  return [...base, { food: 'honey', grams: 21 }, unit('banana'), { food: 'sportsDrink', grams: 473 }];
}

// ─── Bowls (the prepped containers) ─────────────────────────────────────────

type Bowl = {
  role: MealRole;
  time: Minutes;
  title: string;
  protein: ProteinRecipe;
  carb: CarbRecipe;
  veg: VegRecipe | null;
  /** Pre-competition bowls stay low in fat and fiber. */
  lean: boolean;
  note?: string;
};

// Base portion sizes the solver scales: ~30 g protein, ~60 g carbs, 1 tsp oil.
const proteinBase = (food: FoodId) => (30 / FOODS[food].p) * 100;
const carbBase = (food: FoodId) => (60 / FOODS[food].c) * 100;
const OIL_BASE = 4.5;

const BOUNDS = { p: [0.85, 2], c: [0.25, 2.2], f: [0, 4] } as const;

type Scales = { p: number; c: number; f: number };

function bowlFixed(bowl: Bowl): Portion[] {
  const veg = bowl.veg
    ? bowl.veg.foods.map((f) => ({ food: f.food, grams: bowl.lean ? Math.round(f.grams * 0.4) : f.grams }))
    : [];
  return [...bowl.protein.extras.map((e) => ({ ...e })), ...veg];
}

function bowlPortions(bowl: Bowl, s: Scales): Portion[] {
  const proteinFood = bowl.protein.main;
  const carbFood = bowl.carb.food;
  const carbStep = FOODS[carbFood].cooked && FOODS[carbFood].cooked! >= 2 ? 5 : 10;
  const main: Portion = { food: proteinFood, grams: roundTo(proteinBase(proteinFood) * s.p, 5) };
  const carb: Portion = { food: carbFood, grams: roundTo(carbBase(carbFood) * s.c, carbStep) };
  const oil = bowl.lean ? 0 : roundTo(OIL_BASE * s.f, 2.25);
  return portions(main, carb, ...bowlFixed(bowl), oil > 0 && { food: 'oliveOil', grams: oil });
}

const sum = (items: Portion[]) => items.reduce((acc, item) => addMacros(acc, macrosFor(item.food, item.grams)), ZERO);

/**
 * Size the day's bowls so the whole day lands on target. Everything outside
 * the bowls is fixed; three knobs remain (protein, carb and oil portions),
 * solved by projected coordinate descent on a protein-weighted error.
 */
function solveBowls(targets: Macros, fixed: Macros, bowls: Bowl[]): Scales {
  const fixedAll = bowls.reduce((acc, bowl) => addMacros(acc, sum(bowlFixed(bowl))), fixed);
  const column = (fn: (bowl: Bowl) => Portion | null) =>
    bowls.reduce((acc, bowl) => {
      const portion = fn(bowl);
      return portion ? addMacros(acc, macrosFor(portion.food, portion.grams)) : acc;
    }, ZERO);
  const cols = {
    p: column((b) => ({ food: b.protein.main, grams: proteinBase(b.protein.main) })),
    c: column((b) => ({ food: b.carb.food, grams: carbBase(b.carb.food) })),
    f: column((b) => (b.lean ? null : { food: 'oliveOil', grams: OIL_BASE })),
  };
  const residual = { p: targets.p - fixedAll.p, c: targets.c - fixedAll.c, f: targets.f - fixedAll.f };
  const weight = { p: 4, c: 1, f: 1.5 };
  const s: Scales = { p: 1, c: 1, f: 1 };
  const keys = ['p', 'c', 'f'] as const;

  for (let iteration = 0; iteration < 60; iteration += 1) {
    for (const g of keys) {
      let numerator = 0;
      let denominator = 0;
      for (const m of keys) {
        const others = keys.filter((h) => h !== g).reduce((acc, h) => acc + cols[h][m] * s[h], 0);
        numerator += weight[m] * cols[g][m] * (residual[m] - others);
        denominator += weight[m] * cols[g][m] * cols[g][m];
      }
      const [lo, hi] = BOUNDS[g];
      s[g] = denominator > 0 ? Math.min(hi, Math.max(lo, numerator / denominator)) : 0;
    }
  }
  return s;
}

// ─── Day plan ───────────────────────────────────────────────────────────────

type BlockMenu = {
  lunch: ProteinRecipe;
  dinner: ProteinRecipe;
  lean: ProteinRecipe;
  carbs: [CarbRecipe, CarbRecipe];
  /** Rice or pasta: carbs without the bulk, for big days. */
  leanCarb: CarbRecipe;
  veg: VegRecipe;
  breakfast: BreakfastStyle;
};

type DraftMeal = Omit<Meal, 'items' | 'totals'> & {
  portions?: Portion[];
  bowl?: Bowl;
  /** Unprepped extras served with the meal (a drink next to a bowl). */
  sides?: Portion[];
};

function draftMeals(
  day: PlanDay,
  plan: WeekPlan,
  menu: BlockMenu,
  filter: Filter,
  targets: DayTargets,
): { drafts: DraftMeal[]; notes: string[] } {
  const { sleep, event } = plan;
  const drafts: DraftMeal[] = [];
  const notes: string[] = [];
  const add = (meal: Omit<DraftMeal, 'id'>) => drafts.push({ ...meal, id: `${day.day}:${meal.role}:${drafts.length}` });
  // Big-carb days get denser carbs and bigger snacks so the bowls stay a sane size.
  const big = targets.perKg.c >= 5.5;
  const bowl = (role: MealRole, time: Minutes, title: string, which: 'lunch' | 'dinner' | 'lean', note?: string) => {
    // The night before competing, dinner is the low-fiber, low-fat lean bowl.
    const fuelUpDinner = role === 'dinner' && day.load === 'fuel-up';
    const lean = which === 'lean' || fuelUpDinner;
    if (fuelUpDinner) note = 'Low fiber and fat so it sits light tomorrow';
    const protein = lean ? menu.lean : menu[which];
    const planned = which === 'lunch' ? menu.carbs[0] : menu.carbs[1];
    // Potatoes are too bulky to carry a big-day carb target.
    const bulky = FOODS[planned.food].c < 30;
    const carb = lean || (big && bulky) ? menu.leanCarb : planned;
    add({
      role,
      time,
      title,
      note,
      prepped: true,
      bowl: { role, time, title, protein, carb, veg: lean ? null : menu.veg, lean },
    });
  };
  const breakfast = breakfastItems(menu.breakfast, filter, big);
  const eveningTime = day.lightsOut - 60;
  const main = day.sessions.find((s) => !s.isEvent);
  const eventSession = day.sessions.find((s) => s.isEvent);

  if (eventSession && event.time !== null) {
    const mealTime = preEventMealTime(event.time);
    const end = eventSession.end;
    const label = isMatch(event.kind) ? 'match' : 'race';
    const early = mealTime < sleep.wake + 60;
    if (early) {
      add({ role: 'pre-event', time: mealTime, title: `Pre-${label} breakfast`, note: '1–2 g/kg carbs you\'ve eaten before a hard session', prepped: false, portions: raceBreakfastItems(filter) });
    } else {
      add({ role: 'breakfast', time: sleep.wake + 30, title: breakfast.title, prepped: menu.breakfast === 'egg-bites', portions: breakfast.items });
      if (mealTime - hm(12, 30) >= 150) {
        add({ role: 'carb-top-up', time: hm(10, 30), title: 'Carb top-up', prepped: false, portions: carbTopUpItems(filter, false) });
        bowl('lunch', hm(12, 30), 'Lunch bowl', 'lunch');
      }
      bowl('pre-event', mealTime, `Pre-${label} meal`, 'lean', 'Carb-heavy, low fat and fiber · 3–4 h before');
    }
    const drink = event.kind !== '10k';
    add({
      role: 'top-up',
      time: event.time - 45,
      title: 'Top-up',
      note: isMatch(event.kind)
        ? 'Sip through the warm-up; sports drink at half-time too'
        : event.kind === 'hyrox'
          ? 'Take a second gel around station 4'
          : 'Optional gel 15 min before the start',
      prepped: false,
      portions: portions(isMatch(event.kind) ? unit('banana') : unit('gel'), drink && { food: 'sportsDrink', grams: 355 }),
    });
    const late = end + 15 > hm(20, 30);
    add({
      role: 'recovery',
      time: end + 15,
      title: late ? 'Recovery + late refuel' : 'Recovery',
      note: late ? 'Drink it on the way home; it doubles as dinner tonight' : 'Within 45 min of the final whistle',
      prepped: false,
      portions: recoveryItems(filter, late || EVENT_PRESETS[event.kind].minutes >= 80),
    });
    if (early) {
      bowl('lunch', Math.max(hm(12, 30), end + 150), 'Lunch bowl', 'lunch');
      add({ role: 'snack', time: hm(15, 30), title: 'Afternoon snack', prepped: false, portions: snackItems(filter) });
    }
    if (!late) {
      bowl('dinner', Math.max(hm(18, 30), end + 120), 'Dinner bowl', 'dinner');
      add({ role: 'evening', time: eveningTime, title: 'Before bed', note: 'Slow protein overnight', prepped: false, portions: eveningItems(filter) });
    }
    notes.push(`Fluids: 5–7 ml/kg 4 h before, then replace ~150% of what you sweat out.`);
  } else if (main && main.start < hm(11)) {
    add({ role: 'pre', time: Math.max(sleep.wake + 5, main.start - 45), title: 'Pre-session', note: 'Small and fast — just enough to train', prepped: false, portions: preSessionItems(false) });
    add({ role: 'breakfast', time: main.end + 30, title: `Post-session ${breakfast.title.toLowerCase()}`, prepped: menu.breakfast === 'egg-bites', portions: breakfast.items });
    bowl('lunch', hm(12, 30), 'Lunch bowl', 'lunch');
    add({ role: day.load === 'fuel-up' ? 'carb-top-up' : 'snack', time: hm(15, 30), title: day.load === 'fuel-up' ? 'Carb top-up' : 'Afternoon snack', prepped: false, portions: day.load === 'fuel-up' ? carbTopUpItems(filter, true) : snackItems(filter) });
    bowl('dinner', hm(18, 30), 'Dinner bowl', 'dinner');
    add({ role: 'evening', time: eveningTime, title: 'Before bed', note: 'Slow protein overnight', prepped: false, portions: eveningItems(filter) });
  } else {
    add({ role: 'breakfast', time: sleep.wake + 30, title: breakfast.title, prepped: menu.breakfast === 'egg-bites', portions: breakfast.items });
    const hard = !!main && main.intensity >= 6;
    const lateSession = !!main && main.end >= hm(20);

    if (main && lateSession) {
      bowl('lunch', hm(12, 30), 'Lunch bowl', 'lunch');
      const dinnerTime = main.start - 120;
      add({
        role: day.load === 'fuel-up' ? 'carb-top-up' : 'snack',
        time: Math.round((hm(12, 30) + dinnerTime) / 2 / 15) * 15,
        title: day.load === 'fuel-up' ? 'Carb top-up' : 'Afternoon snack',
        prepped: false,
        portions: day.load === 'fuel-up' ? carbTopUpItems(filter, true) : snackItems(filter, big),
      });
      bowl('dinner', dinnerTime, 'Early dinner', 'dinner', 'Eat on your break — fuels the session, no late heavy meal');
      if (hard) {
        add({ role: 'recovery', time: main.end + 20, title: 'Post-session recovery', note: 'Protein + carbs, then wind down', prepped: false, portions: recoveryItems(filter, day.load === 'high') });
      } else {
        add({ role: 'evening', time: eveningTime, title: 'Before bed', note: 'Slow protein overnight', prepped: false, portions: eveningItems(filter) });
      }
    } else if (main) {
      const preTime = main.start - 75;
      const bigDay = day.load === 'fuel-up' || day.load === 'high';
      const topUp = () =>
        add({ role: 'carb-top-up', time: hm(10, 30), title: 'Carb top-up', prepped: false, portions: carbTopUpItems(filter, day.load === 'fuel-up') });
      if (preTime - hm(12, 30) >= 90) {
        // Afternoon/evening session: lunch, a pre-session snack, dinner after.
        if (bigDay) topUp();
        bowl('lunch', hm(12, 30), 'Lunch bowl', 'lunch');
        add({ role: 'pre', time: preTime, title: 'Pre-session', note: '60–90 min out', prepped: false, portions: preSessionItems(hard) });
        bowl('dinner', Math.max(hm(18), main.end + 45), 'Dinner bowl', 'dinner');
      } else if (main.start - (sleep.wake + 30) <= 240) {
        // Late-morning session: breakfast fuels it, lunch refuels.
        if (hard && main.start - (sleep.wake + 30) >= 150) {
          add({ role: 'pre', time: main.start - 60, title: 'Pre-session', note: 'Small and fast', prepped: false, portions: preSessionItems(false) });
        }
        bowl('lunch', Math.max(hm(12, 30), main.end + 30), 'Post-session lunch', 'lunch');
        add({
          role: bigDay ? 'carb-top-up' : 'snack',
          time: hm(15, 30),
          title: bigDay ? 'Carb top-up' : 'Afternoon snack',
          prepped: false,
          portions: bigDay ? carbTopUpItems(filter, day.load === 'fuel-up') : snackItems(filter, big),
        });
        bowl('dinner', hm(18, 30), 'Dinner bowl', 'dinner');
      } else {
        // Early-afternoon session: lunch doubles as the pre-session meal.
        if (bigDay) topUp();
        bowl('lunch', main.start - 150, 'Lunch bowl', 'lunch', 'Doubles as your pre-session meal');
        add({ role: 'snack', time: Math.max(hm(15, 30), main.end + 30), title: 'Post-session snack', prepped: false, portions: snackItems(filter, big) });
        bowl('dinner', Math.max(hm(18, 30), main.end + 90), 'Dinner bowl', 'dinner');
      }
      add({ role: 'evening', time: eveningTime, title: 'Before bed', note: 'Slow protein overnight', prepped: false, portions: eveningItems(filter) });
    } else {
      bowl('lunch', hm(12, 30), 'Lunch bowl', 'lunch');
      add({
        role: day.load === 'fuel-up' ? 'carb-top-up' : 'snack',
        time: hm(15, 30),
        title: day.load === 'fuel-up' ? 'Carb top-up' : 'Afternoon snack',
        prepped: false,
        portions: day.load === 'fuel-up' ? carbTopUpItems(filter, true) : snackItems(filter),
      });
      bowl('dinner', hm(18, 30), 'Dinner bowl', 'dinner');
      add({ role: 'evening', time: eveningTime, title: 'Before bed', note: 'Slow protein overnight', prepped: false, portions: eveningItems(filter) });
    }
  }

  if (day.load === 'fuel-up') {
    notes.push('Fuel-up day: white rice over brown, easy on beans, raw veg and fried food tonight.');
  }
  if (plan.event.kind === 'hypertrophy' && main) {
    notes.push('Protein lands in 4–5 feedings of ~0.4 g/kg — the pattern that best supports muscle growth.');
  }
  return { drafts: drafts.sort((a, b) => a.time - b.time), notes };
}

function finishMeal(draft: DraftMeal, scales: Scales): Meal {
  const list = [...(draft.bowl ? bowlPortions(draft.bowl, scales) : (draft.portions ?? [])), ...(draft.sides ?? [])];
  const items = list.map((portion) => {
    const parts = portionParts(portion.food, portion.grams);
    const recipeName =
      draft.bowl && portion.food === draft.bowl.protein.main
        ? draft.bowl.protein.name
        : draft.bowl && portion.food === draft.bowl.carb.food
          ? draft.bowl.carb.name
          : parts.name;
    return {
      food: portion.food,
      name: recipeName,
      amount: parts.amount,
      grams: portion.grams,
      macros: macrosFor(portion.food, portion.grams),
    };
  });
  const { bowl: _bowl, portions: _portions, sides: _sides, ...rest } = draft;
  return { ...rest, items, totals: items.reduce((acc, item) => addMacros(acc, item.macros), ZERO) };
}

/** Midpoint of the longest gap between meals, for slotting in a top-up. */
function gapTime(drafts: DraftMeal[], day: PlanDay): Minutes {
  const times = drafts.map((d) => d.time).sort((a, b) => a - b);
  const busy = day.sessions.map((s) => ({ start: s.start - 30, end: s.end + 15 }));
  let best = times[0] + 120;
  let widest = -1;
  for (let i = 1; i < times.length; i += 1) {
    const mid = roundTo((times[i - 1] + times[i]) / 2, 15);
    const clash = busy.some((b) => mid >= b.start && mid <= b.end);
    if (!clash && times[i] - times[i - 1] > widest) {
      widest = times[i] - times[i - 1];
      best = mid;
    }
  }
  return best;
}

const addSide = (drafts: DraftMeal[], which: number, portion: Portion) => {
  const bowls = drafts.filter((d) => d.bowl);
  const target = bowls[Math.min(which, bowls.length - 1)] ?? drafts[drafts.length - 1];
  target.sides = [...(target.sides ?? []), portion];
};

const CARB_FILLERS: ((drafts: DraftMeal[], day: PlanDay, filter: Filter) => void)[] = [
  (drafts, day, filter) =>
    drafts.push({
      id: `${day.day}:carb-top-up:${drafts.length}`,
      role: 'carb-top-up',
      time: gapTime(drafts, day),
      title: 'Carb top-up',
      prepped: false,
      portions: carbTopUpItems(filter, false),
    }),
  (drafts) => addSide(drafts, 0, { food: 'sportsDrink', grams: 591 }),
  (drafts) => addSide(drafts, 1, { food: 'sportsDrink', grams: 591 }),
  (drafts, day) =>
    drafts.push({
      id: `${day.day}:carb-top-up:${drafts.length}`,
      role: 'carb-top-up',
      time: gapTime(drafts, day),
      title: 'Carb top-up',
      prepped: false,
      portions: [unit('banana'), unit('riceCakes', 2), { food: 'honey', grams: 21 }],
    }),
];

// ─── Prep blocks ────────────────────────────────────────────────────────────

/** The mid-week refresh keeps every container within 4 days of cooking. */
function pickRefreshDay(plan: WeekPlan): DayKey {
  const options: DayKey[] = ['Wed', 'Thu'];
  const eveningFree = (key: DayKey) => {
    const day = plan.days[dayIndex(key)];
    return day.free
      .filter((block) => block.end > hm(17))
      .reduce((acc, block) => acc + block.end - Math.max(block.start, hm(17)), 0) -
      day.sessions.reduce((acc, s) => acc + s.minutes, 0);
  };
  const usable = options.filter((key) => plan.event.day !== key);
  const ranked = (usable.length ? usable : options).sort((a, b) => eveningFree(b) - eveningFree(a));
  return ranked[0];
}

const cupsOf = (food: FoodId, grams: number) => {
  const perCup: Partial<Record<FoodId, number>> = { rice: 185, quinoa: 170, lentils: 192, oats: 80 };
  const cup = perCup[food];
  if (!cup) return null;
  const cups = Math.round((grams / cup) * 4) / 4;
  return `≈ ${cups} cup${cups === 1 ? '' : 's'} dry`;
};

function prepTimeLabel(plan: WeekPlan, key: DayKey, minutes: number): string {
  if (key === 'Sun') return 'Sunday, before the week starts';
  const day = plan.days[dayIndex(key)];
  const busy = day.sessions.map((s) => ({ start: s.start, end: s.end + 30 }));
  for (let start = hm(18); start + minutes <= plan.sleep.windDown - 15; start += 15) {
    const block = { start, end: start + minutes };
    if (day.free.some((f) => start >= f.start && block.end <= f.end) && !busy.some((b) => overlaps(b, block))) {
      return `${DAY_NAMES[key]} ${formatClock(start)}`;
    }
  }
  return `${DAY_NAMES[key]} evening`;
}

function buildBlock(
  id: 'A' | 'B',
  prepDay: DayKey,
  days: DayFuel[],
  plan: WeekPlan,
  recipes: Map<string, Bowl>,
): PrepBlock {
  const totals = new Map<string, { name: string; food: FoodId; grams: number; portions: number; method: string; minutes: number; shortLife?: boolean }>();
  const vegTotals = new Map<string, { recipe: VegRecipe; grams: Map<FoodId, number>; meals: Set<string> }>();
  let containers = 0;
  let oatJars = 0;
  let eggBites = 0;

  const bump = (key: string, entry: { name: string; food: FoodId; grams: number; method: string; minutes: number; shortLife?: boolean }) => {
    const existing = totals.get(key);
    if (existing) {
      existing.grams += entry.grams;
      existing.portions += 1;
    } else {
      totals.set(key, { ...entry, portions: 1 });
    }
  };

  for (const day of days) {
    for (const meal of day.meals) {
      if (!meal.prepped) continue;
      if (meal.role === 'breakfast') {
        if (meal.items.some((i) => i.food === 'eggs')) eggBites += 1;
        continue;
      }
      containers += 1;
      for (const item of meal.items) {
        const recipe = recipes.get(meal.id);
        if (recipe?.protein.main === item.food) {
          bump(`p:${recipe.protein.id}`, { name: recipe.protein.name, food: item.food, grams: item.grams, method: recipe.protein.method, minutes: recipe.protein.minutes, shortLife: recipe.protein.shortLife });
        } else if (recipe?.carb.food === item.food) {
          bump(`c:${recipe.carb.id}`, { name: recipe.carb.name, food: item.food, grams: item.grams, method: recipe.carb.method, minutes: recipe.carb.minutes });
        } else if (recipe?.veg?.foods.some((f) => f.food === item.food)) {
          const veg = vegTotals.get(recipe.veg.id) ?? { recipe: recipe.veg, grams: new Map<FoodId, number>(), meals: new Set<string>() };
          veg.grams.set(item.food, (veg.grams.get(item.food) ?? 0) + item.grams);
          veg.meals.add(meal.id);
          vegTotals.set(recipe.veg.id, veg);
        }
      }
    }
    for (const meal of day.meals) {
      if (meal.role === 'breakfast' && meal.items.some((i) => i.food === 'oats')) oatJars += 1;
    }
  }

  const proteinAndCarbs: PrepBatch[] = [...totals.values()].map((entry) => {
    const food = FOODS[entry.food];
    const cups = cupsOf(entry.food, entry.grams);
    const amount = food.buy === 'lb' ? `${Math.ceil((entry.grams / 453.6) * 10) / 10} lb ${food.cooked && food.cooked < 1.5 ? 'raw' : 'dry'}` : purchaseLabel(entry.food, entry.grams);
    return {
      name: entry.name,
      amount: cups ? `${Math.round(entry.grams)} g dry` : amount,
      detail: cups ?? `${entry.portions} portion${entry.portions === 1 ? '' : 's'}${entry.shortLife ? ' · best within 2 days' : ''}`,
      method: entry.method,
    };
  });
  const vegBatches: PrepBatch[] = [...vegTotals.values()].map(({ recipe, grams, meals }) => ({
    name: recipe.name,
    amount: [...grams.entries()].map(([food, g]) => purchaseLabel(food, g)).join(' + '),
    detail: `${meals.size} portion${meals.size === 1 ? '' : 's'}`,
    method: recipe.method,
  }));
  const batches = [...proteinAndCarbs, ...vegBatches];

  const steps: string[] = [];
  const ovenFirst = batches.some((b) => /°F/.test(b.method));
  if (ovenFirst) steps.push('Oven to 425°F, rice cooker or pot on, two sheet pans out.');
  for (const batch of batches) steps.push(`${batch.name} — ${batch.amount}. ${batch.method}`);
  if (oatJars > 0) steps.push(`Overnight oats: build ${oatJars} jars (oats, yogurt or soy milk, berries, chia, honey).`);
  if (eggBites > 0) steps.push(`Egg bites: ${eggBites * 3} eggs + egg whites + spinach + peppers in a muffin tin, 350°F for 20 min (3 per breakfast).`);
  steps.push(`Cool 20 min, portion into ${containers} containers and label by day. Anything for day 4 goes in the freezer — move it to the fridge the night before.`);

  const longest = Math.max(20, ...[...totals.values()].map((t) => t.minutes));
  const minutes = roundTo(longest + 8 * batches.length + (oatJars > 0 ? 8 : 0) + (eggBites > 0 ? 10 : 0) + 15, 5);

  return {
    id,
    prepDay,
    when: prepTimeLabel(plan, prepDay, minutes),
    covers: days.map((d) => d.day),
    minutes,
    containers,
    batches,
    steps,
  };
}

// ─── Week ───────────────────────────────────────────────────────────────────

export function buildWeekFuel(profile: Profile, plan: WeekPlan): WeekFuel {
  // Recipe behind each prepped meal, for batching.
  const recipes = new Map<string, Bowl>();
  const filter: Filter = { diet: profile.diet, exclusions: profile.exclusions };
  const week = Number(plan.weekId.split('-W')[1] ?? 0);

  const pool = proteinOptions(filter);
  const animal = pool.filter((recipe) => !recipe.plant);
  const proteins = rotate(animal.length >= 3 ? animal : pool, week);
  const carbs = rotate(carbOptions(filter), week);
  const veg = rotate(vegOptions(filter), week);
  const leanOrder = ['garlic-herb-chicken', 'chili-lime-chicken', 'cajun-shrimp', 'crispy-tofu', 'teriyaki-tempeh'];
  const lean =
    leanOrder.map((id) => proteins.find((p) => p.id === id)).find(Boolean) ?? proteins[0];
  const leanCarb = carbs.find((c) => c.food === 'rice') ?? carbs[0];

  const menus: Record<'A' | 'B', BlockMenu> = {
    A: {
      lunch: proteins[0],
      dinner: proteins[1 % proteins.length],
      lean,
      carbs: [carbs[0], carbs[1 % carbs.length]],
      leanCarb,
      veg: veg[0],
      breakfast: 'oats',
    },
    B: {
      lunch: proteins[2 % proteins.length],
      dinner: proteins[3 % proteins.length],
      lean,
      carbs: [carbs[2 % carbs.length], carbs[3 % carbs.length]],
      leanCarb,
      veg: veg[1 % veg.length],
      breakfast: can('eggs', filter) ? 'egg-bites' : 'oats',
    },
  };

  const refresh = pickRefreshDay(plan);
  const refreshIndex = dayIndex(refresh);
  const eventIndex = plan.event.day ? dayIndex(plan.event.day) : null;

  const days: DayFuel[] = plan.days.map((day, index) => {
    const blockId: 'A' | 'B' = index <= refreshIndex ? 'A' : 'B';
    const menu = menus[blockId];
    const daysToEvent = eventIndex === null ? null : eventIndex - index;
    const targets = dailyTargets(profile, day.load, plan.event.kind, daysToEvent);
    const { drafts, notes } = draftMeals(day, plan, menu, filter, targets);

    const solve = () => {
      const fixed = drafts.reduce(
        (acc, d) => addMacros(acc, sum([...(d.bowl ? [] : (d.portions ?? [])), ...(d.sides ?? [])])),
        ZERO,
      );
      const bowls = drafts.map((d) => d.bowl).filter((b): b is Bowl => Boolean(b));
      const scales = solveBowls(targets, fixed, bowls);
      const meals = drafts.map((draft) => finishMeal(draft, scales));
      return { meals, actual: meals.reduce((acc, meal) => addMacros(acc, meal.totals), ZERO) };
    };

    // Carb-loading days can outgrow sensible bowls: top up with simple carbs until on target.
    let result = solve();
    for (let round = 0; round < CARB_FILLERS.length && targets.c - result.actual.c > targets.c * 0.04; round += 1) {
      CARB_FILLERS[round](drafts, day, filter);
      drafts.sort((a, b) => a.time - b.time);
      result = solve();
    }
    const { meals, actual } = result;
    drafts.forEach((draft, i) => {
      if (draft.bowl) recipes.set(meals[i].id, draft.bowl);
    });

    return {
      day: day.day,
      date: day.date,
      load: day.load,
      loadLabel: LOAD_LABELS[day.load],
      targets,
      actual,
      meals,
      notes,
      block: blockId,
    };
  });

  const blocks: PrepBlock[] = [
    buildBlock('A', 'Sun', days.filter((d) => d.block === 'A'), plan, recipes),
    buildBlock('B', refresh, days.filter((d) => d.block === 'B'), plan, recipes),
  ];

  const totals = new Map<FoodId, number>();
  for (const day of days) {
    for (const meal of day.meals) {
      for (const item of meal.items) totals.set(item.food, (totals.get(item.food) ?? 0) + item.grams);
    }
  }
  const aisles: Aisle[] = ['Meat & fish', 'Produce', 'Dairy & eggs', 'Grains & bread', 'Frozen', 'Pantry'];
  const shopping = aisles
    .map((aisle) => ({
      aisle,
      items: [...totals.entries()]
        .filter(([food]) => FOODS[food].aisle === aisle)
        .map(([food, grams]) => ({ food, name: FOODS[food].name, amount: purchaseLabel(food, grams), grams }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((group) => group.items.length > 0);

  const total = days.reduce((acc, d) => addMacros(acc, d.actual), ZERO);
  const averages = { p: total.p / 7, c: total.c / 7, f: total.f / 7, kcal: total.kcal / 7 };
  const emphasis = weekEmphasis(plan.event.kind);

  return { weekId: plan.weekId, headline: emphasis.headline, detail: emphasis.detail, days, blocks, shopping, averages };
}
