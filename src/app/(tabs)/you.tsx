import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import {
  aboutSummary,
  commitmentsSummary,
  foodSummary,
  sleepSummary,
  trainingSummary,
  workSummary,
} from '@/components/setup';
import { Avatar, Card, Eyebrow, ListRow, Screen } from '@/components/ui';
import { type as t } from '@/constants/type';
import { usePlanner } from '@/context/PlannerContext';
import { useColors } from '@/hooks/useColors';

export default function YouScreen() {
  const colors = useColors();
  const router = useRouter();
  const { profile, weekEvent, resetProfile, restartOnboarding, resetHints } = usePlanner();
  const edit = (section: string) => router.push(`/edit/${section}`);

  const confirm = (title: string, message: string, action: string, run: () => void) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) run();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: action, style: 'destructive', onPress: run },
    ]);
  };

  return (
    <Screen testID="you-screen">
      <View style={styles.profile}>
        <Avatar name={profile.name} size={68} />
        <View style={styles.flex}>
          <Text style={[t.title, { color: colors.foreground }]}>{profile.name || 'Athlete'}</Text>
          <Text style={[t.caption, { color: colors.mutedForeground, marginTop: 4 }]}>{aboutSummary(profile)}</Text>
        </View>
      </View>

      <Eyebrow style={styles.groupLabel}>THIS WEEK</Eyebrow>
      <Card style={styles.group}>
        <ListRow first testID="edit-event" icon="award" title="Built around" value={weekEvent.title} onPress={() => edit('event')} />
      </Card>

      <Eyebrow style={styles.groupLabel}>YOUR SCHEDULE</Eyebrow>
      <Card style={styles.group}>
        <ListRow first testID="edit-work" icon="briefcase" title="Work hours" value={workSummary(profile)} onPress={() => edit('work')} />
        <ListRow testID="edit-training" icon="activity" title="Training days" value={trainingSummary(profile)} onPress={() => edit('training')} />
        <ListRow testID="edit-sleep" icon="moon" title="Sleep" value={sleepSummary(profile)} onPress={() => edit('sleep')} />
        <ListRow testID="edit-commitments" icon="users" title="Clients, team & family" value={commitmentsSummary(profile)} onPress={() => edit('commitments')} />
      </Card>

      <Eyebrow style={styles.groupLabel}>BODY & FOOD</Eyebrow>
      <Card style={styles.group}>
        <ListRow first testID="edit-about" icon="user" title="About you" value={aboutSummary(profile)} onPress={() => edit('about')} />
        <ListRow testID="edit-food" icon="coffee" title="Food" value={foodSummary(profile)} onPress={() => edit('food')} />
      </Card>

      <Eyebrow style={styles.groupLabel}>HELP</Eyebrow>
      <Card style={styles.group}>
        <ListRow
          first
          icon="compass"
          title="Show the tips again"
          value="The quick guide on Today"
          onPress={() => {
            resetHints();
            router.navigate('/');
          }}
        />
        <ListRow icon="refresh-cw" title="Run setup again" value="Walk through every question from the start" onPress={restartOnboarding} />
        <ListRow
          icon="trash-2"
          title="Reset to defaults"
          destructive
          onPress={() => confirm('Reset everything?', 'Your schedule, sleep and food settings go back to the defaults.', 'Reset', resetProfile)}
        />
      </Card>

      <Text style={[t.micro, styles.footnote, { color: colors.mutedForeground }]}>
        Perform gives general training and nutrition guidance, not medical advice.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, marginBottom: 8 },
  groupLabel: { marginHorizontal: 22, marginTop: 26, marginBottom: 10 },
  group: { paddingVertical: 2 },
  footnote: { textAlign: 'center', marginTop: 26, marginHorizontal: 30 },
});
