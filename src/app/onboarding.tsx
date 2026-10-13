import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AboutStep,
  CommitmentsStep,
  EventStep,
  FoodStep,
  SleepStep,
  TrainingStep,
  WorkStep,
} from '@/components/setup';
import { Button, Eyebrow, ProgressBar, shared, type IconName } from '@/components/ui';
import { type as t } from '@/constants/type';
import { usePlanner } from '@/context/PlannerContext';
import { useColors } from '@/hooks/useColors';
import { formatClock } from '@/lib/time';

type Step = {
  key: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  optional?: boolean;
};

const STEPS: Step[] = [
  { key: 'about', eyebrow: 'ABOUT YOU', title: 'Let’s start with you', subtitle: 'This sets your sport-specific sessions and fueling.' },
  { key: 'work', eyebrow: 'WORK', title: 'When are you working?', subtitle: 'Training is planned around your shifts and commute, never on top of them.' },
  { key: 'training', eyebrow: 'TRAINING', title: 'When can you train?', subtitle: 'We pick the best day and time for each session from these.' },
  { key: 'sleep', eyebrow: 'SLEEP', title: 'Protect the night', subtitle: 'Sleep is the anchor. Everything else fits around it.' },
  { key: 'commitments', eyebrow: 'FIXED TIME', title: 'Anything else that’s fixed?', subtitle: 'Clients, team practice, family time. Optional — you can add these later.', optional: true },
  { key: 'event', eyebrow: 'THIS WEEK', title: 'What’s the big thing this week?', subtitle: 'Training load and meals shift to match. Change it any week.' },
  { key: 'food', eyebrow: 'FOOD', title: 'How do you eat?', subtitle: 'Meal prep and your shopping list follow this.' },
];

const PROMISES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'clock', title: 'The right time, every session', body: 'Planned around your shifts, your family and your sleep.' },
  { icon: 'shopping-bag', title: 'Meal prep for your week', body: 'Portions sized to each day’s training, plus one shopping list.' },
  { icon: 'check-circle', title: 'Log anything in one tap', body: 'Sessions, meals and how you slept, from the + Log button.' },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const { profile, updateProfile, weekEvent, setEvent, plan, fuel, completeOnboarding } = usePlanner();
  // -1 = welcome, STEPS.length = ready
  const [index, setIndex] = useState(-1);

  const go = (next: number) => {
    setIndex(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const top = insets.top + (Platform.OS === 'web' ? 24 : 10);
  const bottom = insets.bottom + 16;

  if (index === -1) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={['rgba(212, 241, 113, 0.10)', 'rgba(10, 11, 10, 0)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.6, y: 0.55 }}
        />
        <ScrollView contentContainerStyle={[styles.welcome, { paddingTop: top + 30, paddingBottom: bottom }]}>
          <View style={[styles.mark, { backgroundColor: colors.primary }]}>
            <Feather name="activity" size={22} color={colors.primaryForeground} />
          </View>
          <Eyebrow color={colors.accent} style={{ marginTop: 28 }}>
            PERFORM
          </Eyebrow>
          <Text style={[t.hero, styles.welcomeTitle, { color: colors.foreground }]}>
            Train around{'\n'}your life.
          </Text>
          <Text style={[t.body, { color: colors.mutedForeground, marginTop: 14 }]}>
            For athletes with full-time jobs. Tell us your week once, and we’ll plan when to train, what to eat and when to sleep.
          </Text>
          <View style={styles.promises}>
            {PROMISES.map((p) => (
              <View key={p.title} style={styles.promise}>
                <View style={[styles.promiseIcon, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Feather name={p.icon} size={17} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[t.bodyStrong, { color: colors.foreground }]}>{p.title}</Text>
                  <Text style={[t.caption, { color: colors.mutedForeground, marginTop: 3 }]}>{p.body}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }} />
          <Button testID="start-setup" label="Set up my week" icon="arrow-right" onPress={() => go(0)} />
          <Text style={[t.caption, styles.footnote, { color: colors.mutedForeground }]}>Takes about 2 minutes. Everything can be changed later.</Text>
        </ScrollView>
      </View>
    );
  }

  if (index === STEPS.length) {
    const sessions = plan.days.flatMap((d) => d.sessions.filter((s) => !s.isEvent));
    const first = sessions[0];
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={[styles.welcome, { paddingTop: top + 20, paddingBottom: bottom }]}>
          <View style={[styles.doneBadge, { backgroundColor: colors.primary }]}>
            <Feather name="check" size={26} color={colors.primaryForeground} />
          </View>
          <Text style={[t.hero, styles.welcomeTitle, { color: colors.foreground }]}>Your week is ready.</Text>
          <View style={[styles.stats, { borderColor: colors.border, backgroundColor: colors.card }]}>
            {[
              { value: String(sessions.length), label: 'sessions' },
              { value: formatClock(plan.sleep.lightsOut), label: 'lights out' },
              { value: `${Math.round(fuel.averages.kcal / 50) * 50}`, label: 'kcal / day' },
            ].map((s, i) => (
              <View key={s.label} style={[styles.stat, i > 0 && { borderLeftWidth: 1, borderLeftColor: colors.border }]}>
                <Text style={[t.heading, { color: colors.foreground }]}>{s.value}</Text>
                <Text style={[t.micro, { color: colors.mutedForeground, marginTop: 4 }]}>{s.label}</Text>
              </View>
            ))}
          </View>
          {first ? (
            <Text style={[t.body, { color: colors.secondaryForeground, marginTop: 16 }]}>
              First up: <Text style={{ color: colors.foreground }}>{first.title}</Text> on {first.day} at {first.time}.
            </Text>
          ) : null}

          <Eyebrow style={{ marginTop: 30 }}>HOW TO USE IT</Eyebrow>
          <View style={styles.promises}>
            {[
              { icon: 'sun' as IconName, title: 'Today shows what’s next', body: 'Tap the circle next to anything to check it off.' },
              { icon: 'plus-circle' as IconName, title: 'Tap + Log any time', body: 'Log a session and how hard it felt, a meal, or how you slept.' },
              { icon: 'user' as IconName, title: 'Your week changed?', body: 'Update shifts, days or this week’s event under You. The plan rebuilds instantly.' },
            ].map((p) => (
              <View key={p.title} style={styles.promise}>
                <View style={[styles.promiseIcon, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Feather name={p.icon} size={17} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[t.bodyStrong, { color: colors.foreground }]}>{p.title}</Text>
                  <Text style={[t.caption, { color: colors.mutedForeground, marginTop: 3 }]}>{p.body}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={{ flex: 1, minHeight: 24 }} />
          <Button testID="finish-setup" label="Open my week" icon="arrow-right" onPress={completeOnboarding} />
          <Pressable accessibilityRole="button" onPress={() => go(STEPS.length - 1)} style={({ pressed }) => [styles.backLink, pressed && shared.pressed]}>
            <Text style={[t.label, { color: colors.mutedForeground }]}>Go back</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  const step = STEPS[index];
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: top }]}>
        <Pressable
          testID="setup-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          onPress={() => go(index - 1)}
          style={({ pressed }) => [styles.back, { backgroundColor: colors.secondary }, pressed && shared.pressed]}
        >
          <Feather name="chevron-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={styles.progressWrap}>
          <ProgressBar value={(index + 1) / STEPS.length} height={4} />
          <Text style={[t.micro, { color: colors.mutedForeground, marginTop: 8 }]}>
            Step {index + 1} of {STEPS.length}
          </Text>
        </View>
      </View>

      <ScrollView ref={scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Eyebrow color={colors.accent}>{step.eyebrow}</Eyebrow>
        <Text style={[t.title, { color: colors.foreground, marginTop: 8 }]}>{step.title}</Text>
        <Text style={[t.body, { color: colors.mutedForeground, marginTop: 8, marginBottom: 26 }]}>{step.subtitle}</Text>
        <View style={styles.fields}>
          {step.key === 'about' ? <AboutStep profile={profile} update={updateProfile} /> : null}
          {step.key === 'work' ? <WorkStep profile={profile} update={updateProfile} /> : null}
          {step.key === 'training' ? <TrainingStep profile={profile} update={updateProfile} /> : null}
          {step.key === 'sleep' ? <SleepStep profile={profile} update={updateProfile} /> : null}
          {step.key === 'commitments' ? <CommitmentsStep profile={profile} update={updateProfile} /> : null}
          {step.key === 'event' ? <EventStep event={weekEvent} setEvent={setEvent} /> : null}
          {step.key === 'food' ? <FoodStep profile={profile} update={updateProfile} /> : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottom, borderTopColor: colors.border, backgroundColor: colors.background }]}>
        {step.optional ? <Button variant="ghost" label="Skip" onPress={() => go(index + 1)} style={{ flex: 1 }} /> : null}
        <Button
          testID="setup-continue"
          label={index === STEPS.length - 1 ? 'Build my week' : 'Continue'}
          icon="arrow-right"
          onPress={() => go(index + 1)}
          style={{ flex: 2 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  welcome: { flexGrow: 1, paddingHorizontal: 24 },
  mark: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  welcomeTitle: { marginTop: 12 },
  promises: { marginTop: 22, gap: 18 },
  promise: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  promiseIcon: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  footnote: { textAlign: 'center', marginTop: 12 },
  doneBadge: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', borderWidth: 1, borderRadius: 20, marginTop: 24, paddingVertical: 16 },
  stat: { flex: 1, alignItems: 'center' },
  backLink: { alignSelf: 'center', paddingVertical: 14 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingBottom: 8 },
  back: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  progressWrap: { flex: 1 },
  body: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 40 },
  fields: { gap: 28 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
});
