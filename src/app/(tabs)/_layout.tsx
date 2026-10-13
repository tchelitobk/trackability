import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '@/constants/type';
import { useColors } from '@/hooks/useColors';

type IconName = React.ComponentProps<typeof Feather>['name'];

const icon = (name: IconName) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Feather name={name} size={21} color={color} />;
  };

/** The raised centre button: one obvious place to log anything. */
function LogButton() {
  const colors = useColors();
  const router = useRouter();
  return (
    <View style={styles.logSlot}>
      <Pressable
        testID="tab-log"
        accessibilityRole="button"
        accessibilityLabel="Log a session, meal or check-in"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
          router.push('/log');
        }}
        style={({ pressed }) => [styles.logButton, { backgroundColor: colors.primary, shadowColor: colors.primary }, pressed && { transform: [{ scale: 0.96 }] }]}
      >
        <Feather name="plus" size={26} color={colors.primaryForeground} />
      </Pressable>
      <Text style={[styles.logLabel, { color: colors.foreground }]}>Log</Text>
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const web = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 10.5, letterSpacing: 0.3 },
        tabBarStyle: {
          // Native tabs float over content (screens pad for them); web tabs sit below it.
          position: web ? 'relative' : 'absolute',
          backgroundColor: '#0F1110',
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 66 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('sun') }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen
        name="log-action"
        options={{ title: 'Log', tabBarButton: () => <LogButton /> }}
        listeners={{ tabPress: (event) => event.preventDefault() }}
      />
      <Tabs.Screen name="fuel" options={{ title: 'Fuel', tabBarIcon: icon('shopping-bag') }} />
      <Tabs.Screen name="you" options={{ title: 'You', tabBarIcon: icon('user') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  logSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  logButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginTop: -22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  logLabel: { fontFamily: fonts.semibold, fontSize: 10.5, letterSpacing: 0.3, marginTop: 5 },
});
