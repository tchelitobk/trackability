import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EffortSheet, effortLabel } from '@/components/log';
import { Bullet, Card, CheckCircle, Eyebrow, Header, Screen, SectionTitle, shared, useToneColor, type Tone } from '@/components/ui';
import { type as t } from '@/constants/type';
import { usePlanner } from '@/context/PlannerContext';
import { useColors } from '@/hooks/useColors';
import { EVENT_PRESETS } from '@/lib/events';
import { LOAD_LABELS } from '@/lib/nutrition';
import { addDays, DAY_NAMES, formatClock, fromISODate, monthShort } from '@/lib/time';
import type { PlanDay, PlanSession } from '@/lib/types';

const toneOf = (color: PlanSession['color']): Tone => (color === 'orange' ? 'apricot' : color === 'blue' ? 'sky' : 'lime');

export default function PlanScreen() {
  const colors = useColors();
  const router = useRouter();
  const { plan, weekEvent, todayKey, week, toggleSession, rateSession } = usePlanner();
  const [open, setOpen] = useState<string | null>(null);
  const [allReasons, setAllReasons] = useState(false);
  const [rating, setRating] = useState<PlanSession | null>(null);

  const monday = fromISODate(plan.weekStart);
  const sunday = addDays(monday, 6);
  const reasons = [...plan.warnings.map((w) => ({ text: w, tone: 'apricot' as Tone })), ...plan.insights.map((i) => ({ text: i, tone: 'lime' as Tone }))];
  const shown = allReasons ? reasons : reasons.slice(0, 2);

  const toggle = (session: PlanSession) => {
    const done = Boolean(week.sessions[session.id]);
    toggleSession(session.id);
    if (!done) setRating(session);
  };

  return (
    <Screen testID="plan-screen">
      <Header
        eyebrow={`${monthShort(monday).toUpperCase()} ${monday.getDate()} – ${monthShort(sunday).toUpperCase()} ${sunday.getDate()}`}
        title="Your week"
        subtitle="When to train, and why it’s timed that way."
      />

      <Pressable
        testID="plan-event"
        accessibilityRole="button"
        accessibilityHint="Change what this week is built around"
        onPress={() => router.push('/edit/event')}
        style={({ pressed }) => [styles.event, { backgroundColor: colors.card, borderColor: colors.border }, pressed && shared.pressed]}
      >
        <View style={[styles.eventIcon, { backgroundColor: colors.accentSoft }]}>
          <Feather name="award" size={18} color={colors.accent} />
        </View>
        <View style={styles.flex}>
          <Eyebrow>BUILT AROUND</Eyebrow>
          <Text style={[t.subheading, { color: colors.foreground, marginTop: 4 }]}>{weekEvent.title}</Text>
          <Text style={[t.caption, { color: colors.mutedForeground, marginTop: 2 }]}>{EVENT_PRESETS[weekEvent.kind].blurb}</Text>
        </View>
        <Text style={[t.label, { color: colors.primary }]}>Change</Text>
      </Pressable>

      <Card style={styles.sleep}>
        <View style={styles.sleepRow}>
          {[
            { label: 'Wake', value: formatClock(plan.sleep.wake) },
            { label: 'Wind down', value: formatClock(plan.sleep.windDown) },
            { label: 'Lights out', value: formatClock(plan.sleep.lightsOut) },
          ].map((item, index) => (
            <View key={item.label} style={[styles.sleepCell, index > 0 && { borderLeftWidth: 1, borderLeftColor: colors.border }]}>
              <Text style={[t.heading, { color: colors.foreground }]}>{item.value.replace(':00', '')}</Text>
              <Text style={[t.micro, { color: colors.mutedForeground, marginTop: 3 }]}>{item.label}</Text>
            </View>
          ))}
        </View>
        <Text style={[t.caption, styles.sleepNote, { color: colors.secondaryForeground, borderTopColor: colors.border }]}>
          Hard sessions always finish by {formatClock(plan.sleep.hardCutoff)}, so you can actually fall asleep.
        </Text>
      </Card>

      {reasons.length > 0 ? (
        <Card style={styles.reasons}>
          <Eyebrow>WHY IT LOOKS LIKE THIS</Eyebrow>
          <View style={styles.bullets}>
            {shown.map((r) => (
              <Bullet key={r.text} tone={r.tone}>
                {r.text}
              </Bullet>
            ))}
          </View>
          {reasons.length > 2 ? (
            <Pressable accessibilityRole="button" onPress={() => setAllReasons(!allReasons)} hitSlop={8} style={styles.more}>
              <Text style={[t.label, { color: colors.primary }]}>{allReasons ? 'Show less' : `Show all ${reasons.length}`}</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      <SectionTitle title="Day by day" eyebrow="TAP A SESSION FOR THE WORKOUT" />
      <View style={styles.days}>
        {plan.days.map((day) => (
          <DayBlock
            key={day.day}
            day={day}
            today={day.day === todayKey}
            open={open}
            done={(id) => Boolean(week.sessions[id])}
            effort={(id) => week.sessions[id]?.effort}
            onOpen={(id) => {
              Haptics.selectionAsync().catch(() => undefined);
              setOpen((current) => (current === id ? null : id));
            }}
            onToggle={toggle}
          />
        ))}
      </View>

      <EffortSheet
        visible={Boolean(rating)}
        title={rating?.title ?? ''}
        value={rating ? week.sessions[rating.id]?.effort : undefined}
        onChange={(effort) => rating && rateSession(rating.id, effort)}
        onClose={() => setRating(null)}
      />
    </Screen>
  );
}

function DayBlock({
  day,
  today,
  open,
  done,
  effort,
  onOpen,
  onToggle,
}: {
  day: PlanDay;
  today: boolean;
  open: string | null;
  done: (id: string) => boolean;
  effort: (id: string) => number | undefined;
  onOpen: (id: string) => void;
  onToggle: (session: PlanSession) => void;
}) {
  const colors = useColors();
  const tone = useToneColor();
  const date = fromISODate(day.date);

  return (
    <Card style={[styles.day, today && { borderColor: 'rgba(212,241,113,0.4)' }]}>
      <View style={styles.dayHead}>
        <View style={styles.dayDate}>
          <Text style={[t.micro, { color: today ? colors.primary : colors.mutedForeground, letterSpacing: 0.8 }]}>
            {today ? 'TODAY' : day.day.toUpperCase()}
          </Text>
          <Text style={[t.heading, { color: colors.foreground }]}>{date.getDate()}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={[t.bodyStrong, { color: colors.foreground }]}>{DAY_NAMES[day.day]}</Text>
          <Text style={[t.caption, { color: colors.mutedForeground, marginTop: 1 }]}>{LOAD_LABELS[day.load]}</Text>
        </View>
      </View>

      {day.sessions.length === 0 ? (
        <Text style={[t.caption, styles.rest, { color: colors.mutedForeground, borderTopColor: colors.border }]}>
          No training. {day.micro.filter((m) => m.kind === 'downshift' || m.kind === 'mobility').map((m) => `${m.title} ${formatClock(m.start)}`).join(' · ') || 'Rest and recover.'}
        </Text>
      ) : null}

      {day.sessions.map((session) => {
        const expanded = open === session.id;
        const accent = tone(toneOf(session.color));
        const isDone = done(session.id);
        const rated = effort(session.id);
        return (
          <View key={session.id} style={[styles.session, { borderTopColor: colors.border }]}>
            <View style={styles.sessionRow}>
              <View style={[styles.bar, { backgroundColor: accent }]} />
              <Pressable
                testID={`plan-session-${session.id}`}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() => onOpen(session.id)}
                style={({ pressed }) => [styles.flex, pressed && shared.pressed]}
              >
                <Text style={[t.micro, { color: colors.mutedForeground }]}>
                  {session.time} – {formatClock(session.end)}
                </Text>
                <Text style={[t.subheading, { color: colors.foreground, marginTop: 3 }, isDone && styles.done]}>{session.title}</Text>
                <Text style={[t.caption, { color: colors.mutedForeground, marginTop: 2 }]}>
                  {isDone && rated ? `Logged · felt ${rated}/10 ${effortLabel(rated).toLowerCase()}` : `${session.duration} · effort ${session.intensity}/10`}
                </Text>
                <View style={styles.expandRow}>
                  <Text style={[t.label, { color: accent }]}>{expanded ? 'Hide details' : session.isEvent ? 'Game plan & why' : 'See workout & why'}</Text>
                  <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={accent} />
                </View>
              </Pressable>
              <CheckCircle
                testID={`plan-check-${session.id}`}
                done={isDone}
                tone={toneOf(session.color)}
                label={`${isDone ? 'Undo' : 'Log'} ${session.title}`}
                onPress={() => onToggle(session)}
              />
            </View>

            {expanded ? (
              <View style={[styles.detail, { backgroundColor: colors.secondary }]}>
                <Eyebrow>WHY THIS DAY AND TIME</Eyebrow>
                <View style={styles.bullets}>
                  {session.why.map((line) => (
                    <Bullet key={line} tone={toneOf(session.color)}>
                      {line}
                    </Bullet>
                  ))}
                </View>
                <Eyebrow style={{ marginTop: 6 }}>{session.isEvent ? 'GAME PLAN' : 'THE WORKOUT'}</Eyebrow>
                <View style={styles.blocks}>
                  {session.blocks.map((block) => (
                    <Text key={block} style={[t.body, { color: colors.secondaryForeground }]}>
                      {block}
                    </Text>
                  ))}
                </View>
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
  event: { marginHorizontal: 20, borderRadius: 22, borderWidth: 1, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 13 },
  eventIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sleep: { marginTop: 12, paddingVertical: 16, paddingHorizontal: 0 },
  sleepRow: { flexDirection: 'row' },
  sleepCell: { flex: 1, alignItems: 'center' },
  sleepNote: { borderTopWidth: 1, marginTop: 14, paddingTop: 12, paddingHorizontal: 18, textAlign: 'center' },
  reasons: { marginTop: 12 },
  bullets: { gap: 10, marginTop: 10 },
  more: { marginTop: 12, alignSelf: 'flex-start' },
  days: { gap: 10 },
  day: { paddingVertical: 14 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dayDate: { width: 44, alignItems: 'center' },
  rest: { borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  session: { borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  bar: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginLeft: 20, marginRight: 8 },
  expandRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  done: { textDecorationLine: 'line-through', opacity: 0.5 },
  detail: { borderRadius: 16, padding: 14, marginTop: 12, gap: 4 },
  blocks: { gap: 6, marginTop: 8 },
});
