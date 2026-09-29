import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/hooks/useColors';
import { usePlanner } from '@/context/PlannerContext';
import type { PlanSession } from '@/context/PlannerContext';
import {
  formatClock,
  formatLongDate,
  formatMinutesPadded,
  fromISODate,
  isoWeek,
  monthShort,
} from '@/lib/time';
import type { MicroItem, PlanDay } from '@/lib/types';

type Tone = 'lime' | 'apricot' | 'sky';

type TimelineItem = {
  key: string;
  start: number;
  time: string;
  type: string;
  title: string;
  detail: string;
  duration: string;
  tone: Tone;
  sessionId?: string;
};

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const toneColors = (
  tone: Tone,
  colors: ReturnType<typeof useColors>,
) => {
  if (tone === 'lime') return colors.primary;
  if (tone === 'apricot') return colors.accent;
  return colors.sky;
};

const sessionTone = (session: PlanSession): Tone =>
  session.color === 'orange'
    ? 'apricot'
    : session.color === 'blue'
      ? 'sky'
      : 'lime';

const dayTone = (day: PlanDay): Tone =>
  day.color === 'orange' ? 'apricot' : day.color === 'blue' ? 'sky' : 'lime';

const MICRO: Record<MicroItem['kind'], { type: string; tone: Tone }> = {
  mobility: { type: 'RESET', tone: 'sky' },
  fuel: { type: 'FUEL', tone: 'apricot' },
  downshift: { type: 'RECOVERY', tone: 'apricot' },
  winddown: { type: 'SLEEP', tone: 'sky' },
};

function makeTimeline(day: PlanDay | undefined): TimelineItem[] {
  if (!day) return [];

  const sessions: TimelineItem[] = day.sessions.map((session) => ({
    key: session.id,
    start: session.start,
    time: session.time,
    type: session.type.toUpperCase(),
    title: session.title,
    detail: session.focus,
    duration: session.duration,
    tone: sessionTone(session),
    sessionId: session.id,
  }));

  const rest: TimelineItem[] =
    sessions.length === 0
      ? [
          {
            key: `${day.day}:rest`,
            start: -1,
            time: 'Anytime',
            type: 'RESET',
            title: 'Full rest + prep',
            detail: 'No training today · plan and prep the next block',
            duration: '15 min',
            tone: 'sky',
          },
        ]
      : [];

  const micro: TimelineItem[] = day.micro.map((item) => ({
    key: item.key,
    start: item.start,
    time: formatClock(item.start),
    type: MICRO[item.kind].type,
    title: item.title,
    detail: item.detail,
    duration: formatMinutesPadded(item.minutes),
    tone: MICRO[item.kind].tone,
  }));

  return [...rest, ...sessions, ...micro].sort((a, b) => a.start - b.start);
}

const windowIcon = (start: number): FeatherName =>
  start < 0 ? 'coffee' : start < 12 * 60 ? 'sunrise' : start < 17 * 60 ? 'sun' : 'sunset';

export default function TodayScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const {
    profile,
    sessions,
    plan,
    today,
    todayKey,
    weekEvent,
    toggleSession,
    cycleEvent,
    isDone,
    toggleDone,
  } = usePlanner();

  const [selectedDay, setSelectedDay] = useState(todayKey.toUpperCase());
  const [showRecovery, setShowRecovery] = useState(false);

  const week = useMemo(
    () =>
      plan.days.map((day) => ({
        day: day.day.toUpperCase(),
        date: String(fromISODate(day.date).getDate()),
        label: day.day === todayKey ? 'Today' : day.label,
        tone: dayTone(day),
      })),
    [plan.days, todayKey],
  );

  const selectedPlan = plan.days.find(
    (day) => day.day.toUpperCase() === selectedDay,
  );
  const selectedDate = selectedPlan ? fromISODate(selectedPlan.date) : today;

  const timeline = useMemo(
    () => makeTimeline(selectedPlan),
    [selectedPlan],
  );

  const isItemDone = (item: TimelineItem) =>
    item.sessionId
      ? Boolean(
          sessions.find((session) => session.id === item.sessionId)
            ?.completed,
        )
      : isDone(item.key);

  const next =
    timeline.find((item) => !isItemDone(item)) ?? timeline[0];

  const completed = sessions.filter(
    (session) => session.completed,
  ).length;

  const training = sessions.filter((session) => !session.isEvent);
  const avgMinutes = training.length
    ? Math.round(
        training.reduce((sum, session) => sum + session.minutes, 0) /
          training.length,
      )
    : 0;
  const recoveryMinutes = selectedPlan
    ? selectedPlan.micro
        .filter((item) => item.kind === 'mobility' || item.kind === 'downshift')
        .reduce((sum, item) => sum + item.minutes, 0) +
      selectedPlan.sessions
        .filter((session) => session.type === 'Reset')
        .reduce((sum, session) => sum + session.minutes, 0)
    : 0;

  const { load } = plan;
  const loadTotal = load.strength + load.conditioning + load.recovery || 1;
  const fill = load.score / 10;
  const segment = (value: number) =>
    `${Math.round((value / loadTotal) * fill * 100)}%` as const;

  const topPad =
    insets.top + (Platform.OS === 'web' ? 67 : 16);

  const bottomPad =
    insets.bottom + (Platform.OS === 'web' ? 34 : 98);

  const toggleTimeline = (item: TimelineItem) => {
    if (item.sessionId) {
      toggleSession(item.sessionId);
    } else {
      toggleDone(item.key);
    }

    Haptics.impactAsync(
      Haptics.ImpactFeedbackStyle.Light,
    );
  };

  const changeEvent = () => {
    cycleEvent();

    Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    );

    Alert.alert(
      'Week adjusted',
      'Training load and fueling emphasis now follow the new event.',
    );
  };

  return (
    <ScrollView
      style={[
        styles.screen,
        { backgroundColor: colors.background },
      ]}
      contentContainerStyle={{
        paddingTop: topPad,
        paddingBottom: bottomPad,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View
            style={[
              styles.brandMark,
              { backgroundColor: colors.primary },
            ]}
          >
            <Feather
              name="activity"
              size={20}
              color={colors.primaryForeground}
            />
          </View>

          <View>
            <Text
              style={[
                styles.eyebrow,
                { color: colors.primary },
              ]}
            >
              PERFORM / WEEK {isoWeek(today).week}
            </Text>

            <Text
              style={[
                styles.headerDate,
                { color: colors.foreground },
              ]}
            >
              {formatLongDate(today)}
            </Text>
          </View>
        </View>

        <Pressable
          testID="profile-button"
          onPress={() => router.push('/profile')}
          style={({ pressed }) => [
            styles.profileButton,
            { backgroundColor: colors.secondary },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.profileLetter,
              { color: colors.primary },
            ]}
          >
            {profile.name.charAt(0).toUpperCase() || 'A'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.weekIntro}>
        <View>
          <Text
            style={[
              styles.eyebrow,
              { color: colors.mutedForeground },
            ]}
          >
            THE WEEK, IN ORDER
          </Text>

          <Text
            style={[
              styles.weekPrompt,
              { color: colors.foreground },
            ]}
          >
            Choose a day to inspect
          </Text>
        </View>

        <Text
          style={[
            styles.month,
            { color: colors.mutedForeground },
          ]}
        >
          {monthShort(selectedDate).toUpperCase()} {selectedDate.getFullYear()}
        </Text>
      </View>

      <View
        style={[
          styles.weekRail,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        {week.map((item) => {
          const selected = selectedDay === item.day;
          const accent = toneColors(item.tone, colors);

          return (
            <Pressable
              testID={`focus-day-${item.day}`}
              key={item.day}
              accessibilityLabel={`${item.day} ${item.date}, ${item.label}`}
              onPress={() => {
                setSelectedDay(item.day);
                Haptics.selectionAsync();
              }}
              style={({ pressed }) => [
                styles.dayButton,
                {
                  backgroundColor: selected
                    ? colors.primary
                    : 'transparent',
                },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.dayLabel,
                  {
                    color: selected
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                  },
                ]}
              >
                {item.day}
              </Text>

              <Text
                style={[
                  styles.dayNumber,
                  {
                    color: selected
                      ? colors.primaryForeground
                      : colors.foreground,
                  },
                ]}
              >
                {item.date}
              </Text>

              <View
                style={[
                  styles.dayDot,
                  {
                    backgroundColor: selected
                      ? colors.primaryForeground
                      : accent,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      {next ? (
        <LinearGradient
          colors={[colors.secondary, colors.card]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.nextCard}
        >
          <View style={styles.nextTop}>
            <View style={styles.nextCopy}>
              <Text
                style={[
                  styles.eyebrow,
                  { color: colors.primary },
                ]}
              >
                NEXT WINDOW
              </Text>

              <Text
                style={[
                  styles.nextTime,
                  { color: colors.foreground },
                ]}
              >
                {next.time}
              </Text>

              <Text
                style={[
                  styles.nextMeta,
                  { color: '#B8C8C0' },
                ]}
              >
                {next.duration} · {next.title}
              </Text>
            </View>

            <View
              style={[
                styles.nextIcon,
                { backgroundColor: colors.primary },
              ]}
            >
              <Feather
                name={windowIcon(next.start)}
                size={24}
                color={colors.primaryForeground}
              />
            </View>
          </View>

          <View
            style={[
              styles.divider,
              { backgroundColor: colors.border },
            ]}
          />

          <Pressable
            testID="wind-down"
            onPress={() => router.push('/plan')}
            style={({ pressed }) => [
              styles.windDown,
              pressed && styles.pressed,
            ]}
          >
            <Feather
              name="moon"
              size={15}
              color={colors.accent}
            />

            <Text
              style={[
                styles.windDownText,
                { color: colors.secondaryForeground },
              ]}
            >
              Protecting your {formatClock(selectedPlan?.lightsOut ? selectedPlan.lightsOut - 30 : plan.sleep.windDown)} wind-down
            </Text>

            <Feather
              name="arrow-right"
              size={15}
              color={colors.primary}
            />
          </Pressable>
        </LinearGradient>
      ) : null}

      <View style={styles.motionHeader}>
        <View>
          <Text
            style={[
              styles.eyebrow,
              { color: colors.mutedForeground },
            ]}
          >
            {selectedDay} / {monthShort(selectedDate).toUpperCase()}{' '}
            {selectedDate.getDate()}
          </Text>

          <Text
            style={[
              styles.motionTitle,
              { color: colors.foreground },
            ]}
          >
            Your day in motion
          </Text>
        </View>

        <Pressable
          testID="recovery-toggle"
          onPress={() => {
            setShowRecovery((current) => !current);
            Haptics.selectionAsync();
          }}
          style={({ pressed }) => [
            styles.iconButton,
            {
              borderColor: showRecovery
                ? colors.accent
                : colors.border,
            },
            pressed && styles.pressed,
          ]}
        >
          <Feather
            name={showRecovery ? 'wind' : 'star'}
            size={15}
            color={
              showRecovery
                ? colors.accent
                : colors.mutedForeground
            }
          />
        </Pressable>
      </View>

      <View style={styles.timeline}>
        <View
          style={[
            styles.timelineLine,
            { backgroundColor: colors.border },
          ]}
        />

        {timeline.map((item) => {
          const accent = toneColors(item.tone, colors);
          const done = isItemDone(item);

          return (
            <Pressable
              testID={`timeline-${item.key}`}
              key={item.key}
              onPress={() => toggleTimeline(item)}
              style={({ pressed }) => [
                styles.timelineItem,
                {
                  backgroundColor: colors.card,
                  borderColor: done
                    ? colors.border
                    : accent,
                },
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.timelineDot,
                  {
                    backgroundColor: done
                      ? colors.primary
                      : accent,
                    borderColor: colors.background,
                  },
                ]}
              >
                {done ? (
                  <Feather
                    name="check"
                    size={12}
                    color={colors.primaryForeground}
                  />
                ) : (
                  <View
                    style={[
                      styles.dotCore,
                      {
                        backgroundColor:
                          colors.primaryForeground,
                      },
                    ]}
                  />
                )}
              </View>

              <View style={styles.timelineCopy}>
                <View style={styles.timelineMeta}>
                  <Text
                    style={[
                      styles.timelineType,
                      { color: accent },
                    ]}
                  >
                    {item.type}
                  </Text>

                  <Text
                    style={[
                      styles.timelineTime,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {item.time} · {item.duration}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.timelineTitle,
                    { color: colors.foreground },
                    done && styles.doneText,
                  ]}
                >
                  {item.title}
                </Text>

                <Text
                  style={[
                    styles.timelineDetail,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {item.detail}
                </Text>
              </View>

              <Feather
                name="chevron-right"
                size={15}
                color={colors.mutedForeground}
              />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.metricRow}>
        <View
          style={[
            styles.loadCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.metricHead}>
            <Feather
              name="activity"
              size={15}
              color={colors.primary}
            />

            <Text
              style={[
                styles.metricLabel,
                { color: colors.mutedForeground },
              ]}
            >
              LOAD
            </Text>
          </View>

          <View style={styles.loadValueRow}>
            <Text
              style={[
                styles.loadValue,
                { color: colors.foreground },
              ]}
            >
              {load.score.toFixed(1)}
            </Text>

            <Text
              style={[
                styles.loadState,
                { color: load.score >= 8.5 ? colors.accent : colors.success },
              ]}
            >
              {load.label}
            </Text>
          </View>

          <View
            style={[
              styles.loadTrack,
              { backgroundColor: colors.secondary },
            ]}
          >
            <View
              style={[
                styles.loadSeg,
                {
                  backgroundColor: colors.primary,
                  width: segment(load.strength),
                },
              ]}
            />

            <View
              style={[
                styles.loadSeg,
                {
                  backgroundColor: colors.accent,
                  width: segment(load.conditioning),
                },
              ]}
            />

            <View
              style={[
                styles.loadSeg,
                {
                  backgroundColor: colors.sky,
                  width: segment(load.recovery),
                },
              ]}
            />
          </View>

          <Text
            style={[
              styles.metricFoot,
              { color: colors.mutedForeground },
            ]}
          >
            {completed} of {sessions.length} sessions complete
          </Text>
        </View>

        <Pressable
          testID="recovery-metric"
          onPress={() =>
            setShowRecovery((current) => !current)
          }
          style={({ pressed }) => [
            styles.recoveryCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.metricHead}>
            <Feather
              name="zap"
              size={15}
              color={colors.accent}
            />

            <Feather
              name="star"
              size={15}
              color={colors.mutedForeground}
            />
          </View>

          <View>
            <Text
              style={[
                styles.recoveryValue,
                { color: colors.foreground },
              ]}
            >
              {showRecovery ? recoveryMinutes : avgMinutes}
            </Text>

            <Text
              style={[
                styles.metricFoot,
                { color: colors.mutedForeground },
              ]}
            >
              {showRecovery
                ? 'recovery minutes'
                : 'avg session minutes'}
            </Text>
          </View>
        </Pressable>
      </View>

      <Pressable
        testID="event-card"
        onPress={changeEvent}
        onLongPress={() => router.push('/plan')}
        style={({ pressed }) => [
          styles.eventCard,
          { backgroundColor: colors.secondary },
          pressed && styles.pressed,
        ]}
      >
        <View
          style={[
            styles.eventIcon,
            { backgroundColor: colors.accent },
          ]}
        >
          <Feather
            name="award"
            size={17}
            color={colors.accentForeground}
          />
        </View>

        <View style={styles.eventCopy}>
          <Text
            style={[
              styles.eventLabel,
              { color: colors.mutedForeground },
            ]}
          >
            {"WEEK'S MAIN EVENT"}
          </Text>

          <Text
            style={[
              styles.eventTitle,
              { color: colors.foreground },
            ]}
          >
            {weekEvent.title}
          </Text>
        </View>

        <Feather
          name="chevron-right"
          size={16}
          color={colors.mutedForeground}
        />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 21,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },

  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 1.5,
  },

  headerDate: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    letterSpacing: -0.7,
    marginTop: 4,
  },

  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileLetter: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },

  weekIntro: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 11,
  },

  weekPrompt: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    marginTop: 5,
  },

  month: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },

  weekRail: {
    marginHorizontal: 20,
    borderRadius: 21,
    borderWidth: 1,
    padding: 7,
    flexDirection: 'row',
    gap: 3,
    marginBottom: 19,
  },

  dayButton: {
    flex: 1,
    minWidth: 42,
    borderRadius: 15,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dayLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 0.5,
  },

  dayNumber: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    marginTop: 6,
  },

  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
  },

  nextCard: {
    marginHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#30463A',
    padding: 20,
    marginBottom: 25,
  },

  nextTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  nextCopy: {
    maxWidth: '72%',
  },

  nextTime: {
    fontFamily: 'Inter_700Bold',
    fontSize: 38,
    letterSpacing: -2,
    marginTop: 10,
  },

  nextMeta: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    marginTop: 7,
  },

  nextIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  divider: {
    height: 1,
    marginTop: 20,
    marginBottom: 15,
  },

  windDown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  windDownText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    flex: 1,
  },

  motionHeader: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 13,
  },

  motionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    letterSpacing: -0.6,
    marginTop: 5,
  },

  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  timeline: {
    marginHorizontal: 20,
    paddingLeft: 15,
    position: 'relative',
    gap: 8,
  },

  timelineLine: {
    position: 'absolute',
    width: 1,
    left: 7,
    top: 16,
    bottom: 16,
  },

  timelineItem: {
    borderRadius: 19,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 76,
  },

  timelineDot: {
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },

  dotCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  timelineCopy: {
    flex: 1,
  },

  timelineMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  timelineType: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.1,
  },

  timelineTime: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
  },

  timelineTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    marginTop: 5,
  },

  timelineDetail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    marginTop: 4,
  },

  doneText: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },

  metricRow: {
    marginHorizontal: 20,
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },

  loadCard: {
    flex: 1.12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 15,
  },

  recoveryCard: {
    flex: 0.88,
    borderRadius: 20,
    borderWidth: 1,
    padding: 15,
    justifyContent: 'space-between',
  },

  metricHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  metricLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.1,
    flex: 1,
  },

  loadValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
    marginTop: 18,
  },

  loadValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 31,
    letterSpacing: -1.5,
  },

  loadState: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    marginBottom: 4,
    flexShrink: 1,
  },

  loadTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    flexDirection: 'row',
    gap: 2,
    marginTop: 16,
  },

  loadSeg: {
    height: 6,
    borderRadius: 3,
  },

  metricFoot: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    marginTop: 10,
  },

  recoveryValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 25,
    marginTop: 28,
  },

  eventCard: {
    marginHorizontal: 20,
    borderRadius: 19,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 13,
  },

  eventIcon: {
    width: 37,
    height: 37,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  eventCopy: {
    flex: 1,
  },

  eventLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.1,
  },

  eventTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    marginTop: 5,
  },

  pressed: {
    opacity: 0.78,
  },
});
