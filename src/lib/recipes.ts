import { allowedFood, FOODS, type FoodId } from './foods';
import type { DietStyle, Exclusion } from './types';

export type ProteinRecipe = {
  id: string;
  name: string;
  main: FoodId;
  /** Extra grams of other foods per portion (sauce, beans...). */
  extras: { food: FoodId; grams: number }[];
  method: string;
  minutes: number;
  /** Fish is best within ~2 days of cooking. */
  shortLife?: boolean;
  /** Plant protein: used for omnivores only when animal options run short. */
  plant?: boolean;
};

export type CarbRecipe = { id: string; name: string; food: FoodId; method: string; minutes: number };

export type VegRecipe = { id: string; name: string; foods: { food: FoodId; grams: number }[]; method: string };

export const PROTEIN_RECIPES: ProteinRecipe[] = [
  {
    id: 'chili-lime-chicken',
    name: 'Chili-lime chicken thighs',
    main: 'chickenThigh',
    extras: [],
    method: 'Toss with lime, chili powder, garlic and salt; roast at 425°F for 22–25 min.',
    minutes: 30,
  },
  {
    id: 'turkey-taco',
    name: 'Turkey taco mince',
    main: 'turkey',
    extras: [
      { food: 'blackBeans', grams: 60 },
      { food: 'salsa', grams: 40 },
    ],
    method: 'Brown with taco seasoning, then fold in rinsed beans and salsa.',
    minutes: 20,
  },
  {
    id: 'sheet-pan-salmon',
    name: 'Sheet-pan salmon',
    main: 'salmon',
    extras: [],
    method: 'Salt, pepper, lemon; roast at 400°F for 12–14 min.',
    minutes: 20,
    shortLife: true,
  },
  {
    id: 'garlic-herb-chicken',
    name: 'Garlic-herb chicken breast',
    main: 'chickenBreast',
    extras: [],
    method: 'Pound to even thickness, season, bake at 425°F for 18 min (165°F inside).',
    minutes: 25,
  },
  {
    id: 'beef-bolognese',
    name: 'Lean beef bolognese',
    main: 'beef',
    extras: [{ food: 'marinara', grams: 120 }],
    method: 'Brown with onion and garlic, simmer in marinara for 15 min.',
    minutes: 25,
  },
  {
    id: 'cajun-shrimp',
    name: 'Cajun shrimp',
    main: 'shrimp',
    extras: [],
    method: 'Thaw, toss in Cajun spice, sear 2 min per side.',
    minutes: 12,
    shortLife: true,
  },
  {
    id: 'crispy-tofu',
    plant: true,
    name: 'Crispy baked tofu',
    main: 'tofu',
    extras: [],
    method: 'Press, cube, toss in soy sauce + cornstarch; bake at 400°F for 25 min.',
    minutes: 30,
  },
  {
    id: 'red-lentil-dal',
    plant: true,
    name: 'Red lentil dal',
    main: 'lentils',
    extras: [{ food: 'spinach', grams: 40 }],
    method: 'Simmer lentils with onion, garlic, curry paste and canned tomato for 20 min; stir in spinach.',
    minutes: 30,
  },
  {
    id: 'teriyaki-tempeh',
    plant: true,
    name: 'Teriyaki tempeh',
    main: 'tempeh',
    extras: [],
    method: 'Slice, pan-sear, then simmer in teriyaki for 8 min.',
    minutes: 15,
  },
];

export const CARB_RECIPES: CarbRecipe[] = [
  { id: 'rice', name: 'Jasmine rice', food: 'rice', method: 'Rice cooker, 1 : 1.25 water.', minutes: 25 },
  { id: 'sweet-potato', name: 'Roasted sweet potato', food: 'sweetPotato', method: 'Cube, roast at 425°F for 30 min.', minutes: 35 },
  { id: 'pasta', name: 'Pasta', food: 'pasta', method: 'Boil 1 min under packet time; toss with a little oil.', minutes: 15 },
  { id: 'potatoes', name: 'Roasted baby potatoes', food: 'potatoes', method: 'Halve, roast at 425°F for 30 min.', minutes: 35 },
  { id: 'quinoa', name: 'Quinoa', food: 'quinoa', method: 'Rinse, simmer 1 : 2 water for 15 min.', minutes: 20 },
];

export const VEG_RECIPES: VegRecipe[] = [
  { id: 'broccoli', name: 'Roasted broccoli', foods: [{ food: 'broccoli', grams: 150 }], method: 'Roast at 425°F for 18 min.' },
  {
    id: 'peppers-onions',
    name: 'Peppers + onions',
    foods: [
      { food: 'peppers', grams: 110 },
      { food: 'onion', grams: 40 },
    ],
    method: 'Slice and roast on the second tray for 20 min.',
  },
  { id: 'green-beans', name: 'Garlic green beans', foods: [{ food: 'greenBeans', grams: 150 }], method: 'Blanch 3 min, then sauté with garlic.' },
  { id: 'zucchini', name: 'Roasted zucchini', foods: [{ food: 'zucchini', grams: 160 }], method: 'Half-moons, roast at 425°F for 15 min.' },
];

type Filter = { diet: DietStyle; exclusions: Exclusion[] };

const ok = (id: FoodId, { diet, exclusions }: Filter) => allowedFood(FOODS[id], diet, exclusions);

export const proteinOptions = (filter: Filter) =>
  PROTEIN_RECIPES.filter((r) => ok(r.main, filter) && r.extras.every((e) => ok(e.food, filter)));

export const carbOptions = (filter: Filter) => CARB_RECIPES.filter((r) => ok(r.food, filter));

export const vegOptions = (filter: Filter) => VEG_RECIPES.filter((r) => r.foods.every((f) => ok(f.food, filter)));

/** Rotate a list by the week number so meals change week to week. */
export function rotate<T>(items: T[], by: number): T[] {
  if (items.length === 0) return items;
  const shift = ((by % items.length) + items.length) % items.length;
  return [...items.slice(shift), ...items.slice(0, shift)];
}
