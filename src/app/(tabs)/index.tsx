import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EffortSheet, KIND_META, TaskRow } from '@/components/log';
import {
  Avatar,
  Bullet,
  Button,
  Card,
  Eyebrow,
  Hint,
  ProgressBar,
  ProgressRing,
  Screen,
  SectionTitle,
  shared,
} from '@/components/ui';
import { type as t } from '@/constants/type';
import { usePlanner } from '@/context/PlannerContext';
import { useColors } from '@/hooks/useColors';
import { dayTasks, eatenMacros, FEELS, progress, readiness, type DayTask } from '@/lib/logbook';
import { LOAD_LABELS } from '@/lib/nutrition';
import { DAY_NAMES, formatClock, fromISODate, monthShort } from '@/lib/time';
import type { DayKey, PlanDay } from '@/lib/types';

const greeting = (date: Date) => {
  const hour = date.getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};

const loadWords = (score: number) =>
  score < 4 ? 'A light week' : score < 6.5 ? 'A moderate week' : score < 8.5 ? 'A big week — sleep is the priority' : 'A very big week — protect every hour of sleep';

export default function TodayScreen() {
  const colors = useColors();
  const router = useRouter();
  const {
    profile,
    plan,
    fuel,
    week,
    sessions,
    today,
    todayKey,
    todayISO,
    weekEvent,
    toggleSession,
    rateSession,
    toggleDone,
    toggleMeal,
    checkIn,
    hintSeen,
    dismissHint,
  } = usePlanner();

  const [selected, setSelected] = useState<DayKey>(todayKey);
  const [rating, setRating] = useState<DayTask | null>(null);

  const day = plan.days.find((d) => d.day === selected) ?? plan.days[0];
  const fuelDay = fuel.days.find((d) => d.day === selected);
  const tasks = useMemo(() => dayTasks(day, fuelDay, week), [day, fuelDay, week]);
  const dayProgress = progress(tasks);
  const isToday = selected === todayKey;
  const date = fromISODate(day.date);

  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const next =
    (isToday ? tasks.find((task) => !task.done && task.start + Math.max(task.minutes, 30) + 60 >= nowMinutes) : null) ??
    tasks.find((task) => !task.done);

  const toggle = (task: DayTask) => {
    if (task.kind === 'session' || task.kind === 'event') {
      toggleSession(task.sessionId!);
      // Logging a session asks how hard it felt; undoing doesn't.
      if (!task.done) setRating(task);
    } else if (task.kind === 'meal') {
      toggleMeal(task.key);
    } else {
      toggleDone(task.key);
    }
  };

  const todaysCheckIn = checkIn(todayISO);
  const ready = readiness(todaysCheckIn);
  const eaten = fuelDay ? eatenMacros(fuelDay, week) : null;
  const mealsLogged = fuelDay ? fuelDay.meals.filter((m) => week.meals.includes(m.id)).length : 0;
  const training = sessions.filter((s) => !s.isEvent);
  const trainingDone = training.filter((s) => week.sessions[s.id]).length;
  const firstName = profile.name && profile.name !== 'Athlete' ? `, ${profile.name.split(' ')[0]}` : '';

  return (
    <Screen testID="today-screen">
      <View style={styles.header}>
        <View style={styles.flex}>
          <Eyebrow color={colors.accent}>
            {DAY_NAMES[todayKey].toUpperCase()} · {monthShort(today).toUpperCase()} {today.getDate()}
          </Eyebrow>
          <Text style={[t.title, { color: colors.foreground, marginTop: 6 }]}>
            {greeting(today)}
            {firstName}
          </Text>
        </View>
        <Avatar testID="profile-button" name={profile.name} onPress={() => router.navigate('/you')} />
      </View>

      {!hintSeen('today-intro') ? (
        <Hint testID="today-hint" title="How Perform works" icon="compass" onDismiss={() => dismissHint('today-intro')}>
          <Bullet>Your day is listed below in time order. Tap the circle on the right to check something off.</Bullet>
          <Bullet>Tap the + Log button any time to log a session and how hard it felt, a meal, or how you slept.</Bullet>
          <Bullet>Week changed? Update it under You, and the plan and meals rebuild instantly.</Bullet>
        </Hint>
      ) : null}

      <WeekRail days={plan.days} selected={selected} todayKey={todayKey} onSelect={setSelected} />

      {isToday && !ready ? (
        <Pressable
          testID="checkin-prompt"
          accessibilityRole="button"
          onPress={() => router.push('/log?focus=checkin')}
          style={({ pressed }) => [styles.checkin, { backgroundColor: colors.card, borderColor: colors.border }, pressed && shared.pressed]}
        >
          <View style={[styles.checkinIcon, { backgroundColor: colors.skySoft }]}>
            <Feather name="moon" size={18} color={colors.sky} />
          </View>
          <View style={styles.flex}>
            <Text style={[t.bodyStrong, { color: colors.foreground }]}>How did you sleep?</Text>
            <Text style={[t.caption, { color: colors.mutedForeground, marginTop: 2 }]}>10-second check-in · tells you whether to push or hold back</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
      ) : null}

      {isToday && ready && todaysCheckIn ? (
        <View
          style={[
            styles.checkin,
            {
              backgroundColor: ready.tone === 'easy' ? colors.accentSoft : colors.primarySoft,
              borderColor: ready.tone === 'easy' ? 'rgba(229,195,140,0.3)' : 'rgba(212,241,113,0.25)',
            },
          ]}
        >
          <View style={[styles.checkinIcon, { backgroundColor: colors.secondary }]}>
            <Feather name={ready.tone === 'easy' ? 'battery' : 'battery-charging'} size={18} color={ready.tone === 'easy' ? colors.accent : colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={[t.bodyStrong, { color: colors.foreground }]}>{ready.label}</Text>
            <Text style={[t.caption, { color: colors.secondaryForeground, marginTop: 2 }]}>
              {todaysCheckIn.sleepHours !== undefined ? `Slept ${todaysCheckIn.sleepHours} h` : ''}
              {todaysCheckIn.feel ? ` · feeling ${FEELS[todaysCheckIn.feel - 1].label.toLowerCase()}` : ''}. {ready.advice}
            </Text>
          </View>
        </View>
      ) : null}

      <LinearGradient
        colors={['#1C201D', colors.card]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { borderColor: colors.borderStrong }]}
      >
        {next ? (
          <>
            <View style={styles.heroTop}>
              <Eyebrow color={colors.primary}>
                {isToday ? 'UP NEXT' : `${DAY_NAMES[selected].toUpperCase()}`} · {next.time}
              </Eyebrow>
              <View style={[styles.kindPill, { borderColor: colors.borderStrong }]}>
                <Feather name={KIND_META[next.kind].icon} size={11} color={colors.secondaryForeground} />
                <Text style={[t.micro, { color: colors.secondaryForeground }]}>{KIND_META[next.kind].label}</Text>
              </View>
            </View>
            <Text style={[t.hero, styles.heroTitle, { color: colors.foreground }]} numberOfLines={2}>
              {next.title}
            </Text>
            <Text style={[t.body, { color: colors.mutedForeground }]} numberOfLines={2}>
              {next.kind === 'session' || next.kind === 'event'
                ? `${next.minutes} min · ${next.detail}`
                : next.detail}
            </Text>
            <View style={styles.heroActions}>
              <Button
                testID="hero-done"
                label={next.kind === 'meal' ? 'I ate this' : next.kind === 'habit' ? 'Done' : 'Log session'}
                icon="check"
                onPress={() => toggle(next)}
                style={styles.flex}
              />
              {next.kind !== 'habit' ? (
                <Button
                  variant="ghost"
                  label="Details"
                  onPress={() => router.navigate(next.kind === 'meal' ? '/fuel' : '/plan')}
                  style={styles.detailsButton}
                />
              ) : null}
            </View>
          </>
        ) : (
          <View style={styles.allDone}>
            <Feather name="check-circle" size={26} color={colors.primary} />
            <Text style={[t.heading, { color: colors.foreground }]}>Everything’s logged.</Text>
            <Text style={[t.body, { color: colors.mutedForeground, textAlign: 'center' }]}>
              Lights out by {formatClock(day.lightsOut)}. Tomorrow’s plan is ready.
            </Text>
          </View>
        )}
      </LinearGradient>

      <SectionTitle
        eyebrow={`${DAY_NAMES[selected].toUpperCase()} · ${monthShort(date).toUpperCase()} ${date.getDate()}`}
        title={isToday ? 'Your day' : `${DAY_NAMES[selected]}`}
        action="Log more"
        onAction={() => router.push(`/log?day=${selected}`)}
      />
      <Card style={styles.listCard}>
        <View style={styles.progressHead}>
          <Text style={[t.caption, { color: colors.secondaryForeground }]}>
            {dayProgress.done} of {dayProgress.total} done
          </Text>
          <Text style={[t.caption, { color: colors.mutedForeground }]}>{LOAD_LABELS[day.load]}</Text>
        </View>
        <ProgressBar value={dayProgress.ratio} height={4} />
        <View style={styles.list}>
          {tasks.map((task, index) => (
            <TaskRow key={task.key} task={task} first={index === 0} onToggle={() => toggle(task)} />
          ))}
        </View>
      </Card>

      <View style={styles.statRow}>
        <Pressable
          testID="fuel-snapshot"
          accessibilityRole="button"
          onPress={() => router.navigate('/fuel')}
          style={({ pressed }) => [styles.stat, { backgroundColor: colors.card, borderColor: colors.border }, pressed && shared.pressed]}
        >
          <Eyebrow>FUEL</Eyebrow>
          <View style={styles.statBody}>
            <ProgressRing value={eaten && fuelDay ? eaten.kcal / fuelDay.actual.kcal : 0} size={58} stroke={5} color={colors.accent}>
              <Text style={[t.label, { color: colors.foreground }]}>{mealsLogged}/{fuelDay?.meals.length ?? 0}</Text>
            </ProgressRing>
            <View style={styles.flex}>
              <Text style={[t.subheading, { color: colors.foreground }]}>{Math.round(eaten?.kcal ?? 0).toLocaleString('en-US')}</Text>
              <Text style={[t.micro, { color: colors.mutedForeground, marginTop: 2 }]}>
                of {Math.round(fuelDay?.actual.kcal ?? 0).toLocaleString('en-US')} kcal
              </Text>
            </View>
          </View>
          <Text style={[t.micro, { color: colors.mutedForeground }]}>meals logged ›</Text>
        </Pressable>

        <Pressable
          testID="week-snapshot"
          accessibilityRole="button"
          onPress={() => router.navigate('/plan')}
          style={({ pressed }) => [styles.stat, { backgroundColor: colors.card, borderColor: colors.border }, pressed && shared.pressed]}
        >
          <Eyebrow>THIS WEEK</Eyebrow>
          <View style={styles.statBody}>
            <ProgressRing value={training.length ? trainingDone / training.length : 0} size={58} stroke={5}>
              <Text style={[t.label, { color: colors.foreground }]}>{trainingDone}/{training.length}</Text>
            </ProgressRing>
            <View style={styles.flex}>
              <Text style={[t.subheading, { color: colors.foreground }]}>{plan.load.score.toFixed(1)}</Text>
              <Text style={[t.micro, { color: colors.mutedForeground, marginTop: 2 }]}>load / 10</Text>
            </View>
          </View>
          <Text style={[t.micro, { color: colors.mutedForeground }]}>sessions done ›</Text>
        </Pressable>
      </View>
      <Text style={[t.caption, styles.loadNote, { color: colors.mutedForeground }]}>{loadWords(plan.load.score)}.</Text>

      <Pressable
        testID="event-card"
        accessibilityRole="button"
        accessibilityHint="Change what this week is built around"
        onPress={() => router.push('/edit/event')}
        style={({ pressed }) => [styles.event, { backgroundColor: colors.card, borderColor: colors.border }, pressed && shared.pressed]}
      >
        <View style={[styles.eventIcon, { backgroundColor: colors.accentSoft }]}>
          <Feather name="award" size={18} color={colors.accent} />
        </View>
        <View style={styles.flex}>
          <Eyebrow>THIS WEEK’S FOCUS</Eyebrow>
          <Text style={[t.bodyStrong, { color: colors.foreground, marginTop: 4 }]}>{weekEvent.title}</Text>
        </View>
        <Text style={[t.label, { color: colors.primary }]}>Change</Text>
      </Pressable>

      <EffortSheet
        visible={Boolean(rating)}
        title={rating?.title ?? ''}
        value={rating ? week.sessions[rating.sessionId!]?.effort : undefined}
        onChange={(effort) => rating && rateSession(rating.sessionId!, effort)}
        onClose={() => setRating(null)}
      />
    </Screen>
  );
}

function WeekRail({
  days,
  selected,
  todayKey,
  onSelect,
}: {
  days: PlanDay[];
  selected: DayKey;
  todayKey: DayKey;
  onSelect: (day: DayKey) => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.rail, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {days.map((d) => {
        const active = d.day === selected;
        const dot = d.color === 'orange' ? colors.accent : d.color === 'blue' ? colors.sky : colors.primary;
        const training = d.sessions.length > 0;
        return (
          <Pressable
            key={d.day}
            testID={`focus-day-${d.day.toUpperCase()}`}
            accessibilityRole="button"
            accessibilityLabel={`${DAY_NAMES[d.day]}, ${d.label}`}
            accessibilityState={{ selected: active }}
            onPress={() => {
              Haptics.selectionAsync().catch(() => undefined);
              onSelect(d.day);
            }}
            style={({ pressed }) => [styles.railDay, { backgroundColor: active ? colors.foreground : 'transparent' }, pressed && shared.pressed]}
          >
            <Text style={[t.micro, { color: active ? colors.background : colors.mutedForeground, letterSpacing: 0.6 }]}>
              {d.day === todayKey ? 'TODAY' : d.day.toUpperCase()}
            </Text>
            <Text style={[t.heading, { color: active ? colors.background : colors.foreground, marginTop: 2 }]}>
              {fromISODate(d.date).getDate()}
            </Text>
            <View style={[styles.railDot, { backgroundColor: training ? dot : 'transparent', borderColor: training ? dot : colors.borderStrong }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  rail: { marginHorizontal: 20, borderRadius: 22, borderWidth: 1, padding: 6, flexDirection: 'row', gap: 2, marginBottom: 14 },
  railDay: { flex: 1, borderRadius: 16, paddingVertical: 10, alignItems: 'center', minHeight: 72 },
  railDot: { width: 6, height: 6, borderRadius: 3, borderWidth: 1, marginTop: 6 },
  checkin: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  checkinIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  hero: { marginHorizontal: 20, borderRadius: 26, borderWidth: 1, padding: 22 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kindPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  heroTitle: { marginTop: 12, marginBottom: 8 },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  detailsButton: { paddingHorizontal: 22 },
  allDone: { alignItems: 'center', gap: 8, paddingVertical: 10 },
  listCard: { paddingTop: 14, paddingBottom: 4 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  list: { marginTop: 6 },
  statRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: 14 },
  stat: { flex: 1, borderRadius: 22, borderWidth: 1, padding: 15, gap: 12 },
  statBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  loadNote: { marginHorizontal: 22, marginTop: 10 },
  event: {
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 22,
    borderWidth: 1,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  eventIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
