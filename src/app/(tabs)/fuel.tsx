import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Bullet, Card, Eyebrow, ScreenHeader, SectionTitle, shared, useScreenPadding, useToneColor, type Tone } from '@/components/ui';
import { usePlanner } from '@/context/PlannerContext';
import { useColors } from '@/hooks/useColors';
import type { DayFuel, Meal, PrepBlock } from '@/lib/mealPlanner';
import { DAY_NAMES, formatClock, fromISODate } from '@/lib/time';
import type { DayKey, DayLoad } from '@/lib/types';

type FuelView = 'day' | 'prep' | 'shop';

const loadTone = (load: DayLoad): Tone =>
  load === 'event' || load === 'fuel-up' ? 'apricot' : load === 'rest' || load === 'light' ? 'sky' : 'lime';

const fmt = (value: number) => Math.round(value).toLocaleString('en-US');

export default function FuelScreen() {
  const colors = useColors();
  const padding = useScreenPadding();
  const { fuel, todayKey } = usePlanner();
  const [view, setView] = useState<FuelView>('day');
  const [selected, setSelected] = useState<DayKey>(todayKey);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={padding}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader eyebrow="PERFORM / FUEL" title="Fuel the week" />

      <Card style={styles.emphasis}>
        <View style={[styles.emphasisIcon, { backgroundColor: colors.accent }]}>
          <Feather name="zap" size={16} color={colors.accentForeground} />
        </View>
        <View style={styles.flex}>
          <Eyebrow color={colors.accent}>{"THIS WEEK'S EMPHASIS"}</Eyebrow>
          <Text style={[styles.emphasisTitle, { color: colors.foreground }]}>{fuel.headline}</Text>
          <Text style={[styles.emphasisDetail, { color: colors.mutedForeground }]}>{fuel.detail}</Text>
          <Text style={[styles.emphasisAvg, { color: colors.secondaryForeground }]}>
            Avg {fmt(fuel.averages.kcal)} kcal · {fmt(fuel.averages.p)} g protein · {fmt(fuel.averages.c)} g carbs
          </Text>
        </View>
      </Card>

      <View style={[styles.segmented, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {(
          [
            { key: 'day', label: 'Daily', icon: 'sun' },
            { key: 'prep', label: 'Prep', icon: 'package' },
            { key: 'shop', label: 'Shop', icon: 'shopping-cart' },
          ] as const
        ).map((item) => {
          const active = view === item.key;
          return (
            <Pressable
              key={item.key}
              testID={`fuel-tab-${item.key}`}
              onPress={() => {
                Haptics.selectionAsync();
                setView(item.key);
              }}
              style={({ pressed }) => [
                styles.segment,
                { backgroundColor: active ? colors.primary : 'transparent' },
                pressed && shared.pressed,
              ]}
            >
              <Feather name={item.icon} size={13} color={active ? colors.primaryForeground : colors.mutedForeground} />
              <Text style={[styles.segmentLabel, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {view === 'day' ? <DailyView selected={selected} onSelect={setSelected} /> : null}
      {view === 'prep' ? <PrepView /> : null}
      {view === 'shop' ? <ShopView /> : null}
    </ScrollView>
  );
}

// ─── Daily ──────────────────────────────────────────────────────────────────

function DailyView({ selected, onSelect }: { selected: DayKey; onSelect: (day: DayKey) => void }) {
  const colors = useColors();
  const tone = useToneColor();
  const { fuel } = usePlanner();
  const day = fuel.days.find((d) => d.day === selected) ?? fuel.days[0];
  const max = Math.max(...fuel.days.map((d) => d.targets.kcal));
  const min = Math.min(...fuel.days.map((d) => d.targets.kcal));

  return (
    <>
      <View style={[styles.rail, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {fuel.days.map((d) => {
          const active = d.day === selected;
          const height = 18 + (max === min ? 20 : ((d.targets.kcal - min) / (max - min)) * 34);
          return (
            <Pressable
              key={d.day}
              testID={`fuel-day-${d.day}`}
              accessibilityLabel={`${DAY_NAMES[d.day]}, ${d.loadLabel}, ${fmt(d.targets.kcal)} calories`}
              onPress={() => {
                Haptics.selectionAsync();
                onSelect(d.day);
              }}
              style={({ pressed }) => [
                styles.railDay,
                { backgroundColor: active ? colors.secondary : 'transparent' },
                pressed && shared.pressed,
              ]}
            >
              <View style={styles.railBarWrap}>
                <View style={[styles.railBar, { height, backgroundColor: tone(loadTone(d.load)), opacity: active ? 1 : 0.55 }]} />
              </View>
              <Text style={[styles.railLabel, { color: active ? colors.foreground : colors.mutedForeground }]}>
                {d.day.toUpperCase()}
              </Text>
              <Text style={[styles.railKcal, { color: colors.mutedForeground }]}>{(d.targets.kcal / 1000).toFixed(1)}k</Text>
            </Pressable>
          );
        })}
      </View>

      <TargetsCard day={day} />

      <SectionTitle eyebrow={`${DAY_NAMES[day.day].toUpperCase()} / ${fromISODate(day.date).getDate()}`} title="Meals, timed to training" />
      <View style={styles.meals}>
        {day.meals.map((meal) => (
          <MealCard key={meal.id} meal={meal} />
        ))}
      </View>
    </>
  );
}

function MacroBar({ label, actual, target, perKg, color }: { label: string; actual: number; target: number; perKg: number; color: string }) {
  const colors = useColors();
  const ratio = Math.min(1, actual / Math.max(1, target));
  return (
    <View style={styles.macro}>
      <View style={styles.macroHead}>
        <Text style={[styles.macroLabel, { color: colors.secondaryForeground }]}>{label}</Text>
        <Text style={[styles.macroValue, { color: colors.foreground }]}>
          {fmt(actual)}
          <Text style={{ color: colors.mutedForeground }}> / {fmt(target)} g · {perKg.toFixed(1)} g/kg</Text>
        </Text>
      </View>
      <View style={[styles.macroTrack, { backgroundColor: colors.secondary }]}>
        <View style={[styles.macroFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function TargetsCard({ day }: { day: DayFuel }) {
  const colors = useColors();
  const tone = useToneColor();
  const accent = tone(loadTone(day.load));
  return (
    <Card style={styles.targets}>
      <View style={styles.targetsHead}>
        <View style={styles.flex}>
          <Eyebrow color={accent}>{day.loadLabel.toUpperCase()}</Eyebrow>
          <Text style={[styles.kcal, { color: colors.foreground }]}>
            {fmt(day.actual.kcal)}
            <Text style={[styles.kcalUnit, { color: colors.mutedForeground }]}> kcal planned</Text>
          </Text>
          <Text style={[styles.kcalTarget, { color: colors.mutedForeground }]}>Target {fmt(day.targets.kcal)} kcal</Text>
        </View>
        <View style={[styles.blockBadge, { backgroundColor: colors.secondary }]}>
          <Feather name="package" size={13} color={colors.primary} />
          <Text style={[styles.blockBadgeText, { color: colors.secondaryForeground }]}>Prep {day.block}</Text>
        </View>
      </View>
      <View style={styles.macros}>
        <MacroBar label="Protein" actual={day.actual.p} target={day.targets.p} perKg={day.targets.perKg.p} color={colors.primary} />
        <MacroBar label="Carbs" actual={day.actual.c} target={day.targets.c} perKg={day.targets.perKg.c} color={colors.accent} />
        <MacroBar label="Fat" actual={day.actual.f} target={day.targets.f} perKg={day.targets.perKg.f} color={colors.sky} />
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

function MealCard({ meal }: { meal: Meal }) {
  const colors = useColors();
  return (
    <Card style={styles.meal}>
      <View style={styles.mealHead}>
        <Text style={[styles.mealTime, { color: colors.mutedForeground }]}>{formatClock(meal.time)}</Text>
        {meal.prepped ? (
          <View style={[styles.prepTag, { borderColor: colors.primary }]}>
            <Text style={[styles.prepTagText, { color: colors.primary }]}>PREP BOX</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.mealTitle, { color: colors.foreground }]}>{meal.title}</Text>
      {meal.note ? <Text style={[styles.mealNote, { color: colors.mutedForeground }]}>{meal.note}</Text> : null}
      <View style={styles.items}>
        {meal.items.map((item, index) => (
          <View key={`${item.food}-${index}`} style={styles.item}>
            <Text style={[styles.itemName, { color: colors.secondaryForeground }]}>{item.name}</Text>
            <Text style={[styles.itemAmount, { color: colors.mutedForeground }]}>{item.amount}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.mealTotals, { color: colors.mutedForeground }]}>
        {fmt(meal.totals.p)} P · {fmt(meal.totals.c)} C · {fmt(meal.totals.f)} F · {fmt(meal.totals.kcal)} kcal
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
      <SectionTitle eyebrow={`PREP ${block.id} · COVERS ${range.toUpperCase()}`} title={block.when} />
      <Card>
        <View style={styles.prepMeta}>
          <View style={styles.prepStat}>
            <Feather name="clock" size={14} color={colors.primary} />
            <Text style={[styles.prepStatText, { color: colors.secondaryForeground }]}>~{block.minutes} min</Text>
          </View>
          <View style={styles.prepStat}>
            <Feather name="box" size={14} color={colors.primary} />
            <Text style={[styles.prepStatText, { color: colors.secondaryForeground }]}>{block.containers} containers</Text>
          </View>
        </View>

        <View style={styles.batches}>
          {block.batches.map((batch) => (
            <View key={batch.name} style={[styles.batch, { borderColor: colors.border }]}>
              <View style={styles.flex}>
                <Text style={[styles.batchName, { color: colors.foreground }]}>{batch.name}</Text>
                <Text style={[styles.batchDetail, { color: colors.mutedForeground }]}>{batch.detail}</Text>
              </View>
              <Text style={[styles.batchAmount, { color: colors.primary }]}>{batch.amount}</Text>
            </View>
          ))}
        </View>

        <Eyebrow>ORDER OF WORK</Eyebrow>
        <View style={styles.steps}>
          {block.steps.map((step, index) => (
            <View key={step} style={styles.step}>
              <Text style={[styles.stepIndex, { color: colors.primaryForeground, backgroundColor: colors.primary }]}>{index + 1}</Text>
              <Text style={[styles.stepText, { color: colors.secondaryForeground }]}>{step}</Text>
            </View>
          ))}
        </View>
      </Card>
    </>
  );
}

// ─── Shop ───────────────────────────────────────────────────────────────────

function ShopView() {
  const colors = useColors();
  const { fuel, isBought, toggleBought } = usePlanner();
  const all = fuel.shopping.flatMap((group) => group.items);
  const bought = all.filter((item) => isBought(item.food)).length;

  return (
    <>
      <SectionTitle
        eyebrow="ONE TRIP, WHOLE WEEK"
        title="Shopping list"
        right={
          <Text style={[styles.shopCount, { color: colors.mutedForeground }]}>
            {bought}/{all.length}
          </Text>
        }
      />
      {fuel.shopping.map((group) => (
        <View key={group.aisle} style={styles.aisle}>
          <View style={styles.aisleHead}>
            <Eyebrow>{group.aisle.toUpperCase()}</Eyebrow>
          </View>
          <Card style={styles.aisleCard}>
            {group.items.map((item, index) => {
              const done = isBought(item.food);
              return (
                <Pressable
                  key={item.food}
                  testID={`shop-${item.food}`}
                  onPress={() => {
                    Haptics.selectionAsync();
                    toggleBought(item.food);
                  }}
                  style={({ pressed }) => [
                    styles.shopRow,
                    index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                    pressed && shared.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.check,
                      { borderColor: done ? colors.primary : colors.border, backgroundColor: done ? colors.primary : 'transparent' },
                    ]}
                  >
                    {done ? <Feather name="check" size={12} color={colors.primaryForeground} /> : null}
                  </View>
                  <Text style={[styles.shopName, { color: colors.foreground }, done && styles.struck]}>{item.name}</Text>
                  <Text style={[styles.shopAmount, { color: colors.mutedForeground }, done && styles.struck]}>{item.amount}</Text>
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
  emphasis: { flexDirection: 'row', gap: 12 },
  emphasisIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emphasisTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginTop: 6, letterSpacing: -0.3 },
  emphasisDetail: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 5 },
  emphasisAvg: { fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 9 },
  segmented: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 5,
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 9,
  },
  segmentLabel: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  rail: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 21,
    borderWidth: 1,
    padding: 7,
    flexDirection: 'row',
    gap: 3,
  },
  railDay: { flex: 1, borderRadius: 14, paddingVertical: 8, alignItems: 'center' },
  railBarWrap: { height: 54, justifyContent: 'flex-end' },
  railBar: { width: 10, borderRadius: 5 },
  railLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.5, marginTop: 8 },
  railKcal: { fontFamily: 'Inter_500Medium', fontSize: 9, marginTop: 3 },
  targets: { marginTop: 12 },
  targetsHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  kcal: { fontFamily: 'Inter_700Bold', fontSize: 30, letterSpacing: -1.4, marginTop: 8 },
  kcalUnit: { fontFamily: 'Inter_500Medium', fontSize: 12, letterSpacing: 0 },
  kcalTarget: { fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 3 },
  blockBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 7 },
  blockBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  macros: { marginTop: 14, gap: 11 },
  macro: { gap: 6 },
  macroHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  macroLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  macroValue: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  macroTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  macroFill: { height: 6, borderRadius: 3 },
  notes: { marginTop: 14, gap: 8 },
  meals: { gap: 8 },
  meal: { padding: 14 },
  mealHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mealTime: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  prepTag: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2 },
  prepTagText: { fontFamily: 'Inter_700Bold', fontSize: 8.5, letterSpacing: 1 },
  mealTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, marginTop: 5 },
  mealNote: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  items: { marginTop: 10, gap: 6 },
  item: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  itemName: { fontFamily: 'Inter_500Medium', fontSize: 12.5, flex: 1 },
  itemAmount: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  mealTotals: { fontFamily: 'Inter_500Medium', fontSize: 10.5, marginTop: 10 },
  prepMeta: { flexDirection: 'row', gap: 16 },
  prepStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prepStatText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  batches: { marginTop: 12, marginBottom: 16 },
  batch: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1 },
  batchName: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  batchDetail: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  batchAmount: { fontFamily: 'Inter_700Bold', fontSize: 12.5 },
  steps: { gap: 10, marginTop: 10 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepIndex: {
    width: 20,
    height: 20,
    borderRadius: 7,
    textAlign: 'center',
    lineHeight: 20,
    overflow: 'hidden',
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  stepText: { fontFamily: 'Inter_400Regular', fontSize: 12.5, lineHeight: 18, flex: 1 },
  shopCount: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  aisle: { marginBottom: 12 },
  aisleHead: { paddingHorizontal: 20, marginBottom: 7 },
  aisleCard: { paddingVertical: 2 },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  shopName: { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },
  shopAmount: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  struck: { textDecorationLine: 'line-through', opacity: 0.5 },
});
