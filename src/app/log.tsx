import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EffortPicker, effortLabel } from '@/components/log';
import { Button, Card, CheckCircle, Chip, Eyebrow, Segmented, shared } from '@/components/ui';
import { type as t } from '@/constants/type';
import { usePlanner } from '@/context/PlannerContext';
import { useColors } from '@/hooks/useColors';
import { dayTasks, FEELS, readiness, SLEEP_OPTIONS, type Feel } from '@/lib/logbook';
import { DAY_NAMES, fromISODate, monthShort } from '@/lib/time';
import { DAY_KEYS, type DayKey } from '@/lib/types';

export default function LogScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ day?: string; focus?: string }>();
  const { plan, fuel, week, todayKey, toggleSession, rateSession, toggleMeal, toggleDone, checkIn, saveCheckIn } = usePlanner();

  const todayIndex = DAY_KEYS.indexOf(todayKey);
  const loggable = DAY_KEYS.slice(0, todayIndex + 1);
  const initial = DAY_KEYS.includes(params.day as DayKey) ? (params.day as DayKey) : todayKey;
  const [selected, setSelected] = useState<DayKey>(initial);

  const day = plan.days.find((d) => d.day === selected)!;
  const fuelDay = fuel.days.find((d) => d.day === selected);
  const tasks = dayTasks(day, fuelDay, week);
  const sessions = tasks.filter((x) => x.kind === 'session' || x.kind === 'event');
  const meals = tasks.filter((x) => x.kind === 'meal');
  const planned = meals.filter((m) => !m.custom);
  const habits = tasks.filter((x) => x.kind === 'habit');
  const current = checkIn(day.date);
  const ready = readiness(current);
  const date = fromISODate(day.date);
  const allEaten = planned.length > 0 && planned.every((m) => m.done);
  const openMeal = (id?: string) => router.push(id ? `/meal?day=${selected}&edit=${id}` : `/meal?day=${selected}`);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.top, { paddingTop: (Platform.OS === 'ios' ? 18 : insets.top + 14), borderBottomColor: colors.border }]}>
        <View style={styles.flex}>
          <Eyebrow color={colors.accent}>
            {DAY_NAMES[selected].toUpperCase()} · {monthShort(date).toUpperCase()} {date.getDate()}
          </Eyebrow>
          <Text style={[t.title, { color: colors.foreground, marginTop: 4 }]}>Log</Text>
        </View>
        <Pressable
          testID="close-log"
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={close}
          style={({ pressed }) => [styles.close, { backgroundColor: colors.secondary }, pressed && shared.pressed]}
        >
          <Feather name="x" size={18} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
        {loggable.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
            {[...loggable].reverse().map((d) => (
              <Chip key={d} compact testID={`log-day-${d}`} label={d === todayKey ? 'Today' : DAY_NAMES[d]} selected={selected === d} onPress={() => setSelected(d)} />
            ))}
          </ScrollView>
        ) : null}

        <Section icon="moon" title="Morning check-in" subtitle="How you slept and how you feel decides how hard to push.">
          <Text style={[t.label, { color: colors.secondaryForeground }]}>Hours of sleep</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {SLEEP_OPTIONS.map((hours) => (
              <Chip
                key={hours}
                compact
                tone="sky"
                testID={`sleep-${hours}`}
                label={hours === 9.5 ? '9½+' : `${hours}`.replace('.5', '½')}
                selected={current?.sleepHours === hours}
                onPress={() => saveCheckIn(day.date, { sleepHours: hours })}
              />
            ))}
          </ScrollView>
          <Text style={[t.label, { color: colors.secondaryForeground, marginTop: 6 }]}>How do you feel?</Text>
          <Segmented<Feel>
            testID="feel"
            value={current?.feel ?? (0 as Feel)}
            onChange={(feel) => saveCheckIn(day.date, { feel })}
            options={FEELS.map((f) => ({ value: f.value, label: f.label }))}
          />
          {ready ? (
            <View style={[styles.ready, { backgroundColor: ready.tone === 'easy' ? colors.accentSoft : colors.primarySoft }]}>
              <Text style={[t.bodyStrong, { color: colors.foreground }]}>{ready.label}</Text>
              <Text style={[t.caption, { color: colors.secondaryForeground, marginTop: 3 }]}>{ready.advice}</Text>
            </View>
          ) : null}
        </Section>

        <Section icon="activity" title="Training" subtitle={sessions.length ? 'Check it off, then rate how hard it felt.' : 'Rest day — nothing to log.'}>
          {sessions.map((s) => (
            <View key={s.key} style={[styles.session, { backgroundColor: colors.secondary, borderColor: s.done ? 'rgba(212,241,113,0.35)' : colors.border }]}>
              <View style={styles.sessionHead}>
                <View style={styles.flex}>
                  <Text style={[t.micro, { color: colors.mutedForeground }]}>{s.time} · {s.minutes} min</Text>
                  <Text style={[t.subheading, { color: colors.foreground, marginTop: 3 }]}>{s.title}</Text>
                </View>
                <CheckCircle testID={`log-session-${s.key}`} done={s.done} label={`${s.done ? 'Undo' : 'Log'} ${s.title}`} onPress={() => toggleSession(s.sessionId!)} />
              </View>
              {s.done ? (
                <View style={styles.effort}>
                  <Text style={[t.label, { color: colors.secondaryForeground }]}>
                    How hard was it?{s.effort ? `  ${s.effort}/10 · ${effortLabel(s.effort)}` : ''}
                  </Text>
                  <EffortPicker testID={`effort-${s.key}`} value={s.effort} onChange={(effort) => rateSession(s.sessionId!, effort)} />
                </View>
              ) : (
                <Button compact variant="secondary" icon="check" label="I did this" onPress={() => toggleSession(s.sessionId!)} />
              )}
            </View>
          ))}
        </Section>

        <Section
          icon="coffee"
          title="Meals"
          subtitle={`${meals.filter((m) => m.done).length} of ${meals.length} eaten`}
          action={
            planned.length > 0 ? (
              <Pressable
                testID="log-all-meals"
                accessibilityRole="button"
                onPress={() => planned.filter((m) => m.done === allEaten).forEach((m) => toggleMeal(m.key))}
                hitSlop={8}
              >
                <Text style={[t.label, { color: colors.primary }]}>{allEaten ? 'Clear all' : 'Ate all as planned'}</Text>
              </Pressable>
            ) : null
          }
        >
          {meals.map((m, i) => {
            const meal = fuelDay?.meals.find((x) => x.id === m.key);
            const press = () => (m.custom ? openMeal(m.key) : toggleMeal(m.key));
            return (
              <Pressable
                key={m.key}
                accessibilityRole={m.custom ? 'button' : 'checkbox'}
                accessibilityState={{ checked: m.done }}
                onPress={press}
                style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }, pressed && shared.pressed]}
              >
                <View style={styles.flex}>
                  <Text style={[t.bodyStrong, { color: colors.foreground }, m.done && !m.custom && styles.done]}>{m.title}</Text>
                  <Text style={[t.caption, { color: colors.mutedForeground, marginTop: 2 }]} numberOfLines={1}>
                    {m.custom ? `${m.time} · ${m.detail} · tap to edit` : `${m.time} · ${Math.round(meal?.totals.kcal ?? 0)} kcal · ${m.detail}`}
                  </Text>
                </View>
                <CheckCircle testID={`log-meal-${m.key}`} tone="apricot" done={m.done} label={m.custom ? `Edit ${m.title}` : `${m.done ? 'Undo' : 'Log'} ${m.title}`} onPress={press} />
              </Pressable>
            );
          })}
          <Button testID="add-own-meal" compact variant="secondary" icon="plus" label="Add your own meal" onPress={() => openMeal()} />
        </Section>

        <Section icon="wind" title="Recovery" subtitle="The small things that make the big sessions land.">
          {habits.map((h, i) => (
            <Pressable
              key={h.key}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: h.done }}
              onPress={() => toggleDone(h.key)}
              style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }, pressed && shared.pressed]}
            >
              <View style={styles.flex}>
                <Text style={[t.bodyStrong, { color: colors.foreground }, h.done && styles.done]}>{h.title}</Text>
                <Text style={[t.caption, { color: colors.mutedForeground, marginTop: 2 }]} numberOfLines={1}>
                  {h.time} · {h.detail}
                </Text>
              </View>
              <CheckCircle tone="sky" done={h.done} label={`${h.done ? 'Undo' : 'Log'} ${h.title}`} onPress={() => toggleDone(h.key)} />
            </Pressable>
          ))}
        </Section>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <Button testID="log-done" label="Done" onPress={close} />
      </View>
    </View>
  );
}

function Section({
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <Card style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={[styles.sectionIcon, { backgroundColor: colors.secondary }]}>
          <Feather name={icon} size={16} color={colors.accent} />
        </View>
        <View style={styles.flex}>
          <Text style={[t.heading, { color: colors.foreground }]}>{title}</Text>
          <Text style={[t.caption, { color: colors.mutedForeground, marginTop: 2 }]}>{subtitle}</Text>
        </View>
        {action}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, gap: 12 },
  close: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body: { paddingTop: 16, gap: 14 },
  days: { gap: 8, paddingHorizontal: 20 },
  chips: { gap: 8 },
  section: { padding: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sectionBody: { marginTop: 14, gap: 10 },
  ready: { borderRadius: 14, padding: 12 },
  session: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 12 },
  sessionHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  effort: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  done: { textDecorationLine: 'line-through', opacity: 0.45 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
});
