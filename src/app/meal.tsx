import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Chip, Eyebrow, TimeField, shared } from '@/components/ui';
import { fonts, type as t } from '@/constants/type';
import { usePlanner } from '@/context/PlannerContext';
import { useColors } from '@/hooks/useColors';
import { kcalFromMacros, replacedMeals, type SavedMeal } from '@/lib/logbook';
import { DAY_NAMES, formatClock, fromISODate, monthShort, roundTo } from '@/lib/time';
import { DAY_KEYS, type DayKey } from '@/lib/types';

const num = (value: string) => {
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};
const str = (value: number | undefined) => (value ? String(value) : '');
const newMealId = () => `meal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export default function MealScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ day?: string; replaces?: string; edit?: string }>();
  const { plan, fuel, week, today, todayKey, customMeals, saveMeal, deleteMeal, myMeals, forgetMeal } = usePlanner();

  const dayKey: DayKey = DAY_KEYS.includes(params.day as DayKey) ? (params.day as DayKey) : todayKey;
  const day = plan.days.find((d) => d.day === dayKey)!;
  const fuelDay = fuel.days.find((d) => d.day === dayKey);
  const existing = params.edit ? customMeals(day.date).find((m) => m.id === params.edit) : undefined;
  const swappedElsewhere = replacedMeals(week, day.date);
  if (existing?.replaces) swappedElsewhere.delete(existing.replaces);
  const swappable = (fuelDay?.meals ?? []).filter((m) => !swappedElsewhere.has(m.id));
  const initialInstead = existing ? existing.replaces : params.replaces;
  const insteadMeal = swappable.find((m) => m.id === initialInstead);

  const nowMinutes = roundTo(today.getHours() * 60 + today.getMinutes(), 15);
  const [name, setName] = useState(existing?.name ?? '');
  const [time, setTime] = useState(existing?.time ?? insteadMeal?.time ?? (dayKey === todayKey ? nowMinutes : 12 * 60 + 30));
  const [kcal, setKcal] = useState(str(existing?.kcal));
  const [p, setP] = useState(str(existing?.p));
  const [c, setC] = useState(str(existing?.c));
  const [f, setF] = useState(str(existing?.f));
  const [instead, setInstead] = useState<string | undefined>(insteadMeal?.id);
  const [remember, setRemember] = useState(!existing);

  const macros = { p: num(p), c: num(c), f: num(f) };
  const calories = num(kcal) || kcalFromMacros(macros.p, macros.c, macros.f);
  const valid = name.trim().length > 0 && calories > 0;
  const date = fromISODate(day.date);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const fill = (meal: SavedMeal) => {
    setName(meal.name);
    setKcal(str(meal.kcal));
    setP(str(meal.p));
    setC(str(meal.c));
    setF(str(meal.f));
    setRemember(false);
  };

  const save = () => {
    if (!valid) return;
    saveMeal(
      day.date,
      {
        id: existing?.id ?? newMealId(),
        name: name.trim(),
        time,
        kcal: calories,
        ...macros,
        replaces: instead,
      },
      remember,
    );
    close();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.top, { paddingTop: Platform.OS === 'ios' ? 18 : insets.top + 14, borderBottomColor: colors.border }]}>
        <View style={styles.flex}>
          <Eyebrow color={colors.accent}>
            {DAY_NAMES[dayKey].toUpperCase()} · {monthShort(date).toUpperCase()} {date.getDate()}
          </Eyebrow>
          <Text style={[t.title, { color: colors.foreground, marginTop: 4 }]}>{existing ? 'Edit meal' : 'Add your meal'}</Text>
        </View>
        <Pressable
          testID="close-meal"
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={close}
          style={({ pressed }) => [styles.close, { backgroundColor: colors.secondary }, pressed && shared.pressed]}
        >
          <Feather name="x" size={18} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 140 }]} keyboardShouldPersistTaps="handled">
        {!existing && myMeals.length > 0 ? (
          <Card style={styles.card}>
            <Eyebrow>MY MEALS · TAP TO FILL IN</Eyebrow>
            {myMeals.slice(0, 8).map((meal, i) => (
              <View key={meal.id} style={[styles.savedRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Pressable
                  testID={`saved-${i}`}
                  accessibilityRole="button"
                  onPress={() => fill(meal)}
                  style={({ pressed }) => [styles.flex, pressed && shared.pressed]}
                >
                  <Text style={[t.bodyStrong, { color: colors.foreground }]}>{meal.name}</Text>
                  <Text style={[t.caption, { color: colors.mutedForeground, marginTop: 2 }]}>
                    {meal.kcal} kcal{meal.p ? ` · ${meal.p} g protein` : ''}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${meal.name} from My meals`}
                  hitSlop={8}
                  onPress={() => forgetMeal(meal.id)}
                  style={({ pressed }) => [styles.icon, pressed && shared.pressed]}
                >
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            ))}
          </Card>
        ) : null}

        <Card style={styles.card}>
          <Text style={[t.bodyStrong, { color: colors.foreground }]}>What did you eat?</Text>
          <TextInput
            testID="meal-name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Chipotle chicken bowl"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="sentences"
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]}
          />
          <TimeField testID="meal-time" label="When" value={time} min={5 * 60} max={23 * 60 + 45} onChange={setTime} />
        </Card>

        <Card style={styles.card}>
          <Text style={[t.bodyStrong, { color: colors.foreground }]}>How much?</Text>
          <Text style={[t.caption, { color: colors.mutedForeground, marginTop: -6 }]}>
            Only know calories? That’s fine. Add protein if you can — it’s the one that matters most.
          </Text>
          <NumberField testID="meal-kcal" label="Calories" suffix="kcal" value={kcal} onChange={setKcal} placeholder={calories && !num(kcal) ? String(calories) : '0'} large />
          <View style={styles.macroRow}>
            <NumberField testID="meal-p" label="Protein" suffix="g" value={p} onChange={setP} />
            <NumberField testID="meal-c" label="Carbs" suffix="g" value={c} onChange={setC} />
            <NumberField testID="meal-f" label="Fat" suffix="g" value={f} onChange={setF} />
          </View>
          {!num(kcal) && calories > 0 ? (
            <Text style={[t.caption, { color: colors.secondaryForeground }]}>≈ {calories} kcal from those macros.</Text>
          ) : null}
        </Card>

        {swappable.length > 0 ? (
          <Card style={styles.card}>
            <Text style={[t.bodyStrong, { color: colors.foreground }]}>Did you eat it instead of a planned meal?</Text>
            <Text style={[t.caption, { color: colors.mutedForeground, marginTop: -6 }]}>
              Pick one and it’s swapped out, so your totals stay honest.
            </Text>
            <View style={shared.wrap}>
              <Chip compact tone="apricot" label="No, it was extra" selected={!instead} onPress={() => setInstead(undefined)} />
              {swappable.map((m) => {
                const duplicate = swappable.filter((x) => x.title === m.title).length > 1;
                return (
                  <Chip
                    key={m.id}
                    compact
                    tone="apricot"
                    testID={`instead-${m.id}`}
                    label={duplicate ? `${m.title} · ${formatClock(m.time)}` : m.title}
                    selected={instead === m.id}
                    onPress={() => setInstead(m.id)}
                  />
                );
              })}
            </View>
          </Card>
        ) : null}

        {!existing ? (
          <Pressable
            testID="remember-meal"
            accessibilityRole="switch"
            accessibilityState={{ checked: remember }}
            onPress={() => setRemember(!remember)}
            style={({ pressed }) => [styles.toggle, pressed && shared.pressed]}
          >
            <Feather name={remember ? 'check-square' : 'square'} size={20} color={remember ? colors.primary : colors.mutedForeground} />
            <Text style={[t.body, { color: colors.secondaryForeground }]}>Save to My meals for next time</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        {existing ? (
          <Button
            testID="delete-meal"
            variant="ghost"
            icon="trash-2"
            label="Delete"
            onPress={() => {
              deleteMeal(day.date, existing.id);
              close();
            }}
            style={styles.flex}
          />
        ) : null}
        <Button testID="save-meal" label={existing ? 'Save changes' : 'Log this meal'} icon="check" disabled={!valid} onPress={save} style={{ flex: 2 }} />
      </View>
    </View>
  );
}

function NumberField({
  label,
  suffix,
  value,
  onChange,
  placeholder = '0',
  large,
  testID,
}: {
  label: string;
  suffix: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  large?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.number, !large && styles.numberSmall, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <Text style={[t.micro, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={styles.numberRow}>
        <TextInput
          testID={testID}
          value={value}
          onChangeText={(text) => onChange(text.replace(/[^0-9]/g, '').slice(0, 4))}
          keyboardType="number-pad"
          returnKeyType="done"
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          style={[large ? styles.numberInputLarge : styles.numberInput, { color: colors.foreground }]}
        />
        <Text style={[t.caption, { color: colors.mutedForeground }]}>{suffix}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, gap: 12 },
  close: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body: { paddingTop: 16, gap: 14 },
  card: { gap: 14 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, minHeight: 54, fontFamily: fonts.medium, fontSize: 16 },
  macroRow: { flexDirection: 'row', gap: 10 },
  number: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  numberSmall: { flex: 1 },
  numberRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  numberInput: { flex: 1, fontFamily: fonts.semibold, fontSize: 20, paddingVertical: 4, minWidth: 30 },
  numberInputLarge: { flex: 1, fontFamily: fonts.display, fontSize: 38, paddingVertical: 2 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 22, minHeight: 44 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
