import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Bullet, Card, CheckCircle, Eyebrow, Header, ProgressBar, ProgressRing, Screen, Segmented, SectionTitle, shared, useToneColor, type Tone } from '@/components/ui';
import { type as t } from '@/constants/type';
import { usePlanner } from '@/context/PlannerContext';
import { useColors } from '@/hooks/useColors';
import { eatenMacros } from '@/lib/logbook';
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
  const { fuel, week, toggleMeal, isEaten } = usePlanner();
  const day = fuel.days.find((d) => d.day === selected) ?? fuel.days[0];
  const max = Math.max(...fuel.days.map((d) => d.targets.kcal));
  const min = Math.min(...fuel.days.map((d) => d.targets.kcal));
  const allEaten = day.meals.every((m) => isEaten(m.id));

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
        onAction={() => day.meals.filter((m) => isEaten(m.id) === allEaten).forEach((m) => toggleMeal(m.id))}
      />
      <View style={styles.meals}>
        {day.meals.map((meal) => (
          <MealCard key={meal.id} meal={meal} eaten={week.meals.includes(meal.id)} onToggle={() => toggleMeal(meal.id)} />
        ))}
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

function MealCard({ meal, eaten, onToggle }: { meal: Meal; eaten: boolean; onToggle: () => void }) {
  const colors = useColors();
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
