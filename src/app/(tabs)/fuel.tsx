import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Bullet, Button, Card, CheckCircle, Eyebrow, Header, ProgressBar, ProgressRing, Screen, Segmented, SectionTitle, shared, useToneColor, type Tone } from '@/components/ui';
import { type as t } from '@/constants/type';
import { usePlanner } from '@/context/PlannerContext';
import { useColors } from '@/hooks/useColors';
import { eatenMacros, replacedMeals, type CustomMeal } from '@/lib/logbook';
import type { DayFuel, Meal, PrepBlock } from '@/lib/mealPlanner';
import { DAY_NAMES, formatClock, fromISODate } from '@/lib/time';
import type { DayKey, DayLoad } from '@/lib/types';

type FuelView = 'meals' | 'prep' | 'shop';

const loadTone = (load: DayLoad): Tone =>
  load === 'event' || load === 'fuel-up' ? 'apricot' : load === 'rest' || load === 'light' ? 'sky' : 'lime';

const fmt = (value: number) => Math.round(value).toLocaleString('en-US');

export default function FuelScreen() {
  const colors = useColors();
  const { fuel, todayKey } = usePlanner();
  const [view, setView] = useState<FuelView>('meals');
  const [selected, setSelected] = useState<DayKey>(todayKey);

  return (
    <Screen testID="fuel-screen">
      <Header eyebrow="FUEL" title={fuel.headline} subtitle={fuel.detail} />

      <View style={shared.gutter}>
        <Segmented<FuelView>
          testID="fuel-tab"
          value={view}
          onChange={setView}
          options={[
            { value: 'meals', label: 'Meals' },
            { value: 'prep', label: 'Prep' },
            { value: 'shop', label: 'Shopping' },
          ]}
        />
      </View>

      {view === 'meals' ? <MealsView selected={selected} onSelect={setSelected} /> : null}
      {view === 'prep' ? <PrepView /> : null}
      {view === 'shop' ? <ShopView /> : null}
      <Text style={[t.micro, styles.footnote, { color: colors.mutedForeground }]}>
        Avg {fmt(fuel.averages.kcal)} kcal · {fmt(fuel.averages.p)} g protein a day this week
      </Text>
    </Screen>
  );
}

// ─── Meals ──────────────────────────────────────────────────────────────────

function MealsView({ selected, onSelect }: { selected: DayKey; onSelect: (day: DayKey) => void }) {
  const colors = useColors();
  const tone = useToneColor();
  const router = useRouter();
  const { fuel, week, toggleMeal, isEaten, customMeals } = usePlanner();
  const day = fuel.days.find((d) => d.day === selected) ?? fuel.days[0];
  const max = Math.max(...fuel.days.map((d) => d.targets.kcal));
  const min = Math.min(...fuel.days.map((d) => d.targets.kcal));
  const swapped = replacedMeals(week, day.date);
  const own = customMeals(day.date);
  const planned = day.meals.filter((m) => !swapped.has(m.id));
  const allEaten = planned.every((m) => isEaten(m.id));
  type Entry = { time: number; key: string } & ({ kind: 'planned'; meal: Meal } | { kind: 'custom'; custom: CustomMeal });
  const entries: Entry[] = [
    ...day.meals.map((meal): Entry => ({ kind: 'planned', time: meal.time, key: meal.id, meal })),
    ...own.map((custom): Entry => ({ kind: 'custom', time: custom.time, key: custom.id, custom })),
  ].sort((a, b) => a.time - b.time);
  const openMeal = (query: string) => router.push(`/meal?day=${day.day}${query}`);

  return (
    <>
      <View style={[styles.rail, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {fuel.days.map((d) => {
          const active = d.day === selected;
          const height = 16 + (max === min ? 18 : ((d.targets.kcal - min) / (max - min)) * 30);
          return (
            <Pressable
              key={d.day}
              testID={`fuel-day-${d.day}`}
              accessibilityRole="button"
              accessibilityLabel={`${DAY_NAMES[d.day]}, ${d.loadLabel}, ${fmt(d.targets.kcal)} calories`}
              accessibilityState={{ selected: active }}
              onPress={() => {
                Haptics.selectionAsync().catch(() => undefined);
                onSelect(d.day);
              }}
              style={({ pressed }) => [styles.railDay, { backgroundColor: active ? colors.foreground : 'transparent' }, pressed && shared.pressed]}
            >
              <View style={styles.railBarWrap}>
                <View style={[styles.railBar, { height, backgroundColor: tone(loadTone(d.load)), opacity: active ? 1 : 0.6 }]} />
              </View>
              <Text style={[t.micro, { color: active ? colors.background : colors.mutedForeground, marginTop: 6 }]}>{d.day}</Text>
            </Pressable>
          );
        })}
      </View>

      <DaySummary day={day} />

      <SectionTitle
        eyebrow={`${DAY_NAMES[day.day].toUpperCase()} · ${fromISODate(day.date).getDate()}`}
        title="Meals, timed to training"
        action={allEaten ? 'Clear all' : 'Ate all as planned'}
        onAction={() => planned.filter((m) => isEaten(m.id) === allEaten).forEach((m) => toggleMeal(m.id))}
      />
      <View style={styles.meals}>
        {entries.map((entry) =>
          entry.kind === 'planned' ? (
            <MealCard
              key={entry.key}
              meal={entry.meal}
              eaten={week.meals.includes(entry.meal.id)}
              swappedFor={own.find((m) => m.replaces === entry.meal.id)?.name}
              onToggle={() => toggleMeal(entry.meal.id)}
              onSwap={() => openMeal(`&replaces=${entry.meal.id}`)}
            />
          ) : (
            <CustomMealCard
              key={entry.key}
              meal={entry.custom}
              instead={day.meals.find((m) => m.id === entry.custom.replaces)?.title}
              onEdit={() => openMeal(`&edit=${entry.custom.id}`)}
            />
          ),
        )}
        <Button testID="fuel-add-meal" variant="secondary" icon="plus" label="Add your own meal" onPress={() => openMeal('')} style={shared.gutter} />
      </View>
    </>
  );
}

function DaySummary({ day }: { day: DayFuel }) {
  const colors = useColors();
  const tone = useToneColor();
  const { week } = usePlanner();
  const eaten = eatenMacros(day, week);
  const accent = tone(loadTone(day.load));
  return (
    <Card style={styles.summary}>
      <View style={styles.summaryTop}>
        <ProgressRing value={eaten.kcal / Math.max(1, day.actual.kcal)} size={84} stroke={6} color={colors.accent}>
          <Text style={[t.label, { color: colors.foreground }]}>{Math.round((eaten.kcal / Math.max(1, day.actual.kcal)) * 100)}%</Text>
        </ProgressRing>
        <View style={styles.flex}>
          <Eyebrow color={accent}>{day.loadLabel.toUpperCase()}</Eyebrow>
          <Text style={[t.heading, { color: colors.foreground, marginTop: 4 }]}>{fmt(eaten.kcal)} kcal</Text>
          <Text style={[t.caption, { color: colors.mutedForeground }]}>eaten of {fmt(day.actual.kcal)} planned</Text>
        </View>
      </View>
      <View style={styles.macros}>
        {[
          { label: 'Protein', eaten: eaten.p, planned: day.actual.p, perKg: day.targets.perKg.p, color: colors.primary },
          { label: 'Carbs', eaten: eaten.c, planned: day.actual.c, perKg: day.targets.perKg.c, color: colors.accent },
          { label: 'Fat', eaten: eaten.f, planned: day.actual.f, perKg: day.targets.perKg.f, color: colors.sky },
        ].map((m) => (
          <View key={m.label} style={styles.macro}>
            <View style={styles.macroHead}>
              <Text style={[t.label, { color: colors.secondaryForeground }]}>{m.label}</Text>
              <Text style={[t.caption, { color: colors.mutedForeground }]}>
                <Text style={{ color: colors.foreground }}>{fmt(m.eaten)}</Text> / {fmt(m.planned)} g · {m.perKg.toFixed(1)} g/kg
              </Text>
            </View>
            <ProgressBar value={m.eaten / Math.max(1, m.planned)} color={m.color} height={5} />
          </View>
        ))}
      </View>
      {day.notes.length > 0 ? (
        <View style={styles.notes}>
          {day.notes.map((note) => (
            <Bullet key={note} tone={loadTone(day.load)}>
              {note}
            </Bullet>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function MealCard({
  meal,
  eaten,
  swappedFor,
  onToggle,
  onSwap,
}: {
  meal: Meal;
  eaten: boolean;
  swappedFor?: string;
  onToggle: () => void;
  onSwap: () => void;
}) {
  const colors = useColors();
  if (swappedFor) {
    return (
      <Card style={[styles.meal, styles.swapped]}>
        <Text style={[t.micro, { color: colors.mutedForeground }]}>{formatClock(meal.time)}</Text>
        <Text style={[t.bodyStrong, styles.struck, { color: colors.foreground, marginTop: 4 }]}>{meal.title}</Text>
        <Text style={[t.caption, { color: colors.mutedForeground, marginTop: 2 }]}>Swapped for {swappedFor}</Text>
      </Card>
    );
  }
  return (
    <Card style={[styles.meal, eaten && { borderColor: 'rgba(229,195,140,0.35)' }]}>
      <View style={styles.mealHead}>
        <View style={styles.flex}>
          <View style={styles.mealMeta}>
            <Text style={[t.micro, { color: colors.mutedForeground }]}>{formatClock(meal.time)}</Text>
            {meal.prepped ? (
              <View style={[styles.prepTag, { borderColor: colors.borderStrong }]}>
                <Feather name="package" size={10} color={colors.accent} />
                <Text style={[t.micro, { color: colors.accent, fontSize: 10 }]}>From your prep</Text>
              </View>
            ) : null}
          </View>
          <Text style={[t.subheading, { color: colors.foreground, marginTop: 4 }, eaten && styles.struck]}>{meal.title}</Text>
          {meal.note ? <Text style={[t.caption, { color: colors.mutedForeground, marginTop: 2 }]}>{meal.note}</Text> : null}
        </View>
        <CheckCircle testID={`meal-${meal.id}`} tone="apricot" done={eaten} label={`${eaten ? 'Undo' : 'Log'} ${meal.title}`} onPress={onToggle} />
      </View>
      <View style={[styles.items, { borderTopColor: colors.border }]}>
        {meal.items.map((item, index) => (
          <View key={`${item.food}-${index}`} style={styles.item}>
            <Text style={[t.caption, styles.flex, { color: colors.secondaryForeground }]}>{item.name}</Text>
            <Text style={[t.caption, { color: colors.mutedForeground }]}>{item.amount}</Text>
          </View>
        ))}
      </View>
      <Text style={[t.micro, { color: colors.mutedForeground, marginTop: 10 }]}>
        {fmt(meal.totals.kcal)} kcal · {fmt(meal.totals.p)} g protein · {fmt(meal.totals.c)} g carbs · {fmt(meal.totals.f)} g fat
      </Text>
      {!eaten ? (
        <Pressable
          testID={`swap-${meal.id}`}
          accessibilityRole="button"
          onPress={onSwap}
          hitSlop={8}
          style={({ pressed }) => [styles.swap, { borderTopColor: colors.border }, pressed && shared.pressed]}
        >
          <Feather name="repeat" size={13} color={colors.primary} />
          <Text style={[t.label, { color: colors.primary }]}>Ate something else? Swap it</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

function CustomMealCard({ meal, instead, onEdit }: { meal: CustomMeal; instead?: string; onEdit: () => void }) {
  const colors = useColors();
  return (
    <Card style={[styles.meal, { borderColor: 'rgba(212,241,113,0.3)' }]}>
      <View style={styles.mealHead}>
        <View style={styles.flex}>
          <View style={styles.mealMeta}>
            <Text style={[t.micro, { color: colors.mutedForeground }]}>{formatClock(meal.time)}</Text>
            <View style={[styles.prepTag, { borderColor: colors.borderStrong }]}>
              <Feather name="edit-3" size={10} color={colors.primary} />
              <Text style={[t.micro, { color: colors.primary, fontSize: 10 }]}>Your meal</Text>
            </View>
          </View>
          <Text style={[t.subheading, { color: colors.foreground, marginTop: 4 }]}>{meal.name}</Text>
          {instead ? <Text style={[t.caption, { color: colors.mutedForeground, marginTop: 2 }]}>Instead of {instead.toLowerCase()}</Text> : null}
        </View>
        <Pressable
          testID={`edit-meal-${meal.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${meal.name}`}
          onPress={onEdit}
          style={({ pressed }) => [styles.edit, { backgroundColor: colors.secondary }, pressed && shared.pressed]}
        >
          <Text style={[t.label, { color: colors.foreground }]}>Edit</Text>
        </Pressable>
      </View>
      <Text style={[t.micro, { color: colors.mutedForeground, marginTop: 12 }]}>
        {fmt(meal.kcal)} kcal{meal.p ? ` · ${fmt(meal.p)} g protein` : ''}
        {meal.c ? ` · ${fmt(meal.c)} g carbs` : ''}
        {meal.f ? ` · ${fmt(meal.f)} g fat` : ''}
      </Text>
    </Card>
  );
}

// ─── Prep ───────────────────────────────────────────────────────────────────

function PrepView() {
  const { fuel } = usePlanner();
  return (
    <>
      {fuel.blocks.map((block) => (
        <PrepCard key={block.id} block={block} />
      ))}
    </>
  );
}

function PrepCard({ block }: { block: PrepBlock }) {
  const colors = useColors();
  const range = block.covers.length > 1 ? `${block.covers[0]}–${block.covers[block.covers.length - 1]}` : block.covers[0];
  return (
    <>
      <SectionTitle eyebrow={`${block.id === 'A' ? 'MAIN PREP' : 'MID-WEEK REFRESH'} · FEEDS ${range.toUpperCase()}`} title={block.when} />
      <Card>
        <View style={styles.prepMeta}>
          <View style={[styles.prepStat, { backgroundColor: colors.secondary }]}>
            <Feather name="clock" size={14} color={colors.accent} />
            <Text style={[t.label, { color: colors.secondaryForeground }]}>~{block.minutes} min</Text>
          </View>
          <View style={[styles.prepStat, { backgroundColor: colors.secondary }]}>
            <Feather name="box" size={14} color={colors.accent} />
            <Text style={[t.label, { color: colors.secondaryForeground }]}>{block.containers} containers</Text>
          </View>
        </View>

        <Eyebrow style={{ marginTop: 18 }}>WHAT TO COOK</Eyebrow>
        <View style={styles.batches}>
          {block.batches.map((batch, index) => (
            <View key={batch.name} style={[styles.batch, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <View style={styles.flex}>
                <Text style={[t.bodyStrong, { color: colors.foreground }]}>{batch.name}</Text>
                <Text style={[t.caption, { color: colors.mutedForeground, marginTop: 2 }]}>{batch.detail}</Text>
              </View>
              <Text style={[t.label, { color: colors.accent }]}>{batch.amount}</Text>
            </View>
          ))}
        </View>

        <Eyebrow style={{ marginTop: 18 }}>STEP BY STEP</Eyebrow>
        <View style={styles.steps}>
          {block.steps.map((step, index) => (
            <View key={step} style={styles.step}>
              <View style={[styles.stepIndex, { borderColor: colors.borderStrong }]}>
                <Text style={[t.micro, { color: colors.foreground }]}>{index + 1}</Text>
              </View>
              <Text style={[t.caption, styles.flex, { color: colors.secondaryForeground, lineHeight: 19 }]}>{step}</Text>
            </View>
          ))}
        </View>
      </Card>
    </>
  );
}

// ─── Shopping ───────────────────────────────────────────────────────────────

function ShopView() {
  const colors = useColors();
  const { fuel, isBought, toggleBought } = usePlanner();
  const all = fuel.shopping.flatMap((group) => group.items);
  const bought = all.filter((item) => isBought(item.food)).length;

  return (
    <>
      <SectionTitle eyebrow="ONE TRIP, WHOLE WEEK" title="Shopping list" />
      <Card style={styles.shopProgress}>
        <View style={styles.macroHead}>
          <Text style={[t.label, { color: colors.secondaryForeground }]}>In the basket</Text>
          <Text style={[t.caption, { color: colors.mutedForeground }]}>
            {bought} of {all.length}
          </Text>
        </View>
        <ProgressBar value={all.length ? bought / all.length : 0} color={colors.accent} />
      </Card>
      {fuel.shopping.map((group) => (
        <View key={group.aisle} style={styles.aisle}>
          <Eyebrow style={styles.aisleLabel}>{group.aisle.toUpperCase()}</Eyebrow>
          <Card style={styles.aisleCard}>
            {group.items.map((item, index) => {
              const done = isBought(item.food);
              return (
                <Pressable
                  key={item.food}
                  testID={`shop-${item.food}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => undefined);
                    toggleBought(item.food);
                  }}
                  style={({ pressed }) => [styles.shopRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }, pressed && shared.pressed]}
                >
                  <View
                    style={[
                      styles.box,
                      { borderColor: done ? colors.accent : colors.borderStrong, backgroundColor: done ? colors.accent : 'transparent' },
                    ]}
                  >
                    {done ? <Feather name="check" size={13} color={colors.accentForeground} /> : null}
                  </View>
                  <Text style={[t.body, styles.flex, { color: colors.foreground }, done && styles.struck]}>{item.name}</Text>
                  <Text style={[t.label, { color: colors.mutedForeground }, done && styles.struck]}>{item.amount}</Text>
                </Pressable>
              );
            })}
          </Card>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footnote: { textAlign: 'center', marginTop: 22, marginHorizontal: 30 },
  rail: { marginHorizontal: 20, marginTop: 16, borderRadius: 22, borderWidth: 1, padding: 6, flexDirection: 'row', gap: 2 },
  railDay: { flex: 1, borderRadius: 16, paddingVertical: 10, alignItems: 'center' },
  railBarWrap: { height: 48, justifyContent: 'flex-end' },
  railBar: { width: 8, borderRadius: 4 },
  summary: { marginTop: 12 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  macros: { marginTop: 18, gap: 12 },
  macro: { gap: 7 },
  macroHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  notes: { marginTop: 16, gap: 8 },
  meals: { gap: 10 },
  meal: { padding: 16 },
  mealHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  mealMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prepTag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  items: { borderTopWidth: 1, marginTop: 12, paddingTop: 10, gap: 7 },
  item: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  struck: { textDecorationLine: 'line-through', opacity: 0.5 },
  swapped: { opacity: 0.7 },
  swap: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  edit: { borderRadius: 12, paddingHorizontal: 14, minHeight: 36, justifyContent: 'center' },
  prepMeta: { flexDirection: 'row', gap: 8 },
  prepStat: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 8 },
  batches: { marginTop: 6 },
  batch: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  steps: { gap: 12, marginTop: 10 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepIndex: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  shopProgress: { gap: 10, marginBottom: 6 },
  aisle: { marginTop: 14 },
  aisleLabel: { marginHorizontal: 22, marginBottom: 8 },
  aisleCard: { paddingVertical: 2 },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 52 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
