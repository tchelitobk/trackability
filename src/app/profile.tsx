import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, Chip, Eyebrow, ScreenHeader, SectionTitle, Stepper, shared, useScreenPadding } from '@/components/ui';
import { usePlanner } from '@/context/PlannerContext';
import { useColors } from '@/hooks/useColors';
import { formatClock, hm } from '@/lib/time';
import {
  DAY_KEYS,
  type Chronotype,
  type CommitmentKind,
  type DayKey,
  type DietStyle,
  type Exclusion,
  type Sport,
  type TimeBlock,
} from '@/lib/types';

const SPORTS: { value: Sport; label: string }[] = [
  { value: 'soccer', label: 'Soccer' },
  { value: 'running', label: 'Running' },
  { value: 'hyrox', label: 'HYROX' },
  { value: 'strength', label: 'Strength' },
];

const CHRONOTYPES: { value: Chronotype; label: string }[] = [
  { value: 'early', label: 'Early bird' },
  { value: 'neutral', label: 'In between' },
  { value: 'late', label: 'Night owl' },
];

const DIETS: { value: DietStyle; label: string }[] = [
  { value: 'omnivore', label: 'Everything' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'vegetarian', label: 'Vegetarian' },
];

const EXCLUSIONS: { value: Exclusion; label: string }[] = [
  { value: 'dairy', label: 'Dairy-free' },
  { value: 'gluten', label: 'Gluten-free' },
  { value: 'nuts', label: 'Nut-free' },
];

const KINDS: { value: CommitmentKind; label: string }[] = [
  { value: 'clients', label: 'Clients' },
  { value: 'team', label: 'Team' },
  { value: 'family', label: 'Family' },
  { value: 'other', label: 'Other' },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Nudge one edge of a block without letting it invert. */
const nudge = (block: TimeBlock, edge: 'start' | 'end', delta: number): TimeBlock => {
  if (edge === 'start') return { ...block, start: clamp(block.start + delta, hm(4), block.end - 30) };
  return { ...block, end: clamp(block.end + delta, block.start + 30, hm(23, 30)) };
};

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const padding = useScreenPadding(false);
  const { profile, updateProfile, resetProfile } = usePlanner();

  const [draft, setDraft] = useState({ day: 'Sat' as DayKey, start: hm(8), end: hm(10), label: '', kind: 'clients' as CommitmentKind });

  const toggleDay = (day: DayKey) => {
    const next = profile.availableDays.includes(day)
      ? profile.availableDays.filter((d) => d !== day)
      : [...profile.availableDays, day];
    updateProfile({ availableDays: DAY_KEYS.filter((d) => next.includes(d)) });
  };

  const setWork = (day: DayKey, block: TimeBlock | null) =>
    updateProfile({ work: { ...profile.work, [day]: block } });

  const addCommitment = () => {
    const label = draft.label.trim() || KINDS.find((k) => k.value === draft.kind)!.label;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateProfile({
      commitments: [
        ...profile.commitments,
        { id: `${draft.day}-${Date.now()}`, day: draft.day, start: draft.start, end: draft.end, label, kind: draft.kind },
      ],
    });
    setDraft((current) => ({ ...current, label: '' }));
  };

  const confirmReset = () => {
    const reset = () => {
      resetProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    };
    if (Platform.OS === 'web') {
      reset();
      return;
    }
    Alert.alert('Reset profile?', 'Your schedule, sleep and diet settings go back to the defaults.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: reset },
    ]);
  };

  const hardCount = Math.min(profile.trainingDays, profile.availableDays.length);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={padding}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        eyebrow="PERFORM / PROFILE"
        title="Your constraints"
        right={
          <Pressable
            testID="close-profile"
            accessibilityLabel="Close"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.secondary }, pressed && shared.pressed]}
          >
            <Feather name="x" size={18} color={colors.primary} />
          </Pressable>
        }
      />
      <Text style={[styles.lede, { color: colors.mutedForeground }]}>
        {"The plan rebuilds as you edit. Be honest about shifts and sleep — that's what the schedule protects."}
      </Text>

      <SectionTitle eyebrow="ATHLETE" title="About you" />
      <Card style={styles.stack}>
        <View>
          <Eyebrow>NAME</Eyebrow>
          <TextInput
            testID="name-input"
            value={profile.name}
            onChangeText={(name) => updateProfile({ name })}
            placeholder="Your name"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]}
          />
        </View>
        <View>
          <Eyebrow>SPORT</Eyebrow>
          <View style={[shared.wrap, styles.gapTop]}>
            {SPORTS.map((sport) => (
              <Chip key={sport.value} label={sport.label} selected={profile.sport === sport.value} onPress={() => updateProfile({ sport: sport.value })} />
            ))}
          </View>
        </View>
        <Stepper
          testID="body-weight"
          label="Body weight (drives fueling targets)"
          value={`${profile.bodyWeightLb} lb`}
          onDecrement={() => updateProfile({ bodyWeightLb: clamp(profile.bodyWeightLb - 1, 90, 350) })}
          onIncrement={() => updateProfile({ bodyWeightLb: clamp(profile.bodyWeightLb + 1, 90, 350) })}
        />
      </Card>

      <SectionTitle eyebrow="TRAINING" title="When you can train" />
      <Card style={styles.stack}>
        <View>
          <Eyebrow>OPEN DAYS</Eyebrow>
          <View style={[shared.wrap, styles.gapTop]}>
            {DAY_KEYS.map((day) => (
              <Chip key={day} compact testID={`available-${day}`} label={day} selected={profile.availableDays.includes(day)} onPress={() => toggleDay(day)} />
            ))}
          </View>
        </View>
        <View style={styles.pair}>
          <Stepper
            testID="training-days"
            label="Sessions / week"
            value={`${profile.trainingDays}`}
            onDecrement={() => updateProfile({ trainingDays: clamp(profile.trainingDays - 1, 1, 6) })}
            onIncrement={() => updateProfile({ trainingDays: clamp(profile.trainingDays + 1, 1, 6) })}
          />
          <Stepper
            testID="session-minutes"
            label="Main session"
            value={`${profile.sessionMinutes} min`}
            onDecrement={() => updateProfile({ sessionMinutes: clamp(profile.sessionMinutes - 15, 30, 90) })}
            onIncrement={() => updateProfile({ sessionMinutes: clamp(profile.sessionMinutes + 15, 30, 90) })}
          />
        </View>
        {profile.trainingDays > profile.availableDays.length ? (
          <Text style={[styles.hint, { color: colors.accent }]}>
            Only {profile.availableDays.length} open days — {hardCount} sessions will be scheduled.
          </Text>
        ) : null}
      </Card>

      <SectionTitle eyebrow="SLEEP" title="Anchor the night" />
      <Card style={styles.stack}>
        <View style={styles.pair}>
          <Stepper
            testID="wake-time"
            label="Wake time"
            value={formatClock(profile.wakeTime)}
            onDecrement={() => updateProfile({ wakeTime: clamp(profile.wakeTime - 15, hm(4), hm(10)) })}
            onIncrement={() => updateProfile({ wakeTime: clamp(profile.wakeTime + 15, hm(4), hm(10)) })}
          />
          <Stepper
            testID="sleep-hours"
            label="Sleep need"
            value={`${profile.sleepHours} h`}
            onDecrement={() => updateProfile({ sleepHours: clamp(profile.sleepHours - 0.5, 6, 10) })}
            onIncrement={() => updateProfile({ sleepHours: clamp(profile.sleepHours + 0.5, 6, 10) })}
          />
        </View>
        <View>
          <Eyebrow>WHEN DO YOU FEEL STRONGEST?</Eyebrow>
          <View style={[shared.wrap, styles.gapTop]}>
            {CHRONOTYPES.map((type) => (
              <Chip key={type.value} label={type.label} selected={profile.chronotype === type.value} onPress={() => updateProfile({ chronotype: type.value })} />
            ))}
          </View>
        </View>
      </Card>

      <SectionTitle eyebrow="WORK" title="Shifts + commute" />
      <Card style={styles.stack}>
        <Stepper
          testID="commute"
          label="Commute each way"
          value={`${profile.commuteMinutes} min`}
          onDecrement={() => updateProfile({ commuteMinutes: clamp(profile.commuteMinutes - 5, 0, 120) })}
          onIncrement={() => updateProfile({ commuteMinutes: clamp(profile.commuteMinutes + 5, 0, 120) })}
        />
        <View style={styles.shifts}>
          {DAY_KEYS.map((day) => {
            const block = profile.work[day];
            return (
              <View key={day} style={styles.shiftRow}>
                <Chip
                  compact
                  testID={`work-${day}`}
                  label={day}
                  selected={Boolean(block)}
                  tone="sky"
                  onPress={() => setWork(day, block ? null : { start: hm(9, 30), end: hm(19, 30) })}
                />
                {block ? (
                  <View style={styles.shiftTimes}>
                    <Stepper compact value={formatClock(block.start)} onDecrement={() => setWork(day, nudge(block, 'start', -30))} onIncrement={() => setWork(day, nudge(block, 'start', 30))} />
                    <Stepper compact value={formatClock(block.end)} onDecrement={() => setWork(day, nudge(block, 'end', -30))} onIncrement={() => setWork(day, nudge(block, 'end', 30))} />
                  </View>
                ) : (
                  <Text style={[styles.off, { color: colors.mutedForeground }]}>Off</Text>
                )}
              </View>
            );
          })}
        </View>
      </Card>

      <SectionTitle eyebrow="PROTECTED TIME" title="Family, clients, team" />
      <Card style={styles.stack}>
        <View style={styles.shiftRow}>
          <Chip
            compact
            testID="family-toggle"
            label="Daily family block"
            tone="apricot"
            selected={Boolean(profile.familyBlock)}
            onPress={() => updateProfile({ familyBlock: profile.familyBlock ? null : { start: hm(18), end: hm(19, 30) } })}
          />
        </View>
        {profile.familyBlock ? (
          <View style={styles.pair}>
            <Stepper label="From" value={formatClock(profile.familyBlock.start)} onDecrement={() => updateProfile({ familyBlock: nudge(profile.familyBlock!, 'start', -15) })} onIncrement={() => updateProfile({ familyBlock: nudge(profile.familyBlock!, 'start', 15) })} />
            <Stepper label="To" value={formatClock(profile.familyBlock.end)} onDecrement={() => updateProfile({ familyBlock: nudge(profile.familyBlock!, 'end', -15) })} onIncrement={() => updateProfile({ familyBlock: nudge(profile.familyBlock!, 'end', 15) })} />
          </View>
        ) : (
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Block out bath-and-bedtime (or dinner) and training will never land there.
          </Text>
        )}

        {profile.commitments.map((c) => (
          <View key={c.id} style={[styles.commitment, { borderColor: colors.border }]}>
            <View style={styles.flex}>
              <Text style={[styles.commitmentTitle, { color: colors.foreground }]}>{c.label}</Text>
              <Text style={[styles.commitmentMeta, { color: colors.mutedForeground }]}>
                {c.day} · {formatClock(c.start)} – {formatClock(c.end)}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={`Remove ${c.label}`}
              onPress={() => updateProfile({ commitments: profile.commitments.filter((item) => item.id !== c.id) })}
              style={({ pressed }) => [styles.remove, { backgroundColor: colors.secondary }, pressed && shared.pressed]}
            >
              <Feather name="trash-2" size={14} color={colors.destructive} />
            </Pressable>
          </View>
        ))}

        <View style={[styles.addBox, { borderColor: colors.border }]}>
          <Eyebrow>ADD A COMMITMENT</Eyebrow>
          <View style={shared.wrap}>
            {DAY_KEYS.map((day) => (
              <Chip key={day} compact label={day} tone="apricot" selected={draft.day === day} onPress={() => setDraft((d) => ({ ...d, day }))} />
            ))}
          </View>
          <View style={styles.pair}>
            <Stepper label="From" value={formatClock(draft.start)} onDecrement={() => setDraft((d) => ({ ...d, ...nudge(d, 'start', -30) }))} onIncrement={() => setDraft((d) => ({ ...d, ...nudge(d, 'start', 30) }))} />
            <Stepper label="To" value={formatClock(draft.end)} onDecrement={() => setDraft((d) => ({ ...d, ...nudge(d, 'end', -30) }))} onIncrement={() => setDraft((d) => ({ ...d, ...nudge(d, 'end', 30) }))} />
          </View>
          <View style={shared.wrap}>
            {KINDS.map((kind) => (
              <Chip key={kind.value} compact label={kind.label} tone="apricot" selected={draft.kind === kind.value} onPress={() => setDraft((d) => ({ ...d, kind: kind.value }))} />
            ))}
          </View>
          <TextInput
            testID="commitment-label"
            value={draft.label}
            onChangeText={(label) => setDraft((d) => ({ ...d, label }))}
            placeholder="Label (e.g. Team practice)"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]}
          />
          <Pressable
            testID="add-commitment"
            onPress={addCommitment}
            style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.accent }, pressed && shared.pressed]}
          >
            <Feather name="plus" size={15} color={colors.accentForeground} />
            <Text style={[styles.primaryLabel, { color: colors.accentForeground }]}>Add commitment</Text>
          </Pressable>
        </View>
      </Card>

      <SectionTitle eyebrow="NUTRITION" title="How you eat" />
      <Card style={styles.stack}>
        <View style={shared.wrap}>
          {DIETS.map((diet) => (
            <Chip key={diet.value} label={diet.label} selected={profile.diet === diet.value} onPress={() => updateProfile({ diet: diet.value })} />
          ))}
        </View>
        <View style={shared.wrap}>
          {EXCLUSIONS.map((ex) => (
            <Chip
              key={ex.value}
              label={ex.label}
              tone="apricot"
              selected={profile.exclusions.includes(ex.value)}
              onPress={() =>
                updateProfile({
                  exclusions: profile.exclusions.includes(ex.value)
                    ? profile.exclusions.filter((item) => item !== ex.value)
                    : [...profile.exclusions, ex.value],
                })
              }
            />
          ))}
        </View>
      </Card>

      <Pressable
        testID="reset-profile"
        onPress={confirmReset}
        style={({ pressed }) => [styles.reset, { borderColor: colors.border }, pressed && shared.pressed]}
      >
        <Feather name="rotate-ccw" size={14} color={colors.mutedForeground} />
        <Text style={[styles.resetLabel, { color: colors.mutedForeground }]}>Reset to defaults</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  iconButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  lede: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, paddingHorizontal: 20, marginTop: -8 },
  stack: { gap: 16 },
  gapTop: { marginTop: 9 },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  shifts: { gap: 8 },
  shiftRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shiftTimes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1, justifyContent: 'flex-end' },
  off: { fontFamily: 'Inter_500Medium', fontSize: 12, flex: 1, textAlign: 'right' },
  commitment: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, paddingTop: 12 },
  commitmentTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  commitmentMeta: { fontFamily: 'Inter_500Medium', fontSize: 11.5, marginTop: 3 },
  remove: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  addBox: { borderTopWidth: 1, paddingTop: 14, gap: 12 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 13,
    paddingVertical: 12,
  },
  primaryLabel: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  reset: {
    marginHorizontal: 20,
    marginTop: 22,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resetLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});
