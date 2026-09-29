import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Bullet, Card, Chip, Eyebrow, ScreenHeader, SectionTitle, Stepper, shared, useScreenPadding, useToneColor, type Tone } from '@/components/ui';
import { usePlanner } from '@/context/PlannerContext';
import { useColors } from '@/hooks/useColors';
import { EVENT_ORDER, EVENT_PRESETS, isCompetition, isMatch } from '@/lib/events';
import { LOAD_LABELS } from '@/lib/nutrition';
import { formatClock, fromISODate, hm, monthShort } from '@/lib/time';
import { DAY_KEYS, type PlanDay, type PlanSession } from '@/lib/types';

const toneOf = (color: PlanSession['color']): Tone => (color === 'orange' ? 'apricot' : color === 'blue' ? 'sky' : 'lime');

export default function PlanScreen() {
  const colors = useColors();
  const router = useRouter();
  const padding = useScreenPadding();
  const { plan, weekEvent, setEvent, todayKey } = usePlanner();
  const [open, setOpen] = useState<string | null>(null);

  const monday = fromISODate(plan.weekStart);
  const competition = isCompetition(weekEvent.kind);
  const time = weekEvent.time ?? EVENT_PRESETS[weekEvent.kind].time ?? hm(19);

  const shiftTime = (delta: number) => {
    const next = Math.min(hm(22, 30), Math.max(hm(5), time + delta));
    setEvent(weekEvent.kind, weekEvent.day, next);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={padding}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        eyebrow="PERFORM / PLAN"
        title={`Week of ${monthShort(monday)} ${monday.getDate()}`}
        right={
          <Pressable
            testID="edit-constraints"
            accessibilityLabel="Edit schedule constraints"
            onPress={() => router.push('/profile')}
            style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.secondary }, pressed && shared.pressed]}
          >
            <Feather name="sliders" size={17} color={colors.primary} />
          </Pressable>
        }
      />

      <SectionTitle eyebrow="BUILT AROUND" title={EVENT_PRESETS[weekEvent.kind].label} />
      <Card>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {EVENT_ORDER.map((kind) => (
            <Chip
              key={kind}
              testID={`event-${kind}`}
              label={EVENT_PRESETS[kind].label}
              selected={weekEvent.kind === kind}
              tone={isCompetition(kind) ? 'apricot' : 'lime'}
              onPress={() => setEvent(kind)}
            />
          ))}
        </ScrollView>
        <Text style={[styles.blurb, { color: colors.mutedForeground }]}>{EVENT_PRESETS[weekEvent.kind].blurb}</Text>

        {competition ? (
          <View style={styles.eventControls}>
            <Eyebrow>{isMatch(weekEvent.kind) ? 'MATCH DAY' : 'RACE DAY'}</Eyebrow>
            <View style={styles.dayChips}>
              {DAY_KEYS.map((day) => (
                <Chip
                  key={day}
                  compact
                  testID={`event-day-${day}`}
                  label={day}
                  tone="apricot"
                  selected={weekEvent.day === day}
                  onPress={() => setEvent(weekEvent.kind, day, weekEvent.time)}
                />
              ))}
            </View>
            <Stepper
              testID="event-time"
              label={isMatch(weekEvent.kind) ? 'Kick-off' : 'Start'}
              value={formatClock(time)}
              onDecrement={() => shiftTime(-15)}
              onIncrement={() => shiftTime(15)}
            />
          </View>
        ) : null}
      </Card>

      <SectionTitle eyebrow="SLEEP ANCHOR" title="Protect the night first" />
      <Card>
        <View style={styles.sleepRow}>
          {[
            { label: 'Wake', value: formatClock(plan.sleep.wake), icon: 'sunrise' as const },
            { label: 'Wind-down', value: formatClock(plan.sleep.windDown), icon: 'moon' as const },
            { label: 'Lights out', value: formatClock(plan.sleep.lightsOut), icon: 'power' as const },
          ].map((item) => (
            <View key={item.label} style={styles.sleepCell}>
              <Feather name={item.icon} size={15} color={colors.accent} />
              <Text style={[styles.sleepValue, { color: colors.foreground }]}>{item.value}</Text>
              <Text style={[styles.sleepLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.bullets}>
          {plan.insights.map((line) => (
            <Bullet key={line}>{line}</Bullet>
          ))}
          {plan.warnings.map((line) => (
            <Bullet key={line} tone="apricot">
              {line}
            </Bullet>
          ))}
        </View>
      </Card>

      <SectionTitle eyebrow="THE WEEK" title="Day by day" />
      <View style={styles.days}>
        {plan.days.map((day) => (
          <DayCard
            key={day.day}
            day={day}
            today={day.day === todayKey}
            open={open}
            onToggle={(id) => {
              Haptics.selectionAsync();
              setOpen((current) => (current === id ? null : id));
            }}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function DayCard({
  day,
  today,
  open,
  onToggle,
}: {
  day: PlanDay;
  today: boolean;
  open: string | null;
  onToggle: (id: string) => void;
}) {
  const colors = useColors();
  const tone = useToneColor();
  const { toggleSession } = usePlanner();
  const date = fromISODate(day.date);
  const accent = tone(toneOf(day.color));

  return (
    <Card style={[styles.dayCard, today && { borderColor: colors.primary }]}>
      <View style={styles.dayHead}>
        <View style={[styles.dayBadge, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.dayBadgeDay, { color: colors.mutedForeground }]}>{day.day.toUpperCase()}</Text>
          <Text style={[styles.dayBadgeDate, { color: colors.foreground }]}>{date.getDate()}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={[styles.dayLabel, { color: accent }]}>{day.label.toUpperCase()}</Text>
          <Text style={[styles.dayLoad, { color: colors.mutedForeground }]}>
            {today ? 'Today · ' : ''}
            {LOAD_LABELS[day.load]}
          </Text>
        </View>
      </View>

      {day.sessions.length === 0 ? (
        <Text style={[styles.restLine, { color: colors.mutedForeground }]}>
          {day.micro
            .filter((m) => m.kind !== 'winddown')
            .map((m) => `${m.title} ${formatClock(m.start)}`)
            .join(' · ') || 'Full rest'}
        </Text>
      ) : null}

      {day.sessions.map((session) => {
        const expanded = open === session.id;
        const sessionTone = tone(toneOf(session.color));
        return (
          <View key={session.id} style={styles.session}>
            <Pressable
              testID={`plan-session-${session.id}`}
              onPress={() => onToggle(session.id)}
              style={({ pressed }) => [styles.sessionRow, pressed && shared.pressed]}
            >
              <View style={[styles.sessionBar, { backgroundColor: sessionTone }]} />
              <View style={styles.flex}>
                <Text style={[styles.sessionTime, { color: colors.mutedForeground }]}>
                  {session.time} – {formatClock(session.end)} · {session.duration}
                </Text>
                <Text
                  style={[
                    styles.sessionTitle,
                    { color: colors.foreground },
                    session.completed && styles.done,
                  ]}
                >
                  {session.title}
                </Text>
                <Text style={[styles.sessionFocus, { color: colors.mutedForeground }]}>
                  {session.focus} · RPE {session.intensity}
                </Text>
              </View>
              <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
            </Pressable>

            {expanded ? (
              <View style={[styles.detail, { borderColor: colors.border }]}>
                <Eyebrow>WHY THIS SLOT</Eyebrow>
                <View style={styles.bullets}>
                  {session.why.map((line) => (
                    <Bullet key={line} tone={toneOf(session.color)}>
                      {line}
                    </Bullet>
                  ))}
                </View>
                <Eyebrow>{session.isEvent ? 'GAME PLAN' : 'SESSION'}</Eyebrow>
                <View style={styles.blocks}>
                  {session.blocks.map((block) => (
                    <Text key={block} style={[styles.block, { color: colors.secondaryForeground }]}>
                      {block}
                    </Text>
                  ))}
                </View>
                <Pressable
                  testID={`complete-${session.id}`}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    toggleSession(session.id);
                  }}
                  style={({ pressed }) => [
                    styles.doneButton,
                    { backgroundColor: session.completed ? colors.secondary : colors.primary },
                    pressed && shared.pressed,
                  ]}
                >
                  <Feather
                    name={session.completed ? 'rotate-ccw' : 'check'}
                    size={14}
                    color={session.completed ? colors.primary : colors.primaryForeground}
                  />
                  <Text
                    style={[
                      styles.doneLabel,
                      { color: session.completed ? colors.primary : colors.primaryForeground },
                    ]}
                  >
                    {session.completed ? 'Mark not done' : 'Mark done'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  iconButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chipRow: { gap: 8, paddingRight: 4 },
  blurb: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 12 },
  eventControls: { marginTop: 16, gap: 10 },
  dayChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sleepRow: { flexDirection: 'row', justifyContent: 'space-between' },
  sleepCell: { flex: 1, gap: 5 },
  sleepValue: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.4 },
  sleepLabel: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  divider: { height: 1, marginVertical: 14 },
  bullets: { gap: 9 },
  days: { gap: 10 },
  dayCard: { padding: 13 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  dayBadge: { width: 44, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  dayBadgeDay: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.5 },
  dayBadgeDate: { fontFamily: 'Inter_700Bold', fontSize: 17, marginTop: 2 },
  dayLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  dayLoad: { fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 4 },
  restLine: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 10, marginLeft: 55 },
  session: { marginTop: 10 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  sessionBar: { width: 4, alignSelf: 'stretch', borderRadius: 2, marginLeft: 20, marginRight: 20 },
  sessionTime: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  sessionTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, marginTop: 4 },
  sessionFocus: { fontFamily: 'Inter_400Regular', fontSize: 11.5, marginTop: 3 },
  done: { textDecorationLine: 'line-through', opacity: 0.55 },
  detail: { marginTop: 12, marginLeft: 55, paddingTop: 12, borderTopWidth: 1, gap: 10 },
  blocks: { gap: 6 },
  block: { fontFamily: 'Inter_500Medium', fontSize: 12.5, lineHeight: 18 },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 13,
    paddingVertical: 11,
    marginTop: 4,
  },
  doneLabel: { fontFamily: 'Inter_700Bold', fontSize: 13 },
});
