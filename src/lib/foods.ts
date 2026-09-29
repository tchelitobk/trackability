import type { DietStyle, Exclusion } from './types';

export type FoodTag = 'meat' | 'fish' | 'dairy' | 'egg' | 'gluten' | 'nuts' | 'soy';

export type Aisle = 'Meat & fish' | 'Produce' | 'Dairy & eggs' | 'Grains & bread' | 'Pantry' | 'Frozen';

export type Food = {
  id: string;
  name: string;
  aisle: Aisle;
  /** Macros per 100 g as purchased (raw or dry). */
  p: number;
  c: number;
  f: number;
  tags: FoodTag[];
  /** Count-style serving, e.g. one banana = 118 g. */
  unit?: { singular: string; plural: string; grams: number };
  /** Cooked weight / raw weight, for showing cooked portions. */
  cooked?: number;
  /** Liquids are shown in fl oz instead of grams. */
  liquid?: boolean;
  /** Spoon measures for oils, honey, nut butter. */
  spoon?: 'tsp' | 'tbsp';
  buy: 'lb' | 'oz' | 'count' | 'g' | 'floz';
};

const food = (f: Food) => f;

export const FOODS = {
  // Proteins
  chickenThigh: food({ id: 'chickenThigh', name: 'Chicken thighs (boneless)', aisle: 'Meat & fish', p: 19.7, c: 0, f: 4.1, tags: ['meat'], cooked: 0.72, buy: 'lb' }),
  chickenBreast: food({ id: 'chickenBreast', name: 'Chicken breast', aisle: 'Meat & fish', p: 22.5, c: 0, f: 2.6, tags: ['meat'], cooked: 0.75, buy: 'lb' }),
  turkey: food({ id: 'turkey', name: '93/7 ground turkey', aisle: 'Meat & fish', p: 18.7, c: 0, f: 8.3, tags: ['meat'], cooked: 0.75, buy: 'lb' }),
  beef: food({ id: 'beef', name: '93/7 lean ground beef', aisle: 'Meat & fish', p: 21, c: 0, f: 7, tags: ['meat'], cooked: 0.75, buy: 'lb' }),
  salmon: food({ id: 'salmon', name: 'Salmon fillets', aisle: 'Meat & fish', p: 20.4, c: 0, f: 13.4, tags: ['fish'], cooked: 0.8, buy: 'lb' }),
  shrimp: food({ id: 'shrimp', name: 'Shrimp (peeled)', aisle: 'Frozen', p: 20.1, c: 0.2, f: 0.5, tags: ['fish'], cooked: 0.8, buy: 'lb' }),
  tofu: food({ id: 'tofu', name: 'Extra-firm tofu', aisle: 'Produce', p: 17.3, c: 2.9, f: 8.7, tags: ['soy'], cooked: 0.85, buy: 'oz' }),
  tempeh: food({ id: 'tempeh', name: 'Tempeh', aisle: 'Produce', p: 20.3, c: 7.6, f: 10.8, tags: ['soy'], buy: 'oz' }),
  lentils: food({ id: 'lentils', name: 'Red lentils (dry)', aisle: 'Pantry', p: 24.6, c: 63.4, f: 1.1, tags: [], cooked: 2.5, buy: 'lb' }),
  eggs: food({ id: 'eggs', name: 'Eggs', aisle: 'Dairy & eggs', p: 12.6, c: 0.7, f: 9.5, tags: ['egg'], unit: { singular: 'egg', plural: 'eggs', grams: 50 }, buy: 'count' }),
  eggWhites: food({ id: 'eggWhites', name: 'Liquid egg whites', aisle: 'Dairy & eggs', p: 10.9, c: 0.7, f: 0.2, tags: ['egg'], buy: 'oz' }),
  greekYogurt: food({ id: 'greekYogurt', name: 'Nonfat Greek yogurt', aisle: 'Dairy & eggs', p: 10.3, c: 3.6, f: 0.4, tags: ['dairy'], buy: 'oz' }),
  cottageCheese: food({ id: 'cottageCheese', name: '2% cottage cheese', aisle: 'Dairy & eggs', p: 10.5, c: 4.8, f: 2.3, tags: ['dairy'], buy: 'oz' }),
  whey: food({ id: 'whey', name: 'Whey protein', aisle: 'Pantry', p: 78, c: 8, f: 6, tags: ['dairy'], unit: { singular: 'scoop', plural: 'scoops', grams: 30 }, buy: 'g' }),
  plantProtein: food({ id: 'plantProtein', name: 'Pea protein powder', aisle: 'Pantry', p: 75, c: 8, f: 7, tags: [], unit: { singular: 'scoop', plural: 'scoops', grams: 33 }, buy: 'g' }),
  chocolateMilk: food({ id: 'chocolateMilk', name: 'Low-fat chocolate milk', aisle: 'Dairy & eggs', p: 3.2, c: 10.4, f: 1, tags: ['dairy'], liquid: true, buy: 'floz' }),
  soyMilk: food({ id: 'soyMilk', name: 'Soy milk', aisle: 'Dairy & eggs', p: 3.3, c: 6.3, f: 1.8, tags: ['soy'], liquid: true, buy: 'floz' }),

  // Carbs
  rice: food({ id: 'rice', name: 'Jasmine rice (dry)', aisle: 'Grains & bread', p: 7.1, c: 79.9, f: 0.7, tags: [], cooked: 3, buy: 'lb' }),
  sweetPotato: food({ id: 'sweetPotato', name: 'Sweet potatoes', aisle: 'Produce', p: 1.6, c: 20.1, f: 0.1, tags: [], cooked: 0.8, buy: 'lb' }),
  pasta: food({ id: 'pasta', name: 'Pasta (dry)', aisle: 'Grains & bread', p: 13, c: 75, f: 1.5, tags: ['gluten'], cooked: 2.25, buy: 'lb' }),
  potatoes: food({ id: 'potatoes', name: 'Baby potatoes', aisle: 'Produce', p: 2, c: 17.5, f: 0.1, tags: [], cooked: 0.85, buy: 'lb' }),
  quinoa: food({ id: 'quinoa', name: 'Quinoa (dry)', aisle: 'Grains & bread', p: 14.1, c: 64.2, f: 6.1, tags: [], cooked: 2.7, buy: 'lb' }),
  oats: food({ id: 'oats', name: 'Rolled oats', aisle: 'Grains & bread', p: 13.2, c: 67.7, f: 6.5, tags: [], buy: 'oz' }),
  bagel: food({ id: 'bagel', name: 'Plain bagels', aisle: 'Grains & bread', p: 10, c: 50, f: 1.5, tags: ['gluten'], unit: { singular: 'plain bagel', plural: 'plain bagels', grams: 105 }, buy: 'count' }),
  riceCakes: food({ id: 'riceCakes', name: 'Rice cakes', aisle: 'Grains & bread', p: 8, c: 81, f: 3, tags: [], unit: { singular: 'rice cake', plural: 'rice cakes', grams: 9 }, buy: 'count' }),
  banana: food({ id: 'banana', name: 'Bananas', aisle: 'Produce', p: 1.1, c: 22.8, f: 0.3, tags: [], unit: { singular: 'banana', plural: 'bananas', grams: 118 }, buy: 'count' }),
  berries: food({ id: 'berries', name: 'Frozen blueberries', aisle: 'Frozen', p: 0.7, c: 14.5, f: 0.3, tags: [], buy: 'oz' }),
  honey: food({ id: 'honey', name: 'Honey', aisle: 'Pantry', p: 0.3, c: 82, f: 0, tags: [], spoon: 'tbsp', buy: 'oz' }),
  sportsDrink: food({ id: 'sportsDrink', name: 'Sports drink', aisle: 'Pantry', p: 0, c: 6, f: 0, tags: [], liquid: true, buy: 'floz' }),
  gel: food({ id: 'gel', name: 'Energy gels', aisle: 'Pantry', p: 0, c: 69, f: 0, tags: [], unit: { singular: 'energy gel', plural: 'energy gels', grams: 32 }, buy: 'count' }),

  // Veg
  broccoli: food({ id: 'broccoli', name: 'Broccoli', aisle: 'Produce', p: 2.8, c: 6.6, f: 0.4, tags: [], cooked: 0.9, buy: 'lb' }),
  peppers: food({ id: 'peppers', name: 'Bell peppers', aisle: 'Produce', p: 1, c: 6, f: 0.3, tags: [], cooked: 0.85, unit: { singular: 'bell pepper', plural: 'bell peppers', grams: 150 }, buy: 'count' }),
  onion: food({ id: 'onion', name: 'Onions', aisle: 'Produce', p: 1.1, c: 9.3, f: 0.1, tags: [], unit: { singular: 'onion', plural: 'onions', grams: 150 }, buy: 'count' }),
  greenBeans: food({ id: 'greenBeans', name: 'Green beans', aisle: 'Produce', p: 1.8, c: 7, f: 0.2, tags: [], cooked: 0.9, buy: 'lb' }),
  spinach: food({ id: 'spinach', name: 'Baby spinach', aisle: 'Produce', p: 2.9, c: 3.6, f: 0.4, tags: [], buy: 'oz' }),
  zucchini: food({ id: 'zucchini', name: 'Zucchini', aisle: 'Produce', p: 1.2, c: 3.1, f: 0.3, tags: [], cooked: 0.85, buy: 'lb' }),
  blackBeans: food({ id: 'blackBeans', name: 'Black beans (canned)', aisle: 'Pantry', p: 6, c: 16.5, f: 0.3, tags: [], unit: { singular: 'can', plural: 'cans', grams: 240 }, buy: 'count' }),
  marinara: food({ id: 'marinara', name: 'Marinara sauce', aisle: 'Pantry', p: 1.5, c: 8, f: 1.5, tags: [], buy: 'oz' }),
  salsa: food({ id: 'salsa', name: 'Salsa', aisle: 'Pantry', p: 1.5, c: 6, f: 0.2, tags: [], buy: 'oz' }),

  // Fats
  oliveOil: food({ id: 'oliveOil', name: 'Olive oil', aisle: 'Pantry', p: 0, c: 0, f: 100, tags: [], spoon: 'tsp', buy: 'floz' }),
  avocado: food({ id: 'avocado', name: 'Avocados', aisle: 'Produce', p: 2, c: 8.5, f: 14.7, tags: [], unit: { singular: 'avocado', plural: 'avocados', grams: 150 }, buy: 'count' }),
  almonds: food({ id: 'almonds', name: 'Almonds', aisle: 'Pantry', p: 21, c: 22, f: 50, tags: ['nuts'], buy: 'oz' }),
  peanutButter: food({ id: 'peanutButter', name: 'Peanut butter', aisle: 'Pantry', p: 25, c: 20, f: 50, tags: ['nuts'], spoon: 'tbsp', buy: 'oz' }),
  pumpkinSeeds: food({ id: 'pumpkinSeeds', name: 'Pumpkin seeds', aisle: 'Pantry', p: 30, c: 11, f: 49, tags: [], buy: 'oz' }),
  chia: food({ id: 'chia', name: 'Chia seeds', aisle: 'Pantry', p: 16.5, c: 42, f: 30.7, tags: [], spoon: 'tbsp', buy: 'oz' }),
} satisfies Record<string, Food>;

export type FoodId = keyof typeof FOODS;

export const foodById = (id: FoodId): Food => FOODS[id];

const SPOON_GRAMS: Record<string, Record<'tsp' | 'tbsp', number>> = {
  oliveOil: { tsp: 4.5, tbsp: 13.5 },
  honey: { tsp: 7, tbsp: 21 },
  peanutButter: { tsp: 5.3, tbsp: 16 },
  chia: { tsp: 4, tbsp: 12 },
};

export const spoonGrams = (id: FoodId, spoon: 'tsp' | 'tbsp') => SPOON_GRAMS[id]?.[spoon] ?? (spoon === 'tsp' ? 5 : 15);

/** Whether a food fits the athlete's diet and exclusions. */
export function allowedFood(food: Food, diet: DietStyle, exclusions: Exclusion[]): boolean {
  if (diet !== 'omnivore' && food.tags.includes('meat')) return false;
  if (diet === 'vegetarian' && food.tags.includes('fish')) return false;
  return exclusions.every((exclusion) => !food.tags.includes(exclusion));
}

export type Macros = { p: number; c: number; f: number; kcal: number };

export const ZERO: Macros = { p: 0, c: 0, f: 0, kcal: 0 };

export function macrosFor(id: FoodId, grams: number): Macros {
  const f = FOODS[id];
  const p = (f.p * grams) / 100;
  const c = (f.c * grams) / 100;
  const fat = (f.f * grams) / 100;
  return { p, c, f: fat, kcal: p * 4 + c * 4 + fat * 9 };
}

export const addMacros = (a: Macros, b: Macros): Macros => ({
  p: a.p + b.p,
  c: a.c + b.c,
  f: a.f + b.f,
  kcal: a.kcal + b.kcal,
});

const fraction = (value: number) => {
  const whole = Math.floor(value);
  const rest = value - whole;
  const glyph = rest >= 0.75 ? '¾' : rest >= 0.5 ? '½' : rest >= 0.25 ? '¼' : '';
  if (whole === 0) return glyph || '0';
  return `${whole}${glyph}`;
};

/**
 * Name + amount for a meal card: { name: 'Jasmine rice', amount: '300 g cooked' },
 * { name: 'Bananas', amount: '1 banana' } reads as { name: 'Banana', amount: '1' }.
 */
export function portionParts(id: FoodId, grams: number): { name: string; amount: string } {
  const f = FOODS[id];
  const label = portionLabel(id, grams);
  const name = f.name.replace(' (dry)', '').replace(' (boneless)', '');
  const lower = f.name.toLowerCase();
  if (f.unit && (lower.includes(f.unit.plural) || lower === f.unit.singular)) {
    const [count, ...noun] = label.split(' ');
    const text = noun.join(' ');
    return { name: text.charAt(0).toUpperCase() + text.slice(1), amount: count };
  }
  return { name, amount: label };
}

/** How a portion reads on a meal card, e.g. "150 g cooked", "2 rice cakes", "1½ tsp". */
export function portionLabel(id: FoodId, grams: number): string {
  const f = FOODS[id];
  if (f.unit) {
    const count = grams / f.unit.grams;
    const shown = count >= 1 ? fraction(count) : fraction(Math.max(0.25, count));
    return `${shown} ${count > 1 ? f.unit.plural : f.unit.singular}`;
  }
  if (f.spoon) {
    const spoon = grams >= spoonGrams(id, 'tbsp') ? 'tbsp' : f.spoon;
    return `${fraction(grams / spoonGrams(id, spoon))} ${spoon}`;
  }
  if (f.liquid) return `${Math.round(grams / 29.6)} fl oz`;
  if (f.cooked && f.cooked !== 1) return `${Math.round((grams * f.cooked) / 5) * 5} g cooked`;
  return `${Math.round(grams)} g`;
}

/** How a weekly total reads on the shopping list. */
export function purchaseLabel(id: FoodId, grams: number): string {
  const f = FOODS[id];
  switch (f.buy) {
    case 'lb':
      return `${Math.max(0.25, Math.ceil((grams / 453.6) * 4) / 4)} lb`;
    case 'oz':
      return `${Math.max(1, Math.ceil(grams / 28.35))} oz`;
    case 'floz':
      return `${Math.max(1, Math.ceil(grams / 29.6))} fl oz`;
    case 'count': {
      const count = Math.max(1, Math.ceil(grams / (f.unit?.grams ?? 100) - 0.05));
      return `${count} ${count === 1 ? f.unit?.singular : f.unit?.plural}`;
    }
    case 'g':
      if (f.unit) {
        const servings = Math.ceil(grams / f.unit.grams);
        return `${servings} ${servings === 1 ? f.unit.singular : f.unit.plural}`;
      }
      return `${Math.ceil(grams / 50) * 50} g`;
  }
}
