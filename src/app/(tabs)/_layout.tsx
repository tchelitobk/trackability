import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { Platform, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/hooks/useColors';

type IconName = React.ComponentProps<typeof Feather>['name'];

const icon = (name: IconName) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Feather name={name} size={20} color={color} />;
  };

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const web = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 0.4 },
        tabBarStyle: {
          // Native tabs float over content (screens pad for them); web tabs sit below it.
          position: web ? 'relative' : 'absolute',
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: (web ? 64 : 62) + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('sun') }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="fuel" options={{ title: 'Fuel', tabBarIcon: icon('shopping-bag') }} />
    </Tabs>
  );
}
