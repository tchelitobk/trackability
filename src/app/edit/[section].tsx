import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
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
import { Button, Eyebrow, shared } from '@/components/ui';
import { type as t } from '@/constants/type';
import { usePlanner } from '@/context/PlannerContext';
import { useColors } from '@/hooks/useColors';

const SECTIONS = {
  event: { eyebrow: 'THIS WEEK', title: 'This week’s focus' },
  about: { eyebrow: 'PROFILE', title: 'About you' },
  work: { eyebrow: 'SCHEDULE', title: 'Work hours' },
  training: { eyebrow: 'SCHEDULE', title: 'Training days' },
  sleep: { eyebrow: 'SCHEDULE', title: 'Sleep' },
  commitments: { eyebrow: 'SCHEDULE', title: 'Fixed commitments' },
  food: { eyebrow: 'NUTRITION', title: 'Food' },
} as const;

type Section = keyof typeof SECTIONS;

export default function EditScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { section: raw } = useLocalSearchParams<{ section: string }>();
  const section: Section = raw && raw in SECTIONS ? (raw as Section) : 'about';
  const { profile, updateProfile, weekEvent, setEvent } = usePlanner();
  const meta = SECTIONS[section];
  const close = () => (router.canGoBack() ? router.back() : router.replace('/you'));

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.top, { paddingTop: Platform.OS === 'ios' ? 18 : insets.top + 14, borderBottomColor: colors.border }]}>
        <View style={styles.flex}>
          <Eyebrow color={colors.accent}>{meta.eyebrow}</Eyebrow>
          <Text style={[t.title, { color: colors.foreground, marginTop: 4 }]}>{meta.title}</Text>
        </View>
        <Pressable
          testID="close-edit"
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={close}
          style={({ pressed }) => [styles.close, { backgroundColor: colors.secondary }, pressed && shared.pressed]}
        >
          <Feather name="x" size={18} color={colors.foreground} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 120 }]} keyboardShouldPersistTaps="handled">
        <Text style={[t.caption, { color: colors.mutedForeground }]}>Changes save as you make them, and your plan rebuilds straight away.</Text>
        {section === 'event' ? <EventStep event={weekEvent} setEvent={setEvent} /> : null}
        {section === 'about' ? <AboutStep profile={profile} update={updateProfile} /> : null}
        {section === 'work' ? <WorkStep profile={profile} update={updateProfile} /> : null}
        {section === 'training' ? <TrainingStep profile={profile} update={updateProfile} /> : null}
        {section === 'sleep' ? <SleepStep profile={profile} update={updateProfile} /> : null}
        {section === 'commitments' ? <CommitmentsStep profile={profile} update={updateProfile} /> : null}
        {section === 'food' ? <FoodStep profile={profile} update={updateProfile} /> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 14, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <Button testID="edit-done" label="Done" onPress={close} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, gap: 12 },
  close: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 22, paddingTop: 18, gap: 28 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
});
